// backend/src/controllers/lab.controller.js
const { PrismaClient } = require('@prisma/client')
const { generateLabOrderNo } = require('../services/id-generator.service')
const { sendResponse, sendError } = require('../utils/response.utils')

const prisma = new PrismaClient()

// ─── Create Lab Order ──────────────────────────────────
const createLabOrder = async (req, res) => {
  try {
    const {
      visitId,
      tests = [],       // [{ labTestId, specimenType }]
      priority,
      clinicalInfo
    } = req.body

    if (!visitId || tests.length === 0) {
      return sendError(res, 400, 'visitId and at least one test required')
    }

    // Validate all test IDs
    const testIds = tests.map(t => t.labTestId)
    const validTests = await prisma.labTest.findMany({
      where: { id: { in: testIds }, isActive: true }
    })

    if (validTests.length !== testIds.length) {
      return sendError(res, 400, 'One or more invalid test IDs')
    }

    const orderNumber = await generateLabOrderNo()

    const labOrder = await prisma.$transaction(async (tx) => {
      // Create the order
      const order = await tx.labOrder.create({
        data: {
          orderNumber,
          visitId,
          orderedById: req.user.id,
          priority: priority || 'ROUTINE',
          clinicalInfo,
          status: 'PENDING'
        }
      })

      // Create order items
      await tx.labOrderItem.createMany({
        data: tests.map(t => ({
          labOrderId: order.id,
          labTestId: t.labTestId,
          status: 'ORDERED'
        }))
      })

      // Create payment slip
      const totalPrice = validTests.reduce(
        (sum, t) => sum + parseFloat(t.price), 0
      )

      await tx.paymentSlip.create({
        data: {
          trackingNumber: `SLP-LAB-${orderNumber}`,
          patientId: (await tx.visit.findUnique({
            where: { id: visitId },
            select: { patientId: true }
          })).patientId,
          visitId,
          amount: totalPrice,
          description: `Lab tests: ${validTests.map(t => t.name).join(', ')}`,
          sourceType: 'LAB',
          labOrderId: order.id,
          createdById: req.user.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      })

      return order
    })

    // Fetch complete order
    const completeOrder = await prisma.labOrder.findUnique({
      where: { id: labOrder.id },
      include: {
        items: {
          include: { labTest: true }
        },
        visit: {
          include: {
            patient: {
              select: {
                id: true, mrn: true,
                firstName: true, lastName: true,
                dateOfBirth: true, gender: true
              }
            }
          }
        }
      }
    })

    // Emit to lab technicians
    const io = req.app.get('io')
    io.to('role:LAB_TECHNICIAN').emit('lab:new_order', {
      orderId: labOrder.id,
      orderNumber,
      priority: priority || 'ROUTINE',
      tests: validTests.map(t => t.name)
    })
    io.to('role:LAB_SCIENTIST').emit('lab:new_order', {
      orderId: labOrder.id,
      orderNumber,
      priority: priority || 'ROUTINE'
    })

    // Audit
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'CREATE',
        module: 'LAB_ORDER',
        recordId: labOrder.id,
        newValues: { orderNumber, visitId, tests: testIds },
        ipAddress: req.ip
      }
    })

    return sendResponse(res, 201, 'Lab order created', { order: completeOrder })
  } catch (error) {
    console.error('Lab order error:', error)
    return sendError(res, 500, 'Failed to create lab order', error.message)
  }
}

// ─── Get Lab Queue (for Lab Tech) ─────────────────────
const getLabQueue = async (req, res) => {
  try {
    const { status, priority, date } = req.query

    const today = new Date()
    const startOfDay = new Date(today.setHours(0, 0, 0, 0))
    const endOfDay = new Date(today.setHours(23, 59, 59, 999))

    const where = {
      orderedAt: date
        ? {
            gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
            lte: new Date(new Date(date).setHours(23, 59, 59, 999))
          }
        : { gte: startOfDay, lte: endOfDay }
    }

    if (status) where.status = status
    if (priority) where.priority = priority

    const orders = await prisma.labOrder.findMany({
      where,
      include: {
        items: {
          include: {
            labTest: true,
            result: true
          }
        },
        visit: {
          include: {
            patient: {
              select: {
                id: true, mrn: true,
                firstName: true, lastName: true,
                dateOfBirth: true, gender: true,
                phone: true
              }
            }
          }
        }
      },
      orderBy: [
        {
          priority: 'asc' // STAT first
        },
        { orderedAt: 'asc' }
      ]
    })

    const stats = {
      total: orders.length,
      pending: orders.filter(o => o.status === 'PENDING').length,
      inProgress: orders.filter(o => o.status === 'IN_PROGRESS').length,
      completed: orders.filter(o => o.status === 'COMPLETED').length,
      stat: orders.filter(o => o.priority === 'STAT').length,
      urgent: orders.filter(o => o.priority === 'URGENT').length
    }

    return sendResponse(res, 200, 'Lab queue fetched', { orders, stats })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch lab queue', error.message)
  }
}

// ─── Collect Specimen ──────────────────────────────────
const collectSpecimen = async (req, res) => {
  try {
    const { itemId } = req.params
    const { sampleId, specimenType } = req.body

    const item = await prisma.labOrderItem.update({
      where: { id: itemId },
      data: {
        status: 'SAMPLE_COLLECTED',
        sampleId,
        collectedAt: new Date()
      },
      include: { labOrder: true, labTest: true }
    })

    // Check if all items collected → update order status
    const allItems = await prisma.labOrderItem.findMany({
      where: { labOrderId: item.labOrderId }
    })

    const allCollected = allItems.every(
      i => i.status !== 'ORDERED'
    )

    if (allCollected) {
      await prisma.labOrder.update({
        where: { id: item.labOrderId },
        data: { status: 'IN_PROGRESS' }
      })
    }

    return sendResponse(res, 200, 'Specimen collected', { item })
  } catch (error) {
    return sendError(res, 500, 'Failed to collect specimen', error.message)
  }
}

// ─── Enter Lab Result ──────────────────────────────────
const enterLabResult = async (req, res) => {
  try {
    const { itemId } = req.params
    const {
      result,
      unit,
      normalRange,
      interpretation,
      isCritical,
      notes
    } = req.body

    if (!result) return sendError(res, 400, 'Result is required')

    // Check if result already exists
    const existing = await prisma.labResult.findUnique({
      where: { labOrderItemId: itemId }
    })

    let labResult
    if (existing) {
      labResult = await prisma.labResult.update({
        where: { labOrderItemId: itemId },
        data: {
          result,
          unit,
          normalRange,
          interpretation,
          isCritical: isCritical || false,
          notes
        }
      })
    } else {
      labResult = await prisma.labResult.create({
        data: {
          labOrderItemId: itemId,
          result,
          unit,
          normalRange,
          interpretation,
          isCritical: isCritical || false,
          notes
        }
      })
    }

    // Update item status
    await prisma.labOrderItem.update({
      where: { id: itemId },
      data: { status: 'COMPLETED' }
    })

    // Check if all items completed
    const item = await prisma.labOrderItem.findUnique({
      where: { id: itemId },
      include: { labOrder: { include: { items: true } } }
    })

    const allCompleted = item.labOrder.items.every(
      i => i.status === 'COMPLETED' || i.status === 'VALIDATED' || i.status === 'CANCELLED'
    )

    if (allCompleted) {
      await prisma.labOrder.update({
        where: { id: item.labOrderId },
        data: { status: 'COMPLETED' }
      })
    }

    // Critical value notification
    if (isCritical) {
      const io = req.app.get('io')

      // Get the ordering doctor
      const order = await prisma.labOrder.findUnique({
        where: { id: item.labOrderId },
        include: {
          visit: {
            include: {
              consultations: {
                select: { doctorId: true },
                orderBy: { consultationDate: 'desc' },
                take: 1
              },
              patient: {
                select: { firstName: true, lastName: true, mrn: true }
              }
            }
          }
        }
      })

      const doctorId = order?.visit?.consultations[0]?.doctorId
      if (doctorId) {
        io.to(`user:${doctorId}`).emit('lab:critical_result', {
          orderId: item.labOrderId,
          itemId,
          patientName: `${order.visit.patient.firstName} ${order.visit.patient.lastName}`,
          mrn: order.visit.patient.mrn,
          testName: item.labTest?.name,
          result,
          message: 'CRITICAL LAB VALUE - Immediate attention required!'
        })

        // Create notification
        await prisma.notification.create({
          data: {
            userId: doctorId,
            title: '🚨 Critical Lab Result',
            message: `Critical value for ${order.visit.patient.firstName} ${order.visit.patient.lastName}: ${result}`,
            type: 'LAB_CRITICAL',
            link: `/visits/${order.visitId}`
          }
        })
      }

      // Also notify clinical coordinator
      io.to('role:CLINICAL_COORDINATOR').emit('lab:critical_result', {
        orderId: item.labOrderId,
        itemId,
        result
      })
    }

    return sendResponse(res, 200, 'Result entered', { labResult })
  } catch (error) {
    console.error('Lab result error:', error)
    return sendError(res, 500, 'Failed to enter result', error.message)
  }
}

// ─── Validate Lab Result ───────────────────────────────
const validateLabResult = async (req, res) => {
  try {
    const { resultId } = req.params

    // Only LAB_SCIENTIST can validate
    if (!['LAB_SCIENTIST', 'SUPER_ADMIN', 'HOSPITAL_ADMIN'].includes(req.user.role)) {
      return sendError(res, 403, 'Only Lab Scientists can validate results')
    }

    const labResult = await prisma.labResult.update({
      where: { id: resultId },
      data: {
        validatedById: req.user.id,
        validatedAt: new Date()
      },
      include: {
        labOrderItem: {
          include: {
            labOrder: {
              include: {
                visit: {
                  include: {
                    patient: {
                      select: {
                        firstName: true,
                        lastName: true,
                        mrn: true
                      }
                    },
                    consultations: {
                      select: { doctorId: true },
                      orderBy: { consultationDate: 'desc' },
                      take: 1
                    }
                  }
                }
              }
            },
            labTest: true
          }
        }
      }
    })

    // Update item status to VALIDATED
    await prisma.labOrderItem.update({
      where: { id: labResult.labOrderItemId },
      data: { status: 'VALIDATED' }
    })

    // Notify doctor
    const doctorId = labResult.labOrderItem.labOrder.visit.consultations[0]?.doctorId
    if (doctorId) {
      const io = req.app.get('io')
      const patient = labResult.labOrderItem.labOrder.visit.patient

      io.to(`user:${doctorId}`).emit('lab:result_ready', {
        resultId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        mrn: patient.mrn,
        testName: labResult.labOrderItem.labTest?.name,
        isCritical: labResult.isCritical
      })

      await prisma.notification.create({
        data: {
          userId: doctorId,
          title: labResult.isCritical
            ? '🚨 Critical Lab Result Ready'
            : '✅ Lab Result Ready',
          message: `Result ready for ${patient.firstName} ${patient.lastName} - ${labResult.labOrderItem.labTest?.name}`,
          type: labResult.isCritical ? 'LAB_CRITICAL' : 'LAB_RESULT',
          link: `/visits/${labResult.labOrderItem.labOrder.visitId}`
        }
      })
    }

    return sendResponse(res, 200, 'Result validated', { labResult })
  } catch (error) {
    return sendError(res, 500, 'Failed to validate result', error.message)
  }
}

// ─── Get All Lab Tests (catalog) ───────────────────────
const getLabTests = async (req, res) => {
  try {
    const { category, search, isActive = 'true' } = req.query

    const where = { isActive: isActive === 'true' }
    if (category) where.category = category
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } }
      ]
    }

    const tests = await prisma.labTest.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }]
    })

    // Group by category
    const grouped = tests.reduce((acc, test) => {
      if (!acc[test.category]) acc[test.category] = []
      acc[test.category].push(test)
      return acc
    }, {})

    return sendResponse(res, 200, 'Lab tests fetched', {
      tests,
      grouped,
      categories: Object.keys(grouped)
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch tests', error.message)
  }
}

// ─── Create/Update Lab Test (Admin) ───────────────────
const upsertLabTest = async (req, res) => {
  try {
    const { id } = req.params
    const {
      name, code, category, description,
      price, unit, normalRange,
      turnaroundHours, isActive
    } = req.body

    if (!name || !code || !category || price === undefined) {
      return sendError(res, 400, 'name, code, category, price required')
    }

    let test
    if (id) {
      test = await prisma.labTest.update({
        where: { id },
        data: {
          name, category, description,
          price: parseFloat(price),
          unit, normalRange,
          turnaroundHours: turnaroundHours ? parseInt(turnaroundHours) : 24,
          isActive: isActive !== undefined ? isActive : true
        }
      })
    } else {
      test = await prisma.labTest.create({
        data: {
          name, code, category, description,
          price: parseFloat(price),
          unit, normalRange,
          turnaroundHours: turnaroundHours ? parseInt(turnaroundHours) : 24
        }
      })
    }

    return sendResponse(
      res,
      id ? 200 : 201,
      `Lab test ${id ? 'updated' : 'created'}`,
      { test }
    )
  } catch (error) {
    if (error.code === 'P2002') {
      return sendError(res, 409, 'Lab test code already exists')
    }
    return sendError(res, 500, 'Failed to save lab test', error.message)
  }
}

// ─── Get Lab Order with Results ────────────────────────
const getLabOrderById = async (req, res) => {
  try {
    const { id } = req.params

    const order = await prisma.labOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            labTest: true,
            result: {
              include: {
                validatedBy: {
                  select: { firstName: true, lastName: true }
                }
              }
            }
          }
        },
        visit: {
          include: {
            patient: {
              select: {
                id: true, mrn: true,
                firstName: true, lastName: true,
                dateOfBirth: true, gender: true,
                bloodGroup: true
              }
            }
          }
        }
      }
    })

    if (!order) return sendError(res, 404, 'Lab order not found')

    return sendResponse(res, 200, 'Lab order fetched', { order })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch lab order', error.message)
  }
}

// ─── Cancel Lab Order Item ─────────────────────────────
const cancelLabOrderItem = async (req, res) => {
  try {
    const { itemId } = req.params
    const { reason } = req.body

    const item = await prisma.labOrderItem.update({
      where: { id: itemId },
      data: { status: 'CANCELLED' }
    })

    await prisma.progressNote.create({
      data: {
        visitId: (await prisma.labOrder.findUnique({
          where: { id: item.labOrderId },
          select: { visitId: true }
        })).visitId,
        authorId: req.user.id,
        noteType: 'LAB_CANCELLED',
        note: `Lab test cancelled. Reason: ${reason || 'Not specified'}`
      }
    })

    return sendResponse(res, 200, 'Lab item cancelled', { item })
  } catch (error) {
    return sendError(res, 500, 'Failed to cancel lab item', error.message)
  }
}

module.exports = {
  createLabOrder,
  getLabQueue,
  collectSpecimen,
  enterLabResult,
  validateLabResult,
  getLabTests,
  upsertLabTest,
  getLabOrderById,
  cancelLabOrderItem
}