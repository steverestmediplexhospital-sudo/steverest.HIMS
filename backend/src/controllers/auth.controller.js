// backend/src/controllers/auth.controller.js
const bcrypt = require('bcryptjs')
const jwt    = require('jsonwebtoken')

const getPrisma = () => global.prisma

// ── Generate Tokens ───────────────────────────────────────────────────────────
const generateTokens = (user) => {
  const payload = {
    id:         user.id,
    email:      user.email,
    role:       user.role,
    firstName:  user.firstName,
    lastName:   user.lastName,
    employeeId: user.employeeId,
    departmentId: user.departmentId || null
  }

  const accessToken = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  )

  const refreshToken = jwt.sign(
    { id: user.id, email: user.email, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  )

  return { accessToken, refreshToken }
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const prisma = getPrisma()
    if (!prisma) {
      return res.status(503).json({ success: false, message: 'Database unavailable' })
    }

    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      })
    }

    // Find user with department
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        department: {
          select: { id: true, name: true, code: true }
        }
      }
    })

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      })
    }

    // Check account status
    if (user.status === 'INACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive. Contact administrator.'
      })
    }
    if (user.status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        message: 'Account suspended. Contact administrator.'
      })
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      })
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user)

    // Store refresh token in DB
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await prisma.refreshToken.create({
      data: {
        token:     refreshToken,
        userId:    user.id,
        expiresAt
      }
    })

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data:  { lastLogin: new Date() }
    })

    // Remove sensitive data
    const { passwordHash, ...userSafe } = user

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user:         userSafe,
        accessToken,
        refreshToken,
        expiresIn:    process.env.JWT_EXPIRES_IN || '8h'
      }
    })

  } catch (error) {
    console.error('Login error:', error.message)
    return res.status(500).json({
      success: false,
      message: 'Login failed: ' + error.message
    })
  }
}

// ── REGISTER ──────────────────────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const prisma = getPrisma()
    if (!prisma) {
      return res.status(503).json({ success: false, message: 'Database unavailable' })
    }

    const {
      firstName, lastName, email, password,
      phone, role, departmentId, employeeId
    } = req.body

    if (!firstName || !lastName || !email || !password || !role || !phone) {
      return res.status(400).json({
        success: false,
        message: 'firstName, lastName, email, password, phone, and role are required'
      })
    }

    // Validate role
    const validRoles = [
      'SUPER_ADMIN','HOSPITAL_ADMIN','MEDICAL_DIRECTOR','CLINICAL_COORDINATOR',
      'RECEPTIONIST','MEDICAL_RECORDS_OFFICER','NURSE','DOCTOR','MIDWIFE',
      'LAB_SCIENTIST','LAB_TECHNICIAN','RADIOGRAPHER','PHARMACIST',
      'INVENTORY_OFFICER','FACILITY_OFFICER','CASHIER','ACCOUNTANT',
      'THEATRE_NURSE','SURGEON','MORTUARY_OFFICER'
    ]
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Valid roles: ${validRoles.join(', ')}`
      })
    }

    // Check existing email
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    })
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      })
    }

    // Hash password
    const rounds       = parseInt(process.env.BCRYPT_ROUNDS) || 10
    const passwordHash = await bcrypt.hash(password, rounds)

    // Generate employee ID
    const empId = employeeId || `EMP-${Date.now()}`

    // Check if employeeId already used
    if (employeeId) {
      const existingEmp = await prisma.user.findUnique({
        where: { employeeId }
      })
      if (existingEmp) {
        return res.status(409).json({
          success: false,
          message: 'Employee ID already in use'
        })
      }
    }

    const user = await prisma.user.create({
      data: {
        firstName:    firstName.trim(),
        lastName:     lastName.trim(),
        email:        email.toLowerCase().trim(),
        passwordHash,
        phone:        phone.trim(),
        role,
        employeeId:   empId,
        departmentId: departmentId || null,
        status:       'ACTIVE'
      },
      include: {
        department: { select: { id: true, name: true, code: true } }
      }
    })

    const { accessToken, refreshToken } = generateTokens(user)
    const { passwordHash: _ph, ...userSafe } = user

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data:    { user: userSafe, accessToken, refreshToken }
    })

  } catch (error) {
    console.error('Register error:', error.message)
    return res.status(500).json({
      success: false,
      message: 'Registration failed: ' + error.message
    })
  }
}

// ── REFRESH TOKEN ─────────────────────────────────────────────────────────────
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body
    if (!token) {
      return res.status(400).json({ success: false, message: 'Refresh token required' })
    }

    // Verify token signature
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET)

    const prisma = getPrisma()

    // Check token exists in DB
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token }
    })

    if (!storedToken || storedToken.expiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expired or invalid'
      })
    }

    // Get fresh user data
    const user = await prisma.user.findUnique({
      where:   { id: decoded.id },
      include: { department: { select: { id: true, name: true, code: true } } }
    })

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ success: false, message: 'User not found or inactive' })
    }

    // Generate new tokens
    const tokens = generateTokens(user)

    // Delete old refresh token, create new one
    await prisma.refreshToken.delete({ where: { token } })
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)
    await prisma.refreshToken.create({
      data: { token: tokens.refreshToken, userId: user.id, expiresAt }
    })

    const { passwordHash, ...userSafe } = user
    return res.json({
      success: true,
      data: { ...tokens, user: userSafe }
    })

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token'
    })
  }
}

// ── GET PROFILE ───────────────────────────────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const prisma = getPrisma()
    const user   = await prisma.user.findUnique({
      where:   { id: req.user.id },
      include: { department: { select: { id: true, name: true, code: true } } }
    })

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    const { passwordHash, ...userSafe } = user
    return res.json({ success: true, data: { user: userSafe } })

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ── CHANGE PASSWORD ───────────────────────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'currentPassword and newPassword are required'
      })
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters'
      })
    }

    const user  = await prisma.user.findUnique({ where: { id: req.user.id } })
    const valid = await bcrypt.compare(currentPassword, user.passwordHash)

    if (!valid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      })
    }

    const rounds       = parseInt(process.env.BCRYPT_ROUNDS) || 10
    const passwordHash = await bcrypt.hash(newPassword, rounds)

    await prisma.user.update({
      where: { id: req.user.id },
      data:  { passwordHash }
    })

    // Invalidate all refresh tokens
    await prisma.refreshToken.deleteMany({ where: { userId: req.user.id } })

    return res.json({ success: true, message: 'Password changed successfully' })

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ── LOGOUT ────────────────────────────────────────────────────────────────────
const logout = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { refreshToken: token } = req.body

    if (token && prisma) {
      await prisma.refreshToken.deleteMany({ where: { token } }).catch(() => {})
    }
  } catch (_) {}

  return res.json({ success: true, message: 'Logged out successfully' })
}

// ── GET ALL USERS (admin) ─────────────────────────────────────────────────────
const getAllUsers = async (req, res) => {
  try {
    const prisma = getPrisma()
    const users  = await prisma.user.findMany({
      select: {
        id: true, employeeId: true, firstName: true, lastName: true,
        email: true, phone: true, role: true, status: true,
        lastLogin: true, createdAt: true,
        department: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'asc' }
    })
    return res.json({ success: true, data: { users, total: users.length } })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

module.exports = {
  login,
  register,
  refreshToken,
  getProfile,
  changePassword,
  logout,
  getAllUsers
}