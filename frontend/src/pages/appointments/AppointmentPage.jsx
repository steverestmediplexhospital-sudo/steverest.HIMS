// src/pages/appointments/AppointmentPage.jsx
import { useState, useEffect, useCallback, useRef } from "react"
import {
  Calendar, Clock, Plus, Search, RefreshCw, X,
  ChevronRight, Loader2, User, Phone, Stethoscope,
  CheckCircle, AlertTriangle, XCircle, Eye,
  ArrowRight, Filter, Bell, Edit3, Trash2,
  CalendarDays, UserCheck, Info, Hash,
  ChevronLeft, ChevronDown, MoreVertical,
  Activity, MapPin, FileText, Check, Ban,
  Timer, Users, TrendingUp, BookOpen
} from "lucide-react"
import api from "../../services/api"
import toast from "react-hot-toast"
import useAuthStore from "../../store/authStore"

// ─── Constants ────────────────────────────────────────────────────────────

const APPT_STATUSES = {
  SCHEDULED:   { label: "Scheduled",   color: "bg-blue-100 text-blue-700",     dot: "bg-blue-500",     icon: Calendar    },
  CONFIRMED:   { label: "Confirmed",   color: "bg-emerald-100 text-emerald-700",dot: "bg-emerald-500",  icon: CheckCircle },
  IN_PROGRESS: { label: "In Progress", color: "bg-purple-100 text-purple-700",  dot: "bg-purple-500",   icon: Activity    },
  COMPLETED:   { label: "Completed",   color: "bg-gray-100 text-gray-600",      dot: "bg-gray-400",     icon: Check       },
  CANCELLED:   { label: "Cancelled",   color: "bg-red-100 text-red-700",        dot: "bg-red-500",      icon: XCircle     },
  NO_SHOW:     { label: "No Show",     color: "bg-orange-100 text-orange-700",  dot: "bg-orange-500",   icon: Ban         },
  RESCHEDULED: { label: "Rescheduled", color: "bg-amber-100 text-amber-700",    dot: "bg-amber-500",    icon: Timer       },
}

const APPT_TYPES = ["OPD","FOLLOW_UP","SPECIALIST","PROCEDURE","ANC","REVIEW"]

const VIEW_MODES = [
  { key: "today",    label: "Today"     },
  { key: "week",     label: "This Week" },
  { key: "calendar", label: "Calendar"  },
  { key: "all",      label: "All"       },
]

// ─── Utilities ────────────────────────────────────────────────────────────

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString("en-KE", {
      day: "2-digit", month: "short", year: "numeric"
    })
  : "—"

const fmtTime = (t) => t || "—"

const calcAge = (dob) => {
  if (!dob) return "—"
  return `${new Date().getFullYear() - new Date(dob).getFullYear()}y`
}

const isToday = (d) => {
  const t = new Date()
  const dt = new Date(d)
  return dt.getFullYear() === t.getFullYear()
    && dt.getMonth()      === t.getMonth()
    && dt.getDate()       === t.getDate()
}

const isPast = (d) => new Date(d) < new Date(new Date().setHours(0,0,0,0))

// ─── Shared small components ──────────────────────────────────────────────

const SectionLoader = () => (
  <div className="flex items-center justify-center py-24">
    <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
    <span className="ml-2 text-gray-400 text-sm">Loading appointments…</span>
  </div>
)

const EmptyState = ({ onBook, canBook }) => (
  <div className="flex flex-col items-center justify-center py-24 text-center">
    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
      <CalendarDays className="w-8 h-8 text-blue-300" />
    </div>
    <p className="font-semibold text-gray-700 mb-1">No appointments found</p>
    <p className="text-sm text-gray-400 mb-5">
      Book an appointment to get started
    </p>
    {canBook && (
      <button
        onClick={onBook}
        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white 
                   rounded-xl text-sm font-semibold hover:bg-blue-700">
        <Plus className="w-4 h-4" /> Book Appointment
      </button>
    )}
  </div>
)

// ─── Status Badge ─────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const cfg = APPT_STATUSES[status] || APPT_STATUSES.SCHEDULED
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full 
                      text-xs font-semibold ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL — BOOK APPOINTMENT
// ════════════════════════════════════════════════════════════════════════════

const BookModal = ({ isOpen, onClose, onSuccess, prefillPatient = null }) => {
  const [step, setStep]         = useState(1)
  const [patientSearch, setPS]  = useState("")
  const [patients,   setPatients]   = useState([])
  const [searching,  setSearching]  = useState(false)
  const [selectedPt, setSelectedPt] = useState(prefillPatient)
  const [doctors,    setDoctors]    = useState([])
  const [saving,     setSaving]     = useState(false)

  const [form, setForm] = useState({
    doctorId:        "",
    appointmentDate: new Date().toISOString().slice(0, 10),
    appointmentTime: "",
    type:            "OPD",
    reason:          "",
    notes:           "",
  })

  const searchRef = useRef(null)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Reset on open/close
  useEffect(() => {
    if (!isOpen) {
      setStep(1); setPS(""); setPatients([])
      setSelectedPt(prefillPatient)
      setForm({
        doctorId:"", appointmentDate: new Date().toISOString().slice(0,10),
        appointmentTime:"", type:"OPD", reason:"", notes:""
      })
      return
    }
    if (prefillPatient) setStep(2)

    const loadDoctors = async () => {
      try {
        const res = await api.get("/admin/users?role=DOCTOR&limit=50")
        setDoctors(res.data.data?.users || res.data.users || [])
      } catch { setDoctors([]) }
    }
    loadDoctors()
  }, [isOpen, prefillPatient])

  // Patient search debounce
  useEffect(() => {
    if (!patientSearch.trim() || patientSearch.length < 2) {
      setPatients([]); return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await api.get(
          `/patients?search=${encodeURIComponent(patientSearch)}&limit=10`
        )
        setPatients(res.data.data?.patients || res.data.patients || [])
      } catch { setPatients([]) }
      finally { setSearching(false) }
    }, 400)
    return () => clearTimeout(t)
  }, [patientSearch])

  const handleBook = async () => {
    if (!selectedPt)         return toast.error("Select a patient")
    if (!form.reason.trim()) return toast.error("Reason / complaint is required")
    if (!form.appointmentDate) return toast.error("Select appointment date")

    setSaving(true)
    try {
      await api.post("/appointments", {
        patientId:       selectedPt.id,
        doctorId:        form.doctorId || null,
        appointmentDate: form.appointmentDate,
        appointmentTime: form.appointmentTime || null,
        reason:          form.reason,
        notes:           form.notes || null,
        type:            form.type,
      })
      toast.success(`Appointment booked for ${selectedPt.fullName}`)
      onSuccess()
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to book appointment")
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center 
                    p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg 
                      max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <CalendarDays className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Book Appointment</h2>
              <p className="text-xs text-gray-400">
                Step {step} of 2 — {step === 1 ? "Find Patient" : "Appointment Details"}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex px-6 pt-4 gap-2">
          {[1,2].map(s => (
            <div key={s}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                s <= step ? "bg-blue-600" : "bg-gray-100"
              }`}
            />
          ))}
        </div>

        <div className="p-6">

          {/* ── STEP 1: Patient search ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Search Patient
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 
                                    w-4 h-4 text-gray-400" />
                  <input
                    ref={searchRef}
                    autoFocus
                    value={patientSearch}
                    onChange={e => setPS(e.target.value)}
                    placeholder="Name, patient ID, or phone…"
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 
                               rounded-xl text-sm focus:outline-none 
                               focus:ring-2 focus:ring-blue-500"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 
                                       w-4 h-4 text-blue-500 animate-spin" />
                  )}
                </div>
              </div>

              {patients.length > 0 && (
                <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                  {patients.map((p, i) => (
                    <button key={p.id}
                      onClick={() => { setSelectedPt(p); setStep(2) }}
                      className={`w-full flex items-center gap-3 px-4 py-3 
                                  hover:bg-blue-50 text-left transition-colors ${
                        i < patients.length - 1 ? "border-b border-gray-50" : ""
                      }`}>
                      <div className="w-9 h-9 rounded-full bg-blue-100 
                                      flex items-center justify-center shrink-0">
                        <span className="text-blue-700 font-bold text-sm">
                          {p.fullName?.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">
                          {p.fullName}
                        </p>
                        <p className="text-xs text-gray-400">
                          {p.patientId} · {calcAge(p.dateOfBirth)} · {p.gender}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">
                        {p.phone || "No phone"}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {patientSearch.length >= 2 && !searching && patients.length === 0 && (
                <div className="text-center py-6 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">
                    No patients found for "{patientSearch}"
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Register patient at Reception first
                  </p>
                </div>
              )}

              {patientSearch.length < 2 && (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">
                    Type at least 2 characters to search
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Appointment details ── */}
          {step === 2 && selectedPt && (
            <div className="space-y-4">

              {/* Selected patient */}
              <div className="flex items-center gap-3 p-3 bg-blue-50 
                              border border-blue-100 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-blue-200 
                                flex items-center justify-center shrink-0">
                  <span className="text-blue-800 font-bold">
                    {selectedPt.fullName?.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-blue-900 text-sm">
                    {selectedPt.fullName}
                  </p>
                  <p className="text-xs text-blue-600">
                    {selectedPt.patientId} · {calcAge(selectedPt.dateOfBirth)}
                    · {selectedPt.gender}
                  </p>
                </div>
                {!prefillPatient && (
                  <button onClick={() => setStep(1)}
                    className="text-xs text-blue-600 hover:underline shrink-0">
                    Change
                  </button>
                )}
              </div>

              {/* Appointment type */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">
                  Appointment Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {APPT_TYPES.map(t => (
                    <button key={t}
                      onClick={() => set("type", t)}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold 
                                  border transition-all ${
                        form.type === t
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}>
                      {t.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date + Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={form.appointmentDate}
                    min={new Date().toISOString().slice(0,10)}
                    onChange={e => set("appointmentDate", e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 
                               text-sm focus:outline-none focus:ring-2 
                               focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Time (optional)
                  </label>
                  <input
                    type="time"
                    value={form.appointmentTime}
                    onChange={e => set("appointmentTime", e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 
                               text-sm focus:outline-none focus:ring-2 
                               focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Doctor */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Assign Doctor (optional)
                </label>
                <select
                  value={form.doctorId}
                  onChange={e => set("doctorId", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 
                             text-sm focus:outline-none focus:ring-2 
                             focus:ring-blue-500">
                  <option value="">— Any available doctor —</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>
                      Dr. {d.name}
                      {d.specialization ? ` (${d.specialization})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Reason / Chief Complaint *
                </label>
                <textarea
                  autoFocus
                  value={form.reason}
                  onChange={e => set("reason", e.target.value)}
                  rows={3}
                  placeholder="Reason for appointment…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 
                             text-sm focus:outline-none focus:ring-2 
                             focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Notes
                </label>
                <input
                  value={form.notes}
                  onChange={e => set("notes", e.target.value)}
                  placeholder="Any additional notes…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 
                             text-sm focus:outline-none focus:ring-2 
                             focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between gap-3 px-6 py-4 
                        border-t border-gray-100">
          {step === 1 ? (
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-200 
                         text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          ) : (
            <button onClick={() => !prefillPatient && setStep(1)}
              className={`px-4 py-2 rounded-xl border border-gray-200 
                         text-sm text-gray-600 hover:bg-gray-50 ${
                prefillPatient ? "opacity-40 cursor-default" : ""
              }`}>
              ← Back
            </button>
          )}

          {step === 2 && (
            <button onClick={handleBook} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white 
                         rounded-xl text-sm font-semibold hover:bg-blue-700 
                         disabled:opacity-60">
              {saving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <CalendarDays className="w-4 h-4" />
              }
              Book Appointment
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL — UPDATE STATUS
// ════════════════════════════════════════════════════════════════════════════

const StatusModal = ({ isOpen, onClose, onSuccess, appointment }) => {
  const [status,       setStatus]   = useState("")
  const [notes,        setNotes]    = useState("")
  const [cancelReason, setCancelR]  = useState("")
  const [saving,       setSaving]   = useState(false)

  useEffect(() => {
    if (isOpen && appointment) {
      setStatus(appointment.status || "SCHEDULED")
      setNotes("")
      setCancelR("")
    }
  }, [isOpen, appointment])

  const handleSave = async () => {
    if (!status) return toast.error("Select a status")
    setSaving(true)
    try {
      await api.patch(`/appointments/${appointment.id}/status`, {
        status,
        notes:        notes        || undefined,
        cancelReason: cancelReason || undefined,
      })
      toast.success("Appointment status updated")
      onSuccess()
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to update status")
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen || !appointment) return null

  const isCancelling = status === "CANCELLED"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center 
                    p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Update Status</h2>
          <button onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Patient summary */}
          <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-700">
            <p className="font-semibold">{appointment.patient?.fullName}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {fmtDate(appointment.appointmentDate)} · {fmtTime(appointment.appointmentTime)}
              · {appointment.type}
            </p>
          </div>

          {/* Status selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">
              New Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(APPT_STATUSES).map(([k, cfg]) => {
                const Icon = cfg.icon
                return (
                  <button key={k} onClick={() => setStatus(k)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border 
                                text-xs font-semibold transition-all ${
                      status === k
                        ? `${cfg.color} border-current`
                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}>
                    <Icon className="w-3.5 h-3.5" />
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Cancel reason */}
          {isCancelling && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Cancellation Reason
              </label>
              <input
                autoFocus
                value={cancelReason}
                onChange={e => setCancelR(e.target.value)}
                placeholder="Why is this being cancelled?"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 
                           text-sm focus:outline-none focus:ring-2 
                           focus:ring-red-400"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Any notes about this status change…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 
                         text-sm focus:outline-none focus:ring-2 
                         focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 
                       text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl 
                        text-sm font-semibold text-white disabled:opacity-60 ${
              isCancelling
                ? "bg-red-600 hover:bg-red-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}>
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Check className="w-4 h-4" />
            }
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// APPOINTMENT CARD
// ════════════════════════════════════════════════════════════════════════════

const AppointmentCard = ({
  appt, onView, onUpdateStatus, onCancel, userRole
}) => {
  const cfg     = APPT_STATUSES[appt.status] || APPT_STATUSES.SCHEDULED
  const CfgIcon = cfg.icon
  const today   = isToday(appt.appointmentDate)
  const past    = isPast(appt.appointmentDate) && !today
  const canEdit = [
    "RECEPTIONIST","NURSE","CLINICAL_COORDINATOR",
    "SUPER_ADMIN","HOSPITAL_ADMIN","MEDICAL_RECORDS_OFFICER"
  ].includes(userRole)

  return (
    <div className={`bg-white border rounded-xl overflow-hidden 
                    hover:shadow-md transition-all ${
      today ? "border-blue-200 ring-1 ring-blue-100" :
      past  ? "border-gray-100 opacity-80"           :
              "border-gray-100"
    }`}>
      {today && (
        <div className="bg-blue-600 text-white text-xs font-bold 
                        text-center py-1 tracking-wide">
          TODAY
        </div>
      )}

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-full bg-blue-100 
                            flex items-center justify-center shrink-0">
              <span className="text-blue-700 font-bold text-sm">
                {appt.patient?.fullName?.charAt(0) || "?"}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">
                {appt.patient?.fullName || "Unknown"}
              </p>
              <p className="text-xs text-gray-400">
                {appt.patient?.patientId}
                · {calcAge(appt.patient?.dateOfBirth)}
                · {appt.patient?.gender}
              </p>
            </div>
          </div>
          <StatusBadge status={appt.status} />
        </div>

        {/* Details */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="font-medium">
              {fmtDate(appt.appointmentDate)}
            </span>
            {appt.appointmentTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {fmtTime(appt.appointmentTime)}
              </span>
            )}
          </div>

          {appt.doctor && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Stethoscope className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              Dr. {appt.doctor.name}
              {appt.doctor.specialization
                ? ` · ${appt.doctor.specialization}` : ""}
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Hash className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            {appt.appointmentNo}
            <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">
              {appt.type?.replace("_"," ")}
            </span>
          </div>

          {appt.reason && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg 
                          px-2.5 py-1.5 line-clamp-2 mt-1">
              💬 {appt.reason}
            </p>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 
                      flex items-center justify-between">
        <div className="flex items-center gap-2">
          {appt.patient?.phone && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Phone className="w-3 h-3" />
              {appt.patient.phone}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {canEdit && appt.status !== "COMPLETED" && 
           appt.status !== "CANCELLED" && (
            <button onClick={() => onUpdateStatus(appt)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 
                         text-white rounded-lg text-xs font-semibold 
                         hover:bg-blue-700">
              <Edit3 className="w-3 h-3" /> Status
            </button>
          )}

          <button onClick={() => onView(appt)}
            className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm 
                       text-gray-400 hover:text-gray-700 transition-all">
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// DETAIL DRAWER
// ════════════════════════════════════════════════════════════════════════════

const AppointmentDrawer = ({
  appt, onClose, onUpdateStatus, onBook, userRole
}) => {
  if (!appt) return null

  const cfg  = APPT_STATUSES[appt.status] || APPT_STATUSES.SCHEDULED
  const today = isToday(appt.appointmentDate)
  const canEdit = [
    "RECEPTIONIST","NURSE","CLINICAL_COORDINATOR",
    "SUPER_ADMIN","HOSPITAL_ADMIN","MEDICAL_RECORDS_OFFICER"
  ].includes(userRole)

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-2xl overflow-y-auto flex flex-col">

        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 
                            flex items-center justify-center">
              <span className="text-blue-700 font-bold text-lg">
                {appt.patient?.fullName?.charAt(0)}
              </span>
            </div>
            <div className="flex gap-2">
              {canEdit && appt.status !== "COMPLETED" &&
               appt.status !== "CANCELLED" && (
                <button onClick={() => { onClose(); onUpdateStatus(appt) }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 
                             text-white rounded-xl text-xs font-semibold 
                             hover:bg-blue-700">
                  <Edit3 className="w-3.5 h-3.5" /> Update
                </button>
              )}
              <button onClick={onClose}
                className="p-2 rounded-xl hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          <h2 className="font-bold text-gray-900 text-lg">
            {appt.patient?.fullName}
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {appt.patient?.patientId}
            · {calcAge(appt.patient?.dateOfBirth)}
            · {appt.patient?.gender}
          </p>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <Phone className="w-3 h-3" />
            {appt.patient?.phone || "No phone"}
          </p>

          <div className="flex items-center gap-2 mt-3">
            <StatusBadge status={appt.status} />
            {today && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 
                               text-xs font-bold rounded-full">
                TODAY
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 p-6 space-y-5">

          {/* Appointment details */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase 
                           tracking-wider mb-3">
              Appointment Details
            </h3>
            <div className="space-y-2">
              {[
                ["Appointment No",  appt.appointmentNo],
                ["Type",           appt.type?.replace("_"," ")],
                ["Date",           fmtDate(appt.appointmentDate)],
                ["Time",           fmtTime(appt.appointmentTime)],
                ["Doctor",         appt.doctor
                                   ? `Dr. ${appt.doctor.name}` : "Any available"],
                ["Specialization", appt.doctor?.specialization || "—"],
                ["Reason",         appt.reason || "—"],
                ["Notes",          appt.notes  || "—"],
                ["Booked By",      appt.createdBy?.name || "—"],
              ].map(([label, value]) => (
                <div key={label}
                  className="flex justify-between items-start py-2 
                             border-b border-gray-50">
                  <span className="text-xs text-gray-500 shrink-0">
                    {label}
                  </span>
                  <span className="text-xs font-semibold text-gray-800 
                                   text-right ml-2 max-w-[60%]">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Cancel reason if cancelled */}
          {appt.cancelReason && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
              <p className="text-xs font-semibold text-red-700 mb-1">
                Cancellation Reason
              </p>
              <p className="text-xs text-red-600">{appt.cancelReason}</p>
            </div>
          )}

          {/* Quick actions */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase 
                           tracking-wider mb-3">
              Quick Actions
            </h3>
            <div className="space-y-2">
              <a href={`/doctor/patient/${appt.patientId}`}
                className="flex items-center justify-between p-3 bg-gray-50 
                           rounded-xl hover:bg-blue-50 hover:text-blue-700 
                           text-gray-700 transition-colors">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Eye className="w-4 h-4" /> View Patient Chart
                </div>
                <ChevronRight className="w-4 h-4" />
              </a>

              {canEdit && (
                <button
                  onClick={() => {
                    onClose()
                    onBook({ ...appt.patient, id: appt.patientId })
                  }}
                  className="w-full flex items-center justify-between p-3 
                             bg-gray-50 rounded-xl hover:bg-blue-50 
                             hover:text-blue-700 text-gray-700 transition-colors">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CalendarDays className="w-4 h-4" /> Book Follow-up
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MINI CALENDAR WIDGET
// ════════════════════════════════════════════════════════════════════════════

const MiniCalendar = ({ appointments, selectedDate, onSelectDate }) => {
  const [viewMonth, setViewMonth] = useState(new Date())

  const year  = viewMonth.getFullYear()
  const month = viewMonth.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Build appointment count map for the month
  const apptMap = {}
  appointments.forEach(a => {
    const d = new Date(a.appointmentDate)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const key = d.getDate()
      apptMap[key] = (apptMap[key] || 0) + 1
    }
  })

  const monthName = viewMonth.toLocaleDateString("en-KE", {
    month: "long", year: "numeric"
  })

  const prevMonth = () =>
    setViewMonth(new Date(year, month - 1, 1))
  const nextMonth = () =>
    setViewMonth(new Date(year, month + 1, 1))

  const today = new Date()

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-sm font-bold text-gray-800">{monthName}</p>
        <button onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <div key={d}
            className="text-center text-[10px] font-bold text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {/* Empty cells before first day */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`e${i}`} />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day       = i + 1
          const dateStr   = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`
          const isToday_  = today.getFullYear() === year
                         && today.getMonth()    === month
                         && today.getDate()     === day
          const isSelected = selectedDate === dateStr
          const count     = apptMap[day] || 0

          return (
            <button key={day}
              onClick={() => onSelectDate(dateStr)}
              className={`relative flex flex-col items-center justify-center 
                          py-1 rounded-lg text-xs font-medium transition-all ${
                isSelected
                  ? "bg-blue-600 text-white"
                  : isToday_
                  ? "bg-blue-50 text-blue-700 font-bold"
                  : "hover:bg-gray-50 text-gray-700"
              }`}>
              {day}
              {count > 0 && (
                <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${
                  isSelected ? "bg-white" : "bg-blue-500"
                }`} />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
          Has appointments
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="w-3 h-3 rounded bg-blue-50 inline-block" />
          Today
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// STATS BAR
// ════════════════════════════════════════════════════════════════════════════

const StatsBar = ({ stats }) => {
  const items = [
    { label: "Total Today", value: stats.total,     color: "text-blue-700",    bg: "bg-blue-50",     icon: CalendarDays },
    { label: "Scheduled",   value: stats.scheduled, color: "text-blue-700",    bg: "bg-blue-50",     icon: Calendar     },
    { label: "Confirmed",   value: stats.confirmed, color: "text-emerald-700", bg: "bg-emerald-50",  icon: CheckCircle  },
    { label: "Completed",   value: stats.completed, color: "text-gray-700",    bg: "bg-gray-50",     icon: Check        },
    { label: "No Show",     value: stats.noShow,    color: "text-orange-700",  bg: "bg-orange-50",   icon: Ban          },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map(it => {
        const Icon = it.icon
        return (
          <div key={it.label}
            className={`${it.bg} rounded-xl p-3 flex items-center gap-3`}>
            <Icon className={`w-5 h-5 ${it.color} shrink-0`} />
            <div>
              <p className="text-xs text-gray-400">{it.label}</p>
              <p className={`text-xl font-bold ${it.color}`}>{it.value}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

export default function AppointmentPage() {
  const { user } = useAuthStore()

  const [appointments, setAppointments] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState("")
  const [statusFilter, setSF]           = useState("ALL")
  const [typeFilter,   setTF]           = useState("ALL")
  const [viewMode,     setVM]           = useState("today")
  const [selectedDate, setSelDate]      = useState(
    new Date().toISOString().slice(0,10)
  )
  const [refreshKey,   setRK]           = useState(0)

  // Modals & drawers
  const [bookModal,    setBookModal]    = useState(false)
  const [bookPatient,  setBookPatient]  = useState(null)
  const [statusModal,  setStatusModal]  = useState(false)
  const [statusAppt,   setStatusAppt]  = useState(null)
  const [drawerAppt,   setDrawerAppt]  = useState(null)

  const autoRef = useRef(null)

  // ── Permission check ────────────────────────────────────────────────────
  const canBook = [
    "RECEPTIONIST","NURSE","CLINICAL_COORDINATOR","DOCTOR",
    "SUPER_ADMIN","HOSPITAL_ADMIN","MEDICAL_RECORDS_OFFICER"
  ].includes(user?.role)

  // ── Load appointments ───────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      let url = "/appointments?"

      if (viewMode === "today") {
        url += `date=${new Date().toISOString().slice(0,10)}&`
      } else if (viewMode === "calendar" && selectedDate) {
        url += `date=${selectedDate}&`
      } else if (viewMode === "week") {
        // No date filter — load all, then filter client-side
      }

      url += "limit=200"

      const res = await api.get(url)
      const list = res.data.data?.appointments
                || res.data.appointments
                || []

      // For "week" view, filter to this week client-side
      if (viewMode === "week") {
        const now    = new Date()
        const monday = new Date(now)
        monday.setDate(now.getDate() - now.getDay() + 1)
        monday.setHours(0,0,0,0)
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)
        sunday.setHours(23,59,59,999)

        const weekList = list.filter(a => {
          const d = new Date(a.appointmentDate)
          return d >= monday && d <= sunday
        })
        setAppointments(weekList)
      } else {
        setAppointments(list)
      }
    } catch {
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }, [viewMode, selectedDate])

  useEffect(() => {
    setLoading(true)
    load()
    autoRef.current = setInterval(load, 60000)
    return () => clearInterval(autoRef.current)
  }, [load, refreshKey])

  // ── Stats (today's) ──────────────────────────────────────────────────────
  const todayAppts = appointments.filter(a => isToday(a.appointmentDate))
  const stats = {
    total:     todayAppts.length,
    scheduled: todayAppts.filter(a => a.status === "SCHEDULED").length,
    confirmed: todayAppts.filter(a => a.status === "CONFIRMED").length,
    completed: todayAppts.filter(a => a.status === "COMPLETED").length,
    noShow:    todayAppts.filter(a => a.status === "NO_SHOW").length,
  }

  // ── Filter ───────────────────────────────────────────────────────────────
  const filtered = appointments.filter(a => {
    const name = a.patient?.fullName?.toLowerCase() || ""
    const pid  = a.patient?.patientId?.toLowerCase() || ""
    const apno = a.appointmentNo?.toLowerCase()      || ""
    const q    = search.toLowerCase()

    const matchSearch  = !search
      || name.includes(q) || pid.includes(q) || apno.includes(q)
    const matchStatus  = statusFilter === "ALL" || a.status === statusFilter
    const matchType    = typeFilter   === "ALL" || a.type   === typeFilter

    return matchSearch && matchStatus && matchType
  })

  // ── Sort: today first, then by date/time ────────────────────────────────
  const sorted = [...filtered].sort((a, b) => {
    const aToday = isToday(a.appointmentDate) ? 0 : 1
    const bToday = isToday(b.appointmentDate) ? 0 : 1
    if (aToday !== bToday) return aToday - bToday
    const da = new Date(a.appointmentDate + (a.appointmentTime ? `T${a.appointmentTime}` : ""))
    const db = new Date(b.appointmentDate + (b.appointmentTime ? `T${b.appointmentTime}` : ""))
    return da - db
  })

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSuccess    = () => { setRK(k => k + 1); setLoading(true) }
  const openStatusModal  = (appt) => { setStatusAppt(appt); setStatusModal(true) }
  const openBookForPt    = (pt)   => { setBookPatient(pt);  setBookModal(true)   }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Page Header ── */}
      <div className="bg-white border-b border-gray-100 px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-2xl">
                <CalendarDays className="w-7 h-7 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Appointments
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Scheduling & Calendar ·{" "}
                  {new Date().toLocaleDateString("en-KE", {
                    weekday:"long", day:"numeric",
                    month:"long",  year:"numeric"
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Live indicator */}
              <div className="flex items-center gap-1.5 text-xs text-gray-400 
                              bg-gray-50 px-3 py-2 rounded-xl">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 
                                animate-pulse" />
                Live · 1 min refresh
              </div>

              <button
                onClick={() => { setLoading(true); load() }}
                className="p-2.5 rounded-xl border border-gray-200 
                           hover:bg-gray-50 text-gray-500"
                title="Refresh">
                <RefreshCw className="w-4 h-4" />
              </button>

              {canBook && (
                <button
                  onClick={() => {
                    setBookPatient(null); setBookModal(true)
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 
                             text-white rounded-xl text-sm font-semibold 
                             hover:bg-blue-700 shadow-sm">
                  <Plus className="w-4 h-4" /> Book Appointment
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex gap-6">

          {/* ── LEFT COLUMN — Calendar sidebar ── */}
          <div className="hidden xl:block w-72 shrink-0 space-y-4">
            <MiniCalendar
              appointments={appointments}
              selectedDate={selectedDate}
              onSelectDate={(d) => {
                setSelDate(d)
                setVM("calendar")
              }}
            />

            {/* Today's summary */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase 
                             tracking-wider mb-3">
                Today's Summary
              </h3>
              <div className="space-y-2">
                {Object.entries(APPT_STATUSES)
                  .filter(([k]) => k !== "IN_PROGRESS")
                  .map(([k, cfg]) => {
                    const count = todayAppts.filter(a => a.status === k).length
                    const Icon  = cfg.icon
                    return (
                      <div key={k}
                        className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-3.5 h-3.5 ${cfg.color.split(" ")[1]}`} />
                          <span className="text-xs text-gray-600">
                            {cfg.label}
                          </span>
                        </div>
                        <span className={`text-xs font-bold ${cfg.color.split(" ")[1]}`}>
                          {count}
                        </span>
                      </div>
                    )
                  })
                }
              </div>
            </div>

            {/* Upcoming — next 3 */}
            {(() => {
              const upcoming = appointments
                .filter(a =>
                  !isPast(a.appointmentDate) &&
                  !isToday(a.appointmentDate) &&
                  a.status === "SCHEDULED"
                )
                .sort((a,b) =>
                  new Date(a.appointmentDate) - new Date(b.appointmentDate)
                )
                .slice(0, 3)

              if (!upcoming.length) return null

              return (
                <div className="bg-white border border-gray-100 rounded-2xl p-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase 
                                 tracking-wider mb-3">
                    Upcoming
                  </h3>
                  <div className="space-y-2">
                    {upcoming.map(a => (
                      <button key={a.id}
                        onClick={() => setDrawerAppt(a)}
                        className="w-full text-left p-2.5 bg-gray-50 rounded-xl 
                                   hover:bg-blue-50 transition-colors">
                        <p className="text-xs font-semibold text-gray-800 truncate">
                          {a.patient?.fullName}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {fmtDate(a.appointmentDate)}
                          {a.appointmentTime
                            ? ` · ${fmtTime(a.appointmentTime)}`
                            : ""}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* ── RIGHT COLUMN — Main content ── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Stats */}
            <StatsBar stats={stats} />

            {/* View mode tabs + filters */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 
                            space-y-3">
              {/* View mode */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {VIEW_MODES.map(m => (
                  <button key={m.key}
                    onClick={() => setVM(m.key)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold 
                                whitespace-nowrap transition-all border ${
                      viewMode === m.key
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}>
                    {m.label}
                  </button>
                ))}

                {viewMode === "calendar" && (
                  <span className="text-xs text-gray-400 ml-2 shrink-0">
                    Showing: <span className="font-semibold text-gray-700">
                      {fmtDate(selectedDate)}
                    </span>
                  </span>
                )}

                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {sorted.length} appointment{sorted.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Search + filters */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 
                                     w-4 h-4 text-gray-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search patient, ID, appointment no…"
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 
                               rounded-xl text-sm focus:outline-none 
                               focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={e => setSF(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm 
                             focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="ALL">All Statuses</option>
                  {Object.entries(APPT_STATUSES).map(([k,v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>

                <select
                  value={typeFilter}
                  onChange={e => setTF(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm 
                             focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="ALL">All Types</option>
                  {APPT_TYPES.map(t => (
                    <option key={t} value={t}>{t.replace("_"," ")}</option>
                  ))}
                </select>
              </div>

              {/* Status filter tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setSF("ALL")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl 
                              text-xs font-semibold whitespace-nowrap border ${
                    statusFilter === "ALL"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}>
                  <Users className="w-3.5 h-3.5" />
                  All ({appointments.length})
                </button>

                {Object.entries(APPT_STATUSES).map(([k, cfg]) => {
                  const Icon  = cfg.icon
                  const count = appointments.filter(a => a.status === k).length
                  const active = statusFilter === k
                  return (
                    <button key={k}
                      onClick={() => setSF(k)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl 
                                  text-xs font-semibold whitespace-nowrap border 
                                  transition-all ${
                        active
                          ? "bg-blue-600 text-white border-blue-600"
                          : `bg-white text-gray-600 border-gray-200 
                             hover:bg-gray-50 ${count === 0 ? "opacity-50" : ""}`
                      }`}>
                      <Icon className="w-3.5 h-3.5" />
                      {cfg.label}
                      {count > 0 && (
                        <span className="font-bold">({count})</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Appointment cards grid */}
            {loading ? (
              <SectionLoader />
            ) : sorted.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl">
                <EmptyState
                  onBook={() => {
                    setBookPatient(null); setBookModal(true)
                  }}
                  canBook={canBook}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
                {sorted.map(appt => (
                  <AppointmentCard
                    key={appt.id}
                    appt={appt}
                    onView={setDrawerAppt}
                    onUpdateStatus={openStatusModal}
                    onCancel={openStatusModal}
                    userRole={user?.role}
                  />
                ))}
              </div>
            )}

            {/* Flow info */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-blue-100 rounded-xl shrink-0">
                  <Info className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-800 text-sm mb-2">
                    Appointment Lifecycle
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { label:"Scheduled",   icon: Calendar,    color:"bg-blue-100 text-blue-700"    },
                      { label:"Confirmed",   icon: CheckCircle, color:"bg-emerald-100 text-emerald-700"},
                      { label:"In Progress", icon: Activity,    color:"bg-purple-100 text-purple-700" },
                      { label:"Completed",   icon: Check,       color:"bg-gray-100 text-gray-700"    },
                    ].map((s, i, arr) => {
                      const Icon = s.icon
                      return (
                        <div key={s.label} className="flex items-center gap-2">
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 
                                          rounded-xl text-xs font-semibold ${s.color}`}>
                            <Icon className="w-3.5 h-3.5" /> {s.label}
                          </div>
                          {i < arr.length - 1 && (
                            <ArrowRight className="w-3 h-3 text-blue-400 shrink-0" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals & Drawers ── */}
      <BookModal
        isOpen={bookModal}
        onClose={() => { setBookModal(false); setBookPatient(null) }}
        onSuccess={handleSuccess}
        prefillPatient={bookPatient}
      />

      <StatusModal
        isOpen={statusModal}
        onClose={() => { setStatusModal(false); setStatusAppt(null) }}
        onSuccess={handleSuccess}
        appointment={statusAppt}
      />

      <AppointmentDrawer
        appt={drawerAppt}
        onClose={() => setDrawerAppt(null)}
        onUpdateStatus={openStatusModal}
        onBook={openBookForPt}
        userRole={user?.role}
      />
    </div>
  )
}