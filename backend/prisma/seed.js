// backend/prisma/seed.js
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()
const hash   = (pw) => bcrypt.hashSync(pw, 10)
const log    = (msg) => console.log(`  ✓ ${msg}`)
const section= (msg) => console.log(`\n── ${msg} ──`)

async function main() {
  console.log('\n🌱 St. Everest Mediplex — Database Seed')
  console.log('==========================================')

  // ── 1. DEPARTMENTS ─────────────────────────────────────────────────────
  section('Creating Departments')

  const deptData = [
    { name: 'Administration',        code: 'ADMIN' },
    { name: 'Outpatient',            code: 'OPD'   },
    { name: 'Inpatient',             code: 'IPD'   },
    { name: 'Emergency',             code: 'EMRG'  },
    { name: 'Laboratory',            code: 'LAB'   },
    { name: 'Radiology',             code: 'RAD'   },
    { name: 'Pharmacy',              code: 'PHARM' },
    { name: 'Maternity',             code: 'MAT'   },
    { name: 'Paediatrics',           code: 'PAED'  },
    { name: 'Surgery',               code: 'SURG'  },
    { name: 'ICU',                   code: 'ICU'   },
    { name: 'Mortuary',              code: 'MORT'  },
    { name: 'Finance',               code: 'FIN'   },
    { name: 'Inventory & Supplies',  code: 'INV'   },
    { name: 'Facility Management',   code: 'FAC'   },
  ]

  const depts = {}
  for (const d of deptData) {
    const dept = await prisma.department.upsert({
      where:  { code: d.code },
      update: { name: d.name },
      create: { name: d.name, code: d.code, isActive: true },
    })
    depts[d.code] = dept
    log(`Department: ${d.name}`)
  }

  // ── 2. USERS ───────────────────────────────────────────────────────────
  section('Creating Users')

  const usersData = [
    { email: 'admin@steverest.com',        firstName: 'System',    lastName: 'Administrator', role: 'SUPER_ADMIN',             empId: 'STF-0001', phone: '+254700000001', deptCode: 'ADMIN' },
    { email: 'director@steverest.com',     firstName: 'James',     lastName: 'Mwangi',        role: 'MEDICAL_DIRECTOR',        empId: 'STF-0002', phone: '+254700000002', deptCode: 'ADMIN' },
    { email: 'doctor@steverest.com',       firstName: 'Grace',     lastName: 'Wanjiku',       role: 'DOCTOR',                  empId: 'STF-0003', phone: '+254700000003', deptCode: 'OPD'   },
    { email: 'surgeon@steverest.com',      firstName: 'Peter',     lastName: 'Otieno',        role: 'SURGEON',                 empId: 'STF-0004', phone: '+254700000004', deptCode: 'SURG'  },
    { email: 'nurse@steverest.com',        firstName: 'Mary',      lastName: 'Njeri',         role: 'NURSE',                   empId: 'STF-0005', phone: '+254700000005', deptCode: 'IPD'   },
    { email: 'midwife@steverest.com',      firstName: 'Rose',      lastName: 'Achieng',       role: 'MIDWIFE',                 empId: 'STF-0006', phone: '+254700000006', deptCode: 'MAT'   },
    { email: 'lab@steverest.com',          firstName: 'John',      lastName: 'Kamau',         role: 'LAB_SCIENTIST',           empId: 'STF-0007', phone: '+254700000007', deptCode: 'LAB'   },
    { email: 'labtech@steverest.com',      firstName: 'Ann',       lastName: 'Muthoni',       role: 'LAB_TECHNICIAN',          empId: 'STF-0008', phone: '+254700000008', deptCode: 'LAB'   },
    { email: 'pharmacy@steverest.com',     firstName: 'David',     lastName: 'Odhiambo',      role: 'PHARMACIST',              empId: 'STF-0009', phone: '+254700000009', deptCode: 'PHARM' },
    { email: 'reception@steverest.com',    firstName: 'Faith',     lastName: 'Wambui',        role: 'RECEPTIONIST',            empId: 'STF-0010', phone: '+254700000010', deptCode: 'OPD'   },
    { email: 'cashier@steverest.com',      firstName: 'Samuel',    lastName: 'Kiprotich',     role: 'CASHIER',                 empId: 'STF-0011', phone: '+254700000011', deptCode: 'FIN'   },
    { email: 'coordinator@steverest.com',  firstName: 'Alice',     lastName: 'Omondi',        role: 'CLINICAL_COORDINATOR',    empId: 'STF-0012', phone: '+254700000012', deptCode: 'ADMIN' },
    { email: 'radiology@steverest.com',    firstName: 'Kevin',     lastName: 'Mutua',         role: 'RADIOGRAPHER',            empId: 'STF-0013', phone: '+254700000013', deptCode: 'RAD'   },
    { email: 'mortuary@steverest.com',     firstName: 'Thomas',    lastName: 'Wekesa',        role: 'MORTUARY_OFFICER',        empId: 'STF-0014', phone: '+254700000014', deptCode: 'MORT'  },
    { email: 'inventory@steverest.com',    firstName: 'Lucy',      lastName: 'Chebet',        role: 'INVENTORY_OFFICER',       empId: 'STF-0015', phone: '+254700000015', deptCode: 'INV'   },
    { email: 'facility@steverest.com',     firstName: 'Charles',   lastName: 'Njoroge',       role: 'FACILITY_OFFICER',        empId: 'STF-0016', phone: '+254700000016', deptCode: 'FAC'   },
    { email: 'accountant@steverest.com',   firstName: 'Jane',      lastName: 'Adhiambo',      role: 'ACCOUNTANT',              empId: 'STF-0017', phone: '+254700000017', deptCode: 'FIN'   },
    { email: 'records@steverest.com',      firstName: 'Brian',     lastName: 'Maina',         role: 'MEDICAL_RECORDS_OFFICER', empId: 'STF-0018', phone: '+254700000018', deptCode: 'ADMIN' },
    { email: 'theatrenurse@steverest.com', firstName: 'Esther',    lastName: 'Wanjala',       role: 'THEATRE_NURSE',           empId: 'STF-0019', phone: '+254700000019', deptCode: 'SURG'  },
    { email: 'hospital@steverest.com',     firstName: 'Hospital',  lastName: 'Admin',         role: 'HOSPITAL_ADMIN',          empId: 'STF-0020', phone: '+254700000020', deptCode: 'ADMIN' },
  ]

  const createdUsers = {}
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where:  { email: u.email },
      update: { status: 'ACTIVE' },
      create: {
        employeeId:   u.empId,
        firstName:    u.firstName,
        lastName:     u.lastName,
        email:        u.email,
        phone:        u.phone,
        passwordHash: hash('Admin@1234'),
        role:         u.role,
        departmentId: depts[u.deptCode]?.id || null,
        status:       'ACTIVE',
      },
    })
    createdUsers[u.role] = user
    log(`${u.role}: ${u.firstName} ${u.lastName} (${u.email})`)
  }

  // ── 3. WARDS, ROOMS & BEDS ─────────────────────────────────────────────
  section('Creating Wards, Rooms & Beds')

  const wardsData = [
    {
      name: 'General Ward',      code: 'GW',  deptCode: 'IPD',  floor: '1', capacity: 20,
      rooms: [
        { name: 'Room G1', code: 'G1',   floor: '1', beds: 4 },
        { name: 'Room G2', code: 'G2',   floor: '1', beds: 4 },
        { name: 'Room G3', code: 'G3',   floor: '1', beds: 4 },
        { name: 'Room G4', code: 'G4',   floor: '1', beds: 4 },
        { name: 'Room G5', code: 'G5',   floor: '1', beds: 4 },
      ],
    },
    {
      name: 'Maternity Ward',    code: 'MW',  deptCode: 'MAT',  floor: '2', capacity: 16,
      rooms: [
        { name: 'Antenatal Room',  code: 'M1',  floor: '2', beds: 4 },
        { name: 'Labour Room 1',   code: 'M2',  floor: '2', beds: 2 },
        { name: 'Labour Room 2',   code: 'M3',  floor: '2', beds: 2 },
        { name: 'Postnatal Room',  code: 'M4',  floor: '2', beds: 4 },
        { name: 'Newborn Nursery', code: 'M5',  floor: '2', beds: 4 },
      ],
    },
    {
      name: 'Paediatric Ward',   code: 'PW',  deptCode: 'PAED', floor: '2', capacity: 12,
      rooms: [
        { name: 'Paeds Room 1',   code: 'P1',  floor: '2', beds: 4 },
        { name: 'Paeds Room 2',   code: 'P2',  floor: '2', beds: 4 },
        { name: 'Paeds HDU',      code: 'P3',  floor: '2', beds: 4 },
      ],
    },
    {
      name: 'Private Ward',      code: 'PVT', deptCode: 'IPD',  floor: '3', capacity: 10,
      rooms: [
        { name: 'Private Room 1', code: 'PV1', floor: '3', beds: 1 },
        { name: 'Private Room 2', code: 'PV2', floor: '3', beds: 1 },
        { name: 'Private Room 3', code: 'PV3', floor: '3', beds: 1 },
        { name: 'Private Room 4', code: 'PV4', floor: '3', beds: 1 },
        { name: 'VIP Suite 1',    code: 'VP1', floor: '3', beds: 1 },
        { name: 'VIP Suite 2',    code: 'VP2', floor: '3', beds: 1 },
        { name: 'Semi-Private 1', code: 'SP1', floor: '3', beds: 2 },
        { name: 'Semi-Private 2', code: 'SP2', floor: '3', beds: 2 },
      ],
    },
    {
      name: 'ICU',               code: 'ICU', deptCode: 'ICU',  floor: '3', capacity: 6,
      rooms: [
        { name: 'ICU Bay A',     code: 'IA',  floor: '3', beds: 3 },
        { name: 'ICU Bay B',     code: 'IB',  floor: '3', beds: 3 },
      ],
    },
    {
      name: 'Surgical Ward',     code: 'SW',  deptCode: 'SURG', floor: '1', capacity: 12,
      rooms: [
        { name: 'Surgical Room 1', code: 'S1', floor: '1', beds: 4 },
        { name: 'Surgical Room 2', code: 'S2', floor: '1', beds: 4 },
        { name: 'Surgical HDU',    code: 'S3', floor: '1', beds: 4 },
      ],
    },
    {
      name: 'Female Medical Ward', code: 'FW', deptCode: 'IPD', floor: '2', capacity: 12,
      rooms: [
        { name: 'Female Room 1',    code: 'F1', floor: '2', beds: 4 },
        { name: 'Female Room 2',    code: 'F2', floor: '2', beds: 4 },
        { name: 'Female Isolation', code: 'F3', floor: '2', beds: 4 },
      ],
    },
  ]

  let totalBeds = 0
  for (const wd of wardsData) {
    const ward = await prisma.ward.upsert({
      where:  { code: wd.code },
      update: { name: wd.name },
      create: {
        name:         wd.name,
        code:         wd.code,
        departmentId: depts[wd.deptCode].id,
        floor:        wd.floor,
        capacity:     wd.capacity,
        isActive:     true,
      },
    })

    for (const rd of wd.rooms) {
      const room = await prisma.room.upsert({
        where:  { code: rd.code },
        update: { name: rd.name },
        create: {
          name:     rd.name,
          code:     rd.code,
          wardId:   ward.id,
          floor:    rd.floor,
          isActive: true,
        },
      })

      for (let i = 1; i <= rd.beds; i++) {
        const bedNumber = `${rd.code}-B${i}`
        await prisma.bed.upsert({
          where:  { bedNumber },
          update: {},
          create: {
            bedNumber,
            roomId:   room.id,
            status:   'AVAILABLE',
            isActive: true,
          },
        })
        totalBeds++
      }
    }
    log(`${wd.name}: ${wd.rooms.length} rooms`)
  }
  log(`Total beds: ${totalBeds}`)

  // ── 4. SUPPLIER ────────────────────────────────────────────────────────
  section('Creating Default Supplier')

  const supplier = await prisma.supplier.upsert({
    where:  { code: 'KEMSA' },
    update: {},
    create: {
      name:          'Kenya Medical Supplies Authority',
      code:          'KEMSA',
      contactPerson: 'Supply Officer',
      phone:         '+254800000001',
      email:         'orders@kemsa.go.ke',
      address:       'Nairobi, Kenya',
      isActive:      true,
    },
  })
  log(`Supplier: ${supplier.name}`)

  const supplier2 = await prisma.supplier.upsert({
    where:  { code: 'MEDISEL' },
    update: {},
    create: {
      name:          'Medisel Kenya Ltd',
      code:          'MEDISEL',
      contactPerson: 'Sales Rep',
      phone:         '+254722000002',
      email:         'sales@medisel.co.ke',
      address:       'Industrial Area, Nairobi',
      isActive:      true,
    },
  })
  log(`Supplier: ${supplier2.name}`)

  // ── 5. DRUGS ───────────────────────────────────────────────────────────
  section('Creating Drug Catalogue & Stock')

  const drugsData = [
    { name: 'Amoxicillin 500mg Capsules',      code: 'AMX500',  category: 'ANTIBIOTIC',    unit: 'Capsules', formulation: 'Capsule',   price: 25,   reorder: 100 },
    { name: 'Amoxicillin 250mg Syrup',         code: 'AMX250S', category: 'ANTIBIOTIC',    unit: 'Bottles',  formulation: 'Syrup',     price: 120,  reorder: 50  },
    { name: 'Metronidazole 400mg Tablets',     code: 'MTZ400',  category: 'ANTIBIOTIC',    unit: 'Tablets',  formulation: 'Tablet',    price: 15,   reorder: 200 },
    { name: 'Ciprofloxacin 500mg Tablets',     code: 'CIP500',  category: 'ANTIBIOTIC',    unit: 'Tablets',  formulation: 'Tablet',    price: 40,   reorder: 100 },
    { name: 'Doxycycline 100mg Capsules',      code: 'DOX100',  category: 'ANTIBIOTIC',    unit: 'Capsules', formulation: 'Capsule',   price: 20,   reorder: 100 },
    { name: 'Azithromycin 500mg Tablets',      code: 'AZT500',  category: 'ANTIBIOTIC',    unit: 'Tablets',  formulation: 'Tablet',    price: 85,   reorder: 80  },
    { name: 'Paracetamol 500mg Tablets',       code: 'PCM500',  category: 'ANALGESIC',     unit: 'Tablets',  formulation: 'Tablet',    price: 5,    reorder: 500 },
    { name: 'Paracetamol 120mg Syrup',         code: 'PCM120S', category: 'ANALGESIC',     unit: 'Bottles',  formulation: 'Syrup',     price: 80,   reorder: 100 },
    { name: 'Ibuprofen 400mg Tablets',         code: 'IBU400',  category: 'ANALGESIC',     unit: 'Tablets',  formulation: 'Tablet',    price: 20,   reorder: 200 },
    { name: 'Diclofenac 50mg Tablets',         code: 'DCF50',   category: 'ANALGESIC',     unit: 'Tablets',  formulation: 'Tablet',    price: 15,   reorder: 200 },
    { name: 'Tramadol 50mg Capsules',          code: 'TRM50',   category: 'ANALGESIC',     unit: 'Capsules', formulation: 'Capsule',   price: 35,   reorder: 100 },
    { name: 'Morphine Injection 10mg/ml',      code: 'MOR10',   category: 'ANALGESIC',     unit: 'Ampoules', formulation: 'Injection', price: 450,  reorder: 30  },
    { name: 'Artemether-Lumefantrine 80/480',  code: 'ALU480',  category: 'ANTIMALARIAL',  unit: 'Tablets',  formulation: 'Tablet',    price: 350,  reorder: 100 },
    { name: 'Quinine 300mg Tablets',           code: 'QUI300',  category: 'ANTIMALARIAL',  unit: 'Tablets',  formulation: 'Tablet',    price: 25,   reorder: 200 },
    { name: 'Amlodipine 5mg Tablets',          code: 'AML5',    category: 'CARDIOVASCULAR',unit: 'Tablets',  formulation: 'Tablet',    price: 30,   reorder: 200 },
    { name: 'Enalapril 10mg Tablets',          code: 'ENA10',   category: 'CARDIOVASCULAR',unit: 'Tablets',  formulation: 'Tablet',    price: 25,   reorder: 150 },
    { name: 'Metoprolol 50mg Tablets',         code: 'MET50',   category: 'CARDIOVASCULAR',unit: 'Tablets',  formulation: 'Tablet',    price: 35,   reorder: 100 },
    { name: 'Furosemide 40mg Tablets',         code: 'FUR40',   category: 'CARDIOVASCULAR',unit: 'Tablets',  formulation: 'Tablet',    price: 12,   reorder: 200 },
    { name: 'Metformin 500mg Tablets',         code: 'MFM500',  category: 'ENDOCRINE',     unit: 'Tablets',  formulation: 'Tablet',    price: 15,   reorder: 300 },
    { name: 'Glibenclamide 5mg Tablets',       code: 'GLB5',    category: 'ENDOCRINE',     unit: 'Tablets',  formulation: 'Tablet',    price: 10,   reorder: 200 },
    { name: 'Insulin Actrapid 100IU/ml',       code: 'INS100',  category: 'ENDOCRINE',     unit: 'Vials',    formulation: 'Injection', price: 1200, reorder: 20  },
    { name: 'Normal Saline 0.9% 1L',           code: 'NS1L',    category: 'IV_FLUID',      unit: 'Bags',     formulation: 'Infusion',  price: 250,  reorder: 50  },
    { name: 'Dextrose 5% 1L',                  code: 'D5W1L',   category: 'IV_FLUID',      unit: 'Bags',     formulation: 'Infusion',  price: 280,  reorder: 50  },
    { name: 'Ringers Lactate 1L',              code: 'RL1L',    category: 'IV_FLUID',      unit: 'Bags',     formulation: 'Infusion',  price: 270,  reorder: 50  },
    { name: 'Folic Acid 5mg Tablets',          code: 'FOL5',    category: 'SUPPLEMENT',    unit: 'Tablets',  formulation: 'Tablet',    price: 5,    reorder: 500 },
    { name: 'Ferrous Sulphate 200mg Tablets',  code: 'FES200',  category: 'SUPPLEMENT',    unit: 'Tablets',  formulation: 'Tablet',    price: 8,    reorder: 400 },
    { name: 'Omeprazole 20mg Capsules',        code: 'OMP20',   category: 'OTHER',         unit: 'Capsules', formulation: 'Capsule',   price: 25,   reorder: 200 },
    { name: 'Salbutamol Inhaler 100mcg',       code: 'SAL100',  category: 'RESPIRATORY',   unit: 'Inhalers', formulation: 'Inhaler',   price: 650,  reorder: 30  },
    { name: 'Hydrocortisone Injection 100mg',  code: 'HYD100',  category: 'STEROID',       unit: 'Vials',    formulation: 'Injection', price: 380,  reorder: 30  },
  ]

  const expiry2yr = new Date()
  expiry2yr.setFullYear(expiry2yr.getFullYear() + 2)

  const createdDrugs = []
  for (const d of drugsData) {
    const drug = await prisma.drug.upsert({
      where:  { code: d.code },
      update: { price: d.price },
      create: {
        name:                d.name,
        code:                d.code,
        category:            d.category,
        unit:                d.unit,
        formulation:         d.formulation,
        price:               d.price,
        reorderLevel:        d.reorder,
        requiresPrescription:true,
        isActive:            true,
      },
    })
    createdDrugs.push(drug)

    // Stock batch
    const qty = Math.floor(Math.random() * 400) + 100
    await prisma.drugBatch.create({
      data: {
        drugId:        drug.id,
        batchNumber:   `BATCH-${drug.code}-001`,
        quantity:      qty,
        remainingQty:  qty,
        purchasePrice: d.price * 0.6,
        supplierId:    supplier2.id,
        expiryDate:    expiry2yr,
        receivedAt:    new Date(),
      },
    })
  }
  log(`${createdDrugs.length} drugs with stock batches`)

  // ── 6. INVENTORY ITEMS ─────────────────────────────────────────────────
  section('Creating Inventory Items')

  const inventoryData = [
    { name: 'Surgical Gloves Medium',     code: 'INV-GL-M',  cat: 'CONSUMABLE', unit: 'Pairs',   price: 25,  qty: 500, reorder: 100 },
    { name: 'Surgical Gloves Large',      code: 'INV-GL-L',  cat: 'CONSUMABLE', unit: 'Pairs',   price: 25,  qty: 400, reorder: 100 },
    { name: 'Surgical Masks',             code: 'INV-MSK',   cat: 'CONSUMABLE', unit: 'Pieces',  price: 15,  qty: 1000,reorder: 200 },
    { name: 'Syringes 5ml',               code: 'INV-SY5',   cat: 'CONSUMABLE', unit: 'Pieces',  price: 20,  qty: 500, reorder: 100 },
    { name: 'Syringes 10ml',              code: 'INV-SY10',  cat: 'CONSUMABLE', unit: 'Pieces',  price: 25,  qty: 400, reorder: 100 },
    { name: 'IV Cannula 18G',             code: 'INV-IVC18', cat: 'CONSUMABLE', unit: 'Pieces',  price: 45,  qty: 200, reorder: 50  },
    { name: 'IV Giving Sets',             code: 'INV-IVGS',  cat: 'CONSUMABLE', unit: 'Sets',    price: 60,  qty: 150, reorder: 50  },
    { name: 'Urinary Catheters 14Fr',     code: 'INV-UC14',  cat: 'CONSUMABLE', unit: 'Pieces',  price: 120, qty: 100, reorder: 30  },
    { name: 'Sterile Gauze 10x10',        code: 'INV-GZ',    cat: 'CONSUMABLE', unit: 'Packs',   price: 50,  qty: 300, reorder: 100 },
    { name: 'Bandage Crepe 10cm',         code: 'INV-BC10',  cat: 'CONSUMABLE', unit: 'Rolls',   price: 40,  qty: 200, reorder: 50  },
    { name: 'Blood Collection Tubes EDTA',code: 'INV-BCT-E', cat: 'LAB_SUPPLY', unit: 'Tubes',   price: 35,  qty: 500, reorder: 100 },
    { name: 'Blood Collection Tubes SST', code: 'INV-BCT-S', cat: 'LAB_SUPPLY', unit: 'Tubes',   price: 40,  qty: 400, reorder: 100 },
    { name: 'Urine Collection Cups',      code: 'INV-UC',    cat: 'LAB_SUPPLY', unit: 'Pieces',  price: 20,  qty: 300, reorder: 100 },
    { name: 'Malaria RDT Kits',           code: 'INV-MAL',   cat: 'LAB_SUPPLY', unit: 'Tests',   price: 80,  qty: 200, reorder: 50  },
    { name: 'Pregnancy Test Kits',        code: 'INV-PGT',   cat: 'LAB_SUPPLY', unit: 'Tests',   price: 60,  qty: 100, reorder: 30  },
    { name: 'Hospital Bed Sheets',        code: 'INV-BDS',   cat: 'LINEN',      unit: 'Pieces',  price: 350, qty: 100, reorder: 30  },
    { name: 'Hospital Gowns',            code: 'INV-GWN',   cat: 'LINEN',      unit: 'Pieces',  price: 600, qty: 60,  reorder: 20  },
    { name: 'Jik Bleach 5L',              code: 'INV-JIK',   cat: 'CLEANING',   unit: 'Bottles', price: 380, qty: 50,  reorder: 15  },
    { name: 'Hand Sanitizer 500ml',       code: 'INV-SAN',   cat: 'CLEANING',   unit: 'Bottles', price: 280, qty: 80,  reorder: 20  },
    { name: 'Liquid Soap 5L',            code: 'INV-SOP',   cat: 'CLEANING',   unit: 'Cans',    price: 650, qty: 40,  reorder: 10  },
  ]

  for (const item of inventoryData) {
    const inv = await prisma.inventoryItem.upsert({
      where:  { code: item.code },
      update: { price: item.price },
      create: {
        name:         item.name,
        code:         item.code,
        category:     item.cat,
        unit:         item.unit,
        price:        item.price,
        reorderLevel: item.reorder,
        isActive:     true,
      },
    })

    // Check no duplicate batch
    const existingBatch = await prisma.inventoryBatch.findFirst({
      where: { itemId: inv.id }
    })
    if (!existingBatch) {
      await prisma.inventoryBatch.create({
        data: {
          itemId:        inv.id,
          batchNumber:   `IBATCH-${item.code}-001`,
          quantity:      item.qty,
          remainingQty:  item.qty,
          purchasePrice: item.price * 0.7,
          supplierId:    supplier.id,
          receivedAt:    new Date(),
        },
      })
    }
  }
  log(`${inventoryData.length} inventory items with stock`)

  // ── 7. LAB TESTS ───────────────────────────────────────────────────────
  section('Creating Lab Test Catalogue')

  const labTestsData = [
    { name: 'Full Blood Count (FBC)',        code: 'FBC',   category: 'HAEMATOLOGY',  price: 600,  turnaround: 2  },
    { name: 'Haemoglobin',                   code: 'HGB',   category: 'HAEMATOLOGY',  price: 300,  turnaround: 1  },
    { name: 'Blood Group & Cross Match',     code: 'BGX',   category: 'HAEMATOLOGY',  price: 800,  turnaround: 2  },
    { name: 'ESR',                           code: 'ESR',   category: 'HAEMATOLOGY',  price: 350,  turnaround: 2  },
    { name: 'Clotting Profile (PT/APTT)',    code: 'CLOT',  category: 'HAEMATOLOGY',  price: 1200, turnaround: 4  },
    { name: 'Random Blood Sugar (RBS)',      code: 'RBS',   category: 'BIOCHEMISTRY', price: 300,  turnaround: 1  },
    { name: 'Fasting Blood Sugar (FBS)',     code: 'FBS',   category: 'BIOCHEMISTRY', price: 300,  turnaround: 1  },
    { name: 'HbA1c',                         code: 'HBA1C', category: 'BIOCHEMISTRY', price: 1500, turnaround: 4  },
    { name: 'Lipid Profile',                 code: 'LIPID', category: 'BIOCHEMISTRY', price: 1800, turnaround: 4  },
    { name: 'Liver Function Tests (LFTs)',   code: 'LFT',   category: 'BIOCHEMISTRY', price: 2000, turnaround: 4  },
    { name: 'Renal Function Tests (RFTs)',   code: 'RFT',   category: 'BIOCHEMISTRY', price: 1800, turnaround: 4  },
    { name: 'Thyroid Function Tests (TFTs)', code: 'TFT',   category: 'BIOCHEMISTRY', price: 3500, turnaround: 8  },
    { name: 'Serum Electrolytes',            code: 'ELEC',  category: 'BIOCHEMISTRY', price: 1500, turnaround: 4  },
    { name: 'Malaria RDT',                   code: 'MRDT',  category: 'MICROBIOLOGY', price: 400,  turnaround: 1  },
    { name: 'Malaria Blood Smear',           code: 'MBS',   category: 'MICROBIOLOGY', price: 500,  turnaround: 2  },
    { name: 'Urine MCS',                     code: 'UMCS',  category: 'MICROBIOLOGY', price: 1200, turnaround: 48 },
    { name: 'Stool MCS',                     code: 'SMCS',  category: 'MICROBIOLOGY', price: 1000, turnaround: 48 },
    { name: 'Blood Culture',                 code: 'BC',    category: 'MICROBIOLOGY', price: 2500, turnaround: 72 },
    { name: 'HIV Rapid Test',                code: 'HIV',   category: 'SEROLOGY',     price: 500,  turnaround: 1  },
    { name: 'VDRL/RPR (Syphilis)',           code: 'VDRL',  category: 'SEROLOGY',     price: 600,  turnaround: 2  },
    { name: 'Hepatitis B Surface Antigen',   code: 'HBSAG', category: 'SEROLOGY',     price: 800,  turnaround: 2  },
    { name: 'Widal Test',                    code: 'WIDAL', category: 'SEROLOGY',     price: 700,  turnaround: 4  },
    { name: 'Urinalysis (Dipstick)',         code: 'UDA',   category: 'URINALYSIS',   price: 350,  turnaround: 1  },
    { name: 'Urine Pregnancy Test',          code: 'UPT',   category: 'URINALYSIS',   price: 300,  turnaround: 1  },
  ]

  for (const t of labTestsData) {
    await prisma.labTest.upsert({
      where:  { code: t.code },
      update: { price: t.price },
      create: {
        name:            t.name,
        code:            t.code,
        category:        t.category,
        price:           t.price,
        turnaroundHours: t.turnaround,
        isActive:        true,
      },
    })
  }
  log(`${labTestsData.length} lab tests registered`)

  // ── 8. RADIOLOGY SERVICES ──────────────────────────────────────────────
  section('Creating Radiology Services')

  const radData = [
    { name: 'Chest X-Ray (PA)',          code: 'CXR-PA',   modality: 'X-RAY',      price: 1500  },
    { name: 'Chest X-Ray (AP)',          code: 'CXR-AP',   modality: 'X-RAY',      price: 1500  },
    { name: 'Abdominal X-Ray',           code: 'ABD-XR',   modality: 'X-RAY',      price: 1800  },
    { name: 'Abdominal Ultrasound',      code: 'ABD-USS',  modality: 'ULTRASOUND', price: 3000  },
    { name: 'Obstetric Ultrasound',      code: 'OBS-USS',  modality: 'ULTRASOUND', price: 3500  },
    { name: 'Pelvic Ultrasound',         code: 'PEL-USS',  modality: 'ULTRASOUND', price: 3000  },
    { name: 'Renal Ultrasound',          code: 'REN-USS',  modality: 'ULTRASOUND', price: 3000  },
    { name: 'Neck Ultrasound',           code: 'NCK-USS',  modality: 'ULTRASOUND', price: 3500  },
    { name: 'CT Scan Head',              code: 'CT-HEAD',  modality: 'CT',         price: 15000 },
    { name: 'CT Scan Chest',             code: 'CT-CHEST', modality: 'CT',         price: 18000 },
    { name: 'CT Scan Abdomen & Pelvis',  code: 'CT-ABP',   modality: 'CT',         price: 22000 },
    { name: 'MRI Brain',                 code: 'MRI-BR',   modality: 'MRI',        price: 35000 },
    { name: 'ECG',                       code: 'ECG',      modality: 'ECG',        price: 1200  },
    { name: 'Echocardiogram',            code: 'ECHO',     modality: 'ULTRASOUND', price: 8000  },
  ]

  for (const r of radData) {
    await prisma.radiologyService.upsert({
      where:  { code: r.code },
      update: { price: r.price },
      create: {
        name:     r.name,
        code:     r.code,
        modality: r.modality,
        price:    r.price,
        isActive: true,
      },
    })
  }
  log(`${radData.length} radiology services registered`)

  // ── 9. SERVICE CATALOG (Billing) ───────────────────────────────────────
  section('Creating Service Catalog')

  const servicesData = [
    { name: 'OPD Consultation',          code: 'SVC-OPD',  cat: 'CONSULTATION', price: 500   },
    { name: 'Specialist Consultation',   code: 'SVC-SPEC', cat: 'CONSULTATION', price: 2000  },
    { name: 'Emergency Consultation',    code: 'SVC-EMRG', cat: 'CONSULTATION', price: 1000  },
    { name: 'Follow-up Consultation',    code: 'SVC-FUP',  cat: 'CONSULTATION', price: 300   },
    { name: 'Wound Dressing',            code: 'SVC-WD',   cat: 'PROCEDURE',    price: 500   },
    { name: 'Suturing (simple)',         code: 'SVC-SUT',  cat: 'PROCEDURE',    price: 1500  },
    { name: 'IV Cannulation',            code: 'SVC-IVC',  cat: 'PROCEDURE',    price: 300   },
    { name: 'Injection Administration',  code: 'SVC-INJ',  cat: 'PROCEDURE',    price: 200   },
    { name: 'General Ward (per day)',    code: 'SVC-GWD',  cat: 'WARD',         price: 2000  },
    { name: 'Private Room (per day)',    code: 'SVC-PWD',  cat: 'WARD',         price: 8000  },
    { name: 'VIP Suite (per day)',       code: 'SVC-VIP',  cat: 'WARD',         price: 15000 },
    { name: 'ICU (per day)',             code: 'SVC-ICU',  cat: 'WARD',         price: 25000 },
    { name: 'Minor Surgery',             code: 'SVC-SMS',  cat: 'SURGERY',      price: 15000 },
    { name: 'Major Surgery',             code: 'SVC-MJS',  cat: 'SURGERY',      price: 80000 },
    { name: 'Caesarean Section',         code: 'SVC-CS',   cat: 'SURGERY',      price: 60000 },
    { name: 'Normal Delivery',           code: 'SVC-NVD',  cat: 'MATERNITY',    price: 15000 },
    { name: 'ANC Visit',                 code: 'SVC-ANC',  cat: 'MATERNITY',    price: 800   },
    { name: 'Medical Report',            code: 'SVC-MRP',  cat: 'ADMIN',        price: 1500  },
    { name: 'Death Certificate',         code: 'SVC-DC',   cat: 'ADMIN',        price: 2000  },
  ]

  for (const s of servicesData) {
    await prisma.serviceCatalog.upsert({
      where:  { code: s.code },
      update: { price: s.price },
      create: {
        name:     s.name,
        code:     s.code,
        category: s.cat,
        price:    s.price,
        isActive: true,
      },
    })
  }
  log(`${servicesData.length} services in catalog`)

  // ── 10. ASSETS (Facility) ─────────────────────────────────────────────
  section('Creating Facility Assets')

  const assetsData = [
    { name: 'Philips Ultrasound Machine',   number: 'AST-0001', cat: 'Medical Equipment',  location: 'Radiology Dept',    brand: 'Philips', model: 'HD11 XE',    serial: 'PHL-USS-001', price: 850000  },
    { name: 'GE ECG Machine',              number: 'AST-0002', cat: 'Medical Equipment',  location: 'Cardiology Room',   brand: 'GE',      model: 'MAC 2000',   serial: 'GE-ECG-001',  price: 120000  },
    { name: 'Digital X-Ray Machine',       number: 'AST-0003', cat: 'Medical Equipment',  location: 'Radiology Dept',    brand: 'Siemens', model: 'Multix X',   serial: 'SIE-XR-001',  price: 2500000 },
    { name: 'Autoclave Sterilizer 45L',    number: 'AST-0004', cat: 'Medical Equipment',  location: 'CSSD Room',         brand: 'W&H',     model: 'Lisa 45L',   serial: 'WH-AC-001',   price: 280000  },
    { name: 'Anaesthesia Machine',         number: 'AST-0005', cat: 'Medical Equipment',  location: 'Main Theatre 1',    brand: 'Drager',  model: 'Fabius GS',  serial: 'DRG-AN-001',  price: 1800000 },
    { name: 'Biomedical Fridge 300L',      number: 'AST-0006', cat: 'Medical Equipment',  location: 'Blood Bank',        brand: 'LEC',     model: 'LSU300',     serial: 'LEC-RF-001',  price: 180000  },
    { name: 'Hospital Generator 100KVA',   number: 'AST-0007', cat: 'Generator',          location: 'Generator Room',    brand: 'Cummins', model: 'C100D5',     serial: 'CUM-GN-001',  price: 1500000 },
    { name: 'Backup Generator 50KVA',      number: 'AST-0008', cat: 'Generator',          location: 'Generator Room',    brand: 'Perkins', model: 'P50-1',      serial: 'PER-GN-001',  price: 800000  },
    { name: 'Medical Oxygen Plant',        number: 'AST-0009', cat: 'Medical Equipment',  location: 'Oxygen Plant Room', brand: 'Chart',   model: 'MVS-10',     serial: 'CHT-OX-001',  price: 3200000 },
    { name: 'Hospital Ambulance',          number: 'AST-0010', cat: 'Vehicle',            location: 'Parking Bay',       brand: 'Toyota',  model: 'HiAce 2023', serial: 'KDG-123A',    price: 3500000 },
    { name: 'HVAC System - Ward Block',    number: 'AST-0011', cat: 'HVAC',               location: 'Ward Block',        brand: 'Carrier', model: '30XA-150',   serial: 'CAR-AC-001',  price: 950000  },
    { name: 'Server & IT Infrastructure',  number: 'AST-0012', cat: 'IT Equipment',       location: 'Server Room',       brand: 'Dell',    model: 'PowerEdge',  serial: 'DEL-SRV-001', price: 450000  },
  ]

  const warrantyDate = new Date()
  warrantyDate.setFullYear(warrantyDate.getFullYear() + 3)

  for (const a of assetsData) {
    await prisma.asset.upsert({
      where:  { assetNumber: a.number },
      update: {},
      create: {
        assetNumber:   a.number,
        name:          a.name,
        category:      a.cat,
        brand:         a.brand,
        model:         a.model,
        serialNumber:  a.serial,
        location:      a.location,
        purchaseDate:  new Date('2023-01-15'),
        purchasePrice: a.price,
        warrantyExpiry:warrantyDate,
        status:        'ACTIVE',
      },
    })
    log(`Asset: ${a.name}`)
  }

  // ── 11. PATIENTS ──────────────────────────────────────────────────────
  section('Creating Sample Patients')

  const patientsData = [
    { first: 'John',    last: 'Mwangi',   mid: 'Kamau',   dob: '1985-03-15', gender: 'MALE',   phone: '+254711001001', blood: 'A_POSITIVE',  nokName: 'Mary Mwangi',    nokPhone: '+254711001002', nokRel: 'Wife'    },
    { first: 'Grace',   last: 'Kariuki',  mid: 'Wanjiru', dob: '1992-07-22', gender: 'FEMALE', phone: '+254722002001', blood: 'O_POSITIVE',  nokName: 'James Kariuki',  nokPhone: '+254722002002', nokRel: 'Husband' },
    { first: 'Peter',   last: 'Otieno',   mid: 'Odhiambo',dob: '1978-11-08', gender: 'MALE',   phone: '+254733003001', blood: 'B_POSITIVE',  nokName: 'Agnes Otieno',   nokPhone: '+254733003002', nokRel: 'Wife'    },
    { first: 'Faith',   last: 'Omondi',   mid: 'Akinyi',  dob: '2000-04-30', gender: 'FEMALE', phone: '+254744004001', blood: 'AB_POSITIVE', nokName: 'Paul Omondi',    nokPhone: '+254744004002', nokRel: 'Father'  },
    { first: 'Samuel',  last: 'Ruto',     mid: 'Kipchoge',dob: '1965-09-12', gender: 'MALE',   phone: '+254755005001', blood: 'O_NEGATIVE',  nokName: 'Susan Ruto',     nokPhone: '+254755005002', nokRel: 'Wife'    },
    { first: 'Mary',    last: 'Ngugi',    mid: 'Wambui',  dob: '1998-01-25', gender: 'FEMALE', phone: '+254766006001', blood: 'A_NEGATIVE',  nokName: 'John Ngugi',     nokPhone: '+254766006002', nokRel: 'Husband' },
    { first: 'David',   last: 'Njoroge',  mid: 'Maina',   dob: '1990-06-18', gender: 'MALE',   phone: '+254777007001', blood: 'B_NEGATIVE',  nokName: 'Lucy Njoroge',   nokPhone: '+254777007002', nokRel: 'Wife'    },
    { first: 'Rose',    last: 'Onyango',  mid: 'Achieng', dob: '2005-12-03', gender: 'FEMALE', phone: '+254788008001', blood: 'O_POSITIVE',  nokName: 'Tom Onyango',    nokPhone: '+254788008002', nokRel: 'Father'  },
    { first: 'Kevin',   last: 'Musyoka',  mid: 'Mutua',   dob: '1975-08-14', gender: 'MALE',   phone: '+254799009001', blood: 'A_POSITIVE',  nokName: 'Sarah Musyoka',  nokPhone: '+254799009002', nokRel: 'Wife'    },
    { first: 'Ann',     last: 'Kamau',    mid: 'Njeri',   dob: '1988-02-28', gender: 'FEMALE', phone: '+254700010001', blood: 'AB_NEGATIVE', nokName: 'James Kamau',    nokPhone: '+254700010002', nokRel: 'Husband' },
    { first: 'Thomas',  last: 'Barasa',   mid: 'Wekesa',  dob: '1955-05-20', gender: 'MALE',   phone: '+254711011001', blood: 'B_POSITIVE',  nokName: 'Esther Barasa',  nokPhone: '+254711011002', nokRel: 'Wife'    },
    { first: 'Lucy',    last: 'Kosgei',   mid: 'Chebet',  dob: '1995-10-07', gender: 'FEMALE', phone: '+254722012001', blood: 'O_POSITIVE',  nokName: 'Paul Kosgei',    nokPhone: '+254722012002', nokRel: 'Husband' },
    { first: 'Brian',   last: 'Ochieng',  mid: null,      dob: '2010-03-11', gender: 'MALE',   phone: '+254733013001', blood: 'A_POSITIVE',  nokName: 'Janet Ochieng',  nokPhone: '+254733013002', nokRel: 'Mother'  },
    { first: 'Esther',  last: 'Simiyu',   mid: 'Wanjala', dob: '1982-07-19', gender: 'FEMALE', phone: '+254744014001', blood: 'O_NEGATIVE',  nokName: 'Moses Simiyu',   nokPhone: '+254744014002', nokRel: 'Husband' },
    { first: 'Charles', last: 'Gacheru',  mid: 'Njau',    dob: '1970-12-25', gender: 'MALE',   phone: '+254755015001', blood: 'B_POSITIVE',  nokName: 'Hannah Gacheru', nokPhone: '+254755015002', nokRel: 'Wife'    },
  ]

  const createdPatients = []
  let mrnCounter = await prisma.patient.count()

  for (const p of patientsData) {
    const existing = await prisma.patient.findFirst({ where: { phone: p.phone } })
    if (existing) {
      createdPatients.push(existing)
      continue
    }
    mrnCounter++
    const mrn = `MRN-${String(mrnCounter).padStart(5, '0')}`
    const patient = await prisma.patient.create({
      data: {
        mrn,
        firstName:        p.first,
        middleName:       p.mid || null,
        lastName:         p.last,
        dateOfBirth:      new Date(p.dob),
        gender:           p.gender,
        phone:            p.phone,
        bloodGroup:       p.blood,
        nextOfKinName:    p.nokName,
        nextOfKinPhone:   p.nokPhone,
        nextOfKinRelation:p.nokRel,
        nationality:      'Kenyan',
        patientType:      'OUTPATIENT',
        isActive:         true,
      },
    })
    createdPatients.push(patient)
    log(`Patient: ${p.first} ${p.last} (${mrn})`)
  }

  // ── 12. SAMPLE VISITS ─────────────────────────────────────────────────
  section('Creating Sample OPD Visits (Today)')

  const doctor   = createdUsers['DOCTOR']
  const nurse    = createdUsers['NURSE']
  const today    = new Date()
  const statuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'COMPLETED', 'ACTIVE']
  const complaints = [
    'Fever and chills for 3 days',
    'Headache and body aches',
    'Abdominal pain, nausea and vomiting',
    'Cough and shortness of breath',
    'High blood pressure follow-up',
    'Diabetes review and medication refill',
    'Urinary burning and frequency',
    'Back pain after heavy lifting',
    'Diarrhoea for 2 days',
    'Chest pain on exertion',
  ]

  // Visit number counter
  let visitCounter = await prisma.visit.count()
  let visitCount   = 0

  for (let i = 0; i < Math.min(10, createdPatients.length); i++) {
    const patient   = createdPatients[i]
    const complaint = complaints[i]

    const existingVisit = await prisma.visit.findFirst({
      where: {
        patientId: patient.id,
        createdAt: { gte: new Date(today.toDateString()) },
      },
    })
    if (existingVisit) continue

    visitCounter++
    const visitNumber = `V-${String(visitCounter).padStart(6, '0')}`

    const visit = await prisma.visit.create({
      data: {
        visitNumber,
        patientId:     patient.id,
        visitType:     'OPD',
        chiefComplaint:complaint,
        status:        statuses[i % statuses.length],
        visitDate:     new Date(today.getTime() - (i * 20 * 60000)),
        createdAt:     new Date(today.getTime() - (i * 20 * 60000)),
      },
    })

    // Triage for most patients
    if (i < 8) {
      const levels  = ['NON_URGENT','NON_URGENT','LESS_URGENT','URGENT','IMMEDIATE']
      await prisma.triage.create({
        data: {
          visitId:       visit.id,
          triageLevel:   levels[i % levels.length],
          chiefComplaint:complaint,
          triageTime:    new Date(today.getTime() - (i * 18 * 60000)),
          nurseId:       nurse?.id || null,
        },
      })

      // Vitals
      await prisma.vitalSign.create({
        data: {
          visitId:               visit.id,
          bloodPressureSystolic: Math.floor(Math.random() * 40) + 100,
          bloodPressureDiastolic:Math.floor(Math.random() * 20) + 60,
          pulse:                 Math.floor(Math.random() * 40) + 60,
          temperature:           (36 + Math.random() * 2).toFixed(1),
          oxygenSaturation:      (95 + Math.random() * 5).toFixed(1),
          respiratoryRate:       Math.floor(Math.random() * 8) + 14,
          weight:                (50 + Math.random() * 40).toFixed(1),
          recordedById:          nurse?.id || null,
        },
      })
    }

    visitCount++
    log(`Visit: ${patient.firstName} ${patient.lastName} — ${complaint.substring(0, 35)}…`)
  }

  // ── 13. NOTIFICATIONS ─────────────────────────────────────────────────
  section('Creating Notifications')

  const notifData = [
    { role: 'DOCTOR',       title: 'Patients Waiting',     message: 'You have patients in the OPD queue',         type: 'INFO'    },
    { role: 'NURSE',        title: 'Triage Required',      message: '2 patients pending triage in OPD',           type: 'WARNING' },
    { role: 'PHARMACIST',   title: 'Low Stock Alert',      message: 'Morphine Injection running low (< 30 units)', type: 'WARNING' },
    { role: 'LAB_SCIENTIST',title: 'Pending Lab Orders',   message: '5 lab orders awaiting processing',           type: 'INFO'    },
    { role: 'SUPER_ADMIN',  title: 'System Ready',         message: 'Database seeded successfully',               type: 'INFO'    },
  ]

  for (const n of notifData) {
    const u = createdUsers[n.role]
    if (!u) continue
    await prisma.notification.create({
      data: {
        userId:  u.id,
        title:   n.title,
        message: n.message,
        type:    n.type,
        isRead:  false,
      },
    })
  }
  log(`${notifData.length} notifications created`)

  // ── DONE ──────────────────────────────────────────────────────────────
  console.log('\n==========================================')
  console.log('✅ SEED COMPLETE!')
  console.log(`   🏢 ${Object.keys(depts).length} departments`)
  console.log(`   👤 ${usersData.length} users (password: Admin@1234)`)
  console.log(`   🏥 ${wardsData.length} wards, ${totalBeds} beds`)
  console.log(`   🧑 ${createdPatients.length} patients`)
  console.log(`   💊 ${createdDrugs.length} drugs with stock`)
  console.log(`   📦 ${inventoryData.length} inventory items`)
  console.log(`   🧪 ${labTestsData.length} lab tests`)
  console.log(`   📡 ${radData.length} radiology services`)
  console.log(`   💰 ${servicesData.length} services in catalog`)
  console.log(`   🔧 ${assetsData.length} facility assets`)
  console.log(`   📋 ${visitCount} OPD visits today`)
  console.log('==========================================\n')
}

main()
  .catch(e => {
    console.error('\n❌ SEED FAILED:', e.message)
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })