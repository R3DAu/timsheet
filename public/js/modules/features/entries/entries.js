/**
 * Entries management module
 * Handles creating, editing, and displaying timesheet entries
 */

import { api } from '../../core/api.js';
import { state } from '../../core/state.js';
import { escapeHtml } from '../../core/dom.js';
import { showAlert, showConfirmation } from '../../core/alerts.js';
import { initQuillEditor, destroyQuillEditors, quillGetHtml } from '../../core/quill.js';
import { formatTime, calculateHoursPreview, todayStr, getTimeDefaults, formatLocalDate } from '../../core/dateTime.js';
import {
  attachLocationAutocomplete,
  attachAllLocationAutocompletes,
  addLocationNoteField,
  collectLocationNotes
} from '../../components/location-autocomplete.js';
import { validateEntry, getTimesheetById, getTimesheetEntries } from './entry-validation.js';

/**
 * Get company options for entry forms with XSS protection
 * Admins see all companies; regular users see only companies they have roles assigned to.
 */
function getEntryCompanyOptions(selectedId) {
  const currentUser = state.get('currentUser');
  const companies = state.get('companies');
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

  // XSS FIX: Escape company names
  return companyList.map(c =>
    `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
  );
}

/**
 * Get roles for a specific company in entry forms with XSS protection
 * Admins see all roles for the company; regular users see only their assigned roles.
 */
function getEntryRolesForCompany(companyId) {
  const currentUser = state.get('currentUser');
  const roles = state.get('roles');
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

/**
 * Load entries for a timesheet
 */
export async function loadEntries(timesheetId) {
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

/**
 * Display entries list with XSS protection
 */
export function displayEntries(entries, timesheetId) {
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
          // XSS FIX: Escape travel locations and company/role names
          return `
          <tr>
            <td>${new Date(entry.date).toLocaleDateString()}</td>
            <td>${entry.entryType}${entry.entryType === 'TRAVEL' ? `<br><small>${escapeHtml(entry.travelFrom)} &rarr; ${escapeHtml(entry.travelTo)}</small>` : ''}</td>
            <td>${entry.startTime && entry.endTime ? `${formatTime(entry.startTime)}<br>${formatTime(entry.endTime)}` : '-'}</td>
            <td>${entry.hours.toFixed(2)}</td>
            <td>${escapeHtml(entry.company.name)}</td>
            <td>${escapeHtml(entry.role.name)}</td>
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
                <button class="btn btn-sm btn-primary" onclick="editEntrySlideIn(${entry.id}, ${timesheetId})">Edit</button>
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


/**
 * Delete an entry
 */
export async function deleteEntry(id) {
  if (!await showConfirmation('Delete this entry?')) return;

  try {
    await api.delete(`/entries/${id}`);
    const timesheetId = document.getElementById('timesheetSelect').value;
    // Refresh is handled by timesheets module
    if (window.refreshTimesheets) await window.refreshTimesheets();
    loadEntries(timesheetId);
  } catch (error) {
    showAlert(error.message);
  }
}

// ==================== NEW: SLIDE-IN PANEL VARIANTS ====================

import { showSlidePanel, hideSlidePanel } from '../../core/slide-panel.js';
import { sanitizeRichText } from '../../core/dom.js';

/**
 * Render travel route on map with waypoints
 */
async function renderTravelRoute(map, entry) {
  const markers = [];
  const waypoints = [];
  const waypointNames = [];

  // Starting point
  waypoints.push({ lat: entry.travelFromLat, lng: entry.travelFromLng });
  waypointNames.push(entry.travelFrom);
  const fromMarker = L.marker([entry.travelFromLat, entry.travelFromLng])
    .addTo(map)
    .bindPopup(`<strong>From</strong><br>${escapeHtml(entry.travelFrom || 'N/A')}`);
  markers.push(fromMarker);

  // Parse and geocode location notes
  const locationNotes = [];
  if (entry.locationNotes) {
    try {
      const lnotes = typeof entry.locationNotes === 'string'
        ? JSON.parse(entry.locationNotes)
        : entry.locationNotes;
      locationNotes.push(...lnotes);
    } catch (e) { /* ignore */ }
  }

  // Geocode all waypoints first (sequential to maintain order)
  for (let i = 0; i < locationNotes.length; i++) {
    const ln = locationNotes[i];
    if (ln.location) {
      try {
        const result = await api.get(`/maps/search?query=${encodeURIComponent(ln.location)}`);
        if (result.results && result.results.length > 0) {
          const loc = result.results[0];
          waypoints.push({ lat: loc.lat, lng: loc.lon });
          waypointNames.push(ln.location);

          const marker = L.marker([loc.lat, loc.lon], {
            icon: L.divIcon({
              className: 'waypoint-marker',
              html: `<div style="background: #e74c3c; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${i + 1}</div>`,
              iconSize: [30, 30]
            })
          }).addTo(map).bindPopup(`<strong>Stop ${i + 1}</strong><br>${escapeHtml(ln.location)}`);
          markers.push(marker);
        }
      } catch (e) {
        console.warn('Failed to geocode location note:', ln.location);
      }
    }
  }

  // Ending point
  waypoints.push({ lat: entry.travelToLat, lng: entry.travelToLng });
  waypointNames.push(entry.travelTo);
  const toMarker = L.marker([entry.travelToLat, entry.travelToLng])
    .addTo(map)
    .bindPopup(`<strong>To</strong><br>${escapeHtml(entry.travelTo || 'N/A')}`);
  markers.push(toMarker);

  // Update route text to show all waypoints
  const routeDistanceEl = document.getElementById('routeDistance');
  if (routeDistanceEl && waypointNames.length > 2) {
    const routeText = waypointNames.map((name, i) => {
      if (i === 0) return escapeHtml(name);
      if (i === waypointNames.length - 1) return `→ ${escapeHtml(name)}`;
      return `→ <span style="color: #e74c3c; font-weight: 600;">Stop ${i}</span>`;
    }).join(' ');
    routeDistanceEl.previousElementSibling.innerHTML = routeText;
  }

  // Build OSRM coordinate string with all waypoints
  const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(';');

  // Fetch driving route from OSRM
  try {
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const routeCoords = route.geometry.coordinates.map(c => [c[1], c[0]]);
      const totalDistanceKm = (route.distance / 1000).toFixed(1);
      const durationMin = Math.round(route.duration / 60);

      const routeLine = L.polyline(routeCoords, {
        color: '#3498db',
        weight: 4,
        opacity: 0.7
      }).addTo(map);

      // Update distance display
      if (routeDistanceEl) {
        routeDistanceEl.innerHTML = `<strong>Total Distance:</strong> ${totalDistanceKm} km · <strong>Duration:</strong> ~${durationMin} min${entry.distance && Math.abs(parseFloat(totalDistanceKm) - entry.distance) > 0.5 ? ` <span style="color: #e67e22;">(Stored: ${entry.distance.toFixed(1)} km - needs update)</span>` : ''}`;
      }

      // Fit map to show all markers and route
      const group = L.featureGroup([...markers, routeLine]);
      map.fitBounds(group.getBounds().pad(0.1));
    }
  } catch (err) {
    console.warn('OSRM routing failed, using straight line:', err);
    // Fallback to straight line
    const routeLine = L.polyline(waypoints.map(w => [w.lat, w.lng]), {
      color: '#3498db',
      weight: 4,
      opacity: 0.7,
      dashArray: '5, 5'
    }).addTo(map);

    if (routeDistanceEl) {
      routeDistanceEl.innerHTML = `<span style="color: #e74c3c;">Route calculation failed - showing straight line</span>`;
    }

    const group = L.featureGroup([...markers, routeLine]);
    map.fitBounds(group.getBounds().pad(0.1));
  }
}

/**
 * View entry in read-only slide panel
 */
export async function viewEntrySlideIn(entryId, timesheetId, isEditable) {
  let entry;
  try {
    const result = await api.get(`/entries/timesheet/${timesheetId}`);
    entry = result.entries.find(e => e.id === entryId);
  } catch (error) {
    showAlert('Failed to load entry');
    return;
  }

  if (!entry) {
    showAlert('Entry not found');
    return;
  }

  const dateStr = new Date(entry.date).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  const timeRange = entry.startTime && entry.endTime
    ? `${formatTime(entry.startTime)} - ${formatTime(entry.endTime)}`
    : 'Not set';

  // Parse location notes if present
  let locationNotesHtml = '';
  if (entry.locationNotes) {
    try {
      const locNotes = typeof entry.locationNotes === 'string'
        ? JSON.parse(entry.locationNotes)
        : entry.locationNotes;
      locationNotesHtml = locNotes.map(ln => `
        <div style="background: #e8f4fd; padding: 0.75rem; border-radius: 6px; border-left: 3px solid #3498db; margin-bottom: 0.5rem;">
          <strong>${escapeHtml(ln.location)}</strong>
          <div class="rich-text-content">${sanitizeRichText(ln.description)}</div>
        </div>
      `).join('');
    } catch (e) { /* ignore */ }
  }

  const html = `
    <div class="entry-detail-view">
      <div class="entry-detail-row">
        <div class="entry-detail-label">Date</div>
        <div class="entry-detail-value">${dateStr}</div>
      </div>

      <div class="entry-detail-row">
        <div class="entry-detail-label">Entry Type</div>
        <div class="entry-detail-value">
          <span class="status-badge status-${entry.status}">${entry.entryType}</span>
          ${entry.tsDataSource ? ' <span class="source-badge tsdata-badge">TSDATA</span>' : ''}
        </div>
      </div>

      <div class="entry-detail-row">
        <div class="entry-detail-label">Time</div>
        <div class="entry-detail-value">${timeRange} <span style="color: var(--muted);">(${entry.hours.toFixed(2)} hours)</span></div>
      </div>

      <div class="entry-detail-row">
        <div class="entry-detail-label">Company</div>
        <div class="entry-detail-value">${escapeHtml(entry.company.name)}</div>
      </div>

      <div class="entry-detail-row">
        <div class="entry-detail-label">Role</div>
        <div class="entry-detail-value">${escapeHtml(entry.role.name)}</div>
      </div>

      ${entry.startingLocation ? `
        <div class="entry-detail-row">
          <div class="entry-detail-label">Starting Location</div>
          <div class="entry-detail-value">📍 ${escapeHtml(entry.startingLocation)}</div>
        </div>
      ` : ''}

      ${entry.entryType === 'TRAVEL' && (entry.travelFrom || entry.travelTo) ? `
        <div class="entry-detail-row">
          <div class="entry-detail-label">Travel Route</div>
          <div class="entry-detail-value">
            <div>${escapeHtml(entry.travelFrom || 'N/A')} → ${escapeHtml(entry.travelTo || 'N/A')}</div>
            <div id="routeDistance" style="color: var(--muted); font-size: 0.9rem; margin-top: 0.25rem;">
              ${entry.distance ? `Stored: ${entry.distance.toFixed(1)} km · ` : ''}Calculating route...
            </div>
            <div style="margin-top: 0.25rem;">
              ${entry.isBillable !== false ? '<span class="billable-badge">Billable</span>' : '<span class="non-billable-badge">Non-billable</span>'}
            </div>
          </div>
        </div>
      ` : ''}

      ${(entry.startingLocationLat && entry.startingLocationLng) || (entry.travelFromLat && entry.travelFromLng && entry.travelToLat && entry.travelToLng) ? `
        <div class="entry-detail-row">
          <div class="entry-detail-label">Map</div>
          <div class="entry-detail-value">
            <div id="entryMapContainer" style="width: 100%; height: 300px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border);"></div>
          </div>
        </div>
      ` : ''}

      ${entry.notes ? `
        <div class="entry-detail-row">
          <div class="entry-detail-label">Notes / Details</div>
          <div class="entry-detail-rich-content rich-text-content">
            ${sanitizeRichText(entry.notes)}
          </div>
        </div>
      ` : ''}

      ${locationNotesHtml ? `
        <div class="entry-detail-row">
          <div class="entry-detail-label">Location Notes</div>
          <div>${locationNotesHtml}</div>
        </div>
      ` : ''}

      ${entry.reasonForDeviation ? `
        <div class="entry-detail-row">
          <div class="entry-detail-label">Reason for Deviation</div>
          <div class="entry-detail-value" style="background: #fff3cd; padding: 0.5rem; border-radius: 4px; border-left: 3px solid #ffc107;">
            ${escapeHtml(entry.reasonForDeviation)}
          </div>
        </div>
      ` : ''}

      ${entry.privateNotes ? `
        <div class="entry-detail-row">
          <div class="entry-detail-label">
            Private Notes
            <span class="private-notes-badge" style="margin-left: 0.5rem;">Internal Only</span>
          </div>
          <div class="entry-detail-rich-content rich-text-content" style="background: #fffbf0; border-color: #f0ad4e;">
            ${sanitizeRichText(entry.privateNotes)}
          </div>
        </div>
      ` : ''}

      <div class="entry-detail-row">
        <div class="entry-detail-label">Status</div>
        <div class="entry-detail-value">
          <span class="status-badge status-${entry.status}">${entry.status}</span>
        </div>
      </div>

      ${isEditable ? `
        <div class="slide-panel-actions">
          <button class="btn btn-primary" onclick="editEntrySlideIn(${entryId}, ${timesheetId})">
            Edit Entry
          </button>
          <button class="btn btn-danger" onclick="deleteEntryFromCard(${entryId}, ${timesheetId})">
            Delete Entry
          </button>
          <button class="btn btn-secondary" onclick="hideSlidePanel()">
            Close
          </button>
        </div>
      ` : `
        <div class="slide-panel-actions">
          <button class="btn btn-secondary" onclick="hideSlidePanel()">
            Close
          </button>
        </div>
      `}
    </div>
  `;

  showSlidePanel('Entry Details', html);

  // Initialize map if we have coordinates
  setTimeout(() => {
    const mapContainer = document.getElementById('entryMapContainer');
    if (!mapContainer) return;

    // Check if we have any coordinates to show
    const hasStartingLocation = entry.startingLocationLat && entry.startingLocationLng;
    const hasTravelRoute = entry.travelFromLat && entry.travelFromLng && entry.travelToLat && entry.travelToLng;

    if (!hasStartingLocation && !hasTravelRoute) return;

    // Initialize map
    let centerLat, centerLng;
    if (hasTravelRoute) {
      centerLat = (entry.travelFromLat + entry.travelToLat) / 2;
      centerLng = (entry.travelFromLng + entry.travelToLng) / 2;
    } else {
      centerLat = entry.startingLocationLat;
      centerLng = entry.startingLocationLng;
    }

    const map = L.map('entryMapContainer').setView([centerLat, centerLng], 13);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    // Add markers
    if (hasStartingLocation) {
      L.marker([entry.startingLocationLat, entry.startingLocationLng])
        .addTo(map)
        .bindPopup(`<strong>Starting Location</strong><br>${escapeHtml(entry.startingLocation || 'N/A')}`);
    }

    if (hasTravelRoute) {
      // Render route with location notes as waypoints
      renderTravelRoute(map, entry);
    }
  }, 100); // Small delay to ensure DOM is ready
}

/**
 * Get smart date/time defaults for a timesheet
 * Analyzes existing entries and picks the first available slot
 */
function getSmartDefaultsForTimesheet(timesheetId) {
  const timesheets = state.get('timesheets');
  const ts = timesheets.find(t => t.id === parseInt(timesheetId));
  const currentUser = state.get('currentUser');

  const emp = currentUser.employee;
  const morning = {
    start: emp ? emp.morningStart : '08:30',
    end: emp ? emp.morningEnd : '12:30'
  };
  const afternoon = {
    start: emp ? emp.afternoonStart : '13:00',
    end: emp ? emp.afternoonEnd : '17:00'
  };

  if (!ts) {
    return { date: todayStr(), ...morning };
  }

  // Get week start (Monday) and end (Friday) dates for workdays only
  const weekStart = new Date(ts.weekStarting);
  const weekEnd = new Date(ts.weekEnding);

  // Group existing entries by date
  const entriesByDate = {};
  if (ts.entries) {
    ts.entries.forEach(entry => {
      const dateKey = formatLocalDate(entry.date);
      if (!entriesByDate[dateKey]) entriesByDate[dateKey] = [];
      entriesByDate[dateKey].push(entry);
    });
  }

  // Check each day of the week (Monday to Friday only - skip weekends)
  const currentDate = new Date(weekStart);
  while (currentDate <= weekEnd) {
    const dayOfWeek = currentDate.getDay();

    // Skip Saturday (6) and Sunday (0)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    const dateKey = currentDate.toISOString().split('T')[0];
    const dayEntries = entriesByDate[dateKey] || [];

    // Check if morning slot is available
    const hasMorning = dayEntries.some(e =>
      e.startTime && e.startTime >= '06:00' && e.startTime < '13:00'
    );

    if (!hasMorning) {
      // Morning slot available
      return { date: dateKey, ...morning };
    }

    // Check if afternoon slot is available
    const hasAfternoon = dayEntries.some(e =>
      e.startTime && e.startTime >= '13:00' && e.startTime < '18:00'
    );

    if (!hasAfternoon) {
      // Afternoon slot available
      return { date: dateKey, ...afternoon };
    }

    // Both slots taken, move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // All slots taken, default to today with blank times
  return { date: todayStr(), start: '', end: '' };
}

/**
 * Get time defaults for a timesheet (legacy - kept for compatibility)
 */
function getTimeDefaultsForTimesheet(timesheetId) {
  return getSmartDefaultsForTimesheet(timesheetId);
}

/**
 * Create entry for a specific timesheet (slide-in panel)
 */
export async function createEntryForTimesheet(timesheetId, prefillDate = null) {
  const smartDefaults = getSmartDefaultsForTimesheet(timesheetId);
  const defaultDate = prefillDate || smartDefaults.date;
  const defaults = prefillDate ? getTimeDefaultsForTimesheet(timesheetId) : smartDefaults;

  // Set saved locations for the location note label dropdown
  const currentUser = state.get('currentUser');
  try {
    const raw = currentUser?.employee?.presetAddresses;
    const parsed = raw ? JSON.parse(raw) : [];
    window._employeeSavedLocations = Array.isArray(parsed)
      ? parsed
      : Object.entries(parsed).map(([label, address]) => ({ label, placeName: '', address }));
  } catch (_) {
    window._employeeSavedLocations = [];
  }

  const form = `
    <form id="entryFormSlide">
      <div class="form-group">
        <label>Entry Type</label>
        <select name="entryType" id="slideEntryTypeSelect" required>
          <option value="GENERAL">General</option>
          <option value="TRAVEL">Travel</option>
        </select>
      </div>
      <div class="form-group">
        <label>Date</label>
        <input type="date" name="date" value="${defaultDate}" required>
      </div>
      <div class="time-row">
        <div class="form-group">
          <label>Start Time</label>
          <input type="time" name="startTime" id="slideStartTime" value="${defaults.start}" required>
        </div>
        <div class="form-group">
          <label>End Time</label>
          <input type="time" name="endTime" id="slideEndTime" value="${defaults.end}" required>
        </div>
        <div class="calculated-hours" id="slideHoursPreview">${defaults.start && defaults.end ? calculateHoursPreview(defaults.start, defaults.end) : '0.00 hrs'}</div>
      </div>
      <div class="form-group">
        <label>Company</label>
        <select name="companyId" id="slideEntryCompanySelect" required>
          <option value="">Select company...</option>
          ${getEntryCompanyOptions().join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Role</label>
        <select name="roleId" id="slideEntryRoleSelect" required>
          <option value="">Select company first...</option>
        </select>
      </div>
      <div id="slideStartingLocationField" class="form-group">
        <label>Starting Location</label>
        <input type="text" name="startingLocation" placeholder="e.g. School name, Home, Office">
        <input type="hidden" name="startingLocationLat">
        <input type="hidden" name="startingLocationLng">
        <small style="color: #666;">Where you started from for this entry</small>
      </div>
      <div id="slideTravelFields" style="display:none;">
        <div class="form-group">
          <label>Travel From</label>
          <input type="text" name="travelFrom" placeholder="e.g. Home, Work Place 1, or full address">
          <input type="hidden" name="travelFromLat">
          <input type="hidden" name="travelFromLng">
        </div>
        <div class="form-group">
          <label>Travel To</label>
          <input type="text" name="travelTo" placeholder="e.g. School 1, or full address">
          <input type="hidden" name="travelToLat">
          <input type="hidden" name="travelToLng">
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" name="isBillable" checked>
            <span>Billable (sync to WMS)</span>
          </label>
          <small style="color: #666;">Uncheck if this travel should not be billed or synced to WMS</small>
        </div>
        <div class="form-group" style="background: #e8f4fd; padding: 0.75rem; border-radius: 6px; border-left: 4px solid #3498db; margin-top: 1rem;">
          <div style="margin-bottom: 0.5rem;">
            <strong style="color: #2c3e50;">⏱️ Auto-Calculate Travel Time</strong>
          </div>
          <div style="color: #555; font-size: 0.85rem; margin-bottom: 0.5rem;">
            1. Enter start time<br>
            2. Type location and <strong>select from dropdown</strong> (both From/To)<br>
            3. Click "Calculate" or wait 1 second
          </div>
          <button type="button" id="manualCalcTravelBtn" class="btn btn-sm btn-primary" style="width: 100%;">
            🧮 Calculate End Time from Route
          </button>
        </div>
      </div>
      <div class="quill-wrapper">
        <label>Notes / Details</label>
        <div id="slideNotesEditor"></div>
      </div>
      <div class="location-notes-section" style="border: 2px solid #3498db; border-radius: 4px; padding: 1rem; margin-bottom: 1rem; background: #f0f8ff;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <label style="font-weight: 600; color: #2c3e50; margin: 0;">Location Notes</label>
          <button type="button" class="btn btn-sm btn-primary" id="slideAddLocationNoteBtn">+ Add Location</button>
        </div>
        <small style="color: #666; display: block; margin-bottom: 0.5rem;">Add notes for each school/location visited</small>
        <div id="slideLocationNotesContainer"></div>
      </div>
      <div class="form-group">
        <label>Reason for Deviation</label>
        <textarea name="reasonForDeviation" rows="2" placeholder="If your times differ from your approved schedule, explain why" maxlength="256" style="resize: vertical;"></textarea>
        <small style="color: #666;">Required by DE WMS if entry times deviate from your default schedule</small>
      </div>
      <div class="private-notes-wrapper">
        <label>Private Notes (internal only - not visible to clients)</label>
        <div id="slidePrivateNotesEditor"></div>
      </div>
      <button type="submit" class="btn btn-primary">Create Entry</button>
    </form>
  `;

  showSlidePanel('Create Entry', form);
  destroyQuillEditors();

  const notesEditor = initQuillEditor('slideNotesEditor', 'Enter notes or details...');
  const privateNotesEditor = initQuillEditor('slidePrivateNotesEditor', 'Internal notes...');

  document.getElementById('slideAddLocationNoteBtn').onclick = () => {
    addLocationNoteField('slideLocationNotesContainer');
  };

  const updateHoursPreview = () => {
    const start = document.getElementById('slideStartTime').value;
    const end = document.getElementById('slideEndTime').value;
    document.getElementById('slideHoursPreview').textContent = calculateHoursPreview(start, end) || '0.00 hrs';
  };
  document.getElementById('slideStartTime').onchange = updateHoursPreview;
  document.getElementById('slideEndTime').onchange = updateHoursPreview;

  // Auto-calculate travel time and set end time
  const autoCalculateTravelTime = async () => {
    const entryType = document.getElementById('slideEntryTypeSelect').value;
    if (entryType !== 'TRAVEL') return;

    const startTime = document.getElementById('slideStartTime').value;
    const travelFromLat = document.querySelector('#slideTravelFields input[name="travelFromLat"]').value;
    const travelFromLng = document.querySelector('#slideTravelFields input[name="travelFromLng"]').value;
    const travelToLat = document.querySelector('#slideTravelFields input[name="travelToLat"]').value;
    const travelToLng = document.querySelector('#slideTravelFields input[name="travelToLng"]').value;

    if (!startTime || !travelFromLat || !travelFromLng || !travelToLat || !travelToLng) {
      console.log('Auto-calc skipped: missing required fields', { startTime, travelFromLat, travelFromLng, travelToLat, travelToLng });
      return;
    }

    console.log('Auto-calculating travel time...');

    // Build waypoint list with location notes
    const waypoints = [{ lat: parseFloat(travelFromLat), lng: parseFloat(travelFromLng) }];

    // Add location notes waypoints
    const locationNoteItems = document.querySelectorAll('#slideLocationNotesContainer .location-note-item');
    for (const item of locationNoteItems) {
      const locationInput = item.querySelector('.location-name-input').value.trim();
      if (locationInput) {
        try {
          const result = await api.get(`/maps/search?query=${encodeURIComponent(locationInput)}`);
          if (result.results && result.results.length > 0) {
            waypoints.push({ lat: result.results[0].lat, lng: result.results[0].lon });
          }
        } catch (e) { /* ignore */ }
      }
    }

    waypoints.push({ lat: parseFloat(travelToLat), lng: parseFloat(travelToLng) });

    // Calculate route duration
    try {
      const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(';');
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const durationMinutes = Math.round(data.routes[0].duration / 60);
        console.log(`Route calculated: ${durationMinutes} minutes`);

        // Calculate end time = start time + duration
        const [hours, minutes] = startTime.split(':').map(Number);
        const startMinutes = hours * 60 + minutes;
        const endMinutes = startMinutes + durationMinutes;
        const endHours = Math.floor(endMinutes / 60) % 24;
        const endMins = endMinutes % 60;
        const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

        console.log(`Auto-setting end time: ${startTime} + ${durationMinutes}min = ${endTime}`);

        // Set end time (user can still override)
        document.getElementById('slideEndTime').value = endTime;
        updateHoursPreview();

        // Show notification
        const hoursPreview = document.getElementById('slideHoursPreview');
        hoursPreview.innerHTML += ` <span style="color: #27ae60; font-size: 0.8rem;">(Auto-calculated from ${durationMinutes} min route)</span>`;
        setTimeout(() => updateHoursPreview(), 3000);
      } else {
        console.warn('OSRM returned no routes');
      }
    } catch (err) {
      console.warn('Failed to auto-calculate travel time:', err);
    }
  };

  document.getElementById('slideEntryTypeSelect').onchange = (e) => {
    const isTravel = e.target.value === 'TRAVEL';
    document.getElementById('slideTravelFields').style.display = isTravel ? 'block' : 'none';
    document.getElementById('slideStartingLocationField').style.display = isTravel ? 'none' : 'block';

    // Clear end time for travel entries - it will be auto-calculated from route
    if (isTravel) {
      document.getElementById('slideEndTime').value = '';
      updateHoursPreview();
      console.log('Switched to TRAVEL - end time cleared, will auto-calculate from route');

      // Try to auto-calculate immediately if locations are already filled
      setTimeout(() => {
        console.log('Checking if auto-calc can run immediately...');
        autoCalculateTravelTime();
      }, 100);
    }
  };

  // Trigger auto-calculation when relevant fields change
  document.getElementById('slideStartTime').addEventListener('change', autoCalculateTravelTime);

  const travelFromField = document.querySelector('#slideTravelFields input[name="travelFrom"]');
  const travelToField = document.querySelector('#slideTravelFields input[name="travelTo"]');

  if (travelFromField) {
    travelFromField.addEventListener('change', () => {
      console.log('Travel From changed, scheduling auto-calc');
      setTimeout(autoCalculateTravelTime, 1000); // Wait for autocomplete to populate coords
    });
  }

  if (travelToField) {
    travelToField.addEventListener('change', () => {
      console.log('Travel To changed, scheduling auto-calc');
      setTimeout(autoCalculateTravelTime, 1000);
    });
  }

  // Manual calculate button
  const manualCalcBtn = document.getElementById('manualCalcTravelBtn');
  if (manualCalcBtn) {
    manualCalcBtn.addEventListener('click', () => {
      console.log('Manual calculate clicked');
      autoCalculateTravelTime();
    });
  }

  document.getElementById('slideEntryCompanySelect').onchange = (e) => {
    const companyId = parseInt(e.target.value);
    const roleSelect = document.getElementById('slideEntryRoleSelect');
    if (!companyId) {
      roleSelect.innerHTML = '<option value="">Select company first...</option>';
      return;
    }
    const filteredRoles = getEntryRolesForCompany(companyId);
    roleSelect.innerHTML = '<option value="">Select role...</option>' +
      filteredRoles.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
  };

  attachAllLocationAutocompletes();

  document.getElementById('entryFormSlide').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const existingEntries = getTimesheetEntries(timesheetId);
    const validation = validateEntry({
      date: formData.get('date'),
      startTime: formData.get('startTime'),
      endTime: formData.get('endTime')
    }, existingEntries, null, timesheetId);

    if (!validation.valid) {
      showAlert('Entry validation failed:\n\n' + validation.errors.join('\n'));
      return;
    }

    if (validation.warnings && validation.warnings.length > 0) {
      if (!await showConfirmation('Warning:\n\n' + validation.warnings.join('\n') + '\n\nContinue anyway?')) {
        return;
      }
    }

    const notesHtml = quillGetHtml(notesEditor) || null;
    const privateNotesHtml = quillGetHtml(privateNotesEditor) || null;
    const locationNotesJson = collectLocationNotes('slideLocationNotesContainer');

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
        startingLocationLat: formData.get('startingLocationLat') ? parseFloat(formData.get('startingLocationLat')) : null,
        startingLocationLng: formData.get('startingLocationLng') ? parseFloat(formData.get('startingLocationLng')) : null,
        reasonForDeviation: formData.get('reasonForDeviation') || null,
        notes: notesHtml || null,
        privateNotes: privateNotesHtml || null,
        locationNotes: locationNotesJson,
        travelFrom: formData.get('travelFrom') || null,
        travelFromLat: formData.get('travelFromLat') ? parseFloat(formData.get('travelFromLat')) : null,
        travelFromLng: formData.get('travelFromLng') ? parseFloat(formData.get('travelFromLng')) : null,
        travelTo: formData.get('travelTo') || null,
        travelToLat: formData.get('travelToLat') ? parseFloat(formData.get('travelToLat')) : null,
        travelToLng: formData.get('travelToLng') ? parseFloat(formData.get('travelToLng')) : null,
        isBillable: formData.get('isBillable') === 'on'
      });

      hideSlidePanel();
      if (window.refreshTimesheets) await window.refreshTimesheets();
    } catch (error) {
      showAlert(error.message);
    }
  };
}

/**
 * Create entry for a specific date (convenience wrapper)
 */
export async function createEntryForDate(timesheetId, dateStr) {
  await createEntryForTimesheet(timesheetId, dateStr);
}

/**
 * Edit entry in slide-in panel
 */
export async function editEntrySlideIn(entryId, timesheetId) {
  let entry;
  try {
    const result = await api.get(`/entries/timesheet/${timesheetId}`);
    entry = result.entries.find(e => e.id === entryId);
  } catch (error) {
    showAlert('Failed to load entry');
    return;
  }

  if (!entry) {
    showAlert('Entry not found');
    return;
  }

  // Set saved locations for the location note label dropdown
  const currentUser = state.get('currentUser');
  try {
    const raw = currentUser?.employee?.presetAddresses;
    const parsed = raw ? JSON.parse(raw) : [];
    window._employeeSavedLocations = Array.isArray(parsed)
      ? parsed
      : Object.entries(parsed).map(([label, address]) => ({ label, placeName: '', address }));
  } catch (_) {
    window._employeeSavedLocations = [];
  }

  const dateStr = formatLocalDate(entry.date);
  const isTsData = entry.tsDataSource === true;
  const readonly = isTsData ? 'readonly onclick="return false;" style="background-color: #f5f5f5; cursor: not-allowed;"' : '';
  const disabled = isTsData ? 'disabled style="background-color: #f5f5f5; cursor: not-allowed;"' : '';

  const form = `
    <form id="editEntryFormSlide">
      ${isTsData ? `
        <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 0.75rem; margin-bottom: 1rem;">
          <strong style="color: #856404;">📊 TSDATA Entry</strong>
          <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #856404;">
            Date, time, and hours are readonly (imported from TSDATA).
            You can edit notes, descriptions, and location details.
            ${entry.verified ? '<span style="color: #27ae60;">✓ Verified</span>' : ''}
          </p>
        </div>
      ` : ''}
      <div class="form-group">
        <label>Entry Type</label>
        <select name="entryType" id="slideEditEntryTypeSelect" required ${disabled}>
          <option value="GENERAL" ${entry.entryType === 'GENERAL' ? 'selected' : ''}>General</option>
          <option value="TRAVEL" ${entry.entryType === 'TRAVEL' ? 'selected' : ''}>Travel</option>
        </select>
      </div>
      <div class="form-group">
        <label>Date</label>
        <input type="date" name="date" value="${dateStr}" required ${readonly}>
      </div>
      <div class="time-row">
        <div class="form-group">
          <label>Start Time</label>
          <input type="time" name="startTime" id="slideEditStartTime" value="${entry.startTime || ''}" required ${readonly}>
        </div>
        <div class="form-group">
          <label>End Time</label>
          <input type="time" name="endTime" id="slideEditEndTime" value="${entry.endTime || ''}" required ${readonly}>
        </div>
        <div class="calculated-hours" id="slideEditHoursPreview">${entry.hours.toFixed(2)} hrs</div>
      </div>
      <div class="form-group">
        <label>Company</label>
        <select name="companyId" id="slideEditEntryCompanySelect" required ${disabled}>
          <option value="">Select company...</option>
          ${getEntryCompanyOptions(entry.companyId).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Role</label>
        <select name="roleId" id="slideEditEntryRoleSelect" required ${disabled}>
          <option value="">Select role...</option>
          ${getEntryRolesForCompany(entry.companyId).map(r => `<option value="${r.id}" ${r.id === entry.roleId ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}
        </select>
      </div>
      <div id="slideEditStartingLocationField" class="form-group" style="display:${entry.entryType === 'TRAVEL' ? 'none' : 'block'};">
        <label>Starting Location</label>
        <input type="text" name="startingLocation" value="${escapeHtml(entry.startingLocation || '')}" placeholder="e.g. School name, Home, Office">
        <input type="hidden" name="startingLocationLat" value="${entry.startingLocationLat || ''}">
        <input type="hidden" name="startingLocationLng" value="${entry.startingLocationLng || ''}">
        <small style="color: #666;">Where you started from for this entry</small>
      </div>
      <div id="slideEditTravelFields" style="display:${entry.entryType === 'TRAVEL' ? 'block' : 'none'};">
        <div class="form-group">
          <label>Travel From</label>
          <input type="text" name="travelFrom" value="${escapeHtml(entry.travelFrom || '')}">
          <input type="hidden" name="travelFromLat" value="${entry.travelFromLat || ''}">
          <input type="hidden" name="travelFromLng" value="${entry.travelFromLng || ''}">
        </div>
        <div class="form-group">
          <label>Travel To</label>
          <input type="text" name="travelTo" value="${escapeHtml(entry.travelTo || '')}">
          <input type="hidden" name="travelToLat" value="${entry.travelToLat || ''}">
          <input type="hidden" name="travelToLng" value="${entry.travelToLng || ''}">
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" name="isBillable" ${entry.isBillable !== false ? 'checked' : ''}>
            <span>Billable (sync to WMS)</span>
          </label>
          <small style="color: #666;">Mark as billable for WMS timesheet sync</small>
        </div>
        <div class="form-group" style="background: #e8f4fd; padding: 0.75rem; border-radius: 6px; border-left: 4px solid #3498db; margin-top: 1rem;">
          <div style="margin-bottom: 0.5rem;">
            <strong style="color: #2c3e50;">⏱️ Auto-Calculate Travel Time</strong>
          </div>
          <div style="color: #555; font-size: 0.85rem; margin-bottom: 0.5rem;">
            1. Enter start time<br>
            2. Type location and <strong>select from dropdown</strong> (both From/To)<br>
            3. Click "Calculate" or wait 1 second
          </div>
          <button type="button" id="manualCalcEditTravelBtn" class="btn btn-sm btn-primary" style="width: 100%;">
            🧮 Calculate End Time from Route
          </button>
        </div>
      </div>
      <div class="quill-wrapper">
        <label>Notes / Details</label>
        <div id="slideEditNotesEditor"></div>
      </div>
      <div class="location-notes-section" style="border: 2px solid #3498db; border-radius: 4px; padding: 1rem; margin-bottom: 1rem; background: #f0f8ff;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <label style="font-weight: 600; color: #2c3e50; margin: 0;">Location Notes</label>
          <button type="button" class="btn btn-sm btn-primary" id="slideEditAddLocationNoteBtn">+ Add Location</button>
        </div>
        <small style="color: #666; display: block; margin-bottom: 0.5rem;">Add notes for each school/location visited</small>
        <div id="slideEditLocationNotesContainer"></div>
      </div>
      <div class="form-group">
        <label>Reason for Deviation</label>
        <textarea name="reasonForDeviation" rows="2" maxlength="256" style="resize: vertical;" placeholder="If your times differ from your approved schedule, explain why">${escapeHtml(entry.reasonForDeviation || '')}</textarea>
        <small style="color: #666;">Required by DE WMS if entry times deviate from your default schedule</small>
      </div>
      <div class="private-notes-wrapper">
        <label>Private Notes (internal only - not visible to clients)</label>
        <div id="slideEditPrivateNotesEditor"></div>
      </div>
      <button type="submit" class="btn btn-primary">Save Changes</button>
    </form>
  `;

  showSlidePanel('Edit Entry', form);
  destroyQuillEditors();

  const notesEditor = initQuillEditor('slideEditNotesEditor', 'Enter notes or details...');
  const privateNotesEditor = initQuillEditor('slideEditPrivateNotesEditor', 'Internal notes...');

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
        addLocationNoteField('slideEditLocationNotesContainer', ln.location, ln.description, ln.label, ln.placeName);
      });
    } catch (e) { /* ignore */ }
  }

  document.getElementById('slideEditAddLocationNoteBtn').onclick = () => {
    addLocationNoteField('slideEditLocationNotesContainer');
  };

  const updateHoursPreview = () => {
    const start = document.getElementById('slideEditStartTime').value;
    const end = document.getElementById('slideEditEndTime').value;
    document.getElementById('slideEditHoursPreview').textContent = calculateHoursPreview(start, end) || `${entry.hours.toFixed(2)} hrs`;
  };
  document.getElementById('slideEditStartTime').onchange = updateHoursPreview;
  document.getElementById('slideEditEndTime').onchange = updateHoursPreview;

  // Auto-calculate travel time and set end time
  const autoCalculateEditTravelTime = async () => {
    const entryType = document.getElementById('slideEditEntryTypeSelect').value;
    if (entryType !== 'TRAVEL') return;

    const startTime = document.getElementById('slideEditStartTime').value;
    const travelFromLat = document.querySelector('#slideEditTravelFields input[name="travelFromLat"]').value;
    const travelFromLng = document.querySelector('#slideEditTravelFields input[name="travelFromLng"]').value;
    const travelToLat = document.querySelector('#slideEditTravelFields input[name="travelToLat"]').value;
    const travelToLng = document.querySelector('#slideEditTravelFields input[name="travelToLng"]').value;

    if (!startTime || !travelFromLat || !travelFromLng || !travelToLat || !travelToLng) {
      console.log('Edit: Auto-calc skipped - missing required fields', { startTime, travelFromLat, travelFromLng, travelToLat, travelToLng });
      return;
    }

    console.log('Edit: Auto-calculating travel time...');

    // Build waypoint list with location notes
    const waypoints = [{ lat: parseFloat(travelFromLat), lng: parseFloat(travelFromLng) }];

    // Add location notes waypoints
    const locationNoteItems = document.querySelectorAll('#slideEditLocationNotesContainer .location-note-item');
    for (const item of locationNoteItems) {
      const locationInput = item.querySelector('.location-name-input').value.trim();
      if (locationInput) {
        try {
          const result = await api.get(`/maps/search?query=${encodeURIComponent(locationInput)}`);
          if (result.results && result.results.length > 0) {
            waypoints.push({ lat: result.results[0].lat, lng: result.results[0].lon });
          }
        } catch (e) { /* ignore */ }
      }
    }

    waypoints.push({ lat: parseFloat(travelToLat), lng: parseFloat(travelToLng) });

    // Calculate route duration
    try {
      const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(';');
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const durationMinutes = Math.round(data.routes[0].duration / 60);

        // Calculate end time = start time + duration
        const [hours, minutes] = startTime.split(':').map(Number);
        const startMinutes = hours * 60 + minutes;
        const endMinutes = startMinutes + durationMinutes;
        const endHours = Math.floor(endMinutes / 60) % 24;
        const endMins = endMinutes % 60;
        const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

        // Set end time (user can still override)
        document.getElementById('slideEditEndTime').value = endTime;
        updateHoursPreview();

        // Show notification
        const hoursPreview = document.getElementById('slideEditHoursPreview');
        hoursPreview.innerHTML += ` <span style="color: #27ae60; font-size: 0.8rem;">(Auto-calculated from ${durationMinutes} min route)</span>`;
        setTimeout(() => updateHoursPreview(), 3000);
      }
    } catch (err) {
      console.warn('Failed to auto-calculate travel time:', err);
    }
  };

  document.getElementById('slideEditEntryTypeSelect').onchange = (e) => {
    const isTravel = e.target.value === 'TRAVEL';
    document.getElementById('slideEditTravelFields').style.display = isTravel ? 'block' : 'none';
    document.getElementById('slideEditStartingLocationField').style.display = isTravel ? 'none' : 'block';

    // Clear end time for travel entries - it will be auto-calculated from route
    if (isTravel) {
      document.getElementById('slideEditEndTime').value = '';
      updateHoursPreview();
      console.log('Switched to TRAVEL - end time cleared, will auto-calculate from route');

      // Try to auto-calculate immediately if locations are already filled
      setTimeout(() => {
        console.log('Checking if auto-calc can run immediately...');
        autoCalculateEditTravelTime();
      }, 100);
    }
  };

  // Trigger auto-calculation when relevant fields change
  document.getElementById('slideEditStartTime').addEventListener('change', autoCalculateEditTravelTime);
  const editTravelFromInput = document.querySelector('#slideEditTravelFields input[name="travelFrom"]');
  const editTravelToInput = document.querySelector('#slideEditTravelFields input[name="travelTo"]');
  if (editTravelFromInput) {
    editTravelFromInput.addEventListener('change', () => {
      console.log('Edit: Travel From changed, scheduling auto-calc');
      setTimeout(autoCalculateEditTravelTime, 1000);
    });
  }
  if (editTravelToInput) {
    editTravelToInput.addEventListener('change', () => {
      console.log('Edit: Travel To changed, scheduling auto-calc');
      setTimeout(autoCalculateEditTravelTime, 1000);
    });
  }

  // Manual calculate button
  const manualCalcEditBtn = document.getElementById('manualCalcEditTravelBtn');
  if (manualCalcEditBtn) {
    manualCalcEditBtn.addEventListener('click', () => {
      console.log('Edit: Manual calculate clicked');
      autoCalculateEditTravelTime();
    });
  }

  document.getElementById('slideEditEntryCompanySelect').onchange = (e) => {
    const companyId = parseInt(e.target.value);
    const roleSelect = document.getElementById('slideEditEntryRoleSelect');
    if (!companyId) {
      roleSelect.innerHTML = '<option value="">Select company first...</option>';
      return;
    }
    const filteredRoles = getEntryRolesForCompany(companyId);
    roleSelect.innerHTML = '<option value="">Select role...</option>' +
      filteredRoles.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
  };

  attachAllLocationAutocompletes();

  document.getElementById('editEntryFormSlide').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const existingEntries = getTimesheetEntries(timesheetId);
    const validation = validateEntry({
      date: formData.get('date'),
      startTime: formData.get('startTime'),
      endTime: formData.get('endTime')
    }, existingEntries, entryId, timesheetId);

    if (!validation.valid) {
      showAlert('Entry validation failed:\n\n' + validation.errors.join('\n'));
      return;
    }

    if (validation.warnings && validation.warnings.length > 0) {
      if (!await showConfirmation('Warning:\n\n' + validation.warnings.join('\n') + '\n\nContinue anyway?')) {
        return;
      }
    }

    const notesHtml = quillGetHtml(notesEditor) || null;
    const privateNotesHtml = quillGetHtml(privateNotesEditor) || null;
    const locationNotesJson = collectLocationNotes('slideEditLocationNotesContainer');

    try {
      await api.put(`/entries/${entryId}`, {
        entryType: formData.get('entryType'),
        date: formData.get('date'),
        startTime: formData.get('startTime'),
        endTime: formData.get('endTime'),
        companyId: parseInt(formData.get('companyId')),
        roleId: parseInt(formData.get('roleId')),
        startingLocation: formData.get('startingLocation') || null,
        startingLocationLat: formData.get('startingLocationLat') ? parseFloat(formData.get('startingLocationLat')) : null,
        startingLocationLng: formData.get('startingLocationLng') ? parseFloat(formData.get('startingLocationLng')) : null,
        reasonForDeviation: formData.get('reasonForDeviation') || null,
        notes: notesHtml || null,
        privateNotes: privateNotesHtml || null,
        locationNotes: locationNotesJson,
        travelFrom: formData.get('travelFrom'),
        travelFromLat: formData.get('travelFromLat') ? parseFloat(formData.get('travelFromLat')) : null,
        travelFromLng: formData.get('travelFromLng') ? parseFloat(formData.get('travelFromLng')) : null,
        travelTo: formData.get('travelTo'),
        travelToLat: formData.get('travelToLat') ? parseFloat(formData.get('travelToLat')) : null,
        travelToLng: formData.get('travelToLng') ? parseFloat(formData.get('travelToLng')) : null,
        isBillable: formData.get('isBillable') === 'on'
      });

      hideSlidePanel();
      if (window.refreshTimesheets) await window.refreshTimesheets();
    } catch (error) {
      showAlert(error.message);
    }
  };
}

/**
 * Delete entry from card (knows timesheetId)
 */
export async function deleteEntryFromCard(entryId, timesheetId) {
  if (!await showConfirmation('Delete this entry?')) return;

  try {
    await api.delete(`/entries/${entryId}`);
    hideSlidePanel();
    if (window.refreshTimesheets) await window.refreshTimesheets();
  } catch (error) {
    showAlert(error.message);
  }
}
