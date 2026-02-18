/**
 * Xero Invoice Management Module
 * Admin-only view of monthly invoices for Local Technicians
 */

import { api } from '../../core/api.js';
import { state } from '../../core/state.js';
import { showAlert } from '../../core/alerts.js';
import { escapeHtml } from '../../core/dom.js';
import { registerTabHook } from '../../core/navigation.js';
import { showSlidePanel, hideSlidePanel } from '../../core/slide-panel.js';

/**
 * Initialize invoice management when tab is opened
 */
async function initInvoices() {
  const currentUser = state.get('currentUser');
  if (!currentUser?.isAdmin) return;

  await loadInvoices();
}

/**
 * Load and display all invoices
 */
async function loadInvoices() {
  const container = document.getElementById('xero-invoices-admin');
  if (!container) return;

  container.innerHTML = '<p style="padding: 1rem; color: #6b7280;">Loading invoices...</p>';

  try {
    const invoices = await api.get('/xero/invoice/list');
    renderInvoiceList(container, invoices);
  } catch (error) {
    console.error('Failed to load invoices:', error);
    container.innerHTML = '<p style="padding: 1rem; color: #ef4444;">Failed to load invoices.</p>';
  }
}

/**
 * Render the invoice list table
 */
function renderInvoiceList(container, invoices) {
  if (!invoices || invoices.length === 0) {
    container.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: #6b7280;">
        <p>No invoices found.</p>
        <p style="font-size: 0.875rem; margin-top: 0.5rem;">
          Invoices are created automatically when an LT employee's timesheet is approved.
        </p>
      </div>
    `;
    return;
  }

  const rows = invoices.map(inv => {
    const employeeName = escapeHtml(`${inv.employee.firstName} ${inv.employee.lastName}`);
    const companyName = escapeHtml(inv.company.name);
    const month = formatMonth(inv.invoiceMonth);
    const hours = Number(inv.totalHours).toFixed(2);
    const rate = Number(inv.hourlyRate).toFixed(2);
    const amount = Number(inv.totalAmount).toFixed(2);
    const entryCount = inv.entries.length;
    const statusBadge = renderStatusBadge(inv.status);
    const xeroId = inv.xeroInvoiceId
      ? `<span style="font-family: monospace; font-size: 0.8rem;">${escapeHtml(inv.xeroInvoiceId)}</span>`
      : '<span style="color: #9ca3af;">—</span>';

    return `
      <tr>
        <td>${employeeName}</td>
        <td>${companyName}</td>
        <td>${month}</td>
        <td style="text-align: right;">${hours}</td>
        <td style="text-align: right;">$${rate}/hr</td>
        <td style="text-align: right; font-weight: 600;">$${amount}</td>
        <td>${statusBadge}</td>
        <td>${xeroId}</td>
        <td style="text-align: center;">${entryCount}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="window.xeroInvoices.viewInvoice(${inv.id})">
            View
          </button>
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div style="padding: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="margin: 0;">LT Monthly Invoices</h3>
        <button class="btn btn-secondary" onclick="window.xeroInvoices.refresh()">Refresh</button>
      </div>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
              <th style="padding: 0.75rem; text-align: left; font-size: 0.875rem; white-space: nowrap;">Employee</th>
              <th style="padding: 0.75rem; text-align: left; font-size: 0.875rem; white-space: nowrap;">Company</th>
              <th style="padding: 0.75rem; text-align: left; font-size: 0.875rem; white-space: nowrap;">Month</th>
              <th style="padding: 0.75rem; text-align: right; font-size: 0.875rem; white-space: nowrap;">Total Hours</th>
              <th style="padding: 0.75rem; text-align: right; font-size: 0.875rem; white-space: nowrap;">Rate</th>
              <th style="padding: 0.75rem; text-align: right; font-size: 0.875rem; white-space: nowrap;">Amount</th>
              <th style="padding: 0.75rem; text-align: left; font-size: 0.875rem; white-space: nowrap;">Status</th>
              <th style="padding: 0.75rem; text-align: left; font-size: 0.875rem; white-space: nowrap;">Xero Invoice ID</th>
              <th style="padding: 0.75rem; text-align: center; font-size: 0.875rem; white-space: nowrap;">Timesheets</th>
              <th style="padding: 0.75rem; text-align: left; font-size: 0.875rem;"></th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Apply zebra striping
  container.querySelectorAll('tbody tr').forEach((row, i) => {
    row.style.background = i % 2 === 0 ? '#fff' : '#f9fafb';
    row.style.borderBottom = '1px solid #e5e7eb';
    row.querySelectorAll('td').forEach(td => {
      td.style.padding = '0.75rem';
      td.style.fontSize = '0.875rem';
    });
  });
}

/**
 * View details of a specific invoice
 */
async function viewInvoice(invoiceId) {
  try {
    const inv = await api.get(`/xero/invoice/${invoiceId}`);
    const employeeName = escapeHtml(`${inv.employee.firstName} ${inv.employee.lastName}`);
    const companyName = escapeHtml(inv.company.name);
    const month = formatMonth(inv.invoiceMonth);
    const hours = Number(inv.totalHours).toFixed(2);
    const rate = Number(inv.hourlyRate).toFixed(2);
    const amount = Number(inv.totalAmount).toFixed(2);

    const entriesHtml = inv.entries.length > 0 ? `
      <table style="width: 100%; border-collapse: collapse; margin-top: 0.5rem;">
        <thead>
          <tr style="background: #f9fafb; border-bottom: 1px solid #e5e7eb;">
            <th style="padding: 0.5rem 0.75rem; text-align: left; font-size: 0.8rem;">Week</th>
            <th style="padding: 0.5rem 0.75rem; text-align: right; font-size: 0.8rem;">Hours</th>
            <th style="padding: 0.5rem 0.75rem; text-align: left; font-size: 0.8rem;">Description</th>
          </tr>
        </thead>
        <tbody>
          ${inv.entries.map(e => `
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 0.5rem 0.75rem; font-size: 0.85rem;">
                ${formatDate(e.timesheet.weekStarting)} – ${formatDate(e.timesheet.weekEnding)}
              </td>
              <td style="padding: 0.5rem 0.75rem; text-align: right; font-size: 0.85rem;">${Number(e.hours).toFixed(2)}</td>
              <td style="padding: 0.5rem 0.75rem; font-size: 0.85rem; color: #6b7280;">${escapeHtml(e.description || '')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p style="color: #9ca3af; font-size: 0.875rem; margin: 0.5rem 0;">No entries.</p>';

    showSlidePanel('Invoice Details', `
      <div style="padding: 1.5rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem 1.5rem; margin-bottom: 1.5rem;">
          <div>
            <div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Employee</div>
            <div style="margin-top: 0.25rem;">${employeeName}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Company</div>
            <div style="margin-top: 0.25rem;">${companyName}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Month</div>
            <div style="margin-top: 0.25rem;">${month}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Status</div>
            <div style="margin-top: 0.25rem;">${renderStatusBadge(inv.status)}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Total Hours</div>
            <div style="margin-top: 0.25rem; font-size: 1.25rem; font-weight: 600;">${hours} hrs</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Hourly Rate</div>
            <div style="margin-top: 0.25rem; font-size: 1.25rem; font-weight: 600;">$${rate}/hr</div>
          </div>
          <div style="grid-column: 1 / -1; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 0.5rem; padding: 0.75rem 1rem;">
            <div style="font-size: 0.75rem; font-weight: 600; color: #166534; text-transform: uppercase; letter-spacing: 0.05em;">Total Amount</div>
            <div style="margin-top: 0.25rem; font-size: 1.5rem; font-weight: 700; color: #166534;">$${amount}</div>
          </div>
          ${inv.xeroInvoiceId ? `
            <div style="grid-column: 1 / -1;">
              <div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Xero Invoice ID</div>
              <div style="margin-top: 0.25rem; font-family: monospace; font-size: 0.85rem; color: #374151;">${escapeHtml(inv.xeroInvoiceId)}</div>
            </div>
          ` : ''}
        </div>

        <div style="border-top: 1px solid #e5e7eb; padding-top: 1rem;">
          <h4 style="margin: 0 0 0.75rem 0; font-size: 0.875rem; color: #374151;">
            Timesheets Included (${inv.entries.length})
          </h4>
          ${entriesHtml}
        </div>
      </div>
    `);
  } catch (error) {
    console.error('Failed to load invoice details:', error);
    showAlert('Failed to load invoice details.', 'error');
  }
}

/**
 * Format a date for display (YYYY-MM-DD → "1 Jan 2026")
 */
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Format invoice month ("January 2026")
 */
function formatMonth(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleString('en-AU', { month: 'long', year: 'numeric' });
}

/**
 * Render a coloured status badge
 */
function renderStatusBadge(status) {
  const colours = {
    DRAFT: 'background: #fef3c7; color: #92400e;',
    SUBMITTED: 'background: #dbeafe; color: #1e40af;',
    SENT: 'background: #d1fae5; color: #065f46;',
    PAID: 'background: #f0fdf4; color: #166534;',
    VOIDED: 'background: #fee2e2; color: #991b1b;'
  };
  const style = colours[status] || 'background: #f3f4f6; color: #374151;';
  return `<span style="padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; ${style}">${escapeHtml(status)}</span>`;
}

// Expose globals for onclick handlers
window.xeroInvoices = {
  refresh: loadInvoices,
  viewInvoice
};

// Register tab hook
registerTabHook('xeroInvoices', initInvoices);
