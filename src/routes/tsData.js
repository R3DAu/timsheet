const express = require('express');
const router = express.Router();
const tsDataController = require('../controllers/tsDataController');
const { requireApiKeyOrAuth, requireApiKeyOrAdmin } = require('../middleware/auth');
const apiCache = require('../utils/apiCache');

const TTL = {
  timesheets: 60 * 1000, // 1 min — refreshed by sync operations
  workers:     5 * 60 * 1000, // 5 min — rarely changes
};

// Timesheets - any authenticated user (session or API key)
router.get('/timesheets', requireApiKeyOrAuth,
  apiCache.middleware(req => `tsdata:timesheets:${JSON.stringify(req.query)}`, TTL.timesheets),
  tsDataController.getTimesheets);

// Workers - admin only
router.get('/workers', requireApiKeyOrAdmin,
  apiCache.middleware(req => `tsdata:workers:${JSON.stringify(req.query)}`, TTL.workers),
  tsDataController.getWorkers);

// Trigger sync on TSDATA side — invalidates cached TSDATA responses
router.post('/refresh', requireApiKeyOrAdmin, (req, res, next) => {
  apiCache.invalidate('tsdata:');
  next();
}, tsDataController.triggerRefresh);

// Manual sync (TSDATA → local DB) — invalidates cached TSDATA responses
router.post('/sync', requireApiKeyOrAdmin, (req, res, next) => {
  apiCache.invalidate('tsdata:');
  next();
}, tsDataController.runManualSync);

// Cleanup duplicate TSDATA entries - admin only
router.post('/cleanup-duplicates', requireApiKeyOrAdmin, tsDataController.cleanupDuplicates);

// Remove weekend TSDATA entries - admin only
router.post('/remove-weekend-entries', requireApiKeyOrAdmin, tsDataController.removeWeekendEntries);

// Merge duplicate timesheets - admin only
router.post('/merge-duplicate-timesheets', requireApiKeyOrAdmin, tsDataController.mergeDuplicateTimesheets);

// Sync logs - admin only
router.get('/sync-logs', requireApiKeyOrAdmin, tsDataController.getSyncLogs);

module.exports = router;
