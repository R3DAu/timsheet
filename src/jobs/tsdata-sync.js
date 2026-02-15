const tsDataSyncService = require('../services/tsDataSyncService');

async function runTsDataSync() {
  console.log('[TSDATA Sync Job] Starting scheduled sync...');

  try {
    const result = await tsDataSyncService.performSync();

    if (result.skipped) {
      console.log('[TSDATA Sync Job] Skipped (already in progress)');
    } else if (result.success) {
      console.log('[TSDATA Sync Job] Completed:', {
        duration: result.duration + 'ms',
        timesheetsCreated: result.timesheetsCreated,
        timesheetsUpdated: result.timesheetsUpdated,
        entriesCreated: result.entriesCreated,
        entriesUpdated: result.entriesUpdated,
        errors: result.errors.length
      });
    } else {
      console.error('[TSDATA Sync Job] Failed:', result.error);
    }

    return result;
  } catch (error) {
    console.error('[TSDATA Sync Job] Fatal error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { runTsDataSync };
