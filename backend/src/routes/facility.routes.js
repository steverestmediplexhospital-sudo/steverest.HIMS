// backend/src/routes/facility.routes.js
const express      = require('express')
const router       = express.Router()
const auth         = require('../middleware/auth.middleware')
const { requireRole } = require('../middleware/role.middleware')
const ctrl         = require('../controllers/facility.controller')

const FACILITY_ROLES = [
  'FACILITY_OFFICER',
  'INVENTORY_OFFICER',
  'SUPER_ADMIN',
  'HOSPITAL_ADMIN',
  'CLINICAL_COORDINATOR',
  'MEDICAL_DIRECTOR',
]

// All facility routes require authentication
router.use(auth)

// Stats — any facility role
router.get('/stats', requireRole(...FACILITY_ROLES), ctrl.getStats)

// Assets
router.get('/assets',        requireRole(...FACILITY_ROLES), ctrl.getAssets)
router.post('/assets',       requireRole(...FACILITY_ROLES), ctrl.createAsset)
router.put('/assets/:id',    requireRole(...FACILITY_ROLES), ctrl.updateAsset)
router.delete('/assets/:id', requireRole('FACILITY_OFFICER','SUPER_ADMIN','HOSPITAL_ADMIN'), ctrl.deleteAsset)

// Maintenance / Work Orders
router.get('/maintenance',        requireRole(...FACILITY_ROLES), ctrl.getMaintenance)
router.post('/maintenance',       requireRole(...FACILITY_ROLES), ctrl.createMaintenance)
router.put('/maintenance/:id',    requireRole(...FACILITY_ROLES), ctrl.updateMaintenance)

// Utilities
router.get('/utilities',  requireRole(...FACILITY_ROLES), ctrl.getUtilities)
router.post('/utilities', requireRole(...FACILITY_ROLES), ctrl.createUtilityLog)

// Spaces
router.get('/spaces',      requireRole(...FACILITY_ROLES), ctrl.getSpaces)
router.post('/spaces',     requireRole(...FACILITY_ROLES), ctrl.createSpace)
router.put('/spaces/:id',  requireRole(...FACILITY_ROLES), ctrl.updateSpace)

module.exports = router