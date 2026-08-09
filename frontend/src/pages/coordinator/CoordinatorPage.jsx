import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import toast from "react-hot-toast"
import api from "../../services/api"
import {
  ShieldCheck, Activity, Users, FlaskConical, Pill,
  BedDouble, AlertTriangle, Clock, Eye, CheckCircle,
  RefreshCw, ArrowRight, Zap
} from "lucide-react"

// ─── Fixed colour map — no dynamic Tailwind strings ───────────────────────
const COLOR = {
  blue:   { bg:"bg-blue-50",   border:"border-blue-100",   icon:"text-blue-600",   head:"text-blue-800",   badge:"bg-blue-100 text-blue-700",   btn:"text-blue-600 hover:text-blue-800"   },
  purple: { bg:"bg-purple-50", border:"border-purple-100", icon:"text-purple-600", head:"text-purple-800", badge:"bg-purple-100 text-purple-700", btn:"text-purple-600 hover:text-purple-800" },
  green:  { bg:"bg-green-50",  border:"border-green-100",  icon:"text-green-600",  head:"text-green-800",  badge:"bg-green-100 text-green-700",  btn:"text-green-600 hover:text-green-800"  },
  red:    { bg:"bg-red-50",    border:"border-red-100",    icon:"text-red-600",    head:"text-red-800",    badge:"bg-red-100 text-red-700",    btn:"text-red-600 hover:text-red-800"    },
}

export default function CoordinatorPage() {
  const navigate = useNavigate()

  const [data, setData] = useState({
    visits:        [],
    labs:          [],
    prescriptions: [],
    admissions:    [],
    emergencies:   [],
  })
  const [loading, setLoading]   = useState(true)
  const [stats, setStats]       = useState({
    pendingVisits:     0,
    pendingLabs:       0,
    pendingRx:         0,
    activeAdmissions:  0,
    activeEmergencies: 0,
  })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const today = new Date().toISOString().split("T")[0]

      const [vRes, lRes, rRes, aRes, eRes] = await Promise.allSettled([
        api.get(`/visits?date=${today}`),
        api.get("/lab/orders?status=ORDERED,SAMPLE_COLLECTED,PROCESSING"),
        api.get("/pharmacy/prescriptions?status=PENDING,VERIFIED"),
        api.get("/admissions?status=ACTIVE"),
        api.get("/emergency"),
      ])

      const visits        = vRes.status === "fulfilled" ? (vRes.value.data?.data?.visits        || vRes.value.data?.visits        || vRes.value.data?.data || []) : []
      const labs          = lRes.status === "fulfilled" ? (lRes.value.data?.data?.orders         || lRes.value.data?.orders         || lRes.value.data?.data || []) : []
      const rxs           = rRes.status === "fulfilled" ? (rRes.value.data?.data?.prescriptions  || rRes.value.data?.prescriptions  || rRes.value.data?.data || []) : []
      const adm           = aRes.status === "fulfilled" ? (aRes.value.data?.data?.admissions     || aRes.value.data?.admissions     || aRes.value.data?.data || []) : []
      const emg           = eRes.status === "fulfilled" ? (eRes.value.data?.data?.cases          || eRes.value.data?.cases          || eRes.value.data?.data || []) : []

      const visitsArr        = Array.isArray(visits) ? visits : []
      const labsArr          = Array.isArray(labs)   ? labs   : []
      const rxsArr           = Array.isArray(rxs)    ? rxs    : []
      const admArr           = Array.isArray(adm)    ? adm    : []
      const emgArr           = Array.isArray(emg)    ? emg    : []

      setData({
        visits:        visitsArr,
        labs:          labsArr,
        prescriptions: rxsArr,
        admissions:    admArr,
        emergencies:   emgArr,
      })

      setStats({
        pendingVisits:     visitsArr.filter(v => ["WAITING","TRIAGED","VITALS_DONE"].includes(v.status)).length,
        pendingLabs:       labsArr.length,
        pendingRx:         rxsArr.length,
        activeAdmissions:  admArr.length,
        activeEmergencies: emgArr.filter(e => e.status !== "DISCHARGED").length,
      })
    } catch (e) {
      console.error("CoordinatorPage fetchAll error:", e)
    } finally {
      setLoading(false)   // ← always runs, never leaves page stuck
    }
  }

  const bypass = async (type, id) => {
    try {
      if (type === "lab") {
        await api.patch(`/lab/orders/${id}/process`)
        toast.success("Lab order pushed to processing")
      } else if (type === "rx") {
        await api.patch(`/pharmacy/prescriptions/${id}/verify`)
        toast.success("Prescription verified")
      }
      fetchAll()
    } catch (e) {
      toast.error(e.response?.data?.message || "Action failed")
    }
  }

  // ── Pending visits filtered ───────────────────────────────────────────────
  const pendingVisits   = data.visits.filter(v => ["WAITING","TRIAGED","VITALS_DONE"].includes(v.status))
  const activeEmergencies = data.emergencies.filter(e => e.status !== "DISCHARGED")

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-orange-700 via-orange-600 to-amber-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-white" />
            <div>
              <p className="text-orange-200 text-sm">Clinical Coordinator</p>
              <h1 className="text-2xl font-bold">Coordination Dashboard</h1>
              <p className="text-orange-200 text-sm mt-1">Real-time hospital overview</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label:"Pending Queue", value: stats.pendingVisits     },
                { label:"Pending Labs",  value: stats.pendingLabs       },
                { label:"Emergencies",   value: stats.activeEmergencies },
              ].map(s => (
                <div key={s.label} className="bg-white/20 rounded-xl px-3 py-2 text-center">
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-orange-200 text-xs">{s.label}</p>
                </div>
              ))}
            </div>
            <button
              onClick={fetchAll}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white transition-all"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Override Powers Banner ── */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
        <Zap className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-orange-800 font-semibold text-sm">Coordinator Override Powers</p>
          <p className="text-orange-600 text-xs mt-0.5">
            As Clinical Coordinator, you can push/bypass procedures that may be stalled.
            Use the <strong>Push</strong> and <strong>Verify</strong> buttons to advance stuck workflows.
            All actions are logged in the audit trail.
          </p>
        </div>
      </div>

      {/* ── Panels Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Panel 1 — Pending Queue */}
        <PanelCard
          title="Pending Queue"
          icon={Activity}
          color="blue"
          value={stats.pendingVisits}
          loading={loading}
          onViewAll={() => navigate("/reception")}
        >
          {pendingVisits.length === 0 ? (
            <EmptyPanel color="blue" />
          ) : (
            pendingVisits.slice(0,8).map(v => (
              <div key={v.id} className="flex justify-between items-center py-2.5 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {v.patient?.firstName} {v.patient?.lastName}
                  </p>
                  <p className="text-xs text-gray-400">
                    {v.visitType} · {v.status?.replace(/_/g," ")}
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/doctor/consult/${v.id}`)}
                  className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700 transition-all"
                >
                  See
                </button>
              </div>
            ))
          )}
        </PanelCard>

        {/* Panel 2 — Lab Orders */}
        <PanelCard
          title="Lab Orders Pending"
          icon={FlaskConical}
          color="purple"
          value={stats.pendingLabs}
          loading={loading}
          onViewAll={() => navigate("/laboratory")}
        >
          {data.labs.length === 0 ? (
            <EmptyPanel color="purple" />
          ) : (
            data.labs.slice(0,8).map(o => (
              <div key={o.id} className="flex justify-between items-center py-2.5 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {o.visit?.patient?.firstName} {o.visit?.patient?.lastName}
                  </p>
                  <p className="text-xs text-gray-400">{o.priority} · {o.status}</p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => navigate("/laboratory")}
                    className="text-xs bg-purple-100 text-purple-700 px-2.5 py-1 rounded-lg hover:bg-purple-200 transition-all"
                  >
                    View
                  </button>
                  <button
                    onClick={() => bypass("lab", o.id)}
                    className="text-xs bg-purple-600 text-white px-2.5 py-1 rounded-lg hover:bg-purple-700 transition-all flex items-center gap-1"
                  >
                    <Zap className="w-3 h-3" /> Push
                  </button>
                </div>
              </div>
            ))
          )}
        </PanelCard>

        {/* Panel 3 — Prescriptions */}
        <PanelCard
          title="Prescriptions Pending"
          icon={Pill}
          color="green"
          value={stats.pendingRx}
          loading={loading}
          onViewAll={() => navigate("/pharmacy")}
        >
          {data.prescriptions.length === 0 ? (
            <EmptyPanel color="green" />
          ) : (
            data.prescriptions.slice(0,8).map(rx => (
              <div key={rx.id} className="flex justify-between items-center py-2.5 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {rx.visit?.patient?.firstName} {rx.visit?.patient?.lastName}
                  </p>
                  <p className="text-xs text-gray-400">
                    {rx.items?.length || 0} items · {rx.status}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => navigate("/pharmacy")}
                    className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-lg hover:bg-green-200 transition-all"
                  >
                    View
                  </button>
                  <button
                    onClick={() => bypass("rx", rx.id)}
                    className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-lg hover:bg-green-700 transition-all flex items-center gap-1"
                  >
                    <Zap className="w-3 h-3" /> Verify
                  </button>
                </div>
              </div>
            ))
          )}
        </PanelCard>

        {/* Panel 4 — Emergencies */}
        <PanelCard
          title="Active Emergencies"
          icon={AlertTriangle}
          color="red"
          value={stats.activeEmergencies}
          loading={loading}
          onViewAll={() => navigate("/emergency")}
        >
          {activeEmergencies.length === 0 ? (
            <EmptyPanel color="red" />
          ) : (
            activeEmergencies.slice(0,8).map(e => (
              <div key={e.id} className="flex justify-between items-center py-2.5 border-b border-gray-50 last:border-0">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800">
                      {e.patient?.firstName || e.patientName || "Unknown"}
                    </p>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      e.triageLevel === "IMMEDIATE" ? "bg-red-100 text-red-700"    :
                      e.triageLevel === "URGENT"    ? "bg-orange-100 text-orange-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>
                      {e.triageLevel}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{e.chiefComplaint}</p>
                </div>
                <button
                  onClick={() => navigate("/emergency")}
                  className="text-xs bg-red-600 text-white px-2.5 py-1 rounded-lg hover:bg-red-700 transition-all"
                >
                  View
                </button>
              </div>
            ))
          )}
        </PanelCard>
      </div>

      {/* ── Active Admissions Summary ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <BedDouble className="w-5 h-5 text-indigo-600" />
            Active Admissions ({stats.activeAdmissions})
          </h3>
          <button
            onClick={() => navigate("/ipd")}
            className="text-sm text-indigo-600 flex items-center gap-1 hover:text-indigo-800 transition-all"
          >
            IPD Module <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {data.admissions.length === 0 ? (
          <div className="text-center py-8">
            <BedDouble className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No active admissions</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.admissions.slice(0,8).map(admission => (
              <div
                key={admission.id}
                className="border border-gray-200 rounded-xl p-3 hover:border-indigo-200 transition-colors"
              >
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {admission.patient?.firstName} {admission.patient?.lastName}
                </p>
                <p className="text-xs text-indigo-600 font-medium">
                  Bed {admission.bed?.bedNumber || "—"}
                </p>
                <p className="text-xs text-gray-400">
                  {admission.bed?.room?.ward?.name || admission.ward?.name || "—"}
                </p>
                <p className="text-xs text-gray-400">
                  Day {Math.floor((Date.now() - new Date(admission.admittedAt)) / 86400000) + 1}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

// ─── Reusable Panel Card ─────────────────────────────────────────────────
function PanelCard({ title, icon: Icon, color, value, loading, onViewAll, children }) {
  const c = COLOR[color] || COLOR.blue
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className={`flex items-center justify-between px-5 py-4 border-b border-gray-100 ${c.bg}`}>
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${c.icon}`} />
          <h3 className={`font-semibold ${c.head}`}>{title}</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.badge}`}>
            {loading ? "—" : value}
          </span>
        </div>
        <button
          onClick={onViewAll}
          className={`text-xs flex items-center gap-1 transition-all ${c.btn}`}
        >
          View all <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 max-h-64 overflow-y-auto">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse mb-2" />
          ))
        ) : (
          children
        )}
      </div>
    </div>
  )
}

// ─── Empty Panel State ───────────────────────────────────────────────────
function EmptyPanel({ color }) {
  const c = COLOR[color] || COLOR.blue
  return (
    <div className="text-center py-6">
      <CheckCircle className={`w-8 h-8 mx-auto mb-2 ${c.icon} opacity-30`} />
      <p className="text-gray-400 text-sm">All clear!</p>
    </div>
  )
}