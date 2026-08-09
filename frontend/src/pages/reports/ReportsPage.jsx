// frontend/src/pages/ReportsPage.jsx
import { useState, useEffect, useCallback } from "react"
import useAuthStore from "../../store/authStore"
import api from "../../services/api"
import toast from "react-hot-toast"
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area
} from "recharts"
import {
  TrendingUp, Users, Activity, DollarSign,
  FileText, Download, RefreshCw, Calendar,
  BedDouble, FlaskConical, Pill, AlertTriangle,
  ChevronDown, Printer, Filter, Clock,
  Heart, Building2, ArrowUp, ArrowDown
} from "lucide-react"

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => (n ?? 0).toLocaleString()
const fmtCurrency = (n) => `₦${(n ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
const fmtPct = (n, d) => d ? `${((n / d) * 100).toFixed(1)}%` : "0%"

const COLORS = [
  "#3b82f6","#10b981","#f59e0b","#ef4444",
  "#8b5cf6","#06b6d4","#f97316","#84cc16"
]

const TABS = [
  { id: "overview",   label: "Overview",         icon: TrendingUp   },
  { id: "clinical",   label: "Clinical",          icon: Activity     },
  { id: "financial",  label: "Financial",         icon: DollarSign   },
  { id: "patients",   label: "Patients",          icon: Users        },
  { id: "beds",       label: "Bed Occupancy",     icon: BedDouble    },
  { id: "lab",        label: "Laboratory",        icon: FlaskConical },
  { id: "pharmacy",   label: "Pharmacy",          icon: Pill         }
]

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, color, sub, trend, trendVal }) => (
  <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
    <div className="flex items-start justify-between">
      <div className={`w-11 h-11 rounded-xl bg-${color}-100 flex items-center justify-center`}>
        <Icon className={`w-5 h-5 text-${color}-600`} />
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-medium ${
          trend === "up" ? "text-green-600" : "text-red-600"
        }`}>
          {trend === "up"
            ? <ArrowUp className="w-3 h-3" />
            : <ArrowDown className="w-3 h-3" />
          }
          {trendVal}
        </div>
      )}
    </div>
    <p className="text-2xl font-bold text-gray-800 mt-3">{value ?? "—"}</p>
    <p className="text-sm font-medium text-gray-600 mt-0.5">{label}</p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </div>
)

// ── Date Range Picker ─────────────────────────────────────────────────────────
const DateRange = ({ from, to, onChange }) => (
  <div className="flex items-center gap-2 flex-wrap">
    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-3 py-2">
      <Calendar className="w-4 h-4 text-gray-400" />
      <input
        type="date"
        value={from}
        onChange={e => onChange("from", e.target.value)}
        className="text-sm text-gray-700 outline-none"
      />
    </div>
    <span className="text-gray-400 text-sm">to</span>
    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-3 py-2">
      <Calendar className="w-4 h-4 text-gray-400" />
      <input
        type="date"
        value={to}
        onChange={e => onChange("to", e.target.value)}
        className="text-sm text-gray-700 outline-none"
      />
    </div>
  </div>
)

// ── Quick Range Buttons ───────────────────────────────────────────────────────
const QuickRange = ({ onSelect }) => {
  const ranges = [
    { label: "Today",    days: 0  },
    { label: "7 Days",   days: 7  },
    { label: "30 Days",  days: 30 },
    { label: "90 Days",  days: 90 },
    { label: "1 Year",   days: 365}
  ]
  return (
    <div className="flex gap-2 flex-wrap">
      {ranges.map(r => (
        <button
          key={r.label}
          onClick={() => onSelect(r.days)}
          className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}

// ── Main Reports Page ─────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState("overview")
  const [loading,   setLoading]   = useState(true)
  const [data,      setData]      = useState({})
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
    to:   new Date().toISOString().split("T")[0]
  })

  const handleDateChange = (key, val) => {
    setDateRange(prev => ({ ...prev, [key]: val }))
  }

  const handleQuickRange = (days) => {
    const to   = new Date()
    const from = days === 0
      ? new Date()
      : new Date(Date.now() - days * 86400000)
    setDateRange({
      from: from.toISOString().split("T")[0],
      to:   to.toISOString().split("T")[0]
    })
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const params = `from=${dateRange.from}&to=${dateRange.to}`

      const [
        overviewRes, visitsRes, admissionsRes,
        labRes, billingRes, bedsRes, patientsRes
      ] = await Promise.allSettled([
        api.get(`/reports/overview?${params}`),
        api.get(`/reports/visits?${params}`),
        api.get(`/reports/admissions?${params}`),
        api.get(`/reports/lab?${params}`),
        api.get(`/reports/billing?${params}`),
        api.get(`/reports/beds?${params}`),
        api.get(`/reports/patients?${params}`)
      ])

      const extract = (res) => res.status === "fulfilled"
        ? res.value.data?.data || {}
        : {}

      setData({
        overview:   extract(overviewRes),
        visits:     extract(visitsRes),
        admissions: extract(admissionsRes),
        lab:        extract(labRes),
        billing:    extract(billingRes),
        beds:       extract(bedsRes),
        patients:   extract(patientsRes)
      })
    } catch (e) {
      console.error("Reports fetch error:", e)
      toast.error("Failed to load reports")
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handlePrint = () => window.print()

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-blue-200 text-sm">Management Reports</p>
              <h1 className="text-2xl font-bold">Analytics & Reports</h1>
              <p className="text-blue-200 text-sm">
                {dateRange.from} → {dateRange.to}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchAll}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-white text-blue-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-50"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
          </div>
        </div>
      </div>

      {/* Date Range Controls */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <DateRange
            from={dateRange.from}
            to={dateRange.to}
            onChange={handleDateChange}
          />
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700"
          >
            <Filter className="w-4 h-4" /> Apply Filter
          </button>
        </div>
        <QuickRange onSelect={handleQuickRange} />
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
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-700 bg-blue-50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="p-5">
          {loading ? (
            <LoadingSkeleton />
          ) : (
            <>
              {activeTab === "overview"  && <OverviewTab  data={data} />}
              {activeTab === "clinical"  && <ClinicalTab  data={data} />}
              {activeTab === "financial" && <FinancialTab data={data} />}
              {activeTab === "patients"  && <PatientsTab  data={data} />}
              {activeTab === "beds"      && <BedsTab      data={data} />}
              {activeTab === "lab"       && <LabTab       data={data} />}
              {activeTab === "pharmacy"  && <PharmacyTab  data={data} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Loading Skeleton ───────────────────────────────────────────────────────────
const LoadingSkeleton = () => (
  <div className="space-y-5">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="bg-gray-100 rounded-xl h-28 animate-pulse" />
      ))}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="bg-gray-100 rounded-xl h-64 animate-pulse" />
      ))}
    </div>
  </div>
)

// ── Overview Tab ──────────────────────────────────────────────────────────────
const OverviewTab = ({ data }) => {
  const o = data.overview || {}
  const v = data.visits   || {}
  const b = data.billing  || {}

  const visitTrend  = v.dailyTrend  || []
  const visitTypes  = v.byType      || []
  const revenueTrend= b.dailyRevenue|| []

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Visits"
          value={fmt(o.totalVisits)}
          icon={Users}
          color="blue"
          sub={`${fmt(o.opdVisits)} OPD · ${fmt(o.ipdVisits)} IPD`}
        />
        <StatCard
          label="Active Admissions"
          value={fmt(o.activeAdmissions)}
          icon={BedDouble}
          color="purple"
          sub={`${fmt(o.availableBeds)} beds available`}
        />
        <StatCard
          label="Revenue"
          value={fmtCurrency(o.totalRevenue)}
          icon={DollarSign}
          color="green"
          sub={`${fmt(o.pendingBills)} bills pending`}
        />
        <StatCard
          label="Emergency Cases"
          value={fmt(o.emergencyCases)}
          icon={AlertTriangle}
          color="red"
          sub="This period"
        />
        <StatCard
          label="Lab Tests"
          value={fmt(o.labTests)}
          icon={FlaskConical}
          color="cyan"
          sub={`${fmt(o.labPending)} pending`}
        />
        <StatCard
          label="Prescriptions"
          value={fmt(o.prescriptions)}
          icon={Pill}
          color="orange"
          sub="Dispensed"
        />
        <StatCard
          label="Surgeries"
          value={fmt(o.surgeries)}
          icon={Activity}
          color="pink"
          sub="This period"
        />
        <StatCard
          label="New Patients"
          value={fmt(o.newPatients)}
          icon={Users}
          color="teal"
          sub="Registered"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Daily Visits Trend */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            Daily Visits Trend
          </h3>
          {visitTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={visitTrend}>
                <defs>
                  <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  fill="url(#colorVisits)"
                  strokeWidth={2}
                  name="Visits"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No visit data for this period" />
          )}
        </div>

        {/* Visit Type Breakdown */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-600" />
            Visit Type Breakdown
          </h3>
          {visitTypes.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie
                    data={visitTypes}
                    dataKey="count"
                    nameKey="type"
                    cx="50%" cy="50%"
                    outerRadius={80}
                    label={({ type, percent }) =>
                      `${type} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {visitTypes.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {visitTypes.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <span className="text-sm text-gray-600">{item.type}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-800">
                      {fmt(item.count)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyChart message="No visit type data" />
          )}
        </div>
      </div>

      {/* Revenue Trend */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-600" />
          Daily Revenue Trend
        </h3>
        {revenueTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }}
                tickFormatter={v => `₦${(v/1000).toFixed(0)}k`}
              />
              <Tooltip formatter={v => fmtCurrency(v)} />
              <Bar dataKey="revenue" fill="#10b981" radius={[4,4,0,0]} name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="No revenue data for this period" />
        )}
      </div>
    </div>
  )
}

// ── Clinical Tab ──────────────────────────────────────────────────────────────
const ClinicalTab = ({ data }) => {
  const v = data.visits     || {}
  const a = data.admissions || {}

  const diagnosisDist  = v.topDiagnoses    || []
  const admissionTrend = a.trend           || []
  const avgLOS         = a.avgLOS          || 0
  const byWard         = a.byWard          || []

  return (
    <div className="space-y-6">
      {/* Clinical KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Admissions"
          value={fmt(a.total)}
          icon={BedDouble}
          color="blue"
          sub="This period"
        />
        <StatCard
          label="Avg Length of Stay"
          value={`${avgLOS} days`}
          icon={Clock}
          color="orange"
          sub="Per admission"
        />
        <StatCard
          label="Discharge Rate"
          value={fmtPct(a.discharged, a.total)}
          icon={Activity}
          color="green"
          sub={`${fmt(a.discharged)} discharged`}
        />
        <StatCard
          label="Emergency Admissions"
          value={fmt(a.fromEmergency)}
          icon={AlertTriangle}
          color="red"
          sub="Via Emergency"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Admission Trend */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-4">Admission Trend</h3>
          {admissionTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={admissionTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="admissions"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="discharges"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No admission trend data" />
          )}
        </div>

        {/* Admissions by Ward */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-4">Admissions by Ward</h3>
          {byWard.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byWard} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  dataKey="ward"
                  type="category"
                  tick={{ fontSize: 11 }}
                  width={100}
                />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0,4,4,0]} name="Admissions" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No ward data available" />
          )}
        </div>
      </div>

      {/* Top Diagnoses */}
      {diagnosisDist.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-4">Top Diagnoses / Chief Complaints</h3>
          <div className="space-y-3">
            {diagnosisDist.slice(0, 10).map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-400 w-6">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700">{d.diagnosis}</span>
                    <span className="text-sm font-semibold text-gray-800">{fmt(d.count)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${(d.count / diagnosisDist[0].count) * 100}%`,
                        backgroundColor: COLORS[i % COLORS.length]
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Financial Tab ─────────────────────────────────────────────────────────────
const FinancialTab = ({ data }) => {
  const b = data.billing || {}

  const revenueByService = b.byService    || []
  const paymentMethods   = b.byPayment    || []
  const dailyRevenue     = b.dailyRevenue || []

  return (
    <div className="space-y-6">
      {/* Financial KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue"
          value={fmtCurrency(b.totalRevenue)}
          icon={DollarSign}
          color="green"
          sub="Collected"
        />
        <StatCard
          label="Pending Bills"
          value={fmtCurrency(b.pendingAmount)}
          icon={FileText}
          color="orange"
          sub={`${fmt(b.pendingCount)} invoices`}
        />
        <StatCard
          label="Total Billed"
          value={fmtCurrency(b.totalBilled)}
          icon={TrendingUp}
          color="blue"
          sub="Invoiced amount"
        />
        <StatCard
          label="Collection Rate"
          value={fmtPct(b.totalRevenue, b.totalBilled)}
          icon={Activity}
          color="purple"
          sub="Payment rate"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Revenue by Service */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-4">Revenue by Service Category</h3>
          {revenueByService.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenueByService}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="service" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₦${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => fmtCurrency(v)} />
                <Bar dataKey="revenue" fill="#10b981" radius={[4,4,0,0]} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No service revenue data" />
          )}
        </div>

        {/* Payment Methods */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-4">Payment Methods</h3>
          {paymentMethods.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie
                    data={paymentMethods}
                    dataKey="amount"
                    nameKey="method"
                    cx="50%" cy="50%"
                    outerRadius={80}
                  >
                    {paymentMethods.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={v => fmtCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3">
                {paymentMethods.map((item, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        <span className="text-xs text-gray-600">{item.method}</span>
                      </div>
                      <span className="text-xs font-semibold">{fmtCurrency(item.amount)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1">
                      <div
                        className="h-1 rounded-full"
                        style={{
                          width: fmtPct(item.amount, b.totalRevenue),
                          backgroundColor: COLORS[i % COLORS.length]
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyChart message="No payment method data" />
          )}
        </div>
      </div>

      {/* Daily Revenue Table */}
      {dailyRevenue.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-4">Daily Revenue Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Date</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Bills</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Billed</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Collected</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Rate</th>
                </tr>
              </thead>
              <tbody>
                {dailyRevenue.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-700">{row.date}</td>
                    <td className="py-2 px-3 text-right text-gray-700">{fmt(row.bills)}</td>
                    <td className="py-2 px-3 text-right text-gray-700">{fmtCurrency(row.billed)}</td>
                    <td className="py-2 px-3 text-right font-medium text-green-700">{fmtCurrency(row.revenue)}</td>
                    <td className="py-2 px-3 text-right text-gray-600">{fmtPct(row.revenue, row.billed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Patients Tab ──────────────────────────────────────────────────────────────
const PatientsTab = ({ data }) => {
  const p = data.patients || {}

  const byGender     = p.byGender     || []
  const byAge        = p.byAgeGroup   || []
  const registrations= p.trend        || []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Patients"    value={fmt(p.total)}    icon={Users}  color="blue"   sub="All time"         />
        <StatCard label="New This Period"   value={fmt(p.new)}      icon={Users}  color="green"  sub="Registered"       />
        <StatCard label="Return Patients"   value={fmt(p.returning)}icon={Heart}  color="purple" sub="Repeat visits"    />
        <StatCard label="Active Patients"   value={fmt(p.active)}   icon={Activity} color="orange" sub="Currently admitted" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Gender Distribution */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-4">Gender Distribution</h3>
          {byGender.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={byGender}
                    dataKey="count"
                    nameKey="gender"
                    cx="50%" cy="50%"
                    outerRadius={70}
                    label={({ gender, percent }) =>
                      `${gender} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {byGender.map((_, i) => (
                      <Cell key={i} fill={COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {byGender.map((g, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[i] }}
                    />
                    <span className="text-xs text-gray-600">
                      {g.gender}: {fmt(g.count)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyChart message="No gender data" />
          )}
        </div>

        {/* Age Groups */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 col-span-2">
          <h3 className="font-semibold text-gray-800 mb-4">Age Group Distribution</h3>
          {byAge.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byAge}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="group" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4,4,0,0]} name="Patients" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No age group data" />
          )}
        </div>
      </div>

      {/* Registration Trend */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <h3 className="font-semibold text-gray-800 mb-4">Patient Registration Trend</h3>
        {registrations.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={registrations}>
              <defs>
                <linearGradient id="colorPat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#10b981"
                fill="url(#colorPat)"
                strokeWidth={2}
                name="Registrations"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="No registration trend data" />
        )}
      </div>
    </div>
  )
}

// ── Beds Tab ──────────────────────────────────────────────────────────────────
const BedsTab = ({ data }) => {
  const b = data.beds || {}
  const byWard = b.byWard || []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Beds"     value={fmt(b.total)}     icon={BedDouble} color="blue"   sub="All wards"      />
        <StatCard label="Occupied"       value={fmt(b.occupied)}  icon={BedDouble} color="red"    sub={fmtPct(b.occupied, b.total) + " occupancy"} />
        <StatCard label="Available"      value={fmt(b.available)} icon={BedDouble} color="green"  sub="Ready now"      />
        <StatCard label="Avg Occupancy"  value={fmtPct(b.occupied, b.total)} icon={TrendingUp} color="orange" sub="Current rate" />
      </div>

      {/* Ward Breakdown */}
      {byWard.length > 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-4">Bed Status by Ward</h3>
          <div className="space-y-3">
            {byWard.map((ward, i) => {
              const pct = ward.total > 0
                ? Math.round((ward.occupied / ward.total) * 100)
                : 0
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{ward.name}</span>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="text-blue-600 font-medium">{ward.occupied} occupied</span>
                      <span className="text-green-600 font-medium">{ward.available} free</span>
                      <span className="font-bold text-gray-700">{pct}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${
                        pct >= 90 ? "bg-red-500" :
                        pct >= 70 ? "bg-orange-500" :
                        "bg-green-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-4">Bed Status by Ward</h3>
          <EmptyChart message="No ward bed data available" />
        </div>
      )}

      {/* Occupancy Chart */}
      {byWard.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-4">Ward Capacity Overview</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byWard}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="occupied"  fill="#3b82f6" radius={[4,4,0,0]} name="Occupied"  />
              <Bar dataKey="available" fill="#10b981" radius={[4,4,0,0]} name="Available" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ── Lab Tab ───────────────────────────────────────────────────────────────────
const LabTab = ({ data }) => {
  const l = data.lab || {}
  const byTest     = l.byTest     || []
  const trend      = l.trend      || []
  const turnaround = l.turnaround || []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Tests"    value={fmt(l.total)}     icon={FlaskConical} color="cyan"   sub="Ordered"           />
        <StatCard label="Completed"      value={fmt(l.completed)} icon={Activity}     color="green"  sub="Results issued"    />
        <StatCard label="Pending"        value={fmt(l.pending)}   icon={Clock}        color="orange" sub="Awaiting results"  />
        <StatCard label="Avg Turnaround" value={`${l.avgTurnaround || 0}h`} icon={Clock} color="purple" sub="Hours to result" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Tests by Type */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-4">Top Lab Tests Ordered</h3>
          {byTest.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byTest.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="test" type="category" tick={{ fontSize: 10 }} width={120} />
                <Tooltip />
                <Bar dataKey="count" fill="#06b6d4" radius={[0,4,4,0]} name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No lab test data" />
          )}
        </div>

        {/* Lab Volume Trend */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-4">Daily Lab Volume</h3>
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="ordered"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={false}
                  name="Ordered"
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  name="Completed"
                />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No lab trend data" />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Pharmacy Tab ──────────────────────────────────────────────────────────────
const PharmacyTab = ({ data }) => {
  const ph = data.pharmacy || {}
  const topDrugs = ph.topDrugs || []
  const trend    = ph.trend    || []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Prescriptions"   value={fmt(ph.total)}      icon={Pill}       color="green"  sub="This period"      />
        <StatCard label="Dispensed"       value={fmt(ph.dispensed)}  icon={Activity}   color="blue"   sub="Fulfilled"        />
        <StatCard label="Pending"         value={fmt(ph.pending)}    icon={Clock}      color="orange" sub="Awaiting"         />
        <StatCard label="Drug Revenue"    value={fmtCurrency(ph.revenue)} icon={DollarSign} color="purple" sub="Pharmacy sales" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Drugs */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-4">Most Prescribed Drugs</h3>
          {topDrugs.length > 0 ? (
            <div className="space-y-3">
              {topDrugs.slice(0, 8).map((d, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-5">{i+1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-700">{d.drug}</span>
                      <span className="text-sm font-semibold">{fmt(d.count)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-green-500"
                        style={{
                          width: `${(d.count / topDrugs[0].count) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyChart message="No prescription data" />
          )}
        </div>

        {/* Dispensing Trend */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-4">Daily Dispensing Volume</h3>
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#f97316" radius={[4,4,0,0]} name="Dispensed" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No dispensing trend data" />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Empty Chart Placeholder ───────────────────────────────────────────────────
const EmptyChart = ({ message }) => (
  <div className="flex flex-col items-center justify-center h-40 text-gray-300">
    <TrendingUp className="w-10 h-10 mb-2" />
    <p className="text-sm text-gray-400">{message}</p>
    <p className="text-xs text-gray-300 mt-1">Data will appear as records are added</p>
  </div>
)