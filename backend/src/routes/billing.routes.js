const express = require('express')
const router = express.Router()
const auth = require('../middleware/auth.middleware')
const { requireRole } = require('../middleware/role.middleware')
const ctrl = require('../controllers/billing.controller')

router.use(auth)

router.get('/service-catalog', ctrl.getServiceCatalog)
router.get('/summary', requireRole('ACCOUNTANT','CASHIER','SUPER_ADMIN','HOSPITAL_ADMIN','MEDICAL_DIRECTOR'), ctrl.getFinancialSummary)
router.get('/bills', requireRole('ACCOUNTANT','CASHIER','SUPER_ADMIN','HOSPITAL_ADMIN','RECEPTIONIST'), ctrl.getOrCreateBill)
router.post('/bills/items', requireRole('ACCOUNTANT','CASHIER','SUPER_ADMIN','HOSPITAL_ADMIN'), ctrl.addBillItem)
router.post('/payments', requireRole('ACCOUNTANT','CASHIER','SUPER_ADMIN','HOSPITAL_ADMIN'), ctrl.processPayment)

module.exports = router