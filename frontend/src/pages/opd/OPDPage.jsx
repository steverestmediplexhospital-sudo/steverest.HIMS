// src/pages/opd/OPDPage.jsx
import { useState, useEffect, useCallback, useRef } from "react"
import {
  Users, Clock, CheckCircle, AlertTriangle, Search,
  Plus, RefreshCw, X, Save, Loader2, ChevronRight,
  Activity, Stethoscope, FlaskConical, Pill, LogOut,
  User, Calendar, Phone, MapPin, Filter, Eye,
  ArrowRight, Timer, Bell, TrendingUp, Hash,
  UserCheck, Clipboard, Heart, Info, Edit3,
  CircleDot, Circle, CheckSquare, MoreVertical,
  Thermometer, Weight, Ruler, Wind
} from "lucide-react"
import api from "../../services/api"
import toast from "react-hot-toast"
import useAuthStore from "../../store/authStore"

// ─── Constants ────────────────────────────────────────────────────────────

const OPD_STAGES = {
  REGISTERED:   { label: "Registered",    color: "bg-gray-100 text-gray-600",     dot: "bg-gray-400",    icon: User,          step: 1 },
  TRIAGE:       { label: "Triage",        color: "bg-blue-100 text-blue-700",     dot: "bg-blue-500",    icon: Activity,      step: 2 },
  WAITING:      { label: "Waiting",       color: "bg-amber-100 text-amber-700",   dot: "bg-amber-500",   icon: Clock,         step: 3 },
  WITH_DOCTOR:  { label: "With Doctor",   color: "bg-purple-100 text-purple-700", dot: "bg-purple-500",  icon: Stethoscope,   step: 4 },
  LAB_PENDING:  { label: "Lab Pending",   color: "bg-cyan-100 text-cyan-700",     dot: "bg-cyan-500",    icon: FlaskConical,  step: 5 },
  PHARMACY:     { label: "Pharmacy",      color: "bg-orange-100 text-orange-700", dot: "bg-orange-500",  icon: Pill,          step: 5 },
  COMPLETED:    { label: "Completed",     color: "bg-emerald-100 text-emerald-700",dot: "bg-emerald-500",icon: CheckCircle,   step: 6 },
  REFERRED:     { label: "Referred",      color: "bg-red-100 text-red-700",       dot: "bg-red-500",     icon: ArrowRight,    step: 6 },
}

const VISIT_TYPES = ["OPD", "EMERGENCY", "FOLLOW_UP", "SPECIALIST"]

const VISIT_TYPE_CONFIG = {
  ALL: {
    label:       "All Patients",
    description: "All OPD visits today",
    color:       "bg-blue-600",
    emptyMsg:    "No patients in queue",
  },
  OPD: {
    label:       "OPD",
    description: "General outpatient visits",
    color:       "bg-blue-500",
    emptyMsg:    "No OPD patients today",
  },
  EMERGENCY: {
    label:       "Emergency",
    description: "Emergency walk-in cases",
    color:       "bg-red-500",
    emptyMsg:    "No emergency cases",
  },
  SPECIALIST: {
    label:       "Specialist",
    description: "Specialist referral clinic",
    color:       "bg-purple-500",
    emptyMsg:    "No specialist appointments",
  },
  FOLLOW_UP: {
    label:       "Follow Up",
    description: "Ward rounds & follow-up patients",
    color:       "bg-green-500",
    emptyMsg:    "No follow-up patients today",
  },
}

const TRIAGE_PRIORITY = {
  IMMEDIATE:  { label: "Immediate",   color: "bg-red-100 text-red-700",      border: "border-red-300"    },
  URGENT:     { label: "Urgent",      color: "bg-orange-100 text-orange-700",border: "border-orange-300" },
  LESS_URGENT:{ label: "Less Urgent", color: "bg-yellow-100 text-yellow-700",border: "border-yellow-300" },
  NON_URGENT: { label: "Non-Urgent",  color: "bg-green-100 text-green-700",  border: "border-green-300"  },
}

// ─── Utility helpers ──────────────────────────────────────────────────────

const fmtTime = (d) => d
  ? new Date(d).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })
  : "—"

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })
  : "—"

const waitTime = (d) => {
  if (!d) return "—"
  const mins = Math.floor((Date.now() - new Date(d)) / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return `${hrs}h ${rem}m`
}

const waitColor = (d) => {
  if (!d) return "text-gray-400"
  const mins = Math.floor((Date.now() - new Date(d)) / 60000)
  if (mins > 120) return "text-red-600 font-bold"
  if (mins > 60)  return "text-amber-600 font-semibold"
  return "text-gray-600"
}

const calcAge = (dob) => {
  if (!dob) return "—"
  const y = new Date().getFullYear() - new Date(dob).getFullYear()
  return `${y}y`
}

// ─── Small shared components ──────────────────────────────────────────────

const SectionLoader = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
    <span className="ml-2 text-gray-400 text-sm">Loading queue…</span>
  </div>
)

// ─── Stage Progress Bar ───────────────────────────────────────────────────

const StageProgress = ({ stage }) => {
  const stages = [
    { key: "REGISTERED",  label: "In",     icon: User        },
    { key: "TRIAGE",      label: "Triage", icon: Activity    },
    { key: "WAITING",     label: "Queue",  icon: Clock       },
    { key: "WITH_DOCTOR", label: "Doctor", icon: Stethoscope },
    { key: "COMPLETED",   label: "Done",   icon: CheckCircle },
  ]

  const currentStep = OPD_STAGES[stage]?.step || 1

  return (
    <div className="flex items-center gap-1">
      {stages.map((s, i) => {
        const Icon   = s.icon
        const sStep  = OPD_STAGES[s.key]?.step || i + 1
        const active = currentStep === sStep
        const past   = currentStep > sStep

        return (
          <div key={s.key} className="flex items-center">
            <div className="flex flex-col items-center gap-0.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                past   ? "bg-emerald-500 text-white" :
                active ? "bg-blue-600 text-white" :
                         "bg-gray-100 text-gray-400"
              }`}>
                <Icon className="w-3 h-3" />
              </div>
              <span className={`text-[9px] font-medium ${
                past ? "text-emerald-600" : active ? "text-blue-600" : "text-gray-400"
              }`}>{s.label}</span>
            </div>
            {i < stages.length - 1 && (
              <div className={`w-4 h-0.5 mb-3 mx-0.5 ${past ? "bg-emerald-400" : "bg-gray-200"}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL — CHECK IN PATIENT
// ════════════════════════════════════════════════════════════════════════════

const CheckInModal = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep]               = useState(1)
  const [patientSearch, setPS]        = useState("")
  const [patients, setPatients]       = useState([])
  const [searching, setSearching]     = useState(false)
  const [selectedPatient, setPatient] = useState(null)
  const [saving, setSaving]           = useState(false)
  const [form, setForm]               = useState({
    visitType: "OPD", chiefComplaint: "", assignedDoctorId: "", notes: "",
  })
  const [doctors, setDoctors] = useState([])
  const searchTimeout         = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      setStep(1); setPS(""); setPatients([]); setPatient(null)
      setForm({ visitType: "OPD", chiefComplaint: "", assignedDoctorId: "", notes: "" })
      return
    }
    const loadDoctors = async () => {
      try {
        const res = await api.get("/admin/users?role=DOCTOR&limit=50")
        setDoctors(res.data.data?.users || res.data.users || [])
      } catch { setDoctors([]) }
    }
    loadDoctors()
  }, [isOpen])

  useEffect(() => {
    if (!patientSearch.trim() || patientSearch.length < 2) {
      setPatients([]); return
    }
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await api.get(`/patients?search=${encodeURIComponent(patientSearch)}&limit=10`)
        setPatients(res.data.data?.patients || res.data.patients || [])
      } catch { setPatients([]) }
      finally { setSearching(false) }
    }, 400)
    return () => clearTimeout(searchTimeout.current)
  }, [patientSearch])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleCheckIn = async () => {
    if (!selectedPatient)             return toast.error("Select a patient first")
    if (!form.chiefComplaint.trim())  return toast.error("Chief complaint is required")
    setSaving(true)
    try {
      await api.post("/visits", {
        patientId:        selectedPatient.id,
        visitType:        form.visitType,
        chiefComplaint:   form.chiefComplaint,
        assignedDoctorId: form.assignedDoctorId || null,
        notes:            form.notes,
        department:       "OPD",
      })
      toast.success(`${selectedPatient.firstName} ${selectedPatient.lastName} checked in successfully`)
      onSuccess()
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.message || "Check-in failed")
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <UserCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">OPD Check-In</h2>
              <p className="text-xs text-gray-400">
                Step {step} of 2 — {step === 1 ? "Find Patient" : "Visit Details"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex px-6 pt-4 gap-2">
          {[1, 2].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${s <= step ? "bg-blue-600" : "bg-gray-100"}`} />
          ))}
        </div>

        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Search Patient by Name, ID or Phone
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    autoFocus
                    value={patientSearch}
                    onChange={e => setPS(e.target.value)}
                    placeholder="Type name, patient ID, or phone…"
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />
                  )}
                </div>
              </div>

              {patients.length > 0 && (
                <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                  {patients.map((p, i) => (
                    <button key={p.id}
                      onClick={() => { setPatient(p); setStep(2) }}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-left transition-colors ${
                        i < patients.length - 1 ? "border-b border-gray-50" : ""
                      }`}>
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <span className="text-blue-700 font-bold text-sm">
                          {p.firstName?.charAt(0) || "?"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">
                          {p.firstName} {p.lastName}
                        </p>
                        <p className="text-xs text-gray-400">
                          {p.mrn} · {calcAge(p.dateOfBirth)} · {p.gender}
                        </p>
                      </div>
                      <div className="text-xs text-gray-400 shrink-0">{p.phone || "No phone"}</div>
                      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {patientSearch.length >= 2 && !searching && patients.length === 0 && (
                <div className="text-center py-6 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">No patients found for "{patientSearch}"</p>
                  <p className="text-xs text-gray-400 mt-1">Register the patient at Reception first</p>
                </div>
              )}

              {patientSearch.length < 2 && (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Type at least 2 characters to search</p>
                </div>
              )}
            </div>
          )}

          {step === 2 && selectedPatient && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center shrink-0">
                  <span className="text-blue-800 font-bold">
                    {selectedPatient.firstName?.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-blue-900 text-sm">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </p>
                  <p className="text-xs text-blue-600">
                    {selectedPatient.mrn} · {calcAge(selectedPatient.dateOfBirth)} · {selectedPatient.gender}
                  </p>
                </div>
                <button onClick={() => setStep(1)} className="text-xs text-blue-600 hover:underline">
                  Change
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Visit Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {VISIT_TYPES.map(vt => (
                    <button key={vt} onClick={() => set("visitType", vt)}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all ${
                        form.visitType === vt
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}>
                      {vt.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Chief Complaint *
                </label>
                <textarea
                  value={form.chiefComplaint}
                  onChange={e => set("chiefComplaint", e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder="Main reason for visit today…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Assign to Doctor (optional)
                </label>
                <select
                  value={form.assignedDoctorId}
                  onChange={e => set("assignedDoctorId", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Auto-assign / Walk-in queue —</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>
                      Dr. {d.firstName} {d.lastName}
                      {d.specialization ? ` (${d.specialization})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                <input
                  value={form.notes}
                  onChange={e => set("notes", e.target.value)}
                  placeholder="Any additional notes for the visit…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-3 px-6 py-4 border-t border-gray-100">
          {step === 1 ? (
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          ) : (
            <button onClick={() => setStep(1)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              ← Back
            </button>
          )}
          {step === 2 && (
            <button onClick={handleCheckIn} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
              Check In
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL — QUICK TRIAGE
// ════════════════════════════════════════════════════════════════════════════

const TriageModal = ({ isOpen, onClose, onSuccess, visit }) => {
  const [form, setForm] = useState({
    priority: "NON_URGENT", systolicBP: "", diastolicBP: "",
    heartRate: "", temperature: "", oxygenSaturation: "",
    respiratoryRate: "", weight: "", height: "", notes: "",
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setForm({
        priority: "NON_URGENT", systolicBP: "", diastolicBP: "",
        heartRate: "", temperature: "", oxygenSaturation: "",
        respiratoryRate: "", weight: "", height: "", notes: "",
      })
    }
  }, [isOpen])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!visit) return
    setSaving(true)
    try {
      await api.post(`/visits/${visit.id}/triage`, {
        priority:       form.priority,
        chiefComplaint: visit.chiefComplaint,
        notes:          form.notes,
      })
      const hasVitals = form.systolicBP || form.heartRate || form.temperature || form.oxygenSaturation
      if (hasVitals) {
        await api.post(`/visits/${visit.id}/vitals`, {
          systolicBP:       form.systolicBP       ? Number(form.systolicBP)       : null,
          diastolicBP:      form.diastolicBP      ? Number(form.diastolicBP)      : null,
          heartRate:        form.heartRate        ? Number(form.heartRate)        : null,
          temperature:      form.temperature      ? Number(form.temperature)      : null,
          oxygenSaturation: form.oxygenSaturation ? Number(form.oxygenSaturation): null,
          respiratoryRate:  form.respiratoryRate  ? Number(form.respiratoryRate)  : null,
          weight:           form.weight           ? Number(form.weight)           : null,
          height:           form.height           ? Number(form.height)           : null,
        })
      }
      toast.success("Triage recorded — patient moved to doctor queue")
      onSuccess()
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to save triage")
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen || !visit) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-xl">
              <Activity className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Quick Triage</h2>
              <p className="text-xs text-gray-400">
                {visit.patient?.firstName} {visit.patient?.lastName} · {visit.visitId}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">
              Triage Priority *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TRIAGE_PRIORITY).map(([k, v]) => (
                <button key={k} onClick={() => set("priority", k)}
                  className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    form.priority === k
                      ? `${v.border} ${v.color}`
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">
              Vital Signs <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "systolicBP",       label: "Systolic BP",  placeholder: "120",  unit: "mmHg", icon: Activity    },
                { key: "diastolicBP",      label: "Diastolic BP", placeholder: "80",   unit: "mmHg", icon: Activity    },
                { key: "heartRate",        label: "Heart Rate",   placeholder: "72",   unit: "bpm",  icon: Heart       },
                { key: "temperature",      label: "Temperature",  placeholder: "36.6", unit: "°C",   icon: Thermometer },
                { key: "oxygenSaturation", label: "SpO₂",         placeholder: "98",   unit: "%",    icon: Wind        },
                { key: "respiratoryRate",  label: "Resp. Rate",   placeholder: "16",   unit: "/min", icon: Wind        },
                { key: "weight",           label: "Weight",       placeholder: "70",   unit: "kg",   icon: Weight      },
                { key: "height",           label: "Height",       placeholder: "170",  unit: "cm",   icon: Ruler       },
              ].map(f => {
                const Icon = f.icon
                return (
                  <div key={f.key}>
                    <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Icon className="w-3 h-3" /> {f.label}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={form[f.key]}
                        onChange={e => set(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        {f.unit}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Triage Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              rows={2}
              placeholder="Clinical observations at triage…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            Save Triage
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PATIENT CARD
// ════════════════════════════════════════════════════════════════════════════

const PatientCard = ({ visit, onTriage, onView, onUpdateStatus, userRole }) => {
  const stage     = OPD_STAGES[visit.status] || OPD_STAGES.REGISTERED
  const StageIcon = stage.icon
  const triage    = visit.triage?.[0]
  const priority  = triage ? TRIAGE_PRIORITY[triage.priority] : null
  const vitals    = visit.vitalSigns?.[0]
  const isNurse   = ["NURSE","MIDWIFE","THEATRE_NURSE"].includes(userRole)
  const isDoctor  = ["DOCTOR","SURGEON","MEDICAL_DIRECTOR"].includes(userRole)
  const canTriage = isNurse || ["CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN"].includes(userRole)

  return (
    <div className={`bg-white border rounded-xl overflow-hidden hover:shadow-md transition-all ${
      priority?.border
        ? `border-l-4 ${priority.border} border-t border-r border-b border-gray-100`
        : "border-gray-100"
    }`}>
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <span className="text-blue-700 font-bold text-sm">
                {visit.patient?.firstName?.charAt(0) || "?"}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">
                {visit.patient?.firstName} {visit.patient?.lastName}
              </p>
              <p className="text-xs text-gray-400">
                {calcAge(visit.patient?.dateOfBirth)} · {visit.patient?.gender} · {visit.patient?.mrn}
              </p>
            </div>
          </div>
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${stage.color}`}>
            <StageIcon className="w-3 h-3" />
            {stage.label}
          </span>
        </div>

        {priority && (
          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold mb-2 ${priority.color}`}>
            <AlertTriangle className="w-3 h-3" />
            {TRIAGE_PRIORITY[triage.priority]?.label}
          </div>
        )}

        {visit.chiefComplaint && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-1.5 mb-2 line-clamp-2">
            💬 {visit.chiefComplaint}
          </p>
        )}

        {vitals && (
          <div className="flex flex-wrap gap-2 mb-2">
            {vitals.heartRate && (
              <span className="flex items-center gap-1 text-xs text-gray-500 bg-pink-50 px-2 py-0.5 rounded-lg">
                <Heart className="w-3 h-3 text-pink-400" /> {vitals.heartRate}bpm
              </span>
            )}
            {vitals.systolicBP && (
              <span className="flex items-center gap-1 text-xs text-gray-500 bg-blue-50 px-2 py-0.5 rounded-lg">
                <Activity className="w-3 h-3 text-blue-400" /> {vitals.systolicBP}/{vitals.diastolicBP}
              </span>
            )}
            {vitals.temperature && (
              <span className="flex items-center gap-1 text-xs text-gray-500 bg-orange-50 px-2 py-0.5 rounded-lg">
                <Thermometer className="w-3 h-3 text-orange-400" /> {vitals.temperature}°C
              </span>
            )}
            {vitals.oxygenSaturation && (
              <span className="flex items-center gap-1 text-xs text-gray-500 bg-teal-50 px-2 py-0.5 rounded-lg">
                <Wind className="w-3 h-3 text-teal-400" /> {vitals.oxygenSaturation}%
              </span>
            )}
          </div>
        )}

        <div className="mt-2">
          <StageProgress stage={visit.status} />
        </div>
      </div>

      <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className={`flex items-center gap-1 ${waitColor(visit.createdAt)}`}>
            <Timer className="w-3 h-3" />
            {waitTime(visit.createdAt)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {fmtTime(visit.createdAt)}
          </span>
          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
            visit.visitType === "EMERGENCY" ? "bg-red-100 text-red-700" :
            visit.visitType === "FOLLOW_UP" ? "bg-green-100 text-green-700" :
            visit.visitType === "SPECIALIST" ? "bg-purple-100 text-purple-700" :
            "bg-blue-100 text-blue-700"
          }`}>
            {visit.visitType || "OPD"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {canTriage && (!triage || visit.status === "REGISTERED") && (
            <button onClick={() => onTriage(visit)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700">
              <Activity className="w-3 h-3" /> Triage
            </button>
          )}
          {isDoctor && visit.status !== "COMPLETED" && (
            <button onClick={() => onView(visit)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700">
              <Stethoscope className="w-3 h-3" /> Consult
            </button>
          )}
          <button onClick={() => onView(visit)}
            className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm text-gray-400 hover:text-gray-700 transition-all">
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// VISIT DETAIL DRAWER
// ════════════════════════════════════════════════════════════════════════════

const VisitDrawer = ({ visit, onClose, onTriage, userRole }) => {
  if (!visit) return null

  const stage    = OPD_STAGES[visit.status] || OPD_STAGES.REGISTERED
  const triage   = visit.triage?.[0]
  const vitals   = visit.vitalSigns?.[0]
  const isDoctor = ["DOCTOR","SURGEON","MEDICAL_DIRECTOR"].includes(userRole)

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-2xl overflow-y-auto flex flex-col">

        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-700 font-bold text-lg">
                {visit.patient?.firstName?.charAt(0) || "?"}
              </span>
            </div>
            <div className="flex gap-2">
              {isDoctor && (
                <button
                  onClick={() => window.location.href = `/doctor/consult/${visit.id}`}
                  className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-xl text-xs font-semibold hover:bg-purple-700">
                  <Stethoscope className="w-3.5 h-3.5" /> Open Consultation
                </button>
              )}
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          <h2 className="font-bold text-gray-900 text-lg">
            {visit.patient?.firstName} {visit.patient?.lastName}
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {visit.patient?.mrn} · {calcAge(visit.patient?.dateOfBirth)} · {visit.patient?.gender}
          </p>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <Phone className="w-3 h-3" /> {visit.patient?.phone || "No phone"}
          </p>

          <div className="flex items-center gap-2 mt-3">
            <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${stage.color}`}>
              {stage.label}
            </span>
            <span className="text-xs text-gray-400">Visit: {visit.visitId}</span>
          </div>
        </div>

        <div className="flex-1 p-6 space-y-5">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Visit Details
            </h3>
            <div className="space-y-2">
              {[
                ["Check-in Time",   fmtTime(visit.createdAt)],
                ["Visit Type",      visit.visitType || "OPD"],
                ["Department",      visit.department || "OPD"],
                ["Chief Complaint", visit.chiefComplaint || "—"],
                ["Assigned Doctor", visit.doctor ? `Dr. ${visit.doctor.firstName} ${visit.doctor.lastName}` : "Unassigned"],
                ["Wait Time",       waitTime(visit.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-start py-2 border-b border-gray-50">
                  <span className="text-xs text-gray-500 shrink-0">{label}</span>
                  <span className="text-xs font-semibold text-gray-800 text-right ml-2">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {triage ? (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Triage</h3>
              <div className={`p-3 rounded-xl border ${TRIAGE_PRIORITY[triage.priority]?.border || "border-gray-200"} ${TRIAGE_PRIORITY[triage.priority]?.color || ""}`}>
                <p className="text-sm font-bold">{TRIAGE_PRIORITY[triage.priority]?.label}</p>
                {triage.notes && <p className="text-xs mt-1">{triage.notes}</p>}
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Triage</h3>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                <p className="text-xs text-amber-700">Not yet triaged</p>
                <button
                  onClick={() => { onClose(); onTriage(visit) }}
                  className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700">
                  Triage Now
                </button>
              </div>
            </div>
          )}

          {vitals && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                Latest Vitals
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "BP",     value: vitals.systolicBP       ? `${vitals.systolicBP}/${vitals.diastolicBP} mmHg` : null, icon: Activity,    color: "text-blue-500",   bg: "bg-blue-50"   },
                  { label: "HR",     value: vitals.heartRate        ? `${vitals.heartRate} bpm`    : null, icon: Heart,       color: "text-pink-500",   bg: "bg-pink-50"   },
                  { label: "Temp",   value: vitals.temperature      ? `${vitals.temperature}°C`    : null, icon: Thermometer, color: "text-orange-500", bg: "bg-orange-50" },
                  { label: "SpO₂",  value: vitals.oxygenSaturation ? `${vitals.oxygenSaturation}%`: null, icon: Wind,        color: "text-teal-500",   bg: "bg-teal-50"   },
                  { label: "Weight", value: vitals.weight           ? `${vitals.weight} kg`        : null, icon: Weight,      color: "text-purple-500", bg: "bg-purple-50" },
                  { label: "RR",     value: vitals.respiratoryRate  ? `${vitals.respiratoryRate}/min`: null,icon: Wind,       color: "text-cyan-500",   bg: "bg-cyan-50"   },
                ].filter(v => v.value).map(v => {
                  const Icon = v.icon
                  return (
                    <div key={v.label} className={`${v.bg} rounded-xl p-3 flex items-center gap-2`}>
                      <Icon className={`w-4 h-4 ${v.color}`} />
                      <div>
                        <p className="text-xs text-gray-400">{v.label}</p>
                        <p className="text-sm font-bold text-gray-800">{v.value}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Quick Actions
            </h3>
            <div className="space-y-2">
              {[
                { label: "View Full Patient Chart", href: `/doctor/patient/${visit.patientId}`, icon: Eye         },
                { label: "Open Consultation",       href: `/doctor/consult/${visit.id}`,        icon: Stethoscope },
              ].map(link => {
                const Icon = link.icon
                return (
                  <a key={link.label} href={link.href}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-blue-50 hover:text-blue-700 text-gray-700 transition-colors">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Icon className="w-4 h-4" /> {link.label}
                    </div>
                    <ChevronRight className="w-4 h-4" />
                  </a>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// STATS BAR
// ════════════════════════════════════════════════════════════════════════════

const StatBar = ({ stats }) => {
  const items = [
    { label: "Total Today", value: stats.total,      color: "text-blue-700",    bg: "bg-blue-50",    icon: Users      },
    { label: "Waiting",     value: stats.waiting,    color: "text-amber-700",   bg: "bg-amber-50",   icon: Clock      },
    { label: "With Doctor", value: stats.withDoctor, color: "text-purple-700",  bg: "bg-purple-50",  icon: Stethoscope},
    { label: "Completed",   value: stats.completed,  color: "text-emerald-700", bg: "bg-emerald-50", icon: CheckCircle},
    { label: "Avg Wait",    value: stats.avgWait,    color: "text-gray-700",    bg: "bg-gray-50",    icon: Timer      },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map(it => {
        const Icon = it.icon
        return (
          <div key={it.label} className={`${it.bg} rounded-xl p-3 flex items-center gap-3`}>
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

export default function OPDPage() {
  const { user } = useAuthStore()
  const [visits,       setVisits]    = useState([])
  const [loading,      setLoading]   = useState(true)
  const [search,       setSearch]    = useState("")
  const [stageFilter,  setSF]        = useState("ALL")
  const [typeFilter,   setTF]        = useState("ALL")
  const [refreshKey,   setRK]        = useState(0)
  const [checkInModal, setCheckIn]   = useState(false)
  const [triageModal,  setTriage]    = useState(false)
  const [triageVisit,  setTV]        = useState(null)
  const [drawerVisit,  setDrawer]    = useState(null)
  const autoRefresh = useRef(null)

  // ── Stats ──────────────────────────────────────────────────────────────
  const stats = {
    total:      visits.length,
    waiting:    visits.filter(v => ["WAITING","REGISTERED"].includes(v.status)).length,
    withDoctor: visits.filter(v => v.status === "WITH_DOCTOR").length,
    completed:  visits.filter(v => v.status === "COMPLETED").length,
    avgWait: (() => {
      const active = visits.filter(v => v.status !== "COMPLETED" && v.createdAt)
      if (!active.length) return "—"
      const avg  = active.reduce((s, v) => s + (Date.now() - new Date(v.createdAt)), 0) / active.length
      const mins = Math.floor(avg / 60000)
      return mins < 60 ? `${mins}m` : `${Math.floor(mins/60)}h${mins%60}m`
    })(),
  }

  // ── Load visits ────────────────────────────────────────────────────────
  const loadVisits = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const res   = await api.get(`/visits?date=${today}&department=OPD&limit=200`)
      const list  = res.data.data?.visits || res.data.visits || []
      list.sort((a, b) => {
        const order = { IMMEDIATE: 0, URGENT: 1, LESS_URGENT: 2, NON_URGENT: 3 }
        const pa = a.triage?.[0]?.priority
        const pb = b.triage?.[0]?.priority
        if (pa && pb && order[pa] !== order[pb]) return order[pa] - order[pb]
        return new Date(a.createdAt) - new Date(b.createdAt)
      })
      setVisits(list)
    } catch {
      setVisits([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    loadVisits()
    autoRefresh.current = setInterval(loadVisits, 30000)
    return () => clearInterval(autoRefresh.current)
  }, [loadVisits, refreshKey])

  // ── Filter ─────────────────────────────────────────────────────────────
  const filtered = visits.filter(v => {
    const matchSearch = !search
      || `${v.patient?.firstName} ${v.patient?.lastName}`.toLowerCase().includes(search.toLowerCase())
      || v.patient?.mrn?.toLowerCase().includes(search.toLowerCase())
      || v.visitId?.toLowerCase().includes(search.toLowerCase())
    const matchStage = stageFilter === "ALL" || v.status === stageFilter
    const matchType  = typeFilter  === "ALL" || v.visitType === typeFilter
    return matchSearch && matchStage && matchType
  })

  const openTriage    = (visit) => { setTV(visit); setTriage(true) }
  const openDrawer    = (visit) => setDrawer(visit)
  const handleSuccess = () => { setRK(k => k + 1); setLoading(true) }

  const stageCounts = Object.keys(OPD_STAGES).reduce((acc, key) => {
    acc[key] = visits.filter(v =>
      v.status === key &&
      (typeFilter === "ALL" || v.visitType === typeFilter)
    ).length
    return acc
  }, {})

  const canCheckIn = [
    "RECEPTIONIST","NURSE","CLINICAL_COORDINATOR",
    "SUPER_ADMIN","HOSPITAL_ADMIN","MEDICAL_RECORDS_OFFICER"
  ].includes(user?.role)

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Page Header ── */}
      <div className="bg-white border-b border-gray-100 px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-2xl">
                <Users className="w-7 h-7 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">OPD Queue</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Outpatient Department · {new Date().toLocaleDateString("en-NG", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric"
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-xl">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live · refreshes every 30s
              </div>
              <button
                onClick={() => { setLoading(true); loadVisits() }}
                className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500"
                title="Refresh now">
                <RefreshCw className="w-4 h-4" />
              </button>
              {canCheckIn && (
                <button
                  onClick={() => setCheckIn(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 shadow-sm">
                  <Plus className="w-4 h-4" /> Check In Patient
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">

        {/* ── Stats ── */}
        <StatBar stats={stats} />

        {/* ── Visit Type Tab Bar ── */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">

          {/* Type tabs */}
          <div className="flex border-b border-gray-100 overflow-x-auto">
            {Object.entries(VISIT_TYPE_CONFIG).map(([key, cfg]) => {
              const count  = key === "ALL"
                ? visits.length
                : visits.filter(v => v.visitType === key).length
              const active = typeFilter === key
              return (
                <button
                  key={key}
                  onClick={() => { setTF(key); setSF("ALL") }}
                  className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all ${
                    active
                      ? "border-blue-600 text-blue-700 bg-blue-50"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${
                    key === "EMERGENCY" ? "bg-red-500" :
                    key === "SPECIALIST" ? "bg-purple-500" :
                    key === "FOLLOW_UP" ? "bg-green-500" :
                    key === "OPD" ? "bg-blue-500" :
                    "bg-gray-400"
                  }`} />
                  {cfg.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                    active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                  }`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="p-4 space-y-3">

            {/* Description bar */}
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-500">
                {VISIT_TYPE_CONFIG[typeFilter]?.description}
              </p>
              {typeFilter === "FOLLOW_UP" && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  Ward Rounds
                </span>
              )}
              {typeFilter === "EMERGENCY" && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium animate-pulse">
                  🚨 Priority Queue
                </span>
              )}
              {typeFilter === "SPECIALIST" && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                  By Appointment
                </span>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Search ${VISIT_TYPE_CONFIG[typeFilter]?.label || ""} patients…`}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Stage tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSF("ALL")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                  stageFilter === "ALL"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                All ({typeFilter === "ALL" ? visits.length : visits.filter(v => v.visitType === typeFilter).length})
              </button>

              {Object.entries(OPD_STAGES).map(([key, cfg]) => {
                const Icon  = cfg.icon
                const count = stageCounts[key] || 0
                const active = stageFilter === key
                return (
                  <button key={key}
                    onClick={() => setSF(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                      active
                        ? "bg-blue-600 text-white border-blue-600"
                        : `bg-white text-gray-600 border-gray-200 hover:bg-gray-50 ${count === 0 ? "opacity-40" : ""}`
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {cfg.label}
                    {count > 0 && (
                      <span className={`font-bold ${active ? "text-white" : cfg.color.split(" ")[1]}`}>
                        ({count})
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Queue Grid ── */}
        {loading ? (
          <SectionLoader />
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl">
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                typeFilter === "EMERGENCY" ? "bg-red-50" :
                typeFilter === "SPECIALIST" ? "bg-purple-50" :
                typeFilter === "FOLLOW_UP" ? "bg-green-50" :
                "bg-blue-50"
              }`}>
                {typeFilter === "EMERGENCY"  ? <AlertTriangle className="w-8 h-8 text-red-300" />    :
                 typeFilter === "SPECIALIST" ? <Stethoscope   className="w-8 h-8 text-purple-300" /> :
                 typeFilter === "FOLLOW_UP"  ? <RefreshCw     className="w-8 h-8 text-green-300" />  :
                                              <Users          className="w-8 h-8 text-blue-300" />
                }
              </div>
              <p className="font-semibold text-gray-700">
                {VISIT_TYPE_CONFIG[typeFilter]?.emptyMsg || "No patients found"}
              </p>
              <p className="text-sm text-gray-400 mt-1 mb-5">
                {typeFilter === "FOLLOW_UP"
                  ? "Follow-up patients due for ward rounds will appear here"
                  : typeFilter === "EMERGENCY"
                  ? "Emergency cases will appear here in real-time"
                  : typeFilter === "SPECIALIST"
                  ? "Specialist referral patients will appear here"
                  : "Check in a patient to get started"
                }
              </p>
              {(typeFilter === "ALL" || typeFilter === "OPD") && canCheckIn && (
                <button
                  onClick={() => setCheckIn(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
                  <Plus className="w-4 h-4" /> Check In Patient
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Summary line */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing{" "}
                <span className="font-semibold text-gray-800">{filtered.length}</span>{" "}
                patient{filtered.length !== 1 ? "s" : ""}
                {typeFilter !== "ALL" && (
                  <span> · <span className="font-semibold">{VISIT_TYPE_CONFIG[typeFilter]?.label}</span></span>
                )}
                {stageFilter !== "ALL" && (
                  <span> in <span className="font-semibold">{OPD_STAGES[stageFilter]?.label}</span></span>
                )}
              </p>
              {filtered.some(v => v.triage?.[0]?.priority === "IMMEDIATE") && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-xl text-xs font-bold animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  IMMEDIATE priority patients present
                </div>
              )}
            </div>

            {/* Follow Up — Ward Rounds view */}
            {typeFilter === "FOLLOW_UP" ? (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">Ward Rounds Mode</p>
                    <p className="text-xs text-green-600">
                      Showing follow-up patients — tap Consult to open ward round notes
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filtered.map(visit => (
                    <PatientCard
                      key={visit.id}
                      visit={visit}
                      onTriage={openTriage}
                      onView={openDrawer}
                      onUpdateStatus={handleSuccess}
                      userRole={user?.role}
                    />
                  ))}
                </div>
              </div>
            ) : typeFilter === "EMERGENCY" ? (
              <div className="space-y-3">
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 animate-pulse" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">
                      Emergency Queue — Priority Order
                    </p>
                    <p className="text-xs text-red-600">
                      Patients sorted by triage priority. IMMEDIATE cases appear first.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filtered.map(visit => (
                    <PatientCard
                      key={visit.id}
                      visit={visit}
                      onTriage={openTriage}
                      onView={openDrawer}
                      onUpdateStatus={handleSuccess}
                      userRole={user?.role}
                    />
                  ))}
                </div>
              </div>
            ) : typeFilter === "SPECIALIST" ? (
              <div className="space-y-3">
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-center gap-3">
                  <Stethoscope className="w-5 h-5 text-purple-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-purple-800">Specialist Clinic</p>
                    <p className="text-xs text-purple-600">
                      Referral and specialist appointment patients
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filtered.map(visit => (
                    <PatientCard
                      key={visit.id}
                      visit={visit}
                      onTriage={openTriage}
                      onView={openDrawer}
                      onUpdateStatus={handleSuccess}
                      userRole={user?.role}
                    />
                  ))}
                </div>
              </div>
            ) : (
              /* Default OPD / ALL */
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(visit => (
                  <PatientCard
                    key={visit.id}
                    visit={visit}
                    onTriage={openTriage}
                    onView={openDrawer}
                    onUpdateStatus={handleSuccess}
                    userRole={user?.role}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Flow Guide ── */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-100 rounded-xl shrink-0">
              <Info className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-800 text-sm mb-3">OPD Patient Flow</h3>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { label: "1. Check-In",    icon: UserCheck,   color: "bg-gray-100 text-gray-700"     },
                  { label: "2. Triage",       icon: Activity,    color: "bg-blue-100 text-blue-700"     },
                  { label: "3. Doctor Queue", icon: Clock,       color: "bg-amber-100 text-amber-700"   },
                  { label: "4. Consultation", icon: Stethoscope, color: "bg-purple-100 text-purple-700" },
                  { label: "5. Lab/Pharmacy", icon: FlaskConical,color: "bg-cyan-100 text-cyan-700"    },
                  { label: "6. Discharge",    icon: CheckCircle, color: "bg-emerald-100 text-emerald-700"},
                ].map((step, i, arr) => {
                  const Icon = step.icon
                  return (
                    <div key={step.label} className="flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${step.color}`}>
                        <Icon className="w-3.5 h-3.5" /> {step.label}
                      </div>
                      {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-blue-400 shrink-0" />}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── Modals ── */}
      <CheckInModal
        isOpen={checkInModal}
        onClose={() => setCheckIn(false)}
        onSuccess={handleSuccess}
      />
      <TriageModal
        isOpen={triageModal}
        onClose={() => { setTriage(false); setTV(null) }}
        onSuccess={handleSuccess}
        visit={triageVisit}
      />
      <VisitDrawer
        visit={drawerVisit}
        onClose={() => setDrawer(null)}
        onTriage={openTriage}
        userRole={user?.role}
      />
    </div>
  )
}