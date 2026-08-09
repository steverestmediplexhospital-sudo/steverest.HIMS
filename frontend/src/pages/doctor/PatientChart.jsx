import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import api from "../../services/api"
import { ArrowLeft, User, Heart, Activity, FileText, FlaskConical, Pill, BedDouble, Clock } from "lucide-react"

export default function PatientChart() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const [patient, setPatient] = useState(null)
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => { fetchPatient() }, [patientId])

  const fetchPatient = async () => {
    try {
      const [pRes, vRes] = await Promise.allSettled([
        api.get(`/patients/${patientId}`),
        api.get(`/visits?patientId=${patientId}`)
      ])
      if (pRes.status === "fulfilled") setPatient(pRes.value.data.data)
      if (vRes.status === "fulfilled") setVisits(vRes.value.data.data || [])
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
    { id: "overview", label: "Overview", icon: User },
    { id: "visits", label: "Visits", icon: Activity },
    { id: "labs", label: "Lab Results", icon: FlaskConical },
    { id: "prescriptions", label: "Prescriptions", icon: Pill },
    { id: "admissions", label: "Admissions", icon: BedDouble }
  ]

  const age = patient.dateOfBirth
    ? Math.floor((Date.now() - new Date(patient.dateOfBirth)) / 31557600000)
    : null

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-800">Patient Chart</h1>
      </div>

      {/* Patient Banner */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-2xl">
            {patient.firstName?.[0]}{patient.lastName?.[0]}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-800">{patient.firstName} {patient.lastName}</h2>
            <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
              <span className="font-medium text-blue-600">{patient.patientNumber}</span>
              <span>•</span>
              <span>{patient.gender}</span>
              {age && <><span>•</span><span>{age} years old</span></>}
              <span>•</span>
              <span>{patient.phone}</span>
              {patient.bloodGroup && <><span>•</span><span className="font-medium">Blood: {patient.bloodGroup?.replace(/_/g," ")}</span></>}
            </div>
          </div>
          <div className="text-right">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              patient.patientType === "INPATIENT" ? "bg-blue-100 text-blue-700" :
              patient.patientType === "EMERGENCY" ? "bg-red-100 text-red-700" :
              "bg-green-100 text-green-700"
            }`}>{patient.patientType}</span>
            <p className="text-xs text-gray-400 mt-1">Registered {new Date(patient.createdAt).toLocaleDateString()}</p>
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
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "border-b-2 border-blue-600 text-blue-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            )
          })}
        </div>

        <div className="p-5">
          {/* Overview */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-700">Personal Information</h3>
                {[
                  ["Full Name", `${patient.firstName} ${patient.lastName}`],
                  ["Patient Number", patient.patientNumber],
                  ["Date of Birth", patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : "N/A"],
                  ["Gender", patient.gender],
                  ["Blood Group", patient.bloodGroup?.replace(/_/g," ") || "Unknown"],
                  ["Phone", patient.phone],
                  ["Email", patient.email || "N/A"],
                  ["Address", patient.address || "N/A"]
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-500">{label}</span>
                    <span className="text-sm font-medium text-gray-800">{value}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-700">Emergency Contact</h3>
                {[
                  ["Contact Name", patient.emergencyContactName || "N/A"],
                  ["Relationship", patient.emergencyContactRelation || "N/A"],
                  ["Phone", patient.emergencyContactPhone || "N/A"]
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-500">{label}</span>
                    <span className="text-sm font-medium text-gray-800">{value}</span>
                  </div>
                ))}
                <h3 className="font-semibold text-gray-700 mt-6">Medical Summary</h3>
                {[
                  ["Allergies", patient.allergies || "None recorded"],
                  ["Chronic Conditions", patient.chronicConditions || "None recorded"],
                  ["Total Visits", visits.length]
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-500">{label}</span>
                    <span className="text-sm font-medium text-gray-800">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visits */}
          {activeTab === "visits" && (
            <div className="space-y-3">
              {visits.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400">No visits recorded</p>
                </div>
              ) : (
                visits.map(visit => (
                  <div key={visit.id} className="border border-gray-200 rounded-xl p-4 hover:border-blue-200 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            visit.visitType === "EMERGENCY" ? "bg-red-100 text-red-700" :
                            visit.visitType === "IPD" ? "bg-blue-100 text-blue-700" :
                            "bg-green-100 text-green-700"
                          }`}>{visit.visitType}</span>
                          <p className="font-semibold text-gray-800">{visit.chiefComplaint || "General visit"}</p>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(visit.createdAt).toLocaleDateString()} {new Date(visit.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{visit.status?.replace(/_/g," ")}</span>
                        <button
                          onClick={() => navigate(`/doctor/consult/${visit.id}`)}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
                        >
                          View
                        </button>
                      </div>
                    </div>
                    {visit.vitalSigns?.[0] && (
                      <div className="mt-3 pt-3 border-t border-gray-100 flex gap-4 text-xs text-gray-500">
                        <span>BP: {visit.vitalSigns[0].bloodPressureSystolic}/{visit.vitalSigns[0].bloodPressureDiastolic}</span>
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

          {/* Labs */}
          {activeTab === "labs" && (
            <div className="text-center py-12">
              <FlaskConical className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">Lab Results</p>
              <p className="text-gray-300 text-sm">Results will appear here from laboratory module</p>
            </div>
          )}

          {/* Prescriptions */}
          {activeTab === "prescriptions" && (
            <div className="text-center py-12">
              <Pill className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">Prescription History</p>
              <p className="text-gray-300 text-sm">Prescriptions will appear here from pharmacy module</p>
            </div>
          )}

          {/* Admissions */}
          {activeTab === "admissions" && (
            <div className="text-center py-12">
              <BedDouble className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">Admission History</p>
              <p className="text-gray-300 text-sm">Admissions will appear here from IPD module</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}