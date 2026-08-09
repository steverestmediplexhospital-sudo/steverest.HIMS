// frontend/src/store/notificationStore.js
import { create } from "zustand"
import { persist } from "zustand/middleware"

// ─── Notification shape ───────────────────────────────────────────────────
// {
//   id:        string  (uuid or timestamp-based)
//   type:      "CRITICAL" | "ALERT" | "INFO" | "WARNING"
//   event:     string  (e.g. "emergency:immediate")
//   title:     string  (short heading)
//   message:   string  (full message)
//   timestamp: ISO string
//   read:      boolean
//   link:      string  (optional — navigate to this path on click)
// }

// ─── Event → notification mapper ─────────────────────────────────────────
export const mapEventToNotification = (event, payload) => {
  const ts = new Date().toISOString()
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  const map = {
    "emergency:immediate": {
      type: "CRITICAL",
      title: "🚨 IMMEDIATE Emergency",
      message: payload?.message || `Critical emergency case — immediate attention required`,
      link: "/emergency",
    },
    "emergency:new_case": {
      type: "ALERT",
      title: "🚑 New Emergency Case",
      message: payload?.message || `New emergency patient has arrived`,
      link: "/emergency",
    },
    "vitals:critical": {
      type: "CRITICAL",
      title: "❤️ Critical Vitals",
      message: payload?.message || `Patient vitals are in critical range`,
      link: "/nursing",
    },
    "vitals:alert": {
      type: "WARNING",
      title: "⚠️ Vitals Alert",
      message: payload?.message || `Patient vitals require attention`,
      link: "/nursing",
    },
    "triage:completed": {
      type: "INFO",
      title: "✅ Triage Completed",
      message: payload?.message || `Patient triage has been completed`,
      link: "/doctor",
    },
    "mortuary:new_admission": {
      type: "INFO",
      title: "🏥 Mortuary Admission",
      message: payload?.message || `New body admitted to mortuary`,
      link: "/mortuary",
    },
    "admission:new": {
      type: "INFO",
      title: "🛏️ New Admission",
      message: payload?.message || `New patient admitted to ward`,
      link: "/ipd",
    },
    "visit:created": {
      type: "INFO",
      title: "👤 New Visit",
      message: payload?.message || `New patient visit created — triage pending`,
      link: "/nursing",
    },
  }

  const base = map[event] || {
    type: "INFO",
    title: "Notification",
    message: payload?.message || event,
    link: "/dashboard",
  }

  return { id, event, timestamp: ts, read: false, ...base }
}

// ─── Which roles receive which events ─────────────────────────────────────
export const ROLE_EVENT_MAP = {
  DOCTOR:               ["emergency:new_case","emergency:immediate","vitals:critical","triage:completed"],
  SURGEON:              ["emergency:new_case","emergency:immediate","vitals:critical","triage:completed"],
  MEDICAL_DIRECTOR:     ["emergency:immediate","vitals:critical","emergency:new_case","triage:completed","admission:new","visit:created"],
  NURSE:                ["emergency:new_case","emergency:immediate","vitals:alert","admission:new","visit:created"],
  MIDWIFE:              ["emergency:new_case","vitals:alert","admission:new","visit:created"],
  THEATRE_NURSE:        ["emergency:immediate","admission:new"],
  MORTUARY_OFFICER:     ["mortuary:new_admission","emergency:immediate"],
  CLINICAL_COORDINATOR: ["emergency:immediate","emergency:new_case","vitals:critical","vitals:alert","triage:completed","admission:new","visit:created","mortuary:new_admission"],
  SUPER_ADMIN:          ["emergency:immediate","emergency:new_case","vitals:critical","vitals:alert","triage:completed","admission:new","visit:created","mortuary:new_admission"],
  HOSPITAL_ADMIN:       ["emergency:immediate","emergency:new_case","vitals:critical","admission:new"],
  // These roles get no real-time alerts (they use their own page data)
  LAB_SCIENTIST:        [],
  LAB_TECHNICIAN:       [],
  PHARMACIST:           [],
  RADIOGRAPHER:         [],
  RECEPTIONIST:         [],
  MEDICAL_RECORDS_OFFICER: [],
  CASHIER:              [],
  ACCOUNTANT:           [],
  INVENTORY_OFFICER:    [],
  FACILITY_OFFICER:     [],
}

// ─── Max notifications to keep in store ───────────────────────────────────
const MAX_NOTIFICATIONS = 50

// ─── Store ────────────────────────────────────────────────────────────────
const useNotificationStore = create(
  persist(
    (set, get) => ({
      notifications: [],      // array of notification objects
      unreadCount:   0,       // derived but stored for badge performance

      // ── Add a new notification ──────────────────────────────────────────
      addNotification: (notification) => {
        set((state) => {
          const updated = [notification, ...state.notifications].slice(0, MAX_NOTIFICATIONS)
          const unread  = updated.filter(n => !n.read).length
          return { notifications: updated, unreadCount: unread }
        })
      },

      // ── Mark one as read ───────────────────────────────────────────────
      markOneRead: (id) => {
        set((state) => {
          const updated = state.notifications.map(n =>
            n.id === id ? { ...n, read: true } : n
          )
          const unread = updated.filter(n => !n.read).length
          return { notifications: updated, unreadCount: unread }
        })
      },

      // ── Mark all as read ───────────────────────────────────────────────
      markAllRead: () => {
        set((state) => ({
          notifications: state.notifications.map(n => ({ ...n, read: true })),
          unreadCount: 0,
        }))
      },

      // ── Clear all ──────────────────────────────────────────────────────
      clearAll: () => set({ notifications: [], unreadCount: 0 }),

      // ── Recalculate unread (call if store gets out of sync) ────────────
      recalculate: () => {
        set((state) => ({
          unreadCount: state.notifications.filter(n => !n.read).length,
        }))
      },
    }),
    {
      name:    "st-everest-notifications",   // localStorage key
      version: 1,
      // Only persist notifications array — unreadCount is always derived
      partialize: (state) => ({
        notifications: state.notifications,
        unreadCount:   state.unreadCount,
      }),
    }
  )
)

export default useNotificationStore