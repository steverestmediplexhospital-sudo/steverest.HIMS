// backend/src/controllers/facility.controller.js
// Uses existing schema models: Asset, MaintenanceRecord
// NOT FacilityAsset/MaintenanceRequest (those need migration)

const getPrisma = () => global.prisma

const sendSuccess = (res, message, data = {}, status = 200) =>
  res.status(status).json({ success: true, message, data })

const sendError = (res, message, status = 500) =>
  res.status(status).json({ success: false, message })

// ─── STATS ────────────────────────────────────────────────────────────────────
const getStats = async (req, res) => {
  try {
    const prisma = getPrisma()
    const [
      totalAssets,
      operational,
      pendingMaintenance,
      overdueWork,
    ] = await Promise.all([
      prisma.asset.count({ where: { status: { not: 'DECOMMISSIONED' } } }),
      prisma.asset.count({ where: { status: 'ACTIVE' } }),
      prisma.maintenanceRecord.count({
        where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } }
      }),
      prisma.maintenanceRecord.count({
        where: {
          status:        { in: ['SCHEDULED', 'IN_PROGRESS'] },
          scheduledDate: { lt: new Date() },
        },
      }),
    ])

    // Also get utility and space counts from new models if they exist
    let utilityCount = 0
    let spaceCount   = 0
    try {
      utilityCount = await prisma.utilityLog.count()
      spaceCount   = await prisma.facilitySpace.count()
    } catch (_) {}

    return sendSuccess(res, 'Stats fetched', {
      totalAssets, operational, pendingMaintenance, overdueWork,
      utilityCount, spaceCount,
    })
  } catch (e) {
    return sendError(res, e.message)
  }
}

// ─── ASSETS (using existing Asset model) ──────────────────────────────────────
const getAssets = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { search, category, status } = req.query
    const where = {}

    if (search) {
      where.OR = [
        { name:         { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { location:     { contains: search, mode: 'insensitive' } },
        { assetNumber:  { contains: search, mode: 'insensitive' } },
      ]
    }
    if (category) where.category = category
    if (status)   where.status   = status

    const assets = await prisma.asset.findMany({
      where,
      include: {
        maintenanceRecords: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Map to frontend-compatible shape
    const mapped = assets.map(a => ({
      id:            a.id,
      assetCode:     a.assetNumber,
      name:          a.name,
      category:      a.category,
      serialNumber:  a.serialNumber,
      location:      a.location,
      manufacturer:  a.brand,
      model:         a.model,
      purchaseDate:  a.purchaseDate,
      purchaseCost:  a.purchasePrice,
      warrantyExpiry:a.warrantyExpiry,
      status:        a.status === 'ACTIVE' ? 'OPERATIONAL' : a.status,
      notes:         a.notes,
      maintenanceRequests: a.maintenanceRecords.map(m => ({
        id:            m.id,
        title:         m.maintenanceType,
        status:        m.status,
        scheduledDate: m.scheduledDate,
        assignedTo:    m.technician,
      })),
    }))

    return sendSuccess(res, 'Assets fetched', { assets: mapped })
  } catch (e) {
    return sendError(res, e.message)
  }
}

const createAsset = async (req, res) => {
  try {
    const prisma = getPrisma()
    const {
      name, category, serialNumber, location,
      manufacturer, model, purchaseDate,
      purchaseCost, warrantyExpiry, status, notes,
    } = req.body

    if (!name?.trim())     return sendError(res, 'Asset name is required', 400)
    if (!location?.trim()) return sendError(res, 'Location is required',   400)

    const count       = await prisma.asset.count()
    const assetNumber = `AST-${String(count + 1).padStart(4, '0')}`

    const asset = await prisma.asset.create({
      data: {
        assetNumber,
        name:          name.trim(),
        category:      category      || 'Other',
        serialNumber:  serialNumber  || null,
        location:      location.trim(),
        brand:         manufacturer  || null,
        model:         model         || null,
        purchaseDate:  purchaseDate  ? new Date(purchaseDate)   : null,
        purchasePrice: purchaseCost  ? parseFloat(purchaseCost) : null,
        warrantyExpiry:warrantyExpiry? new Date(warrantyExpiry) : null,
        status:        status === 'OPERATIONAL' ? 'ACTIVE' : (status || 'ACTIVE'),
        notes:         notes         || null,
      },
    })

    // Audit log — non-blocking
    prisma.auditLog.create({
      data: {
        userId:   req.user?.id || 'system',
        action:   'CREATE_ASSET',
        module:   'FACILITY',
        recordId: asset.id,
      },
    }).catch(() => {})

    return sendSuccess(res, 'Asset registered', {
      asset: { ...asset, assetCode: asset.assetNumber, manufacturer: asset.brand }
    }, 201)
  } catch (e) {
    return sendError(res, e.message)
  }
}

const updateAsset = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { id } = req.params
    const {
      name, category, serialNumber, location,
      manufacturer, model, purchaseDate,
      purchaseCost, warrantyExpiry, status, notes,
    } = req.body

    const existing = await prisma.asset.findUnique({ where: { id } })
    if (!existing) return sendError(res, 'Asset not found', 404)

    const asset = await prisma.asset.update({
      where: { id },
      data: {
        name:          name?.trim()      || existing.name,
        category:      category          || existing.category,
        serialNumber:  serialNumber      ?? existing.serialNumber,
        location:      location?.trim()  || existing.location,
        brand:         manufacturer      ?? existing.brand,
        model:         model             ?? existing.model,
        purchaseDate:  purchaseDate      ? new Date(purchaseDate)   : existing.purchaseDate,
        purchasePrice: purchaseCost      ? parseFloat(purchaseCost) : existing.purchasePrice,
        warrantyExpiry:warrantyExpiry    ? new Date(warrantyExpiry) : existing.warrantyExpiry,
        status:        status === 'OPERATIONAL' ? 'ACTIVE' : (status || existing.status),
        notes:         notes             ?? existing.notes,
      },
    })
    return sendSuccess(res, 'Asset updated', {
      asset: { ...asset, assetCode: asset.assetNumber, manufacturer: asset.brand }
    })
  } catch (e) {
    return sendError(res, e.message)
  }
}

const deleteAsset = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { id } = req.params
    await prisma.asset.update({
      where: { id },
      data:  { status: 'DECOMMISSIONED' },
    })
    return sendSuccess(res, 'Asset decommissioned')
  } catch (e) {
    return sendError(res, e.message)
  }
}

// ─── MAINTENANCE (using existing MaintenanceRecord model) ─────────────────────
const getMaintenance = async (req, res) => {
  try {
    const prisma   = getPrisma()
    const { status, assetId } = req.query
    const where    = {}
    if (status)  where.status  = status
    if (assetId) where.assetId = assetId

    const records = await prisma.maintenanceRecord.findMany({
      where,
      include: {
        asset: { select: { id: true, name: true, location: true } }
      },
      orderBy: { scheduledDate: 'desc' },
    })

    const now      = new Date()
    const enriched = records.map(r => ({
      id:            r.id,
      title:         r.maintenanceType,
      description:   r.notes || r.maintenanceType,
      priority:      'MEDIUM',
      status:        r.status === 'SCHEDULED'   ? 'PENDING'     :
                     r.status === 'IN_PROGRESS' ? 'IN_PROGRESS' :
                     r.status === 'COMPLETED'   ? 'COMPLETED'   : 'CANCELLED',
      scheduledDate: r.scheduledDate,
      completedDate: r.completedDate,
      assignedTo:    r.technician,
      estimatedCost: r.cost,
      actualCost:    null,
      notes:         r.notes,
      asset:         r.asset,
      isOverdue:     r.scheduledDate && new Date(r.scheduledDate) < now
                     && !['COMPLETED','CANCELLED'].includes(r.status),
    }))

    return sendSuccess(res, 'Maintenance records fetched', { requests: enriched })
  } catch (e) {
    return sendError(res, e.message)
  }
}

const createMaintenance = async (req, res) => {
  try {
    const prisma = getPrisma()
    const {
      assetId, title, description, priority,
      scheduledDate, assignedTo, estimatedCost, notes,
    } = req.body

    if (!title?.trim()) return sendError(res, 'Title is required', 400)
    if (!assetId)       return sendError(res, 'Asset is required for maintenance record', 400)

    const record = await prisma.maintenanceRecord.create({
      data: {
        assetId:         assetId,
        maintenanceType: title.trim(),
        scheduledDate:   scheduledDate ? new Date(scheduledDate) : new Date(),
        status:          'SCHEDULED',
        technician:      assignedTo    || null,
        cost:            estimatedCost ? parseFloat(estimatedCost) : null,
        notes:           notes || description || null,
        createdById:     req.user?.id  || 'system',
      },
    })
    return sendSuccess(res, 'Work order created', { request: record }, 201)
  } catch (e) {
    return sendError(res, e.message)
  }
}

const updateMaintenance = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { id } = req.params
    const { status, assignedTo, estimatedCost, actualCost, notes, title } = req.body

    const existing = await prisma.maintenanceRecord.findUnique({ where: { id } })
    if (!existing) return sendError(res, 'Record not found', 404)

    // Map status
    const dbStatus = status === 'PENDING'      ? 'SCHEDULED'   :
                     status === 'IN_PROGRESS'  ? 'IN_PROGRESS' :
                     status === 'COMPLETED'    ? 'COMPLETED'   :
                     status === 'CANCELLED'    ? 'CANCELLED'   : existing.status

    const isCompleting = dbStatus === 'COMPLETED' && existing.status !== 'COMPLETED'

    const record = await prisma.maintenanceRecord.update({
      where: { id },
      data: {
        maintenanceType:title       || existing.maintenanceType,
        status:         dbStatus,
        technician:     assignedTo  ?? existing.technician,
        cost:           estimatedCost ? parseFloat(estimatedCost) : existing.cost,
        notes:          notes       ?? existing.notes,
        completedDate:  isCompleting ? new Date() : existing.completedDate,
      },
    })

    // Restore asset to ACTIVE if completing maintenance
    if (isCompleting && existing.assetId) {
      await prisma.asset.update({
        where: { id: existing.assetId },
        data:  { status: 'ACTIVE' },
      }).catch(() => {})
    }

    return sendSuccess(res, 'Record updated', { request: record })
  } catch (e) {
    return sendError(res, e.message)
  }
}

// ─── UTILITIES (new model — needs migration) ──────────────────────────────────
const getUtilities = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { type } = req.query
    const where  = {}
    if (type) where.type = type

    let logs = []
    try {
      logs = await prisma.utilityLog.findMany({
        where,
        orderBy: { readingDate: 'desc' },
      })
    } catch (_) {
      // Model may not exist yet if migration hasn't run
    }
    return sendSuccess(res, 'Utility logs fetched', { logs })
  } catch (e) {
    return sendError(res, e.message)
  }
}

const createUtilityLog = async (req, res) => {
  try {
    const prisma = getPrisma()
    const {
      type, readingDate, previousReading,
      currentReading, unit, cost, notes, supplier,
    } = req.body

    if (!currentReading) return sendError(res, 'Current reading is required', 400)

    const consumption = previousReading
      ? parseFloat(currentReading) - parseFloat(previousReading)
      : null

    let log
    try {
      log = await prisma.utilityLog.create({
        data: {
          type:            type            || 'ELECTRICITY',
          readingDate:     readingDate     ? new Date(readingDate) : new Date(),
          previousReading: previousReading ? parseFloat(previousReading) : null,
          currentReading:  parseFloat(currentReading),
          consumption,
          unit:            unit            || 'kWh',
          cost:            cost            ? parseFloat(cost) : null,
          notes:           notes           || null,
          supplier:        supplier        || null,
          recordedById:    req.user?.id    || null,
        },
      })
    } catch (_) {
      return sendError(res, 'Utility model not yet migrated. Run: npx prisma migrate dev', 503)
    }
    return sendSuccess(res, 'Utility reading logged', { log }, 201)
  } catch (e) {
    return sendError(res, e.message)
  }
}

// ─── SPACES (new model — needs migration) ─────────────────────────────────────
const getSpaces = async (req, res) => {
  try {
    const prisma = getPrisma()
    let spaces = []
    try {
      spaces = await prisma.facilitySpace.findMany({ orderBy: { name: 'asc' } })
    } catch (_) {}
    return sendSuccess(res, 'Spaces fetched', { spaces })
  } catch (e) {
    return sendError(res, e.message)
  }
}

const createSpace = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { name, type, floor, capacity, status, notes } = req.body
    if (!name?.trim()) return sendError(res, 'Space name is required', 400)

    let space
    try {
      space = await prisma.facilitySpace.create({
        data: {
          name:     name.trim(),
          type:     type     || 'Office',
          floor:    floor    || null,
          capacity: capacity ? parseInt(capacity) : null,
          status:   status   || 'ACTIVE',
          notes:    notes    || null,
        },
      })
    } catch (_) {
      return sendError(res, 'Space model not yet migrated. Run: npx prisma migrate dev', 503)
    }
    return sendSuccess(res, 'Space registered', { space }, 201)
  } catch (e) {
    return sendError(res, e.message)
  }
}

const updateSpace = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { id } = req.params
    const { name, type, floor, capacity, status, notes } = req.body

    const existing = await prisma.facilitySpace.findUnique({ where: { id } })
    if (!existing) return sendError(res, 'Space not found', 404)

    const space = await prisma.facilitySpace.update({
      where: { id },
      data: {
        name:     name?.trim()  || existing.name,
        type:     type          || existing.type,
        floor:    floor         ?? existing.floor,
        capacity: capacity      ? parseInt(capacity) : existing.capacity,
        status:   status        || existing.status,
        notes:    notes         ?? existing.notes,
      },
    })
    return sendSuccess(res, 'Space updated', { space })
  } catch (e) {
    return sendError(res, e.message)
  }
}

module.exports = {
  getStats,
  getAssets, createAsset, updateAsset, deleteAsset,
  getMaintenance, createMaintenance, updateMaintenance,
  getUtilities, createUtilityLog,
  getSpaces, createSpace, updateSpace,
}