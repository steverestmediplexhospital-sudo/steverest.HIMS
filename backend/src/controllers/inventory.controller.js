// backend/src/controllers/inventory.controller.js
const { PrismaClient } = require('@prisma/client')
const { generatePONo } = require('../services/id-generator.service')
const { sendResponse, sendError } = require('../utils/response.utils')

const prisma = new PrismaClient()

// ─── Get Inventory Items ───────────────────────────────
const getInventoryItems = async (req, res) => {
  try {
    const {
      category, search,
      isActive = 'true',
      lowStock, page = 1, limit = 50
    } = req.query

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where = { isActive: isActive === 'true' }

    if (category) where.category = category
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        include: {
          batches: {
            where: { remainingQty: { gt: 0 } },
            orderBy: { expiryDate: 'asc' }
          },
          _count: { select: { movements: true } }
        }
      }),
      prisma.inventoryItem.count({ where })
    ])

    // Calculate total stock for each item
    const itemsWithStock = items.map(item => {
      const totalStock = item.batches.reduce(
        (sum, b) => sum + b.remainingQty, 0
      )
      const nearestExpiry = item.batches.find(
        b => b.expiryDate
      )?.expiryDate
      const isLowStock = totalStock <= item.reorderLevel

      return {
        ...item,
        totalStock,
        nearestExpiry,
        isLowStock
      }
    })

    const filtered = lowStock === 'true'
      ? itemsWithStock.filter(i => i.isLowStock)
      : itemsWithStock

    // Get category breakdown
    const categories = await prisma.inventoryItem.groupBy({
      by: ['category'],
      where: { isActive: true },
      _count: true
    })

    return sendResponse(res, 200, 'Inventory fetched', {
      items: filtered,
      categories: categories.map(c => c.category),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      stats: {
        total,
        lowStock: itemsWithStock.filter(i => i.isLowStock).length,
        outOfStock: itemsWithStock.filter(i => i.totalStock === 0).length,
        categories: categories.length
      }
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch inventory', error.message)
  }
}

// ─── Create Inventory Item ─────────────────────────────
const createInventoryItem = async (req, res) => {
  try {
    const {
      name, code, category,
      description, unit,
      reorderLevel, price
    } = req.body

    if (!name || !code || !category || !unit) {
      return sendError(res, 400, 'name, code, category, unit required')
    }

    const item = await prisma.inventoryItem.create({
      data: {
        name, code, category,
        description, unit,
        reorderLevel: reorderLevel ? parseInt(reorderLevel) : 0,
        price: price ? parseFloat(price) : 0
      }
    })

    return sendResponse(res, 201, 'Inventory item created', { item })
  } catch (error) {
    if (error.code === 'P2002') {
      return sendError(res, 409, 'Item code already exists')
    }
    return sendError(res, 500, 'Failed to create item', error.message)
  }
}

// ─── Add Inventory Batch (Stock In) ───────────────────
const addInventoryBatch = async (req, res) => {
  try {
    const {
      itemId, batchNumber,
      quantity, expiryDate,
      purchasePrice, supplierId
    } = req.body

    if (!itemId || !quantity) {
      return sendError(res, 400, 'itemId and quantity required')
    }

    const batch = await prisma.inventoryBatch.create({
      data: {
        itemId,
        batchNumber,
        quantity: parseInt(quantity),
        remainingQty: parseInt(quantity),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        purchasePrice: parseFloat(purchasePrice || 0),
        supplierId
      },
      include: { item: true }
    })

    // Record movement
    await prisma.inventoryMovement.create({
      data: {
        itemId,
        movementType: 'PURCHASE',
        quantity: parseInt(quantity),
        reference: batchNumber,
        notes: `Stock received - Batch: ${batchNumber || 'N/A'}`,
        movedById: req.user.id
      }
    })

    // Check if this resolves low stock
    const item = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: {
        batches: { where: { remainingQty: { gt: 0 } } }
      }
    })

    const totalStock = item.batches.reduce(
      (sum, b) => sum + b.remainingQty, 0
    )

    const io = req.app.get('io')
    io.to('role:INVENTORY_OFFICER').emit('inventory:stock_updated', {
      itemId,
      itemName: batch.item.name,
      newStock: totalStock
    })

    return sendResponse(res, 201, 'Batch added successfully', {
      batch,
      newTotalStock: totalStock
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to add batch', error.message)
  }
}

// ─── Issue Items (Stock Out) ───────────────────────────
const issueItems = async (req, res) => {
  try {
    const {
      itemId, quantity,
      issuedTo,     // department/ward
      issuedToId,
      purpose, notes
    } = req.body

    if (!itemId || !quantity || !issuedTo) {
      return sendError(res, 400, 'itemId, quantity, issuedTo required')
    }

    const item = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: {
        batches: {
          where: { remainingQty: { gt: 0 } },
          orderBy: { expiryDate: 'asc' } // FEFO
        }
      }
    })

    if (!item) return sendError(res, 404, 'Item not found')

    const totalStock = item.batches.reduce(
      (sum, b) => sum + b.remainingQty, 0
    )

    if (totalStock < parseInt(quantity)) {
      return sendError(res, 400, `Insufficient stock. Available: ${totalStock}`)
    }

    // Deduct from batches (FEFO)
    let remainingToDeduct = parseInt(quantity)
    await prisma.$transaction(async (tx) => {
      for (const batch of item.batches) {
        if (remainingToDeduct <= 0) break
        const deduct = Math.min(batch.remainingQty, remainingToDeduct)
        await tx.inventoryBatch.update({
          where: { id: batch.id },
          data: { remainingQty: batch.remainingQty - deduct }
        })
        remainingToDeduct -= deduct
      }

      // Record movement
      await tx.inventoryMovement.create({
        data: {
          itemId,
          movementType: 'ISSUE',
          quantity: parseInt(quantity),
          reference: issuedToId,
          notes: `Issued to ${issuedTo}. Purpose: ${purpose || 'Not specified'}. ${notes || ''}`,
          movedById: req.user.id
        }
      })
    })

    // Check if now at reorder level
    const newTotal = totalStock - parseInt(quantity)
    if (newTotal <= item.reorderLevel) {
      const io = req.app.get('io')
      io.to('role:INVENTORY_OFFICER').emit('inventory:low_stock', {
        itemId,
        itemName: item.name,
        currentStock: newTotal,
        reorderLevel: item.reorderLevel
      })

      // Notify admin too
      io.to('role:HOSPITAL_ADMIN').emit('inventory:low_stock', {
        itemId,
        itemName: item.name,
        currentStock: newTotal
      })
    }

    return sendResponse(res, 200, 'Items issued successfully', {
      issued: parseInt(quantity),
      remaining: newTotal
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to issue items', error.message)
  }
}

// ─── Get Stock Movements ───────────────────────────────
const getStockMovements = async (req, res) => {
  try {
    const {
      itemId, movementType,
      page = 1, limit = 50,
      startDate, endDate
    } = req.query

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where = {}

    if (itemId) where.itemId = itemId
    if (movementType) where.movementType = movementType

    if (startDate || endDate) {
      where.movedAt = {}
      if (startDate) where.movedAt.gte = new Date(startDate)
      if (endDate) where.movedAt.lte = new Date(endDate)
    }

    const [movements, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { movedAt: 'desc' },
        include: {
          item: {
            select: { name: true, code: true, unit: true }
          }
        }
      }),
      prisma.inventoryMovement.count({ where })
    ])

    return sendResponse(res, 200, 'Movements fetched', {
      movements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch movements', error.message)
  }
}

// ─── Create Purchase Order ─────────────────────────────
const createPurchaseOrder = async (req, res) => {
  try {
    const {
      supplierId,
      expectedDate,
      items = [],
      notes
    } = req.body

    if (!supplierId || items.length === 0) {
      return sendError(res, 400, 'supplierId and items required')
    }

    const poNumber = await generatePONo()
    const totalAmount = items.reduce(
      (sum, i) => sum + (parseFloat(i.unitPrice) * parseInt(i.quantity)), 0
    )

    const po = await prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId,
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          status: 'PENDING',
          totalAmount,
          notes,
          createdById: req.user.id
        }
      })

      await tx.purchaseOrderItem.createMany({
        data: items.map(item => ({
          purchaseOrderId: order.id,
          itemName: item.itemName,
          quantity: parseInt(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
          totalPrice: parseFloat(item.unitPrice) * parseInt(item.quantity)
        }))
      })

      return order
    })

    return sendResponse(res, 201, 'Purchase order created', {
      po,
      poNumber
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to create PO', error.message)
  }
}

// ─── Get Asset List ────────────────────────────────────
const getAssets = async (req, res) => {
  try {
    const {
      category, status,
      departmentId, search,
      page = 1, limit = 20
    } = req.query

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where = {}

    if (category) where.category = category
    if (status) where.status = status
    if (departmentId) where.departmentId = departmentId
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { assetNumber: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          maintenanceRecords: {
            orderBy: { scheduledDate: 'desc' },
            take: 1
          }
        }
      }),
      prisma.asset.count({ where })
    ])

    return sendResponse(res, 200, 'Assets fetched', {
      assets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch assets', error.message)
  }
}

// ─── Schedule Maintenance ──────────────────────────────
const scheduleMaintenance = async (req, res) => {
  try {
    const {
      assetId, maintenanceType,
      scheduledDate, technician, notes
    } = req.body

    if (!assetId || !maintenanceType || !scheduledDate) {
      return sendError(res, 400, 'assetId, maintenanceType, scheduledDate required')
    }

    const maintenance = await prisma.maintenanceRecord.create({
      data: {
        assetId,
        maintenanceType,
        scheduledDate: new Date(scheduledDate),
        technician,
        notes,
        status: 'SCHEDULED',
        createdById: req.user.id
      },
      include: {
        asset: { select: { name: true, assetNumber: true } }
      }
    })

    return sendResponse(res, 201, 'Maintenance scheduled', { maintenance })
  } catch (error) {
    return sendError(res, 500, 'Failed to schedule maintenance', error.message)
  }
}

// ─── Get Suppliers ─────────────────────────────────────
const getSuppliers = async (req, res) => {
  try {
    const { search, isActive = 'true' } = req.query

    const where = { isActive: isActive === 'true' }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } }
      ]
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            drugBatches: true,
            inventoryBatches: true
          }
        }
      }
    })

    return sendResponse(res, 200, 'Suppliers fetched', { suppliers })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch suppliers', error.message)
  }
}

module.exports = {
  getInventoryItems,
  createInventoryItem,
  addInventoryBatch,
  issueItems,
  getStockMovements,
  createPurchaseOrder,
  getAssets,
  scheduleMaintenance,
  getSuppliers
}