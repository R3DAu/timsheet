/**
 * WMS Sync module - DE WMS timesheet synchronization
 * CRITICAL XSS FIXES: Error messages from API must be escaped
 */

import { api } from '../../core/api.js';
import { state } from '../../core/state.js';
import { showModalWithHTML, hideModal } from '../../core/modal.js';
import { showAlert } from '../../core/alerts.js';
import { escapeHtml } from '../../core/dom.js';

/**
 * Check if an employee has a role in any company with WMS sync enabled
 * @param {Object} employee - Employee object
 * @returns {boolean}
 */
export function employeeHasWmsSyncRole(employee) {
  if (!employee || !employee.roles) return false;
  return employee.roles.some(r =>
    r.company && r.company.wmsSyncEnabled
  );
}

/**
 * Check if a timesheet has any entries for a WMS-sync-enabled company
 * @param {Object} ts - Timesheet object
 * @returns {boolean}
 */
export function timesheetHasWmsSyncEntries(ts) {
  if (!ts.entries || ts.entries.length === 0) return false;
  return ts.entries.some(e =>
    e.company && e.company.wmsSyncEnabled
  );
}

/**
 * Returns the WMS sync button HTML - enabled, disabled, or hidden
 * @param {Object} ts - Timesheet object
 * @returns {string} - Button HTML
 */
export function getWmsSyncButton(ts) {
  const currentUser = state.get('currentUser');

  // For the current user's own timesheets, check if they have a DE role
  const isOwnTimesheet = currentUser && currentUser.employeeId &&
    ts.employee && ts.employee.id === currentUser.employeeId;

  if (isOwnTimesheet) {
    const emp = currentUser.employee;
    if (!emp || !employeeHasWmsSyncRole(emp)) {
      return ''; // No button if user has no WMS-sync-enabled role
    }
  }

  // Check if timesheet has WMS-syncable entries
  const hasWmsEntries = timesheetHasWmsSyncEntries(ts);

  if (!hasWmsEntries) {
    if (isOwnTimesheet) {
      // Show disabled button for own timesheets so they know it exists
      return `<button class="btn btn-sm btn-info" disabled title="No WMS-syncable entries to sync" style="opacity: 0.5; cursor: not-allowed;">Sync to WMS</button>`;
    }
    return ''; // Hide entirely for admin viewing others with no WMS entries
  }

  return `<button class="btn btn-sm btn-info" onclick="syncToWms(${ts.id}, ${ts.employee?.id || 'null'})">Sync to WMS</button>`;
}

/**
 * Start WMS sync for a timesheet
 * @param {number} timesheetId - Timesheet ID
 * @param {number|null} employeeId - Employee ID for prefilling username
 */
export async function syncToWms(timesheetId, employeeId) {
  // Try to prefetch the DE work email for prefilling
  let prefillEmail = null;
  if (employeeId) {
    try {
      const result = await api.get(`/employees/${employeeId}/de-work-email`);
      prefillEmail = result.email || null;
    } catch (_) {
      // Non-fatal - continue without prefill
    }
  }

  const html = `
    <h3>Sync to DE WMS (TSSP)</h3>
    <div class="alert alert-info">
      Enter your DE (ADFS) login credentials. These are <strong>not stored</strong> on our servers and are only used for this sync session. Your employee profile must have a <strong>DE Worker ID</strong> identifier configured.
    </div>
    <form id="wmsSyncForm">
      <div class="form-group">
        <label>ADFS Username (e.g. domain\\username or email)</label>
        <input type="text" name="wmsUsername" required autocomplete="off" placeholder="EDUCATION\\jsmith or jsmith@education.vic.gov.au" value="${escapeHtml(prefillEmail || '')}">
        ${prefillEmail ? '<small style="color: var(--muted);">Prefilled from your DE profile</small>' : ''}
      </div>
      <div class="form-group">
        <label>ADFS Password</label>
        <input type="password" name="wmsPassword" required autocomplete="off">
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="wmsSyncShowPw">
          <span>Show password</span>
        </label>
      </div>
      <button type="submit" class="btn btn-primary">Start Sync</button>
      <button type="button" class="btn btn-secondary" onclick="hideModal()">Cancel</button>
    </form>
  `;

  showModalWithHTML(html);

  document.getElementById('wmsSyncShowPw').onchange = (e) => {
    const pwInput = document.querySelector('#modalBody input[name="wmsPassword"]');
    pwInput.type = e.target.checked ? 'text' : 'password';
  };

  document.getElementById('wmsSyncForm').onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const credentials = {
      username: form.wmsUsername.value,
      password: form.wmsPassword.value
    };

    // Clear password from form immediately
    form.wmsPassword.value = '';

    try {
      const result = await api.post('/wms-sync/start', {
        timesheetId,
        credentials
      });
      showSyncProgress(result.syncLog.id);
    } catch (error) {
      showAlert('Failed to start sync: ' + error.message);
    }
  };
}

/**
 * Show sync progress modal
 * @param {number} syncLogId - Sync log ID
 */
function showSyncProgress(syncLogId) {
  const html = `
    <h3>WMS Sync Progress</h3>
    <div class="sync-progress">
      <div class="alert alert-info" id="syncProgressAlert">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div class="sync-spinner" id="syncSpinner"></div>
          <span id="syncProgressMessage">Initialising sync...</span>
        </div>
      </div>
      <div id="syncProgressLog" style="background: #1a1a2e; border-radius: 6px; padding: 0.75rem; margin: 0.75rem 0; max-height: 200px; overflow-y: auto; font-family: monospace; font-size: 0.85rem; line-height: 1.6;"></div>
      <div id="syncResultDetails"></div>
    </div>
    <button type="button" class="btn btn-secondary" onclick="hideModal()">Close</button>
  `;

  showModalWithHTML(html);
  pollSyncStatus(syncLogId);
}

/**
 * Poll sync status until complete
 * @param {number} syncLogId - Sync log ID
 */
function pollSyncStatus(syncLogId) {
  let attempts = 0;
  const maxAttempts = 120; // 4 minutes at 2s intervals
  let lastProgressCount = 0;

  const interval = setInterval(async () => {
    attempts++;
    try {
      const result = await api.get('/wms-sync/status/' + syncLogId);
      const log = result.syncLog;
      const alertEl = document.getElementById('syncProgressAlert');
      const messageEl = document.getElementById('syncProgressMessage');
      const spinnerEl = document.getElementById('syncSpinner');
      const logEl = document.getElementById('syncProgressLog');
      const detailsEl = document.getElementById('syncResultDetails');

      if (!alertEl) {
        clearInterval(interval);
        return;
      }

      // Update progress log with new entries
      if (log.progress && log.progress.length > lastProgressCount) {
        for (let i = lastProgressCount; i < log.progress.length; i++) {
          const p = log.progress[i];
          const line = document.createElement('div');
          const isSaved = p.message.includes('Saved ');
          const isError = p.message.includes('Error') || p.message.includes('Failed');
          const isSkipped = p.message.includes('Skipped');
          const color = isError ? '#ff6b6b' : isSkipped ? '#ffd93d' : isSaved ? '#6bcb77' : '#a8b2d1';
          line.style.color = color;
          line.textContent = p.message; // textContent is safe (no HTML)
          logEl.appendChild(line);
        }
        logEl.scrollTop = logEl.scrollHeight;
        lastProgressCount = log.progress.length;

        // Update the main status message with the latest progress
        const latest = log.progress[log.progress.length - 1];
        if (latest && messageEl) {
          messageEl.textContent = latest.message; // textContent is safe
        }
      }

      if (log.status === 'COMPLETED') {
        clearInterval(interval);
        if (spinnerEl) spinnerEl.style.display = 'none';
        if (log.syncDetails) {
          try {
            const details = JSON.parse(log.syncDetails);
            const fillStep = details.steps && details.steps.find(s => s.step === 'fillEntries');
            const entered = fillStep ? fillStep.entriesEntered || 0 : details.entriesSynced || 0;
            const failed = fillStep ? fillStep.entriesFailed || 0 : 0;
            const skipped = fillStep ? fillStep.entriesSkipped || 0 : 0;
            const entries = fillStep ? fillStep.entries || [] : [];

            // Set alert style based on results
            if (failed > 0 && entered === 0) {
              alertEl.className = 'alert alert-danger';
              alertEl.innerHTML = '<strong>Sync completed with errors — no entries were saved.</strong>';
            } else if (failed > 0) {
              alertEl.className = 'alert alert-warning';
              alertEl.innerHTML = `<strong>Sync completed with ${failed} error(s).</strong>`;
            } else {
              alertEl.className = 'alert alert-success';
              alertEl.innerHTML = '<strong>Timesheet synced to DE WMS successfully!</strong>';
            }

            let summary = `Entries synced: ${entered}`;
            if (failed > 0) summary += ` | Failed: ${failed}`;
            if (skipped > 0) summary += ` | Skipped: ${skipped}`;
            summary += ` | Total hours: ${(details.totalHours || 0).toFixed(2)}`;

            // CRITICAL XSS FIX: Escape error messages from sync entries
            let errorDetails = '';
            const failedEntries = entries.filter(e => e.status === 'failed');
            if (failedEntries.length > 0) {
              errorDetails = '<ul style="margin: 0.5rem 0 0; padding-left: 1.25rem; color: #ff6b6b;">';
              failedEntries.forEach(e => {
                errorDetails += `<li>${escapeHtml(e.date)} ${escapeHtml(e.startTime || '')}-${escapeHtml(e.endTime || '')}: ${escapeHtml(e.error)}</li>`;
              });
              errorDetails += '</ul>';
            }

            detailsEl.innerHTML = `<p style="margin-top: 0.5rem;">${escapeHtml(summary)}</p>${errorDetails}`;
          } catch (_) {
            alertEl.className = 'alert alert-success';
            alertEl.innerHTML = '<strong>Timesheet synced to DE WMS successfully!</strong>';
          }
        } else {
          alertEl.className = 'alert alert-success';
          alertEl.innerHTML = '<strong>Timesheet synced to DE WMS successfully!</strong>';
        }
        refreshTimesheets();
      } else if (log.status === 'FAILED') {
        clearInterval(interval);
        if (spinnerEl) spinnerEl.style.display = 'none';
        alertEl.className = 'alert alert-danger';
        // CRITICAL XSS FIX: Escape error message from server
        alertEl.innerHTML = '<strong>Sync failed:</strong> ' + escapeHtml(log.errorMessage || 'Unknown error');
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        if (spinnerEl) spinnerEl.style.display = 'none';
        alertEl.className = 'alert alert-warning';
        alertEl.innerHTML = 'Sync is taking longer than expected. Check sync history later.';
      }
    } catch (error) {
      console.error('Poll error:', error);
    }
  }, 2000);
}

/**
 * View sync history for a timesheet
 * @param {number} timesheetId - Timesheet ID
 */
export async function viewSyncHistory(timesheetId) {
  try {
    const result = await api.get('/wms-sync/timesheet/' + timesheetId);
    const syncs = result.syncs;

    if (syncs.length === 0) {
      showModalWithHTML('<h3>Sync History</h3><p>No sync history for this timesheet.</p>');
      return;
    }

    const rows = syncs.map(sync => {
      const started = sync.startedAt ? new Date(sync.startedAt).toLocaleString() : new Date(sync.createdAt).toLocaleString();
      const duration = sync.startedAt && sync.completedAt
        ? Math.round((new Date(sync.completedAt) - new Date(sync.startedAt)) / 1000) + 's'
        : '-';
      // XSS FIX: Escape error message and username
      return `
        <tr>
          <td>${started}</td>
          <td><span class="status-badge status-${sync.status}">${sync.status}</span></td>
          <td>${escapeHtml(sync.wmsUsername) || '-'}</td>
          <td>${duration}</td>
          <td>${sync.errorMessage ? escapeHtml(sync.errorMessage) : (sync.status === 'COMPLETED' ? 'OK' : '-')}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <h3>Sync History</h3>
      <div class="table-responsive">
        <table>
          <thead>
            <tr><th>Started</th><th>Status</th><th>WMS User</th><th>Duration</th><th>Result</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    showModalWithHTML(html);
  } catch (error) {
    showAlert('Failed to load sync history: ' + error.message);
  }
}

/**
 * Refresh timesheets after sync
 */
async function refreshTimesheets() {
  const currentUser = state.get('currentUser');

  // Dynamically import to avoid circular dependencies
  const { loadMyTimesheets } = await import('../timesheets/timesheets.js');

  if (currentUser.employeeId) {
    await loadMyTimesheets();
  }

  if (currentUser.isAdmin) {
    const { loadAllTimesheets } = await import('../timesheets/timesheets.js');
    await loadAllTimesheets();
  }
}
