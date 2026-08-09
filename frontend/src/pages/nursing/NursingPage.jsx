// frontend/src/pages/NursingPage.jsx
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import useAuthStore from "../../store/authStore"
import api from "../../services/api"
import { toast } from "react-hot-toast"
import {
  Heart, Activity, Thermometer, Wind, Droplets, Clock,
  BedDouble, FileText, Pill, AlertTriangle, CheckCircle2,
  Plus, RefreshCw, User, ChevronRight, X, Save,
  Syringe, ClipboardList, Users, TrendingUp, Bot
} from "lucide-react"

const TABS = [
  { id: "queue",  label: "Patient Queue",     icon: Users        },
  { id: "vitals", label: "Vitals Entry",       icon: Activity     },
  { id: "meds",   label: "Medication Admin",   icon: Syringe      },
  { id: "notes",  label: "Nursing Notes",      icon: ClipboardList},
  { id: "beds",   label: "Bed Management",     icon: BedDouble    }
]

// ── Defensive array extractor ─────────────────────────────────────────────────
const extractArray = (payload, ...keys) => {
  if (Array.isArray(payload)) return payload
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key]
  }
  return []
}

export default function NursingPage() {
  const { user } = useAuthStore()
  const navigate  = useNavigate()
  const [activeTab, setActiveTab] = useState("queue")
  const [stats,    setStats]    = useState({ queue: 0, vitalsdue: 0, medsdue: 0, beds: 0 })
  const [loading,  setLoading]  = useState(true)
  const [aiOpen,   setAiOpen]   = useState(false)

  useEffect(() => { fetchStats() }, [])

  const fetchStats = async () => {
    try {
      const [qRes, bRes] = await Promise.allSettled([
        api.get("/nursing/queue"),
        api.get("/nursing/beds")
      ])

      // ✅ FIXED: defensive extraction — backend may wrap in admissions/queue/array
      const qData = qRes.status === "fulfilled" ? qRes.value.data?.data : null
      const queue  = extractArray(qData, "admissions", "queue", "visits")

      const bData = bRes.status === "fulfilled" ? bRes.value.data?.data : null
      const beds   = extractArray(bData, "beds")

      setStats({
        queue:     queue.length,
        // ✅ FIXED: schema uses pulse not heartRate
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
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setAiOpen(true)}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              <Bot className="w-4 h-4" /> Clinical AI
            </button>
            <button
              onClick={fetchStats}
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
          { label: "Inpatient Queue", value: stats.queue,     icon: Users,    color: "blue",   sub: "Active admissions"  },
          { label: "Vitals Due",      value: stats.vitalsdue, icon: Activity, color: "orange", sub: "Not yet recorded"   },
          { label: "Meds Due",        value: stats.medsdue,   icon: Syringe,  color: "purple", sub: "Scheduled"          },
          { label: "Available Beds",  value: stats.beds,      icon: BedDouble,color: "green",  sub: "Ready for admission"}
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

      {/* Tab Navigation */}
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
              </button>
            )
          })}
        </div>

        <div className="p-5">
          {activeTab === "queue"  && <NursingQueue navigate={navigate} />}
          {activeTab === "vitals" && <VitalsEntry />}
          {activeTab === "meds"   && <MedicationAdmin />}
          {activeTab === "notes"  && <NursingNotes />}
          {activeTab === "beds"   && <BedManagement />}
        </div>
      </div>

      {aiOpen && <NursingAI onClose={() => setAiOpen(false)} />}
    </div>
  )
}

// ── Nursing Queue ──────────────────────────────────────────────────────────────
function NursingQueue({ navigate }) {
  const [admissions, setAdmissions] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState("")

  useEffect(() => { fetchQueue() }, [])

  const fetchQueue = async () => {
    try {
      const res     = await api.get("/nursing/queue")
      // ✅ FIXED: defensive extraction
      const payload = res.data?.data
      const list    = extractArray(payload, "admissions", "queue", "visits")
      setAdmissions(list)
    } catch (e) {
      console.error("fetchQueue error:", e)
      setAdmissions([])
    } finally {
      setLoading(false)
    }
  }

  const filtered = admissions.filter(a =>
    search === "" ||
    `${a.patient?.firstName} ${a.patient?.lastName}`
      .toLowerCase().includes(search.toLowerCase()) ||
    a.patient?.mrn?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search patient..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>
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
          <p className="text-gray-400 font-medium">No active admissions</p>
        </div>
      ) : (
        filtered.map(admission => {
          // ✅ FIXED: vitalSigns is array — take first; uses pulse not heartRate
          const vital       = Array.isArray(admission.visit?.vitalSigns)
            ? admission.visit.vitalSigns[0]
            : null
          const hasVitals   = !!vital
          const daysAdmitted = Math.floor(
            (Date.now() - new Date(admission.admittedAt)) / 86400000
          )

          return (
            <div
              key={admission.id}
              className="border border-gray-200 rounded-xl p-4 hover:border-pink-200 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-700 font-bold text-sm flex-shrink-0">
                    {admission.patient?.firstName?.[0]}{admission.patient?.lastName?.[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">
                      {admission.patient?.firstName} {admission.patient?.lastName}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="text-xs text-gray-400">{admission.patient?.mrn}</span>
                      <span className="text-xs text-gray-300">•</span>
                      <span className="text-xs text-gray-400">
                        {admission.bed?.room?.ward?.name}
                      </span>
                      <span className="text-xs text-gray-300">•</span>
                      <span className="text-xs font-medium text-blue-600">
                        Bed {admission.bed?.bedNumber}
                      </span>
                      <span className="text-xs text-gray-300">•</span>
                      <span className="text-xs text-gray-400">Day {daysAdmitted + 1}</span>
                    </div>

                    {vital ? (
                      <div className="flex gap-3 mt-2 flex-wrap">
                        {[
                          {
                            l: "BP",
                            v: `${vital.bloodPressureSystolic}/${vital.bloodPressureDiastolic}`,
                            alert: vital.bloodPressureSystolic > 140
                          },
                          {
                            // ✅ FIXED: pulse not heartRate
                            l: "HR",
                            v: vital.pulse ? `${vital.pulse} bpm` : null,
                            alert: vital.pulse > 100 || vital.pulse < 60
                          },
                          {
                            l: "T",
                            v: vital.temperature ? `${vital.temperature}°C` : null,
                            alert: vital.temperature > 37.5
                          },
                          {
                            l: "SpO₂",
                            v: vital.oxygenSaturation ? `${vital.oxygenSaturation}%` : null,
                            alert: vital.oxygenSaturation < 95
                          },
                          {
                            l: "RR",
                            v: vital.respiratoryRate ? `${vital.respiratoryRate}/min` : null,
                            alert: vital.respiratoryRate > 20
                          }
                        ].filter(x => x.v && !x.v.includes("undefined") && !x.v.includes("null")).map(x => (
                          <span
                            key={x.l}
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              x.alert
                                ? "bg-red-100 text-red-700 font-medium"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
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

// ── Vitals Entry ───────────────────────────────────────────────────────────────
function VitalsEntry() {
  const [visits,        setVisits]        = useState([])
  const [selectedVisit, setSelectedVisit] = useState("")
  const [loading,       setLoading]       = useState(false)
  const [submitting,    setSubmitting]    = useState(false)
  const [form, setForm] = useState({
    bloodPressureSystolic:  "",
    bloodPressureDiastolic: "",
    heartRate:       "",   // displayed as HR — mapped to pulse on submit
    respiratoryRate: "",
    temperature:     "",
    oxygenSaturation:"",
    weight:          "",
    height:          "",
    bloodGlucose:    "",   // not in schema — shown for completeness, skipped on submit
    painScore:       "0",
    gcsScore:        "",   // not a separate field — skipped on submit
    pupilReaction:   "",   // not in schema — skipped
    urineOutput:     "",   // not in schema — skipped
    notes:           ""
  })

  useEffect(() => { fetchActiveVisits() }, [])

  const fetchActiveVisits = async () => {
    setLoading(true)
    try {
      const res     = await api.get("/nursing/queue")
      const payload = res.data?.data
      // ✅ FIXED: defensive extraction
      const admissions = extractArray(payload, "admissions", "queue", "visits")
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedVisit) { toast.error("Select a patient"); return }
    setSubmitting(true)
    try {
      // ✅ FIXED: map frontend field names to correct schema field names
      const payload = { visitId: selectedVisit }

      if (form.bloodPressureSystolic)  payload.bloodPressureSystolic  = parseInt(form.bloodPressureSystolic)
      if (form.bloodPressureDiastolic) payload.bloodPressureDiastolic = parseInt(form.bloodPressureDiastolic)
      if (form.heartRate)       payload.pulse           = parseInt(form.heartRate)       // ✅ heartRate → pulse
      if (form.respiratoryRate) payload.respiratoryRate = parseInt(form.respiratoryRate)
      if (form.temperature)     payload.temperature     = parseFloat(form.temperature)
      if (form.oxygenSaturation)payload.oxygenSaturation= parseFloat(form.oxygenSaturation)
      if (form.weight)          payload.weight          = parseFloat(form.weight)
      if (form.height)          payload.height          = parseFloat(form.height)
      if (form.painScore)       payload.painScore       = parseInt(form.painScore)
      if (form.notes)           payload.notes           = form.notes
      // bloodGlucose, gcsScore, pupilReaction, urineOutput — not in VitalSign schema, omitted

      await api.post("/nursing/vitals", payload)
      toast.success("Vitals recorded successfully!")
      setForm({
        bloodPressureSystolic: "", bloodPressureDiastolic: "",
        heartRate: "", respiratoryRate: "", temperature: "",
        oxygenSaturation: "", weight: "", height: "",
        bloodGlucose: "", painScore: "0", gcsScore: "",
        pupilReaction: "", urineOutput: "", notes: ""
      })
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to record vitals")
    } finally {
      setSubmitting(false)
    }
  }

  const bpAlert   = form.bloodPressureSystolic && (parseInt(form.bloodPressureSystolic) > 140 || parseInt(form.bloodPressureSystolic) < 90)
  const tempAlert  = form.temperature   && (parseFloat(form.temperature) > 37.5   || parseFloat(form.temperature) < 35)
  const spo2Alert  = form.oxygenSaturation && parseInt(form.oxygenSaturation) < 95
  const hrAlert    = form.heartRate     && (parseInt(form.heartRate) > 100        || parseInt(form.heartRate) < 60)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      {/* Vital Signs Grid */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Heart className="w-4 h-4 text-pink-600" /> Vital Signs
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Blood Pressure */}
          <div className={`col-span-2 border rounded-xl p-4 ${bpAlert ? "border-red-300 bg-red-50" : "border-gray-200"}`}>
            <label className="block text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
              <Heart className="w-3 h-3" /> Blood Pressure (mmHg)
              {bpAlert && <span className="text-red-500 text-xs ml-1">⚠ Alert</span>}
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={form.bloodPressureSystolic}
                onChange={e => set("bloodPressureSystolic", e.target.value)}
                placeholder="Systolic"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
              <span className="text-gray-400 font-bold">/</span>
              <input
                type="number"
                value={form.bloodPressureDiastolic}
                onChange={e => set("bloodPressureDiastolic", e.target.value)}
                placeholder="Diastolic"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Normal: 90-120 / 60-80</p>
          </div>

          {/* Heart Rate — stored as pulse in DB */}
          <div className={`border rounded-xl p-4 ${hrAlert ? "border-red-300 bg-red-50" : "border-gray-200"}`}>
            <label className="block text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
              <Activity className="w-3 h-3" /> Heart Rate (bpm)
              {hrAlert && <span className="text-red-500 text-xs ml-1">⚠</span>}
            </label>
            <input
              type="number"
              value={form.heartRate}
              onChange={e => set("heartRate", e.target.value)}
              placeholder="e.g. 72"
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
            <input
              type="number" step="0.1"
              value={form.temperature}
              onChange={e => set("temperature", e.target.value)}
              placeholder="e.g. 36.5"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <p className="text-xs text-gray-400 mt-1">Normal: 36.1-37.2°C</p>
          </div>

          {/* SpO2 */}
          <div className={`border rounded-xl p-4 ${spo2Alert ? "border-red-300 bg-red-50" : "border-gray-200"}`}>
            <label className="block text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
              <Wind className="w-3 h-3" /> SpO₂ (%)
              {spo2Alert && <span className="text-red-500 text-xs ml-1">⚠ LOW</span>}
            </label>
            <input
              type="number"
              value={form.oxygenSaturation}
              onChange={e => set("oxygenSaturation", e.target.value)}
              placeholder="e.g. 98" min="0" max="100"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <p className="text-xs text-gray-400 mt-1">Normal: ≥ 95%</p>
          </div>

          {/* Respiratory Rate */}
          <div className="border border-gray-200 rounded-xl p-4">
            <label className="block text-xs font-semibold text-gray-500 mb-2">
              Resp. Rate (/min)
            </label>
            <input
              type="number"
              value={form.respiratoryRate}
              onChange={e => set("respiratoryRate", e.target.value)}
              placeholder="e.g. 16"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <p className="text-xs text-gray-400 mt-1">Normal: 12-20/min</p>
          </div>

          {/* Blood Glucose */}
          <div className="border border-gray-200 rounded-xl p-4">
            <label className="block text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
              <Droplets className="w-3 h-3" /> Blood Glucose (mmol/L)
            </label>
            <input
              type="number" step="0.1"
              value={form.bloodGlucose}
              onChange={e => set("bloodGlucose", e.target.value)}
              placeholder="e.g. 5.5"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <p className="text-xs text-gray-400 mt-1">Fasting: 3.9-5.5</p>
          </div>

          {/* Weight */}
          <div className="border border-gray-200 rounded-xl p-4">
            <label className="block text-xs font-semibold text-gray-500 mb-2">Weight (kg)</label>
            <input
              type="number" step="0.1"
              value={form.weight}
              onChange={e => set("weight", e.target.value)}
              placeholder="e.g. 70"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          {/* Height */}
          <div className="border border-gray-200 rounded-xl p-4">
            <label className="block text-xs font-semibold text-gray-500 mb-2">Height (cm)</label>
            <input
              type="number"
              value={form.height}
              onChange={e => set("height", e.target.value)}
              placeholder="e.g. 170"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          {/* GCS */}
          <div className="border border-gray-200 rounded-xl p-4">
            <label className="block text-xs font-semibold text-gray-500 mb-2">GCS Score (3-15)</label>
            <input
              type="number"
              value={form.gcsScore}
              onChange={e => set("gcsScore", e.target.value)}
              placeholder="e.g. 15" min="3" max="15"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <p className="text-xs text-gray-400 mt-1">Normal: 15</p>
          </div>

          {/* Urine Output */}
          <div className="border border-gray-200 rounded-xl p-4">
            <label className="block text-xs font-semibold text-gray-500 mb-2">
              Urine Output (ml/hr)
            </label>
            <input
              type="number"
              value={form.urineOutput}
              onChange={e => set("urineOutput", e.target.value)}
              placeholder="e.g. 50"
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
          <span className={`font-bold ${
            parseInt(form.painScore) >= 7
              ? "text-red-600"
              : parseInt(form.painScore) >= 4
                ? "text-orange-600"
                : "text-green-600"
          }`}>
            {form.painScore}/10
          </span>
        </label>
        <input
          type="range" min="0" max="10"
          value={form.painScore}
          onChange={e => set("painScore", e.target.value)}
          className="w-full accent-pink-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>0 - No Pain</span>
          <span>5 - Moderate</span>
          <span>10 - Worst</span>
        </div>
        <div className="flex justify-between mt-1">
          {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
            <div
              key={n}
              className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-medium ${
                parseInt(form.painScore) === n
                  ? "bg-pink-600 text-white"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {n}
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Clinical Notes</label>
        <textarea
          value={form.notes}
          onChange={e => set("notes", e.target.value)}
          placeholder="Any observations, patient complaints, changes in condition..."
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
        />
      </div>

      {/* Critical Alerts Summary */}
      {(bpAlert || tempAlert || spo2Alert || hrAlert) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700 font-semibold text-sm flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4" /> Critical Values Detected — Notify Doctor
          </p>
          <div className="flex flex-wrap gap-2">
            {bpAlert   && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">BP: {form.bloodPressureSystolic}/{form.bloodPressureDiastolic} mmHg</span>}
            {hrAlert   && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">HR: {form.heartRate} bpm</span>}
            {tempAlert && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">Temp: {form.temperature}°C</span>}
            {spo2Alert && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">SpO₂: {form.oxygenSaturation}%</span>}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !selectedVisit}
        className="w-full bg-pink-600 text-white py-3 rounded-xl font-semibold hover:bg-pink-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
      >
        <Save className="w-5 h-5" />
        {submitting ? "Recording Vitals..." : "Save Vital Signs"}
      </button>
    </form>
  )
}

// ── Medication Administration ──────────────────────────────────────────────────
function MedicationAdmin() {
  const [admissions,   setAdmissions]   = useState([])
  const [records,      setRecords]      = useState([])
  const [showModal,    setShowModal]    = useState(false)
  const [selectedAdm,  setSelectedAdm]  = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [form, setForm] = useState({
    admissionId:    "",
    drugName:       "",
    dose:           "",
    route:          "ORAL",
    administeredAt: "",
    notes:          ""
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { fetchAdmissions() }, [])

  const fetchAdmissions = async () => {
    setLoading(true)
    try {
      const res     = await api.get("/nursing/queue")
      const payload = res.data?.data
      const list    = extractArray(payload, "activeAdmissions", "admissions", "queue")
      setAdmissions(list)

      // fetch med records for first admission if any
      if (list.length > 0) {
        fetchRecords(list[0].id)
        setSelectedAdm(list[0])
      }
    } catch (e) {
      console.error("fetchAdmissions error:", e)
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
    } catch (e) {
      setRecords([])
    }
  }

  const handleAdmissionChange = (admId) => {
    const adm = admissions.find(a => a.id === admId)
    setSelectedAdm(adm || null)
    setForm(f => ({ ...f, admissionId: admId }))
    fetchRecords(admId)
  }

  const openModal = () => {
    setForm({
      admissionId:    selectedAdm?.id || "",
      drugName:       "",
      dose:           "",
      route:          "ORAL",
      administeredAt: new Date().toISOString().slice(0, 16),
      notes:          ""
    })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.admissionId) return toast.error("Select a patient")
    if (!form.drugName.trim()) return toast.error("Enter drug name")
    if (!form.dose.trim()) return toast.error("Enter dose")
    if (!form.route) return toast.error("Select route")

    setSubmitting(true)
    try {
      await api.post("/nursing/medication-admin", {
        admissionId:    form.admissionId,
        drugName:       form.drugName,
        dose:           form.dose,
        route:          form.route,
        administeredAt: form.administeredAt || new Date().toISOString(),
        notes:          form.notes
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

  const ROUTES = ["ORAL", "IV", "IM", "SC", "SL", "TOPICAL", "INHALATION", "RECTAL", "NASAL"]

  const ROUTE_COLOR = {
    ORAL:       "bg-blue-100 text-blue-700",
    IV:         "bg-red-100 text-red-700",
    IM:         "bg-orange-100 text-orange-700",
    SC:         "bg-yellow-100 text-yellow-700",
    SL:         "bg-purple-100 text-purple-700",
    TOPICAL:    "bg-green-100 text-green-700",
    INHALATION: "bg-cyan-100 text-cyan-700",
    RECTAL:     "bg-gray-100 text-gray-700",
    NASAL:      "bg-pink-100 text-pink-700",
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700">
          Medication Administration Record (MAR)
        </h3>
        <button
          onClick={openModal}
          className="flex items-center gap-2 bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pink-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Record Administration
        </button>
      </div>

      {/* 5 Rights Checklist */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-blue-700 text-sm font-medium mb-3">
          📋 5 Rights of Medication Administration
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {["Right Patient","Right Drug","Right Dose","Right Route","Right Time"].map(r => (
            <div key={r} className="bg-white rounded-lg p-2 text-center border border-blue-100">
              <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto mb-1" />
              <p className="text-xs font-medium text-gray-700">{r}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Patient Selector */}
      {admissions.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Select Patient to View MAR
          </label>
          <select
            value={selectedAdm?.id || ""}
            onChange={e => handleAdmissionChange(e.target.value)}
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
      )}

      {/* Records List */}
      {loading ? (
        <div className="flex items-center justify-center h-24">
          <RefreshCw className="w-5 h-5 animate-spin text-pink-500" />
        </div>
      ) : records.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-600">
            Administration Records ({records.length})
          </p>
          <div className="max-h-72 overflow-y-auto space-y-2">
            {records.map(r => (
              <div
                key={r.id}
                className="border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-pink-100 rounded-lg flex items-center justify-center shrink-0">
                    <Syringe className="w-4 h-4 text-pink-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{r.drugName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Dose: <span className="font-medium">{r.dose}</span>
                    </p>
                    {r.notes && (
                      <p className="text-xs text-gray-400 mt-0.5">{r.notes}</p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROUTE_COLOR[r.route] || "bg-gray-100 text-gray-600"}`}>
                    {r.route}
                  </span>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1 justify-end">
                    <Clock className="w-3 h-3" />
                    {new Date(r.administeredAt).toLocaleString("en-NG", {
                      day: "2-digit", month: "short",
                      hour: "2-digit", minute: "2-digit"
                    })}
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
          <p className="text-xs mt-1">
            {admissions.length === 0
              ? "No admitted patients found"
              : "Click 'Record Administration' to add a record"}
          </p>
        </div>
      )}

      {/* ── MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">

            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-800">Record Medication Administration</h3>
                <p className="text-xs text-gray-500 mt-0.5">Confirm all 5 rights before recording</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">

              {/* Patient */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Patient <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.admissionId}
                  onChange={e => setForm(f => ({ ...f, admissionId: e.target.value }))}
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="">-- Select patient --</option>
                  {admissions.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.patient?.firstName} {a.patient?.lastName} — Bed {a.bed?.bedNumber}
                    </option>
                  ))}
                </select>
              </div>

              {/* Drug Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Drug Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.drugName}
                  onChange={e => setForm(f => ({ ...f, drugName: e.target.value }))}
                  placeholder="e.g. Paracetamol 500mg"
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              {/* Dose */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Dose <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.dose}
                  onChange={e => setForm(f => ({ ...f, dose: e.target.value }))}
                  placeholder="e.g. 1 tablet, 500mg, 10ml"
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              {/* Route */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Route <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {ROUTES.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, route: r }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        form.route === r
                          ? "bg-pink-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date/Time */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Date & Time Administered
                </label>
                <input
                  type="datetime-local"
                  value={form.administeredAt}
                  onChange={e => setForm(f => ({ ...f, administeredAt: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Notes <span className="text-gray-400 text-xs">(optional)</span>
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Patient response, observations..."
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-pink-600 text-white rounded-xl text-sm font-semibold hover:bg-pink-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {submitting
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</>
                    : <><Save className="w-4 h-4" /> Record</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Nursing Notes ──────────────────────────────────────────────────────────────
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
      // ✅ FIXED: defensive extraction
      const admissions = extractArray(payload, "admissions", "queue", "visits")
      setVisits(
        admissions
          .map(a => ({
            id:    a.visit?.id,
            label: `${a.patient?.firstName} ${a.patient?.lastName} — Bed ${a.bed?.bedNumber}`
          }))
          .filter(v => v.id)
      )
    } catch (e) {
      console.error("fetchVisits error:", e)
    }
  }

  const fetchNotes = async () => {
    try {
      const res  = await api.get(`/nursing/notes/${selectedVisit}`)
      const data = res.data?.data
      setNotes(Array.isArray(data) ? data : Array.isArray(data?.notes) ? data.notes : [])
    } catch (e) {
      console.error("fetchNotes error:", e)
    }
  }

  const submit = async () => {
    if (!selectedVisit || !form.content.trim()) {
      toast.error("Select patient and enter note")
      return
    }
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
    GENERAL:            "bg-gray-100 text-gray-700",
    ASSESSMENT:         "bg-blue-100 text-blue-700",
    MEDICATION:         "bg-green-100 text-green-700",
    PROCEDURE:          "bg-purple-100 text-purple-700",
    HANDOVER:           "bg-orange-100 text-orange-700",
    INCIDENT:           "bg-red-100 text-red-700",
    DISCHARGE_PLANNING: "bg-teal-100 text-teal-700"
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Patient</label>
          <select
            value={selectedVisit}
            onChange={e => setSelectedVisit(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
          >
            <option value="">Select patient...</option>
            {visits.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Note Type</label>
          <select
            value={form.noteType}
            onChange={e => setForm(p => ({ ...p, noteType: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
          >
            {NOTE_TYPES.map(t => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Note Content <span className="text-red-500">*</span>
        </label>
        <textarea
          value={form.content}
          onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
          placeholder={`Enter ${form.noteType.replace(/_/g, " ").toLowerCase()} note...\n\nInclude: Observations, interventions, patient response, communication with team...`}
          rows={6}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
        />
      </div>

      <div className="flex items-center gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
          <div className="flex gap-2">
            {["ROUTINE","URGENT","CRITICAL"].map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setForm(prev => ({ ...prev, priority: p }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  form.priority === p
                    ? p === "CRITICAL"
                      ? "bg-red-600 text-white"
                      : p === "URGENT"
                        ? "bg-orange-500 text-white"
                        : "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !selectedVisit || !form.content.trim()}
          className="ml-auto flex items-center gap-2 bg-pink-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-pink-700 disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4" />
          {submitting ? "Saving..." : "Save Note"}
        </button>
      </div>

      {/* Previous Notes */}
      {notes.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-700 mb-3">Previous Notes</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {notes.map(note => (
              <div key={note.id} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      NOTE_COLORS[note.noteType] || "bg-gray-100 text-gray-700"
                    }`}>
                      {note.noteType?.replace(/_/g, " ")}
                    </span>
                    {note.priority !== "ROUTINE" && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        note.priority === "CRITICAL"
                          ? "bg-red-100 text-red-700"
                          : "bg-orange-100 text-orange-700"
                      }`}>
                        {note.priority}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {new Date(note.createdAt).toLocaleString()}
                  </div>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-line">{note.content}</p>
                <p className="text-xs text-gray-400 mt-2">
                  — {note.nurse?.firstName} {note.nurse?.lastName}
                  {note.nurse?.role && ` (${note.nurse.role.replace(/_/g, " ")})`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Bed Management ─────────────────────────────────────────────────────────────
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
      // ✅ FIXED: defensive extraction
      const list    = extractArray(payload, "beds")
      setBeds(list)
    } catch (e) {
      console.error("fetchBeds error:", e)
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

  const stats = {
    total:       beds.length,
    available:   beds.filter(b => b.status === "AVAILABLE").length,
    occupied:    beds.filter(b => b.status === "OCCUPIED").length,
    reserved:    beds.filter(b => b.status === "RESERVED").length,
    maintenance: beds.filter(b => ["CLEANING","MAINTENANCE"].includes(b.status)).length
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Beds",  value: stats.total,       color: "gray"   },
          { label: "Available",   value: stats.available,   color: "green"  },
          { label: "Occupied",    value: stats.occupied,    color: "blue"   },
          { label: "Reserved",    value: stats.reserved,    color: "yellow" },
          { label: "Maintenance", value: stats.maintenance, color: "red"    }
        ].map(s => (
          <div
            key={s.label}
            className={`bg-${s.color}-50 border border-${s.color}-200 rounded-xl p-3 text-center`}
          >
            <p className={`text-2xl font-bold text-${s.color}-700`}>{s.value}</p>
            <p className={`text-xs text-${s.color}-600 font-medium`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Occupancy Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-700">Overall Occupancy</p>
          <p className="text-sm font-bold text-gray-800">
            {stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0}%
          </p>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all"
            style={{
              width: stats.total > 0
                ? `${(stats.occupied / stats.total) * 100}%`
                : "0%"
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{stats.occupied} occupied</span>
          <span>{stats.available} available</span>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {["ALL","AVAILABLE","OCCUPIED","RESERVED","CLEANING","MAINTENANCE","ISOLATION"].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f
                ? "bg-pink-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f} {f === "ALL"
              ? `(${beds.length})`
              : `(${beds.filter(b => b.status === f).length})`
            }
          </button>
        ))}
      </div>

      {/* Bed Grid by Ward */}
      {loading ? (
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
          {[...Array(16)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
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
                  <div
                    key={bed.id}
                    className={`border-2 rounded-xl p-3 text-center cursor-pointer hover:shadow-md transition-shadow ${
                      STATUS_COLOR[bed.status] || "bg-gray-100 border-gray-300"
                    }`}
                  >
                    <BedDouble className="w-6 h-6 mx-auto mb-1" />
                    <p className="text-xs font-bold">
                      {bed.bedNumber?.split("-").pop()}
                    </p>
                    <p className="text-xs font-medium mt-0.5">
                      {bed.status === "OCCUPIED"
                        ? bed.admissions?.[0]?.patient?.firstName?.slice(0, 8) || "Occupied"
                        : bed.status
                      }
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

// ── Nursing AI Assistant ───────────────────────────────────────────────────────
function NursingAI({ onClose }) {
  const [messages, setMessages] = useState([{
    role: "assistant",
    text: "Hello Nurse! I can help with:\n• Normal vital sign ranges\n• Medication administration guidelines\n• Nursing procedures\n• Patient assessment tools\n• Drug interactions\n\nWhat do you need?"
  }])
  const [input,    setInput]    = useState("")
  const [thinking, setThinking] = useState(false)

  const QUICK = [
    "Normal vitals ranges",
    "Pain assessment scale",
    "IV drip calculation",
    "Pressure ulcer care",
    "Handover template"
  ]

  const RESPONSES = {
    vital:    "Normal Vital Sign Ranges:\n\n• BP: 90-120 / 60-80 mmHg\n• Heart Rate: 60-100 bpm\n• Temperature: 36.1-37.2°C\n• SpO₂: ≥ 95%\n• RR: 12-20 /min\n• Blood Glucose: 3.9-5.5 (fasting)\n\n🔴 Critical Values (notify doctor immediately):\n• BP > 180/120 or < 80/50\n• HR > 150 or < 40\n• Temp > 40°C or < 35°C\n• SpO₂ < 90%",
    pain:     "Pain Assessment Scales:\n\n📊 Numerical Rating Scale (NRS):\n0 = No pain\n1-3 = Mild pain\n4-6 = Moderate pain\n7-10 = Severe pain\n\n🎭 FACES Scale (paediatrics/confused):\nUsed when patient cannot use NRS\n\n📋 CPOT (Critical Care Pain):\nFor intubated/non-verbal patients\n\n⚠️ Document: location, character, radiation, duration, aggravating/relieving factors",
    drip:     "IV Drip Rate Calculation:\n\nFormula: Rate (drops/min) = Volume (ml) × Drop factor / Time (min)\n\nCommon drop factors:\n• Macro set: 15 drops/ml\n• Micro set: 60 drops/ml\n\nExample: 1000ml NS over 8 hours\n= 1000 × 15 / 480 = 31 drops/min\n\nFor ml/hr: Volume ÷ Hours\n1000ml ÷ 8h = 125 ml/hr",
    pressure: "Pressure Ulcer Prevention (SSKIN Bundle):\n\nS - Surface: Use appropriate mattress\nS - Skin inspection: Check every shift\nK - Keep moving: Reposition 2-hourly\nI - Incontinence: Keep skin dry\nN - Nutrition: Adequate protein intake\n\nBraden Scale ≤ 18 = High risk\n\nStaging:\n• Stage 1: Non-blanchable redness\n• Stage 2: Partial thickness skin loss\n• Stage 3: Full thickness skin loss\n• Stage 4: Tissue/bone exposed",
    handover: "SBAR Handover Template:\n\nS - Situation:\n'I am calling about [patient name], [room/bed], admitted for [reason]'\n\nB - Background:\n'Patient was admitted [date] with [diagnosis]. Relevant history: [PMH, allergies, medications]'\n\nA - Assessment:\n'Current vitals: [vitals]. Patient is [stable/deteriorating] because...'\n\nR - Recommendation:\n'I am requesting [action needed]. I suggest [plan]'"
  }

  const handleSend = async () => {
    if (!input.trim()) return
    const q = input.trim()
    setInput("")
    setMessages(m => [...m, { role: "user", text: q }])
    setThinking(true)
    await new Promise(r => setTimeout(r, 700))
    const lower = q.toLowerCase()
    let response = "Thank you for your question. "
    if      (lower.includes("vital"))                            response = RESPONSES.vital
    else if (lower.includes("pain"))                             response = RESPONSES.pain
    else if (lower.includes("drip") || lower.includes("iv") || lower.includes("calculation")) response = RESPONSES.drip
    else if (lower.includes("pressure") || lower.includes("ulcer")) response = RESPONSES.pressure
    else if (lower.includes("handover") || lower.includes("sbar")) response = RESPONSES.handover
    else response += "Please be more specific. I can help with vitals, pain assessment, IV calculations, wound care, and handover templates."
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
            <p className="text-pink-200 text-xs">Clinical support for nurses</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl font-bold">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-xs rounded-2xl px-4 py-3 text-sm whitespace-pre-line ${
                m.role === "user"
                  ? "bg-pink-600 text-white rounded-tr-none"
                  : "bg-white text-gray-800 shadow-sm border rounded-tl-none"
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="flex gap-2">
              <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border">
                <div className="flex gap-1">
                  {[0,1,2].map(i => (
                    <div
                      key={i}
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t flex gap-2 overflow-x-auto">
          {QUICK.map(s => (
            <button
              key={s}
              onClick={() => setInput(s)}
              className="flex-shrink-0 bg-pink-50 text-pink-700 text-xs px-3 py-1.5 rounded-full hover:bg-pink-100 whitespace-nowrap"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="p-4 border-t flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
            placeholder="Ask nursing question..."
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || thinking}
            className="bg-pink-600 text-white px-4 py-2.5 rounded-xl hover:bg-pink-700 disabled:opacity-50 text-sm font-medium"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}