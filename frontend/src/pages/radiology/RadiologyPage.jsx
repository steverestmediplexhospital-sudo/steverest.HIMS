// frontend/src/pages/radiology/RadiologyPage.jsx
import { useState, useEffect, useCallback } from "react"
import {
  Radio, Plus, Search, RefreshCw, X, CheckCircle,
  AlertTriangle, Calendar, Clock, FileText, Eye,
  User, Activity, Filter, ChevronRight, Save,
  Loader2, Hash, MapPin, Phone, Star, Zap,
  BarChart2, Package, Shield, Download, Info,
  ArrowRight, CheckSquare, Circle, Layers
} from "lucide-react"
import api from "../../services/api"
import toast from "react-hot-toast"
import useAuthStore from "../../store/authStore"

// ─── Constants ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  ORDERED:      { label: "Ordered",      bg: "bg-blue-100",    text: "text-blue-700",    dot: "bg-blue-500"    },
  SCHEDULED:    { label: "Scheduled",    bg: "bg-purple-100",  text: "text-purple-700",  dot: "bg-purple-500"  },
  IMAGING_DONE: { label: "Imaging Done", bg: "bg-amber-100",   text: "text-amber-700",   dot: "bg-amber-500"   },
  REPORTED:     { label: "Reported",     bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
  VALIDATED:    { label: "Validated",    bg: "bg-green-100",   text: "text-green-700",   dot: "bg-green-500"   },
  CANCELLED:    { label: "Cancelled",    bg: "bg-gray-100",    text: "text-gray-600",    dot: "bg-gray-400"    },
}

const PRIORITY_CONFIG = {
  ROUTINE: { label: "Routine", bg: "bg-gray-100",   text: "text-gray-600"   },
  URGENT:  { label: "Urgent",  bg: "bg-amber-100",  text: "text-amber-700"  },
  STAT:    { label: "STAT",    bg: "bg-red-100",    text: "text-red-700"    },
}

const MODALITIES = [
  "X-RAY", "ULTRASOUND", "CT_SCAN", "MRI",
  "MAMMOGRAPHY", "FLUOROSCOPY", "NUCLEAR_MEDICINE", "OTHER",
]

const MODALITY_COLORS = {
  "X-RAY":           { bg: "bg-blue-50",    icon: "text-blue-600"    },
  "ULTRASOUND":      { bg: "bg-emerald-50", icon: "text-emerald-600" },
  "CT_SCAN":         { bg: "bg-purple-50",  icon: "text-purple-600"  },
  "MRI":             { bg: "bg-indigo-50",  icon: "text-indigo-600"  },
  "MAMMOGRAPHY":     { bg: "bg-pink-50",    icon: "text-pink-600"    },
  "FLUOROSCOPY":     { bg: "bg-amber-50",   icon: "text-amber-600"   },
  "NUCLEAR_MEDICINE":{ bg: "bg-red-50",     icon: "text-red-600"     },
  "OTHER":           { bg: "bg-gray-50",    icon: "text-gray-600"    },
}

// ─── Helpers ──────────────────────────────────────────────────────────────
const fmtDate     = (d) => d ? new Date(d).toLocaleDateString("en-KE",  { day:"2-digit", month:"short", year:"numeric" }) : "—"
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("en-KE",      { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }) : "—"
const calcAge     = (dob) => dob ? Math.floor((Date.now() - new Date(dob)) / (365.25*24*60*60*1000)) + "y" : "—"

// ─── Badge ────────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ORDERED
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

const PriorityBadge = ({ priority }) => {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.ROUTINE
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────
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

// ─── Section Loader ───────────────────────────────────────────────────────
const SectionLoader = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
    <span className="ml-2 text-gray-400 text-sm">Loading…</span>
  </div>
)

// ─── Empty State ──────────────────────────────────────────────────────────
const EmptyState = ({ icon: Icon, title, sub, action }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
      <Icon className="w-8 h-8 text-gray-300" />
    </div>
    <p className="font-semibold text-gray-600">{title}</p>
    <p className="text-sm text-gray-400 mt-1 mb-4">{sub}</p>
    {action}
  </div>
)

// ════════════════════════════════════════════════════════════════════════════
// MODAL — SUBMIT REPORT
// ════════════════════════════════════════════════════════════════════════════
const ReportModal = ({ isOpen, order, onClose, onSuccess }) => {
  const [form, setForm]   = useState({
    findings:       "",
    impression:     "",
    recommendation: "",
    imageUrls:      "",
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setForm({ findings:"", impression:"", recommendation:"", imageUrls:"" })
    }
  }, [isOpen])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async () => {
    if (!form.findings.trim()) return toast.error("Findings are required")
    setSaving(true)
    try {
      await api.post(`/radiology/orders/${order.id}/report`, {
        findings:       form.findings.trim(),
        impression:     form.impression.trim()     || null,
        recommendation: form.recommendation.trim() || null,
        imageUrls:      form.imageUrls
          ? form.imageUrls.split(",").map(u => u.trim()).filter(Boolean)
          : [],
      })
      toast.success("Report submitted successfully")
      onSuccess()
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to submit report")
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen || !order) return null

  const patient = order.visit?.patient

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 rounded-xl">
              <FileText className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Submit Radiology Report</h2>
              <p className="text-xs text-gray-400">{order.orderNumber} · {order.service?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Patient info banner */}
          <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-cyan-200 flex items-center justify-center font-bold text-cyan-800 text-lg shrink-0">
              {patient?.firstName?.[0]}{patient?.lastName?.[0]}
            </div>
            <div>
              <p className="font-bold text-gray-900">
                {patient?.firstName} {patient?.lastName}
              </p>
              <p className="text-sm text-gray-500">
                MRN: {patient?.mrn} · {patient?.gender} · {calcAge(patient?.dateOfBirth)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <PriorityBadge priority={order.priority} />
                <span className="text-xs text-gray-400">
                  Ordered: {fmtDateTime(order.orderedAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Clinical info */}
          {order.clinicalInfo && (
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Clinical Information
              </p>
              <p className="text-sm text-gray-700">{order.clinicalInfo}</p>
            </div>
          )}

          {/* Findings */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Findings *
            </label>
            <textarea
              value={form.findings}
              onChange={e => set("findings", e.target.value)}
              rows={5}
              placeholder="Describe imaging findings in detail — anatomy visualised, abnormalities noted, measurements if relevant..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
            />
          </div>

          {/* Impression */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Impression / Conclusion
            </label>
            <textarea
              value={form.impression}
              onChange={e => set("impression", e.target.value)}
              rows={3}
              placeholder="Radiological impression — diagnosis or differential diagnoses..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
            />
          </div>

          {/* Recommendation */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Recommendations
            </label>
            <textarea
              value={form.recommendation}
              onChange={e => set("recommendation", e.target.value)}
              rows={2}
              placeholder="Follow-up imaging, clinical correlation, or further investigations recommended..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
            />
          </div>

          {/* Image URLs */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Image URLs (comma-separated, optional)
            </label>
            <input
              value={form.imageUrls}
              onChange={e => set("imageUrls", e.target.value)}
              placeholder="https://pacs.hospital.com/image1, https://..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-6 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-700 disabled:opacity-60 flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Submit Report
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL — ADD SERVICE
// ════════════════════════════════════════════════════════════════════════════
const ServiceModal = ({ isOpen, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    name:"", modality:"X-RAY", description:"", price:"",
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error("Name is required")
    if (!form.price)       return toast.error("Price is required")
    setSaving(true)
    try {
      await api.post("/radiology/services", {
        name:        form.name.trim(),
        modality:    form.modality,
        description: form.description || null,
        price:       parseFloat(form.price),
      })
      toast.success("Service added")
      onSuccess()
      onClose()
      setForm({ name:"", modality:"X-RAY", description:"", price:"" })
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to add service")
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 rounded-xl">
              <Radio className="w-5 h-5 text-cyan-600" />
            </div>
            <h2 className="font-bold text-gray-900">Add Radiology Service</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Service Name *</label>
            <input value={form.name} onChange={e => set("name", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="e.g. Chest X-Ray PA View" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Modality *</label>
            <div className="grid grid-cols-4 gap-2">
              {MODALITIES.map(m => {
                const mc     = MODALITY_COLORS[m] || MODALITY_COLORS.OTHER
                const active = form.modality === m
                return (
                  <button key={m} onClick={() => set("modality", m)}
                    className={`py-2 px-1 rounded-xl text-xs font-medium border transition-all ${
                      active
                        ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}>
                    {m.replace(/_/g," ")}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Price (KES) *</label>
            <input type="number" value={form.price} onChange={e => set("price", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="0.00" min="0" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
              placeholder="Brief description of the service..." />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-5 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-700 disabled:opacity-60 flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Service
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// ORDER DETAIL DRAWER
// ════════════════════════════════════════════════════════════════════════════
const OrderDrawer = ({ order, onClose, onReport, onValidate, userRole }) => {
  if (!order) return null

  const patient  = order.visit?.patient
  const report   = order.report
  const canReport   = ["RADIOGRAPHER","SUPER_ADMIN","HOSPITAL_ADMIN"].includes(userRole)
  const canValidate = ["RADIOGRAPHER","SUPER_ADMIN","HOSPITAL_ADMIN","MEDICAL_DIRECTOR"].includes(userRole)

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-lg bg-white shadow-2xl overflow-y-auto flex flex-col">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">Order Details</h2>
            <p className="text-xs text-gray-400">{order.orderNumber}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-5">

          {/* Patient */}
          <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-cyan-200 flex items-center justify-center font-bold text-cyan-800 text-lg shrink-0">
                {patient?.firstName?.[0]}{patient?.lastName?.[0]}
              </div>
              <div>
                <p className="font-bold text-gray-900">
                  {patient?.firstName} {patient?.lastName}
                </p>
                <p className="text-sm text-gray-500">
                  MRN: {patient?.mrn} · {patient?.gender} · {calcAge(patient?.dateOfBirth)}
                </p>
                {patient?.phone && (
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3" /> {patient.phone}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Service & Status */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Examination
            </h3>
            <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-900">{order.service?.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {order.service?.modality?.replace(/_/g," ")}
                  </p>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <div className="flex items-center gap-3">
                <PriorityBadge priority={order.priority} />
                <span className="text-xs text-gray-400">
                  Ordered: {fmtDateTime(order.orderedAt)}
                </span>
              </div>
              {order.scheduledAt && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Calendar className="w-3 h-3" />
                  Scheduled: {fmtDateTime(order.scheduledAt)}
                </div>
              )}
              {order.clinicalInfo && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Clinical Info</p>
                  <p className="text-sm text-gray-700">{order.clinicalInfo}</p>
                </div>
              )}
            </div>
          </div>

          {/* Report */}
          {report ? (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                Radiology Report
              </h3>
              <div className="space-y-3">
                <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-cyan-700 mb-2">FINDINGS</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.findings}</p>
                </div>

                {report.impression && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                    <p className="text-xs font-semibold text-emerald-700 mb-2">IMPRESSION</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.impression}</p>
                  </div>
                )}

                {report.recommendation && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                    <p className="text-xs font-semibold text-amber-700 mb-2">RECOMMENDATIONS</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.recommendation}</p>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-gray-400 px-1">
                  <span>
                    Reported by: {report.reportedBy?.firstName} {report.reportedBy?.lastName}
                  </span>
                  <span>{fmtDateTime(report.reportedAt)}</span>
                </div>

                {report.validatedAt ? (
                  <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-xl px-3 py-2">
                    <CheckCircle className="w-4 h-4" />
                    Validated on {fmtDateTime(report.validatedAt)}
                  </div>
                ) : canValidate && (
                  <button
                    onClick={() => onValidate(order)}
                    className="w-full py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 flex items-center justify-center gap-2"
                  >
                    <CheckSquare className="w-4 h-4" /> Validate Report
                  </button>
                )}

                {report.imageUrls?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">Images</p>
                    <div className="space-y-1">
                      {report.imageUrls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-cyan-600 hover:text-cyan-800">
                          <Download className="w-3 h-3" /> Image {i + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                Radiology Report
              </h3>
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-6 text-center">
                <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500 mb-3">No report submitted yet</p>
                {canReport && ["ORDERED","SCHEDULED","IMAGING_DONE"].includes(order.status) && (
                  <button
                    onClick={() => onReport(order)}
                    className="px-4 py-2 bg-cyan-600 text-white rounded-xl text-sm font-semibold hover:bg-cyan-700"
                  >
                    Submit Report
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 1 — QUEUE (Today)
// ════════════════════════════════════════════════════════════════════════════
const QueueTab = ({ refreshKey, userRole }) => {
  const [orders, setOrders]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState("")
  const [statusFilter, setSF]   = useState("ALL")
  const [selected, setSelected] = useState(null)
  const [reportModal, setRM]    = useState(null)
  const [refreshLocal, setRL]   = useState(0)

  const canReport = ["RADIOGRAPHER","SUPER_ADMIN","HOSPITAL_ADMIN"].includes(userRole)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get("/radiology/queue")
      setOrders(res.data.data?.orders || res.data.orders || [])
    } catch {
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, refreshKey, refreshLocal])

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/radiology/orders/${id}/status`, { status })
      toast.success("Status updated")
      setRL(k => k+1)
    } catch {
      toast.error("Failed to update status")
    }
  }

  const validateReport = async (order) => {
    try {
      await api.patch(`/radiology/reports/${order.report.id}/validate`)
      toast.success("Report validated")
      setRL(k => k+1)
      setSelected(null)
    } catch {
      toast.error("Failed to validate")
    }
  }

  const filtered = orders.filter(o => {
    const matchSearch = !search ||
      `${o.visit?.patient?.firstName} ${o.visit?.patient?.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      o.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
      o.visit?.patient?.mrn?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "ALL" || o.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search patient, MRN, order number…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
        </div>
        <select value={statusFilter} onChange={e => setSF(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500">
          <option value="ALL">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([k,v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {loading ? <SectionLoader /> : filtered.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No orders in today's queue"
          sub="Radiology orders placed today will appear here"
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const patient = order.visit?.patient
            const mc      = MODALITY_COLORS[order.service?.modality] || MODALITY_COLORS.OTHER
            return (
              <div key={order.id}
                className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-sm hover:border-cyan-200 transition-all cursor-pointer"
                onClick={() => setSelected(order)}
              >
                <div className="flex items-start gap-4">
                  {/* Modality icon */}
                  <div className={`w-12 h-12 rounded-xl ${mc.bg} flex items-center justify-center shrink-0`}>
                    <Radio className={`w-6 h-6 ${mc.icon}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {patient?.firstName} {patient?.lastName}
                        </p>
                        <p className="text-xs text-gray-400">
                          {patient?.mrn} · {order.orderNumber}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <PriorityBadge priority={order.priority} />
                        <StatusBadge status={order.status} />
                      </div>
                    </div>

                    <p className="text-sm font-semibold text-cyan-700 mb-1">
                      {order.service?.name}
                    </p>
                    <p className="text-xs text-gray-400 mb-2">
                      {order.service?.modality?.replace(/_/g," ")} · Ordered {fmtDateTime(order.orderedAt)}
                    </p>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                      {order.status === "ORDERED" && canReport && (
                        <button
                          onClick={() => updateStatus(order.id, "SCHEDULED")}
                          className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-lg hover:bg-purple-200 transition-all"
                        >
                          Mark Scheduled
                        </button>
                      )}
                      {order.status === "SCHEDULED" && canReport && (
                        <button
                          onClick={() => updateStatus(order.id, "IMAGING_DONE")}
                          className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-lg hover:bg-amber-200 transition-all"
                        >
                          Mark Imaging Done
                        </button>
                      )}
                      {["ORDERED","SCHEDULED","IMAGING_DONE"].includes(order.status) && canReport && !order.report && (
                        <button
                          onClick={() => setRM(order)}
                          className="text-xs bg-cyan-600 text-white px-3 py-1 rounded-lg hover:bg-cyan-700 transition-all flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" /> Submit Report
                        </button>
                      )}
                      {order.report && !order.report.validatedAt && canReport && (
                        <button
                          onClick={() => validateReport(order)}
                          className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition-all flex items-center gap-1"
                        >
                          <CheckCircle className="w-3 h-3" /> Validate
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Report Modal */}
      <ReportModal
        isOpen={!!reportModal}
        order={reportModal}
        onClose={() => setRM(null)}
        onSuccess={() => { setRL(k => k+1); setRM(null) }}
      />

      {/* Order Drawer */}
      {selected && (
        <OrderDrawer
          order={selected}
          onClose={() => setSelected(null)}
          onReport={(o) => { setRM(o); setSelected(null) }}
          onValidate={async (o) => {
            await validateReport(o)
          }}
          userRole={userRole}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 2 — ALL ORDERS
// ════════════════════════════════════════════════════════════════════════════
const AllOrdersTab = ({ refreshKey, userRole }) => {
  const [orders, setOrders]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState("")
  const [statusFilter, setSF]   = useState("ALL")
  const [selected, setSelected] = useState(null)
  const [reportModal, setRM]    = useState(null)
  const [refreshLocal, setRL]   = useState(0)

  const canReport = ["RADIOGRAPHER","SUPER_ADMIN","HOSPITAL_ADMIN"].includes(userRole)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search)                   params.set("search", search)
      if (statusFilter !== "ALL")   params.set("status", statusFilter)
      params.set("limit", "100")

      const res = await api.get(`/radiology/orders?${params}`)
      setOrders(res.data.data?.orders || res.data.orders || [])
    } catch {
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => { load() }, [load, refreshKey, refreshLocal])

  const validateReport = async (order) => {
    try {
      await api.patch(`/radiology/reports/${order.report.id}/validate`)
      toast.success("Report validated")
      setRL(k => k+1)
      setSelected(null)
    } catch {
      toast.error("Failed to validate")
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search patient, MRN, order number…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
        </div>
        <select value={statusFilter} onChange={e => setSF(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500">
          <option value="ALL">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([k,v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {loading ? <SectionLoader /> : orders.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No orders found"
          sub="Try adjusting your search or filters"
        />
      ) : (
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-12 gap-3 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <span className="col-span-3">Patient</span>
            <span className="col-span-3">Service</span>
            <span className="col-span-2">Status</span>
            <span className="col-span-2">Priority</span>
            <span className="col-span-2">Ordered</span>
          </div>

          {orders.map(order => {
            const patient = order.visit?.patient
            return (
              <div key={order.id}
                onClick={() => setSelected(order)}
                className="grid grid-cols-12 gap-3 items-center px-4 py-3 bg-white border border-gray-100 rounded-xl hover:border-cyan-200 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="col-span-3">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {patient?.firstName} {patient?.lastName}
                  </p>
                  <p className="text-xs text-gray-400">{patient?.mrn}</p>
                </div>
                <div className="col-span-3">
                  <p className="text-sm font-medium text-gray-700 truncate">
                    {order.service?.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {order.service?.modality?.replace(/_/g," ")}
                  </p>
                </div>
                <div className="col-span-2">
                  <StatusBadge status={order.status} />
                </div>
                <div className="col-span-2">
                  <PriorityBadge priority={order.priority} />
                </div>
                <div className="col-span-2 text-xs text-gray-500">
                  {fmtDateTime(order.orderedAt)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ReportModal
        isOpen={!!reportModal}
        order={reportModal}
        onClose={() => setRM(null)}
        onSuccess={() => { setRL(k => k+1); setRM(null) }}
      />

      {selected && (
        <OrderDrawer
          order={selected}
          onClose={() => setSelected(null)}
          onReport={(o) => { setRM(o); setSelected(null) }}
          onValidate={validateReport}
          userRole={userRole}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 3 — SERVICES
// ════════════════════════════════════════════════════════════════════════════
const ServicesTab = ({ refreshKey, userRole }) => {
  const [services, setServices] = useState([])
  const [grouped, setGrouped]   = useState({})
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState("")
  const [modal, setModal]       = useState(false)
  const [refreshLocal, setRL]   = useState(0)

  const canAdd = ["RADIOGRAPHER","SUPER_ADMIN","HOSPITAL_ADMIN"].includes(userRole)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get("/radiology/services")
      setServices(res.data.data?.services || res.data.services || [])
      setGrouped(res.data.data?.grouped   || res.data.grouped   || {})
    } catch {
      setServices([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, refreshKey, refreshLocal])

  const filtered = services.filter(s =>
    !search ||
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.modality?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search services…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
        </div>
        {canAdd && (
          <button onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-xl text-sm font-semibold hover:bg-cyan-700">
            <Plus className="w-4 h-4" /> Add Service
          </button>
        )}
      </div>

      {loading ? <SectionLoader /> : filtered.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No services found"
          sub="Add radiology services to the catalogue"
          action={canAdd && (
            <button onClick={() => setModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-xl text-sm font-semibold hover:bg-cyan-700">
              <Plus className="w-4 h-4" /> Add First Service
            </button>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(service => {
            const mc = MODALITY_COLORS[service.modality] || MODALITY_COLORS.OTHER
            return (
              <div key={service.id}
                className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md hover:border-cyan-200 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2.5 rounded-xl ${mc.bg}`}>
                    <Radio className={`w-5 h-5 ${mc.icon}`} />
                  </div>
                  <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                    {service.modality?.replace(/_/g," ")}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">{service.name}</h3>
                <p className="text-xs text-gray-500 mb-3">{service.description || "—"}</p>
                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                  <span className="text-xs text-gray-400 font-mono">{service.code}</span>
                  <span className="text-sm font-bold text-cyan-700">
                    KES {Number(service.price).toLocaleString()}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ServiceModal
        isOpen={modal}
        onClose={() => setModal(false)}
        onSuccess={() => { setRL(k => k+1); setModal(false) }}
      />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function RadiologyPage() {
  const { user }                  = useAuthStore()
  const [activeTab, setActiveTab] = useState("queue")
  const [stats, setStats]         = useState(null)
  const [statsLoading, setSL]     = useState(true)
  const [refreshKey, setRefresh]  = useState(0)

  const loadStats = useCallback(async () => {
    setSL(true)
    try {
      const res = await api.get("/radiology/stats")
      setStats(res.data.data || res.data)
    } catch {
      setStats({
        totalOrders: 0,
        todayOrders: 0,
        pending:     0,
        reported:    0,
        validated:   0,
      })
    } finally {
      setSL(false)
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats, refreshKey])

  const TABS = [
    { id:"queue",    label:"Today's Queue",  icon:Clock,    count: stats?.todayOrders },
    { id:"orders",   label:"All Orders",     icon:FileText, count: stats?.totalOrders },
    { id:"services", label:"Services",       icon:Layers,   count: null               },
  ]

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Radio className="w-7 h-7 text-cyan-600" />
            Radiology Department
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Imaging orders · Reports · Service catalogue
          </p>
        </div>
        <button
          onClick={() => setRefresh(k => k+1)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-all"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statsLoading ? (
          Array.from({ length:5 }).map((_,i) => (
            <div key={i} className="bg-gray-100 animate-pulse rounded-xl h-28" />
          ))
        ) : (
          <>
            <StatCard label="Total Orders"   value={stats?.totalOrders} icon={Radio}       color="cyan"    />
            <StatCard label="Today's Orders" value={stats?.todayOrders} icon={Calendar}    color="blue"    sub="Ordered today" />
            <StatCard label="Pending"        value={stats?.pending}     icon={Clock}       color="amber"   sub="Awaiting imaging/report" />
            <StatCard label="Reported"       value={stats?.reported}    icon={FileText}    color="emerald" sub="Awaiting validation" />
            <StatCard label="Validated"      value={stats?.validated}   icon={CheckCircle} color="green"   sub="Complete" />
          </>
        )}
      </div>

      {/* ── Pending Alert ── */}
      {stats?.pending > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {stats.pending} order{stats.pending > 1 ? "s" : ""} pending imaging or reporting
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Check today's queue and process pending orders
            </p>
          </div>
          <button
            onClick={() => setActiveTab("queue")}
            className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 shrink-0"
          >
            View Queue
          </button>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map(tab => {
            const Icon   = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold whitespace-nowrap border-b-2 transition-all ${
                  active
                    ? "border-cyan-600 text-cyan-700 bg-cyan-50/50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== null && tab.count !== undefined && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    active
                      ? "bg-cyan-100 text-cyan-700"
                      : "bg-gray-100 text-gray-500"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="p-6">
          {activeTab === "queue"    && <QueueTab      refreshKey={refreshKey} userRole={user?.role} />}
          {activeTab === "orders"   && <AllOrdersTab  refreshKey={refreshKey} userRole={user?.role} />}
          {activeTab === "services" && <ServicesTab   refreshKey={refreshKey} userRole={user?.role} />}
        </div>
      </div>

    </div>
  )
}