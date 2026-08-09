// backend/src/routes/reports.routes.js
const router         = require('express').Router()
const authMiddleware = require('../middleware/auth.middleware')

let ctrl = {}
try {
  ctrl = require('../controllers/reports.controller')
} catch (e) {
  console.warn('reports.controller:', e.message)
}

const safe = (fn) => fn || ((req, res) => res.status(501).json({
  success: false, message: 'Not implemented yet'
}))

router.use(authMiddleware)

// ── New endpoints matching ReportsPage.jsx ────────────────────────────────────
router.get('/overview',    safe(ctrl.getOverview))
router.get('/visits',      safe(ctrl.getVisitsReport))
router.get('/admissions',  safe(ctrl.getAdmissionsReport))
router.get('/billing',     safe(ctrl.getBillingReport))
router.get('/beds',        safe(ctrl.getBedsReport))
router.get('/lab',         safe(ctrl.getLabReport))
router.get('/patients',    safe(ctrl.getPatientsReport))
router.get('/pharmacy',    safe(ctrl.getPharmacyReport))

// ── Legacy endpoints (backward compatibility) ─────────────────────────────────
router.get('/dashboard',   safe(ctrl.getOverview))
router.get('/revenue',     safe(ctrl.getBillingReport))

module.exports = router