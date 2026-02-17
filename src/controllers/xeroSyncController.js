const { PrismaClient } = require('@prisma/client');
const xeroSyncService = require('../services/xeroSyncService');

const prisma = new PrismaClient();

/**
 * Xero Sync Controller
 * Handles manual sync operations and sync log viewing
 */

/**
 * POST /api/xero/sync/timesheet/:timesheetId
 * Manually trigger sync for a timesheet
 */
exports.syncTimesheet = async (req, res) => {
  try {
    const { timesheetId } = req.params;

    const timesheet = await prisma.timesheet.findUnique({
      where: { id: parseInt(timesheetId) }
    });

    if (!timesheet) {
      return res.status(404).json({ error: 'Timesheet not found' });
    }

    if (timesheet.status !== 'APPROVED') {
      return res.status(400).json({
        error: 'Only approved timesheets can be synced'
      });
    }

    const result = await xeroSyncService.manualSync(parseInt(timesheetId));

    if (!result) {
      return res.status(500).json({
        error: 'Sync failed',
        message: 'Check sync logs for details'
      });
    }

    res.json({
      success: true,
      xeroTimesheetId: result.TimesheetID,
      message: 'Timesheet synced successfully'
    });
  } catch (error) {
    console.error('[XeroSync] Manual sync error:', error);
    res.status(500).json({
      error: 'Sync failed',
      message: error.message
    });
  }
};

/**
 * GET /api/xero/sync/logs
 * Get sync logs
 */
exports.getSyncLogs = async (req, res) => {
  try {
    const { timesheetId, syncType, status, limit = 50, offset = 0 } = req.query;

    const where = {};
    if (timesheetId) where.timesheetId = parseInt(timesheetId);
    if (syncType) where.syncType = syncType;
    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      prisma.xeroSyncLog.findMany({
        where,
        include: {
          timesheet: {
            select: {
              id: true,
              weekStarting: true,
              weekEnding: true,
              employee: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            }
          },
          xeroToken: {
            select: {
              tenantName: true
            }
          }
        },
        orderBy: { startedAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.xeroSyncLog.count({ where })
    ]);

    res.json({
      logs,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('[XeroSync] Error fetching logs:', error);
    res.status(500).json({
      error: 'Failed to fetch sync logs',
      message: error.message
    });
  }
};

/**
 * GET /api/xero/sync/logs/:id
 * Get a specific sync log
 */
exports.getSyncLog = async (req, res) => {
  try {
    const { id } = req.params;

    const log = await prisma.xeroSyncLog.findUnique({
      where: { id: parseInt(id) },
      include: {
        timesheet: {
          include: {
            employee: true,
            entries: {
              include: {
                role: true,
                company: true
              }
            }
          }
        },
        xeroToken: true
      }
    });

    if (!log) {
      return res.status(404).json({ error: 'Sync log not found' });
    }

    res.json(log);
  } catch (error) {
    console.error('[XeroSync] Error fetching log:', error);
    res.status(500).json({
      error: 'Failed to fetch sync log',
      message: error.message
    });
  }
};

/**
 * GET /api/xero/sync/status/:timesheetId
 * Get sync status for a specific timesheet
 */
exports.getTimesheetSyncStatus = async (req, res) => {
  try {
    const { timesheetId } = req.params;

    const timesheet = await prisma.timesheet.findUnique({
      where: { id: parseInt(timesheetId) },
      select: {
        id: true,
        xeroTimesheetId: true,
        xeroSyncedAt: true,
        xeroSyncLogs: {
          orderBy: { startedAt: 'desc' },
          take: 5
        }
      }
    });

    if (!timesheet) {
      return res.status(404).json({ error: 'Timesheet not found' });
    }

    const status = {
      synced: !!timesheet.xeroTimesheetId,
      xeroTimesheetId: timesheet.xeroTimesheetId,
      lastSyncedAt: timesheet.xeroSyncedAt,
      recentLogs: timesheet.xeroSyncLogs
    };

    res.json(status);
  } catch (error) {
    console.error('[XeroSync] Error fetching sync status:', error);
    res.status(500).json({
      error: 'Failed to fetch sync status',
      message: error.message
    });
  }
};

/**
 * GET /api/xero/sync/stats
 * Get sync statistics
 */
exports.getSyncStats = async (req, res) => {
  try {
    const [totalSyncs, successfulSyncs, failedSyncs, pendingSyncs] = await Promise.all([
      prisma.xeroSyncLog.count(),
      prisma.xeroSyncLog.count({ where: { status: 'SUCCESS' } }),
      prisma.xeroSyncLog.count({ where: { status: 'ERROR' } }),
      prisma.xeroSyncLog.count({ where: { status: 'PENDING' } })
    ]);

    const recentFailures = await prisma.xeroSyncLog.findMany({
      where: { status: 'ERROR' },
      include: {
        timesheet: {
          select: {
            id: true,
            weekStarting: true,
            employee: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      },
      orderBy: { startedAt: 'desc' },
      take: 10
    });

    res.json({
      total: totalSyncs,
      successful: successfulSyncs,
      failed: failedSyncs,
      pending: pendingSyncs,
      successRate: totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0,
      recentFailures
    });
  } catch (error) {
    console.error('[XeroSync] Error fetching stats:', error);
    res.status(500).json({
      error: 'Failed to fetch sync stats',
      message: error.message
    });
  }
};
