// backend/src/controllers/patient.controller.js
const { sendSuccess, sendError } = require('../utils/response.utils')

const getPrisma = () => global.prisma

const getPatients = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { page = 1, limit = 20, search = '', patientType, gender } = req.query
    const skip  = (parseInt(page) - 1) * parseInt(limit)
    const where = { isActive: true }

    if (patientType) where.patientType = patientType
    if (gender)      where.gender      = gender

    if (search.trim()) {
      where.OR = [
        { firstName:  { contains: search, mode: 'insensitive' } },
        { lastName:   { contains: search, mode: 'insensitive' } },
        { mrn:        { contains: search, mode: 'insensitive' } },
        { phone:      { contains: search, mode: 'insensitive' } },
        { nationalId: { contains: search, mode: 'insensitive' } },
        { email:      { contains: search, mode: 'insensitive' } }
      ]
    }

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take:    parseInt(limit),
        orderBy: { registeredAt: 'desc' },
        include: {
          allergies:         { select: { allergen: true, severity: true } },
          chronicConditions: { select: { condition: true } },
          _count:            { select: { visits: true, admissions: true } }
        }
      }),
      prisma.patient.count({ where })
    ])

    return sendSuccess(res, {
      patients,
      data: patients,
      meta: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) }
    }, 'Patients fetched')

  } catch (error) {
    console.error('getPatients:', error.message)
    return sendError(res, 'Failed to fetch patients: ' + error.message, 500)
  }
}

const getPatientById = async (req, res) => {
  try {
    const prisma  = getPrisma()
    const patient = await prisma.patient.findUnique({
      where:   { id: req.params.id },
      include: {
        allergies:         true,
        chronicConditions: true,
        visits: {
          orderBy: { visitDate: 'desc' },
          take:    10,
          include: {
            triage:        true,
            vitalSigns:    { orderBy: { recordedAt: 'desc' }, take: 1 },
            consultations: {
              include: { doctor: { select: { firstName: true, lastName: true } } }
            }
          }
        },
        admissions: {
          orderBy: { admittedAt: 'desc' },
          take:    5,
          include: {
            ward: { select: { name: true } },
            bed:  { select: { bedNumber: true } }
          }
        },
        _count: { select: { visits: true, admissions: true, bills: true } }
      }
    })

    if (!patient) return sendError(res, 'Patient not found', 404)
    return sendSuccess(res, { patient }, 'Patient fetched')

  } catch (error) {
    return sendError(res, 'Failed to fetch patient: ' + error.message, 500)
  }
}

const registerPatient = async (req, res) => {
  try {
    const prisma = getPrisma()
    const {
      firstName, lastName, middleName,
      dateOfBirth, gender, phone, email,
      nationalId, address, city, occupation,
      maritalStatus, religion, nationality,
      bloodGroup, patientType,
      insuranceProvider, insurancePolicyNo, insurancePolicyNumber,
      insuranceMemberNumber, insuranceExpiry,
      corporateCompany, corporateStaffId,
      nextOfKinName, nextOfKinPhone, nextOfKinRelation, nextOfKinAddress,
      emergencyContactName, emergencyContactPhone,
      emergencyContactRelation, emergencyContactAddress,
      guarantorName, guarantorPhone, guarantorRelation,
      allergies, chronicConditions, currentMedications
    } = req.body

    if (!firstName || !lastName || !dateOfBirth || !gender || !phone) {
      return sendError(res, 'firstName, lastName, dateOfBirth, gender and phone are required', 400)
    }

    // Check duplicate national ID
    if (nationalId) {
      const existing = await prisma.patient.findUnique({ where: { nationalId } })
      if (existing) {
        return sendError(res, `Patient with this ID already registered: ${existing.mrn}`, 409)
      }
    }

    // Generate MRN
    const count = await prisma.patient.count()
    const mrn   = 'MRN-' + String(count + 1).padStart(6, '0')

    // Handle allergies - can be string or array
    let allergyData = []
    if (typeof allergies === 'string' && allergies.trim()) {
      allergyData = [{ allergen: allergies.trim(), reaction: null, severity: null }]
    } else if (Array.isArray(allergies)) {
      allergyData = allergies.map(a => ({
        allergen: typeof a === 'string' ? a : a.allergen,
        reaction: a.reaction || null,
        severity: a.severity || null
      }))
    }

    // Handle chronic conditions - can be string or array
    let conditionData = []
    if (typeof chronicConditions === 'string' && chronicConditions.trim()) {
      conditionData = chronicConditions.split(',').map(c => ({
        condition: c.trim(),
        diagnosedAt: null,
        notes: currentMedications || null
      })).filter(c => c.condition)
    } else if (Array.isArray(chronicConditions)) {
      conditionData = chronicConditions.map(c => ({
        condition:   typeof c === 'string' ? c : c.condition,
        diagnosedAt: c.diagnosedAt ? new Date(c.diagnosedAt) : null,
        notes:       c.notes || null
      }))
    }

    const patient = await prisma.patient.create({
      data: {
        mrn,
        firstName:         firstName.trim(),
        lastName:          lastName.trim(),
        middleName:        middleName?.trim()        || null,
        dateOfBirth:       new Date(dateOfBirth),
        gender,
        phone:             phone.trim(),
        email:             email?.trim()             || null,
        nationalId:        nationalId?.trim()        || null,
        address:           address?.trim()           || null,
        city:              city?.trim()              || null,
        occupation:        occupation?.trim()        || null,
        maritalStatus:     maritalStatus             || null,
        religion:          religion                  || null,
        nationality:       nationality               || 'Kenyan',
        bloodGroup:        bloodGroup                || 'UNKNOWN',
        patientType:       patientType               || 'OUTPATIENT',
        insuranceProvider: insuranceProvider         || null,
        insurancePolicyNo: insurancePolicyNo || insurancePolicyNumber || null,
        insuranceExpiry:   insuranceExpiry ? new Date(insuranceExpiry) : null,
        corporateCompany:  corporateCompany          || null,
        corporateStaffId:  corporateStaffId          || null,
        // Next of kin - support both field name formats
        nextOfKinName:     nextOfKinName     || emergencyContactName     || null,
        nextOfKinPhone:    nextOfKinPhone    || emergencyContactPhone    || null,
        nextOfKinRelation: nextOfKinRelation || emergencyContactRelation || null,
        nextOfKinAddress:  nextOfKinAddress  || emergencyContactAddress  || null,
        guarantorName:     guarantorName     || null,
        guarantorPhone:    guarantorPhone    || null,
        guarantorRelation: guarantorRelation || null,
        allergies:         allergyData.length   ? { create: allergyData    } : undefined,
        chronicConditions: conditionData.length ? { create: conditionData  } : undefined
      },
      include: {
        allergies:         true,
        chronicConditions: true
      }
    })

    // Emit real-time event
    const io = req.app.get('io')
    if (io) {
      io.emit('patient:registered', {
        patientId: patient.id,
        mrn,
        name: firstName + ' ' + lastName
      })
    }

    return sendSuccess(res, { patient }, 'Patient registered successfully', 201)

  } catch (error) {
    console.error('registerPatient error:', error.message)
    return sendError(res, 'Registration failed: ' + error.message, 500)
  }
}

const updatePatient = async (req, res) => {
  try {
    const prisma  = getPrisma()
    const { id }  = req.params
    const existing = await prisma.patient.findUnique({ where: { id } })
    if (!existing) return sendError(res, 'Patient not found', 404)

    const allowed = [
      'firstName','lastName','middleName','phone','email','address',
      'city','occupation','maritalStatus','religion','bloodGroup',
      'patientType','insuranceProvider','insurancePolicyNo',
      'nextOfKinName','nextOfKinPhone','nextOfKinRelation',
      'guarantorName','guarantorPhone','nationality'
    ]

    const data = {}
    allowed.forEach(key => {
      if (req.body[key] !== undefined) data[key] = req.body[key] || null
    })

    const patient = await prisma.patient.update({
      where: { id },
      data,
      include: { allergies: true, chronicConditions: true }
    })

    return sendSuccess(res, { patient }, 'Patient updated')
  } catch (error) {
    return sendError(res, 'Update failed: ' + error.message, 500)
  }
}

const searchPatients = async (req, res) => {
  try {
    const prisma = getPrisma()
    const { q = '' } = req.query
    if (!q.trim()) return sendSuccess(res, { patients: [] }, 'No query')

    const patients = await prisma.patient.findMany({
      where: {
        isActive: true,
        OR: [
          { firstName:  { contains: q, mode: 'insensitive' } },
          { lastName:   { contains: q, mode: 'insensitive' } },
          { mrn:        { contains: q, mode: 'insensitive' } },
          { phone:      { contains: q, mode: 'insensitive' } },
          { nationalId: { contains: q, mode: 'insensitive' } }
        ]
      },
      take:    10,
      select: {
        id: true, mrn: true, firstName: true, lastName: true,
        dateOfBirth: true, gender: true, phone: true,
        patientType: true, bloodGroup: true,
        allergies: { select: { allergen: true, severity: true } }
      }
    })

    return sendSuccess(res, { patients }, 'Search results')
  } catch (error) {
    return sendError(res, 'Search failed: ' + error.message, 500)
  }
}

const getPatientVisits = async (req, res) => {
  try {
    const prisma = getPrisma()
    const visits = await prisma.visit.findMany({
      where:   { patientId: req.params.id },
      orderBy: { visitDate: 'desc' },
      include: {
        triage:        true,
        vitalSigns:    { orderBy: { recordedAt: 'desc' }, take: 1 },
        consultations: {
          include: { doctor: { select: { firstName: true, lastName: true } } }
        }
      }
    })
    return sendSuccess(res, { visits }, 'Visits fetched')
  } catch (error) {
    return sendError(res, 'Failed: ' + error.message, 500)
  }
}

const deactivatePatient = async (req, res) => {
  try {
    const prisma = getPrisma()
    await prisma.patient.update({ where: { id: req.params.id }, data: { isActive: false } })
    return sendSuccess(res, {}, 'Patient deactivated')
  } catch (error) {
    return sendError(res, 'Failed: ' + error.message, 500)
  }
}

module.exports = {
  getPatients,
  getPatientById,
  registerPatient,
  updatePatient,
  searchPatients,
  getPatientVisits,
  deactivatePatient
}