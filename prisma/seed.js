const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      passwordHash: adminPasswordHash,
      name: 'Admin User',
      isAdmin: true
    }
  });
  console.log('Created admin user');

  // Create regular user
  const userPasswordHash = await bcrypt.hash('user123', 10);
  const regularUser = await prisma.user.create({
    data: {
      email: 'user@example.com',
      passwordHash: userPasswordHash,
      name: 'John Doe',
      isAdmin: false
    }
  });
  console.log('Created regular user');

  // Create employee profile for regular user
  const employee = await prisma.employee.create({
    data: {
      userId: regularUser.id,
      firstName: 'John',
      lastName: 'Doe',
      email: 'user@example.com',
      phone: '+1234567890',
      presetAddresses: JSON.stringify({
        home: '123 Main St, Springfield',
        work_place_1: 'Department of Education, 456 Admin Blvd',
        school_1: 'Springfield Elementary, 789 School Rd'
      })
    }
  });
  console.log('Created employee profile');

  // Create companies
  const det = await prisma.company.create({
    data: {
      name: 'Department of Education',
      isBillable: true
    }
  });

  const msp = await prisma.company.create({
    data: {
      name: 'MSP Tech Solutions',
      isBillable: true
    }
  });

  const internal = await prisma.company.create({
    data: {
      name: 'Internal (Non-billable)',
      isBillable: false
    }
  });
  console.log('Created companies');

  // Create roles
  const detSpecialist = await prisma.role.create({
    data: {
      name: 'Specialist Technician',
      companyId: det.id,
      payRate: 75.00
    }
  });

  const detLocal = await prisma.role.create({
    data: {
      name: 'Local Technician',
      companyId: det.id,
      payRate: 55.00
    }
  });

  const mspTech = await prisma.role.create({
    data: {
      name: 'Support Technician',
      companyId: msp.id,
      payRate: 65.00
    }
  });

  const mspHelpdesk = await prisma.role.create({
    data: {
      name: 'Helpdesk Support',
      companyId: msp.id,
      payRate: 45.00
    }
  });
  console.log('Created roles');

  // Assign roles to employee
  await prisma.employeeRole.createMany({
    data: [
      {
        employeeId: employee.id,
        roleId: detSpecialist.id,
        companyId: det.id,
        isActive: true
      },
      {
        employeeId: employee.id,
        roleId: mspTech.id,
        companyId: msp.id,
        isActive: true
      }
    ]
  });
  console.log('Assigned roles to employee');

  // Create employee identifiers
  await prisma.employeeIdentifier.createMany({
    data: [
      {
        employeeId: employee.id,
        identifierType: 'payroll',
        identifierValue: 'PAY-12345',
        companyId: det.id
      },
      {
        employeeId: employee.id,
        identifierType: 'contractor_id',
        identifierValue: 'CTR-67890',
        companyId: msp.id
      }
    ]
  });
  console.log('Created employee identifiers');

  // Create approver
  await prisma.timesheetApprover.create({
    data: {
      companyId: det.id,
      userId: adminUser.id,
      email: 'admin@example.com'
    }
  });
  console.log('Created approver');

  // Create a sample timesheet
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday

  const timesheet = await prisma.timesheet.create({
    data: {
      employeeId: employee.id,
      weekStarting: startOfWeek,
      weekEnding: endOfWeek,
      status: 'OPEN'
    }
  });
  console.log('Created sample timesheet');

  // Create sample entries
  await prisma.timesheetEntry.createMany({
    data: [
      {
        timesheetId: timesheet.id,
        entryType: 'GENERAL',
        date: startOfWeek,
        hours: 8,
        roleId: detSpecialist.id,
        companyId: det.id,
        status: 'OPEN',
        notes: 'Network maintenance and updates'
      },
      {
        timesheetId: timesheet.id,
        entryType: 'TRAVEL',
        date: startOfWeek,
        hours: 2,
        roleId: detLocal.id,
        companyId: det.id,
        status: 'OPEN',
        notes: 'Travel to school site',
        travelFrom: '456 Admin Blvd',
        travelTo: '789 School Rd',
        distance: 25.5
      }
    ]
  });
  console.log('Created sample timesheet entries');

  console.log('\n=== Seed Complete ===');
  console.log('Admin credentials:');
  console.log('  Email: admin@example.com');
  console.log('  Password: admin123');
  console.log('\nUser credentials:');
  console.log('  Email: user@example.com');
  console.log('  Password: user123');
  console.log('=====================\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
