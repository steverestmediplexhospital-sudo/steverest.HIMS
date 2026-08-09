// frontend/src/components/layout/NotificationBell.jsx
import { useState, useRef, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Bell, X, CheckCheck, Trash2, AlertTriangle, Info, AlertCircle, Zap } from "lucide-react"
import useNotificationStore from "../../store/notificationStore"

// ─── Type → style map ────────────────────────────────────────────────────
const TYPE_STYLES = {
  CRITICAL: {
    icon:    Zap,
    iconBg:  "bg-red-100",
    iconClr: "text-red-600",
    border:  "border-l-red-500",
    dot:     "bg-red-500",
    label:   "Critical",
    labelBg: "bg-red-100 text-red-700",
  },
  ALERT: {
    icon:    AlertTriangle,
    iconBg:  "bg-orange-100",
    iconClr: "text-orange-600",
    border:  "border-l-orange-500",
    dot:     "bg-orange-500",
    label:   "Alert",
    labelBg: "bg-orange-100 text-orange-700",
  },
  WARNING: {
    icon:    AlertCircle,
    iconBg:  "bg-yellow-100",
    iconClr: "text-yellow-600",
    border:  "border-l-yellow-500",
    dot:     "bg-yellow-400",
    label:   "Warning",
    labelBg: "bg-yellow-100 text-yellow-700",
  },
  INFO: {
    icon:    Info,
    iconBg:  "bg-blue-100",
    iconClr: "text-blue-600",
    border:  "border-l-blue-400",
    dot:     "bg-blue-500",
    label:   "Info",
    labelBg: "bg-blue-100 text-blue-700",
  },
}

// ─── Format relative time ─────────────────────────────────────────────────
const formatRelative = (isoString) => {
  const diff = Date.now() - new Date(isoString).getTime()
  const secs  = Math.floor(diff / 1000)
  if (secs < 60)   return "Just now"
  const mins = Math.floor(secs / 60)
  if (mins < 60)   return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)    return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ────────────────────────────────────────────────────────────────────────────
// NOTIFICATION BELL
// ────────────────────────────────────────────────────────────────────────────
export default function NotificationBell() {
  const navigate                             = useNavigate()
  const [open, setOpen]                      = useState(false)
  const [filter, setFilter]                  = useState("all") // "all" | "unread"
  const dropdownRef                          = useRef(null)

  const { notifications, unreadCount, markOneRead, markAllRead, clearAll } =
    useNotificationStore()

  // ── Close on outside click ──────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // ── Close on Escape ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  // ── Click on a notification ────────────────────────────────────────────
  const handleClick = useCallback((notification) => {
    markOneRead(notification.id)
    setOpen(false)
    if (notification.link) navigate(notification.link)
  }, [markOneRead, navigate])

  // ── Filtered list ──────────────────────────────────────────────────────
  const displayed = filter === "unread"
    ? notifications.filter(n => !n.read)
    : notifications

  // ── Bell pulse — only when there are critical/unread ──────────────────
  const hasCritical = notifications.some(n => !n.read && n.type === "CRITICAL")

  return (
    <div className="relative" ref={dropdownRef}>

      {/* ── Bell Button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`relative p-2 rounded-xl transition-all ${
          open ? "bg-gray-100" : "hover:bg-gray-100"
        }`}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className={`w-5 h-5 transition-colors ${
          hasCritical ? "text-red-500" : "text-gray-500"
        } ${hasCritical ? "animate-bounce" : ""}`} />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 
            rounded-full text-[10px] font-bold text-white flex items-center justify-center
            ${hasCritical ? "bg-red-500 animate-pulse" : "bg-red-500"}`}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div className={`
          absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)]
          bg-white rounded-2xl shadow-2xl border border-gray-100
          z-[9999] flex flex-col overflow-hidden
          animate-in slide-in-from-top-2 duration-150
        `}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-gray-600" />
              <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  title="Mark all as read"
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-all"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  title="Clear all notifications"
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          {notifications.length > 0 && (
            <div className="flex gap-1 px-4 py-2 border-b border-gray-50">
              {["all", "unread"].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all capitalize ${
                    filter === f
                      ? "bg-gray-900 text-white"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  {f === "all" ? `All (${notifications.length})` : `Unread (${unreadCount})`}
                </button>
              ))}
            </div>
          )}

          {/* Notification list */}
          <div className="overflow-y-auto max-h-[420px]">
            {displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Bell className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">
                  {filter === "unread" ? "No unread notifications" : "No notifications yet"}
                </p>
                <p className="text-xs mt-1 opacity-70">
                  Real-time alerts will appear here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {displayed.map((n) => {
                  const style = TYPE_STYLES[n.type] || TYPE_STYLES.INFO
                  const Icon  = style.icon

                  return (
                    <button
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={`w-full text-left px-4 py-3.5 border-l-4 transition-all
                        hover:bg-gray-50 flex items-start gap-3 group
                        ${style.border}
                        ${n.read ? "opacity-60" : "bg-white"}
                      `}
                    >
                      {/* Icon */}
                      <div className={`w-8 h-8 rounded-xl ${style.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                        <Icon className={`w-4 h-4 ${style.iconClr}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs font-bold leading-tight ${n.read ? "text-gray-600" : "text-gray-900"}`}>
                            {n.title}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Unread dot */}
                            {!n.read && (
                              <span className={`w-2 h-2 rounded-full ${style.dot} shrink-0`} />
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">
                          {n.message}
                        </p>

                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${style.labelBg}`}>
                            {style.label}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {formatRelative(n.timestamp)}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
              <p className="text-[10px] text-gray-400 text-center">
                Showing {displayed.length} of {notifications.length} notifications
                {" · "}Real-time via Socket.IO
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}