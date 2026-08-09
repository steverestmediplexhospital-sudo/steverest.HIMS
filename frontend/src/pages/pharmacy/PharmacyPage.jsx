import { useState, useEffect } from "react"
import api from "../../services/api"
import { toast } from "react-hot-toast"
import {
  Pill, Search, RefreshCw, CheckCircle, Clock,
  AlertTriangle, Package, ShoppingCart, FileText,
  X, Save, Plus, TrendingDown, Eye, ChevronDown, ChevronUp
} from "lucide-react"

const TABS = [
  { id: "queue",    label: "Prescription Queue", icon: Clock },
  { id: "dispense", label: "Dispense",            icon: ShoppingCart },
  { id: "stock",    label: "Drug Stock",          icon: Package },
  { id: "alerts",   label: "Stock Alerts",        icon: AlertTriangle }
]

export default function PharmacyPage() {
  const [activeTab, setActiveTab] = useState("queue")
  const [stats, setStats] = useState({ pending: 0, dispensed: 0, lowStock: 0, drugs: 0 })

  useEffect(() => { fetchStats() }, [])

  const fetchStats = async () => {
    try {
      const [rxRes, drugRes, alertRes] = await Promise.allSettled([
        api.get("/pharmacy/prescriptions?status=PENDING,VERIFIED"),
        api.get("/pharmacy/drugs"),
        api.get("/pharmacy/stock-alerts")
      ])
      setStats({
        pending: rxRes.status === "fulfilled" ? (rxRes.value.data.data || []).length : 0,
        drugs: drugRes.status === "fulfilled" ? (drugRes.value.data.data || []).length : 0,
        lowStock: alertRes.status === "fulfilled" ? (alertRes.value.data.data || []).length : 0,
        dispensed: 0
      })
    } catch (e) {}
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-800 via-green-700 to-emerald-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-green-200 text-sm">Pharmacy Department</p>
            <h1 className="text-2xl font-bold">Pharmacy Management System</h1>
            <p className="text-green-200 text-sm mt-1">St. Everest Mediplex</p>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Pending Rx", value: stats.pending, color: "bg-yellow-400/20" },
              { label: "Drugs", value: stats.drugs, color: "bg-blue-400/20" },
              { label: "Low Stock", value: stats.lowStock, color: "bg-red-400/20" },
              { label: "Dispensed Today", value: stats.dispensed, color: "bg-green-400/20" }
            ].map(s => (
              <div key={s.label} className={`${s.color} rounded-xl px-3 py-2 text-center`}>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-green-200 text-xs">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "border-b-2 border-green-600 text-green-700 bg-green-50"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}>
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.id === "queue" && stats.pending > 0 && (
                  <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{stats.pending}</span>
                )}
                {tab.id === "alerts" && stats.lowStock > 0 && (
                  <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">{stats.lowStock}</span>
                )}
              </button>
            )
          })}
        </div>
        <div className="p-5">
          {activeTab === "queue"    && <PrescriptionQueue onRefresh={fetchStats} />}
          {activeTab === "dispense" && <DispenseTab onRefresh={fetchStats} />}
          {activeTab === "stock"    && <DrugStock onRefresh={fetchStats} />}
          {activeTab === "alerts"   && <StockAlerts />}
        </div>
      </div>
    </div>
  )
}

// ── Prescription Queue ───────────────────────────────────────
function PrescriptionQueue({ onRefresh }) {
  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [dispensing, setDispensing] = useState(null)

  useEffect(() => { fetchRx() }, [])

  const fetchRx = async () => {
    setLoading(true)
    try {
      const res = await api.get("/pharmacy/prescriptions?status=PENDING,VERIFIED")
      setPrescriptions(res.data.data || [])
    } catch (e) {} finally { setLoading(false) }
  }

  const verify = async (id) => {
    try {
      await api.patch(`/pharmacy/prescriptions/${id}/verify`)
      toast.success("Prescription verified!")
      fetchRx(); onRefresh()
    } catch (e) { toast.error(e.response?.data?.message || "Failed") }
  }

  const dispense = async (prescription) => {
    try {
      await api.post(`/pharmacy/prescriptions/${prescription.id}/dispense`, {
        items: prescription.items.map(item => ({
          prescriptionItemId: item.id,
          quantityDispensed: item.quantity - item.dispensedQty
        }))
      })
      toast.success("Prescription dispensed successfully!")
      fetchRx(); onRefresh()
    } catch (e) { toast.error(e.response?.data?.message || "Dispense failed") }
  }

  const STATUS_COLOR = {
    PENDING: "bg-yellow-100 text-yellow-700",
    VERIFIED: "bg-blue-100 text-blue-700",
    DISPENSED: "bg-green-100 text-green-700",
    PARTIALLY_DISPENSED: "bg-orange-100 text-orange-700",
    CANCELLED: "bg-red-100 text-red-700"
  }

  if (loading) return (
    <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
  )

  if (!prescriptions.length) return (
    <div className="text-center py-16">
      <Pill className="w-16 h-16 text-gray-200 mx-auto mb-4" />
      <p className="text-gray-400 font-medium text-lg">No pending prescriptions</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {prescriptions.map(rx => (
        <div key={rx.id} className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-4 flex items-center gap-4 cursor-pointer" onClick={() => setExpanded(expanded === rx.id ? null : rx.id)}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-800">
                  {rx.visit?.patient?.firstName} {rx.visit?.patient?.lastName}
                </p>
                <span className="text-xs text-gray-400">{rx.visit?.patient?.patientNumber}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {rx.items?.length} item(s) — Prescribed by Dr. {rx.prescribedBy?.firstName} {rx.prescribedBy?.lastName}
              </p>
              <p className="text-xs text-gray-400">
                {new Date(rx.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[rx.status] || ""}`}>
                {rx.status?.replace(/_/g," ")}
              </span>
              {expanded === rx.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </div>
          </div>

          {expanded === rx.id && (
            <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
              {/* Drug Items */}
              <div className="space-y-2">
                {rx.items?.map(item => (
                  <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-800">{item.drug?.name}</p>
                        <p className="text-xs text-gray-500">{item.drug?.genericName} — {item.drug?.category}</p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="text-sm font-medium text-blue-700">{item.dose}</span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-sm text-gray-600">{item.frequency}</span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-sm text-gray-600">{item.duration}</span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-sm font-bold text-gray-800">Qty: {item.quantity}</span>
                        </div>
                        {item.instructions && (
                          <p className="text-xs text-orange-600 mt-1 italic">📋 {item.instructions}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-700">KES {((item.drug?.sellingPrice || 0) * item.quantity).toLocaleString()}</p>
                        {item.dispensedQty > 0 && (
                          <p className="text-xs text-gray-400">Dispensed: {item.dispensedQty}</p>
                        )}
                      </div>
                    </div>
                    {/* Stock check */}
                    {item.drug?.currentStock !== undefined && (
                      <div className={`mt-2 text-xs px-2 py-1 rounded ${item.drug.currentStock >= item.quantity ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                        Stock: {item.drug.currentStock} units available
                        {item.drug.currentStock < item.quantity && " — INSUFFICIENT STOCK"}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                {rx.status === "PENDING" && (
                  <button onClick={() => verify(rx.id)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                    <CheckCircle className="w-4 h-4" /> Verify Prescription
                  </button>
                )}
                {rx.status === "VERIFIED" && (
                  <button onClick={() => dispense(rx)}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
                    <ShoppingCart className="w-4 h-4" /> Dispense All Items
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Drug Stock ───────────────────────────────────────────────
function DrugStock({ onRefresh }) {
  const [drugs, setDrugs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showAddDrug, setShowAddDrug] = useState(false)
  const [showAddBatch, setShowAddBatch] = useState(null)
  const [form, setForm] = useState({ name: "", genericName: "", category: "", unit: "", reorderLevel: 10, sellingPrice: "", description: "" })
  const [batchForm, setBatchForm] = useState({ batchNumber: "", quantity: 0, expiryDate: "", purchasePrice: 0 })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { fetchDrugs() }, [])

  const fetchDrugs = async () => {
    setLoading(true)
    try {
      const res = await api.get("/pharmacy/drugs")
      setDrugs(res.data.data || [])
    } catch (e) {} finally { setLoading(false) }
  }

  const addDrug = async () => {
    if (!form.name || !form.category || !form.unit) { toast.error("Fill required fields"); return }
    setSubmitting(true)
    try {
      await api.post("/pharmacy/drugs", form)
      toast.success("Drug added to formulary!")
      setShowAddDrug(false)
      fetchDrugs(); onRefresh()
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed")
    } finally { setSubmitting(false) }
  }

  const addBatch = async () => {
    if (!batchForm.batchNumber || !batchForm.quantity || !batchForm.expiryDate) { toast.error("Fill required fields"); return }
    setSubmitting(true)
    try {
      await api.post(`/pharmacy/drugs/${showAddBatch}/batches`, batchForm)
      toast.success("Stock added!")
      setShowAddBatch(null)
      fetchDrugs()
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed")
    } finally { setSubmitting(false) }
  }

  const filtered = drugs.filter(d =>
    search === "" || d.name?.toLowerCase().includes(search.toLowerCase()) || d.genericName?.toLowerCase().includes(search.toLowerCase()) || d.category?.toLowerCase().includes(search.toLowerCase())
  )

  const CAT_COLOR = {
    ANTIBIOTIC: "bg-blue-100 text-blue-700", ANALGESIC: "bg-green-100 text-green-700",
    ANTIHYPERTENSIVE: "bg-purple-100 text-purple-700", ANTIDIABETIC: "bg-yellow-100 text-yellow-700",
    ANTIMALARIAL: "bg-orange-100 text-orange-700", ANTIFUNGAL: "bg-pink-100 text-pink-700",
    ANTIVIRAL: "bg-red-100 text-red-700", VITAMIN: "bg-teal-100 text-teal-700"
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search drugs..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <button onClick={() => setShowAddDrug(true)}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
          <Plus className="w-4 h-4" /> Add Drug
        </button>
      </div>

      <div className="text-sm text-gray-500">{filtered.length} drug(s) in formulary</div>

      <div className="space-y-2">
        {loading ? (
          [...Array(6)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)
        ) : filtered.map(drug => {
          const isLow = drug.currentStock !== undefined && drug.currentStock <= drug.reorderLevel
          const isOut = drug.currentStock !== undefined && drug.currentStock === 0
          return (
            <div key={drug.id} className={`border rounded-xl p-4 flex items-center gap-4 ${isOut ? "border-red-300 bg-red-50" : isLow ? "border-orange-300 bg-orange-50" : "border-gray-200"}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-800">{drug.name}</p>
                  <span className="text-xs text-gray-400">({drug.genericName})</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLOR[drug.category] || "bg-gray-100 text-gray-600"}`}>
                    {drug.category?.replace(/_/g," ")}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-gray-400">Unit: {drug.unit}</span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className={`text-sm font-bold ${isOut ? "text-red-700" : isLow ? "text-orange-700" : "text-green-700"}`}>
                    Stock: {drug.currentStock ?? "N/A"} {drug.unit}
                  </span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-gray-400">Reorder at: {drug.reorderLevel}</span>
                  {drug.sellingPrice && <><span className="text-xs text-gray-400">•</span><span className="text-xs font-bold text-green-700">KES {drug.sellingPrice}</span></>}
                </div>
                {isOut && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">OUT OF STOCK</span>}
                {isLow && !isOut && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">LOW STOCK</span>}
              </div>
              <button onClick={() => setShowAddBatch(drug.id)}
                className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 font-medium flex-shrink-0">
                + Add Stock
              </button>
            </div>
          )
        })}
      </div>

      {/* Add Drug Modal */}
      {showAddDrug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Add Drug to Formulary</h3>
              <button onClick={() => setShowAddDrug(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Brand Name *</label>
                  <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="Brand name"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Generic Name</label>
                  <input value={form.genericName} onChange={e => setForm(p => ({...p, genericName: e.target.value}))} placeholder="Generic/INN name"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Category *</label>
                  <select value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">Select...</option>
                    {["ANTIBIOTIC","ANALGESIC","ANTIHYPERTENSIVE","ANTIDIABETIC","ANTIMALARIAL","ANTIFUNGAL","ANTIVIRAL","VITAMIN","ANTIPARASITIC","ANTACID","ANTIHISTAMINE","CORTICOSTEROID","DIURETIC","OTHER"].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Unit *</label>
                  <select value={form.unit} onChange={e => setForm(p => ({...p, unit: e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">Select...</option>
                    {["Tablet","Capsule","Syrup (ml)","Injection (ml)","Cream (g)","Drops","Inhaler","Sachet","Suppository","Patch"].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Selling Price (NGN)</label>
                  <input type="number" value={form.sellingPrice} onChange={e => setForm(p => ({...p, sellingPrice: e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Reorder Level</label>
                <input type="number" value={form.reorderLevel} onChange={e => setForm(p => ({...p, reorderLevel: parseInt(e.target.value)}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAddDrug(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Cancel</button>
              <button onClick={addDrug} disabled={submitting}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                {submitting ? "Adding..." : "Add Drug"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Batch Modal */}
      {showAddBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Add Stock Batch</h3>
              <button onClick={() => setShowAddBatch(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Batch Number *</label>
                <input value={batchForm.batchNumber} onChange={e => setBatchForm(p => ({...p, batchNumber: e.target.value}))}
                  placeholder="e.g. BATCH-2024-001"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity *</label>
                  <input type="number" value={batchForm.quantity} onChange={e => setBatchForm(p => ({...p, quantity: parseInt(e.target.value)}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Purchase Price (KES)</label>
                  <input type="number" value={batchForm.purchasePrice} onChange={e => setBatchForm(p => ({...p, purchasePrice: parseFloat(e.target.value)}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Expiry Date *</label>
                <input type="date" value={batchForm.expiryDate} onChange={e => setBatchForm(p => ({...p, expiryDate: e.target.value}))}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAddBatch(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Cancel</button>
              <button onClick={addBatch} disabled={submitting}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                {submitting ? "Adding..." : "Add Stock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Dispense Tab ─────────────────────────────────────────────
function DispenseTab({ onRefresh }) {
  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <p className="text-green-700 font-semibold text-sm">💊 Quick Dispense</p>
        <p className="text-green-600 text-xs mt-1">Use the Prescription Queue tab to dispense verified prescriptions</p>
      </div>
      <div className="text-center py-8 text-gray-400">
        <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-200" />
        <p className="font-medium">Dispensing Log</p>
        <p className="text-sm">Recent dispensing records will appear here</p>
      </div>
    </div>
  )
}

// ── Stock Alerts ─────────────────────────────────────────────
function StockAlerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAlerts() }, [])

  const fetchAlerts = async () => {
    try {
      const res = await api.get("/pharmacy/stock-alerts")
      setAlerts(res.data.data || [])
    } catch (e) {} finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      {loading ? (
        [...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)
      ) : alerts.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="w-12 h-12 text-green-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No stock alerts</p>
          <p className="text-gray-300 text-sm">All drugs are adequately stocked</p>
        </div>
      ) : (
        alerts.map(drug => (
          <div key={drug.id} className={`border rounded-xl p-4 flex items-center gap-4 ${drug.currentStock === 0 ? "border-red-300 bg-red-50" : "border-orange-300 bg-orange-50"}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${drug.currentStock === 0 ? "bg-red-100" : "bg-orange-100"}`}>
              {drug.currentStock === 0 ? <AlertTriangle className="w-5 h-5 text-red-600" /> : <TrendingDown className="w-5 h-5 text-orange-600" />}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-800">{drug.name}</p>
              <p className="text-xs text-gray-500">{drug.genericName} — {drug.category}</p>
            </div>
            <div className="text-right">
              <p className={`text-lg font-bold ${drug.currentStock === 0 ? "text-red-700" : "text-orange-700"}`}>
                {drug.currentStock} {drug.unit}
              </p>
              <p className="text-xs text-gray-400">Min: {drug.reorderLevel} {drug.unit}</p>
              <span className={`text-xs font-medium ${drug.currentStock === 0 ? "text-red-600" : "text-orange-600"}`}>
                {drug.currentStock === 0 ? "OUT OF STOCK" : "LOW STOCK"}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  )
}