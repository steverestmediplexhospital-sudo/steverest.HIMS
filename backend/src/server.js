// backend/src/server.js
// backend/src/server.js
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { createServer } = require('http')
const { Server } = require('socket.io')
require('dotenv').config()

const app = express()
const httpServer = createServer(app)

// ─── CORS (MUST BE FIRST) ────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.CORS_ORIGIN,
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'https://steverest-hims-dbye-m8y2geg5k-steverest.vercel.app',
  'https://steverest-hims.vercel.app',
].filter(Boolean)

app.use(cors({
  origin: function(origin, callback) {
    callback(null, true) // allow all origins for now
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

app.options('*', cors()) // handle preflight

app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ─── Socket.IO ───────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true
  }
})

io.on('connection', (socket) => {
  console.log('🔌 Client connected: ' + socket.id)
  socket.on('join:room',  (room)   => { socket.join(room) })
  socket.on('join:role',  (role)   => { socket.join('role:' + role) })
  socket.on('join:user',  (userId) => { socket.join('user:' + userId) })
  socket.on('disconnect', ()       => { console.log('❌ Disconnected: ' + socket.id) })
})
app.set('io', io)

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status:    'HIMS Server Running',
    hospital:  'St. Everest Mediplex',
    timestamp: new Date().toISOString(),
    database:  global.prisma ? 'connected' : 'disconnected'
  })
})

// ─── Prisma ───────────────────────────────────────────────────────────────────
// ─── Prisma ───────────────────────────────────────────────────────────────────
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient({
  log: ['error', 'warn'],
  datasources: {
    db: { url: process.env.DATABASE_URL }
  }
})
global.prisma = prisma
console.log('✅ Prisma initialized')
// ─── Auth Middleware ──────────────────────────────────────────────────────────
const authMiddleware = (() => {
  try { return require('./middleware/auth.middleware') }
  catch (e) {
    console.warn('⚠️  Auth middleware missing, using passthrough')
    return (req, res, next) => next()
  }
})()

// ─── Route Loader ─────────────────────────────────────────────────────────────
const routeLoader = (path, routeFile) => {
  try {
    const router = require(routeFile)
    app.use(path, router)
    console.log(`  ✅ ${path}`)
  } catch (err) {
    console.warn(`  ⚠️  SKIP: ${path} => ${err.message}`)
  }
}

console.log('\n📋 Loading routes...')
routeLoader('/api/auth',          './routes/auth.routes')
routeLoader('/api/admin',         './routes/admin.routes')
routeLoader('/api/patients',      './routes/patient.routes')
routeLoader('/api/visits',        './routes/visit.routes')
routeLoader('/api/nursing',       './routes/nursing.routes')
routeLoader('/api/consultations', './routes/consultation.routes')
routeLoader('/api/lab',           './routes/lab.routes')
routeLoader('/api/pharmacy',      './routes/pharmacy.routes')
routeLoader('/api/admissions',    './routes/admission.routes')
routeLoader('/api/emergency',     './routes/emergency.routes')
routeLoader('/api/billing',       './routes/billing.routes')
routeLoader('/api/maternity',     './routes/maternity.routes')
routeLoader('/api/mortuary',      './routes/mortuary.routes')
routeLoader('/api/inventory',     './routes/inventory.routes')
routeLoader('/api/surgery',       './routes/surgery.routes')
routeLoader('/api/radiology',     './routes/radiology.routes')
routeLoader('/api/appointments',  './routes/appointment.routes')
routeLoader('/api/reports',       './routes/reports.routes')
routeLoader('/api/facility',      './routes/facility.routes')
routeLoader('/api/coordinator',   './routes/coordinator.routes')

// ─── Notifications ────────────────────────────────────────────────────────────
if (prisma) {
  app.get('/api/notifications', authMiddleware, async (req, res) => {
    try {
      const page  = parseInt(req.query.page)  || 1
      const limit = parseInt(req.query.limit) || 20
      const skip  = (page - 1) * limit
      const [notifications, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where:   { userId: req.user?.id },
          orderBy: { createdAt: 'desc' },
          skip, take: limit
        }),
        prisma.notification.count({
          where: { userId: req.user?.id, isRead: false }
        })
      ])
      res.json({ success: true, data: { notifications, unreadCount, page, limit } })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  })

  app.patch('/api/notifications/:id/read', authMiddleware, async (req, res) => {
    try {
      await prisma.notification.update({
        where: { id: req.params.id },
        data:  { isRead: true }
      })
      res.json({ success: true })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  })

  app.patch('/api/notifications/read-all', authMiddleware, async (req, res) => {
    try {
      await prisma.notification.updateMany({
        where: { userId: req.user?.id, isRead: false },
        data:  { isRead: true }
      })
      res.json({ success: true })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  })
}

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    availableAt: 'GET /api/health'
  })
})

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('💥 Error:', err.message)
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  })
})

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000

const startServer = async () => {
  if (prisma) {
    try {
      await prisma.$connect()
      console.log('✅ Supabase PostgreSQL connected successfully')
    } catch (err) {
      console.error('❌ DB Connection failed:', err.message)
      console.log('⚠️  Server will start but DB features unavailable')
    }
  }
  httpServer.listen(PORT, () => {
    console.log('\n==============================================')
    console.log('  🏥 St. Everest Mediplex HIMS Backend')
    console.log(`  🚀 Running: http://localhost:${PORT}`)
    console.log(`  ❤️  Health:  http://localhost:${PORT}/api/health`)
    console.log(`  🌍 Env: ${process.env.NODE_ENV || 'development'}`)
    console.log('==============================================\n')
  })
}

startServer()

module.exports = { app, io, prisma }