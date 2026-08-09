// backend/src/routes/admin.routes.js
const router          = require('express').Router()
const authMiddleware  = require('../middleware/auth.middleware')
const { requireRole } = require('../middleware/auth.middleware')

// Safe import of controller
let ctrl = {}
try { ctrl = require('../controllers/admin.controller') } catch (e) {
  console.warn('admin.controller missing:', e.message)
}

const safe = (fn) => fn || ((req, res) => res.status(501).json({ success: false, message: 'Not implemented' }))

// All admin routes require ADMIN role
router.use(authMiddleware)
router.use(requireRole('ADMIN', 'SUPER_ADMIN'))

router.get('/dashboard',        safe(ctrl.getDashboard))
router.get('/users',            safe(ctrl.getAllUsers))
router.post('/users',           safe(ctrl.createUser))
router.get('/users/:id',        safe(ctrl.getUserById))
router.put('/users/:id',        safe(ctrl.updateUser))
router.delete('/users/:id',     safe(ctrl.deleteUser))
router.patch('/users/:id/status', safe(ctrl.toggleUserStatus))
router.get('/audit-logs',       safe(ctrl.getAuditLogs))
router.get('/system-stats',     safe(ctrl.getSystemStats))

module.exports = router