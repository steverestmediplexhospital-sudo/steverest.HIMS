// backend/src/controllers/maternity.controller.js
const { PrismaClient } = require('@prisma/client')
const {
  generateAntenatalNo,
  generateNewbornNo,
  generateMRN,
  generateVisitNo
} = require('../services/id-generator.service')
const { sendResponse, sendError } = require('../utils/response.utils')

const prisma = new PrismaClient()

// ─── Register Antenatal Patient ────────────────────────
const registerAntenatal = async (req, res) => {
  try {
    const {
      patientId,
      lmp,
      edd,
      gravida,
      para,
      gestationalAge,
      riskLevel,
      bloodGroup,
      rhFactor,
      hivStatus,
      syphilisStatus,
      hbsAgStatus
    } = req.body

    if (!patientId) return sendError(res, 400, 'patientId required')

    // Check if antenatal record already exists
    const existing = await prisma.antenatalRecord.findFirst({
      where: { patientId }
    })

    if (existing) {
      return sendError(res, 409, 'Antenatal record already exists', {
        antenatalNo: existing.antenatalNo,
        id: existing.id
      })
    }

    // Verify patient is female
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { gender: true, firstName: true, lastName: true }
    })

    if (!patient) return sendError(res, 404, 'Patient not found')
    if (patient.gender !== 'FEMALE') {
      return sendError(res, 400, 'Antenatal records can only be created for female patients')
    }

    const antenatalNo = await generateAntenatalNo()

    // Calculate EDD if LMP provided and EDD not given
    let calculatedEdd = edd
    if (lmp && !edd) {
      const lmpDate = new Date(lmp)
      calculatedEdd = new Date(lmpDate)
      calculatedEdd.setDate(calculatedEdd.getDate() + 280) // Naegele's rule
    }

    const antenatalRecord = await prisma.antenatalRecord.create({
      data: {
        antenatalNo,
        patientId,
        lmp: lmp ? new Date(lmp) : null,
        edd: calculatedEdd ? new Date(calculatedEdd) : null,
        gravida: gravida ? parseInt(gravida) : null,
        para: para ? parseInt(para) : null,
        gestationalAge: gestationalAge ? parseInt(gestationalAge) : null,
        riskLevel: riskLevel || 'LOW',
        bloodGroup,
        rhFactor,
        hivStatus,
        syphilisStatus,
        hbsAgStatus
      },
      include: {
        patient: {
          select: {
            id: true, mrn: true,
            firstName: true, lastName: true,
            dateOfBirth: true, phone: true
          }
        }
      }
    })

    // Update patient type
    await prisma.patient.update({
      where: { id: patientId },
      data: { patientType: 'ANTENATAL' }
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'CREATE',
        module: 'ANTENATAL',
        recordId: antenatalRecord.id,
        newValues: { antenatalNo, patientId },
        ipAddress: req.ip
      }
    })

    return sendResponse(res, 201, 'Antenatal record created', {
      antenatalRecord
    })
  } catch (error) {
    console.error('Antenatal registration error:', error)
    return sendError(res, 500, 'Failed to register antenatal', error.message)
  }
}

// ─── Get All Antenatal Records ─────────────────────────
const getAntenatalRecords = async (req, res) => {
  try {
    const {
      page = 1, limit = 20,
      search, riskLevel,
      trimester
    } = req.query

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where = {}

    if (riskLevel) where.riskLevel = riskLevel

    if (search) {
      where.OR = [
        { antenatalNo: { contains: search, mode: 'insensitive' } },
        {
          patient: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { mrn: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } }
            ]
          }
        }
      ]
    }

    const [records, total] = await Promise.all([
      prisma.antenatalRecord.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { registeredAt: 'desc' },
        include: {
          patient: {
            select: {
              id: true, mrn: true,
              firstName: true, lastName: true,
              dateOfBirth: true, phone: true,
              address: true, photo: true
            }
          },
          visits: {
            orderBy: { visitDate: 'desc' },
            take: 1
          },
          _count: {
            select: { visits: true }
          }
        }
      }),
      prisma.antenatalRecord.count({ where })
    ])

    // Calculate gestational age for each record
    const recordsWithGA = records.map(record => {
      let currentGA = record.gestationalAge
      if (record.lmp) {
        const daysSinceLMP = Math.floor(
          (new Date() - new Date(record.lmp)) / (1000 * 60 * 60 * 24)
        )
        currentGA = Math.floor(daysSinceLMP / 7)
      }

      const daysToEDD = record.edd
        ? Math.ceil(
            (new Date(record.edd) - new Date()) / (1000 * 60 * 60 * 24)
          )
        : null

      let currentTrimester = null
      if (currentGA) {
        if (currentGA <= 13) currentTrimester = 1
        else if (currentGA <= 26) currentTrimester = 2
        else currentTrimester = 3
      }

      return {
        ...record,
        currentGA,
        daysToEDD,
        currentTrimester,
        isOverdue: daysToEDD !== null && daysToEDD < 0
      }
    })

    const filteredRecords = trimester
      ? recordsWithGA.filter(r => r.currentTrimester === parseInt(trimester))
      : recordsWithGA

    return sendResponse(res, 200, 'Antenatal records fetched', {
      records: filteredRecords,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      stats: {
        total,
        highRisk: records.filter(r => r.riskLevel === 'HIGH').length,
        overdue: recordsWithGA.filter(r => r.isOverdue).length
      }
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch antenatal records', error.message)
  }
}

// ─── Get Antenatal Record by ID ────────────────────────
const getAntenatalById = async (req, res) => {
  try {
    const { id } = req.params

    const record = await prisma.antenatalRecord.findFirst({
      where: {
        OR: [{ id }, { antenatalNo: id }]
      },
      include: {
        patient: {
          include: {
            allergies: true,
            chronicConditions: true
          }
        },
        visits: {
          orderBy: { visitDate: 'desc' },
          include: {
            antenatalRecord: {
              select: { id: true, antenatalNo: true }
            }
          }
        },
        deliveryRecord: {
          include: {
            newborns: true
          }
        }
      }
    })

    if (!record) return sendError(res, 404, 'Antenatal record not found')

    // Calculate current gestational age
    let currentGA = record.gestationalAge
    if (record.lmp) {
      const daysSinceLMP = Math.floor(
        (new Date() - new Date(record.lmp)) / (1000 * 60 * 60 * 24)
      )
      currentGA = Math.floor(daysSinceLMP / 7)
    }

    const daysToEDD = record.edd
      ? Math.ceil(
          (new Date(record.edd) - new Date()) / (1000 * 60 * 60 * 24)
        )
      : null

    return sendResponse(res, 200, 'Antenatal record fetched', {
      record: {
        ...record,
        currentGA,
        daysToEDD,
        isOverdue: daysToEDD !== null && daysToEDD < 0
      }
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch record', error.message)
  }
}

// ─── Record ANC Visit ──────────────────────────────────
const recordANCVisit = async (req, res) => {
  try {
    const { antenatalRecordId } = req.params
    const {
      visitDate,
      gestationalAge,
      weight,
      bloodPressure,
      fetalHeartRate,
      presentingPart,
      fundalHeight,
      urinalysis,
      notes,
      nextVisitDate,
      // Lab orders this visit
      labTests,
      // Complications
      complications
    } = req.body

    // Get antenatal record
    const antenatalRecord = await prisma.antenatalRecord.findUnique({
      where: { id: antenatalRecordId },
      include: {
        visits: { select: { id: true } }
      }
    })

    if (!antenatalRecord) {
      return sendError(res, 404, 'Antenatal record not found')
    }

    const visitNumber = antenatalRecord.visits.length + 1

    const ancVisit = await prisma.antenatalVisit.create({
      data: {
        antenatalRecordId,
        visitNumber,
        visitDate: visitDate ? new Date(visitDate) : new Date(),
        gestationalAge: gestationalAge ? parseInt(gestationalAge) : null,
        weight: weight ? parseFloat(weight) : null,
        bloodPressure,
        fetalHeartRate: fetalHeartRate ? parseInt(fetalHeartRate) : null,
        presentingPart,
        fundalHeight: fundalHeight ? parseFloat(fundalHeight) : null,
        urinalysis,
        notes: complications
          ? `${notes || ''}\nComplications: ${complications}`
          : notes,
        nextVisitDate: nextVisitDate ? new Date(nextVisitDate) : null,
        attendedById: req.user.id
      }
    })

    // Check for concerning findings and alert
    const alerts = []
    if (bloodPressure) {
      const [systolic] = bloodPressure.split('/').map(Number)
      if (systolic >= 140) {
        alerts.push({
          type: 'WARNING',
          message: 'Elevated BP detected - Consider pre-eclampsia workup'
        })
      }
    }
    if (fetalHeartRate) {
      if (fetalHeartRate < 110 || fetalHeartRate > 160) {
        alerts.push({
          type: 'WARNING',
          message: `Abnormal FHR: ${fetalHeartRate} bpm (Normal: 110-160)`
        })
      }
    }

    // Update gestational age on main record
    if (gestationalAge) {
      await prisma.antenatalRecord.update({
        where: { id: antenatalRecordId },
        data: { gestationalAge: parseInt(gestationalAge) }
      })
    }

    // Emit if high risk findings
    if (alerts.length > 0) {
      const io = req.app.get('io')
      io.to('role:DOCTOR').emit('maternity:alert', {
        antenatalRecordId,
        patientId: antenatalRecord.patientId,
        alerts
      })
      io.to('role:CLINICAL_COORDINATOR').emit('maternity:alert', {
        antenatalRecordId,
        alerts
      })
    }

    return sendResponse(res, 201, 'ANC visit recorded', {
      ancVisit,
      visitNumber,
      alerts
    })
  } catch (error) {
    console.error('ANC visit error:', error)
    return sendError(res, 500, 'Failed to record ANC visit', error.message)
  }
}

// ─── Record Delivery ───────────────────────────────────
const recordDelivery = async (req, res) => {
  try {
    const { antenatalRecordId } = req.params
    const {
      deliveryDate,
      deliveryMode,
      gestationalAge,
      complications,
      bloodLoss,
      placentaComplete,
      notes,
      // Newborn details (can be multiple - twins)
      newborns = []
    } = req.body

    if (!deliveryDate || !deliveryMode) {
      return sendError(res, 400, 'deliveryDate and deliveryMode required')
    }

    if (newborns.length === 0) {
      return sendError(res, 400, 'At least one newborn record required')
    }

    const antenatalRecord = await prisma.antenatalRecord.findUnique({
      where: { id: antenatalRecordId },
      include: { patient: true, deliveryRecord: true }
    })

    if (!antenatalRecord) {
      return sendError(res, 404, 'Antenatal record not found')
    }

    if (antenatalRecord.deliveryRecord) {
      return sendError(res, 409, 'Delivery already recorded for this pregnancy')
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create delivery record
      const delivery = await tx.deliveryRecord.create({
        data: {
          antenatalRecordId,
          deliveryDate: new Date(deliveryDate),
          deliveryMode,
          gestationalAge: gestationalAge ? parseInt(gestationalAge) : null,
          complications,
          bloodLoss: bloodLoss ? parseInt(bloodLoss) : null,
          placentaComplete: placentaComplete !== undefined
            ? placentaComplete
            : null,
          attendedById: req.user.id,
          notes
        }
      })

      const newbornRecords = []

      // Register each newborn
      for (const nb of newborns) {
        // Create patient record for newborn
        const newbornMRN = await generateMRN()
        const newbornPatient = await tx.patient.create({
          data: {
            mrn: newbornMRN,
            firstName: nb.firstName || `Baby of ${antenatalRecord.patient.firstName}`,
            lastName: antenatalRecord.patient.lastName,
            dateOfBirth: new Date(deliveryDate),
            gender: nb.gender,
            phone: antenatalRecord.patient.phone,
            patientType: 'NEWBORN',
            nationality: antenatalRecord.patient.nationality
          }
        })

        const newbornNo = await generateNewbornNo()

        const newbornRecord = await tx.newbornRecord.create({
          data: {
            newbornNo,
            patientId: newbornPatient.id,
            motherId: antenatalRecord.patientId,
            deliveryRecordId: delivery.id,
            birthWeight: nb.birthWeight
              ? parseFloat(nb.birthWeight)
              : null,
            apgar1min: nb.apgar1min ? parseInt(nb.apgar1min) : null,
            apgar5min: nb.apgar5min ? parseInt(nb.apgar5min) : null,
            gender: nb.gender,
            birthTime: nb.birthTime
              ? new Date(nb.birthTime)
              : new Date(deliveryDate),
            vitaminKGiven: nb.vitaminKGiven || false,
            bcgGiven: nb.bcgGiven || false,
            opvGiven: nb.opvGiven || false,
            breastfedWithin1h: nb.breastfedWithin1h || false,
            notes: nb.notes
          }
        })

        newbornRecords.push({ newbornRecord, patient: newbornPatient })
      }

      // Update mother's para count
      await tx.antenatalRecord.update({
        where: { id: antenatalRecordId },
        data: {
          para: (antenatalRecord.para || 0) + 1
        }
      })

      // Update mother patient type
      await tx.patient.update({
        where: { id: antenatalRecord.patientId },
        data: { patientType: 'OUTPATIENT' }
      })

      return { delivery, newborns: newbornRecords }
    })

    // Alert if complications
    if (complications) {
      const io = req.app.get('io')
      io.to('role:DOCTOR').emit('maternity:delivery_complications', {
        antenatalRecordId,
        complications,
        patientName: `${antenatalRecord.patient.firstName} ${antenatalRecord.patient.lastName}`
      })
    }

    // Audit
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'DELIVERY',
        module: 'MATERNITY',
        recordId: antenatalRecordId,
        newValues: {
          deliveryMode,
          newbornCount: newborns.length
        },
        ipAddress: req.ip
      }
    })

    return sendResponse(res, 201, 'Delivery recorded successfully', {
      delivery: result.delivery,
      newborns: result.newborns
    })
  } catch (error) {
    console.error('Delivery record error:', error)
    return sendError(res, 500, 'Failed to record delivery', error.message)
  }
}

// ─── Get Newborn Records ───────────────────────────────
const getNewbornRecords = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where = {}
    if (search) {
      where.OR = [
        { newbornNo: { contains: search, mode: 'insensitive' } },
        {
          patient: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { mrn: { contains: search, mode: 'insensitive' } }
            ]
          }
        },
        {
          mother: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } }
            ]
          }
        }
      ]
    }

    const [records, total] = await Promise.all([
      prisma.newbornRecord.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: {
              id: true, mrn: true,
              firstName: true, lastName: true,
              dateOfBirth: true, gender: true
            }
          },
          mother: {
            select: {
              id: true, mrn: true,
              firstName: true, lastName: true,
              phone: true
            }
          },
          deliveryRecord: {
            select: {
              deliveryMode: true,
              deliveryDate: true,
              gestationalAge: true
            }
          }
        }
      }),
      prisma.newbornRecord.count({ where })
    ])

    return sendResponse(res, 200, 'Newborn records fetched', {
      records,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch newborn records', error.message)
  }
}

// ─── Update Antenatal Risk Level ───────────────────────
const updateRiskLevel = async (req, res) => {
  try {
    const { id } = req.params
    const { riskLevel, riskFactors, notes } = req.body

    const record = await prisma.antenatalRecord.update({
      where: { id },
      data: { riskLevel }
    })

    // Add progress note
    if (notes) {
      const visit = await prisma.visit.findFirst({
        where: { patientId: record.patientId, status: 'ACTIVE' }
      })
      if (visit) {
        await prisma.progressNote.create({
          data: {
            visitId: visit.id,
            authorId: req.user.id,
            noteType: 'RISK_ASSESSMENT',
            note: `Risk level updated to ${riskLevel}. ${notes}`
          }
        })
      }
    }

    // Alert if HIGH risk
    if (riskLevel === 'HIGH') {
      const io = req.app.get('io')
      io.to('role:DOCTOR').emit('maternity:high_risk', {
        antenatalId: id,
        patientId: record.patientId
      })
    }

    return sendResponse(res, 200, 'Risk level updated', { record })
  } catch (error) {
    return sendError(res, 500, 'Failed to update risk level', error.message)
  }
}

// ─── Get Partograph Data ───────────────────────────────
const getPartographData = async (req, res) => {
  try {
    const { antenatalRecordId } = req.params

    // Get the latest ANC visit data for partograph
    const visits = await prisma.antenatalVisit.findMany({
      where: { antenatalRecordId },
      orderBy: { visitDate: 'asc' }
    })

    const record = await prisma.antenatalRecord.findUnique({
      where: { id: antenatalRecordId },
      include: {
        patient: {
          select: {
            firstName: true, lastName: true,
            mrn: true, dateOfBirth: true
          }
        }
      }
    })

    // Build partograph data points
    const partographData = {
      patient: record?.patient,
      lmp: record?.lmp,
      edd: record?.edd,
      gravida: record?.gravida,
      para: record?.para,
      dataPoints: visits.map(v => ({
        time: v.visitDate,
        cervicalDilation: null, // Would need additional fields
        fetalHeartRate: v.fetalHeartRate,
        contractions: null,
        bloodPressure: v.bloodPressure,
        weight: v.weight,
        fundalHeight: v.fundalHeight,
        presentingPart: v.presentingPart
      }))
    }

    return sendResponse(res, 200, 'Partograph data fetched', { partographData })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch partograph', error.message)
  }
}

module.exports = {
  registerAntenatal,
  getAntenatalRecords,
  getAntenatalById,
  recordANCVisit,
  recordDelivery,
  getNewbornRecords,
  updateRiskLevel,
  getPartographData
}