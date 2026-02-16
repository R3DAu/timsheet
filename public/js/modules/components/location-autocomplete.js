/**
 * Location autocomplete component
 * Provides autocomplete for location fields with preset addresses and search results
 */

import { escapeHtml } from '../core/dom.js';
import { state } from '../core/state.js';
import { api } from '../core/api.js';
import { initQuillEditor, getQuillEditor } from '../core/quill.js';
import { registerAutocompleteCleanup } from '../core/modal.js';

// Track active autocomplete instances
let activeAutocompletes = [];
let autocompleteDebounceTimers = {};
let locationNoteCounter = 0;

/**
 * Destroy all active autocompletes
 */
export function destroyAutocompletes() {
  document.querySelectorAll('.location-autocomplete-dropdown').forEach(el => el.remove());
  activeAutocompletes = [];
  autocompleteDebounceTimers = {};
}

// Register cleanup function with modal module
registerAutocompleteCleanup(destroyAutocompletes);

/**
 * Attach autocomplete to a text input. Shows saved locations + search results.
 * Dropdown includes "Use as entered" to accept typed text as-is.
 * @param {HTMLInputElement} input - The input element
 */
export function attachLocationAutocomplete(input) {
  const id = 'ac_' + Math.random().toString(36).slice(2, 8);
  input.dataset.acId = id;
  activeAutocompletes.push(id);

  // Get preset addresses from current user's employee profile
  const currentUser = state.get('currentUser');
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

      // Fetch search results
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

/**
 * Show autocomplete dropdown
 * @private
 */
function showDropdown(input, id, presets, places, query) {
  removeDropdown(id);

  const dropdown = document.createElement('div');
  dropdown.className = 'location-autocomplete-dropdown';
  dropdown.id = 'dropdown_' + id;

  if (presets.length > 0) {
    const header = document.createElement('div');
    header.className = 'ac-header';
    header.textContent = 'Saved Locations';
    dropdown.appendChild(header);

    for (const p of presets) {
      const item = document.createElement('div');
      item.className = 'ac-item';
      item.innerHTML = `<strong>${escapeHtml(p.label)}</strong><br><small style="color:var(--text);">${escapeHtml(p.address)}</small>`;
      item.onmousedown = (e) => {
        e.preventDefault();
        input.value = `${p.label} - ${p.address}`;
        removeDropdown(id);
      };
      item.onmouseenter = () => item.style.background = '#f0f8ff';
      item.onmouseleave = () => item.style.background = '';
      dropdown.appendChild(item);
    }
  }

  if (places.length > 0) {
    const header = document.createElement('div');
    header.className = 'ac-header';
    header.textContent = 'Search Results';
    dropdown.appendChild(header);

    for (const p of places.slice(0, 5)) {
      const item = document.createElement('div');
      item.className = 'ac-item';
      item.innerHTML = `<strong>${escapeHtml(p.mainText)}</strong><br><small style="color:#666;">${escapeHtml(p.secondaryText)}</small>`;
      item.onmousedown = (e) => {
        e.preventDefault();
        input.value = `${p.mainText} - ${p.secondaryText}`;
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
    useAsIs.className = 'ac-use-as-is';
    useAsIs.innerHTML = `Use "<strong>${escapeHtml(query)}</strong>" as entered`;
    useAsIs.onmousedown = (e) => {
      e.preventDefault();
      removeDropdown(id);
    };
    dropdown.appendChild(useAsIs);
  }

  // Don't show empty dropdown
  if (dropdown.children.length === 0) return;

  // Position below input
  const position = () => {
    const rect = input.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top = (rect.bottom + 2) + 'px';
    dropdown.style.left = rect.left + 'px';
    dropdown.style.width = rect.width + 'px';
  };

  position();
  window.addEventListener('scroll', position, true);
  window.addEventListener('resize', position);

  dropdown.addEventListener('remove', () => {
    window.removeEventListener('scroll', position, true);
    window.removeEventListener('resize', position);
  });

  document.body.appendChild(dropdown);
}

/**
 * Remove autocomplete dropdown
 * @private
 */
function removeDropdown(id) {
  const el = document.getElementById('dropdown_' + id);
  if (el) el.remove();
}

/**
 * Find all location inputs in the current modal and attach autocomplete
 */
export function attachAllLocationAutocompletes() {
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

/**
 * Add a location note field
 * @param {string} containerId - Container element ID
 * @param {string} location - Pre-filled location name
 * @param {string} description - Pre-filled description HTML
 * @returns {Object} - { index, editorId }
 */
export function addLocationNoteField(containerId, location, description) {
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

/**
 * Remove a location note field
 * @param {number} index - Location note index
 */
export function removeLocationNote(index) {
  const el = document.getElementById(`locationNote_${index}`);
  if (el) {
    const editorId = `locationEditor_${index}`;
    // Note: Quill editor cleanup is handled by destroyQuillEditors in modal.js
    el.remove();
  }
}

/**
 * Collect location notes from container
 * @param {string} containerId - Container element ID
 * @returns {string|null} - JSON string of location notes or null
 */
export function collectLocationNotes(containerId) {
  const container = document.getElementById(containerId);
  const items = container.querySelectorAll('.location-note-item');
  const notes = [];
  items.forEach(item => {
    const location = item.querySelector('.location-name-input').value.trim();
    const editorDiv = item.querySelector('[id^="locationEditor_"]');
    if (editorDiv) {
      const editor = getQuillEditor(editorDiv.id);
      if (editor) {
        const html = editor.root.innerHTML;
        const description = html === '<p><br></p>' ? '' : html;
        if (location || description) {
          notes.push({ location, description });
        }
      }
    }
  });
  return notes.length > 0 ? JSON.stringify(notes) : null;
}
