const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getAllEmployees = async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      include: {
        user: {
          select: { id: true, email: true, name: true }
        },
        identifiers: true,
        roles: {
          include: {
            role: true,
            company: true
          },
          where: { isActive: true }
        }
      }
    });
    res.json({ employees });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
};

const getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: {
          select: { id: true, email: true, name: true, isAdmin: true }
        },
        identifiers: {
          include: {
            company: true
          }
        },
        roles: {
          include: {
            role: true,
            company: true
          }
        },
        timesheets: {
          orderBy: { weekStarting: 'desc' },
          take: 10
        }
      }
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Parse preset addresses if they exist
    if (employee.presetAddresses) {
      try {
        employee.presetAddresses = JSON.parse(employee.presetAddresses);
      } catch (e) {
        employee.presetAddresses = null;
      }
    }

    res.json({ employee });
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
};

const createEmployee = async (req, res) => {
  try {
    const { userId, firstName, lastName, email, phone, presetAddresses } = req.body;

    if (!userId || !firstName || !lastName || !email) {
      return res.status(400).json({ error: 'userId, firstName, lastName, and email are required' });
    }

    const employee = await prisma.employee.create({
      data: {
        userId: parseInt(userId),
        firstName,
        lastName,
        email,
        phone,
        presetAddresses: presetAddresses ? JSON.stringify(presetAddresses) : null
      },
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      }
    });

    res.status(201).json({ message: 'Employee created successfully', employee });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
};

const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phone, presetAddresses } = req.body;

    const { morningStart, morningEnd, afternoonStart, afternoonEnd, maxDailyHours } = req.body;

    const employee = await prisma.employee.update({
      where: { id: parseInt(id) },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(email && { email }),
        ...(phone !== undefined && { phone }),
        ...(presetAddresses && { presetAddresses: JSON.stringify(presetAddresses) }),
        ...(morningStart !== undefined && { morningStart }),
        ...(morningEnd !== undefined && { morningEnd }),
        ...(afternoonStart !== undefined && { afternoonStart }),
        ...(afternoonEnd !== undefined && { afternoonEnd }),
        ...(maxDailyHours !== undefined && { maxDailyHours: parseFloat(maxDailyHours) })
      },
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      }
    });

    res.json({ message: 'Employee updated successfully', employee });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.employee.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
};

const addEmployeeIdentifier = async (req, res) => {
  try {
    const { id } = req.params;
    const { identifierType, identifierValue, companyId } = req.body;

    if (!identifierType || !identifierValue) {
      return res.status(400).json({ error: 'identifierType and identifierValue are required' });
    }

    const identifier = await prisma.employeeIdentifier.create({
      data: {
        employeeId: parseInt(id),
        identifierType,
        identifierValue,
        companyId: companyId ? parseInt(companyId) : null
      },
      include: {
        company: true
      }
    });

    res.status(201).json({ message: 'Identifier added successfully', identifier });
  } catch (error) {
    console.error('Add identifier error:', error);
    res.status(500).json({ error: 'Failed to add identifier' });
  }
};

const updateIdentifier = async (req, res) => {
  try {
    const { identifierId } = req.params;
    const { identifierType, identifierValue, companyId } = req.body;

    const identifier = await prisma.employeeIdentifier.update({
      where: { id: parseInt(identifierId) },
      data: {
        ...(identifierType && { identifierType }),
        ...(identifierValue && { identifierValue }),
        ...(companyId !== undefined && { companyId: companyId ? parseInt(companyId) : null })
      },
      include: { company: true }
    });

    res.json({ message: 'Identifier updated successfully', identifier });
  } catch (error) {
    console.error('Update identifier error:', error);
    res.status(500).json({ error: 'Failed to update identifier' });
  }
};

const deleteIdentifier = async (req, res) => {
  try {
    const { identifierId } = req.params;

    await prisma.employeeIdentifier.delete({
      where: { id: parseInt(identifierId) }
    });

    res.json({ message: 'Identifier deleted successfully' });
  } catch (error) {
    console.error('Delete identifier error:', error);
    res.status(500).json({ error: 'Failed to delete identifier' });
  }
};

const assignRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleId, companyId } = req.body;

    if (!roleId || !companyId) {
      return res.status(400).json({ error: 'roleId and companyId are required' });
    }

    const employeeRole = await prisma.employeeRole.create({
      data: {
        employeeId: parseInt(id),
        roleId: parseInt(roleId),
        companyId: parseInt(companyId),
        isActive: true
      },
      include: {
        role: true,
        company: true
      }
    });

    res.status(201).json({ message: 'Role assigned successfully', employeeRole });
  } catch (error) {
    console.error('Assign role error:', error);
    res.status(500).json({ error: 'Failed to assign role' });
  }
};

const getDeWorkEmail = async (req, res) => {
  try {
    const { id } = req.params;

    // Check for cached de_work_email identifier
    const existing = await prisma.employeeIdentifier.findFirst({
      where: { employeeId: parseInt(id), identifierType: 'de_work_email' }
    });

    if (existing) {
      return res.json({ email: existing.identifierValue });
    }

    // Look up de_worker_id for this employee
    const workerIdIdentifier = await prisma.employeeIdentifier.findFirst({
      where: { employeeId: parseInt(id), identifierType: 'de_worker_id' }
    });

    if (!workerIdIdentifier) {
      return res.json({ email: null });
    }

    // Fetch work email from TSDATA API
    try {
      const tsDataService = require('../services/tsDataService');
      const data = await tsDataService.getWorker(workerIdIdentifier.identifierValue);
      const email = data?.worker?.work_email_address || null;

      if (email) {
        // Cache as identifier for future calls
        await prisma.employeeIdentifier.create({
          data: {
            employeeId: parseInt(id),
            identifierType: 'de_work_email',
            identifierValue: email,
            companyId: null
          }
        });
      }

      return res.json({ email });
    } catch (tsError) {
      console.warn(`[Employee] Could not fetch DE work email for employee ${id}:`, tsError.message);
      return res.json({ email: null });
    }
  } catch (error) {
    console.error('Get DE work email error:', error);
    return res.json({ email: null });
  }
};

module.exports = {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  addEmployeeIdentifier,
  updateIdentifier,
  deleteIdentifier,
  assignRole,
  getDeWorkEmail
};
