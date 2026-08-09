const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");
const {
  registerAntenatal, getAntenatalRecords,
  getAntenatalById, recordANCVisit,
  recordDelivery, getNewbornRecords,
  updateRiskLevel, getPartographData
} = require("../controllers/maternity.controller");

router.use(auth);
router.post("/antenatal", requireRole("DOCTOR","NURSE","MIDWIFE","CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN"), registerAntenatal);
router.get("/antenatal", getAntenatalRecords);
router.get("/antenatal/:id", getAntenatalById);
router.post("/antenatal/:antenatalRecordId/visits", requireRole("DOCTOR","NURSE","MIDWIFE","CLINICAL_COORDINATOR","SUPER_ADMIN"), recordANCVisit);
router.post("/antenatal/:antenatalRecordId/delivery", requireRole("DOCTOR","MIDWIFE","NURSE","SUPER_ADMIN"), recordDelivery);
router.patch("/antenatal/:id/risk-level", requireRole("DOCTOR","CLINICAL_COORDINATOR","SUPER_ADMIN"), updateRiskLevel);
router.get("/antenatal/:antenatalRecordId/partograph", getPartographData);
router.get("/newborns", getNewbornRecords);

module.exports = router;

