// backend/src/routes/mortuary.routes.js
const express = require('express')
const router  = express.Router()
const auth    = require('../middleware/auth.middleware')
const { requireRole } = require('../middleware/role.middleware')
const ctrl    = require('../controllers/mortuary.controller')

router.use(auth)

// ── Stats ──────────────────────────────────────────────────────────────────────
router.get('/stats', ctrl.getMortuaryStats)

// ── List + Admit ───────────────────────────────────────────────────────────────
router.get('/', ctrl.getMortuaryRecords)

router.post('/',
  requireRole(
    'MORTUARY_OFFICER', 'DOCTOR', 'NURSE',
    'CLINICAL_COORDINATOR', 'SUPER_ADMIN', 'HOSPITAL_ADMIN'
  ),
  ctrl.admitToMortuary
)

// ── Single record ──────────────────────────────────────────────────────────────
router.get('/:id', ctrl.getMortuaryById)

// ── ✅ ADDED: Release body ─────────────────────────────────────────────────────
router.patch('/:id/release',
  requireRole(
    'MORTUARY_OFFICER', 'DOCTOR',
    'CLINICAL_COORDINATOR', 'SUPER_ADMIN', 'HOSPITAL_ADMIN'
  ),
  ctrl.releaseBody
)

// ── ✅ ADDED: Autopsy report ───────────────────────────────────────────────────
router.patch('/:id/autopsy',
  requireRole('MORTUARY_OFFICER', 'DOCTOR', 'SUPER_ADMIN', 'HOSPITAL_ADMIN'),
  ctrl.updateAutopsy
)

// ── Belongings ─────────────────────────────────────────────────────────────────
router.post('/:id/belongings',
  requireRole('MORTUARY_OFFICER', 'SUPER_ADMIN', 'HOSPITAL_ADMIN'),
  ctrl.addBelonging
)

// ── Family notification ────────────────────────────────────────────────────────
router.post('/:id/notify-family',
  requireRole('MORTUARY_OFFICER', 'SUPER_ADMIN', 'HOSPITAL_ADMIN'),
  ctrl.notifyFamily
)

module.exports = router