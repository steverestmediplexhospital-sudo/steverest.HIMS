// frontend/src/pages/mortuary/MortuaryPage.jsx
import { useState, useEffect, useCallback } from "react"
import useAuthStore from "../../store/authStore"
import api from "../../services/api"
import toast from "react-hot-toast"
import {
  Users, Plus, Search, RefreshCw, X, CheckCircle,
  AlertTriangle, Calendar, Clock, FileText, Eye,
  Phone, User, Hash, MapPin, Shield, Package,
  ChevronDown, ChevronRight, Printer, Download,
  Activity, BookOpen, Archive, ArrowRight,
  Clipboard, Star, Zap, Building2, Lock
} from "lucide-react"
import { printDeathCertificate } from "../../services/pdfPrint"

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  ADMITTED:  { color: "blue",   bg: "bg-blue-100",   text: "text-blue-700",   label: "Admitted"   },
  AUTOPSY:   { color: "orange", bg: "bg-orange-100", text: "text-orange-700", label: "In Autopsy"  },
  RELEASED:  { color: "green",  bg: "bg-green-100",  text: "text-green-700",  label: "Released"   },
  UNCLAIMED: { color: "red",    bg: "bg-red-100",    text: "text-red-700",    label: "Unclaimed"  }
}

const TABS = [
  { key: "records",  label: "Mortuary Records",   icon: Archive    },
  { key: "admitted", label: "Currently Admitted",  icon: Users      },
  { key: "autopsy",  label: "Autopsy",             icon: FileText   },
  { key: "released", label: "Released",            icon: CheckCircle }
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (dt) => dt
  ? new Date(dt).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric"
    })
  : "—"

const formatDateTime = (dt) => dt
  ? new Date(dt).toLocaleString("en-GB", {
      day: "2-digit", month: "short",
      hour: "2-digit", minute: "2-digit"
    })
  : "—"

const calcDays = (from) => {
  if (!from) return 0
  return Math.ceil((new Date() - new Date(from)) / (1000 * 60 * 60 * 24))
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
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

// ─── Admit to Mortuary Modal ──────────────────────────────────────────────────
const AdmitModal = ({ isOpen, onClose, onSuccess }) => {
  const [saving,    setSaving]    = useState(false)
  const [patients,  setPatients]  = useState([])
  const [searching, setSearching] = useState(false)
  const [form, setForm] = useState({
    patientSearch:     "",
    patientId:         "",
    deceasedName:      "",
    gender:            "MALE",
    estimatedAge:      "",
    dateOfDeath:       new Date().toISOString().split("T")[0],
    timeOfDeath:       new Date().toTimeString().slice(0, 5),
    causeOfDeath:      "",
    placeOfDeath:      "IN_HOSPITAL",
    storageUnit:       "",
    isAutopsyRequired: false,
    policeCase:        false,
    policeReference:   "",
    familyName:        "",
    familyPhone:       "",
    familyRelation:    "",
    notes:             ""
  })

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
    if (!form.deceasedName) return toast.error("Deceased name is required")
    if (!form.gender)       return toast.error("Gender is required")
    if (!form.dateOfDeath)  return toast.error("Date of death is required")
    setSaving(true)
    try {
      await api.post("/mortuary", {
        patientId:         form.patientId      || undefined,
        deceasedName:      form.deceasedName,
        gender:            form.gender,
        estimatedAge:      form.estimatedAge   ? parseInt(form.estimatedAge) : undefined,
        dateOfDeath:       form.dateOfDeath,
        timeOfDeath:       form.timeOfDeath,
        causeOfDeath:      form.causeOfDeath,
        placeOfDeath:      form.placeOfDeath,
        storageUnit:       form.storageUnit,
        isAutopsyRequired: form.isAutopsyRequired,
        policeCase:        form.policeCase,
        policeReference:   form.policeReference,
        familyName:        form.familyName,
        familyPhone:       form.familyPhone,
        familyRelation:    form.familyRelation,
        notes:             form.notes
      })
      toast.success("Body admitted to mortuary!")
      onSuccess()
      onClose()
      setForm({
        patientSearch: "", patientId: "", deceasedName: "",
        gender: "MALE", estimatedAge: "",
        dateOfDeath: new Date().toISOString().split("T")[0],
        timeOfDeath: new Date().toTimeString().slice(0, 5),
        causeOfDeath: "", placeOfDeath: "IN_HOSPITAL",
        storageUnit: "", isAutopsyRequired: false,
        policeCase: false, policeReference: "",
        familyName: "", familyPhone: "",
        familyRelation: "", notes: ""
      })
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to admit to mortuary")
    } finally { setSaving(false) }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Archive className="w-5 h-5 text-gray-600" />
            Admit to Mortuary
          </h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Link to existing patient */}
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-xs font-medium text-blue-700 mb-2">
              Link to Hospital Patient (optional — for in-hospital deaths)
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={form.patientSearch}
                onChange={e => {
                  setForm(prev => ({ ...prev, patientSearch: e.target.value }))
                  searchPatients(e.target.value)
                }}
                placeholder="Search hospital patient by name or MRN..."
                className="w-full pl-9 pr-3 py-2 border border-blue-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            {patients.length > 0 && (
              <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden bg-white">
                {patients.map(p => (
                  <div key={p.id}
                    onClick={() => {
                      setForm(prev => ({
                        ...prev,
                        patientId:     p.id,
                        patientSearch: `${p.firstName} ${p.lastName} (${p.mrn})`,
                        deceasedName:  `${p.firstName} ${p.lastName}`,
                        gender:        p.gender || "MALE"
                      }))
                      setPatients([])
                    }}
                    className="p-2.5 hover:bg-gray-50 cursor-pointer text-sm border-b border-gray-100 last:border-0"
                  >
                    <span className="font-medium">{p.firstName} {p.lastName}</span>
                    <span className="text-gray-400 ml-2">{p.mrn}</span>
                    <span className="text-gray-400 ml-2">{p.gender}</span>
                  </div>
                ))}
              </div>
            )}
            {form.patientId && (
              <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Linked to hospital record
              </p>
            )}
          </div>

          {/* Deceased Information */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Deceased Information</h3>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Full Name of Deceased *
              </label>
              <input
                type="text"
                value={form.deceasedName}
                onChange={e => setForm(prev => ({ ...prev, deceasedName: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-400"
                placeholder="Full name as known"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Gender *</label>
                <select
                  value={form.gender}
                  onChange={e => setForm(prev => ({ ...prev, gender: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other / Unknown</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Estimated Age (years)
                </label>
                <input
                  type="number" min="0" max="120"
                  value={form.estimatedAge}
                  onChange={e => setForm(prev => ({ ...prev, estimatedAge: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                  placeholder="e.g. 45"
                />
              </div>
            </div>
          </div>

          {/* Death Details */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Death Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Date of Death *
                </label>
                <input
                  type="date"
                  value={form.dateOfDeath}
                  onChange={e => setForm(prev => ({ ...prev, dateOfDeath: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Time of Death
                </label>
                <input
                  type="time"
                  value={form.timeOfDeath}
                  onChange={e => setForm(prev => ({ ...prev, timeOfDeath: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Cause of Death
              </label>
              <input
                type="text"
                value={form.causeOfDeath}
                onChange={e => setForm(prev => ({ ...prev, causeOfDeath: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                placeholder="e.g. Cardiac arrest, Road traffic accident..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Place of Death
                </label>
                <select
                  value={form.placeOfDeath}
                  onChange={e => setForm(prev => ({ ...prev, placeOfDeath: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                >
                  <option value="IN_HOSPITAL">In Hospital</option>
                  <option value="EMERGENCY">Emergency Department</option>
                  <option value="ICU">ICU / HDU</option>
                  <option value="THEATRE">Operating Theatre</option>
                  <option value="HOME">At Home</option>
                  <option value="ROAD">Road / Public Place</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Storage Unit / Fridge No.
                </label>
                <input
                  type="text"
                  value={form.storageUnit}
                  onChange={e => setForm(prev => ({ ...prev, storageUnit: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                  placeholder="e.g. Fridge 3, Unit A"
                />
              </div>
            </div>
          </div>

          {/* Autopsy & Police */}
          <div className="bg-orange-50 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-orange-800">Autopsy & Legal</h3>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isAutopsyRequired}
                  onChange={e => setForm(prev => ({
                    ...prev, isAutopsyRequired: e.target.checked
                  }))}
                  className="w-4 h-4 text-orange-600"
                />
                <span className="text-sm text-gray-700 font-medium">Autopsy Required</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.policeCase}
                  onChange={e => setForm(prev => ({ ...prev, policeCase: e.target.checked }))}
                  className="w-4 h-4 text-red-600"
                />
                <span className="text-sm text-gray-700 font-medium">Police Case</span>
              </label>
            </div>
            {form.policeCase && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Police Reference / OB Number
                </label>
                <input
                  type="text"
                  value={form.policeReference}
                  onChange={e => setForm(prev => ({ ...prev, policeReference: e.target.value }))}
                  className="w-full px-3 py-2 border border-orange-200 rounded-xl text-sm"
                  placeholder="e.g. OB/123/2026"
                />
              </div>
            )}
            {form.isAutopsyRequired && (
              <div className="bg-orange-100 rounded-lg p-2 text-xs text-orange-700 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                Body cannot be released until autopsy is completed
              </div>
            )}
          </div>

          {/* Family / Next of Kin */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Next of Kin / Family Contact</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Family Contact Name
                </label>
                <input
                  type="text"
                  value={form.familyName}
                  onChange={e => setForm(prev => ({ ...prev, familyName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Relationship
                </label>
                <select
                  value={form.familyRelation}
                  onChange={e => setForm(prev => ({ ...prev, familyRelation: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                >
                  <option value="">Select...</option>
                  <option value="SPOUSE">Spouse</option>
                  <option value="PARENT">Parent</option>
                  <option value="CHILD">Child</option>
                  <option value="SIBLING">Sibling</option>
                  <option value="RELATIVE">Other Relative</option>
                  <option value="FRIEND">Friend</option>
                  <option value="UNKNOWN">Unknown</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Family Phone Number
              </label>
              <input
                type="tel"
                value={form.familyPhone}
                onChange={e => setForm(prev => ({ ...prev, familyPhone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                placeholder="+254..."
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Notes
            </label>
            <textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              placeholder="Any additional information..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-400"
            />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-gray-800 text-white rounded-xl text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
            >
              {saving ? "Admitting..." : "Admit to Mortuary"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Release Modal ────────────────────────────────────────────────────────────
const ReleaseModal = ({ isOpen, record, onClose, onSuccess }) => {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    releasedTo:  "",
    funeralHome: "",
    notes:       ""
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.releasedTo) return toast.error("Released to name is required")
    setSaving(true)
    try {
      await api.patch(`/mortuary/${record.id}/release`, form)
      toast.success("Body released successfully!")
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to release body")
    } finally { setSaving(false) }
  }

  if (!isOpen || !record) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-green-600" /> Release Body
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="p-5">
          <div className="bg-gray-50 rounded-xl p-3 mb-4">
            <p className="font-semibold text-gray-800">{record.deceasedName}</p>
            <p className="text-sm text-gray-500">
              {record.mortuaryNumber} • Admitted: {formatDate(record.admittedAt)}
            </p>
            <p className="text-sm text-gray-500">
              Days in mortuary: {calcDays(record.admittedAt)}
            </p>
          </div>

          {record.isAutopsyRequired && !record.autopsyRecord?.completedAt && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">
                Autopsy required but not completed. Complete autopsy before release.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Released To (Name) *
              </label>
              <input
                type="text"
                value={form.releasedTo}
                onChange={e => setForm(prev => ({ ...prev, releasedTo: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                placeholder="Full name of person receiving body"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Funeral Home / Undertaker
              </label>
              <input
                type="text"
                value={form.funeralHome}
                onChange={e => setForm(prev => ({ ...prev, funeralHome: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                placeholder="Name of funeral home (if applicable)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Release Notes
              </label>
              <textarea
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                placeholder="ID verified, documents issued, special instructions..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  saving ||
                  (record.isAutopsyRequired && !record.autopsyRecord?.completedAt)
                }
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? "Releasing..." : "Confirm Release"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Autopsy Modal ────────────────────────────────────────────────────────────
const AutopsyModal = ({ isOpen, record, onClose, onSuccess }) => {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    performedAt:  new Date().toISOString().slice(0, 16),
    findings:     "",
    causeOfDeath: "",
    notes:        ""
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.findings)     return toast.error("Findings are required")
    if (!form.causeOfDeath) return toast.error("Cause of death is required")
    setSaving(true)
    try {
      await api.patch(`/mortuary/${record.id}/autopsy`, form)
      toast.success("Autopsy record updated!")
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update autopsy")
    } finally { setSaving(false) }
  }

  if (!isOpen || !record) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-500" /> Autopsy Record
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="p-5">
          <div className="bg-orange-50 rounded-xl p-3 mb-4">
            <p className="font-semibold text-gray-800">{record.deceasedName}</p>
            <p className="text-sm text-gray-500">{record.mortuaryNumber}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date & Time Performed
              </label>
              <input
                type="datetime-local"
                value={form.performedAt}
                onChange={e => setForm(prev => ({ ...prev, performedAt: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Autopsy Findings *
              </label>
              <textarea
                value={form.findings}
                onChange={e => setForm(prev => ({ ...prev, findings: e.target.value }))}
                rows={5}
                placeholder="Detailed autopsy findings..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cause of Death (Confirmed) *
              </label>
              <input
                type="text"
                value={form.causeOfDeath}
                onChange={e => setForm(prev => ({ ...prev, causeOfDeath: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                placeholder="Final confirmed cause of death"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Notes
              </label>
              <textarea
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                placeholder="Toxicology, additional investigations..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium"
              >
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 bg-orange-600 text-white rounded-xl text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Autopsy Report"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Belonging Modal ──────────────────────────────────────────────────────────
const BelongingModal = ({ isOpen, record, onClose, onSuccess }) => {
  const [saving, setSaving] = useState(false)
  const [item, setItem] = useState({
    itemDescription: "", quantity: "1", notes: ""
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!item.itemDescription) return toast.error("Item description required")
    setSaving(true)
    try {
      await api.post(`/mortuary/${record.id}/belongings`, item)
      toast.success("Belonging recorded!")
      onSuccess()
      onClose()
    } catch {
      toast.error("Failed to record belonging")
    } finally { setSaving(false) }
  }

  if (!isOpen || !record) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-gray-600" /> Record Belonging
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-sm font-medium text-gray-700">{record.deceasedName}</p>
            <p className="text-xs text-gray-500">{record.mortuaryNumber}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Item Description *
            </label>
            <input
              type="text"
              value={item.itemDescription}
              onChange={e => setItem(prev => ({ ...prev, itemDescription: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
              placeholder="e.g. Gold ring, watch, wallet, clothing..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input
              type="number" min="1"
              value={item.quantity}
              onChange={e => setItem(prev => ({ ...prev, quantity: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input
              type="text"
              value={item.notes}
              onChange={e => setItem(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
              placeholder="Condition, color, description..."
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-gray-800 text-white rounded-xl text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving..." : "Record Belonging"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Print Death Certificate Handler ─────────────────────────────────────────
const handlePrintDeathCertificate = (record, certifyingDoctor = null) => {
  printDeathCertificate({
    patient: {
      fullName:    record.deceasedName,
      patientId:   record.patient?.patientId || record.patient?.mrn,
      dateOfBirth: record.patient?.dateOfBirth,
      gender:      record.gender,
      address:     record.patient?.address,
      nationalId:  record.patient?.nationalId,
      nationality: record.patient?.nationality || "Kenyan",
    },
    doctor: certifyingDoctor || {
      name:               record.certifiedBy?.name,
      specialization:     record.certifiedBy?.specialization || "Medical Officer",
      registrationNumber: record.certifiedBy?.registrationNumber,
    },
    mortuaryRecord: record,
    causeOfDeath: {
      immediate:   record.autopsyRecord?.causeOfDeath || record.causeOfDeath,
      dueTo:       record.causeOfDeathDueTo      || null,
      underlying:  record.underlyingCause        || null,
      contributing:record.contributingFactors    || null,
    },
    mannerOfDeath:  record.mannerOfDeath || "Natural",
    dateOfDeath:    record.dateOfDeath,
    timeOfDeath:    record.timeOfDeath,
    placeOfDeath:   record.placeOfDeath?.replace(/_/g, " ") || "St. Everest Mediplex",
    docNumber:      `DC-${record.mortuaryNumber || record.id}`,
  })
}

// ─── Mortuary Record Card ─────────────────────────────────────────────────────
const MortuaryCard = ({
  record, onRelease, onAutopsy,
  onBelonging, onView, userRole
}) => {
  const cfg  = STATUS_CONFIG[record.status] || STATUS_CONFIG.ADMITTED
  const days = calcDays(record.admittedAt)

  const canRelease = [
    "MORTUARY_OFFICER","DOCTOR","SUPER_ADMIN",
    "HOSPITAL_ADMIN","CLINICAL_COORDINATOR"
  ].includes(userRole)

  const canAutopsy = [
    "MORTUARY_OFFICER","DOCTOR","SUPER_ADMIN","HOSPITAL_ADMIN"
  ].includes(userRole)

  const canPrintCert = [
    "MORTUARY_OFFICER","DOCTOR","SUPER_ADMIN",
    "HOSPITAL_ADMIN","CLINICAL_COORDINATOR","MEDICAL_DIRECTOR"
  ].includes(userRole)

  return (
    <div className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all ${
      record.status === "UNCLAIMED" ? "border-red-200"    :
      record.policeCase             ? "border-orange-200" :
      "border-gray-100"
    }`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-white ${
              record.gender === "MALE"   ? "bg-blue-500"   :
              record.gender === "FEMALE" ? "bg-purple-500" :
              "bg-gray-500"
            }`}>
              {record.deceasedName?.split(" ").map(n => n[0]).slice(0, 2).join("")}
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{record.deceasedName}</h3>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                <span>{record.mortuaryNumber}</span>
                <span>•</span>
                <span>{record.gender}</span>
                {record.estimatedAge && (
                  <><span>•</span><span>~{record.estimatedAge}y</span></>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>
              {cfg.label}
            </span>
            {record.policeCase && (
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Shield className="w-3 h-3" /> Police Case
              </span>
            )}
          </div>
        </div>

        {/* Death Info */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-xs text-gray-500">Date of Death</p>
            <p className="text-sm font-medium text-gray-800">
              {formatDate(record.dateOfDeath)}
              {record.timeOfDeath && ` @ ${record.timeOfDeath}`}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-xs text-gray-500">Days in Mortuary</p>
            <p className={`text-sm font-medium ${days > 7 ? "text-red-600" : "text-gray-800"}`}>
              {record.status === "RELEASED"
                ? "Released"
                : `${days} day${days !== 1 ? "s" : ""}`
              }
            </p>
          </div>
        </div>

        {record.causeOfDeath && (
          <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 mb-3">
            <span className="font-medium">Cause: </span>{record.causeOfDeath}
          </p>
        )}

        {record.storageUnit && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
            <Archive className="w-3.5 h-3.5" />
            <span>Storage: {record.storageUnit}</span>
          </div>
        )}

        {record.familyName && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
            <Phone className="w-3.5 h-3.5" />
            <span>
              {record.familyName} ({record.familyRelation || "Family"})
              {record.familyPhone && ` • ${record.familyPhone}`}
            </span>
          </div>
        )}

        {record.isAutopsyRequired && (
          <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 mb-3 ${
            record.autopsyRecord?.completedAt
              ? "bg-green-50 text-green-700"
              : "bg-orange-50 text-orange-700"
          }`}>
            <FileText className="w-3.5 h-3.5 flex-shrink-0" />
            {record.autopsyRecord?.completedAt
              ? "Autopsy completed"
              : "Autopsy required — pending"
            }
          </div>
        )}

        {record.belongings?.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
            <Package className="w-3.5 h-3.5" />
            <span>{record.belongings.length} belonging(s) recorded</span>
          </div>
        )}

        {/* Actions */}
        {record.status !== "RELEASED" && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-100">
            <button
              onClick={() => onView(record)}
              className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200"
            >
              <Eye className="w-3 h-3" /> View
            </button>

            {canAutopsy &&
             record.isAutopsyRequired &&
             !record.autopsyRecord?.completedAt && (
              <button
                onClick={() => onAutopsy(record)}
                className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg hover:bg-orange-200"
              >
                <FileText className="w-3 h-3" /> Autopsy Report
              </button>
            )}

            <button
              onClick={() => onBelonging(record)}
              className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200"
            >
              <Package className="w-3 h-3" /> Belongings
            </button>

            {canRelease && record.status === "ADMITTED" && (
              <button
                onClick={() => onRelease(record)}
                className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200"
              >
                <ArrowRight className="w-3 h-3" /> Release
              </button>
            )}

            {/* ── Death Certificate print button ── */}
            {canPrintCert && (
              <button
                onClick={() => handlePrintDeathCertificate(record)}
                className="flex items-center gap-1 text-xs bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100"
              >
                <Printer className="w-3 h-3" /> Death Cert
              </button>
            )}
          </div>
        )}

        {/* Released info */}
        {record.status === "RELEASED" && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              Released to: <span className="font-medium">{record.releasedTo}</span>
              {record.releasedAt && ` on ${formatDate(record.releasedAt)}`}
            </p>
            {record.funeralHome && (
              <p className="text-xs text-gray-500 mt-0.5">
                Funeral home: {record.funeralHome}
              </p>
            )}
            {/* ── Print cert button on released records too ── */}
            <button
              onClick={() => handlePrintDeathCertificate(record)}
              className="mt-2 flex items-center gap-1.5 text-xs bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100"
            >
              <Printer className="w-3 h-3" /> Print Death Certificate
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────
const DetailDrawer = ({ record, onClose, onRelease, onAutopsy }) => {
  if (!record) return null

  const cfg  = STATUS_CONFIG[record.status] || STATUS_CONFIG.ADMITTED
  const days = calcDays(record.admittedAt)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
      <div className="w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Mortuary Record</h2>
          <div className="flex items-center gap-2">
            {/* ── Print button in drawer header ── */}
            <button
              onClick={() => handlePrintDeathCertificate(record)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-700
                         border border-gray-200 rounded-xl text-xs font-semibold
                         hover:bg-gray-100 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Death Certificate
            </button>
            <button onClick={onClose}>
              <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Header Card */}
          <div className="bg-gray-800 text-white rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-xl">{record.deceasedName}</h3>
                <p className="text-gray-300 text-sm mt-1">
                  {record.mortuaryNumber} • {record.gender}
                  {record.estimatedAge && ` • ~${record.estimatedAge} years`}
                </p>
              </div>
              <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>
                {cfg.label}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-white/10 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-300">Date of Death</p>
                <p className="text-sm font-semibold">{formatDate(record.dateOfDeath)}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-300">Time</p>
                <p className="text-sm font-semibold">{record.timeOfDeath || "—"}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-300">Days Here</p>
                <p className="text-sm font-semibold">
                  {record.status === "RELEASED" ? "Released" : `${days}d`}
                </p>
              </div>
            </div>
          </div>

          {/* Death Details */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-3">Death Details</h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Cause of Death", value: record.causeOfDeath  || "Not specified" },
                { label: "Place of Death", value: record.placeOfDeath?.replace(/_/g," ") || "—" },
                { label: "Storage Unit",   value: record.storageUnit   || "Not assigned"  },
                { label: "Admitted",       value: formatDateTime(record.admittedAt)         }
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Legal Status */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-3">Legal Status</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-600">Autopsy Required</span>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  record.isAutopsyRequired
                    ? "bg-orange-100 text-orange-700"
                    : "bg-gray-200 text-gray-600"
                }`}>
                  {record.isAutopsyRequired ? "YES" : "NO"}
                </span>
              </div>
              {record.isAutopsyRequired && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-600">Autopsy Status</span>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    record.autopsyRecord?.completedAt
                      ? "bg-green-100 text-green-700"
                      : "bg-orange-100 text-orange-700"
                  }`}>
                    {record.autopsyRecord?.completedAt ? "COMPLETED" : "PENDING"}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-600">Police Case</span>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  record.policeCase
                    ? "bg-orange-100 text-orange-700"
                    : "bg-gray-200 text-gray-600"
                }`}>
                  {record.policeCase
                    ? `YES — ${record.policeReference || "Ref pending"}`
                    : "NO"
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Autopsy Findings */}
          {record.autopsyRecord?.findings && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-500" /> Autopsy Findings
              </h4>
              <div className="bg-orange-50 rounded-xl p-4 text-sm text-gray-700 space-y-2">
                <div>
                  <p className="font-medium text-orange-800">Findings</p>
                  <p className="mt-1">{record.autopsyRecord.findings}</p>
                </div>
                {record.autopsyRecord.causeOfDeath && (
                  <div>
                    <p className="font-medium text-orange-800">Confirmed Cause</p>
                    <p className="mt-1">{record.autopsyRecord.causeOfDeath}</p>
                  </div>
                )}
                {record.autopsyRecord.performedAt && (
                  <p className="text-xs text-gray-500">
                    Performed: {formatDateTime(record.autopsyRecord.performedAt)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Family Contact */}
          {record.familyName && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-500" /> Next of Kin
              </h4>
              <div className="bg-blue-50 rounded-xl p-4 space-y-1">
                <p className="font-medium text-gray-800">{record.familyName}</p>
                {record.familyRelation && (
                  <p className="text-sm text-gray-600">
                    Relationship: {record.familyRelation}
                  </p>
                )}
                {record.familyPhone && (
                  <p className="text-sm text-blue-700">{record.familyPhone}</p>
                )}
              </div>
            </div>
          )}

          {/* Belongings */}
          {record.belongings?.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-500" />
                Belongings ({record.belongings.length})
              </h4>
              <div className="space-y-2">
                {record.belongings.map((item, i) => (
                  <div key={item.id || i}
                    className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                    <span className="text-sm text-gray-700">{item.itemDescription}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Qty: {item.quantity}</span>
                      {item.notes && (
                        <span className="text-xs text-gray-400">— {item.notes}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Release Info */}
          {record.status === "RELEASED" && (
            <div className="bg-green-50 rounded-xl p-4">
              <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Release Information
              </h4>
              <p className="text-sm text-gray-700">
                <span className="font-medium">Released to:</span> {record.releasedTo}
              </p>
              {record.funeralHome && (
                <p className="text-sm text-gray-700 mt-1">
                  <span className="font-medium">Funeral Home:</span> {record.funeralHome}
                </p>
              )}
              {record.releasedAt && (
                <p className="text-xs text-gray-500 mt-1">
                  Released: {formatDateTime(record.releasedAt)}
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          {record.notes && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Notes</h4>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3">
                {record.notes}
              </p>
            </div>
          )}

          {/* ── Print Death Certificate — bottom of drawer ── */}
          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={() => handlePrintDeathCertificate(record)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gray-800
                         text-white rounded-xl text-sm font-semibold hover:bg-gray-900
                         transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print Death Certificate
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Mortuary Page ───────────────────────────────────────────────────────
export default function MortuaryPage() {
  const { user } = useAuthStore()

  const [activeTab,    setActiveTab]    = useState("records")
  const [records,      setRecords]      = useState([])
  const [stats,        setStats]        = useState({})
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [refreshKey,   setRefreshKey]   = useState(0)

  const [showAdmit,       setShowAdmit]       = useState(false)
  const [releaseRecord,   setReleaseRecord]   = useState(null)
  const [autopsyRecord,   setAutopsyRecord]   = useState(null)
  const [belongingRecord, setBelongingRecord] = useState(null)
  const [detailRecord,    setDetailRecord]    = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search)       params.append("search", search)
      if (statusFilter) params.append("status", statusFilter)
      params.append("limit", "50")

      const res  = await api.get(`/mortuary?${params}`)
      const data = res.data
      const list = data.data?.records || data.records || []

      setRecords(list)
      setStats(data.data?.stats || {
        total:       list.length,
        admitted:    list.filter(r => r.status === "ADMITTED").length,
        autopsy:     list.filter(r => r.status === "AUTOPSY").length,
        released:    list.filter(r => r.status === "RELEASED").length,
        unclaimed:   list.filter(r => r.status === "UNCLAIMED").length,
        policeCases: list.filter(r => r.policeCase).length
      })
    } catch (err) {
      console.error("Mortuary fetch error:", err)
      toast.error("Failed to load mortuary records")
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData, refreshKey])

  const filteredRecords = records.filter(r => {
    if (activeTab === "admitted")  return r.status === "ADMITTED"
    if (activeTab === "autopsy")   return r.isAutopsyRequired
    if (activeTab === "released")  return r.status === "RELEASED"
    return true
  })

  const canAdmit = [
    "MORTUARY_OFFICER","DOCTOR","NURSE",
    "CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN"
  ].includes(user?.role)

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Archive className="w-7 h-7 text-gray-600" />
            Mortuary
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Mortuary management — admissions, autopsy & release
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200"
          >
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
          {canAdmit && (
            <button
              onClick={() => setShowAdmit(true)}
              className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-xl hover:bg-gray-900 text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Admit to Mortuary
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total Records"     value={stats.total}    icon={Archive}      color="gray"   />
        <StatCard label="Currently Admitted" value={stats.admitted} icon={Users}        color="blue"   />
        <StatCard
          label="Pending Autopsy"
          value={records.filter(r =>
            r.isAutopsyRequired && !r.autopsyRecord?.completedAt
          ).length}
          icon={FileText}
          color="orange"
        />
        <StatCard label="Released"     value={stats.released}    icon={CheckCircle} color="green" />
        <StatCard label="Police Cases" value={stats.policeCases} icon={Shield}      color="red"   />
      </div>

      {/* Tabs & Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map(tab => {
            const count =
              tab.key === "admitted" ? stats.admitted :
              tab.key === "autopsy"  ? records.filter(r => r.isAutopsyRequired).length :
              tab.key === "released" ? stats.released :
              records.length

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-gray-800 text-gray-800"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.key
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search & Filter */}
        <div className="p-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, mortuary number..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-400"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm"
          >
            <option value="">All Status</option>
            <option value="ADMITTED">Admitted</option>
            <option value="AUTOPSY">In Autopsy</option>
            <option value="RELEASED">Released</option>
            <option value="UNCLAIMED">Unclaimed</option>
          </select>
        </div>
      </div>

      {/* Records Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 animate-pulse border border-gray-100">
              <div className="flex gap-3 mb-3">
                <div className="w-11 h-11 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="h-14 bg-gray-100 rounded-lg" />
                <div className="h-14 bg-gray-100 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white rounded-xl p-16 text-center border border-gray-100">
          <Archive className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">
            {search ? "No records match your search" : "No mortuary records"}
          </p>
          {canAdmit && !search && (
            <button
              onClick={() => setShowAdmit(true)}
              className="mt-3 text-sm text-gray-600 hover:text-gray-800"
            >
              Admit first record →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRecords.map(record => (
            <MortuaryCard
              key={record.id}
              record={record}
              onView={setDetailRecord}
              onRelease={setReleaseRecord}
              onAutopsy={setAutopsyRecord}
              onBelonging={setBelongingRecord}
              userRole={user?.role}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <AdmitModal
        isOpen={showAdmit}
        onClose={() => setShowAdmit(false)}
        onSuccess={() => setRefreshKey(k => k + 1)}
      />
      <ReleaseModal
        isOpen={!!releaseRecord}
        record={releaseRecord}
        onClose={() => setReleaseRecord(null)}
        onSuccess={() => setRefreshKey(k => k + 1)}
      />
      <AutopsyModal
        isOpen={!!autopsyRecord}
        record={autopsyRecord}
        onClose={() => setAutopsyRecord(null)}
        onSuccess={() => setRefreshKey(k => k + 1)}
      />
      <BelongingModal
        isOpen={!!belongingRecord}
        record={belongingRecord}
        onClose={() => setBelongingRecord(null)}
        onSuccess={() => setRefreshKey(k => k + 1)}
      />
      {detailRecord && (
        <DetailDrawer
          record={detailRecord}
          onClose={() => setDetailRecord(null)}
          onRelease={setReleaseRecord}
          onAutopsy={setAutopsyRecord}
        />
      )}
    </div>
  )
}