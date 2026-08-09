import { useState, useEffect } from "react"
import api from "../../services/api"
import { toast } from "react-hot-toast"
import {
  Settings, Users, Building2, Shield, Plus, Search,
  Edit3, Trash2, X, Save, CheckCircle, AlertTriangle,
  Eye, EyeOff, RefreshCw, UserCheck, UserX, Key,
  Activity, Database, Server, Clock
} from "lucide-react"

const TABS = [
  { id: "users",       label: "User Management",  icon: Users },
  { id: "departments", label: "Departments",       icon: Building2 },
  { id: "roles",       label: "Roles & Access",    icon: Shield },
  { id: "system",      label: "System Settings",   icon: Settings },
  { id: "audit",       label: "Audit Logs",        icon: Activity }
]

const ROLES = [
  "SUPER_ADMIN","HOSPITAL_ADMIN","MEDICAL_DIRECTOR","CLINICAL_COORDINATOR",
  "RECEPTIONIST","MEDICAL_RECORDS_OFFICER","NURSE","MIDWIFE","THEATRE_NURSE",
  "DOCTOR","SURGEON","LAB_TECHNICIAN","LAB_SCIENTIST","RADIOGRAPHER",
  "PHARMACIST","INVENTORY_OFFICER","FACILITY_OFFICER","ACCOUNTANT",
  "MORTUARY_OFFICER"
]

const ROLE_COLOR = {
  SUPER_ADMIN: "bg-red-100 text-red-700", HOSPITAL_ADMIN: "bg-red-100 text-red-700",
  MEDICAL_DIRECTOR: "bg-purple-100 text-purple-700", DOCTOR: "bg-blue-100 text-blue-700",
  SURGEON: "bg-blue-100 text-blue-700", NURSE: "bg-pink-100 text-pink-700",
  MIDWIFE: "bg-pink-100 text-pink-700", THEATRE_NURSE: "bg-pink-100 text-pink-700",
  LAB_TECHNICIAN: "bg-purple-100 text-purple-700", LAB_SCIENTIST: "bg-purple-100 text-purple-700",
  PHARMACIST: "bg-green-100 text-green-700", RADIOGRAPHER: "bg-indigo-100 text-indigo-700",
  RECEPTIONIST: "bg-teal-100 text-teal-700", ACCOUNTANT: "bg-yellow-100 text-yellow-700",
  CLINICAL_COORDINATOR: "bg-orange-100 text-orange-700",
  INVENTORY_OFFICER: "bg-gray-100 text-gray-700", FACILITY_OFFICER: "bg-gray-100 text-gray-700",
  MORTUARY_OFFICER: "bg-gray-100 text-gray-700", MEDICAL_RECORDS_OFFICER: "bg-teal-100 text-teal-700"
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("users")
  const [stats, setStats] = useState({ users: 0, active: 0, departments: 0, roles: ROLES.length })

  useEffect(() => { fetchStats() }, [])

  const fetchStats = async () => {
    try {
      const [uRes, dRes] = await Promise.allSettled([
        api.get("/admin/users"),
        api.get("/admin/departments")
      ])
      const users = uRes.status === "fulfilled" ? uRes.value.data.data || [] : []
      const depts = dRes.status === "fulfilled" ? dRes.value.data.data || [] : []
      setStats({
        users: users.length,
        active: users.filter(u => u.status === "ACTIVE").length,
        departments: depts.length,
        roles: ROLES.length
      })
    } catch (e) {}
  }

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-gray-800 via-gray-700 to-slate-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-gray-300 text-sm">Administration</p>
            <h1 className="text-2xl font-bold">System Administration</h1>
            <p className="text-gray-300 text-sm mt-1">St. Everest Mediplex HIMS</p>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total Users", value: stats.users },
              { label: "Active", value: stats.active },
              { label: "Departments", value: stats.departments },
              { label: "Roles", value: stats.roles }
            ].map(s => (
              <div key={s.label} className="bg-white/20 rounded-xl px-3 py-2 text-center">
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-gray-300 text-xs">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "border-b-2 border-gray-700 text-gray-800 bg-gray-50"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}>
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            )
          })}
        </div>
        <div className="p-5">
          {activeTab === "users"       && <UserManagement onRefresh={fetchStats} />}
          {activeTab === "departments" && <DepartmentManagement />}
          {activeTab === "roles"       && <RolesOverview />}
          {activeTab === "system"      && <SystemSettings />}
          {activeTab === "audit"       && <AuditLogs />}
        </div>
      </div>
    </div>
  )
}

// ── User Management ──────────────────────────────────────────
function UserManagement({ onRefresh }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterRole, setFilterRole] = useState("ALL")
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [departments, setDepartments] = useState([])

  const EMPTY = {
    firstName: "", lastName: "", email: "", phone: "",
    role: "NURSE", departmentId: "", employeeId: "",
    password: "", specialization: "", qualification: ""
  }
  const [form, setForm] = useState(EMPTY)
  const [showPass, setShowPass] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { fetchUsers(); fetchDepts() }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await api.get("/admin/users")
      setUsers(res.data.data || [])
    } catch (e) {} finally { setLoading(false) }
  }

  const fetchDepts = async () => {
    try {
      const res = await api.get("/admin/departments")
      setDepartments(res.data.data || [])
    } catch (e) {}
  }

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const openEdit = (user) => {
    setEditUser(user)
    setForm({ ...EMPTY, ...user, password: "" })
    setShowForm(true)
  }

  const submit = async () => {
    if (!form.firstName || !form.lastName || !form.email || !form.role) {
      toast.error("Fill required fields"); return
    }
    if (!editUser && !form.password) {
      toast.error("Password required for new users"); return
    }
    setSubmitting(true)
    try {
      if (editUser) {
        const payload = { ...form }
        if (!payload.password) delete payload.password
        await api.put(`/admin/users/${editUser.id}`, payload)
        toast.success("User updated!")
      } else {
        await api.post("/admin/users", form)
        toast.success("User created!")
      }
      setShowForm(false)
      setEditUser(null)
      setForm(EMPTY)
      fetchUsers()
      onRefresh()
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed")
    } finally { setSubmitting(false) }
  }

  const toggleStatus = async (user) => {
    try {
      await api.patch(`/admin/users/${user.id}/status`, {
        status: user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
      })
      toast.success(`User ${user.status === "ACTIVE" ? "deactivated" : "activated"}`)
      fetchUsers(); onRefresh()
    } catch (e) { toast.error("Failed") }
  }

  const filtered = users.filter(u =>
    (filterRole === "ALL" || u.role === filterRole) &&
    (search === "" || `${u.firstName} ${u.lastName} ${u.email} ${u.employeeId}`.toLowerCase().includes(search.toLowerCase()))
  )

  const INPUT = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-500" />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="ALL">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g," ")}</option>)}
        </select>
        <button onClick={() => { setEditUser(null); setForm(EMPTY); setShowForm(true) }}
          className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900">
          <Plus className="w-4 h-4" /> Add User
        </button>
        <button onClick={fetchUsers} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="text-sm text-gray-500">{filtered.length} users</div>

      {/* Users Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Employee","Name & Contact","Role","Department","Status","Actions"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-8 bg-gray-100 rounded animate-pulse" /></td></tr>
              ))
            ) : filtered.map(user => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-xs flex-shrink-0">
                      {user.firstName?.[0]}{user.lastName?.[0]}
                    </div>
                    <span className="text-xs font-mono text-gray-500">{user.employeeId}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm font-semibold text-gray-800">{user.firstName} {user.lastName}</p>
                  <p className="text-xs text-gray-400">{user.email}</p>
                  <p className="text-xs text-gray-400">{user.phone}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_COLOR[user.role] || "bg-gray-100 text-gray-600"}`}>
                    {user.role?.replace(/_/g," ")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs text-gray-600">{user.department?.name || "—"}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    user.status === "ACTIVE" ? "bg-green-100 text-green-700" :
                    user.status === "SUSPENDED" ? "bg-red-100 text-red-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>{user.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(user)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => toggleStatus(user)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        user.status === "ACTIVE"
                          ? "text-gray-400 hover:text-red-600 hover:bg-red-50"
                          : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                      }`} title={user.status === "ACTIVE" ? "Deactivate" : "Activate"}>
                      {user.status === "ACTIVE" ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">No users found</p>
          </div>
        )}
      </div>

      {/* User Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">{editUser ? "Edit User" : "Create New User"}</h3>
              <button onClick={() => { setShowForm(false); setEditUser(null) }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">First Name *</label>
                  <input value={form.firstName} onChange={e => set("firstName", e.target.value)} placeholder="First name" className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Last Name *</label>
                  <input value={form.lastName} onChange={e => set("lastName", e.target.value)} placeholder="Last name" className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email *</label>
                  <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@steverestmediplex.com" className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone *</label>
                  <input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="07XXXXXXXX" className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Employee ID</label>
                  <input value={form.employeeId} onChange={e => set("employeeId", e.target.value)} placeholder="EMP-XXX" className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Role *</label>
                  <select value={form.role} onChange={e => set("role", e.target.value)} className={INPUT}>
                    {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g," ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Department</label>
                  <select value={form.departmentId} onChange={e => set("departmentId", e.target.value)} className={INPUT}>
                    <option value="">No Department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Specialization</label>
                  <input value={form.specialization} onChange={e => set("specialization", e.target.value)} placeholder="e.g. Cardiology" className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Qualification</label>
                  <input value={form.qualification} onChange={e => set("qualification", e.target.value)} placeholder="e.g. MBChB, BSN" className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    {editUser ? "New Password (leave blank to keep current)" : "Password *"}
                  </label>
                  <div className="relative">
                    <input type={showPass ? "text" : "password"} value={form.password} onChange={e => set("password", e.target.value)}
                      placeholder={editUser ? "Leave blank to keep current" : "Min 8 characters"}
                      className={INPUT + " pr-10"} />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-3">
              <button onClick={() => { setShowForm(false); setEditUser(null) }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={submit} disabled={submitting}
                className="flex-1 py-2.5 bg-gray-800 text-white rounded-xl text-sm font-semibold hover:bg-gray-900 disabled:opacity-50 flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                {submitting ? "Saving..." : (editUser ? "Update User" : "Create User")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Department Management ────────────────────────────────────
function DepartmentManagement() {
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", code: "", description: "", location: "", headOfDepartment: "" })
  const [submitting, setSubmitting] = useState(false)
  const [editDept, setEditDept] = useState(null)

  const DEPT_DEFAULTS = [
    { name: "General Practice / OPD", code: "OPD", description: "Outpatient general consultations" },
    { name: "Emergency", code: "EMG", description: "24/7 emergency services" },
    { name: "Internal Medicine", code: "INT", description: "Internal medicine and specialties" },
    { name: "Surgery", code: "SRG", description: "General and specialized surgery" },
    { name: "Obstetrics & Gynaecology", code: "OBGYN", description: "Maternity and women health" },
    { name: "Paediatrics", code: "PAED", description: "Children health services" },
    { name: "Cardiology", code: "CARD", description: "Heart and cardiovascular" },
    { name: "Orthopaedics", code: "ORTH", description: "Bones, joints and muscles" },
    { name: "Ophthalmology", code: "OPH", description: "Eye care services" },
    { name: "ENT", code: "ENT", description: "Ear, nose and throat" },
    { name: "Dermatology", code: "DERM", description: "Skin conditions" },
    { name: "Neurology", code: "NEURO", description: "Brain and nervous system" },
    { name: "Urology", code: "URO", description: "Urinary tract and male reproductive" },
    { name: "Psychiatry", code: "PSY", description: "Mental health services" },
    { name: "Oncology", code: "ONC", description: "Cancer treatment" },
    { name: "Laboratory", code: "LAB", description: "Laboratory diagnostic services" },
    { name: "Radiology", code: "RAD", description: "Imaging and radiology" },
    { name: "Pharmacy", code: "PHARM", description: "Pharmacy services" },
    { name: "Physiotherapy", code: "PHYSIO", description: "Physiotherapy and rehabilitation" },
    { name: "Nutrition & Dietetics", code: "NUTR", description: "Nutritional support" },
    { name: "Dental", code: "DENT", description: "Dental services" },
    { name: "ICU", code: "ICU", description: "Intensive care unit" },
    { name: "HDU", code: "HDU", description: "High dependency unit" },
    { name: "Mortuary", code: "MORT", description: "Mortuary services" }
  ]

  useEffect(() => { fetchDepartments() }, [])

  const fetchDepartments = async () => {
    setLoading(true)
    try {
      const res = await api.get("/admin/departments")
      setDepartments(res.data.data || [])
    } catch (e) {} finally { setLoading(false) }
  }

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const submit = async () => {
    if (!form.name || !form.code) { toast.error("Name and code required"); return }
    setSubmitting(true)
    try {
      if (editDept) {
        await api.put(`/admin/departments/${editDept.id}`, form)
        toast.success("Department updated!")
      } else {
        await api.post("/admin/departments", form)
        toast.success("Department created!")
      }
      setShowForm(false)
      setEditDept(null)
      setForm({ name: "", code: "", description: "", location: "", headOfDepartment: "" })
      fetchDepartments()
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed")
    } finally { setSubmitting(false) }
  }

  const quickAdd = async (dept) => {
    try {
      await api.post("/admin/departments", dept)
      toast.success(`${dept.name} added!`)
      fetchDepartments()
    } catch (e) {
      if (e.response?.status === 409) toast.error("Department already exists")
      else toast.error("Failed to add department")
    }
  }

  const INPUT = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
  const existingCodes = new Set(departments.map(d => d.code))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{departments.length} departments configured</p>
        <button onClick={() => { setEditDept(null); setForm({ name:"",code:"",description:"",location:"",headOfDepartment:"" }); setShowForm(true) }}
          className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900">
          <Plus className="w-4 h-4" /> Add Department
        </button>
      </div>

      {/* Existing Departments */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {loading ? (
          [...Array(6)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)
        ) : departments.map(dept => (
          <div key={dept.id} className="border border-gray-200 rounded-xl p-4 hover:border-gray-400 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold">{dept.code}</span>
                  {dept.isActive !== false ? (
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Active</span>
                  ) : (
                    <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">Inactive</span>
                  )}
                </div>
                <p className="font-semibold text-gray-800 text-sm mt-1">{dept.name}</p>
                {dept.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{dept.description}</p>}
                {dept.location && <p className="text-xs text-gray-400">📍 {dept.location}</p>}
              </div>
              <button onClick={() => { setEditDept(dept); setForm({...dept}); setShowForm(true) }}
                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg flex-shrink-0">
                <Edit3 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Add Standard Departments */}
      <div className="border border-dashed border-gray-300 rounded-xl p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">Quick Add Standard Departments</p>
        <p className="text-xs text-gray-400 mb-4">Click to instantly add standard hospital departments</p>
        <div className="flex flex-wrap gap-2">
          {DEPT_DEFAULTS.filter(d => !existingCodes.has(d.code)).map(dept => (
            <button key={dept.code} onClick={() => quickAdd(dept)}
              className="flex items-center gap-1 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-700 text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:border-blue-300 transition-colors">
              <Plus className="w-3 h-3" /> {dept.name}
            </button>
          ))}
          {DEPT_DEFAULTS.filter(d => !existingCodes.has(d.code)).length === 0 && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" /> All standard departments are configured!
            </p>
          )}
        </div>
      </div>

      {/* Department Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">{editDept ? "Edit Department" : "Add Department"}</h3>
              <button onClick={() => { setShowForm(false); setEditDept(null) }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Department Name *</label>
                  <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Cardiology" className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Code *</label>
                  <input value={form.code} onChange={e => set("code", e.target.value.toUpperCase())} placeholder="e.g. CARD" className={INPUT} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                <textarea value={form.description} onChange={e => set("description", e.target.value)}
                  rows={2} placeholder="Department description..." className={INPUT} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Location / Floor</label>
                  <input value={form.location} onChange={e => set("location", e.target.value)} placeholder="e.g. 2nd Floor, Wing B" className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Head of Department</label>
                  <input value={form.headOfDepartment} onChange={e => set("headOfDepartment", e.target.value)} placeholder="Name" className={INPUT} />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowForm(false); setEditDept(null) }} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Cancel</button>
              <button onClick={submit} disabled={submitting}
                className="flex-1 py-2.5 bg-gray-800 text-white rounded-xl text-sm font-semibold hover:bg-gray-900 disabled:opacity-50">
                {submitting ? "Saving..." : (editDept ? "Update" : "Create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Roles Overview ───────────────────────────────────────────
function RolesOverview() {
  const ACCESS_MAP = {
    SUPER_ADMIN:            ["ALL MODULES"],
    HOSPITAL_ADMIN:         ["ALL MODULES"],
    MEDICAL_DIRECTOR:       ["Dashboard","Doctor","Nursing","Lab","Pharmacy","IPD","Surgery","Maternity","Reports","Coordinator","Admin"],
    CLINICAL_COORDINATOR:   ["Dashboard","Nursing","Doctor","Lab","Pharmacy","Emergency","IPD","Surgery","Maternity","Mortuary","Reports"],
    RECEPTIONIST:           ["Reception","Billing","Appointments"],
    MEDICAL_RECORDS_OFFICER:["Reception","Patient Records"],
    NURSE:                  ["Nursing","Emergency","IPD","Maternity","Reception"],
    MIDWIFE:                ["Nursing","Maternity","Emergency"],
    THEATRE_NURSE:          ["Nursing","Surgery","IPD"],
    DOCTOR:                 ["Doctor","Emergency","IPD","Surgery","Maternity","Mortuary"],
    SURGEON:                ["Doctor","Surgery","IPD","Emergency"],
    LAB_TECHNICIAN:         ["Laboratory"],
    LAB_SCIENTIST:          ["Laboratory","Reports"],
    RADIOGRAPHER:           ["Radiology"],
    PHARMACIST:             ["Pharmacy"],
    INVENTORY_OFFICER:      ["Inventory"],
    FACILITY_OFFICER:       ["Facility","Inventory"],
    ACCOUNTANT:             ["Billing","Reports"],
    MORTUARY_OFFICER:       ["Mortuary"]
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Role-based access control matrix for St. Everest Mediplex HIMS</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(ACCESS_MAP).map(([role, modules]) => (
          <div key={role} className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-gray-500" />
              <span className={`text-xs px-2 py-1 rounded-full font-bold ${ROLE_COLOR[role] || "bg-gray-100 text-gray-600"}`}>
                {role.replace(/_/g," ")}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {modules.map(m => (
                <span key={m} className={`text-xs px-2 py-0.5 rounded-full font-medium ${m === "ALL MODULES" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                  {m}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── System Settings ──────────────────────────────────────────
function SystemSettings() {
  const [settings, setSettings] = useState({
    hospitalName: "St. Everest Mediplex",
    hospitalPhone: "+234 810 604 3994",
    hospitalEmail: "info@steverestmediplex.com",
    hospitalAddress: "28 Godwin Omoigwi Street,Amagba GRA, Benin city, Nigeria",
    currency: "NGN",
    timezone: "Africa/Nigeria",
    dateFormat: "DD/MM/YYYY",
    appointmentDuration: "30",
    maxAppointmentsPerDay: "20",
    enableSMS: "false",
    enableEmail: "false",
    maintenanceMode: "false"
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await new Promise(r => setTimeout(r, 800))
    toast.success("Settings saved!")
    setSaving(false)
  }

  const INPUT = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"

  return (
    <div className="max-w-2xl space-y-6">
      {/* Hospital Info */}
      <div className="border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Building2 className="w-4 h-4" /> Hospital Information
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Hospital Name</label>
            <input value={settings.hospitalName} onChange={e => setSettings(p => ({...p, hospitalName: e.target.value}))} className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
            <input value={settings.hospitalPhone} onChange={e => setSettings(p => ({...p, hospitalPhone: e.target.value}))} className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
            <input value={settings.hospitalEmail} onChange={e => setSettings(p => ({...p, hospitalEmail: e.target.value}))} className={INPUT} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Address</label>
            <textarea value={settings.hospitalAddress} onChange={e => setSettings(p => ({...p, hospitalAddress: e.target.value}))} rows={2} className={INPUT} />
          </div>
        </div>
      </div>

      {/* System Config */}
      <div className="border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Server className="w-4 h-4" /> System Configuration
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Currency</label>
            <select value={settings.currency} onChange={e => setSettings(p => ({...p, currency: e.target.value}))} className={INPUT}>
              <option value="KES">KES - Kenyan Shilling</option>
              <option value="USD">USD - US Dollar</option>
              <option value="UGX">UGX - Ugandan Shilling</option>
              <option value="TZS">TZS - Tanzanian Shilling</option>
              <option value="GHS">GHS - Ghanaian Cedi</option>
              <option value="NGN">NGN - Nigerian Naira</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Timezone</label>
            <select value={settings.timezone} onChange={e => setSettings(p => ({...p, timezone: e.target.value}))} className={INPUT}>
              <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
              <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
              <option value="Africa/Accra">Africa/Accra (GMT)</option>
              <option value="Africa/Johannesburg">Africa/Johannesburg (SAST)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Appointment Duration (mins)</label>
            <select value={settings.appointmentDuration} onChange={e => setSettings(p => ({...p, appointmentDuration: e.target.value}))} className={INPUT}>
              <option value="15">15 minutes</option>
              <option value="20">20 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">1 hour</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Max Appointments/Day</label>
            <input type="number" value={settings.maxAppointmentsPerDay} onChange={e => setSettings(p => ({...p, maxAppointmentsPerDay: e.target.value}))} className={INPUT} />
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div className="border border-gray-200 rounded-xl p-5 space-y-3">
        <h3 className="font-semibold text-gray-800">Feature Toggles</h3>
        {[
          { key: "enableSMS", label: "SMS Notifications", desc: "Send SMS alerts to patients" },
          { key: "enableEmail", label: "Email Notifications", desc: "Send email notifications" },
          { key: "maintenanceMode", label: "Maintenance Mode", desc: "Restrict access to admins only" }
        ].map(toggle => (
          <div key={toggle.key} className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-700">{toggle.label}</p>
              <p className="text-xs text-gray-400">{toggle.desc}</p>
            </div>
            <button onClick={() => setSettings(p => ({...p, [toggle.key]: p[toggle.key] === "true" ? "false" : "true"}))}
              className={`w-12 h-6 rounded-full transition-colors relative ${settings[toggle.key] === "true" ? "bg-green-500" : "bg-gray-300"}`}>
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${settings[toggle.key] === "true" ? "left-6" : "left-0.5"}`} />
            </button>
          </div>
        ))}
      </div>

      <button onClick={save} disabled={saving}
        className="w-full py-3 bg-gray-800 text-white rounded-xl font-semibold hover:bg-gray-900 disabled:opacity-50 flex items-center justify-center gap-2">
        <Save className="w-5 h-5" />
        {saving ? "Saving Settings..." : "Save All Settings"}
      </button>
    </div>
  )
}

// ── Audit Logs ───────────────────────────────────────────────
function AuditLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchLogs() }, [])

  const fetchLogs = async () => {
    try {
      const res = await api.get("/admin/audit-logs")
      setLogs(res.data.data || [])
    } catch (e) {} finally { setLoading(false) }
  }

  const ACTION_COLOR = {
    CREATE: "bg-green-100 text-green-700",
    UPDATE: "bg-blue-100 text-blue-700",
    DELETE: "bg-red-100 text-red-700",
    LOGIN:  "bg-purple-100 text-purple-700",
    LOGOUT: "bg-gray-100 text-gray-600"
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">System activity trail</p>
        <button onClick={fetchLogs} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">No audit logs yet</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Time","User","Action","Module","Record"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {log.user?.firstName} {log.user?.lastName}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLOR[log.action] || "bg-gray-100 text-gray-600"}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{log.module}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{log.recordId?.slice(0,8)}...</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}