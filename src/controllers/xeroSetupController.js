const { PrismaClient } = require('@prisma/client');
const xeroPayrollService = require('../services/xeroPayrollService');

const prisma = new PrismaClient();

/**
 * Parse a Xero date value which may be in /Date(timestamp+offset)/ format.
 * The xero-node SDK inconsistently leaves some date fields as raw strings.
 * Returns an ISO date string (YYYY-MM-DD) for safe frontend consumption, or null.
 */
function parseXeroDate(d) {
  if (!d) return null;
  if (d instanceof Date) return isNaN(d) ? null : d;
  if (typeof d === 'string') {
    const match = /\/Date\((-?\d+)/.exec(d);
    if (match) return new Date(parseInt(match[1], 10));
    const parsed = new Date(d);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

function toIsoDate(d) {
  const parsed = parseXeroDate(d);
  if (!parsed) return null;
  return parsed.toISOString();
}

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
    const { employeeId, employeeType, autoApprove, syncEnabled, isSalaried } = req.body;

    if (!employeeId) {
      return res.status(400).json({ error: 'employeeId is required' });
    }

    const settings = await prisma.employeeXeroSettings.upsert({
      where: { employeeId: parseInt(employeeId) },
      update: {
        employeeType: employeeType || 'ST',
        autoApprove: autoApprove === true,
        syncEnabled: syncEnabled !== false,
        isSalaried: isSalaried === true
      },
      create: {
        employeeId: parseInt(employeeId),
        employeeType: employeeType || 'ST',
        autoApprove: autoApprove === true,
        syncEnabled: syncEnabled !== false,
        isSalaried: isSalaried === true
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
    const [employeeMappings, earningsRateMappings, companyMappings, employeeSettings, employeeEarningsRates, leaveTypeMappings] = await Promise.all([
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
      }),
      prisma.employeeRoleEarningsRate.findMany({
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          role: {
            select: {
              id: true,
              name: true,
              companyId: true
            }
          }
        }
      }),
      prisma.xeroLeaveTypeMapping.findMany({
        orderBy: {
          leaveType: 'asc'
        }
      })
    ]);

    res.json({
      employees: employeeMappings,
      earningsRates: earningsRateMappings,
      companies: companyMappings,
      settings: employeeSettings,
      employeeEarningsRates: employeeEarningsRates,
      leaveTypes: leaveTypeMappings
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

/**
 * POST /api/xero/setup/employee-earnings-rate
 * Set employee-specific earnings rate override
 */
exports.setEmployeeEarningsRate = async (req, res) => {
  try {
    const { employeeId, roleId, xeroTenantId, xeroEarningsRateId, earningsRateName } = req.body;

    if (!employeeId || !roleId || !xeroTenantId || !xeroEarningsRateId || !earningsRateName) {
      return res.status(400).json({
        error: 'employeeId, roleId, xeroTenantId, xeroEarningsRateId, and earningsRateName are required'
      });
    }

    const mapping = await prisma.employeeRoleEarningsRate.upsert({
      where: {
        employeeId_roleId_xeroTenantId: {
          employeeId: parseInt(employeeId),
          roleId: parseInt(roleId),
          xeroTenantId
        }
      },
      update: {
        xeroEarningsRateId,
        earningsRateName
      },
      create: {
        employeeId: parseInt(employeeId),
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
    console.error('[XeroSetup] Error setting employee earnings rate:', error);
    res.status(500).json({
      error: 'Failed to set employee earnings rate',
      message: error.message
    });
  }
};

/**
 * DELETE /api/xero/setup/employee-earnings-rate/:id
 * Remove employee-specific earnings rate override (revert to role default)
 */
exports.deleteEmployeeEarningsRate = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.employeeRoleEarningsRate.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      success: true,
      message: 'Employee earnings rate override removed'
    });
  } catch (error) {
    console.error('[XeroSetup] Error deleting employee earnings rate:', error);
    res.status(500).json({
      error: 'Failed to delete employee earnings rate',
      message: error.message
    });
  }
};

/**
 * GET /api/xero/setup/leave-types/:tenantId
 * Get Xero leave types for a tenant
 */
exports.getXeroLeaveTypes = async (req, res) => {
  try {
    const { tenantId } = req.params;

    const leaveTypes = await xeroPayrollService.getLeaveTypes(tenantId);

    res.json(leaveTypes);
  } catch (error) {
    console.error('[XeroSetup] Error fetching leave types:', error);
    res.status(500).json({ error: 'Failed to fetch Xero leave types' });
  }
};

/**
 * POST /api/xero/setup/leave-type-mapping
 * Map leave type to Xero leave type
 */
/**
 * GET /api/xero/setup/payroll-calendars/:tenantId
 * Get payroll calendars with current/upcoming pay run info
 */
exports.getPayrollCalendars = async (req, res) => {
  try {
    const { tenantId } = req.params;

    const [calendars, payruns] = await Promise.all([
      xeroPayrollService.getPayrollCalendars(tenantId),
      xeroPayrollService.getPayruns(tenantId)
    ]);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Enrich each calendar with its current/most-recent pay run info
    const enriched = calendars.map(cal => {
      // Find pay runs for this calendar, sorted by period start descending
      const calPayruns = payruns
        .filter(pr => pr.payrollCalendarID === cal.payrollCalendarID)
        .sort((a, b) => {
          const aDate = parseXeroDate(a.payRunPeriodStartDate);
          const bDate = parseXeroDate(b.payRunPeriodStartDate);
          return (bDate || 0) - (aDate || 0);
        });

      // Find the pay run that strictly covers today
      const actualCurrentPayrun = calPayruns.find(pr => {
        const s = parseXeroDate(pr.payRunPeriodStartDate);
        const e = parseXeroDate(pr.payRunPeriodEndDate);
        if (!s || !e) return false;
        s.setUTCHours(0, 0, 0, 0);
        e.setUTCHours(0, 0, 0, 0);
        return s <= today && today <= e;
      }) || null;

      // For display: use the current-period run if it exists, otherwise the most recent
      const displayPayrun = actualCurrentPayrun || calPayruns[0] || null;

      const mapPayRun = (pr) => ({
        payRunID: pr.payRunID,
        payPeriodStartDate: toIsoDate(pr.payRunPeriodStartDate),
        payPeriodEndDate: toIsoDate(pr.payRunPeriodEndDate),
        paymentDate: toIsoDate(pr.paymentDate),
        payRunStatus: pr.payRunStatus
      });

      return {
        payrollCalendarID: cal.payrollCalendarID,
        name: cal.name,
        calendarType: cal.calendarType,
        startDate: toIsoDate(cal.startDate),
        paymentDate: toIsoDate(cal.paymentDate),
        // currentPayRun: best run to display (today's period or most recent)
        currentPayRun: displayPayrun ? mapPayRun(displayPayrun) : null,
        // hasCurrentPeriod: true only when a pay run actually covers today
        hasCurrentPeriod: actualCurrentPayrun !== null,
        recentPayRuns: calPayruns.slice(0, 5).map(mapPayRun)
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('[XeroSetup] Error fetching payroll calendars:', error);
    res.status(500).json({ error: 'Failed to fetch payroll calendars', message: error.message });
  }
};

/**
 * POST /api/xero/setup/payrun/create
 * Create the next pay run for a payroll calendar
 */
exports.createPayRun = async (req, res) => {
  try {
    const { tenantId, payrollCalendarID } = req.body;

    if (!tenantId || !payrollCalendarID) {
      return res.status(400).json({ error: 'tenantId and payrollCalendarID are required' });
    }

    const payRun = await xeroPayrollService.createPayrun(tenantId, { payrollCalendarID });

    if (!payRun) {
      return res.status(500).json({ error: 'Failed to create pay run' });
    }

    res.json({
      success: true,
      payRun: {
        payRunID: payRun.payRunID,
        payPeriodStartDate: toIsoDate(payRun.payRunPeriodStartDate),
        payPeriodEndDate: toIsoDate(payRun.payRunPeriodEndDate),
        paymentDate: toIsoDate(payRun.paymentDate),
        payRunStatus: payRun.payRunStatus
      }
    });
  } catch (error) {
    console.error('[XeroSetup] Error creating pay run:', error);
    res.status(500).json({ error: 'Failed to create pay run', message: error.message });
  }
};

exports.mapLeaveType = async (req, res) => {
  try {
    const { xeroTenantId, leaveType, xeroLeaveTypeId, leaveTypeName } = req.body;

    const mapping = await prisma.xeroLeaveTypeMapping.upsert({
      where: {
        xeroTenantId_leaveType: {
          xeroTenantId,
          leaveType
        }
      },
      update: {
        xeroLeaveTypeId,
        leaveTypeName
      },
      create: {
        xeroTenantId,
        leaveType,
        xeroLeaveTypeId,
        leaveTypeName
      }
    });

    res.json(mapping);
  } catch (error) {
    console.error('[XeroSetup] Error mapping leave type:', error);
    res.status(500).json({ error: 'Failed to map leave type' });
  }
};
