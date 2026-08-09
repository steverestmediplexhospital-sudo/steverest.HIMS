// frontend/src/pages/maternity/MaternityPage.jsx
import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import useAuthStore from "../../store/authStore"
import api from "../../services/api"
import toast from "react-hot-toast"
import {
  Heart, Plus, Search, RefreshCw, X, CheckCircle,
  AlertTriangle, Calendar, Clock, User, Phone,
  FileText, Activity, Thermometer, TrendingUp,
  Baby, Star, Shield, Eye, Edit, ChevronRight,
  ChevronDown, Droplets, Wind, Hash, MapPin,
  ArrowRight, BarChart3, Stethoscope, FlaskConical,
  Clipboard, Users, BookOpen, Zap
} from "lucide-react"

// ─── Constants ────────────────────────────────────────────────────────────────
const RISK_CONFIG = {
  LOW:      { color: "green",  bg: "bg-green-100",  text: "text-green-700",  label: "Low Risk"    },
  MODERATE: { color: "yellow", bg: "bg-yellow-100", text: "text-yellow-700", label: "Moderate Risk"},
  HIGH:     { color: "red",    bg: "bg-red-100",    text: "text-red-700",    label: "High Risk"   }
}

const DELIVERY_MODES = [
  { value: "NORMAL_VAGINAL",   label: "Normal Vaginal Delivery (NVD)" },
  { value: "CAESAREAN_SECTION",label: "Caesarean Section (C/S)"        },
  { value: "ASSISTED_VAGINAL", label: "Assisted Vaginal (Forceps/Vacuum)" },
  { value: "BREECH",           label: "Breech Delivery"                }
]

const TABS = [
  { key: "antenatal", label: "Antenatal (ANC)",  icon: Heart    },
  { key: "labour",    label: "Labour & Delivery", icon: Baby     },
  { key: "newborn",   label: "Newborn Records",   icon: Star     },
  { key: "postnatal", label: "Postnatal Care",    icon: Shield   }
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const calcAge = (dob) => {
  if (!dob) return "N/A"
  return Math.floor((new Date() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000)) + "y"
}

const formatDate = (dt) => dt
  ? new Date(dt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
  : "—"

const formatDateTime = (dt) => dt
  ? new Date(dt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
  : "—"

const calcEDD = (lmp) => {
  if (!lmp) return null
  const d = new Date(lmp)
  d.setDate(d.getDate() + 280)
  return d
}

const calcGA = (lmp) => {
  if (!lmp) return null
  const days = Math.floor((new Date() - new Date(lmp)) / (1000 * 60 * 60 * 24))
  const weeks = Math.floor(days / 7)
  const rem   = days % 7
  return `${weeks}w ${rem}d`
}

const daysToEDD = (edd) => {
  if (!edd) return null
  return Math.ceil((new Date(edd) - new Date()) / (1000 * 60 * 60 * 24))
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, color, sub }) => (
  <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
    <div className={`w-10 h-10 rounded-xl bg-${color}-100 flex items-center justify-center mb-3`}>
      <Icon className={`w-5 h-5 text-${color}-600`} />
    </div>
    <p className="text-2xl font-bold text-gray-800">{value ?? 0}</p>
    <p className="text-sm font-medium text-gray-600 mt-0.5">{label}</p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </div>
)

// ─── ANC Registration Modal ───────────────────────────────────────────────────
const ANCRegisterModal = ({ isOpen, onClose, onSuccess }) => {
  const [step,   setStep]   = useState(1)
  const [saving, setSaving] = useState(false)
  const [patients,  setPatients]  = useState([])
  const [searching, setSearching] = useState(false)
  const [form, setForm] = useState({
    // Patient
    patientSearch: "", patientId: "", patientName: "",
    // Obstetric history
    gravida: "", para: "", lmp: "", edd: "",
    // Screening
    bloodGroup: "", rhFactor: "", hivStatus: "UNKNOWN",
    syphilisStatus: "UNKNOWN", hbsAgStatus: "UNKNOWN",
    // Risk
    riskLevel: "LOW",
    // Notes
    notes: ""
  })

  const searchPatients = async (q) => {
    if (q.length < 2) { setPatients([]); return }
    setSearching(true)
    try {
      const r = await api.get(`/patients?search=${q}&limit=5`)
      setPatients(r.data.data?.patients || r.data.patients || [])
    } catch { } finally { setSearching(false) }
  }

  const handleLMPChange = (lmp) => {
    const edd = calcEDD(lmp)
    setForm(prev => ({
      ...prev,
      lmp,
      edd: edd ? edd.toISOString().split("T")[0] : ""
    }))
  }

  const handleSubmit = async () => {
    if (!form.patientId) return toast.error("Select a patient")
    if (!form.lmp)       return toast.error("LMP date is required")
    setSaving(true)
    try {
      await api.post("/maternity/antenatal", {
        patientId:     form.patientId,
        lmp:           form.lmp,
        edd:           form.edd,
        gravida:       form.gravida ? parseInt(form.gravida) : null,
        para:          form.para    ? parseInt(form.para)    : null,
        bloodGroup:    form.bloodGroup    || null,
        rhFactor:      form.rhFactor      || null,
        hivStatus:     form.hivStatus,
        syphilisStatus:form.syphilisStatus,
        hbsAgStatus:   form.hbsAgStatus,
        riskLevel:     form.riskLevel,
        notes:         form.notes
      })
      toast.success("ANC record created successfully!")
      onSuccess()
      onClose()
      setStep(1)
      setForm({
        patientSearch: "", patientId: "", patientName: "",
        gravida: "", para: "", lmp: "", edd: "",
        bloodGroup: "", rhFactor: "", hivStatus: "UNKNOWN",
        syphilisStatus: "UNKNOWN", hbsAgStatus: "UNKNOWN",
        riskLevel: "LOW", notes: ""
      })
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to register ANC")
    } finally { setSaving(false) }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-500" />
              Register Antenatal Patient
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Step {step} of 2</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        {/* Step indicators */}
        <div className="flex px-5 pt-4 gap-2">
          {["Patient & Obstetric History", "Screening & Risk Assessment"].map((s, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full ${step > i ? "bg-pink-500" : "bg-gray-200"}`} />
          ))}
        </div>

        <div className="p-5 space-y-5">
          {step === 1 && (
            <>
              {/* Patient Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patient *
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={form.patientSearch}
                    onChange={e => {
                      setForm(prev => ({ ...prev, patientSearch: e.target.value }))
                      searchPatients(e.target.value)
                    }}
                    placeholder="Search patient by name or MRN..."
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-500"
                  />
                </div>
                {patients.length > 0 && (
                  <div className="border border-gray-200 rounded-xl mt-1 overflow-hidden">
                    {patients.map(p => (
                      <div key={p.id}
                        onClick={() => {
                          setForm(prev => ({
                            ...prev,
                            patientId:     p.id,
                            patientSearch: `${p.firstName} ${p.lastName} (${p.mrn})`,
                            patientName:   `${p.firstName} ${p.lastName}`
                          }))
                          setPatients([])
                        }}
                        className="p-2.5 hover:bg-gray-50 cursor-pointer text-sm border-b border-gray-100 last:border-0"
                      >
                        <span className="font-medium">{p.firstName} {p.lastName}</span>
                        <span className="text-gray-400 ml-2">{p.mrn}</span>
                        <span className="text-gray-400 ml-2">{calcAge(p.dateOfBirth)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {form.patientId && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> {form.patientName} selected
                  </p>
                )}
              </div>

              {/* Obstetric History */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gravida (Total pregnancies)
                  </label>
                  <input
                    type="number" min="1"
                    value={form.gravida}
                    onChange={e => setForm(prev => ({ ...prev, gravida: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-500"
                    placeholder="e.g. 2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Para (Previous deliveries)
                  </label>
                  <input
                    type="number" min="0"
                    value={form.para}
                    onChange={e => setForm(prev => ({ ...prev, para: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-500"
                    placeholder="e.g. 1"
                  />
                </div>
              </div>

              {/* LMP & EDD */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    LMP (Last Menstrual Period) *
                  </label>
                  <input
                    type="date"
                    value={form.lmp}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={e => handleLMPChange(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    EDD (Expected Delivery Date)
                  </label>
                  <input
                    type="date"
                    value={form.edd}
                    onChange={e => setForm(prev => ({ ...prev, edd: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-500"
                  />
                  {form.lmp && (
                    <p className="text-xs text-pink-600 mt-1">
                      GA: {calcGA(form.lmp)} • EDD auto-calculated (Naegele's rule)
                    </p>
                  )}
                </div>
              </div>

              {/* Blood Group */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                  <select
                    value={form.bloodGroup}
                    onChange={e => setForm(prev => ({ ...prev, bloodGroup: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-500"
                  >
                    <option value="">Unknown</option>
                    {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rh Factor</label>
                  <select
                    value={form.rhFactor}
                    onChange={e => setForm(prev => ({ ...prev, rhFactor: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-500"
                  >
                    <option value="">Unknown</option>
                    <option value="POSITIVE">Positive (+)</option>
                    <option value="NEGATIVE">Negative (−)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => {
                  if (!form.patientId) return toast.error("Select a patient first")
                  if (!form.lmp)       return toast.error("LMP is required")
                  setStep(2)
                }}
                className="w-full py-2.5 bg-pink-600 text-white rounded-xl font-medium hover:bg-pink-700"
              >
                Next: Screening →
              </button>
            </>
          )}

          {step === 2 && (
            <>
              {/* Screening Results */}
              <div className="bg-pink-50 rounded-xl p-4">
                <h3 className="font-medium text-pink-800 mb-3 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4" /> Booking Screening Results
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "hivStatus",      label: "HIV Status"      },
                    { key: "syphilisStatus", label: "VDRL/Syphilis"   },
                    { key: "hbsAgStatus",    label: "HBsAg (Hep B)"  }
                  ].map(item => (
                    <div key={item.key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {item.label}
                      </label>
                      <select
                        value={form[item.key]}
                        onChange={e => setForm(prev => ({ ...prev, [item.key]: e.target.value }))}
                        className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
                      >
                        <option value="UNKNOWN">Unknown</option>
                        <option value="NEGATIVE">Negative</option>
                        <option value="POSITIVE">Positive</option>
                        <option value="REACTIVE">Reactive</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Risk Classification
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(RISK_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setForm(prev => ({ ...prev, riskLevel: key }))}
                      className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        form.riskLevel === key
                          ? `${cfg.bg} ${cfg.text} border-${cfg.color}-400`
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>

                {form.riskLevel === "HIGH" && (
                  <div className="mt-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    High-risk pregnancy — doctor will be notified
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Notes / Risk Factors
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  placeholder="Previous pregnancy complications, chronic conditions, other risk factors..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-500"
                />
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
                <p className="font-medium text-gray-700 mb-2">Registration Summary</p>
                <p><span className="text-gray-500">Patient:</span> <span className="font-medium">{form.patientName}</span></p>
                <p><span className="text-gray-500">G{form.gravida || "?"}P{form.para || "?"} •</span> LMP: {formatDate(form.lmp)}</p>
                <p><span className="text-gray-500">EDD:</span> <span className="font-medium text-pink-600">{formatDate(form.edd)}</span></p>
                <p><span className="text-gray-500">GA:</span> {calcGA(form.lmp)}</p>
                <p><span className="text-gray-500">Risk:</span> <span className={`font-medium ${RISK_CONFIG[form.riskLevel]?.text}`}>{RISK_CONFIG[form.riskLevel]?.label}</span></p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-pink-600 text-white rounded-xl text-sm font-medium hover:bg-pink-700 disabled:opacity-50"
                >
                  {saving ? "Registering..." : "Register ANC Patient"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ANC Visit Modal ──────────────────────────────────────────────────────────
const ANCVisitModal = ({ isOpen, record, onClose, onSuccess }) => {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    visitDate:      new Date().toISOString().split("T")[0],
    gestationalAge: "",
    weight:         "",
    bloodPressure:  "",
    fetalHeartRate: "",
    presentingPart: "",
    fundalHeight:   "",
    urinalysis:     "",
    nextVisitDate:  "",
    notes:          "",
    complications:  ""
  })

  // Auto-calculate GA from LMP
  useEffect(() => {
    if (record?.lmp) {
      const days  = Math.floor((new Date() - new Date(record.lmp)) / (1000 * 60 * 60 * 24))
      const weeks = Math.floor(days / 7)
      setForm(prev => ({ ...prev, gestationalAge: String(weeks) }))
    }
  }, [record])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post(`/maternity/antenatal/${record.id}/visits`, form)
      toast.success("ANC visit recorded!")
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to record visit")
    } finally { setSaving(false) }
  }

  if (!isOpen || !record) return null

  // BP warning
  const bpWarning = form.bloodPressure
    ? parseInt(form.bloodPressure.split("/")[0]) >= 140
    : false

  // FHR warning
  const fhrWarning = form.fetalHeartRate
    ? (parseInt(form.fetalHeartRate) < 110 || parseInt(form.fetalHeartRate) > 160)
    : false

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <Clipboard className="w-5 h-5 text-pink-500" />
              Record ANC Visit
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {record.patient?.firstName} {record.patient?.lastName} •
              {record.antenatalNo} • Visit #{(record._count?.visits || 0) + 1}
            </p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Visit Date & GA */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Visit Date *</label>
              <input
                type="date"
                value={form.visitDate}
                onChange={e => setForm(prev => ({ ...prev, visitDate: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gestational Age (weeks)
              </label>
              <input
                type="number" min="4" max="44"
                value={form.gestationalAge}
                onChange={e => setForm(prev => ({ ...prev, gestationalAge: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-500"
                placeholder="Auto-calculated"
              />
            </div>
          </div>

          {/* Measurements */}
          <div className="bg-pink-50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-pink-800 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Maternal Measurements
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number" step="0.1"
                  value={form.weight}
                  onChange={e => setForm(prev => ({ ...prev, weight: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="e.g. 65.5"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Blood Pressure (mmHg)
                </label>
                <input
                  type="text"
                  value={form.bloodPressure}
                  onChange={e => setForm(prev => ({ ...prev, bloodPressure: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${
                    bpWarning ? "border-red-400 bg-red-50" : "border-gray-200"
                  }`}
                  placeholder="e.g. 120/80"
                />
                {bpWarning && (
                  <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Elevated BP — consider pre-eclampsia
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Fundal Height (cm)
                </label>
                <input
                  type="number" step="0.5"
                  value={form.fundalHeight}
                  onChange={e => setForm(prev => ({ ...prev, fundalHeight: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="e.g. 28"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Urinalysis
                </label>
                <select
                  value={form.urinalysis}
                  onChange={e => setForm(prev => ({ ...prev, urinalysis: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">Select...</option>
                  <option value="NORMAL">Normal</option>
                  <option value="PROTEIN+">Protein +</option>
                  <option value="PROTEIN++">Protein ++</option>
                  <option value="GLUCOSE+">Glucose +</option>
                  <option value="PROTEIN+GLUCOSE+">Protein + Glucose +</option>
                  <option value="BLOOD+">Blood +</option>
                </select>
              </div>
            </div>
          </div>

          {/* Fetal Assessment */}
          <div className="bg-blue-50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
              <Baby className="w-4 h-4" /> Fetal Assessment
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Fetal Heart Rate (bpm)
                </label>
                <input
                  type="number" min="80" max="200"
                  value={form.fetalHeartRate}
                  onChange={e => setForm(prev => ({ ...prev, fetalHeartRate: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${
                    fhrWarning ? "border-red-400 bg-red-50" : "border-gray-200"
                  }`}
                  placeholder="Normal: 110-160"
                />
                {fhrWarning && (
                  <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Abnormal FHR
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Presenting Part
                </label>
                <select
                  value={form.presentingPart}
                  onChange={e => setForm(prev => ({ ...prev, presentingPart: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">Select...</option>
                  <option value="CEPHALIC">Cephalic (Head)</option>
                  <option value="BREECH">Breech</option>
                  <option value="TRANSVERSE">Transverse</option>
                  <option value="OBLIQUE">Oblique</option>
                  <option value="NOT_ENGAGED">Not Engaged</option>
                  <option value="ENGAGED">Engaged</option>
                </select>
              </div>
            </div>
          </div>

          {/* Next Visit & Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Next Visit Date
              </label>
              <input
                type="date"
                value={form.nextVisitDate}
                onChange={e => setForm(prev => ({ ...prev, nextVisitDate: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Complications
              </label>
              <input
                type="text"
                value={form.complications}
                onChange={e => setForm(prev => ({ ...prev, complications: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-500"
                placeholder="If any..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Clinical Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              placeholder="Additional observations, treatment given, advice given..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-500"
            />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-pink-600 text-white rounded-xl text-sm font-medium hover:bg-pink-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Record Visit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delivery Modal ───────────────────────────────────────────────────────────
const DeliveryModal = ({ isOpen, record, onClose, onSuccess }) => {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    deliveryDate:     new Date().toISOString().slice(0, 16),
    deliveryMode:     "NORMAL_VAGINAL",
    gestationalAge:   "",
    complications:    "",
    bloodLoss:        "",
    placentaComplete: true,
    notes:            "",
    newborns: [{
      gender:          "MALE",
      birthWeight:     "",
      apgar1min:       "",
      apgar5min:       "",
      birthTime:       new Date().toISOString().slice(0, 16),
      vitaminKGiven:   false,
      bcgGiven:        false,
      opvGiven:        false,
      breastfedWithin1h: false,
      notes:           ""
    }]
  })

  const addNewborn = () => setForm(prev => ({
    ...prev,
    newborns: [...prev.newborns, {
      gender: "MALE", birthWeight: "", apgar1min: "",
      apgar5min: "", birthTime: new Date().toISOString().slice(0, 16),
      vitaminKGiven: false, bcgGiven: false, opvGiven: false,
      breastfedWithin1h: false, notes: ""
    }]
  }))

  const updateNewborn = (idx, field, value) => {
    setForm(prev => ({
      ...prev,
      newborns: prev.newborns.map((nb, i) =>
        i === idx ? { ...nb, [field]: value } : nb
      )
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.deliveryMode) return toast.error("Delivery mode required")
    if (form.newborns.some(nb => !nb.gender)) return toast.error("Newborn gender required")
    setSaving(true)
    try {
      await api.post(`/maternity/antenatal/${record.id}/delivery`, form)
      toast.success("Delivery recorded successfully!")
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to record delivery")
    } finally { setSaving(false) }
  }

  if (!isOpen || !record) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <Baby className="w-5 h-5 text-blue-500" />
              Record Delivery
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {record.patient?.firstName} {record.patient?.lastName} • {record.antenatalNo}
            </p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Delivery Details */}
          <div className="bg-blue-50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-blue-800 mb-3">Delivery Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Date & Time of Delivery *
                </label>
                <input
                  type="datetime-local"
                  value={form.deliveryDate}
                  onChange={e => setForm(prev => ({ ...prev, deliveryDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Mode of Delivery *
                </label>
                <select
                  value={form.deliveryMode}
                  onChange={e => setForm(prev => ({ ...prev, deliveryMode: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  {DELIVERY_MODES.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Gestational Age at Delivery (weeks)
                </label>
                <input
                  type="number" min="20" max="44"
                  value={form.gestationalAge}
                  onChange={e => setForm(prev => ({ ...prev, gestationalAge: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="e.g. 39"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Blood Loss (ml)
                </label>
                <input
                  type="number"
                  value={form.bloodLoss}
                  onChange={e => setForm(prev => ({ ...prev, bloodLoss: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="e.g. 300"
                />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.placentaComplete}
                  onChange={e => setForm(prev => ({ ...prev, placentaComplete: e.target.checked }))}
                  className="w-4 h-4 text-pink-600"
                />
                <span className="text-sm text-gray-700">Placenta Complete</span>
              </label>
            </div>

            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Complications</label>
              <input
                type="text"
                value={form.complications}
                onChange={e => setForm(prev => ({ ...prev, complications: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="PPH, perineal tear, shoulder dystocia, etc."
              />
            </div>
          </div>

          {/* Newborn Records */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Baby className="w-4 h-4 text-blue-500" />
                Newborn Record(s)
              </h3>
              <button
                type="button"
                onClick={addNewborn}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add twin/multiple
              </button>
            </div>

            {form.newborns.map((nb, idx) => (
              <div key={idx} className="bg-gray-50 rounded-xl p-4 mb-3">
                <p className="text-xs font-semibold text-gray-600 mb-3">
                  Baby #{idx + 1}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Gender *</label>
                    <select
                      value={nb.gender}
                      onChange={e => updateNewborn(idx, "gender", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Birth Weight (kg)
                    </label>
                    <input
                      type="number" step="0.01" min="0.5" max="6"
                      value={nb.birthWeight}
                      onChange={e => updateNewborn(idx, "birthWeight", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      placeholder="e.g. 3.2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      APGAR @ 1 min (0-10)
                    </label>
                    <input
                      type="number" min="0" max="10"
                      value={nb.apgar1min}
                      onChange={e => updateNewborn(idx, "apgar1min", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      APGAR @ 5 min (0-10)
                    </label>
                    <input
                      type="number" min="0" max="10"
                      value={nb.apgar5min}
                      onChange={e => updateNewborn(idx, "apgar5min", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Time of Birth
                    </label>
                    <input
                      type="datetime-local"
                      value={nb.birthTime}
                      onChange={e => updateNewborn(idx, "birthTime", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Newborn Interventions */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[
                    { key: "vitaminKGiven",    label: "Vitamin K Given"     },
                    { key: "bcgGiven",         label: "BCG Given"            },
                    { key: "opvGiven",         label: "OPV 0 Given"          },
                    { key: "breastfedWithin1h",label: "Breastfed within 1hr" }
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={nb[item.key]}
                        onChange={e => updateNewborn(idx, item.key, e.target.checked)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-xs text-gray-700">{item.label}</span>
                    </label>
                  ))}
                </div>

                <div className="mt-2">
                  <input
                    type="text"
                    value={nb.notes}
                    onChange={e => updateNewborn(idx, "notes", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="Newborn notes (resuscitation needed, abnormalities, etc.)"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delivery Notes
            </label>
            <textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              placeholder="Additional notes about the delivery..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
            />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Recording..." : "Record Delivery"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── ANC Record Card ──────────────────────────────────────────────────────────
const ANCRecordCard = ({ record, onVisit, onDelivery, onView }) => {
  const riskCfg  = RISK_CONFIG[record.riskLevel] || RISK_CONFIG.LOW
  const days     = record.edd ? daysToEDD(record.edd) : null
  const isOverdue = days !== null && days < 0
  const lastVisit = record.visits?.[0]

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
      <div className="p-4">
        <div className="flex items-start justify-between">
          {/* Patient */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-pink-100 flex items-center justify-center text-pink-700 font-bold">
              {record.patient?.firstName?.[0]}{record.patient?.lastName?.[0]}
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">
                {record.patient?.firstName} {record.patient?.lastName}
              </h3>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                <span>{record.antenatalNo}</span>
                <span>•</span>
                <span>G{record.gravida ?? "?"}P{record.para ?? "?"}</span>
                <span>•</span>
                <span>{record.patient?.phone}</span>
              </div>
            </div>
          </div>

          {/* Risk Badge */}
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${riskCfg.bg} ${riskCfg.text}`}>
            {riskCfg.label}
          </span>
        </div>

        {/* Pregnancy Info */}
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="bg-gray-50 rounded-xl p-2.5 text-center">
            <p className="text-xs text-gray-500">GA Today</p>
            <p className="font-bold text-gray-800 text-sm">
              {record.lmp ? calcGA(record.lmp) : "—"}
            </p>
          </div>
          <div className={`rounded-xl p-2.5 text-center ${isOverdue ? "bg-red-50" : "bg-pink-50"}`}>
            <p className="text-xs text-gray-500">EDD</p>
            <p className={`font-bold text-sm ${isOverdue ? "text-red-600" : "text-pink-700"}`}>
              {record.edd ? formatDate(record.edd) : "—"}
            </p>
            {days !== null && (
              <p className={`text-xs ${isOverdue ? "text-red-500" : "text-gray-500"}`}>
                {isOverdue ? `${Math.abs(days)}d overdue` : `${days}d to go`}
              </p>
            )}
          </div>
          <div className="bg-gray-50 rounded-xl p-2.5 text-center">
            <p className="text-xs text-gray-500">ANC Visits</p>
            <p className="font-bold text-gray-800 text-sm">
              {record._count?.visits || 0}
            </p>
          </div>
        </div>

        {/* Screening Alerts */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {record.hivStatus === "POSITIVE" && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              HIV+
            </span>
          )}
          {record.syphilisStatus === "REACTIVE" && (
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
              VDRL Reactive
            </span>
          )}
          {record.rhFactor === "NEGATIVE" && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
              Rh−
            </span>
          )}
          {isOverdue && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Overdue
            </span>
          )}
          {lastVisit?.nextVisitDate && new Date(lastVisit.nextVisitDate) < new Date() && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
              Visit Overdue
            </span>
          )}
        </div>

        {/* Last visit */}
        {lastVisit && (
          <p className="text-xs text-gray-400 mt-2">
            Last visit: {formatDate(lastVisit.visitDate)}
            {lastVisit.nextVisitDate && ` • Next: ${formatDate(lastVisit.nextVisitDate)}`}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => onView(record)}
            className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200"
          >
            <Eye className="w-3 h-3" /> View
          </button>
          <button
            onClick={() => onVisit(record)}
            className="flex items-center gap-1 text-xs bg-pink-100 text-pink-700 px-3 py-1.5 rounded-lg hover:bg-pink-200"
          >
            <Clipboard className="w-3 h-3" /> ANC Visit
          </button>
          {!record.deliveryRecord && (
            <button
              onClick={() => onDelivery(record)}
              className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200"
            >
              <Baby className="w-3 h-3" /> Record Delivery
            </button>
          )}
          {record.deliveryRecord && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Delivered
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Newborn Card ─────────────────────────────────────────────────────────────
const NewbornCard = ({ record }) => {
  const apgarColor = (score) => {
    if (score >= 7) return "text-green-600"
    if (score >= 4) return "text-yellow-600"
    return "text-red-600"
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            record.gender === "MALE" ? "bg-blue-100" : "bg-pink-100"
          }`}>
            <Baby className={`w-5 h-5 ${record.gender === "MALE" ? "text-blue-600" : "text-pink-600"}`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">
              {record.patient?.firstName} {record.patient?.lastName}
            </h3>
            <p className="text-xs text-gray-500">
              {record.newbornNo} • {record.gender} • Born: {formatDateTime(record.birthTime)}
            </p>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          record.gender === "MALE"
            ? "bg-blue-100 text-blue-700"
            : "bg-pink-100 text-pink-700"
        }`}>
          {record.gender}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <p className="text-xs text-gray-500">Weight</p>
          <p className={`font-bold text-sm ${
            record.birthWeight < 2.5 ? "text-orange-600" : "text-gray-800"
          }`}>
            {record.birthWeight ? `${record.birthWeight}kg` : "—"}
          </p>
          {record.birthWeight < 2.5 && (
            <p className="text-xs text-orange-500">LBW</p>
          )}
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <p className="text-xs text-gray-500">APGAR 1min</p>
          <p className={`font-bold text-sm ${apgarColor(record.apgar1min)}`}>
            {record.apgar1min ?? "—"}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <p className="text-xs text-gray-500">APGAR 5min</p>
          <p className={`font-bold text-sm ${apgarColor(record.apgar5min)}`}>
            {record.apgar5min ?? "—"}
          </p>
        </div>
      </div>

      {/* Interventions */}
      <div className="grid grid-cols-2 gap-1 mt-3">
        {[
          { key: "vitaminKGiven",    label: "Vitamin K" },
          { key: "bcgGiven",         label: "BCG"        },
          { key: "opvGiven",         label: "OPV 0"      },
          { key: "breastfedWithin1h",label: "Breastfed"  }
        ].map(item => (
          <div key={item.key} className="flex items-center gap-1.5">
            {record[item.key]
              ? <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              : <X className="w-3.5 h-3.5 text-red-400" />
            }
            <span className="text-xs text-gray-600">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Mother */}
      {record.mother && (
        <p className="text-xs text-gray-400 mt-2 border-t border-gray-100 pt-2">
          Mother: {record.mother.firstName} {record.mother.lastName} • {record.mother.mrn}
        </p>
      )}
    </div>
  )
}

// ─── ANC Detail Drawer ────────────────────────────────────────────────────────
const ANCDetailDrawer = ({ record, onClose, onVisit, onDelivery }) => {
  if (!record) return null
  const riskCfg = RISK_CONFIG[record.riskLevel] || RISK_CONFIG.LOW

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
      <div className="w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">ANC Record Detail</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Patient Header */}
          <div className={`rounded-xl p-4 ${riskCfg.bg}`}>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center font-bold text-xl text-pink-600">
                {record.patient?.firstName?.[0]}{record.patient?.lastName?.[0]}
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg">
                  {record.patient?.firstName} {record.patient?.lastName}
                </h3>
                <p className="text-sm text-gray-600">
                  {record.patient?.mrn} • Age: {calcAge(record.patient?.dateOfBirth)}
                </p>
                <p className="text-sm text-gray-600">{record.patient?.phone}</p>
              </div>
            </div>
          </div>

          {/* Pregnancy Details */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Heart className="w-4 h-4 text-pink-500" /> Pregnancy Details
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "ANC Number",  value: record.antenatalNo                    },
                { label: "Risk Level",  value: riskCfg.label                         },
                { label: "Gravida",     value: `G${record.gravida ?? "?"}`           },
                { label: "Para",        value: `P${record.para ?? "?"}`              },
                { label: "LMP",         value: formatDate(record.lmp)               },
                { label: "EDD",         value: formatDate(record.edd)               },
                { label: "GA Today",    value: record.lmp ? calcGA(record.lmp) : "—"},
                { label: "ANC Visits",  value: record._count?.visits || 0           }
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p className="font-semibold text-gray-800 text-sm mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Screening Results */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-purple-500" /> Screening Results
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Blood Group",  value: record.bloodGroup    || "Unknown" },
                { label: "Rh Factor",    value: record.rhFactor      || "Unknown" },
                { label: "HIV Status",   value: record.hivStatus     || "Unknown" },
                { label: "VDRL",         value: record.syphilisStatus|| "Unknown" },
                { label: "HBsAg",        value: record.hbsAgStatus   || "Unknown" }
              ].map(item => (
                <div key={item.label} className={`rounded-xl p-2.5 text-center ${
                  item.value === "POSITIVE" || item.value === "REACTIVE"
                    ? "bg-red-50"
                    : "bg-gray-50"
                }`}>
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p className={`font-semibold text-xs mt-0.5 ${
                    item.value === "POSITIVE" || item.value === "REACTIVE"
                      ? "text-red-600"
                      : "text-gray-800"
                  }`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Visit History */}
          {record.visits?.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" /> Visit History
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {record.visits.map((visit, idx) => (
                  <div key={visit.id} className="bg-gray-50 rounded-xl p-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">
                        Visit #{record.visits.length - idx}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(visit.visitDate)}
                      </span>
                    </div>
                    {visit.gestationalAge && (
                      <p className="text-xs text-gray-500 mt-1">
                        GA: {visit.gestationalAge}w • BP: {visit.bloodPressure || "—"} •
                        FHR: {visit.fetalHeartRate || "—"} bpm
                      </p>
                    )}
                    {visit.notes && (
                      <p className="text-xs text-gray-500 mt-1">{visit.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delivery Record */}
          {record.deliveryRecord && (
            <div className="bg-green-50 rounded-xl p-4">
              <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                <Baby className="w-4 h-4" /> Delivery Recorded
              </h4>
              <p className="text-sm text-green-700">
                {DELIVERY_MODES.find(m => m.value === record.deliveryRecord.deliveryMode)?.label}
              </p>
              <p className="text-xs text-green-600 mt-1">
                {formatDateTime(record.deliveryRecord.deliveryDate)}
                {record.deliveryRecord.gestationalAge && ` at ${record.deliveryRecord.gestationalAge} weeks`}
              </p>
              {record.deliveryRecord.newborns?.length > 0 && (
                <p className="text-xs text-green-600 mt-0.5">
                  {record.deliveryRecord.newborns.length} newborn(s) registered
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { onVisit(record); onClose() }}
              className="flex items-center justify-center gap-2 p-3 bg-pink-100 text-pink-700 rounded-xl text-sm font-medium hover:bg-pink-200"
            >
              <Clipboard className="w-4 h-4" /> Record ANC Visit
            </button>
            {!record.deliveryRecord && (
              <button
                onClick={() => { onDelivery(record); onClose() }}
                className="flex items-center justify-center gap-2 p-3 bg-blue-100 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-200"
              >
                <Baby className="w-4 h-4" /> Record Delivery
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Maternity Page ──────────────────────────────────────────────────────
export default function MaternityPage() {
  const { user }   = useAuthStore()
  const navigate   = useNavigate()

  const [activeTab,    setActiveTab]    = useState("antenatal")
  const [ancRecords,   setAncRecords]   = useState([])
  const [newborns,     setNewborns]     = useState([])
  const [stats,        setStats]        = useState({})
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState("")
  const [riskFilter,   setRiskFilter]   = useState("")
  const [refreshKey,   setRefreshKey]   = useState(0)

  // Modals
  const [showRegister, setShowRegister] = useState(false)
  const [visitRecord,  setVisitRecord]  = useState(null)
  const [deliveryRecord, setDeliveryRecord] = useState(null)
  const [detailRecord, setDetailRecord] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search)     params.append("search", search)
      if (riskFilter) params.append("riskLevel", riskFilter)
      params.append("limit", "50")

      const [ancRes, nbRes] = await Promise.allSettled([
        api.get(`/maternity/antenatal?${params}`),
        api.get("/maternity/newborns?limit=20")
      ])

      if (ancRes.status === "fulfilled") {
        const data    = ancRes.value.data
        const records = data.data?.records || data.records || []
        setAncRecords(records)

        setStats({
          total:     data.data?.pagination?.total || records.length,
          highRisk:  records.filter(r => r.riskLevel === "HIGH").length,
          overdue:   records.filter(r => r.isOverdue).length,
          delivered: records.filter(r => r.deliveryRecord).length,
          active:    records.filter(r => !r.deliveryRecord).length,
          newborns:  0
        })
      }

      if (nbRes.status === "fulfilled") {
        const data = nbRes.value.data
        const list = data.data?.records || data.records || []
        setNewborns(list)
        setStats(prev => ({ ...prev, newborns: list.length }))
      }
    } catch (err) {
      console.error("Maternity fetch error:", err)
    } finally {
      setLoading(false)
    }
  }, [search, riskFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData, refreshKey])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Heart className="w-7 h-7 text-pink-500" />
            Maternity & Obstetrics
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Antenatal care, labour, delivery & newborn records
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200"
          >
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
          {["NURSE","DOCTOR","MIDWIFE","CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN"].includes(user?.role) && (
            <button
              onClick={() => setShowRegister(true)}
              className="flex items-center gap-2 bg-pink-600 text-white px-4 py-2 rounded-xl hover:bg-pink-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Register ANC Patient
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total ANC"       value={stats.total}     icon={Heart}     color="pink"   />
        <StatCard label="Active"          value={stats.active}    icon={Activity}  color="blue"   />
        <StatCard label="High Risk"       value={stats.highRisk}  icon={AlertTriangle} color="red" />
        <StatCard label="Delivered"       value={stats.delivered} icon={CheckCircle} color="green" />
        <StatCard label="Newborns"        value={stats.newborns}  icon={Baby}      color="purple" />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-pink-500 text-pink-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="p-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search patient, ANC number..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-500"
            />
          </div>
          {activeTab === "antenatal" && (
            <select
              value={riskFilter}
              onChange={e => setRiskFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm"
            >
              <option value="">All Risk Levels</option>
              <option value="LOW">Low Risk</option>
              <option value="MODERATE">Moderate Risk</option>
              <option value="HIGH">High Risk</option>
            </select>
          )}
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "antenatal" && (
        <div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                  <div className="flex gap-3 mb-3">
                    <div className="w-11 h-11 bg-gray-200 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/2" />
                      <div className="h-3 bg-gray-100 rounded w-1/3" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="h-14 bg-gray-100 rounded-xl" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : ancRecords.length === 0 ? (
            <div className="bg-white rounded-xl p-16 text-center border border-gray-100">
              <Heart className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No ANC records found</p>
              <button
                onClick={() => setShowRegister(true)}
                className="mt-3 text-sm text-pink-600 hover:text-pink-800"
              >
                Register first patient →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ancRecords.map(record => (
                <ANCRecordCard
                  key={record.id}
                  record={record}
                  onVisit={setVisitRecord}
                  onDelivery={setDeliveryRecord}
                  onView={setDetailRecord}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "labour" && (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <Baby className="w-12 h-12 text-blue-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700 mb-1">Labour Ward</h3>
          <p className="text-gray-400 text-sm mb-4">
            Active labour cases and delivery room management
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left mt-6">
            {ancRecords
              .filter(r => !r.deliveryRecord && r.currentGA >= 37)
              .map(record => (
                <div key={record.id}
                  className="bg-blue-50 rounded-xl p-4 border border-blue-100"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">
                        {record.patient?.firstName} {record.patient?.lastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {record.antenatalNo} • GA: {calcGA(record.lmp)} • EDD: {formatDate(record.edd)}
                      </p>
                    </div>
                    <button
                      onClick={() => setDeliveryRecord(record)}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg"
                    >
                      Record Delivery
                    </button>
                  </div>
                </div>
              ))}
            {ancRecords.filter(r => !r.deliveryRecord && r.currentGA >= 37).length === 0 && (
              <div className="col-span-2 text-center text-gray-400 py-8">
                No patients at term currently
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "newborn" && (
        <div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl p-4 animate-pulse h-40" />
              ))}
            </div>
          ) : newborns.length === 0 ? (
            <div className="bg-white rounded-xl p-16 text-center border border-gray-100">
              <Baby className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No newborn records yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {newborns.map(record => (
                <NewbornCard key={record.id} record={record} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "postnatal" && (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <Shield className="w-12 h-12 text-green-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700 mb-1">Postnatal Care</h3>
          <p className="text-gray-400 text-sm mb-4">
            Post-delivery care — mothers who delivered in the last 6 weeks
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left mt-4">
            {ancRecords
              .filter(r => r.deliveryRecord)
              .map(record => {
                const deliveryDate = record.deliveryRecord?.deliveryDate
                const daysSince    = deliveryDate
                  ? Math.floor((new Date() - new Date(deliveryDate)) / (1000 * 60 * 60 * 24))
                  : null

                if (daysSince === null || daysSince > 42) return null

                return (
                  <div key={record.id} className="bg-green-50 rounded-xl p-4 border border-green-100">
                    <p className="font-semibold text-gray-800">
                      {record.patient?.firstName} {record.patient?.lastName}
                    </p>
                    <p className="text-xs text-gray-500">
                      Delivered: {formatDate(record.deliveryRecord.deliveryDate)} •
                      Day {daysSince} postnatal
                    </p>
                    <p className="text-xs text-gray-500">
                      Mode: {DELIVERY_MODES.find(m => m.value === record.deliveryRecord.deliveryMode)?.label}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        daysSince <= 3  ? "bg-blue-100 text-blue-700"  :
                        daysSince <= 7  ? "bg-green-100 text-green-700" :
                        daysSince <= 14 ? "bg-yellow-100 text-yellow-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {daysSince <= 3  ? "Immediate (0-3d)"  :
                         daysSince <= 7  ? "Early (4-7d)"      :
                         daysSince <= 14 ? "Late (8-14d)"      :
                         "Extended (>14d)"}
                      </span>
                    </div>
                  </div>
                )
              })
              .filter(Boolean)}
          </div>
        </div>
      )}

      {/* Modals */}
      <ANCRegisterModal
        isOpen={showRegister}
        onClose={() => setShowRegister(false)}
        onSuccess={() => setRefreshKey(k => k + 1)}
      />

      <ANCVisitModal
        isOpen={!!visitRecord}
        record={visitRecord}
        onClose={() => setVisitRecord(null)}
        onSuccess={() => setRefreshKey(k => k + 1)}
      />

      <DeliveryModal
        isOpen={!!deliveryRecord}
        record={deliveryRecord}
        onClose={() => setDeliveryRecord(null)}
        onSuccess={() => setRefreshKey(k => k + 1)}
      />

      {detailRecord && (
        <ANCDetailDrawer
          record={detailRecord}
          onClose={() => setDetailRecord(null)}
          onVisit={setVisitRecord}
          onDelivery={setDeliveryRecord}
        />
      )}
    </div>
  )
}