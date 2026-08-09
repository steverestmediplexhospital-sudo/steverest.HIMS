// backend/src/controllers/visit.controller.js
// backend/src/controllers/visit.controller.js
// ✅ FIXED: global.prisma, correct sendSuccess/sendError signatures

const getPrisma          = () => global.prisma
const { generateVisitNo } = require('../services/id-generator.service')
const { sendSuccess, sendError } = require('../utils/response.utils')

// ─── Create Visit ──────────────────────────────────────────────────────────────
const createVisit = async (req, res) => {
  try {
    const prisma = getPrisma()
    const {
      patientId,
      visitType      = 'OPD',
      chiefComplaint,
      notes,
      department,       // accepted but not stored (no field in schema)
      assignedDoctorId  // accepted but not stored (no doctorId on Visit)
    } = req.body

    if (!patientId) return sendError(res, 'Patient ID is required', 400)

    // Verify patient exists
    const patient = await prisma.patient.findUnique({ where: { id: patientId } })
    if (!patient) return sendError(res, 'Patient not found', 404)

    // Check for already-active visit
    const activeVisit = await prisma.visit.findFirst({
      where: { patientId, status: 'ACTIVE' }
    })
    if (activeVisit) {
      return sendError(res,
        `Patient already has an active visit (${activeVisit.visitNumber})`,
        409
      )
    }

    const visitNumber = await generateVisitNo()

    const visit = await prisma.visit.create({
      data: {
        visitNumber,
        patientId,
        visitType,
        chiefComplaint: chiefComplaint || null,
        status:         'ACTIVE',
        notes:          notes          || null
      },
      include: {
        patient: {
          select: {
            id: true, mrn: true,
            firstName: true, lastName: true,
            gender: true, dateOfBirth: true,
            phone: true, bloodGroup: true,
            allergies: true
          }
        }
      }
    })

    // Update patient type to match visit type
    const patientTypeMap = {
      IPD:       'INPATIENT',
      EMERGENCY: 'EMERGENCY',
      ANTENATAL: 'ANTENATAL',
      OPD:       'OUTPATIENT',
      SURGERY:   'INPATIENT',
    }
    const newPatientType = patientTypeMap[visitType]
    if (newPatientType) {
      await prisma.patient.update({
        where: { id: patientId },
        data:  { patientType: newPatientType }
      }).catch(() => {}) // non-blocking
    }

    // Real-time events
    const io = req.app.get('io')
    if (io) {
      const eventData = {
        visitId:     visit.id,
        visitNumber,
        patientName: `${patient.firstName} ${patient.lastName}`,
        visitType
      }
      io.emit('visit:created', eventData)

      if (visitType === 'OPD' || visitType === 'EMERGENCY') {
        io.to('role:NURSE').emit('triage:pending', {
          ...eventData, chiefComplaint
        })
      }
    }

    // Audit log — non-blocking
    prisma.auditLog.create({
      data: {
        userId:    req.user?.id || 'system',
        action:    'CREATE',
        module:    'VISIT',
        recordId:  visit.id,
        newValues: { visitNumber, visitType, patientId }
      }
    }).catch(() => {})

    return sendSuccess(res, { visit }, 'Visit created successfully', 201)

  } catch (error) {
    console.error('createVisit error:', error)
    return sendError(res, 'Failed to create visit: ' + error.message, 500)
  }
}

// ─── Get All Visits ────────────────────────────────────────────────────────────
const getVisits = async (req, res) => {
  try {
    const prisma = getPrisma()
    const {
      page      = 1,
      limit     = 20,
      status,
      visitType,
      patientId,
      date,
      search
    } = req.query

    const skip  = (parseInt(page) - 1) * parseInt(limit)
    const where = {}

    if (status)    where.status    = status
    if (visitType) where.visitType = visitType
    if (patientId) where.patientId = patientId

    if (date) {
      const d = new Date(date)
      if (!isNaN(d.getTime())) {
        where.visitDate = {
          gte: new Date(new Date(date).setHours(0,  0,  0,   0)),
          lte: new Date(new Date(date).setHours(23, 59, 59, 999))
        }
      }
    }

    if (search) {
      where.OR = [
        { visitNumber: { contains: search, mode: 'insensitive' } },
        { patient: { firstName: { contains: search, mode: 'insensitive' } } },
        { patient: { lastName:  { contains: search, mode: 'insensitive' } } },
        { patient: { mrn:       { contains: search, mode: 'insensitive' } } }
      ]
    }

    const [visits, total] = await Promise.all([
      prisma.visit.findMany({
        where,
        skip,
        take:     parseInt(limit),
        orderBy:  { visitDate: 'desc' },
        include: {
          patient: {
            select: {
              id: true, mrn: true,
              firstName: true, lastName: true,
              gender: true, dateOfBirth: true,
              phone: true, photo: true
            }
          },
          triage:    true,
          vitalSigns: {
            orderBy: { recordedAt: 'desc' },
            take: 1
          },
          consultations: {
            include: {
              doctor: {
                select: { id: true, firstName: true, lastName: true }
              }
            },
            orderBy:  { consultationDate: 'desc' },
            take: 1
          },
          admission: {
            include: { ward: true, bed: true }
          }
        }
      }),
      prisma.visit.count({ where })
    ])

    return sendSuccess(res, {
      visits,
      pagination: {
        page:  parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }, 'Visits fetched')

  } catch (error) {
    console.error('getVisits error:', error)
    return sendError(res, 'Failed to fetch visits: ' + error.message, 500)
  }
}

// ─── Get Visit by ID ───────────────────────────────────────────────────────────
const getVisitById = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { id } = req.params

    const visit = await prisma.visit.findFirst({
      where: { OR: [{ id }, { visitNumber: id }] },
      include: {
        patient: {
          include: {
            allergies:         true,
            chronicConditions: true
          }
        },
        triage:    true,
        vitalSigns: { orderBy: { recordedAt: 'desc' } },
        consultations: {
          include: {
            doctor: {
              select: {
                id: true, firstName: true, lastName: true,
                role: true
              }
            }
          },
          orderBy: { consultationDate: 'desc' }
        },
        nursingAssessments: {
          include: {
            nurse: { select: { firstName: true, lastName: true } }
          },
          orderBy: { assessedAt: 'desc' }
        },
        labOrders: {
          include: {
            items: {
              include: {
                labTest: true,
                result:  true
              }
            }
          },
          orderBy: { orderedAt: 'desc' }
        },
        prescriptions: {
          include: {
            prescribedBy: {
              select: { firstName: true, lastName: true }
            },
            items: {
              include: { drug: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        radiologyOrders: {
          include: {
            service: true,
            report:  true
          },
          orderBy: { orderedAt: 'desc' }
        },
        admission: {
          include: {
            ward: true,
            bed:  { include: { room: true } }
          }
        },
        surgeries:     { orderBy: { createdAt: 'desc' } },
        progressNotes: { orderBy: { createdAt: 'desc' } },
        paymentSlips:  true
      }
    })

    if (!visit) return sendError(res, 'Visit not found', 404)

    return sendSuccess(res, { visit }, 'Visit fetched')

  } catch (error) {
    console.error('getVisitById error:', error)
    return sendError(res, 'Failed to fetch visit: ' + error.message, 500)
  }
}

// ─── Close / Discharge Visit ───────────────────────────────────────────────────
const closeVisit = async (req, res) => {
  try {
    const prisma  = getPrisma()
    const { id }  = req.params
    const { notes } = req.body

    const existing = await prisma.visit.findUnique({ where: { id } })
    if (!existing) return sendError(res, 'Visit not found', 404)

    const visit = await prisma.visit.update({
      where: { id },
      data: {
        status:       'COMPLETED',
        dischargedAt: new Date(),
        notes:        notes
          ? `${existing.notes || ''}\n${notes}`.trim()
          : existing.notes
      }
    })

    // Restore patient to outpatient
    await prisma.patient.update({
      where: { id: visit.patientId },
      data:  { patientType: 'OUTPATIENT' }
    }).catch(() => {})

    const io = req.app.get('io')
    if (io) io.emit('visit:completed', { visitId: id })

    return sendSuccess(res, { visit }, 'Visit closed')

  } catch (error) {
    return sendError(res, 'Failed to close visit: ' + error.message, 500)
  }
}

// ─── Record Vital Signs ────────────────────────────────────────────────────────
const recordVitals = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { id } = req.params
    const {
      bloodPressureSystolic,
      bloodPressureDiastolic,
      temperature,
      pulse,
      respiratoryRate,
      oxygenSaturation,
      weight,
      height,
      painScore
    } = req.body

    // Verify visit exists
    const visit = await prisma.visit.findUnique({ where: { id } })
    if (!visit) return sendError(res, 'Visit not found', 404)

    // Auto-calculate BMI
    let bmi = null
    if (weight && height) {
      const hm = parseFloat(height) / 100
      bmi = parseFloat((parseFloat(weight) / (hm * hm)).toFixed(1))
    }

    const vital = await prisma.vitalSign.create({
      data: {
        visitId:               id,
        bloodPressureSystolic:  bloodPressureSystolic  ? parseInt(bloodPressureSystolic)  : null,
        bloodPressureDiastolic: bloodPressureDiastolic ? parseInt(bloodPressureDiastolic) : null,
        temperature:            temperature            ? parseFloat(temperature)           : null,
        pulse:                  pulse                  ? parseInt(pulse)                   : null,
        respiratoryRate:        respiratoryRate        ? parseInt(respiratoryRate)         : null,
        oxygenSaturation:       oxygenSaturation       ? parseFloat(oxygenSaturation)      : null,
        weight:                 weight                 ? parseFloat(weight)                : null,
        height:                 height                 ? parseFloat(height)                : null,
        bmi:                    bmi,
        painScore:              painScore              ? parseInt(painScore)               : null,
        recordedById:           req.user?.id           || null
      }
    })

    // Critical alerts
    const alerts = []
    if (oxygenSaturation && parseFloat(oxygenSaturation) < 90)
      alerts.push({ type: 'CRITICAL', message: 'Critical: SpO₂ below 90%' })
    if (bloodPressureSystolic && parseInt(bloodPressureSystolic) > 180)
      alerts.push({ type: 'CRITICAL', message: 'Critical: Systolic BP > 180 mmHg' })
    if (temperature && parseFloat(temperature) > 39.5)
      alerts.push({ type: 'WARNING',  message: 'High fever: Temperature > 39.5°C' })
    if (pulse && (parseInt(pulse) > 120 || parseInt(pulse) < 50))
      alerts.push({ type: 'WARNING',  message: 'Abnormal pulse rate' })

    if (alerts.length > 0) {
      const io = req.app.get('io')
      if (io) io.emit('vitals:alert', { visitId: id, alerts, vital })
    }

    return sendSuccess(res, { vital, alerts }, 'Vitals recorded', 201)

  } catch (error) {
    return sendError(res, 'Failed to record vitals: ' + error.message, 500)
  }
}

// ─── Add Progress Note ─────────────────────────────────────────────────────────
const addProgressNote = async (req, res) => {
  try {
    const prisma  = getPrisma()
    const { id }  = req.params
    const { noteType, note } = req.body

    if (!noteType) return sendError(res, 'noteType is required', 400)
    if (!note)     return sendError(res, 'note content is required', 400)

    const progressNote = await prisma.progressNote.create({
      data: {
        visitId:  id,
        authorId: req.user?.id || 'system',
        noteType,
        note
      }
    })

    return sendSuccess(res, { progressNote }, 'Progress note added', 201)

  } catch (error) {
    return sendError(res, 'Failed to add note: ' + error.message, 500)
  }
}

// ─── Get Today's Visits (Dashboard / OPD Queue) ───────────────────────────────
const getTodayVisits = async (req, res) => {
  try {
    const prisma    = getPrisma()
    const today     = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0,  0,  0)
    const endOfDay   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)

    const visits = await prisma.visit.findMany({
      where: {
        visitDate: { gte: startOfDay, lte: endOfDay }
      },
      include: {
        patient: {
          select: {
            id: true, mrn: true,
            firstName: true, lastName: true,
            gender: true, dateOfBirth: true,
            photo: true
          }
        },
        triage:    true,
        vitalSigns: {
          orderBy: { recordedAt: 'desc' },
          take: 1
        }
      },
      orderBy: { visitDate: 'asc' }
    })

    const stats = {
      total:          visits.length,
      opd:            visits.filter(v => v.visitType === 'OPD').length,
      emergency:      visits.filter(v => v.visitType === 'EMERGENCY').length,
      ipd:            visits.filter(v => v.visitType === 'IPD').length,
      completed:      visits.filter(v => v.status === 'COMPLETED').length,
      active:         visits.filter(v => v.status === 'ACTIVE').length,
      awaitingTriage: visits.filter(v => v.status === 'ACTIVE' && !v.triage).length
    }

    return sendSuccess(res, { visits, stats }, "Today's visits fetched")

  } catch (error) {
    console.error('getTodayVisits error:', error)
    return sendError(res, "Failed to fetch today's visits: " + error.message, 500)
  }
}

// ─── Get Visit Stats (for dashboard cards) ────────────────────────────────────
const getVisitStats = async (req, res) => {
  try {
    const prisma     = getPrisma()
    const today      = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    const [todayTotal, todayOPD, todayEmergency, activeAdmissions] = await Promise.all([
      prisma.visit.count({ where: { visitDate: { gte: startOfDay } } }),
      prisma.visit.count({ where: { visitDate: { gte: startOfDay }, visitType: 'OPD' } }),
      prisma.visit.count({ where: { visitDate: { gte: startOfDay }, visitType: 'EMERGENCY' } }),
      prisma.admission.count({ where: { status: 'ACTIVE' } })
    ])

    return sendSuccess(res, {
      todayTotal,
      todayOPD,
      todayEmergency,
      activeAdmissions
    }, 'Visit stats fetched')

  } catch (error) {
    return sendError(res, 'Failed to fetch stats: ' + error.message, 500)
  }
}

module.exports = {
  createVisit,
  getVisits,
  getVisitById,
  closeVisit,
  recordVitals,
  addProgressNote,
  getTodayVisits,
  getVisitStats
}