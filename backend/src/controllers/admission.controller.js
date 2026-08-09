// backend/src/controllers/admission.controller.js
const { PrismaClient } = require('@prisma/client')
const { generateAdmissionNo } = require('../services/id-generator.service')
const { sendResponse, sendError } = require('../utils/response.utils')

const prisma = new PrismaClient()

// ─── Admit Patient ─────────────────────────────────────
const admitPatient = async (req, res) => {
  try {
    const {
      visitId,
      bedId,
      wardId,
      admissionReason,
      admittingDoctorId
    } = req.body

    if (!visitId || !bedId || !wardId) {
      return sendError(res, 400, 'visitId, bedId, wardId required')
    }

    // Check bed availability
    const bed = await prisma.bed.findUnique({
      where: { id: bedId },
      include: { room: { include: { ward: true } } }
    })

    if (!bed) return sendError(res, 404, 'Bed not found')
    if (bed.status !== 'AVAILABLE') {
      return sendError(res, 409, `Bed is ${bed.status}`)
    }

    // Get visit
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        patient: true,
        admission: true
      }
    })

    if (!visit) return sendError(res, 404, 'Visit not found')
    if (visit.admission) {
      return sendError(res, 409, 'Patient already admitted', {
        admissionId: visit.admission.id
      })
    }

    const admissionNumber = await generateAdmissionNo()

    const admission = await prisma.$transaction(async (tx) => {
      // Create admission
      const adm = await tx.admission.create({
        data: {
          admissionNumber,
          patientId: visit.patientId,
          visitId,
          wardId,
          bedId,
          admissionReason,
          admittingDoctorId: admittingDoctorId || req.user.id,
          status: 'ACTIVE'
        }
      })

      // Mark bed as occupied
      await tx.bed.update({
        where: { id: bedId },
        data: { status: 'OCCUPIED' }
      })

      // Update patient type
      await tx.patient.update({
        where: { id: visit.patientId },
        data: { patientType: 'INPATIENT' }
      })

      // Update visit type to IPD
      await tx.visit.update({
        where: { id: visitId },
        data: { visitType: 'IPD' }
      })

      return adm
    })

    // Fetch complete admission
    const complete = await prisma.admission.findUnique({
      where: { id: admission.id },
      include: {
        patient: {
          select: {
            id: true, mrn: true,
            firstName: true, lastName: true,
            gender: true, dateOfBirth: true,
            bloodGroup: true, allergies: true
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
            }
          }
        }
      }
    })

    // Notify ward nurses
    const io = req.app.get('io')
    io.to('role:NURSE').emit('admission:new', {
      admissionId: admission.id,
      admissionNumber,
      patientName: `${visit.patient.firstName} ${visit.patient.lastName}`,
      wardId,
      bedId,
      bedNumber: bed.bedNumber
    })
    io.to('role:CLINICAL_COORDINATOR').emit('admission:new', {
      admissionId: admission.id,
      admissionNumber
    })

    // Emit bed status change
    io.emit('bed:status_changed', {
      bedId,
      status: 'OCCUPIED',
      admissionId: admission.id
    })

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'ADMIT',
        module: 'ADMISSION',
        recordId: admission.id,
        newValues: { admissionNumber, wardId, bedId },
        ipAddress: req.ip
      }
    })

    return sendResponse(res, 201, 'Patient admitted successfully', {
      admission: complete
    })
  } catch (error) {
    console.error('Admission error:', error)
    return sendError(res, 500, 'Failed to admit patient', error.message)
  }
}

// ─── Get Active Admissions ─────────────────────────────
const getAdmissions = async (req, res) => {
  try {
    const {
      status = 'ACTIVE', wardId,
      page = 1, limit = 20, search
    } = req.query

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where = {}
    if (status) where.status = status
    if (wardId) where.wardId = wardId

    if (search) {
      where.OR = [
        { admissionNumber: { contains: search, mode: 'insensitive' } },
        { patient: { firstName: { contains: search, mode: 'insensitive' } } },
        { patient: { lastName: { contains: search, mode: 'insensitive' } } },
        { patient: { mrn: { contains: search, mode: 'insensitive' } } }
      ]
    }

    const [admissions, total] = await Promise.all([
      prisma.admission.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { admittedAt: 'desc' },
        include: {
          patient: {
            select: {
              id: true, mrn: true,
              firstName: true, lastName: true,
              gender: true, dateOfBirth: true,
              photo: true, bloodGroup: true,
              allergies: true
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
                take: 1,
                include: {
                  doctor: {
                    select: { firstName: true, lastName: true }
                  }
                }
              },
              labOrders: {
                where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
                select: { id: true, status: true, priority: true }
              },
              prescriptions: {
                where: { status: { in: ['PENDING', 'VERIFIED'] } },
                select: { id: true, status: true }
              }
            }
          }
        }
      }),
      prisma.admission.count({ where })
    ])

    // Calculate length of stay for each
    const admissionsWithLOS = admissions.map(adm => {
      const los = Math.ceil(
        (new Date() - new Date(adm.admittedAt)) / (1000 * 60 * 60 * 24)
      )
      return { ...adm, lengthOfStay: los }
    })

    return sendResponse(res, 200, 'Admissions fetched', {
      admissions: admissionsWithLOS,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch admissions', error.message)
  }
}

// ─── Get Bed Map ───────────────────────────────────────
const getBedMap = async (req, res) => {
  try {
    const { wardId } = req.query

    const where = { isActive: true }
    if (wardId) where.id = wardId

    const wards = await prisma.ward.findMany({
      where,
      include: {
        department: { select: { name: true } },
        rooms: {
          where: { isActive: true },
          include: {
            beds: {
              where: { isActive: true },
              include: {
                admissions: {
                  where: { status: 'ACTIVE' },
                  include: {
                    patient: {
                      select: {
                        id: true, mrn: true,
                        firstName: true, lastName: true,
                        gender: true, dateOfBirth: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    // Build summary stats
    const stats = wards.reduce((acc, ward) => {
      const allBeds = ward.rooms.flatMap(r => r.beds)
      acc.total += allBeds.length
      acc.available += allBeds.filter(b => b.status === 'AVAILABLE').length
      acc.occupied += allBeds.filter(b => b.status === 'OCCUPIED').length
      acc.reserved += allBeds.filter(b => b.status === 'RESERVED').length
      acc.maintenance += allBeds.filter(
        b => b.status === 'MAINTENANCE'
      ).length
      return acc
    }, { total: 0, available: 0, occupied: 0, reserved: 0, maintenance: 0 })

    stats.occupancyRate = stats.total > 0
      ? ((stats.occupied / stats.total) * 100).toFixed(1)
      : 0

    return sendResponse(res, 200, 'Bed map fetched', { wards, stats })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch bed map', error.message)
  }
}

// ─── Discharge Patient ─────────────────────────────────
const dischargePatient = async (req, res) => {
  try {
    const { id } = req.params
    const {
      dischargeNotes,
      dischargeType,  // HOME, TRANSFER, AGAINST_ADVICE, DECEASED
      followUpDate,
      followUpInstructions
    } = req.body

    const admission = await prisma.admission.findUnique({
      where: { id },
      include: { patient: true, bed: true, visit: true }
    })

    if (!admission) return sendError(res, 404, 'Admission not found')
    if (admission.status !== 'ACTIVE') {
      return sendError(res, 400, 'Patient is not currently admitted')
    }

    await prisma.$transaction(async (tx) => {
      // Update admission
      await tx.admission.update({
        where: { id },
        data: {
          status: dischargeType === 'DECEASED' ? 'DECEASED' : 'DISCHARGED',
          dischargedAt: new Date(),
          dischargeNotes,
          dischargeType
        }
      })

      // Free the bed
      await tx.bed.update({
        where: { id: admission.bedId },
        data: { status: 'CLEANING' }
      })

      // Close the visit
      await tx.visit.update({
        where: { id: admission.visitId },
        data: {
          status: 'COMPLETED',
          dischargedAt: new Date()
        }
      })

      // Update patient type
      await tx.patient.update({
        where: { id: admission.patientId },
        data: {
          patientType: dischargeType === 'DECEASED'
            ? 'OUTPATIENT'
            : 'OUTPATIENT'
        }
      })
    })

    // Emit events
    const io = req.app.get('io')
    io.emit('bed:status_changed', {
      bedId: admission.bedId,
      status: 'CLEANING'
    })
    io.emit('admission:discharged', {
      admissionId: id,
      patientName: `${admission.patient.firstName} ${admission.patient.lastName}`
    })

    // If deceased → auto trigger mortuary workflow
    if (dischargeType === 'DECEASED') {
      io.to('role:MORTUARY_OFFICER').emit('mortuary:admission_required', {
        patientId: admission.patientId,
        patientName: `${admission.patient.firstName} ${admission.patient.lastName}`,
        mrn: admission.patient.mrn
      })
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'DISCHARGE',
        module: 'ADMISSION',
        recordId: id,
        newValues: { dischargeType, dischargeNotes },
        ipAddress: req.ip
      }
    })

    return sendResponse(res, 200, 'Patient discharged successfully')
  } catch (error) {
    return sendError(res, 500, 'Failed to discharge patient', error.message)
  }
}

// ─── Update Bed Status ─────────────────────────────────
const updateBedStatus = async (req, res) => {
  try {
    const { bedId } = req.params
    const { status, notes } = req.body

    const validStatuses = ['AVAILABLE', 'RESERVED', 'MAINTENANCE', 'CLEANING', 'ISOLATION']
    if (!validStatuses.includes(status)) {
      return sendError(res, 400, `Status must be one of: ${validStatuses.join(', ')}`)
    }

    const bed = await prisma.bed.update({
      where: { id: bedId },
      data: { status, notes }
    })

    const io = req.app.get('io')
    io.emit('bed:status_changed', { bedId, status })

    return sendResponse(res, 200, 'Bed status updated', { bed })
  } catch (error) {
    return sendError(res, 500, 'Failed to update bed', error.message)
  }
}

// ─── Transfer Patient ──────────────────────────────────
const transferPatient = async (req, res) => {
  try {
    const { id } = req.params
    const { newBedId, newWardId, reason } = req.body

    const admission = await prisma.admission.findUnique({
      where: { id }
    })

    if (!admission) return sendError(res, 404, 'Admission not found')

    const newBed = await prisma.bed.findUnique({ where: { id: newBedId } })
    if (!newBed || newBed.status !== 'AVAILABLE') {
      return sendError(res, 409, 'New bed not available')
    }

    await prisma.$transaction(async (tx) => {
      // Free old bed
      await tx.bed.update({
        where: { id: admission.bedId },
        data: { status: 'CLEANING' }
      })

      // Occupy new bed
      await tx.bed.update({
        where: { id: newBedId },
        data: { status: 'OCCUPIED' }
      })

      // Update admission
      await tx.admission.update({
        where: { id },
        data: {
          bedId: newBedId,
          wardId: newWardId || admission.wardId
        }
      })

      // Log the transfer
      await tx.progressNote.create({
        data: {
          visitId: admission.visitId,
          authorId: req.user.id,
          noteType: 'TRANSFER',
          note: `Patient transferred from bed ${admission.bedId} to ${newBedId}. Reason: ${reason || 'Not specified'}`
        }
      })
    })

    const io = req.app.get('io')
    io.emit('bed:status_changed', { bedId: admission.bedId, status: 'CLEANING' })
    io.emit('bed:status_changed', { bedId: newBedId, status: 'OCCUPIED' })

    return sendResponse(res, 200, 'Patient transferred successfully')
  } catch (error) {
    return sendError(res, 500, 'Failed to transfer patient', error.message)
  }
}

// ─── Record Admission Vital Signs ─────────────────────
const recordAdmissionVitals = async (req, res) => {
  try {
    const { admissionId } = req.params
    const vitalsData = req.body

    const vital = await prisma.admissionVitalSign.create({
      data: {
        admissionId,
        ...vitalsData,
        recordedById: req.user.id,
        recordedAt: new Date()
      }
    })

    // Alert on critical values
    const alerts = []
    if (vitalsData.oxygenSaturation && vitalsData.oxygenSaturation < 90) {
      alerts.push('CRITICAL: SpO2 below 90%')
    }
    if (vitalsData.bloodPressureSystolic > 180) {
      alerts.push('CRITICAL: Systolic BP > 180mmHg')
    }

    if (alerts.length > 0) {
      const io = req.app.get('io')
      io.to('role:DOCTOR').emit('vitals:critical', {
        admissionId, alerts, vital
      })
    }

    return sendResponse(res, 201, 'Vitals recorded', { vital, alerts })
  } catch (error) {
    return sendError(res, 500, 'Failed to record vitals', error.message)
  }
}

module.exports = {
  admitPatient,
  getAdmissions,
  getBedMap,
  dischargePatient,
  updateBedStatus,
  transferPatient,
  recordAdmissionVitals
}