// backend/src/controllers/reports.controller.js
// ✅ Uses global.prisma, matches all ReportsPage endpoints

const getPrisma = () => global.prisma

// ── Date Range Helper ─────────────────────────────────────────────────────────
const getDateRange = (from, to) => {
  const start = from
    ? new Date(new Date(from).setHours(0, 0, 0, 0))
    : new Date(new Date().setHours(0, 0, 0, 0))

  const end = to
    ? new Date(new Date(to).setHours(23, 59, 59, 999))
    : new Date(new Date().setHours(23, 59, 59, 999))

  return { start, end }
}

// ── Generate daily trend array between two dates ───────────────────────────────
const getDailyTrend = (records, dateField, from, to) => {
  const { start, end } = getDateRange(from, to)
  const days = Math.ceil((end - start) / 86400000)
  const result = []

  for (let i = 0; i <= Math.min(days, 90); i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().split("T")[0]

    const count = records.filter(r => {
      const rd = new Date(r[dateField])
      return rd.toISOString().split("T")[0] === dateStr
    }).length

    result.push({ date: dateStr, count })
  }
  return result
}

// ── Overview Report ───────────────────────────────────────────────────────────
const getOverview = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { from, to } = req.query
    const { start, end } = getDateRange(from, to)
    const where = { createdAt: { gte: start, lte: end } }

    const [
      totalVisits, opdVisits, ipdVisits, emergencyVisits,
      activeAdmissions, newPatients,
      totalBeds, availableBeds,
      labTests, labPending,
      prescriptions, surgeries,
      pendingBills, totalRevenue
    ] = await Promise.all([
      prisma.visit.count({ where }),
      prisma.visit.count({ where: { ...where, visitType: "OPD"       } }),
      prisma.visit.count({ where: { ...where, visitType: "IPD"       } }),
      prisma.visit.count({ where: { ...where, visitType: "EMERGENCY" } }),
      prisma.admission.count({ where: { status: "ACTIVE" } }),
      prisma.patient.count({ where }),
      prisma.bed.count(),
      prisma.bed.count({ where: { status: "AVAILABLE" } }),
      prisma.labOrder.count({ where }),
      prisma.labOrder.count({
        where: {
          orderedAt: { gte: start, lte: end },
          status: { in: ["ORDERED", "SAMPLE_COLLECTED", "PROCESSING"] }
        }
      }),
      prisma.prescription.count({ where }),
      prisma.surgery.count({ where }),
      prisma.bill.count({
        where: { status: { in: ["PENDING", "PARTIALLY_PAID"] } }
      }),
      prisma.payment.aggregate({
        where: { createdAt: { gte: start, lte: end } },
        _sum: { amount: true }
      })
    ])

    return res.json({
      success: true,
      data: {
        totalVisits,
        opdVisits,
        ipdVisits,
        emergencyCases:   emergencyVisits,
        activeAdmissions,
        newPatients,
        totalBeds,
        availableBeds,
        labTests,
        labPending,
        prescriptions,
        surgeries,
        pendingBills,
        totalRevenue: parseFloat(totalRevenue._sum?.amount || 0)
      }
    })
  } catch (e) {
    console.error("getOverview error:", e)
    return res.status(500).json({ success: false, message: e.message })
  }
}

// ── Visits Report ─────────────────────────────────────────────────────────────
const getVisitsReport = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { from, to } = req.query
    const { start, end } = getDateRange(from, to)

    const visits = await prisma.visit.findMany({
      where: { visitDate: { gte: start, lte: end } },
      select: {
        id: true, visitType: true, status: true,
        visitDate: true, chiefComplaint: true
      }
    })

    // Daily trend
    const dailyTrend = getDailyTrend(visits, "visitDate", from, to)

    // By type
    const typeMap = {}
    visits.forEach(v => {
      typeMap[v.visitType] = (typeMap[v.visitType] || 0) + 1
    })
    const byType = Object.entries(typeMap).map(([type, count]) => ({
      type, count
    }))

    // Top diagnoses from chief complaints
    const diagMap = {}
    visits.forEach(v => {
      if (v.chiefComplaint) {
        const key = v.chiefComplaint.trim().substring(0, 50)
        diagMap[key] = (diagMap[key] || 0) + 1
      }
    })
    const topDiagnoses = Object.entries(diagMap)
      .map(([diagnosis, count]) => ({ diagnosis, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)

    return res.json({
      success: true,
      data: {
        total:       visits.length,
        dailyTrend,
        byType,
        topDiagnoses,
        completed:   visits.filter(v => v.status === "COMPLETED").length,
        active:      visits.filter(v => v.status === "ACTIVE").length
      }
    })
  } catch (e) {
    console.error("getVisitsReport error:", e)
    return res.status(500).json({ success: false, message: e.message })
  }
}

// ── Admissions Report ─────────────────────────────────────────────────────────
const getAdmissionsReport = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { from, to } = req.query
    const { start, end } = getDateRange(from, to)

    const admissions = await prisma.admission.findMany({
      where: { admittedAt: { gte: start, lte: end } },
      include: {
        ward: { select: { name: true } }
      }
    })

    // Daily trend
    const trend = getDailyTrend(admissions, "admittedAt", from, to)
      .map(d => ({
        date: d.date,
        admissions: d.count,
        discharges: admissions.filter(a => {
          if (!a.dischargedAt) return false
          return new Date(a.dischargedAt).toISOString().split("T")[0] === d.date
        }).length
      }))

    // By ward
    const wardMap = {}
    admissions.forEach(a => {
      const name = a.ward?.name || "Unknown"
      wardMap[name] = (wardMap[name] || 0) + 1
    })
    const byWard = Object.entries(wardMap)
      .map(([ward, count]) => ({ ward, count }))
      .sort((a, b) => b.count - a.count)

    // Average length of stay
    const withDischarge = admissions.filter(a => a.dischargedAt)
    const avgLOS = withDischarge.length > 0
      ? Math.round(
          withDischarge.reduce((sum, a) => {
            return sum + (new Date(a.dischargedAt) - new Date(a.admittedAt)) / 86400000
          }, 0) / withDischarge.length * 10
        ) / 10
      : 0

    return res.json({
      success: true,
      data: {
        total:         admissions.length,
        discharged:    admissions.filter(a => a.status === "DISCHARGED").length,
        active:        admissions.filter(a => a.status === "ACTIVE").length,
        fromEmergency: admissions.filter(a => a.admissionReason?.toLowerCase().includes("emergency")).length,
        avgLOS,
        trend,
        byWard
      }
    })
  } catch (e) {
    console.error("getAdmissionsReport error:", e)
    return res.status(500).json({ success: false, message: e.message })
  }
}

// ── Billing Report ────────────────────────────────────────────────────────────
const getBillingReport = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { from, to } = req.query
    const { start, end } = getDateRange(from, to)

    const [bills, payments] = await Promise.all([
      prisma.bill.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: {
          id: true, totalAmount: true, paidAmount: true,
          status: true, createdAt: true
        }
      }),
      prisma.payment.findMany({
        where:   { createdAt: { gte: start, lte: end } },
        select:  { amount: true, paymentMethod: true, createdAt: true }
      })
    ])

    const totalBilled  = bills.reduce((s, b) => s + parseFloat(b.totalAmount || 0), 0)
    const totalRevenue = payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0)
    const pendingAmount= bills
      .filter(b => ["PENDING","PARTIALLY_PAID"].includes(b.status))
      .reduce((s, b) => s + (parseFloat(b.totalAmount || 0) - parseFloat(b.paidAmount || 0)), 0)

    // By payment method
    const methodMap = {}
    payments.forEach(p => {
      const m = p.paymentMethod || "CASH"
      methodMap[m] = (methodMap[m] || 0) + parseFloat(p.amount || 0)
    })
    const byPayment = Object.entries(methodMap).map(([method, amount]) => ({
      method, amount
    }))

    // By service category — placeholder
    const byService = [
      { service: "Consultation", revenue: totalRevenue * 0.3  },
      { service: "Lab",          revenue: totalRevenue * 0.2  },
      { service: "Pharmacy",     revenue: totalRevenue * 0.25 },
      { service: "Ward",         revenue: totalRevenue * 0.15 },
      { service: "Procedures",   revenue: totalRevenue * 0.1  }
    ].filter(s => s.revenue > 0)

    // Daily revenue
    const { start: s, end: e } = getDateRange(from, to)
    const days = Math.ceil((e - s) / 86400000)
    const dailyRevenue = []
    for (let i = 0; i <= Math.min(days, 90); i++) {
      const d = new Date(s)
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().split("T")[0]

      const dayBills = bills.filter(b =>
        new Date(b.createdAt).toISOString().split("T")[0] === dateStr
      )
      const dayPayments = payments.filter(p =>
        new Date(p.createdAt).toISOString().split("T")[0] === dateStr
      )

      dailyRevenue.push({
        date:    dateStr,
        bills:   dayBills.length,
        billed:  dayBills.reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0),
        revenue: dayPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
      })
    }

    return res.json({
      success: true,
      data: {
        totalBilled,
        totalRevenue,
        pendingAmount,
        pendingCount:  bills.filter(b => ["PENDING","PARTIALLY_PAID"].includes(b.status)).length,
        totalCount:    bills.length,
        byPayment,
        byService,
        dailyRevenue
      }
    })
  } catch (e) {
    console.error("getBillingReport error:", e)
    return res.status(500).json({ success: false, message: e.message })
  }
}

// ── Beds Report ───────────────────────────────────────────────────────────────
const getBedsReport = async (req, res) => {
  try {
    const prisma = getPrisma()

    const wards = await prisma.ward.findMany({
      include: {
        rooms: {
          include: {
            beds: {
              select: { id: true, status: true, bedNumber: true }
            }
          }
        }
      }
    })

    const byWard = wards.map(ward => {
      const allBeds = ward.rooms.flatMap(r => r.beds)
      return {
        name:      ward.name,
        total:     allBeds.length,
        occupied:  allBeds.filter(b => b.status === "OCCUPIED").length,
        available: allBeds.filter(b => b.status === "AVAILABLE").length,
        reserved:  allBeds.filter(b => b.status === "RESERVED").length,
        maintenance: allBeds.filter(b =>
          ["MAINTENANCE","CLEANING"].includes(b.status)
        ).length
      }
    })

    const total     = byWard.reduce((s, w) => s + w.total,     0)
    const occupied  = byWard.reduce((s, w) => s + w.occupied,  0)
    const available = byWard.reduce((s, w) => s + w.available, 0)

    return res.json({
      success: true,
      data: {
        total,
        occupied,
        available,
        reserved:    byWard.reduce((s, w) => s + w.reserved,    0),
        maintenance: byWard.reduce((s, w) => s + w.maintenance, 0),
        occupancyRate: total > 0 ? Math.round((occupied / total) * 100) : 0,
        byWard
      }
    })
  } catch (e) {
    console.error("getBedsReport error:", e)
    return res.status(500).json({ success: false, message: e.message })
  }
}

// ── Lab Report ────────────────────────────────────────────────────────────────
const getLabReport = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { from, to } = req.query
    const { start, end } = getDateRange(from, to)

    const orders = await prisma.labOrder.findMany({
      where: { orderedAt: { gte: start, lte: end } },
      include: {
        items: {
          include: { labTest: { select: { name: true, category: true } } }
        }
      }
    })

    // By test type
    const testMap = {}
    orders.forEach(o => {
      o.items?.forEach(item => {
        const name = item.labTest?.name || "Unknown"
        testMap[name] = (testMap[name] || 0) + 1
      })
    })
    const byTest = Object.entries(testMap)
      .map(([test, count]) => ({ test, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)

    // Daily trend
    const trend = getDailyTrend(orders, "orderedAt", from, to).map(d => ({
      date:      d.date,
      ordered:   d.count,
      completed: orders.filter(o => {
        if (!o.completedAt) return false
        return new Date(o.completedAt).toISOString().split("T")[0] === d.date
      }).length
    }))

    // Avg turnaround hours
    const completed = orders.filter(o => o.completedAt && o.orderedAt)
    const avgTurnaround = completed.length > 0
      ? Math.round(
          completed.reduce((s, o) => {
            return s + (new Date(o.completedAt) - new Date(o.orderedAt)) / 3600000
          }, 0) / completed.length * 10
        ) / 10
      : 0

    return res.json({
      success: true,
      data: {
        total:      orders.length,
        completed:  orders.filter(o =>
          ["COMPLETED","VALIDATED"].includes(o.status)
        ).length,
        pending:    orders.filter(o =>
          ["ORDERED","SAMPLE_COLLECTED","PROCESSING"].includes(o.status)
        ).length,
        avgTurnaround,
        byTest,
        trend
      }
    })
  } catch (e) {
    console.error("getLabReport error:", e)
    return res.status(500).json({ success: false, message: e.message })
  }
}

// ── Patients Report ───────────────────────────────────────────────────────────
const getPatientsReport = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { from, to } = req.query
    const { start, end } = getDateRange(from, to)

    const [allPatients, newPatients, activeAdmissions] = await Promise.all([
      prisma.patient.findMany({
        select: {
          id: true, gender: true, dateOfBirth: true,
          createdAt: true, patientType: true
        }
      }),
      prisma.patient.findMany({
        where:  { createdAt: { gte: start, lte: end } },
        select: { id: true, createdAt: true }
      }),
      prisma.admission.count({ where: { status: "ACTIVE" } })
    ])

    // Gender distribution
    const genderMap = {}
    allPatients.forEach(p => {
      const g = p.gender || "UNKNOWN"
      genderMap[g] = (genderMap[g] || 0) + 1
    })
    const byGender = Object.entries(genderMap).map(([gender, count]) => ({
      gender, count
    }))

    // Age groups
    const ageGroups = {
      "0-5":   0,
      "6-17":  0,
      "18-35": 0,
      "36-50": 0,
      "51-65": 0,
      "65+":   0
    }
    allPatients.forEach(p => {
      if (!p.dateOfBirth) return
      const age = Math.floor(
        (Date.now() - new Date(p.dateOfBirth)) / (365.25 * 86400000)
      )
      if      (age <= 5)  ageGroups["0-5"]++
      else if (age <= 17) ageGroups["6-17"]++
      else if (age <= 35) ageGroups["18-35"]++
      else if (age <= 50) ageGroups["36-50"]++
      else if (age <= 65) ageGroups["51-65"]++
      else                ageGroups["65+"]++
    })
    const byAgeGroup = Object.entries(ageGroups).map(([group, count]) => ({
      group, count
    }))

    // Registration trend
    const trend = getDailyTrend(newPatients, "createdAt", from, to)

    return res.json({
      success: true,
      data: {
        total:     allPatients.length,
        new:       newPatients.length,
        returning: allPatients.length - newPatients.length,
        active:    activeAdmissions,
        byGender,
        byAgeGroup,
        trend
      }
    })
  } catch (e) {
    console.error("getPatientsReport error:", e)
    return res.status(500).json({ success: false, message: e.message })
  }
}

// ── Pharmacy Report ───────────────────────────────────────────────────────────
const getPharmacyReport = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { from, to } = req.query
    const { start, end } = getDateRange(from, to)

    const prescriptions = await prisma.prescription.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: {
        items: {
          include: { drug: { select: { name: true, price: true } } }
        }
      }
    })

    // Top drugs
    const drugMap = {}
    prescriptions.forEach(rx => {
      rx.items?.forEach(item => {
        const name = item.drug?.name || "Unknown"
        drugMap[name] = (drugMap[name] || 0) + (item.quantity || 1)
      })
    })
    const topDrugs = Object.entries(drugMap)
      .map(([drug, count]) => ({ drug, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)

    // Revenue from dispensed items
    const revenue = prescriptions
      .filter(rx => rx.status === "DISPENSED")
      .reduce((sum, rx) => {
        return sum + rx.items.reduce((s, item) => {
          return s + (parseFloat(item.drug?.price || 0) * (item.quantity || 1))
        }, 0)
      }, 0)

    // Daily trend
    const trend = getDailyTrend(prescriptions, "createdAt", from, to)

    return res.json({
      success: true,
      data: {
        total:     prescriptions.length,
        dispensed: prescriptions.filter(rx => rx.status === "DISPENSED").length,
        pending:   prescriptions.filter(rx =>
          ["PENDING","VERIFIED"].includes(rx.status)
        ).length,
        revenue,
        topDrugs,
        trend
      }
    })
  } catch (e) {
    console.error("getPharmacyReport error:", e)
    return res.status(500).json({ success: false, message: e.message })
  }
}

module.exports = {
  getOverview,
  getVisitsReport,
  getAdmissionsReport,
  getBillingReport,
  getBedsReport,
  getLabReport,
  getPatientsReport,
  getPharmacyReport,
  // Legacy exports (keep for backward compatibility)
  getDashboardReport: getOverview,
  getRevenueReport:   getBillingReport,
  getPatientReport:   getPatientsReport,
  getAdmissionReport: getAdmissionsReport
}