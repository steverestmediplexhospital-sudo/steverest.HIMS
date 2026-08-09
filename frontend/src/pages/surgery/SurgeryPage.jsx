// frontend/src/pages/surgery/SurgeryPage.jsx
import { useState, useEffect, useCallback } from "react"
import useAuthStore from "../../store/authStore"
import api from "../../services/api"
import toast from "react-hot-toast"
import {
  Scissors, Plus, Search, RefreshCw, X, CheckCircle,
  AlertTriangle, Calendar, Clock, FileText, Eye,
  User, Activity, Stethoscope, Heart, Shield,
  ChevronDown, ChevronRight, Play, Pause, Square,
  Users, Building2, FlaskConical, Pill, Hash,
  ArrowRight, BookOpen, Clipboard, Zap, Star,
  Package, Phone, MapPin, TrendingUp, BarChart3,
  Printer
} from "lucide-react"
import { printDocument } from "../../services/pdfPrint"

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  REQUESTED:   { color: "gray",   bg: "bg-gray-100",   text: "text-gray-700",   label: "Requested",   icon: Clipboard   },
  SCHEDULED:   { color: "blue",   bg: "bg-blue-100",   text: "text-blue-700",   label: "Scheduled",   icon: Calendar    },
  IN_PROGRESS: { color: "orange", bg: "bg-orange-100", text: "text-orange-700", label: "In Progress", icon: Play        },
  COMPLETED:   { color: "green",  bg: "bg-green-100",  text: "text-green-700",  label: "Completed",   icon: CheckCircle },
  CANCELLED:   { color: "red",    bg: "bg-red-100",    text: "text-red-700",    label: "Cancelled",   icon: X           },
  POSTPONED:   { color: "yellow", bg: "bg-yellow-100", text: "text-yellow-700", label: "Postponed",   icon: Pause       }
}

const ANAESTHESIA_TYPES = [
  "GENERAL", "SPINAL", "EPIDURAL", "LOCAL",
  "REGIONAL", "SEDATION", "COMBINED"
]

const THEATRE_ROOMS = [
  "Theatre 1", "Theatre 2", "Theatre 3",
  "Minor OT", "Emergency OT", "Obstetric OT"
]

const TABS = [
  { key: "all",         label: "All Surgeries", icon: Scissors   },
  { key: "scheduled",   label: "Scheduled",     icon: Calendar   },
  { key: "in_progress", label: "In Progress",   icon: Play       },
  { key: "completed",   label: "Completed",     icon: CheckCircle }
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (dt) =>
  dt
    ? new Date(dt).toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric"
      })
    : "—"

const formatDateTime = (dt) =>
  dt
    ? new Date(dt).toLocaleString("en-GB", {
        day: "2-digit", month: "short",
        hour: "2-digit", minute: "2-digit"
      })
    : "—"

const calcAge = (dob) => {
  if (!dob) return "N/A"
  return (
    Math.floor(
      (new Date() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000)
    ) + "y"
  )
}

const calcDuration = (start, end) => {
  if (!start || !end) return null
  const mins = Math.round((new Date(end) - new Date(start)) / 60000)
  return mins >= 60
    ? `${Math.floor(mins / 60)}h ${mins % 60}m`
    : `${mins}m`
}

// ─── Surgery Report Print Function ───────────────────────────────────────────
// Uses printDocument from pdfPrint — same infrastructure, same branding
const printSurgeryReport = (surgery) => {
  const patient = surgery.visit?.patient || {}
  const surgeon = surgery.surgeon || {}

  const patientName = `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "—"
  const patientId   = patient.mrn || patient.patientNumber || "—"
  const patientAge  = patient.dateOfBirth ? calcAge(patient.dateOfBirth) : "—"
  const patientGender = patient.gender || "—"

  const surgeonName = surgeon.firstName
    ? `Dr. ${surgeon.firstName} ${surgeon.lastName || ""}`.trim()
    : "—"

  const today = new Date().toLocaleDateString("en-KE", {
    day: "2-digit", month: "long", year: "numeric"
  })

  // Parse pre-op checklist if stored as JSON string
  let preOpData = null
  try {
    preOpData = surgery.preOpNotes ? JSON.parse(surgery.preOpNotes) : null
  } catch {
    preOpData = null
  }

  const checklistLabels = {
    consentSigned:    "Informed consent signed",
    npoConfirmed:     "NPO (nil per oral) confirmed",
    labsReviewed:     "Lab results reviewed",
    imagingReviewed:  "Imaging reviewed",
    bloodGrouped:     "Blood group & crossmatch done",
    ivAccessDone:     "IV access established",
    skinPrepDone:     "Skin preparation done",
    markingSiteDone:  "Surgical site marked",
    allergiesChecked: "Allergies verified",
    medicationsGiven: "Pre-op medications given"
  }

  const duration = calcDuration(surgery.startedAt, surgery.completedAt)

  const HOSPITAL = {
    name:    "St. Everest Mediplex",
    tagline: "Quality Healthcare for All",
    address: "P.O. Box 1234, Benin, Nigeria",
    phone:   "+254 700 000 000",
    email:   "info@steverestmediplex.com",
    license: "MOH/HF/2024/001234"
  }

  const html = `
    <div class="page">
      <div class="watermark">SURGERY</div>

      <!-- Letterhead -->
      <div class="letterhead">
        <div class="letterhead-left">
          <div class="logo-circle">SE</div>
          <div>
            <div class="hospital-name">${HOSPITAL.name}</div>
            <div class="hospital-tagline">${HOSPITAL.tagline}</div>
          </div>
        </div>
        <div class="letterhead-right">
          <div>${HOSPITAL.address}</div>
          <div>Tel: ${HOSPITAL.phone}</div>
          <div>${HOSPITAL.email}</div>
          <div>License: ${HOSPITAL.license}</div>
        </div>
      </div>
      <div class="sub-header">
        <span>www.steverestmediplex.com</span>
        <span>Document: Surgical Report</span>
        <span>${today}</span>
      </div>

      <!-- Title -->
      <div class="doc-title">
        <h1>Surgical Operation Report</h1>
        <div class="doc-number">
          Surgery No: ${surgery.surgeryNumber || surgery.id || "—"}
          &nbsp;·&nbsp;
          <span style="
            display:inline-block;
            border:1.5px solid;
            padding:1px 8px;
            border-radius:3px;
            font-size:9pt;
            font-weight:700;
            ${surgery.status === "COMPLETED"
              ? "color:#16a34a; border-color:#16a34a;"
              : surgery.status === "IN_PROGRESS"
                ? "color:#d97706; border-color:#d97706;"
                : "color:#6b7280; border-color:#6b7280;"
            }
          ">
            ${STATUS_CONFIG[surgery.status]?.label || surgery.status}
          </span>
        </div>
        <hr class="title-divider" />
      </div>

      <!-- Patient Box -->
      <div class="patient-box">
        <div class="patient-name">${patientName}</div>
        <div class="patient-meta">
          <span>Patient ID: ${patientId}</span>
          <span>Age: ${patientAge}</span>
          <span>Gender: ${patientGender}</span>
          ${patient.bloodGroup
            ? `<span>Blood Group: ${patient.bloodGroup.replace("_", " ")}</span>`
            : ""
          }
        </div>
      </div>

      <!-- Procedure -->
      <div class="section">
        <div class="section-title">Procedure Details</div>
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Procedure:</span>
            <span class="info-value" style="font-weight:700; font-size:11.5pt;">
              ${surgery.procedureName || "—"}
            </span>
          </div>
          ${surgery.icdCode ? `
          <div class="info-row">
            <span class="info-label">ICD-10 Code:</span>
            <span class="info-value">${surgery.icdCode}</span>
          </div>
          ` : ""}
          <div class="info-row">
            <span class="info-label">Theatre Room:</span>
            <span class="info-value">${surgery.theatreRoom || "—"}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Anaesthesia:</span>
            <span class="info-value">${surgery.anaesthesiaType || "—"}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Lead Surgeon:</span>
            <span class="info-value" style="font-weight:600;">${surgeonName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Surgery Number:</span>
            <span class="info-value">${surgery.surgeryNumber || "—"}</span>
          </div>
        </div>
      </div>

      <!-- Timeline -->
      <div class="section">
        <div class="section-title">Operative Timeline</div>
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Date & Time</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Scheduled</td>
              <td>${formatDateTime(surgery.scheduledAt)}</td>
              <td>${surgery.theatreRoom || "—"}</td>
            </tr>
            <tr>
              <td><strong>Surgery Started</strong></td>
              <td><strong>${formatDateTime(surgery.startedAt)}</strong></td>
              <td>—</td>
            </tr>
            <tr>
              <td><strong>Surgery Completed</strong></td>
              <td><strong>${formatDateTime(surgery.completedAt)}</strong></td>
              <td>${duration ? `Duration: ${duration}` : "—"}</td>
            </tr>
            ${duration ? `
            <tr style="background:#f0fdf4 !important;">
              <td><strong>Total Duration</strong></td>
              <td colspan="2"><strong style="color:#16a34a;">${duration}</strong></td>
            </tr>
            ` : ""}
          </tbody>
        </table>
      </div>

      <!-- Pre-Op Checklist -->
      ${preOpData?.checklist ? `
      <div class="section">
        <div class="section-title">Pre-Operative Safety Checklist</div>
        <table>
          <thead>
            <tr>
              <th>Checklist Item</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(preOpData.checklist).map(([key, done]) => `
              <tr>
                <td>${checklistLabels[key] || key}</td>
                <td style="${done ? "color:#16a34a; font-weight:700;" : "color:#dc2626; font-weight:700;"}">
                  ${done ? "✓ Completed" : "✗ Not Done"}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        ${preOpData.notes ? `
        <div class="content-box" style="margin-top:8px;">
          <strong>Pre-Op Notes:</strong> ${preOpData.notes}
        </div>
        ` : ""}
      </div>
      ` : ""}

      <!-- Intra-Op Notes -->
      ${surgery.intraOpNotes ? `
      <div class="section">
        <div class="section-title">Intra-Operative Findings & Notes</div>
        <div class="content-box" style="line-height:1.8; white-space:pre-wrap;">
          ${surgery.intraOpNotes}
        </div>
      </div>
      ` : ""}

      <!-- Post-Op Notes -->
      ${surgery.postOpNotes ? `
      <div class="section">
        <div class="section-title">Post-Operative Notes</div>
        <div class="content-box" style="line-height:1.8; white-space:pre-wrap;">
          ${surgery.postOpNotes}
        </div>
      </div>
      ` : ""}

      <!-- Complications -->
      ${surgery.complications ? `
      <div class="alert-box">
        <strong>⚠ Complications Documented:</strong><br/>
        ${surgery.complications}
      </div>
      ` : `
      <div class="highlight-box">
        ✓ No complications recorded during this procedure.
      </div>
      `}

      <!-- Patient Allergies -->
      ${patient.allergies?.length ? `
      <div class="alert-box">
        <strong>⚠ Known Patient Allergies:</strong>
        ${patient.allergies.map(a => `${a.allergen} (${a.severity})`).join(" · ")}
      </div>
      ` : ""}

      <!-- Signatures -->
      <div class="signature-section">
        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="signature-name">${surgeonName}</div>
          <div class="signature-role">Lead Surgeon</div>
          <div class="signature-role">
            Reg No: ${surgeon.registrationNumber || "MOH/MD/—"}
          </div>
          <div class="signature-role">${today}</div>
        </div>

        <div class="signature-block">
          <div class="stamp-area">HOSPITAL<br/>STAMP</div>
        </div>

        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="signature-name">Anaesthetist</div>
          <div class="signature-role">Anaesthesia: ${surgery.anaesthesiaType || "—"}</div>
          <div class="signature-role">${today}</div>
        </div>
      </div>

      <!-- Theatre Nurse -->
      <div style="margin-top:20px; display:flex; justify-content:center;">
        <div class="signature-block" style="max-width:200px; text-align:center;">
          <div class="signature-line"></div>
          <div class="signature-name">Theatre Nurse</div>
          <div class="signature-role">Scrub Nurse / Circulating Nurse</div>
          <div class="signature-role">${today}</div>
        </div>
      </div>

      <div style="margin-top:10px; font-size:8.5pt; color:#6b7280; font-style:italic;">
        * This is a computer-generated surgical report.
        Retain in patient's permanent medical record.
        Surgery No: ${surgery.surgeryNumber || surgery.id || "—"}
      </div>

      <!-- Footer -->
      <div class="doc-footer">
        <span>${HOSPITAL.name} · ${HOSPITAL.address}</span>
        <span class="footer-center">
          Ref: ${surgery.surgeryNumber || "—"} ·
          This document is computer-generated · Confidential Medical Record
        </span>
        <span>Printed: ${new Date().toLocaleString("en-KE")}</span>
      </div>
    </div>
  `

  printDocument(html, `Surgical Report — ${surgery.procedureName || "Surgery"}`)
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

// ─── Schedule Surgery Modal ───────────────────────────────────────────────────
const ScheduleSurgeryModal = ({ isOpen, onClose, onSuccess }) => {
  const [step,     setStep]     = useState(1)
  const [saving,   setSaving]   = useState(false)
  const [patients, setPatients] = useState([])
  const [doctors,  setDoctors]  = useState([])
  const [form, setForm] = useState({
    patientSearch: "", patientId: "", patientName: "", visitId: "",
    procedureName: "", icdCode: "", scheduledAt: "",
    theatreRoom: "", anaesthesiaType: "GENERAL", surgeonId: "",
    preOpNotes: "",
    preOpChecklist: {
      consentSigned:    false, npoConfirmed:     false,
      labsReviewed:     false, imagingReviewed:  false,
      bloodGrouped:     false, ivAccessDone:     false,
      skinPrepDone:     false, markingSiteDone:  false,
      allergiesChecked: false, medicationsGiven: false
    }
  })

  useEffect(() => {
    if (isOpen) fetchDoctors()
  }, [isOpen])

  const fetchDoctors = async () => {
    try {
      const r = await api.get("/admin/users?role=SURGEON,DOCTOR&limit=50")
      setDoctors(r.data.data?.users || r.data.users || [])
    } catch {}
  }

  const searchPatients = async (q) => {
    if (q.length < 2) { setPatients([]); return }
    try {
      const r = await api.get(`/patients?search=${q}&limit=5`)
      setPatients(r.data.data?.patients || r.data.patients || [])
    } catch {}
  }

  const toggleChecklist = (key) =>
    setForm(prev => ({
      ...prev,
      preOpChecklist: { ...prev.preOpChecklist, [key]: !prev.preOpChecklist[key] }
    }))

  const handleSubmit = async () => {
    if (!form.patientId)     return toast.error("Select a patient")
    if (!form.procedureName) return toast.error("Procedure name required")
    if (!form.surgeonId)     return toast.error("Select a surgeon")
    setSaving(true)
    try {
      let visitId = form.visitId
      if (!visitId) {
        const vRes = await api.post("/visits", {
          patientId:      form.patientId,
          visitType:      "SURGERY",
          chiefComplaint: form.procedureName
        })
        visitId = vRes.data.data?.visit?.id || vRes.data.visit?.id
      }

      await api.post("/surgery", {
        visitId,
        surgeonId:       form.surgeonId,
        procedureName:   form.procedureName,
        icdCode:         form.icdCode        || undefined,
        scheduledAt:     form.scheduledAt    || undefined,
        theatreRoom:     form.theatreRoom    || undefined,
        anaesthesiaType: form.anaesthesiaType || undefined,
        preOpNotes:      JSON.stringify({
          notes:     form.preOpNotes,
          checklist: form.preOpChecklist
        })
      })

      toast.success("Surgery scheduled successfully!")
      onSuccess()
      onClose()
      setStep(1)
      setForm({
        patientSearch: "", patientId: "", patientName: "", visitId: "",
        procedureName: "", icdCode: "", scheduledAt: "",
        theatreRoom: "", anaesthesiaType: "GENERAL", surgeonId: "",
        preOpNotes: "",
        preOpChecklist: {
          consentSigned:    false, npoConfirmed:     false,
          labsReviewed:     false, imagingReviewed:  false,
          bloodGrouped:     false, ivAccessDone:     false,
          skinPrepDone:     false, markingSiteDone:  false,
          allergiesChecked: false, medicationsGiven: false
        }
      })
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to schedule surgery")
    } finally { setSaving(false) }
  }

  if (!isOpen) return null

  const checklistItems = [
    { key: "consentSigned",    label: "Informed consent signed"      },
    { key: "npoConfirmed",     label: "NPO (nil per oral) confirmed"  },
    { key: "labsReviewed",     label: "Lab results reviewed"          },
    { key: "imagingReviewed",  label: "Imaging reviewed"              },
    { key: "bloodGrouped",     label: "Blood group & crossmatch done" },
    { key: "ivAccessDone",     label: "IV access established"         },
    { key: "skinPrepDone",     label: "Skin preparation done"         },
    { key: "markingSiteDone",  label: "Surgical site marked"          },
    { key: "allergiesChecked", label: "Allergies verified"            },
    { key: "medicationsGiven", label: "Pre-op medications given"      }
  ]

  const checklistDone = Object.values(form.preOpChecklist).filter(Boolean).length

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <Scissors className="w-5 h-5 text-indigo-600" /> Schedule Surgery
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Step {step} of 3</p>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex px-5 pt-4 gap-2">
          {["Patient & Procedure", "Scheduling & Team", "Pre-Op Checklist"].map((s, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${
              step > i ? "bg-indigo-600" : "bg-gray-200"
            }`} />
          ))}
        </div>

        <div className="p-5 space-y-5">
          {/* ── Step 1 ── */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patient *
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={form.patientSearch}
                    onChange={e => {
                      setForm(prev => ({ ...prev, patientSearch: e.target.value }))
                      searchPatients(e.target.value)
                    }}
                    placeholder="Search patient by name or MRN..."
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm
                               focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                {patients.length > 0 && (
                  <div className="border border-gray-200 rounded-xl mt-1 overflow-hidden">
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
                        className="p-2.5 hover:bg-gray-50 cursor-pointer text-sm border-b last:border-0"
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
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> {form.patientName} selected
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Procedure / Operation Name *
                </label>
                <input
                  type="text"
                  value={form.procedureName}
                  onChange={e => setForm(prev => ({ ...prev, procedureName: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm
                             focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Appendicectomy, Caesarean Section, Hernia Repair..."
                />
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-2">Common Procedures:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Appendicectomy", "Caesarean Section", "Laparotomy",
                    "Hernia Repair", "Cholecystectomy", "Debridement",
                    "Wound Closure", "Amputation", "Hysterectomy",
                    "Prostatectomy", "Fracture Fixation", "Skin Grafting"
                  ].map(proc => (
                    <button
                      key={proc}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, procedureName: proc }))}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                        form.procedureName === proc
                          ? "bg-indigo-100 text-indigo-700 border-indigo-300"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {proc}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ICD-10 Code (optional)
                </label>
                <input
                  type="text"
                  value={form.icdCode}
                  onChange={e => setForm(prev => ({ ...prev, icdCode: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                  placeholder="e.g. K35.9, O82, K40.9..."
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!form.patientId)     return toast.error("Select a patient")
                  if (!form.procedureName) return toast.error("Procedure name required")
                  setStep(2)
                }}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-medium
                           hover:bg-indigo-700"
              >
                Next: Scheduling & Team →
              </button>
            </>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Scheduled Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={e => setForm(prev => ({ ...prev, scheduledAt: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm
                               focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Theatre Room
                  </label>
                  <select
                    value={form.theatreRoom}
                    onChange={e => setForm(prev => ({ ...prev, theatreRoom: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                  >
                    <option value="">Select theatre...</option>
                    {THEATRE_ROOMS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lead Surgeon *
                </label>
                <select
                  value={form.surgeonId}
                  onChange={e => setForm(prev => ({ ...prev, surgeonId: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm
                             focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select surgeon...</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>
                      Dr. {d.firstName} {d.lastName} — {d.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Anaesthesia Type
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {ANAESTHESIA_TYPES.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, anaesthesiaType: type }))}
                      className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                        form.anaesthesiaType === type
                          ? "bg-indigo-100 text-indigo-700 border-indigo-300"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pre-Operative Notes
                </label>
                <textarea
                  value={form.preOpNotes}
                  onChange={e => setForm(prev => ({ ...prev, preOpNotes: e.target.value }))}
                  rows={4}
                  placeholder="Pre-operative assessment, patient condition, special considerations..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-700
                             rounded-xl text-sm font-medium"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!form.surgeonId) return toast.error("Select a surgeon")
                    setStep(3)
                  }}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium"
                >
                  Next: Pre-Op Checklist →
                </button>
              </div>
            </>
          )}

          {/* ── Step 3 ── */}
          {step === 3 && (
            <>
              <div className="bg-indigo-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-indigo-800 flex items-center gap-2">
                    <Clipboard className="w-4 h-4" /> Pre-Operative Safety Checklist
                  </h3>
                  <span className="text-sm text-indigo-700 font-medium">
                    {checklistDone}/{checklistItems.length} done
                  </span>
                </div>

                <div className="w-full h-2 bg-indigo-200 rounded-full mb-4">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all"
                    style={{ width: `${(checklistDone / checklistItems.length) * 100}%` }}
                  />
                </div>

                <div className="space-y-2">
                  {checklistItems.map(item => (
                    <label key={item.key}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <div
                        onClick={() => toggleChecklist(item.key)}
                        className={`w-5 h-5 rounded flex items-center justify-center border-2
                                    flex-shrink-0 transition-all ${
                          form.preOpChecklist[item.key]
                            ? "bg-indigo-600 border-indigo-600"
                            : "border-gray-300 group-hover:border-indigo-400"
                        }`}
                      >
                        {form.preOpChecklist[item.key] && (
                          <CheckCircle className="w-3.5 h-3.5 text-white" />
                        )}
                      </div>
                      <span className={`text-sm ${
                        form.preOpChecklist[item.key]
                          ? "text-gray-500 line-through"
                          : "text-gray-700"
                      }`}>
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
                <p className="font-medium text-gray-700 mb-2">Surgery Summary</p>
                <p>
                  <span className="text-gray-500">Patient: </span>
                  <span className="font-medium">{form.patientName}</span>
                </p>
                <p>
                  <span className="text-gray-500">Procedure: </span>
                  <span className="font-medium">{form.procedureName}</span>
                </p>
                {form.scheduledAt && (
                  <p>
                    <span className="text-gray-500">Scheduled: </span>
                    <span className="font-medium">{formatDateTime(form.scheduledAt)}</span>
                  </p>
                )}
                {form.theatreRoom && (
                  <p>
                    <span className="text-gray-500">Theatre: </span>
                    <span className="font-medium">{form.theatreRoom}</span>
                  </p>
                )}
                <p>
                  <span className="text-gray-500">Anaesthesia: </span>
                  <span className="font-medium">{form.anaesthesiaType}</span>
                </p>
                <p>
                  <span className="text-gray-500">Checklist: </span>
                  <span className={`font-medium ${
                    checklistDone === checklistItems.length
                      ? "text-green-600"
                      : "text-orange-600"
                  }`}>
                    {checklistDone}/{checklistItems.length} items complete
                  </span>
                </p>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-700
                             rounded-xl text-sm font-medium"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl
                             text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? "Scheduling..." : "Schedule Surgery"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Surgery Notes Modal ──────────────────────────────────────────────────────
const SurgeryNotesModal = ({ isOpen, surgery, noteType, onClose, onSuccess }) => {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    notes:        "",
    complications: "",
    startedAt:    new Date().toISOString().slice(0, 16),
    completedAt:  ""
  })

  const isIntraOp = noteType === "intra"
  const isPostOp  = noteType === "post"

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.notes) return toast.error("Notes are required")
    setSaving(true)
    try {
      const payload = {}
      if (isIntraOp) {
        payload.status        = "IN_PROGRESS"
        payload.startedAt     = form.startedAt
        payload.intraOpNotes  = form.notes
        payload.complications = form.complications
      }
      if (isPostOp) {
        payload.status        = "COMPLETED"
        payload.completedAt   = form.completedAt || new Date().toISOString()
        payload.postOpNotes   = form.notes
        payload.complications = form.complications
      }

      await api.patch(`/surgery/${surgery.id}/status`, payload)

      toast.success(
        isIntraOp
          ? "Surgery started — intra-op notes saved!"
          : "Surgery completed — post-op notes saved!"
      )

      // Auto-print after completing surgery
      if (isPostOp) {
        const enrichedSurgery = {
          ...surgery,
          postOpNotes:   form.notes,
          complications: form.complications,
          completedAt:   payload.completedAt,
          status:        "COMPLETED"
        }
        setTimeout(() => {
          const confirmed = window.confirm(
            "Surgery completed. Print the surgical report now?"
          )
          if (confirmed) printSurgeryReport(enrichedSurgery)
        }, 500)
      }

      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save notes")
    } finally { setSaving(false) }
  }

  if (!isOpen || !surgery) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5
                        flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              {isIntraOp
                ? <><Play className="w-5 h-5 text-orange-500" /> Intra-Operative Notes</>
                : <><CheckCircle className="w-5 h-5 text-green-500" /> Post-Operative Notes</>
              }
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {surgery.visit?.patient?.firstName} {surgery.visit?.patient?.lastName}
              {" • "}{surgery.surgeryNumber}
            </p>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-indigo-50 rounded-xl p-3">
            <p className="font-medium text-indigo-800">{surgery.procedureName}</p>
            <p className="text-xs text-indigo-600 mt-0.5">
              Theatre: {surgery.theatreRoom || "—"} •
              Anaesthesia: {surgery.anaesthesiaType || "—"}
            </p>
          </div>

          {isIntraOp && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Surgery Start Time
              </label>
              <input
                type="datetime-local"
                value={form.startedAt}
                onChange={e => setForm(prev => ({ ...prev, startedAt: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
              />
            </div>
          )}

          {isPostOp && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Surgery End Time
                </label>
                <input
                  type="datetime-local"
                  value={form.completedAt}
                  onChange={e => setForm(prev => ({ ...prev, completedAt: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration
                </label>
                <div className="px-3 py-2.5 bg-gray-50 rounded-xl text-sm text-gray-600">
                  {form.completedAt && surgery.startedAt
                    ? calcDuration(surgery.startedAt, form.completedAt)
                    : "—"
                  }
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isIntraOp
                ? "Intra-Operative Findings & Notes *"
                : "Post-Operative Notes *"
              }
            </label>
            <textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={6}
              placeholder={isIntraOp
                ? "Operative findings, procedure performed, organs involved, blood loss, fluids given, specimens sent..."
                : "Patient condition post-op, recovery status, instructions, drain output, wound status..."
              }
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm
                         focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Complications (if any)
            </label>
            <input
              type="text"
              value={form.complications}
              onChange={e => setForm(prev => ({ ...prev, complications: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
              placeholder="Haemorrhage, anaesthesia reaction, conversion to open, etc."
            />
          </div>

          {isPostOp && form.complications && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3
                            flex items-center gap-2 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Complications documented — relevant teams will be notified
            </div>
          )}

          {/* Print hint on post-op modal */}
          {isPostOp && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Printer className="w-3.5 h-3.5" />
              Surgical report will auto-print after completion
            </p>
          )}

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
                isIntraOp
                  ? "bg-orange-600 hover:bg-orange-700"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {saving
                ? "Saving..."
                : isIntraOp ? "Start Surgery & Save" : "Complete Surgery & Save"
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Surgery Card ─────────────────────────────────────────────────────────────
const SurgeryCard = ({ surgery, onView, onIntraOp, onPostOp, onPrint, userRole }) => {
  const cfg      = STATUS_CONFIG[surgery.status] || STATUS_CONFIG.REQUESTED
  const patient  = surgery.visit?.patient
  const StatusIcon = cfg.icon

  const canOperate = [
    "SURGEON", "DOCTOR", "THEATRE_NURSE",
    "CLINICAL_COORDINATOR", "SUPER_ADMIN", "HOSPITAL_ADMIN"
  ].includes(userRole)

  return (
    <div className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all ${
      surgery.status === "IN_PROGRESS" ? "border-orange-300 ring-1 ring-orange-200" :
      surgery.status === "REQUESTED"   ? "border-blue-200" :
      "border-gray-100"
    }`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold ${
              patient?.gender === "MALE"
                ? "bg-blue-100 text-blue-700"
                : "bg-pink-100 text-pink-700"
            }`}>
              {patient?.firstName?.[0]}{patient?.lastName?.[0]}
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">
                {patient?.firstName} {patient?.lastName}
              </h3>
              <p className="text-xs text-gray-500">
                {patient?.mrn} • {surgery.surgeryNumber}
              </p>
            </div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium
                            flex items-center gap-1 ${cfg.bg} ${cfg.text}`}>
            <StatusIcon className="w-3 h-3" />
            {cfg.label}
          </span>
        </div>

        {/* Procedure */}
        <div className="bg-indigo-50 rounded-xl px-3 py-2.5 mb-3">
          <p className="font-semibold text-indigo-900 text-sm">{surgery.procedureName}</p>
          {surgery.icdCode && (
            <p className="text-xs text-indigo-500 mt-0.5">ICD: {surgery.icdCode}</p>
          )}
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-xs text-gray-500">Scheduled</p>
            <p className="text-sm font-medium text-gray-800">
              {surgery.scheduledAt ? formatDateTime(surgery.scheduledAt) : "Not set"}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-xs text-gray-500">Theatre</p>
            <p className="text-sm font-medium text-gray-800">
              {surgery.theatreRoom || "—"}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-xs text-gray-500">Anaesthesia</p>
            <p className="text-sm font-medium text-gray-800">
              {surgery.anaesthesiaType || "—"}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-xs text-gray-500">Duration</p>
            <p className="text-sm font-medium text-gray-800">
              {calcDuration(surgery.startedAt, surgery.completedAt) || "—"}
            </p>
          </div>
        </div>

        {/* Surgeon */}
        {surgery.surgeon && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
            <Stethoscope className="w-3.5 h-3.5" />
            <span>
              Surgeon: Dr. {surgery.surgeon.firstName} {surgery.surgeon.lastName}
            </span>
          </div>
        )}

        {/* Complications */}
        {surgery.complications && (
          <div className="flex items-center gap-2 text-xs bg-red-50 text-red-700
                          rounded-lg px-3 py-2 mb-3">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Complications: {surgery.complications}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-100">
          <button
            onClick={() => onView(surgery)}
            className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700
                       px-3 py-1.5 rounded-lg hover:bg-gray-200"
          >
            <Eye className="w-3 h-3" /> View
          </button>

          {/* Print — visible on all statuses that have notes */}
          {(surgery.status === "COMPLETED" ||
            surgery.status === "IN_PROGRESS" ||
            surgery.intraOpNotes ||
            surgery.postOpNotes) && (
            <button
              onClick={() => onPrint(surgery)}
              className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700
                         border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-100"
            >
              <Printer className="w-3 h-3" /> Print Report
            </button>
          )}

          {canOperate && surgery.status === "SCHEDULED" && (
            <button
              onClick={() => onIntraOp(surgery)}
              className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700
                         px-3 py-1.5 rounded-lg hover:bg-orange-200"
            >
              <Play className="w-3 h-3" /> Start Surgery
            </button>
          )}

          {canOperate && surgery.status === "IN_PROGRESS" && (
            <button
              onClick={() => onPostOp(surgery)}
              className="flex items-center gap-1 text-xs bg-green-100 text-green-700
                         px-3 py-1.5 rounded-lg hover:bg-green-200"
            >
              <CheckCircle className="w-3 h-3" /> Complete Surgery
            </button>
          )}

          {surgery.status === "REQUESTED" && canOperate && (
            <button
              onClick={() => onIntraOp(surgery)}
              className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700
                         px-3 py-1.5 rounded-lg hover:bg-blue-200"
            >
              <Play className="w-3 h-3" /> Commence
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Surgery Detail Drawer ────────────────────────────────────────────────────
const SurgeryDetailDrawer = ({ surgery, onClose, onPrint }) => {
  if (!surgery) return null
  const cfg     = STATUS_CONFIG[surgery.status] || STATUS_CONFIG.REQUESTED
  const patient = surgery.visit?.patient

  let preOpData = null
  try {
    preOpData = surgery.preOpNotes ? JSON.parse(surgery.preOpNotes) : null
  } catch {
    preOpData = null
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
      <div className="w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl">

        {/* Sticky header with print button */}
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5
                        flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Surgery Details</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPrint(surgery)}
              className="flex items-center gap-1.5 text-sm bg-indigo-50 text-indigo-700
                         border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-100"
            >
              <Printer className="w-4 h-4" /> Print Report
            </button>
            <button onClick={onClose}>
              <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Patient Header */}
          <div className={`rounded-xl p-4 ${cfg.bg}`}>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center
                              font-bold text-xl text-indigo-600">
                {patient?.firstName?.[0]}{patient?.lastName?.[0]}
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg">
                  {patient?.firstName} {patient?.lastName}
                </h3>
                <p className="text-sm text-gray-600">
                  {patient?.mrn} • {patient?.gender} • {calcAge(patient?.dateOfBirth)}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                                  mt-1 inline-block ${cfg.bg} ${cfg.text}`}>
                  {cfg.label}
                </span>
              </div>
            </div>
          </div>

          {/* Procedure */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Scissors className="w-4 h-4 text-indigo-600" /> Procedure
            </h4>
            <div className="bg-indigo-50 rounded-xl p-4">
              <p className="font-bold text-indigo-900 text-lg">{surgery.procedureName}</p>
              {surgery.icdCode && (
                <p className="text-sm text-indigo-600">ICD-10: {surgery.icdCode}</p>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" /> Timeline
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Surgery #",   value: surgery.surgeryNumber               },
                { label: "Theatre",     value: surgery.theatreRoom || "—"          },
                { label: "Anaesthesia", value: surgery.anaesthesiaType || "—"      },
                { label: "Scheduled",   value: formatDateTime(surgery.scheduledAt) },
                { label: "Started",     value: formatDateTime(surgery.startedAt)   },
                { label: "Completed",   value: formatDateTime(surgery.completedAt) },
                {
                  label: "Duration",
                  value: calcDuration(surgery.startedAt, surgery.completedAt) || "—"
                }
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Pre-Op Checklist */}
          {preOpData?.checklist && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Clipboard className="w-4 h-4 text-purple-500" /> Pre-Op Checklist
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(preOpData.checklist).map(([key, done]) => (
                  <div key={key} className="flex items-center gap-2">
                    {done
                      ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      : <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                    }
                    <span className="text-xs text-gray-600">
                      {key.replace(/([A-Z])/g, " $1")
                           .replace(/^./, s => s.toUpperCase())}
                    </span>
                  </div>
                ))}
              </div>
              {preOpData.notes && (
                <div className="mt-3 bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
                  <p className="font-medium text-gray-700 mb-1">Pre-Op Notes</p>
                  {preOpData.notes}
                </div>
              )}
            </div>
          )}

          {/* Intra-Op Notes */}
          {surgery.intraOpNotes && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Play className="w-4 h-4 text-orange-500" /> Intra-Operative Notes
              </h4>
              <p className="text-sm text-gray-600 bg-orange-50 rounded-xl p-4 whitespace-pre-wrap">
                {surgery.intraOpNotes}
              </p>
            </div>
          )}

          {/* Post-Op Notes */}
          {surgery.postOpNotes && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" /> Post-Operative Notes
              </h4>
              <p className="text-sm text-gray-600 bg-green-50 rounded-xl p-4 whitespace-pre-wrap">
                {surgery.postOpNotes}
              </p>
            </div>
          )}

          {/* Complications */}
          {surgery.complications && (
            <div>
              <h4 className="font-semibold text-red-600 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Complications
              </h4>
              <p className="text-sm text-red-700 bg-red-50 rounded-xl p-4">
                {surgery.complications}
              </p>
            </div>
          )}

          {/* Patient Allergies */}
          {patient?.allergies?.length > 0 && (
            <div>
              <h4 className="font-semibold text-red-600 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Patient Allergies
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

          {/* Full-width print button at bottom of drawer */}
          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={() => onPrint(surgery)}
              className="w-full flex items-center justify-center gap-2 py-3
                         bg-indigo-600 text-white rounded-xl text-sm font-medium
                         hover:bg-indigo-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print / Download Surgical Report
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Surgery Page ────────────────────────────────────────────────────────
export default function SurgeryPage() {
  const { user } = useAuthStore()

  const [activeTab,    setActiveTab]    = useState("all")
  const [surgeries,    setSurgeries]    = useState([])
  const [stats,        setStats]        = useState({})
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState("")
  const [refreshKey,   setRefreshKey]   = useState(0)

  const [showSchedule, setShowSchedule] = useState(false)
  const [intraOp,      setIntraOp]      = useState(null)
  const [postOp,       setPostOp]       = useState(null)
  const [detail,       setDetail]       = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await api.get("/surgery?limit=50")
      const data = res.data
      const list = data.data?.surgeries || data.surgeries || data.data || []

      setSurgeries(list)
      setStats({
        total:      list.length,
        requested:  list.filter(s => s.status === "REQUESTED").length,
        scheduled:  list.filter(s => s.status === "SCHEDULED").length,
        inProgress: list.filter(s => s.status === "IN_PROGRESS").length,
        completed:  list.filter(s => s.status === "COMPLETED").length,
        todayCount: list.filter(s => {
          if (!s.scheduledAt) return false
          return new Date(s.scheduledAt).toDateString() === new Date().toDateString()
        }).length
      })
    } catch (err) {
      console.error("Surgery fetch error:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData, refreshKey])

  // ── Central print handler ──────────────────────────────────────────────────
  const handlePrint = (surgery) => {
    try {
      printSurgeryReport(surgery)
    } catch (e) {
      console.error("Print error:", e)
      toast.error("Failed to open print window")
    }
  }

  const filteredSurgeries = surgeries.filter(s => {
    const q           = search.toLowerCase()
    const matchSearch = !search
      || `${s.visit?.patient?.firstName} ${s.visit?.patient?.lastName}`
           .toLowerCase().includes(q)
      || s.procedureName?.toLowerCase().includes(q)
      || s.surgeryNumber?.toLowerCase().includes(q)
      || s.visit?.patient?.mrn?.toLowerCase().includes(q)

    const matchTab =
      activeTab === "all"         ? true :
      activeTab === "scheduled"   ? ["SCHEDULED", "REQUESTED"].includes(s.status) :
      activeTab === "in_progress" ? s.status === "IN_PROGRESS" :
      activeTab === "completed"   ? s.status === "COMPLETED" :
      true

    return matchSearch && matchTab
  })

  const canSchedule = [
    "SURGEON", "DOCTOR", "CLINICAL_COORDINATOR",
    "SUPER_ADMIN", "HOSPITAL_ADMIN"
  ].includes(user?.role)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Scissors className="w-7 h-7 text-indigo-600" />
            Surgery / Theatre
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Surgical procedures — scheduling, theatre management & operative notes
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200"
          >
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
          {canSchedule && (
            <button
              onClick={() => setShowSchedule(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white
                         px-4 py-2 rounded-xl hover:bg-indigo-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Schedule Surgery
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total"       value={stats.total}      icon={Scissors}    color="indigo" />
        <StatCard label="Requested"   value={stats.requested}  icon={Clipboard}   color="gray"   />
        <StatCard label="Scheduled"   value={stats.scheduled}  icon={Calendar}    color="blue"   />
        <StatCard
          label="In Progress"
          value={stats.inProgress}
          icon={Play}
          color="orange"
          sub={stats.inProgress > 0 ? "Active now" : ""}
        />
        <StatCard label="Completed"   value={stats.completed}  icon={CheckCircle} color="green"  />
      </div>

      {/* Today's Theatre Schedule */}
      {stats.todayCount > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-indigo-800">
              Today's Theatre Schedule (
              {stats.todayCount} procedure{stats.todayCount > 1 ? "s" : ""})
            </h3>
          </div>
          <div className="space-y-2">
            {surgeries
              .filter(s => {
                if (!s.scheduledAt) return false
                return new Date(s.scheduledAt).toDateString() === new Date().toDateString()
              })
              .map(s => {
                const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.SCHEDULED
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between bg-white rounded-xl
                               px-4 py-2.5 cursor-pointer hover:shadow-sm"
                  >
                    <div
                      className="flex items-center gap-3 flex-1"
                      onClick={() => setDetail(s)}
                    >
                      <span className="text-sm font-semibold text-indigo-700">
                        {new Date(s.scheduledAt).toLocaleTimeString([], {
                          hour: "2-digit", minute: "2-digit"
                        })}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {s.procedureName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {s.visit?.patient?.firstName} {s.visit?.patient?.lastName} •{" "}
                          {s.theatreRoom || "Theatre TBD"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium
                                        ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                      {/* Quick print from today's schedule */}
                      {(s.intraOpNotes || s.postOpNotes) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePrint(s) }}
                          title="Print surgical report"
                          className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg
                                     hover:bg-indigo-100"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Tabs & Search */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map(tab => {
            const count =
              tab.key === "scheduled"   ? stats.scheduled + stats.requested :
              tab.key === "in_progress" ? stats.inProgress :
              tab.key === "completed"   ? stats.completed :
              stats.total

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium
                            whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.key
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search patient, procedure, surgery number..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm
                         focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Surgery Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i}
              className="bg-white rounded-xl p-4 animate-pulse border border-gray-100">
              <div className="flex gap-3 mb-3">
                <div className="w-11 h-11 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              </div>
              <div className="h-12 bg-indigo-50 rounded-xl mb-3" />
              <div className="grid grid-cols-2 gap-2">
                <div className="h-14 bg-gray-100 rounded-lg" />
                <div className="h-14 bg-gray-100 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredSurgeries.length === 0 ? (
        <div className="bg-white rounded-xl p-16 text-center border border-gray-100">
          <Scissors className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">
            {search ? "No surgeries match your search" : "No surgeries found"}
          </p>
          {canSchedule && !search && (
            <button
              onClick={() => setShowSchedule(true)}
              className="mt-3 text-sm text-indigo-600 hover:text-indigo-800"
            >
              Schedule first surgery →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSurgeries.map(surgery => (
            <SurgeryCard
              key={surgery.id}
              surgery={surgery}
              onView={setDetail}
              onIntraOp={setIntraOp}
              onPostOp={setPostOp}
              onPrint={handlePrint}
              userRole={user?.role}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <ScheduleSurgeryModal
        isOpen={showSchedule}
        onClose={() => setShowSchedule(false)}
        onSuccess={() => setRefreshKey(k => k + 1)}
      />

      <SurgeryNotesModal
        isOpen={!!intraOp}
        surgery={intraOp}
        noteType="intra"
        onClose={() => setIntraOp(null)}
        onSuccess={() => setRefreshKey(k => k + 1)}
      />

      <SurgeryNotesModal
        isOpen={!!postOp}
        surgery={postOp}
        noteType="post"
        onClose={() => setPostOp(null)}
        onSuccess={() => setRefreshKey(k => k + 1)}
      />

      {detail && (
        <SurgeryDetailDrawer
          surgery={detail}
          onClose={() => setDetail(null)}
          onPrint={handlePrint}
        />
      )}
    </div>
  )
}