/**
 * Xero Sync Logs Module
 * Displays sync logs, statistics, and sync status
 */

import { api } from '../../core/api.js';
import { state } from '../../core/state.js';
import { showAlert } from '../../core/alerts.js';
import { escapeHtml } from '../../core/dom.js';
import { registerTabHook } from '../../core/navigation.js';

let currentFilters = {
  status: '',
  type: ''
};

/**
 * Initialize sync logs when tab is opened
 */
export async function initXeroSyncLogs() {
  setupEventListeners();
  await loadSyncStats();
  await loadSyncLogs();
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Refresh button
  document.getElementById('refreshSyncLogsBtn')?.addEventListener('click', async () => {
    await loadSyncStats();
    await loadSyncLogs();
  });

  // Filter changes
  document.getElementById('syncLogStatusFilter')?.addEventListener('change', (e) => {
    currentFilters.status = e.target.value;
    loadSyncLogs();
  });

  document.getElementById('syncLogTypeFilter')?.addEventListener('change', (e) => {
    currentFilters.type = e.target.value;
    loadSyncLogs();
  });
}

/**
 * Load sync statistics
 */
async function loadSyncStats() {
  try {
    const stats = await api.get('/xero/sync/stats');
    displaySyncStats(stats);
  } catch (error) {
    console.error('Failed to load sync stats:', error);
  }
}

/**
 * Display sync statistics cards
 */
function displaySyncStats(stats) {
  const container = document.getElementById('syncStatsCards');

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;">
      <div class="stat-card" style="padding: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; color: white;">
        <div style="font-size: 2rem; font-weight: bold;">${stats.total || 0}</div>
        <div style="opacity: 0.9;">Total Syncs</div>
      </div>

      <div class="stat-card" style="padding: 1rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px; color: white;">
        <div style="font-size: 2rem; font-weight: bold;">${stats.successful || 0}</div>
        <div style="opacity: 0.9;">Successful</div>
        <div style="font-size: 0.875rem; opacity: 0.8; margin-top: 0.25rem;">
          ${stats.total > 0 ? Math.round(stats.successRate) : 0}% success rate
        </div>
      </div>

      <div class="stat-card" style="padding: 1rem; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 8px; color: white;">
        <div style="font-size: 2rem; font-weight: bold;">${stats.failed || 0}</div>
        <div style="opacity: 0.9;">Failed</div>
      </div>

      <div class="stat-card" style="padding: 1rem; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 8px; color: white;">
        <div style="font-size: 2rem; font-weight: bold;">${stats.pending || 0}</div>
        <div style="opacity: 0.9;">Pending</div>
      </div>

      <div class="stat-card" style="padding: 1rem; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); border-radius: 8px; color: white;">
        <div style="font-size: 2rem; font-weight: bold;">${stats.invoicesCreated || 0}</div>
        <div style="opacity: 0.9;">Invoices Created</div>
        ${stats.invoicesFailed > 0 ? `
          <div style="font-size: 0.875rem; opacity: 0.8; margin-top: 0.25rem;">
            ${stats.invoicesFailed} failed
          </div>
        ` : ''}
      </div>
    </div>

    ${stats.recentFailures && stats.recentFailures.length > 0 ? `
      <div style="margin-top: 1.5rem; padding: 1rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
        <h4 style="margin: 0 0 0.5rem 0; color: #dc2626;">Recent Failures (${stats.recentFailures.length})</h4>
        <div style="font-size: 0.875rem;">
          ${stats.recentFailures.slice(0, 5).map(failure => `
            <div style="padding: 0.5rem 0; border-bottom: 1px solid #fecaca;">
              <strong>${escapeHtml(failure.timesheet?.employee?.firstName || 'Unknown')} ${escapeHtml(failure.timesheet?.employee?.lastName || '')}</strong>
              - Week ${failure.timesheet?.weekStarting ? new Date(failure.timesheet.weekStarting).toLocaleDateString() : 'Unknown'}
              <div style="color: #991b1b; margin-top: 0.25rem;">${escapeHtml(failure.errorMessage || 'Unknown error')}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

/**
 * Load sync logs
 */
async function loadSyncLogs() {
  try {
    const params = new URLSearchParams({
      limit: '50',
      offset: '0',
      ...(currentFilters.status && { status: currentFilters.status }),
      ...(currentFilters.type && { syncType: currentFilters.type })
    });

    const result = await api.get(`/xero/sync/logs?${params}`);
    displaySyncLogs(result.logs);
  } catch (error) {
    console.error('Failed to load sync logs:', error);
  }
}

/**
 * Display sync logs
 */
function displaySyncLogs(logs) {
  const container = document.getElementById('syncLogsList');

  if (!logs || logs.length === 0) {
    container.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 2rem;">No sync logs found.</p>';
    return;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Date/Time</th>
          <th>Type</th>
          <th>Employee</th>
          <th>Week / Month</th>
          <th>Records</th>
          <th>Status</th>
          <th>Duration</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${logs.map(log => {
          const statusColors = {
            SUCCESS: '#10b981',
            ERROR: '#ef4444',
            PENDING: '#f59e0b',
            PARTIAL: '#3b82f6'
          };

          const statusColor = statusColors[log.status] || '#6b7280';

          const duration = log.completedAt && log.startedAt ?
            Math.round((new Date(log.completedAt) - new Date(log.startedAt)) / 1000) :
            null;

          const isInvoice = log.syncType === 'INVOICE_CREATE';

          // For invoice logs, pull the month from syncDetails if available
          let invoiceMonth = null;
          if (isInvoice && log.syncDetails) {
            try {
              const details = JSON.parse(log.syncDetails);
              if (details.monthName) invoiceMonth = details.monthName;
            } catch (_) {}
          }

          const contextCell = isInvoice
            ? (invoiceMonth || (log.xeroInvoiceId ? log.xeroInvoiceId.slice(0, 8) + '…' : '-'))
            : (log.timesheet?.weekStarting ? new Date(log.timesheet.weekStarting).toLocaleDateString() : '-');

          return `
            <tr>
              <td>${new Date(log.startedAt).toLocaleString()}</td>
              <td>
                <span style="font-size: 0.8rem; padding: 0.15rem 0.4rem; border-radius: 3px; background: ${isInvoice ? '#dbeafe' : '#f3f4f6'}; color: ${isInvoice ? '#1e40af' : '#374151'};">
                  ${escapeHtml(log.syncType)}
                </span>
              </td>
              <td>
                ${log.timesheet?.employee ?
                  `${escapeHtml(log.timesheet.employee.firstName)} ${escapeHtml(log.timesheet.employee.lastName)}` :
                  '-'
                }
              </td>
              <td>${escapeHtml(contextCell)}</td>
              <td>
                <span title="Processed: ${log.recordsProcessed}, Success: ${log.recordsSuccess}, Failed: ${log.recordsFailed}">
                  ${log.recordsSuccess}/${log.recordsProcessed}
                </span>
              </td>
              <td>
                <span style="display: inline-block; padding: 0.25rem 0.5rem; background: ${statusColor}22; color: ${statusColor}; border-radius: 4px; font-size: 0.875rem; font-weight: 500;">
                  ${escapeHtml(log.status)}
                </span>
              </td>
              <td>${duration !== null ? `${duration}s` : '-'}</td>
              <td>
                <button class="btn btn-sm btn-secondary" onclick="window.viewSyncLog(${log.id})">View</button>
                ${log.timesheetId ? `
                  <button class="btn btn-sm btn-primary" onclick="window.retrySyncLog(${log.timesheetId})">Retry</button>
                ` : ''}
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

/**
 * View sync log details
 */
window.viewSyncLog = async function(logId) {
  try {
    const log = await api.get(`/xero/sync/logs/${logId}`);

    const { showSlidePanel } = await import('../../core/slide-panel.js');

    const details = log.syncDetails ? JSON.parse(log.syncDetails) : {};

    const html = `
      <h2>Sync Log Details</h2>
      <div style="max-width: 600px;">
        <table style="width: 100%; margin-bottom: 1rem;">
          <tr>
            <td style="font-weight: 500; padding: 0.5rem 0;">Status:</td>
            <td>${escapeHtml(log.status)}</td>
          </tr>
          <tr>
            <td style="font-weight: 500; padding: 0.5rem 0;">Type:</td>
            <td>${escapeHtml(log.syncType)}</td>
          </tr>
          <tr>
            <td style="font-weight: 500; padding: 0.5rem 0;">Started:</td>
            <td>${new Date(log.startedAt).toLocaleString()}</td>
          </tr>
          ${log.completedAt ? `
            <tr>
              <td style="font-weight: 500; padding: 0.5rem 0;">Completed:</td>
              <td>${new Date(log.completedAt).toLocaleString()}</td>
            </tr>
          ` : ''}
          <tr>
            <td style="font-weight: 500; padding: 0.5rem 0;">Records Processed:</td>
            <td>${log.recordsProcessed}</td>
          </tr>
          <tr>
            <td style="font-weight: 500; padding: 0.5rem 0;">Successful:</td>
            <td>${log.recordsSuccess}</td>
          </tr>
          <tr>
            <td style="font-weight: 500; padding: 0.5rem 0;">Failed:</td>
            <td>${log.recordsFailed}</td>
          </tr>
          ${log.xeroTimesheetId ? `
            <tr>
              <td style="font-weight: 500; padding: 0.5rem 0;">Xero Timesheet ID:</td>
              <td style="font-family: monospace; font-size: 0.875rem;">${escapeHtml(log.xeroTimesheetId)}</td>
            </tr>
          ` : ''}
          ${log.xeroInvoiceId ? `
            <tr>
              <td style="font-weight: 500; padding: 0.5rem 0;">Xero Invoice ID:</td>
              <td style="font-family: monospace; font-size: 0.875rem;">${escapeHtml(log.xeroInvoiceId)}</td>
            </tr>
          ` : ''}
          ${log.xeroToken ? `
            <tr>
              <td style="font-weight: 500; padding: 0.5rem 0;">Xero Tenant:</td>
              <td>${escapeHtml(log.xeroToken.tenantName)}</td>
            </tr>
          ` : ''}
        </table>

        ${log.errorMessage ? `
          <div style="padding: 1rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; margin-bottom: 1rem;">
            <strong style="color: #dc2626;">Error:</strong>
            <pre style="margin: 0.5rem 0 0 0; white-space: pre-wrap; font-size: 0.875rem;">${escapeHtml(log.errorMessage)}</pre>
          </div>
        ` : ''}

        ${Object.keys(details).length > 0 ? `
          <div style="padding: 1rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px;">
            <strong>Sync Details:</strong>
            <pre style="margin: 0.5rem 0 0 0; white-space: pre-wrap; font-size: 0.875rem; max-height: 300px; overflow-y: auto;">${JSON.stringify(details, null, 2)}</pre>
          </div>
        ` : ''}
      </div>
    `;

    showSlidePanel('Sync Log Details', html);
  } catch (error) {
    console.error('Failed to load sync log:', error);
    showAlert('Failed to load sync log: ' + error.message, 'error');
  }
};

/**
 * Retry a failed sync
 */
window.retrySyncLog = async function(timesheetId) {
  try {
    await api.post(`/xero/sync/timesheet/${timesheetId}`);
    showAlert('Sync initiated successfully', 'success');

    setTimeout(async () => {
      await loadSyncStats();
      await loadSyncLogs();
    }, 2000);
  } catch (error) {
    console.error('Failed to retry sync:', error);
    showAlert('Failed to retry sync: ' + error.message, 'error');
  }
};

// Register tab hook
registerTabHook('xeroSyncLogs', initXeroSyncLogs);
