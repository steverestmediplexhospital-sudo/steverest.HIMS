// src/pages/facility/FacilityPage.jsx
import { useState, useEffect, useCallback } from "react"
import {
  Building2, Wrench, Zap, Package, Plus, Search, Filter,
  AlertTriangle, CheckCircle, Clock, XCircle, RefreshCw,
  ChevronRight, X, Save, Loader2, Eye, Edit3, Trash2,
  Calendar, User, MapPin, TrendingUp, Activity, Settings,
  BarChart2, FileText, Droplets,
  Thermometer, Wind, Shield, Bell, Download,
  ArrowUpRight, ArrowDownRight, Hash, Info, Star,
  CheckSquare, AlertCircle, Battery, Cpu, Monitor,
  Truck, Flame, WifiOff, Wifi
} from "lucide-react"
import api from "../../services/api"
import toast from "react-hot-toast"
import useAuthStore from "../../store/authStore"

// ─── Colour palette ───────────────────────────────────────────────────────
const C = {
  primary: "emerald",
  stat: [
    { bg: "bg-emerald-50", text: "text-emerald-700", icon: "text-emerald-500", border: "border-emerald-100" },
    { bg: "bg-amber-50",   text: "text-amber-700",   icon: "text-amber-500",   border: "border-amber-100"   },
    { bg: "bg-blue-50",    text: "text-blue-700",    icon: "text-blue-500",    border: "border-blue-100"    },
    { bg: "bg-red-50",     text: "text-red-700",     icon: "text-red-500",     border: "border-red-100"     },
  ],
}

// ─── Status helpers ───────────────────────────────────────────────────────
const ASSET_STATUS = {
  OPERATIONAL:    { label: "Operational",    color: "bg-emerald-100 text-emerald-700", icon: CheckCircle   },
  UNDER_REPAIR:   { label: "Under Repair",   color: "bg-amber-100 text-amber-700",     icon: Wrench        },
  DECOMMISSIONED: { label: "Decommissioned", color: "bg-gray-100 text-gray-600",       icon: XCircle       },
  FAULTY:         { label: "Faulty",         color: "bg-red-100 text-red-700",         icon: AlertTriangle },
}

const MAINT_STATUS = {
  PENDING:     { label: "Pending",     color: "bg-amber-100 text-amber-700",    icon: Clock         },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-100 text-blue-700",      icon: Activity      },
  COMPLETED:   { label: "Completed",   color: "bg-emerald-100 text-emerald-700",icon: CheckCircle   },
  CANCELLED:   { label: "Cancelled",   color: "bg-gray-100 text-gray-600",      icon: XCircle       },
  OVERDUE:     { label: "Overdue",     color: "bg-red-100 text-red-700",        icon: AlertTriangle },
}

const PRIORITY = {
  LOW:      { label: "Low",      color: "bg-gray-100 text-gray-600"   },
  MEDIUM:   { label: "Medium",   color: "bg-blue-100 text-blue-700"   },
  HIGH:     { label: "High",     color: "bg-amber-100 text-amber-700" },
  CRITICAL: { label: "Critical", color: "bg-red-100 text-red-700"     },
}

const ASSET_CATEGORIES = [
  "Medical Equipment","Furniture","Generator","HVAC",
  "Electrical","Plumbing","Vehicle","IT Equipment",
  "Kitchen Equipment","Laundry Equipment","Other",
]

// ─── Utility helpers ──────────────────────────────────────────────────────
const fmtDate     = (d) => d ? new Date(d).toLocaleDateString("en-KE", { day:"2-digit", month:"short", year:"numeric" }) : "—"
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("en-KE",     { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—"
const isOverdue   = (d) => d && new Date(d) < new Date()

// ─── Badge ────────────────────────────────────────────────────────────────
const Badge = ({ cfg }) => {
  if (!cfg) return null
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      {Icon && <Icon className="w-3 h-3" />}
      {cfg.label}
    </span>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, idx, sub }) => {
  const s = C.stat[idx % 4]
  return (
    <div className={`${s.bg} border ${s.border} rounded-xl p-4 flex items-start gap-3`}>
      <div className="p-2 bg-white rounded-lg shadow-sm">
        <Icon className={`w-5 h-5 ${s.icon}`} />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className={`text-2xl font-bold ${s.text}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Section Loader ───────────────────────────────────────────────────────
const SectionLoader = () => (
  <div className="flex items-center justify-center py-16">
    <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
    <span className="ml-2 text-gray-400 text-sm">Loading…</span>
  </div>
)

// ─── Empty State ──────────────────────────────────────────────────────────
const EmptyState = ({ icon: Icon, title, sub, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
      <Icon className="w-7 h-7 text-gray-400" />
    </div>
    <p className="font-semibold text-gray-700">{title}</p>
    <p className="text-sm text-gray-400 mt-1 mb-4">{sub}</p>
    {action}
  </div>
)

// ════════════════════════════════════════════════════════════════════════════
// MODAL — ADD / EDIT ASSET
// ════════════════════════════════════════════════════════════════════════════
const AssetModal = ({ isOpen, onClose, onSuccess, asset }) => {
  const isEdit = !!asset
  const [form, setForm] = useState({
    name:"", category:"Medical Equipment", serialNumber:"",
    location:"", manufacturer:"", model:"", purchaseDate:"",
    purchaseCost:"", warrantyExpiry:"", status:"OPERATIONAL", notes:"",
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (asset) {
      setForm({
        name:           asset.name           || "",
        category:       asset.category       || "Medical Equipment",
        serialNumber:   asset.serialNumber   || "",
        location:       asset.location       || "",
        manufacturer:   asset.manufacturer   || "",
        model:          asset.model          || "",
        purchaseDate:   asset.purchaseDate   ? asset.purchaseDate.slice(0,10)   : "",
        purchaseCost:   asset.purchaseCost   || "",
        warrantyExpiry: asset.warrantyExpiry ? asset.warrantyExpiry.slice(0,10) : "",
        status:         asset.status         || "OPERATIONAL",
        notes:          asset.notes          || "",
      })
    } else {
      setForm({
        name:"", category:"Medical Equipment", serialNumber:"",
        location:"", manufacturer:"", model:"", purchaseDate:"",
        purchaseCost:"", warrantyExpiry:"", status:"OPERATIONAL", notes:"",
      })
    }
  }, [asset, isOpen])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async () => {
    if (!form.name.trim())     return toast.error("Asset name is required")
    if (!form.location.trim()) return toast.error("Location is required")
    setSaving(true)
    try {
      const payload = {
        ...form,
        purchaseCost:   form.purchaseCost   ? parseFloat(form.purchaseCost)   : null,
        purchaseDate:   form.purchaseDate   || null,
        warrantyExpiry: form.warrantyExpiry || null,
      }
      if (isEdit) {
        await api.put(`/facility/assets/${asset.id}`, payload)
        toast.success("Asset updated")
      } else {
        await api.post("/facility/assets", payload)
        toast.success("Asset registered")
      }
      onSuccess()
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to save asset")
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-xl"><Package className="w-5 h-5 text-emerald-600" /></div>
            <div>
              <h2 className="font-bold text-gray-900">{isEdit ? "Edit Asset" : "Register New Asset"}</h2>
              <p className="text-xs text-gray-400">Facility asset registry</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Asset Name *</label>
              <input value={form.name} onChange={e => set("name", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g. Philips Ultrasound Machine" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
              <select value={form.category} onChange={e => set("category", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {ASSET_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {Object.keys(ASSET_STATUS).map(s => <option key={s} value={s}>{ASSET_STATUS[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Serial Number</label>
              <input value={form.serialNumber} onChange={e => set("serialNumber", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="SN-XXXXXXXXXX" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Location *</label>
              <input value={form.location} onChange={e => set("location", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g. Ward 3, Room 3B" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Manufacturer</label>
              <input value={form.manufacturer} onChange={e => set("manufacturer", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g. Philips, GE, Siemens" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Model</label>
              <input value={form.model} onChange={e => set("model", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Model number" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Purchase Date</label>
              <input type="date" value={form.purchaseDate} onChange={e => set("purchaseDate", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Purchase Cost (KES)</label>
              <input type="number" value={form.purchaseCost} onChange={e => set("purchaseCost", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0.00" min="0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Warranty Expiry</label>
              <input type="date" value={form.warrantyExpiry} onChange={e => set("warrantyExpiry", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                placeholder="Additional notes about this asset…" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? "Save Changes" : "Register Asset"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL — MAINTENANCE REQUEST
// ════════════════════════════════════════════════════════════════════════════
const MaintenanceModal = ({ isOpen, onClose, onSuccess, request, assets }) => {
  const isEdit = !!request
  const [form, setForm] = useState({
    assetId:"", title:"", description:"", priority:"MEDIUM",
    scheduledDate:"", assignedTo:"", estimatedCost:"", notes:"", status:"PENDING",
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (request) {
      setForm({
        assetId:       request.assetId       || "",
        title:         request.title         || "",
        description:   request.description   || "",
        priority:      request.priority      || "MEDIUM",
        scheduledDate: request.scheduledDate ? request.scheduledDate.slice(0,10) : "",
        assignedTo:    request.assignedTo    || "",
        estimatedCost: request.estimatedCost || "",
        notes:         request.notes         || "",
        status:        request.status        || "PENDING",
      })
    } else {
      setForm({
        assetId:"", title:"", description:"", priority:"MEDIUM",
        scheduledDate:"", assignedTo:"", estimatedCost:"", notes:"", status:"PENDING",
      })
    }
  }, [request, isOpen])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async () => {
    if (!form.title.trim())       return toast.error("Title is required")
    if (!form.description.trim()) return toast.error("Description is required")
    setSaving(true)
    try {
      const payload = {
        ...form,
        assetId:       form.assetId       || null,
        scheduledDate: form.scheduledDate || null,
        estimatedCost: form.estimatedCost ? parseFloat(form.estimatedCost) : null,
      }
      if (isEdit) {
        await api.put(`/facility/maintenance/${request.id}`, payload)
        toast.success("Work order updated")
      } else {
        await api.post("/facility/maintenance", payload)
        toast.success("Work order created")
      }
      onSuccess()
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to save work order")
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl"><Wrench className="w-5 h-5 text-amber-600" /></div>
            <div>
              <h2 className="font-bold text-gray-900">{isEdit ? "Edit Work Order" : "New Work Order"}</h2>
              <p className="text-xs text-gray-400">Maintenance request</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Title *</label>
            <input value={form.title} onChange={e => set("title", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Brief description of the issue" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Related Asset</label>
              <select value={form.assetId} onChange={e => set("assetId", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                <option value="">— No specific asset —</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Priority</label>
              <select value={form.priority} onChange={e => set("priority", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                {Object.keys(PRIORITY).map(p => <option key={p} value={p}>{PRIORITY[p].label}</option>)}
              </select>
            </div>
            {isEdit && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                <select value={form.status} onChange={e => set("status", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                  {Object.keys(MAINT_STATUS).map(s => <option key={s} value={s}>{MAINT_STATUS[s].label}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Scheduled Date</label>
              <input type="date" value={form.scheduledDate} onChange={e => set("scheduledDate", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Assigned To</label>
              <input value={form.assignedTo} onChange={e => set("assignedTo", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Technician / contractor name" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Estimated Cost (NGN)</label>
              <input type="number" value={form.estimatedCost} onChange={e => set("estimatedCost", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="0.00" min="0" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description *</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              placeholder="Detailed description of the problem…" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              placeholder="Additional notes…" />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-5 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-60 flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? "Save Changes" : "Create Work Order"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL — UTILITY LOG
// ════════════════════════════════════════════════════════════════════════════
const UtilityModal = ({ isOpen, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    type:"ELECTRICITY", readingDate:new Date().toISOString().slice(0,10),
    previousReading:"", currentReading:"", unit:"kWh",
    cost:"", notes:"", supplier:"",
  })
  const [saving, setSaving] = useState(false)

  const UTILITY_TYPES = [
    { value:"ELECTRICITY", label:"Electricity",   unit:"kWh",       icon:Zap      },
    { value:"WATER",       label:"Water",          unit:"m³",        icon:Droplets },
    { value:"FUEL",        label:"Fuel/Generator", unit:"Litres",    icon:Flame    },
    { value:"GAS",         label:"Medical Gas",    unit:"Cylinders", icon:Wind     },
  ]

  useEffect(() => {
    const ut = UTILITY_TYPES.find(u => u.value === form.type)
    if (ut) setForm(p => ({ ...p, unit: ut.unit }))
  }, [form.type])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const consumption = form.currentReading && form.previousReading
    ? (parseFloat(form.currentReading) - parseFloat(form.previousReading)).toFixed(2)
    : "—"

  const handleSubmit = async () => {
    if (!form.currentReading) return toast.error("Current reading is required")
    setSaving(true)
    try {
      await api.post("/facility/utilities", {
        ...form,
        previousReading: form.previousReading ? parseFloat(form.previousReading) : null,
        currentReading:  parseFloat(form.currentReading),
        cost:            form.cost ? parseFloat(form.cost) : null,
      })
      toast.success("Utility reading logged")
      onSuccess()
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to log reading")
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl"><Zap className="w-5 h-5 text-blue-600" /></div>
            <div>
              <h2 className="font-bold text-gray-900">Log Utility Reading</h2>
              <p className="text-xs text-gray-400">Record meter reading / consumption</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Utility Type</label>
            <div className="grid grid-cols-4 gap-2">
              {UTILITY_TYPES.map(ut => {
                const Icon   = ut.icon
                const active = form.type === ut.value
                return (
                  <button key={ut.value} onClick={() => set("type", ut.value)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-xs font-medium transition-all ${
                      active ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}>
                    <Icon className="w-4 h-4" />
                    {ut.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Reading Date</label>
              <input type="date" value={form.readingDate} onChange={e => set("readingDate", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Supplier / Meter</label>
              <input value={form.supplier} onChange={e => set("supplier", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. KPLC, Nairobi Water" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Previous Reading ({form.unit})</label>
              <input type="number" value={form.previousReading} onChange={e => set("previousReading", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0" min="0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Current Reading ({form.unit}) *</label>
              <input type="number" value={form.currentReading} onChange={e => set("currentReading", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0" min="0" />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700">Calculated Consumption</span>
            <span className="text-lg font-bold text-blue-800">
              {consumption} {consumption !== "—" ? form.unit : ""}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Cost (KES)</label>
              <input type="number" value={form.cost} onChange={e => set("cost", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00" min="0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
              <input value={form.notes} onChange={e => set("notes", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Any remarks" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Log Reading
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// ASSET DETAIL DRAWER
// ════════════════════════════════════════════════════════════════════════════
const AssetDrawer = ({ asset, onClose, onEdit, onMaintenance }) => {
  if (!asset) return null
  const status         = ASSET_STATUS[asset.status] || ASSET_STATUS.OPERATIONAL
  const warrantyExpired = asset.warrantyExpiry && isOverdue(asset.warrantyExpiry)

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-2xl overflow-y-auto flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between mb-3">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <Package className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => onEdit(asset)}        className="p-2 rounded-xl hover:bg-gray-100"  title="Edit"><Edit3  className="w-4 h-4 text-gray-500"  /></button>
              <button onClick={() => onMaintenance(asset)} className="p-2 rounded-xl hover:bg-amber-50"  title="Log Maintenance"><Wrench className="w-4 h-4 text-amber-500" /></button>
              <button onClick={onClose}                    className="p-2 rounded-xl hover:bg-gray-100"><X     className="w-4 h-4 text-gray-400" /></button>
            </div>
          </div>
          <h2 className="font-bold text-gray-900 text-lg leading-tight">{asset.name}</h2>
          <p className="text-sm text-gray-400 mt-1">{asset.category} · {asset.location}</p>
          <div className="mt-3"><Badge cfg={status} /></div>
        </div>

        <div className="flex-1 p-6 space-y-5">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Asset Details</h3>
            <div className="space-y-2">
              {[
                ["Serial Number", asset.serialNumber  || "—"],
                ["Manufacturer",  asset.manufacturer  || "—"],
                ["Model",         asset.model         || "—"],
                ["Location",      asset.location      || "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className="text-xs font-semibold text-gray-800">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Financial</h3>
            <div className="space-y-2">
              {[
                ["Purchase Date",   fmtDate(asset.purchaseDate)],
                ["Purchase Cost",   asset.purchaseCost ? `NGN ${Number(asset.purchaseCost).toLocaleString()}` : "—"],
                ["Warranty Expiry", fmtDate(asset.warrantyExpiry)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className={`text-xs font-semibold ${label === "Warranty Expiry" && warrantyExpired ? "text-red-600" : "text-gray-800"}`}>
                    {value} {label === "Warranty Expiry" && warrantyExpired && "⚠️"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {asset.notes && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Notes</h3>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3">{asset.notes}</p>
            </div>
          )}

          {asset.maintenanceRequests?.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                Maintenance History ({asset.maintenanceRequests.length})
              </h3>
              <div className="space-y-2">
                {asset.maintenanceRequests.slice(0,5).map(m => {
                  const ms = MAINT_STATUS[m.status] || MAINT_STATUS.PENDING
                  return (
                    <div key={m.id} className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl">
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${
                        m.status === "COMPLETED" ? "bg-emerald-500" :
                        m.status === "OVERDUE"   ? "bg-red-500"     : "bg-amber-500"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{m.title}</p>
                        <p className="text-xs text-gray-400">{fmtDate(m.scheduledDate)}</p>
                      </div>
                      <Badge cfg={ms} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 1 — ASSETS
// ════════════════════════════════════════════════════════════════════════════
const AssetsTab = ({ refreshKey }) => {
  const [assets, setAssets]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState("")
  const [catFilter, setCat]     = useState("ALL")
  const [statusFilter, setSF]   = useState("ALL")
  const [selected, setSelected] = useState(null)
  const [modal, setModal]       = useState(false)
  const [editAsset, setEdit]    = useState(null)
  const [maintModal, setMaint]  = useState(false)
  const [maintAsset, setMA]     = useState(null)
  const [refreshLocal, setRL]   = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get("/facility/assets")
      setAssets(res.data.data?.assets || res.data.assets || [])
    } catch {
      setAssets([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, refreshKey, refreshLocal])

  const filtered = assets.filter(a => {
    const matchSearch = !search ||
      a.name?.toLowerCase().includes(search.toLowerCase()) ||
      a.location?.toLowerCase().includes(search.toLowerCase()) ||
      a.serialNumber?.toLowerCase().includes(search.toLowerCase())
    const matchCat  = catFilter    === "ALL" || a.category === catFilter
    const matchStat = statusFilter === "ALL" || a.status   === statusFilter
    return matchSearch && matchCat && matchStat
  })

  const openEdit  = (asset) => { setEdit(asset); setModal(true); setSelected(null) }
  const openMaint = (asset) => { setMA(asset);   setMaint(true); setSelected(null) }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <select value={catFilter} onChange={e => setCat(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="ALL">All Categories</option>
          {ASSET_CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setSF(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="ALL">All Status</option>
          {Object.entries(ASSET_STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={() => { setEdit(null); setModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Register Asset
        </button>
      </div>

      {loading ? <SectionLoader /> : filtered.length === 0 ? (
        <EmptyState icon={Package} title="No assets found"
          sub={assets.length === 0 ? "Register your first hospital asset" : "Try adjusting your search or filters"}
          action={assets.length === 0 && (
            <button onClick={() => { setEdit(null); setModal(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">
              <Plus className="w-4 h-4" /> Register First Asset
            </button>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(asset => {
            const status         = ASSET_STATUS[asset.status] || ASSET_STATUS.OPERATIONAL
            const warrantyExpired = asset.warrantyExpiry && isOverdue(asset.warrantyExpiry)
            return (
              <div key={asset.id} onClick={() => setSelected(asset)}
                className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md hover:border-emerald-200 cursor-pointer transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
                      <Package className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-xs text-gray-400">{asset.category}</p>
                  </div>
                  <Badge cfg={status} />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-1">{asset.name}</h3>
                <div className="space-y-1 mb-3">
                  {asset.location && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="w-3 h-3" /> {asset.location}
                    </div>
                  )}
                  {asset.manufacturer && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Info className="w-3 h-3" /> {asset.manufacturer}{asset.model && ` · ${asset.model}`}
                    </div>
                  )}
                  {asset.serialNumber && (
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Hash className="w-3 h-3" /> {asset.serialNumber}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    {warrantyExpired
                      ? <span className="text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Warranty expired</span>
                      : asset.warrantyExpiry
                        ? <span>Warranty: {fmtDate(asset.warrantyExpiry)}</span>
                        : <span>No warranty info</span>
                    }
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => { e.stopPropagation(); openEdit(asset) }}  className="p-1.5 rounded-lg hover:bg-emerald-50"><Edit3  className="w-3.5 h-3.5 text-emerald-600" /></button>
                    <button onClick={e => { e.stopPropagation(); openMaint(asset) }} className="p-1.5 rounded-lg hover:bg-amber-50"> <Wrench className="w-3.5 h-3.5 text-amber-600"   /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AssetModal
        isOpen={modal} onClose={() => { setModal(false); setEdit(null) }}
        onSuccess={() => setRL(k => k+1)} asset={editAsset}
      />
      <MaintenanceModal
        isOpen={maintModal} onClose={() => { setMaint(false); setMA(null) }}
        onSuccess={() => setRL(k => k+1)} assets={assets}
        request={maintAsset ? { assetId: maintAsset.id } : null}
      />
      <AssetDrawer
        asset={selected} onClose={() => setSelected(null)}
        onEdit={openEdit} onMaintenance={openMaint}
      />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 2 — MAINTENANCE
// ════════════════════════════════════════════════════════════════════════════
const MaintenanceTab = ({ refreshKey }) => {
  const [requests, setReqs]       = useState([])
  const [assets, setAssets]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState("")
  const [statusFilter, setSF]     = useState("ALL")
  const [priorityFilter, setPF]   = useState("ALL")
  const [modal, setModal]         = useState(false)
  const [selected, setSelected]   = useState(null)
  const [refreshLocal, setRL]     = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [reqRes, aRes] = await Promise.all([
        api.get("/facility/maintenance"),
        api.get("/facility/assets"),
      ])
      setReqs(reqRes.data.data?.requests || reqRes.data.requests || [])
      setAssets(aRes.data.data?.assets   || aRes.data.assets     || [])
    } catch {
      setReqs([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, refreshKey, refreshLocal])

  const filtered = requests.filter(r => {
    const matchSearch = !search ||
      r.title?.toLowerCase().includes(search.toLowerCase()) ||
      r.assignedTo?.toLowerCase().includes(search.toLowerCase())
    const matchStat = statusFilter   === "ALL" || r.status   === statusFilter
    const matchPri  = priorityFilter === "ALL" || r.priority === priorityFilter
    return matchSearch && matchStat && matchPri
  })

  const complete = async (id) => {
    try {
      await api.put(`/facility/maintenance/${id}`, { status:"COMPLETED" })
      toast.success("Marked as completed")
      setRL(k => k+1)
    } catch {
      toast.error("Failed to update")
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search work orders…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
        </div>
        <select value={statusFilter} onChange={e => setSF(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
          <option value="ALL">All Status</option>
          {Object.entries(MAINT_STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={priorityFilter} onChange={e => setPF(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
          <option value="ALL">All Priority</option>
          {Object.entries(PRIORITY).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={() => setModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700">
          <Plus className="w-4 h-4" /> New Work Order
        </button>
      </div>

      {loading ? <SectionLoader /> : filtered.length === 0 ? (
        <EmptyState icon={Wrench} title="No work orders"
          sub="No maintenance requests match your filters"
          action={
            <button onClick={() => setModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700">
              <Plus className="w-4 h-4" /> Create Work Order
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const ms     = MAINT_STATUS[req.status]   || MAINT_STATUS.PENDING
            const pr     = PRIORITY[req.priority]     || PRIORITY.MEDIUM
            const overdue = req.scheduledDate && isOverdue(req.scheduledDate) && req.status !== "COMPLETED"
            return (
              <div key={req.id}
                className={`bg-white border rounded-xl p-4 hover:shadow-sm transition-all ${
                  overdue ? "border-red-200 bg-red-50/30" : "border-gray-100"
                }`}>
                <div className="flex items-start gap-4">
                  <div className={`w-1 self-stretch rounded-full ${
                    req.priority === "CRITICAL" ? "bg-red-500"   :
                    req.priority === "HIGH"     ? "bg-amber-500" :
                    req.priority === "MEDIUM"   ? "bg-blue-400"  : "bg-gray-300"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm">{req.title}</h3>
                        {req.asset && <p className="text-xs text-gray-500 mt-0.5">Asset: {req.asset.name}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pr.color}`}>{pr.label}</span>
                        <Badge cfg={ms} />
                        {overdue && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Overdue
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">{req.description}</p>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
                      {req.scheduledDate && (
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Scheduled: {fmtDate(req.scheduledDate)}</span>
                      )}
                      {req.assignedTo && (
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {req.assignedTo}</span>
                      )}
                      {req.estimatedCost && (
                        <span className="font-medium text-gray-600">KES {Number(req.estimatedCost).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {req.status !== "COMPLETED" && req.status !== "CANCELLED" && (
                      <button onClick={() => complete(req.id)}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-100 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Complete
                      </button>
                    )}
                    <button onClick={() => setSelected(req)}
                      className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-100 flex items-center gap-1">
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <MaintenanceModal
        isOpen={modal || !!selected}
        onClose={() => { setModal(false); setSelected(null) }}
        onSuccess={() => setRL(k => k+1)}
        assets={assets} request={selected}
      />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 3 — UTILITIES
// ════════════════════════════════════════════════════════════════════════════
const UtilitiesTab = ({ refreshKey }) => {
  const [logs, setLogs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [typeFilter, setTF]     = useState("ALL")
  const [modal, setModal]       = useState(false)
  const [refreshLocal, setRL]   = useState(0)

  const TYPES = [
    { value:"ELECTRICITY", label:"Electricity", icon:Zap,      color:"text-yellow-600", bg:"bg-yellow-50"  },
    { value:"WATER",       label:"Water",       icon:Droplets, color:"text-blue-600",   bg:"bg-blue-50"    },
    { value:"FUEL",        label:"Fuel",        icon:Flame,    color:"text-orange-600", bg:"bg-orange-50"  },
    { value:"GAS",         label:"Gas",         icon:Wind,     color:"text-purple-600", bg:"bg-purple-50"  },
  ]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get("/facility/utilities")
      setLogs(res.data.data?.logs || res.data.logs || [])
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, refreshKey, refreshLocal])

  const filtered = typeFilter === "ALL" ? logs : logs.filter(l => l.type === typeFilter)

  const summaries = TYPES.map(t => {
    const typeLogs  = logs.filter(l => l.type === t.value)
    const totalCost = typeLogs.reduce((s, l) => s + (l.cost || 0), 0)
    const latestLog = typeLogs[0]
    return { ...t, totalCost, latestLog, count: typeLogs.length }
  })

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {summaries.map(s => {
          const Icon = s.icon
          return (
            <div key={s.value} className={`${s.bg} border border-gray-100 rounded-xl p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-5 h-5 ${s.color}`} />
                <span className="text-sm font-semibold text-gray-700">{s.label}</span>
              </div>
              <p className="text-lg font-bold text-gray-900">KES {s.totalCost.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">{s.count} readings logged</p>
              {s.latestLog && <p className="text-xs text-gray-500 mt-1">Last: {fmtDate(s.latestLog.readingDate)}</p>}
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-2">
          <button onClick={() => setTF("ALL")}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium ${typeFilter === "ALL" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            All
          </button>
          {TYPES.map(t => {
            const Icon = t.icon
            return (
              <button key={t.value} onClick={() => setTF(t.value)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium ${typeFilter === t.value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            )
          })}
        </div>
        <button onClick={() => setModal(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Log Reading
        </button>
      </div>

      {loading ? <SectionLoader /> : filtered.length === 0 ? (
        <EmptyState icon={Zap} title="No utility readings"
          sub="Start logging meter readings to track consumption"
          action={
            <button onClick={() => setModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Log First Reading
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-6 gap-4 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <span className="col-span-1">Type</span>
            <span className="col-span-1">Date</span>
            <span className="col-span-1">Previous</span>
            <span className="col-span-1">Current</span>
            <span className="col-span-1">Consumption</span>
            <span className="col-span-1">Cost (KES)</span>
          </div>
          {filtered.map(log => {
            const t   = TYPES.find(u => u.value === log.type)
            const Icon = t?.icon || Zap
            const consumption = log.currentReading && log.previousReading
              ? (log.currentReading - log.previousReading).toFixed(2)
              : "—"
            return (
              <div key={log.id}
                className="grid grid-cols-6 gap-4 items-center px-4 py-3 bg-white border border-gray-100 rounded-xl hover:border-blue-200 transition-all">
                <div className="col-span-1 flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${t?.bg || "bg-gray-50"}`}>
                    <Icon className={`w-4 h-4 ${t?.color || "text-gray-500"}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{t?.label || log.type}</span>
                </div>
                <span className="col-span-1 text-sm text-gray-600">{fmtDate(log.readingDate)}</span>
                <span className="col-span-1 text-sm text-gray-600">{log.previousReading ?? "—"} {log.unit}</span>
                <span className="col-span-1 text-sm text-gray-600">{log.currentReading} {log.unit}</span>
                <span className="col-span-1 text-sm font-semibold text-gray-900">
                  {consumption !== "—" ? `${consumption} ${log.unit}` : "—"}
                </span>
                <span className="col-span-1 text-sm font-semibold text-emerald-700">
                  {log.cost ? Number(log.cost).toLocaleString() : "—"}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <UtilityModal isOpen={modal} onClose={() => setModal(false)} onSuccess={() => setRL(k => k+1)} />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 4 — SPACES
// ════════════════════════════════════════════════════════════════════════════
const SpacesTab = ({ refreshKey }) => {
  const [spaces, setSpaces]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState("")
  const [modal, setModal]       = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm]         = useState({ name:"", type:"Office", floor:"", capacity:"", status:"ACTIVE", notes:"" })
  const [saving, setSaving]     = useState(false)
  const [refreshLocal, setRL]   = useState(0)

  const SPACE_TYPES = [
    "Office","Consultation Room","Laboratory","Pharmacy","Store",
    "Kitchen","Generator Room","Mechanical Room","Boardroom","Reception","Other",
  ]
  const SPACE_STATUS = {
    ACTIVE:           { label:"Active",      color:"bg-emerald-100 text-emerald-700" },
    INACTIVE:         { label:"Inactive",    color:"bg-gray-100 text-gray-600"       },
    UNDER_RENOVATION: { label:"Renovation",  color:"bg-amber-100 text-amber-700"     },
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get("/facility/spaces")
      setSpaces(res.data.data?.spaces || res.data.spaces || [])
    } catch {
      setSpaces([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, refreshKey, refreshLocal])

  const filtered = spaces.filter(s =>
    !search ||
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.type?.toLowerCase().includes(search.toLowerCase())
  )

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error("Space name is required")
    setSaving(true)
    try {
      if (selected) {
        await api.put(`/facility/spaces/${selected.id}`, form)
        toast.success("Space updated")
      } else {
        await api.post("/facility/spaces", form)
        toast.success("Space registered")
      }
      setModal(false); setSelected(null)
      setForm({ name:"", type:"Office", floor:"", capacity:"", status:"ACTIVE", notes:"" })
      setRL(k => k+1)
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search spaces…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <button onClick={() => {
          setSelected(null)
          setForm({ name:"", type:"Office", floor:"", capacity:"", status:"ACTIVE", notes:"" })
          setModal(true)
        }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Add Space
        </button>
      </div>

      {loading ? <SectionLoader /> : filtered.length === 0 ? (
        <EmptyState icon={Building2} title="No spaces registered"
          sub="Register hospital spaces, rooms and areas"
          action={
            <button onClick={() => setModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">
              <Plus className="w-4 h-4" /> Add First Space
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(sp => {
            const ss = SPACE_STATUS[sp.status] || SPACE_STATUS.ACTIVE
            return (
              <div key={sp.id}
                className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md hover:border-emerald-200 transition-all group cursor-pointer"
                onClick={() => {
                  setSelected(sp)
                  setForm({ name:sp.name, type:sp.type, floor:sp.floor||"", capacity:sp.capacity||"", status:sp.status, notes:sp.notes||"" })
                  setModal(true)
                }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-emerald-50 rounded-lg"><Building2 className="w-4 h-4 text-emerald-600" /></div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ss.color}`}>{ss.label}</span>
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">{sp.name}</h3>
                <p className="text-xs text-gray-500 mb-3">{sp.type}</p>
                <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-50">
                  {sp.floor    && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Floor {sp.floor}</span>}
                  {sp.capacity && <span className="flex items-center gap-1"><User   className="w-3 h-3" /> Capacity: {sp.capacity}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-xl"><Building2 className="w-5 h-5 text-emerald-600" /></div>
                <h2 className="font-bold text-gray-900">{selected ? "Edit Space" : "Add Space"}</h2>
              </div>
              <button onClick={() => { setModal(false); setSelected(null) }} className="p-2 rounded-xl hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Space Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({...p, name:e.target.value}))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. Medical Records Room" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm(p => ({...p, type:e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    {SPACE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({...p, status:e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    {Object.keys(SPACE_STATUS).map(s => <option key={s} value={s}>{SPACE_STATUS[s].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Floor</label>
                  <input value={form.floor} onChange={e => setForm(p => ({...p, floor:e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="G / 1 / 2 …" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Capacity</label>
                  <input type="number" value={form.capacity} onChange={e => setForm(p => ({...p, capacity:e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Max persons" min="0" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({...p, notes:e.target.value}))} rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  placeholder="Any additional notes…" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => { setModal(false); setSelected(null) }}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSubmit} disabled={saving}
                className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {selected ? "Save Changes" : "Add Space"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function FacilityPage() {
  const { user }                  = useAuthStore()
  const [activeTab, setActiveTab] = useState("assets")
  const [stats, setStats]         = useState(null)
  const [statsLoading, setSL]     = useState(true)
  const [refreshKey, setRefresh]  = useState(0)

  // Load stats
  const loadStats = useCallback(async () => {
    setSL(true)
    try {
      const res = await api.get("/facility/stats")
      setStats(res.data.data || res.data)
    } catch {
      setStats({
        totalAssets:        0,
        operational:        0,
        pendingMaintenance: 0,
        overdueWork:        0,
        utilityCount:       0,
        spaceCount:         0,
      })
    } finally {
      setSL(false)
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats, refreshKey])

  const TABS = [
    { id:"assets",      label:"Assets",      icon:Package,   count: stats?.totalAssets        },
    { id:"maintenance", label:"Maintenance",  icon:Wrench,    count: stats?.pendingMaintenance,
      alert: stats?.overdueWork > 0 },
    { id:"utilities",   label:"Utilities",   icon:Zap,       count: stats?.utilityCount       },
    { id:"spaces",      label:"Spaces",      icon:Building2, count: stats?.spaceCount         },
  ]

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facility Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Assets · Maintenance · Utilities · Spaces
          </p>
        </div>
        <button
          onClick={() => setRefresh(k => k+1)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-all"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length:4 }).map((_,i) => (
            <div key={i} className="bg-gray-100 animate-pulse rounded-xl h-24" />
          ))
        ) : (
          <>
            <StatCard
              label="Total Assets"     idx={0}
              value={stats?.totalAssets || 0}
              icon={Package}
              sub={`${stats?.operational || 0} operational`}
            />
            <StatCard
              label="Pending Maintenance" idx={1}
              value={stats?.pendingMaintenance || 0}
              icon={Wrench}
              sub={stats?.overdueWork > 0 ? `⚠️ ${stats.overdueWork} overdue` : "All on schedule"}
            />
            <StatCard
              label="Utility Readings" idx={2}
              value={stats?.utilityCount || 0}
              icon={Zap}
              sub="Logged this period"
            />
            <StatCard
              label="Registered Spaces" idx={3}
              value={stats?.spaceCount || 0}
              icon={Building2}
              sub="Rooms & areas"
            />
          </>
        )}
      </div>

      {/* ── Overdue Warning Banner ── */}
      {stats?.overdueWork > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">
              {stats.overdueWork} overdue maintenance {stats.overdueWork === 1 ? "work order" : "work orders"}
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              These work orders are past their scheduled date and require immediate attention
            </p>
          </div>
          <button
            onClick={() => setActiveTab("maintenance")}
            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 shrink-0"
          >
            View Now
          </button>
        </div>
      )}

      {/* ── Tab Navigation ── */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        {/* Tabs */}
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
                    ? "border-emerald-600 text-emerald-700 bg-emerald-50/50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && tab.count !== null && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    tab.alert
                      ? "bg-red-100 text-red-700"
                      : active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-500"
                  }`}>
                    {tab.count}
                  </span>
                )}
                {tab.alert && (
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                )}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === "assets"      && <AssetsTab      refreshKey={refreshKey} />}
          {activeTab === "maintenance" && <MaintenanceTab refreshKey={refreshKey} />}
          {activeTab === "utilities"   && <UtilitiesTab   refreshKey={refreshKey} />}
          {activeTab === "spaces"      && <SpacesTab      refreshKey={refreshKey} />}
        </div>
      </div>
    </div>
  )
}