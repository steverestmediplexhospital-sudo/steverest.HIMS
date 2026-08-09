// frontend/src/pages/EmergencyPage.jsx
import { useState, useEffect } from "react"
import api from "../../services/api"
import { toast } from "react-hot-toast"
import {
  AlertTriangle, Plus, RefreshCw, Clock,
  Activity, X, ChevronDown, ChevronUp, Zap
} from "lucide-react"

const TRIAGE_CONFIG = {
  IMMEDIATE:   { color: "bg-red-600",    text: "text-red-700",    bg: "bg-red-50",    border: "border-red-300",   label: "IMMEDIATE",   desc: "Life threatening" },
  URGENT:      { color: "bg-orange-500", text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-300",label: "URGENT",      desc: "Serious condition" },
  LESS_URGENT: { color: "bg-yellow-500", text: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-300",label: "LESS URGENT", desc: "Stable, can wait" },
  NON_URGENT:  { color: "bg-green-500",  text: "text-green-700",  bg: "bg-green-50",  border: "border-green-300", label: "NON URGENT",  desc: "Minor condition" }
}

export default function EmergencyPage() {
  const [cases,   setCases]   = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [stats,   setStats]   = useState({
    immediate: 0, urgent: 0, lessUrgent: 0, nonUrgent: 0, total: 0
  })

  useEffect(() => {
    fetchCases()
    const t = setInterval(fetchCases, 20000)
    return () => clearInterval(t)
  }, [])

  const fetchCases = async () => {
    try {
      const res     = await api.get("/emergency")
      const payload = res.data?.data || {}

      // ✅ Backend returns { cases: [...], stats: {...} } not a plain array
      const list = Array.isArray(payload.cases)
        ? payload.cases
        : Array.isArray(payload)
          ? payload
          : []

      setCases(list)

      if (payload.stats) {
        setStats({
          immediate:  payload.stats.immediate  || 0,
          urgent:     payload.stats.urgent     || 0,
          lessUrgent: payload.stats.lessUrgent || 0,
          nonUrgent:  payload.stats.nonUrgent  || 0,
          total:      payload.stats.total      || list.length
        })
      } else {
        setStats({
          immediate:  list.filter(c => c.triage?.triageLevel === "IMMEDIATE").length,
          urgent:     list.filter(c => c.triage?.triageLevel === "URGENT").length,
          lessUrgent: list.filter(c => c.triage?.triageLevel === "LESS_URGENT").length,
          nonUrgent:  list.filter(c => c.triage?.triageLevel === "NON_URGENT").length,
          total:      list.length
        })
      }
    } catch (e) {
      console.error("Emergency fetch error:", e)
      toast.error("Failed to load emergency cases")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-700 via-red-600 to-rose-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center animate-pulse">
              <AlertTriangle className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-red-200 text-sm">Emergency Department</p>
              <h1 className="text-2xl font-bold">Emergency Triage</h1>
              <p className="text-red-200 text-sm">{stats.total} active cases</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { level: "IMMEDIATE",   value: stats.immediate,  color: "bg-red-800/50"    },
              { level: "URGENT",      value: stats.urgent,     color: "bg-orange-600/50" },
              { level: "LESS URGENT", value: stats.lessUrgent, color: "bg-yellow-600/50" },
              { level: "NON URGENT",  value: stats.nonUrgent,  color: "bg-green-700/50"  }
            ].map(s => (
              <div key={s.level} className={`${s.color} rounded-xl px-3 py-2 text-center min-w-16`}>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-red-200 text-xs">{s.level}</p>
              </div>
            ))}
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-2 bg-white text-red-700 px-4 py-2 rounded-xl font-semibold hover:bg-red-50 transition-colors"
            >
              <Plus className="w-5 h-5" /> New Case
            </button>
            <button
              onClick={fetchCases}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Triage Lanes */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {Object.entries(TRIAGE_CONFIG).map(([level, config]) => {
          // ✅ FIXED: triageLevel nested inside c.triage.triageLevel
          const levelCases = cases.filter(c => c.triage?.triageLevel === level)
          return (
            <div key={level} className={`border-2 ${config.border} rounded-xl overflow-hidden`}>
              <div className={`${config.color} px-4 py-3 flex items-center justify-between`}>
                <div>
                  <p className="text-white font-bold text-sm">{config.label}</p>
                  <p className="text-white/80 text-xs">{config.desc}</p>
                </div>
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white font-bold">
                  {levelCases.length}
                </div>
              </div>
              <div className={`${config.bg} p-3 space-y-2 min-h-32`}>
                {loading ? (
                  <div className="h-16 bg-white/50 rounded-lg animate-pulse" />
                ) : levelCases.length === 0 ? (
                  <div className="text-center py-6">
                    <p className={`text-xs ${config.text} opacity-60`}>
                      No {config.label.toLowerCase()} cases
                    </p>
                  </div>
                ) : (
                  levelCases.map(c => (
                    <EmergencyCard
                      key={c.id}
                      emergencyCase={c}
                      config={config}
                      onUpdate={fetchCases}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {showNew && (
        <NewEmergencyModal
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); fetchCases() }}
        />
      )}
    </div>
  )
}

// ── Emergency Card ─────────────────────────────────────────────────────────────
function EmergencyCard({ emergencyCase, config, onUpdate }) {
  const [expanded, setExpanded] = useState(false)

  const waitMins = Math.floor(
    (Date.now() - new Date(emergencyCase.visitDate || emergencyCase.createdAt)) / 60000
  )

  // ✅ FIXED: vitalSigns is an array — take first element
  const vitals = Array.isArray(emergencyCase.vitalSigns)
    ? emergencyCase.vitalSigns[0]
    : null

  const updateStatus = async (status) => {
    try {
      await api.patch(`/emergency/${emergencyCase.id}/status`, { status })
      toast.success("Status updated")
      onUpdate()
    } catch {
      toast.error("Failed to update")
    }
  }

  const patientName = emergencyCase.patient
    ? `${emergencyCase.patient.firstName || ""} ${emergencyCase.patient.lastName || ""}`.trim()
    : "Unknown Patient"

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800 text-sm truncate">{patientName}</p>
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {emergencyCase.chiefComplaint}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{emergencyCase.visitNumber}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-xs text-gray-400 flex items-center gap-0.5">
              <Clock className="w-3 h-3" />{waitMins}m
            </span>
            {expanded
              ? <ChevronUp className="w-3 h-3 text-gray-400" />
              : <ChevronDown className="w-3 h-3 text-gray-400" />
            }
          </div>
        </div>

        {/* ✅ FIXED: vitals is single object from array[0], uses pulse not heartRate */}
        {vitals && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {vitals.bloodPressureSystolic && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                vitals.bloodPressureSystolic > 140
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-600"
              }`}>
                BP {vitals.bloodPressureSystolic}/{vitals.bloodPressureDiastolic}
              </span>
            )}
            {vitals.pulse && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                vitals.pulse > 100
                  ? "bg-orange-100 text-orange-700"
                  : "bg-gray-100 text-gray-600"
              }`}>
                HR {vitals.pulse}
              </span>
            )}
            {vitals.oxygenSaturation && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                vitals.oxygenSaturation < 95
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-600"
              }`}>
                SpO₂ {vitals.oxygenSaturation}%
              </span>
            )}
            {vitals.temperature && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                vitals.temperature > 38
                  ? "bg-orange-100 text-orange-700"
                  : "bg-gray-100 text-gray-600"
              }`}>
                T {vitals.temperature}°C
              </span>
            )}
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-2">
          {emergencyCase.triage && (
            <div className="text-xs text-gray-600 space-y-0.5">
              {emergencyCase.triage.arrivalMode && (
                <p>Arrival: {emergencyCase.triage.arrivalMode.replace(/_/g, " ")}</p>
              )}
              {emergencyCase.triage.notes && (
                <p className="italic text-gray-500">{emergencyCase.triage.notes}</p>
              )}
            </div>
          )}
          {emergencyCase.notes && (
            <p className="text-xs text-gray-500 italic">{emergencyCase.notes}</p>
          )}
          <div className="flex gap-1 flex-wrap">
            {["STABILIZED", "ADMITTED", "DISCHARGED", "REFERRED"].map(s => (
              <button
                key={s}
                onClick={() => updateStatus(s)}
                className="text-xs bg-gray-200 hover:bg-blue-600 hover:text-white text-gray-700 px-2 py-1 rounded transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── New Emergency Modal ────────────────────────────────────────────────────────
function NewEmergencyModal({ onClose, onCreated }) {
  const [submitting,      setSubmitting]      = useState(false)
  const [patientType,     setPatientType]     = useState("EXISTING")
  const [searchQuery,     setSearchQuery]     = useState("")
  const [searchResults,   setSearchResults]   = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [form, setForm] = useState({
    chiefComplaint: "", triageLevel: "URGENT",
    mechanism: "", arrivalMode: "WALK_IN", consciousness: "ALERT",
    // ✅ Vitals stored as heartRate in form but sent as pulse to backend
    bloodPressureSystolic: "", bloodPressureDiastolic: "",
    heartRate: "", respiratoryRate: "", temperature: "",
    oxygenSaturation: "", gcsScore: "",
    // Walk-in patient fields
    firstName: "", lastName: "", gender: "",
    age: "", phone: "", address: ""
  })

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const searchPatients = async (q) => {
    if (q.length < 2) { setSearchResults([]); return }
    try {
      const res  = await api.get(`/patients?search=${q}&limit=8`)
      const data = res.data?.data
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.patients)
          ? data.patients
          : []
      setSearchResults(list)
    } catch { setSearchResults([]) }
  }

  const submit = async () => {
    if (!form.chiefComplaint) { toast.error("Chief complaint is required"); return }
    if (!form.triageLevel)    { toast.error("Triage level is required");    return }
    if (patientType === "EXISTING" && !selectedPatient) {
      toast.error("Select a patient or choose Walk-in")
      return
    }
    if (patientType === "WALK_IN" && (!form.firstName || !form.lastName || !form.gender)) {
      toast.error("First name, last name and gender are required")
      return
    }

    setSubmitting(true)
    try {
      // ✅ FIXED: flat payload — no nested vitalSigns object
      // ✅ FIXED: heartRate form field sent as pulse to backend
      const payload = {
        chiefComplaint: form.chiefComplaint,
        triageLevel:    form.triageLevel,
        mechanism:      form.mechanism      || undefined,
        arrivalMode:    form.arrivalMode,
        consciousness:  form.consciousness,
        // Vitals — flat, correct schema names
        bloodPressureSystolic:  form.bloodPressureSystolic  ? parseInt(form.bloodPressureSystolic)  : undefined,
        bloodPressureDiastolic: form.bloodPressureDiastolic ? parseInt(form.bloodPressureDiastolic) : undefined,
        pulse:                  form.heartRate              ? parseInt(form.heartRate)               : undefined,
        respiratoryRate:        form.respiratoryRate        ? parseInt(form.respiratoryRate)         : undefined,
        temperature:            form.temperature            ? parseFloat(form.temperature)           : undefined,
        oxygenSaturation:       form.oxygenSaturation       ? parseInt(form.oxygenSaturation)        : undefined,
        gcsScore:               form.gcsScore               ? parseInt(form.gcsScore)                : undefined
      }

      if (patientType === "EXISTING" && selectedPatient) {
        payload.patientId = selectedPatient.id
      } else {
        // Walk-in — backend creates patient from these fields
        payload.firstName   = form.firstName.trim()
        payload.lastName    = form.lastName.trim()
        payload.gender      = form.gender
        payload.phone       = form.phone    || undefined
        payload.address     = form.address  || undefined
      }

      await api.post("/emergency", payload)
      toast.success(
        form.triageLevel === "IMMEDIATE"
          ? "🚨 IMMEDIATE case created!"
          : "Emergency case created!"
      )
      onCreated()
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to create emergency case")
    } finally {
      setSubmitting(false)
    }
  }

  const INPUT = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-red-600 rounded-t-2xl p-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-white" />
            <h3 className="font-bold text-white text-lg">New Emergency Case</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Triage Level */}
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-3">
              Triage Level <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(TRIAGE_CONFIG).map(([level, config]) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => set("triageLevel", level)}
                  className={`border-2 rounded-xl p-3 text-center transition-all ${
                    form.triageLevel === level
                      ? `${config.border} ${config.bg} shadow-md scale-105`
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className={`w-4 h-4 ${config.color} rounded-full mx-auto mb-1`} />
                  <p className={`text-xs font-bold ${
                    form.triageLevel === level ? config.text : "text-gray-600"
                  }`}>
                    {config.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{config.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Patient */}
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Patient</label>
            <div className="flex gap-2 mb-3">
              {["EXISTING", "WALK_IN"].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPatientType(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                    patientType === t
                      ? "border-red-500 bg-red-50 text-red-700"
                      : "border-gray-200 text-gray-600"
                  }`}
                >
                  {t === "EXISTING" ? "Registered Patient" : "Walk-in / Unknown"}
                </button>
              ))}
            </div>

            {patientType === "EXISTING" ? (
              <div>
                <input
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value)
                    searchPatients(e.target.value)
                  }}
                  placeholder="Search patient by name or MRN..."
                  className={INPUT}
                />
                {searchResults.length > 0 && (
                  <div className="border border-gray-200 rounded-lg mt-1 max-h-32 overflow-y-auto bg-white shadow-lg">
                    {searchResults.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPatient(p)
                          setSearchResults([])
                          setSearchQuery(`${p.firstName} ${p.lastName} — ${p.mrn}`)
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 border-b border-gray-50 last:border-0"
                      >
                        <span className="font-medium">{p.firstName} {p.lastName}</span>
                        <span className="text-gray-400 ml-2">{p.mrn}</span>
                        <span className="text-gray-400 ml-2">{p.gender}</span>
                        {p.allergies?.length > 0 && (
                          <span className="text-red-500 ml-2 text-xs">⚠ Allergies</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {selectedPatient?.allergies?.length > 0 && (
                  <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2">
                    <p className="text-xs text-red-700 font-semibold">
                      ⚠️ ALLERGIES: {selectedPatient.allergies.map(a => a.allergen).join(", ")}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={form.firstName}
                  onChange={e => set("firstName", e.target.value)}
                  placeholder="First name *"
                  className={INPUT}
                />
                <input
                  value={form.lastName}
                  onChange={e => set("lastName", e.target.value)}
                  placeholder="Last name *"
                  className={INPUT}
                />
                <select
                  value={form.gender}
                  onChange={e => set("gender", e.target.value)}
                  className={INPUT}
                >
                  <option value="">Gender *</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
                <input
                  value={form.age}
                  onChange={e => set("age", e.target.value)}
                  placeholder="Estimated age"
                  className={INPUT}
                />
                <input
                  value={form.phone}
                  onChange={e => set("phone", e.target.value)}
                  placeholder="Phone (if known)"
                  className={INPUT}
                />
                <input
                  value={form.address}
                  onChange={e => set("address", e.target.value)}
                  placeholder="Address (if known)"
                  className={INPUT}
                />
              </div>
            )}
          </div>

          {/* Chief Complaint */}
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              Chief Complaint <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.chiefComplaint}
              onChange={e => set("chiefComplaint", e.target.value)}
              placeholder="Describe the emergency: what happened, when, how severe..."
              rows={3}
              className={INPUT}
            />
          </div>

          {/* Arrival & Consciousness */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Arrival Mode
              </label>
              <select
                value={form.arrivalMode}
                onChange={e => set("arrivalMode", e.target.value)}
                className={INPUT}
              >
                <option value="WALK_IN">Walk-in</option>
                <option value="AMBULANCE">Ambulance</option>
                <option value="POLICE">Police</option>
                <option value="PRIVATE_CAR">Private Car</option>
                <option value="REFERRAL">Referral</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Consciousness (AVPU)
              </label>
              <select
                value={form.consciousness}
                onChange={e => set("consciousness", e.target.value)}
                className={INPUT}
              >
                <option value="ALERT">Alert</option>
                <option value="VOICE">Responds to Voice</option>
                <option value="PAIN">Responds to Pain</option>
                <option value="UNRESPONSIVE">Unresponsive</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Mechanism (if trauma)
              </label>
              <input
                value={form.mechanism}
                onChange={e => set("mechanism", e.target.value)}
                placeholder="e.g. RTA, fall, assault..."
                className={INPUT}
              />
            </div>
          </div>

          {/* Emergency Vitals */}
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-red-600" /> Emergency Vitals
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">BP (mmHg)</label>
                <div className="flex gap-1 items-center">
                  <input
                    type="number"
                    value={form.bloodPressureSystolic}
                    onChange={e => set("bloodPressureSystolic", e.target.value)}
                    placeholder="Sys"
                    className={INPUT}
                  />
                  <span className="text-gray-400 font-bold">/</span>
                  <input
                    type="number"
                    value={form.bloodPressureDiastolic}
                    onChange={e => set("bloodPressureDiastolic", e.target.value)}
                    placeholder="Dia"
                    className={INPUT}
                  />
                </div>
              </div>
              {[
                { label: "HR (bpm)",   field: "heartRate",      placeholder: "72"   },
                { label: "RR (/min)",  field: "respiratoryRate",placeholder: "16"   },
                { label: "Temp (°C)",  field: "temperature",    placeholder: "36.5" },
                { label: "SpO₂ (%)",   field: "oxygenSaturation",placeholder: "98" },
                { label: "GCS (3-15)", field: "gcsScore",       placeholder: "15"   }
              ].map(v => (
                <div key={v.field}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    {v.label}
                  </label>
                  <input
                    type="number"
                    value={form[v.field]}
                    onChange={e => set(v.field, e.target.value)}
                    placeholder={v.placeholder}
                    className={INPUT}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="flex-1 py-3 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" />
            {submitting ? "Creating..." : "Create Emergency Case"}
          </button>
        </div>
      </div>
    </div>
  )
}