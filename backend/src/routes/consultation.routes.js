// backend/src/routes/consultation.routes.js
const router         = require('express').Router()
const authMiddleware = require('../middleware/auth.middleware')

let ctrl = {}
try { ctrl = require('../controllers/consultation.controller') } catch (e) {
  console.warn('consultation.controller:', e.message)
}

const safe = (fn) => fn || ((req, res) => res.status(501).json({ success: false, message: 'Not implemented yet' }))

router.use(authMiddleware)

router.get('/',                    safe(ctrl.getConsultations))
router.post('/',                   safe(ctrl.createConsultation))
router.get('/stats',               safe(ctrl.getStats))
router.get('/:id',                 safe(ctrl.getConsultationById))
router.put('/:id',                 safe(ctrl.updateConsultation))
router.post('/:id/soap',           safe(ctrl.saveSoapNote))
router.post('/:id/diagnosis',      safe(ctrl.addDiagnosis))
router.post('/:id/prescriptions',  safe(ctrl.addPrescription))
router.post('/:id/lab-orders',     safe(ctrl.orderLabTest))
router.post('/:id/complete',       safe(ctrl.completeConsultation))

module.exports = router