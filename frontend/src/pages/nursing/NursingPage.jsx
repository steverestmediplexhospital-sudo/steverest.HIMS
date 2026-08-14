// frontend/src/pages/nursing/NursingPage.jsx
import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import useAuthStore from "../../store/authStore"
import api from "../../services/api"
import { toast } from "react-hot-toast"
import {
  Heart, Activity, Thermometer, Wind, Droplets, Clock,
  BedDouble, AlertTriangle, CheckCircle2, Plus, RefreshCw,
  User, X, Save, Syringe, ClipboardList, Users, TrendingUp,
  Bot, Edit3, FileEdit, ChevronDown, ChevronUp, LogIn,
  LogOut, Star, UserCheck, Shield, Calendar
} from "lucide-react"

// ── Constants ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: "queue",  label: "Patient Queue",    icon: Users        },
  { id: "vitals", label: "Vitals Entry",      icon: Activity     },
  { id: "meds",   label: "Medication Admin",  icon: Syringe      },
  { id: "notes",  label: "Nursing Notes",     icon: ClipboardList},
  { id: "beds",   label: "Bed Management",    icon: BedDouble    },
  { id: "shift",  label: "Shift Management",  icon: Calendar     }
]

const SHIFT_INFO = {
  MORNING: { label: "Morning Shift", time: "07:00 – 15:00", icon: "🌅", color: "yellow" },
  EVENING: { label: "Evening Shift", time: "15:00 – 23:00", icon: "🌆", color: "orange" },
  NIGHT:   { label: "Night Shift",   time: "23:00 – 07:00", icon: "🌙", color: "blue"   }
}

const getCurrentShiftType = () => {
  const h = new Date().getHours()
  if (h >= 7  && h < 15) return "MORNING"
  if (h >= 15 && h < 23) return "EVENING"
  return "NIGHT"
}

// ── Defensive array extractor ─────────────────────────────────────────────────
const extractArray = (payload, ...keys) => {
  if (Array.isArray(payload)) return payload
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key]
  }
  return []
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function NursingPage() {
  const { user }  = useAuthStore()
  const navigate  = useNavigate()
  const [activeTab,    setActiveTab]    = useState("queue")
  const [stats,        setStats]        = useState({ queue: 0, vitalsdue: 0, medsdue: 0, beds: 0 })
  const [loading,      setLoading]      = useState(true)
  const [aiOpen,       setAiOpen]       = useState(false)
  const [activeShift,  setActiveShift]  = useState(null)

  useEffect(() => { fetchStats(); fetchActiveShift() }, [])

  const fetchActiveShift = async () => {
    try {
      const res = await api.get("/nursing/shift/active")
      setActiveShift(res.data?.data?.shift || null)
    } catch (e) { /* not clocked in */ }
  }

  const fetchStats = async () => {
    try {
      const [qRes, bRes] = await Promise.allSettled([
        api.get("/nursing/queue"),
        api.get("/nursing/beds")
      ])
      const qData = qRes.status === "fulfilled" ? qRes.value.data?.data : null
      const queue  = extractArray(qData, "admissions", "activeAdmissions", "queue", "visits")
      const bData  = bRes.status === "fulfilled" ? bRes.value.data?.data : null
      const beds   = extractArray(bData, "beds")
      setStats({
        queue:     queue.length,
        vitalsdue: queue.filter(a => !a.visit?.vitalSigns?.length).length,
        medsdue:   0,
        beds:      beds.filter(b => b.status === "AVAILABLE").length
      })
    } catch (e) {
      console.error("fetchStats error:", e)
    } finally {
      setLoading(false)
    }
  }

  const shiftInfo = activeShift ? SHIFT_INFO[activeShift.shiftType] : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-700 via-rose-600 to-pink-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-pink-200 text-sm">Nursing Station</p>
            <h1 className="text-2xl font-bold">{user?.firstName} {user?.lastName}</h1>
            <p className="text-pink-200 text-sm mt-1">
              {user?.role?.replace(/_/g, " ")} — St. Everest Mediplex
            </p>
            {/* Shift badge */}
            {activeShift ? (
              <div className="flex items-center gap-2 mt-2">
                <span className="bg-green-500 text-white text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  ON DUTY — {shiftInfo?.label} {shiftInfo?.icon}
                </span>
                {user?.isNurseInCharge && (
                  <span className="bg-yellow-400 text-yellow-900 text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1">
                    <Star className="w-3 h-3" /> NIC
                  </span>
                )}
              </div>
            ) : (
              <span className="mt-2 inline-block bg-white/20 text-white text-xs px-3 py-1 rounded-full">
                ⏸ Not clocked in
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setActiveTab("shift") }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeShift
                  ? "bg-green-500 hover:bg-green-600 text-white"
                  : "bg-white/20 hover:bg-white/30 text-white"
              }`}
            >
              <Calendar className="w-4 h-4" />
              {activeShift ? "Manage Shift" : "Start Shift"}
            </button>
            <button
              onClick={() => setAiOpen(true)}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              <Bot className="w-4 h-4" /> Clinical AI
            </button>
            <button
              onClick={() => { fetchStats(); fetchActiveShift() }}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Inpatient Queue", value: stats.queue,     icon: Users,    color: "blue",   sub: "Active admissions"   },
          { label: "Vitals Due",      value: stats.vitalsdue, icon: Activity, color: "orange", sub: "Not yet recorded"    },
          { label: "Meds Due",        value: stats.medsdue,   icon: Syringe,  color: "purple", sub: "Scheduled"           },
          { label: "Available Beds",  value: stats.beds,      icon: BedDouble,color: "green",  sub: "Ready for admission" }
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className={`w-10 h-10 rounded-lg bg-${s.color}-50 flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 text-${s.color}-600`} />
              </div>
              <p className="text-2xl font-bold text-gray-800">{loading ? "—" : s.value}</p>
              <p className="text-xs font-medium text-gray-600">{s.label}</p>
              <p className="text-xs text-gray-400">{s.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "border-b-2 border-pink-600 text-pink-700 bg-pink-50"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-4 h-4" /> {tab.label}
                {tab.id === "shift" && activeShift && (
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                )}
              </button>
            )
          })}
        </div>

        <div className="p-5">
          {activeTab === "queue"  && <NursingQueue navigate={navigate} activeShift={activeShift} currentUser={user} />}
          {activeTab === "vitals" && <VitalsEntry />}
          {activeTab === "meds"   && <MedicationAdmin />}
          {activeTab === "notes"  && <NursingNotes />}
          {activeTab === "beds"   && <BedManagement />}
          {activeTab === "shift"  && (
            <ShiftManagement
              activeShift={activeShift}
              currentUser={user}
              onShiftChange={() => { fetchActiveShift(); fetchStats() }}
            />
          )}
        </div>
      </div>

      {aiOpen && <NursingAI onClose={() => setAiOpen(false)} />}
    </div>
  )
}

// ── Nursing Queue ─────────────────────────────────────────────────────────────
function NursingQueue({ navigate, activeShift, currentUser }) {
  const [admissions,  setAdmissions]  = useState([])
  const [myPatients,  setMyPatients]  = useState([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState("")
  const [viewMode,    setViewMode]    = useState("all") // "all" | "mine"

  useEffect(() => { fetchQueue() }, [])
  useEffect(() => { if (activeShift) fetchMyPatients() }, [activeShift])

  const fetchQueue = async () => {
    try {
      const res     = await api.get("/nursing/queue")
      const payload = res.data?.data
      const list    = extractArray(payload, "admissions", "activeAdmissions", "queue", "visits")
      setAdmissions(list)
    } catch (e) {
      console.error("fetchQueue error:", e)
      setAdmissions([])
    } finally {
      setLoading(false)
    }
  }

  const fetchMyPatients = async () => {
    try {
      const res = await api.get("/nursing/shift/my-patients")
      setMyPatients(res.data?.data?.patients || [])
    } catch (e) { setMyPatients([]) }
  }

  const displayList = viewMode === "mine" ? myPatients : admissions

  const filtered = displayList.filter(a =>
    search === "" ||
    `${a.patient?.firstName} ${a.patient?.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    a.patient?.mrn?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search patient..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>
        {/* View toggle */}
        {activeShift && (
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setViewMode("all")}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                viewMode === "all" ? "bg-pink-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              All Patients ({admissions.length})
            </button>
            <button
              onClick={() => { setViewMode("mine"); fetchMyPatients() }}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                viewMode === "mine" ? "bg-pink-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              My Patients ({myPatients.length})
            </button>
          </div>
        )}
        <button
          onClick={fetchQueue}
          className="p-2 text-gray-400 hover:text-pink-600 rounded-lg hover:bg-pink-50"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        [...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse border border-gray-100 rounded-xl p-4 flex gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        ))
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <BedDouble className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">
            {viewMode === "mine" ? "No patients assigned to you this shift" : "No active admissions"}
          </p>
          {viewMode === "mine" && !activeShift && (
            <p className="text-xs text-gray-400 mt-1">Clock in to see your assigned patients</p>
          )}
        </div>
      ) : (
        filtered.map(admission => {
          const vital = Array.isArray(admission.visit?.vitalSigns)
            ? admission.visit.vitalSigns[0] : null
          const hasVitals    = !!vital
          const daysAdmitted = Math.floor((Date.now() - new Date(admission.admittedAt)) / 86400000)
          const assignedNurse = admission.nurseAssignments?.[0]?.shift?.nurse

          return (
            <div key={admission.id} className="border border-gray-200 rounded-xl p-4 hover:border-pink-200 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-700 font-bold text-sm flex-shrink-0">
                    {admission.patient?.firstName?.[0]}{admission.patient?.lastName?.[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800">
                        {admission.patient?.firstName} {admission.patient?.lastName}
                      </p>
                      {assignedNurse && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <UserCheck className="w-3 h-3" />
                          {assignedNurse.firstName} {assignedNurse.lastName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="text-xs text-gray-400">{admission.patient?.mrn}</span>
                      <span className="text-xs text-gray-300">•</span>
                      <span className="text-xs text-gray-400">{admission.bed?.room?.ward?.name || admission.ward?.name}</span>
                      <span className="text-xs text-gray-300">•</span>
                      <span className="text-xs font-medium text-blue-600">Bed {admission.bed?.bedNumber}</span>
                      <span className="text-xs text-gray-300">•</span>
                      <span className="text-xs text-gray-400">Day {daysAdmitted + 1}</span>
                    </div>

                    {vital ? (
                      <div className="flex gap-3 mt-2 flex-wrap">
                        {[
                          { l: "BP",   v: `${vital.bloodPressureSystolic}/${vital.bloodPressureDiastolic}`, alert: vital.bloodPressureSystolic > 140 },
                          { l: "HR",   v: vital.pulse ? `${vital.pulse} bpm` : null, alert: vital.pulse > 100 || vital.pulse < 60 },
                          { l: "T",    v: vital.temperature ? `${vital.temperature}°C` : null, alert: vital.temperature > 37.5 },
                          { l: "SpO₂", v: vital.oxygenSaturation ? `${vital.oxygenSaturation}%` : null, alert: vital.oxygenSaturation < 95 },
                          { l: "RR",   v: vital.respiratoryRate ? `${vital.respiratoryRate} cpm` : null, alert: vital.respiratoryRate > 20 }
                        ].filter(x => x.v && !x.v.includes("undefined") && !x.v.includes("null")).map(x => (
                          <span key={x.l} className={`text-xs px-2 py-0.5 rounded-full ${
                            x.alert ? "bg-red-100 text-red-700 font-medium" : "bg-gray-100 text-gray-600"
                          }`}>
                            {x.l}: {x.v}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 mt-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" /> Vitals not recorded
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => navigate(`/nursing/vitals/${admission.visit?.id}`)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      hasVitals
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-orange-600 text-white hover:bg-orange-700"
                    }`}
                  >
                    {hasVitals ? "Update Vitals" : "Record Vitals"}
                  </button>
                  <button
                    onClick={() => navigate(`/nursing/notes/${admission.visit?.id}`)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium"
                  >
                    Nursing Note
                  </button>
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ── Vitals Entry ──────────────────────────────────────────────────────────────
function VitalsEntry() {
  const [visits,        setVisits]        = useState([])
  const [selectedVisit, setSelectedVisit] = useState("")
  const [loading,       setLoading]       = useState(false)
  const [submitting,    setSubmitting]    = useState(false)

  const nowLocal = () => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  }

  // ── BP stored per location — switching preserves each location's data ──────
  const emptyBP = () => ({ systolic: "", diastolic: "" })
  const [bpData, setBpData] = useState({
    LEFT_ARM:  emptyBP(),
    RIGHT_ARM: emptyBP(),
    LEFT_LEG:  emptyBP(),
    RIGHT_LEG: emptyBP()
  })
  const [bpLocation, setBpLocation] = useState("LEFT_ARM")

  const setBP = (field, val) => {
    setBpData(prev => ({
      ...prev,
      [bpLocation]: { ...prev[bpLocation], [field]: val }
    }))
  }

  const currentBP = bpData[bpLocation]

  const [form, setForm] = useState({
    heartRate:          "",
    temperature:        "",
    oxygenSaturation:   "",
    weight:             "",
    height:             "",
    bloodGlucose:       "",
    painScore:          "0",
    gcsScore:           "",
    urineOutput:        "",
    notes:              "",
    respiratoryRate:    "",
    bpStandingSystolic:  "",
    bpStandingDiastolic: "",
    bpSupineSystolic:    "",
    bpSupineDiastolic:   "",
    spo2OnOxygen:        false,
    oxygenLitresPerMin:  "",
    recordedAt:          nowLocal()
  })

  useEffect(() => { fetchActiveVisits() }, [])

  const fetchActiveVisits = async () => {
    setLoading(true)
    try {
      const res        = await api.get("/nursing/queue")
      const payload    = res.data?.data
      const admissions = extractArray(payload, "admissions", "activeAdmissions", "queue", "visits")
      setVisits(
        admissions
          .map(a => ({
            id:    a.visit?.id,
            label: `${a.patient?.firstName} ${a.patient?.lastName} — Bed ${a.bed?.bedNumber}`
          }))
          .filter(v => v.id)
      )
    } catch (e) {
      console.error("fetchActiveVisits error:", e)
    } finally {
      setLoading(false)
    }
  }

  const set = (field, val) => setForm(p => ({ ...p, [field]: val }))

  // Auto-calculate BMI
  const bmi = (() => {
    const w = parseFloat(form.weight)
    const h = parseFloat(form.height)
    if (!w || !h || h === 0) return null
    return (w / ((h / 100) ** 2)).toFixed(1)
  })()

  const bmiCategory = (b) => {
    if (!b) return null
    const v = parseFloat(b)
    if (v < 18.5) return { label: "Underweight", color: "text-blue-600" }
    if (v < 25)   return { label: "Normal",       color: "text-green-600" }
    if (v < 30)   return { label: "Overweight",   color: "text-orange-600" }
    return               { label: "Obese",         color: "text-red-600" }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedVisit) { toast.error("Select a patient"); return }
    setSubmitting(true)
    try {
      const payload = { visitId: selectedVisit }

      // Primary BP = current location's sitting reading
      const primaryBP = bpData[bpLocation]
      if (primaryBP.systolic)  payload.bloodPressureSystolic  = parseInt(primaryBP.systolic)
      if (primaryBP.diastolic) payload.bloodPressureDiastolic = parseInt(primaryBP.diastolic)

      if (form.heartRate)       payload.pulse            = parseInt(form.heartRate)
      if (form.respiratoryRate) payload.respiratoryRate  = parseInt(form.respiratoryRate)
      if (form.temperature)     payload.temperature      = parseFloat(form.temperature)
      if (form.oxygenSaturation)payload.oxygenSaturation = parseFloat(form.oxygenSaturation)
      if (form.weight)          payload.weight           = parseFloat(form.weight)
      if (form.height)          payload.height           = parseFloat(form.height)
      if (form.painScore)       payload.painScore        = parseInt(form.painScore)
      if (bmi)                  payload.bmi              = parseFloat(bmi)
      if (form.recordedAt)      payload.recordedAt       = new Date(form.recordedAt).toISOString()

      // Build enriched notes with all BP positions + O2 info
      const extraNotes = []
      // All 4 locations that have data
      Object.entries(bpData).forEach(([loc, bp]) => {
        if (bp.systolic && bp.diastolic) {
          extraNotes.push(`${loc.replace(/_/g, " ")} BP: ${bp.systolic}/${bp.diastolic} mmHg`)
        }
      })
      if (form.bpStandingSystolic && form.bpStandingDiastolic)
        extraNotes.push(`Standing BP: ${form.bpStandingSystolic}/${form.bpStandingDiastolic} mmHg`)
      if (form.bpSupineSystolic && form.bpSupineDiastolic)
        extraNotes.push(`Supine BP: ${form.bpSupineSystolic}/${form.bpSupineDiastolic} mmHg`)
      if (form.spo2OnOxygen)
        extraNotes.push(`SpO2 on O₂: ${form.oxygenLitresPerMin || "?"}L/min`)
      else
        extraNotes.push("SpO2: Room Air")
      if (form.gcsScore)    extraNotes.push(`GCS: ${form.gcsScore}`)
      if (form.urineOutput) extraNotes.push(`Urine Output: ${form.urineOutput}ml/hr`)
      if (form.bloodGlucose)extraNotes.push(`Blood Glucose: ${form.bloodGlucose}mmol/L`)

      const fullNotes = [
        ...extraNotes,
        form.notes ? `Notes: ${form.notes}` : ""
      ].filter(Boolean).join(" | ")

      if (fullNotes) payload.notes = fullNotes

      await api.post("/nursing/vitals", payload)
      toast.success("✅ Vitals saved to EMR successfully!")

      // Reset
      setBpData({ LEFT_ARM: emptyBP(), RIGHT_ARM: emptyBP(), LEFT_LEG: emptyBP(), RIGHT_LEG: emptyBP() })
      setForm({
        heartRate: "", temperature: "", oxygenSaturation: "", weight: "",
        height: "", bloodGlucose: "", painScore: "0", gcsScore: "",
        urineOutput: "", notes: "", respiratoryRate: "",
        bpStandingSystolic: "", bpStandingDiastolic: "",
        bpSupineSystolic: "", bpSupineDiastolic: "",
        spo2OnOxygen: false, oxygenLitresPerMin: "",
        recordedAt: nowLocal()
      })
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to record vitals")
    } finally {
      setSubmitting(false)
    }
  }

  // Alerts
  const bpAlert  = currentBP.systolic && (parseInt(currentBP.systolic) > 140 || parseInt(currentBP.systolic) < 90)
  const tempAlert = form.temperature    && (parseFloat(form.temperature) > 37.5 || parseFloat(form.temperature) < 35)
  const spo2Alert = form.oxygenSaturation && parseInt(form.oxygenSaturation) < 95
  const hrAlert   = form.heartRate      && (parseInt(form.heartRate) > 100 || parseInt(form.heartRate) < 60)
  const rrAlert   = form.respiratoryRate && (parseInt(form.respiratoryRate) > 20 || parseInt(form.respiratoryRate) < 12)

  const BP_LOCATIONS = [
    { value: "LEFT_ARM",  label: "Left Arm"  },
    { value: "RIGHT_ARM", label: "Right Arm" },
    { value: "LEFT_LEG",  label: "Left Leg"  },
    { value: "RIGHT_LEG", label: "Right Leg" }
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Patient selector */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Select Patient <span className="text-red-500">*</span>
        </label>
        <select
          value={selectedVisit}
          onChange={e => setSelectedVisit(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
        >
          <option value="">-- Select active patient --</option>
          {visits.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </div>

      {/* Timestamp */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <label className="block text-sm font-semibold text-blue-700 mb-2 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Vitals Recorded At
          <span className="text-xs font-normal text-blue-500">(adjustable — defaults to now)</span>
        </label>
        <input
          type="datetime-local"
          value={form.recordedAt}
          onChange={e => set("recordedAt", e.target.value)}
          className="w-full md:w-72 border border-blue-300 rounded-lg px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* Vital Signs */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Heart className="w-4 h-4 text-pink-600" /> Vital Signs
        </h3>

        {/* ── BLOOD PRESSURE — per-location memory ─────────────────────────── */}
        <div className={`border-2 rounded-xl p-5 mb-4 ${bpAlert ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Heart className="w-4 h-4 text-pink-600" /> Blood Pressure (mmHg)
              {bpAlert && <span className="text-red-500 text-xs bg-red-100 px-2 py-0.5 rounded-full">⚠ Alert</span>}
            </h4>
            {/* Location selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Site:</span>
              <div className="flex gap-1 flex-wrap">
                {BP_LOCATIONS.map(loc => (
                  <button
                    key={loc.value}
                    type="button"
                    onClick={() => setBpLocation(loc.value)}
                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors relative ${
                      bpLocation === loc.value
                        ? "bg-pink-600 text-white"
                        : "bg-white border border-gray-200 text-gray-600 hover:border-pink-300"
                    }`}
                  >
                    {loc.label}
                    {/* Dot indicator if this location has data */}
                    {bpData[loc.value].systolic && loc.value !== bpLocation && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Show data summary for other locations */}
          {Object.entries(bpData).some(([loc, bp]) => loc !== bpLocation && bp.systolic) && (
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(bpData).map(([loc, bp]) =>
                loc !== bpLocation && bp.systolic ? (
                  <span key={loc} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    {loc.replace(/_/g, " ")}: {bp.systolic}/{bp.diastolic}
                  </span>
                ) : null
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Primary BP for selected location */}
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <label className="block text-xs font-semibold text-gray-500 mb-2">
                🪑 Sitting BP — {BP_LOCATIONS.find(l => l.value === bpLocation)?.label}
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={currentBP.systolic}
                  onChange={e => setBP("systolic", e.target.value)}
                  placeholder="Sys"
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
                <span className="text-gray-400 font-bold">/</span>
                <input
                  type="number"
                  value={currentBP.diastolic}
                  onChange={e => setBP("diastolic", e.target.value)}
                  placeholder="Dia"
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Primary reading</p>
            </div>

            {/* Standing BP */}
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <label className="block text-xs font-semibold text-gray-500 mb-2">🧍 Standing BP</label>
              <div className="flex items-center gap-1">
                <input type="number" value={form.bpStandingSystolic}
                  onChange={e => set("bpStandingSystolic", e.target.value)}
                  placeholder="Sys"
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
                <span className="text-gray-400 font-bold">/</span>
                <input type="number" value={form.bpStandingDiastolic}
                  onChange={e => set("bpStandingDiastolic", e.target.value)}
                  placeholder="Dia"
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Orthostatic check</p>
            </div>

            {/* Supine BP */}
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <label className="block text-xs font-semibold text-gray-500 mb-2">🛏 Lying Supine BP</label>
              <div className="flex items-center gap-1">
                <input type="number" value={form.bpSupineSystolic}
                  onChange={e => set("bpSupineSystolic", e.target.value)}
                  placeholder="Sys"
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
                <span className="text-gray-400 font-bold">/</span>
                <input type="number" value={form.bpSupineDiastolic}
                  onChange={e => set("bpSupineDiastolic", e.target.value)}
                  placeholder="Dia"
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Lying flat</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">Normal: 90-120 / 60-80 mmHg</p>
        </div>

        {/* Other vitals grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">

          {/* Heart Rate */}
          <div className={`border rounded-xl p-4 ${hrAlert ? "border-red-300 bg-red-50" : "border-gray-200"}`}>
            <label className="block text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
              <Activity className="w-3 h-3" /> Heart Rate (bpm)
              {hrAlert && <span className="text-red-500 text-xs ml-1">⚠</span>}
            </label>
            <input type="number" value={form.heartRate}
              onChange={e => set("heartRate", e.target.value)} placeholder="e.g. 72"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <p className="text-xs text-gray-400 mt-1">Normal: 60-100 bpm</p>
          </div>

          {/* Temperature */}
          <div className={`border rounded-xl p-4 ${tempAlert ? "border-orange-300 bg-orange-50" : "border-gray-200"}`}>
            <label className="block text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
              <Thermometer className="w-3 h-3" /> Temperature (°C)
              {tempAlert && <span className="text-orange-500 text-xs ml-1">⚠</span>}
            </label>
            <input type="number" step="0.1" value={form.temperature}
              onChange={e => set("temperature", e.target.value)} placeholder="e.g. 36.5"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <p className="text-xs text-gray-400 mt-1">Normal: 36.1-37.2°C</p>
          </div>

          {/* SpO2 */}
          <div className={`border rounded-xl p-4 col-span-2 md:col-span-1 ${spo2Alert ? "border-red-300 bg-red-50" : "border-gray-200"}`}>
            <label className="block text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
              <Wind className="w-3 h-3" /> SpO₂ (%)
              {spo2Alert && <span className="text-red-500 text-xs ml-1">⚠ LOW</span>}
            </label>
            <input type="number" value={form.oxygenSaturation}
              onChange={e => set("oxygenSaturation", e.target.value)}
              placeholder="e.g. 98" min="0" max="100"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 mb-2"
            />
            <div className="flex items-center gap-2 mt-1">
              <button type="button" onClick={() => set("spo2OnOxygen", false)}
                className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${
                  !form.spo2OnOxygen ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >🌬 Room Air</button>
              <button type="button" onClick={() => set("spo2OnOxygen", true)}
                className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${
                  form.spo2OnOxygen ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >🫁 On O₂</button>
            </div>
            {form.spo2OnOxygen && (
              <input type="number" step="0.5" value={form.oxygenLitresPerMin}
                onChange={e => set("oxygenLitresPerMin", e.target.value)}
                placeholder="O₂ flow (L/min)"
                className="mt-2 w-full border border-blue-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-blue-50"
              />
            )}
            <p className="text-xs text-gray-400 mt-1">Normal: ≥ 95%</p>
          </div>

          {/* Respiration */}
          <div className={`border rounded-xl p-4 ${rrAlert ? "border-orange-300 bg-orange-50" : "border-gray-200"}`}>
            <label className="block text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
              <Wind className="w-3 h-3" /> Respiration (cpm)
              {rrAlert && <span className="text-orange-500 text-xs ml-1">⚠</span>}
            </label>
            <input type="number" value={form.respiratoryRate}
              onChange={e => set("respiratoryRate", e.target.value)} placeholder="e.g. 16"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <p className="text-xs text-gray-400 mt-1">Normal: 12-20 cpm</p>
          </div>

          {/* Blood Glucose */}
          <div className="border border-gray-200 rounded-xl p-4">
            <label className="block text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
              <Droplets className="w-3 h-3" /> Blood Glucose (mmol/L)
            </label>
            <input type="number" step="0.1" value={form.bloodGlucose}
              onChange={e => set("bloodGlucose", e.target.value)} placeholder="e.g. 5.5"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <p className="text-xs text-gray-400 mt-1">Fasting: 3.9-5.5</p>
          </div>

          {/* Weight */}
          <div className="border border-gray-200 rounded-xl p-4">
            <label className="block text-xs font-semibold text-gray-500 mb-2">Weight (kg)</label>
            <input type="number" step="0.1" value={form.weight}
              onChange={e => set("weight", e.target.value)} placeholder="e.g. 70"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          {/* Height */}
          <div className="border border-gray-200 rounded-xl p-4">
            <label className="block text-xs font-semibold text-gray-500 mb-2">Height (cm)</label>
            <input type="number" value={form.height}
              onChange={e => set("height", e.target.value)} placeholder="e.g. 170"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          {/* BMI */}
          <div className={`border-2 rounded-xl p-4 ${bmi ? "border-pink-200 bg-pink-50" : "border-gray-200"}`}>
            <label className="block text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> BMI (auto-calculated)
            </label>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-2xl font-bold ${bmi ? "text-pink-700" : "text-gray-300"}`}>{bmi || "—"}</span>
              {bmi && bmiCategory(bmi) && (
                <span className={`text-xs font-semibold ${bmiCategory(bmi).color}`}>{bmiCategory(bmi).label}</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">{bmi ? `${form.weight}kg / ${form.height}cm` : "Enter weight + height"}</p>
          </div>

          {/* GCS */}
          <div className="border border-gray-200 rounded-xl p-4">
            <label className="block text-xs font-semibold text-gray-500 mb-2">GCS Score (3-15)</label>
            <input type="number" value={form.gcsScore}
              onChange={e => set("gcsScore", e.target.value)}
              placeholder="e.g. 15" min="3" max="15"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <p className="text-xs text-gray-400 mt-1">Normal: 15</p>
          </div>

          {/* Urine Output */}
          <div className="border border-gray-200 rounded-xl p-4">
            <label className="block text-xs font-semibold text-gray-500 mb-2">Urine Output (ml/hr)</label>
            <input type="number" value={form.urineOutput}
              onChange={e => set("urineOutput", e.target.value)} placeholder="e.g. 50"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <p className="text-xs text-gray-400 mt-1">Normal: ≥ 0.5 ml/kg/hr</p>
          </div>
        </div>
      </div>

      {/* Pain Score */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Pain Score:{" "}
          <span className={`font-bold ${parseInt(form.painScore) >= 7 ? "text-red-600" : parseInt(form.painScore) >= 4 ? "text-orange-600" : "text-green-600"}`}>
            {form.painScore}/10
          </span>
        </label>
        <input type="range" min="0" max="10" value={form.painScore}
          onChange={e => set("painScore", e.target.value)} className="w-full accent-pink-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>0 - No Pain</span><span>5 - Moderate</span><span>10 - Worst</span>
        </div>
        <div className="flex justify-between mt-1">
          {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
            <div key={n} className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-medium ${
              parseInt(form.painScore) === n ? "bg-pink-600 text-white" : "bg-gray-100 text-gray-500"
            }`}>{n}</div>
          ))}
        </div>
      </div>

      {/* Clinical Notes */}
      <ClinicalNotesSection notes={form.notes} onChange={val => set("notes", val)} />

      {/* Critical Alerts */}
      {(bpAlert || tempAlert || spo2Alert || hrAlert || rrAlert) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700 font-semibold text-sm flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4" /> Critical Values Detected — Notify Doctor
          </p>
          <div className="flex flex-wrap gap-2">
            {bpAlert   && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">BP: {currentBP.systolic}/{currentBP.diastolic} mmHg</span>}
            {hrAlert   && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">HR: {form.heartRate} bpm</span>}
            {tempAlert && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">Temp: {form.temperature}°C</span>}
            {spo2Alert && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">SpO₂: {form.oxygenSaturation}%</span>}
            {rrAlert   && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">RR: {form.respiratoryRate} cpm</span>}
          </div>
        </div>
      )}

      <button type="submit" disabled={submitting || !selectedVisit}
        className="w-full bg-pink-600 text-white py-3 rounded-xl font-semibold hover:bg-pink-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
      >
        <Save className="w-5 h-5" />
        {submitting ? "Saving to EMR..." : "Save Vital Signs to EMR"}
      </button>
    </form>
  )
}

// ── Clinical Notes Section ────────────────────────────────────────────────────
function ClinicalNotesSection({ notes, onChange }) {
  const DEFAULT_SECTIONS = [
    { id: 1, title: "General Observations",   content: "" },
    { id: 2, title: "Patient Complaints",      content: "" },
    { id: 3, title: "Interventions Performed", content: "" },
    { id: 4, title: "Patient Response",        content: "" },
    { id: 5, title: "Communication with Team", content: "" }
  ]

  const [sections,      setSections]      = useState(DEFAULT_SECTIONS)
  const [editingId,     setEditingId]     = useState(null)
  const [editTitle,     setEditTitle]     = useState("")
  const [collapsed,     setCollapsed]     = useState({})
  const [useStructured, setUseStructured] = useState(true)

  useEffect(() => {
    if (!useStructured) return
    const combined = sections
      .filter(s => s.content.trim())
      .map(s => `[${s.title}]\n${s.content}`)
      .join("\n\n")
    onChange(combined)
  }, [sections, useStructured])

  const updateSection = (id, field, value) =>
    setSections(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))

  const saveTitle = (id) => {
    if (editTitle.trim()) updateSection(id, "title", editTitle.trim())
    setEditingId(null)
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileEdit className="w-5 h-5 text-pink-600" />
          <span className="text-sm font-bold text-gray-700">Clinical Documentation</span>
          <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
            {sections.filter(s => s.content.trim()).length}/{sections.length} filled
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setUseStructured(v => !v)}
            className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
          >
            {useStructured ? "📝 Free Text" : "📋 Structured"}
          </button>
          {useStructured && (
            <button type="button"
              onClick={() => { const id = Date.now(); setSections(p => [...p, { id, title: "New Section", content: "" }]); setEditingId(id); setEditTitle("New Section") }}
              className="text-xs px-3 py-1 rounded-lg bg-pink-600 text-white hover:bg-pink-700 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add Section
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {useStructured ? (
          sections.map((section, idx) => (
            <div key={section.id} className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between bg-gray-50 px-3 py-2 border-b border-gray-200">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs font-bold text-pink-600 bg-pink-50 w-5 h-5 rounded-full flex items-center justify-center">
                    {idx + 1}
                  </span>
                  {editingId === section.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input autoFocus value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onBlur={() => saveTitle(section.id)}
                        onKeyDown={e => e.key === "Enter" && saveTitle(section.id)}
                        className="flex-1 border border-pink-300 rounded-lg px-2 py-0.5 text-sm font-semibold focus:outline-none"
                      />
                      <button type="button" onClick={() => saveTitle(section.id)} className="text-xs text-pink-600 font-medium">Save</button>
                    </div>
                  ) : (
                    <span className="text-sm font-semibold text-gray-700 flex-1">{section.title}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => { setEditingId(section.id); setEditTitle(section.title) }}
                    className="p-1 text-gray-400 hover:text-pink-600 rounded">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => setCollapsed(p => ({ ...p, [section.id]: !p[section.id] }))}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded">
                    {collapsed[section.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                  </button>
                  {sections.length > 1 && (
                    <button type="button" onClick={() => setSections(p => p.filter(s => s.id !== section.id))}
                      className="p-1 text-gray-400 hover:text-red-500 rounded">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {!collapsed[section.id] && (
                <textarea value={section.content}
                  onChange={e => updateSection(section.id, "content", e.target.value)}
                  placeholder={`Enter ${section.title.toLowerCase()}...`}
                  rows={3}
                  className="w-full px-4 py-3 text-sm text-gray-700 focus:outline-none focus:bg-pink-50 resize-none"
                />
              )}
            </div>
          ))
        ) : (
          <textarea value={notes} onChange={e => onChange(e.target.value)}
            placeholder="Any observations, patient complaints, changes in condition..."
            rows={6}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        )}
      </div>
    </div>
  )
}

// ── Shift Management ──────────────────────────────────────────────────────────
function ShiftManagement({ activeShift, currentUser, onShiftChange }) {
  const [onDutyStaff,  setOnDutyStaff]  = useState([])
  const [admissions,   setAdmissions]   = useState([])
  const [loading,      setLoading]      = useState(false)
  const [clockingIn,   setClockingIn]   = useState(false)
  const [clockingOut,  setClockingOut]  = useState(false)
  const [ward,         setWard]         = useState("")
  const [notes,        setNotes]        = useState("")
  const [assignModal,  setAssignModal]  = useState(false)
  const [assignForm,   setAssignForm]   = useState({ nurseId: "", admissionId: "", shiftId: "", notes: "" })
  const [assigning,    setAssigning]    = useState(false)
  const [myPatients,   setMyPatients]   = useState([])

  const shiftInfo = activeShift ? SHIFT_INFO[activeShift.shiftType] : SHIFT_INFO[getCurrentShiftType()]

  useEffect(() => {
    fetchOnDutyStaff()
    fetchAdmissions()
    if (activeShift) fetchMyPatients()
  }, [activeShift])

  const fetchOnDutyStaff = async () => {
    try {
      const res = await api.get("/nursing/staff/on-duty")
      setOnDutyStaff(res.data?.data?.activeShifts || [])
    } catch (e) { setOnDutyStaff([]) }
  }

  const fetchAdmissions = async () => {
    try {
      const res     = await api.get("/nursing/queue")
      const payload = res.data?.data
      const list    = extractArray(payload, "admissions", "activeAdmissions", "queue")
      setAdmissions(list)
    } catch (e) { setAdmissions([]) }
  }

  const fetchMyPatients = async () => {
    try {
      const res = await api.get("/nursing/shift/my-patients")
      setMyPatients(res.data?.data?.patients || [])
    } catch (e) { setMyPatients([]) }
  }

  const handleClockIn = async () => {
    setClockingIn(true)
    try {
      await api.post("/nursing/shift/clockin", { ward, notes })
      toast.success(`✅ Clocked in for ${shiftInfo?.label}`)
      setNotes("")
      onShiftChange()
      fetchOnDutyStaff()
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to clock in")
    } finally {
      setClockingIn(false)
    }
  }

  const handleClockOut = async () => {
    if (!confirm("Are you sure you want to clock out? All patient assignments will be deactivated.")) return
    setClockingOut(true)
    try {
      await api.post("/nursing/shift/clockout", { notes })
      toast.success("✅ Clocked out successfully")
      onShiftChange()
      fetchOnDutyStaff()
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to clock out")
    } finally {
      setClockingOut(false)
    }
  }

  const handleAssign = async () => {
    if (!assignForm.nurseId || !assignForm.admissionId) {
      toast.error("Select nurse and patient")
      return
    }
    setAssigning(true)
    try {
      await api.post("/nursing/shift/assign", {
        shiftId:     assignForm.shiftId,
        nurseId:     assignForm.nurseId,
        admissionId: assignForm.admissionId,
        notes:       assignForm.notes
      })
      toast.success("✅ Nurse assigned to patient")
      setAssignModal(false)
      setAssignForm({ nurseId: "", admissionId: "", shiftId: "", notes: "" })
      fetchOnDutyStaff()
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to assign nurse")
    } finally {
      setAssigning(false)
    }
  }

  const isNIC = currentUser?.isNurseInCharge ||
    ["SUPER_ADMIN","HOSPITAL_ADMIN","CLINICAL_COORDINATOR","MEDICAL_DIRECTOR"].includes(currentUser?.role)

  return (
    <div className="space-y-6">

      {/* Current Shift Status */}
      <div className={`rounded-xl p-5 border-2 ${
        activeShift
          ? "bg-green-50 border-green-300"
          : "bg-gray-50 border-gray-200"
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">{shiftInfo?.icon}</span>
              <div>
                <h3 className="font-bold text-gray-800 text-lg">{shiftInfo?.label}</h3>
                <p className="text-sm text-gray-500">{shiftInfo?.time}</p>
              </div>
            </div>
            {activeShift ? (
              <div className="mt-2 space-y-1">
                <p className="text-sm text-green-700 font-semibold flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  On Duty since {new Date(activeShift.clockedInAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                </p>
                {activeShift.ward && (
                  <p className="text-xs text-gray-500">Ward: <span className="font-medium">{activeShift.ward}</span></p>
                )}
                {currentUser?.isNurseInCharge && (
                  <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-semibold">
                    <Star className="w-3 h-3" /> Nurse In Charge
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mt-1">You are not currently clocked in</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {!activeShift ? (
              <>
                <input
                  value={ward}
                  onChange={e => setWard(e.target.value)}
                  placeholder="Ward/Unit (optional)"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                <button
                  onClick={handleClockIn}
                  disabled={clockingIn}
                  className="flex items-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  {clockingIn ? "Clocking In..." : `Clock In — ${shiftInfo?.label}`}
                </button>
              </>
            ) : (
              <button
                onClick={handleClockOut}
                disabled={clockingOut}
                className="flex items-center gap-2 bg-red-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                {clockingOut ? "Clocking Out..." : "Clock Out"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* My Patients (when clocked in) */}
      {activeShift && (
        <div>
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-pink-600" /> My Assigned Patients ({myPatients.length})
          </h3>
          {myPatients.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200">
              <Users className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No patients assigned to you yet</p>
              {isNIC && <p className="text-xs text-gray-400 mt-1">Use the assignment panel below to assign patients</p>}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myPatients.map(admission => {
                const vital = admission.visit?.vitalSigns?.[0]
                return (
                  <div key={admission.id} className="border border-gray-200 rounded-xl p-4 bg-white">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-pink-100 flex items-center justify-center text-pink-700 font-bold text-sm flex-shrink-0">
                        {admission.patient?.firstName?.[0]}{admission.patient?.lastName?.[0]}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800 text-sm">
                          {admission.patient?.firstName} {admission.patient?.lastName}
                        </p>
                        <p className="text-xs text-gray-400">{admission.patient?.mrn} • Bed {admission.bed?.bedNumber}</p>
                        {vital ? (
                          <div className="flex gap-2 mt-1 flex-wrap">
                            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                              BP: {vital.bloodPressureSystolic}/{vital.bloodPressureDiastolic}
                            </span>
                            {vital.pulse && <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">HR: {vital.pulse}</span>}
                            {vital.temperature && <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">T: {vital.temperature}°C</span>}
                          </div>
                        ) : (
                          <span className="text-xs text-orange-600 mt-1 inline-block">⚠ No vitals recorded</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* NIC Assignment Panel */}
      {isNIC && activeShift && (
        <div className="border border-yellow-200 bg-yellow-50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Shield className="w-4 h-4 text-yellow-600" /> Nurse In Charge — Patient Assignment
            </h3>
            <button
              onClick={() => { setAssignModal(true); setAssignForm({ nurseId: "", admissionId: "", shiftId: "", notes: "" }) }}
              className="flex items-center gap-2 bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-700"
            >
              <Plus className="w-4 h-4" /> Assign Nurse
            </button>
          </div>

          {/* On-duty nurses */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">ON-DUTY NURSES ({onDutyStaff.length})</p>
            {onDutyStaff.length === 0 ? (
              <p className="text-sm text-gray-400">No nurses clocked in yet</p>
            ) : (
              <div className="space-y-2">
                {onDutyStaff.map(shift => (
                  <div key={shift.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-xs">
                        {shift.nurse?.firstName?.[0]}{shift.nurse?.lastName?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {shift.nurse?.firstName} {shift.nurse?.lastName}
                          {shift.nurse?.isNurseInCharge && (
                            <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">NIC</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">
                          {shift.shiftType} • Clocked in {new Date(shift.clockedInAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                          {shift.ward && ` • ${shift.ward}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-blue-600">
                        {shift.assignments?.length || 0} patient(s)
                      </p>
                      {shift.assignments?.length > 0 && (
                        <div className="flex flex-col gap-0.5 mt-1">
                          {shift.assignments.slice(0, 2).map(a => (
                            <p key={a.id} className="text-xs text-gray-400">
                              {a.admission?.patient?.firstName} • Bed {a.admission?.bed?.bedNumber}
                            </p>
                          ))}
                          {shift.assignments.length > 2 && (
                            <p className="text-xs text-gray-400">+{shift.assignments.length - 2} more</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Non-NIC info */}
      {!isNIC && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-blue-700 text-sm flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Patient assignment is managed by the Nurse In Charge. Your assigned patients appear above.
          </p>
        </div>
      )}

      {/* Assignment Modal */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Assign Nurse to Patient</h3>
              <button onClick={() => setAssignModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Select nurse */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Select Nurse <span className="text-red-500">*</span>
                </label>
                <select
                  value={assignForm.nurseId}
                  onChange={e => {
                    const shift = onDutyStaff.find(s => s.nurseId === e.target.value || s.nurse?.id === e.target.value)
                    setAssignForm(f => ({ ...f, nurseId: e.target.value, shiftId: shift?.id || "" }))
                  }}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="">-- Select on-duty nurse --</option>
                  {onDutyStaff.map(s => (
                    <option key={s.id} value={s.nurse?.id}>
                      {s.nurse?.firstName} {s.nurse?.lastName} — {s.shiftType} ({s.assignments?.length || 0} patients)
                    </option>
                  ))}
                </select>
              </div>

              {/* Select patient */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Select Patient <span className="text-red-500">*</span>
                </label>
                <select
                  value={assignForm.admissionId}
                  onChange={e => setAssignForm(f => ({ ...f, admissionId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="">-- Select admitted patient --</option>
                  {admissions.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.patient?.firstName} {a.patient?.lastName} — Bed {a.bed?.bedNumber}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes (optional)</label>
                <textarea
                  value={assignForm.notes}
                  onChange={e => setAssignForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Special instructions, care priorities..."
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button onClick={() => setAssignModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleAssign} disabled={assigning || !assignForm.nurseId || !assignForm.admissionId}
                  className="flex-1 py-2.5 bg-pink-600 text-white rounded-xl text-sm font-semibold hover:bg-pink-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {assigning ? <><RefreshCw className="w-4 h-4 animate-spin" /> Assigning...</> : <><UserCheck className="w-4 h-4" /> Assign</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Medication Administration ──────────────────────────────────────────────────
function MedicationAdmin() {
  const [admissions,  setAdmissions]  = useState([])
  const [records,     setRecords]     = useState([])
  const [showModal,   setShowModal]   = useState(false)
  const [selectedAdm, setSelectedAdm] = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [form, setForm] = useState({ admissionId: "", drugName: "", dose: "", route: "ORAL", administeredAt: "", notes: "" })
  const [submitting, setSubmitting]   = useState(false)

  useEffect(() => { fetchAdmissions() }, [])

  const fetchAdmissions = async () => {
    setLoading(true)
    try {
      const res     = await api.get("/nursing/queue")
      const payload = res.data?.data
      const list    = extractArray(payload, "activeAdmissions", "admissions", "queue")
      setAdmissions(list)
      if (list.length > 0) { fetchRecords(list[0].id); setSelectedAdm(list[0]) }
    } catch (e) {
      setAdmissions([])
    } finally {
      setLoading(false)
    }
  }

  const fetchRecords = async (admissionId) => {
    if (!admissionId) return
    try {
      const res  = await api.get(`/nursing/medication-admin/${admissionId}`)
      const data = res.data?.data
      setRecords(Array.isArray(data) ? data : [])
    } catch (e) { setRecords([]) }
  }

  const handleAdmissionChange = (admId) => {
    const adm = admissions.find(a => a.id === admId)
    setSelectedAdm(adm || null)
    setForm(f => ({ ...f, admissionId: admId }))
    fetchRecords(admId)
  }

  const openModal = () => {
    setForm({ admissionId: selectedAdm?.id || "", drugName: "", dose: "", route: "ORAL",
      administeredAt: new Date().toISOString().slice(0, 16), notes: "" })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.admissionId) return toast.error("Select a patient")
    if (!form.drugName.trim()) return toast.error("Enter drug name")
    if (!form.dose.trim()) return toast.error("Enter dose")
    setSubmitting(true)
    try {
      await api.post("/nursing/medication-admin", {
        admissionId: form.admissionId, drugName: form.drugName,
        dose: form.dose, route: form.route,
        administeredAt: form.administeredAt || new Date().toISOString(), notes: form.notes
      })
      toast.success("Medication administration recorded!")
      setShowModal(false)
      fetchRecords(form.admissionId)
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to record medication")
    } finally {
      setSubmitting(false)
    }
  }

  const ROUTES = ["ORAL","IV","IM","SC","SL","TOPICAL","INHALATION","RECTAL","NASAL"]
  const ROUTE_COLOR = {
    ORAL: "bg-blue-100 text-blue-700", IV: "bg-red-100 text-red-700",
    IM: "bg-orange-100 text-orange-700", SC: "bg-yellow-100 text-yellow-700",
    SL: "bg-purple-100 text-purple-700", TOPICAL: "bg-green-100 text-green-700",
    INHALATION: "bg-cyan-100 text-cyan-700", RECTAL: "bg-gray-100 text-gray-700",
    NASAL: "bg-pink-100 text-pink-700"
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700">Medication Administration Record (MAR)</h3>
        <button onClick={openModal}
          className="flex items-center gap-2 bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pink-700">
          <Plus className="w-4 h-4" /> Record Administration
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-blue-700 text-sm font-medium mb-3">📋 5 Rights of Medication Administration</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {["Right Patient","Right Drug","Right Dose","Right Route","Right Time"].map(r => (
            <div key={r} className="bg-white rounded-lg p-2 text-center border border-blue-100">
              <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto mb-1" />
              <p className="text-xs font-medium text-gray-700">{r}</p>
            </div>
          ))}
        </div>
      </div>

      {admissions.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Select Patient to View MAR</label>
          <select value={selectedAdm?.id || ""} onChange={e => handleAdmissionChange(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500">
            <option value="">-- Select admitted patient --</option>
            {admissions.map(a => (
              <option key={a.id} value={a.id}>{a.patient?.firstName} {a.patient?.lastName} — Bed {a.bed?.bedNumber}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-24"><RefreshCw className="w-5 h-5 animate-spin text-pink-500" /></div>
      ) : records.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-600">Administration Records ({records.length})</p>
          <div className="max-h-72 overflow-y-auto space-y-2">
            {records.map(r => (
              <div key={r.id} className="border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-pink-100 rounded-lg flex items-center justify-center shrink-0">
                    <Syringe className="w-4 h-4 text-pink-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{r.drugName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Dose: <span className="font-medium">{r.dose}</span></p>
                    {r.notes && <p className="text-xs text-gray-400 mt-0.5">{r.notes}</p>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROUTE_COLOR[r.route] || "bg-gray-100 text-gray-600"}`}>{r.route}</span>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1 justify-end">
                    <Clock className="w-3 h-3" />
                    {new Date(r.administeredAt).toLocaleString("en-KE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-10 text-gray-400">
          <Syringe className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="font-medium text-sm">No administration records yet</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-800">Record Medication Administration</h3>
                <p className="text-xs text-gray-500 mt-0.5">Confirm all 5 rights before recording</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Patient <span className="text-red-500">*</span></label>
                <select value={form.admissionId} onChange={e => setForm(f => ({ ...f, admissionId: e.target.value }))} required
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500">
                  <option value="">-- Select patient --</option>
                  {admissions.map(a => (
                    <option key={a.id} value={a.id}>{a.patient?.firstName} {a.patient?.lastName} — Bed {a.bed?.bedNumber}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Drug Name <span className="text-red-500">*</span></label>
                <input type="text" value={form.drugName} onChange={e => setForm(f => ({ ...f, drugName: e.target.value }))}
                  placeholder="e.g. Paracetamol 500mg" required
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Dose <span className="text-red-500">*</span></label>
                <input type="text" value={form.dose} onChange={e => setForm(f => ({ ...f, dose: e.target.value }))}
                  placeholder="e.g. 1 tablet, 500mg, 10ml" required
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Route <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-2">
                  {ROUTES.map(r => (
                    <button key={r} type="button" onClick={() => setForm(f => ({ ...f, route: r }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        form.route === r ? "bg-pink-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}>{r}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date & Time Administered</label>
                <input type="datetime-local" value={form.administeredAt}
                  onChange={e => setForm(f => ({ ...f, administeredAt: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes <span className="text-gray-400 text-xs">(optional)</span></label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Patient response, observations..." rows={2}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2.5 bg-pink-600 text-white rounded-xl text-sm font-semibold hover:bg-pink-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Record</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Nursing Notes ─────────────────────────────────────────────────────────────
function NursingNotes() {
  const [visits,        setVisits]        = useState([])
  const [selectedVisit, setSelectedVisit] = useState("")
  const [notes,         setNotes]         = useState([])
  const [form,  setForm]  = useState({ noteType: "GENERAL", content: "", priority: "ROUTINE" })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { fetchVisits() }, [])
  useEffect(() => { if (selectedVisit) fetchNotes() }, [selectedVisit])

  const fetchVisits = async () => {
    try {
      const res        = await api.get("/nursing/queue")
      const payload    = res.data?.data
      const admissions = extractArray(payload, "admissions", "activeAdmissions", "queue", "visits")
      setVisits(
        admissions.map(a => ({
          id:    a.visit?.id,
          label: `${a.patient?.firstName} ${a.patient?.lastName} — Bed ${a.bed?.bedNumber}`
        })).filter(v => v.id)
      )
    } catch (e) { console.error("fetchVisits error:", e) }
  }

  const fetchNotes = async () => {
    try {
      const res  = await api.get(`/nursing/notes/${selectedVisit}`)
      const data = res.data?.data
      setNotes(Array.isArray(data) ? data : [])
    } catch (e) { console.error("fetchNotes error:", e) }
  }

  const submit = async () => {
    if (!selectedVisit || !form.content.trim()) { toast.error("Select patient and enter note"); return }
    setSubmitting(true)
    try {
      await api.post("/nursing/notes", { visitId: selectedVisit, ...form })
      toast.success("Nursing note saved!")
      setForm({ noteType: "GENERAL", content: "", priority: "ROUTINE" })
      fetchNotes()
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to save note")
    } finally {
      setSubmitting(false)
    }
  }

  const NOTE_TYPES  = ["GENERAL","ASSESSMENT","MEDICATION","PROCEDURE","HANDOVER","INCIDENT","DISCHARGE_PLANNING"]
  const NOTE_COLORS = {
    GENERAL: "bg-gray-100 text-gray-700", ASSESSMENT: "bg-blue-100 text-blue-700",
    MEDICATION: "bg-green-100 text-green-700", PROCEDURE: "bg-purple-100 text-purple-700",
    HANDOVER: "bg-orange-100 text-orange-700", INCIDENT: "bg-red-100 text-red-700",
    DISCHARGE_PLANNING: "bg-teal-100 text-teal-700"
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Patient</label>
          <select value={selectedVisit} onChange={e => setSelectedVisit(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500">
            <option value="">Select patient...</option>
            {visits.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Note Type</label>
          <select value={form.noteType} onChange={e => setForm(p => ({ ...p, noteType: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500">
            {NOTE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Note Content <span className="text-red-500">*</span>
        </label>
        <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
          placeholder={`Enter ${form.noteType.replace(/_/g, " ").toLowerCase()} note...`}
          rows={6}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
        />
      </div>

      <div className="flex items-center gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
          <div className="flex gap-2">
            {["ROUTINE","URGENT","CRITICAL"].map(p => (
              <button key={p} type="button" onClick={() => setForm(prev => ({ ...prev, priority: p }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  form.priority === p
                    ? p === "CRITICAL" ? "bg-red-600 text-white" : p === "URGENT" ? "bg-orange-500 text-white" : "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>{p}</button>
            ))}
          </div>
        </div>
        <button type="button" onClick={submit}
          disabled={submitting || !selectedVisit || !form.content.trim()}
          className="ml-auto flex items-center gap-2 bg-pink-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-pink-700 disabled:opacity-50">
          <Save className="w-4 h-4" />
          {submitting ? "Saving..." : "Save Note"}
        </button>
      </div>

      {notes.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-700 mb-3">Previous Notes</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {notes.map(note => (
              <div key={note.id} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${NOTE_COLORS[note.noteType] || "bg-gray-100 text-gray-700"}`}>
                      {note.noteType?.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {new Date(note.createdAt).toLocaleString()}
                  </div>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-line">{note.note || note.content}</p>
                <p className="text-xs text-gray-400 mt-2">
                  — {note.nurse?.firstName || note.author?.firstName} {note.nurse?.lastName || note.author?.lastName}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Bed Management ────────────────────────────────────────────────────────────
function BedManagement() {
  const [beds,    setBeds]    = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState("ALL")

  useEffect(() => { fetchBeds() }, [])

  const fetchBeds = async () => {
    setLoading(true)
    try {
      const res     = await api.get("/nursing/beds")
      const payload = res.data?.data
      const list    = extractArray(payload, "beds")
      setBeds(list)
    } catch (e) {
      setBeds([])
    } finally {
      setLoading(false)
    }
  }

  const STATUS_COLOR = {
    AVAILABLE:   "bg-green-100 border-green-300 text-green-700",
    OCCUPIED:    "bg-blue-100 border-blue-300 text-blue-700",
    RESERVED:    "bg-yellow-100 border-yellow-300 text-yellow-700",
    CLEANING:    "bg-orange-100 border-orange-300 text-orange-700",
    MAINTENANCE: "bg-red-100 border-red-300 text-red-700",
    ISOLATION:   "bg-purple-100 border-purple-300 text-purple-700"
  }

  const wards    = [...new Set(beds.map(b => b.room?.ward?.name).filter(Boolean))]
  const filtered = filter === "ALL" ? beds : beds.filter(b => b.status === filter)
  const stats    = {
    total:       beds.length,
    available:   beds.filter(b => b.status === "AVAILABLE").length,
    occupied:    beds.filter(b => b.status === "OCCUPIED").length,
    reserved:    beds.filter(b => b.status === "RESERVED").length,
    maintenance: beds.filter(b => ["CLEANING","MAINTENANCE"].includes(b.status)).length
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Beds",  value: stats.total,       color: "gray"   },
          { label: "Available",   value: stats.available,   color: "green"  },
          { label: "Occupied",    value: stats.occupied,    color: "blue"   },
          { label: "Reserved",    value: stats.reserved,    color: "yellow" },
          { label: "Maintenance", value: stats.maintenance, color: "red"    }
        ].map(s => (
          <div key={s.label} className={`bg-${s.color}-50 border border-${s.color}-200 rounded-xl p-3 text-center`}>
            <p className={`text-2xl font-bold text-${s.color}-700`}>{s.value}</p>
            <p className={`text-xs text-${s.color}-600 font-medium`}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-700">Overall Occupancy</p>
          <p className="text-sm font-bold text-gray-800">
            {stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0}%
          </p>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div className="bg-blue-600 h-3 rounded-full transition-all"
            style={{ width: stats.total > 0 ? `${(stats.occupied / stats.total) * 100}%` : "0%" }} />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{stats.occupied} occupied</span>
          <span>{stats.available} available</span>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["ALL","AVAILABLE","OCCUPIED","RESERVED","CLEANING","MAINTENANCE","ISOLATION"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f ? "bg-pink-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>
            {f} {f === "ALL" ? `(${beds.length})` : `(${beds.filter(b => b.status === f).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
          {[...Array(16)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <BedDouble className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">No beds match current filter</p>
        </div>
      ) : (
        wards.map(ward => {
          const wardBeds = filtered.filter(b => b.room?.ward?.name === ward)
          if (!wardBeds.length) return null
          return (
            <div key={ward}>
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <BedDouble className="w-4 h-4 text-pink-600" /> {ward}
                <span className="text-xs text-gray-400">({wardBeds.length} beds)</span>
              </h3>
              <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {wardBeds.map(bed => (
                  <div key={bed.id}
                    className={`border-2 rounded-xl p-3 text-center cursor-pointer hover:shadow-md transition-shadow ${STATUS_COLOR[bed.status] || "bg-gray-100 border-gray-300"}`}>
                    <BedDouble className="w-6 h-6 mx-auto mb-1" />
                    <p className="text-xs font-bold">{bed.bedNumber?.split("-").pop()}</p>
                    <p className="text-xs font-medium mt-0.5">
                      {bed.status === "OCCUPIED" ? bed.admissions?.[0]?.patient?.firstName?.slice(0, 8) || "Occupied" : bed.status}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ── Nursing AI ────────────────────────────────────────────────────────────────
function NursingAI({ onClose }) {
  const [messages, setMessages] = useState([{
    role: "assistant",
    text: "Hello Nurse! I can help with:\n• Normal vital sign ranges\n• Medication administration guidelines\n• Nursing procedures\n• Patient assessment tools\n• Drug interactions\n\nWhat do you need?"
  }])
  const [input,    setInput]    = useState("")
  const [thinking, setThinking] = useState(false)

  const QUICK = ["Normal vitals ranges","Pain assessment scale","IV drip calculation","Pressure ulcer care","Handover template"]
  const RESPONSES = {
    vital:    "Normal Vital Sign Ranges:\n\n• BP: 90-120 / 60-80 mmHg\n• Heart Rate: 60-100 bpm\n• Temperature: 36.1-37.2°C\n• SpO₂: ≥ 95%\n• RR: 12-20 cpm\n• Blood Glucose: 3.9-5.5 (fasting)\n\n🔴 Critical Values:\n• BP > 180/120 or < 80/50\n• HR > 150 or < 40\n• Temp > 40°C or < 35°C\n• SpO₂ < 90%",
    pain:     "Pain Assessment:\n\n📊 NRS: 0=None, 1-3=Mild, 4-6=Moderate, 7-10=Severe\n🎭 FACES Scale for paediatrics\n📋 CPOT for non-verbal patients\n\n⚠️ Document: location, character, duration, aggravating/relieving factors",
    drip:     "IV Drip Calculation:\n\nRate (drops/min) = Volume × Drop factor ÷ Time (min)\n\nMacro: 15 drops/ml | Micro: 60 drops/ml\n\nExample: 1000ml over 8h\n= 1000 × 15 ÷ 480 = 31 drops/min\n= 125 ml/hr",
    pressure: "Pressure Ulcer Prevention (SSKIN):\n\nS - Surface: Appropriate mattress\nS - Skin: Check every shift\nK - Keep moving: 2-hourly reposition\nI - Incontinence: Keep skin dry\nN - Nutrition: Adequate protein\n\nBraden ≤ 18 = High risk",
    handover: "SBAR Handover:\n\nS - Situation: Patient name, bed, reason\nB - Background: Admission date, PMH, allergies\nA - Assessment: Current vitals, condition\nR - Recommendation: Action needed, plan"
  }

  const handleSend = async () => {
    if (!input.trim()) return
    const q = input.trim()
    setInput("")
    setMessages(m => [...m, { role: "user", text: q }])
    setThinking(true)
    await new Promise(r => setTimeout(r, 700))
    const lower = q.toLowerCase()
    let response = "Please be more specific. I can help with vitals, pain, IV calculations, wound care, and handovers."
    if      (lower.includes("vital"))                                                   response = RESPONSES.vital
    else if (lower.includes("pain"))                                                    response = RESPONSES.pain
    else if (lower.includes("drip") || lower.includes("iv") || lower.includes("calc")) response = RESPONSES.drip
    else if (lower.includes("pressure") || lower.includes("ulcer"))                    response = RESPONSES.pressure
    else if (lower.includes("handover") || lower.includes("sbar"))                     response = RESPONSES.handover
    setMessages(m => [...m, { role: "assistant", text: response }])
    setThinking(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-96 bg-white flex flex-col shadow-2xl">
        <div className="bg-gradient-to-r from-pink-700 to-rose-600 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold">Nursing AI Assistant</p>
            <p className="text-pink-200 text-xs">Clinical support</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl font-bold">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-xs rounded-2xl px-4 py-3 text-sm whitespace-pre-line ${
                m.role === "user" ? "bg-pink-600 text-white rounded-tr-none" : "bg-white text-gray-800 shadow-sm border rounded-tl-none"
              }`}>{m.text}</div>
            </div>
          ))}
          {thinking && (
            <div className="flex">
              <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border">
                <div className="flex gap-1">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t flex gap-2 overflow-x-auto">
          {QUICK.map(s => (
            <button key={s} onClick={() => setInput(s)}
              className="flex-shrink-0 bg-pink-50 text-pink-700 text-xs px-3 py-1.5 rounded-full hover:bg-pink-100 whitespace-nowrap">
              {s}
            </button>
          ))}
        </div>

        <div className="p-4 border-t flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
            placeholder="Ask nursing question..."
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
          <button onClick={handleSend} disabled={!input.trim() || thinking}
            className="bg-pink-600 text-white px-4 py-2.5 rounded-xl hover:bg-pink-700 disabled:opacity-50 text-sm font-medium">
            Send
          </button>
        </div>
      </div>
    </div>
  )
}