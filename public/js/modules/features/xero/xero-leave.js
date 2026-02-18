/**
 * Xero Leave Management Module
 * Handles leave request workflow and Xero sync
 */

import { api } from '../../core/api.js';
import { state } from '../../core/state.js';
import { showAlert } from '../../core/alerts.js';
import { showSlidePanel, hideSlidePanel } from '../../core/slide-panel.js';
import { registerTabHook } from '../../core/navigation.js';
import { initQuillEditor, quillGetHtml } from '../../core/quill.js';

let leaveBalances = null;

/**
 * Initialize leave management when tab is opened
 */
export async function initLeaveManagement() {
  const currentUser = state.get('currentUser');
  if (!currentUser) return;

  // Always clear both containers to prevent stale content from a previous session
  const employeeContainer = document.getElementById('xero-leave-employee');
  const adminContainer = document.getElementById('xero-leave-admin');
  if (employeeContainer) employeeContainer.innerHTML = '';
  if (adminContainer) {
    adminContainer.innerHTML = '';
    // Only show the divider for admins
    adminContainer.style.borderTop = currentUser.isAdmin ? '1px solid #e5e7eb' : 'none';
  }

  // If user is employee, show employee view
  if (currentUser.employeeId) {
    await showEmployeeLeaveView();
  }

  // If user is admin, show admin view
  if (currentUser.isAdmin) {
    await showAdminLeaveView();
  }
}

/**
 * Show employee leave request view
 */
async function showEmployeeLeaveView() {
  const container = document.getElementById('xero-leave-employee');
  if (!container) return;

  // Fetch employee's leave requests
  const requests = await fetchMyLeaveRequests();

  // Fetch leave balances from Xero
  leaveBalances = await fetchLeaveBalances();

  // Check if balances are actually available (not just a message)
  const hasBalances = leaveBalances && Array.isArray(leaveBalances) && leaveBalances.length > 0;

  container.innerHTML = `
    <div class="leave-employee-view">
      <div class="leave-header">
        <h2>My Leave Requests</h2>
        <button class="btn btn-primary" onclick="xeroLeave.showNewLeaveRequestPanel()">
          New Leave Request
        </button>
      </div>

      ${hasBalances ? `
        <div class="leave-balances">
          <h3>Your Leave Balances</h3>
          <div class="balance-grid">
            ${formatLeaveBalances(leaveBalances)}
          </div>
        </div>
      ` : ''}

      <div class="leave-requests">
        <h3>Your Leave Requests</h3>
        ${requests.length > 0 ? `
          <table class="leave-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Hours</th>
                <th>Status</th>
                <th>Approved By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${requests.map(req => `
                <tr class="leave-request-row status-${req.status.toLowerCase()}">
                  <td>${formatLeaveType(req.leaveType)}</td>
                  <td>${formatDate(req.startDate)}</td>
                  <td>${formatDate(req.endDate)}</td>
                  <td>${req.totalHours}h</td>
                  <td><span class="status-badge status-${req.status.toLowerCase()}">${req.status}</span></td>
                  <td>${req.approvedBy ? req.approvedBy.name : '-'}</td>
                  <td>
                    ${req.status === 'PENDING' ? `
                      <button class="btn btn-sm btn-danger" onclick="xeroLeave.deleteLeaveRequest(${req.id})">
                        Delete
                      </button>
                    ` : '-'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p class="no-data">No leave requests yet.</p>'}
      </div>
    </div>
  `;
}

/**
 * Show admin leave approval view
 */
async function showAdminLeaveView() {
  const container = document.getElementById('xero-leave-admin');
  if (!container) return;

  // Fetch all leave requests
  const requests = await fetchAllLeaveRequests();

  // Fetch all employee leave balances
  const allBalances = await fetchAllEmployeeBalances();

  const pending = requests.filter(r => r.status === 'PENDING');
  const processed = requests.filter(r => r.status !== 'PENDING');

  container.innerHTML = `
    <div class="leave-admin-view">
      <h2>Leave Request Management (Admin)</h2>

      ${allBalances.length > 0 ? `
        <div class="leave-section" style="margin-bottom: 2rem;">
          <h3>Employee Leave Balances</h3>
          <div style="display: grid; gap: 1.5rem;">
            ${allBalances.map(emp => `
              <div style="background: white; border-radius: 8px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                  <div>
                    <h4 style="margin: 0; color: #111827;">${escapeHtml(emp.employeeName)}</h4>
                    <p style="margin: 0.25rem 0 0 0; color: #6b7280; font-size: 0.875rem;">${escapeHtml(emp.email)}</p>
                  </div>
                </div>
                ${emp.notConfigured || !emp.balances ? `
                  <p style="color: #9ca3af; font-size: 0.875rem; margin: 0;">Not configured in Xero — no leave balance available.</p>
                ` : `
                  <div class="balance-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                    ${emp.balances.map(bal => {
                      const name = bal.leaveName || bal.LeaveName || bal.name || bal.Name || 'Unknown';
                      const units = bal.numberOfUnits || bal.NumberOfUnits || 0;
                      return `
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 1rem; color: white; text-align: center;">
                          <div style="font-size: 0.75rem; opacity: 0.9; margin-bottom: 0.5rem;">${escapeHtml(name)}</div>
                          <div style="font-size: 1.75rem; font-weight: 700;">${units}h</div>
                          <div style="font-size: 0.75rem; opacity: 0.8;">available</div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                `}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="leave-section">
        <h3>Pending Approval (${pending.length})</h3>
        ${pending.length > 0 ? `
          <table class="leave-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Hours</th>
                <th>Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${pending.map(req => `
                <tr>
                  <td>${req.employee.firstName} ${req.employee.lastName}</td>
                  <td>${formatLeaveType(req.leaveType)}</td>
                  <td>${formatDate(req.startDate)}</td>
                  <td>${formatDate(req.endDate)}</td>
                  <td>${req.totalHours}h</td>
                  <td style="max-width: 300px;">
                    <div class="leave-notes-preview">${req.notes ? req.notes : '-'}</div>
                  </td>
                  <td>
                    <button class="btn btn-sm btn-success" onclick="xeroLeave.approveLeaveRequest(${req.id})">
                      Approve
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="xeroLeave.rejectLeaveRequest(${req.id})">
                      Reject
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p class="no-data">No pending leave requests.</p>'}
      </div>

      <div class="leave-section">
        <h3>Processed Requests (${processed.length})</h3>
        ${processed.length > 0 ? `
          <table class="leave-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Hours</th>
                <th>Status</th>
                <th>Processed By</th>
                <th>Xero Sync</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${processed.map(req => `
                <tr class="status-${req.status.toLowerCase()}">
                  <td>${req.employee.firstName} ${req.employee.lastName}</td>
                  <td>${formatLeaveType(req.leaveType)}</td>
                  <td>${formatDate(req.startDate)}</td>
                  <td>${formatDate(req.endDate)}</td>
                  <td>${req.totalHours}h</td>
                  <td><span class="status-badge status-${req.status.toLowerCase()}">${req.status}</span></td>
                  <td>${req.approvedBy ? req.approvedBy.name : '-'}</td>
                  <td>${req.xeroLeaveId ? '✓ Synced' : '-'}</td>
                  <td>
                    ${req.status === 'APPROVED' ? `
                      <button class="btn btn-sm btn-warning" onclick="xeroLeave.rejectLeaveRequest(${req.id})" title="Reject and cancel in Xero">
                        Reject
                      </button>
                    ` : ''}
                    <button class="btn btn-sm btn-danger" onclick="xeroLeave.adminDeleteLeaveRequest(${req.id})" title="${req.xeroLeaveId ? 'Delete locally and cancel in Xero' : 'Delete'}">
                      Delete
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p class="no-data">No processed requests.</p>'}
      </div>
    </div>
  `;
}

/**
 * Show new leave request slide panel
 */
export function showNewLeaveRequestPanel() {
  // Calculate tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const panelContent = `
    <form id="new-leave-form" style="padding: 1.5rem;">
      <div class="form-group">
        <label for="leave-type">Leave Type</label>
        <select id="leave-type" name="leaveType" class="form-control" required>
          <option value="">Select type...</option>
          <option value="ANNUAL">Annual Leave</option>
          <option value="SICK">Sick Leave</option>
          <option value="PERSONAL">Personal Leave</option>
          <option value="UNPAID">Unpaid Leave</option>
        </select>
      </div>

      <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label for="start-date">Start Date</label>
          <input type="date" id="start-date" name="startDate" class="form-control" value="${tomorrowStr}" required />
        </div>

        <div class="form-group">
          <label for="end-date">End Date</label>
          <input type="date" id="end-date" name="endDate" class="form-control" value="${tomorrowStr}" required />
        </div>
      </div>

      <div class="form-group">
        <label for="leave-hours">Total Hours</label>
        <input type="number" id="leave-hours" name="totalHours" class="form-control" value="7.6" step="0.1" min="0" required />
        <small style="color: #6b7280; font-size: 0.875rem;">Default: 7.6 hours per day</small>
      </div>

      <div class="form-group">
        <label for="leave-reason">Reason for Leave</label>
        <div id="leaveReasonEditor" style="height: 150px; background: white;"></div>
      </div>

      <div class="form-actions" style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
        <button type="button" class="btn btn-secondary" onclick="hideSlidePanel()">Cancel</button>
        <button type="submit" class="btn btn-primary">Submit Request</button>
      </div>
    </form>
  `;

  showSlidePanel('New Leave Request', panelContent);

  // Initialize Quill editor and form handler
  requestAnimationFrame(() => {
    // Initialize WYSIWYG editor for reason
    const reasonEditor = initQuillEditor('leaveReasonEditor', 'Enter the reason for your leave request...');

    const form = document.getElementById('new-leave-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(e.target);

        // Get rich text content from Quill editor
        const reasonHtml = quillGetHtml(reasonEditor);

        // Add the editor content to form data
        const data = {
          leaveType: formData.get('leaveType'),
          startDate: formData.get('startDate'),
          endDate: formData.get('endDate'),
          totalHours: parseFloat(formData.get('totalHours')),
          notes: reasonHtml
        };

        await submitLeaveRequest(data);
      });
    }
  });
}

/**
 * Submit leave request
 */
async function submitLeaveRequest(data) {
  try {
    await api.post('/xero/leave/request', data);

    showAlert('Leave request submitted successfully!', 'success');
    hideSlidePanel();
    await showEmployeeLeaveView();
  } catch (error) {
    console.error('Error submitting leave request:', error);
    showAlert(error.message || 'Failed to create leave request', 'error');
  }
}

/**
 * Approve leave request
 */
export async function approveLeaveRequest(id) {
  if (!confirm('Approve this leave request? It will be synced to Xero.')) {
    return;
  }

  try {
    await api.post(`/xero/leave/approve/${id}`);
    showAlert('Leave request approved and synced to Xero!', 'success');
    await initLeaveManagement();
  } catch (error) {
    console.error('Error approving leave request:', error);
    showAlert(error.message || 'Failed to approve leave request', 'error');
  }
}

/**
 * Reject leave request
 */
export async function rejectLeaveRequest(id) {
  if (!confirm('Reject this leave request?')) {
    return;
  }

  try {
    await api.post(`/xero/leave/reject/${id}`);
    showAlert('Leave request rejected.', 'success');
    await initLeaveManagement();
  } catch (error) {
    console.error('Error rejecting leave request:', error);
    showAlert(error.message || 'Failed to reject leave request', 'error');
  }
}

/**
 * Delete leave request (employee's own pending request)
 */
export async function deleteLeaveRequest(id) {
  if (!confirm('Delete this leave request?')) {
    return;
  }

  try {
    await api.delete(`/xero/leave/request/${id}`);
    showAlert('Leave request deleted.', 'success');
    await initLeaveManagement();
  } catch (error) {
    console.error('Error deleting leave request:', error);
    showAlert(error.message || 'Failed to delete leave request', 'error');
  }
}

/**
 * Admin: delete any leave request (with optional Xero cancellation)
 */
export async function adminDeleteLeaveRequest(id) {
  if (!confirm('Delete this leave request? If it was synced to Xero, the leave application will also be cancelled.')) {
    return;
  }

  try {
    await api.delete(`/xero/leave/request/${id}`);
    showAlert('Leave request deleted.', 'success');
    await initLeaveManagement();
  } catch (error) {
    console.error('Error deleting leave request:', error);
    showAlert(error.message || 'Failed to delete leave request', 'error');
  }
}

/**
 * Fetch employee's own leave requests
 */
async function fetchMyLeaveRequests() {
  try {
    return await api.get('/xero/leave/my-requests');
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    showAlert('Failed to load leave requests', 'error');
    return [];
  }
}

/**
 * Fetch all leave requests (admin)
 */
async function fetchAllLeaveRequests() {
  try {
    return await api.get('/xero/leave/requests');
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    showAlert('Failed to load leave requests', 'error');
    return [];
  }
}

/**
 * Fetch leave balances from Xero
 */
async function fetchLeaveBalances() {
  try {
    const data = await api.get('/xero/leave/balances');
    return data.message ? null : data; // Return null if no balances available
  } catch (error) {
    console.error('Error fetching leave balances:', error);
    return null;
  }
}

/**
 * Fetch all employee leave balances (admin only)
 */
async function fetchAllEmployeeBalances() {
  try {
    return await api.get('/xero/leave/all-balances');
  } catch (error) {
    console.error('Error fetching all employee balances:', error);
    return [];
  }
}

/**
 * Format leave balances for display
 */
function formatLeaveBalances(balances) {
  if (!balances || !Array.isArray(balances) || balances.length === 0) {
    return '<p class="no-data">No leave balances available from Xero</p>';
  }

  return balances.map(balance => {
    // Handle both camelCase and PascalCase from Xero API
    const leaveName = balance.leaveName || balance.LeaveName ||
                      balance.leaveType || balance.LeaveType ||
                      balance.name || balance.Name || 'Unknown Leave';
    const units = balance.numberOfUnits || balance.NumberOfUnits || 0;

    return `
      <div class="balance-card">
        <div class="balance-type">${leaveName}</div>
        <div class="balance-hours">${units}h</div>
        <div class="balance-label">available</div>
      </div>
    `;
  }).join('');
}

/**
 * Format leave type for display
 */
function formatLeaveType(type) {
  const types = {
    'ANNUAL': 'Annual Leave',
    'SICK': 'Sick Leave',
    'PERSONAL': 'Personal Leave',
    'UNPAID': 'Unpaid Leave'
  };
  return types[type] || type;
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Export functions to global scope for onclick handlers
window.xeroLeave = {
  showNewLeaveRequestPanel,
  approveLeaveRequest,
  rejectLeaveRequest,
  deleteLeaveRequest,
  adminDeleteLeaveRequest
};

// Register tab hook
registerTabHook('leaveManagement', initLeaveManagement);
