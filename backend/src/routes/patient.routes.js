// backend/src/routes/patient.routes.js
const router         = require('express').Router()
const authMiddleware = require('../middleware/auth.middleware')
const ctrl           = require('../controllers/patient.controller')

router.use(authMiddleware)

router.get('/',           ctrl.getPatients)
router.post('/',          ctrl.registerPatient)
router.get('/search',     ctrl.searchPatients)
router.get('/:id',        ctrl.getPatientById)
router.put('/:id',        ctrl.updatePatient)
router.delete('/:id',     ctrl.deactivatePatient)
router.get('/:id/visits', ctrl.getPatientVisits)

module.exports = router