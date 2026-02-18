/**
 * WMS Comparison module - Compare timesheet entries with DE WMS data
 * XSS FIXES: Escape worker IDs, names, company names, and error messages
 */

import { api } from '../../core/api.js';
import { showSlidePanel } from '../../core/slide-panel.js';
import { showAlert } from '../../core/alerts.js';
import { escapeHtml } from '../../core/dom.js';

/**
 * Show DE WMS entry comparison for a timesheet
 * @param {number} timesheetId - Timesheet ID
 */
export async function showDeWmsEntries(timesheetId) {
  try {
    const result = await api.get(`/timesheets/${timesheetId}`);
    const ts = result.timesheet;

    // Find the employee's DE worker identifier
    const employee = ts.employee;
    let workerId = null;
    if (employee.identifiers) {
      const deId = employee.identifiers.find(i => i.identifierType === 'de_worker_id');
      if (deId) workerId = deId.identifierValue;
    }

    const fromDate = new Date(ts.weekStarting).toISOString().split('T')[0];
    const toDate = new Date(ts.weekEnding).toISOString().split('T')[0];

    // Fetch DE WMS entries from tsdata
    let wmsEntries = [];
    let fetchError = null;
    try {
      const params = new URLSearchParams({ fromDate, toDate });
      if (workerId) params.set('workerId', workerId);
      const wmsResult = await api.get(`/tsdata/timesheets?${params.toString()}`);
      wmsEntries = wmsResult.timesheets || [];
    } catch (err) {
      fetchError = err.message;
    }

    // Build comparison
    const ourEntries = ts.entries.map(e => ({
      date: new Date(e.date).toLocaleDateString(),
      dateRaw: new Date(e.date).toISOString().split('T')[0],
      startTime: e.startTime || '-',
      endTime: e.endTime || '-',
      hours: e.hours,
      company: e.company.name,
      source: 'ours'
    }));

    const wmsFormatted = wmsEntries.map(e => ({
      date: e.date ? new Date(e.date).toLocaleDateString() : '-',
      dateRaw: e.date ? new Date(e.date).toISOString().split('T')[0] : '',
      startTime: e.startTime || e.start_time || '-',
      endTime: e.endTime || e.end_time || '-',
      hours: e.hours || e.totalHours || 0,
      // XSS FIX: Escape company/school name from WMS data
      company: e.company || e.school || '-',
      source: 'wms'
    }));

    // Match entries by date
    const allDates = [...new Set([...ourEntries.map(e => e.dateRaw), ...wmsFormatted.map(e => e.dateRaw)])].sort();

    let comparisonRows = '';
    for (const date of allDates) {
      const ours = ourEntries.filter(e => e.dateRaw === date);
      const wms = wmsFormatted.filter(e => e.dateRaw === date);
      const maxRows = Math.max(ours.length, wms.length, 1);

      for (let i = 0; i < maxRows; i++) {
        const ourEntry = ours[i];
        const wmsEntry = wms[i];

        let status = '';
        if (ourEntry && wmsEntry) {
          const hoursMatch = Math.abs(ourEntry.hours - wmsEntry.hours) < 0.05;
          status = hoursMatch
            ? '<span class="status-badge status-APPROVED">Matched</span>'
            : '<span class="status-badge status-INCOMPLETE">Hours Differ</span>';
        } else if (ourEntry && !wmsEntry) {
          status = '<span class="status-badge status-SUBMITTED">Missing in WMS</span>';
        } else {
          status = '<span class="status-badge status-LOCKED">Extra in WMS</span>';
        }

        comparisonRows += `
          <tr>
            ${i === 0 ? `<td rowspan="${maxRows}">${new Date(date).toLocaleDateString()}</td>` : ''}
            <td>${ourEntry ? `${ourEntry.startTime} - ${ourEntry.endTime}` : '-'}</td>
            <td>${ourEntry ? ourEntry.hours.toFixed(2) : '-'}</td>
            <td>${ourEntry ? escapeHtml(ourEntry.company) : '-'}</td>
            <td>${wmsEntry ? `${wmsEntry.startTime} - ${wmsEntry.endTime}` : '-'}</td>
            <td>${wmsEntry ? Number(wmsEntry.hours).toFixed(2) : '-'}</td>
            <td>${wmsEntry ? escapeHtml(wmsEntry.company) : '-'}</td>
            <td>${status}</td>
          </tr>
        `;
      }
    }

    const html = `
      <h3>DE WMS Entry Comparison</h3>
      <p>${escapeHtml(ts.employee.user.name)} &mdash; Week ${new Date(ts.weekStarting).toLocaleDateString()} - ${new Date(ts.weekEnding).toLocaleDateString()}</p>
      ${workerId ? `<p><small>DE Worker ID: ${escapeHtml(workerId)}</small></p>` : '<p style="color: #e67e22;"><small>No DE WMS worker identifier found for this employee. Showing all entries for the date range.</small></p>'}
      ${fetchError ? `<div class="alert alert-danger" style="padding: 0.75rem; background: #f8d7da; border-radius: 4px; margin-bottom: 1rem;">Could not fetch WMS data: ${escapeHtml(fetchError)}</div>` : ''}
      ${allDates.length > 0 ? `
        <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th rowspan="2">Date</th>
              <th colspan="3" style="text-align:center; border-bottom: 2px solid #3498db;">Our Entries</th>
              <th colspan="3" style="text-align:center; border-bottom: 2px solid #e67e22;">DE WMS Entries</th>
              <th rowspan="2">Status</th>
            </tr>
            <tr>
              <th>Time</th>
              <th>Hours</th>
              <th>Company</th>
              <th>Time</th>
              <th>Hours</th>
              <th>Company</th>
            </tr>
          </thead>
          <tbody>
            ${comparisonRows}
          </tbody>
        </table>
        </div>
      ` : '<p>No entries found for comparison.</p>'}
    `;

    showSlidePanel('DE WMS Entries', html, { wide: true });
  } catch (error) {
    showAlert('Failed to load DE WMS comparison: ' + error.message);
  }
}
