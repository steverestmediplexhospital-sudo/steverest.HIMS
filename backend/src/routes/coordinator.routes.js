// backend/src/routes/coordinator.routes.js
const router         = require('express').Router()
const authMiddleware = require('../middleware/auth.middleware')

let ctrl = {}
try { ctrl = require('../controllers/coordinator.controller') } catch (e) {}

const safe = (fn) => fn || ((req, res) => res.status(501).json({ success: false, message: 'Not implemented yet' }))

router.use(authMiddleware)

router.get('/dashboard',      safe(ctrl.getDashboard))
router.get('/pending-tasks',  safe(ctrl.getPendingTasks))
router.post('/override',      safe(ctrl.overrideProcedure))
router.get('/workflow',       safe(ctrl.getWorkflow))

module.exports = router