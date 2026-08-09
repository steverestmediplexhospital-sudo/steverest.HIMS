// frontend/src/pages/ipd/IPDPage.jsx
import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import useAuthStore from "../../store/authStore"
import api from "../../services/api"
import toast from "react-hot-toast"
import {
  BedDouble, Users, Activity, AlertTriangle, Plus,
  Search, Filter, RefreshCw, ArrowRight, Clock,
  CheckCircle, X, ChevronDown, ChevronRight,
  Thermometer, Heart, Wind, Droplets, UserPlus,
  LogOut, ArrowLeftRight, Building2, Stethoscope,
  FileText, Pill, FlaskConical, Eye, Edit,
  TrendingUp, BarChart3, MapPin, Calendar,
  Phone, User, Hash, Zap, Printer
} from "lucide-react"
import { printDischargeSummary } from "../../services/pdfPrint"

// ─── Constants ────────────────────────────────────────────────────────────────
const BED_STATUS_CONFIG = {
  AVAILABLE:   { color: "green",  bg: "bg-green-100",  text: "text-green-700",  border: "border-green-300",  label: "Available"   },
  OCCUPIED:    { color: "red",    bg: "bg-red-100",    text: "text-red-700",    border: "border-red-300",    label: "Occupied"    },
  RESERVED:    { color: "yellow", bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-300", label: "Reserved"    },
  CLEANING:    { color: "blue",   bg: "bg-blue-100",   text: "text-blue-700",   border: "border-blue-300",   label: "Cleaning"    },
  MAINTENANCE: { color: "gray",   bg: "bg-gray-100",   text: "text-gray-700",   border: "border-gray-300",   label: "Maintenance" },
  ISOLATION:   { color: "purple", bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-300", label: "Isolation"   }
}

const TRIAGE_COLORS = {
  IMMEDIATE:   "bg-red-600 text-white",
  URGENT:      "bg-orange-500 text-white",
  LESS_URGENT: "bg-yellow-500 text-white",
  NON_URGENT:  "bg-green-500 text-white"
}

// ─── Utility ──────────────────────────────────────────────────────────────────
const calcAge = (dob) => {
  if (!dob) return "N/A"
  const years = Math.floor(
    (new Date() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000)
  )
  return `${years}y`
}

const calcLOS = (admittedAt) => {
  if (!admittedAt) return 0
  return Math.ceil((new Date() - new Date(admittedAt)) / (1000 * 60 * 60 * 24))
}

const formatTime = (dt) =>
  dt ? new Date(dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"

const formatDate = (dt) =>
  dt
    ? new Date(dt).toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric"
      })
    : "--"

// ─── Helper: build printDischargeSummary payload from admission ───────────────
const buildDischargePrintPayload = (admission, dischargeForm = {}) => {
  const patient  = admission.patient || {}
  const consult  = admission.visit?.consultations?.[0] || {}
  const doctor   = consult.doctor || {}
  const rx       = admission.visit?.prescriptions?.[0]?.items || []

  return {
    patient: {
      fullName:    `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "—",
      patientId:   patient.mrn || patient.patientNumber || patient.id || "—",
      dateOfBirth: patient.dateOfBirth || null,
      gender:      patient.gender || "—",
      bloodGroup:  patient.bloodGroup?.replace("_", " ") || "—",
    },
    doctor: {
      name:           doctor.firstName
        ? `${doctor.firstName} ${doctor.lastName || ""}`.trim()
        : "—",
      specialization: doctor.specialization || "Medical Officer",
    },
    admission: {
      admissionNumber: admission.admissionNumber || "—",
      admittedAt:      admission.admittedAt,
      dischargedAt:    admission.dischargedAt || new Date().toISOString(),
      ward:  { name: admission.ward?.name || "—" },
      bed:   { bedNumber: admission.bed?.bedNumber || "—" },
    },
    diagnosis: consult.assessment || consult.diagnosis || dischargeForm.dischargeNotes || "—",
    procedures: consult.plan || "—",
    dischargeMedications: rx.map(item => ({
      drugName:     item.drug?.name || item.drugName || "—",
      dose:         item.dosage || "—",
      frequency:    item.frequency || "—",
      duration:     item.duration || "—",
      instructions: item.instructions || "As directed",
    })),
    condition:      dischargeForm.dischargeType === "HOME"           ? "Stable — Discharged Home"
                  : dischargeForm.dischargeType === "TRANSFER"       ? "Transferred to Another Facility"
                  : dischargeForm.dischargeType === "AGAINST_ADVICE" ? "Discharged Against Medical Advice"
                  : dischargeForm.dischargeType === "DECEASED"       ? "Deceased"
                  : "Stable",
    followUpDate:  dischargeForm.followUpDate  || null,
    followUpNotes: dischargeForm.followUpNotes || dischargeForm.dischargeNotes || "",
    docNumber:     admission.admissionNumber || admission.id,
  }
}

// ─── Sub-Components ───────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, color, sub }) => (
  <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
    <div className={`w-10 h-10 rounded-xl bg-${color}-100 flex items-center justify-center mb-3`}>
      <Icon className={`w-5 h-5 text-${color}-600`} />
    </div>
    <p className="text-2xl font-bold text-gray-800">{value ?? 0}</p>
    <p className="text-sm font-medium text-gray-600 mt-0.5">{label}</p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </div>
)

// ─── Bed Cell ─────────────────────────────────────────────────────────────────
const BedCell = ({ bed, onBedClick }) => {
  const cfg       = BED_STATUS_CONFIG[bed.status] || BED_STATUS_CONFIG.AVAILABLE
  const admission = bed.admissions?.[0]
  const patient   = admission?.patient

  return (
    <div
      onClick={() => onBedClick(bed)}
      className={`
        relative p-3 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md
        ${cfg.bg} ${cfg.border}
        ${bed.status === "OCCUPIED" ? "min-h-[110px]" : "min-h-[80px]"}
      `}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-bold ${cfg.text}`}>🛏 {bed.bedNumber}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>
          {cfg.label}
        </span>
      </div>

      {bed.status === "OCCUPIED" && patient && (
        <div className="mt-1">
          <p className="text-xs font-semibold text-gray-800 truncate">
            {patient.firstName} {patient.lastName}
          </p>
          <p className="text-xs text-gray-500">{patient.mrn}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            LOS: {calcLOS(admission?.admittedAt)}d
          </p>
          {admission?.visit?.triage && (
            <span className={`
              text-xs px-1.5 py-0.5 rounded mt-1 inline-block
              ${TRIAGE_COLORS[admission.visit.triage.triageLevel] || "bg-gray-200 text-gray-700"}
            `}>
              {admission.visit.triage.triageLevel}
            </span>
          )}
        </div>
      )}

      {bed.status === "AVAILABLE" && (
        <div className="flex items-center justify-center h-8 mt-1">
          <Plus className={`w-5 h-5 ${cfg.text} opacity-50`} />
        </div>
      )}
    </div>
  )
}

// ─── Ward View ────────────────────────────────────────────────────────────────
const WardView = ({ wards, loading, onBedClick }) => {
  const [expandedWards, setExpandedWards] = useState({})

  const toggleWard = (wardId) =>
    setExpandedWards(prev => ({ ...prev, [wardId]: !prev[wardId] }))

  if (loading) return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-3" />
          <div className="grid grid-cols-6 gap-2">
            {[...Array(6)].map((_, j) => (
              <div key={j} className="h-20 bg-gray-100 rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  if (!wards.length) return (
    <div className="bg-white rounded-xl p-16 text-center border border-gray-100">
      <Building2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
      <p className="text-gray-400 font-medium">No wards configured</p>
      <p className="text-gray-300 text-sm">Contact administrator to set up wards</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {wards.map(ward => {
        const allBeds   = ward.rooms?.flatMap(r => r.beds) || []
        const available = allBeds.filter(b => b.status === "AVAILABLE").length
        const occupied  = allBeds.filter(b => b.status === "OCCUPIED").length
        const occupancy = allBeds.length
          ? Math.round((occupied / allBeds.length) * 100)
          : 0
        const isExpanded = expandedWards[ward.id] !== false

        return (
          <div key={ward.id}
            className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div
              onClick={() => toggleWard(ward.id)}
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{ward.name}</h3>
                  <p className="text-xs text-gray-500">
                    {ward.code} • {ward.wardType || "General"} • Capacity: {allBeds.length}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden sm:block">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          occupancy > 90 ? "bg-red-500" :
                          occupancy > 70 ? "bg-orange-500" : "bg-green-500"
                        }`}
                        style={{ width: `${occupancy}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{occupancy}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-green-600 font-medium">{available} free</span>
                  <span className="text-red-500 font-medium">{occupied} occupied</span>
                </div>
                {isExpanded
                  ? <ChevronDown className="w-4 h-4 text-gray-400" />
                  : <ChevronRight className="w-4 h-4 text-gray-400" />
                }
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-gray-100 p-4 space-y-4">
                {ward.rooms?.map(room => (
                  <div key={room.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">
                        {room.roomNumber} — {room.roomType || "General Room"}
                      </span>
                      <span className="text-xs text-gray-400">
                        ({room.beds?.length || 0} beds)
                      </span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                      {room.beds?.map(bed => (
                        <BedCell key={bed.id} bed={bed} onBedClick={onBedClick} />
                      ))}
                    </div>
                  </div>
                ))}

                <div className="flex items-center gap-3 pt-2 flex-wrap">
                  {Object.entries(BED_STATUS_CONFIG).map(([key, cfg]) => (
                    <div key={key} className="flex items-center gap-1">
                      <div className={`w-3 h-3 rounded ${cfg.bg} border ${cfg.border}`} />
                      <span className="text-xs text-gray-500">{cfg.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Admission List View ──────────────────────────────────────────────────────
const AdmissionList = ({
  admissions, loading, onViewAdmission,
  onDischarge, onTransfer, userRole, onPrintDischarge
}) => {
  if (loading) return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl p-4 animate-pulse flex gap-4">
          <div className="w-12 h-12 bg-gray-200 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
            <div className="h-3 bg-gray-100 rounded w-1/4" />
          </div>
        </div>
      ))}
    </div>
  )

  if (!admissions.length) return (
    <div className="bg-white rounded-xl p-16 text-center border border-gray-100">
      <BedDouble className="w-12 h-12 text-gray-200 mx-auto mb-3" />
      <p className="text-gray-400 font-medium">No active admissions</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {admissions.map(adm => {
        const patient    = adm.patient
        const vitals     = adm.visit?.vitalSigns?.[0]
        const consult    = adm.visit?.consultations?.[0]
        const los        = calcLOS(adm.admittedAt)
        const isDischarge = adm.status === "DISCHARGED"

        return (
          <div key={adm.id}
            className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all"
          >
            <div className="p-4">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center
                  text-white font-bold text-lg flex-shrink-0
                  ${patient?.gender === "MALE" ? "bg-blue-500" : "bg-pink-500"}
                `}>
                  {patient?.firstName?.[0]}{patient?.lastName?.[0]}
                </div>

                {/* Patient Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        {patient?.firstName} {patient?.lastName}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-500">{patient?.mrn}</span>
                        <span className="text-gray-300">•</span>
                        <span className="text-xs text-gray-500">
                          {patient?.gender} • {calcAge(patient?.dateOfBirth)}
                        </span>
                        {patient?.bloodGroup && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span className="text-xs font-medium text-red-600">
                              {patient.bloodGroup.replace("_", " ")}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                        {adm.admissionNumber}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        los > 7
                          ? "bg-orange-100 text-orange-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        Day {los}
                      </span>
                    </div>
                  </div>

                  {/* Location & Doctor */}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      <span>{adm.ward?.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <BedDouble className="w-3 h-3" />
                      <span>Bed {adm.bed?.bedNumber}</span>
                    </div>
                    {consult?.doctor && (
                      <div className="flex items-center gap-1">
                        <Stethoscope className="w-3 h-3" />
                        <span>
                          Dr. {consult.doctor.firstName} {consult.doctor.lastName}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>Admitted: {formatDate(adm.admittedAt)}</span>
                    </div>
                  </div>

                  {adm.admissionReason && (
                    <p className="text-xs text-gray-600 mt-1 bg-gray-50 px-2 py-1 rounded">
                      <span className="font-medium">Reason: </span>
                      {adm.admissionReason}
                    </p>
                  )}

                  {vitals && (
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {vitals.bloodPressureSystolic && (
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <Activity className="w-3 h-3 text-red-400" />
                          <span>
                            {vitals.bloodPressureSystolic}/{vitals.bloodPressureDiastolic}
                          </span>
                        </div>
                      )}
                      {vitals.temperature && (
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <Thermometer className="w-3 h-3 text-orange-400" />
                          <span>{vitals.temperature}°C</span>
                        </div>
                      )}
                      {vitals.pulse && (
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <Heart className="w-3 h-3 text-pink-400" />
                          <span>{vitals.pulse} bpm</span>
                        </div>
                      )}
                      {vitals.oxygenSaturation && (
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <Droplets className="w-3 h-3 text-blue-400" />
                          <span>SpO2: {vitals.oxygenSaturation}%</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {adm.visit?.labOrders?.length > 0 && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                        <FlaskConical className="w-3 h-3 inline mr-1" />
                        {adm.visit.labOrders.length} Lab
                      </span>
                    )}
                    {adm.visit?.prescriptions?.length > 0 && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        <Pill className="w-3 h-3 inline mr-1" />
                        {adm.visit.prescriptions.length} Rx Pending
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => onViewAdmission(adm)}
                    className="flex items-center gap-1 text-xs bg-blue-600 text-white
                               px-3 py-1.5 rounded-lg hover:bg-blue-700"
                  >
                    <Eye className="w-3 h-3" /> View
                  </button>

                  {/* Print Discharge Summary — always available */}
                  <button
                    onClick={() => onPrintDischarge(adm)}
                    title="Print Discharge Summary"
                    className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700
                               border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-100"
                  >
                    <Printer className="w-3 h-3" /> Summary
                  </button>

                  {["DOCTOR","NURSE","CLINICAL_COORDINATOR",
                    "SUPER_ADMIN","HOSPITAL_ADMIN"].includes(userRole) && (
                    <>
                      <button
                        onClick={() => onTransfer(adm)}
                        className="flex items-center gap-1 text-xs bg-yellow-500 text-white
                                   px-3 py-1.5 rounded-lg hover:bg-yellow-600"
                      >
                        <ArrowLeftRight className="w-3 h-3" /> Transfer
                      </button>
                      <button
                        onClick={() => onDischarge(adm)}
                        className="flex items-center gap-1 text-xs bg-red-500 text-white
                                   px-3 py-1.5 rounded-lg hover:bg-red-600"
                      >
                        <LogOut className="w-3 h-3" /> Discharge
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Admit Patient Modal ──────────────────────────────────────────────────────
const AdmitModal = ({ isOpen, onClose, onSuccess, selectedBed }) => {
  const [form, setForm] = useState({
    patientSearch: "", patientId: "", patientName: "",
    wardId: "", bedId: selectedBed?.id || "",
    admissionReason: "", admittingDoctorId: ""
  })
  const [patients,  setPatients]  = useState([])
  const [wards,     setWards]     = useState([])
  const [beds,      setBeds]      = useState([])
  const [searching, setSearching] = useState(false)
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchWards()
      if (selectedBed) {
        setForm(prev => ({
          ...prev,
          bedId:  selectedBed.id,
          wardId: selectedBed.room?.ward?.id || ""
        }))
      }
    }
  }, [isOpen, selectedBed])

  const fetchWards = async () => {
    try {
      const r = await api.get("/admissions/wards")
      setWards(r.data.wards || r.data.data || [])
    } catch { toast.error("Failed to load wards") }
  }

  const fetchBeds = async (wardId) => {
    try {
      const r = await api.get(`/admissions/beds?status=AVAILABLE&wardId=${wardId}`)
      setBeds(r.data.beds || r.data.data || [])
    } catch {}
  }

  const searchPatients = async (q) => {
    if (q.length < 2) { setPatients([]); return }
    setSearching(true)
    try {
      const r = await api.get(`/patients?search=${q}&limit=5`)
      setPatients(r.data.data?.patients || r.data.patients || [])
    } catch {} finally { setSearching(false) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.patientId || !form.bedId || !form.wardId) {
      return toast.error("Patient, ward and bed are required")
    }
    setSaving(true)
    try {
      const visitRes = await api.post("/visits", {
        patientId:      form.patientId,
        visitType:      "IPD",
        chiefComplaint: form.admissionReason
      })
      const visitId = visitRes.data.data?.visit?.id || visitRes.data.visit?.id

      await api.post("/admissions", {
        visitId,
        bedId:             form.bedId,
        wardId:            form.wardId,
        admissionReason:   form.admissionReason,
        admittingDoctorId: form.admittingDoctorId || undefined
      })

      toast.success("Patient admitted successfully!")
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to admit patient")
    } finally { setSaving(false) }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-600" /> Admit Patient
          </h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Patient Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={form.patientSearch}
                onChange={e => {
                  setForm(prev => ({ ...prev, patientSearch: e.target.value }))
                  searchPatients(e.target.value)
                }}
                placeholder="Search by name or MRN..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm
                           focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {patients.length > 0 && (
              <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden">
                {patients.map(p => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setForm(prev => ({
                        ...prev,
                        patientId:     p.id,
                        patientSearch: `${p.firstName} ${p.lastName} (${p.mrn})`,
                        patientName:   `${p.firstName} ${p.lastName}`
                      }))
                      setPatients([])
                    }}
                    className="p-2 hover:bg-gray-50 cursor-pointer text-sm
                               border-b border-gray-100 last:border-0"
                  >
                    <span className="font-medium">{p.firstName} {p.lastName}</span>
                    <span className="text-gray-400 ml-2">{p.mrn}</span>
                    <span className="text-gray-400 ml-2">
                      {p.gender} • {calcAge(p.dateOfBirth)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {form.patientId && (
              <div className="mt-1 text-xs text-green-600 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> {form.patientName} selected
              </div>
            )}
          </div>

          {/* Ward */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ward *</label>
            <select
              value={form.wardId}
              onChange={e => {
                setForm(prev => ({ ...prev, wardId: e.target.value, bedId: "" }))
                if (e.target.value) fetchBeds(e.target.value)
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm
                         focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select ward...</option>
              {wards.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.availableBeds ?? "?"} available)
                </option>
              ))}
            </select>
          </div>

          {/* Bed */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bed *</label>
            <select
              value={form.bedId}
              onChange={e => setForm(prev => ({ ...prev, bedId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm
                         focus:ring-2 focus:ring-indigo-500"
              disabled={!form.wardId}
            >
              <option value="">
                {form.wardId ? "Select available bed..." : "Select ward first"}
              </option>
              {beds.map(b => (
                <option key={b.id} value={b.id}>
                  Bed {b.bedNumber} — {b.room?.roomNumber || ""}
                </option>
              ))}
              {selectedBed && selectedBed.status === "AVAILABLE" && (
                <option value={selectedBed.id}>
                  Bed {selectedBed.bedNumber} (Selected)
                </option>
              )}
            </select>
          </div>

          {/* Admission Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Admission
            </label>
            <textarea
              value={form.admissionReason}
              onChange={e => setForm(prev => ({ ...prev, admissionReason: e.target.value }))}
              rows={3}
              placeholder="Chief complaint / reason for admission..."
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm
                         focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl
                         hover:bg-gray-50 text-sm font-medium"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl
                         hover:bg-indigo-700 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Admitting..." : "Admit Patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Discharge Modal ──────────────────────────────────────────────────────────
const DischargeModal = ({ isOpen, admission, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    dischargeNotes: "",
    dischargeType:  "HOME",
    followUpDate:   "",
    followUpNotes:  ""
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.patch(`/admissions/${admission.id}/discharge`, form)
      toast.success("Patient discharged successfully!")

      // Auto-print discharge summary after successful discharge
      setTimeout(() => {
        const confirmed = window.confirm(
          "Patient discharged. Print discharge summary now?"
        )
        if (confirmed) {
          printDischargeSummary(buildDischargePrintPayload(admission, form))
        }
      }, 500)

      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to discharge")
    } finally { setSaving(false) }
  }

  if (!isOpen || !admission) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <LogOut className="w-5 h-5 text-red-500" /> Discharge Patient
          </h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-5">
          <div className="bg-gray-50 rounded-xl p-3 mb-4">
            <p className="font-medium text-gray-800">
              {admission.patient?.firstName} {admission.patient?.lastName}
            </p>
            <p className="text-sm text-gray-500">
              {admission.admissionNumber} • {admission.ward?.name} • Bed {admission.bed?.bedNumber}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discharge Type *
              </label>
              <select
                value={form.dischargeType}
                onChange={e => setForm(prev => ({ ...prev, dischargeType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
              >
                <option value="HOME">Discharged Home</option>
                <option value="TRANSFER">Transferred to Another Facility</option>
                <option value="AGAINST_ADVICE">Discharged Against Medical Advice</option>
                <option value="DECEASED">Deceased</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discharge Notes
              </label>
              <textarea
                value={form.dischargeNotes}
                onChange={e => setForm(prev => ({ ...prev, dischargeNotes: e.target.value }))}
                rows={3}
                placeholder="Discharge summary, follow-up instructions..."
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
              />
            </div>

            {/* Follow-up fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Follow-up Date
                </label>
                <input
                  type="date"
                  value={form.followUpDate}
                  onChange={e => setForm(prev => ({ ...prev, followUpDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Follow-up Notes
                </label>
                <input
                  value={form.followUpNotes}
                  onChange={e => setForm(prev => ({ ...prev, followUpNotes: e.target.value }))}
                  placeholder="e.g. Review wound"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                />
              </div>
            </div>

            {form.dischargeType === "DECEASED" && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                ⚠️ This will trigger automatic mortuary workflow notification.
              </div>
            )}

            {/* Print hint */}
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Printer className="w-3.5 h-3.5" />
              Discharge summary will auto-print after confirmation
            </p>

            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700
                           rounded-xl text-sm font-medium"
              >
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className={`flex-1 py-2.5 text-white rounded-xl text-sm font-medium
                            disabled:opacity-50 ${
                  form.dischargeType === "DECEASED"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {saving ? "Processing..." : "Confirm Discharge"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Admission Detail Drawer ──────────────────────────────────────────────────
const AdmissionDetailDrawer = ({ admission, onClose, onPrintDischarge }) => {
  if (!admission) return null
  const patient = admission.patient
  const vitals  = admission.visit?.vitalSigns?.[0]

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
      <div className="w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5
                        flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Admission Details</h2>
          <div className="flex items-center gap-2">
            {/* Print discharge summary from drawer */}
            <button
              onClick={() => onPrintDischarge(admission)}
              className="flex items-center gap-1.5 text-sm bg-indigo-50 text-indigo-700
                         border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-100"
            >
              <Printer className="w-4 h-4" /> Print Summary
            </button>
            <button onClick={onClose}>
              <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Patient Card */}
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-4">
            <div className="flex items-center gap-4">
              <div className={`
                w-14 h-14 rounded-full flex items-center justify-center
                text-white font-bold text-xl
                ${patient?.gender === "MALE" ? "bg-blue-500" : "bg-pink-500"}
              `}>
                {patient?.firstName?.[0]}{patient?.lastName?.[0]}
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg">
                  {patient?.firstName} {patient?.lastName}
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{patient?.mrn}</span>
                  <span>•</span>
                  <span>{patient?.gender}</span>
                  <span>•</span>
                  <span>{calcAge(patient?.dateOfBirth)}</span>
                </div>
                {patient?.bloodGroup && (
                  <span className="text-sm font-semibold text-red-600 mt-0.5 block">
                    Blood: {patient.bloodGroup.replace("_", " ")}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Admission Info */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Admission #", value: admission.admissionNumber },
              { label: "Ward",        value: admission.ward?.name },
              { label: "Bed",         value: `Bed ${admission.bed?.bedNumber}` },
              { label: "Day",         value: `Day ${calcLOS(admission.admittedAt)}` },
              { label: "Admitted",    value: formatDate(admission.admittedAt) },
              { label: "Status",      value: admission.status }
            ].map(item => (
              <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="font-semibold text-gray-800 text-sm mt-0.5">
                  {item.value || "—"}
                </p>
              </div>
            ))}
          </div>

          {/* Vitals */}
          {vitals && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Activity className="w-4 h-4 text-red-500" /> Latest Vitals
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: "BP",
                    value: vitals.bloodPressureSystolic
                      ? `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic}`
                      : null,
                    icon: Activity
                  },
                  { label: "Temp",  value: vitals.temperature       ? `${vitals.temperature}°C`        : null, icon: Thermometer },
                  { label: "Pulse", value: vitals.pulse             ? `${vitals.pulse} bpm`            : null, icon: Heart       },
                  { label: "SpO2",  value: vitals.oxygenSaturation  ? `${vitals.oxygenSaturation}%`   : null, icon: Droplets    },
                  { label: "RR",    value: vitals.respiratoryRate   ? `${vitals.respiratoryRate}/min`  : null, icon: Wind        },
                  { label: "Pain",  value: vitals.painScore != null ? `${vitals.painScore}/10`         : null, icon: Zap         }
                ].filter(v => v.value).map(v => (
                  <div key={v.label} className="bg-gray-50 rounded-xl p-2 text-center">
                    <p className="text-xs text-gray-500">{v.label}</p>
                    <p className="font-semibold text-gray-800 text-sm">{v.value}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Recorded: {formatTime(vitals.recordedAt)}
              </p>
            </div>
          )}

          {/* Admission Reason */}
          {admission.admissionReason && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Admission Reason</h4>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3">
                {admission.admissionReason}
              </p>
            </div>
          )}

          {/* Allergies */}
          {patient?.allergies?.length > 0 && (
            <div>
              <h4 className="font-semibold text-red-600 mb-2 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> Allergies
              </h4>
              <div className="flex flex-wrap gap-2">
                {patient.allergies.map((a, i) => (
                  <span key={i}
                    className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                    {a.allergen} ({a.severity})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "View Full Chart", icon: FileText,     color: "blue",   path: `/doctor/patient/${patient?.id}` },
              { label: "Order Lab Test",  icon: FlaskConical, color: "purple", path: "/laboratory" },
              { label: "Pharmacy",        icon: Pill,         color: "green",  path: "/pharmacy"   },
              { label: "Doctor Notes",    icon: Stethoscope,  color: "indigo", path: "/doctor"     },
            ].map(action => (
              <a
                key={action.label}
                href={action.path}
                className={`flex items-center gap-2 p-3 bg-${action.color}-50
                            text-${action.color}-700 rounded-xl text-sm font-medium
                            hover:bg-${action.color}-100 transition-colors`}
              >
                <action.icon className="w-4 h-4" />
                {action.label}
              </a>
            ))}
          </div>

          {/* Print discharge summary — bottom of drawer */}
          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={() => onPrintDischarge(admission)}
              className="w-full flex items-center justify-center gap-2 py-3
                         bg-indigo-600 text-white rounded-xl text-sm font-medium
                         hover:bg-indigo-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print / Download Discharge Summary
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main IPD Page ────────────────────────────────────────────────────────────
export default function IPDPage() {
  const { user }  = useAuthStore()
  const navigate  = useNavigate()

  const [view,        setView]        = useState("ward")
  const [wards,       setWards]       = useState([])
  const [admissions,  setAdmissions]  = useState([])
  const [stats,       setStats]       = useState({})
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState("")
  const [wardFilter,  setWardFilter]  = useState("")
  const [showAdmit,   setShowAdmit]   = useState(false)
  const [selectedBed, setSelectedBed] = useState(null)
  const [discharge,   setDischarge]   = useState(null)
  const [detail,      setDetail]      = useState(null)
  const [refreshKey,  setRefreshKey]  = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [wardsRes, admsRes] = await Promise.allSettled([
        api.get("/admissions/wards"),
        api.get("/admissions?status=ACTIVE&limit=100")
      ])

      if (wardsRes.status === "fulfilled") {
        setWards(wardsRes.value.data.wards || wardsRes.value.data.data || [])
      }

      if (admsRes.status === "fulfilled") {
        const data = admsRes.value.data
        const list = data.admissions || data.data?.admissions || data.data || []
        setAdmissions(list)

        const allBeds = (wardsRes.status === "fulfilled"
          ? (wardsRes.value.data.wards || wardsRes.value.data.data || [])
          : []
        ).flatMap(w => w.rooms?.flatMap(r => r.beds) || [])

        setStats({
          totalBeds:  allBeds.length,
          available:  allBeds.filter(b => b.status === "AVAILABLE").length,
          occupied:   allBeds.filter(b => b.status === "OCCUPIED").length,
          admissions: list.length,
          occupancy:  allBeds.length
            ? Math.round(
                (allBeds.filter(b => b.status === "OCCUPIED").length / allBeds.length) * 100
              )
            : 0
        })
      }
    } catch (err) {
      console.error("IPD fetch error:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData, refreshKey])

  const handleBedClick = (bed) => {
    if (bed.status === "AVAILABLE") {
      setSelectedBed(bed)
      setShowAdmit(true)
    } else if (bed.status === "OCCUPIED") {
      const admission = admissions.find(a => a.bedId === bed.id)
      if (admission) setDetail(admission)
    }
  }

  // ── Central print handler ────────────────────────────────────────────────
  const handlePrintDischarge = (admission, dischargeForm = {}) => {
    try {
      printDischargeSummary(buildDischargePrintPayload(admission, dischargeForm))
    } catch (e) {
      console.error("Print error:", e)
      toast.error("Failed to open print window")
    }
  }

  const filteredAdmissions = admissions.filter(a => {
    const q           = search.toLowerCase()
    const matchSearch = !search
      || `${a.patient?.firstName} ${a.patient?.lastName}`.toLowerCase().includes(q)
      || a.patient?.mrn?.toLowerCase().includes(q)
      || a.admissionNumber?.toLowerCase().includes(q)
    const matchWard   = !wardFilter || a.wardId === wardFilter
    return matchSearch && matchWard
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <BedDouble className="w-7 h-7 text-indigo-600" />
            IPD / Admissions
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Inpatient department — ward & bed management
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>

          {["DOCTOR","NURSE","CLINICAL_COORDINATOR",
            "RECEPTIONIST","SUPER_ADMIN","HOSPITAL_ADMIN"].includes(user?.role) && (
            <button
              onClick={() => { setSelectedBed(null); setShowAdmit(true) }}
              className="flex items-center gap-2 bg-indigo-600 text-white
                         px-4 py-2 rounded-xl hover:bg-indigo-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Admit Patient
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total Beds"  value={stats.totalBeds}  icon={BedDouble}   color="indigo" />
        <StatCard label="Available"   value={stats.available}  icon={CheckCircle} color="green"  />
        <StatCard label="Occupied"    value={stats.occupied}   icon={Users}       color="red"    />
        <StatCard label="Admissions"  value={stats.admissions} icon={UserPlus}    color="blue"   />
        <StatCard
          label="Occupancy"
          value={`${stats.occupancy || 0}%`}
          icon={TrendingUp}
          color={
            stats.occupancy > 90 ? "red" :
            stats.occupancy > 70 ? "orange" : "green"
          }
        />
      </div>

      {/* View Toggle & Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex bg-gray-100 rounded-xl p-1">
            {[
              { key: "ward", label: "Ward View",    icon: Building2 },
              { key: "list", label: "Patient List", icon: Users     }
            ].map(v => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  view === v.key
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <v.icon className="w-4 h-4" />
                {v.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search patient, MRN..."
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm
                           focus:ring-2 focus:ring-indigo-500 w-48"
              />
            </div>

            <select
              value={wardFilter}
              onChange={e => setWardFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm
                         focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Wards</option>
              {wards.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {view === "ward" ? (
        <WardView
          wards={wardFilter ? wards.filter(w => w.id === wardFilter) : wards}
          loading={loading}
          onBedClick={handleBedClick}
        />
      ) : (
        <AdmissionList
          admissions={filteredAdmissions}
          loading={loading}
          onViewAdmission={setDetail}
          onDischarge={setDischarge}
          onTransfer={() => toast("Transfer functionality coming soon")}
          onPrintDischarge={handlePrintDischarge}
          userRole={user?.role}
        />
      )}

      {/* Modals */}
      <AdmitModal
        isOpen={showAdmit}
        selectedBed={selectedBed}
        onClose={() => { setShowAdmit(false); setSelectedBed(null) }}
        onSuccess={() => setRefreshKey(k => k + 1)}
      />

      <DischargeModal
        isOpen={!!discharge}
        admission={discharge}
        onClose={() => setDischarge(null)}
        onSuccess={() => setRefreshKey(k => k + 1)}
      />

      {detail && (
        <AdmissionDetailDrawer
          admission={detail}
          onClose={() => setDetail(null)}
          onPrintDischarge={handlePrintDischarge}
        />
      )}
    </div>
  )
}