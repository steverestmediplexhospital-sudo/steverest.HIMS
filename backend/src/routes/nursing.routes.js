// backend/src/routes/nursing.routes.js
const router         = require('express').Router()
const authMiddleware = require('../middleware/auth.middleware')

router.use(authMiddleware)

const getPrisma = () => global.prisma

// ── Helper ────────────────────────────────────────────────────────────────────
const getCurrentShift = () => {
  const h = new Date().getHours()
  if (h >= 7  && h < 15) return 'MORNING'
  if (h >= 15 && h < 23) return 'EVENING'
  return 'NIGHT'
}

const getShiftTimes = (shiftType) => {
  const shifts = {
    MORNING: { label: 'Morning',  start: '07:00', end: '15:00' },
    EVENING: { label: 'Evening',  start: '15:00', end: '23:00' },
    NIGHT:   { label: 'Night',    start: '23:00', end: '07:00' }
  }
  return shifts[shiftType] || shifts.MORNING
}

// ─── Triage ───────────────────────────────────────────────────────────────────
router.post('/triage', async (req, res) => {
  try {
    const prisma = getPrisma()
    const { visitId, triageLevel, chiefComplaint, arrivalMode, notes } = req.body

    if (!visitId || !triageLevel || !chiefComplaint) {
      return res.status(400).json({
        success: false,
        message: 'visitId, triageLevel, chiefComplaint required'
      })
    }

    const existing = await prisma.triage.findUnique({ where: { visitId } })
    let triage
    if (existing) {
      triage = await prisma.triage.update({
        where: { visitId },
        data:  { triageLevel, chiefComplaint, arrivalMode, notes }
      })
    } else {
      triage = await prisma.triage.create({
        data: { visitId, triageLevel, chiefComplaint, arrivalMode, notes, nurseId: req.user?.id }
      })
    }

    await prisma.visit.update({
      where: { id: visitId },
      data:  { status: 'ACTIVE', chiefComplaint }
    })

    const io = req.app.get('io')
    if (io) {
      io.emit('triage:completed', { visitId, triageLevel, chiefComplaint })
      if (triageLevel === 'IMMEDIATE') {
        io.emit('emergency:alert', { visitId, message: 'IMMEDIATE triage', triageLevel })
      }
    }

    return res.status(existing ? 200 : 201).json({
      success: true,
      message: existing ? 'Triage updated' : 'Triage recorded',
      data: { triage }
    })
  } catch (error) {
    console.error('Triage error:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
})

// ─── Nursing Queue ────────────────────────────────────────────────────────────
router.get('/queue', async (req, res) => {
  try {
    const prisma     = getPrisma()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [pendingTriage, activeAdmissions] = await Promise.all([
      prisma.visit.findMany({
        where: { status: 'ACTIVE', triage: null, visitDate: { gte: todayStart } },
        include: {
          patient: {
            select: { id: true, mrn: true, firstName: true, lastName: true, gender: true, dateOfBirth: true }
          }
        },
        orderBy: { visitDate: 'asc' }
      }),

      prisma.admission.findMany({
        where: { status: 'ACTIVE' },
        include: {
          patient: {
            select: { id: true, mrn: true, firstName: true, lastName: true, gender: true, dateOfBirth: true, bloodGroup: true }
          },
          ward: true,
          bed:  { include: { room: { include: { ward: true } } } },
          visit: {
            include: {
              triage:     true,
              vitalSigns: { orderBy: { recordedAt: 'desc' }, take: 1 },
              consultations: {
                orderBy: { consultationDate: 'desc' },
                take: 1,
                include: { doctor: { select: { firstName: true, lastName: true } } }
              },
              prescriptions: { where: { status: { in: ['PENDING', 'VERIFIED'] } }, select: { id: true, status: true } }
            }
          },
          medicationAdministrations: { orderBy: { administeredAt: 'desc' }, take: 5 },
          nurseAssignments: {
            where:   { isActive: true },
            include: { shift: { include: { nurse: { select: { id: true, firstName: true, lastName: true } } } } }
          }
        },
        orderBy: { admittedAt: 'asc' }
      })
    ])

    return res.json({
      success: true,
      data: {
        pendingTriage,
        activeAdmissions,
        stats: { awaitingTriage: pendingTriage.length, activePatients: activeAdmissions.length }
      }
    })
  } catch (error) {
    console.error('Nursing queue error:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
})

// ─── Assessments ──────────────────────────────────────────────────────────────
router.get('/assessments', async (req, res) => {
  try {
    const prisma = getPrisma()
    const { visitId, page = 1, limit = 20 } = req.query
    const skip  = (parseInt(page) - 1) * parseInt(limit)
    const where = visitId ? { visitId } : {}

    const assessments = await prisma.nursingAssessment.findMany({
      where,
      include: {
        visit: { include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } } } },
        nurse: { select: { firstName: true, lastName: true } }
      },
      orderBy: { assessedAt: 'desc' },
      skip,
      take: parseInt(limit)
    })

    return res.json({ success: true, data: assessments })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})

router.post('/assessments', async (req, res) => {
  try {
    const prisma = getPrisma()
    const { visitId, assessment, carePlan, notes, shift } = req.body

    if (!visitId) return res.status(400).json({ success: false, message: 'visitId required' })

    const nursingAssessment = await prisma.nursingAssessment.create({
      data: { visitId, nurseId: req.user?.id, assessment, carePlan, notes, shift: shift || getCurrentShift() },
      include: {
        nurse: { select: { firstName: true, lastName: true } },
        visit: { include: { patient: { select: { firstName: true, lastName: true, mrn: true } } } }
      }
    })

    const io = req.app.get('io')
    if (io) io.emit('nursing:assessment_complete', { visitId })

    return res.status(201).json({ success: true, message: 'Assessment saved', data: { nursingAssessment } })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})

// ─── Vitals ───────────────────────────────────────────────────────────────────
router.get('/vitals/:visitId', async (req, res) => {
  try {
    const prisma = getPrisma()
    const vitals = await prisma.vitalSign.findMany({
      where:   { visitId: req.params.visitId },
      orderBy: { recordedAt: 'desc' }
    })
    return res.json({ success: true, data: vitals })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})

router.post('/vitals', async (req, res) => {
  try {
    const prisma = getPrisma()
    const {
      visitId,
      bloodPressureSystolic, bloodPressureDiastolic,
      temperature, pulse, respiratoryRate,
      oxygenSaturation, weight, height,
      painScore, bmi, notes, recordedAt
    } = req.body

    if (!visitId) return res.status(400).json({ success: false, message: 'visitId required' })

    const calcBmi = bmi || ((weight && height)
      ? parseFloat((weight / ((height / 100) ** 2)).toFixed(1))
      : null)

    const vitals = await prisma.vitalSign.create({
      data: {
        visitId,
        bloodPressureSystolic:  bloodPressureSystolic  ? parseInt(bloodPressureSystolic)  : null,
        bloodPressureDiastolic: bloodPressureDiastolic ? parseInt(bloodPressureDiastolic) : null,
        temperature:            temperature            ? parseFloat(temperature)           : null,
        pulse:                  pulse                  ? parseInt(pulse)                   : null,
        respiratoryRate:        respiratoryRate        ? parseInt(respiratoryRate)         : null,
        oxygenSaturation:       oxygenSaturation       ? parseFloat(oxygenSaturation)      : null,
        weight:                 weight                 ? parseFloat(weight)                : null,
        height:                 height                 ? parseFloat(height)                : null,
        bmi:                    calcBmi,
        painScore:              painScore              ? parseInt(painScore)               : null,
        notes:                  notes                  || null,
        recordedById:           req.user?.id,
        recordedAt:             recordedAt             ? new Date(recordedAt)              : new Date()
      }
    })

    const io = req.app.get('io')
    if (io) {
      const alerts = []
      if (oxygenSaturation && parseFloat(oxygenSaturation) < 90) alerts.push('CRITICAL: SpO2 below 90%')
      if (bloodPressureSystolic && parseInt(bloodPressureSystolic) > 180) alerts.push('CRITICAL: Systolic BP > 180mmHg')
      if (pulse && (parseInt(pulse) < 40 || parseInt(pulse) > 150)) alerts.push(`CRITICAL: Heart rate ${pulse} bpm`)
      if (alerts.length > 0) io.to('role:DOCTOR').emit('vitals:critical', { visitId, alerts, vital: vitals })
    }

    return res.status(201).json({ success: true, message: 'Vitals recorded', data: { vitals } })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})

// ─── Medication Administration ────────────────────────────────────────────────
router.post('/medication-admin', async (req, res) => {
  try {
    const prisma = getPrisma()
    const { admissionId, drugName, dose, route, administeredAt, notes } = req.body

    if (!admissionId || !drugName || !dose || !route) {
      return res.status(400).json({ success: false, message: 'admissionId, drugName, dose, route required' })
    }

    const medAdmin = await prisma.medicationAdministration.create({
      data: {
        admissionId, drugName, dose, route,
        administeredAt:   administeredAt ? new Date(administeredAt) : new Date(),
        administeredById: req.user?.id,
        notes
      }
    })

    return res.status(201).json({ success: true, message: 'Medication administered', data: { medAdmin } })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/medication-admin/:admissionId', async (req, res) => {
  try {
    const prisma  = getPrisma()
    const records = await prisma.medicationAdministration.findMany({
      where:   { admissionId: req.params.admissionId },
      orderBy: { administeredAt: 'desc' }
    })
    return res.json({ success: true, data: records })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})

// ─── Progress Notes ───────────────────────────────────────────────────────────
router.get('/progress-notes/:visitId', async (req, res) => {
  try {
    const prisma = getPrisma()
    const notes  = await prisma.progressNote.findMany({
      where:   { visitId: req.params.visitId },
      orderBy: { createdAt: 'desc' }
    })
    return res.json({ success: true, data: notes })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})

router.post('/progress-notes', async (req, res) => {
  try {
    const prisma = getPrisma()
    const { visitId, noteType, note } = req.body
    if (!visitId || !note) return res.status(400).json({ success: false, message: 'visitId and note required' })
    const progressNote = await prisma.progressNote.create({
      data: { visitId, authorId: req.user?.id, noteType: noteType || 'NURSING', note }
    })
    return res.status(201).json({ success: true, message: 'Note added', data: { progressNote } })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})

// ─── Stats ────────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const prisma     = getPrisma()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [activeAdmissions, todayVitals, todayMedAdmin, pendingTriage, activeShifts] = await Promise.all([
      prisma.admission.count({ where: { status: 'ACTIVE' } }),
      prisma.vitalSign.count({ where: { recordedAt: { gte: todayStart } } }),
      prisma.medicationAdministration.count({ where: { administeredAt: { gte: todayStart } } }),
      prisma.visit.count({ where: { status: 'ACTIVE', triage: null, visitDate: { gte: todayStart } } }),
      prisma.nurseShift.count({ where: { status: 'ACTIVE' } })
    ])

    return res.json({
      success: true,
      data: { activeAdmissions, todayVitals, todayMedAdmin, pendingTriage, activeShifts }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})

// ─── Beds ─────────────────────────────────────────────────────────────────────
router.get('/beds', async (req, res) => {
  try {
    const prisma = getPrisma()
    const beds   = await prisma.bed.findMany({
      include: {
        room: { include: { ward: true } },
        admissions: {
          where:   { status: 'ACTIVE' },
          include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true, gender: true } } }
        }
      },
      orderBy: { bedNumber: 'asc' }
    })

    return res.json({ success: true, data: beds, beds, meta: { total: beds.length } })
  } catch (error) {
    console.error('Nursing beds error:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
})

// ─── Nursing Notes ────────────────────────────────────────────────────────────
router.get('/notes/:visitId', async (req, res) => {
  try {
    const prisma = getPrisma()
    const notes  = await prisma.progressNote.findMany({
      where:   { visitId: req.params.visitId },
      include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
      orderBy: { createdAt: 'desc' }
    })
    const mapped = notes.map(n => ({ ...n, nurse: n.author }))
    return res.json({ success: true, data: mapped })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})

router.post('/notes', async (req, res) => {
  try {
    const prisma = getPrisma()
    const { visitId, noteType, content, priority } = req.body

    if (!visitId)  return res.status(400).json({ success: false, message: 'visitId required' })
    if (!content)  return res.status(400).json({ success: false, message: 'content required' })

    const visit = await prisma.visit.findUnique({ where: { id: visitId } })
    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' })

    const noteText = (priority && priority !== 'ROUTINE') ? `[${priority}] ${content}` : content

    const note = await prisma.progressNote.create({
      data: {
        visitId,
        authorId: req.user?.id || null,
        noteType: noteType || 'NURSING',
        note:     noteText
      },
      include: { author: { select: { firstName: true, lastName: true, role: true } } }
    })

    return res.status(201).json({ success: true, message: 'Note saved', data: { ...note, nurse: note.author } })
  } catch (error) {
    console.error('Nursing notes POST error:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
})

// ─── SHIFT MANAGEMENT ─────────────────────────────────────────────────────────

// Get active shift for current nurse
router.get('/shift/active', async (req, res) => {
  try {
    const prisma = getPrisma()
    const shift  = await prisma.nurseShift.findFirst({
      where:   { nurseId: req.user?.id, status: 'ACTIVE' },
      include: {
        nurse:       { select: { id: true, firstName: true, lastName: true, isNurseInCharge: true } },
        assignments: {
          where:   { isActive: true },
          include: {
            admission: {
              include: {
                patient: { select: { id: true, mrn: true, firstName: true, lastName: true } },
                bed:     { include: { room: { include: { ward: true } } } },
                ward:    true
              }
            }
          }
        }
      }
    })
    return res.json({ success: true, data: { shift } })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})

// Clock In
router.post('/shift/clockin', async (req, res) => {
  try {
    const prisma = getPrisma()
    const { ward, notes } = req.body

    // Check if already clocked in
    const existing = await prisma.nurseShift.findFirst({
      where: { nurseId: req.user?.id, status: 'ACTIVE' }
    })
    if (existing) {
      return res.status(400).json({ success: false, message: 'Already clocked in. Clock out first.' })
    }

    const shiftType = getCurrentShift()
    const shift     = await prisma.nurseShift.create({
      data: {
        nurseId:     req.user?.id,
        shiftType,
        ward:        ward || null,
        clockedInAt: new Date(),
        status:      'ACTIVE',
        notes:       notes || null
      },
      include: { nurse: { select: { id: true, firstName: true, lastName: true, isNurseInCharge: true } } }
    })

    const io = req.app.get('io')
    if (io) io.emit('shift:clockin', { nurseId: req.user?.id, shiftType, ward })

    return res.status(201).json({
      success: true,
      message: `Clocked in for ${shiftType} shift`,
      data:    { shift }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})

// Clock Out
router.post('/shift/clockout', async (req, res) => {
  try {
    const prisma = getPrisma()
    const { notes } = req.body

    const activeShift = await prisma.nurseShift.findFirst({
      where: { nurseId: req.user?.id, status: 'ACTIVE' }
    })
    if (!activeShift) {
      return res.status(400).json({ success: false, message: 'No active shift found' })
    }

    // Deactivate all assignments for this shift
    await prisma.nurseAssignment.updateMany({
      where: { shiftId: activeShift.id, isActive: true },
      data:  { isActive: false }
    })

    const shift = await prisma.nurseShift.update({
      where: { id: activeShift.id },
      data:  { clockedOutAt: new Date(), status: 'COMPLETED', notes: notes || activeShift.notes }
    })

    const io = req.app.get('io')
    if (io) io.emit('shift:clockout', { nurseId: req.user?.id, shiftId: activeShift.id })

    return res.json({ success: true, message: 'Clocked out successfully', data: { shift } })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})

// Get all nurses on duty (for NIC assignment)
router.get('/staff/on-duty', async (req, res) => {
  try {
    const prisma = getPrisma()

    const activeShifts = await prisma.nurseShift.findMany({
      where:   { status: 'ACTIVE' },
      include: {
        nurse: {
          select: {
            id: true, firstName: true, lastName: true,
            role: true, isNurseInCharge: true
          }
        },
        assignments: {
          where:   { isActive: true },
          include: {
            admission: {
              include: {
                patient: { select: { firstName: true, lastName: true } },
                bed:     true
              }
            }
          }
        }
      },
      orderBy: { clockedInAt: 'asc' }
    })

    return res.json({ success: true, data: { activeShifts } })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})

// Assign nurse to patient (NIC only)
router.post('/shift/assign', async (req, res) => {
  try {
    const prisma = getPrisma()
    const { shiftId, nurseId, admissionId, notes } = req.body

    if (!shiftId || !nurseId || !admissionId) {
      return res.status(400).json({ success: false, message: 'shiftId, nurseId, admissionId required' })
    }

    // Check assigner is NIC or admin
    const assigner = await prisma.user.findUnique({ where: { id: req.user?.id } })
    if (!assigner?.isNurseInCharge &&
        !['SUPER_ADMIN','HOSPITAL_ADMIN','CLINICAL_COORDINATOR'].includes(assigner?.role)) {
      return res.status(403).json({ success: false, message: 'Only Nurse In Charge can assign nurses' })
    }

    // Deactivate existing assignment for this admission in this shift
    await prisma.nurseAssignment.updateMany({
      where: { shiftId, admissionId, isActive: true },
      data:  { isActive: false }
    })

    const assignment = await prisma.nurseAssignment.create({
      data: {
        shiftId, nurseId, admissionId,
        assignedById: req.user?.id,
        notes:        notes || null,
        isActive:     true
      },
      include: {
        admission: {
          include: {
            patient: { select: { firstName: true, lastName: true, mrn: true } },
            bed:     { include: { room: { include: { ward: true } } } }
          }
        }
      }
    })

    const io = req.app.get('io')
    if (io) io.to(nurseId).emit('shift:assigned', { admissionId, assignment })

    return res.status(201).json({ success: true, message: 'Nurse assigned to patient', data: { assignment } })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})

// Get my assigned patients for current shift
router.get('/shift/my-patients', async (req, res) => {
  try {
    const prisma = getPrisma()

    const activeShift = await prisma.nurseShift.findFirst({
      where: { nurseId: req.user?.id, status: 'ACTIVE' }
    })

    if (!activeShift) {
      return res.json({ success: true, data: { patients: [], shift: null } })
    }

    const assignments = await prisma.nurseAssignment.findMany({
      where:   { shiftId: activeShift.id, nurseId: req.user?.id, isActive: true },
      include: {
        admission: {
          include: {
            patient: {
              select: { id: true, mrn: true, firstName: true, lastName: true, gender: true, dateOfBirth: true, bloodGroup: true }
            },
            bed:  { include: { room: { include: { ward: true } } } },
            ward: true,
            visit: {
              include: {
                vitalSigns:    { orderBy: { recordedAt: 'desc' }, take: 1 },
                consultations: { orderBy: { consultationDate: 'desc' }, take: 1 },
                triage:        true
              }
            },
            medicationAdministrations: { orderBy: { administeredAt: 'desc' }, take: 3 }
          }
        }
      }
    })

    return res.json({
      success: true,
      data: {
        shift:    activeShift,
        patients: assignments.map(a => a.admission)
      }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})

// Toggle isNurseInCharge flag (Admin only)
router.patch('/staff/:userId/set-nic', async (req, res) => {
  try {
    const prisma = getPrisma()
    const { isNurseInCharge } = req.body

    const caller = await prisma.user.findUnique({ where: { id: req.user?.id } })
    if (!['SUPER_ADMIN','HOSPITAL_ADMIN','MEDICAL_DIRECTOR'].includes(caller?.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' })
    }

    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data:  { isNurseInCharge: Boolean(isNurseInCharge) },
      select: { id: true, firstName: true, lastName: true, isNurseInCharge: true }
    })

    return res.json({ success: true, message: `NIC status updated`, data: { user } })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})

module.exports = router