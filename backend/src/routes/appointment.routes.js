// backend/src/routes/appointment.routes.js
const express = require('express')
const router  = express.Router()
const auth    = require('../middleware/auth.middleware')
const { generateAppointmentNo } = require('../services/id-generator.service')
const { sendSuccess, sendError } = require('../utils/response.utils')

const getPrisma = () => global.prisma

router.use(auth)

// ── Select helpers ───────────────────────────────────────────
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

    if (!patientId)       return sendError(res, 'Patient ID is required', 400)
    if (!appointmentDate) return sendError(res, 'Appointment date is required', 400)

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

    const io = req.app.get('io')
    if (io && doctorId) {
      io.to(`user:${doctorId}`).emit('appointment:new', {
        appointmentId: appointment.id,
        appointmentNo: appointment.appointmentNo,
        patientName:   `${appointment.patient?.firstName} ${appointment.patient?.lastName}`,
        date:          appointmentDate,
      })
    }

    return sendSuccess(res, { appointment }, 'Appointment scheduled successfully', 201)
  } catch (error) {
    console.error('Create appointment error:', error)
    return sendError(res, 'Failed to create appointment: ' + error.message, 500)
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

    if (doctorId)  where.doctorId        = doctorId
    if (patientId) where.patientId       = patientId
    if (status)    where.status          = status
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

    return sendSuccess(res, {
      appointments,
      pagination: {
        page:  parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      }
    }, 'Appointments fetched')
  } catch (error) {
    console.error('Fetch appointments error:', error)
    return sendError(res, 'Failed to fetch appointments: ' + error.message, 500)
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

    return sendSuccess(res, { appointments, stats }, "Today's appointments")
  } catch (error) {
    return sendError(res, "Failed to fetch today's appointments: " + error.message, 500)
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

    if (!appointment) return sendError(res, 'Appointment not found', 404)
    return sendSuccess(res, { appointment }, 'Appointment fetched')
  } catch (error) {
    return sendError(res, 'Failed to fetch appointment: ' + error.message, 500)
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
      return sendError(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400)
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

    return sendSuccess(res, { appointment }, 'Appointment status updated')
  } catch (error) {
    return sendError(res, 'Failed to update appointment status: ' + error.message, 500)
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

    return sendSuccess(res, { appointment }, 'Appointment rescheduled')
  } catch (error) {
    return sendError(res, 'Failed to reschedule appointment: ' + error.message, 500)
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
    return sendSuccess(res, {}, 'Appointment cancelled')
  } catch (error) {
    return sendError(res, 'Failed to cancel appointment: ' + error.message, 500)
  }
})

module.exports = router