// backend/src/routes/admin.routes.js
const router         = require('express').Router()
const authMiddleware = require('../middleware/auth.middleware')
const { requireRole } = require('../middleware/auth.middleware')

let ctrl = {}
try {
  ctrl = require('../controllers/admin.controller')
} catch (e) {
  console.warn('admin.controller missing:', e.message)
}

const safe = (fn) => fn || ((req, res) =>
  res.status(501).json({ success: false, message: 'Not implemented' })
)

// ─── Auth Guard ───────────────────────────────────────────────
router.use(authMiddleware)
router.use(requireRole(
  'SUPER_ADMIN',
  'HOSPITAL_ADMIN',
  'MEDICAL_DIRECTOR',
  'CLINICAL_COORDINATOR'
))

// ─── Dashboard Stats ──────────────────────────────────────────
router.get('/dashboard',      safe(ctrl.getDashboardStats))
router.get('/stats',          safe(ctrl.getDashboardStats))

// ─── Users ────────────────────────────────────────────────────
router.get('/users',          safe(ctrl.getUsers))
router.post('/users',         safe(ctrl.createUser))
router.get('/users/:id',      safe(ctrl.getUsers))
router.put('/users/:id',      safe(ctrl.updateUser))
router.delete('/users/:id',   safe(ctrl.deactivateUser))
router.patch('/users/:id/activate',   safe(ctrl.activateUser))
router.patch('/users/:id/deactivate', safe(ctrl.deactivateUser))
router.patch('/users/:id/reset-password', safe(ctrl.resetUserPassword))
router.patch('/users/:id/status',     safe(ctrl.updateUser))

// ─── Departments ──────────────────────────────────────────────
router.get('/departments',        safe(ctrl.getDepartments))
router.post('/departments',       safe(ctrl.createDepartment))
router.put('/departments/:id',    safe(ctrl.updateDepartment))

// ─── Wards ────────────────────────────────────────────────────
router.get('/wards',              safe(ctrl.getWards))
router.post('/wards',             safe(ctrl.createWard))

// ─── Rooms ────────────────────────────────────────────────────
router.get('/rooms',              safe(ctrl.getRooms))
router.post('/rooms',             safe(ctrl.createRoom))

// ─── Beds ─────────────────────────────────────────────────────
router.get('/beds',               safe(ctrl.getBeds))
router.post('/beds',              safe(ctrl.createBed))

// ─── Settings ─────────────────────────────────────────────────
router.get('/settings',           safe(ctrl.getSettings))
router.post('/settings',          safe(ctrl.updateSetting))
router.put('/settings',           safe(ctrl.updateSetting))

// ─── Audit Logs ───────────────────────────────────────────────
router.get('/audit-logs',         safe(ctrl.getAuditLogs))

module.exports = router