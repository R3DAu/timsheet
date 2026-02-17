/**
 * Role management module
 */

import { api } from '../../core/api.js';
import { state } from '../../core/state.js';
import { showModalWithForm, hideModal } from '../../core/modal.js';
import { showAlert, showConfirmation } from '../../core/alerts.js';
import { escapeHtml } from '../../core/dom.js';
import { registerTabHook } from '../../core/navigation.js';

/**
 * Load roles from API
 */
export async function loadRoles() {
  try {
    const result = await api.get('/roles');
    state.set('roles', result.roles);
    if (document.getElementById('rolesTab').classList.contains('active')) {
      displayRoles();
    }
  } catch (error) {
    console.error('Load roles error:', error);
  }
}

/**
 * Display roles list
 */
export function displayRoles() {
  const roles = state.get('roles');
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
            <td>${escapeHtml(r.name)}</td>
            <td>${escapeHtml(r.company.name)}</td>
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

/**
 * Create a new role
 */
export async function createRole() {
  const companies = state.get('companies');

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
          ${companies.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Pay Rate ($/hr)</label>
        <input type="number" name="payRate" step="0.01" min="0" required>
      </div>
      <button type="submit" class="btn btn-primary">Create Role</button>
    </form>
  `;

  showModalWithForm('Add Role', form);

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
      await loadRoles();
      displayRoles();
    } catch (error) {
      showAlert(error.message);
    }
  };
}

/**
 * Edit a role
 * @param {number} id - Role ID
 */
export async function editRole(id) {
  const roles = state.get('roles');
  const role = roles.find(r => r.id === id);
  if (!role) return;

  const form = `
    <form id="editRoleForm">
      <div class="form-group">
        <label>Role Name</label>
        <input type="text" name="name" value="${escapeHtml(role.name)}" required>
      </div>
      <div class="form-group">
        <label>Company</label>
        <select name="companyId" disabled>
          <option>${escapeHtml(role.company.name)}</option>
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

  showModalWithForm('Edit Role', form);

  document.getElementById('editRoleForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await api.put(`/roles/${id}`, {
        name: formData.get('name'),
        payRate: parseFloat(formData.get('payRate'))
      });
      hideModal();
      await loadRoles();
      displayRoles();
    } catch (error) {
      showAlert(error.message);
    }
  };
}

/**
 * Delete a role
 * @param {number} id - Role ID
 */
export async function deleteRole(id) {
  if (!showConfirmation('Delete this role?')) return;

  try {
    await api.delete(`/roles/${id}`);
    await loadRoles();
    displayRoles();
  } catch (error) {
    showAlert(error.message);
  }
}

// Register tab hook
registerTabHook('roles', displayRoles);
