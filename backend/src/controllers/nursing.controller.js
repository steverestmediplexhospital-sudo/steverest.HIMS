// backend/src/controllers/nursing.controller.js
const { PrismaClient } = require('@prisma/client')
const { sendResponse, sendError } = require('../utils/response.utils')

const prisma = new PrismaClient()

// ─── Triage Patient ────────────────────────────────────
const triagePatient = async (req, res) => {
  try {
    const {
      visitId, triageLevel, chiefComplaint,
      arrivalMode, notes
    } = req.body

    if (!visitId || !triageLevel || !chiefComplaint) {
      return sendError(res, 400, 'visitId, triageLevel, chiefComplaint required')
    }

    // Check if already triaged
    const existing = await prisma.triage.findUnique({ where: { visitId } })
    if (existing) {
      // Update instead
      const triage = await prisma.triage.update({
        where: { visitId },
        data: { triageLevel, chiefComplaint, arrivalMode, notes }
      })
      return sendResponse(res, 200, 'Triage updated', { triage })
    }

    const triage = await prisma.triage.create({
      data: {
        visitId,
        triageLevel,
        chiefComplaint,
        arrivalMode,
        notes,
        nurseId: req.user.id
      }
    })

    // Update visit status
    await prisma.visit.update({
      where: { id: visitId },
      data: {
        status: triageLevel === 'IMMEDIATE' ? 'ACTIVE' : 'ACTIVE',
        chiefComplaint
      }
    })

    // Emit for doctor queue update
    const io = req.app.get('io')
    io.emit('triage:completed', {
      visitId,
      triageLevel,
      chiefComplaint,
      nurseId: req.user.id
    })

    // Critical triage alert
    if (triageLevel === 'IMMEDIATE') {
      io.emit('emergency:alert', {
        visitId,
        message: 'IMMEDIATE triage - Patient needs urgent attention',
        triageLevel
      })
    }

    return sendResponse(res, 201, 'Triage recorded', { triage })
  } catch (error) {
    console.error('Triage error:', error)
    return sendError(res, 500, 'Failed to record triage', error.message)
  }
}

// ─── Create Nursing Assessment ─────────────────────────
const createNursingAssessment = async (req, res) => {
  try {
    const {
      visitId, assessment, carePlan, notes, shift
    } = req.body

    if (!visitId) return sendError(res, 400, 'Visit ID required')

    const nursingAssessment = await prisma.nursingAssessment.create({
      data: {
        visitId,
        nurseId: req.user.id,
        assessment,
        carePlan,
        notes,
        shift: shift || getCurrentShift()
      },
      include: {
        nurse: { select: { firstName: true, lastName: true } },
        visit: {
          include: {
            patient: {
              select: { firstName: true, lastName: true, mrn: true }
            }
          }
        }
      }
    })

    // Notify doctor
    const io = req.app.get('io')
    io.emit('nursing:assessment_complete', {
      visitId,
      assessmentId: nursingAssessment.id
    })

    return sendResponse(res, 201, 'Nursing assessment saved', { nursingAssessment })
  } catch (error) {
    return sendError(res, 500, 'Failed to save assessment', error.message)
  }
}

// ─── Add Nursing Note ──────────────────────────────────
const addNursingNote = async (req, res) => {
  try {
    const {
      visitId, admissionId,
      noteType, observations,
      interventions, patientResponse,
      handoverToId, handoverNotes,
      shift
    } = req.body

    if (!observations) return sendError(res, 400, 'Observations required')
    if (!visitId && !admissionId) {
      return sendError(res, 400, 'Either visitId or admissionId required')
    }

    const note = await prisma.nursingNote.create({
      data: {
        visitId,
        admissionId,
        nurseId: req.user.id,
        shift: shift || getCurrentShift(),
        noteType: noteType || 'PROGRESS',
        observations,
        interventions,
        patientResponse,
        handoverToId,
        handoverNotes
      }
    })

    if (handoverToId) {
      const io = req.app.get('io')
      io.to(handoverToId).emit('nursing:handover', {
        noteId: note.id,
        from: req.user.id,
        visitId,
        admissionId
      })
    }

    return sendResponse(res, 201, 'Nursing note saved', { note })
  } catch (error) {
    return sendError(res, 500, 'Failed to save note', error.message)
  }
}

// ─── Create Care Plan ──────────────────────────────────
const createCarePlan = async (req, res) => {
  try {
    const {
      admissionId, nursingDiagnosis,
      relatedFactor, goals,
      interventions, reviewDate
    } = req.body

    if (!admissionId || !nursingDiagnosis) {
      return sendError(res, 400, 'Admission ID and nursing diagnosis required')
    }

    const carePlan = await prisma.carePlan.create({
      data: {
        admissionId,
        nurseId: req.user.id,
        nursingDiagnosis,
        relatedFactor,
        goals: goals || [],
        interventions: interventions || [],
        reviewDate: reviewDate ? new Date(reviewDate) : null
      }
    })

    return sendResponse(res, 201, 'Care plan created', { carePlan })
  } catch (error) {
    return sendError(res, 500, 'Failed to create care plan', error.message)
  }
}

// ─── Update Care Plan Evaluation ──────────────────────
const updateCarePlan = async (req, res) => {
  try {
    const { id } = req.params
    const { evaluation, isActive, goals, interventions } = req.body

    const carePlan = await prisma.carePlan.update({
      where: { id },
      data: { evaluation, isActive, goals, interventions, updatedAt: new Date() }
    })

    return sendResponse(res, 200, 'Care plan updated', { carePlan })
  } catch (error) {
    return sendError(res, 500, 'Failed to update care plan', error.message)
  }
}

// ─── Record Fluid Balance ──────────────────────────────
const recordFluidBalance = async (req, res) => {
  try {
    const {
      admissionId, period, periodDate,
      oralIntake, ivFluids, bloodProducts,
      ngTube, urine, stool, vomit,
      drain, bloodLoss, notes
    } = req.body

    if (!admissionId) return sendError(res, 400, 'Admission ID required')

    // Calculate totals
    const totalIntake = (
      parseFloat(oralIntake || 0) +
      parseFloat(ivFluids || 0) +
      parseFloat(bloodProducts || 0) +
      parseFloat(ngTube || 0)
    ).toFixed(2)

    const totalOutput = (
      parseFloat(urine || 0) +
      parseFloat(stool || 0) +
      parseFloat(vomit || 0) +
      parseFloat(drain || 0) +
      parseFloat(bloodLoss || 0)
    ).toFixed(2)

    const netBalance = (parseFloat(totalIntake) - parseFloat(totalOutput)).toFixed(2)

    const fluidBalance = await prisma.fluidBalance.create({
      data: {
        admissionId,
        recordedById: req.user.id,
        period: period || getCurrentShift(),
        periodDate: periodDate ? new Date(periodDate) : new Date(),
        oralIntake: oralIntake ? parseFloat(oralIntake) : null,
        ivFluids: ivFluids ? parseFloat(ivFluids) : null,
        bloodProducts: bloodProducts ? parseFloat(bloodProducts) : null,
        ngTube: ngTube ? parseFloat(ngTube) : null,
        totalIntake: parseFloat(totalIntake),
        urine: urine ? parseFloat(urine) : null,
        stool: stool ? parseFloat(stool) : null,
        vomit: vomit ? parseFloat(vomit) : null,
        drain: drain ? parseFloat(drain) : null,
        bloodLoss: bloodLoss ? parseFloat(bloodLoss) : null,
        totalOutput: parseFloat(totalOutput),
        netBalance: parseFloat(netBalance),
        notes
      }
    })

    return sendResponse(res, 201, 'Fluid balance recorded', {
      fluidBalance,
      summary: { totalIntake, totalOutput, netBalance }
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to record fluid balance', error.message)
  }
}

// ─── Get Nursing Queue ─────────────────────────────────
const getNursingQueue = async (req, res) => {
  try {
    // Active visits that need triage or nursing assessment
    const pendingTriage = await prisma.visit.findMany({
      where: {
        status: 'ACTIVE',
        triage: null,
        visitDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      },
      include: {
        patient: {
          select: {
            id: true, mrn: true,
            firstName: true, lastName: true,
            gender: true, dateOfBirth: true
          }
        }
      },
      orderBy: { visitDate: 'asc' }
    })

    // Active admissions in nurse's ward
    const activeAdmissions = await prisma.admission.findMany({
      where: { status: 'ACTIVE' },
      include: {
        patient: {
          select: {
            id: true, mrn: true,
            firstName: true, lastName: true,
            gender: true, dateOfBirth: true
          }
        },
        ward: true,
        bed: { include: { room: true } },
        visit: {
          include: {
            triage: true,
            vitalSigns: {
              orderBy: { recordedAt: 'desc' },
              take: 1
            },
            consultations: {
              orderBy: { consultationDate: 'desc' },
              take: 1
            }
          }
        }
      }
    })

    // Pending doctor orders (lab, prescriptions)
    const pendingOrders = await prisma.labOrder.findMany({
      where: {
        status: 'PENDING',
        visit: {
          visitDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
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
        items: { include: { labTest: true } }
      }
    })

    return sendResponse(res, 200, 'Nursing queue fetched', {
      pendingTriage,
      activeAdmissions,
      pendingOrders,
      stats: {
        awaitingTriage: pendingTriage.length,
        activePatients: activeAdmissions.length,
        pendingLabOrders: pendingOrders.length
      }
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch nursing queue', error.message)
  }
}

// ─── Record Medication Administration ─────────────────
const recordMedicationAdmin = async (req, res) => {
  try {
    const {
      admissionId, drugName, dose,
      route, administeredAt, notes
    } = req.body

    if (!admissionId || !drugName || !dose || !route) {
      return sendError(res, 400, 'admissionId, drugName, dose, route required')
    }

    const medAdmin = await prisma.medicationAdministration.create({
      data: {
        admissionId,
        drugName,
        dose,
        route,
        administeredAt: administeredAt ? new Date(administeredAt) : new Date(),
        administeredById: req.user.id,
        notes
      }
    })

    return sendResponse(res, 201, 'Medication administration recorded', { medAdmin })
  } catch (error) {
    return sendError(res, 500, 'Failed to record medication admin', error.message)
  }
}

// ─── Get Admission Nursing Data ─────────────────────────
const getAdmissionNursingData = async (req, res) => {
  try {
    const { admissionId } = req.params

    const [carePlans, nursingNotes, fluidBalance, medAdmin, vitals] = await Promise.all([
      prisma.carePlan.findMany({
        where: { admissionId },
        orderBy: { startDate: 'desc' }
      }),
      prisma.nursingNote.findMany({
        where: { admissionId },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.fluidBalance.findMany({
        where: { admissionId },
        orderBy: { recordedAt: 'desc' },
        take: 10
      }),
      prisma.medicationAdministration.findMany({
        where: { admissionId },
        orderBy: { administeredAt: 'desc' }
      }),
      prisma.admissionVitalSign.findMany({
        where: { admissionId },
        orderBy: { recordedAt: 'desc' },
        take: 20
      })
    ])

    return sendResponse(res, 200, 'Nursing data fetched', {
      carePlans,
      nursingNotes,
      fluidBalance,
      medAdmin,
      vitals
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch nursing data', error.message)
  }
}

// ─── Helper: Get Current Shift ─────────────────────────
const getCurrentShift = () => {
  const hour = new Date().getHours()
  if (hour >= 7 && hour < 15) return 'MORNING'
  if (hour >= 15 && hour < 23) return 'AFTERNOON'
  return 'NIGHT'
}

module.exports = {
  triagePatient,
  createNursingAssessment,
  addNursingNote,
  createCarePlan,
  updateCarePlan,
  recordFluidBalance,
  getNursingQueue,
  recordMedicationAdmin,
  getAdmissionNursingData
}