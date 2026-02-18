const { PrismaClient } = require('@prisma/client');
const xeroSyncService = require('../services/xeroSyncService');
const emailService = require('../services/emailService');

const prisma = new PrismaClient();

/**
 * Xero Sync Job
 * Runs Sunday nights to sync approved timesheets to Xero
 */

/**
 * Auto-approve timesheets for employees with autoApprove enabled
 */
async function autoApproveTimesheets() {
  if (process.env.XERO_AUTO_APPROVE_ENABLED !== 'true') {
    console.log('[XeroSync Job] Auto-approve is disabled');
    return [];
  }

  console.log('[XeroSync Job] Starting auto-approval...');

  // Find employees with autoApprove enabled
  const employeesWithAutoApprove = await prisma.employeeXeroSettings.findMany({
    where: {
      autoApprove: true,
      syncEnabled: true
    },
    include: {
      employee: true
    }
  });

  if (employeesWithAutoApprove.length === 0) {
    console.log('[XeroSync Job] No employees with auto-approve enabled');
    return [];
  }

  // Get current week (Sunday-Saturday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const weekStarting = new Date(now);
  weekStarting.setDate(now.getDate() - dayOfWeek); // Go back to Sunday
  weekStarting.setHours(0, 0, 0, 0);

  const weekEnding = new Date(weekStarting);
  weekEnding.setDate(weekStarting.getDate() + 6); // Saturday
  weekEnding.setHours(23, 59, 59, 999);

  // Find SUBMITTED timesheets for this week for auto-approve employees
  const timesheetsToApprove = await prisma.timesheet.findMany({
    where: {
      employeeId: {
        in: employeesWithAutoApprove.map(e => e.employeeId)
      },
      status: 'SUBMITTED',
      weekStarting: {
        gte: weekStarting,
        lte: weekEnding
      }
    },
    include: {
      employee: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    }
  });

  const approved = [];
  for (const timesheet of timesheetsToApprove) {
    try {
      await prisma.timesheet.update({
        where: { id: timesheet.id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedById: null // System approval
        }
      });

      console.log(`[XeroSync Job] Auto-approved timesheet ${timesheet.id} for ${timesheet.employee.firstName} ${timesheet.employee.lastName}`);
      approved.push(timesheet);
    } catch (error) {
      console.error(`[XeroSync Job] Failed to auto-approve timesheet ${timesheet.id}:`, error);
    }
  }

  return approved;
}

/**
 * Sync all pending timesheets to Xero
 */
async function syncPendingTimesheets() {
  console.log('[XeroSync Job] Starting timesheet sync...');

  // Find approved timesheets that haven't been synced yet
  const pendingTimesheets = await prisma.timesheet.findMany({
    where: {
      status: 'APPROVED',
      xeroTimesheetId: null,
      employee: {
        xeroSettings: {
          syncEnabled: true,
          isSalaried: false // Skip salaried employees
        }
      }
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          xeroSettings: true
        }
      }
    },
    orderBy: {
      weekStarting: 'asc'
    }
  });

  console.log(`[XeroSync Job] Found ${pendingTimesheets.length} timesheets to sync`);

  const results = {
    total: pendingTimesheets.length,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  for (const timesheet of pendingTimesheets) {
    try {
      console.log(`[XeroSync Job] Syncing timesheet ${timesheet.id} for ${timesheet.employee.firstName} ${timesheet.employee.lastName}...`);

      const result = await xeroSyncService.processApprovedTimesheet(timesheet);

      if (result) {
        results.success++;
      } else {
        results.skipped++;
      }
    } catch (error) {
      console.error(`[XeroSync Job] Failed to sync timesheet ${timesheet.id}:`, error);
      results.failed++;
      results.errors.push({
        timesheetId: timesheet.id,
        employee: `${timesheet.employee.firstName} ${timesheet.employee.lastName}`,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Send email report to admins
 */
async function sendSyncReport(autoApproved, syncResults) {
  try {
    // Get admin users
    const admins = await prisma.user.findMany({
      where: { isAdmin: true }
    });

    if (admins.length === 0) {
      console.log('[XeroSync Job] No admin users to send report to');
      return;
    }

    const subject = `Xero Sync Report - ${new Date().toLocaleDateString()}`;
    const html = `
      <h2>Xero Timesheet Sync Report</h2>

      <h3>Auto-Approval Summary</h3>
      <p><strong>${autoApproved.length}</strong> timesheet(s) auto-approved</p>
      ${autoApproved.length > 0 ? `
        <ul>
          ${autoApproved.map(ts => `
            <li>${ts.employee.firstName} ${ts.employee.lastName} - Week of ${new Date(ts.weekStarting).toLocaleDateString()}</li>
          `).join('')}
        </ul>
      ` : ''}

      <h3>Sync Summary</h3>
      <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;">
        <tr>
          <td><strong>Total Timesheets:</strong></td>
          <td>${syncResults.total}</td>
        </tr>
        <tr style="background-color: #d1fae5;">
          <td><strong>Successfully Synced:</strong></td>
          <td>${syncResults.success}</td>
        </tr>
        <tr style="background-color: #fef3c7;">
          <td><strong>Skipped:</strong></td>
          <td>${syncResults.skipped}</td>
        </tr>
        <tr style="background-color: #fef2f2;">
          <td><strong>Failed:</strong></td>
          <td>${syncResults.failed}</td>
        </tr>
      </table>

      ${syncResults.errors.length > 0 ? `
        <h3>Errors</h3>
        <ul style="color: #dc2626;">
          ${syncResults.errors.map(err => `
            <li><strong>${err.employee}</strong> (Timesheet #${err.timesheetId}): ${err.error}</li>
          `).join('')}
        </ul>
      ` : '<p style="color: #10b981;">✓ No errors</p>'}

      <p style="margin-top: 2rem; color: #6b7280; font-size: 0.875rem;">
        This is an automated report from your timesheet system.
      </p>
    `;

    for (const admin of admins) {
      await emailService.sendEmail(
        admin.email,
        subject,
        html
      );
    }

    console.log(`[XeroSync Job] Sync report sent to ${admins.length} admin(s)`);
  } catch (error) {
    console.error('[XeroSync Job] Failed to send sync report:', error);
  }
}

/**
 * Main sync job - runs Sunday nights
 */
async function runXeroSyncJob() {
  if (process.env.XERO_SYNC_ENABLED !== 'true') {
    console.log('[XeroSync Job] Xero sync is disabled');
    return;
  }

  console.log('[XeroSync Job] ========== Starting Xero Sync Job ==========');
  console.log('[XeroSync Job] Time:', new Date().toLocaleString());

  try {
    // Step 1: Auto-approve timesheets
    const autoApproved = await autoApproveTimesheets();

    // Step 2: Sync pending timesheets
    const syncResults = await syncPendingTimesheets();

    // Step 3: Send email report
    await sendSyncReport(autoApproved, syncResults);

    console.log('[XeroSync Job] ========== Xero Sync Job Completed ==========');
    console.log(`[XeroSync Job] Auto-approved: ${autoApproved.length}, Synced: ${syncResults.success}/${syncResults.total}, Failed: ${syncResults.failed}`);
  } catch (error) {
    console.error('[XeroSync Job] Fatal error in sync job:', error);
  }
}

module.exports = {
  runXeroSyncJob,
  autoApproveTimesheets,
  syncPendingTimesheets,
  sendSyncReport
};
