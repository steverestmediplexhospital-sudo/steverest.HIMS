// backend/src/controllers/surgery.controller.js
const { PrismaClient } = require('@prisma/client')
const { generateSurgeryNo } = require('../services/id-generator.service')
const { sendResponse, sendError } = require('../utils/response.utils')

const prisma = new PrismaClient()

// ─── Create Surgery Request ────────────────────────────
const createSurgeryRequest = async (req, res) => {
  try {
    const {
      visitId,
      surgeonId,
      procedureName,
      icdCode,
      scheduledAt,
      theatreRoom,
      anaesthesiaType,
      preOpNotes,
      urgency = 'ELECTIVE'
    } = req.body

    if (!visitId || !surgeonId || !procedureName) {
      return sendError(res, 400, 'visitId, surgeonId, procedureName required')
    }

    const surgeryNumber = await generateSurgeryNo()

    const surgery = await prisma.surgery.create({
      data: {
        surgeryNumber,
        visitId,
        surgeonId,
        procedureName,
        icdCode,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        theatreRoom,
        anaesthesiaType,
        preOpNotes,
        status: 'REQUESTED'
      },
      include: {
        surgeon: {
          select: { firstName: true, lastName: true, role: true }
        },
        visit: {
          include: {
            patient: {
              select: {
                id: true, mrn: true,
                firstName: true, lastName: true,
                gender: true, dateOfBirth: true,
                bloodGroup: true, allergies: true
              }
            }
          }
        }
      }
    })

    // Create payment slip for surgery
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      select: { patientId: true }
    })

    // Notify theatre nurses and surgeons
    const io = req.app.get('io')
    io.to('role:THEATRE_NURSE').emit('surgery:new_request', {
      surgeryId: surgery.id,
      surgeryNumber,
      procedureName,
      scheduledAt,
      theatreRoom,
      patientName: `${surgery.visit.patient.firstName} ${surgery.visit.patient.lastName}`
    })
    io.to(`user:${surgeonId}`).emit('surgery:assigned', {
      surgeryId: surgery.id,
      surgeryNumber,
      procedureName,
      scheduledAt
    })

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'CREATE',
        module: 'SURGERY',
        recordId: surgery.id,
        newValues: { surgeryNumber, procedureName, surgeonId },
        ipAddress: req.ip
      }
    })

    return sendResponse(res, 201, 'Surgery request created', { surgery })
  } catch (error) {
    console.error('Surgery error:', error)
    return sendError(res, 500, 'Failed to create surgery request', error.message)
  }
}

// ─── Get All Surgeries ─────────────────────────────────
const getSurgeries = async (req, res) => {
  try {
    const {
      status, surgeonId,
      date, page = 1, limit = 20
    } = req.query

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where = {}

    if (status) where.status = status
    if (surgeonId) where.surgeonId = surgeonId

    if (date) {
      where.scheduledAt = {
        gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
        lte: new Date(new Date(date).setHours(23, 59, 59, 999))
      }
    }

    const [surgeries, total] = await Promise.all([
      prisma.surgery.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { scheduledAt: 'asc' },
        include: {
          surgeon: {
            select: { firstName: true, lastName: true }
          },
          visit: {
            include: {
              patient: {
                select: {
                  id: true, mrn: true,
                  firstName: true, lastName: true,
                  gender: true, dateOfBirth: true,
                  bloodGroup: true
                }
              }
            }
          }
        }
      }),
      prisma.surgery.count({ where })
    ])

    const stats = {
      total,
      requested: surgeries.filter(s => s.status === 'REQUESTED').length,
      scheduled: surgeries.filter(s => s.status === 'SCHEDULED').length,
      inProgress: surgeries.filter(s => s.status === 'IN_PROGRESS').length,
      completed: surgeries.filter(s => s.status === 'COMPLETED').length,
      cancelled: surgeries.filter(s => s.status === 'CANCELLED').length
    }

    return sendResponse(res, 200, 'Surgeries fetched', {
      surgeries,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch surgeries', error.message)
  }
}

// ─── Update Surgery Status ─────────────────────────────
const updateSurgeryStatus = async (req, res) => {
  try {
    const { id } = req.params
    const {
      status,
      startedAt,
      completedAt,
      intraOpNotes,
      postOpNotes,
      complications,
      theatreRoom,
      scheduledAt
    } = req.body

    const validStatuses = [
      'REQUESTED', 'SCHEDULED', 'IN_PROGRESS',
      'COMPLETED', 'CANCELLED', 'POSTPONED'
    ]

    if (!validStatuses.includes(status)) {
      return sendError(res, 400, `Invalid status. Must be: ${validStatuses.join(', ')}`)
    }

    const surgery = await prisma.surgery.update({
      where: { id },
      data: {
        status,
        startedAt: startedAt ? new Date(startedAt) : undefined,
        completedAt: completedAt ? new Date(completedAt) : undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        intraOpNotes,
        postOpNotes,
        complications,
        theatreRoom,
        updatedAt: new Date()
      },
      include: {
        surgeon: {
          select: { firstName: true, lastName: true }
        },
        visit: {
          include: {
            patient: {
              select: { firstName: true, lastName: true, mrn: true }
            }
          }
        }
      }
    })

    const io = req.app.get('io')
    io.emit('surgery:status_updated', {
      surgeryId: id,
      status,
      surgeryNumber: surgery.surgeryNumber,
      patientName: `${surgery.visit.patient.firstName} ${surgery.visit.patient.lastName}`
    })

    // If completed, notify ward nurse
    if (status === 'COMPLETED') {
      io.to('role:NURSE').emit('surgery:completed', {
        surgeryId: id,
        patientId: surgery.visit.patient.id,
        complications
      })
    }

    return sendResponse(res, 200, 'Surgery status updated', { surgery })
  } catch (error) {
    return sendError(res, 500, 'Failed to update surgery', error.message)
  }
}

// ─── Get Theatre Schedule ──────────────────────────────
const getTheatreSchedule = async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query

    const schedule = await prisma.surgery.findMany({
      where: {
        scheduledAt: {
          gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
          lte: new Date(new Date(date).setHours(23, 59, 59, 999))
        },
        status: { in: ['SCHEDULED', 'IN_PROGRESS', 'REQUESTED'] }
      },
      include: {
        surgeon: {
          select: { firstName: true, lastName: true }
        },
        visit: {
          include: {
            patient: {
              select: {
                id: true, mrn: true,
                firstName: true, lastName: true,
                gender: true, bloodGroup: true
              }
            }
          }
        }
      },
      orderBy: { scheduledAt: 'asc' }
    })

    // Group by theatre room
    const byTheatre = schedule.reduce((acc, s) => {
      const room = s.theatreRoom || 'Unassigned'
      if (!acc[room]) acc[room] = []
      acc[room].push(s)
      return acc
    }, {})

    return sendResponse(res, 200, 'Theatre schedule fetched', {
      date,
      schedule,
      byTheatre,
      totalSurgeries: schedule.length
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to fetch schedule', error.message)
  }
}

module.exports = {
  createSurgeryRequest,
  getSurgeries,
  updateSurgeryStatus,
  getTheatreSchedule
}