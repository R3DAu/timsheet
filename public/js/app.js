// Global state
let currentUser = null;
let companies = [];
let roles = [];
let employees = [];
let timesheets = [];
let myTimesheets = [];
let allTimesheets = [];
let users = [];
let activeQuillEditors = {};
let locationNoteCounter = 0;

// Time helpers
function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function calculateHoursPreview(startTime, endTime) {
  if (!startTime || !endTime) return '';
  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);
  let startMins = sH * 60 + sM;
  let endMins = eH * 60 + eM;
  if (endMins <= startMins) endMins += 24 * 60;
  const hours = (endMins - startMins) / 60;
  return `${hours.toFixed(2)} hrs`;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function getTimeDefaults(timesheetId) {
  // Check how many entries exist for today on this timesheet
  const ts = [...myTimesheets, ...allTimesheets].find(t => t.id === parseInt(timesheetId));
  const today = todayStr();
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

function initQuillEditor(containerId, placeholder) {
  const editor = new Quill(`#${containerId}`, {
    theme: 'snow',
    placeholder: placeholder || 'Enter details...',
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['link'],
        ['clean']
      ]
    }
  });
  activeQuillEditors[containerId] = editor;
  return editor;
}

function destroyQuillEditors() {
  activeQuillEditors = {};
  locationNoteCounter = 0;
}

// ==================== LOCATION AUTOCOMPLETE ====================

let activeAutocompletes = [];
let autocompleteDebounceTimers = {};

function destroyAutocompletes() {
  document.querySelectorAll('.location-autocomplete-dropdown').forEach(el => el.remove());
  activeAutocompletes = [];
  autocompleteDebounceTimers = {};
}

/**
 * Attach autocomplete to a text input. Shows saved locations + Google Places results.
 * Dropdown includes "Use as entered" to accept typed text as-is.
 * @param {HTMLInputElement} input - The input element
 */
function attachLocationAutocomplete(input) {
  const id = 'ac_' + Math.random().toString(36).slice(2, 8);
  input.dataset.acId = id;
  activeAutocompletes.push(id);

  // Get preset addresses from current user's employee profile
  const presets = [];
  if (currentUser && currentUser.employee && currentUser.employee.presetAddresses) {
    try {
      const pa = typeof currentUser.employee.presetAddresses === 'string'
        ? JSON.parse(currentUser.employee.presetAddresses)
        : currentUser.employee.presetAddresses;
      if (pa && typeof pa === 'object') {
        for (const [label, addr] of Object.entries(pa)) {
          presets.push({ label, address: addr });
        }
      }
    } catch (e) { /* ignore */ }
  }

  input.addEventListener('input', () => {
    const query = input.value.trim();
    clearTimeout(autocompleteDebounceTimers[id]);

    if (query.length < 2) {
      removeDropdown(id);
      return;
    }

    autocompleteDebounceTimers[id] = setTimeout(async () => {
      // Filter presets that match
      const matchingPresets = presets.filter(p =>
        p.label.toLowerCase().includes(query.toLowerCase()) ||
        p.address.toLowerCase().includes(query.toLowerCase())
      );

      // Fetch Google Places results
      let places = [];
      try {
        const res = await api.get(`/maps/search?query=${encodeURIComponent(query)}`);
        places = res.results || [];
      } catch (e) {
        console.warn('Location search failed:', e.message || e);
      }

      showDropdown(input, id, matchingPresets, places, query);
    }, 300);
  });

  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 2) {
      input.dispatchEvent(new Event('input'));
    } else if (presets.length > 0) {
      showDropdown(input, id, presets, [], '');
    }
  });

  // Close dropdown on blur (with delay to allow click)
  input.addEventListener('blur', () => {
    setTimeout(() => removeDropdown(id), 200);
  });
}

function showDropdown(input, id, presets, places, query) {
  removeDropdown(id);

  const dropdown = document.createElement('div');
  dropdown.className = 'location-autocomplete-dropdown';
  dropdown.id = 'dropdown_' + id;
  dropdown.style.cssText = 'position:absolute;z-index:2000;background:white;border:1px solid #ddd;border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,0.15);max-height:250px;overflow-y:auto;';

  if (presets.length > 0) {
    const header = document.createElement('div');
    header.style.cssText = 'padding:4px 10px;font-size:0.75rem;color:#999;font-weight:600;text-transform:uppercase;border-bottom:1px solid #eee;';
    header.textContent = 'Saved Locations';
    dropdown.appendChild(header);

    for (const p of presets) {
      const item = document.createElement('div');
      item.style.cssText = 'padding:8px 10px;cursor:pointer;border-bottom:1px solid #f5f5f5;';
      item.innerHTML = `<strong>${escapeHtml(p.label)}</strong><br><small style="color:#666;">${escapeHtml(p.address)}</small>`;
      item.onmousedown = (e) => {
        e.preventDefault();
        input.value = p.label;
        removeDropdown(id);
      };
      item.onmouseenter = () => item.style.background = '#f0f8ff';
      item.onmouseleave = () => item.style.background = '';
      dropdown.appendChild(item);
    }
  }

  if (places.length > 0) {
    const header = document.createElement('div');
    header.style.cssText = 'padding:4px 10px;font-size:0.75rem;color:#999;font-weight:600;text-transform:uppercase;border-bottom:1px solid #eee;';
    header.textContent = 'Search Results';
    dropdown.appendChild(header);

    for (const p of places.slice(0, 5)) {
      const item = document.createElement('div');
      item.style.cssText = 'padding:8px 10px;cursor:pointer;border-bottom:1px solid #f5f5f5;';
      item.innerHTML = `<strong>${escapeHtml(p.mainText)}</strong><br><small style="color:#666;">${escapeHtml(p.secondaryText)}</small>`;
      item.onmousedown = (e) => {
        e.preventDefault();
        input.value = p.mainText;
        removeDropdown(id);
      };
      item.onmouseenter = () => item.style.background = '#f0f8ff';
      item.onmouseleave = () => item.style.background = '';
      dropdown.appendChild(item);
    }
  }

  // "Use as-is" option at the bottom when the user has typed something
  if (query && query.length >= 1) {
    const useAsIs = document.createElement('div');
    useAsIs.style.cssText = 'padding:8px 10px;cursor:pointer;background:#f8f9fa;border-top:1px solid #ddd;color:#555;font-style:italic;';
    useAsIs.innerHTML = `Use "<strong>${escapeHtml(query)}</strong>" as entered`;
    useAsIs.onmousedown = (e) => {
      e.preventDefault();
      removeDropdown(id);
    };
    useAsIs.onmouseenter = () => useAsIs.style.background = '#e9ecef';
    useAsIs.onmouseleave = () => useAsIs.style.background = '#f8f9fa';
    dropdown.appendChild(useAsIs);
  }

  // Don't show empty dropdown
  if (dropdown.children.length === 0) return;

  // Position below input
  const rect = input.getBoundingClientRect();
  dropdown.style.position = 'fixed';
  dropdown.style.top = (rect.bottom + 2) + 'px';
  dropdown.style.left = rect.left + 'px';
  dropdown.style.width = rect.width + 'px';
  document.body.appendChild(dropdown);
}

function removeDropdown(id) {
  const el = document.getElementById('dropdown_' + id);
  if (el) el.remove();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Find all location inputs in the current modal and attach autocomplete.
 */
function attachAllLocationAutocompletes() {
  destroyAutocompletes();
  const modal = document.getElementById('modalBody');
  if (!modal) return;

  // Starting Location input
  const startingLoc = modal.querySelector('input[name="startingLocation"]');
  if (startingLoc) attachLocationAutocomplete(startingLoc);

  // Travel From/To inputs
  const travelFrom = modal.querySelector('input[name="travelFrom"]');
  if (travelFrom) attachLocationAutocomplete(travelFrom);
  const travelTo = modal.querySelector('input[name="travelTo"]');
  if (travelTo) attachLocationAutocomplete(travelTo);

  // Location note inputs (attach to existing ones)
  modal.querySelectorAll('.location-name-input').forEach(inp => {
    if (!inp.dataset.acId) attachLocationAutocomplete(inp);
  });
}

function addLocationNoteField(containerId, location, description) {
  const container = document.getElementById(containerId);
  const index = locationNoteCounter++;
  const editorId = `locationEditor_${index}`;
  const div = document.createElement('div');
  div.className = 'location-note-item';
  div.id = `locationNote_${index}`;
  div.innerHTML = `
    <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
      <input type="text" class="form-control location-name-input" placeholder="School / Location name" value="${(location || '').replace(/"/g, '&quot;')}" style="flex: 1;">
      <button type="button" class="btn btn-sm btn-danger" onclick="removeLocationNote(${index})">Remove</button>
    </div>
    <div class="quill-wrapper">
      <div id="${editorId}"></div>
    </div>
  `;
  container.appendChild(div);
  const editor = initQuillEditor(editorId, 'What was done at this location...');
  if (description) {
    editor.root.innerHTML = description;
  }
  // Attach location autocomplete to the new input
  const locInput = div.querySelector('.location-name-input');
  if (locInput) attachLocationAutocomplete(locInput);
  return { index, editorId };
}

function removeLocationNote(index) {
  const el = document.getElementById(`locationNote_${index}`);
  if (el) {
    const editorId = `locationEditor_${index}`;
    delete activeQuillEditors[editorId];
    el.remove();
  }
}

function collectLocationNotes(containerId) {
  const container = document.getElementById(containerId);
  const items = container.querySelectorAll('.location-note-item');
  const notes = [];
  items.forEach(item => {
    const location = item.querySelector('.location-name-input').value.trim();
    const editorDiv = item.querySelector('[id^="locationEditor_"]');
    if (editorDiv && activeQuillEditors[editorDiv.id]) {
      const html = activeQuillEditors[editorDiv.id].root.innerHTML;
      const description = html === '<p><br></p>' ? '' : html;
      if (location || description) {
        notes.push({ location, description });
      }
    }
  });
  return notes.length > 0 ? JSON.stringify(notes) : null;
}

// ==================== ENTRY VALIDATION ====================

/**
 * Convert HH:MM to minutes since midnight for comparison.
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Validate a timesheet entry against all rules.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 *
 * Rules:
 * 1. End time must be after start time
 * 2. Times cannot cross midnight
 * 3. No overlapping times on the same day (across ALL companies)
 * 4. At least one 30-minute unpaid break required in a day (when 2+ entries)
 * 5. No start time at 11:00 PM or later
 * 6. Max 12 hours per single entry
 * 7. Max daily hours (employee-configurable)
 * 8. Entry date must fall within the timesheet's week range
 * 9. Weekend entries should have a reason for deviation
 */
function validateEntry(entry, existingEntries, excludeEntryId, timesheetId) {
  const errors = [];
  const warnings = [];
  const startMins = timeToMinutes(entry.startTime);
  const endMins = timeToMinutes(entry.endTime);

  if (startMins === null || endMins === null) {
    errors.push('Start time and end time are required.');
    return { valid: false, errors, warnings };
  }

  // Rule 1: End time must be after start time
  if (endMins <= startMins) {
    errors.push('End time must be after start time.');
  }

  // Rule 2: No start time at 11pm or later
  if (startMins >= 23 * 60) {
    errors.push('Start time cannot be 11:00 PM or later.');
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  // Rule 6: Max 12 hours per single entry
  const entryHours = (endMins - startMins) / 60;
  if (entryHours > 12) {
    errors.push(`Entry duration of ${entryHours.toFixed(1)} hours exceeds the 12-hour maximum per entry.`);
  }

  // Rule 8: Entry date must fall within the timesheet's week range
  const ts = getTimesheetById(timesheetId);
  if (ts) {
    const entryDate = new Date(entry.date);
    const weekStart = new Date(ts.weekStarting);
    const weekEnd = new Date(ts.weekEnding);
    weekStart.setHours(0, 0, 0, 0);
    weekEnd.setHours(23, 59, 59, 999);

    if (entryDate < weekStart || entryDate > weekEnd) {
      errors.push(`Entry date must be within the timesheet week (${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}).`);
    }
  }

  // Rule 9: Weekend check
  const dayOfWeek = new Date(entry.date).getDay(); // 0=Sun, 6=Sat
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    warnings.push('This entry is on a weekend. A reason for deviation may be required by DE WMS.');
  }

  // Get all entries for the same day (across ALL companies)
  const entryDate = entry.date;
  const sameDayEntries = existingEntries.filter(e => {
    const eDate = new Date(e.date).toISOString().split('T')[0];
    const matchesDate = eDate === entryDate;
    const notSelf = excludeEntryId ? e.id !== excludeEntryId : true;
    return matchesDate && notSelf && e.startTime && e.endTime;
  });

  // Rule 3: No overlapping times
  for (const other of sameDayEntries) {
    const otherStart = timeToMinutes(other.startTime);
    const otherEnd = timeToMinutes(other.endTime);
    if (otherStart === null || otherEnd === null) continue;

    if (startMins < otherEnd && endMins > otherStart) {
      errors.push(`Overlaps with existing entry ${formatTime(other.startTime)} - ${formatTime(other.endTime)} (${other.company ? other.company.name : 'unknown'}).`);
    }
  }

  // Rule 4: At least one 30-minute unpaid break must exist in the day (when 2+ entries)
  // Collect all entries for this day including the new one, then check gaps
  if (sameDayEntries.length > 0) {
    const allDayEntries = [...sameDayEntries.map(e => ({
      start: timeToMinutes(e.startTime),
      end: timeToMinutes(e.endTime)
    })), { start: startMins, end: endMins }].filter(e => e.start !== null && e.end !== null);

    // Sort by start time
    allDayEntries.sort((a, b) => a.start - b.start);

    // Check if ANY gap between consecutive entries is >= 30 minutes
    let hasRequiredBreak = false;
    for (let i = 0; i < allDayEntries.length - 1; i++) {
      const gap = allDayEntries[i + 1].start - allDayEntries[i].end;
      if (gap >= 30) {
        hasRequiredBreak = true;
        break;
      }
    }

    if (!hasRequiredBreak) {
      errors.push('At least one 30-minute unpaid break is required when there are multiple entries in a day.');
    }
  }

  // Rule 7: Max daily hours (employee-configurable)
  const maxDaily = (currentUser && currentUser.employee) ? (currentUser.employee.maxDailyHours || 16) : 16;
  const existingDayHours = sameDayEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
  if (existingDayHours + entryHours > maxDaily) {
    errors.push(`Total hours for this day would be ${(existingDayHours + entryHours).toFixed(1)}h, exceeding your ${maxDaily}h daily limit.`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Get a timesheet by ID from loaded data.
 */
function getTimesheetById(timesheetId) {
  return [...myTimesheets, ...allTimesheets].find(t => t.id === parseInt(timesheetId)) || null;
}

/**
 * Get all entries for a given timesheet (from loaded data).
 */
function getTimesheetEntries(timesheetId) {
  const ts = getTimesheetById(timesheetId);
  return ts && ts.entries ? ts.entries : [];
}

// API helper
const api = {
  async call(endpoint, options = {}) {
    const response = await fetch(`/api${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  },

  get(endpoint) {
    return this.call(endpoint);
  },

  post(endpoint, body) {
    return this.call(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  put(endpoint, body) {
    return this.call(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return this.call(endpoint, {
      method: 'DELETE'
    });
  }
};

// Authentication
async function login(email, password) {
  try {
    const result = await api.post('/auth/login', { email, password });
    currentUser = result.user;
    showMainScreen();
  } catch (error) {
    document.getElementById('loginError').textContent = error.message;
  }
}

async function logout() {
  try {
    await api.post('/auth/logout');
    currentUser = null;
    showLoginScreen();
  } catch (error) {
    console.error('Logout error:', error);
  }
}

async function checkAuth() {
  try {
    const result = await api.get('/auth/me');
    currentUser = result.user;
    showMainScreen();
  } catch (error) {
    showLoginScreen();
  }
}

// Screen management
function showLoginScreen() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('mainScreen').style.display = 'none';
}

function showMainScreen() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('mainScreen').style.display = 'block';
  document.getElementById('userDisplay').textContent = currentUser.name;

  const hasProfile = !!currentUser.employeeId;
  const isAdmin = currentUser.isAdmin;

  // Configure tabs visibility
  const myTimesheetsTab = document.querySelector('[data-tab="myTimesheets"]');
  const allTimesheetsTab = document.querySelector('[data-tab="allTimesheets"]');

  if (isAdmin && !hasProfile) {
    // Admin without profile: hide My Timesheets, show All Timesheets
    myTimesheetsTab.style.display = 'none';
    allTimesheetsTab.style.display = '';
    // Make All Timesheets the default active tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    allTimesheetsTab.classList.add('active');
    document.getElementById('allTimesheetsTab').classList.add('active');
  } else if (isAdmin && hasProfile) {
    // Admin with profile: show both
    myTimesheetsTab.style.display = '';
    allTimesheetsTab.style.display = '';
    // Default to My Timesheets
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    myTimesheetsTab.classList.add('active');
    document.getElementById('myTimesheetsTab').classList.add('active');
  } else {
    // Regular user: My Timesheets only
    myTimesheetsTab.style.display = '';
    allTimesheetsTab.style.display = 'none';
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    myTimesheetsTab.classList.add('active');
    document.getElementById('myTimesheetsTab').classList.add('active');
  }

  // Show/hide admin tabs
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });

  loadAllData();
}

async function loadAllData() {
  loadCompanies();
  loadRoles();
  if (currentUser.employeeId) {
    loadMyTimesheets();
  }
  if (currentUser.isAdmin) {
    loadAllTimesheets();
    loadEmployees();
    loadUsers();
    loadApiKeys();
  }
}

// Modal management
function showModal(title, content) {
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modalBody');
  if (content === undefined) {
    // Single argument: title is the full HTML
    modalBody.innerHTML = title;
  } else {
    modalBody.innerHTML = `<h2>${title}</h2>${content}`;
  }
  modal.style.display = 'block';
}

function hideModal() {
  document.getElementById('modal').style.display = 'none';
  destroyQuillEditors();
  destroyAutocompletes();
}

// ==================== TIMESHEETS ====================

async function loadMyTimesheets() {
  try {
    const result = await api.get(`/timesheets?employeeId=${currentUser.employeeId}`);
    myTimesheets = result.timesheets;
    displayMyTimesheets();
    populateTimesheetSelect();
  } catch (error) {
    console.error('Load my timesheets error:', error);
  }
}

async function loadAllTimesheets() {
  try {
    const result = await api.get('/timesheets');
    allTimesheets = result.timesheets;
    displayAllTimesheets();
    populateTimesheetSelect();
  } catch (error) {
    console.error('Load all timesheets error:', error);
  }
}

function displayTimesheetTable(tsArray, containerId, showEmployee) {
  const container = document.getElementById(containerId);
  if (tsArray.length === 0) {
    container.innerHTML = '<p>No timesheets found.</p>';
    return;
  }

  const isAdmin = currentUser.isAdmin;

  const html = `
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
            ${showEmployee ? `<td>${ts.employee.user.name}</td>` : ''}
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
  container.innerHTML = html;
}

function displayMyTimesheets() {
  displayTimesheetTable(myTimesheets, 'myTimesheetsList', false);
}

function displayAllTimesheets() {
  displayTimesheetTable(allTimesheets, 'allTimesheetsList', true);
}

function populateTimesheetSelect() {
  const select = document.getElementById('timesheetSelect');
  // Combine both lists, deduplicate by id
  const allTs = [...myTimesheets];
  allTimesheets.forEach(ts => {
    if (!allTs.find(t => t.id === ts.id)) allTs.push(ts);
  });
  allTs.sort((a, b) => new Date(b.weekStarting) - new Date(a.weekStarting));
  timesheets = allTs; // keep unified list for entry lookups

  select.innerHTML = '<option value="">Select a timesheet...</option>' +
    allTs.map(ts => {
      const label = currentUser.isAdmin
        ? `${ts.employee.user.name} - Week ${new Date(ts.weekStarting).toLocaleDateString()} - ${new Date(ts.weekEnding).toLocaleDateString()}`
        : `Week ${new Date(ts.weekStarting).toLocaleDateString()} - ${new Date(ts.weekEnding).toLocaleDateString()}`;
      return `<option value="${ts.id}">${label}</option>`;
    }).join('');
}

async function createTimesheet() {
  let employeeSelectHtml = '';
  if (currentUser.isAdmin && employees.length > 0) {
    employeeSelectHtml = `
      <div class="form-group">
        <label>Employee</label>
        <select name="employeeId" required>
          ${currentUser.employeeId ? `<option value="${currentUser.employeeId}">Myself</option>` : ''}
          ${employees.filter(e => e.id !== currentUser.employeeId).map(e => `<option value="${e.id}">${e.firstName} ${e.lastName}</option>`).join('')}
        </select>
      </div>
    `;
  }

  const form = `
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
      <button type="submit" class="btn btn-primary">Create</button>
    </form>
  `;

  showModal('Create Timesheet', form);

  document.getElementById('timesheetForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const employeeId = formData.get('employeeId')
      ? parseInt(formData.get('employeeId'))
      : currentUser.employeeId;

    if (!employeeId) {
      alert('No employee profile found. An admin must create an employee profile for your account first.');
      return;
    }

    try {
      await api.post('/timesheets', {
        employeeId,
        weekStarting: formData.get('weekStarting'),
        weekEnding: formData.get('weekEnding')
      });
      hideModal();
      refreshTimesheets();
    } catch (error) {
      alert(error.message);
    }
  };
}

async function refreshTimesheets() {
  if (currentUser.employeeId) await loadMyTimesheets();
  if (currentUser.isAdmin) await loadAllTimesheets();
}

async function submitTimesheet(id) {
  if (!confirm('Are you sure you want to submit this timesheet?')) return;
  try {
    await api.post(`/timesheets/${id}/submit`);
    refreshTimesheets();
    alert('Timesheet submitted successfully');
  } catch (error) {
    alert(error.message);
  }
}

async function approveTimesheet(id) {
  if (!confirm('Approve this timesheet?')) return;
  try {
    await api.post(`/timesheets/${id}/approve`);
    refreshTimesheets();
    alert('Timesheet approved');
  } catch (error) {
    alert(error.message);
  }
}

async function lockTimesheet(id) {
  if (!confirm('Lock this timesheet? No further edits will be allowed.')) return;
  try {
    await api.post(`/timesheets/${id}/lock`);
    refreshTimesheets();
    alert('Timesheet locked');
  } catch (error) {
    alert(error.message);
  }
}

async function deleteTimesheet(id) {
  if (!confirm('Are you sure you want to delete this timesheet?')) return;
  try {
    await api.delete(`/timesheets/${id}`);
    refreshTimesheets();
  } catch (error) {
    alert(error.message);
  }
}

async function viewTimesheet(id) {
  try {
    const result = await api.get(`/timesheets/${id}`);
    const ts = result.timesheet;

    const html = `
      <h3>${ts.employee.user.name}</h3>
      <p>Week ${new Date(ts.weekStarting).toLocaleDateString()} - ${new Date(ts.weekEnding).toLocaleDateString()}</p>
      <p><strong>Status:</strong> <span class="status-badge status-${ts.status}">${ts.status}</span></p>
      ${ts.approvedBy ? `<p><strong>Approved by:</strong> ${ts.approvedBy.name}</p>` : ''}
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
                <td>${entry.company.name}</td>
                <td>${entry.role.name}</td>
                <td>${entry.startingLocation || '-'}</td>
                <td>
                  <div class="rich-text-content">${entry.notes || '-'}</div>
                  ${entry.reasonForDeviation ? `<div style="margin-top:0.25rem;padding:0.25rem 0.5rem;background:#fff3cd;border-radius:4px;border-left:3px solid #ffc107;"><small><strong>Deviation:</strong> ${entry.reasonForDeviation}</small></div>` : ''}
                  ${entry.entryType === 'TRAVEL' ? `<br><small>${entry.travelFrom} &rarr; ${entry.travelTo}${entry.distance ? ` (${entry.distance.toFixed(1)} km)` : ''}</small>` : ''}
                  ${entry.locationNotes ? (() => {
                    try {
                      const lnotes = typeof entry.locationNotes === 'string' ? JSON.parse(entry.locationNotes) : entry.locationNotes;
                      return lnotes.map(ln => `<div style="margin-top:0.5rem;padding:0.25rem 0.5rem;background:#e8f4fd;border-radius:4px;border-left:3px solid #3498db;"><strong>${ln.location}</strong><div class="rich-text-content">${ln.description}</div></div>`).join('');
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

    showModal('Timesheet Details', html);
  } catch (error) {
    alert(error.message);
  }
}

// ==================== ENTRIES ====================

/**
 * Get company options for entry forms.
 * Admins see all companies; regular users see only companies they have roles assigned to.
 */
function getEntryCompanyOptions(selectedId) {
  const emp = currentUser && currentUser.employee;
  let companyList;

  if (currentUser && currentUser.isAdmin) {
    // Admins see all companies
    companyList = companies;
  } else if (emp && emp.roles && emp.roles.length > 0) {
    // Regular users see only companies they're assigned to
    const assignedCompanyIds = new Set(emp.roles.map(er => er.company.id));
    companyList = companies.filter(c => assignedCompanyIds.has(c.id));
  } else {
    companyList = [];
  }

  return companyList.map(c =>
    `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.name}</option>`
  );
}

/**
 * Get roles for a specific company in entry forms.
 * Admins see all roles for the company; regular users see only their assigned roles.
 */
function getEntryRolesForCompany(companyId) {
  const emp = currentUser && currentUser.employee;

  if (currentUser && currentUser.isAdmin) {
    // Admins see all roles for this company
    return roles.filter(r => r.company.id === companyId);
  } else if (emp && emp.roles && emp.roles.length > 0) {
    // Regular users see only their assigned roles for this company
    return emp.roles
      .filter(er => er.company.id === companyId)
      .map(er => er.role);
  }
  return [];
}

async function loadEntries(timesheetId) {
  if (!timesheetId) {
    document.getElementById('entriesList').innerHTML = '<p>Please select a timesheet</p>';
    return;
  }

  try {
    const result = await api.get(`/entries/timesheet/${timesheetId}`);
    displayEntries(result.entries, timesheetId);
  } catch (error) {
    console.error('Load entries error:', error);
  }
}

function displayEntries(entries, timesheetId) {
  const container = document.getElementById('entriesList');
  if (entries.length === 0) {
    container.innerHTML = '<p>No entries found</p>';
    return;
  }

  const html = `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Time</th>
          <th>Hours</th>
          <th>Company</th>
          <th>Role</th>
          <th>Status</th>
          <th>Source</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${entries.map(entry => {
          const isEditable = entry.status === 'OPEN';
          const isTsData = entry.tsDataSource || false;
          return `
          <tr>
            <td>${new Date(entry.date).toLocaleDateString()}</td>
            <td>${entry.entryType}${entry.entryType === 'TRAVEL' ? `<br><small>${entry.travelFrom} &rarr; ${entry.travelTo}</small>` : ''}</td>
            <td>${entry.startTime && entry.endTime ? `${formatTime(entry.startTime)}<br>${formatTime(entry.endTime)}` : '-'}</td>
            <td>${entry.hours.toFixed(2)}</td>
            <td>${entry.company.name}</td>
            <td>${entry.role.name}</td>
            <td>
              <span class="status-badge status-${entry.status}">${entry.status}</span>
              ${entry.privateNotes ? `<br><span class="private-notes-badge">Private</span>` : ''}
            </td>
            <td>
              ${isTsData
                ? `<span class="source-badge tsdata-badge" title="Synced from TSDATA${entry.tsDataSyncedAt ? ' on ' + new Date(entry.tsDataSyncedAt).toLocaleString() : ''}">TSDATA</span>`
                : '<span class="source-badge local-badge">Local</span>'
              }
            </td>
            <td>
              ${isEditable ? `
                <button class="btn btn-sm btn-primary" onclick="editEntry(${entry.id}, ${timesheetId})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteEntry(${entry.id})">Delete</button>
              ` : `<span style="color:#999; font-size:0.85rem;">Locked</span>`}
            </td>
          </tr>
        `;}).join('')}
      </tbody>
    </table>
  `;
  container.innerHTML = html;
}

async function createEntry() {
  const timesheetId = document.getElementById('timesheetSelect').value;
  if (!timesheetId) {
    alert('Please select a timesheet first');
    return;
  }

  const defaults = getTimeDefaults(timesheetId);

  const form = `
    <form id="entryForm">
      <div class="form-group">
        <label>Entry Type</label>
        <select name="entryType" id="entryTypeSelect" required>
          <option value="GENERAL">General</option>
          <option value="TRAVEL">Travel</option>
        </select>
      </div>
      <div class="form-group">
        <label>Date</label>
        <input type="date" name="date" value="${todayStr()}" required>
      </div>
      <div class="time-row">
        <div class="form-group">
          <label>Start Time</label>
          <input type="time" name="startTime" id="createStartTime" value="${defaults.start}" required>
        </div>
        <div class="form-group">
          <label>End Time</label>
          <input type="time" name="endTime" id="createEndTime" value="${defaults.end}" required>
        </div>
        <div class="calculated-hours" id="createHoursPreview">${defaults.start && defaults.end ? calculateHoursPreview(defaults.start, defaults.end) : '0.00 hrs'}</div>
      </div>
      <div class="form-group">
        <label>Company</label>
        <select name="companyId" id="entryCompanySelect" required>
          <option value="">Select company...</option>
          ${getEntryCompanyOptions().join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Role</label>
        <select name="roleId" id="entryRoleSelect" required>
          <option value="">Select company first...</option>
        </select>
      </div>
      <div class="form-group">
        <label>Starting Location</label>
        <input type="text" name="startingLocation" placeholder="e.g. School name, Home, Office">
        <small style="color: #666;">Where you started from for this entry</small>
      </div>
      <div id="travelFields" style="display:none;">
        <div class="form-group">
          <label>Travel From</label>
          <input type="text" name="travelFrom" placeholder="e.g. Home, Work Place 1, or full address">
        </div>
        <div class="form-group">
          <label>Travel To</label>
          <input type="text" name="travelTo" placeholder="e.g. School 1, or full address">
        </div>
      </div>
      <div class="quill-wrapper">
        <label>Notes / Details</label>
        <div id="createNotesEditor"></div>
      </div>
      <div class="location-notes-section" style="border: 2px solid #3498db; border-radius: 4px; padding: 1rem; margin-bottom: 1rem; background: #f0f8ff;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <label style="font-weight: 600; color: #2c3e50; margin: 0;">Location Notes</label>
          <button type="button" class="btn btn-sm btn-primary" id="addLocationNoteBtn">+ Add Location</button>
        </div>
        <small style="color: #666; display: block; margin-bottom: 0.5rem;">Add notes for each school/location visited</small>
        <div id="createLocationNotesContainer"></div>
      </div>
      <div class="form-group">
        <label>Reason for Deviation</label>
        <textarea name="reasonForDeviation" rows="2" placeholder="If your times differ from your approved schedule, explain why" maxlength="256" style="resize: vertical;"></textarea>
        <small style="color: #666;">Required by DE WMS if entry times deviate from your default schedule</small>
      </div>
      <div class="private-notes-wrapper">
        <label>Private Notes (internal only - not visible to clients)</label>
        <div id="createPrivateNotesEditor"></div>
      </div>
      <button type="submit" class="btn btn-primary">Create Entry</button>
    </form>
  `;

  showModal('Create Entry', form);
  destroyQuillEditors();

  const notesEditor = initQuillEditor('createNotesEditor', 'Enter notes or details...');
  const privateNotesEditor = initQuillEditor('createPrivateNotesEditor', 'Internal notes...');

  document.getElementById('addLocationNoteBtn').onclick = () => {
    addLocationNoteField('createLocationNotesContainer');
  };

  const updateHoursPreview = () => {
    const start = document.getElementById('createStartTime').value;
    const end = document.getElementById('createEndTime').value;
    document.getElementById('createHoursPreview').textContent = calculateHoursPreview(start, end) || '0.00 hrs';
  };
  document.getElementById('createStartTime').onchange = updateHoursPreview;
  document.getElementById('createEndTime').onchange = updateHoursPreview;

  document.getElementById('entryTypeSelect').onchange = (e) => {
    document.getElementById('travelFields').style.display =
      e.target.value === 'TRAVEL' ? 'block' : 'none';
  };

  document.getElementById('entryCompanySelect').onchange = (e) => {
    const companyId = parseInt(e.target.value);
    const roleSelect = document.getElementById('entryRoleSelect');
    if (!companyId) {
      roleSelect.innerHTML = '<option value="">Select company first...</option>';
      return;
    }
    const filteredRoles = getEntryRolesForCompany(companyId);
    roleSelect.innerHTML = '<option value="">Select role...</option>' +
      filteredRoles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  };

  // Attach location autocomplete to all location inputs
  attachAllLocationAutocompletes();

  document.getElementById('entryForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    // Validate entry before submitting
    const existingEntries = getTimesheetEntries(timesheetId);
    const validation = validateEntry({
      date: formData.get('date'),
      startTime: formData.get('startTime'),
      endTime: formData.get('endTime')
    }, existingEntries, null, timesheetId);

    if (!validation.valid) {
      alert('Entry validation failed:\n\n' + validation.errors.join('\n'));
      return;
    }

    if (validation.warnings && validation.warnings.length > 0) {
      if (!confirm('Warning:\n\n' + validation.warnings.join('\n') + '\n\nContinue anyway?')) {
        return;
      }
    }

    const notesHtml = notesEditor.root.innerHTML === '<p><br></p>' ? '' : notesEditor.root.innerHTML;
    const privateNotesHtml = privateNotesEditor.root.innerHTML === '<p><br></p>' ? '' : privateNotesEditor.root.innerHTML;
    const locationNotesJson = collectLocationNotes('createLocationNotesContainer');

    try {
      await api.post('/entries', {
        timesheetId: parseInt(timesheetId),
        entryType: formData.get('entryType'),
        date: formData.get('date'),
        startTime: formData.get('startTime'),
        endTime: formData.get('endTime'),
        companyId: parseInt(formData.get('companyId')),
        roleId: parseInt(formData.get('roleId')),
        startingLocation: formData.get('startingLocation') || null,
        reasonForDeviation: formData.get('reasonForDeviation') || null,
        notes: notesHtml || null,
        privateNotes: privateNotesHtml || null,
        locationNotes: locationNotesJson,
        travelFrom: formData.get('travelFrom'),
        travelTo: formData.get('travelTo')
      });
      hideModal();
      await refreshTimesheets();
      loadEntries(timesheetId);
    } catch (error) {
      alert(error.message);
    }
  };
}

async function editEntry(id, timesheetIdParam) {
  const timesheetId = timesheetIdParam || document.getElementById('timesheetSelect').value;

  // Fetch entry directly from API to avoid stale data
  let entry;
  try {
    const result = await api.get(`/entries/timesheet/${timesheetId}`);
    entry = result.entries.find(e => e.id === id);
  } catch (error) {
    alert('Failed to load entry');
    return;
  }

  if (!entry) {
    alert('Entry not found');
    return;
  }

  const dateStr = new Date(entry.date).toISOString().split('T')[0];

  const form = `
    <form id="editEntryForm">
      <div class="form-group">
        <label>Entry Type</label>
        <select name="entryType" id="editEntryTypeSelect" required>
          <option value="GENERAL" ${entry.entryType === 'GENERAL' ? 'selected' : ''}>General</option>
          <option value="TRAVEL" ${entry.entryType === 'TRAVEL' ? 'selected' : ''}>Travel</option>
        </select>
      </div>
      <div class="form-group">
        <label>Date</label>
        <input type="date" name="date" value="${dateStr}" required>
      </div>
      <div class="time-row">
        <div class="form-group">
          <label>Start Time</label>
          <input type="time" name="startTime" id="editStartTime" value="${entry.startTime || ''}" required>
        </div>
        <div class="form-group">
          <label>End Time</label>
          <input type="time" name="endTime" id="editEndTime" value="${entry.endTime || ''}" required>
        </div>
        <div class="calculated-hours" id="editHoursPreview">${entry.hours.toFixed(2)} hrs</div>
      </div>
      <div class="form-group">
        <label>Company</label>
        <select name="companyId" id="editEntryCompanySelect" required>
          <option value="">Select company...</option>
          ${getEntryCompanyOptions(entry.companyId).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Role</label>
        <select name="roleId" id="editEntryRoleSelect" required>
          <option value="">Select role...</option>
          ${getEntryRolesForCompany(entry.companyId).map(r => `<option value="${r.id}" ${r.id === entry.roleId ? 'selected' : ''}>${r.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Starting Location</label>
        <input type="text" name="startingLocation" value="${(entry.startingLocation || '').replace(/"/g, '&quot;')}" placeholder="e.g. School name, Home, Office">
        <small style="color: #666;">Where you started from for this entry</small>
      </div>
      <div id="editTravelFields" style="display:${entry.entryType === 'TRAVEL' ? 'block' : 'none'};">
        <div class="form-group">
          <label>Travel From</label>
          <input type="text" name="travelFrom" value="${entry.travelFrom || ''}">
        </div>
        <div class="form-group">
          <label>Travel To</label>
          <input type="text" name="travelTo" value="${entry.travelTo || ''}">
        </div>
      </div>
      <div class="quill-wrapper">
        <label>Notes / Details</label>
        <div id="editNotesEditor"></div>
      </div>
      <div class="location-notes-section" style="border: 2px solid #3498db; border-radius: 4px; padding: 1rem; margin-bottom: 1rem; background: #f0f8ff;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <label style="font-weight: 600; color: #2c3e50; margin: 0;">Location Notes</label>
          <button type="button" class="btn btn-sm btn-primary" id="editAddLocationNoteBtn">+ Add Location</button>
        </div>
        <small style="color: #666; display: block; margin-bottom: 0.5rem;">Add notes for each school/location visited</small>
        <div id="editLocationNotesContainer"></div>
      </div>
      <div class="form-group">
        <label>Reason for Deviation</label>
        <textarea name="reasonForDeviation" rows="2" maxlength="256" style="resize: vertical;" placeholder="If your times differ from your approved schedule, explain why">${(entry.reasonForDeviation || '').replace(/</g, '&lt;')}</textarea>
        <small style="color: #666;">Required by DE WMS if entry times deviate from your default schedule</small>
      </div>
      <div class="private-notes-wrapper">
        <label>Private Notes (internal only - not visible to clients)</label>
        <div id="editPrivateNotesEditor"></div>
      </div>
      <button type="submit" class="btn btn-primary">Save Changes</button>
    </form>
  `;

  showModal('Edit Entry', form);
  destroyQuillEditors();

  const notesEditor = initQuillEditor('editNotesEditor', 'Enter notes or details...');
  const privateNotesEditor = initQuillEditor('editPrivateNotesEditor', 'Internal notes...');

  if (entry.notes) {
    notesEditor.root.innerHTML = entry.notes;
  }
  if (entry.privateNotes) {
    privateNotesEditor.root.innerHTML = entry.privateNotes;
  }

  if (entry.locationNotes) {
    try {
      const locNotes = typeof entry.locationNotes === 'string' ? JSON.parse(entry.locationNotes) : entry.locationNotes;
      locNotes.forEach(ln => {
        addLocationNoteField('editLocationNotesContainer', ln.location, ln.description);
      });
    } catch (e) { /* ignore parse errors */ }
  }

  document.getElementById('editAddLocationNoteBtn').onclick = () => {
    addLocationNoteField('editLocationNotesContainer');
  };

  const updateHoursPreview = () => {
    const start = document.getElementById('editStartTime').value;
    const end = document.getElementById('editEndTime').value;
    document.getElementById('editHoursPreview').textContent = calculateHoursPreview(start, end) || `${entry.hours.toFixed(2)} hrs`;
  };
  document.getElementById('editStartTime').onchange = updateHoursPreview;
  document.getElementById('editEndTime').onchange = updateHoursPreview;

  document.getElementById('editEntryTypeSelect').onchange = (e) => {
    document.getElementById('editTravelFields').style.display =
      e.target.value === 'TRAVEL' ? 'block' : 'none';
  };

  document.getElementById('editEntryCompanySelect').onchange = (e) => {
    const companyId = parseInt(e.target.value);
    const roleSelect = document.getElementById('editEntryRoleSelect');
    if (!companyId) {
      roleSelect.innerHTML = '<option value="">Select company first...</option>';
      return;
    }
    const filteredRoles = getEntryRolesForCompany(companyId);
    roleSelect.innerHTML = '<option value="">Select role...</option>' +
      filteredRoles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  };

  // Attach location autocomplete to all location inputs
  attachAllLocationAutocompletes();

  document.getElementById('editEntryForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    // Validate entry before submitting (exclude current entry from overlap check)
    const existingEntries = getTimesheetEntries(timesheetId);
    const validation = validateEntry({
      date: formData.get('date'),
      startTime: formData.get('startTime'),
      endTime: formData.get('endTime')
    }, existingEntries, id, timesheetId);

    if (!validation.valid) {
      alert('Entry validation failed:\n\n' + validation.errors.join('\n'));
      return;
    }

    if (validation.warnings && validation.warnings.length > 0) {
      if (!confirm('Warning:\n\n' + validation.warnings.join('\n') + '\n\nContinue anyway?')) {
        return;
      }
    }

    const notesHtml = notesEditor.root.innerHTML === '<p><br></p>' ? '' : notesEditor.root.innerHTML;
    const privateNotesHtml = privateNotesEditor.root.innerHTML === '<p><br></p>' ? '' : privateNotesEditor.root.innerHTML;
    const locationNotesJson = collectLocationNotes('editLocationNotesContainer');

    try {
      await api.put(`/entries/${id}`, {
        entryType: formData.get('entryType'),
        date: formData.get('date'),
        startTime: formData.get('startTime'),
        endTime: formData.get('endTime'),
        companyId: parseInt(formData.get('companyId')),
        roleId: parseInt(formData.get('roleId')),
        startingLocation: formData.get('startingLocation') || null,
        reasonForDeviation: formData.get('reasonForDeviation') || null,
        notes: notesHtml || null,
        privateNotes: privateNotesHtml || null,
        locationNotes: locationNotesJson,
        travelFrom: formData.get('travelFrom'),
        travelTo: formData.get('travelTo')
      });
      hideModal();
      await refreshTimesheets();
      loadEntries(timesheetId);
    } catch (error) {
      alert(error.message);
    }
  };
}

async function deleteEntry(id) {
  if (!confirm('Delete this entry?')) return;

  try {
    await api.delete(`/entries/${id}`);
    const timesheetId = document.getElementById('timesheetSelect').value;
    await refreshTimesheets();
    loadEntries(timesheetId);
  } catch (error) {
    alert(error.message);
  }
}

// ==================== COMPANIES ====================

async function loadCompanies() {
  try {
    const result = await api.get('/companies');
    companies = result.companies;
    if (document.getElementById('companiesTab').classList.contains('active')) {
      displayCompanies();
    }
  } catch (error) {
    console.error('Load companies error:', error);
  }
}

function displayCompanies() {
  const container = document.getElementById('companiesList');
  if (companies.length === 0) {
    container.innerHTML = '<p>No companies found. Add your first company.</p>';
    return;
  }

  const html = `
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Billable</th>
          <th>WMS Sync</th>
          <th>Roles</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${companies.map(c => `
          <tr>
            <td>${c.name}</td>
            <td>${c.isBillable ? 'Yes' : 'No'}</td>
            <td>${c.wmsSyncEnabled ? 'Yes' : 'No'}</td>
            <td>${c._count.roles}</td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="editCompany(${c.id})">Edit</button>
              <button class="btn btn-sm btn-danger" onclick="deleteCompany(${c.id})">Delete</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  container.innerHTML = html;
}

async function createCompany() {
  const form = `
    <form id="companyForm">
      <div class="form-group">
        <label>Company Name</label>
        <input type="text" name="name" required>
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" name="isBillable" checked>
          <span>Billable</span>
        </label>
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" name="wmsSyncEnabled">
          <span>Allow DE WMS Timesheet Sync</span>
        </label>
      </div>
      <button type="submit" class="btn btn-primary">Create Company</button>
    </form>
  `;

  showModal('Add Company', form);

  document.getElementById('companyForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await api.post('/companies', {
        name: formData.get('name'),
        isBillable: formData.has('isBillable'),
        wmsSyncEnabled: formData.has('wmsSyncEnabled')
      });
      hideModal();
      loadCompanies();
      displayCompanies();
    } catch (error) {
      alert(error.message);
    }
  };
}

async function editCompany(id) {
  const company = companies.find(c => c.id === id);
  if (!company) return;

  const form = `
    <form id="editCompanyForm">
      <div class="form-group">
        <label>Company Name</label>
        <input type="text" name="name" value="${company.name}" required>
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" name="isBillable" ${company.isBillable ? 'checked' : ''}>
          <span>Billable</span>
        </label>
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" name="wmsSyncEnabled" ${company.wmsSyncEnabled ? 'checked' : ''}>
          <span>Allow DE WMS Timesheet Sync</span>
        </label>
      </div>
      <button type="submit" class="btn btn-primary">Save Changes</button>
    </form>
  `;

  showModal('Edit Company', form);

  document.getElementById('editCompanyForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await api.put(`/companies/${id}`, {
        name: formData.get('name'),
        isBillable: formData.has('isBillable'),
        wmsSyncEnabled: formData.has('wmsSyncEnabled')
      });
      hideModal();
      loadCompanies();
      displayCompanies();
    } catch (error) {
      alert(error.message);
    }
  };
}

async function deleteCompany(id) {
  if (!confirm('Delete this company? This will also delete all associated roles.')) return;

  try {
    await api.delete(`/companies/${id}`);
    loadCompanies();
    displayCompanies();
  } catch (error) {
    alert(error.message);
  }
}

// ==================== ROLES ====================

async function loadRoles() {
  try {
    const result = await api.get('/roles');
    roles = result.roles;
    if (document.getElementById('rolesTab').classList.contains('active')) {
      displayRoles();
    }
  } catch (error) {
    console.error('Load roles error:', error);
  }
}

function displayRoles() {
  const container = document.getElementById('rolesList');
  if (roles.length === 0) {
    container.innerHTML = '<p>No roles found. Add your first role.</p>';
    return;
  }

  const html = `
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Company</th>
          <th>Pay Rate</th>
          <th>Employees</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${roles.map(r => `
          <tr>
            <td>${r.name}</td>
            <td>${r.company.name}</td>
            <td>$${r.payRate.toFixed(2)}/hr</td>
            <td>${r._count.employeeRoles}</td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="editRole(${r.id})">Edit</button>
              <button class="btn btn-sm btn-danger" onclick="deleteRole(${r.id})">Delete</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  container.innerHTML = html;
}

async function createRole() {
  const form = `
    <form id="roleForm">
      <div class="form-group">
        <label>Role Name</label>
        <input type="text" name="name" required placeholder="e.g. Specialist Technician">
      </div>
      <div class="form-group">
        <label>Company</label>
        <select name="companyId" required>
          <option value="">Select company...</option>
          ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Pay Rate ($/hr)</label>
        <input type="number" name="payRate" step="0.01" min="0" required>
      </div>
      <button type="submit" class="btn btn-primary">Create Role</button>
    </form>
  `;

  showModal('Add Role', form);

  document.getElementById('roleForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await api.post('/roles', {
        name: formData.get('name'),
        companyId: parseInt(formData.get('companyId')),
        payRate: parseFloat(formData.get('payRate'))
      });
      hideModal();
      loadRoles();
      displayRoles();
    } catch (error) {
      alert(error.message);
    }
  };
}

async function editRole(id) {
  const role = roles.find(r => r.id === id);
  if (!role) return;

  const form = `
    <form id="editRoleForm">
      <div class="form-group">
        <label>Role Name</label>
        <input type="text" name="name" value="${role.name}" required>
      </div>
      <div class="form-group">
        <label>Company</label>
        <select name="companyId" disabled>
          <option>${role.company.name}</option>
        </select>
        <small>Company cannot be changed after creation</small>
      </div>
      <div class="form-group">
        <label>Pay Rate ($/hr)</label>
        <input type="number" name="payRate" step="0.01" min="0" value="${role.payRate}" required>
      </div>
      <button type="submit" class="btn btn-primary">Save Changes</button>
    </form>
  `;

  showModal('Edit Role', form);

  document.getElementById('editRoleForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await api.put(`/roles/${id}`, {
        name: formData.get('name'),
        payRate: parseFloat(formData.get('payRate'))
      });
      hideModal();
      loadRoles();
      displayRoles();
    } catch (error) {
      alert(error.message);
    }
  };
}

async function deleteRole(id) {
  if (!confirm('Delete this role?')) return;

  try {
    await api.delete(`/roles/${id}`);
    loadRoles();
    displayRoles();
  } catch (error) {
    alert(error.message);
  }
}

// ==================== EMPLOYEES ====================

async function loadEmployees() {
  try {
    const result = await api.get('/employees');
    employees = result.employees;
    if (document.getElementById('employeesTab').classList.contains('active')) {
      displayEmployees();
    }
  } catch (error) {
    console.error('Load employees error:', error);
  }
}

function displayEmployees() {
  const container = document.getElementById('employeesList');
  if (employees.length === 0) {
    container.innerHTML = '<p>No employees found. Add your first employee.</p>';
    return;
  }

  const html = `
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Phone</th>
          <th>Roles</th>
          <th>IDs</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${employees.map(e => `
          <tr>
            <td>${e.firstName} ${e.lastName}</td>
            <td>${e.email}</td>
            <td>${e.phone || '-'}</td>
            <td>${e.roles.map(r => `${r.role.name} (${r.company.name})`).join(', ') || '-'}</td>
            <td>${e.identifiers.length}</td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="viewEmployee(${e.id})">View</button>
              <button class="btn btn-sm btn-primary" onclick="editEmployee(${e.id})">Edit</button>
              <button class="btn btn-sm btn-danger" onclick="deleteEmployee(${e.id})">Delete</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  container.innerHTML = html;
}

async function createEmployee() {
  // Get users without profiles for the dropdown
  const usersWithoutProfiles = users.filter(u => !u.employee);

  const form = `
    <form id="employeeForm">
      <div class="form-group">
        <label>Link to User Account</label>
        <select name="userId" required>
          <option value="">Select user...</option>
          ${usersWithoutProfiles.map(u => `<option value="${u.id}">${u.name} (${u.email})</option>`).join('')}
        </select>
        ${usersWithoutProfiles.length === 0 ? '<small style="color: #e74c3c;">All users already have profiles. Create a new user first.</small>' : ''}
      </div>
      <div class="form-group">
        <label>First Name</label>
        <input type="text" name="firstName" required>
      </div>
      <div class="form-group">
        <label>Last Name</label>
        <input type="text" name="lastName" required>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email" required>
      </div>
      <div class="form-group">
        <label>Phone</label>
        <input type="tel" name="phone" placeholder="+61400000000">
      </div>
      <button type="submit" class="btn btn-primary">Create Employee</button>
    </form>
  `;

  showModal('Add Employee', form);

  // Auto-fill name/email when user is selected
  document.querySelector('#employeeForm select[name="userId"]').onchange = (e) => {
    const userId = parseInt(e.target.value);
    const user = users.find(u => u.id === userId);
    if (user) {
      const nameParts = user.name.split(' ');
      document.querySelector('#employeeForm input[name="firstName"]').value = nameParts[0] || '';
      document.querySelector('#employeeForm input[name="lastName"]').value = nameParts.slice(1).join(' ') || '';
      document.querySelector('#employeeForm input[name="email"]').value = user.email;
    }
  };

  document.getElementById('employeeForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await api.post('/employees', {
        userId: parseInt(formData.get('userId')),
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email'),
        phone: formData.get('phone') || null
      });
      hideModal();
      loadEmployees();
      displayEmployees();
      loadUsers(); // Refresh to update profile links
    } catch (error) {
      alert(error.message);
    }
  };
}

async function viewEmployee(id) {
  try {
    const result = await api.get(`/employees/${id}`);
    const emp = result.employee;

    let presetAddresses = null;
    if (emp.presetAddresses) {
      try {
        presetAddresses = typeof emp.presetAddresses === 'string'
          ? JSON.parse(emp.presetAddresses)
          : emp.presetAddresses;
      } catch (e) { /* ignore */ }
    }

    const html = `
      <p><strong>Name:</strong> ${emp.firstName} ${emp.lastName}</p>
      <p><strong>Email:</strong> ${emp.email}</p>
      <p><strong>Phone:</strong> ${emp.phone || '-'}</p>
      <p><strong>Max Daily Hours:</strong> ${emp.maxDailyHours || 16}h</p>
      <p><strong>Linked User:</strong> ${emp.user.name} (${emp.user.email})</p>

      <h3>Roles</h3>
      ${emp.roles.length > 0 ? `
        <table>
          <thead><tr><th>Role</th><th>Company</th><th>Active</th></tr></thead>
          <tbody>
            ${emp.roles.map(r => `
              <tr>
                <td>${r.role.name}</td>
                <td>${r.company.name}</td>
                <td>${r.isActive ? 'Yes' : 'No'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p>No roles assigned</p>'}

      <h3>Identifiers</h3>
      ${emp.identifiers.length > 0 ? `
        <table>
          <thead><tr><th>Type</th><th>Value</th><th>Company</th><th>Actions</th></tr></thead>
          <tbody>
            ${emp.identifiers.map(i => `
              <tr>
                <td>${i.identifierType}</td>
                <td>${i.identifierValue}</td>
                <td>${i.company ? i.company.name : '-'}</td>
                <td>
                  <button class="btn btn-sm btn-primary" onclick="editIdentifierForm(${emp.id}, ${i.id}, '${i.identifierType}', '${i.identifierValue}', ${i.companyId || 'null'})">Edit</button>
                  <button class="btn btn-sm btn-danger" onclick="deleteIdentifier(${emp.id}, ${i.id})">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p>No identifiers</p>'}

      ${presetAddresses ? `
        <h3>Preset Addresses</h3>
        <table>
          <thead><tr><th>Label</th><th>Address</th></tr></thead>
          <tbody>
            ${Object.entries(presetAddresses).map(([key, val]) => `
              <tr><td>${key}</td><td>${val}</td></tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
        <button class="btn btn-sm btn-primary" onclick="addIdentifierForm(${emp.id})">Add Identifier</button>
        <button class="btn btn-sm btn-primary" onclick="assignRoleForm(${emp.id})">Assign Role</button>
      </div>
    `;

    showModal(`Employee: ${emp.firstName} ${emp.lastName}`, html);
  } catch (error) {
    alert(error.message);
  }
}

async function editEmployee(id) {
  const emp = employees.find(e => e.id === id);
  if (!emp) return;

  const form = `
    <form id="editEmployeeForm">
      <div class="form-group">
        <label>First Name</label>
        <input type="text" name="firstName" value="${emp.firstName}" required>
      </div>
      <div class="form-group">
        <label>Last Name</label>
        <input type="text" name="lastName" value="${emp.lastName}" required>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email" value="${emp.email}" required>
      </div>
      <div class="form-group">
        <label>Phone</label>
        <input type="tel" name="phone" value="${emp.phone || ''}">
      </div>
      <div class="form-group">
        <label>Max Daily Hours</label>
        <input type="number" name="maxDailyHours" step="0.5" min="1" max="24" value="${emp.maxDailyHours || 16}">
        <small style="color: #666;">Maximum billable hours per day for this employee</small>
      </div>
      <button type="submit" class="btn btn-primary">Save Changes</button>
    </form>
  `;

  showModal('Edit Employee', form);

  document.getElementById('editEmployeeForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await api.put(`/employees/${id}`, {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email'),
        phone: formData.get('phone') || null,
        maxDailyHours: parseFloat(formData.get('maxDailyHours')) || 16
      });
      hideModal();
      loadEmployees();
      displayEmployees();
    } catch (error) {
      alert(error.message);
    }
  };
}

async function deleteEmployee(id) {
  if (!confirm('Delete this employee? This will also delete their timesheets.')) return;

  try {
    await api.delete(`/employees/${id}`);
    loadEmployees();
    displayEmployees();
    loadUsers();
  } catch (error) {
    alert(error.message);
  }
}

async function addIdentifierForm(employeeId) {
  const form = `
    <form id="identifierForm">
      <div class="form-group">
        <label>Identifier Type</label>
        <select name="identifierType" id="addIdType" required>
          <option value="de_worker_id">DE Worker ID</option>
          <option value="payroll">Payroll ID</option>
          <option value="contractor_id">Contractor ID</option>
          <option value="hr_system">HR System ID</option>
          <option value="badge">Badge Number</option>
          <option value="other">Other...</option>
        </select>
      </div>
      <div class="form-group" id="addIdCustomGroup" style="display:none;">
        <label>Custom Type Name</label>
        <input type="text" id="addIdCustomType" placeholder="e.g. tax_file_number">
      </div>
      <div class="form-group">
        <label>Identifier Value</label>
        <input type="text" name="identifierValue" required>
      </div>
      <div class="form-group">
        <label>Company (optional)</label>
        <select name="companyId">
          <option value="">None</option>
          ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>
      <button type="submit" class="btn btn-primary">Add Identifier</button>
    </form>
  `;

  showModal(form);

  document.getElementById('addIdType').onchange = (e) => {
    const customGroup = document.getElementById('addIdCustomGroup');
    const customInput = document.getElementById('addIdCustomType');
    if (e.target.value === 'other') {
      customGroup.style.display = '';
      customInput.required = true;
    } else {
      customGroup.style.display = 'none';
      customInput.required = false;
    }
  };

  document.getElementById('identifierForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    let identifierType = formData.get('identifierType');
    if (identifierType === 'other') {
      identifierType = document.getElementById('addIdCustomType').value.trim();
      if (!identifierType) {
        alert('Please enter a custom type name');
        return;
      }
    }
    try {
      await api.post(`/employees/${employeeId}/identifiers`, {
        identifierType,
        identifierValue: formData.get('identifierValue'),
        companyId: formData.get('companyId') ? parseInt(formData.get('companyId')) : null
      });
      hideModal();
      viewEmployee(employeeId);
    } catch (error) {
      alert(error.message);
    }
  };
}

async function editIdentifierForm(employeeId, identifierId, type, value, companyId) {
  const knownTypes = ['de_worker_id', 'payroll', 'contractor_id', 'hr_system', 'badge'];
  const isCustomType = !knownTypes.includes(type);

  const form = `
    <form id="editIdentifierForm">
      <div class="form-group">
        <label>Identifier Type</label>
        <select name="identifierType" id="editIdType" required>
          <option value="de_worker_id" ${type === 'de_worker_id' ? 'selected' : ''}>DE Worker ID</option>
          <option value="payroll" ${type === 'payroll' ? 'selected' : ''}>Payroll ID</option>
          <option value="contractor_id" ${type === 'contractor_id' ? 'selected' : ''}>Contractor ID</option>
          <option value="hr_system" ${type === 'hr_system' ? 'selected' : ''}>HR System ID</option>
          <option value="badge" ${type === 'badge' ? 'selected' : ''}>Badge Number</option>
          <option value="other" ${isCustomType ? 'selected' : ''}>Other...</option>
        </select>
      </div>
      <div class="form-group" id="editIdCustomGroup" style="${isCustomType ? '' : 'display:none;'}">
        <label>Custom Type Name</label>
        <input type="text" id="editIdCustomType" value="${isCustomType ? type : ''}" ${isCustomType ? 'required' : ''}>
      </div>
      <div class="form-group">
        <label>Identifier Value</label>
        <input type="text" name="identifierValue" value="${value}" required>
      </div>
      <div class="form-group">
        <label>Company (optional)</label>
        <select name="companyId">
          <option value="">None</option>
          ${companies.map(c => `<option value="${c.id}" ${c.id === companyId ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <button type="submit" class="btn btn-primary">Save Changes</button>
    </form>
  `;

  showModal(form);

  document.getElementById('editIdType').onchange = (e) => {
    const customGroup = document.getElementById('editIdCustomGroup');
    const customInput = document.getElementById('editIdCustomType');
    if (e.target.value === 'other') {
      customGroup.style.display = '';
      customInput.required = true;
    } else {
      customGroup.style.display = 'none';
      customInput.required = false;
    }
  };

  document.getElementById('editIdentifierForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    let identifierType = formData.get('identifierType');
    if (identifierType === 'other') {
      identifierType = document.getElementById('editIdCustomType').value.trim();
      if (!identifierType) {
        alert('Please enter a custom type name');
        return;
      }
    }
    try {
      await api.put(`/employees/identifiers/${identifierId}`, {
        identifierType,
        identifierValue: formData.get('identifierValue'),
        companyId: formData.get('companyId') ? parseInt(formData.get('companyId')) : null
      });
      hideModal();
      viewEmployee(employeeId);
    } catch (error) {
      alert(error.message);
    }
  };
}

async function deleteIdentifier(employeeId, identifierId) {
  if (!confirm('Delete this identifier?')) return;
  try {
    await api.delete(`/employees/identifiers/${identifierId}`);
    viewEmployee(employeeId);
  } catch (error) {
    alert(error.message);
  }
}

async function assignRoleForm(employeeId) {
  const form = `
    <form id="assignRoleForm">
      <div class="form-group">
        <label>Company</label>
        <select name="companyId" id="assignRoleCompanySelect" required>
          <option value="">Select company...</option>
          ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Role</label>
        <select name="roleId" id="assignRoleRoleSelect" required>
          <option value="">Select role...</option>
          ${roles.map(r => `<option value="${r.id}" data-company="${r.company.id}">${r.name} - ${r.company.name}</option>`).join('')}
        </select>
      </div>
      <button type="submit" class="btn btn-primary">Assign Role</button>
    </form>
  `;

  showModal('Assign Role to Employee', form);

  document.getElementById('assignRoleCompanySelect').onchange = (e) => {
    const companyId = parseInt(e.target.value);
    const roleSelect = document.getElementById('assignRoleRoleSelect');
    const filteredRoles = companyId
      ? roles.filter(r => r.company.id === companyId)
      : roles;
    roleSelect.innerHTML = '<option value="">Select role...</option>' +
      filteredRoles.map(r => `<option value="${r.id}">${r.name} - ${r.company.name}</option>`).join('');
  };

  document.getElementById('assignRoleForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await api.post(`/employees/${employeeId}/roles`, {
        roleId: parseInt(formData.get('roleId')),
        companyId: parseInt(formData.get('companyId'))
      });
      hideModal();
      loadEmployees();
      viewEmployee(employeeId);
    } catch (error) {
      alert(error.message);
    }
  };
}

// ==================== USERS ====================

async function loadUsers() {
  try {
    const result = await api.get('/users');
    users = result.users;
    if (document.getElementById('usersTab').classList.contains('active')) {
      displayUsers();
    }
  } catch (error) {
    console.error('Load users error:', error);
  }
}

function displayUsers() {
  const container = document.getElementById('usersList');
  if (users.length === 0) {
    container.innerHTML = '<p>No users found.</p>';
    return;
  }

  const html = `
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Email</th>
          <th>Admin</th>
          <th>Employee Profile</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(u => `
          <tr>
            <td>${u.id}</td>
            <td>${u.name}</td>
            <td>${u.email}</td>
            <td>${u.isAdmin ? '<span style="color: #27ae60; font-weight: 600;">Yes</span>' : 'No'}</td>
            <td>${u.employee ? `${u.employee.firstName} ${u.employee.lastName} (ID: ${u.employee.id})` : '<span style="color: #999;">None</span>'}</td>
            <td>${new Date(u.createdAt).toLocaleDateString()}</td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="editUser(${u.id})">Edit</button>
              ${!u.employee ? `<button class="btn btn-sm btn-success" onclick="linkProfileToUser(${u.id}, '${u.name.replace(/'/g, "\\'")}', '${u.email.replace(/'/g, "\\'")}')">Link Profile</button>` : ''}
              ${u.id !== currentUser.id ? `<button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})">Delete</button>` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  container.innerHTML = html;
}

async function createUser() {
  const form = `
    <form id="userForm">
      <div class="form-group">
        <label>Name</label>
        <input type="text" name="name" required>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email" required>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" name="password" required minlength="6">
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" name="isAdmin">
          <span>Admin User</span>
        </label>
      </div>
      <button type="submit" class="btn btn-primary">Create User</button>
    </form>
  `;

  showModal('Add System User', form);

  document.getElementById('userForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await api.post('/users', {
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
        isAdmin: formData.has('isAdmin')
      });
      hideModal();
      loadUsers();
      displayUsers();
    } catch (error) {
      alert(error.message);
    }
  };
}

async function editUser(id) {
  const user = users.find(u => u.id === id);
  if (!user) return;

  const form = `
    <form id="editUserForm">
      <div class="form-group">
        <label>Name</label>
        <input type="text" name="name" value="${user.name}" required>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email" value="${user.email}" required>
      </div>
      <div class="form-group">
        <label>New Password (leave blank to keep current)</label>
        <input type="password" name="password" minlength="6">
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" name="isAdmin" ${user.isAdmin ? 'checked' : ''}>
          <span>Admin User</span>
        </label>
      </div>
      <button type="submit" class="btn btn-primary">Save Changes</button>
    </form>
  `;

  showModal('Edit User', form);

  document.getElementById('editUserForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      isAdmin: formData.has('isAdmin')
    };
    const password = formData.get('password');
    if (password) data.password = password;

    try {
      await api.put(`/users/${id}`, data);
      hideModal();
      loadUsers();
      displayUsers();
    } catch (error) {
      alert(error.message);
    }
  };
}

async function linkProfileToUser(userId, userName, userEmail) {
  const nameParts = userName.split(' ');
  const form = `
    <form id="linkProfileForm">
      <p>Create an employee profile for <strong>${userName}</strong> (${userEmail})</p>
      <div class="form-group">
        <label>First Name</label>
        <input type="text" name="firstName" value="${nameParts[0] || ''}" required>
      </div>
      <div class="form-group">
        <label>Last Name</label>
        <input type="text" name="lastName" value="${nameParts.slice(1).join(' ') || ''}" required>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email" value="${userEmail}" required>
      </div>
      <div class="form-group">
        <label>Phone</label>
        <input type="tel" name="phone" placeholder="+61400000000">
      </div>
      <button type="submit" class="btn btn-primary">Create Profile</button>
    </form>
  `;

  showModal('Link Employee Profile', form);

  document.getElementById('linkProfileForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await api.post('/employees', {
        userId: userId,
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email'),
        phone: formData.get('phone') || null
      });
      hideModal();
      loadUsers();
      displayUsers();
      loadEmployees();
    } catch (error) {
      alert(error.message);
    }
  };
}

async function deleteUser(id) {
  if (!confirm('Delete this user? This cannot be undone.')) return;

  try {
    await api.delete(`/users/${id}`);
    loadUsers();
    displayUsers();
  } catch (error) {
    alert(error.message);
  }
}

// ==================== MY PROFILE ====================

async function showMyProfile() {
  // Re-fetch current user data
  try {
    const result = await api.get('/auth/me');
    currentUser = result.user;
  } catch (error) {
    alert('Failed to load profile');
    return;
  }

  const emp = currentUser.employee;

  const form = `
    <form id="profileForm">
      <div class="form-group">
        <label>Name</label>
        <input type="text" name="name" value="${currentUser.name}" required>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" value="${currentUser.email}" disabled>
        <small>Email cannot be changed</small>
      </div>
      <div class="form-group">
        <label>New Password (leave blank to keep current)</label>
        <input type="password" name="password" minlength="6">
      </div>
      ${emp ? `
        <hr>
        <h3>Employee Details</h3>
        <div class="form-group">
          <label>Phone</label>
          <input type="tel" name="phone" value="${emp.phone || ''}">
        </div>
        <h3>Time Templates</h3>
        <p><small>Default start/end times for new entries</small></p>
        <div style="display: flex; gap: 1rem;">
          <div style="flex: 1; border: 1px solid #ddd; padding: 0.75rem; border-radius: 4px;">
            <strong>Morning</strong>
            <div class="form-group" style="margin-top: 0.5rem;">
              <label>Start</label>
              <input type="time" name="morningStart" value="${emp.morningStart || '08:30'}">
            </div>
            <div class="form-group">
              <label>End</label>
              <input type="time" name="morningEnd" value="${emp.morningEnd || '12:30'}">
            </div>
          </div>
          <div style="flex: 1; border: 1px solid #ddd; padding: 0.75rem; border-radius: 4px;">
            <strong>Afternoon</strong>
            <div class="form-group" style="margin-top: 0.5rem;">
              <label>Start</label>
              <input type="time" name="afternoonStart" value="${emp.afternoonStart || '13:00'}">
            </div>
            <div class="form-group">
              <label>End</label>
              <input type="time" name="afternoonEnd" value="${emp.afternoonEnd || '17:00'}">
            </div>
          </div>
        </div>
        <h3 style="margin-top: 1.5rem;">Saved Locations</h3>
        <p><small>Quick-select locations when creating entries. These appear in the autocomplete dropdown.</small></p>
        <div id="presetAddressesContainer"></div>
        <button type="button" class="btn btn-sm btn-primary" id="addPresetAddressBtn" style="margin-top: 0.5rem;">+ Add Location</button>
      ` : '<p><em>No employee profile linked to your account.</em></p>'}
      <button type="submit" class="btn btn-primary" style="margin-top: 1rem;">Save Profile</button>
    </form>
  `;

  showModal('My Profile', form);

  // Populate preset addresses
  if (emp) {
    const container = document.getElementById('presetAddressesContainer');
    let presets = {};
    if (emp.presetAddresses) {
      try {
        presets = typeof emp.presetAddresses === 'string' ? JSON.parse(emp.presetAddresses) : emp.presetAddresses;
      } catch (e) { /* ignore */ }
    }

    let presetIndex = 0;
    const addPresetRow = (label = '', address = '') => {
      const idx = presetIndex++;
      const row = document.createElement('div');
      row.className = 'preset-address-row';
      row.id = `presetRow_${idx}`;
      row.style.cssText = 'display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem;';
      row.innerHTML = `
        <input type="text" class="form-control preset-label" placeholder="Label (e.g. Home)" value="${(label || '').replace(/"/g, '&quot;')}" style="flex:1;">
        <input type="text" class="form-control preset-address" placeholder="Address" value="${(address || '').replace(/"/g, '&quot;')}" style="flex:2;">
        <button type="button" class="btn btn-sm btn-danger" onclick="document.getElementById('presetRow_${idx}').remove()">X</button>
      `;
      container.appendChild(row);
      // Attach autocomplete to the address input
      const addrInput = row.querySelector('.preset-address');
      if (addrInput) attachLocationAutocomplete(addrInput);
    };

    // Add existing presets
    if (presets && typeof presets === 'object') {
      for (const [label, addr] of Object.entries(presets)) {
        addPresetRow(label, addr);
      }
    }

    document.getElementById('addPresetAddressBtn').onclick = () => addPresetRow();
  }

  document.getElementById('profileForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = { name: formData.get('name') };
    const password = formData.get('password');
    if (password) data.password = password;

    if (emp) {
      data.phone = formData.get('phone') || null;
      data.morningStart = formData.get('morningStart');
      data.morningEnd = formData.get('morningEnd');
      data.afternoonStart = formData.get('afternoonStart');
      data.afternoonEnd = formData.get('afternoonEnd');

      // Collect preset addresses
      const presetObj = {};
      document.querySelectorAll('.preset-address-row').forEach(row => {
        const label = row.querySelector('.preset-label').value.trim();
        const address = row.querySelector('.preset-address').value.trim();
        if (label && address) presetObj[label] = address;
      });
      data.presetAddresses = Object.keys(presetObj).length > 0 ? presetObj : null;
    }

    try {
      const result = await api.put('/auth/profile', data);
      currentUser = result.user;
      document.getElementById('userDisplay').textContent = currentUser.name;
      hideModal();
      alert('Profile updated successfully');
    } catch (error) {
      alert(error.message);
    }
  };
}

// ==================== API KEYS ====================

let apiKeys = [];

async function loadApiKeys() {
  try {
    const result = await api.get('/api-keys');
    apiKeys = result.apiKeys;
    displayApiKeys();
  } catch (error) {
    console.error('Load API keys error:', error);
  }
}

function displayApiKeys() {
  const container = document.getElementById('apiKeysList');
  if (apiKeys.length === 0) {
    container.innerHTML = '<p>No API keys created yet.</p>';
    return;
  }

  const html = `
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Key Prefix</th>
          <th>Created By</th>
          <th>Last Used</th>
          <th>Expires</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${apiKeys.map(k => `
          <tr>
            <td>${k.name}</td>
            <td><code>${k.keyPrefix}...</code></td>
            <td>${k.user.name}</td>
            <td>${k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}</td>
            <td>${k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : 'Never'}</td>
            <td>
              <span class="status-badge ${k.isActive ? 'status-APPROVED' : 'status-LOCKED'}">${k.isActive ? 'Active' : 'Revoked'}</span>
            </td>
            <td>
              ${k.isActive ? `<button class="btn btn-sm btn-danger" onclick="revokeApiKey(${k.id})">Revoke</button>` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  container.innerHTML = html;
}

async function createApiKey() {
  const form = `
    <form id="apiKeyForm">
      <div class="form-group">
        <label>Key Name</label>
        <input type="text" name="name" required placeholder="e.g., CI/CD Pipeline">
      </div>
      <div class="form-group">
        <label>Expires (optional)</label>
        <input type="date" name="expiresAt">
      </div>
      <button type="submit" class="btn btn-primary">Create API Key</button>
    </form>
  `;

  showModal('Create API Key', form);

  document.getElementById('apiKeyForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      const result = await api.post('/api-keys', {
        name: formData.get('name'),
        expiresAt: formData.get('expiresAt') || null
      });

      // Show the key once
      const keyDisplay = `
        <div style="margin-bottom: 1rem;">
          <p style="color: #27ae60; font-weight: 600;">API Key created successfully!</p>
          <p><strong>Copy this key now - it will not be shown again:</strong></p>
          <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.5rem;">
            <input type="text" id="newApiKeyValue" value="${result.apiKey.key}" readonly
              style="font-family: monospace; flex: 1; padding: 0.5rem; background: #f8f9fa; border: 1px solid #dee2e6;">
            <button type="button" class="btn btn-primary" onclick="copyApiKey()">Copy</button>
          </div>
        </div>
        <button type="button" class="btn btn-secondary" onclick="hideModal(); loadApiKeys();">Done</button>
      `;
      document.getElementById('modalBody').innerHTML = `<h2>API Key Created</h2>${keyDisplay}`;
    } catch (error) {
      alert(error.message);
    }
  };
}

function copyApiKey() {
  const input = document.getElementById('newApiKeyValue');
  input.select();
  navigator.clipboard.writeText(input.value).then(() => {
    const btn = input.nextElementSibling;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
  });
}

async function revokeApiKey(id) {
  if (!confirm('Are you sure you want to revoke this API key? This cannot be undone.')) return;
  try {
    await api.delete(`/api-keys/${id}`);
    loadApiKeys();
  } catch (error) {
    alert(error.message);
  }
}

// ==================== DE WMS ENTRIES (TSDATA) ====================

async function showDeWmsEntries(timesheetId) {
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
            <td>${ourEntry ? ourEntry.company : '-'}</td>
            <td>${wmsEntry ? `${wmsEntry.startTime} - ${wmsEntry.endTime}` : '-'}</td>
            <td>${wmsEntry ? Number(wmsEntry.hours).toFixed(2) : '-'}</td>
            <td>${wmsEntry ? wmsEntry.company : '-'}</td>
            <td>${status}</td>
          </tr>
        `;
      }
    }

    const html = `
      <h3>DE WMS Entry Comparison</h3>
      <p>${ts.employee.user.name} &mdash; Week ${new Date(ts.weekStarting).toLocaleDateString()} - ${new Date(ts.weekEnding).toLocaleDateString()}</p>
      ${workerId ? `<p><small>DE Worker ID: ${workerId}</small></p>` : '<p style="color: #e67e22;"><small>No DE WMS worker identifier found for this employee. Showing all entries for the date range.</small></p>'}
      ${fetchError ? `<div class="alert alert-danger" style="padding: 0.75rem; background: #f8d7da; border-radius: 4px; margin-bottom: 1rem;">Could not fetch WMS data: ${fetchError}</div>` : ''}
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

    showModal('DE WMS Entries', html);
  } catch (error) {
    alert('Failed to load DE WMS comparison: ' + error.message);
  }
}

// ==================== WMS SYNC ====================

/**
 * Check if an employee has a role in any company with WMS sync enabled.
 */
function employeeHasWmsSyncRole(employee) {
  if (!employee || !employee.roles) return false;
  return employee.roles.some(r =>
    r.company && r.company.wmsSyncEnabled
  );
}

/**
 * Check if a timesheet has any entries for a WMS-sync-enabled company.
 */
function timesheetHasWmsSyncEntries(ts) {
  if (!ts.entries || ts.entries.length === 0) return false;
  return ts.entries.some(e =>
    e.company && e.company.wmsSyncEnabled
  );
}

/**
 * Returns the WMS sync button HTML - enabled, disabled, or hidden.
 */
function getWmsSyncButton(ts) {
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

  return `<button class="btn btn-sm btn-info" onclick="syncToWms(${ts.id})">Sync to WMS</button>`;
}

async function syncToWms(timesheetId) {
  const html = `
    <h3>Sync to DE WMS (TSSP)</h3>
    <div class="alert alert-info">
      Enter your DE (ADFS) login credentials. These are <strong>not stored</strong> on our servers and are only used for this sync session. Your employee profile must have a <strong>DE Worker ID</strong> identifier configured.
    </div>
    <form id="wmsSyncForm">
      <div class="form-group">
        <label>ADFS Username (e.g. domain\\username or email)</label>
        <input type="text" name="wmsUsername" required autocomplete="off" placeholder="EDUCATION\\jsmith or jsmith@education.vic.gov.au">
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

  showModal(html);

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
      alert('Failed to start sync: ' + error.message);
    }
  };
}

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

  showModal(html);
  pollSyncStatus(syncLogId);
}

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
          line.textContent = p.message;
          logEl.appendChild(line);
        }
        logEl.scrollTop = logEl.scrollHeight;
        lastProgressCount = log.progress.length;

        // Update the main status message with the latest progress
        const latest = log.progress[log.progress.length - 1];
        if (latest && messageEl) {
          messageEl.textContent = latest.message;
        }
      }

      if (log.status === 'COMPLETED') {
        clearInterval(interval);
        if (spinnerEl) spinnerEl.style.display = 'none';
        alertEl.className = 'alert alert-success';
        alertEl.innerHTML = '<strong>Timesheet synced to DE WMS successfully!</strong>';
        if (log.syncDetails) {
          try {
            const details = JSON.parse(log.syncDetails);
            const entered = details.steps && details.steps[2] ? details.steps[2].entriesEntered || 0 : details.entriesSynced || 0;
            const failed = details.steps && details.steps[2] ? details.steps[2].entriesFailed || 0 : 0;
            const skipped = details.steps && details.steps[2] ? details.steps[2].entriesSkipped || 0 : 0;
            let summary = `Entries synced: ${entered}`;
            if (failed > 0) summary += ` | Failed: ${failed}`;
            if (skipped > 0) summary += ` | Skipped: ${skipped}`;
            summary += ` | Total hours: ${(details.totalHours || 0).toFixed(2)}`;
            detailsEl.innerHTML = `<p style="margin-top: 0.5rem;">${summary}</p>`;
          } catch (_) {}
        }
        refreshTimesheets();
      } else if (log.status === 'FAILED') {
        clearInterval(interval);
        if (spinnerEl) spinnerEl.style.display = 'none';
        alertEl.className = 'alert alert-danger';
        alertEl.innerHTML = '<strong>Sync failed:</strong> ' + (log.errorMessage || 'Unknown error');
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

async function viewSyncHistory(timesheetId) {
  try {
    const result = await api.get('/wms-sync/timesheet/' + timesheetId);
    const syncs = result.syncs;

    if (syncs.length === 0) {
      showModal('<h3>Sync History</h3><p>No sync history for this timesheet.</p>');
      return;
    }

    const rows = syncs.map(sync => {
      const started = sync.startedAt ? new Date(sync.startedAt).toLocaleString() : new Date(sync.createdAt).toLocaleString();
      const duration = sync.startedAt && sync.completedAt
        ? Math.round((new Date(sync.completedAt) - new Date(sync.startedAt)) / 1000) + 's'
        : '-';
      return `
        <tr>
          <td>${started}</td>
          <td><span class="status-badge status-${sync.status}">${sync.status}</span></td>
          <td>${sync.wmsUsername || '-'}</td>
          <td>${duration}</td>
          <td>${sync.errorMessage || (sync.status === 'COMPLETED' ? 'OK' : '-')}</td>
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

    showModal(html);
  } catch (error) {
    alert('Failed to load sync history: ' + error.message);
  }
}

// ==================== EVENT LISTENERS ====================

document.addEventListener('DOMContentLoaded', () => {
  // Login form
  document.getElementById('loginForm').onsubmit = (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    login(email, password);
  };

  // Logout button
  document.getElementById('logoutBtn').onclick = logout;

  // My Profile button
  document.getElementById('myProfileBtn').onclick = showMyProfile;

  // Tab navigation
  document.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = () => {
      const tabName = tab.dataset.tab;

      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
      document.getElementById(`${tabName}Tab`).classList.add('active');

      if (tabName === 'companies') displayCompanies();
      if (tabName === 'roles') displayRoles();
      if (tabName === 'employees') displayEmployees();
      if (tabName === 'users') displayUsers();
      if (tabName === 'apiKeys') loadApiKeys();
      if (tabName === 'allTimesheets') displayAllTimesheets();
      if (tabName === 'myTimesheets') displayMyTimesheets();
    };
  });

  // Timesheet select
  document.getElementById('timesheetSelect').onchange = (e) => {
    loadEntries(e.target.value);
  };

  // Create buttons
  document.getElementById('createTimesheetBtn').onclick = createTimesheet;
  document.getElementById('createEntryBtn').onclick = createEntry;
  document.getElementById('createCompanyBtn').onclick = createCompany;
  document.getElementById('createRoleBtn').onclick = createRole;
  document.getElementById('createEmployeeBtn').onclick = createEmployee;
  document.getElementById('createUserBtn').onclick = createUser;
  document.getElementById('createApiKeyBtn').onclick = createApiKey;

  // Modal close (only via X button, not clicking outside)
  document.querySelector('.close').onclick = hideModal;

  // Check authentication
  checkAuth();
});
