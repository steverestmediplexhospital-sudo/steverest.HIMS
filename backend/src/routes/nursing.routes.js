// backend/src/routes/nursing.routes.js
const router         = require('express').Router()
const authMiddleware = require('../middleware/auth.middleware')

router.use(authMiddleware)

const getPrisma = () => global.prisma

// ─── Triage ───────────────────────────────────────────────────────────────────
router.post('/triage', async (req, res) => {
  try {
    const prisma = getPrisma()
    const {
      visitId, triageLevel, chiefComplaint,
      arrivalMode, notes
    } = req.body

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
        where:  { visitId },
        data:   { triageLevel, chiefComplaint, arrivalMode, notes }
      })
    } else {
      triage = await prisma.triage.create({
        data: {
          visitId, triageLevel, chiefComplaint,
          arrivalMode, notes,
          nurseId: req.user?.id
        }
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
        io.emit('emergency:alert', {
          visitId,
          message: 'IMMEDIATE triage - Patient needs urgent attention',
          triageLevel
        })
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
    const prisma    = getPrisma()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [pendingTriage, activeAdmissions] = await Promise.all([
      prisma.visit.findMany({
        where: {
          status:    'ACTIVE',
          triage:    null,
          visitDate: { gte: todayStart }
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
      }),

      prisma.admission.findMany({
        where: { status: 'ACTIVE' },
        include: {
          patient: {
            select: {
              id: true, mrn: true,
              firstName: true, lastName: true,
              gender: true, dateOfBirth: true,
              bloodGroup: true
            }
          },
          ward: true,
          bed:  true,
          visit: {
            include: {
              triage:     true,
              vitalSigns: {
                orderBy: { recordedAt: 'desc' },
                take:    1
              },
              consultations: {
                orderBy: { consultationDate: 'desc' },
                take:    1,
                include: {
                  doctor: { select: { firstName: true, lastName: true } }
                }
              },
              prescriptions: {
                where:  { status: { in: ['PENDING', 'VERIFIED'] } },
                select: { id: true, status: true }
              }
            }
          },
          medicationAdministrations: {
            orderBy: { administeredAt: 'desc' },
            take:    5
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
        stats: {
          awaitingTriage: pendingTriage.length,
          activePatients: activeAdmissions.length
        }
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
        visit: {
          include: {
            patient: {
              select: { id: true, mrn: true, firstName: true, lastName: true }
            }
          }
        },
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

    if (!visitId) {
      return res.status(400).json({ success: false, message: 'visitId required' })
    }

    const getCurrentShift = () => {
      const h = new Date().getHours()
      if (h >= 7  && h < 15) return 'MORNING'
      if (h >= 15 && h < 23) return 'AFTERNOON'
      return 'NIGHT'
    }

    const nursingAssessment = await prisma.nursingAssessment.create({
      data: {
        visitId,
        nurseId:    req.user?.id,
        assessment,
        carePlan,
        notes,
        shift:      shift || getCurrentShift()
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

    const io = req.app.get('io')
    if (io) io.emit('nursing:assessment_complete', { visitId })

    return res.status(201).json({ 
      success: true, 
      message: 'Assessment saved',
      data: { nursingAssessment } 
    })
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
      bloodPressureSystolic,  bloodPressureDiastolic,
      temperature,            pulse,
      respiratoryRate,        oxygenSaturation,
      weight,                 height,
      painScore
    } = req.body

    if (!visitId) {
      return res.status(400).json({ success: false, message: 'visitId required' })
    }

    const bmi = (weight && height)
      ? parseFloat((weight / ((height / 100) ** 2)).toFixed(1))
      : null

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
        bmi,
        painScore:              painScore              ? parseInt(painScore)               : null,
        recordedById:           req.user?.id
      }
    })

    // Alert on critical values
    const io = req.app.get('io')
    if (io) {
      const alerts = []
      if (oxygenSaturation && parseFloat(oxygenSaturation) < 90) {
        alerts.push('CRITICAL: SpO2 below 90%')
      }
      if (bloodPressureSystolic && parseInt(bloodPressureSystolic) > 180) {
        alerts.push('CRITICAL: Systolic BP > 180mmHg')
      }
      if (pulse && (parseInt(pulse) < 40 || parseInt(pulse) > 150)) {
        alerts.push(`CRITICAL: Heart rate ${pulse} bpm`)
      }
      if (alerts.length > 0) {
        io.to('role:DOCTOR').emit('vitals:critical', { visitId, alerts, vital: vitals })
      }
    }

    return res.status(201).json({ 
      success: true, 
      message: 'Vitals recorded',
      data: { vitals } 
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})

// ─── Medication Administration ────────────────────────────────────────────────
router.post('/medication-admin', async (req, res) => {
  try {
    const prisma = getPrisma()
    const {
      admissionId, drugName, dose,
      route, administeredAt, notes
    } = req.body

    if (!admissionId || !drugName || !dose || !route) {
      return res.status(400).json({ 
        success: false, 
        message: 'admissionId, drugName, dose, route required' 
      })
    }

    const medAdmin = await prisma.medicationAdministration.create({
      data: {
        admissionId,
        drugName,
        dose,
        route,
        administeredAt:   administeredAt ? new Date(administeredAt) : new Date(),
        administeredById: req.user?.id,
        notes
      }
    })

    return res.status(201).json({ 
      success: true, 
      message: 'Medication administered',
      data: { medAdmin } 
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/medication-admin/:admissionId', async (req, res) => {
  try {
    const prisma   = getPrisma()
    const records  = await prisma.medicationAdministration.findMany({
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

    if (!visitId || !note) {
      return res.status(400).json({ 
        success: false, 
        message: 'visitId and note required' 
      })
    }

    const progressNote = await prisma.progressNote.create({
      data: {
        visitId,
        authorId: req.user?.id,
        noteType: noteType || 'NURSING',
        note
      }
    })

    return res.status(201).json({ 
      success: true, 
      message: 'Note added',
      data: { progressNote } 
    })
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

    const [
      activeAdmissions,
      todayAssessments,
      todayVitals,
      todayMedAdmin,
      pendingTriage
    ] = await Promise.all([
      prisma.admission.count({ where: { status: 'ACTIVE' } }),
      prisma.nursingAssessment.count({
        where: { assessedAt: { gte: todayStart } }
      }),
      prisma.vitalSign.count({
        where: { recordedAt: { gte: todayStart } }
      }),
      prisma.medicationAdministration.count({
        where: { administeredAt: { gte: todayStart } }
      }),
      prisma.visit.count({
        where: { status: 'ACTIVE', triage: null, visitDate: { gte: todayStart } }
      })
    ])

    return res.json({
      success: true,
      data: {
        activeAdmissions,
        todayAssessments,
        todayVitals,
        todayMedAdmin,
        pendingTriage
      }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})


// ─── Beds (for Nursing bed management tab) ────────────────────────────────────
router.get('/beds', async (req, res) => {
  try {
    const prisma = getPrisma()

    const beds = await prisma.bed.findMany({
      include: {
        room: {
          include: { ward: true }
        },
        admissions: {
          where: { status: 'ACTIVE' },
          include: {
            patient: {
              select: {
                id: true, mrn: true,
                firstName: true, lastName: true,
                gender: true
              }
            }
          }
        }
      },
      orderBy: { bedNumber: 'asc' }
    })

    return res.json({
      success: true,
      data: beds,        // ✅ return as array directly so frontend extractArray works
      beds,
      meta: { total: beds.length }
    })
  } catch (error) {
    console.error('Nursing beds error:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
})

// ─── Nursing Notes (separate from progress notes) ─────────────────────────────
router.get('/notes/:visitId', async (req, res) => {
  try {
    const prisma = getPrisma()

    const notes = await prisma.progressNote.findMany({
      where:   { visitId: req.params.visitId },
      include: {
        author: {
          select: {
            id: true, firstName: true, lastName: true, role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // ✅ Map author to nurse for frontend compatibility
    const mapped = notes.map(n => ({
      ...n,
      nurse: n.author
    }))

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

    // Verify visit exists
    const visit = await prisma.visit.findUnique({ where: { id: visitId } })
    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' })

    const note = await prisma.progressNote.create({
      data: {
        visitId,
        authorId: req.user?.id || null,
        noteType: noteType || 'NURSING',
        note:     content,          // ✅ schema field is 'note' not 'content'
        // priority is not a schema field on ProgressNote — store in note text
        ...(priority && priority !== 'ROUTINE'
          ? { note: `[${priority}] ${content}` }
          : {}
        )
      },
      include: {
        author: {
          select: { firstName: true, lastName: true, role: true }
        }
      }
    })

    return res.status(201).json({
      success: true,
      message: 'Note saved',
      data: { ...note, nurse: note.author }
    })
  } catch (error) {
    console.error('Nursing notes POST error:', error)
    return res.status(500).json({ success: false, message: error.message })
  }
})
module.exports = router