// frontend/src/pages/inventory/InventoryPage.jsx
import { useState, useEffect, useCallback } from "react"
import useAuthStore from "../../store/authStore"
import api from "../../services/api"
import toast from "react-hot-toast"
import {
  Package, Plus, Search, RefreshCw, X, CheckCircle,
  AlertTriangle, Calendar, Clock, FileText, Eye,
  TrendingUp, TrendingDown, BarChart3, Hash,
  ArrowRight, ArrowUp, ArrowDown, Truck,
  ShoppingCart, Archive, Tag, Layers,
  ChevronDown, ChevronRight, Edit, Trash2,
  Download, Printer, Users, Building2,
  DollarSign, Activity, Star, Shield, Zap
} from "lucide-react"

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  "MEDICAL_SUPPLIES", "SURGICAL_SUPPLIES", "LABORATORY",
  "STATIONERY", "CLEANING", "LINEN", "EQUIPMENT",
  "PROTECTIVE_EQUIPMENT", "FURNITURE", "OTHER"
]

const CATEGORY_CONFIG = {
  MEDICAL_SUPPLIES:    { label: "Medical Supplies",    color: "blue"   },
  SURGICAL_SUPPLIES:   { label: "Surgical Supplies",   color: "indigo" },
  LABORATORY:          { label: "Laboratory",          color: "purple" },
  STATIONERY:          { label: "Stationery",          color: "yellow" },
  CLEANING:            { label: "Cleaning",            color: "green"  },
  LINEN:               { label: "Linen & Bedding",     color: "pink"   },
  EQUIPMENT:           { label: "Equipment",           color: "orange" },
  PROTECTIVE_EQUIPMENT:{ label: "PPE",                 color: "red"    },
  FURNITURE:           { label: "Furniture",           color: "amber"  },
  OTHER:               { label: "Other",               color: "gray"   }
}

const MOVEMENT_TYPES = {
  PURCHASE:   { label: "Purchase",    color: "green",  icon: ArrowDown  },
  ISSUE:      { label: "Issued",      color: "red",    icon: ArrowUp    },
  RETURN:     { label: "Return",      color: "blue",   icon: ArrowDown  },
  ADJUSTMENT: { label: "Adjustment",  color: "yellow", icon: Activity   },
  TRANSFER:   { label: "Transfer",    color: "purple", icon: ArrowRight },
  EXPIRED:    { label: "Expired",     color: "red",    icon: AlertTriangle},
  DAMAGED:    { label: "Damaged",     color: "orange", icon: AlertTriangle}
}

const PO_STATUS = {
  PENDING:   { color: "yellow", bg: "bg-yellow-100", text: "text-yellow-700", label: "Pending"   },
  APPROVED:  { color: "blue",   bg: "bg-blue-100",   text: "text-blue-700",   label: "Approved"  },
  ORDERED:   { color: "indigo", bg: "bg-indigo-100", text: "text-indigo-700", label: "Ordered"   },
  RECEIVED:  { color: "green",  bg: "bg-green-100",  text: "text-green-700",  label: "Received"  },
  CANCELLED: { color: "red",    bg: "bg-red-100",    text: "text-red-700",    label: "Cancelled" }
}

const TABS = [
  { key: "items",     label: "Stock Items",      icon: Package     },
  { key: "movements", label: "Stock Movements",  icon: Activity    },
  { key: "orders",    label: "Purchase Orders",  icon: ShoppingCart},
  { key: "suppliers", label: "Suppliers",        icon: Truck       },
  { key: "alerts",    label: "Alerts",           icon: AlertTriangle}
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (dt) => dt
  ? new Date(dt).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric"
    })
  : "—"

const formatDateTime = (dt) => dt
  ? new Date(dt).toLocaleString("en-GB", {
      day: "2-digit", month: "short",
      hour: "2-digit", minute: "2-digit"
    })
  : "—"

const isExpiringSoon = (date, days = 90) => {
  if (!date) return false
  const diff = (new Date(date) - new Date()) / (1000 * 60 * 60 * 24)
  return diff > 0 && diff <= days
}

const isExpired = (date) => {
  if (!date) return false
  return new Date(date) < new Date()
}

const stockStatus = (item) => {
  const qty = item.batches?.reduce((sum, b) => sum + (b.remainingQty || 0), 0)
    ?? item.currentStock ?? 0
  if (qty === 0)               return { label: "Out of Stock",  color: "red"    }
  if (qty <= item.reorderLevel) return { label: "Low Stock",    color: "orange" }
  return                              { label: "In Stock",      color: "green"  }
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

// ─── Add Item Modal ───────────────────────────────────────────────────────────
const AddItemModal = ({ isOpen, onClose, onSuccess, editItem }) => {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name:         "",
    code:         "",
    category:     "MEDICAL_SUPPLIES",
    description:  "",
    unit:         "PCS",
    reorderLevel: "10",
    price:        ""
  })

  useEffect(() => {
    if (editItem) {
      setForm({
        name:         editItem.name         || "",
        code:         editItem.code         || "",
        category:     editItem.category     || "MEDICAL_SUPPLIES",
        description:  editItem.description  || "",
        unit:         editItem.unit         || "PCS",
        reorderLevel: String(editItem.reorderLevel || 10),
        price:        String(editItem.price || "")
      })
    } else {
      setForm({
        name: "", code: "", category: "MEDICAL_SUPPLIES",
        description: "", unit: "PCS", reorderLevel: "10", price: ""
      })
    }
  }, [editItem, isOpen])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name)  return toast.error("Item name required")
    if (!form.price) return toast.error("Price required")
    setSaving(true)
    try {
      const payload = {
        ...form,
        reorderLevel: parseInt(form.reorderLevel) || 0,
        price:        parseFloat(form.price),
        code: form.code || form.name.toUpperCase()
          .replace(/\s+/g, "_").slice(0, 15)
      }

      if (editItem) {
        await api.put(`/inventory/items/${editItem.id}`, payload)
        toast.success("Item updated!")
      } else {
        await api.post("/inventory/items", payload)
        toast.success("Item added to inventory!")
      }
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save item")
    } finally { setSaving(false) }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-600" />
            {editItem ? "Edit Item" : "Add Inventory Item"}
          </h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500"
                placeholder="e.g. Surgical Gloves Size M, Gauze Swabs 10x10..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item Code
              </label>
              <input
                type="text"
                value={form.code}
                onChange={e => setForm(prev => ({ ...prev, code: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                placeholder="Auto-generated if blank"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <select
                value={form.category}
                onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {CATEGORY_CONFIG[c]?.label || c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit of Measure *
              </label>
              <select
                value={form.unit}
                onChange={e => setForm(prev => ({ ...prev, unit: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
              >
                {["PCS","BOX","PACK","ROLL","BOTTLE","TUBE","PAIR",
                  "DOZEN","CARTON","LITRE","ML","KG","GRAM","SET","UNIT"
                ].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit Price (NGN) *
              </label>
              <input
                type="number" step="0.01" min="0"
                value={form.price}
                onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reorder Level
              </label>
              <input
                type="number" min="0"
                value={form.reorderLevel}
                onChange={e => setForm(prev => ({ ...prev, reorderLevel: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                placeholder="Min quantity before alert"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
                placeholder="Additional details about this item..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : editItem ? "Update Item" : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Receive Stock Modal ──────────────────────────────────────────────────────
const ReceiveStockModal = ({ isOpen, item, onClose, onSuccess }) => {
  const [saving,    setSaving]    = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [form, setForm] = useState({
    batchNumber:   "",
    quantity:      "",
    purchasePrice: "",
    expiryDate:    "",
    supplierId:    "",
    notes:         ""
  })

  useEffect(() => {
    if (isOpen) {
      fetchSuppliers()
      if (item) {
        setForm(prev => ({ ...prev, purchasePrice: String(item.price || "") }))
      }
    }
  }, [isOpen, item])

  const fetchSuppliers = async () => {
    try {
      const r = await api.get("/inventory/suppliers")
      setSuppliers(r.data.data?.suppliers || r.data.suppliers || [])
    } catch { }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.quantity)      return toast.error("Quantity required")
    if (!form.purchasePrice) return toast.error("Purchase price required")
    setSaving(true)
    try {
      await api.post(`/inventory/items/${item.id}/stock`, {
        batchNumber:   form.batchNumber   || `BATCH-${Date.now()}`,
        quantity:      parseInt(form.quantity),
        purchasePrice: parseFloat(form.purchasePrice),
        expiryDate:    form.expiryDate    || undefined,
        supplierId:    form.supplierId    || undefined,
        notes:         form.notes         || undefined
      })
      toast.success(`${form.quantity} ${item.unit} received!`)
      onSuccess()
      onClose()
      setForm({
        batchNumber: "", quantity: "", purchasePrice: "",
        expiryDate: "", supplierId: "", notes: ""
      })
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to receive stock")
    } finally { setSaving(false) }
  }

  if (!isOpen || !item) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <ArrowDown className="w-5 h-5 text-green-600" />
              Receive Stock
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{item.name} — {item.code}</p>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Current Stock Banner */}
          <div className="bg-green-50 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Current Stock</p>
              <p className="font-bold text-gray-800">
                {item.batches?.reduce((s, b) => s + (b.remainingQty || 0), 0) ?? 0} {item.unit}
              </p>
            </div>
            <Package className="w-8 h-8 text-green-400" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity Received *
              </label>
              <input
                type="number" min="1"
                value={form.quantity}
                onChange={e => setForm(prev => ({ ...prev, quantity: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500"
                placeholder={`Enter qty in ${item.unit}`}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Price / Unit (NGN) *
              </label>
              <input
                type="number" step="0.01" min="0"
                value={form.purchasePrice}
                onChange={e => setForm(prev => ({ ...prev, purchasePrice: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Batch Number
              </label>
              <input
                type="text"
                value={form.batchNumber}
                onChange={e => setForm(prev => ({ ...prev, batchNumber: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                placeholder="e.g. BN2026-001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expiry Date
              </label>
              <input
                type="date"
                value={form.expiryDate}
                onChange={e => setForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier
              </label>
              <select
                value={form.supplierId}
                onChange={e => setForm(prev => ({ ...prev, supplierId: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
              >
                <option value="">Select supplier (optional)</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                placeholder="LPO number, delivery note, remarks..."
              />
            </div>
          </div>

          {/* Total Cost */}
          {form.quantity && form.purchasePrice && (
            <div className="bg-amber-50 rounded-xl p-3 flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Cost</span>
              <span className="font-bold text-amber-700">
                KES {(parseInt(form.quantity || 0) * parseFloat(form.purchasePrice || 0)).toLocaleString()}
              </span>
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Receiving..." : "Receive Stock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Issue Stock Modal ────────────────────────────────────────────────────────
const IssueStockModal = ({ isOpen, item, onClose, onSuccess }) => {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    quantity:      "",
    reference:     "",
    notes:         "",
    movementType:  "ISSUE"
  })

  const currentStock = item?.batches?.reduce(
    (s, b) => s + (b.remainingQty || 0), 0
  ) ?? 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.quantity) return toast.error("Quantity required")
    if (parseInt(form.quantity) > currentStock) {
      return toast.error(`Cannot issue more than ${currentStock} ${item.unit} in stock`)
    }
    setSaving(true)
    try {
      await api.post(`/inventory/items/${item.id}/movement`, {
        movementType: form.movementType,
        quantity:     parseInt(form.quantity),
        reference:    form.reference || undefined,
        notes:        form.notes     || undefined
      })
      toast.success(`${form.quantity} ${item.unit} issued!`)
      onSuccess()
      onClose()
      setForm({ quantity: "", reference: "", notes: "", movementType: "ISSUE" })
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to issue stock")
    } finally { setSaving(false) }
  }

  if (!isOpen || !item) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <ArrowUp className="w-5 h-5 text-red-500" />
              Issue / Adjust Stock
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{item.name}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Stock Status */}
          <div className={`rounded-xl p-3 ${
            currentStock === 0         ? "bg-red-50"    :
            currentStock <= item.reorderLevel ? "bg-orange-50" : "bg-green-50"
          }`}>
            <p className="text-xs text-gray-500">Available Stock</p>
            <p className={`font-bold text-lg ${
              currentStock === 0         ? "text-red-600"    :
              currentStock <= item.reorderLevel ? "text-orange-600" : "text-green-700"
            }`}>
              {currentStock} {item.unit}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Movement Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Movement Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["ISSUE","RETURN","ADJUSTMENT"].map(type => {
                  const cfg = MOVEMENT_TYPES[type]
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, movementType: type }))}
                      className={`py-2 text-xs font-medium rounded-xl border-2 transition-all ${
                        form.movementType === type
                          ? `bg-${cfg.color}-100 border-${cfg.color}-400 text-${cfg.color}-700`
                          : "border-gray-200 text-gray-600"
                      }`}
                    >
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity *
              </label>
              <input
                type="number" min="1" max={currentStock}
                value={form.quantity}
                onChange={e => setForm(prev => ({ ...prev, quantity: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500"
                placeholder={`Max: ${currentStock} ${item.unit}`}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference (Department / Ward)
              </label>
              <input
                type="text"
                value={form.reference}
                onChange={e => setForm(prev => ({ ...prev, reference: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                placeholder="e.g. Ward A, Theatre, OPD..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                placeholder="Reason for adjustment, recipient name..."
              />
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium"
              >
                Cancel
              </button>
              <button type="submit" disabled={saving || currentStock === 0}
                className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                {saving ? "Processing..." : "Confirm"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Purchase Order Modal ─────────────────────────────────────────────────────
const PurchaseOrderModal = ({ isOpen, onClose, onSuccess }) => {
  const [saving,    setSaving]    = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [items,     setItems]     = useState([])
  const [form, setForm] = useState({
    supplierId:   "",
    expectedDate: "",
    notes:        "",
    poItems: [{
      itemName: "", quantity: "1", unitPrice: ""
    }]
  })

  useEffect(() => {
    if (isOpen) {
      fetchSuppliers()
      fetchItems()
    }
  }, [isOpen])

  const fetchSuppliers = async () => {
    try {
      const r = await api.get("/inventory/suppliers")
      setSuppliers(r.data.data?.suppliers || r.data.suppliers || [])
    } catch { }
  }

  const fetchItems = async () => {
    try {
      const r = await api.get("/inventory/items?limit=200")
      setItems(r.data.data?.items || r.data.items || [])
    } catch { }
  }

  const addPOItem = () => setForm(prev => ({
    ...prev,
    poItems: [...prev.poItems, { itemName: "", quantity: "1", unitPrice: "" }]
  }))

  const removePOItem = (idx) => setForm(prev => ({
    ...prev,
    poItems: prev.poItems.filter((_, i) => i !== idx)
  }))

  const updatePOItem = (idx, field, value) => setForm(prev => ({
    ...prev,
    poItems: prev.poItems.map((item, i) =>
      i === idx ? { ...item, [field]: value } : item
    )
  }))

  const totalAmount = form.poItems.reduce((sum, item) => {
    return sum + (parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0))
  }, 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.supplierId) return toast.error("Select a supplier")
    if (form.poItems.some(i => !i.itemName || !i.quantity || !i.unitPrice)) {
      return toast.error("All item fields are required")
    }
    setSaving(true)
    try {
      await api.post("/inventory/purchase-orders", {
        supplierId:   form.supplierId,
        expectedDate: form.expectedDate || undefined,
        notes:        form.notes        || undefined,
        totalAmount,
        items: form.poItems.map(i => ({
          itemName:   i.itemName,
          quantity:   parseInt(i.quantity),
          unitPrice:  parseFloat(i.unitPrice),
          totalPrice: parseInt(i.quantity) * parseFloat(i.unitPrice)
        }))
      })
      toast.success("Purchase order created!")
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create PO")
    } finally { setSaving(false) }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            New Purchase Order
          </h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier *
              </label>
              <select
                value={form.supplierId}
                onChange={e => setForm(prev => ({ ...prev, supplierId: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select supplier...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Delivery Date
              </label>
              <input
                type="date"
                value={form.expectedDate}
                onChange={e => setForm(prev => ({ ...prev, expectedDate: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
              />
            </div>
          </div>

          {/* PO Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                Items to Order
              </label>
              <button type="button" onClick={addPOItem}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
              >
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>

            {/* Header */}
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 mb-2 px-1">
              <div className="col-span-5">Item</div>
              <div className="col-span-2">Qty</div>
              <div className="col-span-3">Unit Price</div>
              <div className="col-span-2">Total</div>
            </div>

            <div className="space-y-2">
              {form.poItems.map((poItem, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={poItem.itemName}
                      onChange={e => updatePOItem(idx, "itemName", e.target.value)}
                      list={`items-list-${idx}`}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                      placeholder="Item name..."
                      required
                    />
                    <datalist id={`items-list-${idx}`}>
                      {items.map(item => (
                        <option key={item.id} value={item.name} />
                      ))}
                    </datalist>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number" min="1"
                      value={poItem.quantity}
                      onChange={e => updatePOItem(idx, "quantity", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                      required
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number" step="0.01" min="0"
                      value={poItem.unitPrice}
                      onChange={e => updatePOItem(idx, "unitPrice", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="col-span-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      {(parseInt(poItem.quantity || 0) * parseFloat(poItem.unitPrice || 0)).toLocaleString()}
                    </span>
                    {form.poItems.length > 1 && (
                      <button type="button" onClick={() => removePOItem(idx)}>
                        <X className="w-4 h-4 text-red-400 hover:text-red-600" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
              <span className="font-semibold text-gray-700">Total Amount</span>
              <span className="font-bold text-lg text-blue-700">
                NGN {totalAmount.toLocaleString()}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
              placeholder="Special instructions, delivery notes..."
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
              {saving ? "Creating..." : "Create Purchase Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Add Supplier Modal ───────────────────────────────────────────────────────
const AddSupplierModal = ({ isOpen, onClose, onSuccess }) => {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: "", code: "", contactPerson: "",
    phone: "", email: "", address: ""
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name) return toast.error("Supplier name required")
    setSaving(true)
    try {
      await api.post("/inventory/suppliers", {
        ...form,
        code: form.code || form.name.toUpperCase()
          .replace(/\s+/g, "_").slice(0, 10)
      })
      toast.success("Supplier added!")
      onSuccess()
      onClose()
      setForm({ name: "", code: "", contactPerson: "", phone: "", email: "", address: "" })
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add supplier")
    } finally { setSaving(false) }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Truck className="w-5 h-5 text-purple-600" />
            Add Supplier
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supplier Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500"
              placeholder="e.g. MedPharma Supplies Ltd"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier Code
              </label>
              <input
                type="text"
                value={form.code}
                onChange={e => setForm(prev => ({ ...prev, code: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                placeholder="Auto-generated"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                value={form.contactPerson}
                onChange={e => setForm(prev => ({ ...prev, contactPerson: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                placeholder="Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                placeholder="+254..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                placeholder="supplier@email.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              value={form.address}
              onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
              placeholder="Physical / postal address"
            />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Item Card ────────────────────────────────────────────────────────────────
const ItemCard = ({ item, onView, onReceive, onIssue, onEdit, userRole }) => {
  const currentStock = item.batches?.reduce(
    (s, b) => s + (b.remainingQty || 0), 0
  ) ?? item.currentStock ?? 0

  const status   = stockStatus(item)
  const catCfg   = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.OTHER
  const expiring = item.batches?.some(b => isExpiringSoon(b.expiryDate))
  const expired  = item.batches?.some(b => isExpired(b.expiryDate))

  const canManage = [
    "INVENTORY_OFFICER","FACILITY_OFFICER",
    "CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN"
  ].includes(userRole)

  return (
    <div className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all ${
      currentStock === 0 ? "border-red-300" :
      currentStock <= item.reorderLevel ? "border-orange-300" :
      expired ? "border-red-200" :
      "border-gray-100"
    }`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl bg-${catCfg.color}-100 flex items-center justify-center`}>
              <Package className={`w-5 h-5 text-${catCfg.color}-600`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 text-sm leading-tight">
                {item.name}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {item.code} • {catCfg.label}
              </p>
            </div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium bg-${status.color}-100 text-${status.color}-700`}>
            {status.label}
          </span>
        </div>

        {/* Stock Info */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-500">In Stock</p>
            <p className={`font-bold text-sm ${
              currentStock === 0             ? "text-red-600"    :
              currentStock <= item.reorderLevel ? "text-orange-600" : "text-gray-800"
            }`}>
              {currentStock}
            </p>
            <p className="text-xs text-gray-400">{item.unit}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-500">Reorder At</p>
            <p className="font-bold text-sm text-gray-700">{item.reorderLevel}</p>
            <p className="text-xs text-gray-400">{item.unit}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-500">Unit Price</p>
            <p className="font-bold text-sm text-gray-700">
              {parseFloat(item.price || 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">KES</p>
          </div>
        </div>

        {/* Alerts */}
        {(expiring || expired) && (
          <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 mb-3 ${
            expired ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"
          }`}>
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {expired ? "Some batches have expired!" : "Some batches expiring within 90 days"}
          </div>
        )}

        {/* Batches */}
        {item.batches?.length > 0 && (
          <div className="text-xs text-gray-500 mb-3">
            {item.batches.filter(b => b.remainingQty > 0).length} active batch(es) •
            Oldest exp: {
              item.batches
                .filter(b => b.expiryDate && b.remainingQty > 0)
                .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))[0]
                ?.expiryDate
                ? formatDate(item.batches
                    .filter(b => b.expiryDate && b.remainingQty > 0)
                    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))[0]
                    .expiryDate)
                : "N/A"
            }
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-100">
          <button
            onClick={() => onView(item)}
            className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200"
          >
            <Eye className="w-3 h-3" /> View
          </button>
          {canManage && (
            <>
              <button
                onClick={() => onReceive(item)}
                className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200"
              >
                <ArrowDown className="w-3 h-3" /> Receive
              </button>
              <button
                onClick={() => onIssue(item)}
                disabled={currentStock === 0}
                className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-200 disabled:opacity-40"
              >
                <ArrowUp className="w-3 h-3" /> Issue
              </button>
              <button
                onClick={() => onEdit(item)}
                className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200"
              >
                <Edit className="w-3 h-3" /> Edit
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Item Detail Drawer ───────────────────────────────────────────────────────
const ItemDetailDrawer = ({ item, onClose, onReceive, onIssue }) => {
  if (!item) return null

  const currentStock = item.batches?.reduce(
    (s, b) => s + (b.remainingQty || 0), 0
  ) ?? 0

  const status = stockStatus(item)
  const catCfg = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.OTHER

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
      <div className="w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Item Details</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Header */}
          <div className={`bg-${catCfg.color}-50 border border-${catCfg.color}-200 rounded-xl p-5`}>
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 bg-${catCfg.color}-100 rounded-xl flex items-center justify-center`}>
                <Package className={`w-7 h-7 text-${catCfg.color}-600`} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg">{item.name}</h3>
                <p className="text-sm text-gray-600">{item.code} • {catCfg.label}</p>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium mt-1 inline-block bg-${status.color}-100 text-${status.color}-700`}>
                  {status.label}
                </span>
              </div>
            </div>
          </div>

          {/* Stock Summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Current Stock",  value: `${currentStock} ${item.unit}`,
                color: currentStock === 0 ? "red" : currentStock <= item.reorderLevel ? "orange" : "green" },
              { label: "Reorder Level",  value: `${item.reorderLevel} ${item.unit}`, color: "gray"  },
              { label: "Unit Price",     value: `KES ${parseFloat(item.price||0).toLocaleString()}`, color: "blue" }
            ].map(s => (
              <div key={s.label} className={`bg-${s.color}-50 rounded-xl p-3 text-center`}>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`font-bold text-sm text-${s.color}-700 mt-0.5`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Description */}
          {item.description && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Description</h4>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3">
                {item.description}
              </p>
            </div>
          )}

          {/* Batches */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-500" />
              Stock Batches ({item.batches?.length || 0})
            </h4>
            {item.batches?.length > 0 ? (
              <div className="space-y-2">
                {item.batches.map((batch, i) => (
                  <div key={batch.id || i}
                    className={`rounded-xl p-3 border ${
                      isExpired(batch.expiryDate)      ? "bg-red-50 border-red-200"    :
                      isExpiringSoon(batch.expiryDate) ? "bg-orange-50 border-orange-200" :
                      "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {batch.batchNumber || `Batch ${i + 1}`}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Received: {formatDate(batch.receivedAt)}
                          {batch.expiryDate && ` • Expires: ${formatDate(batch.expiryDate)}`}
                        </p>
                        {batch.supplier?.name && (
                          <p className="text-xs text-gray-400">
                            From: {batch.supplier.name}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-800">
                          {batch.remainingQty} / {batch.quantity}
                        </p>
                        <p className="text-xs text-gray-500">{item.unit}</p>
                        {(isExpired(batch.expiryDate) || isExpiringSoon(batch.expiryDate)) && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            isExpired(batch.expiryDate)
                              ? "bg-red-100 text-red-700"
                              : "bg-orange-100 text-orange-700"
                          }`}>
                            {isExpired(batch.expiryDate) ? "EXPIRED" : "EXPIRING"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No stock batches received yet</p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { onReceive(item); onClose() }}
              className="flex items-center justify-center gap-2 p-3 bg-green-100 text-green-700 rounded-xl text-sm font-medium hover:bg-green-200"
            >
              <ArrowDown className="w-4 h-4" /> Receive Stock
            </button>
            <button
              onClick={() => { onIssue(item); onClose() }}
              disabled={currentStock === 0}
              className="flex items-center justify-center gap-2 p-3 bg-amber-100 text-amber-700 rounded-xl text-sm font-medium hover:bg-amber-200 disabled:opacity-50"
            >
              <ArrowUp className="w-4 h-4" /> Issue Stock
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Inventory Page ──────────────────────────────────────────────────────
export default function InventoryPage() {
  const { user }   = useAuthStore()

  const [activeTab,   setActiveTab]   = useState("items")
  const [items,       setItems]       = useState([])
  const [movements,   setMovements]   = useState([])
  const [orders,      setOrders]      = useState([])
  const [suppliers,   setSuppliers]   = useState([])
  const [stats,       setStats]       = useState({})
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState("")
  const [catFilter,   setCatFilter]   = useState("")
  const [refreshKey,  setRefreshKey]  = useState(0)

  // Modals
  const [showAddItem,     setShowAddItem]     = useState(false)
  const [editItem,        setEditItem]        = useState(null)
  const [receiveItem,     setReceiveItem]     = useState(null)
  const [issueItem,       setIssueItem]       = useState(null)
  const [showPO,          setShowPO]          = useState(false)
  const [showSupplier,    setShowSupplier]    = useState(false)
  const [detailItem,      setDetailItem]      = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search)    params.append("search",   search)
      if (catFilter) params.append("category", catFilter)
      params.append("limit", "100")

      const [itemsRes, movRes, poRes, supRes] = await Promise.allSettled([
        api.get(`/inventory/items?${params}`),
        api.get("/inventory/movements?limit=30"),
        api.get("/inventory/purchase-orders?limit=20"),
        api.get("/inventory/suppliers")
      ])

      if (itemsRes.status === "fulfilled") {
        const data = itemsRes.value.data
        const list = data.data?.items || data.items || []
        setItems(list)
        setStats({
          total:      list.length,
          lowStock:   list.filter(i => {
            const qty = i.batches?.reduce((s, b) => s + (b.remainingQty || 0), 0) ?? 0
            return qty <= i.reorderLevel && qty > 0
          }).length,
          outOfStock: list.filter(i => {
            const qty = i.batches?.reduce((s, b) => s + (b.remainingQty || 0), 0) ?? 0
            return qty === 0
          }).length,
          expiring:   list.filter(i =>
            i.batches?.some(b => isExpiringSoon(b.expiryDate))
          ).length,
          totalValue: list.reduce((sum, i) => {
            const qty = i.batches?.reduce((s, b) => s + (b.remainingQty || 0), 0) ?? 0
            return sum + (qty * parseFloat(i.price || 0))
          }, 0)
        })
      }

      if (movRes.status === "fulfilled") {
        const data = movRes.value.data
        setMovements(data.data?.movements || data.movements || [])
      }

      if (poRes.status === "fulfilled") {
        const data = poRes.value.data
        setOrders(data.data?.orders || data.orders || [])
      }

      if (supRes.status === "fulfilled") {
        const data = supRes.value.data
        setSuppliers(data.data?.suppliers || data.suppliers || [])
      }
    } catch (err) {
      console.error("Inventory fetch error:", err)
    } finally {
      setLoading(false)
    }
  }, [search, catFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData, refreshKey])

  const canManage = [
    "INVENTORY_OFFICER","FACILITY_OFFICER",
    "CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN"
  ].includes(user?.role)

  const alertItems = items.filter(i => {
    const qty = i.batches?.reduce((s, b) => s + (b.remainingQty || 0), 0) ?? 0
    return qty === 0
      || qty <= i.reorderLevel
      || i.batches?.some(b => isExpiringSoon(b.expiryDate) || isExpired(b.expiryDate))
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Package className="w-7 h-7 text-amber-600" />
            Inventory Management
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Stock control, purchase orders & supplier management
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200"
          >
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
          {canManage && (
            <>
              <button
                onClick={() => setShowSupplier(true)}
                className="flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-2 rounded-xl hover:bg-purple-200 text-sm font-medium"
              >
                <Truck className="w-4 h-4" /> Add Supplier
              </button>
              <button
                onClick={() => setShowPO(true)}
                className="flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-xl hover:bg-blue-200 text-sm font-medium"
              >
                <ShoppingCart className="w-4 h-4" /> Purchase Order
              </button>
              <button
                onClick={() => { setEditItem(null); setShowAddItem(true) }}
                className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-xl hover:bg-amber-700 text-sm font-medium"
              >
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="Total Items"
          value={stats.total}
          icon={Package}
          color="amber"
        />
        <StatCard
          label="Low Stock"
          value={stats.lowStock}
          icon={TrendingDown}
          color="orange"
          sub={stats.lowStock > 0 ? "Need reorder" : ""}
        />
        <StatCard
          label="Out of Stock"
          value={stats.outOfStock}
          icon={AlertTriangle}
          color="red"
        />
        <StatCard
          label="Expiring Soon"
          value={stats.expiring}
          icon={Clock}
          color="yellow"
          sub="Within 90 days"
        />
        <StatCard
          label="Stock Value"
          value={`NGN ${Math.round(stats.totalValue || 0).toLocaleString()}`}
          icon={DollarSign}
          color="green"
        />
      </div>

      {/* Critical Alerts Banner */}
      {(stats.outOfStock > 0 || stats.lowStock > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-700 font-medium text-sm">Stock Alert</p>
            <p className="text-red-600 text-xs mt-0.5">
              {stats.outOfStock > 0 && `${stats.outOfStock} item(s) out of stock. `}
              {stats.lowStock > 0   && `${stats.lowStock} item(s) below reorder level.`}
            </p>
          </div>
          <button
            onClick={() => setActiveTab("alerts")}
            className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg"
          >
            View Alerts
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map(tab => {
            const badge =
              tab.key === "alerts"    ? alertItems.length  :
              tab.key === "orders"    ? orders.length      :
              tab.key === "suppliers" ? suppliers.length   :
              tab.key === "movements" ? movements.length   :
              items.length

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-amber-600 text-amber-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {badge > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    tab.key === "alerts"
                      ? "bg-red-500 text-white"
                      : activeTab === tab.key
                        ? "bg-amber-600 text-white"
                        : "bg-gray-100 text-gray-600"
                  }`}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Filter Bar */}
        {activeTab === "items" && (
          <div className="p-4 flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search items by name, code..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <select
              value={catFilter}
              onChange={e => setCatFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {CATEGORY_CONFIG[c]?.label || c}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Tab: Items ── */}
      {activeTab === "items" && (
        loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 animate-pulse border border-gray-100">
                <div className="flex gap-3 mb-3">
                  <div className="w-11 h-11 bg-gray-200 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-100 rounded w-1/3" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="h-14 bg-gray-100 rounded-lg" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl p-16 text-center border border-gray-100">
            <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No inventory items</p>
            {canManage && (
              <button
                onClick={() => setShowAddItem(true)}
                className="mt-3 text-sm text-amber-600 hover:text-amber-800"
              >
                Add first item →
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                onView={setDetailItem}
                onReceive={setReceiveItem}
                onIssue={setIssueItem}
                onEdit={(i) => { setEditItem(i); setShowAddItem(true) }}
                userRole={user?.role}
              />
            ))}
          </div>
        )
      )}

      {/* ── Tab: Movements ── */}
      {activeTab === "movements" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-700">Recent Stock Movements</h3>
          </div>
          {movements.length === 0 ? (
            <div className="p-16 text-center">
              <Activity className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400">No movements recorded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {movements.map((mov, i) => {
                const typeCfg = MOVEMENT_TYPES[mov.movementType] || MOVEMENT_TYPES.ADJUSTMENT
                const TypeIcon = typeCfg.icon
                return (
                  <div key={mov.id || i} className="p-4 flex items-center gap-4">
                    <div className={`w-9 h-9 rounded-xl bg-${typeCfg.color}-100 flex items-center justify-center flex-shrink-0`}>
                      <TypeIcon className={`w-4 h-4 text-${typeCfg.color}-600`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">
                        {mov.item?.name || "Unknown Item"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {typeCfg.label} •
                        {mov.reference ? ` Ref: ${mov.reference} •` : ""}
                        {formatDateTime(mov.movedAt)}
                      </p>
                      {mov.notes && (
                        <p className="text-xs text-gray-400 mt-0.5">{mov.notes}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`font-bold text-sm ${
                        ["PURCHASE","RETURN"].includes(mov.movementType)
                          ? "text-green-600"
                          : "text-red-600"
                      }`}>
                        {["PURCHASE","RETURN"].includes(mov.movementType) ? "+" : "-"}
                        {mov.quantity} {mov.item?.unit}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Purchase Orders ── */}
      {activeTab === "orders" && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="bg-white rounded-xl p-16 text-center border border-gray-100">
              <ShoppingCart className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No purchase orders</p>
              {canManage && (
                <button
                  onClick={() => setShowPO(true)}
                  className="mt-3 text-sm text-blue-600"
                >
                  Create first PO →
                </button>
              )}
            </div>
          ) : orders.map(order => {
            const cfg = PO_STATUS[order.status] || PO_STATUS.PENDING
            return (
              <div key={order.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-800">{order.poNumber}</h3>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Supplier: {order.supplier?.name || "—"} •
                      {order.items?.length || 0} item(s) •
                      Ordered: {formatDate(order.orderDate)}
                    </p>
                    {order.expectedDate && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Expected: {formatDate(order.expectedDate)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-800">
                      KES {parseFloat(order.totalAmount || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                {order.items && order.items.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {order.items.slice(0, 4).map((item, i) => (
                      <span key={i}
                        className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                      >
                        {item.itemName} × {item.quantity}
                      </span>
                    ))}
                    {order.items.length > 4 && (
                      <span className="text-xs text-gray-400">
                        +{order.items.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Tab: Suppliers ── */}
      {activeTab === "suppliers" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suppliers.length === 0 ? (
            <div className="col-span-2 bg-white rounded-xl p-16 text-center border border-gray-100">
              <Truck className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No suppliers added yet</p>
              {canManage && (
                <button
                  onClick={() => setShowSupplier(true)}
                  className="mt-3 text-sm text-purple-600"
                >
                  Add first supplier →
                </button>
              )}
            </div>
          ) : suppliers.map(sup => (
            <div key={sup.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{sup.name}</h3>
                  <p className="text-xs text-gray-500">{sup.code}</p>
                </div>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                  sup.isActive
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}>
                  {sup.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                {sup.contactPerson && (
                  <p className="flex items-center gap-1.5 text-xs">
                    <Users className="w-3 h-3" /> {sup.contactPerson}
                  </p>
                )}
                {sup.phone && (
                  <p className="flex items-center gap-1.5 text-xs">
                    <Hash className="w-3 h-3" /> {sup.phone}
                  </p>
                )}
                {sup.email && (
                  <p className="flex items-center gap-1.5 text-xs col-span-2 truncate">
                    <FileText className="w-3 h-3 flex-shrink-0" /> {sup.email}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: Alerts ── */}
      {activeTab === "alerts" && (
        <div className="space-y-3">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <h3 className="font-semibold text-red-800 mb-1">
              {alertItems.length} Item(s) Require Attention
            </h3>
            <p className="text-xs text-red-600">
              Review and take action on items below
            </p>
          </div>
          {alertItems.length === 0 ? (
            <div className="bg-white rounded-xl p-16 text-center border border-gray-100">
              <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">All stock levels are healthy!</p>
            </div>
          ) : alertItems.map(item => {
            const qty = item.batches?.reduce((s, b) => s + (b.remainingQty || 0), 0) ?? 0
            const hasExpired  = item.batches?.some(b => isExpired(b.expiryDate))
            const hasExpiring = item.batches?.some(b => isExpiringSoon(b.expiryDate))

            return (
              <div key={item.id}
                className={`bg-white rounded-xl border shadow-sm p-4 ${
                  qty === 0 ? "border-red-300" :
                  hasExpired ? "border-red-200" :
                  "border-orange-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      qty === 0 ? "bg-red-100" : "bg-orange-100"
                    }`}>
                      <AlertTriangle className={`w-5 h-5 ${
                        qty === 0 ? "text-red-600" : "text-orange-600"
                      }`} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.code}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {qty === 0 && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                        OUT OF STOCK
                      </span>
                    )}
                    {qty > 0 && qty <= item.reorderLevel && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                        LOW: {qty} {item.unit}
                      </span>
                    )}
                    {hasExpired && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                        BATCH EXPIRED
                      </span>
                    )}
                    {!hasExpired && hasExpiring && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                        EXPIRING SOON
                      </span>
                    )}
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setReceiveItem(item)}
                      className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200"
                    >
                      <ArrowDown className="w-3 h-3" /> Receive Stock
                    </button>
                    <button
                      onClick={() => setShowPO(true)}
                      className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200"
                    >
                      <ShoppingCart className="w-3 h-3" /> Create PO
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modals ── */}
      <AddItemModal
        isOpen={showAddItem}
        editItem={editItem}
        onClose={() => { setShowAddItem(false); setEditItem(null) }}
        onSuccess={() => setRefreshKey(k => k + 1)}
      />

      <ReceiveStockModal
        isOpen={!!receiveItem}
        item={receiveItem}
        onClose={() => setReceiveItem(null)}
        onSuccess={() => setRefreshKey(k => k + 1)}
      />

      <IssueStockModal
        isOpen={!!issueItem}
        item={issueItem}
        onClose={() => setIssueItem(null)}
        onSuccess={() => setRefreshKey(k => k + 1)}
      />

      <PurchaseOrderModal
        isOpen={showPO}
        onClose={() => setShowPO(false)}
        onSuccess={() => setRefreshKey(k => k + 1)}
      />

      <AddSupplierModal
        isOpen={showSupplier}
        onClose={() => setShowSupplier(false)}
        onSuccess={() => setRefreshKey(k => k + 1)}
      />

      {detailItem && (
        <ItemDetailDrawer
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onReceive={setReceiveItem}
          onIssue={setIssueItem}
        />
      )}
    </div>
  )
}