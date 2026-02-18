/**
 * My Profile management module
 */

import { api } from '../../core/api.js';
import { state } from '../../core/state.js';
import { showAlert } from '../../core/alerts.js';
import { escapeHtml } from '../../core/dom.js';
import { showSlidePanel, hideSlidePanel } from '../../core/slide-panel.js';
import { attachLocationAutocomplete } from '../../components/location-autocomplete.js';

/**
 * Show My Profile modal with XSS protection
 */
export async function showMyProfile() {
  // Re-fetch current user data
  let currentUser;
  try {
    const result = await api.get('/auth/me');
    currentUser = result.user;
    state.set('currentUser', currentUser); // Update state
  } catch (error) {
    showAlert('Failed to load profile');
    return;
  }

  const emp = currentUser.employee;

  const form = `
    <form id="profileForm">
      <div class="form-group">
        <label>Name</label>
        <input type="text" name="name" value="${escapeHtml(currentUser.name)}" required>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" value="${escapeHtml(currentUser.email)}" disabled>
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
          <input type="tel" name="phone" value="${escapeHtml(emp.phone || '')}">
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

  showSlidePanel('My Profile', form);

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
      // XSS FIX: Use escapeHtml for both label and address
      row.innerHTML = `
        <input type="text" class="form-control preset-label" placeholder="Label (e.g. Home)" value="${escapeHtml(label || '')}" style="flex:1;">
        <input type="text" class="form-control preset-address" placeholder="Address" value="${escapeHtml(address || '')}" style="flex:2;">
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
      const updatedUser = result.user;
      state.set('currentUser', updatedUser);
      document.getElementById('userDisplay').textContent = updatedUser.name;
      hideSlidePanel();
      showAlert('Profile updated successfully');
    } catch (error) {
      showAlert(error.message);
    }
  };
}
