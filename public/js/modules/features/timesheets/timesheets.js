import {api} from '../../core/api.js';
import {state} from '../../core/state.js';
import {escapeHtml, sanitizeRichText} from '../../core/dom.js';
import {registerTabHook} from '../../core/navigation.js';
import {showSlidePanel, hideSlidePanel} from '../../core/slide-panel.js';
import {showAlert, showConfirmation} from '../../core/alerts.js';
import {formatTime, todayStr, formatLocalDate} from '../../core/dateTime.js';
import {getWmsSyncButton} from '../wms/wms-sync.js';

export async function loadMyTimesheets() {
    const currentUser = state.get('currentUser');
    const result = await api.get(`/timesheets?employeeId=${currentUser.employeeId}`);
    state.set('myTimesheets', result.timesheets);
    await combineTimesheetsAndDedupe();

    // Auto-create current + next week timesheets
    await autoCreateTimesheets();

    // Reload after auto-create
    const updatedResult = await api.get(`/timesheets?employeeId=${currentUser.employeeId}`);
    state.set('myTimesheets', updatedResult.timesheets);
    await combineTimesheetsAndDedupe();

    // Display in unified view
    displayUnifiedTimesheets();
}

export async function loadAllTimesheets() {
    const result = await api.get('/timesheets');
    state.set('allTimesheets', result.timesheets);
    //let's get all of the timesheets and combine them into one list for easy lookup.
    await combineTimesheetsAndDedupe();
    displayAllTimesheets();
}

//create the table for the display timesheets.
function displayTimesheetsTable(tsArray, containerId, showEmployee) {
    const container = document.getElementById(containerId);
    const currentUser = state.get('currentUser');

    if(tsArray.length === 0) {
        container.innerHTML = '<p>No timesheets found.</p>';
        return;
    }

    const isAdmin = currentUser.isAdmin;

    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    ${showEmployee ? '<th>Employee</th>' : ''}
                    <th>Week</th>
                    <th>Status</th>
                    <th>Entries</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${tsArray.map(ts => `
                <tr>
                    ${showEmployee ? `<td>${escapeHtml(ts.employee.user.name)}</td>` : ''}
                    <td>${new Date(ts.weekStarting).toLocaleDateString()} - ${new Date(ts.weekEnding).toLocaleDateString()}</td>
                    <td>
                        <span class="status-badge status-${ts.status}">${ts.status}</span>
                        ${ts.autoCreated ? ' <span class="source-badge tsdata-badge" title="Auto-created from TSDATA sync">TSDATA</span>' : ''}
                        ${ts.tsDataStatus && ts.tsDataStatus !== ts.status ? `<br><small style="color:#666;">TSDATA: ${ts.tsDataStatus}</small>` : ''}
                    </td>
                    <td>${ts.entries.length}</td>
                    <td>${ts.submittedAt ? new Date(ts.submittedAt).toLocaleString() : ts.tsDataSyncedAt ? `<small>Synced ${new Date(ts.tsDataSyncedAt).toLocaleString()}</small>` : '-'}</td>
                    <td>
                      <button class="btn btn-sm btn-primary" onclick="viewTimesheet(${ts.id})">View</button>
                      ${ts.status === 'SUBMITTED' && isAdmin ? `
                        <button class="btn btn-sm btn-success" onclick="approveTimesheet(${ts.id})">Approve</button>
                      ` : ''}
                      ${ts.status === 'APPROVED' && isAdmin ? `
                        <button class="btn btn-sm btn-secondary" onclick="lockTimesheet(${ts.id})">Lock</button>
                      ` : ''}
                      ${getWmsSyncButton(ts)}
                      ${ts.status === 'OPEN' ? `
                        <button class="btn btn-sm btn-success" onclick="submitTimesheet(${ts.id})">Submit</button>
                      ` : ''}
                      <button class="btn btn-sm btn-danger" onclick="deleteTimesheet(${ts.id})">Delete</button>
                    </td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

export async function populateTimeSheetSelect(){
    const select = document.getElementById('timesheetSelect');
    let timesheets = state.get('timesheets');

    select.innerHTML = '<option value="">Select a timesheet...</option>' +
        timesheets.map(ts => {
            const label = currentUser.isAdmin
                ? `${escapeHtml(ts.employee.user.name)} - Week ${new Date(ts.weekStarting).toLocaleDateString()} - ${new Date(ts.weekEnding).toLocaleDateString()}`
                : `Week ${new Date(ts.weekStarting).toLocaleDateString()} - ${new Date(ts.weekEnding).toLocaleDateString()}`;
            return `<option value="${ts.id}">${label}</option>`;
        }).join('');
}

export async function createTimesheet(){
    const currentUser = state.get('currentUser');
    let employeeSelectHtml = '';

    //only draw this if the user is an admin.
    if(currentUser.isAdmin){
        const employees = await api.get('/employees');
        employeeSelectHtml = `
            <div class="form-group">
                <label>Employee</label>
                <select name="employeeId" required>
                    <option value="">Select employee...</option>
                    ${employees.filter(e => e.id !== currentUser.employeeId).map(e =>`<option value="${e.id}">${escapeHtml(e.user.name)}</option>`).join('')}
                </select>
            </div>
        `;
    }

    //The html for the modal.
    const html = `
        <form id="timesheetForm"> 
            ${employeeSelectHtml}
            <div class="form-group">
                <label>Week Starting</label>
                <input type="date" name="weekStarting" required>
            </div>
            <div class="form-group">
                <label>Week Ending</label>
                <input type="date" name="weekEnding" required>
            </div>
            <button type="submit" class="btn btn-primary">Create Timesheet</button>
        </form>
    `;

    //show the modal.
    showSlidePanel('Create Timesheet', html);
    const timesheetModal = document.getElementById('timesheetForm');

    //now let's attach to the submit action.
    timesheetModal.onsubmit = async (e) => {
        //stop the form from submitting by default.
        e.preventDefault();

        const formData = new FormData(e.target);
        const employeeId = formData.get('employeeId')
        ? parseInt(formData.get('employeeId'))
        : currentUser.employeeId;

        if(!employeeId){
            showAlert('No employee profile found. An admin must create an employee profile for your account first.');
        }

        try {
            await api.post('/timesheets',{
                employeeId,
                weekStarting: formData.get('weekStarting'),
                weekEnding: formData.get('weekEnding')
            });

            //magic the modal away :)
            hideSlidePanel();

            await refreshTimesheets();
        } catch (error) {
            showAlert(error.message);
        }
    };
}

export async function refreshTimesheets() {
    const currentUser = state.get('currentUser');

    //reload the timesheets list.
    if(currentUser.isAdmin) await loadAllTimesheets();
    if(currentUser.employeeId) await loadMyTimesheets();
}

export function displayMyTimesheets() {
    displayUnifiedTimesheets();
}

export async function displayAllTimesheets() {
    displayUnifiedTimesheets();
}

export async function submitTimesheet(id) {
    if (!await showConfirmation('Are you sure you want to submit this timesheet?')) return;
    try {
        await api.post(`/timesheets/${id}/submit`);
        await refreshTimesheets();
        showAlert('Timesheet submitted successfully');
    } catch (error) {
        showAlert(error.message);
    }
}

export async function approveTimesheet(id) {
    if (!await showConfirmation('Approve this timesheet?')) return;
    try {
        await api.post(`/timesheets/${id}/approve`);
        await refreshTimesheets();
        showAlert('Timesheet approved');
    } catch (error) {
        showAlert(error.message);
    }
}

export async function lockTimesheet(id) {
    if (!await showConfirmation('Lock this timesheet? No further edits will be allowed.')) return;
    try {
        await api.post(`/timesheets/${id}/lock`);
        await refreshTimesheets();
        showAlert('Timesheet locked');
    } catch (error) {
        showAlert(error.message);
    }
}

export async function unlockTimesheet(id) {
    if (!await showConfirmation('Unlock this timesheet? Status will be set to UNLOCKED so it can be edited and re-locked without re-submitting.')) return;
    try {
        await api.post(`/timesheets/${id}/unlock`);
        await refreshTimesheets();
        showAlert('Timesheet unlocked (status: UNLOCKED)');
    } catch (error) {
        showAlert(error.message);
    }
}

export async function setTimesheetOpen(id) {
    if (!showConfirmation('Set this timesheet back to OPEN? Entries will be editable again.')) return;
    try {
        await api.post(`/timesheets/${id}/change-status`, { status: 'OPEN' });
        await refreshTimesheets();
        showAlert('Timesheet set to OPEN');
    } catch (error) {
        showAlert(error.message);
    }
}

export async function deleteTimesheet(id) {
    if (!await showConfirmation('Are you sure you want to delete this timesheet and all its entries?')) return;
    try {
        await api.delete(`/timesheets/${id}`);
        await refreshTimesheets();
        showAlert('Timesheet deleted successfully');
    } catch (error) {
        showAlert(error.message);
    }
}

export async function xeroResyncTimesheet(id) {
    try {
        await api.post(`/xero/sync/timesheet/${id}`);
        await refreshTimesheets();
        showAlert('Xero sync successful', 'success');
    } catch (error) {
        showAlert('Xero sync failed: ' + error.message, 'error');
    }
}

//add in helper function to combine all timesheets into one list for easier lookup, dedupe by Id
export function combineTimesheetsAndDedupe(){
    const myTimesheets = state.get('myTimesheets');
    const allTimesheets = state.get('allTimesheets');
    const timesheets = [...myTimesheets];

    allTimesheets.forEach(ts => {
        if(!timesheets.find(t => t.id === ts.id)) timesheets.push(ts);
    });

    timesheets.sort((a, b) => new Date(b.weekStarting) - new Date(a.weekStarting));
    //let's store this in the state for easy lookup later
    state.set('timesheets', timesheets);
    //and return the work we've done here.
    return timesheets;
}

//helper function to get the current TimeDefaults for a timesheet.
function getTimeDefaults(timesheetId) {
    // Check how many entries exist for today on this timesheet
    const ts = state.get('timesheets').find(t => t.id === parseInt(timesheetId));
    const today = todayStr();
    const currentUser = state.get('currentUser');

    let todayEntryCount = 0;
    if (ts && ts.entries) {
        todayEntryCount = ts.entries.filter(e => {
            const d = formatLocalDate(e.date);
            return d === today;
        }).length;
    }

    const emp = currentUser.employee;
    const morning = {
        start: emp ? emp.morningStart : '08:30',
        end: emp ? emp.morningEnd : '12:30'
    };
    const afternoon = {
        start: emp ? emp.afternoonStart : '13:00',
        end: emp ? emp.afternoonEnd : '17:00'
    };

    // First entry of the day → morning, second → afternoon, else blank
    if (todayEntryCount === 0) return morning;
    if (todayEntryCount === 1) return afternoon;
    return { start: '', end: '' };
}

// ==================== NEW: UNIFIED ACCORDION VIEW ====================

/**
 * Returns a Xero sync status badge for APPROVED timesheets
 */
function getXeroSyncBadge(ts) {
  if (ts.status !== 'APPROVED') return '';
  if (ts.xeroTimesheetId) {
    return '<span class="source-badge xero-synced-badge" title="Synced to Xero">✓ Xero</span>';
  }
  const latestLog = ts.xeroSyncLogs?.[0];
  if (latestLog?.status === 'ERROR') {
    return `<span class="source-badge xero-error-badge" title="${escapeHtml(latestLog.errorMessage || 'Sync failed')}">✗ Xero</span>`;
  }
  return '<span class="source-badge xero-pending-badge" title="Pending Xero sync">⏳ Xero</span>';
}

/**
 * Returns a Xero resync button for APPROVED timesheets not yet successfully synced (admin only)
 */
function getXeroResyncButton(ts, currentUser) {
  if (!currentUser.isAdmin) return '';
  if (ts.status !== 'APPROVED') return '';
  if (ts.xeroTimesheetId) return ''; // Already synced — no button needed
  return `<button class="btn btn-sm btn-info" onclick="xeroResyncTimesheet(${ts.id})" title="Retry Xero sync">↻ Xero</button>`;
}

/**
 * Main render function - unified accordion view
 */
export function displayUnifiedTimesheets() {
  const currentUser = state.get('currentUser');
  const selectedEmployeeId = state.get('selectedEmployeeId');
  const container = document.getElementById('timesheetsAccordion');

  if (!container) return;

  // Determine which timesheets to show
  let timesheetsToShow;
  if (currentUser.isAdmin && selectedEmployeeId && selectedEmployeeId !== currentUser.employeeId) {
    timesheetsToShow = state.get('allTimesheets')
      .filter(ts => ts.employeeId === selectedEmployeeId);
  } else {
    timesheetsToShow = state.get('myTimesheets');
  }

  // Sort: OPEN first, then by weekStarting desc
  timesheetsToShow.sort((a, b) => {
    if (a.status === 'OPEN' && b.status !== 'OPEN') return -1;
    if (b.status === 'OPEN' && a.status !== 'OPEN') return 1;
    return new Date(b.weekStarting) - new Date(a.weekStarting);
  });

  if (timesheetsToShow.length === 0) {
    container.innerHTML = '<p style="padding: 1rem; color: var(--muted);">No timesheets found.</p>';
    return;
  }

  const accordionOpen = state.get('accordionOpen') || {};

  container.innerHTML = timesheetsToShow.map(ts => {
    const isOpen = accordionOpen[ts.id] || ts.status === 'OPEN';
    const totalHours = ts.entries.reduce((sum, e) => sum + e.hours, 0);
    const weekLabel = `${new Date(ts.weekStarting).toLocaleDateString()} - ${new Date(ts.weekEnding).toLocaleDateString()}`;

    return `
      <div class="accordion-item ${isOpen ? 'open' : ''}" data-ts-id="${ts.id}">
        <div class="accordion-header" onclick="toggleAccordion(${ts.id})">
          <div class="accordion-header-left">
            <span class="accordion-chevron">&#9654;</span>
            <span class="accordion-week">${weekLabel}</span>
            <span class="status-badge status-${ts.status}">${ts.status}</span>
            ${ts.autoCreated ? '<span class="source-badge tsdata-badge">TSDATA</span>' : ''}
            ${getXeroSyncBadge(ts)}
          </div>
          <div class="accordion-meta">
            <span>${ts.entries.length} entries</span>
            <span>&middot;</span>
            <span>${totalHours.toFixed(1)} hrs</span>
            <div class="accordion-actions" onclick="event.stopPropagation();">
              ${ts.status === 'OPEN' ? `<button class="btn btn-sm btn-success" onclick="submitTimesheet(${ts.id})">Submit</button>` : ''}
              ${ts.status === 'SUBMITTED' && currentUser.isAdmin ? `<button class="btn btn-sm btn-success" onclick="approveTimesheet(${ts.id})">Approve</button>` : ''}
              ${(ts.status === 'APPROVED' || ts.status === 'UNLOCKED') && currentUser.isAdmin ? `<button class="btn btn-sm btn-secondary" onclick="lockTimesheet(${ts.id})">Lock</button>` : ''}
              ${ts.status === 'UNLOCKED' && currentUser.isAdmin ? `<button class="btn btn-sm btn-info" onclick="setTimesheetOpen(${ts.id})" title="Set back to OPEN so entries can be freely edited">Set to Open</button>` : ''}
              ${getXeroResyncButton(ts, currentUser)}
              ${(ts.status === 'LOCKED' || ts.status === 'APPROVED' || ts.status === 'SUBMITTED') && currentUser.isAdmin ? `
                <button class="btn btn-sm btn-warning" onclick="unlockTimesheet(${ts.id})" title="Unlock and set to UNLOCKED">🔓 Unlock</button>
              ` : ''}
              ${getWmsSyncButton(ts)}
              ${currentUser.isAdmin ? `<button class="btn btn-sm btn-danger" onclick="deleteTimesheet(${ts.id})">Delete</button>` : ''}
            </div>
          </div>
        </div>
        <div class="accordion-body">
          <div class="accordion-body-inner">
            ${renderEntriesByDate(ts)}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Toggle accordion open/close
 */
export function toggleAccordion(timesheetId) {
  const accordionOpen = state.get('accordionOpen') || {};
  accordionOpen[timesheetId] = !accordionOpen[timesheetId];
  state.set('accordionOpen', accordionOpen);

  const item = document.querySelector(`.accordion-item[data-ts-id="${timesheetId}"]`);
  if (item) item.classList.toggle('open');
}

/**
 * Render entries grouped by date (with nested accordions)
 */
function renderEntriesByDate(ts) {
  if (ts.entries.length === 0) {
    return `
      <p style="color: var(--muted); font-size: 0.9rem;">No entries yet.</p>
      <button class="add-entry-btn" onclick="createEntryForTimesheet(${ts.id})">
        + Add Entry
      </button>
    `;
  }

  // Group entries by date
  const grouped = {};
  ts.entries.forEach(entry => {
    const dateKey = formatLocalDate(entry.date);
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(entry);
  });

  const sortedDates = Object.keys(grouped).sort(); // Chronological order (oldest first)
  const isEditable = ts.status === 'OPEN';
  const dateAccordionOpen = state.get('dateAccordionOpen') || {};

  return sortedDates.map(dateKey => {
    const dateEntries = grouped[dateKey].sort((a, b) => {
      if (!a.startTime || !b.startTime) return 0;
      return a.startTime.localeCompare(b.startTime);
    });
    const dayTotal = dateEntries.reduce((sum, e) => sum + e.hours, 0);
    const dateLabel = new Date(dateKey + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric'
    });
    const dateId = `${ts.id}-${dateKey}`;
    const isOpen = dateAccordionOpen[dateId] !== false; // Default open

    return `
      <div class="date-group ${isOpen ? 'open' : ''}" data-date-id="${dateId}">
        <div class="date-group-header" onclick="toggleDateAccordion('${dateId}')">
          <div class="date-group-header-left">
            <span class="date-chevron">&#9654;</span>
            <h4>${dateLabel}</h4>
          </div>
          <span class="date-hours">${dayTotal.toFixed(2)} hrs · ${dateEntries.length} entries</span>
        </div>
        <div class="date-group-body">
          <div class="date-group-body-inner">
            ${dateEntries.map(entry => renderEntryCard(entry, ts.id, isEditable)).join('')}
            ${isEditable ? `
              <button class="add-entry-btn" onclick="createEntryForDate(${ts.id}, '${dateKey}'); event.stopPropagation();">
                + Add Entry for ${dateLabel}
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('') + (isEditable ? `
    <button class="add-entry-btn" style="margin-top: 0.5rem;" onclick="createEntryForTimesheet(${ts.id})">
      + Add Entry
    </button>
  ` : '');
}

/**
 * Toggle date accordion open/close
 */
export function toggleDateAccordion(dateId) {
  const dateAccordionOpen = state.get('dateAccordionOpen') || {};
  dateAccordionOpen[dateId] = !dateAccordionOpen[dateId];
  state.set('dateAccordionOpen', dateAccordionOpen);

  const item = document.querySelector(`.date-group[data-date-id="${dateId}"]`);
  if (item) item.classList.toggle('open');
}

/**
 * Convert HTML rich-text to WMS-style plain text bullet points.
 * Mirrors the server-side htmlToBulletPoints() in wmsAutomation.js.
 */
function htmlToBulletPoints(html) {
  if (!html) return '';
  let text = html;
  // ul/ol → bullet lines
  text = text.replace(/<[uo]l[^>]*>([\s\S]*?)<\/[uo]l>/gi, (_, content) =>
    content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (__, item) =>
      `- ${item.replace(/<[^>]*>/g, '').trim()}`
    )
  );
  // remaining li
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, item) =>
    `- ${item.replace(/<[^>]*>/g, '').trim()}`
  );
  // paragraphs → bullet lines
  text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, content) => {
    const stripped = content.replace(/<[^>]*>/g, '').trim();
    return stripped ? `- ${stripped}` : '';
  });
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]*>/g, '');
  // decode common HTML entities
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Format a timesheet entry as a WMS comment string.
 */
function formatWmsComment(entry) {
  const parts = [];
  if (entry.startingLocation) parts.push(`[${entry.startingLocation}]`);

  if (entry.locationNotes) {
    try {
      const notes = typeof entry.locationNotes === 'string'
        ? JSON.parse(entry.locationNotes)
        : entry.locationNotes;
      if (Array.isArray(notes) && notes.length > 0) {
        notes.forEach(ln => {
          const loc = ln.location || 'General';
          const tasks = htmlToBulletPoints(ln.description || '');
          parts.push(`[${loc}]\n${tasks}`);
        });
      }
    } catch (_) { /* fall through */ }
  }

  if (parts.length <= (entry.startingLocation ? 1 : 0) && entry.notes) {
    parts.push(htmlToBulletPoints(entry.notes));
  }

  return parts.join('\n\n');
}

/**
 * Copy WMS-formatted comment for an entry to clipboard.
 * Called from inline onclick via window.copyWmsEntry.
 */
window.copyWmsEntry = async function(entryId) {
  // Find the entry in combined timesheets state
  const allTimesheets = state.get('timesheets') || [];
  let entry = null;
  for (const ts of allTimesheets) {
    entry = (ts.entries || []).find(e => e.id === entryId);
    if (entry) break;
  }
  if (!entry) { showAlert('Entry not found', 'error'); return; }

  const text = formatWmsComment(entry);
  if (!text) { showAlert('No comment text to copy', 'warning'); return; }

  try {
    await navigator.clipboard.writeText(text);
    showAlert('WMS comment copied to clipboard', 'success', 2500);
  } catch (_) {
    // Fallback for browsers without clipboard API
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showAlert('WMS comment copied to clipboard', 'success', 2500);
  }
};

/**
 * Render a single entry card (clickable to view details)
 */
function renderEntryCard(entry, timesheetId, isEditable) {
  const timeRange = entry.startTime && entry.endTime
    ? `${formatTime(entry.startTime)} - ${formatTime(entry.endTime)}`
    : 'No time set';

  const plainNotes = entry.notes
    ? entry.notes.replace(/<[^>]*>/g, '').substring(0, 100)
    : '';

  return `
    <div class="entry-card" onclick="viewEntrySlideIn(${entry.id}, ${timesheetId}, ${isEditable})">
      <div class="entry-card-main">
        <div class="entry-card-time">
          ${timeRange}
          <span class="entry-hours">${entry.hours.toFixed(2)} hrs &middot; ${entry.entryType}</span>
        </div>
        <div class="entry-card-role">${escapeHtml(entry.role.name)}</div>
        <div class="entry-card-company">${escapeHtml(entry.company.name)}</div>
        <div class="entry-card-badges">
          <span class="status-badge status-${entry.status}">${entry.status}</span>
          ${entry.tsDataSource ? '<span class="source-badge tsdata-badge">TSDATA</span>' : ''}
          ${entry.privateNotes ? '<span class="private-notes-badge">Private</span>' : ''}
        </div>
        ${entry.startingLocation ? `<div class="entry-card-location">📍 ${escapeHtml(entry.startingLocation)}</div>` : ''}
        ${plainNotes ? `<div class="entry-card-description">${escapeHtml(plainNotes)}</div>` : ''}
      </div>
      <div class="entry-card-actions" onclick="event.stopPropagation();">
        <button class="btn-icon" onclick="copyWmsEntry(${entry.id})" title="Copy WMS comment">&#128203;</button>
        ${isEditable ? `
          <button class="btn-icon" onclick="editEntrySlideIn(${entry.id}, ${timesheetId})" title="Edit">&#9998;</button>
          <button class="btn-icon btn-delete" onclick="deleteEntryFromCard(${entry.id}, ${timesheetId})" title="Delete">&times;</button>
        ` : state.get('currentUser').isAdmin ? `
          <span style="color:#999; font-size:0.75rem; margin-right:0.5rem;">Locked</span>
          <button class="btn-icon btn-delete" onclick="deleteEntryFromCard(${entry.id}, ${timesheetId})" title="Admin Delete">&times;</button>
        ` : '<span style="color:#999; font-size:0.75rem;">Locked</span>'}
      </div>
    </div>
  `;
}

// ==================== ADMIN EMPLOYEE SELECTOR ====================

let _employeeSelectorInitialized = false;

/**
 * Initialize employee selector for admins
 */
export function initEmployeeSelector() {
  const currentUser = state.get('currentUser');
  if (!currentUser.isAdmin) return;
  if (_employeeSelectorInitialized) return;

  const wrapper = document.getElementById('employeeSelectorWrapper');
  const input = document.getElementById('employeeSearchInput');
  const dropdown = document.getElementById('employeeDropdown');

  if (!wrapper || !input || !dropdown) return;

  _employeeSelectorInitialized = true;
  wrapper.style.display = '';
  input.placeholder = 'My Timesheets - Search to switch employee...';

  input.addEventListener('focus', () => {
    renderEmployeeDropdown('');
    dropdown.style.display = 'block';
  });

  input.addEventListener('input', (e) => {
    renderEmployeeDropdown(e.target.value);
  });

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });
}

/**
 * Render employee dropdown options
 */
function renderEmployeeDropdown(searchTerm) {
  const employees = state.get('employees');
  const currentUser = state.get('currentUser');
  const dropdown = document.getElementById('employeeDropdown');
  const selectedId = state.get('selectedEmployeeId');

  if (!dropdown) return;

  const filtered = employees.filter(emp => {
    const name = emp.user.name.toLowerCase();
    const email = emp.user.email.toLowerCase();
    const term = searchTerm.toLowerCase();
    return name.includes(term) || email.includes(term);
  });

  let html = `
    <div class="employee-dropdown-item employee-dropdown-item-self ${!selectedId || selectedId === currentUser.employeeId ? 'selected' : ''}"
         onclick="selectEmployee(null)">
      <span class="emp-name">My Timesheets</span>
    </div>
  `;

  html += filtered.map(emp => {
    const allTs = state.get('allTimesheets');
    const tsCount = allTs.filter(ts => ts.employeeId === emp.id).length;

    return `
      <div class="employee-dropdown-item ${selectedId === emp.id ? 'selected' : ''}"
           onclick="selectEmployee(${emp.id})">
        <span class="emp-name">${escapeHtml(emp.user.name)}</span>
        <span class="emp-ts-count">${tsCount} timesheets</span>
      </div>
    `;
  }).join('');

  dropdown.innerHTML = html;
}

/**
 * Select an employee (admin feature)
 */
export async function selectEmployee(employeeId) {
  const currentUser = state.get('currentUser');
  const input = document.getElementById('employeeSearchInput');
  const dropdown = document.getElementById('employeeDropdown');
  const heading = document.getElementById('timesheetsHeading');

  if (!employeeId || employeeId === currentUser.employeeId) {
    state.set('selectedEmployeeId', null);
    if (input) input.value = '';
    if (input) input.placeholder = 'My Timesheets - Search to switch employee...';
    if (heading) heading.textContent = 'My Timesheets';
  } else {
    state.set('selectedEmployeeId', employeeId);
    const employees = state.get('employees');
    const emp = employees.find(e => e.id === employeeId);
    if (input) input.value = emp ? emp.user.name : '';
    if (heading) heading.textContent = `Timesheets: ${emp ? emp.user.name : ''}`;
  }

  if (dropdown) dropdown.style.display = 'none';

  // Auto-create current + next week timesheets for the selected employee
  const targetId = state.get('selectedEmployeeId');
  if (targetId) {
    await autoCreateTimesheets(targetId);
    // Reload timesheets after auto-create so newly created ones appear
    const result = await api.get(`/timesheets?employeeId=${targetId}`);
    const allTimesheets = state.get('allTimesheets') || [];
    // Merge: replace entries for this employee
    const others = allTimesheets.filter(ts => ts.employeeId !== targetId);
    state.set('allTimesheets', [...others, ...(result.timesheets || [])]);
    await combineTimesheetsAndDedupe();
  }

  displayUnifiedTimesheets();
}

// ==================== AUTO-CREATE TIMESHEETS ====================

/**
 * Auto-create timesheets for current and next week.
 * @param {number} [targetEmployeeId] - Defaults to the logged-in user's employeeId.
 */
export async function autoCreateTimesheets(targetEmployeeId) {
  const currentUser = state.get('currentUser');
  const employeeId = targetEmployeeId || currentUser.employeeId;
  if (!employeeId) return;

  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const currentMonday = new Date(now);
  currentMonday.setDate(now.getDate() + mondayOffset);
  currentMonday.setHours(0, 0, 0, 0);

  const currentSunday = new Date(currentMonday);
  currentSunday.setDate(currentMonday.getDate() + 6);

  const nextMonday = new Date(currentMonday);
  nextMonday.setDate(currentMonday.getDate() + 7);
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);

  const weeks = [
    { start: currentMonday, end: currentSunday },
    { start: nextMonday, end: nextSunday }
  ];

  // For the current user use cached state; for other employees fetch fresh.
  let existingTimesheets;
  if (!targetEmployeeId || targetEmployeeId === currentUser.employeeId) {
    existingTimesheets = state.get('myTimesheets') || [];
  } else {
    const result = await api.get(`/timesheets?employeeId=${employeeId}`);
    existingTimesheets = result.timesheets || [];
  }

  for (const week of weeks) {
    const weekStartStr = week.start.toISOString().split('T')[0];
    const weekEndStr = week.end.toISOString().split('T')[0];

    const exists = existingTimesheets.some(ts => {
      const tsStart = formatLocalDate(ts.weekStarting);
      return tsStart === weekStartStr;
    });

    if (!exists) {
      try {
        await api.post('/timesheets', {
          employeeId,
          weekStarting: weekStartStr,
          weekEnding: weekEndStr
        });
      } catch (error) {
        console.log('Auto-create timesheet skipped:', error.message);
      }
    }
  }
}


registerTabHook('timesheets', displayUnifiedTimesheets);
registerTabHook('myTimesheets', displayMyTimesheets);
registerTabHook('allTimesheets', displayAllTimesheets);