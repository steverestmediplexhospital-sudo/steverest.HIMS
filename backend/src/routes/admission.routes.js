// backend/src/routes/admission.routes.js
const router         = require('express').Router()
const authMiddleware = require('../middleware/auth.middleware')
const getPrisma      = () => global.prisma

router.use(authMiddleware)

let ctrl = {}
try { ctrl = require('../controllers/admission.controller') } catch (e) {
  console.warn('admission.controller:', e.message)
}

const safe = (fn) => fn || ((req, res) => res.status(501).json({ 
  success: false, message: 'Not implemented yet' 
}))

// ─── Stats & Special Routes FIRST (before /:id) ──────────────────────────────
router.get('/stats',   safe(ctrl.getStats || ctrl.getBedMap))
router.get('/active',  safe(ctrl.getActiveAdmissions || ctrl.getAdmissions))

/router.get('/beds', async (req, res) => {
  try {
    const prisma  = getPrisma()
    const { status, wardId } = req.query

    // ✅ FIXED: Bed has no wardId — it connects via Room
    const where = {}
    if (status) where.status = status
    // Filter by ward through room relation
    if (wardId) {
      where.room = { wardId }
    }

    const beds = await prisma.bed.findMany({
      where,
      include: {
        room: {
          include: { ward: true }
        },
        admissions: {
          where:   { status: 'ACTIVE' },
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
      data: beds,
      beds,
      meta: { total: beds.length }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})
router.get('/wards', async (req, res) => {
  try {
    const prisma = getPrisma()
    const wards  = await prisma.ward.findMany({
      where:   { isActive: true },
      include: {
        rooms: {
          where:   { isActive: true },
          include: {
            beds: {
              where:   { isActive: true },
              include: {
                admissions: {
                  where:   { status: 'ACTIVE' },
                  include: {
                    patient: {
                      select: { 
                        id: true, mrn: true,
                        firstName: true, lastName: true 
                      }
                    }
                  }
                }
              }
            }
          }
        },
        _count: { select: { rooms: true } }
      },
      orderBy: { name: 'asc' }
    })

    // Add bed stats to each ward
    const wardsWithStats = wards.map(ward => {
      const allBeds = ward.rooms.flatMap(r => r.beds)
      return {
        ...ward,
        totalBeds:     allBeds.length,
        availableBeds: allBeds.filter(b => b.status === 'AVAILABLE').length,
        occupiedBeds:  allBeds.filter(b => b.status === 'OCCUPIED').length
      }
    })

    return res.json({ 
      success: true, 
      data: wardsWithStats,
      wards: wardsWithStats 
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})

router.post('/wards', async (req, res) => {
  try {
    const prisma = getPrisma()
    const { name, code, description, capacity, wardType } = req.body

    if (!name) {
      return res.status(400).json({ success: false, message: 'Ward name required' })
    }

    const ward = await prisma.ward.create({
      data: {
        name,
        code:        code        || name.substring(0, 3).toUpperCase(),
        description,
        capacity:    capacity    ? parseInt(capacity) : 20,
        wardType:    wardType    || 'GENERAL',
        isActive:    true
      }
    })

    return res.status(201).json({ success: true, data: { ward }, message: 'Ward created' })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/rooms', async (req, res) => {
  try {
    const prisma  = getPrisma()
    const { wardId } = req.query
    const where   = { isActive: true }
    if (wardId) where.wardId = wardId

    const rooms = await prisma.room.findMany({
      where,
      include: {
        ward: true,
        beds: { where: { isActive: true } }
      },
      orderBy: { roomNumber: 'asc' }
    })

    return res.json({ success: true, data: rooms })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})

// ─── Bed Map ──────────────────────────────────────────────────────────────────
router.get('/bed-map', safe(ctrl.getBedMap))

// ─── Main CRUD ────────────────────────────────────────────────────────────────
router.get('/',  safe(ctrl.getAdmissions))
router.post('/', safe(ctrl.admitPatient))

// ─── Individual Admission Routes ──────────────────────────────────────────────
router.get('/:id',             safe(ctrl.getAdmissionById || ctrl.getAdmissions))
router.put('/:id',             safe(ctrl.updateAdmission  || ctrl.admitPatient))
router.patch('/:id/discharge', safe(ctrl.dischargePatient))
router.patch('/:id/transfer',  safe(ctrl.transferPatient))
router.patch('/beds/:bedId/status', safe(ctrl.updateBedStatus))
router.post('/:admissionId/vitals', safe(ctrl.recordAdmissionVitals))

module.exports = router