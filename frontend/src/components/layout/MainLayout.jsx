// frontend/src/components/layout/MainLayout.jsx
// ─── ONLY CHANGES FROM YOUR VERSION ───────────────────────────────────────
// 1. Added import for NotificationBell
// 2. Replaced placeholder <button> bell with <NotificationBell />
// Everything else is IDENTICAL to what you provided
// ──────────────────────────────────────────────────────────────────────────

import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  LayoutDashboard, Users, Stethoscope, Activity,
  FlaskConical, Pill, Heart, Bed, Baby, Building2,
  Scissors, Radio, Package, Wrench, FileText,
  DollarSign, Settings, LogOut, ChevronLeft,
  ChevronRight, Bell, User, Menu, X,
  ClipboardList, AlertTriangle, UserCheck,
  Shield, BarChart2, Zap
} from "lucide-react"
import useAuthStore from "../../store/authStore"
import toast from "react-hot-toast"
import api from "../../services/api"
import NotificationBell from "./NotificationBell"   // ← NEW IMPORT



// ─── Nav item definition ──────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: [],
  },
  {
    group: "Outpatient",
    items: [
      {
        id: "opd",
        label: "OPD Queue",
        href: "/opd",
        icon: Users,
        roles: [
          "RECEPTIONIST","NURSE","MIDWIFE","DOCTOR","SURGEON",
          "CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN",
          "MEDICAL_DIRECTOR","MEDICAL_RECORDS_OFFICER",
        ],
        badge: "Live",
        badgeColor: "bg-emerald-500",
      },
      {
        id: "reception",
        label: "Reception",
        href: "/reception",
        icon: UserCheck,
        roles: [
          "RECEPTIONIST","NURSE","CLINICAL_COORDINATOR",
          "SUPER_ADMIN","HOSPITAL_ADMIN","MEDICAL_RECORDS_OFFICER",
        ],
      },
      {
        id: "emergency",
        label: "Emergency",
        href: "/emergency",
        icon: AlertTriangle,
        roles: [
          "DOCTOR","SURGEON","NURSE","MIDWIFE","THEATRE_NURSE",
          "MEDICAL_DIRECTOR","CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN",
        ],
        badgeColor: "bg-red-500",
      },
    ],
  },
  {
    group: "Clinical",
    items: [
      {
        id: "doctor",
        label: "Doctor",
        href: "/doctor",
        icon: Stethoscope,
        roles: [
          "DOCTOR","SURGEON","MEDICAL_DIRECTOR",
          "CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN",
        ],
      },
      {
        id: "nursing",
        label: "Nursing",
        href: "/nursing",
        icon: Heart,
        roles: [
          "NURSE","MIDWIFE","THEATRE_NURSE",
          "CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN","MEDICAL_DIRECTOR",
        ],
      },
      {
        id: "ipd",
        label: "IPD / Wards",
        href: "/ipd",
        icon: Bed,
        roles: [
          "DOCTOR","SURGEON","NURSE","MIDWIFE","THEATRE_NURSE",
          "MEDICAL_DIRECTOR","CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN",
        ],
      },
    ],
  },
  {
    group: "Specialised",
    items: [
      {
        id: "maternity",
        label: "Maternity",
        href: "/maternity",
        icon: Baby,
        roles: [
          "NURSE","DOCTOR","MIDWIFE",
          "CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN",
        ],
      },
      {
        id: "surgery",
        label: "Surgery",
        href: "/surgery",
        icon: Scissors,
        roles: [
          "SURGEON","DOCTOR","THEATRE_NURSE",
          "CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN",
        ],
      },
      {
        id: "mortuary",
        label: "Mortuary",
        href: "/mortuary",
        icon: Building2,
        roles: [
          "MORTUARY_OFFICER","DOCTOR","NURSE",
          "CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN",
        ],
      },
    ],
  },
  {
    group: "Diagnostics",
    items: [
      {
        id: "laboratory",
        label: "Laboratory",
        href: "/laboratory",
        icon: FlaskConical,
        roles: [
          "LAB_TECHNICIAN","LAB_SCIENTIST",
          "CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN",
        ],
      },
      {
        id: "radiology",
        label: "Radiology",
        href: "/radiology",
        icon: Radio,
        roles: [
          "RADIOGRAPHER",
          "CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN",
        ],
      },
      {
        id: "pharmacy",
        label: "Pharmacy",
        href: "/pharmacy",
        icon: Pill,
        roles: [
          "PHARMACIST",
          "CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN",
        ],
      },
    ],
  },
  {
    group: "Administration",
    items: [
      {
        id: "billing",
        label: "Billing",
        href: "/billing",
        icon: DollarSign,
        roles: [
          "ACCOUNTANT","CASHIER","RECEPTIONIST",
          "CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN",
        ],
      },
      {
        id: "inventory",
        label: "Inventory",
        href: "/inventory",
        icon: Package,
        roles: [
          "INVENTORY_OFFICER","FACILITY_OFFICER",
          "CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN",
        ],
      },
      {
        id: "facility",
        label: "Facility",
        href: "/facility",
        icon: Wrench,
        roles: [
          "FACILITY_OFFICER","INVENTORY_OFFICER",
          "SUPER_ADMIN","HOSPITAL_ADMIN",
        ],
      },
      {
        id: "reports",
        label: "Reports",
        href: "/reports",
        icon: BarChart2,
        roles: [
          "ACCOUNTANT","CLINICAL_COORDINATOR","LAB_SCIENTIST",
          "MEDICAL_DIRECTOR","SUPER_ADMIN","HOSPITAL_ADMIN",
        ],
      },

      
      {
        id: "coordinator",
        label: "Coordinator",
        href: "/coordinator",
        icon: ClipboardList,
        roles: [
          "CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN","MEDICAL_DIRECTOR",
        ],
      },
      {
        id: "admin",
        label: "Admin Panel",
        href: "/admin",
        icon: Shield,
        roles: ["SUPER_ADMIN","HOSPITAL_ADMIN","MEDICAL_DIRECTOR"],
      },
    ],
  },
]

// ─── Role colour map ──────────────────────────────────────────────────────
const ROLE_COLORS = {
  SUPER_ADMIN:             { bg: "from-blue-600 to-blue-800",      accent: "blue"    },
  HOSPITAL_ADMIN:          { bg: "from-blue-600 to-blue-800",      accent: "blue"    },
  MEDICAL_DIRECTOR:        { bg: "from-indigo-600 to-indigo-800",  accent: "indigo"  },
  CLINICAL_COORDINATOR:    { bg: "from-violet-600 to-violet-800",  accent: "violet"  },
  DOCTOR:                  { bg: "from-blue-600 to-blue-800",      accent: "blue"    },
  SURGEON:                 { bg: "from-blue-600 to-blue-800",      accent: "blue"    },
  NURSE:                   { bg: "from-pink-600 to-pink-800",      accent: "pink"    },
  MIDWIFE:                 { bg: "from-pink-600 to-pink-800",      accent: "pink"    },
  THEATRE_NURSE:           { bg: "from-pink-600 to-pink-800",      accent: "pink"    },
  LAB_SCIENTIST:           { bg: "from-purple-600 to-purple-800",  accent: "purple"  },
  LAB_TECHNICIAN:          { bg: "from-purple-600 to-purple-800",  accent: "purple"  },
  PHARMACIST:              { bg: "from-green-600 to-green-800",    accent: "green"   },
  RADIOGRAPHER:            { bg: "from-cyan-600 to-cyan-800",      accent: "cyan"    },
  RECEPTIONIST:            { bg: "from-teal-600 to-teal-800",      accent: "teal"    },
  MEDICAL_RECORDS_OFFICER: { bg: "from-teal-600 to-teal-800",      accent: "teal"    },
  CASHIER:                 { bg: "from-amber-600 to-amber-800",    accent: "amber"   },
  ACCOUNTANT:              { bg: "from-amber-600 to-amber-800",    accent: "amber"   },
  INVENTORY_OFFICER:       { bg: "from-orange-600 to-orange-800",  accent: "orange"  },
  FACILITY_OFFICER:        { bg: "from-emerald-600 to-emerald-800",accent: "emerald" },
  MORTUARY_OFFICER:        { bg: "from-gray-600 to-gray-800",      accent: "gray"    },
}

const getRoleColor = (role) =>
  ROLE_COLORS[role] || { bg: "from-blue-600 to-blue-800", accent: "blue" }

// ─── Filter nav items for a role ─────────────────────────────────────────
const getNavForRole = (role) => {
  const result = []
  for (const section of NAV_ITEMS) {
    if (section.group) {
      const visibleItems = section.items.filter(item =>
        !item.roles || item.roles.length === 0 || item.roles.includes(role)
      )
      if (visibleItems.length > 0) result.push({ ...section, items: visibleItems })
    } else {
      if (!section.roles || section.roles.length === 0 || section.roles.includes(role)) {
        result.push(section)
      }
    }
  }
  return result
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN LAYOUT
// ════════════════════════════════════════════════════════════════════════════
export default function MainLayout({ children }) {
  const location             = useLocation()
  const navigate             = useNavigate()
  const { user, logout }     = useAuthStore()
  const [collapsed, setCol]  = useState(false)
  const [mobileOpen, setMob] = useState(false)

  const roleColor = getRoleColor(user?.role)
  const navItems  = getNavForRole(user?.role)

  const handleLogout = async () => {
    try { await api.post("/auth/logout") } catch { /* ignore */ }
    logout()
    navigate("/login")
    toast.success("Logged out successfully")
  }

  const isActive = (href) =>
    href === "/dashboard"
      ? location.pathname === "/dashboard"
      : location.pathname.startsWith(href)

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`bg-gradient-to-br ${roleColor.bg} px-4 py-5`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-tight truncate">St. Everest</p>
              <p className="text-white/70 text-xs truncate">Mediplex</p>
            </div>
          )}
        </div>
      </div>

      {/* User strip */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${roleColor.bg} flex items-center justify-center shrink-0`}>
              <span className="text-white font-bold text-xs">{user?.name?.charAt(0) || "U"}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-900 truncate">{user?.name}</p>
              <p className="text-[10px] text-gray-400 truncate">{user?.role?.replace(/_/g, " ")}</p>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map((section, si) => {
          if (section.group) {
            return (
              <div key={section.group} className={si > 0 ? "mt-4" : ""}>
                {!collapsed && (
                  <p className="px-3 pb-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {section.group}
                  </p>
                )}
                {section.items.map(item => {
                  const Icon   = item.icon
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.id}
                      to={item.href}
                      onClick={() => setMob(false)}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative ${
                        active
                          ? `bg-gradient-to-r ${roleColor.bg} text-white shadow-sm`
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${active ? "text-white" : "text-gray-400 group-hover:text-gray-600"}`} />
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full text-white font-bold ${item.badgeColor || "bg-blue-500"}`}>
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                      {collapsed && active && (
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </Link>
                  )
                })}
              </div>
            )
          } else {
            const Icon   = section.icon
            const active = isActive(section.href)
            return (
              <Link
                key={section.id}
                to={section.href}
                onClick={() => setMob(false)}
                title={collapsed ? section.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative ${
                  active
                    ? `bg-gradient-to-r ${roleColor.bg} text-white shadow-sm`
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? "text-white" : "text-gray-400 group-hover:text-gray-600"}`} />
                {!collapsed && <span className="flex-1 truncate">{section.label}</span>}
                {collapsed && active && (
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </Link>
            )
          }
        })}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-gray-100 space-y-1">
        <button
          onClick={() => setCol(c => !c)}
          className="hidden lg:flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" />
            : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>
          }
        </button>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 hover:text-red-600 transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col bg-white border-r border-gray-100 shadow-sm transition-all duration-300 ${
        collapsed ? "w-16" : "w-60"
      }`}>
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setMob(false)} />
          <div className="w-64 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-end p-4 border-b border-gray-100">
              <button onClick={() => setMob(false)} className="p-2 rounded-xl hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarContent />
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Topbar ── */}
        <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMob(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-gray-100"
            >
              <Menu className="w-5 h-5 text-gray-500" />
            </button>

            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
              <span className="font-semibold text-gray-800">
                {(() => {
                  for (const section of NAV_ITEMS) {
                    if (section.group) {
                      const found = section.items.find(i => isActive(i.href))
                      if (found) return found.label
                    } else {
                      if (isActive(section.href)) return section.label
                    }
                  }
                  return "Dashboard"
                })()}
              </span>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">

            {/* ↓↓↓ REPLACED placeholder bell with real NotificationBell ↓↓↓ */}
            <NotificationBell />
            {/* ↑↑↑ That's the only functional change in this file ↑↑↑ */}

            {/* User chip */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100">
              <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${roleColor.bg} flex items-center justify-center`}>
                <span className="text-white font-bold text-[10px]">{user?.name?.charAt(0) || "U"}</span>
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-gray-800 leading-tight">{user?.name?.split(" ")[0]}</p>
                <p className="text-[10px] text-gray-400 leading-tight">{user?.role?.replace(/_/g, " ")}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}