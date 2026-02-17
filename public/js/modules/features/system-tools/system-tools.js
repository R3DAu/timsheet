/**
 * System Tools module
 * Admin utilities for data repair and maintenance
 */

import { api } from '../../core/api.js';
import { showAlert } from '../../core/alerts.js';

/**
 * Initialize system tools tab
 */
export function initSystemTools() {
  const cleanupBtn = document.getElementById('cleanupDuplicatesBtn');
  const repairBtn = document.getElementById('repairStatusBtn');
  const syncBtn = document.getElementById('manualSyncBtn');
  const weekendBtn = document.getElementById('removeWeekendBtn');
  const mergeBtn = document.getElementById('mergeDuplicatesBtn');

  if (cleanupBtn) {
    cleanupBtn.addEventListener('click', runCleanupDuplicates);
  }

  if (repairBtn) {
    repairBtn.addEventListener('click', runRepairStatuses);
  }

  if (syncBtn) {
    syncBtn.addEventListener('click', runManualSync);
  }

  if (weekendBtn) {
    weekendBtn.addEventListener('click', runRemoveWeekendEntries);
  }

  if (mergeBtn) {
    mergeBtn.addEventListener('click', runMergeDuplicateTimesheets);
  }
}

/**
 * Run TSDATA duplicate cleanup
 */
async function runCleanupDuplicates() {
  const btn = document.getElementById('cleanupDuplicatesBtn');
  const resultDiv = document.getElementById('cleanupDuplicatesResult');

  // Disable button and show loading
  btn.disabled = true;
  btn.textContent = '🔄 Running cleanup...';
  resultDiv.innerHTML = '<p style="color: #6b7280;">Processing... This may take a moment.</p>';

  try {
    const result = await api.post('/tsdata/cleanup-duplicates', {});

    // Show success result
    resultDiv.innerHTML = `
      <div style="background: #d1fae5; border: 1px solid #10b981; border-radius: 6px; padding: 1rem; color: #065f46;">
        <strong>✅ Cleanup completed successfully!</strong>
        <ul style="margin: 0.5rem 0 0 1.5rem; font-size: 0.9rem;">
          <li><strong>${result.duplicatesRemoved || 0}</strong> duplicate TSDATA entries removed</li>
          <li><strong>${result.entriesVerified || 0}</strong> local entries marked as verified</li>
          <li><strong>${result.timesheetsUpdated || 0}</strong> timesheets updated</li>
        </ul>
        ${result.errors > 0 ? `<p style="margin-top: 0.5rem; color: #dc2626;">⚠️ ${result.errors} errors occurred</p>` : ''}
      </div>
    `;

    // Refresh timesheets if any changes were made
    if (result.duplicatesRemoved > 0 || result.entriesVerified > 0) {
      if (window.refreshTimesheets) {
        await window.refreshTimesheets();
      }
    }
  } catch (error) {
    resultDiv.innerHTML = `
      <div style="background: #fee2e2; border: 1px solid #dc2626; border-radius: 6px; padding: 1rem; color: #991b1b;">
        <strong>❌ Cleanup failed</strong>
        <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem;">${error.message || 'Unknown error occurred'}</p>
      </div>
    `;
    console.error('Cleanup error:', error);
  } finally {
    // Re-enable button
    btn.disabled = false;
    btn.textContent = '🧹 Run TSDATA Cleanup';
  }
}

/**
 * Run status consistency repair
 */
async function runRepairStatuses() {
  const btn = document.getElementById('repairStatusBtn');
  const resultDiv = document.getElementById('repairStatusResult');

  // Disable button and show loading
  btn.disabled = true;
  btn.textContent = '🔄 Repairing statuses...';
  resultDiv.innerHTML = '<p style="color: #6b7280;">Processing... This may take a moment.</p>';

  try {
    const result = await api.post('/timesheets/repair/status-inconsistencies', {});

    // Show success result
    resultDiv.innerHTML = `
      <div style="background: #d1fae5; border: 1px solid #10b981; border-radius: 6px; padding: 1rem; color: #065f46;">
        <strong>✅ Status repair completed successfully!</strong>
        <ul style="margin: 0.5rem 0 0 1.5rem; font-size: 0.9rem;">
          <li><strong>${result.timesheetsChecked || 0}</strong> timesheets checked</li>
          <li><strong>${result.timesheetsFixed || 0}</strong> timesheets had inconsistencies</li>
          <li><strong>${result.entriesUpdated || 0}</strong> entries updated to match parent status</li>
        </ul>
      </div>
    `;

    // Refresh timesheets if any changes were made
    if (result.entriesUpdated > 0) {
      if (window.refreshTimesheets) {
        await window.refreshTimesheets();
      }
    }
  } catch (error) {
    resultDiv.innerHTML = `
      <div style="background: #fee2e2; border: 1px solid #dc2626; border-radius: 6px; padding: 1rem; color: #991b1b;">
        <strong>❌ Status repair failed</strong>
        <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem;">${error.message || 'Unknown error occurred'}</p>
      </div>
    `;
    console.error('Status repair error:', error);
  } finally {
    // Re-enable button
    btn.disabled = false;
    btn.textContent = '🔄 Repair Entry Statuses';
  }
}

/**
 * Run weekend entries removal
 */
async function runRemoveWeekendEntries() {
  const btn = document.getElementById('removeWeekendBtn');
  const resultDiv = document.getElementById('removeWeekendResult');

  // Disable button and show loading
  btn.disabled = true;
  btn.textContent = '🔄 Removing weekend entries...';
  resultDiv.innerHTML = '<p style="color: #6b7280;">Processing...</p>';

  try {
    const result = await api.post('/tsdata/remove-weekend-entries', {});

    // Show success result
    resultDiv.innerHTML = `
      <div style="background: #d1fae5; border: 1px solid #10b981; border-radius: 6px; padding: 1rem; color: #065f46;">
        <strong>✅ Weekend entries removed successfully!</strong>
        <ul style="margin: 0.5rem 0 0 1.5rem; font-size: 0.9rem;">
          <li><strong>${result.weekendEntriesRemoved || 0}</strong> weekend entries deleted</li>
          <li><strong>${result.timesheetsUpdated || 0}</strong> timesheets updated</li>
        </ul>
        <p style="margin-top: 0.5rem; font-size: 0.85rem;">Future TSDATA syncs will automatically skip weekend entries.</p>
      </div>
    `;

    // Refresh timesheets
    if (result.weekendEntriesRemoved > 0 && window.refreshTimesheets) {
      await window.refreshTimesheets();
    }
  } catch (error) {
    resultDiv.innerHTML = `
      <div style="background: #fee2e2; border: 1px solid #dc2626; border-radius: 6px; padding: 1rem; color: #991b1b;">
        <strong>❌ Weekend removal failed</strong>
        <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem;">${error.message || 'Unknown error occurred'}</p>
      </div>
    `;
    console.error('Weekend removal error:', error);
  } finally {
    // Re-enable button
    btn.disabled = false;
    btn.textContent = '📅 Remove Weekend Entries';
  }
}

/**
 * Run manual TSDATA sync
 */
async function runManualSync() {
  const btn = document.getElementById('manualSyncBtn');
  const resultDiv = document.getElementById('manualSyncResult');

  // Disable button and show loading
  btn.disabled = true;
  btn.textContent = '🔄 Syncing from TSDATA...';
  resultDiv.innerHTML = '<p style="color: #6b7280;">Processing... This may take several minutes.</p>';

  try {
    const result = await api.post('/tsdata/sync', {});

    // Show success result
    resultDiv.innerHTML = `
      <div style="background: #d1fae5; border: 1px solid #10b981; border-radius: 6px; padding: 1rem; color: #065f46;">
        <strong>✅ TSDATA sync completed successfully!</strong>
        <ul style="margin: 0.5rem 0 0 1.5rem; font-size: 0.9rem;">
          <li><strong>${result.timesheetsCreated || 0}</strong> timesheets created</li>
          <li><strong>${result.timesheetsUpdated || 0}</strong> timesheets updated</li>
          <li><strong>${result.entriesCreated || 0}</strong> entries created</li>
          <li><strong>${result.entriesUpdated || 0}</strong> entries verified/updated</li>
        </ul>
        ${result.errors && result.errors.length > 0 ? `<p style="margin-top: 0.5rem; color: #dc2626;">⚠️ ${result.errors.length} worker(s) had errors</p>` : ''}
      </div>
    `;

    // Refresh timesheets
    if (window.refreshTimesheets) {
      await window.refreshTimesheets();
    }
  } catch (error) {
    resultDiv.innerHTML = `
      <div style="background: #fee2e2; border: 1px solid #dc2626; border-radius: 6px; padding: 1rem; color: #991b1b;">
        <strong>❌ TSDATA sync failed</strong>
        <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem;">${error.message || 'Unknown error occurred'}</p>
      </div>
    `;
    console.error('Manual sync error:', error);
  } finally {
    // Re-enable button
    btn.disabled = false;
    btn.textContent = '🔄 Run Manual Sync';
  }
}

/**
 * Run merge duplicate timesheets
 */
async function runMergeDuplicateTimesheets() {
  const btn = document.getElementById('mergeDuplicatesBtn');
  const resultDiv = document.getElementById('mergeDuplicatesResult');

  // Disable button and show loading
  btn.disabled = true;
  btn.textContent = '🔄 Merging duplicate timesheets...';
  resultDiv.innerHTML = '<p style="color: #6b7280;">Processing... This may take a moment.</p>';

  try {
    const result = await api.post('/tsdata/merge-duplicate-timesheets', {});

    // Show success result
    resultDiv.innerHTML = `
      <div style="background: #d1fae5; border: 1px solid #10b981; border-radius: 6px; padding: 1rem; color: #065f46;">
        <strong>✅ Duplicate timesheets merged successfully!</strong>
        <ul style="margin: 0.5rem 0 0 1.5rem; font-size: 0.9rem;">
          <li><strong>${result.employeesProcessed || 0}</strong> employees processed</li>
          <li><strong>${result.timesheetsMerged || 0}</strong> duplicate timesheets merged</li>
          <li><strong>${result.entriesMoved || 0}</strong> entries moved to kept timesheets</li>
        </ul>
      </div>
    `;

    // Refresh timesheets
    if (window.refreshTimesheets) {
      await window.refreshTimesheets();
    }
  } catch (error) {
    resultDiv.innerHTML = `
      <div style="background: #fee2e2; border: 1px solid #dc2626; border-radius: 6px; padding: 1rem; color: #991b1b;">
        <strong>❌ Merge failed</strong>
        <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem;">${error.message || 'Unknown error occurred'}</p>
      </div>
    `;
    console.error('Merge duplicates error:', error);
  } finally {
    // Re-enable button
    btn.disabled = false;
    btn.textContent = '🔀 Merge Duplicate Timesheets';
  }
}
