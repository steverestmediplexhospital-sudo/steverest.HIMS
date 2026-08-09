// backend/create-admin.js
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function createUsers() {
  try {
    console.log('Connecting to Supabase...')
    await prisma.$connect()
    console.log('Connected!\n')

    const users = [
      {
        email:      'admin@steverest.com',
        firstName:  'System',
        lastName:   'Admin',
        password:   'Admin@1234',
        role:       'SUPER_ADMIN',
        employeeId: 'EMP-ADMIN-001',
        phone:      '+254700000001'
      },
      {
        email:      'hadmin@steverest.com',
        firstName:  'Hospital',
        lastName:   'Admin',
        password:   'Admin@1234',
        role:       'HOSPITAL_ADMIN',
        employeeId: 'EMP-HADM-001',
        phone:      '+254700000002'
      },
      {
        email:      'doctor@steverest.com',
        firstName:  'John',
        lastName:   'Kamau',
        password:   'Doctor@1234',
        role:       'DOCTOR',
        employeeId: 'EMP-DOC-001',
        phone:      '+254711000001'
      },
      {
        email:      'surgeon@steverest.com',
        firstName:  'David',
        lastName:   'Mwangi',
        password:   'Surgeon@1234',
        role:       'SURGEON',
        employeeId: 'EMP-SRG-001',
        phone:      '+254711000002'
      },
      {
        email:      'nurse@steverest.com',
        firstName:  'Mary',
        lastName:   'Wanjiku',
        password:   'Nurse@1234',
        role:       'NURSE',
        employeeId: 'EMP-NRS-001',
        phone:      '+254722000001'
      },
      {
        email:      'theatre@steverest.com',
        firstName:  'Alice',
        lastName:   'Achieng',
        password:   'Nurse@1234',
        role:       'THEATRE_NURSE',
        employeeId: 'EMP-THN-001',
        phone:      '+254722000002'
      },
      {
        email:      'midwife@steverest.com',
        firstName:  'Grace',
        lastName:   'Njeri',
        password:   'Midwife@1234',
        role:       'MIDWIFE',
        employeeId: 'EMP-MID-001',
        phone:      '+254722000003'
      },
      {
        email:      'lab@steverest.com',
        firstName:  'Peter',
        lastName:   'Otieno',
        password:   'Lab@1234',
        role:       'LAB_SCIENTIST',
        employeeId: 'EMP-LAB-001',
        phone:      '+254733000001'
      },
      {
        email:      'labtech@steverest.com',
        firstName:  'Samuel',
        lastName:   'Kipchoge',
        password:   'Lab@1234',
        role:       'LAB_TECHNICIAN',
        employeeId: 'EMP-LBT-001',
        phone:      '+254733000002'
      },
      {
        email:      'radiology@steverest.com',
        firstName:  'Brian',
        lastName:   'Odhiambo',
        password:   'Radio@1234',
        role:       'RADIOGRAPHER',
        employeeId: 'EMP-RAD-001',
        phone:      '+254733000003'
      },
      {
        email:      'pharmacy@steverest.com',
        firstName:  'Esther',
        lastName:   'Mutua',
        password:   'Pharm@1234',
        role:       'PHARMACIST',
        employeeId: 'EMP-PHA-001',
        phone:      '+254744000001'
      },
      {
        email:      'reception@steverest.com',
        firstName:  'Jane',
        lastName:   'Ndungu',
        password:   'Recep@1234',
        role:       'RECEPTIONIST',
        employeeId: 'EMP-REC-001',
        phone:      '+254755000001'
      },
      {
        email:      'records@steverest.com',
        firstName:  'Kevin',
        lastName:   'Macharia',
        password:   'Records@1234',
        role:       'MEDICAL_RECORDS_OFFICER',
        employeeId: 'EMP-MRO-001',
        phone:      '+254755000002'
      },
      {
        email:      'coordinator@steverest.com',
        firstName:  'Ruth',
        lastName:   'Kamande',
        password:   'Coord@1234',
        role:       'CLINICAL_COORDINATOR',
        employeeId: 'EMP-CCO-001',
        phone:      '+254755000003'
      },
      {
        email:      'cashier@steverest.com',
        firstName:  'James',
        lastName:   'Waweru',
        password:   'Cash@1234',
        role:       'CASHIER',
        employeeId: 'EMP-CSH-001',
        phone:      '+254766000001'
      },
      {
        email:      'accountant@steverest.com',
        firstName:  'Ann',
        lastName:   'Muthoni',
        password:   'Acct@1234',
        role:       'ACCOUNTANT',
        employeeId: 'EMP-ACC-001',
        phone:      '+254766000002'
      },
      {
        email:      'inventory@steverest.com',
        firstName:  'Tom',
        lastName:   'Kariuki',
        password:   'Inv@1234',
        role:       'INVENTORY_OFFICER',
        employeeId: 'EMP-INV-001',
        phone:      '+254766000003'
      },
      {
        email:      'facility@steverest.com',
        firstName:  'Joseph',
        lastName:   'Mwenda',
        password:   'Fac@1234',
        role:       'FACILITY_OFFICER',
        employeeId: 'EMP-FAC-001',
        phone:      '+254766000004'
      },
      {
        email:      'mortuary@steverest.com',
        firstName:  'Charles',
        lastName:   'Gitau',
        password:   'Mort@1234',
        role:       'MORTUARY_OFFICER',
        employeeId: 'EMP-MOR-001',
        phone:      '+254777000001'
      },
      {
        email:      'director@steverest.com',
        firstName:  'Dr. Sarah',
        lastName:   'Omondi',
        password:   'Director@1234',
        role:       'MEDICAL_DIRECTOR',
        employeeId: 'EMP-MD-001',
        phone:      '+254700000010'
      }
    ]

    console.log('Creating users...\n')

    for (const u of users) {
      const hash = await bcrypt.hash(u.password, 10)
      const user = await prisma.user.upsert({
        where:  { email: u.email },
        update: {
          passwordHash: hash,
          status:       'ACTIVE',
          firstName:    u.firstName,
          lastName:     u.lastName,
          phone:        u.phone,
          role:         u.role
        },
        create: {
          email:        u.email,
          firstName:    u.firstName,
          lastName:     u.lastName,
          passwordHash: hash,
          role:         u.role,
          employeeId:   u.employeeId,
          status:       'ACTIVE',
          phone:        u.phone
        }
      })
      console.log(`  ✅ ${user.role.padEnd(25)} ${user.email.padEnd(35)} pwd: ${u.password}`)
    }

    console.log('\n========================================')
    console.log('  ALL USERS CREATED SUCCESSFULLY')
    console.log('========================================')
    console.log('\n  PRIMARY LOGIN:')
    console.log('  admin@steverest.com  /  Admin@1234  (SUPER_ADMIN)')
    console.log('  doctor@steverest.com /  Doctor@1234 (DOCTOR)')
    console.log('  nurse@steverest.com  /  Nurse@1234  (NURSE)')
    console.log('========================================\n')

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    if (error.code) console.error('   Code:', error.code)
  } finally {
    await prisma.$disconnect()
    console.log('Disconnected.')
  }
}

createUsers()