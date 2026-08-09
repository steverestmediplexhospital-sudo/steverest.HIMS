import { useState, useEffect } from "react"
import api from "../../services/api"
import { toast } from "react-hot-toast"
import {
  CreditCard, Search, RefreshCw, Plus, Eye,
  CheckCircle, Clock, AlertTriangle, X, Save,
  Receipt, DollarSign, TrendingUp, FileText,
  Printer, ChevronDown, ChevronUp
} from "lucide-react"
import { printBill } from "../../services/pdfPrint"

const TABS = [
  { id: "slips",    label: "Payment Slips",   icon: Receipt    },
  { id: "bills",    label: "Bills",           icon: FileText   },
  { id: "payments", label: "Process Payment", icon: CreditCard },
  { id: "revenue",  label: "Revenue",         icon: TrendingUp }
]

const PAYMENT_STATUS = {
  PENDING:        "bg-yellow-100 text-yellow-700 border-yellow-300",
  PAID:           "bg-green-100 text-green-700 border-green-300",
  PARTIALLY_PAID: "bg-orange-100 text-orange-700 border-orange-300",
  WAIVED:         "bg-purple-100 text-purple-700 border-purple-300",
  INSURANCE:      "bg-blue-100 text-blue-700 border-blue-300"
}

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState("slips")
  const [stats, setStats] = useState({
    pending: 0, paid: 0, totalToday: 0, slips: 0
  })

  useEffect(() => { fetchStats() }, [])

  const fetchStats = async () => {
    try {
      const res = await api.get("/billing/stats/revenue")
      setStats(res.data.data || {})
    } catch {}
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-emerald-200 text-sm">Accounts & Billing</p>
            <h1 className="text-2xl font-bold">Billing & Payments</h1>
            <p className="text-emerald-200 text-sm mt-1">St. Everest Mediplex</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Pending Payment",  value: stats.pending || 0 },
              { label: "Collected Today",  value: `KES ${(stats.totalToday || 0).toLocaleString()}` },
              { label: "Paid Today",       value: stats.paid || 0 }
            ].map(s => (
              <div key={s.label} className="bg-white/20 rounded-xl px-4 py-2 text-center">
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-emerald-200 text-xs">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "border-b-2 border-emerald-600 text-emerald-700 bg-emerald-50"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}>
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            )
          })}
        </div>
        <div className="p-5">
          {activeTab === "slips"    && <PaymentSlips />}
          {activeTab === "bills"    && <BillsList />}
          {activeTab === "payments" && <ProcessPayment onSuccess={fetchStats} />}
          {activeTab === "revenue"  && <RevenueTab />}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PAYMENT SLIPS
// ════════════════════════════════════════════════════════════════════════════
function PaymentSlips() {
  const [slips,   setSlips]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState("PENDING")
  const [search,  setSearch]  = useState("")

  useEffect(() => { fetchSlips() }, [filter])

  const fetchSlips = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/billing/payment-slips?status=${filter}`)
      setSlips(res.data.data || [])
    } catch {} finally { setLoading(false) }
  }

  // ── Print a single payment slip as a receipt ──────────────────────────
  const handlePrintSlip = (slip) => {
    printBill({
      patient: {
        fullName:  `${slip.patient?.firstName || ""} ${slip.patient?.lastName || ""}`.trim(),
        patientId: slip.patient?.patientNumber || slip.patient?.mrn,
        phone:     slip.patient?.phone,
        address:   slip.patient?.address,
      },
      bill: {
        billNumber: slip.trackingNumber,
      },
      items: [{
        description: slip.description || slip.sourceType,
        category:    slip.sourceType  || "Service",
        quantity:    1,
        unitPrice:   slip.amount,
        amount:      slip.amount,
      }],
      payments: slip.status === "PAID" ? [{
        date:            slip.paidAt,
        method:          slip.paymentMethod || "CASH",
        reference:       slip.reference     || "—",
        amount:          slip.amount,
      }] : [],
      docNumber: slip.trackingNumber,
    })
  }

  const filtered = slips.filter(s =>
    search === "" ||
    s.trackingNumber?.toLowerCase().includes(search.toLowerCase()) ||
    `${s.patient?.firstName} ${s.patient?.lastName}`
      .toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by tracking number or patient..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {["PENDING","PAID","ALL"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-gray-500"
              }`}>
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={fetchSlips}
          className="p-2 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Receipt className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">No payment slips found</p>
        </div>
      ) : (
        filtered.map(slip => (
          <div key={slip.id}
            className={`border rounded-xl p-4 flex items-center gap-4 ${
              PAYMENT_STATUS[slip.status]
                ?.split(" ")
                .filter(c => c.startsWith("border-"))
                .join(" ") || "border-gray-200"
            }`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-mono text-sm font-bold text-gray-800">
                  {slip.trackingNumber}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                  PAYMENT_STATUS[slip.status] || "bg-gray-100 text-gray-600"
                }`}>
                  {slip.status}
                </span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {slip.sourceType}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-0.5">
                {slip.patient?.firstName} {slip.patient?.lastName} — {slip.description}
              </p>
              <p className="text-xs text-gray-400">
                {new Date(slip.createdAt).toLocaleString()}
              </p>
            </div>

            <div className="text-right flex-shrink-0 space-y-1">
              <p className="text-lg font-bold text-emerald-700">
                KES {parseFloat(slip.amount || 0).toLocaleString()}
              </p>

              {/* ── Print button — always visible ── */}
              <button
                onClick={() => handlePrintSlip(slip)}
                className="flex items-center gap-1 text-xs bg-gray-50 text-gray-600
                           border border-gray-200 px-2.5 py-1 rounded-lg
                           hover:bg-emerald-50 hover:text-emerald-700
                           hover:border-emerald-200 transition-colors ml-auto"
              >
                <Printer className="w-3 h-3" />
                {slip.status === "PAID" ? "Print Receipt" : "Print Slip"}
              </button>

              {slip.status === "PENDING" && (
                <button className="text-xs bg-emerald-600 text-white px-3 py-1.5
                                   rounded-lg hover:bg-emerald-700 w-full">
                  Process Payment
                </button>
              )}
              {slip.status === "PAID" && (
                <p className="text-xs text-green-600">
                  ✓ Paid {slip.paidAt
                    ? new Date(slip.paidAt).toLocaleDateString()
                    : ""}
                </p>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// BILLS LIST
// ════════════════════════════════════════════════════════════════════════════
function BillsList() {
  const [bills,    setBills]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { fetchBills() }, [])

  const fetchBills = async () => {
    setLoading(true)
    try {
      const res = await api.get("/billing/bills")
      setBills(res.data.data || [])
    } catch {} finally { setLoading(false) }
  }

  // ── Print a full bill / invoice ──────────────────────────────────────
  const handlePrintBill = (bill) => {
    printBill({
      patient: {
        fullName:  `${bill.patient?.firstName || ""} ${bill.patient?.lastName || ""}`.trim(),
        patientId: bill.patient?.patientNumber || bill.patient?.mrn,
        phone:     bill.patient?.phone,
        address:   bill.patient?.address,
      },
      bill: {
        billNumber: bill.billNumber,
      },
      items: (bill.items || []).map(item => ({
        description: item.description || item.name,
        category:    item.category    || item.itemType || "Service",
        quantity:    item.quantity    || 1,
        unitPrice:   item.unitPrice   || item.price || item.totalPrice,
        amount:      item.totalPrice  || item.amount,
      })),
      payments: (bill.payments || []).map(p => ({
        date:      p.createdAt || p.date,
        method:    p.method    || p.paymentMethod,
        reference: p.reference || p.transactionId || "—",
        amount:    p.amount,
      })),
      docNumber: bill.billNumber,
    })
  }

  const STATUS_COLOR = {
    OPEN:            "bg-blue-100 text-blue-700",
    PENDING_PAYMENT: "bg-yellow-100 text-yellow-700",
    PAID:            "bg-green-100 text-green-700",
    PARTIALLY_PAID:  "bg-orange-100 text-orange-700",
    WAIVED:          "bg-purple-100 text-purple-700",
    CANCELLED:       "bg-red-100 text-red-700"
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{bills.length} bills</p>
        <button
          onClick={fetchBills}
          className="p-2 text-gray-400 hover:text-emerald-600">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : bills.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400">No bills yet</p>
        </div>
      ) : bills.map(bill => (
        <div key={bill.id} className="border border-gray-200 rounded-xl overflow-hidden">

          {/* Bill header row */}
          <div
            className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setExpanded(expanded === bill.id ? null : bill.id)}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-mono text-sm font-bold text-gray-800">
                  {bill.billNumber}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  STATUS_COLOR[bill.status] || "bg-gray-100 text-gray-600"
                }`}>
                  {bill.status?.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-0.5">
                {bill.patient?.firstName} {bill.patient?.lastName}
              </p>
              <p className="text-xs text-gray-400">
                {new Date(bill.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div className="text-right">
              <p className="font-bold text-gray-800">
                KES {parseFloat(bill.totalAmount || 0).toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">
                Paid: KES {parseFloat(bill.paidAmount || 0).toLocaleString()}
              </p>
              {parseFloat(bill.totalAmount) > parseFloat(bill.paidAmount || 0) && (
                <p className="text-xs text-red-600 font-medium">
                  Balance: KES{" "}
                  {(
                    parseFloat(bill.totalAmount) - parseFloat(bill.paidAmount || 0)
                  ).toLocaleString()}
                </p>
              )}
            </div>

            {/* ── Print button on bill row ── */}
            <button
              onClick={e => { e.stopPropagation(); handlePrintBill(bill) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700
                         border border-emerald-200 rounded-lg text-xs font-semibold
                         hover:bg-emerald-100 transition-colors shrink-0"
              title="Print Bill / Invoice"
            >
              <Printer className="w-3.5 h-3.5" />
              {bill.status === "PAID" ? "Receipt" : "Invoice"}
            </button>

            {expanded === bill.id
              ? <ChevronUp   className="w-4 h-4 text-gray-400 shrink-0" />
              : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
            }
          </div>

          {/* Expanded bill items */}
          {expanded === bill.id && bill.items?.length > 0 && (
            <div className="border-t border-gray-100 p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-500 uppercase">Bill Items</p>
                {/* Print button inside expanded view too */}
                <button
                  onClick={() => handlePrintBill(bill)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50
                             text-emerald-700 border border-emerald-200 rounded-lg
                             text-xs font-semibold hover:bg-emerald-100 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Full {bill.status === "PAID" ? "Receipt" : "Invoice"}
                </button>
              </div>
              <div className="space-y-2">
                {bill.items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-700">
                      {item.description} × {item.quantity}
                    </span>
                    <span className="font-medium text-gray-800">
                      KES {parseFloat(item.totalPrice || item.amount || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="border-t border-gray-200 pt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span>KES {parseFloat(bill.totalAmount || 0).toLocaleString()}</span>
                </div>
                {parseFloat(bill.paidAmount || 0) > 0 && (
                  <div className="flex justify-between text-green-700 font-semibold text-sm">
                    <span>Paid</span>
                    <span>KES {parseFloat(bill.paidAmount).toLocaleString()}</span>
                  </div>
                )}
                {parseFloat(bill.totalAmount) > parseFloat(bill.paidAmount || 0) && (
                  <div className="flex justify-between text-red-600 font-bold">
                    <span>Balance Due</span>
                    <span>
                      KES{" "}
                      {(
                        parseFloat(bill.totalAmount) - parseFloat(bill.paidAmount || 0)
                      ).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PROCESS PAYMENT
// ════════════════════════════════════════════════════════════════════════════
function ProcessPayment({ onSuccess }) {
  const [tracking,   setTracking]   = useState("")
  const [slip,       setSlip]       = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [form,       setForm]       = useState({
    method: "CASH", reference: "", notes: ""
  })
  const [processing, setProcessing] = useState(false)

  const lookupSlip = async () => {
    if (!tracking.trim()) { toast.error("Enter tracking number"); return }
    setLoading(true)
    try {
      const res = await api.get(`/billing/payment-slips/${tracking.trim()}`)
      setSlip(res.data.data)
    } catch {
      toast.error("Payment slip not found")
      setSlip(null)
    } finally { setLoading(false) }
  }

  const processPayment = async () => {
    if (!slip) return
    setProcessing(true)
    try {
      await api.post("/billing/payments", {
        paymentSlipId: slip.id,
        billId:        slip.billId,
        amount:        slip.amount,
        method:        form.method,
        reference:     form.reference,
        notes:         form.notes
      })
      toast.success(
        `Payment of KES ${parseFloat(slip.amount).toLocaleString()} processed!`
      )

      // ── Auto-print receipt after successful payment ──────────────────
      printBill({
        patient: {
          fullName:  `${slip.patient?.firstName || ""} ${slip.patient?.lastName || ""}`.trim(),
          patientId: slip.patient?.patientNumber || slip.patient?.mrn,
          phone:     slip.patient?.phone,
        },
        bill: {
          billNumber: slip.trackingNumber,
        },
        items: [{
          description: slip.description || slip.sourceType,
          category:    slip.sourceType  || "Service",
          quantity:    1,
          unitPrice:   slip.amount,
          amount:      slip.amount,
        }],
        payments: [{
          date:      new Date().toISOString(),
          method:    form.method,
          reference: form.reference || "—",
          amount:    slip.amount,
        }],
        docNumber: slip.trackingNumber,
      })

      setSlip(null)
      setTracking("")
      setForm({ method: "CASH", reference: "", notes: "" })
      onSuccess()
    } catch (e) {
      toast.error(e.response?.data?.message || "Payment processing failed")
    } finally { setProcessing(false) }
  }

  // ── Manual reprint after payment lookup ─────────────────────────────
  const handleReprintReceipt = () => {
    if (!slip) return
    printBill({
      patient: {
        fullName:  `${slip.patient?.firstName || ""} ${slip.patient?.lastName || ""}`.trim(),
        patientId: slip.patient?.patientNumber || slip.patient?.mrn,
        phone:     slip.patient?.phone,
      },
      bill: {
        billNumber: slip.trackingNumber,
      },
      items: [{
        description: slip.description || slip.sourceType,
        category:    slip.sourceType  || "Service",
        quantity:    1,
        unitPrice:   slip.amount,
        amount:      slip.amount,
      }],
      payments: slip.status === "PAID" ? [{
        date:      slip.paidAt,
        method:    slip.paymentMethod || "CASH",
        reference: slip.reference     || "—",
        amount:    slip.amount,
      }] : [],
      docNumber: slip.trackingNumber,
    })
  }

  const METHODS = [
    "CASH","CARD","BANK_TRANSFER","INSURANCE","CORPORATE","WAIVER"
  ]

  return (
    <div className="max-w-lg mx-auto space-y-5">

      {/* Lookup */}
      <div className="border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Find Payment Slip</h3>
        <div className="flex gap-3">
          <input
            value={tracking}
            onChange={e => setTracking(e.target.value)}
            onKeyDown={e => e.key === "Enter" && lookupSlip()}
            placeholder="Enter tracking number (e.g. PAY-001234)"
            className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={lookupSlip}
            disabled={loading}
            className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-sm
                       font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "..." : "Lookup"}
          </button>
        </div>
      </div>

      {/* Slip Details */}
      {slip && (
        <div className="border border-emerald-300 bg-emerald-50 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-emerald-800">Payment Slip Details</h3>
            <div className="flex items-center gap-2">
              {/* Print slip button */}
              <button
                onClick={handleReprintReceipt}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white
                           text-emerald-700 border border-emerald-200 rounded-lg
                           text-xs font-semibold hover:bg-emerald-100 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                {slip.status === "PAID" ? "Reprint Receipt" : "Print Slip"}
              </button>
              <span className={`text-xs px-2 py-1 rounded-full font-medium border ${
                PAYMENT_STATUS[slip.status] || "bg-gray-100 text-gray-600"
              }`}>
                {slip.status}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {[
              ["Tracking #",  slip.trackingNumber],
              ["Patient",     `${slip.patient?.firstName || ""} ${slip.patient?.lastName || ""}`.trim()],
              ["Description", slip.description],
              ["Source",      slip.sourceType],
              ["Amount",      `KES ${parseFloat(slip.amount || 0).toLocaleString()}`]
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-gray-500">{label}</span>
                <span className={`font-medium ${
                  label === "Amount"
                    ? "text-emerald-700 text-lg font-bold"
                    : "text-gray-800"
                }`}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {slip.status === "PENDING" ? (
            <div className="space-y-3 pt-3 border-t border-emerald-200">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {METHODS.map(m => (
                    <button key={m}
                      onClick={() => setForm(p => ({ ...p, method: m }))}
                      className={`py-2 rounded-lg text-xs font-medium border-2 transition-colors ${
                        form.method === m
                          ? "border-emerald-500 bg-emerald-100 text-emerald-700"
                          : "border-gray-200 text-gray-600 hover:border-emerald-300"
                      }`}>
                      {m.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>

              {["CARD","BANK_TRANSFER","INSURANCE","CORPORATE"].includes(form.method) && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Reference Number
                  </label>
                  <input
                    value={form.reference}
                    onChange={e => setForm(p => ({ ...p, reference: e.target.value }))}
                    placeholder="Transaction/Reference number..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm
                               focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              <button
                onClick={processPayment}
                disabled={processing}
                className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold
                           hover:bg-emerald-700 disabled:opacity-50 flex items-center
                           justify-center gap-2"
              >
                <CreditCard className="w-5 h-5" />
                {processing
                  ? "Processing..."
                  : `Confirm Payment — KES ${parseFloat(slip.amount || 0).toLocaleString()}`
                }
              </button>

              <p className="text-xs text-center text-gray-400">
                Receipt will print automatically after payment
              </p>
            </div>
          ) : (
            <div className="bg-green-100 rounded-lg p-4 text-center space-y-2">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto" />
              <p className="text-green-700 font-semibold">Already Paid</p>
              <p className="text-green-600 text-sm">This slip has been processed</p>
              <button
                onClick={handleReprintReceipt}
                className="flex items-center gap-2 px-4 py-2 bg-white text-green-700
                           border border-green-300 rounded-lg text-sm font-semibold
                           hover:bg-green-50 transition-colors mx-auto"
              >
                <Printer className="w-4 h-4" /> Reprint Receipt
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// REVENUE TAB
// ════════════════════════════════════════════════════════════════════════════
function RevenueTab() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [period,  setPeriod]  = useState("TODAY")

  useEffect(() => { fetchRevenue() }, [period])

  const fetchRevenue = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/billing/stats/revenue?period=${period}`)
      setData(res.data.data)
    } catch {} finally { setLoading(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {["TODAY","WEEK","MONTH","YEAR"].map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === p
                ? "bg-emerald-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>
            {p}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Revenue",   value: `KES ${(data?.totalRevenue || 0).toLocaleString()}`, color: "green"  },
            { label: "Payments Today",  value: data?.paymentsToday || 0,                            color: "blue"   },
            { label: "Pending Slips",   value: data?.pendingSlips  || 0,                            color: "yellow" },
            { label: "Outstanding",     value: `KES ${(data?.outstanding || 0).toLocaleString()}`,  color: "red"    }
          ].map(s => (
            <div key={s.label}
              className={`bg-${s.color}-50 border border-${s.color}-200 rounded-xl p-4`}>
              <p className={`text-2xl font-bold text-${s.color}-700`}>{s.value}</p>
              <p className={`text-sm text-${s.color}-600 font-medium mt-1`}>{s.label}</p>
              <p className="text-xs text-gray-400">{period.toLowerCase()}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <TrendingUp className="w-12 h-12 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-400 font-medium">Revenue Chart</p>
        <p className="text-gray-300 text-sm">Detailed analytics coming soon</p>
      </div>
    </div>
  )
}