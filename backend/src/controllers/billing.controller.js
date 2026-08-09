// backend/src/controllers/billing.controller.js
const { PrismaClient } = require('@prisma/client')
const { generateBillNo, generatePaymentNo } = require('../services/id-generator.service')
const { sendResponse, sendError } = require('../utils/response.utils')

const prisma = new PrismaClient()

// ─── Get/Create Bill for Patient ──────────────────────
const getOrCreateBill = async (req, res) => {
  try {
    const { patientId, visitId } = req.query

    if (!patientId) return sendError(res, 400, 'patientId required')

    let bill = await prisma.bill.findFirst({
      where: {
        patientId,
        visitId: visitId || undefined,
        status: { in: ['OPEN', 'PENDING_PAYMENT', 'PARTIALLY_PAID'] }
      },
      include: {
        items: {
          include: { serviceCatalog: true }
        },
        payments: true,
        paymentSlips: true,
        patient: {
          select: {
            id: true, mrn: true,
            firstName: true, lastName: true,
            phone: true,
            insuranceProvider: true,
            insurancePolicyNo: true
          }
        }
      }
    })

    if (!bill) {
      const billNumber = await generateBillNo()
      bill = await prisma.bill.create({
        data: {
          billNumber,
          patientId,
          visitId: visitId || undefined,
          status: 'OPEN'
        },
        include: {
          items: true,
          payments: true,
          patient: {
            select: {
              id: true, mrn: true,
              firstName: true, lastName: true,
              phone: true
            }
          }
        }
      })
    }

    return sendResponse(res, 200, 'Bill fetched', { bill })
  } catch (error) {
    return sendError(res, 500, 'Failed to get bill', error.message)
  }
}

// ─── Add Bill Item ─────────────────────────────────────
const addBillItem = async (req, res) => {
  try {
    const {
      billId,
      description,
      category,
      quantity = 1,
      unitPrice,
      serviceCatalogId,
      sourceType,
      sourceId
    } = req.body

    if (!billId || !description || unitPrice === undefined) {
      return sendError(res, 400, 'billId, description, unitPrice required')
    }

    const totalPrice = parseFloat(unitPrice) * parseInt(quantity)

    const item = await prisma.billItem.create({
      data: {
        billId,
        description,
        quantity: parseInt(quantity),
        unitPrice: parseFloat(unitPrice),
        totalPrice,
        serviceCatalogId,
        sourceType,
        sourceId,
        paymentStatus: 'PENDING'
      }
    })

    // Update bill total
    await updateBillTotals(billId)

    return sendResponse(res, 201, 'Bill item added', { item })
  } catch (error) {
    return sendError(res, 500, 'Failed to add bill item', error.message)
  }
}

// ─── Process Payment ───────────────────────────────────
const processPayment = async (req, res) => {
  try {
    const {
      billId,
      paymentSlipId,
      amount,
      method,
      reference,
      notes
    } = req.body

    if (!billId || !amount || !method) {
      return sendError(res, 400, 'billId, amount, method required')
    }

    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: { payments: true }
    })

    if (!bill) return sendError(res, 404, 'Bill not found')

    const paymentNumber = await generatePaymentNo()

    const payment = await prisma.$transaction(async (tx) => {
      const pay = await tx.payment.create({
        data: {
          paymentNumber,
          billId,
          paymentSlipId,
          amount: parseFloat(amount),
          method,
          reference,
          notes,
          processedById: req.user.id,
          processedAt: new Date()
        }
      })

      // Update bill paid amount and status
      const totalPaid = bill.payments.reduce(
        (sum, p) => sum + parseFloat(p.amount), 0
      ) + parseFloat(amount)

      const billTotal = parseFloat(bill.totalAmount)
      let newStatus = 'OPEN'
      if (totalPaid >= billTotal) newStatus = 'PAID'
      else if (totalPaid > 0) newStatus = 'PARTIALLY_PAID'

      await tx.bill.update({
        where: { id: billId },
        data: {
          paidAmount: totalPaid,
          status: newStatus
        }
      })

      // Update payment slip if provided
      if (paymentSlipId) {
        await tx.paymentSlip.update({
          where: { id: paymentSlipId },
          data: { status: 'PAID', paidAt: new Date() }
        })
      }

      return pay
    })

    // Emit payment confirmation
    const io = req.app.get('io')
    io.emit('billing:payment_received', {
      billId,
      amount,
      method,
      paymentNumber
    })

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'PAYMENT',
        module: 'BILLING',
        recordId: billId,
        newValues: { amount, method, paymentNumber },
        ipAddress: req.ip
      }
    })

    return sendResponse(res, 201, 'Payment processed', { payment })
  } catch (error) {
    return sendError(res, 500, 'Failed to process payment', error.message)
  }
}

// ─── Get Service Catalog ───────────────────────────────
const getServiceCatalog = async (req, res) => {
  try {
    const { category, search } = req.query

    const where = { isActive: true }
    if (category) where.category = category
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } }
      ]
    }

    const services = await prisma.serviceCatalog.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }]
    })

    const grouped = services.reduce((acc, s) => {
      if (!acc[s.category]) acc[s.category] = []
      acc[s.category].push(s)
      return acc
    }, {})

    return sendResponse(res, 200, 'Service catalog fetched', {
      services,
      grouped
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch catalog', error.message)
  }
}

// ─── Get Financial Summary (Dashboard) ────────────────
const getFinancialSummary = async (req, res) => {
  try {
    const { period = 'today' } = req.query

    let startDate, endDate
    const now = new Date()

    switch (period) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0))
        endDate = new Date(now.setHours(23, 59, 59, 999))
        break
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7))
        endDate = new Date()
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        break
      default:
        startDate = new Date(now.setHours(0, 0, 0, 0))
        endDate = new Date(now.setHours(23, 59, 59, 999))
    }

    const [payments, bills, pendingBills] = await Promise.all([
      prisma.payment.aggregate({
        where: { processedAt: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
        _count: true
      }),
      prisma.bill.aggregate({
        where: { createdAt: { gte: startDate, lte: endDate } },
        _sum: { totalAmount: true },
        _count: true
      }),
      prisma.bill.aggregate({
        where: {
          status: { in: ['OPEN', 'PENDING_PAYMENT', 'PARTIALLY_PAID'] }
        },
        _sum: { totalAmount: true },
        _count: true
      })
    ])

    // Revenue by payment method
    const revenueByMethod = await prisma.payment.groupBy({
      by: ['method'],
      where: { processedAt: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
      _count: true
    })

    return sendResponse(res, 200, 'Financial summary', {
      period,
      totalCollected: payments._sum.amount || 0,
      totalTransactions: payments._count,
      totalBilled: bills._sum.totalAmount || 0,
      totalBills: bills._count,
      outstandingAmount: pendingBills._sum.totalAmount || 0,
      outstandingBills: pendingBills._count,
      revenueByMethod,
      collectionRate: bills._sum.totalAmount
        ? (
            ((payments._sum.amount || 0) / parseFloat(bills._sum.totalAmount)) *
            100
          ).toFixed(1)
        : 0
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch summary', error.message)
  }
}

// ─── Helper: Recalculate Bill Totals ──────────────────
const updateBillTotals = async (billId) => {
  const items = await prisma.billItem.findMany({ where: { billId } })
  const subtotal = items.reduce((sum, i) => sum + parseFloat(i.totalPrice), 0)

  await prisma.bill.update({
    where: { id: billId },
    data: { totalAmount: subtotal }
  })
}

module.exports = {
  getOrCreateBill,
  addBillItem,
  processPayment,
  getServiceCatalog,
  getFinancialSummary
}