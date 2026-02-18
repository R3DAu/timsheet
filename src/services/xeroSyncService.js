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

        // Find the Xero pay period that covers this timesheet's start date.
        // Xero rejects timesheets whose startDate/endDate don't exactly match
        // a pay period (e.g. fortnightly calendars won't match our weekly dates).
        const payPeriod = await this.findPayPeriod(tenantId, fullTimesheet.weekStarting);
        if (!payPeriod) {
          throw new Error(
            `No Xero pay period found covering ${this.formatXeroDate(fullTimesheet.weekStarting)}. ` +
            `Ensure the payroll calendar in Xero includes this period.`
          );
        }

        // If the pay run is already POSTED, timesheets are locked in Xero
        if (payPeriod.payRunStatus === 'POSTED') {
          throw new Error(
            `Pay run for ${this.formatXeroDate(payPeriod.startDate)}–${this.formatXeroDate(payPeriod.endDate)} ` +
            `is already POSTED in Xero. Unlock the pay run in Xero before syncing.`
          );
        }

        const timesheetLines = Object.entries(entriesByRate).map(([earningsRateId, data]) => ({
          earningsRateID: earningsRateId,
          numberOfUnits: this.buildNumberOfUnits(data.entries, payPeriod.startDate, payPeriod.endDate)
        }));

        const xeroTimesheetData = {
          employeeID: xeroEmployeeId.identifierValue,
          startDate: this.formatXeroDate(payPeriod.startDate),
          endDate: this.formatXeroDate(payPeriod.endDate),
          status: 'DRAFT',
          timesheetLines
        };

        console.log(`[XeroSync] Syncing timesheet ${fullTimesheet.id} to Xero tenant ${tenantId}`);

        try {
          xeroTimesheet = await xeroPayrollService.createTimesheet(tenantId, xeroTimesheetData);
        } catch (createError) {
          // Xero returns 400 "already exists" when a timesheet for that employee/week
          // already exists in Xero but we don't have its ID stored locally.
          const message = createError.response?.body?.Message || createError.body?.Message || '';
          if (!message.toLowerCase().includes('already exists')) throw createError;

          console.log(`[XeroSync] Timesheet already exists in Xero — searching for existing to update...`);
          const existingList = await xeroPayrollService.getTimesheetsByEmployee(
            tenantId, xeroEmployeeId.identifierValue
          );
          // Match on the pay period start date (not our local week start)
          const periodStartStr = this.formatXeroDate(payPeriod.startDate);
          const found = existingList.find(t => {
            if (!t.startDate) return false;
            const tStart = this.parseXeroDate(t.startDate);
            return tStart ? this.formatXeroDate(tStart) === periodStartStr : false;
          });

          if (!found?.timesheetID) {
            throw new Error('Timesheet already exists in Xero but could not be located to update');
          }

          console.log(`[XeroSync] Found existing Xero timesheet ${found.timesheetID} — updating`);
          xeroTimesheet = await xeroPayrollService.updateTimesheet(tenantId, found.timesheetID, xeroTimesheetData);
          if (!xeroTimesheet) xeroTimesheet = { timesheetID: found.timesheetID };
        }

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

        await this.ensurePayrun(tenantId, payPeriod);

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
   * Ensure a pay run exists in Xero for the given pay period.
   * If the pay run is missing, attempts to create it via the payroll calendar.
   * Returns the pay run ID, or null if it could not be created.
   *
   * @param {string} tenantId
   * @param {Object} payPeriod - Result of findPayPeriod
   */
  async ensurePayrun(tenantId, payPeriod) {
    try {
      if (payPeriod.payRunId) {
        // Pay run already exists — cache it locally if we haven't already
        await prisma.xeroPayrun.upsert({
          where: { xeroPayrunId: payPeriod.payRunId },
          create: {
            xeroTenantId: tenantId,
            xeroPayrunId: payPeriod.payRunId,
            periodStart: payPeriod.startDate,
            periodEnd: payPeriod.endDate,
            paymentDate: payPeriod.startDate, // Approximate — actual date in Xero
            status: payPeriod.payRunStatus || 'DRAFT'
          },
          update: {
            status: payPeriod.payRunStatus || 'DRAFT'
          }
        });
        return payPeriod.payRunId;
      }

      // No pay run yet — try to create one using the payroll calendar
      if (!payPeriod.payrollCalendarId) {
        console.warn('[XeroSync] Cannot create pay run: no payroll calendar found');
        return null;
      }

      console.log(`[XeroSync] No pay run found for period ${this.formatXeroDate(payPeriod.startDate)} – creating via calendar ${payPeriod.calendarName || payPeriod.payrollCalendarId}`);

      const newPayRun = await xeroPayrollService.createPayrun(tenantId, {
        payrollCalendarID: payPeriod.payrollCalendarId
      });

      if (!newPayRun?.payRunID) {
        console.warn('[XeroSync] Failed to create pay run');
        return null;
      }

      await prisma.xeroPayrun.upsert({
        where: { xeroPayrunId: newPayRun.payRunID },
        create: {
          xeroTenantId: tenantId,
          xeroPayrunId: newPayRun.payRunID,
          periodStart: payPeriod.startDate,
          periodEnd: payPeriod.endDate,
          paymentDate: this.parseXeroDate(newPayRun.paymentDate) || payPeriod.startDate,
          status: newPayRun.payRunStatus || 'DRAFT'
        },
        update: { status: newPayRun.payRunStatus || 'DRAFT' }
      });

      console.log(`[XeroSync] Created pay run ${newPayRun.payRunID} for period ${this.formatXeroDate(payPeriod.startDate)}`);
      return newPayRun.payRunID;
    } catch (error) {
      console.error('[XeroSync] Error ensuring pay run:', error);
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
   * Build NumberOfUnits array for Xero.
   * The array has one element per day in the pay period (e.g. 7 for weekly, 14 for fortnightly).
   * Each position is the day offset from periodStartDate (position 0 = period start day).
   *
   * @param {Array} entries - Timesheet entries for this earnings rate
   * @param {Date} periodStartDate - Pay period start date
   * @param {Date} periodEndDate - Pay period end date
   * @returns {Array} Array of N numbers (hours per day across the pay period)
   */
  buildNumberOfUnits(entries, periodStartDate, periodEndDate) {
    const start = new Date(periodStartDate);
    const end = new Date(periodEndDate);
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(0, 0, 0, 0);

    const periodDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const hoursPerDay = new Array(periodDays).fill(0);

    // Group entries by date and sum hours
    const entriesByDate = {};
    for (const entry of entries) {
      const dateKey = new Date(entry.date).toISOString().split('T')[0];
      entriesByDate[dateKey] = (entriesByDate[dateKey] || 0) + entry.hours;
    }

    // Place hours at the correct day offset from period start
    for (const [dateStr, hours] of Object.entries(entriesByDate)) {
      const entryDate = new Date(dateStr);
      entryDate.setUTCHours(0, 0, 0, 0);
      const dayOffset = Math.round((entryDate - start) / (1000 * 60 * 60 * 24));
      if (dayOffset >= 0 && dayOffset < periodDays) {
        hoursPerDay[dayOffset] += hours;
      }
    }

    return hoursPerDay;
  }

  /**
   * Find the Xero pay period that covers a given date.
   * First checks existing pay runs; if none found, falls back to calendar math.
   * Returns full pay period info including pay run status (so callers can detect POSTED).
   *
   * @param {string} tenantId
   * @param {Date} date
   * @returns {{ startDate, endDate, payRunId, payRunStatus, payrollCalendarId, calendarName } | null}
   */
  async findPayPeriod(tenantId, date) {
    try {
      const target = new Date(date);
      target.setUTCHours(0, 0, 0, 0);

      // 1. Check existing pay runs first
      const payruns = await xeroPayrollService.getPayruns(tenantId);
      for (const pr of payruns) {
        if (!pr.payRunPeriodStartDate || !pr.payRunPeriodEndDate) continue;
        const prStart = this.parseXeroDate(pr.payRunPeriodStartDate);
        const prEnd = this.parseXeroDate(pr.payRunPeriodEndDate);
        if (!prStart || !prEnd) continue;
        prStart.setUTCHours(0, 0, 0, 0);
        prEnd.setUTCHours(0, 0, 0, 0);
        if (prStart <= target && target <= prEnd) {
          return {
            startDate: prStart,
            endDate: prEnd,
            payRunId: pr.payRunID,
            payRunStatus: pr.payRunStatus,
            payrollCalendarId: pr.payrollCalendarID,
            calendarName: null
          };
        }
      }

      // 2. No pay run found — derive period dates from payroll calendar math.
      // Prefer calendars that have existing pay runs (i.e. are actively used)
      // over calendars with no pay runs (e.g. old/unused calendars like "Weekly").
      const calendars = await xeroPayrollService.getPayrollCalendars(tenantId);
      const calendarIdsWithPayruns = new Set(
        payruns.map(pr => pr.payrollCalendarID).filter(Boolean)
      );
      const sortedCalendars = [
        ...calendars.filter(c => calendarIdsWithPayruns.has(c.payrollCalendarID)),
        ...calendars.filter(c => !calendarIdsWithPayruns.has(c.payrollCalendarID))
      ];
      for (const cal of sortedCalendars) {
        const period = this.calculatePayPeriodFromCalendar(cal, target);
        if (period) {
          console.log(`[XeroSync] Calculated pay period from calendar "${cal.name}": ${this.formatXeroDate(period.startDate)} – ${this.formatXeroDate(period.endDate)}`);
          return {
            ...period,
            payRunId: null,
            payRunStatus: null,
            payrollCalendarId: cal.payrollCalendarID,
            calendarName: cal.name
          };
        }
      }

      return null;
    } catch (error) {
      console.error('[XeroSync] Error finding pay period:', error);
      return null;
    }
  }

  /**
   * Calculate pay period start/end dates for a given date using a payroll calendar's rules.
   * Supports WEEKLY and FORTNIGHTLY calendar types.
   *
   * @param {Object} calendar - Xero PayrollCalendar object
   * @param {Date} target - The date to find the period for
   * @returns {{ startDate: Date, endDate: Date } | null}
   */
  calculatePayPeriodFromCalendar(calendar, target) {
    if (!calendar.startDate) return null;

    const calStart = this.parseXeroDate(calendar.startDate);
    if (!calStart) return null;
    calStart.setUTCHours(0, 0, 0, 0);
    const t = new Date(target);
    t.setUTCHours(0, 0, 0, 0);

    if (t < calStart) return null; // Before calendar started

    const ONE_DAY = 1000 * 60 * 60 * 24;
    const daysDiff = Math.round((t - calStart) / ONE_DAY);

    let periodLengthDays;
    switch (calendar.calendarType) {
      case 'WEEKLY':      periodLengthDays = 7;  break;
      case 'FORTNIGHTLY': periodLengthDays = 14; break;
      default: return null; // MONTHLY etc. need more complex logic
    }

    const periodNumber = Math.floor(daysDiff / periodLengthDays);
    const startDate = new Date(calStart.getTime() + periodNumber * periodLengthDays * ONE_DAY);
    const endDate = new Date(startDate.getTime() + (periodLengthDays - 1) * ONE_DAY);

    return { startDate, endDate };
  }

  /**
   * Parse a Xero date which may be in /Date(timestamp+offset)/ format.
   * The xero-node SDK inconsistently deserialises some date fields, leaving
   * them as raw strings that new Date() cannot parse.
   *
   * @param {*} d - Raw value from Xero SDK (string, Date, or null)
   * @returns {Date|null}
   */
  parseXeroDate(d) {
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
