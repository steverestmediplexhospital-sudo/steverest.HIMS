// backend/src/middleware/auth.middleware.js
const jwt = require('jsonwebtoken')

// ── All valid roles from schema ───────────────────────────────────────────────
const VALID_ROLES = [
  'SUPER_ADMIN',
  'HOSPITAL_ADMIN',
  'MEDICAL_DIRECTOR',
  'CLINICAL_COORDINATOR',
  'RECEPTIONIST',
  'MEDICAL_RECORDS_OFFICER',
  'NURSE',
  'DOCTOR',
  'MIDWIFE',
  'LAB_SCIENTIST',
  'LAB_TECHNICIAN',
  'RADIOGRAPHER',
  'PHARMACIST',
  'INVENTORY_OFFICER',
  'FACILITY_OFFICER',
  'CASHIER',
  'ACCOUNTANT',
  'THEATRE_NURSE',
  'SURGEON',
  'MORTUARY_OFFICER'
]

// ── Admin roles (can access everything) ──────────────────────────────────────
const ADMIN_ROLES = ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MEDICAL_DIRECTOR']

// ── Auth Middleware ───────────────────────────────────────────────────────────
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      })
    }

    const token   = authHeader.substring(7)
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    req.user = decoded
    next()

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please login again.',
        code:    'TOKEN_EXPIRED'
      })
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid token.',
      code:    'INVALID_TOKEN'
    })
  }
}

// ── Role Guard ────────────────────────────────────────────────────────────────
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      })
    }

    // Super admins bypass role checks
    if (ADMIN_ROLES.includes(req.user.role)) {
      return next()
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required: ${roles.join(', ')}`,
        yourRole: req.user.role
      })
    }
    next()
  }
}

// ── Optional Auth (doesn't fail if no token) ─────────────────────────────────
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      const token   = authHeader.substring(7)
      req.user      = jwt.verify(token, process.env.JWT_SECRET)
    }
  } catch (_) {}
  next()
}

module.exports             = authMiddleware
module.exports.requireRole = requireRole
module.exports.optionalAuth = optionalAuth
module.exports.ADMIN_ROLES  = ADMIN_ROLES
module.exports.VALID_ROLES  = VALID_ROLES