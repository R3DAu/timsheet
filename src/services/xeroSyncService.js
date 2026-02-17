const prisma = require('../config/database');
const xeroPayrollService = require('./xeroPayrollService');

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

      // 3. Get Xero employee ID
      const xeroEmployeeId = fullTimesheet.employee.identifiers.find(
        i => i.identifierType === 'xero_employee_id'
      );

      if (!xeroEmployeeId) {
        throw new Error('Employee not mapped to Xero employee ID');
      }

      // 4. Determine which Xero tenant to use (from first company mapping)
      const firstEntry = fullTimesheet.entries[0];
      if (!firstEntry) {
        throw new Error('No timesheet entries found');
      }

      const companyMapping = firstEntry.company.xeroMappings?.[0];
      if (!companyMapping) {
        throw new Error('Company not mapped to Xero tenant');
      }

      const tenantId = companyMapping.xeroTenantId;

      // 5. Group entries by earnings rate and sum hours
      const entriesByRate = this.groupEntriesByEarningsRate(fullTimesheet.entries, tenantId);

      if (Object.keys(entriesByRate).length === 0) {
        throw new Error('No earnings rate mappings found for timesheet entries');
      }

      // 6. Build Xero timesheet data
      const timesheetLines = Object.entries(entriesByRate).map(([earningsRateId, data]) => ({
        EarningsRateID: earningsRateId,
        NumberOfUnits: [data.totalHours]
      }));

      const xeroTimesheetData = {
        EmployeeID: xeroEmployeeId.identifierValue,
        StartDate: this.formatXeroDate(fullTimesheet.weekStarting),
        EndDate: this.formatXeroDate(fullTimesheet.weekEnding),
        Status: 'DRAFT',
        TimesheetLines: timesheetLines
      };

      // 7. Create timesheet in Xero
      console.log(`[XeroSync] Syncing timesheet ${fullTimesheet.id} to Xero tenant ${tenantId}`);

      const xeroTimesheet = await xeroPayrollService.createTimesheet(tenantId, xeroTimesheetData);

      if (!xeroTimesheet || !xeroTimesheet.TimesheetID) {
        throw new Error('Failed to create Xero timesheet - no ID returned');
      }

      // 8. Update local timesheet with Xero ID
      await prisma.timesheet.update({
        where: { id: fullTimesheet.id },
        data: {
          xeroTimesheetId: xeroTimesheet.TimesheetID,
          xeroSyncedAt: new Date()
        }
      });

      // 9. Ensure payrun exists for this week
      await this.ensurePayrun(tenantId, fullTimesheet.weekStarting, fullTimesheet.weekEnding);

      // 10. Handle Local Technician invoicing (if applicable)
      const employeeType = fullTimesheet.employee.xeroSettings?.employeeType || 'ST';
      if (employeeType === 'LT') {
        await this.processLocalTechInvoice(fullTimesheet, companyMapping);
      }

      // 11. Update sync log
      await prisma.xeroSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'SUCCESS',
          xeroTimesheetId: xeroTimesheet.TimesheetID,
          xeroTokenId: companyMapping.xeroTokenId,
          recordsProcessed: fullTimesheet.entries.length,
          recordsSuccess: fullTimesheet.entries.length,
          completedAt: new Date(),
          syncDetails: JSON.stringify({
            tenantId,
            timesheetLines: timesheetLines.length,
            totalHours: Object.values(entriesByRate).reduce((sum, data) => sum + data.totalHours, 0)
          })
        }
      });

      console.log(`[XeroSync] Successfully synced timesheet ${fullTimesheet.id} to Xero (ID: ${xeroTimesheet.TimesheetID})`);

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

      // Don't throw - we don't want to block timesheet approval
      return null;
    }
  }

  /**
   * Group timesheet entries by Xero earnings rate and sum hours
   */
  groupEntriesByEarningsRate(entries, tenantId) {
    const grouped = {};

    for (const entry of entries) {
      // Find Xero earnings rate mapping for this role
      const mapping = entry.role.xeroEarningsRateMaps?.find(
        m => m.xeroTenantId === tenantId
      );

      if (!mapping) {
        console.warn(`[XeroSync] No earnings rate mapping for role ${entry.role.id} in tenant ${tenantId}`);
        continue;
      }

      const rateId = mapping.xeroEarningsRateId;

      if (!grouped[rateId]) {
        grouped[rateId] = {
          totalHours: 0,
          earningsRateName: mapping.earningsRateName,
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
        const prStart = new Date(pr.PaymentDate);
        const prEnd = new Date(pr.PayPeriodEndDate);
        return prStart.getTime() === weekStart.getTime() && prEnd.getTime() === weekEnd.getTime();
      });

      if (matchingPayrun) {
        // Store in our DB
        const payrun = await prisma.xeroPayrun.create({
          data: {
            xeroTenantId: tenantId,
            xeroPayrunId: matchingPayrun.PayRunID,
            periodStart: new Date(matchingPayrun.PayPeriodStartDate),
            periodEnd: new Date(matchingPayrun.PayPeriodEndDate),
            paymentDate: new Date(matchingPayrun.PaymentDate),
            status: matchingPayrun.PayRunStatus
          }
        });

        console.log(`[XeroSync] Found existing Xero payrun: ${matchingPayrun.PayRunID}`);
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
   * Process Local Technician invoice (Phase 4 feature)
   */
  async processLocalTechInvoice(timesheet, companyMapping) {
    // TODO: Phase 4 - Implement invoice management
    console.log('[XeroSync] LT invoice processing not yet implemented (Phase 4)');
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
