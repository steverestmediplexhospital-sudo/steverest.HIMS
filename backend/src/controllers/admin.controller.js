const { PrismaClient } = require('@prisma/client')
const { hashPassword } = require('../utils/password.utils')
const { sendSuccess, sendError, sendPaginated } = require('../utils/response.utils')

const prisma = new PrismaClient()

// ─── USERS ────────────────────────────────────────

const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, status, search } = req.query
    const skip = (page - 1) * limit

    const where = {}
    if (role) where.role = role
    if (status) where.status = status
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: Number(skip),
        take: Number(limit),
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          lastLogin: true,
          createdAt: true,
          department: {
            select: { id: true, name: true, code: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ])

    return sendPaginated(res, users, {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit)
    }, 'Users retrieved successfully')
  } catch (error) {
    console.error('Get users error:', error)
    return sendError(res, 'Failed to retrieve users', 500)
  }
}

const createUser = async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone,
      role, departmentId, employeeId
    } = req.body

    if (!firstName || !lastName || !email || !role || !employeeId) {
      return sendError(res, 'Required fields missing', 400)
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { employeeId }] }
    })

    if (existing) {
      return sendError(res, 'Email or Employee ID already exists', 400)
    }

    const tempPassword = 'TempPass@1234'
    const passwordHash = await hashPassword(tempPassword)

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email: email.toLowerCase().trim(),
        phone,
        role,
        departmentId: departmentId || null,
        employeeId,
        passwordHash,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true
      }
    })

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'CREATE_USER',
        module: 'ADMIN',
        recordId: user.id,
        newValues: { email, role, employeeId }
      }
    })

    return sendSuccess(res, {
      user,
      tempPassword
    }, 'User created successfully', 201)
  } catch (error) {
    console.error('Create user error:', error)
    return sendError(res, 'Failed to create user', 500)
  }
}

const updateUser = async (req, res) => {
  try {
    const { id } = req.params
    const { firstName, lastName, phone, role, departmentId, status } = req.body

    const user = await prisma.user.update({
      where: { id },
      data: {
        firstName,
        lastName,
        phone,
        role,
        departmentId: departmentId || null,
        status
      },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true
      }
    })

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE_USER',
        module: 'ADMIN',
        recordId: id
      }
    })

    return sendSuccess(res, user, 'User updated successfully')
  } catch (error) {
    console.error('Update user error:', error)
    return sendError(res, 'Failed to update user', 500)
  }
}

const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params
    const tempPassword = 'TempPass@1234'
    const passwordHash = await hashPassword(tempPassword)

    await prisma.user.update({
      where: { id },
      data: { passwordHash }
    })

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'RESET_PASSWORD',
        module: 'ADMIN',
        recordId: id
      }
    })

    return sendSuccess(res, { tempPassword }, 'Password reset successfully')
  } catch (error) {
    console.error('Reset password error:', error)
    return sendError(res, 'Failed to reset password', 500)
  }
}

// ─── DEPARTMENTS ──────────────────────────────────

const getDepartments = async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: { select: { users: true, wards: true } }
      },
      orderBy: { name: 'asc' }
    })
    return sendSuccess(res, departments, 'Departments retrieved')
  } catch (error) {
    return sendError(res, 'Failed to retrieve departments', 500)
  }
}

const createDepartment = async (req, res) => {
  try {
    const { name, code, description } = req.body

    if (!name || !code) {
      return sendError(res, 'Name and code are required', 400)
    }

    const dept = await prisma.department.create({
      data: { name, code: code.toUpperCase(), description }
    })

    return sendSuccess(res, dept, 'Department created', 201)
  } catch (error) {
    if (error.code === 'P2002') {
      return sendError(res, 'Department name or code already exists', 400)
    }
    return sendError(res, 'Failed to create department', 500)
  }
}

const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, isActive } = req.body

    const dept = await prisma.department.update({
      where: { id },
      data: { name, description, isActive }
    })

    return sendSuccess(res, dept, 'Department updated')
  } catch (error) {
    return sendError(res, 'Failed to update department', 500)
  }
}

// ─── WARDS ────────────────────────────────────────

const getWards = async (req, res) => {
  try {
    const wards = await prisma.ward.findMany({
      include: {
        department: { select: { name: true, code: true } },
        _count: { select: { rooms: true, admissions: true } }
      },
      orderBy: { name: 'asc' }
    })
    return sendSuccess(res, wards, 'Wards retrieved')
  } catch (error) {
    return sendError(res, 'Failed to retrieve wards', 500)
  }
}

const createWard = async (req, res) => {
  try {
    const { name, code, departmentId, floor, capacity } = req.body

    if (!name || !code || !departmentId) {
      return sendError(res, 'Name, code and department are required', 400)
    }

    const ward = await prisma.ward.create({
      data: {
        name,
        code: code.toUpperCase(),
        departmentId,
        floor,
        capacity: Number(capacity) || 0
      }
    })

    return sendSuccess(res, ward, 'Ward created', 201)
  } catch (error) {
    if (error.code === 'P2002') {
      return sendError(res, 'Ward code already exists', 400)
    }
    return sendError(res, 'Failed to create ward', 500)
  }
}

// ─── BEDS ─────────────────────────────────────────

const getBeds = async (req, res) => {
  try {
    const { wardId, status } = req.query
    const where = {}
    if (wardId) where.room = { wardId }
    if (status) where.status = status

    const beds = await prisma.bed.findMany({
      where,
      include: {
        room: {
          include: {
            ward: {
              select: { name: true, code: true }
            }
          }
        }
      },
      orderBy: { bedNumber: 'asc' }
    })
    return sendSuccess(res, beds, 'Beds retrieved')
  } catch (error) {
    return sendError(res, 'Failed to retrieve beds', 500)
  }
}

const createBed = async (req, res) => {
  try {
    const { bedNumber, roomId, bedType, dailyRate } = req.body

    if (!bedNumber || !roomId) {
      return sendError(res, 'Bed number and room are required', 400)
    }

    const bed = await prisma.bed.create({
      data: {
        bedNumber,
        roomId,
        bedType,
        dailyRate: Number(dailyRate) || 0,
        status: 'AVAILABLE'
      }
    })

    return sendSuccess(res, bed, 'Bed created', 201)
  } catch (error) {
    if (error.code === 'P2002') {
      return sendError(res, 'Bed number already exists', 400)
    }
    return sendError(res, 'Failed to create bed', 500)
  }
}

// ─── SYSTEM SETTINGS ──────────────────────────────

const getSettings = async (req, res) => {
  try {
    const settings = await prisma.systemSetting.findMany({
      orderBy: { group: 'asc' }
    })

    const grouped = settings.reduce((acc, setting) => {
      const group = setting.group || 'general'
      if (!acc[group]) acc[group] = {}
      acc[group][setting.key] = setting.value
      return acc
    }, {})

    return sendSuccess(res, grouped, 'Settings retrieved')
  } catch (error) {
    return sendError(res, 'Failed to retrieve settings', 500)
  }
}

const updateSetting = async (req, res) => {
  try {
    const { key, value } = req.body

    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    })

    return sendSuccess(res, setting, 'Setting updated')
  } catch (error) {
    return sendError(res, 'Failed to update setting', 500)
  }
}

// ─── AUDIT LOGS ───────────────────────────────────

const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query
    const skip = (page - 1) * limit

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        skip: Number(skip),
        take: Number(limit),
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              role: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.auditLog.count()
    ])

    return sendPaginated(res, logs, {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit)
    }, 'Audit logs retrieved')
  } catch (error) {
    return sendError(res, 'Failed to retrieve audit logs', 500)
  }
}

// ─── STATS ────────────────────────────────────────

const getDashboardStats = async (req, res) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [
      totalPatients,
      todayVisits,
      admitted,
      pendingLabs,
      pendingPrescriptions,
      totalUsers,
      totalDepartments
    ] = await Promise.all([
      prisma.patient.count({ where: { isActive: true } }),
      prisma.visit.count({
        where: { visitDate: { gte: today } }
      }),
      prisma.admission.count({
        where: { status: 'ACTIVE' }
      }),
      prisma.labOrder.count({
        where: { status: { in: ['PENDING', 'IN_PROGRESS'] } }
      }),
      prisma.prescription.count({
        where: { status: 'PENDING' }
      }),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.department.count({ where: { isActive: true } })
    ])

    return sendSuccess(res, {
      totalPatients,
      todayVisits,
      admitted,
      pendingLabs,
      pendingPrescriptions,
      emergency: 0,
      totalUsers,
      totalDepartments
    }, 'Stats retrieved')
  } catch (error) {
    console.error('Stats error:', error)
    return sendError(res, 'Failed to retrieve stats', 500)
  }
}

module.exports = {
  getUsers,
  createUser,
  updateUser,
  resetUserPassword,
  getDepartments,
  createDepartment,
  updateDepartment,
  getWards,
  createWard,
  getBeds,
  createBed,
  getSettings,
  updateSetting,
  getAuditLogs,
  getDashboardStats
}