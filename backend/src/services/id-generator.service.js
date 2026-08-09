// backend/src/services/id-generator.service.js
// ✅ FIXED: Use global.prisma instead of new PrismaClient()

const getPrisma = () => global.prisma

const generateId = async (prefix, model, field) => {
  const prisma  = getPrisma()
  const year    = new Date().getFullYear().toString()

  const latest = await prisma[model].findFirst({
    where:   { [field]: { startsWith: `${prefix}-${year}-` } },
    orderBy: { [field]: 'desc' }
  })

  let sequence = 1
  if (latest) {
    const parts = latest[field].split('-')
    sequence = parseInt(parts[parts.length - 1]) + 1
  }

  return `${prefix}-${year}-${String(sequence).padStart(4, '0')}`
}

// ── Inline fallback for models that need simple counters ──────────────────────
const generateSimpleId = async (prefix, model, field) => {
  const prisma = getPrisma()
  const count  = await prisma[model].count()
  return `${prefix}-${String(count + 1).padStart(6, '0')}`
}

module.exports = {
  // ── Patient & Visit ──────────────────────────────────────────────────────
  generateMRN:           () => generateId('SE',   'patient',        'mrn'),
  generateVisitNo:       () => generateId('VIS',  'visit',          'visitNumber'),

  // ── Admissions & Clinical ────────────────────────────────────────────────
  generateAdmissionNo:   () => generateId('ADM',  'admission',      'admissionNumber'),
  generateLabOrderNo:    () => generateId('LAB',  'labOrder',       'orderNumber'),
  generatePrescriptionNo:() => generateId('RX',   'prescription',   'prescriptionNo'),
  generateAntenatalNo:   () => generateId('ANC',  'antenatalRecord','antenatalNo'),
  generateSurgeryNo:     () => generateId('SRG',  'surgery',        'surgeryNumber'),
  generateNewbornNo:     () => generateId('NB',   'newbornRecord',  'newbornNo'),
  generateAppointmentNo: () => generateId('APT',  'appointment',    'appointmentNo'),

  // ── Finance ───────────────────────────────────────────────────────────────
  generateBillNo:        () => generateId('BILL', 'bill',           'billNumber'),
  generatePaymentNo:     () => generateId('PAY',  'payment',        'paymentNumber'),
  generatePaymentSlipNo: () => generateId('SLP',  'paymentSlip',    'trackingNumber'),
  generatePONo:          () => generateId('PO',   'purchaseOrder',  'poNumber'),

  // ── Mortuary ──────────────────────────────────────────────────────────────
  // ✅ FIXED: mortuaryRecord exists in schema
  generateMortuaryNo:    () => generateId('MRT',  'mortuaryRecord', 'mortuaryNumber'),

  // ── Emergency ─────────────────────────────────────────────────────────────
  // ✅ FIXED: No emergencyCase model — emergency uses Visit model
  // Emergency visits use generateVisitNo() — not a separate model
  generateEmergencyNo:   () => generateId('VIS',  'visit',          'visitNumber'),

  // ── Radiology ─────────────────────────────────────────────────────────────
  generateRadiologyOrderNo: () => generateId('RAD', 'radiologyOrder', 'orderNumber'),
}