// backend/src/controllers/pharmacy.controller.js
const { PrismaClient } = require('@prisma/client')
const { generatePrescriptionNo } = require('../services/id-generator.service')
const { sendResponse, sendError } = require('../utils/response.utils')

const prisma = new PrismaClient()

// ─── Create Prescription ───────────────────────────────
const createPrescription = async (req, res) => {
  try {
    const {
      visitId,
      items = [],  // [{ drugId, dose, frequency, duration, quantity, route, instructions }]
      notes
    } = req.body

    if (!visitId || items.length === 0) {
      return sendError(res, 400, 'visitId and at least one drug required')
    }

    // Validate drugs
    const drugIds = items.map(i => i.drugId)
    const drugs = await prisma.drug.findMany({
      where: { id: { in: drugIds }, isActive: true },
      include: { stockBatches: { where: { remainingQty: { gt: 0 } } } }
    })

    if (drugs.length !== drugIds.length) {
      return sendError(res, 400, 'One or more invalid drug IDs')
    }

    // Check stock availability
    const stockIssues = []
    for (const item of items) {
      const drug = drugs.find(d => d.id === item.drugId)
      const totalStock = drug.stockBatches.reduce(
        (sum, b) => sum + b.remainingQty, 0
      )
      if (totalStock < item.quantity) {
        stockIssues.push({
          drug: drug.name,
          requested: item.quantity,
          available: totalStock
        })
      }
    }

    if (stockIssues.length > 0) {
      // Don't block - warn only. Pharmacist will handle
      console.warn('Stock issues:', stockIssues)
    }

    const prescriptionNo = await generatePrescriptionNo()

    const prescription = await prisma.$transaction(async (tx) => {
      const rx = await tx.prescription.create({
        data: {
          prescriptionNo,
          visitId,
          prescribedById: req.user.id,
          status: 'PENDING',
          notes
        }
      })

      await tx.prescriptionItem.createMany({
        data: items.map(item => ({
          prescriptionId: rx.id,
          drugId: item.drugId,
          dose: item.dose,
          frequency: item.frequency,
          duration: item.duration,
          route: item.route || 'ORAL',
          quantity: parseInt(item.quantity),
          instructions: item.instructions
        }))
      })

      // Calculate total cost
      const totalCost = items.reduce((sum, item) => {
        const drug = drugs.find(d => d.id === item.drugId)
        return sum + (parseFloat(drug.price) * item.quantity)
      }, 0)

      // Create payment slip
      const visit = await tx.visit.findUnique({
        where: { id: visitId },
        select: { patientId: true }
      })

      await tx.paymentSlip.create({
        data: {
          trackingNumber: `SLP-RX-${prescriptionNo}`,
          patientId: visit.patientId,
          visitId,
          amount: totalCost,
          description: `Prescription ${prescriptionNo}`,
          sourceType: 'PHARMACY',
          prescriptionId: rx.id,
          createdById: req.user.id,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
        }
      })

      return rx
    })

    // Fetch complete prescription
    const complete = await prisma.prescription.findUnique({
      where: { id: prescription.id },
      include: {
        items: {
          include: {
            drug: {
              include: {
                stockBatches: {
                  where: { remainingQty: { gt: 0 } },
                  orderBy: { expiryDate: 'asc' }
                }
              }
            }
          }
        },
        prescribedBy: {
          select: { firstName: true, lastName: true, role: true }
        },
        visit: {
          include: {
            patient: {
              select: {
                id: true, mrn: true,
                firstName: true, lastName: true,
                dateOfBirth: true, gender: true,
                allergies: true
              }
            }
          }
        }
      }
    })

    // Notify pharmacy
    const io = req.app.get('io')
    io.to('role:PHARMACIST').emit('pharmacy:new_prescription', {
      prescriptionId: prescription.id,
      prescriptionNo,
      patientName: `${complete.visit.patient.firstName} ${complete.visit.patient.lastName}`,
      mrn: complete.visit.patient.mrn,
      stockIssues
    })

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'CREATE',
        module: 'PRESCRIPTION',
        recordId: prescription.id,
        newValues: { prescriptionNo, visitId, drugs: drugIds },
        ipAddress: req.ip
      }
    })

    return sendResponse(res, 201, 'Prescription created', {
      prescription: complete,
      stockWarnings: stockIssues.length > 0 ? stockIssues : null
    })
  } catch (error) {
    console.error('Prescription error:', error)
    return sendError(res, 500, 'Failed to create prescription', error.message)
  }
}

// ─── Get Pharmacy Queue ────────────────────────────────
const getPharmacyQueue = async (req, res) => {
  try {
    const { status, date } = req.query

    const today = new Date()
    const startOfDay = new Date(today.setHours(0, 0, 0, 0))
    const endOfDay = new Date(today.setHours(23, 59, 59, 999))

    const where = {
      createdAt: date
        ? {
            gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
            lte: new Date(new Date(date).setHours(23, 59, 59, 999))
          }
        : { gte: startOfDay, lte: endOfDay }
    }

    if (status) where.status = status

    const prescriptions = await prisma.prescription.findMany({
      where,
      include: {
        items: {
          include: {
            drug: {
              select: {
                id: true, name: true, genericName: true,
                formulation: true, strength: true,
                unit: true, isControlled: true,
                stockBatches: {
                  where: { remainingQty: { gt: 0 } },
                  select: { remainingQty: true, expiryDate: true }
                }
              }
            }
          }
        },
        prescribedBy: {
          select: { firstName: true, lastName: true, role: true }
        },
        visit: {
          include: {
            patient: {
              select: {
                id: true, mrn: true,
                firstName: true, lastName: true,
                dateOfBirth: true, gender: true,
                phone: true,
                allergies: true
              }
            }
          }
        },
        paymentSlip: true
      },
      orderBy: { createdAt: 'asc' }
    })

    const stats = {
      total: prescriptions.length,
      pending: prescriptions.filter(p => p.status === 'PENDING').length,
      verified: prescriptions.filter(p => p.status === 'VERIFIED').length,
      dispensed: prescriptions.filter(p => p.status === 'DISPENSED').length,
      partial: prescriptions.filter(p => p.status === 'PARTIALLY_DISPENSED').length
    }

    return sendResponse(res, 200, 'Pharmacy queue fetched', {
      prescriptions,
      stats
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch pharmacy queue', error.message)
  }
}

// ─── Verify Prescription ───────────────────────────────
const verifyPrescription = async (req, res) => {
  try {
    const { id } = req.params
    const { notes } = req.body

    const prescription = await prisma.prescription.findUnique({
      where: { id },
      include: {
        items: { include: { drug: true } },
        visit: {
          include: {
            patient: { include: { allergies: true } }
          }
        }
      }
    })

    if (!prescription) return sendError(res, 404, 'Prescription not found')
    if (prescription.status !== 'PENDING') {
      return sendError(res, 400, `Cannot verify - status is ${prescription.status}`)
    }

    // Check for drug-allergy interactions
    const allergyWarnings = []
    const patientAllergens = prescription.visit.patient.allergies.map(
      a => a.allergen.toLowerCase()
    )

    for (const item of prescription.items) {
      const drugName = item.drug.name.toLowerCase()
      const genericName = item.drug.genericName?.toLowerCase()

      for (const allergen of patientAllergens) {
        if (drugName.includes(allergen) || genericName?.includes(allergen)) {
          allergyWarnings.push({
            drug: item.drug.name,
            allergen,
            severity: 'HIGH'
          })
        }
      }
    }

    await prisma.prescription.update({
      where: { id },
      data: { status: 'VERIFIED', notes }
    })

    return sendResponse(res, 200, 'Prescription verified', {
      prescription,
      allergyWarnings
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to verify prescription', error.message)
  }
}

// ─── Dispense Prescription ─────────────────────────────
const dispensePrescription = async (req, res) => {
  try {
    const { id } = req.params
    const {
      items = [], // [{ prescriptionItemId, quantityDispensed, batchId }]
      counselingNotes,
      patientCounseled
    } = req.body

    const prescription = await prisma.prescription.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            drug: {
              include: {
                stockBatches: {
                  where: { remainingQty: { gt: 0 } },
                  orderBy: { expiryDate: 'asc' } // FEFO
                }
              }
            }
          }
        },
        visit: {
          include: {
            patient: {
              select: { id: true, mrn: true, firstName: true, lastName: true }
            }
          }
        }
      }
    })

    if (!prescription) return sendError(res, 404, 'Prescription not found')
    if (prescription.status === 'DISPENSED') {
      return sendError(res, 400, 'Prescription already fully dispensed')
    }

    await prisma.$transaction(async (tx) => {
      for (const dispenseItem of items) {
        const rxItem = prescription.items.find(
          i => i.id === dispenseItem.prescriptionItemId
        )
        if (!rxItem) continue

        const qtyToDispense = parseInt(dispenseItem.quantityDispensed)

        // Deduct from stock (FEFO - First Expiry First Out)
        let remainingToDeduct = qtyToDispense
        for (const batch of rxItem.drug.stockBatches) {
          if (remainingToDeduct <= 0) break

          const deduct = Math.min(batch.remainingQty, remainingToDeduct)
          await tx.drugBatch.update({
            where: { id: batch.id },
            data: { remainingQty: batch.remainingQty - deduct }
          })
          remainingToDeduct -= deduct
        }

        // Update dispensed quantity
        await tx.prescriptionItem.update({
          where: { id: dispenseItem.prescriptionItemId },
          data: {
            dispensedQty: rxItem.dispensedQty + qtyToDispense
          }
        })
      }

      // Check if fully or partially dispensed
      const updatedItems = await tx.prescriptionItem.findMany({
        where: { prescriptionId: id }
      })

      const allFullyDispensed = updatedItems.every(
        i => i.dispensedQty >= i.quantity
      )
      const anyDispensed = updatedItems.some(i => i.dispensedQty > 0)

      const newStatus = allFullyDispensed
        ? 'DISPENSED'
        : anyDispensed
        ? 'PARTIALLY_DISPENSED'
        : 'VERIFIED'

      await tx.prescription.update({
        where: { id },
        data: {
          status: newStatus,
          dispensedAt: allFullyDispensed ? new Date() : null
        }
      })

      // Update payment slip status
      await tx.paymentSlip.updateMany({
        where: { prescriptionId: id },
        data: { status: 'PAID', paidAt: new Date() }
      })
    })

    // Notify doctor/nurse that prescription is dispensed
    const io = req.app.get('io')
    io.emit('pharmacy:dispensed', {
      prescriptionId: id,
      patientName: `${prescription.visit.patient.firstName} ${prescription.visit.patient.lastName}`,
      mrn: prescription.visit.patient.mrn
    })

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'DISPENSE',
        module: 'PRESCRIPTION',
        recordId: id,
        newValues: { items, counselingNotes },
        ipAddress: req.ip
      }
    })

    return sendResponse(res, 200, 'Prescription dispensed', {
      prescriptionId: id
    })
  } catch (error) {
    console.error('Dispense error:', error)
    return sendError(res, 500, 'Failed to dispense prescription', error.message)
  }
}

// ─── Drug Management ───────────────────────────────────
const getDrugs = async (req, res) => {
  try {
    const { search, category, isActive = 'true', lowStock } = req.query

    const where = { isActive: isActive === 'true' }
    if (category) where.category = category
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { genericName: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } }
      ]
    }

    const drugs = await prisma.drug.findMany({
      where,
      include: {
        stockBatches: {
          where: {
            remainingQty: { gt: 0 },
            expiryDate: { gt: new Date() }
          },
          orderBy: { expiryDate: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    })

    // Calculate total stock for each drug
    const drugsWithStock = drugs.map(drug => {
      const totalStock = drug.stockBatches.reduce(
        (sum, b) => sum + b.remainingQty, 0
      )
      const nearestExpiry = drug.stockBatches[0]?.expiryDate
      const isLowStock = totalStock <= drug.reorderLevel

      return {
        ...drug,
        totalStock,
        nearestExpiry,
        isLowStock
      }
    })

    const filtered = lowStock === 'true'
      ? drugsWithStock.filter(d => d.isLowStock)
      : drugsWithStock

    return sendResponse(res, 200, 'Drugs fetched', {
      drugs: filtered,
      stats: {
        total: drugsWithStock.length,
        lowStock: drugsWithStock.filter(d => d.isLowStock).length,
        outOfStock: drugsWithStock.filter(d => d.totalStock === 0).length
      }
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch drugs', error.message)
  }
}

// ─── Add Drug Batch (Stock In) ─────────────────────────
const addDrugBatch = async (req, res) => {
  try {
    const {
      drugId, batchNumber, expiryDate,
      quantity, purchasePrice, supplierId
    } = req.body

    if (!drugId || !quantity || !expiryDate) {
      return sendError(res, 400, 'drugId, quantity, expiryDate required')
    }

    const batch = await prisma.drugBatch.create({
      data: {
        drugId,
        batchNumber,
        expiryDate: new Date(expiryDate),
        quantity: parseInt(quantity),
        remainingQty: parseInt(quantity),
        purchasePrice: parseFloat(purchasePrice),
        supplierId
      },
      include: { drug: true }
    })

    // Check if this resolves low stock - notify
    const totalStock = await prisma.drugBatch.aggregate({
      where: { drugId, remainingQty: { gt: 0 } },
      _sum: { remainingQty: true }
    })

    const io = req.app.get('io')
    io.to('role:PHARMACIST').emit('pharmacy:stock_updated', {
      drugId,
      drugName: batch.drug.name,
      newStock: totalStock._sum.remainingQty
    })

    return sendResponse(res, 201, 'Drug batch added', { batch })
  } catch (error) {
    return sendError(res, 500, 'Failed to add batch', error.message)
  }
}

// ─── Get Expiring Drugs ────────────────────────────────
const getExpiringDrugs = async (req, res) => {
  try {
    const { days = 30 } = req.query
    const expiryThreshold = new Date(
      Date.now() + parseInt(days) * 24 * 60 * 60 * 1000
    )

    const batches = await prisma.drugBatch.findMany({
      where: {
        expiryDate: { lte: expiryThreshold, gt: new Date() },
        remainingQty: { gt: 0 }
      },
      include: {
        drug: { select: { id: true, name: true, category: true } }
      },
      orderBy: { expiryDate: 'asc' }
    })

    return sendResponse(res, 200, 'Expiring drugs fetched', { batches })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch expiring drugs', error.message)
  }
}

module.exports = {
  createPrescription,
  getPharmacyQueue,
  verifyPrescription,
  dispensePrescription,
  getDrugs,
  addDrugBatch,
  getExpiringDrugs
}