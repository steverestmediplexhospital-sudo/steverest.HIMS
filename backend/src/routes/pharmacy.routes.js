// backend/src/routes/pharmacy.routes.js
const router         = require('express').Router()
const authMiddleware = require('../middleware/auth.middleware')

let ctrl = {}
try { ctrl = require('../controllers/pharmacy.controller') } catch (e) {
  console.warn('pharmacy.controller:', e.message)
}

const safe = (fn) => fn || ((req, res) => res.status(501).json({ success: false, message: 'Not implemented yet' }))

router.use(authMiddleware)

// Prescriptions
router.get('/prescriptions',               safe(ctrl.getPrescriptions))
router.post('/prescriptions',              safe(ctrl.createPrescription))
router.get('/prescriptions/:id',           safe(ctrl.getPrescriptionById))
router.patch('/prescriptions/:id/dispense',safe(ctrl.dispensePrescription))
router.patch('/prescriptions/:id/status',  safe(ctrl.updateStatus))

// Drugs / Inventory
router.get('/drugs',                       safe(ctrl.getDrugs))
router.post('/drugs',                      safe(ctrl.addDrug))
router.get('/drugs/:id',                   safe(ctrl.getDrugById))
router.put('/drugs/:id',                   safe(ctrl.updateDrug))
router.patch('/drugs/:id/stock',           safe(ctrl.updateStock))

// Stats
router.get('/stats',                       safe(ctrl.getStats))
router.get('/low-stock',                   safe(ctrl.getLowStock))
router.get('/expiring',                    safe(ctrl.getExpiring))

module.exports = router