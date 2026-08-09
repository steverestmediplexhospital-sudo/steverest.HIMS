// backend/src/controllers/consultation.controller.js
const { PrismaClient } = require('@prisma/client')
const { sendResponse, sendError } = require('../utils/response.utils')

const prisma = new PrismaClient()

// ─── Create/Update SOAP Consultation ──────────────────
const createConsultation = async (req, res) => {
  try {
    const {
      visitId,
      // S - Subjective
      subjective,
      // O - Objective
      objective,
      generalExamination,
      systemicExamination,
      // A - Assessment
      assessment,
      primaryDiagnosis,
      primaryIcdCode,
      secondaryDiagnosis,
      secondaryIcdCode,
      // P - Plan
      plan,
      admitPatient,
      referPatient,
      referralNote,
      followUpDate,
      followUpNotes,
      sickLeaveDays,
      sickLeaveFrom,
      sickLeaveTo,
      clinicalNotes
    } = req.body

    if (!visitId) return sendError(res, 400, 'Visit ID required')

    // Check visit exists
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        patient: {
          include: { allergies: true, chronicConditions: true }
        },
        triage: true,
        vitalSigns: {
          orderBy: { recordedAt: 'desc' },
          take: 1
        }
      }
    })

    if (!visit) return sendError(res, 404, 'Visit not found')

    // Check if consultation already exists for this visit by this doctor
    const existing = await prisma.consultation.findFirst({
      where: { visitId, doctorId: req.user.id }
    })

    let consultation
    if (existing) {
      consultation = await prisma.consultation.update({
        where: { id: existing.id },
        data: {
          subjective,
          objective,
          generalExamination,
          systemicExamination,
          assessment,
          plan,
          primaryDiagnosis,
          primaryIcdCode,
          secondaryDiagnosis,
          secondaryIcdCode,
          admitPatient: admitPatient || false,
          referPatient: referPatient || false,
          referralNote,
          followUpDate: followUpDate ? new Date(followUpDate) : null,
          followUpNotes,
          sickLeaveDays: sickLeaveDays ? parseInt(sickLeaveDays) : null,
          sickLeaveFrom: sickLeaveFrom ? new Date(sickLeaveFrom) : null,
          sickLeaveTo: sickLeaveTo ? new Date(sickLeaveTo) : null,
          clinicalNotes,
          updatedAt: new Date()
        },
        include: {
          doctor: {
            select: {
              id: true, firstName: true,
              lastName: true, role: true
            }
          }
        }
      })
    } else {
      consultation = await prisma.consultation.create({
        data: {
          visitId,
          doctorId: req.user.id,
          subjective,
          objective,
          generalExamination,
          systemicExamination,
          assessment,
          plan,
          primaryDiagnosis,
          primaryIcdCode,
          secondaryDiagnosis,
          secondaryIcdCode,
          admitPatient: admitPatient || false,
          referPatient: referPatient || false,
          referralNote,
          followUpDate: followUpDate ? new Date(followUpDate) : null,
          followUpNotes,
          sickLeaveDays: sickLeaveDays ? parseInt(sickLeaveDays) : null,
          sickLeaveFrom: sickLeaveFrom ? new Date(sickLeaveFrom) : null,
          sickLeaveTo: sickLeaveTo ? new Date(sickLeaveTo) : null,
          clinicalNotes
        },
        include: {
          doctor: {
            select: {
              id: true, firstName: true,
              lastName: true, role: true
            }
          }
        }
      })
    }

    // Handle admission order
    if (admitPatient) {
      const io = req.app.get('io')
      io.emit('admission:requested', {
        visitId,
        patientId: visit.patientId,
        patientName: `${visit.patient.firstName} ${visit.patient.lastName}`,
        diagnosis: primaryDiagnosis,
        doctorName: `${req.user.firstName} ${req.user.lastName}`
      })

      // Notify clinical coordinator and nurses
      io.to('role:CLINICAL_COORDINATOR').emit('admission:requested', {
        visitId,
        consultationId: consultation.id
      })
      io.to('role:NURSE').emit('admission:requested', {
        visitId,
        consultationId: consultation.id
      })
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: existing ? 'UPDATE' : 'CREATE',
        module: 'CONSULTATION',
        recordId: consultation.id,
        newValues: { visitId, primaryDiagnosis },
        ipAddress: req.ip
      }
    })

    return sendResponse(
      res,
      existing ? 200 : 201,
      `Consultation ${existing ? 'updated' : 'saved'} successfully`,
      { consultation }
    )
  } catch (error) {
    console.error('Consultation error:', error)
    return sendError(res, 500, 'Failed to save consultation', error.message)
  }
}

// ─── Get Consultation by Visit ─────────────────────────
const getConsultationByVisit = async (req, res) => {
  try {
    const { visitId } = req.params

    const consultations = await prisma.consultation.findMany({
      where: { visitId },
      include: {
        doctor: {
          select: {
            id: true, firstName: true,
            lastName: true, role: true,
            department: { select: { name: true } }
          }
        },
        visit: {
          include: {
            patient: {
              select: {
                id: true, mrn: true,
                firstName: true, lastName: true,
                dateOfBirth: true, gender: true,
                bloodGroup: true,
                allergies: true,
                chronicConditions: true
              }
            },
            triage: true,
            vitalSigns: {
              orderBy: { recordedAt: 'desc' },
              take: 1
            }
          }
        }
      },
      orderBy: { consultationDate: 'desc' }
    })

    return sendResponse(res, 200, 'Consultations fetched', { consultations })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch consultations', error.message)
  }
}

// ─── Get Doctor's Queue ────────────────────────────────
const getDoctorQueue = async (req, res) => {
  try {
    const doctorId = req.user.id
    const today = new Date()
    const startOfDay = new Date(today.setHours(0, 0, 0, 0))
    const endOfDay = new Date(today.setHours(23, 59, 59, 999))

    // Triaged patients waiting for doctor
    const waitingPatients = await prisma.visit.findMany({
      where: {
        status: 'ACTIVE',
        visitDate: { gte: startOfDay, lte: endOfDay },
        triage: { isNot: null },
        consultations: { none: {} }
      },
      include: {
        patient: {
          select: {
            id: true, mrn: true,
            firstName: true, lastName: true,
            gender: true, dateOfBirth: true,
            photo: true, allergies: true
          }
        },
        triage: true,
        vitalSigns: {
          orderBy: { recordedAt: 'desc' },
          take: 1
        }
      },
      orderBy: [
        { triage: { triageLevel: 'asc' } },
        { visitDate: 'asc' }
      ]
    })

    // Doctor's consultations today
    const myConsultations = await prisma.consultation.findMany({
      where: {
        doctorId,
        consultationDate: { gte: startOfDay, lte: endOfDay }
      },
      include: {
        visit: {
          include: {
            patient: {
              select: {
                id: true, mrn: true,
                firstName: true, lastName: true,
                gender: true, dateOfBirth: true
              }
            },
            triage: true
          }
        }
      },
      orderBy: { consultationDate: 'desc' }
    })

    // Active inpatients under this doctor
    const myInpatients = await prisma.admission.findMany({
      where: {
        status: 'ACTIVE',
        admittingDoctorId: doctorId
      },
      include: {
        patient: {
          select: {
            id: true, mrn: true,
            firstName: true, lastName: true,
            gender: true, dateOfBirth: true
          }
        },
        ward: true,
        bed: true,
        visit: {
          include: {
            vitalSigns: {
              orderBy: { recordedAt: 'desc' },
              take: 1
            },
            labOrders: {
              where: { status: { in: ['COMPLETED'] } },
              include: {
                items: {
                  where: { status: 'COMPLETED' },
                  include: { result: true, labTest: true }
                }
              }
            }
          }
        }
      }
    })

    // Pending lab results for doctor's patients
    const pendingResults = await prisma.labOrder.findMany({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        visit: {
          consultations: {
            some: { doctorId }
          }
        }
      },
      include: {
        visit: {
          include: {
            patient: {
              select: { firstName: true, lastName: true, mrn: true }
            }
          }
        },
        items: {
          include: { labTest: true }
        }
      }
    })

    const stats = {
      waiting: waitingPatients.length,
      seen: myConsultations.length,
      inpatients: myInpatients.length,
      pendingResults: pendingResults.length,
      immediate: waitingPatients.filter(
        v => v.triage?.triageLevel === 'IMMEDIATE'
      ).length,
      urgent: waitingPatients.filter(
        v => v.triage?.triageLevel === 'URGENT'
      ).length
    }

    return sendResponse(res, 200, "Doctor's queue fetched", {
      waitingPatients,
      myConsultations,
      myInpatients,
      pendingResults,
      stats
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch doctor queue', error.message)
  }
}

// ─── Get Single Consultation ───────────────────────────
const getConsultationById = async (req, res) => {
  try {
    const { id } = req.params

    const consultation = await prisma.consultation.findUnique({
      where: { id },
      include: {
        doctor: {
          select: {
            id: true, firstName: true,
            lastName: true, role: true
          }
        },
        visit: {
          include: {
            patient: {
              include: {
                allergies: true,
                chronicConditions: true
              }
            },
            triage: true,
            vitalSigns: {
              orderBy: { recordedAt: 'desc' },
              take: 1
            },
            labOrders: {
              include: {
                items: {
                  include: { labTest: true, result: true }
                }
              }
            },
            prescriptions: {
              include: {
                items: { include: { drug: true } }
              }
            },
            admission: {
              include: { ward: true, bed: true }
            }
          }
        }
      }
    })

    if (!consultation) return sendError(res, 404, 'Consultation not found')

    return sendResponse(res, 200, 'Consultation fetched', { consultation })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch consultation', error.message)
  }
}

// ─── Get Patient History ───────────────────────────────
const getPatientHistory = async (req, res) => {
  try {
    const { patientId } = req.params

    const consultations = await prisma.consultation.findMany({
      where: {
        visit: { patientId }
      },
      include: {
        doctor: {
          select: {
            firstName: true, lastName: true,
            role: true,
            department: { select: { name: true } }
          }
        },
        visit: {
          select: {
            visitNumber: true,
            visitType: true,
            visitDate: true,
            triage: true
          }
        }
      },
      orderBy: { consultationDate: 'desc' }
    })

    return sendResponse(res, 200, 'Patient history fetched', { consultations })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch history', error.message)
  }
}

module.exports = {
  createConsultation,
  getConsultationByVisit,
  getDoctorQueue,
  getConsultationById,
  getPatientHistory
}