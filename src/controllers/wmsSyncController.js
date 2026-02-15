const { PrismaClient } = require('@prisma/client');
const wmsSyncService = require('../services/wmsSyncService');

const prisma = new PrismaClient();

const startSync = async (req, res) => {
  try {
    const { timesheetId, credentials } = req.body;
    const userId = req.session.userId;
    const isAdmin = req.session.isAdmin;

    if (!timesheetId || !credentials) {
      return res.status(400).json({ error: 'timesheetId and credentials are required' });
    }

    if (!credentials.username || !credentials.password) {
      return res.status(400).json({ error: 'credentials must include username and password' });
    }

    // Verify timesheet exists and user has permission
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: parseInt(timesheetId) },
      include: { employee: true }
    });

    if (!timesheet) {
      return res.status(404).json({ error: 'Timesheet not found' });
    }

    if (!isAdmin && timesheet.employee.userId !== userId) {
      return res.status(403).json({ error: 'You do not have permission to sync this timesheet' });
    }

    const syncLog = await wmsSyncService.startSync(parseInt(timesheetId), credentials);

    res.status(202).json({
      message: 'Sync started',
      syncLog: {
        id: syncLog.id,
        timesheetId: syncLog.timesheetId,
        status: syncLog.status
      }
    });
  } catch (error) {
    console.error('Start sync error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

const getSyncStatus = async (req, res) => {
  try {
    const { syncLogId } = req.params;
    const status = await wmsSyncService.getSyncStatus(parseInt(syncLogId));
    res.json({ syncLog: status });
  } catch (error) {
    console.error('Get sync status error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

const getTimesheetSyncs = async (req, res) => {
  try {
    const { timesheetId } = req.params;
    const syncs = await wmsSyncService.getTimesheetSyncs(parseInt(timesheetId));
    res.json({ syncs });
  } catch (error) {
    console.error('Get timesheet syncs error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  startSync,
  getSyncStatus,
  getTimesheetSyncs
};
