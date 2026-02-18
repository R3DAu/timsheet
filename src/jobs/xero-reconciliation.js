const { PrismaClient } = require('@prisma/client');
const xeroPayrollService = require('../services/xeroPayrollService');
const emailService = require('../services/emailService');

const prisma = new PrismaClient();

/**
 * Xero Reconciliation Job
 * Runs Monday mornings to validate and reconcile timesheets with Xero
 */

/**
 * Get date range for previous week (Sunday-Saturday)
 */
function getPreviousWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay();

  // Go back to last Sunday
  const lastSunday = new Date(now);
  lastSunday.setDate(now.getDate() - dayOfWeek - 7);
  lastSunday.setHours(0, 0, 0, 0);

  // Last Saturday
  const lastSaturday = new Date(lastSunday);
  lastSaturday.setDate(lastSunday.getDate() + 6);
  lastSaturday.setHours(23, 59, 59, 999);

  return { weekStart: lastSunday, weekEnd: lastSaturday };
}

/**
 * Reconcile timesheets with Xero
 */
async function reconcileTimesheets() {
  console.log('[Xero Reconciliation] Starting reconciliation...');

  const { weekStart, weekEnd } = getPreviousWeekRange();
  console.log(`[Xero Reconciliation] Checking week: ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`);

  // Find synced timesheets from last week
  const syncedTimesheets = await prisma.timesheet.findMany({
    where: {
      weekStarting: {
        gte: weekStart,
        lte: weekEnd
      },
      xeroTimesheetId: {
        not: null
      }
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          identifiers: true
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

  console.log(`[Xero Reconciliation] Found ${syncedTimesheets.length} synced timesheets to reconcile`);

  const results = {
    total: syncedTimesheets.length,
    validated: 0,
    differences: [],
    updated: 0,
    errors: []
  };

  // Group by tenant
  const timesheetsByTenant = {};
  for (const timesheet of syncedTimesheets) {
    const firstEntry = timesheet.entries[0];
    if (!firstEntry) continue;

    const companyMapping = firstEntry.company.xeroMappings?.[0];
    if (!companyMapping) continue;

    const tenantId = companyMapping.xeroTenantId;
    if (!timesheetsByTenant[tenantId]) {
      timesheetsByTenant[tenantId] = [];
    }
    timesheetsByTenant[tenantId].push(timesheet);
  }

  // Reconcile each tenant
  for (const [tenantId, timesheets] of Object.entries(timesheetsByTenant)) {
    console.log(`[Xero Reconciliation] Reconciling ${timesheets.length} timesheets for tenant ${tenantId}`);

    for (const timesheet of timesheets) {
      try {
        await reconcileTimesheet(timesheet, tenantId, results);
      } catch (error) {
        console.error(`[Xero Reconciliation] Error reconciling timesheet ${timesheet.id}:`, error);
        results.errors.push({
          timesheetId: timesheet.id,
          employee: `${timesheet.employee.firstName} ${timesheet.employee.lastName}`,
          error: error.message
        });
      }
    }
  }

  return results;
}

/**
 * Reconcile a single timesheet with Xero
 */
async function reconcileTimesheet(timesheet, tenantId, results) {
  const { employee, entries, xeroTimesheetId } = timesheet;

  // Fetch timesheet from Xero
  let xeroTimesheet;
  try {
    xeroTimesheet = await xeroPayrollService.getTimesheet(tenantId, xeroTimesheetId);
  } catch (error) {
    console.error(`[Xero Reconciliation] Failed to fetch Xero timesheet ${xeroTimesheetId}:`, error);
    results.errors.push({
      timesheetId: timesheet.id,
      employee: `${employee.firstName} ${employee.lastName}`,
      error: `Failed to fetch from Xero: ${error.message}`
    });
    return;
  }

  if (!xeroTimesheet) {
    console.warn(`[Xero Reconciliation] Timesheet ${xeroTimesheetId} not found in Xero`);
    results.errors.push({
      timesheetId: timesheet.id,
      employee: `${employee.firstName} ${employee.lastName}`,
      error: 'Timesheet not found in Xero'
    });
    return;
  }

  // Calculate local hours by earnings rate
  const localHoursByRate = calculateLocalHours(entries, tenantId, employee);

  // Calculate Xero hours by earnings rate
  const xeroHoursByRate = calculateXeroHours(xeroTimesheet);

  // Compare and find differences
  const differences = comparHours(localHoursByRate, xeroHoursByRate, timesheet, employee);

  if (differences.length > 0) {
    console.log(`[Xero Reconciliation] Found ${differences.length} difference(s) for timesheet ${timesheet.id}`);
    results.differences.push({
      timesheetId: timesheet.id,
      employee: `${employee.firstName} ${employee.lastName}`,
      weekStarting: timesheet.weekStarting,
      xeroTimesheetId,
      differences
    });

    // TODO: Option to auto-update Xero if differences found
    // For now, just log the differences
  } else {
    results.validated++;
  }
}

/**
 * Calculate local hours grouped by earnings rate
 */
function calculateLocalHours(entries, tenantId, employee) {
  const hoursByRate = {};

  for (const entry of entries) {
    // Check for employee-specific rate first
    const customRate = employee.customEarningsRates?.find(
      r => r.roleId === entry.role.id && r.xeroTenantId === tenantId
    );

    let rateId;
    if (customRate) {
      rateId = customRate.xeroEarningsRateId;
    } else {
      const roleMapping = entry.role.xeroEarningsRateMaps?.find(
        m => m.xeroTenantId === tenantId
      );
      if (!roleMapping) continue;
      rateId = roleMapping.xeroEarningsRateId;
    }

    if (!hoursByRate[rateId]) {
      hoursByRate[rateId] = 0;
    }
    hoursByRate[rateId] += entry.hours;
  }

  return hoursByRate;
}

/**
 * Calculate Xero hours grouped by earnings rate
 */
function calculateXeroHours(xeroTimesheet) {
  const hoursByRate = {};

  const timesheetLines = xeroTimesheet.timesheetLines || xeroTimesheet.TimesheetLines || [];

  for (const line of timesheetLines) {
    const rateId = line.earningsRateID || line.EarningsRateID;
    const numberOfUnits = line.numberOfUnits || line.NumberOfUnits || [];

    if (!rateId) continue;

    // Sum all hours from the 7-day array
    const totalHours = numberOfUnits.reduce((sum, hours) => sum + (hours || 0), 0);

    if (!hoursByRate[rateId]) {
      hoursByRate[rateId] = 0;
    }
    hoursByRate[rateId] += totalHours;
  }

  return hoursByRate;
}

/**
 * Compare local and Xero hours
 */
function comparHours(localHours, xeroHours, timesheet, employee) {
  const differences = [];
  const allRateIds = new Set([...Object.keys(localHours), ...Object.keys(xeroHours)]);

  for (const rateId of allRateIds) {
    const local = localHours[rateId] || 0;
    const xero = xeroHours[rateId] || 0;
    const diff = Math.abs(local - xero);

    // Tolerance of 0.1 hours (6 minutes) to account for rounding
    if (diff > 0.1) {
      differences.push({
        earningsRateId: rateId,
        localHours: local,
        xeroHours: xero,
        difference: local - xero
      });
    }
  }

  return differences;
}

/**
 * Send reconciliation report email
 */
async function sendReconciliationReport(results) {
  try {
    // Get admin users
    const admins = await prisma.user.findMany({
      where: { isAdmin: true }
    });

    if (admins.length === 0) {
      console.log('[Xero Reconciliation] No admin users to send report to');
      return;
    }

    const { weekStart, weekEnd } = getPreviousWeekRange();

    const subject = `Xero Reconciliation Report - Week of ${weekStart.toLocaleDateString()}`;
    const html = `
      <h2>Xero Payroll Reconciliation Report</h2>
      <p><strong>Week:</strong> ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}</p>

      <h3>Summary</h3>
      <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;">
        <tr>
          <td><strong>Total Timesheets:</strong></td>
          <td>${results.total}</td>
        </tr>
        <tr style="background-color: #d1fae5;">
          <td><strong>Validated (No Differences):</strong></td>
          <td>${results.validated}</td>
        </tr>
        <tr style="background-color: ${results.differences.length > 0 ? '#fef3c7' : '#d1fae5'};">
          <td><strong>Differences Found:</strong></td>
          <td>${results.differences.length}</td>
        </tr>
        <tr style="background-color: ${results.errors.length > 0 ? '#fef2f2' : '#d1fae5'};">
          <td><strong>Errors:</strong></td>
          <td>${results.errors.length}</td>
        </tr>
      </table>

      ${results.differences.length > 0 ? `
        <h3>Differences Detected</h3>
        <p style="color: #f59e0b;">The following timesheets have differences between local and Xero:</p>
        ${results.differences.map(diff => `
          <div style="margin: 1rem 0; padding: 1rem; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 4px;">
            <p><strong>${diff.employee}</strong> - Week of ${new Date(diff.weekStarting).toLocaleDateString()}</p>
            <p style="font-size: 0.875rem; color: #92400e;">Timesheet ID: ${diff.timesheetId} | Xero ID: ${diff.xeroTimesheetId}</p>
            <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; margin-top: 0.5rem;">
              <tr style="background-color: #fbbf24;">
                <th>Earnings Rate</th>
                <th>Local Hours</th>
                <th>Xero Hours</th>
                <th>Difference</th>
              </tr>
              ${diff.differences.map(d => `
                <tr>
                  <td>${d.earningsRateId.substring(0, 8)}...</td>
                  <td>${d.localHours}</td>
                  <td>${d.xeroHours}</td>
                  <td style="color: ${d.difference > 0 ? '#dc2626' : '#10b981'};">
                    ${d.difference > 0 ? '+' : ''}${d.difference.toFixed(2)}
                  </td>
                </tr>
              `).join('')}
            </table>
            <p style="margin-top: 0.5rem; font-size: 0.875rem; color: #92400e;">
              <strong>Action Required:</strong> Local data is the source of truth. Please review and update Xero manually if needed.
            </p>
          </div>
        `).join('')}
      ` : '<p style="color: #10b981;">✓ All timesheets match Xero perfectly!</p>'}

      ${results.errors.length > 0 ? `
        <h3>Errors</h3>
        <ul style="color: #dc2626;">
          ${results.errors.map(err => `
            <li><strong>${err.employee}</strong> (Timesheet #${err.timesheetId}): ${err.error}</li>
          `).join('')}
        </ul>
      ` : ''}

      <p style="margin-top: 2rem; color: #6b7280; font-size: 0.875rem;">
        This is an automated reconciliation report from your timesheet system.
      </p>
    `;

    for (const admin of admins) {
      await emailService.sendEmail(
        admin.email,
        subject,
        html
      );
    }

    console.log(`[Xero Reconciliation] Report sent to ${admins.length} admin(s)`);
  } catch (error) {
    console.error('[Xero Reconciliation] Failed to send report:', error);
  }
}

/**
 * Main reconciliation job - runs Monday mornings
 */
async function runReconciliationJob() {
  if (process.env.XERO_SYNC_ENABLED !== 'true') {
    console.log('[Xero Reconciliation] Xero sync is disabled');
    return;
  }

  console.log('[Xero Reconciliation] ========== Starting Reconciliation Job ==========');
  console.log('[Xero Reconciliation] Time:', new Date().toLocaleString());

  try {
    // Reconcile timesheets
    const results = await reconcileTimesheets();

    // Send email report
    await sendReconciliationReport(results);

    console.log('[Xero Reconciliation] ========== Reconciliation Job Completed ==========');
    console.log(`[Xero Reconciliation] Validated: ${results.validated}/${results.total}, Differences: ${results.differences.length}, Errors: ${results.errors.length}`);
  } catch (error) {
    console.error('[Xero Reconciliation] Fatal error in reconciliation job:', error);
  }
}

module.exports = {
  runReconciliationJob,
  reconcileTimesheets,
  sendReconciliationReport
};
