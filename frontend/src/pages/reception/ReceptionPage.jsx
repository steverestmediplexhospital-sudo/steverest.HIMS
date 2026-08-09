import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import api from "../../services/api"
import { toast } from "react-hot-toast"
import {
  Users, UserPlus, Search, Calendar, Clock, ChevronRight,
  Phone, MapPin, Heart, AlertCircle, FileText, Activity,
  X, Save, CheckCircle, User, RefreshCw, Eye, Edit3
} from "lucide-react"

const TABS = [
  { id: "register",     label: "Register Patient",   icon: UserPlus },
  { id: "search",       label: "Find Patient",        icon: Search },
  { id: "queue",        label: "OPD Queue",           icon: Activity },
  { id: "appointments", label: "Appointments",        icon: Calendar }
]

export default function ReceptionPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("search")
  const [stats, setStats] = useState({ today: 0, total: 0, waiting: 0, appointments: 0 })

  useEffect(() => { fetchStats() }, [])

  const fetchStats = async () => {
    try {
      const [pRes, vRes] = await Promise.allSettled([
        api.get("/patients?limit=1"),
        api.get(`/visits?date=${new Date().toISOString().split("T")[0]}`)
      ])
      const visits = vRes.status === "fulfilled" ? vRes.value.data.data || [] : []
      setStats({
        today: visits.length,
        total: pRes.status === "fulfilled" ? pRes.value.data.meta?.total || 0 : 0,
        waiting: visits.filter(v => ["WAITING","TRIAGED"].includes(v.status)).length,
        appointments: 0
      })
    } catch (e) {}
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-cyan-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-teal-200 text-sm">Reception & Registration</p>
            <h1 className="text-2xl font-bold">Patient Management</h1>
            <p className="text-teal-200 text-sm mt-1">St. Everest Mediplex — Front Desk</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Today Visits", value: stats.today },
              { label: "Waiting", value: stats.waiting },
              { label: "Total Patients", value: stats.total },
              { label: "Appointments", value: stats.appointments }
            ].map(s => (
              <div key={s.label} className="bg-white/20 rounded-xl px-4 py-2 text-center">
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-teal-200 text-xs">{s.label}</p>
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
                    ? "border-b-2 border-teal-600 text-teal-700 bg-teal-50"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}>
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            )
          })}
        </div>
        <div className="p-5">
          {activeTab === "register"     && <PatientRegistrationForm onSuccess={() => setActiveTab("search")} />}
          {activeTab === "search"       && <PatientSearch navigate={navigate} />}
          {activeTab === "queue"        && <OPDQueue navigate={navigate} />}
          {activeTab === "appointments" && <AppointmentsTab />}
        </div>
      </div>
    </div>
  )
}

// ── Full Patient Registration Form ───────────────────────────
function PatientRegistrationForm({ onSuccess, editPatient = null }) {
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    // Personal
    firstName: "", lastName: "", middleName: "", dateOfBirth: "",
    gender: "", bloodGroup: "", maritalStatus: "", nationality: "Nigerian",
    nationalId: "", passportNumber: "", religion: "",
    // Contact
    phone: "", altPhone: "", email: "",
    address: "", city: "", county: "", postalCode: "",
    // Emergency Contact
    emergencyContactName: "", emergencyContactRelation: "",
    emergencyContactPhone: "", emergencyContactAddress: "",
    // Medical
    patientType: "OUTPATIENT", allergies: "", chronicConditions: "",
    currentMedications: "", bloodGroup2: "", rhFactor: "",
    // Insurance
    insuranceProvider: "", insurancePolicyNumber: "", insuranceMemberNumber: "",
    // Visit (for new OPD)
    chiefComplaint: "", visitType: "OPD",
    ...editPatient
  })

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const STEPS = [
    { n: 1, label: "Personal Info" },
    { n: 2, label: "Contact Details" },
    { n: 3, label: "Medical History" },
    { n: 4, label: "Insurance & Visit" }
  ]

  const handleSubmit = async () => {
    if (!form.firstName || !form.lastName || !form.gender || !form.dateOfBirth || !form.phone) {
      toast.error("Fill in all required fields (Name, Gender, DOB, Phone)")
      return
    }
    setSubmitting(true)
    try {
      let patient
      if (editPatient?.id) {
        const res = await api.put(`/patients/${editPatient.id}`, form)
        patient = res.data.data
        toast.success("Patient record updated!")
      } else {
        const res = await api.post("/patients", form)
        patient = res.data.data
        // Create visit if chief complaint provided
        if (form.chiefComplaint) {
          await api.post("/visits", {
            patientId: patient.id,
            visitType: form.visitType || "OPD",
            chiefComplaint: form.chiefComplaint
          })
        }
        toast.success(`Patient registered! ID: ${patient.patientNumber}`)
      }
      onSuccess(patient)
    } catch (e) {
      toast.error(e.response?.data?.message || "Registration failed")
    } finally { setSubmitting(false) }
  }

  const INPUT = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
  const LABEL = "block text-xs font-semibold text-gray-600 mb-1.5"
  const REQ = <span className="text-red-500">*</span>

  return (
    <div>
      {/* Step Progress */}
      <div className="flex items-center mb-6">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center flex-1">
            <div className="flex items-center gap-2">
              <div onClick={() => step > s.n && setStep(s.n)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  step === s.n ? "bg-teal-600 text-white" :
                  step > s.n ? "bg-green-500 text-white cursor-pointer" :
                  "bg-gray-200 text-gray-500"
                }`}>
                {step > s.n ? <CheckCircle className="w-4 h-4" /> : s.n}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${step === s.n ? "text-teal-700" : "text-gray-400"}`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${step > s.n ? "bg-green-400" : "bg-gray-200"}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Personal Information */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2"><User className="w-4 h-4 text-teal-600" /> Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className={LABEL}>First Name {REQ}</label><input value={form.firstName} onChange={e => set("firstName", e.target.value)} placeholder="First name" className={INPUT} /></div>
            <div><label className={LABEL}>Middle Name</label><input value={form.middleName} onChange={e => set("middleName", e.target.value)} placeholder="Middle name" className={INPUT} /></div>
            <div><label className={LABEL}>Last Name {REQ}</label><input value={form.lastName} onChange={e => set("lastName", e.target.value)} placeholder="Last name" className={INPUT} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={LABEL}>Date of Birth {REQ}</label>
              <input type="date" value={form.dateOfBirth} onChange={e => set("dateOfBirth", e.target.value)} max={new Date().toISOString().split("T")[0]} className={INPUT} />
              {form.dateOfBirth && <p className="text-xs text-gray-400 mt-1">Age: {Math.floor((Date.now() - new Date(form.dateOfBirth)) / 31557600000)} years</p>}
            </div>
            <div>
              <label className={LABEL}>Gender {REQ}</label>
              <select value={form.gender} onChange={e => set("gender", e.target.value)} className={INPUT}>
                <option value="">Select gender...</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Blood Group</label>
              <select value={form.bloodGroup} onChange={e => set("bloodGroup", e.target.value)} className={INPUT}>
                <option value="">Unknown</option>
                {["A_POSITIVE","A_NEGATIVE","B_POSITIVE","B_NEGATIVE","AB_POSITIVE","AB_NEGATIVE","O_POSITIVE","O_NEGATIVE"].map(bg => (
                  <option key={bg} value={bg}>{bg.replace(/_/g," ")}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className={LABEL}>Marital Status</label>
              <select value={form.maritalStatus} onChange={e => set("maritalStatus", e.target.value)} className={INPUT}>
                <option value="">Select...</option>
                {["SINGLE","MARRIED","DIVORCED","WIDOWED","SEPARATED"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className={LABEL}>Nationality</label><input value={form.nationality} onChange={e => set("nationality", e.target.value)} className={INPUT} /></div>
            <div><label className={LABEL}>National ID / Birth Cert</label><input value={form.nationalId} onChange={e => set("nationalId", e.target.value)} placeholder="ID number" className={INPUT} /></div>
            <div><label className={LABEL}>Religion</label><input value={form.religion} onChange={e => set("religion", e.target.value)} placeholder="Optional" className={INPUT} /></div>
          </div>
          <div>
            <label className={LABEL}>Patient Type {REQ}</label>
            <div className="flex gap-3 flex-wrap">
              {["OUTPATIENT","INPATIENT","EMERGENCY","ANTENATAL","NEWBORN"].map(t => (
                <button key={t} type="button" onClick={() => set("patientType", t)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${
                    form.patientType === t ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600 hover:border-teal-300"
                  }`}>{t.replace(/_/g," ")}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Contact Details */}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Phone className="w-4 h-4 text-teal-600" /> Contact Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className={LABEL}>Primary Phone {REQ}</label><input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="07XXXXXXXX" className={INPUT} /></div>
            <div><label className={LABEL}>Alternative Phone</label><input value={form.altPhone} onChange={e => set("altPhone", e.target.value)} placeholder="Optional" className={INPUT} /></div>
            <div><label className={LABEL}>Email Address</label><input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="Optional" className={INPUT} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={LABEL}>Physical Address {REQ}</label><textarea value={form.address} onChange={e => set("address", e.target.value)} placeholder="Street, Estate, Area..." rows={2} className={INPUT} /></div>
            <div className="space-y-3">
              <div><label className={LABEL}>City/Town</label><input value={form.city} onChange={e => set("city", e.target.value)} placeholder="e.g. Lagos" className={INPUT} /></div>
              <div><label className={LABEL}>County</label><input value={form.county} onChange={e => set("county", e.target.value)} placeholder="e.g. Lagos" className={INPUT} /></div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-orange-500" /> Emergency Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={LABEL}>Contact Name {REQ}</label><input value={form.emergencyContactName} onChange={e => set("emergencyContactName", e.target.value)} placeholder="Full name" className={INPUT} /></div>
              <div>
                <label className={LABEL}>Relationship {REQ}</label>
                <select value={form.emergencyContactRelation} onChange={e => set("emergencyContactRelation", e.target.value)} className={INPUT}>
                  <option value="">Select...</option>
                  {["Spouse","Parent","Child","Sibling","Grandparent","Friend","Guardian","Other"].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div><label className={LABEL}>Phone {REQ}</label><input value={form.emergencyContactPhone} onChange={e => set("emergencyContactPhone", e.target.value)} placeholder="07XXXXXXXX" className={INPUT} /></div>
              <div><label className={LABEL}>Address</label><input value={form.emergencyContactAddress} onChange={e => set("emergencyContactAddress", e.target.value)} placeholder="Optional" className={INPUT} /></div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Medical History */}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Heart className="w-4 h-4 text-red-500" /> Medical History</h3>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-700 text-sm font-semibold mb-3 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Allergies (Drug, Food, Environmental)</p>
            <textarea value={form.allergies} onChange={e => set("allergies", e.target.value)}
              placeholder="List all known allergies and reactions. Write NKDA if no known drug allergies..."
              rows={3} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Chronic/Pre-existing Conditions</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {["Diabetes Mellitus","Hypertension","Asthma","Heart Disease","HIV/AIDS","Epilepsy","Sickle Cell Disease","Thyroid Disease","Cancer","CKD"].map(c => (
                <button key={c} type="button"
                  onClick={() => set("chronicConditions", form.chronicConditions ? `${form.chronicConditions}, ${c}` : c)}
                  className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full hover:bg-blue-100 border border-blue-200">
                  + {c}
                </button>
              ))}
            </div>
            <textarea value={form.chronicConditions} onChange={e => set("chronicConditions", e.target.value)}
              placeholder="List chronic conditions, previous surgeries, significant medical history..."
              rows={3} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Current Medications</label>
            <textarea value={form.currentMedications} onChange={e => set("currentMedications", e.target.value)}
              placeholder="List all medications patient is currently taking with doses..."
              rows={3} className={INPUT} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={LABEL}>RH Factor</label>
              <select value={form.rhFactor} onChange={e => set("rhFactor", e.target.value)} className={INPUT}>
                <option value="">Unknown</option>
                <option value="POSITIVE">Positive (+)</option>
                <option value="NEGATIVE">Negative (-)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Insurance & Visit */}
      {step === 4 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2"><FileText className="w-4 h-4 text-teal-600" /> Insurance & Initial Visit</h3>

          <div className="border border-gray-200 rounded-xl p-4 space-y-4">
            <h4 className="font-medium text-gray-700">Insurance Information (Optional)</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={LABEL}>Insurance Provider</label>
                <select value={form.insuranceProvider} onChange={e => set("insuranceProvider", e.target.value)} className={INPUT}>
                  <option value="">Self Pay / Cash</option>
                  {["NHIF","AAR Healthcare","Jubilee Insurance","Resolution Health","CIC Insurance","Madison Insurance","GA Insurance","First Assurance","APA Insurance","Sanlam"].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div><label className={LABEL}>Policy Number</label><input value={form.insurancePolicyNumber} onChange={e => set("insurancePolicyNumber", e.target.value)} placeholder="Policy/Card number" className={INPUT} /></div>
              <div><label className={LABEL}>Member Number</label><input value={form.insuranceMemberNumber} onChange={e => set("insuranceMemberNumber", e.target.value)} placeholder="Member ID" className={INPUT} /></div>
            </div>
          </div>

          <div className="border border-teal-200 bg-teal-50 rounded-xl p-4 space-y-4">
            <h4 className="font-medium text-teal-700">Initial Visit / Chief Complaint</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Visit Type</label>
                <select value={form.visitType} onChange={e => set("visitType", e.target.value)} className={INPUT}>
                  <option value="OPD">OPD (Outpatient)</option>
                  <option value="EMERGENCY">Emergency</option>
                  <option value="ANTENATAL">Antenatal</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Chief Complaint</label>
                <input value={form.chiefComplaint} onChange={e => set("chiefComplaint", e.target.value)}
                  placeholder="Main reason for visit today..." className={INPUT} />
              </div>
            </div>
          </div>

          {/* Summary Preview */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h4 className="font-medium text-gray-700 mb-3">Registration Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                ["Name", `${form.firstName} ${form.middleName || ""} ${form.lastName}`.trim()],
                ["DOB", form.dateOfBirth ? new Date(form.dateOfBirth).toLocaleDateString() : "—"],
                ["Gender", form.gender || "—"],
                ["Phone", form.phone || "—"],
                ["Type", form.patientType],
                ["Insurance", form.insuranceProvider || "Self Pay"],
                ["Blood Group", form.bloodGroup?.replace(/_/g," ") || "Unknown"],
                ["Emergency Contact", form.emergencyContactName || "—"]
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-gray-800">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
        <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}
          className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
          ← Previous
        </button>
        <div className="flex gap-2">
          {step < 4 ? (
            <button onClick={() => {
              if (step === 1 && (!form.firstName || !form.lastName || !form.gender || !form.dateOfBirth)) {
                toast.error("Fill required fields: First Name, Last Name, Gender, Date of Birth")
                return
              }
              setStep(s => s + 1)
            }}
              className="px-6 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700">
              Next →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
              <Save className="w-4 h-4" />
              {submitting ? "Registering..." : "Complete Registration"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Patient Search ───────────────────────────────────────────
function PatientSearch({ navigate }) {
  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [showNewVisit, setShowNewVisit] = useState(false)
  const [visitForm, setVisitForm] = useState({ visitType: "OPD", chiefComplaint: "" })
  const [creating, setCreating] = useState(false)

  const doSearch = async () => {
    if (!search.trim()) return
    setLoading(true)
    try {
      const res = await api.get(`/patients?search=${encodeURIComponent(search)}&limit=20`)
      setResults(res.data.data || [])
    } catch (e) { toast.error("Search failed") }
    finally { setLoading(false) }
  }

  const createVisit = async () => {
    if (!visitForm.chiefComplaint.trim()) { toast.error("Enter chief complaint"); return }
    setCreating(true)
    try {
      const res = await api.post("/visits", {
        patientId: selected.id,
        visitType: visitForm.visitType,
        chiefComplaint: visitForm.chiefComplaint
      })
      toast.success("Visit created! Patient added to queue.")
      setShowNewVisit(false)
      setSelected(null)
      setResults([])
      setSearch("")
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to create visit")
    } finally { setCreating(false) }
  }

  const age = (dob) => dob ? Math.floor((Date.now() - new Date(dob)) / 31557600000) : null

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && doSearch()}
            placeholder="Search by name, patient number, phone, or ID..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <button onClick={doSearch} disabled={loading}
          className="bg-teal-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">{results.length} patient(s) found</p>
          {results.map(patient => (
            <div key={patient.id} className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
              selected?.id === patient.id ? "border-teal-500 bg-teal-50" : "border-gray-200 hover:border-teal-300"
            }`} onClick={() => setSelected(selected?.id === patient.id ? null : patient)}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm">
                    {patient.firstName?.[0]}{patient.lastName?.[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{patient.firstName} {patient.lastName}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                      <span className="font-medium text-teal-600">{patient.patientNumber}</span>
                      <span>•</span>
                      <span>{patient.gender}</span>
                      {age(patient.dateOfBirth) && <><span>•</span><span>{age(patient.dateOfBirth)} yrs</span></>}
                      <span>•</span>
                      <span>{patient.phone}</span>
                      {patient.bloodGroup && <><span>•</span><span className="font-medium">{patient.bloodGroup?.replace(/_/g," ")}</span></>}
                    </div>
                    {patient.allergies && (
                      <p className="text-xs text-red-600 mt-1 font-medium">⚠ Allergies: {patient.allergies}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    patient.patientType === "INPATIENT" ? "bg-blue-100 text-blue-700" :
                    patient.patientType === "EMERGENCY" ? "bg-red-100 text-red-700" :
                    "bg-green-100 text-green-700"
                  }`}>{patient.patientType}</span>
                  <button onClick={e => { e.stopPropagation(); navigate(`/doctor/patient/${patient.id}`) }}
                    className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200 flex items-center gap-1">
                    <Eye className="w-3 h-3" /> View
                  </button>
                </div>
              </div>

              {selected?.id === patient.id && (
                <div className="mt-4 pt-4 border-t border-teal-200 flex gap-3 flex-wrap">
                  <button onClick={() => setShowNewVisit(true)}
                    className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700">
                    <Activity className="w-4 h-4" /> New OPD Visit
                  </button>
                  <button onClick={() => navigate(`/doctor/patient/${patient.id}`)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                    <FileText className="w-4 h-4" /> Full Chart
                  </button>
                  <button className="flex items-center gap-2 bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
                    <Edit3 className="w-4 h-4" /> Edit Record
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New Visit Modal */}
      {showNewVisit && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">New Visit — {selected.firstName} {selected.lastName}</h3>
              <button onClick={() => setShowNewVisit(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Visit Type</label>
                <div className="flex gap-2">
                  {["OPD","EMERGENCY","ANTENATAL"].map(t => (
                    <button key={t} onClick={() => setVisitForm(p => ({...p, visitType: t}))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                        visitForm.visitType === t ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600"
                      }`}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Chief Complaint <span className="text-red-500">*</span></label>
                <textarea value={visitForm.chiefComplaint} onChange={e => setVisitForm(p => ({...p, chiefComplaint: e.target.value}))}
                  placeholder="Patient's main complaint today..."
                  rows={3} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowNewVisit(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={createVisit} disabled={creating}
                className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
                {creating ? "Creating..." : "Create Visit & Add to Queue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── OPD Queue ────────────────────────────────────────────────
function OPDQueue({ navigate }) {
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchQueue(); const t = setInterval(fetchQueue, 30000); return () => clearInterval(t) }, [])

  const fetchQueue = async () => {
    try {
      const res = await api.get(`/visits?date=${new Date().toISOString().split("T")[0]}`)
      setVisits(res.data.data || [])
    } catch (e) {} finally { setLoading(false) }
  }

  const STATUS_LABEL = {
    WAITING: { label: "Waiting", color: "bg-gray-100 text-gray-600" },
    TRIAGED: { label: "Triaged", color: "bg-blue-100 text-blue-700" },
    VITALS_DONE: { label: "Vitals Done", color: "bg-purple-100 text-purple-700" },
    IN_CONSULTATION: { label: "In Consultation", color: "bg-yellow-100 text-yellow-700" },
    AWAITING_LAB: { label: "Awaiting Lab", color: "bg-orange-100 text-orange-700" },
    CONSULTATION_DONE: { label: "Consult Done", color: "bg-green-100 text-green-700" },
    COMPLETED: { label: "Completed", color: "bg-teal-100 text-teal-700" }
  }

  const getWait = (t) => {
    const m = Math.floor((Date.now() - new Date(t)) / 60000)
    return m < 60 ? `${m}m` : `${Math.floor(m/60)}h ${m%60}m`
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{visits.length} visits today</p>
        <button onClick={fetchQueue} className="text-gray-400 hover:text-teal-600 p-2 rounded-lg hover:bg-teal-50"><RefreshCw className="w-4 h-4" /></button>
      </div>
      {loading ? (
        [...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)
      ) : visits.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">No visits today yet</p>
        </div>
      ) : (
        visits.map((visit, idx) => {
          const s = STATUS_LABEL[visit.status] || { label: visit.status, color: "bg-gray-100 text-gray-600" }
          return (
            <div key={visit.id} className="border border-gray-200 rounded-xl p-3 flex items-center gap-4 hover:border-teal-200 transition-colors">
              <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-bold flex-shrink-0">{idx+1}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm">{visit.patient?.firstName} {visit.patient?.lastName}</p>
                <p className="text-xs text-gray-400">{visit.patient?.patientNumber} • {visit.visitType} • {visit.chiefComplaint || "General"}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" />{getWait(visit.createdAt)}</span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.color}`}>{s.label}</span>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ── Appointments Tab ─────────────────────────────────────────
function AppointmentsTab() {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ patientId: "", doctorId: "", scheduledAt: "", reason: "", appointmentType: "OPD" })
  const [patients, setPatients] = useState([])
  const [doctors, setDoctors] = useState([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { fetchAppointments(); fetchDoctors() }, [])

  const fetchAppointments = async () => {
    try {
      const res = await api.get(`/appointments?date=${new Date().toISOString().split("T")[0]}`)
      setAppointments(res.data.data || [])
    } catch (e) {} finally { setLoading(false) }
  }

  const fetchDoctors = async () => {
    try {
      const res = await api.get("/admin/users?role=DOCTOR")
      setDoctors(res.data.data || [])
    } catch (e) {}
  }

  const searchPatients = async (q) => {
    if (q.length < 2) return
    try {
      const res = await api.get(`/patients?search=${q}&limit=10`)
      setPatients(res.data.data || [])
    } catch (e) {}
  }

  const submit = async () => {
    if (!form.patientId || !form.doctorId || !form.scheduledAt) { toast.error("Fill all required fields"); return }
    setSubmitting(true)
    try {
      await api.post("/appointments", form)
      toast.success("Appointment booked!")
      setShowForm(false)
      fetchAppointments()
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to book appointment")
    } finally { setSubmitting(false) }
  }

  const STATUS_COLOR = {
    SCHEDULED: "bg-blue-100 text-blue-700",
    CONFIRMED: "bg-green-100 text-green-700",
    CHECKED_IN: "bg-purple-100 text-purple-700",
    COMPLETED: "bg-teal-100 text-teal-700",
    CANCELLED: "bg-red-100 text-red-700",
    NO_SHOW: "bg-gray-100 text-gray-600"
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700">Today&apos;s Appointments</h3>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700">
          <Calendar className="w-4 h-4" /> Book Appointment
        </button>
      </div>

      {loading ? (
        [...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)
      ) : appointments.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">No appointments today</p>
        </div>
      ) : (
        appointments.map(appt => (
          <div key={appt.id} className="border border-gray-200 rounded-xl p-4 flex items-center gap-4">
            <div className="text-center flex-shrink-0 bg-teal-50 rounded-xl p-2 w-16">
              <p className="text-xs text-gray-500">Time</p>
              <p className="text-sm font-bold text-teal-700">
                {new Date(appt.scheduledAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}
              </p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800">{appt.patient?.firstName} {appt.patient?.lastName}</p>
              <p className="text-xs text-gray-400">Dr. {appt.doctor?.firstName} {appt.doctor?.lastName} • {appt.reason || appt.appointmentType}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[appt.status] || "bg-gray-100 text-gray-600"}`}>
              {appt.status}
            </span>
          </div>
        ))
      )}

      {/* Book Appointment Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Book Appointment</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Search Patient</label>
                <input onChange={e => searchPatients(e.target.value)} placeholder="Type patient name..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                {patients.length > 0 && (
                  <div className="border border-gray-200 rounded-lg mt-1 max-h-32 overflow-y-auto">
                    {patients.map(p => (
                      <button key={p.id} onClick={() => { setForm(prev => ({...prev, patientId: p.id})); setPatients([]) }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50 border-b border-gray-50">
                        {p.firstName} {p.lastName} — {p.patientNumber}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Doctor</label>
                <select value={form.doctorId} onChange={e => setForm(p => ({...p, doctorId: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option value="">Select doctor...</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date & Time</label>
                <input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(p => ({...p, scheduledAt: e.target.value}))}
                  min={new Date().toISOString().slice(0,16)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reason</label>
                <input value={form.reason} onChange={e => setForm(p => ({...p, reason: e.target.value}))}
                  placeholder="Reason for appointment..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Cancel</button>
              <button onClick={submit} disabled={submitting}
                className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
                {submitting ? "Booking..." : "Book Appointment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}