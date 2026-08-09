// backend/src/routes/lab.routes.js
const router         = require('express').Router()
const authMiddleware = require('../middleware/auth.middleware')

let ctrl = {}
try { ctrl = require('../controllers/lab.controller') } catch (e) {
  console.warn('lab.controller:', e.message)
}

const safe = (fn) => fn || ((req, res) => res.status(501).json({ success: false, message: 'Not implemented yet' }))

router.use(authMiddleware)

// Orders
router.get('/orders',              safe(ctrl.getOrders))
router.post('/orders',             safe(ctrl.createOrder))
router.get('/orders/:id',          safe(ctrl.getOrderById))
router.patch('/orders/:id/status', safe(ctrl.updateOrderStatus))
router.post('/orders/:id/results', safe(ctrl.submitResults))

// Results
router.get('/results',             safe(ctrl.getResults))
router.get('/results/:id',         safe(ctrl.getResultById))
router.patch('/results/:id/verify',safe(ctrl.verifyResult))

// Tests catalog
router.get('/tests',               safe(ctrl.getTestCatalog))
router.post('/tests',              safe(ctrl.createTest))

// Stats
router.get('/stats',               safe(ctrl.getStats))
router.get('/pending',             safe(ctrl.getPendingOrders))

module.exports = router