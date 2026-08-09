

const express = require('express')
const router = express.Router()
const auth = require('../middleware/auth.middleware')
const { requireRole } = require('../middleware/role.middleware')
const ctrl = require('../controllers/inventory.controller')

router.use(auth)

router.get('/items', ctrl.getInventoryItems)
router.post('/items', requireRole('INVENTORY_OFFICER','SUPER_ADMIN','HOSPITAL_ADMIN'), ctrl.createInventoryItem)
router.post('/items/batch', requireRole('INVENTORY_OFFICER','SUPER_ADMIN','HOSPITAL_ADMIN'), ctrl.addInventoryBatch)
router.post('/items/issue', requireRole('INVENTORY_OFFICER','NURSE','THEATRE_NURSE','SUPER_ADMIN','HOSPITAL_ADMIN'), ctrl.issueItems)
router.get('/movements', ctrl.getStockMovements)
router.post('/purchase-orders', requireRole('INVENTORY_OFFICER','SUPER_ADMIN','HOSPITAL_ADMIN'), ctrl.createPurchaseOrder)
router.get('/assets', ctrl.getAssets)
router.post('/assets/maintenance', requireRole('FACILITY_OFFICER','INVENTORY_OFFICER','SUPER_ADMIN','HOSPITAL_ADMIN'), ctrl.scheduleMaintenance)
router.get('/suppliers', ctrl.getSuppliers)

module.exports = router