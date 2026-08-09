// backend/src/routes/auth.routes.js
const router         = require('express').Router()
const authMiddleware = require('../middleware/auth.middleware')
const ctrl           = require('../controllers/auth.controller')

// ── Public ────────────────────────────────────────────────────────────────────
router.post('/login',         ctrl.login)
router.post('/register',      ctrl.register)
router.post('/refresh-token', ctrl.refreshToken)

// ── Health check ──────────────────────────────────────────────────────────────
router.get('/check', (req, res) => {
  res.json({ success: true, message: 'Auth routes OK' })
})

// ── Protected ─────────────────────────────────────────────────────────────────
router.get('/profile',          authMiddleware, ctrl.getProfile)
router.post('/change-password', authMiddleware, ctrl.changePassword)
router.post('/logout',          authMiddleware, ctrl.logout)
router.get('/users',            authMiddleware, ctrl.getAllUsers)

module.exports = router