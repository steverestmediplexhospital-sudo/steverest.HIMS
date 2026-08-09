// backend/src/routes/emergency.routes.js
const router         = require('express').Router()
const authMiddleware = require('../middleware/auth.middleware')
const ctrl           = require('../controllers/emergency.controller')

router.use(authMiddleware)

// ── Stats (BEFORE /:id to avoid conflict) ─────────────────────────────────────
router.get('/stats', ctrl.getEmergencyStats)

// ── List + Register ────────────────────────────────────────────────────────────
router.get('/',  ctrl.getEmergencyCases)
router.post('/', ctrl.registerEmergency)

// ── Single visit actions ───────────────────────────────────────────────────────
router.patch('/:id/status',   ctrl.updateStatus)
router.patch('/:id/triage',   ctrl.updateTriage)
router.post('/:id/vitals',    ctrl.addVitals)
router.post('/:id/admit',     ctrl.admitPatient)
router.post('/:id/discharge', ctrl.dischargePatient)

module.exports = router