import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import api from "../../services/api"
import {
  Search, RefreshCw, User, Clock, ChevronRight,
  Activity, Users, CheckCircle, Stethoscope,
  AlertTriangle, Timer, Heart, Wind, Thermometer,
  ArrowLeft, Eye
} from "lucide-react"

// ─── Constants ────────────────────────────────────────────────────────────────
const TRIAGE_COLOR = {
  IMMEDIATE:   "bg-red-100 text-red-700 border border-red-300",
  URGENT:      "bg-orange-100 text-orange-700 border border-orange-300",
  LESS_URGENT: "bg-yellow-100 text-yellow-700 border border-yellow-300",
  NON_URGENT:  "bg-green-100 text-green-700 border border-green-300",
}

const STATUS_COLOR = {
  REGISTERED:        "bg-gray-100 text-gray-600",
  WAITING:           "bg-amber-100 text-amber-700",
  TRIAGED:           "bg-blue-100 text-blue-700",
  VITALS_DONE:       "bg-purple-100 text-purple-700",
  WITH_DOCTOR:       "bg-yellow-100 text-yellow-700",
  IN_CONSULTATION:   "bg-yellow-100 text-yellow-700",
  AWAITING_LAB:      "bg-orange-100 text-orange-700",
  LAB_PENDING:       "bg-orange-100 text-orange-700",
  PHARMACY:          "bg-indigo-100 text-indigo-700",
  CONSULTATION_DONE: "bg-green-100 text-green-700",
  COMPLETED:         "bg-teal-100 text-teal-700",
  REFERRED:          "bg-red-100 text-red-700",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getWaitTime = (createdAt) => {
  if (!createdAt) return "—"
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

const waitColor = (createdAt) => {
  if (!createdAt) return "text-gray-400"
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
  if (mins > 120) return "text-red-600 font-bold"
  if (mins > 60)  return "text-amber-600 font-semibold"
  return "text-gray-500"
}

const calcAge = (dob) => {
  if (!dob) return "—"
  return `${Math.floor((Date.now() - new Date(dob)) / (1000 * 60 * 60 * 24 * 365.25))}y`
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, color, bg }) => (
  <div className={`${bg} rounded-xl p-4 flex items-center gap-3`}>
    <Icon className={`w-5 h-5 ${color} shrink-0`} />
    <div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  </div>
)

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DoctorQueue() {
  const navigate = useNavigate()
  const [visits,  setVisits]  = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState("")
  const [filter,  setFilter]  = useState("PENDING")

  useEffect(() => {
    fetchQueue()
    const t = setInterval(fetchQueue, 20000)
    return () => clearInterval(t)
  }, [])

  const fetchQueue = async () => {
    try {
      const today = new Date().toISOString().split("T")[0]
      const res   = await api.get(`/visits?date=${today}&limit=200`)
      const list  = res.data.data?.visits || res.data.data || res.data.visits || []
      // Sort: IMMEDIATE first, then by wait time
      const sorted = Array.isArray(list) ? [...list].sort((a, b) => {
        const order = { IMMEDIATE: 0, URGENT: 1, LESS_URGENT: 2, NON_URGENT: 3 }
        const pa = a.triage?.[0]?.priority || a.triageLevel
        const pb = b.triage?.[0]?.priority || b.triageLevel
        if (pa && pb && order[pa] !== order[pb]) return order[pa] - order[pb]
        return new Date(a.createdAt) - new Date(b.createdAt)
      }) : []
      setVisits(sorted)
    } catch (e) {
      console.error("fetchQueue error:", e)
      setVisits([])
    } finally {
      setLoading(false)
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const pending    = visits.filter(v => ["WAITING","TRIAGED","VITALS_DONE","REGISTERED"].includes(v.status)).length
  const inProgress = visits.filter(v => ["WITH_DOCTOR","IN_CONSULTATION","AWAITING_LAB","LAB_PENDING"].includes(v.status)).length
  const completed  = visits.filter(v => ["CONSULTATION_DONE","COMPLETED","PHARMACY"].includes(v.status)).length
  const total      = visits.length

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = visits.filter(v => {
    const name = `${v.patient?.firstName || ""} ${v.patient?.lastName || ""}`.toLowerCase()
    const id   = (v.patient?.mrn || v.patient?.patientNumber || "").toLowerCase()
    const matchSearch = !search || name.includes(search.toLowerCase()) || id.includes(search.toLowerCase())
    const matchFilter =
      filter === "ALL" ||
      (filter === "PENDING"     && ["WAITING","TRIAGED","VITALS_DONE","REGISTERED"].includes(v.status)) ||
      (filter === "IN_PROGRESS" && ["WITH_DOCTOR","IN_CONSULTATION","AWAITING_LAB","LAB_PENDING"].includes(v.status)) ||
      (filter === "COMPLETED"   && ["CONSULTATION_DONE","COMPLETED","PHARMACY","REFERRED"].includes(v.status))
    return matchSearch && matchFilter
  })

  const FILTERS = [
    { key: "PENDING",     label: "Pending",     count: pending    },
    { key: "IN_PROGRESS", label: "In Progress", count: inProgress },
    { key: "COMPLETED",   label: "Completed",   count: completed  },
    { key: "ALL",         label: "All",         count: total      },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/doctor")}
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors text-gray-500"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-blue-600" />
                Patient Queue
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date().toLocaleDateString("en-NG", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric"
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-white border border-gray-200 px-3 py-2 rounded-xl">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Auto-refresh 20s
            </div>
            <button
              onClick={() => { setLoading(true); fetchQueue() }}
              className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Today"  value={total}      icon={Users}       color="text-blue-700"    bg="bg-blue-50"    />
          <StatCard label="Pending"      value={pending}    icon={Clock}       color="text-amber-700"   bg="bg-amber-50"   />
          <StatCard label="In Progress"  value={inProgress} icon={Activity}    color="text-purple-700"  bg="bg-purple-50"  />
          <StatCard label="Completed"    value={completed}  icon={CheckCircle} color="text-emerald-700" bg="bg-emerald-50" />
        </div>

        {/* ── Search + Filter ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by patient name or ID…"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filter === f.key
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {f.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                    filter === f.key ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-500"
                  }`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Queue List ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="divide-y divide-gray-50">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="p-4 animate-pulse flex gap-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                  <div className="w-20 h-8 bg-gray-100 rounded-lg" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <User className="w-8 h-8 text-gray-300" />
              </div>
              <p className="font-semibold text-gray-500">No patients found</p>
              <p className="text-sm text-gray-400 mt-1">
                {filter === "PENDING"
                  ? "No patients waiting for consultation"
                  : "Try changing the filter or search"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map((visit, idx) => {
                const vital    = visit.vitalSigns?.[0]
                const triage   = visit.triage?.[0]
                const priority = triage?.priority || visit.triageLevel
                const isUrgent = ["IMMEDIATE","URGENT"].includes(priority)

                return (
                  <div
                    key={visit.id}
                    className={`p-4 hover:bg-gray-50 transition-colors ${
                      priority === "IMMEDIATE" ? "border-l-4 border-red-400" :
                      priority === "URGENT"    ? "border-l-4 border-orange-400" : ""
                    }`}
                  >
                    <div className="flex items-start gap-4">

                      {/* Queue Number */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        isUrgent ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                      }`}>
                        {idx + 1}
                      </div>

                      {/* Patient Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-800 text-sm">
                            {visit.patient?.firstName} {visit.patient?.lastName}
                          </p>
                          <span className="text-xs text-gray-400">
                            {visit.patient?.mrn || visit.patient?.patientNumber}
                          </span>
                          <span className="text-xs text-gray-400">
                            · {calcAge(visit.patient?.dateOfBirth)} · {visit.patient?.gender}
                          </span>
                          {priority && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TRIAGE_COLOR[priority] || "bg-gray-100 text-gray-600"}`}>
                              {priority.replace("_", " ")}
                            </span>
                          )}
                        </div>

                        {/* Chief Complaint */}
                        {visit.chiefComplaint && (
                          <p className="text-xs text-gray-500 mb-1.5 bg-gray-50 rounded-lg px-2 py-1 inline-block">
                            💬 {visit.chiefComplaint}
                          </p>
                        )}

                        {/* Vitals Strip */}
                        {vital && (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {vital.bloodPressureSystolic && (
                              <span className="flex items-center gap-1 text-xs text-gray-500 bg-blue-50 px-2 py-0.5 rounded-lg">
                                <Activity className="w-3 h-3 text-blue-400" />
                                {vital.bloodPressureSystolic}/{vital.bloodPressureDiastolic}
                              </span>
                            )}
                            {(vital.pulse || vital.heartRate) && (
                              <span className="flex items-center gap-1 text-xs text-gray-500 bg-pink-50 px-2 py-0.5 rounded-lg">
                                <Heart className="w-3 h-3 text-pink-400" />
                                {vital.pulse || vital.heartRate} bpm
                              </span>
                            )}
                            {vital.temperature && (
                              <span className="flex items-center gap-1 text-xs text-gray-500 bg-orange-50 px-2 py-0.5 rounded-lg">
                                <Thermometer className="w-3 h-3 text-orange-400" />
                                {vital.temperature}°C
                              </span>
                            )}
                            {vital.oxygenSaturation && (
                              <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg ${
                                vital.oxygenSaturation < 95
                                  ? "bg-red-50 text-red-600 font-semibold"
                                  : "bg-teal-50 text-gray-500"
                              }`}>
                                <Wind className="w-3 h-3 text-teal-400" />
                                {vital.oxygenSaturation}%
                              </span>
                            )}
                          </div>
                        )}

                        {/* Visit meta */}
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-xs text-gray-400">
                            {visit.visitType || "OPD"}
                          </span>
                          <span className="text-xs text-gray-300">·</span>
                          <span className={`flex items-center gap-1 text-xs ${waitColor(visit.createdAt)}`}>
                            <Timer className="w-3 h-3" />
                            Wait: {getWaitTime(visit.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Right Side — Status + Actions */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[visit.status] || "bg-gray-100 text-gray-600"}`}>
                          {(visit.status || "REGISTERED").replace(/_/g, " ")}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {/* View Chart */}
                          <button
                            onClick={() => navigate(`/doctor/patient/${visit.patientId || visit.patient?.id}`)}
                            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors"
                            title="View Patient Chart"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Consult */}
                          <button
                            onClick={() => navigate(`/doctor/consult/${visit.id}`)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              isUrgent
                                ? "bg-red-600 text-white hover:bg-red-700"
                                : "bg-blue-600 text-white hover:bg-blue-700"
                            }`}
                          >
                            Consult <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Immediate Alert Banner ── */}
        {visits.some(v => (v.triage?.[0]?.priority || v.triageLevel) === "IMMEDIATE") && (
          <div className="mt-4 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
            <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-800">
                IMMEDIATE Priority Patient(s) in Queue
              </p>
              <p className="text-xs text-red-600">
                {visits.filter(v => (v.triage?.[0]?.priority || v.triageLevel) === "IMMEDIATE").length} patient(s) require immediate attention
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}