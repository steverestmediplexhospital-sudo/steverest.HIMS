// backend/src/controllers/mortuary.controller.js
// ✅ FIXED: Uses global.prisma, correct sendSuccess/sendError, no external service dependency

const { sendSuccess, sendError } = require('../utils/response.utils')

const getPrisma = () => global.prisma

// ─── Generate mortuary number inline (no external service needed) ─────────────
const generateMortuaryNumber = async (prisma) => {
  const count = await prisma.mortuaryRecord.count()
  return 'MRT-' + String(count + 1).padStart(6, '0')
}

// ─── Admit to Mortuary ────────────────────────────────────────────────────────
const admitToMortuary = async (req, res) => {
  try {
    const prisma = getPrisma()
    const {
      patientId,
      deceasedName,
      gender,
      estimatedAge,
      dateOfDeath,
      timeOfDeath,
      causeOfDeath,
      placeOfDeath,
      certifiedById,
      storageUnit,
      isAutopsyRequired,
      policeCase,
      policeReference,
      familyName,
      familyPhone,
      familyRelation,
      notes
    } = req.body

    // Validation
    if (!deceasedName) return sendError(res, 'deceasedName is required', 400)
    if (!gender)       return sendError(res, 'gender is required', 400)
    if (!dateOfDeath)  return sendError(res, 'dateOfDeath is required', 400)

    const mortuaryNumber = await generateMortuaryNumber(prisma)

    const mortuaryRecord = await prisma.mortuaryRecord.create({
      data: {
        mortuaryNumber,
        patientId:         patientId    || null,
        deceasedName:      deceasedName.trim(),
        gender,
        estimatedAge:      estimatedAge  ? parseInt(estimatedAge)  : null,
        dateOfDeath:       new Date(dateOfDeath),
        timeOfDeath:       timeOfDeath  || null,
        causeOfDeath:      causeOfDeath || null,
        placeOfDeath:      placeOfDeath || null,
        certifiedById:     certifiedById|| null,
        storageUnit:       storageUnit  || null,
        status:            'ADMITTED',
        isAutopsyRequired: isAutopsyRequired === true || isAutopsyRequired === 'true',
        policeCase:        policeCase    === true || policeCase    === 'true',
        policeReference:   policeReference || null,
        familyName:        familyName   || null,
        familyPhone:       familyPhone  || null,
        familyRelation:    familyRelation|| null,
        notes:             notes        || null
      }
    })

    // Create autopsy record placeholder if required
    if (isAutopsyRequired === true || isAutopsyRequired === 'true') {
      await prisma.autopsyRecord.create({
        data: {
          mortuaryRecordId: mortuaryRecord.id,
          requestedById:    req.user?.id || null
        }
      })

      // Update status to AUTOPSY
      await prisma.mortuaryRecord.update({
        where: { id: mortuaryRecord.id },
        data:  { status: 'AUTOPSY' }
      })
    }

    // Real-time notifications
    const io = req.app.get('io')
    if (io) {
      io.to('role:MORTUARY_OFFICER').emit('mortuary:new_admission', {
        mortuaryId: mortuaryRecord.id,
        mortuaryNumber,
        deceasedName,
        isAutopsyRequired,
        policeCase
      })
    }

    // Audit log (best effort — don't crash if it fails)
    try {
      await prisma.auditLog.create({
        data: {
          userId:    req.user?.id || null,
          action:    'ADMIT',
          module:    'MORTUARY',
          recordId:  mortuaryRecord.id,
          newValues: { mortuaryNumber, deceasedName },
          ipAddress: req.ip || null
        }
      })
    } catch { /* audit log failure should not block response */ }

    // Return complete record
    const complete = await prisma.mortuaryRecord.findUnique({
      where:   { id: mortuaryRecord.id },
      include: { autopsyRecord: true, belongings: true }
    })

    return sendSuccess(res, { mortuaryRecord: complete }, 'Body admitted to mortuary', 201)

  } catch (error) {
    console.error('admitToMortuary error:', error)
    return sendError(res, 'Failed to admit to mortuary: ' + error.message, 500)
  }
}

// ─── Get All Mortuary Records ─────────────────────────────────────────────────
const getMortuaryRecords = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { status, page = 1, limit = 50, search } = req.query

    const skip  = (parseInt(page) - 1) * parseInt(limit)
    const where = {}

    if (status) where.status = status

    if (search) {
      where.OR = [
        { mortuaryNumber: { contains: search, mode: 'insensitive' } },
        { deceasedName:   { contains: search, mode: 'insensitive' } },
        { familyName:     { contains: search, mode: 'insensitive' } },
        { causeOfDeath:   { contains: search, mode: 'insensitive' } }
      ]
    }

    const [records, total] = await Promise.all([
      prisma.mortuaryRecord.findMany({
        where,
        skip,
        take:    parseInt(limit),
        orderBy: { admittedAt: 'desc' },
        include: {
          autopsyRecord: true,
          belongings:    true
        }
      }),
      prisma.mortuaryRecord.count({ where })
    ])

    // Attach computed field
    const recordsWithDays = records.map(record => ({
      ...record,
      daysInMortuary: Math.ceil(
        (new Date() - new Date(record.admittedAt)) / (1000 * 60 * 60 * 24)
      )
    }))

    const stats = {
      total,
      admitted:    records.filter(r => r.status === 'ADMITTED').length,
      autopsy:     records.filter(r => r.status === 'AUTOPSY').length,
      released:    records.filter(r => r.status === 'RELEASED').length,
      unclaimed:   records.filter(r => r.status === 'UNCLAIMED').length,
      policeCases: records.filter(r => r.policeCase).length
    }

    return sendSuccess(res, {
      records: recordsWithDays,
      stats,
      pagination: {
        page:  parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }, 'Mortuary records fetched')

  } catch (error) {
    console.error('getMortuaryRecords error:', error)
    return sendError(res, 'Failed to fetch mortuary records: ' + error.message, 500)
  }
}

// ─── Get Single Mortuary Record ───────────────────────────────────────────────
const getMortuaryById = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { id } = req.params

    const record = await prisma.mortuaryRecord.findFirst({
      where: {
        OR: [{ id }, { mortuaryNumber: id }]
      },
      include: {
        autopsyRecord: true,
        belongings:    true
      }
    })

    if (!record) return sendError(res, 'Mortuary record not found', 404)

    const daysInMortuary = Math.ceil(
      (new Date() - new Date(record.admittedAt)) / (1000 * 60 * 60 * 24)
    )

    return sendSuccess(res, { record: { ...record, daysInMortuary } }, 'Mortuary record fetched')

  } catch (error) {
    console.error('getMortuaryById error:', error)
    return sendError(res, 'Failed to fetch record: ' + error.message, 500)
  }
}

// ─── Release Body ─────────────────────────────────────────────────────────────
const releaseBody = async (req, res) => {
  try {
    const prisma  = getPrisma()
    const { id }  = req.params
    const { releasedTo, funeralHome, notes } = req.body

    if (!releasedTo) return sendError(res, 'releasedTo is required', 400)

    const record = await prisma.mortuaryRecord.findUnique({ where: { id } })
    if (!record) return sendError(res, 'Mortuary record not found', 404)

    if (record.status === 'RELEASED') {
      return sendError(res, 'Body has already been released', 400)
    }

    // Block release if autopsy required but not completed
    if (record.isAutopsyRequired) {
      const autopsy = await prisma.autopsyRecord.findUnique({
        where: { mortuaryRecordId: id }
      })
      if (!autopsy?.completedAt) {
        return sendError(
          res,
          'Autopsy is required but not yet completed. Complete autopsy before releasing.',
          400
        )
      }
    }

    const updated = await prisma.mortuaryRecord.update({
      where: { id },
      data: {
        status:       'RELEASED',
        releasedAt:   new Date(),
        releasedTo,
        releasedById: req.user?.id || null,
        funeralHome:  funeralHome  || null,
        notes:        notes
          ? `${record.notes ? record.notes + '\n' : ''}Release: ${notes}`
          : record.notes
      },
      include: { autopsyRecord: true, belongings: true }
    })

    // Real-time notification
    const io = req.app.get('io')
    if (io) {
      io.emit('mortuary:released', {
        mortuaryId:     id,
        mortuaryNumber: record.mortuaryNumber,
        deceasedName:   record.deceasedName,
        releasedTo
      })
    }

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId:    req.user?.id || null,
          action:    'RELEASE',
          module:    'MORTUARY',
          recordId:  id,
          newValues: { releasedTo, funeralHome },
          ipAddress: req.ip || null
        }
      })
    } catch { /* non-fatal */ }

    return sendSuccess(res, { record: updated }, 'Body released successfully')

  } catch (error) {
    console.error('releaseBody error:', error)
    return sendError(res, 'Failed to release body: ' + error.message, 500)
  }
}

// ─── Update Autopsy Record ────────────────────────────────────────────────────
const updateAutopsy = async (req, res) => {
  try {
    const prisma         = getPrisma()
    const { id }         = req.params   // mortuaryRecord id
    const { performedAt, findings, causeOfDeath, notes } = req.body

    // Find existing autopsy record
    const autopsy = await prisma.autopsyRecord.findUnique({
      where: { mortuaryRecordId: id }
    })

    if (!autopsy) {
      // Create one if it doesn't exist yet
      await prisma.autopsyRecord.create({
        data: {
          mortuaryRecordId: id,
          requestedById:    req.user?.id || null
        }
      })
    }

    const isCompleted = !!(findings && causeOfDeath)

    const updated = await prisma.autopsyRecord.update({
      where: { mortuaryRecordId: id },
      data: {
        performedById: req.user?.id || null,
        performedAt:   performedAt ? new Date(performedAt) : null,
        findings:      findings    || null,
        causeOfDeath:  causeOfDeath|| null,
        notes:         notes       || null,
        completedAt:   isCompleted ? new Date() : null
      }
    })

    // Update mortuary record status and cause of death
    await prisma.mortuaryRecord.update({
      where: { id },
      data: {
        status:       isCompleted ? 'ADMITTED' : 'AUTOPSY',
        causeOfDeath: causeOfDeath || undefined
      }
    })

    return sendSuccess(res, { autopsy: updated }, 'Autopsy record updated')

  } catch (error) {
    console.error('updateAutopsy error:', error)
    return sendError(res, 'Failed to update autopsy: ' + error.message, 500)
  }
}

// ─── Add Belonging ────────────────────────────────────────────────────────────
const addBelonging = async (req, res) => {
  try {
    const prisma       = getPrisma()
    const { id }       = req.params   // mortuaryRecord id
    const { itemDescription, quantity, notes } = req.body

    if (!itemDescription) return sendError(res, 'itemDescription is required', 400)

    // Verify record exists
    const record = await prisma.mortuaryRecord.findUnique({ where: { id } })
    if (!record) return sendError(res, 'Mortuary record not found', 404)

    const belonging = await prisma.mortuaryBelonging.create({
      data: {
        mortuaryRecordId: id,
        itemDescription:  itemDescription.trim(),
        quantity:         quantity ? parseInt(quantity) : 1,
        notes:            notes || null
      }
    })

    return sendSuccess(res, { belonging }, 'Belonging recorded', 201)

  } catch (error) {
    console.error('addBelonging error:', error)
    return sendError(res, 'Failed to record belonging: ' + error.message, 500)
  }
}

// ─── Notify Family ────────────────────────────────────────────────────────────
const notifyFamily = async (req, res) => {
  try {
    const prisma  = getPrisma()
    const { id }  = req.params
    const { notificationMethod, notes } = req.body

    const record = await prisma.mortuaryRecord.findUnique({ where: { id } })
    if (!record) return sendError(res, 'Mortuary record not found', 404)

    const timestamp = new Date().toLocaleString('en-GB')
    const noteEntry = `Family notified via ${notificationMethod || 'phone'} on ${timestamp}${notes ? ': ' + notes : ''}`

    const updated = await prisma.mortuaryRecord.update({
      where: { id },
      data: {
        notes: record.notes ? `${record.notes}\n${noteEntry}` : noteEntry
      }
    })

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId:    req.user?.id || null,
          action:    'FAMILY_NOTIFIED',
          module:    'MORTUARY',
          recordId:  id,
          newValues: { notificationMethod, notes },
          ipAddress: req.ip || null
        }
      })
    } catch { /* non-fatal */ }

    return sendSuccess(res, { record: updated }, 'Family notification recorded')

  } catch (error) {
    console.error('notifyFamily error:', error)
    return sendError(res, 'Failed to record notification: ' + error.message, 500)
  }
}

// ─── Get Stats ────────────────────────────────────────────────────────────────
const getMortuaryStats = async (req, res) => {
  try {
    const prisma = getPrisma()

    const [total, admitted, autopsy, released, unclaimed, policeCases] = await Promise.all([
      prisma.mortuaryRecord.count(),
      prisma.mortuaryRecord.count({ where: { status: 'ADMITTED'  } }),
      prisma.mortuaryRecord.count({ where: { status: 'AUTOPSY'   } }),
      prisma.mortuaryRecord.count({ where: { status: 'RELEASED'  } }),
      prisma.mortuaryRecord.count({ where: { status: 'UNCLAIMED' } }),
      prisma.mortuaryRecord.count({ where: { policeCase: true    } })
    ])

    return sendSuccess(res, {
      stats: { total, admitted, autopsy, released, unclaimed, policeCases }
    }, 'Stats fetched')

  } catch (error) {
    return sendError(res, 'Failed to fetch stats: ' + error.message, 500)
  }
}

module.exports = {
  admitToMortuary,
  getMortuaryRecords,
  getMortuaryById,
  releaseBody,
  updateAutopsy,
  addBelonging,
  notifyFamily,
  getMortuaryStats
}