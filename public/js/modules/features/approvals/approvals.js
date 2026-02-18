/**
 * Approvals Module
 * Unified admin queue showing pending timesheets and pending leave requests
 */

import { api } from '../../core/api.js';
import { state } from '../../core/state.js';
import { showAlert } from '../../core/alerts.js';
import { registerTabHook } from '../../core/navigation.js';
import { escapeHtml } from '../../core/dom.js';
import { approveTimesheet, unlockTimesheet } from '../timesheets/timesheets.js';
import { approveLeaveRequest, rejectLeaveRequest } from '../xero/xero-leave.js';

/**
 * Initialize the approvals tab - load and render pending items
 */
export async function initApprovals() {
  const currentUser = state.get('currentUser');
  if (!currentUser?.isAdmin) return;

  const container = document.getElementById('approvalsContent');
  if (!container) return;

  container.innerHTML = '<p style="padding: 1rem; color: var(--muted);">Loading...</p>';

  try {
    // Load pending timesheets and leave requests in parallel
    const [tsResult, leaveResult] = await Promise.all([
      api.get('/timesheets?status=SUBMITTED'),
      api.get('/xero/leave/requests?status=PENDING')
    ]);

    const pendingTimesheets = tsResult.timesheets || [];
    const pendingLeave = Array.isArray(leaveResult) ? leaveResult : [];

    // Update badge
    const total = pendingTimesheets.length + pendingLeave.length;
    const badge = document.getElementById('approvalsBadge');
    if (badge) {
      badge.textContent = total;
      badge.style.display = total > 0 ? 'inline-flex' : 'none';
    }

    container.innerHTML = renderApprovals(pendingTimesheets, pendingLeave);
  } catch (error) {
    console.error('[Approvals] Error loading approvals:', error);
    container.innerHTML = '<p style="padding: 1rem; color: var(--danger);">Failed to load approvals.</p>';
  }
}

/**
 * Render both sections of the approvals page
 */
function renderApprovals(timesheets, leaveRequests) {
  return `
    <div style="padding: 1.5rem;">
      ${renderTimesheetSection(timesheets)}
      <div style="margin-top: 2rem;">
        ${renderLeaveSection(leaveRequests)}
      </div>
    </div>
  `;
}

function renderTimesheetSection(timesheets) {
  const rows = timesheets.length === 0
    ? '<tr><td colspan="4" style="text-align:center; color: var(--muted); padding: 1rem;">No timesheets awaiting approval</td></tr>'
    : timesheets.map(ts => {
        const employee = ts.employee;
        const name = employee ? `${employee.firstName} ${employee.lastName}` : '—';
        const week = new Date(ts.weekStarting).toLocaleDateString();
        const totalHours = (ts.entries || []).reduce((sum, e) => sum + e.hours, 0);
        return `
          <tr>
            <td>${escapeHtml(name)}</td>
            <td>${escapeHtml(week)}</td>
            <td>${totalHours.toFixed(1)} hrs</td>
            <td>
              <div style="display:flex; gap:0.5rem;">
                <button class="btn btn-sm btn-success" onclick="approvalsApproveTimesheet(${ts.id})">Approve</button>
                <button class="btn btn-sm btn-warning" onclick="approvalsUnlockTimesheet(${ts.id})" title="Send back to Open">Unlock</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

  return `
    <div>
      <h3 style="margin: 0 0 1rem 0;">Pending Timesheets <span class="nav-badge" style="display:inline-flex;">${timesheets.length}</span></h3>
      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Week Starting</th>
              <th>Hours</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderLeaveSection(leaveRequests) {
  const rows = leaveRequests.length === 0
    ? '<tr><td colspan="6" style="text-align:center; color: var(--muted); padding: 1rem;">No leave requests awaiting approval</td></tr>'
    : leaveRequests.map(lr => {
        const employee = lr.employee;
        const name = employee ? `${employee.firstName} ${employee.lastName}` : '—';
        const leaveType = formatLeaveType(lr.leaveType);
        const start = new Date(lr.startDate).toLocaleDateString();
        const end = new Date(lr.endDate).toLocaleDateString();
        const dates = start === end ? start : `${start} – ${end}`;
        const notes = lr.notes
          ? lr.notes.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
          : '';
        return `
          <tr>
            <td>${escapeHtml(name)}</td>
            <td>${escapeHtml(leaveType)}</td>
            <td>${escapeHtml(dates)}</td>
            <td>${lr.totalHours ? lr.totalHours.toFixed(1) + ' hrs' : '—'}</td>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(notes)}">${escapeHtml(notes)}</td>
            <td>
              <div style="display:flex; gap:0.5rem;">
                <button class="btn btn-sm btn-success" onclick="approvalsApproveLeave(${lr.id})">Approve</button>
                <button class="btn btn-sm btn-danger" onclick="approvalsRejectLeave(${lr.id})">Reject</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

  return `
    <div>
      <h3 style="margin: 0 0 1rem 0;">Pending Leave Requests <span class="nav-badge" style="display:inline-flex;">${leaveRequests.length}</span></h3>
      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Type</th>
              <th>Dates</th>
              <th>Hours</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function formatLeaveType(type) {
  const map = {
    ANNUAL: 'Annual Leave',
    SICK: "Personal/Carer's Leave",
    LONG_SERVICE: 'Long Service Leave',
    COMPASSIONATE: 'Compassionate Leave',
    UNPAID: 'Unpaid Leave',
    OTHER: 'Other'
  };
  return map[type] || type;
}

// ==================== Action wrappers that refresh the view ====================

window.approvalsApproveTimesheet = async (id) => {
  await approveTimesheet(id);
  await initApprovals();
};

window.approvalsUnlockTimesheet = async (id) => {
  await unlockTimesheet(id);
  await initApprovals();
};

window.approvalsApproveLeave = async (id) => {
  await approveLeaveRequest(id);
  await initApprovals();
};

window.approvalsRejectLeave = async (id) => {
  await rejectLeaveRequest(id);
  await initApprovals();
};

// Register tab hook
registerTabHook('approvals', initApprovals);
