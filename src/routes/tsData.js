const express = require('express');
const router = express.Router();
const tsDataController = require('../controllers/tsDataController');
const { requireApiKeyOrAuth, requireApiKeyOrAdmin } = require('../middleware/auth');

// Timesheets - any authenticated user (session or API key)
router.get('/timesheets', requireApiKeyOrAuth, tsDataController.getTimesheets);

// Workers - admin only
router.get('/workers', requireApiKeyOrAdmin, tsDataController.getWorkers);

// Trigger sync on TSDATA side - admin only
router.post('/refresh', requireApiKeyOrAdmin, tsDataController.triggerRefresh);

// Manual sync (TSDATA → local DB) - admin only
router.post('/sync', requireApiKeyOrAdmin, tsDataController.runManualSync);

// Cleanup duplicate TSDATA entries - admin only
router.post('/cleanup-duplicates', requireApiKeyOrAdmin, tsDataController.cleanupDuplicates);

// Remove weekend TSDATA entries - admin only
router.post('/remove-weekend-entries', requireApiKeyOrAdmin, tsDataController.removeWeekendEntries);

// Merge duplicate timesheets - admin only
router.post('/merge-duplicate-timesheets', requireApiKeyOrAdmin, tsDataController.mergeDuplicateTimesheets);

// Sync logs - admin only
router.get('/sync-logs', requireApiKeyOrAdmin, tsDataController.getSyncLogs);

module.exports = router;
