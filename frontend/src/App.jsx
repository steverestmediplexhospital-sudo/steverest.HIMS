// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Toaster } from "react-hot-toast"
import { Suspense, lazy, useEffect, useRef } from "react"
import { io } from "socket.io-client"
import useAuthStore from "./store/authStore"
import useNotificationStore, {
  mapEventToNotification,
  ROLE_EVENT_MAP,
} from "./store/notificationStore"
import MainLayout from "./components/layout/MainLayout"
import LoginPage from "./pages/auth/LoginPage"

// ── Core Pages ──────────────────────────────────────────────────────────────
const Dashboard        = lazy(() => import("./pages/dashboard/Dashboard"))
const AdminPage        = lazy(() => import("./pages/admin/AdminPage"))
const ReceptionPage    = lazy(() => import("./pages/reception/ReceptionPage"))
const CoordinatorPage  = lazy(() => import("./pages/coordinator/CoordinatorPage"))
const ReportsPage      = lazy(() => import("./pages/reports/ReportsPage"))

// ── Doctor / Clinical ────────────────────────────────────────────────────────
const DoctorPage       = lazy(() => import("./pages/doctor/DoctorPage"))
const DoctorQueue      = lazy(() => import("./pages/doctor/DoctorQueue"))
const ConsultationForm = lazy(() => import("./pages/doctor/ConsultationForm"))
const PatientChart     = lazy(() => import("./pages/doctor/PatientChart"))

// ── Nursing ──────────────────────────────────────────────────────────────────
const NursingPage      = lazy(() => import("./pages/nursing/NursingPage"))

// ── Departmental Modules ─────────────────────────────────────────────────────
const LaboratoryPage   = lazy(() => import("./pages/laboratory/LaboratoryPage"))
const PharmacyPage     = lazy(() => import("./pages/pharmacy/PharmacyPage"))
const RadiologyPage    = lazy(() => import("./pages/radiology/RadiologyPage"))
const EmergencyPage    = lazy(() => import("./pages/emergency/EmergencyPage"))
const BillingPage      = lazy(() => import("./pages/billing/BillingPage"))

// ── IPD / Inpatient ──────────────────────────────────────────────────────────
const IPDPage          = lazy(() => import("./pages/ipd/IPDPage"))
const OPDPage          = lazy(() => import("./pages/opd/OPDPage"))

// ── Appointments & Admissions ─────────────────────────────────────────────────
const AppointmentPage  = lazy(() => import("./pages/appointments/AppointmentPage"))
const AdmissionPage    = lazy(() => import("./pages/admission/AdmissionPage"))

// ── Specialised Clinical ─────────────────────────────────────────────────────
const SurgeryPage      = lazy(() => import("./pages/surgery/SurgeryPage"))
const MaternityPage    = lazy(() => import("./pages/maternity/MaternityPage"))
const MortuaryPage     = lazy(() => import("./pages/mortuary/MortuaryPage"))

// ── Operations ───────────────────────────────────────────────────────────────
const InventoryPage    = lazy(() => import("./pages/inventory/InventoryPage"))
const FacilityPage     = lazy(() => import("./pages/facility/FacilityPage"))

// ────────────────────────────────────────────────────────────────────────────
// SOCKET.IO EVENTS TO LISTEN FOR
// ────────────────────────────────────────────────────────────────────────────
const SOCKET_EVENTS = [
  "emergency:new_case",
  "emergency:immediate",
  "vitals:critical",
  "vitals:alert",
  "triage:completed",
  "mortuary:new_admission",
  "admission:new",
  "visit:created",
]

// ────────────────────────────────────────────────────────────────────────────
// CRITICAL ALERT SOUND (Web Audio API — no file needed)
// ────────────────────────────────────────────────────────────────────────────
const playCriticalSound = () => {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    const beep = (freq, start, duration) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = "sine"
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(
        0.001, ctx.currentTime + start + duration
      )
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + duration)
    }
    beep(880, 0.0, 0.15)
    beep(880, 0.2, 0.15)
    beep(660, 0.4, 0.25)
  } catch {
    // AudioContext not available — silent fallback
  }
}

const playAlertSound = () => {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 660
    osc.type = "sine"
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch { /* silent */ }
}

// ────────────────────────────────────────────────────────────────────────────
// PAGE LOADER
// ────────────────────────────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-gray-500 text-sm font-medium">Loading...</p>
    </div>
  </div>
)

// ────────────────────────────────────────────────────────────────────────────
// PROTECTED ROUTE
// ────────────────────────────────────────────────────────────────────────────
const ProtectedRoute = ({ children, roles }) => {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (roles && user && !roles.includes(user.role))
    return <Navigate to="/dashboard" replace />
  return (
    <MainLayout>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </MainLayout>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// ROLE-BASED REDIRECT
// ────────────────────────────────────────────────────────────────────────────
const RoleRedirect = () => {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />

  const roleHomeMap = {
    NURSE:                   "/nursing",
    MIDWIFE:                 "/nursing",
    THEATRE_NURSE:           "/nursing",
    DOCTOR:                  "/doctor",
    SURGEON:                 "/surgery",
    LAB_TECHNICIAN:          "/laboratory",
    LAB_SCIENTIST:           "/laboratory",
    PHARMACIST:              "/pharmacy",
    RADIOGRAPHER:            "/radiology",
    RECEPTIONIST:            "/reception",
    MEDICAL_RECORDS_OFFICER: "/reception",
    CASHIER:                 "/billing",
    ACCOUNTANT:              "/billing",
    INVENTORY_OFFICER:       "/inventory",
    FACILITY_OFFICER:        "/facility",
    MORTUARY_OFFICER:        "/mortuary",
    CLINICAL_COORDINATOR:    "/coordinator",
    MEDICAL_DIRECTOR:        "/dashboard",
    SUPER_ADMIN:             "/dashboard",
    HOSPITAL_ADMIN:          "/dashboard",
  }

  return <Navigate to={roleHomeMap[user?.role] || "/dashboard"} replace />
}

// ────────────────────────────────────────────────────────────────────────────
// ROLE GROUPS
// ────────────────────────────────────────────────────────────────────────────
const ADMIN_ROLES = [
  "SUPER_ADMIN", "HOSPITAL_ADMIN", "MEDICAL_DIRECTOR",
]

const COORDINATOR_PLUS = [
  ...ADMIN_ROLES, "CLINICAL_COORDINATOR",
]

const DR = [
  "DOCTOR", "SURGEON", "MEDICAL_DIRECTOR",
  "CLINICAL_COORDINATOR", "SUPER_ADMIN", "HOSPITAL_ADMIN",
]

const NR = [
  "NURSE", "MIDWIFE", "THEATRE_NURSE",
  "CLINICAL_COORDINATOR", "SUPER_ADMIN", "HOSPITAL_ADMIN", "MEDICAL_DIRECTOR",
]

const ALL_CLINICAL = [
  "DOCTOR", "SURGEON",
  "NURSE", "MIDWIFE", "THEATRE_NURSE",
  "MEDICAL_DIRECTOR", "CLINICAL_COORDINATOR",
  "SUPER_ADMIN", "HOSPITAL_ADMIN",
]

const FINANCE_ROLES = [
  "ACCOUNTANT", "CASHIER", "RECEPTIONIST",
  "CLINICAL_COORDINATOR", "SUPER_ADMIN", "HOSPITAL_ADMIN",
]

const ALL_ROLES = [
  "SUPER_ADMIN", "HOSPITAL_ADMIN", "MEDICAL_DIRECTOR",
  "CLINICAL_COORDINATOR", "RECEPTIONIST", "MEDICAL_RECORDS_OFFICER",
  "NURSE", "DOCTOR", "MIDWIFE", "LAB_SCIENTIST", "LAB_TECHNICIAN",
  "RADIOGRAPHER", "PHARMACIST", "INVENTORY_OFFICER",
  "FACILITY_OFFICER", "CASHIER", "ACCOUNTANT",
  "THEATRE_NURSE", "SURGEON", "MORTUARY_OFFICER",
]

const APPOINTMENT_ROLES = [
  "RECEPTIONIST", "NURSE", "MIDWIFE", "DOCTOR", "SURGEON",
  "CLINICAL_COORDINATOR", "SUPER_ADMIN", "HOSPITAL_ADMIN",
  "MEDICAL_DIRECTOR", "MEDICAL_RECORDS_OFFICER",
]

// ────────────────────────────────────────────────────────────────────────────
// APP — with Socket.IO listener
// ────────────────────────────────────────────────────────────────────────────
export default function App() {
  const { isAuthenticated, user } = useAuthStore()
  const { addNotification }       = useNotificationStore()
  const socketRef                 = useRef(null)

  // ── Socket.IO connection ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      return
    }

    if (socketRef.current?.connected) return

    const socket = io(
      import.meta.env.VITE_SOCKET_URL || "http://localhost:5000",
      {
        transports:          ["websocket", "polling"],
        reconnectionDelay:    1000,
        reconnectionAttempts: 10,
        auth: { role: user.role },
      }
    )

    socketRef.current = socket

    socket.on("connect", () => {
      console.log("[Socket.IO] Connected:", socket.id)
    })

    socket.on("disconnect", (reason) => {
      console.log("[Socket.IO] Disconnected:", reason)
    })

    socket.on("connect_error", (err) => {
      console.warn("[Socket.IO] Connection error:", err.message)
    })

    const allowedEvents = ROLE_EVENT_MAP[user.role] || []

    SOCKET_EVENTS.forEach((event) => {
      socket.on(event, (payload) => {
        if (!allowedEvents.includes(event)) return
        const notification = mapEventToNotification(event, payload)
        addNotification(notification)
        if (notification.type === "CRITICAL") {
          playCriticalSound()
        } else if (
          notification.type === "ALERT" ||
          notification.type === "WARNING"
        ) {
          playAlertSound()
        }
      })
    })

    return () => {
      SOCKET_EVENTS.forEach((event) => socket.off(event))
      socket.disconnect()
      socketRef.current = null
    }
  }, [isAuthenticated, user?.role])

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { borderRadius: "10px", fontSize: "14px" },
        }}
      />

      <Routes>
        {/* ── Public ── */}
        <Route
          path="/login"
          element={
            isAuthenticated
              ? <Navigate to="/dashboard" replace />
              : <LoginPage />
          }
        />

        {/* ── Root redirect ── */}
        <Route path="/" element={<RoleRedirect />} />

        {/* ── Dashboard ── */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* ════════ DOCTOR ════════ */}
        <Route path="/doctor"
          element={
            <ProtectedRoute roles={DR}>
              <DoctorPage />
            </ProtectedRoute>
          }
        />
        <Route path="/doctor/queue"
          element={
            <ProtectedRoute roles={DR}>
              <DoctorQueue />
            </ProtectedRoute>
          }
        />
        <Route path="/doctor/consult/:visitId"
          element={
            <ProtectedRoute roles={DR}>
              <ConsultationForm />
            </ProtectedRoute>
          }
        />
        <Route path="/doctor/patient/:patientId"
          element={
            <ProtectedRoute roles={ALL_CLINICAL}>
              <PatientChart />
            </ProtectedRoute>
          }
        />

        {/* ════════ NURSING ════════ */}
        <Route path="/nursing"
          element={
            <ProtectedRoute roles={NR}>
              <NursingPage />
            </ProtectedRoute>
          }
        />
        <Route path="/nursing/vitals/:visitId"
          element={
            <ProtectedRoute roles={NR}>
              <NursingPage />
            </ProtectedRoute>
          }
        />
        <Route path="/nursing/notes/:visitId"
          element={
            <ProtectedRoute roles={NR}>
              <NursingPage />
            </ProtectedRoute>
          }
        />

        {/* ════════ ADMIN ════════ */}
        <Route path="/admin/*"
          element={
            <ProtectedRoute roles={ADMIN_ROLES}>
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route path="/coordinator/*"
          element={
            <ProtectedRoute roles={COORDINATOR_PLUS}>
              <CoordinatorPage />
            </ProtectedRoute>
          }
        />

        {/* ════════ RECEPTION ════════ */}
        <Route path="/reception/*"
          element={
            <ProtectedRoute roles={[
              "RECEPTIONIST","NURSE","CLINICAL_COORDINATOR",
              "SUPER_ADMIN","HOSPITAL_ADMIN","MEDICAL_RECORDS_OFFICER",
            ]}>
              <ReceptionPage />
            </ProtectedRoute>
          }
        />

        {/* ════════ OPD ════════ */}
        <Route path="/opd/*"
          element={
            <ProtectedRoute roles={[
              "RECEPTIONIST","NURSE","DOCTOR","MIDWIFE","SURGEON",
              "CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN",
              "MEDICAL_DIRECTOR","MEDICAL_RECORDS_OFFICER",
            ]}>
              <OPDPage />
            </ProtectedRoute>
          }
        />

        {/* ════════ APPOINTMENTS ════════ */}
        <Route path="/appointments/*"
          element={
            <ProtectedRoute roles={APPOINTMENT_ROLES}>
              <AppointmentPage />
            </ProtectedRoute>
          }
        />

        {/* ════════ ADMISSIONS (redirects to IPD) ════════ */}
        <Route path="/admission/*"
          element={
            <ProtectedRoute roles={ALL_ROLES}>
              <AdmissionPage />
            </ProtectedRoute>
          }
        />

        {/* ════════ CLINICAL DEPARTMENTS ════════ */}
        <Route path="/laboratory/*"
          element={
            <ProtectedRoute roles={[
              "LAB_TECHNICIAN","LAB_SCIENTIST",
              "CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN",
            ]}>
              <LaboratoryPage />
            </ProtectedRoute>
          }
        />
        <Route path="/pharmacy/*"
          element={
            <ProtectedRoute roles={[
              "PHARMACIST",
              "CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN",
            ]}>
              <PharmacyPage />
            </ProtectedRoute>
          }
        />
        <Route path="/radiology/*"
          element={
            <ProtectedRoute roles={[
              "RADIOGRAPHER",
              "CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN",
            ]}>
              <RadiologyPage />
            </ProtectedRoute>
          }
        />
        <Route path="/emergency/*"
          element={
            <ProtectedRoute roles={ALL_CLINICAL}>
              <EmergencyPage />
            </ProtectedRoute>
          }
        />

        {/* ════════ IPD ════════ */}
        <Route path="/ipd/*"
          element={
            <ProtectedRoute roles={ALL_CLINICAL}>
              <IPDPage />
            </ProtectedRoute>
          }
        />

        {/* ════════ SPECIALISED ════════ */}
        <Route path="/surgery/*"
          element={
            <ProtectedRoute roles={[
              "SURGEON","DOCTOR","THEATRE_NURSE",
              "CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN",
            ]}>
              <SurgeryPage />
            </ProtectedRoute>
          }
        />
        <Route path="/maternity/*"
          element={
            <ProtectedRoute roles={[
              "NURSE","DOCTOR","MIDWIFE",
              "CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN",
            ]}>
              <MaternityPage />
            </ProtectedRoute>
          }
        />
        <Route path="/mortuary/*"
          element={
            <ProtectedRoute roles={[
              "MORTUARY_OFFICER","DOCTOR","NURSE",
              "CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN",
            ]}>
              <MortuaryPage />
            </ProtectedRoute>
          }
        />

        {/* ════════ FINANCE ════════ */}
        <Route path="/billing/*"
          element={
            <ProtectedRoute roles={FINANCE_ROLES}>
              <BillingPage />
            </ProtectedRoute>
          }
        />

        {/* ════════ OPERATIONS ════════ */}
        <Route path="/inventory/*"
          element={
            <ProtectedRoute roles={[
              "INVENTORY_OFFICER","FACILITY_OFFICER",
              "CLINICAL_COORDINATOR","SUPER_ADMIN","HOSPITAL_ADMIN",
            ]}>
              <InventoryPage />
            </ProtectedRoute>
          }
        />
        <Route path="/facility/*"
          element={
            <ProtectedRoute roles={[
              "FACILITY_OFFICER","INVENTORY_OFFICER",
              "SUPER_ADMIN","HOSPITAL_ADMIN",
            ]}>
              <FacilityPage />
            </ProtectedRoute>
          }
        />

        {/* ════════ REPORTS ════════ */}
        <Route path="/reports/*"
          element={
            <ProtectedRoute roles={[
              "ACCOUNTANT","CLINICAL_COORDINATOR","LAB_SCIENTIST",
              "MEDICAL_DIRECTOR","SUPER_ADMIN","HOSPITAL_ADMIN",
            ]}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />

        {/* ════════ FALLBACK ════════ */}
        <Route
          path="*"
          element={
            isAuthenticated
              ? <Navigate to="/dashboard" replace />
              : <Navigate to="/login"    replace />
          }
        />
      </Routes>
    </BrowserRouter>
  )
}