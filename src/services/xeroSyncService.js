const { PrismaClient } = require('@prisma/client');
const xeroPayrollService = require('./xeroPayrollService');

const prisma = new PrismaClient();

/**
 * Xero Sync Service
 * Orchestrates timesheet syncing to Xero Payroll
 */
class XeroSyncService {
  constructor() {
    this.enabled = process.env.XERO_SYNC_ENABLED === 'true';
  }

  /**
   * Process an approved timesheet and sync to Xero
   * Called from timesheetController after approval
   */
  async processApprovedTimesheet(timesheet) {
    if (!this.enabled) {
      console.log('[XeroSync] Xero sync is disabled');
      return null;
    }

    const syncLog = await prisma.xeroSyncLog.create({
      data: {
        syncType: 'TIMESHEET_SYNC',
        status: 'PENDING',
        timesheetId: timesheet.id
      }
    });

    try {
      // 1. Load full timesheet with relations
      const fullTimesheet = await prisma.timesheet.findUnique({
        where: { id: timesheet.id },
        include: {
          employee: {
            include: {
              identifiers: true,
              xeroSettings: true,
              customEarningsRates: true, // Employee-specific earnings rate overrides
              roles: {
                include: {
                  role: {
                    include: {
                      xeroEarningsRateMaps: true,
                      company: {
                        include: {
                          xeroMappings: true
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          entries: {
            include: {
              role: {
                include: {
                  xeroEarningsRateMaps: true,
                  company: {
                    include: {
                      xeroMappings: true
                    }
                  }
                }
              },
              company: {
                include: {
                  xeroMappings: true
                }
              }
            }
          }
        }
      });

      // 2. Check if employee has Xero sync enabled
      if (!fullTimesheet.employee.xeroSettings?.syncEnabled) {
        console.log(`[XeroSync] Sync disabled for employee ${fullTimesheet.employee.id}`);
        await prisma.xeroSyncLog.update({
          where: { id: syncLog.id },
          data: {
            status: 'SUCCESS',
            completedAt: new Date(),
            syncDetails: JSON.stringify({ message: 'Sync disabled for employee' })
          }
        });
        return null;
      }

      // 2b. Check if employee is salaried (skip timesheet sync)
      if (fullTimesheet.employee.xeroSettings?.isSalaried) {
        console.log(`[XeroSync] Skipping timesheet sync for salaried employee ${fullTimesheet.employee.id}`);
        await prisma.xeroSyncLog.update({
          where: { id: syncLog.id },
          data: {
            status: 'SUCCESS',
            completedAt: new Date(),
            syncDetails: JSON.stringify({ message: 'Employee is salaried - timesheet sync skipped' })
          }
        });
        return null;
      }

      // 3. Determine which Xero tenant to use (from first company mapping)
      const firstEntry = fullTimesheet.entries[0];
      if (!firstEntry) {
        throw new Error('No timesheet entries found');
      }

      const companyMapping = firstEntry.company.xeroMappings?.[0];
      if (!companyMapping) {
        throw new Error('Company not mapped to Xero tenant');
      }

      const tenantId = companyMapping.xeroTenantId;
      const employeeType = fullTimesheet.employee.xeroSettings?.employeeType || 'ST';

      // 4. Payroll timesheet sync (ST and LT both need this to get paid)
      let xeroTimesheet = null;
      try {
        // Get Xero employee ID
        const xeroEmployeeId = fullTimesheet.employee.identifiers.find(
          i => i.identifierType === 'xero_employee_id'
        );

        if (!xeroEmployeeId) {
          throw new Error('Employee not mapped to Xero employee ID');
        }

        // Group entries by earnings rate and sum hours per day
        const entriesByRate = this.groupEntriesByEarningsRate(
          fullTimesheet.entries,
          tenantId,
          fullTimesheet.employee
        );

        if (Object.keys(entriesByRate).length === 0) {
          throw new Error('No earnings rate mappings found for timesheet entries');
        }

        const timesheetLines = Object.entries(entriesByRate).map(([earningsRateId, data]) => ({
          earningsRateID: earningsRateId,
          numberOfUnits: this.buildNumberOfUnits(data.entries, fullTimesheet.weekStarting)
        }));

        const xeroTimesheetData = {
          employeeID: xeroEmployeeId.identifierValue,
          startDate: this.formatXeroDate(fullTimesheet.weekStarting),
          endDate: this.formatXeroDate(fullTimesheet.weekEnding),
          status: 'DRAFT',
          timesheetLines
        };

        console.log(`[XeroSync] Syncing timesheet ${fullTimesheet.id} to Xero tenant ${tenantId}`);
        xeroTimesheet = await xeroPayrollService.createTimesheet(tenantId, xeroTimesheetData);

        if (!xeroTimesheet || !xeroTimesheet.timesheetID) {
          throw new Error('Failed to create Xero timesheet - no ID returned');
        }

        await prisma.timesheet.update({
          where: { id: fullTimesheet.id },
          data: {
            xeroTimesheetId: xeroTimesheet.timesheetID,
            xeroSyncedAt: new Date()
          }
        });

        await this.ensurePayrun(tenantId, fullTimesheet.weekStarting, fullTimesheet.weekEnding);

        await prisma.xeroSyncLog.update({
          where: { id: syncLog.id },
          data: {
            status: 'SUCCESS',
            xeroTimesheetId: xeroTimesheet.timesheetID,
            xeroTokenId: companyMapping.xeroTokenId,
            recordsProcessed: fullTimesheet.entries.length,
            recordsSuccess: fullTimesheet.entries.length,
            completedAt: new Date(),
            syncDetails: JSON.stringify({
              employeeType,
              tenantId,
              timesheetLines: timesheetLines.length,
              totalHours: Object.values(entriesByRate).reduce((sum, data) => sum + data.totalHours, 0)
            })
          }
        });

        console.log(`[XeroSync] Successfully synced timesheet ${fullTimesheet.id} to Xero (ID: ${xeroTimesheet.timesheetID})`);
      } catch (payrollError) {
        console.error(`[XeroSync] Payroll sync failed for timesheet ${timesheet.id}:`, payrollError);

        await prisma.xeroSyncLog.update({
          where: { id: syncLog.id },
          data: {
            status: 'ERROR',
            errorMessage: payrollError.message,
            completedAt: new Date()
          }
        });

        // For ST: stop here. For LT: fall through to invoice processing.
        if (employeeType !== 'LT') return null;
      }

      // 5. LT only: create/update monthly invoice regardless of payroll sync outcome
      if (employeeType === 'LT') {
        await this.processLocalTechInvoice(fullTimesheet, companyMapping);
      }

      return xeroTimesheet;
    } catch (error) {
      console.error(`[XeroSync] Error syncing timesheet ${timesheet.id}:`, error);

      await prisma.xeroSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'ERROR',
          errorMessage: error.message,
          completedAt: new Date()
        }
      });

      return null;
    }
  }

  /**
   * Group timesheet entries by Xero earnings rate and sum hours
   * Checks for employee-specific overrides first, then falls back to role default
   */
  groupEntriesByEarningsRate(entries, tenantId, employee) {
    const grouped = {};

    for (const entry of entries) {
      // First check for employee-specific earnings rate override
      const customRate = employee.customEarningsRates?.find(
        r => r.roleId === entry.role.id && r.xeroTenantId === tenantId
      );

      let rateId, rateName;

      if (customRate) {
        // Use employee-specific rate
        rateId = customRate.xeroEarningsRateId;
        rateName = customRate.earningsRateName;
        console.log(`[XeroSync] Using custom earnings rate for employee ${employee.id}, role ${entry.role.id}: ${rateName}`);
      } else {
        // Fall back to role default
        const roleMapping = entry.role.xeroEarningsRateMaps?.find(
          m => m.xeroTenantId === tenantId
        );

        if (!roleMapping) {
          console.warn(`[XeroSync] No earnings rate mapping for role ${entry.role.id} in tenant ${tenantId}`);
          continue;
        }

        rateId = roleMapping.xeroEarningsRateId;
        rateName = roleMapping.earningsRateName;
      }

      if (!grouped[rateId]) {
        grouped[rateId] = {
          totalHours: 0,
          earningsRateName: rateName,
          entries: []
        };
      }

      grouped[rateId].totalHours += entry.hours;
      grouped[rateId].entries.push(entry);
    }

    return grouped;
  }

  /**
   * Ensure a payrun exists for the given week
   */
  async ensurePayrun(tenantId, weekStart, weekEnd) {
    try {
      // Check if payrun already exists in our DB
      const existingPayrun = await prisma.xeroPayrun.findFirst({
        where: {
          xeroTenantId: tenantId,
          periodStart: weekStart,
          periodEnd: weekEnd
        }
      });

      if (existingPayrun) {
        console.log(`[XeroSync] Payrun already exists for week ${weekStart.toISOString()}`);
        return existingPayrun;
      }

      // Get payroll calendars from Xero
      const calendars = await xeroPayrollService.getPayrollCalendars(tenantId);

      if (!calendars || calendars.length === 0) {
        console.warn('[XeroSync] No payroll calendars found in Xero');
        return null;
      }

      // Use the first active calendar
      const calendar = calendars[0];

      // Check if payrun exists in Xero
      const xeroPayruns = await xeroPayrollService.getPayruns(tenantId);
      const matchingPayrun = xeroPayruns.find(pr => {
        const prStart = new Date(pr.paymentDate);
        const prEnd = new Date(pr.payPeriodEndDate);
        return prStart.getTime() === weekStart.getTime() && prEnd.getTime() === weekEnd.getTime();
      });

      if (matchingPayrun) {
        // Store in our DB
        const payrun = await prisma.xeroPayrun.create({
          data: {
            xeroTenantId: tenantId,
            xeroPayrunId: matchingPayrun.payRunID,
            periodStart: new Date(matchingPayrun.payPeriodStartDate),
            periodEnd: new Date(matchingPayrun.payPeriodEndDate),
            paymentDate: new Date(matchingPayrun.paymentDate),
            status: matchingPayrun.payRunStatus
          }
        });

        console.log(`[XeroSync] Found existing Xero payrun: ${matchingPayrun.payRunID}`);
        return payrun;
      }

      console.log(`[XeroSync] No payrun found for week ${weekStart.toISOString()} - payruns should be created in Xero manually`);
      return null;
    } catch (error) {
      console.error('[XeroSync] Error ensuring payrun:', error);
      return null;
    }
  }

  /**
   * Process Local Technician invoice
   * Called for LT employees after timesheet sync
   */
  async processLocalTechInvoice(timesheet, companyMapping) {
    // Guard clauses: skip if missing required invoice fields
    if (!companyMapping.invoiceRate || !companyMapping.xeroContactId) {
      console.log(`[XeroSync] Skipping LT invoice for timesheet ${timesheet.id}: missing invoiceRate or xeroContactId on company mapping`);
      return;
    }

    const weekStart = new Date(timesheet.weekStarting);
    const invoiceMonth = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
    const tenantId = companyMapping.xeroTenantId;
    const employeeId = timesheet.employee.id;
    const companyId = companyMapping.companyId;
    const { firstName, lastName } = timesheet.employee;

    // Calculate total hours for this timesheet
    const timesheetHours = timesheet.entries.reduce((sum, e) => sum + e.hours, 0);

    const monthName = invoiceMonth.toLocaleString('en-AU', { month: 'long', year: 'numeric' });

    // Find existing invoice for this employee+company+month
    const existingInvoice = await prisma.xeroInvoice.findUnique({
      where: {
        employeeId_companyId_invoiceMonth: {
          employeeId,
          companyId,
          invoiceMonth
        }
      },
      include: { entries: true }
    });

    if (existingInvoice) {
      const existingEntry = existingInvoice.entries.find(e => e.timesheetId === timesheet.id);

      if (existingEntry) {
        // Timesheet already linked — check if hours changed (re-approval after unlock)
        if (existingEntry.hours === timesheetHours) {
          console.log(`[XeroSync] Timesheet ${timesheet.id} already linked to invoice ${existingInvoice.id} with same hours — skipping`);
          return;
        }

        // Hours changed: update the entry and recalculate the invoice total
        const hoursDiff = timesheetHours - existingEntry.hours;
        const newTotalHours = existingInvoice.totalHours + hoursDiff;
        const newTotalAmount = newTotalHours * companyMapping.invoiceRate;

        await prisma.xeroInvoiceEntry.update({
          where: { id: existingEntry.id },
          data: { hours: timesheetHours }
        });

        await prisma.xeroInvoice.update({
          where: { id: existingInvoice.id },
          data: { totalHours: newTotalHours, totalAmount: newTotalAmount }
        });

        if (existingInvoice.xeroInvoiceId) {
          await xeroPayrollService.updateInvoice(tenantId, existingInvoice.xeroInvoiceId, {
            lineItems: [{
              description: `Local Tech Services - ${firstName} ${lastName} - ${monthName}`,
              quantity: newTotalHours,
              unitAmount: companyMapping.invoiceRate,
              accountCode: '200'
            }]
          });
        }

        console.log(`[XeroSync] Re-approval: updated invoice ${existingInvoice.id} timesheet ${timesheet.id} hours ${existingEntry.hours} → ${timesheetHours}`);
        return;
      }

      // New timesheet for an existing invoice month — add an entry
      await prisma.xeroInvoiceEntry.create({
        data: {
          invoiceId: existingInvoice.id,
          timesheetId: timesheet.id,
          hours: timesheetHours,
          description: `Week of ${this.formatXeroDate(timesheet.weekStarting)}`
        }
      });

      // Recalculate cumulative totals
      const newTotalHours = existingInvoice.totalHours + timesheetHours;
      const newTotalAmount = newTotalHours * companyMapping.invoiceRate;

      await prisma.xeroInvoice.update({
        where: { id: existingInvoice.id },
        data: { totalHours: newTotalHours, totalAmount: newTotalAmount }
      });

      // If already pushed to Xero, update the line item in-place
      if (existingInvoice.xeroInvoiceId) {
        await xeroPayrollService.updateInvoice(tenantId, existingInvoice.xeroInvoiceId, {
          lineItems: [{
            description: `Local Tech Services - ${firstName} ${lastName} - ${monthName}`,
            quantity: newTotalHours,
            unitAmount: companyMapping.invoiceRate,
            accountCode: '200'
          }]
        });
      }

      console.log(`[XeroSync] Updated invoice ${existingInvoice.id} with timesheet ${timesheet.id}: total hours now ${newTotalHours}`);
    } else {
      // No invoice yet — create in Xero first, then store locally
      const lastDayOfMonth = new Date(invoiceMonth.getFullYear(), invoiceMonth.getMonth() + 1, 0);

      const invoiceData = {
        type: 'ACCREC',
        contact: { contactID: companyMapping.xeroContactId },
        lineItems: [{
          description: `Local Tech Services - ${firstName} ${lastName} - ${monthName}`,
          quantity: timesheetHours,
          unitAmount: companyMapping.invoiceRate,
          accountCode: '200'
        }],
        date: this.formatXeroDate(invoiceMonth),
        dueDate: this.formatXeroDate(lastDayOfMonth),
        status: 'DRAFT'
      };

      const xeroInvoice = await xeroPayrollService.createInvoice(tenantId, invoiceData);

      // Store XeroInvoice + XeroInvoiceEntry atomically
      const newInvoice = await prisma.$transaction(async (tx) => {
        const invoice = await tx.xeroInvoice.create({
          data: {
            employeeId,
            companyId,
            xeroTenantId: tenantId,
            xeroInvoiceId: xeroInvoice?.invoiceID || null,
            invoiceMonth,
            totalHours: timesheetHours,
            hourlyRate: companyMapping.invoiceRate,
            totalAmount: timesheetHours * companyMapping.invoiceRate,
            status: 'DRAFT'
          }
        });

        await tx.xeroInvoiceEntry.create({
          data: {
            invoiceId: invoice.id,
            timesheetId: timesheet.id,
            hours: timesheetHours,
            description: `Week of ${this.formatXeroDate(timesheet.weekStarting)}`
          }
        });

        return invoice;
      });

      // Log the operation
      await prisma.xeroSyncLog.create({
        data: {
          xeroTokenId: companyMapping.xeroTokenId,
          syncType: 'INVOICE_CREATE',
          status: 'SUCCESS',
          timesheetId: timesheet.id,
          xeroInvoiceId: xeroInvoice?.invoiceID || null,
          recordsProcessed: 1,
          recordsSuccess: 1,
          completedAt: new Date(),
          syncDetails: JSON.stringify({
            invoiceId: newInvoice.id,
            monthName,
            hours: timesheetHours,
            amount: timesheetHours * companyMapping.invoiceRate
          })
        }
      });

      console.log(`[XeroSync] Created Xero DRAFT invoice for ${firstName} ${lastName} - ${monthName} (Xero ID: ${xeroInvoice?.invoiceID})`);
    }
  }

  /**
   * Build NumberOfUnits array for Xero (7 days: Sun-Sat)
   * @param {Array} entries - Timesheet entries for this earnings rate
   * @param {Date} weekStarting - Start date of the week
   * @returns {Array} Array of 7 numbers (hours per day, Sun-Sat)
   */
  buildNumberOfUnits(entries, weekStarting) {
    // Initialize array with 7 zeros (Sun-Sat)
    const hoursPerDay = [0, 0, 0, 0, 0, 0, 0];

    // Group entries by date and sum hours
    const entriesByDate = {};
    for (const entry of entries) {
      const dateKey = new Date(entry.date).toISOString().split('T')[0];
      if (!entriesByDate[dateKey]) {
        entriesByDate[dateKey] = 0;
      }
      entriesByDate[dateKey] += entry.hours;
    }

    // Distribute hours to correct day index (0=Sun, 6=Sat)
    for (const [dateStr, hours] of Object.entries(entriesByDate)) {
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      hoursPerDay[dayOfWeek] += hours;
    }

    return hoursPerDay;
  }

  /**
   * Format date for Xero API (YYYY-MM-DD)
   */
  formatXeroDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Manual sync for a specific timesheet
   */
  async manualSync(timesheetId) {
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: timesheetId }
    });

    if (!timesheet) {
      throw new Error('Timesheet not found');
    }

    if (timesheet.status !== 'APPROVED') {
      throw new Error('Only approved timesheets can be synced');
    }

    return await this.processApprovedTimesheet(timesheet);
  }
}

module.exports = new XeroSyncService();
