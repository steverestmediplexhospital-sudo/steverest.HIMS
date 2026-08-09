// backend/src/services/notification.service.js
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const createNotification = async ({
  userId, patientId, title,
  message, type, link, priority = 'NORMAL'
}) => {
  try {
    return await prisma.notification.create({
      data: { userId, patientId, title, message, type, link }
    })
  } catch (error) {
    console.error('Notification creation failed:', error)
  }
}

const notifyRole = async (io, role, event, data) => {
  io.to(`role:${role}`).emit(event, data)
}

const notifyUser = async (io, userId, event, data) => {
  io.to(`user:${userId}`).emit(event, data)
}

const markAsRead = async (notificationId, userId) => {
  return prisma.notification.update({
    where: { id: notificationId, userId },
    data: { isRead: true }
  })
}

const getUserNotifications = async (userId, page = 1, limit = 20) => {
  const skip = (page - 1) * limit
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.notification.count({
      where: { userId, isRead: false }
    })
  ])
  return { notifications, unreadCount }
}

module.exports = {
  createNotification,
  notifyRole,
  notifyUser,
  markAsRead,
  getUserNotifications
}