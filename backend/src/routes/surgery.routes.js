const express = require('express')
const router = express.Router()
const auth = require('../middleware/auth.middleware')
const { requireRole } = require('../middleware/role.middleware')
const ctrl = require('../controllers/surgery.controller')

router.use(auth)

router.post('/', requireRole('DOCTOR','SURGEON','CLINICAL_COORDINATOR','SUPER_ADMIN','HOSPITAL_ADMIN'), ctrl.createSurgeryRequest)
router.get('/', ctrl.getSurgeries)
router.get('/theatre-schedule', ctrl.getTheatreSchedule)
router.patch('/:id/status', requireRole('SURGEON','DOCTOR','THEATRE_NURSE','CLINICAL_COORDINATOR','SUPER_ADMIN'), ctrl.updateSurgeryStatus)
router.post('/', requireRole('DOCTOR','SURGEON','CLINICAL_COORDINATOR','SUPER_ADMIN','HOSPITAL_ADMIN'), ctrl.createSurgeryRequest)
module.exports = router