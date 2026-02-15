const { PrismaClient } = require('@prisma/client');
const tsDataService = require('../services/tsDataService');
const tsDataSyncService = require('../services/tsDataSyncService');

const prisma = new PrismaClient();

const getTimesheets = async (req, res) => {
  try {
    const { workerId, fromDate, toDate, periodId } = req.query;
    const timesheets = await tsDataService.getTimesheets({ workerId, fromDate, toDate, periodId });
    res.json({ timesheets });
  } catch (error) {
    console.error('TSDATA getTimesheets error:', error);
    res.status(502).json({ error: 'Failed to fetch timesheets from TSDATA: ' + error.message });
  }
};

const getWorkers = async (req, res) => {
  try {
    const { status } = req.query;
    const workers = await tsDataService.getWorkers({ status });
    res.json({ workers });
  } catch (error) {
    console.error('TSDATA getWorkers error:', error);
    res.status(502).json({ error: 'Failed to fetch workers from TSDATA: ' + error.message });
  }
};

const triggerRefresh = async (req, res) => {
  try {
    const result = await tsDataService.triggerSync();
    res.json({ message: 'Sync triggered successfully', result });
  } catch (error) {
    console.error('TSDATA triggerSync error:', error);
    res.status(502).json({ error: 'Failed to trigger sync: ' + error.message });
  }
};

const runManualSync = async (req, res) => {
  try {
    console.log(`[Manual Sync] Triggered by user ${req.session.userId}`);
    const result = await tsDataSyncService.performSync();

    if (result.skipped) {
      return res.status(409).json({ error: 'Sync already in progress' });
    }

    if (result.success) {
      res.json({
        message: 'Sync completed successfully',
        ...result
      });
    } else {
      res.status(500).json({
        error: 'Sync failed',
        details: result.error
      });
    }
  } catch (error) {
    console.error('Manual sync error:', error);
    res.status(500).json({ error: 'Failed to run sync: ' + error.message });
  }
};

const getSyncLogs = async (req, res) => {
  try {
    const { limit = '50', syncType, status } = req.query;

    const where = {};
    if (syncType) where.syncType = syncType;
    if (status) where.status = status;

    const logs = await prisma.tsDataSyncLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10)
    });

    res.json({ logs });
  } catch (error) {
    console.error('Get sync logs error:', error);
    res.status(500).json({ error: 'Failed to fetch sync logs' });
  }
};

module.exports = {
  getTimesheets,
  getWorkers,
  triggerRefresh,
  runManualSync,
  getSyncLogs
};
