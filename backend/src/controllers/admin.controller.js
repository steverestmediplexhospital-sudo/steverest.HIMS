// backend/src/controllers/admin.controller.js
const { sendSuccess, sendError, sendPaginated } = require('../utils/response.utils')
const bcrypt = require('bcryptjs')

const getPrisma = () => global.prisma

const NURSING_ROLES = ['NURSE', 'MIDWIFE', 'THEATRE_NURSE']

// ─── USERS ────────────────────────────────────────────────────────────────────

const getUsers = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { page = 1, limit = 20, role, status, search } = req.query
    const skip  = (Number(page) - 1) * Number(limit)

    const where = {}
    if (role)   where.role   = role
    if (status) where.status = status
    if (search) {
      where.OR = [
        { firstName:  { contains: search, mode: 'insensitive' } },
        { lastName:   { contains: search, mode: 'insensitive' } },
        { email:      { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        select: {
          id:              true,
          employeeId:      true,
          firstName:       true,
          lastName:        true,
          email:           true,
          phone:           true,
          role:            true,
          status:          true,
          specialization:  true,
          qualification:   true,
          isNurseInCharge: true,
          lastLogin:       true,
          createdAt:       true,
          department: {
            select: { id: true, name: true, code: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ])

    return sendSuccess(res, {
      users,
      data: users,
      meta: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    }, 'Users retrieved successfully')

  } catch (error) {
    console.error('getUsers error:', error)
    return sendError(res, 'Failed to retrieve users: ' + error.message, 500)
  }
}

const createUser = async (req, res) => {
  try {
    const prisma = getPrisma()
    const {
      firstName, lastName, email, phone,
      role, password, employeeId,
      departmentId, specialization, qualification,
      isNurseInCharge
    } = req.body

    // ✅ Validate required fields
    if (!firstName || !lastName || !email || !phone || !role) {
      return sendError(res, 'firstName, lastName, email, phone and role are required', 400)
    }

    // ✅ Check duplicate email
    const existingEmail = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    })
    if (existingEmail) {
      return sendError(res, 'Email already registered', 409)
    }

    // ✅ Check duplicate employeeId if provided
    if (employeeId) {
      const existingEmp = await prisma.user.findFirst({
        where: { employeeId }
      })
      if (existingEmp) {
        return sendError(res, 'Employee ID already exists', 409)
      }
    }

    // ✅ Use provided password or default
    const plainPassword = password || 'TempPass@1234'
    const passwordHash  = await bcrypt.hash(
      plainPassword,
      parseInt(process.env.BCRYPT_ROUNDS) || 10
    )

    // ✅ Auto-generate employee ID if not provided
    const count = await prisma.user.count()
    const empId = employeeId?.trim() || `EMP-${String(count + 1).padStart(4, '0')}`

    const user = await prisma.user.create({
      data: {
        firstName:       firstName.trim(),
        lastName:        lastName.trim(),
        email:           email.toLowerCase().trim(),
        phone:           phone.trim(),
        role,
        passwordHash,
        employeeId:      empId,
        status:          'ACTIVE',
        isNurseInCharge: NURSING_ROLES.includes(role) ? Boolean(isNurseInCharge) : false,
        ...(specialization ? { specialization } : {}),
        ...(qualification  ? { qualification  } : {}),
        ...(departmentId   ? { department: { connect: { id: departmentId } } } : {})
      },
      select: {
        id:              true,
        employeeId:      true,
        firstName:       true,
        lastName:        true,
        email:           true,
        phone:           true,
        role:            true,
        status:          true,
        specialization:  true,
        qualification:   true,
        isNurseInCharge: true,
        createdAt:       true,
        department: {
          select: { id: true, name: true, code: true }
        }
      }
    })

    // ✅ Audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId:    req.user.id,
          action:    'CREATE_USER',
          module:    'ADMIN',
          recordId:  user.id,
          newValues: { email, role, employeeId: empId }
        }
      })
    } catch (auditErr) {
      console.warn('Audit log failed:', auditErr.message)
    }

    return sendSuccess(res, {
      user,
      tempPassword: password ? undefined : 'TempPass@1234'
    }, 'User created successfully', 201)

  } catch (error) {
    console.error('createUser error:', error)
    return sendError(res, 'Failed to create user: ' + error.message, 500)
  }
}

const updateUser = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { id } = req.params
    const {
      firstName, lastName, phone, role,
      departmentId, specialization, qualification,
      status, isNurseInCharge
    } = req.body

    // ✅ Check user exists
    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) return sendError(res, 'User not found', 404)

    const effectiveRole = role || existing.role

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName  && { lastName  }),
        ...(phone     && { phone     }),
        ...(role      && { role      }),
        ...(status    && { status    }),
        ...(specialization !== undefined && specialization
          ? { specialization }
          : specialization === '' ? { specialization: undefined } : {}
        ),
        ...(qualification !== undefined && qualification
          ? { qualification }
          : qualification === '' ? { qualification: undefined } : {}
        ),
        ...(isNurseInCharge !== undefined && {
          isNurseInCharge: NURSING_ROLES.includes(effectiveRole)
            ? Boolean(isNurseInCharge)
            : false
        }),
        ...(departmentId !== undefined && {
          department: departmentId
            ? { connect: { id: departmentId } }
            : { disconnect: true }
        })
      },
      select: {
        id:              true,
        employeeId:      true,
        firstName:       true,
        lastName:        true,
        email:           true,
        phone:           true,
        role:            true,
        status:          true,
        specialization:  true,
        qualification:   true,
        isNurseInCharge: true,
        createdAt:       true,
        department: {
          select: { id: true, name: true, code: true }
        }
      }
    })

    // ✅ Audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId:   req.user.id,
          action:   'UPDATE_USER',
          module:   'ADMIN',
          recordId: id
        }
      })
    } catch (auditErr) {
      console.warn('Audit log failed:', auditErr.message)
    }

    return sendSuccess(res, { user }, 'User updated successfully')

  } catch (error) {
    console.error('updateUser error:', error)
    return sendError(res, 'Failed to update user: ' + error.message, 500)
  }
}

const resetUserPassword = async (req, res) => {
  try {
    const prisma       = getPrisma()
    const { id }       = req.params
    const { password } = req.body

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) return sendError(res, 'User not found', 404)

    const newPassword  = password || 'TempPass@1234'
    const passwordHash = await bcrypt.hash(
      newPassword,
      parseInt(process.env.BCRYPT_ROUNDS) || 10
    )

    await prisma.user.update({
      where: { id },
      data:  { passwordHash }
    })

    // ✅ Audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId:   req.user.id,
          action:   'RESET_PASSWORD',
          module:   'ADMIN',
          recordId: id
        }
      })
    } catch (auditErr) {
      console.warn('Audit log failed:', auditErr.message)
    }

    return sendSuccess(res, { tempPassword: newPassword }, 'Password reset successfully')

  } catch (error) {
    console.error('resetUserPassword error:', error)
    return sendError(res, 'Failed to reset password: ' + error.message, 500)
  }
}

const deactivateUser = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { id } = req.params

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) return sendError(res, 'User not found', 404)

    await prisma.user.update({
      where: { id },
      data:  { status: 'INACTIVE' }
    })

    return sendSuccess(res, {}, 'User deactivated successfully')

  } catch (error) {
    return sendError(res, 'Failed to deactivate user: ' + error.message, 500)
  }
}

const activateUser = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { id } = req.params

    await prisma.user.update({
      where: { id },
      data:  { status: 'ACTIVE' }
    })

    return sendSuccess(res, {}, 'User activated successfully')

  } catch (error) {
    return sendError(res, 'Failed to activate user: ' + error.message, 500)
  }
}

// ─── DEPARTMENTS ──────────────────────────────────────────────────────────────

const getDepartments = async (req, res) => {
  try {
    const prisma      = getPrisma()
    const departments = await prisma.department.findMany({
      include: {
        _count: { select: { users: true, wards: true } }
      },
      orderBy: { name: 'asc' }
    })
    return sendSuccess(res, {
      departments,
      data: departments
    }, 'Departments retrieved')
  } catch (error) {
    return sendError(res, 'Failed to retrieve departments: ' + error.message, 500)
  }
}

const createDepartment = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { name, code, description } = req.body

    if (!name || !code) {
      return sendError(res, 'Name and code are required', 400)
    }

    const dept = await prisma.department.create({
      data: { name, code: code.toUpperCase(), description }
    })

    return sendSuccess(res, { department: dept }, 'Department created', 201)

  } catch (error) {
    if (error.code === 'P2002') {
      return sendError(res, 'Department name or code already exists', 400)
    }
    return sendError(res, 'Failed to create department: ' + error.message, 500)
  }
}

const updateDepartment = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { id } = req.params
    const { name, description, isActive } = req.body

    const dept = await prisma.department.update({
      where: { id },
      data:  { name, description, isActive }
    })

    return sendSuccess(res, { department: dept }, 'Department updated')

  } catch (error) {
    return sendError(res, 'Failed to update department: ' + error.message, 500)
  }
}

// ─── WARDS ────────────────────────────────────────────────────────────────────

const getWards = async (req, res) => {
  try {
    const prisma = getPrisma()
    const wards  = await prisma.ward.findMany({
      include: {
        department: { select: { name: true, code: true } },
        rooms: {
          include: {
            beds: {
              select: { id: true, bedNumber: true, status: true }
            }
          }
        },
        _count: { select: { rooms: true, admissions: true } }
      },
      orderBy: { name: 'asc' }
    })
    return sendSuccess(res, { wards, data: wards }, 'Wards retrieved')
  } catch (error) {
    return sendError(res, 'Failed to retrieve wards: ' + error.message, 500)
  }
}

const createWard = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { name, code, departmentId, floor, capacity, wardType } = req.body

    if (!name || !code) {
      return sendError(res, 'Name and code are required', 400)
    }

    const ward = await prisma.ward.create({
      data: {
        name,
        code:         code.toUpperCase(),
        departmentId: departmentId || null,
        floor:        floor        || null,
        capacity:     Number(capacity) || 0,
        wardType:     wardType     || 'GENERAL'
      }
    })

    return sendSuccess(res, { ward }, 'Ward created', 201)

  } catch (error) {
    if (error.code === 'P2002') {
      return sendError(res, 'Ward code already exists', 400)
    }
    return sendError(res, 'Failed to create ward: ' + error.message, 500)
  }
}

// ─── ROOMS ────────────────────────────────────────────────────────────────────

const getRooms = async (req, res) => {
  try {
    const prisma     = getPrisma()
    const { wardId } = req.query
    const where      = wardId ? { wardId } : {}

    const rooms = await prisma.room.findMany({
      where,
      include: {
        ward: { select: { name: true, code: true } },
        beds: {
          select: { id: true, bedNumber: true, status: true, bedType: true }
        },
        _count: { select: { beds: true } }
      },
      orderBy: { roomNumber: 'asc' }
    })

    return sendSuccess(res, { rooms, data: rooms }, 'Rooms retrieved')
  } catch (error) {
    return sendError(res, 'Failed to retrieve rooms: ' + error.message, 500)
  }
}

const createRoom = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { roomNumber, wardId, roomType, capacity } = req.body

    if (!roomNumber || !wardId) {
      return sendError(res, 'Room number and ward are required', 400)
    }

    const room = await prisma.room.create({
      data: {
        roomNumber,
        wardId,
        roomType: roomType || 'GENERAL',
        capacity: Number(capacity) || 1
      }
    })

    return sendSuccess(res, { room }, 'Room created', 201)
  } catch (error) {
    return sendError(res, 'Failed to create room: ' + error.message, 500)
  }
}

// ─── BEDS ─────────────────────────────────────────────────────────────────────

const getBeds = async (req, res) => {
  try {
    const prisma             = getPrisma()
    const { wardId, status } = req.query
    const where              = {}
    if (wardId) where.room   = { wardId }
    if (status) where.status = status

    const beds = await prisma.bed.findMany({
      where,
      include: {
        room: {
          include: {
            ward: { select: { name: true, code: true } }
          }
        }
      },
      orderBy: { bedNumber: 'asc' }
    })

    return sendSuccess(res, { beds, data: beds }, 'Beds retrieved')
  } catch (error) {
    return sendError(res, 'Failed to retrieve beds: ' + error.message, 500)
  }
}

const createBed = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { bedNumber, roomId, bedType, dailyRate } = req.body

    if (!bedNumber || !roomId) {
      return sendError(res, 'Bed number and room are required', 400)
    }

    const bed = await prisma.bed.create({
      data: {
        bedNumber,
        roomId,
        bedType:   bedType  || 'STANDARD',
        dailyRate: Number(dailyRate) || 0,
        status:    'AVAILABLE'
      }
    })

    return sendSuccess(res, { bed }, 'Bed created', 201)

  } catch (error) {
    if (error.code === 'P2002') {
      return sendError(res, 'Bed number already exists in this room', 400)
    }
    return sendError(res, 'Failed to create bed: ' + error.message, 500)
  }
}

// ─── SYSTEM SETTINGS ──────────────────────────────────────────────────────────

const getSettings = async (req, res) => {
  try {
    const prisma   = getPrisma()
    const settings = await prisma.systemSetting.findMany({
      orderBy: { group: 'asc' }
    })

    const grouped = settings.reduce((acc, s) => {
      const group = s.group || 'general'
      if (!acc[group]) acc[group] = {}
      acc[group][s.key] = s.value
      return acc
    }, {})

    return sendSuccess(res, { settings: grouped, raw: settings }, 'Settings retrieved')
  } catch (error) {
    return sendError(res, 'Failed to retrieve settings: ' + error.message, 500)
  }
}

const updateSetting = async (req, res) => {
  try {
    const prisma                = getPrisma()
    const { key, value, group } = req.body

    if (!key || value === undefined) {
      return sendError(res, 'Key and value are required', 400)
    }

    const setting = await prisma.systemSetting.upsert({
      where:  { key },
      update: { value },
      create: { key, value, group: group || 'general' }
    })

    return sendSuccess(res, { setting }, 'Setting updated')
  } catch (error) {
    return sendError(res, 'Failed to update setting: ' + error.message, 500)
  }
}

// ─── AUDIT LOGS ───────────────────────────────────────────────────────────────

const getAuditLogs = async (req, res) => {
  try {
    const prisma   = getPrisma()
    const { page = 1, limit = 50, module, action } = req.query
    const skip     = (Number(page) - 1) * Number(limit)
    const where    = {}
    if (module) where.module = module
    if (action) where.action = action

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          user: {
            select: {
              firstName: true,
              lastName:  true,
              email:     true,
              role:      true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.auditLog.count({ where })
    ])

    return sendSuccess(res, {
      logs,
      data: logs,
      meta: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    }, 'Audit logs retrieved')

  } catch (error) {
    return sendError(res, 'Failed to retrieve audit logs: ' + error.message, 500)
  }
}

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────

const getDashboardStats = async (req, res) => {
  try {
    const prisma = getPrisma()
    const today  = new Date()
    today.setHours(0, 0, 0, 0)

    const [
      totalPatients,
      todayVisits,
      admitted,
      pendingLabs,
      pendingPrescriptions,
      totalUsers,
      totalDepartments,
      emergencyVisits
    ] = await Promise.all([
      prisma.patient.count({ where: { isActive: true } }),
      prisma.visit.count({ where: { visitDate: { gte: today } } }),
      prisma.admission.count({ where: { status: 'ACTIVE' } }),
      prisma.labOrder.count({ where: { status: { in: ['PENDING','IN_PROGRESS'] } } }),
      prisma.prescription.count({ where: { status: 'PENDING' } }),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.department.count({ where: { isActive: true } }),
      prisma.visit.count({
        where: { visitType: 'EMERGENCY', visitDate: { gte: today } }
      })
    ])

    return sendSuccess(res, {
      totalPatients,
      todayVisits,
      admitted,
      pendingLabs,
      pendingPrescriptions,
      emergency:       emergencyVisits,
      totalUsers,
      totalDepartments
    }, 'Stats retrieved')

  } catch (error) {
    console.error('getDashboardStats error:', error)
    return sendError(res, 'Failed to retrieve stats: ' + error.message, 500)
  }
}

module.exports = {
  getUsers,
  createUser,
  updateUser,
  resetUserPassword,
  deactivateUser,
  activateUser,
  getDepartments,
  createDepartment,
  updateDepartment,
  getWards,
  createWard,
  getRooms,
  createRoom,
  getBeds,
  createBed,
  getSettings,
  updateSetting,
  getAuditLogs,
  getDashboardStats
}