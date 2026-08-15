// frontend/src/pages/AppointmentPage.jsx
import { useState, useEffect } from "react"
import useAuthStore from "../../store/authStore"
import api from  "../../services/api"
import { toast } from "react-hot-toast"
import {
  Calendar, Clock, User, Plus, RefreshCw, X, Save,
  Search, CheckCircle2, XCircle, AlertTriangle, Phone,
  Stethoscope, Filter, ChevronDown, Edit3, Trash2,
  CalendarCheck, UserCheck, Building2
} from "lucide-react"

// ── Helpers ───────────────────────────────────────────────────────────────────
const extractArray = (payload, ...keys) => {
  if (Array.isArray(payload)) return payload
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key]
  }
  return []
}

const STATUS_STYLES = {
  SCHEDULED:  { label: "Scheduled",  color: "bg-blue-100 text-blue-700",   icon: "🗓" },
  CONFIRMED:  { label: "Confirmed",  color: "bg-green-100 text-green-700", icon: "✅" },
  ARRIVED:    { label: "Arrived",    color: "bg-teal-100 text-teal-700",   icon: "🏥" },
  IN_PROGRESS:{ label: "In Progress",color: "bg-purple-100 text-purple-700",icon: "⏳" },
  COMPLETED:  { label: "Completed",  color: "bg-gray-100 text-gray-700",   icon: "✔" },
  CANCELLED:  { label: "Cancelled",  color: "bg-red-100 text-red-700",     icon: "❌" },
  NO_SHOW:    { label: "No Show",    color: "bg-orange-100 text-orange-700",icon: "⚠" },
}

const APPOINTMENT_TYPES = [
  "GENERAL_CONSULTATION",
  "FOLLOW_UP",
  "SPECIALIST_REFERRAL",
  "PROCEDURE",
  "LAB_REVIEW",
  "ANTENATAL",
  "POSTNATAL",
  "VACCINATION",
  "DENTAL",
  "EYE_CLINIC",
  "PHYSIOTHERAPY",
  "NUTRITION",
  "MENTAL_HEALTH",
  "EMERGENCY_REVIEW",
]

const nowLocalDate = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AppointmentPage() {
  const { user } = useAuthStore()
  const [appointments, setAppointments] = useState([])
  const [doctors,      setDoctors]      = useState([])
  const [patients,     setPatients]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [editAppt,     setEditAppt]     = useState(null)
  const [activeTab,    setActiveTab]    = useState("all")
  const [search,       setSearch]       = useState("")
  const [dateFilter,   setDateFilter]   = useState("")
  const [stats,        setStats]        = useState({
    total: 0, scheduled: 0, confirmed: 0, completed: 0, cancelled: 0, noShow: 0
  })

  useEffect(() => {
    fetchAppointments()
    fetchDoctors()
    fetchPatients()
  }, [])

  // ── Fetch Appointments ──────────────────────────────────────────────────────
  const fetchAppointments = async () => {
    setLoading(true)
    try {
      const res  = await api.get("/appointments")
      const list = extractArray(
        res.data?.data,
        "appointments", "data", "results"
      )
      setAppointments(list)
      setStats({
        total:     list.length,
        scheduled: list.filter(a => a.status === "SCHEDULED").length,
        confirmed: list.filter(a => a.status === "CONFIRMED").length,
        completed: list.filter(a => a.status === "COMPLETED").length,
        cancelled: list.filter(a => a.status === "CANCELLED").length,
        noShow:    list.filter(a => a.status === "NO_SHOW").length,
      })
    } catch (e) {
      console.error("fetchAppointments error:", e)
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }

  // ── Fetch Doctors ───────────────────────────────────────────────────────────
  const fetchDoctors = async () => {
    try {
      const res  = await api.get("/admin/users?limit=200&status=ACTIVE")
      const all  =
        res.data?.data?.users ||
        res.data?.data?.data  ||
        res.data?.data        ||
        []
      const docs = Array.isArray(all)
        ? all.filter(u => ["DOCTOR", "SURGEON"].includes(u.role))
        : []
      setDoctors(docs)
    } catch (e) {
      console.error("fetchDoctors error:", e)
      setDoctors([])
    }
  }

  // ── Fetch Patients ──────────────────────────────────────────────────────────
  const fetchPatients = async () => {
    try {
      const res  = await api.get("/patients?limit=200&status=ACTIVE")
      const list = extractArray(
        res.data?.data,
        "patients", "data", "results"
      )
      setPatients(list)
    } catch (e) {
      console.error("fetchPatients error:", e)
      setPatients([])
    }
  }

  // ── Update Status ───────────────────────────────────────────────────────────
  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/appointments/${id}/status`, { status })
      toast.success(`Appointment marked as ${STATUS_STYLES[status]?.label}`)
      fetchAppointments()
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to update status")
    }
  }

  // ── Delete Appointment ──────────────────────────────────────────────────────
  const deleteAppt = async (id) => {
    if (!confirm("Cancel this appointment?")) return
    try {
      await api.delete(`/appointments/${id}`)
      toast.success("Appointment cancelled")
      fetchAppointments()
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to cancel appointment")
    }
  }

  // ── Filter Logic ────────────────────────────────────────────────────────────
  const filtered = appointments.filter(a => {
    const matchTab =
      activeTab === "all"       ? true :
      activeTab === "today"     ? new Date(a.scheduledAt).toDateString() === new Date().toDateString() :
      activeTab === "upcoming"  ? new Date(a.scheduledAt) > new Date() && ["SCHEDULED","CONFIRMED"].includes(a.status) :
      activeTab === "completed" ? a.status === "COMPLETED" :
      activeTab === "cancelled" ? ["CANCELLED","NO_SHOW"].includes(a.status) :
      true

    const matchSearch =
      search === "" ||
      `${a.patient?.firstName} ${a.patient?.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      a.patient?.mrn?.toLowerCase().includes(search.toLowerCase()) ||
      `${a.doctor?.firstName} ${a.doctor?.lastName}`.toLowerCase().includes(search.toLowerCase())

    const matchDate =
      dateFilter === "" ||
      new Date(a.scheduledAt).toISOString().slice(0, 10) === dateFilter

    return matchTab && matchSearch && matchDate
  })

  const canManage = ["SUPER_ADMIN","HOSPITAL_ADMIN","RECEPTIONIST",
    "CLINICAL_COORDINATOR","DOCTOR","MEDICAL_DIRECTOR"].includes(user?.role)

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-blue-200 text-sm">Appointment Management</p>
            <h1 className="text-2xl font-bold">Appointments</h1>
            <p className="text-blue-200 text-sm mt-1">
              St. Everest Mediplex — {new Date().toLocaleDateString("en-NG", {
                weekday: "long", day: "numeric", month: "long", year: "numeric"
              })}
            </p>
          </div>
          <div className="flex gap-3">
            {canManage && (
              <button
                onClick={() => { setEditAppt(null); setShowModal(true) }}
                className="flex items-center gap-2 bg-white text-blue-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-50 transition-colors"
              >
                <Plus className="w-4 h-4" /> Book Appointment
              </button>
            )}
            <button
              onClick={() => { fetchAppointments(); fetchDoctors(); fetchPatients() }}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: "Total",     value: stats.total,     color: "blue"   },
          { label: "Scheduled", value: stats.scheduled, color: "blue"   },
          { label: "Confirmed", value: stats.confirmed, color: "green"  },
          { label: "Completed", value: stats.completed, color: "gray"   },
          { label: "Cancelled", value: stats.cancelled, color: "red"    },
          { label: "No Show",   value: stats.noShow,    color: "orange" },
        ].map(s => (
          <div key={s.label} className={`bg-${s.color}-50 border border-${s.color}-200 rounded-xl p-3 text-center`}>
            <p className={`text-2xl font-bold text-${s.color}-700`}>{s.value}</p>
            <p className={`text-xs text-${s.color}-600 font-medium`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs + Filters ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {[
            { id: "all",       label: "All Appointments" },
            { id: "today",     label: "Today"            },
            { id: "upcoming",  label: "Upcoming"         },
            { id: "completed", label: "Completed"        },
            { id: "cancelled", label: "Cancelled"        },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 border-blue-600 text-blue-700 bg-blue-50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search + Date Filter */}
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search patient, MRN, or doctor..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {dateFilter && (
              <button onClick={() => setDateFilter("")} className="text-gray-400 hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="text-sm text-gray-500 flex items-center">
            {filtered.length} appointment{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Appointments List */}
        <div className="p-4 space-y-3">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse border border-gray-100 rounded-xl p-4 flex gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <CalendarCheck className="w-14 h-14 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium text-lg">No appointments found</p>
              <p className="text-gray-400 text-sm mt-1">
                {search || dateFilter ? "Try adjusting your filters" : "Book a new appointment to get started"}
              </p>
              {canManage && !search && !dateFilter && (
                <button
                  onClick={() => { setEditAppt(null); setShowModal(true) }}
                  className="mt-4 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 inline mr-2" />
                  Book First Appointment
                </button>
              )}
            </div>
          ) : (
            filtered.map(appt => {
              const statusStyle = STATUS_STYLES[appt.status] || STATUS_STYLES.SCHEDULED
              const apptDate    = new Date(appt.scheduledAt)
              const isToday     = apptDate.toDateString() === new Date().toDateString()
              const isPast      = apptDate < new Date()
              const doctorName  = appt.doctor
                ? `Dr. ${appt.doctor.firstName} ${appt.doctor.lastName}`
                : "Doctor not assigned"
              const deptName    = appt.doctor?.department?.name || ""

              return (
                <div
                  key={appt.id}
                  className={`border rounded-xl p-4 hover:shadow-sm transition-all ${
                    isToday ? "border-blue-200 bg-blue-50/30" : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    {/* Left — Patient + Doctor Info */}
                    <div className="flex items-start gap-4">
                      {/* Date Badge */}
                      <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl text-center flex-shrink-0 ${
                        isToday ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
                      }`}>
                        <p className="text-xs font-medium">
                          {apptDate.toLocaleDateString("en-NG", { month: "short" })}
                        </p>
                        <p className="text-xl font-bold leading-none">
                          {apptDate.getDate()}
                        </p>
                        <p className="text-xs">
                          {apptDate.toLocaleDateString("en-NG", { weekday: "short" })}
                        </p>
                      </div>

                      <div>
                        {/* Patient */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-gray-800">
                            {appt.patient?.firstName} {appt.patient?.lastName}
                          </p>
                          {isToday && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                              Today
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle.color}`}>
                            {statusStyle.icon} {statusStyle.label}
                          </span>
                        </div>

                        <p className="text-xs text-gray-400 mt-0.5">
                          MRN: {appt.patient?.mrn} •{" "}
                          {appt.patient?.phone && <><Phone className="w-3 h-3 inline" /> {appt.patient.phone}</>}
                        </p>

                        {/* Doctor + Dept */}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                            <Stethoscope className="w-3 h-3" /> {doctorName}
                          </span>
                          {deptName && (
                            <span className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                              <Building2 className="w-3 h-3" /> {deptName}
                            </span>
                          )}
                        </div>

                        {/* Time + Type */}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            {apptDate.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {appt.appointmentType && (
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                              {appt.appointmentType.replace(/_/g, " ")}
                            </span>
                          )}
                          {appt.notes && (
                            <span className="text-xs text-gray-400 italic truncate max-w-xs">
                              "{appt.notes}"
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right — Actions */}
                    {canManage && (
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        {/* Status Quick Actions */}
                        {appt.status === "SCHEDULED" && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateStatus(appt.id, "CONFIRMED")}
                              className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => updateStatus(appt.id, "CANCELLED")}
                              className="text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                        {appt.status === "CONFIRMED" && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateStatus(appt.id, "ARRIVED")}
                              className="text-xs px-3 py-1.5 bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 font-medium"
                            >
                              Mark Arrived
                            </button>
                            <button
                              onClick={() => updateStatus(appt.id, "NO_SHOW")}
                              className="text-xs px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 font-medium"
                            >
                              No Show
                            </button>
                          </div>
                        )}
                        {appt.status === "ARRIVED" && (
                          <button
                            onClick={() => updateStatus(appt.id, "COMPLETED")}
                            className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                          >
                            Mark Completed
                          </button>
                        )}

                        {/* Edit + Delete */}
                        <div className="flex gap-2">
                          {!["COMPLETED","CANCELLED"].includes(appt.status) && (
                            <button
                              onClick={() => { setEditAppt(appt); setShowModal(true) }}
                              className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" /> Edit
                            </button>
                          )}
                          {["SUPER_ADMIN","HOSPITAL_ADMIN","RECEPTIONIST"].includes(user?.role) && (
                            <button
                              onClick={() => deleteAppt(appt.id)}
                              className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── Book / Edit Modal ── */}
      {showModal && (
        <AppointmentModal
          editAppt={editAppt}
          doctors={doctors}
          patients={patients}
          onClose={() => { setShowModal(false); setEditAppt(null) }}
          onSaved={() => { setShowModal(false); setEditAppt(null); fetchAppointments() }}
        />
      )}
    </div>
  )
}

// ── Appointment Modal ─────────────────────────────────────────────────────────
function AppointmentModal({ editAppt, doctors, patients, onClose, onSaved }) {
  const isEdit = !!editAppt

  const [form, setForm] = useState({
    patientId:       editAppt?.patient?.id       || editAppt?.patientId       || "",
    doctorId:        editAppt?.doctor?.id         || editAppt?.doctorId         || "",
    scheduledAt:     editAppt?.scheduledAt
      ? new Date(editAppt.scheduledAt).toISOString().slice(0, 16)
      : nowLocalDate(),
    appointmentType: editAppt?.appointmentType   || "GENERAL_CONSULTATION",
    notes:           editAppt?.notes             || "",
    status:          editAppt?.status            || "SCHEDULED",
  })

  const [submitting,     setSubmitting]     = useState(false)
  const [patientSearch,  setPatientSearch]  = useState("")
  const [doctorSearch,   setDoctorSearch]   = useState("")

  const set = (field, val) => setForm(p => ({ ...p, [field]: val }))

  // ── Filtered dropdowns ──────────────────────────────────────────────────────
  const filteredPatients = patients.filter(p =>
    patientSearch === "" ||
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(patientSearch.toLowerCase()) ||
    p.mrn?.toLowerCase().includes(patientSearch.toLowerCase())
  )

  const filteredDoctors = doctors.filter(d =>
    doctorSearch === "" ||
    `${d.firstName} ${d.lastName}`.toLowerCase().includes(doctorSearch.toLowerCase()) ||
    d.department?.name?.toLowerCase().includes(doctorSearch.toLowerCase())
  )

  // ── Selected display ────────────────────────────────────────────────────────
  const selectedDoctor  = doctors.find(d => d.id === form.doctorId)
  const selectedPatient = patients.find(p => p.id === form.patientId)

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.patientId)   return toast.error("Select a patient")
    if (!form.doctorId)    return toast.error("Select a doctor")
    if (!form.scheduledAt) return toast.error("Select appointment date and time")

    setSubmitting(true)
    try {
      const payload = {
        patientId:       form.patientId,
        doctorId:        form.doctorId,
        scheduledAt:     new Date(form.scheduledAt).toISOString(),
        appointmentType: form.appointmentType,
        notes:           form.notes,
        status:          form.status,
      }

      if (isEdit) {
        await api.put(`/appointments/${editAppt.id}`, payload)
        toast.success("✅ Appointment updated successfully")
      } else {
        await api.post("/appointments", payload)
        toast.success("✅ Appointment booked successfully")
      }
      onSaved()
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to save appointment")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-bold text-gray-800 text-lg">
              {isEdit ? "Edit Appointment" : "Book New Appointment"}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {isEdit ? "Update appointment details" : "Fill in the details to book an appointment"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">

          {/* ── Patient Selection ── */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Patient <span className="text-red-500">*</span>
              <span className="text-xs font-normal text-gray-400 ml-1">
                ({patients.length} registered)
              </span>
            </label>

            {/* Search patients */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={patientSearch}
                onChange={e => setPatientSearch(e.target.value)}
                placeholder="Search by name or MRN..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={form.patientId}
              onChange={e => set("patientId", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              size={patientSearch ? Math.min(filteredPatients.length + 1, 6) : 1}
            >
              <option value="">-- Select patient --</option>
              {filteredPatients.map(p => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName} — MRN: {p.mrn}
                  {p.phone ? ` | ${p.phone}` : ""}
                </option>
              ))}
            </select>

            {/* Selected patient preview */}
            {selectedPatient && (
              <div className="mt-2 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {selectedPatient.firstName?.[0]}{selectedPatient.lastName?.[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-800">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </p>
                  <p className="text-xs text-blue-600">
                    MRN: {selectedPatient.mrn}
                    {selectedPatient.dateOfBirth &&
                      ` • DOB: ${new Date(selectedPatient.dateOfBirth).toLocaleDateString("en-NG")}`}
                  </p>
                </div>
                <CheckCircle2 className="w-4 h-4 text-blue-600 ml-auto" />
              </div>
            )}

            {patients.length === 0 && (
              <p className="text-xs text-orange-600 mt-1">
                ⚠ No patients found — register patients first via Reception
              </p>
            )}
          </div>

          {/* ── Doctor Selection ── */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Assign Doctor <span className="text-red-500">*</span>
              <span className="text-xs font-normal text-gray-400 ml-1">
                ({doctors.length} registered)
              </span>
            </label>

            {/* Search doctors */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={doctorSearch}
                onChange={e => setDoctorSearch(e.target.value)}
                placeholder="Search by name or department..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={form.doctorId}
              onChange={e => set("doctorId", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              size={doctorSearch ? Math.min(filteredDoctors.length + 1, 6) : 1}
            >
              <option value="">-- Select doctor --</option>

              {/* Doctors grouped by role */}
              {filteredDoctors.filter(d => d.role === "DOCTOR").length > 0 && (
                <optgroup label="👨‍⚕️ Doctors">
                  {filteredDoctors
                    .filter(d => d.role === "DOCTOR")
                    .map(d => (
                      <option key={d.id} value={d.id}>
                        Dr. {d.firstName} {d.lastName}
                        {d.department?.name ? ` — ${d.department.name}` : ""}
                      </option>
                    ))}
                </optgroup>
              )}

              {filteredDoctors.filter(d => d.role === "SURGEON").length > 0 && (
                <optgroup label="🔪 Surgeons">
                  {filteredDoctors
                    .filter(d => d.role === "SURGEON")
                    .map(d => (
                      <option key={d.id} value={d.id}>
                        Dr. {d.firstName} {d.lastName}
                        {d.department?.name ? ` — ${d.department.name}` : " — Surgery"}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>

            {/* Selected doctor preview */}
            {selectedDoctor && (
              <div className="mt-2 flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {selectedDoctor.firstName?.[0]}{selectedDoctor.lastName?.[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-indigo-800">
                    Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}
                  </p>
                  <p className="text-xs text-indigo-600">
                    {selectedDoctor.role === "SURGEON" ? "Surgeon" : "Doctor"}
                    {selectedDoctor.department?.name
                      ? ` • ${selectedDoctor.department.name}`
                      : ""}
                  </p>
                </div>
                <CheckCircle2 className="w-4 h-4 text-indigo-600 ml-auto" />
              </div>
            )}

            {doctors.length === 0 && (
              <p className="text-xs text-orange-600 mt-1">
                ⚠ No doctors found — register doctor users via Admin panel
              </p>
            )}
          </div>

          {/* ── Date & Time ── */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Appointment Date & Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={e => set("scheduledAt", e.target.value)}
              min={nowLocalDate()}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {form.scheduledAt && (
              <p className="text-xs text-gray-500 mt-1">
                📅 {new Date(form.scheduledAt).toLocaleDateString("en-NG", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric"
                })} at {new Date(form.scheduledAt).toLocaleTimeString("en-NG", {
                  hour: "2-digit", minute: "2-digit"
                })}
              </p>
            )}
          </div>

          {/* ── Appointment Type ── */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Appointment Type
            </label>
            <select
              value={form.appointmentType}
              onChange={e => set("appointmentType", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {APPOINTMENT_TYPES.map(t => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>

          {/* ── Status (edit only) ── */}
          {isEdit && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Status
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STATUS_STYLES).map(([key, val]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set("status", key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      form.status === key
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {val.icon} {val.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Notes ── */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Notes / Reason for Visit
              <span className="text-gray-400 text-xs font-normal ml-1">(optional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="Reason for visit, special instructions, symptoms..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* ── Summary Box ── */}
          {(form.patientId || form.doctorId || form.scheduledAt) && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                Appointment Summary
              </p>
              {selectedPatient && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700 font-medium">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </span>
                  <span className="text-gray-400 text-xs">({selectedPatient.mrn})</span>
                </div>
              )}
              {selectedDoctor && (
                <div className="flex items-center gap-2 text-sm">
                  <Stethoscope className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700 font-medium">
                    Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}
                  </span>
                  {selectedDoctor.department?.name && (
                    <span className="text-gray-400 text-xs">
                      — {selectedDoctor.department.name}
                    </span>
                  )}
                </div>
              )}
              {form.scheduledAt && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">
                    {new Date(form.scheduledAt).toLocaleDateString("en-NG", {
                      weekday: "short", day: "numeric", month: "short", year: "numeric"
                    })} at {new Date(form.scheduledAt).toLocaleTimeString("en-NG", {
                      hour: "2-digit", minute: "2-digit"
                    })}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <CalendarCheck className="w-4 h-4 text-gray-400" />
                <span className="text-gray-700">
                  {form.appointmentType.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          )}

          {/* ── Buttons ── */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !form.patientId || !form.doctorId || !form.scheduledAt}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              {submitting
                ? (isEdit ? "Updating..." : "Booking...")
                : (isEdit ? "Update Appointment" : "Book Appointment")}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}