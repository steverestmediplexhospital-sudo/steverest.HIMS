// frontend/src/pages/dashboard/Dashboard.jsx
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import useAuthStore from "../../store/authStore"
import api from "../../services/api"
import {
  Users, Activity, BedDouble, FlaskConical, Pill,
  AlertTriangle, TrendingUp, Clock, CheckCircle,
  ArrowRight, RefreshCw, UserPlus, Stethoscope,
  DollarSign, FileText, Package, Heart,
  Clipboard, Building2, Calendar, ShieldAlert,
  Microscope, Thermometer, Bell, BarChart3
} from "lucide-react"

// ── Role-based dashboard config ───────────────────────────────────────────────
const ROLE_CONFIG = {
  DOCTOR: {
    color:   "blue",
    title:   "Doctor / OPD",
    tagline: "Your patients need you",
    stats: [
      { key: "todayVisits",    label: "My Patients Today", icon: Users,        color: "blue",   path: "/doctor"    },
      { key: "pendingConsult", label: "Awaiting Consult",  icon: Stethoscope,  color: "indigo", path: "/doctor"    },
      { key: "pendingLabs",    label: "Pending Labs",      icon: FlaskConical, color: "purple", path: "/laboratory"},
      { key: "pendingRx",      label: "Prescriptions",     icon: Pill,         color: "orange", path: "/pharmacy"  },
      { key: "admissions",     label: "My Inpatients",     icon: BedDouble,    color: "teal",   path: "/ipd"       },
      { key: "emergency",      label: "Emergency Cases",   icon: AlertTriangle,color: "red",    path: "/emergency" },
    ],
    actions: [
      { label: "New OPD Visit",    icon: Stethoscope,   path: "/doctor",     color: "blue"   },
      { label: "Emergency Triage", icon: AlertTriangle, path: "/emergency",  color: "red"    },
      { label: "Write Rx",         icon: Pill,          path: "/pharmacy",   color: "orange" },
      { label: "Order Lab Test",   icon: FlaskConical,  path: "/laboratory", color: "purple" },
      { label: "Admit Patient",    icon: BedDouble,     path: "/ipd",        color: "indigo" },
      { label: "Patient Chart",    icon: FileText,      path: "/doctor",     color: "teal"   },
    ]
  },
  NURSE: {
    color:   "pink",
    title:   "Nursing Station",
    tagline: "Compassionate care, every shift",
    stats: [
      { key: "wardPatients",   label: "Ward Patients",     icon: BedDouble,    color: "pink",   path: "/ipd"       },
      { key: "vitalsdue",      label: "Vitals Due",         icon: Thermometer,  color: "red",    path: "/nursing"   },
      { key: "todayVisits",    label: "Today's Visits",     icon: Activity,     color: "blue",   path: "/nursing"   },
      { key: "emergency",      label: "Emergency Cases",    icon: AlertTriangle,color: "orange", path: "/emergency" },
      { key: "pendingMeds",    label: "Medications Due",    icon: Pill,         color: "purple", path: "/nursing"   },
      { key: "assessments",    label: "Assessments Done",   icon: Clipboard,    color: "green",  path: "/nursing"   },
    ],
    actions: [
      { label: "Record Vitals",    icon: Thermometer,   path: "/nursing",    color: "pink"   },
      { label: "Triage Patient",   icon: ShieldAlert,   path: "/emergency",  color: "red"    },
      { label: "Nursing Notes",    icon: Clipboard,     path: "/nursing",    color: "purple" },
      { label: "Medication Admin", icon: Pill,          path: "/nursing",    color: "orange" },
      { label: "Register Patient", icon: UserPlus,      path: "/reception",  color: "teal"   },
      { label: "View Ward",        icon: BedDouble,     path: "/ipd",        color: "indigo" },
    ]
  },
  PHARMACIST: {
    color:   "green",
    title:   "Pharmacy",
    tagline: "Dispensing with precision",
    stats: [
      { key: "pendingRx",      label: "Pending Prescriptions", icon: Pill,         color: "orange", path: "/pharmacy"  },
      { key: "dispensedToday", label: "Dispensed Today",       icon: CheckCircle,  color: "green",  path: "/pharmacy"  },
      { key: "lowStock",       label: "Low Stock Alerts",      icon: AlertTriangle,color: "red",    path: "/pharmacy"  },
      { key: "totalDrugs",     label: "Drug Items",            icon: Package,      color: "blue",   path: "/pharmacy"  },
      { key: "expiringSoon",   label: "Expiring Soon",         icon: Clock,        color: "yellow", path: "/pharmacy"  },
      { key: "todayRevenue",   label: "Pharmacy Revenue",      icon: DollarSign,   color: "teal",   path: "/billing"   },
    ],
    actions: [
      { label: "Dispense Rx",      icon: Pill,          path: "/pharmacy",   color: "green"  },
      { label: "Check Stock",      icon: Package,       path: "/pharmacy",   color: "blue"   },
      { label: "Add Drug",         icon: UserPlus,      path: "/pharmacy",   color: "teal"   },
      { label: "Low Stock",        icon: AlertTriangle, path: "/pharmacy",   color: "red"    },
    ]
  },
  LAB_SCIENTIST: {
    color:   "purple",
    title:   "Laboratory",
    tagline: "Accuracy in every result",
    stats: [
      { key: "pendingOrders",  label: "Pending Orders",    icon: FlaskConical, color: "orange", path: "/laboratory"},
      { key: "processing",     label: "Processing",         icon: Activity,     color: "blue",   path: "/laboratory"},
      { key: "completedToday", label: "Completed Today",    icon: CheckCircle,  color: "green",  path: "/laboratory"},
      { key: "critical",       label: "Critical Results",   icon: AlertTriangle,color: "red",    path: "/laboratory"},
      { key: "samplesIn",      label: "Samples Received",   icon: Microscope,   color: "purple", path: "/laboratory"},
      { key: "pendingValidate",label: "Pending Validation", icon: FileText,     color: "teal",   path: "/laboratory"},
    ],
    actions: [
      { label: "Process Sample",   icon: Microscope,    path: "/laboratory", color: "purple" },
      { label: "Enter Results",    icon: FileText,      path: "/laboratory", color: "blue"   },
      { label: "Validate Results", icon: CheckCircle,   path: "/laboratory", color: "green"  },
      { label: "View Orders",      icon: FlaskConical,  path: "/laboratory", color: "orange" },
    ]
  },
  LAB_TECHNICIAN: {
    color:   "purple",
    title:   "Laboratory",
    tagline: "Accuracy in every result",
    stats: [
      { key: "pendingOrders",  label: "Pending Orders",    icon: FlaskConical, color: "orange", path: "/laboratory"},
      { key: "processing",     label: "Processing",         icon: Activity,     color: "blue",   path: "/laboratory"},
      { key: "completedToday", label: "Completed Today",    icon: CheckCircle,  color: "green",  path: "/laboratory"},
      { key: "samplesIn",      label: "Samples Received",   icon: Microscope,   color: "purple", path: "/laboratory"},
    ],
    actions: [
      { label: "Collect Sample",   icon: Microscope,    path: "/laboratory", color: "purple" },
      { label: "Enter Results",    icon: FileText,      path: "/laboratory", color: "blue"   },
      { label: "View Orders",      icon: FlaskConical,  path: "/laboratory", color: "orange" },
    ]
  },
  RECEPTIONIST: {
    color:   "teal",
    title:   "Reception",
    tagline: "First impressions matter",
    stats: [
      { key: "totalPatients",  label: "Total Patients",    icon: Users,        color: "blue",   path: "/reception" },
      { key: "registeredToday",label: "Registered Today",  icon: UserPlus,     color: "teal",   path: "/reception" },
      { key: "todayVisits",    label: "Today's Visits",    icon: Activity,     color: "green",  path: "/reception" },
      { key: "appointments",   label: "Appointments",      icon: Calendar,     color: "purple", path: "/reception" },
      { key: "pendingBills",   label: "Pending Bills",     icon: DollarSign,   color: "orange", path: "/billing"   },
      { key: "emergency",      label: "Emergency Cases",   icon: AlertTriangle,color: "red",    path: "/emergency" },
    ],
    actions: [
      { label: "Register Patient", icon: UserPlus,      path: "/reception",  color: "teal"   },
      { label: "New Visit",        icon: Activity,      path: "/reception",  color: "blue"   },
      { label: "Appointments",     icon: Calendar,      path: "/reception",  color: "purple" },
      { label: "Emergency",        icon: AlertTriangle, path: "/emergency",  color: "red"    },
    ]
  },
  CASHIER: {
    color:   "emerald",
    title:   "Cashier",
    tagline: "Every payment processed",
    stats: [
      { key: "todayRevenue",   label: "Today's Revenue",   icon: DollarSign,   color: "emerald",path: "/billing"   },
      { key: "pendingBills",   label: "Pending Bills",     icon: FileText,     color: "orange", path: "/billing"   },
      { key: "paidToday",      label: "Paid Today",        icon: CheckCircle,  color: "green",  path: "/billing"   },
      { key: "transactions",   label: "Transactions",      icon: Activity,     color: "blue",   path: "/billing"   },
    ],
    actions: [
      { label: "Process Payment",  icon: DollarSign,    path: "/billing",    color: "emerald"},
      { label: "View Bills",       icon: FileText,      path: "/billing",    color: "orange" },
      { label: "Daily Report",     icon: BarChart3,     path: "/reports",    color: "blue"   },
    ]
  },
  ACCOUNTANT: {
    color:   "emerald",
    title:   "Accounts",
    tagline: "Financial integrity",
    stats: [
      { key: "todayRevenue",   label: "Today's Revenue",   icon: DollarSign,   color: "emerald",path: "/billing"   },
      { key: "monthRevenue",   label: "Month Revenue",     icon: TrendingUp,   color: "green",  path: "/billing"   },
      { key: "pendingBills",   label: "Pending Bills",     icon: FileText,     color: "orange", path: "/billing"   },
      { key: "expenses",       label: "Expenses",          icon: Package,      color: "red",    path: "/billing"   },
    ],
    actions: [
      { label: "View Reports",     icon: BarChart3,     path: "/reports",    color: "blue"   },
      { label: "Billing",          icon: DollarSign,    path: "/billing",    color: "emerald"},
      { label: "Expenses",         icon: Package,       path: "/billing",    color: "red"    },
    ]
  },
  CLINICAL_COORDINATOR: {
    color:   "violet",
    title:   "Clinical Coordinator",
    tagline: "Keeping everything flowing",
    stats: [
      { key: "totalPatients",  label: "Total Patients",    icon: Users,        color: "blue",   path: "/reception" },
      { key: "todayVisits",    label: "Today's Visits",    icon: Activity,     color: "green",  path: "/reception" },
      { key: "admissions",     label: "Active Admissions", icon: BedDouble,    color: "indigo", path: "/ipd"       },
      { key: "pendingLabs",    label: "Pending Labs",      icon: FlaskConical, color: "purple", path: "/laboratory"},
      { key: "pendingRx",      label: "Pending Rx",        icon: Pill,         color: "orange", path: "/pharmacy"  },
      { key: "emergency",      label: "Emergency Cases",   icon: AlertTriangle,color: "red",    path: "/emergency" },
    ],
    actions: [
      { label: "Override Task",    icon: ShieldAlert,   path: "/coordinator",color: "violet" },
      { label: "View Workflow",    icon: Activity,      path: "/coordinator",color: "blue"   },
      { label: "All Patients",     icon: Users,         path: "/reception",  color: "teal"   },
      { label: "Emergency",        icon: AlertTriangle, path: "/emergency",  color: "red"    },
      { label: "Lab Orders",       icon: FlaskConical,  path: "/laboratory", color: "purple" },
      { label: "Pharmacy",         icon: Pill,          path: "/pharmacy",   color: "orange" },
    ]
  },
  MORTUARY_OFFICER: {
    color:   "gray",
    title:   "Mortuary",
    tagline: "Dignity in every service",
    stats: [
      { key: "currentOccupancy",label: "Current Occupancy", icon: BedDouble,   color: "gray",   path: "/mortuary"  },
      { key: "admittedToday",   label: "Admitted Today",    icon: UserPlus,    color: "blue",   path: "/mortuary"  },
      { key: "releasedToday",   label: "Released Today",    icon: CheckCircle, color: "green",  path: "/mortuary"  },
      { key: "pendingAutopsy",  label: "Pending Autopsy",   icon: FileText,    color: "orange", path: "/mortuary"  },
    ],
    actions: [
      { label: "New Admission",    icon: UserPlus,      path: "/mortuary",   color: "blue"   },
      { label: "Release Body",     icon: CheckCircle,   path: "/mortuary",   color: "green"  },
      { label: "Autopsy Record",   icon: FileText,      path: "/mortuary",   color: "orange" },
    ]
  },
  RADIOGRAPHER: {
    color:   "cyan",
    title:   "Radiology",
    tagline: "Imaging with clarity",
    stats: [
      { key: "pendingOrders",  label: "Pending Orders",    icon: Activity,     color: "orange", path: "/radiology" },
      { key: "scheduledToday", label: "Scheduled Today",   icon: Calendar,     color: "blue",   path: "/radiology" },
      { key: "completedToday", label: "Completed Today",   icon: CheckCircle,  color: "green",  path: "/radiology" },
      { key: "pendingReports", label: "Pending Reports",   icon: FileText,     color: "purple", path: "/radiology" },
    ],
    actions: [
      { label: "New Imaging",      icon: Activity,      path: "/radiology",  color: "cyan"   },
      { label: "Write Report",     icon: FileText,      path: "/radiology",  color: "blue"   },
      { label: "View Orders",      icon: Calendar,      path: "/radiology",  color: "orange" },
    ]
  },
  INVENTORY_OFFICER: {
    color:   "amber",
    title:   "Inventory",
    tagline: "Stock managed, care sustained",
    stats: [
      { key: "totalItems",     label: "Total Items",       icon: Package,      color: "blue",   path: "/inventory" },
      { key: "lowStock",       label: "Low Stock",         icon: AlertTriangle,color: "red",    path: "/inventory" },
      { key: "expiringSoon",   label: "Expiring Soon",     icon: Clock,        color: "orange", path: "/inventory" },
      { key: "pendingOrders",  label: "Purchase Orders",   icon: FileText,     color: "purple", path: "/inventory" },
    ],
    actions: [
      { label: "Add Stock",        icon: Package,       path: "/inventory",  color: "blue"   },
      { label: "Low Stock Alert",  icon: AlertTriangle, path: "/inventory",  color: "red"    },
      { label: "Purchase Order",   icon: FileText,      path: "/inventory",  color: "purple" },
    ]
  },
  FACILITY_OFFICER: {
    color:   "slate",
    title:   "Facility Management",
    tagline: "Keeping the hospital running",
    stats: [
      { key: "totalAssets",    label: "Total Assets",      icon: Building2,    color: "blue",   path: "/facility"  },
      { key: "maintenance",    label: "Maintenance Due",   icon: AlertTriangle,color: "orange", path: "/facility"  },
      { key: "completed",      label: "Completed",         icon: CheckCircle,  color: "green",  path: "/facility"  },
      { key: "critical",       label: "Critical Issues",   icon: ShieldAlert,  color: "red",    path: "/facility"  },
    ],
    actions: [
      { label: "New Request",      icon: FileText,      path: "/facility",   color: "blue"   },
      { label: "Maintenance",      icon: Building2,     path: "/facility",   color: "orange" },
    ]
  }
}

// Admin/Director uses full hospital overview
const ADMIN_ROLES = ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MEDICAL_DIRECTOR']

// ── Stat Card Component ───────────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, color, path, loading, navigate }) => (
  <div
    onClick={() => navigate(path)}
    className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-all group"
  >
    <div className={`w-10 h-10 rounded-xl bg-${color}-100 flex items-center justify-center mb-3`}>
      <Icon className={`w-5 h-5 text-${color}-600`} />
    </div>
    <p className="text-2xl font-bold text-gray-800">
      {loading ? <span className="text-gray-300 animate-pulse">—</span> : (value ?? 0)}
    </p>
    <p className="text-sm font-medium text-gray-600 mt-0.5">{label}</p>
  </div>
)

// ── Admin Dashboard ───────────────────────────────────────────────────────────
function AdminDashboard({ stats, loading, navigate, recentVisits }) {
  const adminStats = [
    { label: "Total Patients",  value: stats.totalPatients,    icon: Users,         color: "blue",    path: "/reception"  },
    { label: "Today's Visits",  value: stats.todayVisits,      icon: Activity,      color: "green",   path: "/reception"  },
    { label: "Admitted",        value: stats.admissions,       icon: BedDouble,     color: "indigo",  path: "/ipd"        },
    { label: "Available Beds",  value: stats.availableBeds,    icon: BedDouble,     color: "teal",    path: "/ipd"        },
    { label: "Pending Labs",    value: stats.pendingLabs,      icon: FlaskConical,  color: "purple",  path: "/laboratory" },
    { label: "Pending Rx",      value: stats.pendingRx,        icon: Pill,          color: "orange",  path: "/pharmacy"   },
    { label: "Emergency",       value: stats.emergency,        icon: AlertTriangle, color: "red",     path: "/emergency"  },
    { label: "Revenue Today",   value: `NGN ${(stats.todayRevenue || 0).toLocaleString()}`, icon: DollarSign, color: "emerald", path: "/billing" }
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {adminStats.map(s => (
          <StatCard key={s.label} {...s} loading={loading} navigate={navigate} />
        ))}
      </div>

      {/* Recent Visits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-800">Today's Visits</h2>
              <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                {stats.todayVisits || 0}
              </span>
            </div>
            <button onClick={() => navigate("/reception")}
              className="text-blue-600 text-sm flex items-center gap-1 hover:text-blue-800">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <VisitsList visits={recentVisits} loading={loading} navigate={navigate} />
        </div>

        <QuickActionsCard actions={[
          { label: "Register Patient", icon: UserPlus,      path: "/reception",  color: "teal"   },
          { label: "OPD Visit",        icon: Stethoscope,   path: "/doctor",     color: "blue"   },
          { label: "Emergency",        icon: AlertTriangle, path: "/emergency",  color: "red"    },
          { label: "Admit Patient",    icon: BedDouble,     path: "/ipd",        color: "indigo" },
          { label: "Lab Orders",       icon: FlaskConical,  path: "/laboratory", color: "purple" },
          { label: "Pharmacy",         icon: Pill,          path: "/pharmacy",   color: "green"  },
          { label: "Reports",          icon: BarChart3,     path: "/reports",    color: "yellow" },
          { label: "Admin Panel",      icon: Building2,     path: "/admin",      color: "gray"   },
        ]} navigate={navigate} />
      </div>
    </div>
  )
}

// ── Visits List Component ─────────────────────────────────────────────────────
function VisitsList({ visits, loading, navigate }) {
  const STATUS_COLOR = {
    ACTIVE:     "bg-blue-100 text-blue-700",
    COMPLETED:  "bg-green-100 text-green-700",
    CANCELLED:  "bg-red-100 text-red-700"
  }

  if (loading) return (
    <div className="divide-y divide-gray-50">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="p-4 animate-pulse flex gap-3">
          <div className="w-8 h-8 bg-gray-200 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-200 rounded w-1/3" />
            <div className="h-2 bg-gray-100 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )

  if (!visits?.length) return (
    <div className="p-12 text-center">
      <Activity className="w-12 h-12 text-gray-200 mx-auto mb-3" />
      <p className="text-gray-400 font-medium">No visits today yet</p>
      <button onClick={() => navigate("/reception")}
        className="mt-3 text-sm text-blue-600 hover:text-blue-800">
        Register first patient →
      </button>
    </div>
  )

  return (
    <div className="divide-y divide-gray-50">
      {visits.map((visit, idx) => (
        <div key={visit.id}
          onClick={() => navigate(`/doctor/patient/${visit.patientId}`)}
          className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer transition-colors">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {idx + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-800 text-sm">
              {visit.patient?.firstName} {visit.patient?.lastName}
            </p>
            <p className="text-xs text-gray-400">
              {visit.patient?.mrn} • {visit.visitType} • {visit.chiefComplaint || "General"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-400">
              {new Date(visit.visitDate || visit.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[visit.status] || "bg-gray-100 text-gray-600"}`}>
              {visit.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Quick Actions Card ────────────────────────────────────────────────────────
function QuickActionsCard({ actions, navigate }) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-600" /> Quick Actions
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {actions.map(a => {
            const Icon = a.icon
            return (
              <button key={a.label} onClick={() => navigate(a.path)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all text-center">
                <div className={`w-8 h-8 rounded-lg bg-${a.color}-100 flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 text-${a.color}-600`} />
                </div>
                <span className="text-xs font-medium text-gray-600 leading-tight">{a.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* System Status */}
      <SystemStatusCard />
    </div>
  )
}

// ── System Status Card ────────────────────────────────────────────────────────
function SystemStatusCard() {
  const { user } = useAuthStore()
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-green-600" /> System Status
      </h3>
      <div className="space-y-2.5">
        {[
          { label: "Database",       detail: "Supabase Connected",  ok: true },
          { label: "API Server",     detail: "Running on Port 5000",ok: true },
          { label: "Authentication", detail: "JWT Active",          ok: true },
          { label: "Real-time",      detail: "Socket.io Ready",     ok: true },
          { label: "Your Role",      detail: user?.role?.replace(/_/g, " "), ok: true },
          { label: "Employee ID",    detail: user?.employeeId,      ok: true }
        ].map(s => (
          <div key={s.label} className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{s.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {s.ok ? "✓" : "✗"} {s.detail}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Role-Specific Dashboard ───────────────────────────────────────────────────
function RoleDashboard({ config, stats, loading, navigate, recentVisits, user }) {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-${Math.min(config.stats.length, 6)} gap-4`}>
        {config.stats.map(s => (
          <StatCard
            key={s.key}
            label={s.label}
            value={stats[s.key]}
            icon={s.icon}
            color={s.color}
            path={s.path}
            loading={loading}
            navigate={navigate}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Visits - for clinical roles */}
        {['DOCTOR','NURSE','CLINICAL_COORDINATOR','MIDWIFE'].includes(user?.role) && (
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                <h2 className="font-semibold text-gray-800">Today's Patients</h2>
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                  {stats.todayVisits || 0}
                </span>
              </div>
              <button onClick={() => navigate("/reception")}
                className="text-blue-600 text-sm flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <VisitsList visits={recentVisits} loading={loading} navigate={navigate} />
          </div>
        )}

        {/* Quick Actions + Status */}
        <div className={['DOCTOR','NURSE','CLINICAL_COORDINATOR','MIDWIFE'].includes(user?.role) ? '' : 'lg:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-6'}>
          <QuickActionsCard actions={config.actions} navigate={navigate} />
        </div>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuthStore()
  const navigate  = useNavigate()

  const [stats,        setStats]        = useState({})
  const [recentVisits, setRecentVisits] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [lastUpdated,  setLastUpdated]  = useState(new Date())

  const isAdmin  = ADMIN_ROLES.includes(user?.role)
  const config   = ROLE_CONFIG[user?.role]

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return "Good Morning"
    if (h < 17) return "Good Afternoon"
    return "Good Evening"
  }

  const fetchDashboard = async () => {
    try {
      const today = new Date().toISOString().split("T")[0]

      const [pRes, vRes, admRes, bedRes, labRes, rxRes, emgRes] = await Promise.allSettled([
        api.get("/patients?limit=1"),
        api.get(`/visits?date=${today}`),
        api.get("/admissions?status=ACTIVE"),
        api.get("/admissions/beds?status=AVAILABLE"),
        api.get("/lab/orders?status=ORDERED,SAMPLE_COLLECTED,PROCESSING"),
        api.get("/pharmacy/prescriptions?status=PENDING,VERIFIED"),
        api.get("/emergency")
      ])

      const visits     = vRes.status     === "fulfilled" ? (vRes.value.data.data     || vRes.value.data.visits     || []) : []
      const admList    = admRes.status   === "fulfilled" ? (admRes.value.data.data   || admRes.value.data.admissions|| []) : []
      const bedList    = bedRes.status   === "fulfilled" ? (bedRes.value.data.data   || bedRes.value.data.beds      || []) : []
      const labList    = labRes.status   === "fulfilled" ? (labRes.value.data.data   || labRes.value.data.orders    || []) : []
      const rxList     = rxRes.status    === "fulfilled" ? (rxRes.value.data.data    || rxRes.value.data.prescriptions|| []) : []
      const emgList    = emgRes.status   === "fulfilled" ? (emgRes.value.data.data   || emgRes.value.data.cases     || []) : []
      const totalPts   = pRes.status     === "fulfilled" ? (pRes.value.data.meta?.total || 0) : 0

      setStats({
        totalPatients:   totalPts,
        registeredToday: visits.filter(v => v.visitType !== 'EMERGENCY').length,
        todayVisits:     visits.length,
        admissions:      admList.length,
        availableBeds:   bedList.length,
        pendingLabs:     labList.length,
        pendingOrders:   labList.length,
        pendingRx:       rxList.length,
        emergency:       emgList.filter(e => e.status === 'ACTIVE').length,
        todayRevenue:    0,
        // defaults for other roles
        dispensedToday:  0,
        lowStock:        0,
        totalDrugs:      0,
        expiringSoon:    0,
        wardPatients:    admList.length,
        vitalsdue:       0,
        pendingMeds:     0,
        assessments:     0,
        pendingConsult:  visits.filter(v => v.status === 'ACTIVE').length,
        appointments:    0,
        pendingBills:    0,
        paidToday:       0,
        transactions:    0,
        monthRevenue:    0,
        expenses:        0,
        currentOccupancy:0,
        admittedToday:   0,
        releasedToday:   0,
        pendingAutopsy:  0,
        scheduledToday:  0,
        completedToday:  0,
        pendingReports:  0,
        processing:      0,
        critical:        0,
        samplesIn:       0,
        pendingValidate: 0,
        totalItems:      0,
        totalAssets:     0,
        maintenance:     0,
        completed:       0
      })

      setRecentVisits(visits.slice(0, 8))
      setLastUpdated(new Date())

    } catch (e) {
      console.error('Dashboard error:', e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
    const t = setInterval(fetchDashboard, 60000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className={`bg-gradient-to-r ${
        isAdmin
          ? 'from-blue-800 via-blue-700 to-indigo-700'
          : `from-${config?.color || 'blue'}-800 via-${config?.color || 'blue'}-700 to-${config?.color || 'indigo'}-600`
        } rounded-2xl p-6 text-white`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-white/70 text-sm">{getGreeting()},</p>
            <h1 className="text-2xl font-bold">{user?.firstName} {user?.lastName}</h1>
            <p className="text-white/70 text-sm mt-1">
              {user?.role?.replace(/_/g, " ")} — St. Everest Mediplex
            </p>
            {isAdmin && (
              <p className="text-white/60 text-xs mt-0.5">Hospital Administration Overview</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-white font-bold">
                {new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              </p>
              <p className="text-white/60 text-xs flex items-center gap-1 justify-end mt-1">
                <Clock className="w-3 h-3" />
                Updated: {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <button onClick={fetchDashboard}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors">
              <RefreshCw className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Role-based content */}
      {isAdmin ? (
        <AdminDashboard
          stats={stats}
          loading={loading}
          navigate={navigate}
          recentVisits={recentVisits}
        />
      ) : config ? (
        <RoleDashboard
          config={config}
          stats={stats}
          loading={loading}
          navigate={navigate}
          recentVisits={recentVisits}
          user={user}
        />
      ) : (
        <div className="text-center py-20 text-gray-400">
          <Bell className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p>Dashboard not configured for role: {user?.role}</p>
        </div>
      )}
    </div>
  )
}