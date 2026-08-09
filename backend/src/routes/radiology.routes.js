// backend/src/routes/radiology.routes.js
const express      = require("express")
const router       = express.Router()
const auth         = require("../middleware/auth.middleware")
const { requireRole } = require("../middleware/role.middleware")
const ctrl         = require("../controllers/radiology.controller")

const RADIOLOGY_ROLES = [
  "RADIOGRAPHER",
  "CLINICAL_COORDINATOR",
  "SUPER_ADMIN",
  "HOSPITAL_ADMIN",
  "MEDICAL_DIRECTOR",
]

const ORDERING_ROLES = [
  "DOCTOR",
  "SURGEON",
  "CLINICAL_COORDINATOR",
  "SUPER_ADMIN",
  "HOSPITAL_ADMIN",
]

router.use(auth)

// ── Stats ──────────────────────────────────────────────────────────────────
router.get("/stats", requireRole(...RADIOLOGY_ROLES), ctrl.getStats)

// ── Services ───────────────────────────────────────────────────────────────
router.get("/services",  requireRole(...RADIOLOGY_ROLES, ...ORDERING_ROLES), ctrl.getServices)
router.post("/services", requireRole(...RADIOLOGY_ROLES),                    ctrl.createService)

// ── Queue (today's orders) ─────────────────────────────────────────────────
router.get("/queue", requireRole(...RADIOLOGY_ROLES), ctrl.getQueue)

// ── All Orders ─────────────────────────────────────────────────────────────
router.get("/orders",     requireRole(...RADIOLOGY_ROLES), ctrl.getOrders)
router.post("/orders",    requireRole(...ORDERING_ROLES),  ctrl.createOrder)
router.get("/orders/:id", requireRole(...RADIOLOGY_ROLES, ...ORDERING_ROLES), ctrl.getOrder)

// ── Order Status Update ────────────────────────────────────────────────────
router.patch(
  "/orders/:id/status",
  requireRole(...RADIOLOGY_ROLES),
  ctrl.updateOrderStatus
)

// ── Reports ────────────────────────────────────────────────────────────────
router.post(
  "/orders/:orderId/report",
  requireRole(...RADIOLOGY_ROLES),
  ctrl.submitReport
)

router.patch(
  "/reports/:id/validate",
  requireRole("RADIOGRAPHER", "SUPER_ADMIN", "HOSPITAL_ADMIN", "MEDICAL_DIRECTOR"),
  ctrl.validateReport
)

module.exports = router