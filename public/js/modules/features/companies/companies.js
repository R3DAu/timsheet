/**
 * Company management module
 */

import { api } from '../../core/api.js';
import { state } from '../../core/state.js';
import { showModalWithForm, hideModal } from '../../core/modal.js';
import { showAlert, showConfirmation } from '../../core/alerts.js';
import { escapeHtml } from '../../core/dom.js';
import { registerTabHook } from '../../core/navigation.js';

/**
 * Load companies from API
 */
export async function loadCompanies() {
  try {
    const result = await api.get('/companies');
    state.set('companies', result.companies);
    if (document.getElementById('companiesTab').classList.contains('active')) {
      displayCompanies();
    }
  } catch (error) {
    console.error('Load companies error:', error);
  }
}

/**
 * Display companies list
 */
export function displayCompanies() {
  const companies = state.get('companies');
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
            <td>${escapeHtml(c.name)}</td>
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

/**
 * Create a new company
 */
export async function createCompany() {
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

  showModalWithForm('Add Company', form);

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
      await loadCompanies();
      displayCompanies();
    } catch (error) {
      showAlert(error.message);
    }
  };
}

/**
 * Edit a company
 * @param {number} id - Company ID
 */
export async function editCompany(id) {
  const companies = state.get('companies');
  const company = companies.find(c => c.id === id);
  if (!company) return;

  const form = `
    <form id="editCompanyForm">
      <div class="form-group">
        <label>Company Name</label>
        <input type="text" name="name" value="${escapeHtml(company.name)}" required>
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

  showModalWithForm('Edit Company', form);

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
      await loadCompanies();
      displayCompanies();
    } catch (error) {
      showAlert(error.message);
    }
  };
}

/**
 * Delete a company
 * @param {number} id - Company ID
 */
export async function deleteCompany(id) {
  if (!await showConfirmation('Delete this company? This will also delete all associated roles.')) return;

  try {
    await api.delete(`/companies/${id}`);
    await loadCompanies();
    displayCompanies();
  } catch (error) {
    showAlert(error.message);
  }
}

// Register tab hook
registerTabHook('companies', displayCompanies);
