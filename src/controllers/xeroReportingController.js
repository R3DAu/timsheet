const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * GET /api/xero/reporting/overview
 * Per-employee Xero sync health summary for the dashboard.
 * Admin only.
 */
exports.getOverview = async (req, res) => {
  try {
    const [employees, approvedCounts, submittedCounts] = await Promise.all([
      prisma.employee.findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          xeroSettings: {
            select: {
              syncEnabled: true,
              employeeType: true,
              autoApprove: true,
              isSalaried: true
            }
          },
          identifiers: {
            where: { identifierType: 'xero_employee_id' },
            select: { identifierValue: true }
          },
          // Most recently Xero-synced timesheet → its latest sync log
          timesheets: {
            where: { xeroSyncLogs: { some: {} } },
            orderBy: { xeroSyncedAt: 'desc' },
            take: 1,
            select: {
              id: true,
              xeroSyncLogs: {
                orderBy: { startedAt: 'desc' },
                take: 1,
                select: {
                  id: true,
                  status: true,
                  startedAt: true,
                  errorMessage: true,
                  timesheetId: true
                }
              }
            }
          }
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
      }),

      // APPROVED timesheets per employee (approved but not yet pushed to Xero)
      prisma.timesheet.groupBy({
        by: ['employeeId'],
        where: { status: 'APPROVED' },
        _count: { id: true }
      }),

      // SUBMITTED timesheets per employee (awaiting human approval)
      prisma.timesheet.groupBy({
        by: ['employeeId'],
        where: { status: 'SUBMITTED' },
        _count: { id: true }
      })
    ]);

    const approvedMap = new Map(approvedCounts.map(r => [r.employeeId, r._count.id]));
    const submittedMap = new Map(submittedCounts.map(r => [r.employeeId, r._count.id]));

    const result = employees.map(emp => {
      const lastTimesheetWithLog = emp.timesheets[0];
      const lastLog = lastTimesheetWithLog?.xeroSyncLogs?.[0] ?? null;

      return {
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        xeroSettings: emp.xeroSettings ?? null,
        isMapped: emp.identifiers.length > 0,
        lastSync: lastLog
          ? {
              logId: lastLog.id,
              timesheetId: lastLog.timesheetId,
              status: lastLog.status,
              startedAt: lastLog.startedAt,
              errorMessage: lastLog.errorMessage ?? null
            }
          : null,
        pendingApprovalCount: submittedMap.get(emp.id) ?? 0,
        pendingSyncCount: approvedMap.get(emp.id) ?? 0
      };
    });

    res.json(result);
  } catch (error) {
    console.error('[XeroReporting] Overview error:', error);
    res.status(500).json({ error: 'Failed to fetch reporting overview' });
  }
};
