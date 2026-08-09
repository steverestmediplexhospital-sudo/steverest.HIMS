// backend/src/controllers/radiology.controller.js

const getPrisma = () => global.prisma

const sendSuccess = (res, message, data = {}, status = 200) =>
  res.status(status).json({ success: true, message, data })

const sendError = (res, message, status = 500) =>
  res.status(status).json({ success: false, message })

// ─── STATS ────────────────────────────────────────────────────────────────
const getStats = async (req, res) => {
  try {
    const prisma = getPrisma()
    const today  = new Date()
    today.setHours(0, 0, 0, 0)

    const [
      totalOrders,
      todayOrders,
      pending,
      reported,
      validated,
    ] = await Promise.all([
      prisma.radiologyOrder.count(),
      prisma.radiologyOrder.count({
        where: { orderedAt: { gte: today } },
      }),
      prisma.radiologyOrder.count({
        where: { status: { in: ["ORDERED", "SCHEDULED", "IMAGING_DONE"] } },
      }),
      prisma.radiologyOrder.count({
        where: { status: "REPORTED" },
      }),
      prisma.radiologyOrder.count({
        where: { status: "VALIDATED" },
      }),
    ])

    return sendSuccess(res, "Stats fetched", {
      totalOrders,
      todayOrders,
      pending,
      reported,
      validated,
    })
  } catch (e) {
    return sendError(res, e.message)
  }
}

// ─── GET SERVICES ─────────────────────────────────────────────────────────
const getServices = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { search, modality } = req.query
    const where = { isActive: true }

    if (modality) where.modality = modality
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ]
    }

    const services = await prisma.radiologyService.findMany({
      where,
      orderBy: [{ modality: "asc" }, { name: "asc" }],
    })

    const grouped = services.reduce((acc, s) => {
      if (!acc[s.modality]) acc[s.modality] = []
      acc[s.modality].push(s)
      return acc
    }, {})

    return sendSuccess(res, "Services fetched", { services, grouped })
  } catch (e) {
    return sendError(res, e.message)
  }
}

// ─── CREATE SERVICE ───────────────────────────────────────────────────────
const createService = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { name, modality, description, price } = req.body

    if (!name?.trim())    return sendError(res, "Name is required", 400)
    if (!modality?.trim()) return sendError(res, "Modality is required", 400)
    if (!price)           return sendError(res, "Price is required", 400)

    const count = await prisma.radiologyService.count()
    const code  = `RAD-${modality.slice(0,3).toUpperCase()}-${String(count + 1).padStart(3, "0")}`

    const service = await prisma.radiologyService.create({
      data: {
        name:        name.trim(),
        code,
        modality:    modality.trim(),
        description: description || null,
        price:       parseFloat(price),
        isActive:    true,
      },
    })

    return sendSuccess(res, "Service created", { service }, 201)
  } catch (e) {
    return sendError(res, e.message)
  }
}

// ─── GET QUEUE (orders) ───────────────────────────────────────────────────
const getQueue = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { status, date, priority } = req.query

    const today = new Date()
    const where = {
      orderedAt: {
        gte: date
          ? new Date(new Date(date).setHours(0, 0, 0, 0))
          : new Date(today.setHours(0, 0, 0, 0)),
        lte: date
          ? new Date(new Date(date).setHours(23, 59, 59, 999))
          : new Date(new Date().setHours(23, 59, 59, 999)),
      },
    }

    if (status)   where.status   = status
    if (priority) where.priority = priority

    const orders = await prisma.radiologyOrder.findMany({
      where,
      include: {
        service: true,
        report: {
          include: {
            reportedBy: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        visit: {
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
              },
            },
          },
        },
      },
      orderBy: { orderedAt: "asc" },
    })

    return sendSuccess(res, "Queue fetched", { orders })
  } catch (e) {
    return sendError(res, e.message)
  }
}

// ─── GET ALL ORDERS (with filters, no date restriction) ───────────────────
const getOrders = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { status, priority, search, limit = 50, page = 1 } = req.query
    const where = {}

    if (status)   where.status   = status
    if (priority) where.priority = priority
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        {
          visit: {
            patient: {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName:  { contains: search, mode: "insensitive" } },
                { mrn:       { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
      ]
    }

    const [orders, total] = await Promise.all([
      prisma.radiologyOrder.findMany({
        where,
        include: {
          service: true,
          report: {
            include: {
              reportedBy: {
                select: { firstName: true, lastName: true },
              },
            },
          },
          visit: {
            include: {
              patient: {
                select: {
                  id: true, mrn: true,
                  firstName: true, lastName: true,
                  gender: true, dateOfBirth: true, phone: true,
                },
              },
            },
          },
        },
        orderBy: { orderedAt: "desc" },
        take:    parseInt(limit),
        skip:    (parseInt(page) - 1) * parseInt(limit),
      }),
      prisma.radiologyOrder.count({ where }),
    ])

    return sendSuccess(res, "Orders fetched", { orders, total })
  } catch (e) {
    return sendError(res, e.message)
  }
}

// ─── CREATE ORDER ─────────────────────────────────────────────────────────
const createOrder = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { visitId, serviceId, priority, clinicalInfo, scheduledAt } = req.body

    if (!visitId)   return sendError(res, "visitId is required", 400)
    if (!serviceId) return sendError(res, "serviceId is required", 400)

    const year        = new Date().getFullYear()
    const count       = await prisma.radiologyOrder.count()
    const orderNumber = `RAD-${year}-${String(count + 1).padStart(4, "0")}`

    const order = await prisma.radiologyOrder.create({
      data: {
        orderNumber,
        visitId,
        serviceId,
        orderedById:  req.user.id,
        priority:     priority    || "ROUTINE",
        clinicalInfo: clinicalInfo || null,
        scheduledAt:  scheduledAt  ? new Date(scheduledAt) : null,
        status:       "ORDERED",
      },
      include: {
        service: true,
        visit: {
          include: {
            patient: {
              select: { firstName: true, lastName: true, mrn: true },
            },
          },
        },
      },
    })

    // Notify radiographers
    try {
      const io = req.app.get("io")
      if (io) {
        io.to("role:RADIOGRAPHER").emit("radiology:new_order", {
          orderId:     order.id,
          orderNumber,
          service:     order.service.name,
          priority:    priority || "ROUTINE",
        })
      }
    } catch (_) {}

    // Audit log
    prisma.auditLog.create({
      data: {
        userId:   req.user.id,
        action:   "CREATE_RADIOLOGY_ORDER",
        module:   "RADIOLOGY",
        recordId: order.id,
      },
    }).catch(() => {})

    return sendSuccess(res, "Radiology order created", { order }, 201)
  } catch (e) {
    return sendError(res, e.message)
  }
}

// ─── UPDATE ORDER STATUS ──────────────────────────────────────────────────
const updateOrderStatus = async (req, res) => {
  try {
    const prisma    = getPrisma()
    const { id }    = req.params
    const { status, scheduledAt } = req.body

    const existing = await prisma.radiologyOrder.findUnique({ where: { id } })
    if (!existing) return sendError(res, "Order not found", 404)

    const data = { status: status || existing.status }
    if (scheduledAt) data.scheduledAt = new Date(scheduledAt)

    const order = await prisma.radiologyOrder.update({
      where: { id },
      data,
      include: { service: true },
    })

    return sendSuccess(res, "Order updated", { order })
  } catch (e) {
    return sendError(res, e.message)
  }
}

// ─── SUBMIT REPORT ────────────────────────────────────────────────────────
const submitReport = async (req, res) => {
  try {
    const prisma      = getPrisma()
    const { orderId } = req.params
    const { findings, impression, recommendation, imageUrls } = req.body

    if (!findings?.trim()) return sendError(res, "Findings are required", 400)

    // Check order exists
    const order = await prisma.radiologyOrder.findUnique({
      where:   { id: orderId },
      include: {
        service: { select: { name: true } },
        visit: {
          include: {
            consultations: {
              select:  { doctorId: true },
              orderBy: { consultationDate: "desc" },
              take:    1,
            },
            patient: {
              select: { firstName: true, lastName: true, mrn: true },
            },
          },
        },
      },
    })

    if (!order) return sendError(res, "Order not found", 404)

    // Check if report already exists
    const existing = await prisma.radiologyReport.findUnique({
      where: { radiologyOrderId: orderId },
    })
    if (existing) return sendError(res, "Report already submitted for this order", 400)

    const report = await prisma.radiologyReport.create({
      data: {
        radiologyOrderId: orderId,
        reportedById:     req.user.id,
        findings:         findings.trim(),
        impression:       impression    || null,
        recommendation:   recommendation || null,
        imageUrls:        imageUrls     || [],
        reportedAt:       new Date(),
      },
    })

    // Update order status
    await prisma.radiologyOrder.update({
      where: { id: orderId },
      data:  { status: "REPORTED" },
    })

    // Notify doctor
    const doctorId = order?.visit?.consultations?.[0]?.doctorId
    if (doctorId) {
      try {
        const io = req.app.get("io")
        if (io) {
          io.to(`user:${doctorId}`).emit("radiology:report_ready", {
            orderId,
            service:     order.service.name,
            patientName: `${order.visit.patient.firstName} ${order.visit.patient.lastName}`,
            mrn:         order.visit.patient.mrn,
          })
        }

        await prisma.notification.create({
          data: {
            userId:  doctorId,
            title:   "📸 Radiology Report Ready",
            message: `${order.service.name} report ready for ${order.visit.patient.firstName} ${order.visit.patient.lastName}`,
            type:    "RADIOLOGY_RESULT",
            link:    `/visits/${order.visitId}`,
          },
        })
      } catch (_) {}
    }

    // Audit log
    prisma.auditLog.create({
      data: {
        userId:   req.user.id,
        action:   "SUBMIT_RADIOLOGY_REPORT",
        module:   "RADIOLOGY",
        recordId: report.id,
      },
    }).catch(() => {})

    return sendSuccess(res, "Report submitted", { report }, 201)
  } catch (e) {
    return sendError(res, e.message)
  }
}

// ─── VALIDATE REPORT ──────────────────────────────────────────────────────
const validateReport = async (req, res) => {
  try {
    const prisma    = getPrisma()
    const { id }    = req.params

    const report = await prisma.radiologyReport.findUnique({ where: { id } })
    if (!report) return sendError(res, "Report not found", 404)

    const updated = await prisma.radiologyReport.update({
      where: { id },
      data:  { validatedAt: new Date() },
    })

    // Update order status
    await prisma.radiologyOrder.update({
      where: { id: report.radiologyOrderId },
      data:  { status: "VALIDATED" },
    })

    return sendSuccess(res, "Report validated", { report: updated })
  } catch (e) {
    return sendError(res, e.message)
  }
}

// ─── GET SINGLE ORDER ─────────────────────────────────────────────────────
const getOrder = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { id } = req.params

    const order = await prisma.radiologyOrder.findUnique({
      where: { id },
      include: {
        service: true,
        report: {
          include: {
            reportedBy: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        visit: {
          include: {
            patient: {
              select: {
                id: true, mrn: true,
                firstName: true, lastName: true,
                gender: true, dateOfBirth: true,
                phone: true, bloodGroup: true,
              },
            },
          },
        },
      },
    })

    if (!order) return sendError(res, "Order not found", 404)
    return sendSuccess(res, "Order fetched", { order })
  } catch (e) {
    return sendError(res, e.message)
  }
}

module.exports = {
  getStats,
  getServices,
  createService,
  getQueue,
  getOrders,
  createOrder,
  updateOrderStatus,
  submitReport,
  validateReport,
  getOrder,
}