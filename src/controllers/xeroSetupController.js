const { PrismaClient } = require('@prisma/client');
const xeroPayrollService = require('../services/xeroPayrollService');

const prisma = new PrismaClient();

/**
 * Xero Setup Controller
 * Handles employee/role mapping and configuration
 */

/**
 * GET /api/xero/setup/employees/:tenantId
 * Get Xero employees for mapping
 */
exports.getXeroEmployees = async (req, res) => {
  try {
    const { tenantId } = req.params;

    const employees = await xeroPayrollService.getEmployees(tenantId);

    res.json(employees);
  } catch (error) {
    console.error('[XeroSetup] Error fetching Xero employees:', error);
    res.status(500).json({
      error: 'Failed to fetch Xero employees',
      message: error.message
    });
  }
};

/**
 * POST /api/xero/setup/employees/map
 * Map local employee to Xero employee
 */
exports.mapEmployee = async (req, res) => {
  try {
    const { employeeId, xeroEmployeeId, companyId } = req.body;

    if (!employeeId || !xeroEmployeeId) {
      return res.status(400).json({
        error: 'employeeId and xeroEmployeeId are required'
      });
    }

    // For xero_employee_id, we don't use companyId (it's a global mapping)
    // Find existing mapping first
    const existing = await prisma.employeeIdentifier.findFirst({
      where: {
        employeeId: parseInt(employeeId),
        identifierType: 'xero_employee_id',
        companyId: null
      }
    });

    let mapping;
    if (existing) {
      // Update existing mapping
      mapping = await prisma.employeeIdentifier.update({
        where: { id: existing.id },
        data: {
          identifierValue: xeroEmployeeId
        }
      });
    } else {
      // Create new mapping
      mapping = await prisma.employeeIdentifier.create({
        data: {
          employeeId: parseInt(employeeId),
          identifierType: 'xero_employee_id',
          identifierValue: xeroEmployeeId,
          companyId: null
        }
      });
    }

    res.json({
      success: true,
      mapping
    });
  } catch (error) {
    console.error('[XeroSetup] Error mapping employee:', error);
    res.status(500).json({
      error: 'Failed to map employee',
      message: error.message
    });
  }
};

/**
 * GET /api/xero/setup/earnings-rates/:tenantId
 * Get Xero earnings rates for mapping
 */
exports.getEarningsRates = async (req, res) => {
  try {
    const { tenantId } = req.params;

    const rates = await xeroPayrollService.getEarningsRates(tenantId);

    res.json(rates);
  } catch (error) {
    console.error('[XeroSetup] Error fetching earnings rates:', error);
    res.status(500).json({
      error: 'Failed to fetch earnings rates',
      message: error.message
    });
  }
};

/**
 * POST /api/xero/setup/earnings-rates/map
 * Map local role to Xero earnings rate
 */
exports.mapEarningsRate = async (req, res) => {
  try {
    const { roleId, xeroTenantId, xeroEarningsRateId, earningsRateName } = req.body;

    if (!roleId || !xeroTenantId || !xeroEarningsRateId || !earningsRateName) {
      return res.status(400).json({
        error: 'roleId, xeroTenantId, xeroEarningsRateId, and earningsRateName are required'
      });
    }

    const mapping = await prisma.xeroEarningsRateMapping.upsert({
      where: {
        roleId_xeroTenantId: {
          roleId: parseInt(roleId),
          xeroTenantId
        }
      },
      update: {
        xeroEarningsRateId,
        earningsRateName
      },
      create: {
        roleId: parseInt(roleId),
        xeroTenantId,
        xeroEarningsRateId,
        earningsRateName
      }
    });

    res.json({
      success: true,
      mapping
    });
  } catch (error) {
    console.error('[XeroSetup] Error mapping earnings rate:', error);
    res.status(500).json({
      error: 'Failed to map earnings rate',
      message: error.message
    });
  }
};

/**
 * POST /api/xero/setup/employee-settings
 * Update employee Xero settings
 */
exports.updateEmployeeSettings = async (req, res) => {
  try {
    const { employeeId, employeeType, autoApprove, syncEnabled } = req.body;

    if (!employeeId) {
      return res.status(400).json({ error: 'employeeId is required' });
    }

    const settings = await prisma.employeeXeroSettings.upsert({
      where: { employeeId: parseInt(employeeId) },
      update: {
        employeeType: employeeType || 'ST',
        autoApprove: autoApprove === true,
        syncEnabled: syncEnabled !== false
      },
      create: {
        employeeId: parseInt(employeeId),
        employeeType: employeeType || 'ST',
        autoApprove: autoApprove === true,
        syncEnabled: syncEnabled !== false
      }
    });

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('[XeroSetup] Error updating employee settings:', error);
    res.status(500).json({
      error: 'Failed to update employee settings',
      message: error.message
    });
  }
};

/**
 * POST /api/xero/setup/company-mapping
 * Map company to Xero tenant
 */
exports.mapCompany = async (req, res) => {
  try {
    const { companyId, xeroTokenId, xeroTenantId, xeroContactId, invoiceRate } = req.body;

    if (!companyId || !xeroTokenId || !xeroTenantId) {
      return res.status(400).json({
        error: 'companyId, xeroTokenId, and xeroTenantId are required'
      });
    }

    const mapping = await prisma.companyXeroMapping.upsert({
      where: {
        companyId_xeroTokenId: {
          companyId: parseInt(companyId),
          xeroTokenId: parseInt(xeroTokenId)
        }
      },
      update: {
        xeroTenantId,
        xeroContactId: xeroContactId || null,
        invoiceRate: invoiceRate ? parseFloat(invoiceRate) : null
      },
      create: {
        companyId: parseInt(companyId),
        xeroTokenId: parseInt(xeroTokenId),
        xeroTenantId,
        xeroContactId: xeroContactId || null,
        invoiceRate: invoiceRate ? parseFloat(invoiceRate) : null
      }
    });

    res.json({
      success: true,
      mapping
    });
  } catch (error) {
    console.error('[XeroSetup] Error mapping company:', error);
    res.status(500).json({
      error: 'Failed to map company',
      message: error.message
    });
  }
};

/**
 * GET /api/xero/setup/mappings
 * Get all current mappings
 */
exports.getMappings = async (req, res) => {
  try {
    const [employeeMappings, earningsRateMappings, companyMappings, employeeSettings] = await Promise.all([
      prisma.employeeIdentifier.findMany({
        where: { identifierType: 'xero_employee_id' },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      }),
      prisma.xeroEarningsRateMapping.findMany({
        include: {
          role: {
            select: {
              id: true,
              name: true,
              companyId: true
            }
          }
        }
      }),
      prisma.companyXeroMapping.findMany({
        include: {
          company: {
            select: {
              id: true,
              name: true
            }
          },
          xeroToken: {
            select: {
              id: true,
              tenantId: true,
              tenantName: true
            }
          }
        }
      }),
      prisma.employeeXeroSettings.findMany({
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      })
    ]);

    res.json({
      employees: employeeMappings,
      earningsRates: earningsRateMappings,
      companies: companyMappings,
      settings: employeeSettings
    });
  } catch (error) {
    console.error('[XeroSetup] Error fetching mappings:', error);
    res.status(500).json({
      error: 'Failed to fetch mappings',
      message: error.message
    });
  }
};

/**
 * GET /api/xero/setup/contacts/:tenantId
 * Get Xero contacts for invoicing
 */
exports.getXeroContacts = async (req, res) => {
  try {
    const { tenantId } = req.params;

    const contacts = await xeroPayrollService.getContacts(tenantId);

    res.json(contacts);
  } catch (error) {
    console.error('[XeroSetup] Error fetching Xero contacts:', error);
    res.status(500).json({
      error: 'Failed to fetch Xero contacts',
      message: error.message
    });
  }
};
