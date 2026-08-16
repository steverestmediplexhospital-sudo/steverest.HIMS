export default function OPDPage() {
  const { user } = useAuthStore()
  const [visits,        setVisits]    = useState([])
  const [myAppointments,setMyAppts]   = useState([])
  const [loading,       setLoading]   = useState(true)
  const [search,        setSearch]    = useState("")
  const [stageFilter,   setSF]        = useState("ALL")
  const [typeFilter,    setTF]        = useState("ALL")
  const [refreshKey,    setRK]        = useState(0)
  const [checkInModal,  setCheckIn]   = useState(false)
  const [triageModal,   setTriage]    = useState(false)
  const [triageVisit,   setTV]        = useState(null)
  const [drawerVisit,   setDrawer]    = useState(null)
  const [showAppts,     setShowAppts] = useState(true)
  const autoRefresh = useRef(null)

  const isDoctor = ["DOCTOR","SURGEON","MEDICAL_DIRECTOR"].includes(user?.role)

  const stats = {
    total:      visits.length,
    waiting:    visits.filter(v => ["WAITING","REGISTERED"].includes(v.status)).length,
    withDoctor: visits.filter(v => v.status === "WITH_DOCTOR").length,
    completed:  visits.filter(v => v.status === "COMPLETED").length,
    avgWait: (() => {
      const active = visits.filter(v => v.status !== "COMPLETED" && v.createdAt)
      if (!active.length) return "—"
      const avg  = active.reduce((s, v) => s + (Date.now() - new Date(v.createdAt)), 0) / active.length
      const mins = Math.floor(avg / 60000)
      return mins < 60 ? `${mins}m` : `${Math.floor(mins/60)}h${mins%60}m`
    })(),
  }

  const loadVisits = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const res   = await api.get(`/visits?date=${today}&department=OPD&limit=200`)
      const list  = res.data.data?.visits || res.data.visits || []
      list.sort((a, b) => {
        const order = { IMMEDIATE: 0, URGENT: 1, LESS_URGENT: 2, NON_URGENT: 3 }
        const pa = a.triage?.[0]?.priority
        const pb = b.triage?.[0]?.priority
        if (pa && pb && order[pa] !== order[pb]) return order[pa] - order[pb]
        return new Date(a.createdAt) - new Date(b.createdAt)
      })
      setVisits(list)
    } catch {
      setVisits([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMyAppointments = useCallback(async () => {
    if (!isDoctor) return
    try {
      const stored   = localStorage.getItem('steverest-hims-auth')
      const doctorId = stored
        ? JSON.parse(stored)?.state?.user?.id
        : user?.id
      if (!doctorId) return
      const today = new Date().toISOString().slice(0, 10)
      const res   = await api.get(`/appointments?date=${today}&doctorId=${doctorId}&limit=50`)
      const list  = res.data.data?.appointments || res.data.data || []
      const sorted = Array.isArray(list)
        ? [...list]
            .filter(a => !["CANCELLED","NO_SHOW"].includes(a.status))
            .sort((a, b) => (a.appointmentTime || "").localeCompare(b.appointmentTime || ""))
        : []
      setMyAppts(sorted)
    } catch (e) {
      console.error("loadMyAppointments error:", e)
      setMyAppts([])
    }
  }, [isDoctor, user?.id])

  useEffect(() => {
    setLoading(true)
    loadVisits()
    loadMyAppointments()
    autoRefresh.current = setInterval(() => {
      loadVisits()
      loadMyAppointments()
    }, 30000)
    return () => clearInterval(autoRefresh.current)
  }, [loadVisits, loadMyAppointments, refreshKey])

  const filtered = visits.filter(v => {
    const matchSearch = !search
      || `${v.patient?.firstName} ${v.patient?.lastName}`.toLowerCase().includes(search.toLowerCase())
      || v.patient?.mrn?.toLowerCase().includes(search.toLowerCase())
      || v.visitId?.toLowerCase().includes(search.toLowerCase())
    const matchStage = stageFilter === "ALL" || v.status === stageFilter
    const matchType  = typeFilter  === "ALL" || v.visitType === typeFilter
    return matchSearch && matchStage && matchType
  })

  const openTriage    = (visit) => { setTV(visit); setTriage(true) }
  const openDrawer    = (visit) => setDrawer(visit)
  const handleSuccess = () => { setRK(k => k + 1); setLoading(true) }

  const stageCounts = Object.keys(OPD_STAGES).reduce((acc, key) => {
    acc[key] = visits.filter(v =>
      v.status === key &&
      (typeFilter === "ALL" || v.visitType === typeFilter)
    ).length
    return acc
  }, {})

  const canCheckIn = [
    "RECEPTIONIST","NURSE","CLINICAL_COORDINATOR",
    "SUPER_ADMIN","HOSPITAL_ADMIN","MEDICAL_RECORDS_OFFICER"
  ].includes(user?.role)

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Page Header ── */}
      <div className="bg-white border-b border-gray-100 px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-2xl">
                <Users className="w-7 h-7 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">OPD Queue</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Outpatient Department · {new Date().toLocaleDateString("en-NG", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric"
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-xl">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live · refreshes every 30s
              </div>
              <button
                onClick={() => { setLoading(true); loadVisits(); loadMyAppointments() }}
                className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500"
                title="Refresh now">
                <RefreshCw className="w-4 h-4" />
              </button>
              {canCheckIn && (
                <button
                  onClick={() => setCheckIn(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 shadow-sm">
                  <Plus className="w-4 h-4" /> Check In Patient
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">

        {/* ── Stats ── */}
        <StatBar stats={stats} />

        {/* ── MY APPOINTMENTS BANNER (Doctor only) ── */}
        {isDoctor && myAppointments.length > 0 && (
          <div className="bg-white border border-teal-200 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowAppts(s => !s)}
              className="w-full flex items-center justify-between px-5 py-3.5 bg-teal-50 hover:bg-teal-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-teal-600" />
                <span className="font-semibold text-teal-800">
                  My Appointments Today
                </span>
                <span className="bg-teal-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {myAppointments.length}
                </span>
              </div>
              <span className="text-teal-600 text-xs font-medium">
                {showAppts ? "▲ Hide" : "▼ Show"}
              </span>
            </button>

            {showAppts && (
              <div className="divide-y divide-gray-50">
                {myAppointments.map(appt => {
                  const isNow = (() => {
                    if (!appt.appointmentTime) return false
                    const [h, m]  = appt.appointmentTime.split(":").map(Number)
                    const apptMin = h * 60 + m
                    const nowMin  = new Date().getHours() * 60 + new Date().getMinutes()
                    return Math.abs(apptMin - nowMin) <= 30
                  })()

                  return (
                    <div key={appt.id}
                      className={`flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors ${
                        isNow ? "bg-teal-50/50 border-l-4 border-teal-500" : ""
                      }`}>

                      {/* Time */}
                      <div className={`flex-shrink-0 w-14 text-center rounded-xl py-2 ${
                        isNow ? "bg-teal-600 text-white" : "bg-gray-100"
                      }`}>
                        <p className={`text-sm font-bold leading-none ${isNow ? "text-white" : "text-gray-700"}`}>
                          {appt.appointmentTime || "—"}
                        </p>
                        {isNow && <p className="text-[10px] text-teal-200 mt-0.5">NOW</p>}
                      </div>

                      {/* Patient */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-800 text-sm">
                            {appt.patient?.firstName} {appt.patient?.lastName}
                          </p>
                          <span className="text-xs text-teal-600 font-medium">
                            {appt.patient?.mrn}
                          </span>
                          {appt.patient?.gender && (
                            <span className="text-xs text-gray-400">
                              · {calcAge(appt.patient?.dateOfBirth)} · {appt.patient?.gender}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {appt.reason && (
                            <p className="text-xs text-gray-500">
                              📋 {appt.reason}
                            </p>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            appt.appointmentType === "OPD"        ? "bg-blue-100 text-blue-700"   :
                            appt.appointmentType === "SPECIALIST" ? "bg-purple-100 text-purple-700":
                            appt.appointmentType === "FOLLOW_UP"  ? "bg-green-100 text-green-700" :
                            appt.appointmentType === "ANTENATAL"  ? "bg-pink-100 text-pink-700"   :
                            "bg-gray-100 text-gray-600"
                          }`}>
                            {appt.appointmentType || "OPD"}
                          </span>
                          {appt.patient?.phone && (
                            <span className="text-xs text-gray-400">
                              📞 {appt.patient.phone}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status + Action */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          appt.status === "SCHEDULED"  ? "bg-blue-100 text-blue-700"   :
                          appt.status === "CONFIRMED"  ? "bg-green-100 text-green-700" :
                          appt.status === "CHECKED_IN" ? "bg-purple-100 text-purple-700":
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {appt.status}
                        </span>
                        <button
                          onClick={() => window.location.href = `/doctor/patient/${appt.patientId}`}
                          className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition-colors">
                          See Patient <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── NO APPOINTMENTS notice for doctor ── */}
        {isDoctor && myAppointments.length === 0 && !loading && (
          <div className="bg-teal-50 border border-teal-100 rounded-2xl px-5 py-4 flex items-center gap-3">
            <Calendar className="w-5 h-5 text-teal-400 shrink-0" />
            <p className="text-sm text-teal-700">
              No appointments scheduled for you today. Walk-in patients appear below.
            </p>
          </div>
        )}

        {/* ── Visit Type Tab Bar ── */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="flex border-b border-gray-100 overflow-x-auto">
            {Object.entries(VISIT_TYPE_CONFIG).map(([key, cfg]) => {
              const count  = key === "ALL"
                ? visits.length
                : visits.filter(v => v.visitType === key).length
              const active = typeFilter === key
              return (
                <button
                  key={key}
                  onClick={() => { setTF(key); setSF("ALL") }}
                  className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all ${
                    active
                      ? "border-blue-600 text-blue-700 bg-blue-50"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${
                    key === "EMERGENCY"  ? "bg-red-500"    :
                    key === "SPECIALIST" ? "bg-purple-500" :
                    key === "FOLLOW_UP"  ? "bg-green-500"  :
                    key === "OPD"        ? "bg-blue-500"   :
                    "bg-gray-400"
                  }`} />
                  {cfg.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                    active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                  }`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-500">
                {VISIT_TYPE_CONFIG[typeFilter]?.description}
              </p>
              {typeFilter === "EMERGENCY" && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium animate-pulse">
                  🚨 Priority Queue
                </span>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Search ${VISIT_TYPE_CONFIG[typeFilter]?.label || ""} patients…`}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSF("ALL")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                  stageFilter === "ALL"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                All ({typeFilter === "ALL" ? visits.length : visits.filter(v => v.visitType === typeFilter).length})
              </button>

              {Object.entries(OPD_STAGES).map(([key, cfg]) => {
                const Icon  = cfg.icon
                const count = stageCounts[key] || 0
                const active = stageFilter === key
                return (
                  <button key={key}
                    onClick={() => setSF(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                      active
                        ? "bg-blue-600 text-white border-blue-600"
                        : `bg-white text-gray-600 border-gray-200 hover:bg-gray-50 ${count === 0 ? "opacity-40" : ""}`
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {cfg.label}
                    {count > 0 && (
                      <span className={`font-bold ${active ? "text-white" : cfg.color.split(" ")[1]}`}>
                        ({count})
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Queue Grid ── */}
        {loading ? (
          <SectionLoader />
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl">
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                typeFilter === "EMERGENCY" ? "bg-red-50" :
                typeFilter === "SPECIALIST" ? "bg-purple-50" :
                typeFilter === "FOLLOW_UP" ? "bg-green-50" : "bg-blue-50"
              }`}>
                {typeFilter === "EMERGENCY"  ? <AlertTriangle className="w-8 h-8 text-red-300" />    :
                 typeFilter === "SPECIALIST" ? <Stethoscope   className="w-8 h-8 text-purple-300" /> :
                 typeFilter === "FOLLOW_UP"  ? <RefreshCw     className="w-8 h-8 text-green-300" />  :
                                              <Users          className="w-8 h-8 text-blue-300" />}
              </div>
              <p className="font-semibold text-gray-700">
                {VISIT_TYPE_CONFIG[typeFilter]?.emptyMsg || "No patients found"}
              </p>
              <p className="text-sm text-gray-400 mt-1 mb-5">
                {typeFilter === "EMERGENCY"
                  ? "Emergency cases will appear here in real-time"
                  : typeFilter === "SPECIALIST"
                  ? "Specialist referral patients will appear here"
                  : "Check in a patient to get started"}
              </p>
              {(typeFilter === "ALL" || typeFilter === "OPD") && canCheckIn && (
                <button
                  onClick={() => setCheckIn(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
                  <Plus className="w-4 h-4" /> Check In Patient
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing <span className="font-semibold text-gray-800">{filtered.length}</span> patient{filtered.length !== 1 ? "s" : ""}
              </p>
              {filtered.some(v => v.triage?.[0]?.priority === "IMMEDIATE") && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-xl text-xs font-bold animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  IMMEDIATE priority patients present
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(visit => (
                <PatientCard
                  key={visit.id}
                  visit={visit}
                  onTriage={openTriage}
                  onView={openDrawer}
                  onUpdateStatus={handleSuccess}
                  userRole={user?.role}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Flow Guide ── */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-100 rounded-xl shrink-0">
              <Info className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-800 text-sm mb-3">OPD Patient Flow</h3>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { label: "1. Check-In",    icon: UserCheck,    color: "bg-gray-100 text-gray-700"      },
                  { label: "2. Triage",       icon: Activity,     color: "bg-blue-100 text-blue-700"      },
                  { label: "3. Doctor Queue", icon: Clock,        color: "bg-amber-100 text-amber-700"    },
                  { label: "4. Consultation", icon: Stethoscope,  color: "bg-purple-100 text-purple-700"  },
                  { label: "5. Lab/Pharmacy", icon: FlaskConical, color: "bg-cyan-100 text-cyan-700"     },
                  { label: "6. Discharge",    icon: CheckCircle,  color: "bg-emerald-100 text-emerald-700"},
                ].map((step, i, arr) => {
                  const Icon = step.icon
                  return (
                    <div key={step.label} className="flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${step.color}`}>
                        <Icon className="w-3.5 h-3.5" /> {step.label}
                      </div>
                      {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-blue-400 shrink-0" />}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── Modals ── */}
      <CheckInModal
        isOpen={checkInModal}
        onClose={() => setCheckIn(false)}
        onSuccess={handleSuccess}
      />
      <TriageModal
        isOpen={triageModal}
        onClose={() => { setTriage(false); setTV(null) }}
        onSuccess={handleSuccess}
        visit={triageVisit}
      />
      <VisitDrawer
        visit={drawerVisit}
        onClose={() => setDrawer(null)}
        onTriage={openTriage}
        userRole={user?.role}
      />
    </div>
  )
}