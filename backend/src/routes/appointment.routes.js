

// backend/src/routes/appointment.routes.js
const express = require('express')
const router = express.Router()
const auth = require('../middleware/auth.middleware')
const { generateAppointmentNo } = require('../services/id-generator.service')
const { sendResponse, sendError } = require('../utils/response.utils')

// ALWAYS use global.prisma — never new PrismaClient()
const getPrisma = () => global.prisma

router.use(auth)

router.post('/', async (req, res) => {
  try {
    const prisma = getPrisma()
    const { 
      patientId, doctorId, appointmentDate, 
      appointmentTime, reason, notes, type 
    } = req.body

    if (!patientId)        return sendError(res, 400, 'Patient ID is required')
    if (!appointmentDate)  return sendError(res, 400, 'Appointment date is required')

    const appointmentNo = await generateAppointmentNo()
    
    const appointment = await prisma.appointment.create({
      data: {
        appointmentNo,
        patientId,
        doctorId:        doctorId || null,
        appointmentDate: new Date(appointmentDate),
        appointmentTime: appointmentTime || null,
        reason:          reason || null,
        notes:           notes  || null,
        type:            type   || 'OPD',
        status:          'SCHEDULED',
        createdById:     req.user.id,
      },
      include: {
        patient: {
          select: {
            id: true, patientId: true, fullName: true,
            phone: true, gender: true, dateOfBirth: true
          }
        },
        doctor: {
          select: { id: true, name: true, specialization: true }
        }
      }
    })

    // Socket.IO notification to assigned doctor
    const io = req.app.get('io')
    if (io && doctorId) {
      io.to(`user:${doctorId}`).emit('appointment:new', {
        appointmentId: appointment.id,
        appointmentNo: appointment.appointmentNo,
        patientName:   appointment.patient?.fullName,
        date:          appointmentDate,
      })
    }

    return sendResponse(res, 201, 'Appointment scheduled successfully', { appointment })
  } catch (error) {
    console.error('Create appointment error:', error)
    return sendError(res, 500, 'Failed to create appointment', error.message)
  }
})

router.get('/', async (req, res) => {
  try {
    const prisma = getPrisma()
    const { 
      doctorId, patientId, date, status, 
      type, page = 1, limit = 50 
    } = req.query

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where = {}

    if (doctorId)  where.doctorId  = doctorId
    if (patientId) where.patientId = patientId
    if (status)    where.status    = status
    if (type)      where.type      = type

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
        take:      parseInt(limit),
        orderBy:   { appointmentDate: 'asc' },
        include: {
          patient: {
            select: {
              id: true, patientId: true, fullName: true,
              phone: true, gender: true, dateOfBirth: true
            }
          },
          doctor: {
            select: { id: true, name: true, specialization: true }
          },
          createdBy: {
            select: { id: true, name: true }
          }
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

router.get('/today', async (req, res) => {
  try {
    const prisma = getPrisma()
    const today  = new Date()

    const appointments = await prisma.appointment.findMany({
      where: {
        appointmentDate: {
          gte: new Date(today.setHours(0,  0,  0,   0)),
          lte: new Date(today.setHours(23, 59, 59, 999)),
        }
      },
      orderBy: { appointmentDate: 'asc' },
      include: {
        patient: {
          select: {
            id: true, patientId: true, fullName: true,
            phone: true, gender: true, dateOfBirth: true
          }
        },
        doctor: {
          select: { id: true, name: true, specialization: true }
        }
      }
    })

    // Stats
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

router.get('/:id', async (req, res) => {
  try {
    const prisma = getPrisma()
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: {
        patient: {
          select: {
            id: true, patientId: true, fullName: true,
            phone: true, gender: true, dateOfBirth: true,
            address: true, bloodGroup: true,
          }
        },
        doctor: {
          select: { id: true, name: true, specialization: true, email: true }
        },
        createdBy: {
          select: { id: true, name: true }
        }
      }
    })

    if (!appointment) return sendError(res, 404, 'Appointment not found')

    return sendResponse(res, 200, 'Appointment fetched', { appointment })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch appointment', error.message)
  }
})

router.patch('/:id/status', async (req, res) => {
  try {
    const prisma = getPrisma()
    const { status, notes, cancelReason } = req.body

    const validStatuses = [
      'SCHEDULED','CONFIRMED','IN_PROGRESS',
      'COMPLETED','CANCELLED','NO_SHOW','RESCHEDULED'
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
        patient: {
          select: { id: true, patientId: true, fullName: true, phone: true }
        },
        doctor: {
          select: { id: true, name: true }
        }
      }
    })

    // Notify doctor of status change
    const io = req.app.get('io')
    if (io && appointment.doctorId) {
      io.to(`user:${appointment.doctorId}`).emit('appointment:updated', {
        appointmentId: appointment.id,
        status,
        patientName:   appointment.patient?.fullName,
      })
    }

    return sendResponse(res, 200, 'Appointment status updated', { appointment })
  } catch (error) {
    return sendError(res, 500, 'Failed to update appointment', error.message)
  }
})

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
        type:            type            || undefined,
        status:          'RESCHEDULED',
        updatedAt:       new Date(),
      },
      include: {
        patient: {
          select: { id: true, patientId: true, fullName: true, phone: true }
        },
        doctor: {
          select: { id: true, name: true }
        }
      }
    })

    return sendResponse(res, 200, 'Appointment rescheduled', { appointment })
  } catch (error) {
    return sendError(res, 500, 'Failed to reschedule appointment', error.message)
  }
})

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