// backend/src/routes/visit.routes.js
const router         = require('express').Router()
const authMiddleware = require('../middleware/auth.middleware')

let ctrl = {}
try {
  ctrl = require('../controllers/visit.controller')
} catch (e) {
  console.warn('visit.controller load error:', e.message)
}

const safe = (fn) => fn || ((req, res) => res.status(501).json({
  success: false, message: 'Not implemented yet'
}))

router.use(authMiddleware)

// ── Core visit routes ──────────────────────────────────────────────────────────
router.get('/',    safe(ctrl.getVisits))
router.post('/',   safe(ctrl.createVisit))

// ── Stats & today (must be BEFORE /:id to avoid route conflict) ───────────────
router.get('/stats', safe(ctrl.getVisitStats))
router.get('/today', safe(ctrl.getTodayVisits))

// ── Single visit ───────────────────────────────────────────────────────────────
router.get('/:id',  safe(ctrl.getVisitById))

// ── ✅ FIXED: was ctrl.addVitalSigns — correct name is ctrl.recordVitals ───────
router.post('/:id/vitals',         safe(ctrl.recordVitals))
router.post('/:id/progress-notes', safe(ctrl.addProgressNote))
router.patch('/:id/close',         safe(ctrl.closeVisit))

module.exports = router