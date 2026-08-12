import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import api from "../../services/api"
import {
  ArrowLeft, User, Heart, Activity, FileText,
  FlaskConical, Pill, BedDouble, Clock, Edit3, X, Save
} from "lucide-react"

export default function PatientChart() {
  const { patientId } = useParams()
  const navigate      = useNavigate()
  const [patient,   setPatient]   = useState(null)
  const [visits,    setVisits]    = useState([])
  const [labs,      setLabs]      = useState([])
  const [rxList,    setRxList]    = useState([])
  const [admissions,setAdmissions]= useState([])
  const [loading,   setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState("overview")
  const [showEdit,  setShowEdit]  = useState(false)

  useEffect(() => { fetchAll() }, [patientId])

  const fetchAll = async () => {
    try {
      const [pRes, vRes, lRes, rxRes, aRes] = await Promise.allSettled([
        api.get(`/patients/${patientId}`),
        api.get(`/visits?patientId=${patientId}`),
        api.get(`/lab?patientId=${patientId}`),
        api.get(`/pharmacy/prescriptions?patientId=${patientId}`),
        api.get(`/admissions?patientId=${patientId}`)
      ])

      // ✅ FIX: correctly extract patient
      if (pRes.status === "fulfilled") {
        const d = pRes.value.data.data
        setPatient(d?.patient || d)
      }

      // ✅ FIX: correctly extract visits
      if (vRes.status === "fulfilled") {
        const d = vRes.value.data.data
        setVisits(d?.visits || d?.data || d || [])
      }

      // ✅ FIX: correctly extract lab orders
      if (lRes.status === "fulfilled") {
        const d = lRes.value.data.data
        setLabs(d?.labOrders || d?.orders || d?.data || d || [])
      }

      // ✅ FIX: correctly extract prescriptions
      if (rxRes.status === "fulfilled") {
        const d = rxRes.value.data.data
        setRxList(d?.prescriptions || d?.data || d || [])
      }

      // ✅ FIX: correctly extract admissions
      if (aRes.status === "fulfilled") {
        const d = aRes.value.data.data
        setAdmissions(d?.admissions || d?.data || d || [])
      }

    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!patient) return (
    <div className="text-center py-12">
      <p className="text-gray-400">Patient not found</p>
      <button onClick={() => navigate(-1)} className="mt-4 text-blue-600 text-sm">Go back</button>
    </div>
  )

  const TABS = [
    { id: "overview",      label: "Overview",      icon: User        },
    { id: "visits",        label: "Visits",         icon: Activity    },
    { id: "labs",          label: "Lab Results",    icon: FlaskConical},
    { id: "prescriptions", label: "Prescriptions",  icon: Pill        },
    { id: "admissions",    label: "Admissions",     icon: BedDouble   }
  ]

  const age = patient.dateOfBirth
    ? Math.floor((Date.now() - new Date(patient.dateOfBirth)) / 31557600000)
    : null

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-800">Patient Chart</h1>
        </div>
        <button onClick={() => setShowEdit(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Edit3 className="w-4 h-4" /> Edit Patient
        </button>
      </div>

      {/* Patient Banner */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-2xl">
            {patient.firstName?.[0]}{patient.lastName?.[0]}
          </div>
          <div className="flex-1">
            {/* ✅ FIX: show correct name */}
            <h2 className="text-xl font-bold text-gray-800">
              {patient.firstName} {patient.middleName || ""} {patient.lastName}
            </h2>
            <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
              {/* ✅ FIX: use mrn not patientNumber */}
              <span className="font-medium text-blue-600">{patient.mrn}</span>
              <span>•</span>
              <span>{patient.gender}</span>
              {age && <><span>•</span><span>{age} years old</span></>}
              <span>•</span>
              <span>{patient.phone}</span>
              {patient.bloodGroup && (
                <><span>•</span>
                <span className="font-medium">
                  Blood: {patient.bloodGroup?.replace(/_/g," ")}
                </span></>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              patient.patientType === "INPATIENT"  ? "bg-blue-100 text-blue-700"  :
              patient.patientType === "EMERGENCY"  ? "bg-red-100 text-red-700"    :
              "bg-green-100 text-green-700"
            }`}>{patient.patientType}</span>
            <p className="text-xs text-gray-400 mt-1">
              Registered {patient.registeredAt
                ? new Date(patient.registeredAt).toLocaleDateString()
                : patient.createdAt
                ? new Date(patient.createdAt).toLocaleDateString()
                : "N/A"}
            </p>
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
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "border-b-2 border-blue-600 text-blue-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}>
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            )
          })}
        </div>

        <div className="p-5">

          {/* ── OVERVIEW ── */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-700 mb-3">Personal Information</h3>
                {[
                  ["Full Name",       `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "N/A"],
                  ["MRN",             patient.mrn           || "N/A"],
                  ["Date of Birth",   patient.dateOfBirth   ? new Date(patient.dateOfBirth).toLocaleDateString() : "N/A"],
                  ["Gender",          patient.gender        || "N/A"],
                  ["Blood Group",     patient.bloodGroup?.replace(/_/g," ") || "Unknown"],
                  ["Phone",           patient.phone         || "N/A"],
                  ["Email",           patient.email         || "N/A"],
                  ["Address",         patient.address       || "N/A"],
                  ["City",            patient.city          || "N/A"],
                  ["Nationality",     patient.nationality   || "N/A"],
                  ["Marital Status",  patient.maritalStatus || "N/A"],
                  ["National ID",     patient.nationalId    || "N/A"],
                  ["Insurance",       patient.insuranceProvider || "Self Pay"],
                  ["Policy No",       patient.insurancePolicyNo || "N/A"]
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-500">{label}</span>
                    <span className="text-sm font-medium text-gray-800 text-right max-w-xs">{value}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-gray-700 mb-3">Emergency Contact</h3>
                {[
                  ["Contact Name",  patient.nextOfKinName     || patient.emergencyContactName     || "N/A"],
                  ["Relationship",  patient.nextOfKinRelation || patient.emergencyContactRelation || "N/A"],
                  ["Phone",         patient.nextOfKinPhone    || patient.emergencyContactPhone    || "N/A"],
                  ["Address",       patient.nextOfKinAddress  || patient.emergencyContactAddress  || "N/A"]
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-500">{label}</span>
                    <span className="text-sm font-medium text-gray-800">{value}</span>
                  </div>
                ))}

                <h3 className="font-semibold text-gray-700 mt-6 mb-3">Medical Summary</h3>
                {[
                  ["Allergies", patient.allergies?.length > 0
                    ? patient.allergies.map(a => a.allergen).join(", ")
                    : "None recorded"],
                  ["Chronic Conditions", patient.chronicConditions?.length > 0
                    ? patient.chronicConditions.map(c => c.condition).join(", ")
                    : "None recorded"],
                  ["Total Visits",    patient._count?.visits     ?? visits.length],
                  ["Total Admissions",patient._count?.admissions ?? admissions.length],
                  ["Patient Type",    patient.patientType || "N/A"]
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-500">{label}</span>
                    <span className="text-sm font-medium text-gray-800">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── VISITS ── */}
          {activeTab === "visits" && (
            <div className="space-y-3">
              {visits.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400">No visits recorded</p>
                </div>
              ) : (
                visits.map(visit => (
                  <div key={visit.id}
                    className="border border-gray-200 rounded-xl p-4 hover:border-blue-200 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            visit.visitType === "EMERGENCY" ? "bg-red-100 text-red-700"   :
                            visit.visitType === "IPD"       ? "bg-blue-100 text-blue-700"  :
                            "bg-green-100 text-green-700"
                          }`}>{visit.visitType}</span>
                          <p className="font-semibold text-gray-800">
                            {visit.chiefComplaint || "General visit"}
                          </p>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(visit.createdAt).toLocaleDateString()}{" "}
                          {new Date(visit.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                          {visit.status?.replace(/_/g," ")}
                        </span>
                        <button
                          onClick={() => navigate(`/doctor/consult/${visit.id}`)}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
                          View
                        </button>
                      </div>
                    </div>
                    {visit.vitalSigns?.[0] && (
                      <div className="mt-3 pt-3 border-t border-gray-100 flex gap-4 text-xs text-gray-500 flex-wrap">
                        <span>BP: {visit.vitalSigns[0].bloodPressureSystolic}/{visit.vitalSigns[0].bloodPressureDiastolic} mmHg</span>
                        <span>HR: {visit.vitalSigns[0].heartRate} bpm</span>
                        <span>Temp: {visit.vitalSigns[0].temperature}°C</span>
                        <span>SpO₂: {visit.vitalSigns[0].oxygenSaturation}%</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── LAB RESULTS ── */}
          {activeTab === "labs" && (
            <div className="space-y-3">
              {labs.length === 0 ? (
                <div className="text-center py-12">
                  <FlaskConical className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">No Lab Results</p>
                  <p className="text-gray-300 text-sm">Lab results will appear here when ordered</p>
                </div>
              ) : (
                labs.map(order => (
                  <div key={order.id}
                    className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-800">
                          Order #{order.orderNumber}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(order.orderedAt || order.createdAt).toLocaleDateString()}{" "}
                          — Priority: {order.priority}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        order.status === "COMPLETED"    ? "bg-green-100 text-green-700"  :
                        order.status === "IN_PROGRESS"  ? "bg-yellow-100 text-yellow-700":
                        order.status === "PENDING"      ? "bg-gray-100 text-gray-600"    :
                        "bg-blue-100 text-blue-700"
                      }`}>{order.status}</span>
                    </div>
                    {order.items?.map(item => (
                      <div key={item.id}
                        className="bg-gray-50 rounded-lg p-3 mb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-medium text-gray-700">
                              {item.labTest?.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {item.labTest?.category}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            item.status === "COMPLETED"  ? "bg-green-100 text-green-700" :
                            item.status === "VALIDATED"  ? "bg-blue-100 text-blue-700"   :
                            "bg-gray-100 text-gray-500"
                          }`}>{item.status}</span>
                        </div>
                        {item.result && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Result:</span>
                              <span className={`font-bold ${
                                item.result.isCritical ? "text-red-600" : "text-gray-800"
                              }`}>
                                {item.result.result} {item.result.unit}
                                {item.result.isCritical && " ⚠️ CRITICAL"}
                              </span>
                            </div>
                            {item.result.normalRange && (
                              <div className="flex justify-between text-xs mt-1">
                                <span className="text-gray-500">Normal Range:</span>
                                <span className="text-gray-600">{item.result.normalRange}</span>
                              </div>
                            )}
                            {item.result.interpretation && (
                              <p className="text-xs text-gray-600 mt-1">
                                {item.result.interpretation}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── PRESCRIPTIONS ── */}
          {activeTab === "prescriptions" && (
            <div className="space-y-3">
              {rxList.length === 0 ? (
                <div className="text-center py-12">
                  <Pill className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">No Prescriptions</p>
                  <p className="text-gray-300 text-sm">Prescriptions will appear here when written</p>
                </div>
              ) : (
                rxList.map(rx => (
                  <div key={rx.id}
                    className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-800">
                          Rx #{rx.prescriptionNo}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(rx.createdAt).toLocaleDateString()}{" "}
                          — Dr. {rx.prescribedBy?.firstName} {rx.prescribedBy?.lastName}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        rx.status === "DISPENSED"          ? "bg-green-100 text-green-700"  :
                        rx.status === "PENDING"            ? "bg-yellow-100 text-yellow-700":
                        rx.status === "PARTIALLY_DISPENSED"? "bg-orange-100 text-orange-700":
                        rx.status === "CANCELLED"          ? "bg-red-100 text-red-700"      :
                        "bg-gray-100 text-gray-600"
                      }`}>{rx.status?.replace(/_/g," ")}</span>
                    </div>
                    <div className="space-y-2">
                      {rx.items?.map(item => (
                        <div key={item.id}
                          className="bg-gray-50 rounded-lg p-3 flex justify-between items-start">
                          <div>
                            <p className="text-sm font-medium text-gray-700">
                              {item.drug?.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {item.dose} — {item.frequency} — {item.duration}
                            </p>
                            {item.instructions && (
                              <p className="text-xs text-blue-600 mt-0.5">
                                ℹ {item.instructions}
                              </p>
                            )}
                          </div>
                          <div className="text-right text-xs text-gray-500">
                            <p>Qty: {item.quantity}</p>
                            <p>Dispensed: {item.dispensedQty}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── ADMISSIONS ── */}
          {activeTab === "admissions" && (
            <div className="space-y-3">
              {admissions.length === 0 ? (
                <div className="text-center py-12">
                  <BedDouble className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">No Admissions</p>
                  <p className="text-gray-300 text-sm">Admission history will appear here</p>
                </div>
              ) : (
                admissions.map(adm => (
                  <div key={adm.id}
                    className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-800">
                          Admission #{adm.admissionNumber}
                        </p>
                        <p className="text-xs text-gray-400">
                          Admitted: {new Date(adm.admittedAt).toLocaleDateString()}
                          {adm.dischargedAt && ` — Discharged: ${new Date(adm.dischargedAt).toLocaleDateString()}`}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        adm.status === "ACTIVE"      ? "bg-blue-100 text-blue-700"   :
                        adm.status === "DISCHARGED"  ? "bg-green-100 text-green-700" :
                        adm.status === "TRANSFERRED" ? "bg-yellow-100 text-yellow-700":
                        "bg-gray-100 text-gray-600"
                      }`}>{adm.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mt-2">
                      <span>Ward: <strong>{adm.ward?.name || "N/A"}</strong></span>
                      <span>Bed: <strong>{adm.bed?.bedNumber || "N/A"}</strong></span>
                      {adm.admissionReason && (
                        <span className="col-span-2">
                          Reason: <strong>{adm.admissionReason}</strong>
                        </span>
                      )}
                      {adm.dischargeNotes && (
                        <span className="col-span-2">
                          Discharge Notes: <strong>{adm.dischargeNotes}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── EDIT PATIENT MODAL ── */}
      {showEdit && patient && (
        <EditPatientModal
          patient={patient}
          onClose={() => setShowEdit(false)}
          onSuccess={() => { setShowEdit(false); fetchAll() }}
        />
      )}
    </div>
  )
}

// ── Edit Patient Modal ───────────────────────────────────────
function EditPatientModal({ patient, onClose, onSuccess }) {
  const [form, setForm] = useState({
    firstName:              patient.firstName        || "",
    lastName:               patient.lastName         || "",
    middleName:             patient.middleName       || "",
    phone:                  patient.phone            || "",
    email:                  patient.email            || "",
    address:                patient.address          || "",
    city:                   patient.city             || "",
    occupation:             patient.occupation       || "",
    maritalStatus:          patient.maritalStatus    || "",
    religion:               patient.religion         || "",
    bloodGroup:             patient.bloodGroup       || "",
    patientType:            patient.patientType      || "OUTPATIENT",
    insuranceProvider:      patient.insuranceProvider|| "",
    insurancePolicyNo:      patient.insurancePolicyNo|| "",
    nextOfKinName:          patient.nextOfKinName    || patient.emergencyContactName    || "",
    nextOfKinPhone:         patient.nextOfKinPhone   || patient.emergencyContactPhone   || "",
    nextOfKinRelation:      patient.nextOfKinRelation|| patient.emergencyContactRelation|| "",
    nationality:            patient.nationality      || ""
  })
  const [saving, setSaving] = useState(false)

  const set = (f, v) => setForm(p => ({...p, [f]: v}))

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put(`/patients/${patient.id}`, form)
      const { toast } = await import("react-hot-toast")
      toast.success("Patient record updated!")
      onSuccess()
    } catch (e) {
      const { toast } = await import("react-hot-toast")
      toast.error(e.response?.data?.message || "Update failed")
    } finally { setSaving(false) }
  }

  const INPUT = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const LABEL = "block text-xs font-semibold text-gray-600 mb-1.5"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-800 text-lg">
            Edit Patient — {patient.firstName} {patient.lastName}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className={LABEL}>First Name</label>
              <input value={form.firstName} onChange={e => set("firstName", e.target.value)} className={INPUT} /></div>
            <div><label className={LABEL}>Middle Name</label>
              <input value={form.middleName} onChange={e => set("middleName", e.target.value)} className={INPUT} /></div>
            <div><label className={LABEL}>Last Name</label>
              <input value={form.lastName} onChange={e => set("lastName", e.target.value)} className={INPUT} /></div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={LABEL}>Phone</label>
              <input value={form.phone} onChange={e => set("phone", e.target.value)} className={INPUT} /></div>
            <div><label className={LABEL}>Email</label>
              <input value={form.email} onChange={e => set("email", e.target.value)} className={INPUT} /></div>
          </div>

          {/* Address */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={LABEL}>Address</label>
              <input value={form.address} onChange={e => set("address", e.target.value)} className={INPUT} /></div>
            <div><label className={LABEL}>City</label>
              <input value={form.city} onChange={e => set("city", e.target.value)} className={INPUT} /></div>
          </div>

          {/* Medical */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={LABEL}>Blood Group</label>
              <select value={form.bloodGroup} onChange={e => set("bloodGroup", e.target.value)} className={INPUT}>
                <option value="">Unknown</option>
                {["A_POSITIVE","A_NEGATIVE","B_POSITIVE","B_NEGATIVE",
                  "AB_POSITIVE","AB_NEGATIVE","O_POSITIVE","O_NEGATIVE"].map(bg => (
                  <option key={bg} value={bg}>{bg.replace(/_/g," ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Marital Status</label>
              <select value={form.maritalStatus} onChange={e => set("maritalStatus", e.target.value)} className={INPUT}>
                <option value="">Select...</option>
                {["SINGLE","MARRIED","DIVORCED","WIDOWED","SEPARATED"].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Patient Type</label>
              <select value={form.patientType} onChange={e => set("patientType", e.target.value)} className={INPUT}>
                {["OUTPATIENT","INPATIENT","EMERGENCY","ANTENATAL","NEWBORN"].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Insurance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={LABEL}>Insurance Provider</label>
              <input value={form.insuranceProvider} onChange={e => set("insuranceProvider", e.target.value)}
                placeholder="Self Pay if empty" className={INPUT} /></div>
            <div><label className={LABEL}>Policy Number</label>
              <input value={form.insurancePolicyNo} onChange={e => set("insurancePolicyNo", e.target.value)} className={INPUT} /></div>
          </div>

          {/* Next of Kin */}
          <div className="border-t pt-4">
            <h4 className="font-semibold text-gray-700 mb-3">Next of Kin / Emergency Contact</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className={LABEL}>Name</label>
                <input value={form.nextOfKinName} onChange={e => set("nextOfKinName", e.target.value)} className={INPUT} /></div>
              <div><label className={LABEL}>Phone</label>
                <input value={form.nextOfKinPhone} onChange={e => set("nextOfKinPhone", e.target.value)} className={INPUT} /></div>
              <div><label className={LABEL}>Relation</label>
                <input value={form.nextOfKinRelation} onChange={e => set("nextOfKinRelation", e.target.value)} className={INPUT} /></div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  )
}