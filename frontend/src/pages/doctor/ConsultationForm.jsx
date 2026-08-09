import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import api from "../../services/api"
import useAuthStore from "../../store/authStore"
import { toast } from "react-hot-toast"
import {
  User, Activity, FileText, FlaskConical, Pill,
  BedDouble, Save, CheckCircle, ChevronDown, ChevronUp,
  AlertTriangle, Heart, Thermometer, Wind, Bot, X, Plus, Trash2
} from "lucide-react"

const TABS = [
  { id: "subjective", label: "S - Subjective", icon: User },
  { id: "objective", label: "O - Objective", icon: Activity },
  { id: "assessment", label: "A - Assessment", icon: FileText },
  { id: "plan", label: "P - Plan", icon: CheckCircle }
]

const DEPT_TEMPLATES = {
  GENERAL: {
    systems: ["Cardiovascular","Respiratory","Gastrointestinal","Genitourinary","Musculoskeletal","Neurological","Skin/Integumentary"],
    commonDx: ["Malaria","Typhoid","Upper RTI","Hypertension","Diabetes Mellitus Type 2","Peptic Ulcer Disease","UTI","Anaemia","Gastroenteritis"]
  },
  OB_GYN: {
    systems: ["Obstetric History","Menstrual History","Gynaecological","Cardiovascular","Respiratory","Abdominal"],
    commonDx: ["Normal pregnancy","Pre-eclampsia","Gestational diabetes","Ectopic pregnancy","Fibroid uterus","PID","Menorrhagia","PCOS"]
  },
  PAEDIATRICS: {
    systems: ["Growth & Development","Immunization","Cardiovascular","Respiratory","Gastrointestinal","Neurological"],
    commonDx: ["Malaria","Pneumonia","Gastroenteritis","Malnutrition","Measles","Meningitis","Neonatal jaundice"]
  },
  SURGERY: {
    systems: ["Cardiovascular","Respiratory","Abdominal","Musculoskeletal","Wound/Skin","Neurological"],
    commonDx: ["Appendicitis","Hernia","Bowel obstruction","Fracture","Wound infection","Abscess"]
  },
  CARDIOLOGY: {
    systems: ["Cardiovascular","Respiratory","Peripheral Vascular","Neurological","Renal"],
    commonDx: ["Hypertension","Heart failure","Atrial fibrillation","Ischaemic heart disease","DVT","Pulmonary embolism"]
  }
}

export default function ConsultationForm() {
  const { visitId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState("subjective")
  const [visit, setVisit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [consultId, setConsultId] = useState(null)
  const [deptType, setDeptType] = useState("GENERAL")
  const [aiOpen, setAiOpen] = useState(false)
  const [labOrders, setLabOrders] = useState([])
  const [prescriptions, setPrescriptions] = useState([])
  const [labTests, setLabTests] = useState([])
  const [drugs, setDrugs] = useState([])
  const [showLabModal, setShowLabModal] = useState(false)
  const [showRxModal, setShowRxModal] = useState(false)

  const [form, setForm] = useState({
    // Subjective
    chiefComplaint: "",
    historyOfPresentingIllness: "",
    pastMedicalHistory: "",
    familyHistory: "",
    socialHistory: "",
    allergies: "",
    currentMedications: "",
    reviewOfSystems: {},
    // Objective
    generalExam: "",
    systemicExam: {},
    // Assessment
    diagnosis: "",
    differentialDiagnosis: "",
    icdCode: "",
    // Plan
    plan: "",
    notes: "",
    disposition: "OPD",
    followUpDate: "",
    followUpInstructions: ""
  })

  useEffect(() => {
    fetchVisit()
    fetchLabTests()
    fetchDrugs()
  }, [visitId])

  const fetchVisit = async () => {
    try {
      const res = await api.get(`/visits/${visitId}`)
      const v = res.data.data
      setVisit(v)
      if (v.consultation) {
        setConsultId(v.consultation.id)
        setForm(prev => ({ ...prev, ...v.consultation }))
        setLabOrders(v.consultation.labOrders || [])
        setPrescriptions(v.consultation.prescriptions || [])
      }
    } catch (e) {
      toast.error("Failed to load visit")
    } finally {
      setLoading(false)
    }
  }

  const fetchLabTests = async () => {
    try {
      const res = await api.get("/lab/tests")
      setLabTests(res.data.data || [])
    } catch (e) {}
  }

  const fetchDrugs = async () => {
    try {
      const res = await api.get("/pharmacy/drugs")
      setDrugs(res.data.data || [])
    } catch (e) {}
  }

  const handleSave = async (finalize = false) => {
    setSaving(true)
    try {
      const payload = { ...form, visitId, departmentType: deptType }
      let res
      if (consultId) {
        res = await api.put(`/consultations/${consultId}`, payload)
      } else {
        res = await api.post("/consultations", payload)
        setConsultId(res.data.data.id)
      }
      if (finalize) {
        await api.post(`/consultations/${res.data.data.id || consultId}/finalize`)
        toast.success("Consultation finalized!")
        navigate("/doctor")
      } else {
        toast.success("Saved as draft")
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const template = DEPT_TEMPLATES[deptType] || DEPT_TEMPLATES.GENERAL
  const vital = visit?.vitalSigns?.[0]

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500">Loading patient data...</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto">
      {/* Patient Banner */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
              {visit?.patient?.firstName?.[0]}{visit?.patient?.lastName?.[0]}
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-lg">
                {visit?.patient?.firstName} {visit?.patient?.lastName}
              </h2>
              <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
                <span>{visit?.patient?.patientNumber}</span>
                <span>•</span>
                <span>{visit?.patient?.gender}</span>
                <span>•</span>
                <span>{visit?.patient?.dateOfBirth ? Math.floor((Date.now() - new Date(visit.patient.dateOfBirth)) / 31557600000) : "?"} yrs</span>
                <span>•</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  visit?.visitType === "EMERGENCY" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                }`}>{visit?.visitType}</span>
              </div>
            </div>
          </div>

          {/* Vitals Summary */}
          {vital && (
            <div className="flex items-center gap-4 flex-wrap">
              {[
                { icon: Heart, label: "BP", value: `${vital.bloodPressureSystolic}/${vital.bloodPressureDiastolic}`, unit: "mmHg", alert: vital.bloodPressureSystolic > 140 },
                { icon: Activity, label: "HR", value: vital.heartRate, unit: "bpm", alert: vital.heartRate > 100 || vital.heartRate < 60 },
                { icon: Thermometer, label: "Temp", value: vital.temperature, unit: "°C", alert: vital.temperature > 37.5 },
                { icon: Wind, label: "SpO₂", value: vital.oxygenSaturation, unit: "%", alert: vital.oxygenSaturation < 95 },
                { icon: Activity, label: "RR", value: vital.respiratoryRate, unit: "/min", alert: vital.respiratoryRate > 20 }
              ].map(v => v.value && (
                <div key={v.label} className={`text-center p-2 rounded-lg border ${v.alert ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
                  <p className={`text-xs font-medium ${v.alert ? "text-red-600" : "text-gray-500"}`}>{v.label}</p>
                  <p className={`text-sm font-bold ${v.alert ? "text-red-700" : "text-gray-800"}`}>{v.value} <span className="text-xs font-normal">{v.unit}</span></p>
                </div>
              ))}
            </div>
          )}

          {/* Department Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Dept:</label>
            <select
              value={deptType}
              onChange={e => setDeptType(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="GENERAL">General Practice</option>
              <option value="OB_GYN">OB/GYN</option>
              <option value="PAEDIATRICS">Paediatrics</option>
              <option value="SURGERY">Surgery</option>
              <option value="CARDIOLOGY">Cardiology</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Main Form */}
        <div className="flex-1">
          {/* SOAP Tabs */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex border-b border-gray-100">
              {TABS.map(tab => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "bg-blue-600 text-white"
                        : "text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
                  </button>
                )
              })}
            </div>

            <div className="p-6 space-y-5">
              {/* SUBJECTIVE */}
              {activeTab === "subjective" && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Chief Complaint <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={form.chiefComplaint}
                      onChange={e => setForm(p => ({...p, chiefComplaint: e.target.value}))}
                      placeholder="Primary reason for visit..."
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">History of Presenting Illness</label>
                    <textarea
                      value={form.historyOfPresentingIllness}
                      onChange={e => setForm(p => ({...p, historyOfPresentingIllness: e.target.value}))}
                      placeholder="Onset, duration, character, aggravating/relieving factors, associated symptoms..."
                      rows={5}
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Past Medical History</label>
                      <textarea
                        value={form.pastMedicalHistory}
                        onChange={e => setForm(p => ({...p, pastMedicalHistory: e.target.value}))}
                        placeholder="Previous illnesses, surgeries, hospitalizations..."
                        rows={3}
                        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Family History</label>
                      <textarea
                        value={form.familyHistory}
                        onChange={e => setForm(p => ({...p, familyHistory: e.target.value}))}
                        placeholder="Relevant family medical history..."
                        rows={3}
                        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Allergies</label>
                      <input
                        value={form.allergies}
                        onChange={e => setForm(p => ({...p, allergies: e.target.value}))}
                        placeholder="Drug/food allergies and reactions..."
                        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Current Medications</label>
                      <input
                        value={form.currentMedications}
                        onChange={e => setForm(p => ({...p, currentMedications: e.target.value}))}
                        placeholder="Current medications and doses..."
                        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Review of Systems */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Review of Systems</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {template.systems.map(sys => (
                        <div key={sys} className="border border-gray-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-gray-600 mb-2">{sys}</p>
                          <textarea
                            value={form.reviewOfSystems?.[sys] || ""}
                            onChange={e => setForm(p => ({...p, reviewOfSystems: {...(p.reviewOfSystems||{}), [sys]: e.target.value}}))}
                            placeholder="Findings..."
                            rows={2}
                            className="w-full text-xs border border-gray-100 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* OBJECTIVE */}
              {activeTab === "objective" && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">General Examination</label>
                    <textarea
                      value={form.generalExam}
                      onChange={e => setForm(p => ({...p, generalExam: e.target.value}))}
                      placeholder="General appearance, conscious level, hydration, pallor, jaundice, cyanosis, clubbing, lymphadenopathy, oedema..."
                      rows={4}
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Systemic Examination</label>
                    <div className="space-y-3">
                      {template.systems.map(sys => (
                        <div key={sys} className="border border-gray-200 rounded-lg p-4">
                          <p className="text-sm font-semibold text-gray-700 mb-2">{sys}</p>
                          <textarea
                            value={form.systemicExam?.[sys] || ""}
                            onChange={e => setForm(p => ({...p, systemicExam: {...(p.systemicExam||{}), [sys]: e.target.value}}))}
                            placeholder={`${sys} findings...`}
                            rows={2}
                            className="w-full text-sm border border-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ASSESSMENT */}
              {activeTab === "assessment" && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Primary Diagnosis <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        value={form.diagnosis}
                        onChange={e => setForm(p => ({...p, diagnosis: e.target.value}))}
                        placeholder="Type diagnosis or select from common..."
                        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {template.commonDx.map(dx => (
                        <button
                          key={dx}
                          onClick={() => setForm(p => ({...p, diagnosis: dx}))}
                          className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors"
                        >
                          {dx}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Differential Diagnoses</label>
                    <textarea
                      value={form.differentialDiagnosis}
                      onChange={e => setForm(p => ({...p, differentialDiagnosis: e.target.value}))}
                      placeholder="List differential diagnoses in order of likelihood..."
                      rows={3}
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">ICD-10 Code</label>
                    <input
                      value={form.icdCode}
                      onChange={e => setForm(p => ({...p, icdCode: e.target.value}))}
                      placeholder="e.g. J18.9, B50, E11..."
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {/* PLAN */}
              {activeTab === "plan" && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Management Plan</label>
                    <textarea
                      value={form.plan}
                      onChange={e => setForm(p => ({...p, plan: e.target.value}))}
                      placeholder="Investigations ordered, treatment plan, procedures, referrals..."
                      rows={4}
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Disposition</label>
                      <select
                        value={form.disposition}
                        onChange={e => setForm(p => ({...p, disposition: e.target.value}))}
                        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="OPD">Discharge - OPD Follow-up</option>
                        <option value="ADMIT">Admit to Ward</option>
                        <option value="REFER">Refer to Specialist</option>
                        <option value="EMERGENCY">Transfer to Emergency</option>
                        <option value="THEATRE">Transfer to Theatre</option>
                        <option value="HOME">Discharge Home</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Follow-up Date</label>
                      <input
                        type="date"
                        value={form.followUpDate}
                        onChange={e => setForm(p => ({...p, followUpDate: e.target.value}))}
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Doctor Notes</label>
                    <textarea
                      value={form.notes}
                      onChange={e => setForm(p => ({...p, notes: e.target.value}))}
                      placeholder="Additional clinical notes, patient education, special instructions..."
                      rows={3}
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Lab Orders Summary */}
                  <div className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                        <FlaskConical className="w-4 h-4 text-purple-600" /> Lab Orders
                        {labOrders.length > 0 && <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">{labOrders.length}</span>}
                      </h3>
                      <button onClick={() => setShowLabModal(true)} className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Order Tests
                      </button>
                    </div>
                    {labOrders.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-3">No lab orders yet</p>
                    ) : (
                      <div className="space-y-2">
                        {labOrders.map(order => (
                          <div key={order.id} className="flex items-center justify-between bg-purple-50 rounded-lg px-3 py-2">
                            <span className="text-sm text-gray-700">{order.items?.map(i => i.labTest?.name).join(", ")}</span>
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{order.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Prescriptions Summary */}
                  <div className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                        <Pill className="w-4 h-4 text-green-600" /> Prescriptions
                        {prescriptions.length > 0 && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">{prescriptions.length}</span>}
                      </h3>
                      <button onClick={() => setShowRxModal(true)} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Prescribe
                      </button>
                    </div>
                    {prescriptions.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-3">No prescriptions yet</p>
                    ) : (
                      <div className="space-y-2">
                        {prescriptions.map(rx => (
                          <div key={rx.id} className="bg-green-50 rounded-lg px-3 py-2">
                            {rx.items?.map(item => (
                              <p key={item.id} className="text-sm text-gray-700">
                                {item.drug?.name} — {item.dose} {item.frequency} × {item.duration}
                              </p>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Navigation & Save */}
            <div className="border-t border-gray-100 p-4 flex items-center justify-between bg-gray-50">
              <div className="flex gap-2">
                {activeTab !== "subjective" && (
                  <button
                    onClick={() => setActiveTab(TABS[TABS.findIndex(t => t.id === activeTab) - 1].id)}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
                  >
                    ← Previous
                  </button>
                )}
                {activeTab !== "plan" && (
                  <button
                    onClick={() => setActiveTab(TABS[TABS.findIndex(t => t.id === activeTab) + 1].id)}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200"
                  >
                    Next →
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" /> Save Draft
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving || !form.chiefComplaint || !form.diagnosis}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  {saving ? "Saving..." : "Finalize & Sign"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* AI Sidebar */}
        <div className="w-72 flex-shrink-0">
          <MiniAIAssistant diagnosis={form.diagnosis} chiefComplaint={form.chiefComplaint} />
        </div>
      </div>

      {/* Lab Order Modal */}
      {showLabModal && (
        <LabOrderModal
          visitId={visitId}
          consultId={consultId}
          labTests={labTests}
          onClose={() => setShowLabModal(false)}
          onOrdered={(order) => { setLabOrders(p => [...p, order]); setShowLabModal(false) }}
        />
      )}

      {/* Prescription Modal */}
      {showRxModal && (
        <PrescriptionModal
          visitId={visitId}
          consultId={consultId}
          drugs={drugs}
          onClose={() => setShowRxModal(false)}
          onPrescribed={(rx) => { setPrescriptions(p => [...p, rx]); setShowRxModal(false) }}
        />
      )}
    </div>
  )
}

// ── Mini AI Assistant ────────────────────────────────────────
function MiniAIAssistant({ diagnosis, chiefComplaint }) {
  const [query, setQuery] = useState("")
  const [response, setResponse] = useState("")
  const [loading, setLoading] = useState(false)

  const QUICK = [
    { label: "Dosage guide", q: "dosage for " + (diagnosis || "condition") },
    { label: "Differentials", q: "differential diagnosis for " + (chiefComplaint || "symptoms") },
    { label: "ICD code", q: "ICD-10 code for " + (diagnosis || "diagnosis") },
    { label: "Investigations", q: "investigations for " + (diagnosis || "condition") }
  ]

  const ask = async (q) => {
    setLoading(true)
    setResponse("")
    await new Promise(r => setTimeout(r, 600))
    setResponse(`Clinical guidance for: **${q}**\n\nBased on current guidelines, consider standard protocols and patient-specific factors. Always verify with latest clinical references.\n\nFor specific dosages, check formulary and patient renal/hepatic function.`)
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm sticky top-4">
      <div className="bg-gradient-to-r from-blue-800 to-blue-600 rounded-t-xl p-4">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-white" />
          <p className="text-white font-semibold text-sm">Clinical AI</p>
        </div>
        <p className="text-blue-200 text-xs mt-1">Real-time clinical support</p>
      </div>

      <div className="p-4 space-y-3">
        {diagnosis && (
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Current diagnosis:</p>
            <p className="text-sm font-medium text-blue-700">{diagnosis}</p>
          </div>
        )}

        <div className="space-y-2">
          {QUICK.map(q => (
            <button
              key={q.label}
              onClick={() => ask(q.q)}
              className="w-full text-left text-xs bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-700 px-3 py-2 rounded-lg transition-colors"
            >
              {q.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && ask(query)}
            placeholder="Ask clinical question..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 pr-16"
          />
          <button
            onClick={() => ask(query)}
            className="absolute right-1 top-1 bg-blue-600 text-white text-xs px-2 py-1 rounded"
          >Ask</button>
        </div>

        {loading && (
          <div className="flex gap-1 justify-center py-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:"0.1s"}} />
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:"0.2s"}} />
          </div>
        )}

        {response && (
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 whitespace-pre-line max-h-48 overflow-y-auto">
            {response}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Lab Order Modal ──────────────────────────────────────────
function LabOrderModal({ visitId, consultId, labTests, onClose, onOrdered }) {
  const [selected, setSelected] = useState([])
  const [urgency, setUrgency] = useState("ROUTINE")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState("")
  const categories = [...new Set(labTests.map(t => t.category))]

  const filteredTests = labTests.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (testId) => {
    setSelected(p => p.includes(testId) ? p.filter(x => x !== testId) : [...p, testId])
  }

  const submit = async () => {
    if (!selected.length) { toast.error("Select at least one test"); return }
    setSubmitting(true)
    try {
      const res = await api.post("/lab/orders", {
        visitId,
        consultationId: consultId,
        urgency,
        notes,
        items: selected.map(testId => ({ labTestId: testId }))
      })
      toast.success("Lab order created!")
      onOrdered(res.data.data)
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to create lab order")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-purple-600" /> Order Laboratory Tests
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          <div className="flex gap-3">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tests..."
              className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <select
              value={urgency}
              onChange={e => setUrgency(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
            >
              <option value="ROUTINE">Routine</option>
              <option value="URGENT">Urgent</option>
              <option value="STAT">STAT</option>
            </select>
          </div>

          {selected.length > 0 && (
            <div className="bg-purple-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-purple-700 mb-2">{selected.length} test(s) selected — Total: KES {labTests.filter(t => selected.includes(t.id)).reduce((s, t) => s + (t.price || 0), 0).toLocaleString()}</p>
              <div className="flex flex-wrap gap-1">
                {selected.map(id => {
                  const t = labTests.find(x => x.id === id)
                  return t ? (
                    <span key={id} className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                      {t.name}
                      <button onClick={() => toggle(id)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                    </span>
                  ) : null
                })}
              </div>
            </div>
          )}

          {categories.map(cat => {
            const tests = filteredTests.filter(t => t.category === cat)
            if (!tests.length) return null
            return (
              <div key={cat}>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{cat}</h4>
                <div className="grid grid-cols-2 gap-2">
                  {tests.map(test => (
                    <label key={test.id} className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      selected.includes(test.id) ? "border-purple-300 bg-purple-50" : "border-gray-200 hover:border-purple-200"
                    }`}>
                      <input type="checkbox" checked={selected.includes(test.id)} onChange={() => toggle(test.id)} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 leading-tight">{test.name}</p>
                        <p className="text-xs text-gray-400">{test.code} • TAT: {test.turnaroundHours}h</p>
                        <p className="text-xs font-semibold text-purple-600">KES {test.price?.toLocaleString()}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="p-5 border-t border-gray-100 flex gap-3">
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Clinical notes for lab..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
          />
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={!selected.length || submitting} className="px-6 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
            {submitting ? "Ordering..." : `Order ${selected.length} Test(s)`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Prescription Modal ───────────────────────────────────────
function PrescriptionModal({ visitId, consultId, drugs, onClose, onPrescribed }) {
  const [items, setItems] = useState([{ drugId: "", dose: "", frequency: "", duration: "", quantity: 1, instructions: "" }])
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState("")

  const filteredDrugs = drugs.filter(d => d.name?.toLowerCase().includes(search.toLowerCase()) || d.genericName?.toLowerCase().includes(search.toLowerCase()))

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  const addItem = () => setItems(p => [...p, { drugId: "", dose: "", frequency: "", duration: "", quantity: 1, instructions: "" }])
  const removeItem = (idx) => setItems(p => p.filter((_, i) => i !== idx))

  const submit = async () => {
    const valid = items.filter(i => i.drugId && i.dose && i.frequency && i.duration)
    if (!valid.length) { toast.error("Fill in all required fields"); return }
    setSubmitting(true)
    try {
      const res = await api.post("/pharmacy/prescriptions", {
        visitId,
        consultationId: consultId,
        items: valid.map(i => ({ ...i, quantity: parseInt(i.quantity) }))
      })
      toast.success("Prescription created!")
      onPrescribed(res.data.data)
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to create prescription")
    } finally {
      setSubmitting(false)
    }
  }

  const FREQUENCIES = ["OD","BD","TDS","QDS","5x daily","SOS","Nocte","Mane","Stat","Weekly"]
  const DURATIONS = ["1 day","2 days","3 days","5 days","7 days","10 days","14 days","1 month","2 months","3 months","Ongoing"]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Pill className="w-5 h-5 text-green-600" /> Write Prescription
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">Drug #{idx + 1}</p>
                {items.length > 1 && (
                  <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Drug Name <span className="text-red-500">*</span></label>
                <select
                  value={item.drugId}
                  onChange={e => updateItem(idx, "drugId", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select drug...</option>
                  {drugs.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.genericName || d.category})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Dose <span className="text-red-500">*</span></label>
                  <input
                    value={item.dose}
                    onChange={e => updateItem(idx, "dose", e.target.value)}
                    placeholder="e.g. 500mg"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Frequency <span className="text-red-500">*</span></label>
                  <select
                    value={item.frequency}
                    onChange={e => updateItem(idx, "frequency", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select...</option>
                    {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Duration <span className="text-red-500">*</span></label>
                  <select
                    value={item.duration}
                    onChange={e => updateItem(idx, "duration", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select...</option>
                    {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={e => updateItem(idx, "quantity", e.target.value)}
                    min={1}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Special Instructions</label>
                <input
                  value={item.instructions}
                  onChange={e => updateItem(idx, "instructions", e.target.value)}
                  placeholder="e.g. Take with food, Avoid alcohol..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          ))}

          <button onClick={addItem} className="w-full border-2 border-dashed border-green-200 text-green-600 py-3 rounded-xl hover:border-green-400 hover:bg-green-50 transition-colors text-sm font-medium flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Add Another Drug
          </button>
        </div>

        <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={submitting} className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {submitting ? "Prescribing..." : "Issue Prescription"}
          </button>
        </div>
      </div>
    </div>
  )
}