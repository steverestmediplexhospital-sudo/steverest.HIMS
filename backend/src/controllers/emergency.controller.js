// backend/src/controllers/emergency.controller.js
const { sendSuccess, sendError, sendPaginated } = require('../utils/response.utils')

const getPrisma = () => global.prisma

// ─── Get Emergency Cases ───────────────────────────────────────────────────────
const getEmergencyCases = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { triageLevel, date } = req.query

    const targetDate = date ? new Date(date) : new Date()

    const where = {
      visitType: 'EMERGENCY',
      visitDate: {
        gte: new Date(new Date(targetDate).setHours(0,  0,  0,   0)),
        lte: new Date(new Date(targetDate).setHours(23, 59, 59, 999))
      }
    }

    // Optional triage level filter
    if (triageLevel) {
      where.triage = { triageLevel }
    }

    const visits = await prisma.visit.findMany({
      where,
      include: {
        patient: {
          select: {
            id:          true,
            mrn:         true,
            firstName:   true,
            lastName:    true,
            gender:      true,
            dateOfBirth: true,
            phone:       true,
            bloodGroup:  true,
            allergies: {
              select: { allergen: true, severity: true }
            }
          }
        },
        triage:    true,
        vitalSigns: {
          orderBy: { recordedAt: 'desc' },
          take: 1
        }
      },
      orderBy: { visitDate: 'desc' }
    })

    // Sort by triage priority
    const PRIORITY = { IMMEDIATE: 1, URGENT: 2, LESS_URGENT: 3, NON_URGENT: 4 }
    visits.sort((a, b) => {
      const pa = PRIORITY[a.triage?.triageLevel] || 5
      const pb = PRIORITY[b.triage?.triageLevel] || 5
      return pa - pb
    })

    const stats = {
      total:      visits.length,
      active:     visits.filter(v => v.status === 'ACTIVE').length,
      immediate:  visits.filter(v => v.triage?.triageLevel === 'IMMEDIATE').length,
      urgent:     visits.filter(v => v.triage?.triageLevel === 'URGENT').length,
      lessUrgent: visits.filter(v => v.triage?.triageLevel === 'LESS_URGENT').length,
      nonUrgent:  visits.filter(v => v.triage?.triageLevel === 'NON_URGENT').length
    }

    // ✅ FIXED: correct sendSuccess signature — (res, data, message, statusCode)
    return sendSuccess(res, { cases: visits, stats }, 'Emergency cases fetched')

  } catch (error) {
    console.error('getEmergencyCases error:', error)
    return sendError(res, 'Failed to fetch emergency cases: ' + error.message, 500)
  }
}

// ─── Register Emergency Case ───────────────────────────────────────────────────
const registerEmergency = async (req, res) => {
  try {
    const prisma = getPrisma()
    const {
      patientId,
      // Walk-in patient fields
      firstName, lastName, gender, dateOfBirth, phone, address,
      // Clinical fields
      triageLevel, chiefComplaint, arrivalMode, notes, mechanism,
      consciousness,
      // Vitals
      bloodPressureSystolic, bloodPressureDiastolic,
      temperature, pulse, respiratoryRate, oxygenSaturation,
      weight, height, gcsScore
    } = req.body

    if (!triageLevel)     return sendError(res, 'triageLevel is required', 400)
    if (!chiefComplaint)  return sendError(res, 'chiefComplaint is required', 400)

    let resolvedPatientId = patientId

    // ── Quick-register walk-in patient ──────────────────────────────────────
    if (!patientId) {
      if (!firstName || !lastName || !gender) {
        return sendError(res, 'firstName, lastName and gender are required for walk-in', 400)
      }

      const count = await prisma.patient.count()
      const mrn   = 'MRN-' + String(count + 1).padStart(6, '0')

      const newPatient = await prisma.patient.create({
        data: {
          mrn,
          firstName:   firstName.trim(),
          lastName:    lastName.trim(),
          gender,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date('1990-01-01'),
          phone:       phone   || 'UNKNOWN',
          address:     address || null,
          patientType: 'EMERGENCY'
        }
      })
      resolvedPatientId = newPatient.id
    }

    // ── Generate visit number ───────────────────────────────────────────────
    const vCount      = await prisma.visit.count()
    const visitNumber = 'VIS-' + String(vCount + 1).padStart(6, '0')

    // ── Create visit ────────────────────────────────────────────────────────
    const visit = await prisma.visit.create({
      data: {
        visitNumber,
        patientId:     resolvedPatientId,
        visitType:     'EMERGENCY',
        chiefComplaint,
        status:        'ACTIVE',
        notes:         notes || null
      }
    })

    // ── Create triage ───────────────────────────────────────────────────────
    await prisma.triage.create({
      data: {
        visitId:        visit.id,
        triageLevel,
        chiefComplaint,
        arrivalMode:    arrivalMode || 'WALK_IN',
        notes:          mechanism ? `Mechanism: ${mechanism}. Consciousness: ${consciousness || 'ALERT'}` : null,
        nurseId:        req.user?.id || null
      }
    })

    // ── Record vitals if provided ───────────────────────────────────────────
    const hasVitals = bloodPressureSystolic || temperature || pulse || oxygenSaturation
    if (hasVitals) {
      await prisma.vitalSign.create({
        data: {
          visitId:               visit.id,
          bloodPressureSystolic:  bloodPressureSystolic  ? parseInt(bloodPressureSystolic)  : null,
          bloodPressureDiastolic: bloodPressureDiastolic ? parseInt(bloodPressureDiastolic) : null,
          temperature:            temperature            ? parseFloat(temperature)           : null,
          pulse:                  pulse                  ? parseInt(pulse)                   : null,
          respiratoryRate:        respiratoryRate        ? parseInt(respiratoryRate)         : null,
          oxygenSaturation:       oxygenSaturation       ? parseFloat(oxygenSaturation)      : null,
          weight:                 weight                 ? parseFloat(weight)                : null,
          height:                 height                 ? parseFloat(height)                : null,
          painScore:              gcsScore               ? parseInt(gcsScore)                : null,
          recordedById:           req.user?.id           || null
        }
      })
    }

    // ── Real-time notifications ─────────────────────────────────────────────
    const io = req.app.get('io')
    if (io) {
      const eventData = { visitId: visit.id, visitNumber, triageLevel, chiefComplaint }
      if (triageLevel === 'IMMEDIATE') {
        io.emit('emergency:immediate', {
          ...eventData,
          message: '🚨 IMMEDIATE — Patient needs urgent care NOW!'
        })
      }
      io.emit('emergency:new_case', eventData)
      io.to('role:DOCTOR').emit('emergency:new_case', eventData)
      io.to('role:NURSE').emit('emergency:new_case', eventData)
    }

    // ── Return complete visit ───────────────────────────────────────────────
    const completeVisit = await prisma.visit.findUnique({
      where:   { id: visit.id },
      include: {
        patient:   true,
        triage:    true,
        vitalSigns: { orderBy: { recordedAt: 'desc' }, take: 1 }
      }
    })

    return sendSuccess(res, { visit: completeVisit, visitNumber }, 'Emergency case registered', 201)

  } catch (error) {
    console.error('registerEmergency error:', error)
    return sendError(res, 'Failed to register emergency: ' + error.message, 500)
  }
}

// ─── Update Triage ─────────────────────────────────────────────────────────────
const updateTriage = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { id } = req.params
    const { triageLevel, chiefComplaint, arrivalMode, notes } = req.body

    // id here is visitId
    const existing = await prisma.triage.findUnique({ where: { visitId: id } })
    if (!existing) return sendError(res, 'Triage not found for this visit', 404)

    const triage = await prisma.triage.update({
      where: { visitId: id },
      data: {
        triageLevel:    triageLevel    || existing.triageLevel,
        chiefComplaint: chiefComplaint || existing.chiefComplaint,
        arrivalMode:    arrivalMode    || existing.arrivalMode,
        notes:          notes          ?? existing.notes
      }
    })

    return sendSuccess(res, { triage }, 'Triage updated')
  } catch (error) {
    return sendError(res, 'Failed to update triage: ' + error.message, 500)
  }
}

// ─── Update Visit Status ───────────────────────────────────────────────────────
const updateStatus = async (req, res) => {
  try {
    const prisma  = getPrisma()
    const { id }  = req.params
    const { status, notes } = req.body

    const existing = await prisma.visit.findUnique({ where: { id } })
    if (!existing) return sendError(res, 'Visit not found', 404)

    const visit = await prisma.visit.update({
      where: { id },
      data: {
        status,
        dischargedAt: ['COMPLETED', 'DISCHARGED'].includes(status) ? new Date() : existing.dischargedAt,
        notes:        notes ?? existing.notes
      }
    })

    const io = req.app.get('io')
    if (io) io.emit('emergency:status_updated', { visitId: id, status })

    return sendSuccess(res, { visit }, 'Status updated')
  } catch (error) {
    return sendError(res, 'Failed to update status: ' + error.message, 500)
  }
}

// ─── Add Vitals ────────────────────────────────────────────────────────────────
const addVitals = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { id } = req.params
    const {
      bloodPressureSystolic, bloodPressureDiastolic,
      temperature, pulse, respiratoryRate,
      oxygenSaturation, weight, height, painScore
    } = req.body

    const vitals = await prisma.vitalSign.create({
      data: {
        visitId:               id,
        bloodPressureSystolic:  bloodPressureSystolic  ? parseInt(bloodPressureSystolic)  : null,
        bloodPressureDiastolic: bloodPressureDiastolic ? parseInt(bloodPressureDiastolic) : null,
        temperature:            temperature            ? parseFloat(temperature)           : null,
        pulse:                  pulse                  ? parseInt(pulse)                   : null,
        respiratoryRate:        respiratoryRate        ? parseInt(respiratoryRate)         : null,
        oxygenSaturation:       oxygenSaturation       ? parseFloat(oxygenSaturation)      : null,
        weight:                 weight                 ? parseFloat(weight)                : null,
        height:                 height                 ? parseFloat(height)                : null,
        painScore:              painScore              ? parseInt(painScore)               : null,
        recordedById:           req.user?.id           || null
      }
    })

    return sendSuccess(res, { vitals }, 'Vitals recorded')
  } catch (error) {
    return sendError(res, 'Failed to record vitals: ' + error.message, 500)
  }
}

// ─── Discharge Patient ─────────────────────────────────────────────────────────
const dischargePatient = async (req, res) => {
  try {
    const prisma  = getPrisma()
    const { id }  = req.params
    const { notes, dischargeType } = req.body

    const existing = await prisma.visit.findUnique({ where: { id } })
    if (!existing) return sendError(res, 'Visit not found', 404)

    const visit = await prisma.visit.update({
      where: { id },
      data: {
        status:       'COMPLETED',
        dischargedAt: new Date(),
        notes:        notes ? `${existing.notes || ''}\n${notes}` : existing.notes
      }
    })

    const io = req.app.get('io')
    if (io) {
      io.emit('emergency:discharged', { visitId: id, dischargeType })
      if (dischargeType === 'DECEASED') {
        io.to('role:MORTUARY_OFFICER').emit('mortuary:new_case', { visitId: id })
      }
    }

    return sendSuccess(res, { visit }, 'Patient discharged')
  } catch (error) {
    return sendError(res, 'Failed to discharge: ' + error.message, 500)
  }
}

// ─── Get Emergency Stats ───────────────────────────────────────────────────────
const getEmergencyStats = async (req, res) => {
  try {
    const prisma = getPrisma()
    const today  = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    const [total, active] = await Promise.all([
      prisma.visit.count({
        where: {
          visitType: 'EMERGENCY',
          visitDate: { gte: todayStart }
        }
      }),
      prisma.visit.count({
        where: { visitType: 'EMERGENCY', status: 'ACTIVE' }
      })
    ])

    // Count immediate separately (avoid nested filter on relation)
    const immediateVisits = await prisma.triage.count({
      where: {
        triageLevel: 'IMMEDIATE',
        visit: {
          visitType: 'EMERGENCY',
          status:    'ACTIVE'
        }
      }
    })

    return sendSuccess(res, {
      total, active, immediate: immediateVisits
    }, 'Emergency stats fetched')

  } catch (error) {
    return sendError(res, 'Failed to fetch stats: ' + error.message, 500)
  }
}

// ─── Admit From Emergency ──────────────────────────────────────────────────────
const admitPatient = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { id } = req.params
    const { wardId, bedId, admissionReason, admittingDoctorId } = req.body

    if (!wardId || !bedId) return sendError(res, 'wardId and bedId are required', 400)

    const visit = await prisma.visit.findUnique({ where: { id } })
    if (!visit) return sendError(res, 'Visit not found', 404)

    // Check bed availability
    const bed = await prisma.bed.findUnique({ where: { id: bedId } })
    if (!bed) return sendError(res, 'Bed not found', 404)
    if (bed.status === 'OCCUPIED') return sendError(res, 'Bed is already occupied', 400)

    const aCount          = await prisma.admission.count()
    const admissionNumber = 'ADM-' + String(aCount + 1).padStart(6, '0')

    const admission = await prisma.admission.create({
      data: {
        admissionNumber,
        patientId:         visit.patientId,
        visitId:           id,
        wardId,
        bedId,
        admissionReason:   admissionReason || visit.chiefComplaint || 'Emergency admission',
        admittingDoctorId: admittingDoctorId || null,
        status:            'ACTIVE'
      }
    })

    // Mark bed occupied
    await prisma.bed.update({
      where: { id: bedId },
      data:  { status: 'OCCUPIED' }
    })

    // Upgrade visit to IPD
    await prisma.visit.update({
      where: { id },
      data:  { visitType: 'IPD' }
    })

    const io = req.app.get('io')
    if (io) io.emit('admission:new', { admissionId: admission.id, admissionNumber })

    return sendSuccess(res, { admission }, 'Patient admitted successfully', 201)

  } catch (error) {
    return sendError(res, 'Failed to admit patient: ' + error.message, 500)
  }
}

module.exports = {
  getEmergencyCases,
  registerEmergency,
  updateTriage,
  updateStatus,
  addVitals,
  dischargePatient,
  getEmergencyStats,
  admitPatient
}