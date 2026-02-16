import {api} from '../../core/api.js';
import {state} from '../../core/state.js';
import {escapeHtml, sanitizeRichText} from '../../core/dom.js';
import {registerTabHook} from '../../core/navigation.js';
import {showModalWithForm, hideModal} from '../../core/modal.js';
import {showAlert, showConfirmation} from '../../core/alerts.js';
import {formatTime, todayStr} from '../../core/dateTime.js';
import {getWmsSyncButton} from '../wms/wms.js';

export async function loadMyTimesheets() {
    const currentUser = state.get('currentUser');
    const result = await api.get(`/timesheets?employeeId=${currentUser.employeeId}`);
    state.set('myTimesheets', result.timesheets);
    //let's get all of the timesheets and combine them into one list for easy lookup.
    await combineTimesheetsAndDedupe();
    displayMyTimesheets();
    populateTimesheetSelect();
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
    showModalWithForm('Create Timesheet', html);
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
            hideModal();

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
    displayTimesheetsTable(state.get('myTimesheets'), 'myTimesheetsList', false);
}

export async function displayAllTimesheets() {
    displayTimesheetsTable(state.get('allTimesheets'), 'allTimesheetsList', true);
}

export async function viewTimesheet(id) {
    //get the timesheet from the state.
    const ts = state.get('timesheets').find(ts => ts.id === id);

    //let's return an error if we can't find it.
    if(!ts) {
        showAlert('Timesheet not found.');
        return;
    }

    const html = `
    <h3>${escapeHtml(ts.employee.user.name)}</h3>
      <p>Week ${new Date(ts.weekStarting).toLocaleDateString()} - ${new Date(ts.weekEnding).toLocaleDateString()}</p>
      <p><strong>Status:</strong> <span class="status-badge status-${ts.status}">${ts.status}</span></p>
      ${ts.approvedBy ? `<p><strong>Approved by:</strong> ${escapeHtml(ts.approvedBy.name)}</p>` : ''}
      ${ts.entries.length > 0 ? `
        <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Time</th>
              <th>Hours</th>
              <th>Company</th>
              <th>Role</th>
              <th>Location</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            ${ts.entries.map(entry => `
              <tr>
                <td>${new Date(entry.date).toLocaleDateString()}</td>
                <td>${entry.entryType}</td>
                <td style="white-space:nowrap;">${entry.startTime && entry.endTime ? `${formatTime(entry.startTime)} - ${formatTime(entry.endTime)}` : '-'}</td>
                <td>${entry.hours.toFixed(2)}</td>
                <td>${escapeHtml(entry.company.name)}</td>
                <td>${escapeHtml(entry.role.name)}</td>
                <td>${escapeHtml(entry.startingLocation) || '-'}</td>
                <td>
                  <div class="rich-text-content">${sanitizeRichText(entry.notes) || '-'}</div>
                  ${entry.reasonForDeviation ? `<div style="margin-top:0.25rem;padding:0.25rem 0.5rem;background:#fff3cd;border-radius:4px;border-left:3px solid #ffc107;"><small><strong>Deviation:</strong> ${sanitizeRichText(entry.reasonForDeviation)}</small></div>` : ''}
                  ${entry.entryType === 'TRAVEL' ? `<br><small>${escapeHtml(entry.travelFrom)} &rarr; ${escapeHtml(entry.travelTo)}${entry.distance ? ` (${entry.distance.toFixed(1)} km)` : ''}</small>` : ''}
                  ${entry.locationNotes ? (() => {
                        try {
                            const lnotes = typeof entry.locationNotes === 'string' ? JSON.parse(entry.locationNotes) : entry.locationNotes;
                            return lnotes.map(ln => `<div style="margin-top:0.5rem;padding:0.25rem 0.5rem;background:#e8f4fd;border-radius:4px;border-left:3px solid #3498db;"><strong>${escapeHtml(ln.location)}</strong><div class="rich-text-content">${sanitizeRichText(ln.description)}</div></div>`).join('');
                        } catch(e) { return ''; }
                    })() : ''}
                  ${entry.privateNotes ? `<br><span class="private-notes-badge">Private notes</span>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        </div>
        <p><strong>Total Hours:</strong> ${ts.entries.reduce((sum, e) => sum + e.hours, 0).toFixed(2)}</p>
      ` : '<p>No entries yet</p>'}
      <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
        <button class="btn btn-secondary" onclick="hideModal(); showDeWmsEntries(${id});">DE WMS Entries</button>
      </div>
    `;

    try{
        showModalWithForm('Timesheet Details', html);
    }catch (e){
        showAlert(e);
    }
}

export async function submitTimesheet(id) {
    if (!showConfirmation('Are you sure you want to submit this timesheet?')) return;
    try {
        await api.post(`/timesheets/${id}/submit`);
        await refreshTimesheets();
        showAlert('Timesheet submitted successfully');
    } catch (error) {
        showAlert(error.message);
    }
}

export async function approveTimesheet(id) {
    if (!showConfirmation('Approve this timesheet?')) return;
    try {
        await api.post(`/timesheets/${id}/approve`);
        await refreshTimesheets();
        showAlert('Timesheet approved');
    } catch (error) {
        showAlert(error.message);
    }
}

export async function lockTimesheet(id) {
    if (!showConfirmation('Lock this timesheet? No further edits will be allowed.')) return;
    try {
        await api.post(`/timesheets/${id}/lock`);
        await refreshTimesheets();
        showAlert('Timesheet locked');
    } catch (error) {
        showAlert(error.message);
    }
}

export async function deleteTimesheet(id) {
    if (!showConfirmation('Are you sure you want to delete this timesheet?')) return;
    try {
        await api.delete(`/timesheets/${id}`);
        await refreshTimesheets();
    } catch (error) {
        showAlert(error.message);
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
            const d = new Date(e.date).toISOString().split('T')[0];
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

registerTabHook('myTimesheets', displayMyTimesheets);
registerTabHook('allTimesheets', displayAllTimesheets);