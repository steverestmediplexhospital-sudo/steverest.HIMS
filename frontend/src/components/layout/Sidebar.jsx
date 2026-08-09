// frontend/src/components/layout/Sidebar.jsx
import { NavLink, useLocation } from "react-router-dom"
import useAuthStore from "../../store/authStore"
import {
  LayoutDashboard, Users, Heart, Stethoscope,
  AlertTriangle, BedDouble, FlaskConical, Pill,
  Radio, Scissors, Baby, Skull, CreditCard,
  Package, Wrench, BarChart3, Settings,
  ChevronLeft, ChevronRight, ShieldCheck,
  CalendarDays
} from "lucide-react"

const MENU = [
  { label: "Dashboard",        icon: LayoutDashboard, path: "/dashboard",     roles: ["ALL"] },
  { label: "Reception",        icon: Users,           path: "/reception",     roles: ["RECEPTIONIST","NURSE","CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN","MEDICAL_RECORDS_OFFICER"] },
  { label: "OPD Queue",        icon: Users,           path: "/opd",           roles: ["RECEPTIONIST","NURSE","MIDWIFE","DOCTOR","SURGEON","CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN","MEDICAL_DIRECTOR","MEDICAL_RECORDS_OFFICER"] },
  { label: "Appointments",     icon: CalendarDays,    path: "/appointments",  roles: ["RECEPTIONIST","NURSE","MIDWIFE","DOCTOR","SURGEON","CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN","MEDICAL_DIRECTOR","MEDICAL_RECORDS_OFFICER"] },
  { label: "Nursing",          icon: Heart,           path: "/nursing",       roles: ["NURSE","MIDWIFE","THEATRE_NURSE","CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN"] },
  { label: "Doctor / OPD",     icon: Stethoscope,     path: "/doctor",        roles: ["DOCTOR","SURGEON","MEDICAL_DIRECTOR","CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN"] },
  { label: "Emergency",        icon: AlertTriangle,   path: "/emergency",     roles: ["NURSE","DOCTOR","MIDWIFE","CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN"] },
  { label: "IPD / Admissions", icon: BedDouble,       path: "/ipd",           roles: ["NURSE","DOCTOR","MIDWIFE","RECEPTIONIST","CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN"] },
  { label: "Laboratory",       icon: FlaskConical,    path: "/laboratory",    roles: ["LAB_TECHNICIAN","LAB_SCIENTIST","CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN"] },
  { label: "Pharmacy",         icon: Pill,            path: "/pharmacy",      roles: ["PHARMACIST","CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN"] },
  { label: "Radiology",        icon: Radio,           path: "/radiology",     roles: ["RADIOGRAPHER","CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN"] },
  { label: "Surgery",          icon: Scissors,        path: "/surgery",       roles: ["SURGEON","DOCTOR","THEATRE_NURSE","CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN"] },
  { label: "Maternity",        icon: Baby,            path: "/maternity",     roles: ["NURSE","DOCTOR","MIDWIFE","CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN"] },
  { label: "Mortuary",         icon: Skull,           path: "/mortuary",      roles: ["MORTUARY_OFFICER","DOCTOR","NURSE","CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN"] },
  { label: "Billing",          icon: CreditCard,      path: "/billing",       roles: ["ACCOUNTANT","CASHIER","RECEPTIONIST","CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN"] },
  { label: "Inventory",        icon: Package,         path: "/inventory",     roles: ["INVENTORY_OFFICER","FACILITY_OFFICER","CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN"] },
  { label: "Facility",         icon: Wrench,          path: "/facility",      roles: ["FACILITY_OFFICER","INVENTORY_OFFICER","SUPER_ADMIN","HOSPITAL_ADMIN"] },
  { label: "Coordinator",      icon: ShieldCheck,     path: "/coordinator",   roles: ["CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN","MEDICAL_DIRECTOR"] },
  { label: "Reports",          icon: BarChart3,       path: "/reports",       roles: ["ACCOUNTANT","CLINICAL_COORDINATOR","LAB_SCIENTIST","MEDICAL_DIRECTOR","SUPER_ADMIN","HOSPITAL_ADMIN"] },
  { label: "Admin",            icon: Settings,        path: "/admin",         roles: ["SUPER_ADMIN","HOSPITAL_ADMIN","MEDICAL_DIRECTOR"] },
]

export default function Sidebar({ collapsed, setCollapsed }) {
  const { user } = useAuthStore()
  const location = useLocation()

  const visible = MENU.filter(item =>
    item.roles.includes("ALL") || item.roles.includes(user?.role)
  )

  return (
    <aside className={`fixed top-0 left-0 h-full z-40 bg-gradient-to-b from-blue-900 via-blue-800 to-blue-900 transition-all duration-300 flex flex-col ${collapsed ? "w-16" : "w-64"}`}>
      <div className="flex items-center justify-between p-4 border-b border-blue-700">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="text-blue-800 font-bold text-sm">SE</span>
            </div>
            <div>
              <p className="text-white font-bold text-sm">St. Everest</p>
              <p className="text-blue-300 text-xs">Mediplex HIMS</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center mx-auto">
            <span className="text-blue-800 font-bold text-sm">SE</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-blue-300 hover:text-white p-1 rounded"
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" />
            : <ChevronLeft  className="w-4 h-4" />
          }
        </button>
      </div>

      {!collapsed && (
        <div className="px-4 py-3 border-b border-blue-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
              {user?.name?.charAt(0) || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {user?.name}
              </p>
              <p className="text-blue-300 text-xs truncate">
                {user?.role?.replace(/_/g, " ")}
              </p>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-2">
        {visible.map((item) => {
          const Icon     = item.icon
          const isActive = location.pathname.startsWith(item.path)
          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : ""}
              className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-all group relative ${
                isActive
                  ? "bg-white/20 text-white"
                  : "text-blue-200 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </NavLink>
          )
        })}
      </nav>

      {!collapsed && (
        <div className="p-4 border-t border-blue-700">
          <p className="text-blue-400 text-xs text-center">
            v2.0.0 • St. Everest Mediplex
          </p>
        </div>
      )}
    </aside>
  )
}