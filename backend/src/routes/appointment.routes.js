// backend/src/routes/appointments.routes.js
const express = require('express')
const router  = express.Router()
const auth    = require('../middleware/auth.middleware')
const { generateAppointmentNo } = require('../services/id-generator.service')
const { sendResponse, sendError } = require('../utils/response.utils')

const getPrisma = () => global.prisma

router.use(auth)

// ── Patient & Doctor select helpers ─────────────────────────
const PATIENT_SELECT = {
  id: true, mrn: true,
  firstName: true, lastName: true,
  phone: true, gender: true, dateOfBirth: true
}

const DOCTOR_SELECT = {
  id: true, firstName: true, lastName: true,
  email: true, role: true
}

const CREATED_BY_SELECT = {
  id: true, firstName: true, lastName: true
}

// ── POST / — Create appointment ──────────────────────────────
router.post('/', async (req, res) => {
  try {
    const prisma = getPrisma()
    const {
      patientId, doctorId, appointmentDate,
      appointmentTime, reason, notes, type
    } = req.body

    if (!patientId)       return sendError(res, 400, 'Patient ID is required')
    if (!appointmentDate) return sendError(res, 400, 'Appointment date is required')

    const appointmentNo = await generateAppointmentNo()

    const appointment = await prisma.appointment.create({
      data: {
        appointmentNo,
        patientId,
        doctorId:        doctorId        || null,
        appointmentDate: new Date(appointmentDate),
        appointmentTime: appointmentTime || null,
        appointmentType: type            || 'OPD',
        reason:          reason          || null,
        notes:           notes           || null,
        status:          'SCHEDULED',
        createdById:     req.user.id,
      },
      include: {
        patient:   { select: PATIENT_SELECT },
        doctor:    { select: DOCTOR_SELECT },
        createdBy: { select: CREATED_BY_SELECT }
      }
    })

    // Notify doctor via Socket.IO
    const io = req.app.get('io')
    if (io && doctorId) {
      io.to(`user:${doctorId}`).emit('appointment:new', {
        appointmentId: appointment.id,
        appointmentNo: appointment.appointmentNo,
        patientName:   `${appointment.patient?.firstName} ${appointment.patient?.lastName}`,
        date:          appointmentDate,
      })
    }

    return sendResponse(res, 201, 'Appointment scheduled successfully', { appointment })
  } catch (error) {
    console.error('Create appointment error:', error)
    return sendError(res, 500, 'Failed to create appointment', error.message)
  }
})

// ── GET / — List appointments ────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const prisma = getPrisma()
    const {
      doctorId, patientId, date, status,
      type, page = 1, limit = 50
    } = req.query

    const skip  = (parseInt(page) - 1) * parseInt(limit)
    const where = {}

    if (doctorId)  where.doctorId       = doctorId
    if (patientId) where.patientId      = patientId
    if (status)    where.status         = status
    if (type)      where.appointmentType = type

    if (date) {
      where.appointmentDate = {
        gte: new Date(new Date(date).setHours(0,  0,  0,   0)),
        lte: new Date(new Date(date).setHours(23, 59, 59, 999)),
      }
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take:    parseInt(limit),
        orderBy: { appointmentDate: 'asc' },
        include: {
          patient:   { select: PATIENT_SELECT },
          doctor:    { select: DOCTOR_SELECT },
          createdBy: { select: CREATED_BY_SELECT }
        }
      }),
      prisma.appointment.count({ where })
    ])

    return sendResponse(res, 200, 'Appointments fetched', {
      appointments,
      pagination: {
        page:  parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      }
    })
  } catch (error) {
    console.error('Fetch appointments error:', error)
    return sendError(res, 500, 'Failed to fetch appointments', error.message)
  }
})

// ── GET /today — Today's appointments ───────────────────────
router.get('/today', async (req, res) => {
  try {
    const prisma = getPrisma()
    const today  = new Date()

    const appointments = await prisma.appointment.findMany({
      where: {
        appointmentDate: {
          gte: new Date(new Date(today).setHours(0,  0,  0,   0)),
          lte: new Date(new Date(today).setHours(23, 59, 59, 999)),
        }
      },
      orderBy: { appointmentDate: 'asc' },
      include: {
        patient: { select: PATIENT_SELECT },
        doctor:  { select: DOCTOR_SELECT }
      }
    })

    const stats = {
      total:     appointments.length,
      scheduled: appointments.filter(a => a.status === 'SCHEDULED').length,
      confirmed: appointments.filter(a => a.status === 'CONFIRMED').length,
      completed: appointments.filter(a => a.status === 'COMPLETED').length,
      cancelled: appointments.filter(a => a.status === 'CANCELLED').length,
      noShow:    appointments.filter(a => a.status === 'NO_SHOW').length,
    }

    return sendResponse(res, 200, "Today's appointments", { appointments, stats })
  } catch (error) {
    return sendError(res, 500, "Failed to fetch today's appointments", error.message)
  }
})

// ── GET /:id — Single appointment ───────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const prisma      = getPrisma()
    const appointment = await prisma.appointment.findUnique({
      where:   { id: req.params.id },
      include: {
        patient:   { select: { ...PATIENT_SELECT, address: true, bloodGroup: true } },
        doctor:    { select: DOCTOR_SELECT },
        createdBy: { select: CREATED_BY_SELECT }
      }
    })

    if (!appointment) return sendError(res, 404, 'Appointment not found')
    return sendResponse(res, 200, 'Appointment fetched', { appointment })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch appointment', error.message)
  }
})

// ── PATCH /:id/status — Update status ───────────────────────
router.patch('/:id/status', async (req, res) => {
  try {
    const prisma = getPrisma()
    const { status, notes, cancelReason } = req.body

    const validStatuses = [
      'SCHEDULED', 'CONFIRMED', 'IN_PROGRESS',
      'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'
    ]
    if (!validStatuses.includes(status)) {
      return sendError(res, 400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`)
    }

    const appointment = await prisma.appointment.update({
      where: { id: req.params.id },
      data: {
        status,
        notes:        notes        || undefined,
        cancelReason: cancelReason || undefined,
        updatedAt:    new Date(),
      },
      include: {
        patient: { select: PATIENT_SELECT },
        doctor:  { select: DOCTOR_SELECT }
      }
    })

    const io = req.app.get('io')
    if (io && appointment.doctorId) {
      io.to(`user:${appointment.doctorId}`).emit('appointment:updated', {
        appointmentId: appointment.id,
        status,
        patientName: `${appointment.patient?.firstName} ${appointment.patient?.lastName}`,
      })
    }

    return sendResponse(res, 200, 'Appointment status updated', { appointment })
  } catch (error) {
    return sendError(res, 500, 'Failed to update appointment status', error.message)
  }
})

// ── PUT /:id — Reschedule ────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const prisma = getPrisma()
    const {
      doctorId, appointmentDate, appointmentTime,
      reason, notes, type
    } = req.body

    const appointment = await prisma.appointment.update({
      where: { id: req.params.id },
      data: {
        doctorId:        doctorId        || undefined,
        appointmentDate: appointmentDate ? new Date(appointmentDate) : undefined,
        appointmentTime: appointmentTime || undefined,
        reason:          reason          || undefined,
        notes:           notes           || undefined,
        appointmentType: type            || undefined,
        status:          'RESCHEDULED',
        updatedAt:       new Date(),
      },
      include: {
        patient: { select: PATIENT_SELECT },
        doctor:  { select: DOCTOR_SELECT }
      }
    })

    return sendResponse(res, 200, 'Appointment rescheduled', { appointment })
  } catch (error) {
    return sendError(res, 500, 'Failed to reschedule appointment', error.message)
  }
})

// ── DELETE /:id — Cancel ─────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const prisma = getPrisma()
    await prisma.appointment.update({
      where: { id: req.params.id },
      data:  { status: 'CANCELLED', updatedAt: new Date() }
    })
    return sendResponse(res, 200, 'Appointment cancelled')
  } catch (error) {
    return sendError(res, 500, 'Failed to cancel appointment', error.message)
  }
})

module.exports = router