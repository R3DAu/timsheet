/**
 * Xero Dashboard Module
 * Aggregated health summary for Xero integration.
 *
 * Sections:
 *   1. Health Summary Cards  — sync rate, pending approvals, pending sync, leave pending
 *   2. Employee Sync Status  — per-employee table
 *   3. Pay Period Status     — per-tenant payroll calendar current run
 *   4. Recent Failures       — last 5 sync errors with retry
 *   5. Invoice Summary       — grouped by status with totals
 */

import { api } from '../../core/api.js';
import { state } from '../../core/state.js';
import { showAlert } from '../../core/alerts.js';
import { escapeHtml } from '../../core/dom.js';
import { registerTabHook } from '../../core/navigation.js';

// ─── Initialization ───────────────────────────────────────────────────────────

export async function initXeroDashboard() {
  const currentUser = state.get('currentUser');
  if (!currentUser?.isAdmin) return;

  setupEventListeners();
  await loadDashboard();
}

function setupEventListeners() {
  const btn = document.getElementById('xeroDashboardRefreshBtn');
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.addEventListener('click', loadDashboard);
  }
}

// ─── Data Loading ─────────────────────────────────────────────────────────────

async function loadDashboard() {
  setLoadingState();

  try {
    const [overview, stats, invoiceData, leaveData] = await Promise.all([
      api.get('/xero/reporting/overview'),
      api.get('/xero/sync/stats'),
      api.get('/xero/invoice/list').catch(() => ({ invoices: [] })),
      api.get('/xero/leave/requests').catch(() => [])
    ]);

    const invoices = invoiceData.invoices || invoiceData || [];
    const leaveRequests = Array.isArray(leaveData) ? leaveData : (leaveData.requests || []);
    const pendingLeave = leaveRequests.filter(r => r.status === 'PENDING');

    renderHealthCards(stats, overview, pendingLeave.length);
    renderEmployeeTable(overview);
    renderPayPeriods();
    renderRecentFailures(stats);
    renderInvoiceSummary(invoices);
  } catch (error) {
    console.error('[XeroDashboard] Load error:', error);
    showAlert('Failed to load dashboard: ' + error.message, 'error');
  }
}

function setLoadingState() {
  const ids = [
    'xeroDashboardCards',
    'xeroDashboardEmployeeTable',
    'xeroDashboardPayPeriods',
    'xeroDashboardFailures',
    'xeroDashboardInvoiceSummary'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<p style="color:#9ca3af;padding:0.5rem 0;">Loading…</p>';
  });
}

// ─── Section 1: Health Cards ──────────────────────────────────────────────────

function renderHealthCards(stats, overview, leavePendingCount) {
  const container = document.getElementById('xeroDashboardCards');
  if (!container) return;

  const successRate = stats.total > 0 ? Math.round(stats.successRate) : 0;
  const pendingApprovals = overview.reduce((s, e) => s + e.pendingApprovalCount, 0);
  const pendingSync      = overview.reduce((s, e) => s + e.pendingSyncCount, 0);

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;">

      <div style="padding:1.25rem;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:8px;color:#fff;">
        <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:.08em;opacity:.85;margin-bottom:.4rem;">Sync Health</div>
        <div style="font-size:2rem;font-weight:700;line-height:1;">${successRate}%</div>
        <div style="font-size:0.8rem;opacity:.85;margin-top:.2rem;">${stats.failed || 0} failed of ${stats.total || 0}</div>
        <div style="margin-top:.75rem;height:4px;background:rgba(255,255,255,.3);border-radius:2px;">
          <div style="height:100%;width:${successRate}%;background:#fff;border-radius:2px;"></div>
        </div>
      </div>

      <div style="padding:1.25rem;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:8px;color:#fff;">
        <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:.08em;opacity:.85;margin-bottom:.4rem;">Pending Approval</div>
        <div style="font-size:2rem;font-weight:700;line-height:1;">${pendingApprovals}</div>
        <div style="font-size:0.8rem;opacity:.85;margin-top:.2rem;">timesheets submitted</div>
      </div>

      <div style="padding:1.25rem;background:linear-gradient(135deg,#0ea5e9,#0284c7);border-radius:8px;color:#fff;">
        <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:.08em;opacity:.85;margin-bottom:.4rem;">Pending Sync</div>
        <div style="font-size:2rem;font-weight:700;line-height:1;">${pendingSync}</div>
        <div style="font-size:0.8rem;opacity:.85;margin-top:.2rem;">approved, not yet synced</div>
      </div>

      <div style="padding:1.25rem;background:linear-gradient(135deg,#10b981,#059669);border-radius:8px;color:#fff;">
        <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:.08em;opacity:.85;margin-bottom:.4rem;">Leave Pending</div>
        <div style="font-size:2rem;font-weight:700;line-height:1;">${leavePendingCount}</div>
        <div style="font-size:0.8rem;opacity:.85;margin-top:.2rem;">awaiting approval</div>
      </div>

    </div>
  `;
}

// ─── Section 2: Employee Sync Status Table ────────────────────────────────────

function renderEmployeeTable(overview) {
  const container = document.getElementById('xeroDashboardEmployeeTable');
  if (!container) return;

  if (!overview || overview.length === 0) {
    container.innerHTML = '<p style="color:#6b7280;font-size:.875rem;">No employees found.</p>';
    return;
  }

  const syncStatusColours = {
    SUCCESS: '#10b981',
    ERROR:   '#ef4444',
    PARTIAL: '#3b82f6',
    PENDING: '#f59e0b'
  };

  const rows = overview.map((emp, i) => {
    const name = `${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}`;

    const type = emp.xeroSettings?.employeeType;
    const typeBadge = type
      ? `<span style="padding:.15rem .4rem;border-radius:3px;font-size:.72rem;font-weight:600;background:${type === 'LT' ? '#dbeafe' : '#f3e8ff'};color:${type === 'LT' ? '#1e40af' : '#6b21a8'};">${type}</span>`
      : '<span style="color:#9ca3af;font-size:.8rem;">—</span>';

    const syncBadge = emp.xeroSettings === null
      ? '<span style="color:#9ca3af;font-size:.8rem;">Not configured</span>'
      : emp.xeroSettings.syncEnabled
        ? '<span style="padding:.15rem .4rem;border-radius:3px;font-size:.72rem;background:#d1fae5;color:#065f46;">Enabled</span>'
        : '<span style="padding:.15rem .4rem;border-radius:3px;font-size:.72rem;background:#fee2e2;color:#991b1b;">Disabled</span>';

    const mappedBadge = emp.isMapped
      ? '<span style="padding:.15rem .4rem;border-radius:3px;font-size:.72rem;background:#d1fae5;color:#065f46;">Yes</span>'
      : '<span style="padding:.15rem .4rem;border-radius:3px;font-size:.72rem;background:#fef3c7;color:#92400e;">No</span>';

    let lastSyncHtml = '<span style="color:#9ca3af;font-size:.8rem;">Never</span>';
    if (emp.lastSync) {
      const c = syncStatusColours[emp.lastSync.status] || '#6b7280';
      lastSyncHtml = `
        <span style="font-size:.8rem;color:#374151;">${relativeTime(emp.lastSync.startedAt)}</span>
        <span style="display:inline-block;margin-left:.3rem;padding:.1rem .35rem;border-radius:3px;font-size:.7rem;font-weight:600;background:${c}22;color:${c};">${emp.lastSync.status}</span>
      `;
    }

    const approvalCell = emp.pendingApprovalCount > 0
      ? `<span style="font-weight:600;color:#d97706;">${emp.pendingApprovalCount}</span>`
      : '<span style="color:#9ca3af;">0</span>';

    const syncCell = emp.pendingSyncCount > 0
      ? `<span style="font-weight:600;color:#0284c7;">${emp.pendingSyncCount}</span>`
      : '<span style="color:#9ca3af;">0</span>';

    return `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'};border-bottom:1px solid #f3f4f6;">
        <td style="padding:.55rem .75rem;font-size:.875rem;">${name}</td>
        <td style="padding:.55rem .75rem;">${typeBadge}</td>
        <td style="padding:.55rem .75rem;">${syncBadge}</td>
        <td style="padding:.55rem .75rem;">${mappedBadge}</td>
        <td style="padding:.55rem .75rem;">${lastSyncHtml}</td>
        <td style="padding:.55rem .75rem;text-align:center;">${approvalCell}</td>
        <td style="padding:.55rem .75rem;text-align:center;">${syncCell}</td>
        <td style="padding:.55rem .75rem;">
          <button class="btn btn-sm btn-secondary" onclick="window.xeroDashboard.viewLogs()">Logs</button>
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb;">
            <th style="padding:.6rem .75rem;text-align:left;font-size:.8rem;font-weight:600;">Employee</th>
            <th style="padding:.6rem .75rem;text-align:left;font-size:.8rem;font-weight:600;">Type</th>
            <th style="padding:.6rem .75rem;text-align:left;font-size:.8rem;font-weight:600;">Sync</th>
            <th style="padding:.6rem .75rem;text-align:left;font-size:.8rem;font-weight:600;">Mapped</th>
            <th style="padding:.6rem .75rem;text-align:left;font-size:.8rem;font-weight:600;">Last Sync</th>
            <th style="padding:.6rem .75rem;text-align:center;font-size:.8rem;font-weight:600;">Pending Approval</th>
            <th style="padding:.6rem .75rem;text-align:center;font-size:.8rem;font-weight:600;">Pending Sync</th>
            <th style="padding:.6rem .75rem;font-size:.8rem;"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ─── Section 3: Pay Period Status ─────────────────────────────────────────────

async function renderPayPeriods() {
  const container = document.getElementById('xeroDashboardPayPeriods');
  if (!container) return;

  try {
    const tenants = await api.get('/xero/auth/tenants');

    if (!Array.isArray(tenants) || tenants.length === 0) {
      container.innerHTML = '<p style="color:#9ca3af;font-size:.875rem;">No Xero tenants connected.</p>';
      return;
    }

    const calendarsByTenant = await Promise.all(
      tenants.map(t =>
        api.get(`/xero/setup/payroll-calendars/${t.tenantId}`)
          .then(data => ({ tenant: t, calendars: Array.isArray(data) ? data : [] }))
          .catch(() => ({ tenant: t, calendars: [] }))
      )
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const statusStyles = {
      DRAFT:  'background:#fef3c7;color:#92400e;',
      POSTED: 'background:#dbeafe;color:#1e40af;',
      PAID:   'background:#d1fae5;color:#065f46;'
    };

    let html = '';
    for (const { tenant, calendars } of calendarsByTenant) {
      const tenantLabel = `<div style="font-size:.8rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:.5rem;">${escapeHtml(tenant.tenantName)}</div>`;

      if (calendars.length === 0) {
        html += `<div style="margin-bottom:1.25rem;">${tenantLabel}<p style="color:#9ca3af;font-size:.85rem;">No payroll calendars found.</p></div>`;
        continue;
      }

      const calRows = calendars.map(cal => {
        const runs = cal.recentPayRuns || [];
        // Current run: most recent run whose period covers today, or just the most recent
        const currentRun = runs.find(r => new Date(r.periodEnd) >= today) || runs[0] || null;

        let statusHtml;
        if (currentRun) {
          const style = statusStyles[currentRun.status] || 'background:#f3f4f6;color:#374151;';
          statusHtml = `
            <span style="padding:.15rem .5rem;border-radius:9999px;font-size:.72rem;font-weight:600;${style}">${escapeHtml(currentRun.status)}</span>
            <span style="font-size:.8rem;color:#6b7280;margin-left:.5rem;">${formatDateShort(currentRun.periodStart)} – ${formatDateShort(currentRun.periodEnd)}</span>
          `;
        } else {
          statusHtml = `<span style="padding:.15rem .5rem;border-radius:9999px;font-size:.72rem;font-weight:600;background:#fee2e2;color:#991b1b;">No Pay Run</span>`;
        }

        return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid #f3f4f6;">
            <span style="font-size:.875rem;font-weight:500;">${escapeHtml(cal.name || cal.calendarName || 'Calendar')}</span>
            <div>${statusHtml}</div>
          </div>
        `;
      }).join('');

      html += `
        <div style="margin-bottom:1.25rem;">
          ${tenantLabel}
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:.5rem .75rem;">${calRows}</div>
        </div>
      `;
    }

    container.innerHTML = html || '<p style="color:#9ca3af;font-size:.875rem;">No calendar data available.</p>';
  } catch (error) {
    console.error('[XeroDashboard] Pay periods error:', error);
    container.innerHTML = '<p style="color:#ef4444;font-size:.875rem;">Failed to load pay period data.</p>';
  }
}

// ─── Section 4: Recent Failures ───────────────────────────────────────────────

function renderRecentFailures(stats) {
  const container = document.getElementById('xeroDashboardFailures');
  if (!container) return;

  const failures = stats.recentFailures || [];

  if (failures.length === 0) {
    container.innerHTML = `
      <div style="padding:1rem;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;color:#166534;font-size:.875rem;">
        No recent sync failures.
      </div>
    `;
    return;
  }

  const rows = failures.slice(0, 5).map(f => {
    const emp = f.timesheet?.employee;
    const empName = emp ? `${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}` : 'Unknown Employee';
    const weekStr = f.timesheet?.weekStarting
      ? 'Week of ' + new Date(f.timesheet.weekStarting).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
      : '';
    const retryBtn = f.timesheetId
      ? `<button class="btn btn-sm btn-primary" onclick="window.xeroDashboard.retrySync(${f.timesheetId})">Retry</button>`
      : '';

    return `
      <div style="padding:.75rem;border-bottom:1px solid #fecaca;display:flex;align-items:flex-start;gap:.75rem;">
        <div style="flex:1;">
          <div style="font-weight:500;font-size:.875rem;">${empName}</div>
          ${weekStr ? `<div style="font-size:.8rem;color:#6b7280;margin-top:.1rem;">${weekStr}</div>` : ''}
          <div style="font-size:.8rem;color:#991b1b;margin-top:.25rem;font-family:monospace;white-space:pre-wrap;max-width:600px;">
            ${escapeHtml(f.errorMessage || 'Unknown error')}
          </div>
        </div>
        <div>${retryBtn}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;overflow:hidden;">
      ${rows}
    </div>
  `;
}

// ─── Section 5: Invoice Summary ───────────────────────────────────────────────

function renderInvoiceSummary(invoices) {
  const container = document.getElementById('xeroDashboardInvoiceSummary');
  if (!container) return;

  if (!invoices || invoices.length === 0) {
    container.innerHTML = '<p style="color:#9ca3af;font-size:.875rem;">No invoices found.</p>';
    return;
  }

  const groups = {};
  for (const inv of invoices) {
    if (!groups[inv.status]) groups[inv.status] = { count: 0, total: 0 };
    groups[inv.status].count++;
    groups[inv.status].total += Number(inv.totalAmount) || 0;
  }

  const statusOrder = ['DRAFT', 'SUBMITTED', 'SENT', 'PAID', 'VOIDED'];
  const statusStyles = {
    DRAFT:     { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
    SUBMITTED: { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' },
    SENT:      { bg: '#d1fae5', color: '#065f46', border: '#a7f3d0' },
    PAID:      { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
    VOIDED:    { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' }
  };

  const totalCount = invoices.length;
  const totalAmount = invoices.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);

  const statusCards = statusOrder
    .filter(s => groups[s])
    .map(status => {
      const g = groups[status];
      const st = statusStyles[status] || { bg: '#f3f4f6', color: '#374151', border: '#e5e7eb' };
      return `
        <div style="padding:1rem 1.25rem;background:${st.bg};border:1px solid ${st.border};border-radius:8px;min-width:130px;">
          <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${st.color};margin-bottom:.35rem;">${status}</div>
          <div style="font-size:1.5rem;font-weight:700;color:${st.color};line-height:1;">${g.count}</div>
          <div style="font-size:.8rem;color:${st.color};margin-top:.2rem;opacity:.85;">$${g.total.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      `;
    }).join('');

  container.innerHTML = `
    <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-start;">
      ${statusCards}
      <div style="padding:1rem 1.25rem;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;min-width:130px;">
        <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#374151;margin-bottom:.35rem;">Total</div>
        <div style="font-size:1.5rem;font-weight:700;color:#111827;line-height:1;">${totalCount}</div>
        <div style="font-size:.8rem;color:#4b5563;margin-top:.2rem;">$${totalAmount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
    </div>
  `;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function relativeTime(dateStr) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateShort(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

// ─── Global onclick handlers ──────────────────────────────────────────────────

window.xeroDashboard = {
  viewLogs() {
    import('../../core/navigation.js').then(({ activateTab }) => activateTab('xeroSyncLogs'));
  },

  async retrySync(timesheetId) {
    try {
      await api.post(`/xero/sync/timesheet/${timesheetId}`);
      showAlert('Sync initiated. Refreshing in 2s…', 'success');
      setTimeout(loadDashboard, 2000);
    } catch (error) {
      showAlert('Failed to retry sync: ' + error.message, 'error');
    }
  }
};

// ─── Tab registration ─────────────────────────────────────────────────────────

registerTabHook('xeroDashboard', initXeroDashboard);
