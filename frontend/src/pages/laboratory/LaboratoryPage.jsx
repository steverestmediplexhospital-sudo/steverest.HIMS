// frontend/src/pages/LaboratoryPage.jsx
import { useState, useEffect } from "react"
import api from "../../services/api"
import { toast } from "react-hot-toast"
import {
  FlaskConical, Search, RefreshCw, CheckCircle, Clock,
  AlertTriangle, Eye, FileText, ChevronDown, ChevronUp,
  Microscope, TestTube, Activity, X, Save, Plus, Printer
} from "lucide-react"
import { printLabResults } from "../../services/pdfPrint"

const TABS = [
  { id: "pending",   label: "Pending Orders",    icon: Clock },
  { id: "collect",   label: "Sample Collection", icon: TestTube },
  { id: "results",   label: "Enter Results",     icon: Activity },
  { id: "completed", label: "Completed",         icon: CheckCircle },
  { id: "tests",     label: "Test Catalog",      icon: FlaskConical }
]

const STATUS_COLOR = {
  ORDERED:          "bg-gray-100 text-gray-700",
  SAMPLE_COLLECTED: "bg-blue-100 text-blue-700",
  PROCESSING:       "bg-yellow-100 text-yellow-700",
  COMPLETED:        "bg-green-100 text-green-700",
  VALIDATED:        "bg-teal-100 text-teal-700",
  CANCELLED:        "bg-red-100 text-red-700"
}

// ─── Helper: build printLabResults payload from an order object ──────────────
const buildPrintPayload = (order) => {
  const p = order.visit?.patient || {}
  return {
    patient: {
      fullName:    `${p.firstName || ""} ${p.lastName || ""}`.trim() || "—",
      patientId:   p.patientNumber || p.id || "—",
      dateOfBirth: p.dateOfBirth || null,
      gender:      p.gender || "—",
    },
    doctor: {
      name: order.orderedBy?.firstName
        ? `${order.orderedBy.firstName} ${order.orderedBy.lastName || ""}`.trim()
        : order.visit?.doctor?.firstName
          ? `${order.visit.doctor.firstName} ${order.visit.doctor.lastName || ""}`.trim()
          : "—",
      specialization: order.orderedBy?.specialization || "—",
    },
    labScientist: {
      name: order.processedBy?.firstName
        ? `${order.processedBy.firstName} ${order.processedBy.lastName || ""}`.trim()
        : "Laboratory Scientist",
    },
    visit: {
      visitId: order.visit?.visitNumber || order.visit?.id || "—",
    },
    labOrder: {
      orderNumber: order.orderNumber || order.id,
      createdAt:   order.createdAt,
      collectedAt: order.collectedAt,
      comments:    order.notes || order.technicianNotes || "",
    },
    results: (order.results || []).map(r => ({
      testName:       r.parameter || r.testName || "—",
      value:          r.value     || "—",
      unit:           r.unit      || "—",
      referenceRange: r.normalRange || r.referenceRange || "—",
      name:           r.parameter || "—",
    })),
    docNumber: order.orderNumber || order.id,
  }
}

export default function LaboratoryPage() {
  const [activeTab, setActiveTab] = useState("pending")
  const [orders, setOrders]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [stats, setStats]         = useState({
    pending: 0, collected: 0, processing: 0, completed: 0
  })

  useEffect(() => { fetchOrders() }, [activeTab])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const statusMap = {
        pending:   "ORDERED",
        collect:   "ORDERED",
        results:   "SAMPLE_COLLECTED,PROCESSING",
        completed: "COMPLETED,VALIDATED",
      }
      const status = statusMap[activeTab]
      const url    = status ? `/lab/orders?status=${status}` : "/lab/orders"
      const res    = await api.get(url)
      const data   = res.data.data || []
      setOrders(data)

      // Stats
      const all       = await api.get("/lab/orders")
      const allOrders = all.data.data || []
      setStats({
        pending:    allOrders.filter(o => o.status === "ORDERED").length,
        collected:  allOrders.filter(o => o.status === "SAMPLE_COLLECTED").length,
        processing: allOrders.filter(o => o.status === "PROCESSING").length,
        completed:  allOrders.filter(o =>
          ["COMPLETED", "VALIDATED"].includes(o.status)
        ).length,
      })
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-800 via-purple-700 to-indigo-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-purple-200 text-sm">Laboratory Department</p>
            <h1 className="text-2xl font-bold">Laboratory Information System</h1>
            <p className="text-purple-200 text-sm mt-1">St. Everest Mediplex</p>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Pending",    value: stats.pending,    color: "bg-yellow-400/20" },
              { label: "Collected",  value: stats.collected,  color: "bg-blue-400/20"   },
              { label: "Processing", value: stats.processing, color: "bg-orange-400/20" },
              { label: "Completed",  value: stats.completed,  color: "bg-green-400/20"  },
            ].map(s => (
              <div key={s.label} className={`${s.color} rounded-xl px-3 py-2 text-center`}>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-purple-200 text-xs">{s.label}</p>
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
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "border-b-2 border-purple-600 text-purple-700 bg-purple-50"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.id === "pending" && stats.pending > 0 && (
                  <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {stats.pending}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <div className="p-5">
          {activeTab === "tests" ? (
            <TestCatalog />
          ) : (
            <LabOrdersList
              orders={orders}
              loading={loading}
              tab={activeTab}
              onRefresh={fetchOrders}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Lab Orders List ──────────────────────────────────────────────────────────
function LabOrdersList({ orders, loading, tab, onRefresh }) {
  const [expanded,      setExpanded]      = useState(null)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showResults,   setShowResults]   = useState(false)

  // ── Print handler ──────────────────────────────────────────────────────────
  const handlePrintResult = (order) => {
    if (!order.results?.length) {
      toast.error("No results available to print")
      return
    }
    try {
      printLabResults(buildPrintPayload(order))
    } catch (e) {
      console.error("Print error:", e)
      toast.error("Failed to open print window")
    }
  }

  const handleCollect = async (orderId) => {
    try {
      await api.patch(`/lab/orders/${orderId}/collect`, {
        collectedAt:      new Date().toISOString(),
        collectionNotes:  "Sample collected at lab",
      })
      toast.success("Sample collected!")
      onRefresh()
    } catch (e) { toast.error(e.response?.data?.message || "Failed") }
  }

  const handleProcess = async (orderId) => {
    try {
      await api.patch(`/lab/orders/${orderId}/process`)
      toast.success("Order marked as processing")
      onRefresh()
    } catch (e) { toast.error(e.response?.data?.message || "Failed") }
  }

  const handleValidate = async (order) => {
    try {
      await api.patch(`/lab/orders/${order.id}/validate`)
      toast.success("Results validated and released!")
      onRefresh()
      // Auto-print after validation
      if (order.results?.length) {
        setTimeout(() => {
          toast("Opening print window…", { icon: "🖨️" })
          printLabResults(buildPrintPayload(order))
        }, 800)
      }
    } catch (e) { toast.error(e.response?.data?.message || "Failed") }
  }

  if (loading) return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i}
          className="animate-pulse border border-gray-100 rounded-xl p-4 flex gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )

  if (orders.length === 0) return (
    <div className="text-center py-16">
      <FlaskConical className="w-16 h-16 text-gray-200 mx-auto mb-4" />
      <p className="text-gray-400 font-medium text-lg">No orders found</p>
      <p className="text-gray-300 text-sm mt-1">
        Orders will appear here as doctors submit requests
      </p>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{orders.length} order(s)</p>
        <button
          onClick={onRefresh}
          className="text-gray-400 hover:text-purple-600 p-2 rounded-lg hover:bg-purple-50"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {orders.map(order => {
        const isCompleted = ["COMPLETED", "VALIDATED"].includes(order.status)
        const hasResults  = (order.results?.length || 0) > 0

        return (
          <div
            key={order.id}
            className="border border-gray-200 rounded-xl overflow-hidden hover:border-purple-200 transition-colors"
          >
            {/* ── Row header ── */}
            <div className="p-4 flex items-center gap-4">
              {/* Urgency bar */}
              <div
                className={`w-1 h-12 rounded-full flex-shrink-0 ${
                  order.urgency === "STAT"   ? "bg-red-500"    :
                  order.urgency === "URGENT" ? "bg-orange-500" : "bg-green-500"
                }`}
              />

              {/* Patient info — clickable to expand */}
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => setExpanded(expanded === order.id ? null : order.id)}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-800">
                    {order.visit?.patient?.firstName} {order.visit?.patient?.lastName}
                  </p>
                  <span className="text-xs text-gray-400">
                    {order.visit?.patient?.patientNumber}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    order.urgency === "STAT"   ? "bg-red-100 text-red-700"    :
                    order.urgency === "URGENT" ? "bg-orange-100 text-orange-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {order.urgency}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <p className="text-xs text-gray-500">
                    {order.items?.map(i => i.labTest?.name).join(", ").substring(0, 60)}
                    {order.items?.length > 2 ? "..." : ""}
                  </p>
                  <span className="text-xs text-gray-300">•</span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(order.createdAt).toLocaleTimeString([], {
                      hour: "2-digit", minute: "2-digit"
                    })}
                  </span>
                </div>
              </div>

              {/* Right side: status + quick print + chevron */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  STATUS_COLOR[order.status] || "bg-gray-100 text-gray-600"
                }`}>
                  {order.status?.replace(/_/g, " ")}
                </span>

                {/* Quick print button visible on completed rows WITHOUT expanding */}
                {isCompleted && hasResults && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePrintResult(order) }}
                    title="Print Lab Result"
                    className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700
                               border border-purple-200 px-2 py-1 rounded-lg
                               hover:bg-purple-100 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print
                  </button>
                )}

                <button
                  onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                  className="text-gray-400"
                >
                  {expanded === order.id
                    ? <ChevronUp className="w-4 h-4" />
                    : <ChevronDown className="w-4 h-4" />
                  }
                </button>
              </div>
            </div>

            {/* ── Expanded panel ── */}
            {expanded === order.id && (
              <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">

                {/* Tests ordered */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                    Tests Ordered ({order.items?.length})
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {order.items?.map(item => (
                      <div
                        key={item.id}
                        className="bg-white border border-gray-200 rounded-lg p-3"
                      >
                        <p className="text-sm font-medium text-gray-800">
                          {item.labTest?.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {item.labTest?.code} • {item.labTest?.category}
                        </p>
                        {item.labTest?.normalRange && (
                          <p className="text-xs text-green-600 mt-1">
                            Normal: {item.labTest?.normalRange}
                          </p>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full mt-1 inline-block ${
                          item.status === "COMPLETED"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}>
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Clinical notes */}
                {order.notes && (
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-blue-700 mb-1">
                      Clinical Notes from Doctor:
                    </p>
                    <p className="text-sm text-blue-800">{order.notes}</p>
                  </div>
                )}

                {/* Results if available */}
                {hasResults && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-gray-500 uppercase">
                        Results ({order.results.length})
                      </p>
                      {/* Print + Reprint buttons inside expanded view */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePrintResult(order)}
                          className="flex items-center gap-1.5 text-xs bg-purple-600 text-white
                                     px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Print Full Report
                        </button>
                        {isCompleted && (
                          <button
                            onClick={() => handlePrintResult(order)}
                            className="flex items-center gap-1.5 text-xs bg-white text-purple-700
                                       border border-purple-300 px-3 py-1.5 rounded-lg
                                       hover:bg-purple-50 transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Reprint
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {order.results.map(result => (
                        <div
                          key={result.id}
                          className={`border rounded-lg p-3 ${
                            result.isAbnormal
                              ? "border-red-300 bg-red-50"
                              : "border-gray-200 bg-white"
                          }`}
                        >
                          <div className="flex justify-between">
                            <p className="text-sm font-semibold text-gray-800">
                              {result.parameter}
                            </p>
                            <p className={`text-sm font-bold ${
                              result.isAbnormal ? "text-red-700" : "text-green-700"
                            }`}>
                              {result.value} {result.unit}
                              {result.isAbnormal && (
                                <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 rounded">
                                  ABNORMAL
                                </span>
                              )}
                            </p>
                          </div>
                          {result.normalRange && (
                            <p className="text-xs text-gray-400">
                              Normal: {result.normalRange}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 flex-wrap">
                  {order.status === "ORDERED" && (
                    <button
                      onClick={() => handleCollect(order.id)}
                      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2
                                 rounded-lg text-sm font-medium hover:bg-blue-700"
                    >
                      <TestTube className="w-4 h-4" /> Mark Sample Collected
                    </button>
                  )}

                  {order.status === "SAMPLE_COLLECTED" && (
                    <>
                      <button
                        onClick={() => handleProcess(order.id)}
                        className="flex items-center gap-2 bg-yellow-600 text-white px-4 py-2
                                   rounded-lg text-sm font-medium hover:bg-yellow-700"
                      >
                        <Activity className="w-4 h-4" /> Start Processing
                      </button>
                      <button
                        onClick={() => { setSelectedOrder(order); setShowResults(true) }}
                        className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2
                                   rounded-lg text-sm font-medium hover:bg-purple-700"
                      >
                        <FileText className="w-4 h-4" /> Enter Results
                      </button>
                    </>
                  )}

                  {order.status === "PROCESSING" && (
                    <button
                      onClick={() => { setSelectedOrder(order); setShowResults(true) }}
                      className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2
                                 rounded-lg text-sm font-medium hover:bg-purple-700"
                    >
                      <FileText className="w-4 h-4" /> Enter Results
                    </button>
                  )}

                  {order.status === "COMPLETED" && (
                    <>
                      <button
                        onClick={() => handleValidate(order)}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2
                                   rounded-lg text-sm font-medium hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4" /> Validate & Release
                      </button>
                      {/* Print before validating */}
                      {hasResults && (
                        <button
                          onClick={() => handlePrintResult(order)}
                          className="flex items-center gap-2 bg-white text-purple-700
                                     border border-purple-300 px-4 py-2 rounded-lg
                                     text-sm font-medium hover:bg-purple-50"
                        >
                          <Printer className="w-4 h-4" /> Print Draft
                        </button>
                      )}
                    </>
                  )}

                  {order.status === "VALIDATED" && hasResults && (
                    <button
                      onClick={() => handlePrintResult(order)}
                      className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2
                                 rounded-lg text-sm font-medium hover:bg-teal-700"
                    >
                      <Printer className="w-4 h-4" /> Print Validated Report
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Results Entry Modal */}
      {showResults && selectedOrder && (
        <ResultsModal
          order={selectedOrder}
          onClose={() => { setShowResults(false); setSelectedOrder(null) }}
          onSaved={(savedOrder) => {
            setShowResults(false)
            setSelectedOrder(null)
            onRefresh()
            // Offer to print immediately after saving
            if (savedOrder) {
              setTimeout(() => {
                const confirmed = window.confirm(
                  "Results saved successfully. Print the lab report now?"
                )
                if (confirmed) printLabResults(buildPrintPayload(savedOrder))
              }, 500)
            }
          }}
        />
      )}
    </div>
  )
}

// ── Results Entry Modal ──────────────────────────────────────────────────────
function ResultsModal({ order, onClose, onSaved }) {
  const [results, setResults] = useState(
    order.items?.map(item => ({
      labTestId:   item.labTest?.id,
      testName:    item.labTest?.name,
      normalRange: item.labTest?.normalRange || "",
      unit:        item.labTest?.unit || "",
      parameters:  [{
        parameter:   item.labTest?.name,
        value:       "",
        unit:        item.labTest?.unit || "",
        normalRange: item.labTest?.normalRange || "",
        isAbnormal:  false,
        notes:       "",
      }],
    })) || []
  )
  const [overallNotes, setOverallNotes] = useState("")
  const [submitting,   setSubmitting]   = useState(false)

  const updateParam = (testIdx, paramIdx, field, value) => {
    setResults(prev => prev.map((test, ti) =>
      ti !== testIdx ? test : {
        ...test,
        parameters: test.parameters.map((param, pi) =>
          pi !== paramIdx ? param : { ...param, [field]: value }
        ),
      }
    ))
  }

  const addParam = (testIdx) => {
    setResults(prev => prev.map((test, ti) =>
      ti !== testIdx ? test : {
        ...test,
        parameters: [
          ...test.parameters,
          { parameter: "", value: "", unit: "", normalRange: "", isAbnormal: false, notes: "" },
        ],
      }
    ))
  }

  const submit = async () => {
    const allResults = results.flatMap(t =>
      t.parameters.filter(p => p.parameter && p.value)
    )
    if (!allResults.length) { toast.error("Enter at least one result"); return }
    setSubmitting(true)
    try {
      await api.post(`/lab/orders/${order.id}/results`, {
        results:         allResults,
        overallNotes,
        technicianNotes: overallNotes,
      })
      toast.success("Results submitted successfully!")

      // Build a mock savedOrder so parent can offer to print
      const savedOrder = {
        ...order,
        results: allResults.map(r => ({
          parameter:   r.parameter,
          value:       r.value,
          unit:        r.unit,
          normalRange: r.normalRange,
          isAbnormal:  r.isAbnormal,
        })),
        notes: overallNotes,
      }
      onSaved(savedOrder)
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to submit results")
    } finally { setSubmitting(false) }
  }

  // ── Print from inside modal (before submitting, as a draft check) ──────────
  const handlePrintDraft = () => {
    const allResults = results.flatMap(t =>
      t.parameters.filter(p => p.parameter && p.value)
    )
    if (!allResults.length) { toast.error("Enter at least one result to preview"); return }
    const draftOrder = {
      ...order,
      results: allResults.map(r => ({
        parameter:   r.parameter,
        value:       r.value,
        unit:        r.unit,
        normalRange: r.normalRange,
        isAbnormal:  r.isAbnormal,
      })),
      notes: overallNotes,
    }
    printLabResults(buildPrintPayload(draftOrder))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Modal header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-purple-600" /> Enter Lab Results
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {order.visit?.patient?.firstName} {order.visit?.patient?.lastName}
              {" — "}
              {order.visit?.patient?.patientNumber}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Draft print from modal */}
            <button
              onClick={handlePrintDraft}
              title="Preview / Print draft"
              className="flex items-center gap-1.5 text-sm text-purple-700 border border-purple-200
                         bg-purple-50 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <Printer className="w-4 h-4" /> Preview
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {results.map((test, testIdx) => (
            <div key={testIdx} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-800">{test.testName}</h4>
                <button
                  onClick={() => addParam(testIdx)}
                  className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Parameter
                </button>
              </div>
              <div className="space-y-3">
                {test.parameters.map((param, paramIdx) => (
                  <div key={paramIdx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-3">
                      <input
                        value={param.parameter}
                        onChange={e => updateParam(testIdx, paramIdx, "parameter", e.target.value)}
                        placeholder="Parameter name"
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm
                                   focus:outline-none focus:ring-1 focus:ring-purple-400"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        value={param.value}
                        onChange={e => updateParam(testIdx, paramIdx, "value", e.target.value)}
                        placeholder="Result value"
                        className={`w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none
                                    focus:ring-1 ${
                                      param.isAbnormal
                                        ? "border-red-300 bg-red-50"
                                        : "border-gray-200 focus:ring-purple-400"
                                    }`}
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        value={param.unit}
                        onChange={e => updateParam(testIdx, paramIdx, "unit", e.target.value)}
                        placeholder="Unit"
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm
                                   focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        value={param.normalRange}
                        onChange={e => updateParam(testIdx, paramIdx, "normalRange", e.target.value)}
                        placeholder="Normal range"
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm
                                   focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        value={param.notes}
                        onChange={e => updateParam(testIdx, paramIdx, "notes", e.target.value)}
                        placeholder="Notes"
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm
                                   focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={param.isAbnormal}
                          onChange={e =>
                            updateParam(testIdx, paramIdx, "isAbnormal", e.target.checked)
                          }
                        />
                        <span className={`text-xs font-medium ${
                          param.isAbnormal ? "text-red-600" : "text-gray-500"
                        }`}>
                          {param.isAbnormal ? "ABNORMAL" : "Normal"}
                        </span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Overall Notes / Interpretation
            </label>
            <textarea
              value={overallNotes}
              onChange={e => setOverallNotes(e.target.value)}
              placeholder="General observations, interpretations, recommendations..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Modal footer */}
        <div className="p-5 border-t border-gray-100 flex justify-between items-center">
          {/* Print hint */}
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Printer className="w-3.5 h-3.5" />
            Report will auto-print after validation
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600
                         hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg
                         text-sm font-semibold hover:bg-purple-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {submitting ? "Submitting..." : "Submit Results"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Test Catalog ─────────────────────────────────────────────────────────────
function TestCatalog() {
  const [tests,     setTests]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState("")
  const [filterCat, setFilterCat] = useState("ALL")

  useEffect(() => { fetchTests() }, [])

  const fetchTests = async () => {
    try {
      const res = await api.get("/lab/tests")
      setTests(res.data.data || [])
    } catch (e) {}
    finally { setLoading(false) }
  }

  const categories = ["ALL", ...new Set(tests.map(t => t.category))]
  const filtered   = tests.filter(t =>
    (filterCat === "ALL" || t.category === filterCat) &&
    (search === "" ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.code.toLowerCase().includes(search.toLowerCase())
    )
  )

  const CAT_COLOR = {
    HEMATOLOGY:   "bg-red-100 text-red-700",
    CHEMISTRY:    "bg-blue-100 text-blue-700",
    SEROLOGY:     "bg-green-100 text-green-700",
    MICROBIOLOGY: "bg-yellow-100 text-yellow-700",
    URINALYSIS:   "bg-purple-100 text-purple-700",
    THYROID:      "bg-pink-100 text-pink-700",
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tests..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
        >
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="text-sm text-gray-500">{filtered.length} test(s)</div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {loading ? (
          [...Array(9)].map((_, i) =>
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          )
        ) : filtered.map(test => (
          <div
            key={test.id}
            className="border border-gray-200 rounded-xl p-4 hover:border-purple-200 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-semibold text-gray-800 text-sm">{test.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{test.code}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                CAT_COLOR[test.category] || "bg-gray-100 text-gray-600"
              }`}>
                {test.category}
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
              <div>
                {test.normalRange && (
                  <p className="text-xs text-green-600">Normal: {test.normalRange}</p>
                )}
                <p className="text-xs text-gray-400">TAT: {test.turnaroundHours}h</p>
              </div>
              <p className="text-sm font-bold text-purple-700">
                KES {test.price?.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}