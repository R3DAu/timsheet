/**
 * Employee management module
 * CRITICAL XSS FIXES: Fixed onclick injection vulnerability at line 2013
 */

import { api } from '../../core/api.js';
import { state } from '../../core/state.js';
import { showModalWithForm, showModalWithHTML, hideModal } from '../../core/modal.js';
import { showAlert, showConfirmation } from '../../core/alerts.js';
import { escapeHtml } from '../../core/dom.js';
import { registerTabHook } from '../../core/navigation.js';

/**
 * Load employees from API
 */
export async function loadEmployees() {
  try {
    const result = await api.get('/employees');
    state.set('employees', result.employees);
    if (document.getElementById('employeesTab').classList.contains('active')) {
      displayEmployees();
    }
  } catch (error) {
    console.error('Load employees error:', error);
  }
}

/**
 * Display employees list with XSS protection
 */
export function displayEmployees() {
  const employees = state.get('employees');
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
            <td>${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</td>
            <td>${escapeHtml(e.email)}</td>
            <td>${escapeHtml(e.phone) || '-'}</td>
            <td>${e.roles.map(r => `${escapeHtml(r.role.name)} (${escapeHtml(r.company.name)})`).join(', ') || '-'}</td>
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

/**
 * Create a new employee
 */
export async function createEmployee() {
  const users = state.get('users');
  const usersWithoutProfiles = users.filter(u => !u.employee);

  const form = `
    <form id="employeeForm">
      <div class="form-group">
        <label>Link to User Account</label>
        <select name="userId" required>
          <option value="">Select user...</option>
          ${usersWithoutProfiles.map(u => `<option value="${u.id}">${escapeHtml(u.name)} (${escapeHtml(u.email)})</option>`).join('')}
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

  showModalWithForm('Add Employee', form);

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
      await loadEmployees();
      displayEmployees();
      // Refresh users to update profile links
      const { loadUsers } = await import('../users/users.js');
      await loadUsers();
    } catch (error) {
      showAlert(error.message);
    }
  };
}

/**
 * View employee details
 * CRITICAL XSS FIX: Changed onclick to data attributes for identifier edit button
 */
export async function viewEmployee(id) {
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
      <p><strong>Name:</strong> ${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(emp.email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(emp.phone) || '-'}</p>
      <p><strong>Max Daily Hours:</strong> ${emp.maxDailyHours || 16}h</p>
      <p><strong>Linked User:</strong> ${escapeHtml(emp.user.name)} (${escapeHtml(emp.user.email)})</p>

      <h3>Roles</h3>
      ${emp.roles.length > 0 ? `
        <table>
          <thead><tr><th>Role</th><th>Company</th><th>Active</th></tr></thead>
          <tbody>
            ${emp.roles.map(r => `
              <tr>
                <td>${escapeHtml(r.role.name)}</td>
                <td>${escapeHtml(r.company.name)}</td>
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
                <td>${escapeHtml(i.identifierType)}</td>
                <td>${escapeHtml(i.identifierValue)}</td>
                <td>${i.company ? escapeHtml(i.company.name) : '-'}</td>
                <td>
                  <button class="btn btn-sm btn-primary emp-edit-id-btn"
                    data-emp-id="${emp.id}"
                    data-id="${i.id}"
                    data-type="${escapeHtml(i.identifierType)}"
                    data-value="${escapeHtml(i.identifierValue)}"
                    data-company-id="${i.companyId || ''}">Edit</button>
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
              <tr><td>${escapeHtml(key)}</td><td>${escapeHtml(val)}</td></tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
        <button class="btn btn-sm btn-primary" onclick="addIdentifierForm(${emp.id})">Add Identifier</button>
        <button class="btn btn-sm btn-primary" onclick="assignRoleForm(${emp.id})">Assign Role</button>
      </div>
    `;

    showModalWithForm(`Employee: ${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}`, html);

    // CRITICAL XSS FIX: Event delegation for edit identifier buttons (replaces onclick injection)
    document.querySelectorAll('.emp-edit-id-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        editIdentifierForm(
          parseInt(btn.dataset.empId),
          parseInt(btn.dataset.id),
          btn.dataset.type,
          btn.dataset.value,
          btn.dataset.companyId ? parseInt(btn.dataset.companyId) : null
        );
      });
    });
  } catch (error) {
    showAlert(error.message);
  }
}

/**
 * Edit employee
 */
export async function editEmployee(id) {
  const employees = state.get('employees');
  const emp = employees.find(e => e.id === id);
  if (!emp) return;

  const form = `
    <form id="editEmployeeForm">
      <div class="form-group">
        <label>First Name</label>
        <input type="text" name="firstName" value="${escapeHtml(emp.firstName)}" required>
      </div>
      <div class="form-group">
        <label>Last Name</label>
        <input type="text" name="lastName" value="${escapeHtml(emp.lastName)}" required>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email" value="${escapeHtml(emp.email)}" required>
      </div>
      <div class="form-group">
        <label>Phone</label>
        <input type="tel" name="phone" value="${escapeHtml(emp.phone) || ''}">
      </div>
      <div class="form-group">
        <label>Max Daily Hours</label>
        <input type="number" name="maxDailyHours" step="0.5" min="1" max="24" value="${emp.maxDailyHours || 16}">
        <small style="color: #666;">Maximum billable hours per day for this employee</small>
      </div>
      <button type="submit" class="btn btn-primary">Save Changes</button>
    </form>
  `;

  showModalWithForm('Edit Employee', form);

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
      await loadEmployees();
      displayEmployees();
    } catch (error) {
      showAlert(error.message);
    }
  };
}

/**
 * Delete employee
 */
export async function deleteEmployee(id) {
  if (!showConfirmation('Delete this employee? This will also delete their timesheets.')) return;

  try {
    await api.delete(`/employees/${id}`);
    await loadEmployees();
    displayEmployees();
    const { loadUsers } = await import('../users/users.js');
    await loadUsers();
  } catch (error) {
    showAlert(error.message);
  }
}

/**
 * Add identifier form
 */
export async function addIdentifierForm(employeeId) {
  const companies = state.get('companies');

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
          ${companies.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <button type="submit" class="btn btn-primary">Add Identifier</button>
    </form>
  `;

  showModalWithHTML(form);

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
        showAlert('Please enter a custom type name');
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
      showAlert(error.message);
    }
  };
}

/**
 * Edit identifier form
 * CRITICAL XSS FIX: Parameters are now safely passed via data attributes
 */
export async function editIdentifierForm(employeeId, identifierId, type, value, companyId) {
  const companies = state.get('companies');
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
        <input type="text" id="editIdCustomType" value="${escapeHtml(isCustomType ? type : '')}" ${isCustomType ? 'required' : ''}>
      </div>
      <div class="form-group">
        <label>Identifier Value</label>
        <input type="text" name="identifierValue" value="${escapeHtml(value)}" required>
      </div>
      <div class="form-group">
        <label>Company (optional)</label>
        <select name="companyId">
          <option value="">None</option>
          ${companies.map(c => `<option value="${c.id}" ${c.id === companyId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <button type="submit" class="btn btn-primary">Save Changes</button>
    </form>
  `;

  showModalWithHTML(form);

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
        showAlert('Please enter a custom type name');
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
      showAlert(error.message);
    }
  };
}

/**
 * Delete identifier
 */
export async function deleteIdentifier(employeeId, identifierId) {
  if (!showConfirmation('Delete this identifier?')) return;
  try {
    await api.delete(`/employees/identifiers/${identifierId}`);
    viewEmployee(employeeId);
  } catch (error) {
    showAlert(error.message);
  }
}

/**
 * Assign role form
 */
export async function assignRoleForm(employeeId) {
  const companies = state.get('companies');
  const roles = state.get('roles');

  const form = `
    <form id="assignRoleForm">
      <div class="form-group">
        <label>Company</label>
        <select name="companyId" id="assignRoleCompanySelect" required>
          <option value="">Select company...</option>
          ${companies.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Role</label>
        <select name="roleId" id="assignRoleRoleSelect" required>
          <option value="">Select role...</option>
          ${roles.map(r => `<option value="${r.id}" data-company="${r.company.id}">${escapeHtml(r.name)} - ${escapeHtml(r.company.name)}</option>`).join('')}
        </select>
      </div>
      <button type="submit" class="btn btn-primary">Assign Role</button>
    </form>
  `;

  showModalWithForm('Assign Role to Employee', form);

  document.getElementById('assignRoleCompanySelect').onchange = (e) => {
    const companyId = parseInt(e.target.value);
    const roleSelect = document.getElementById('assignRoleRoleSelect');
    const filteredRoles = companyId
      ? roles.filter(r => r.company.id === companyId)
      : roles;
    roleSelect.innerHTML = '<option value="">Select role...</option>' +
      filteredRoles.map(r => `<option value="${r.id}">${escapeHtml(r.name)} - ${escapeHtml(r.company.name)}</option>`).join('');
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
      await loadEmployees();
      viewEmployee(employeeId);
    } catch (error) {
      showAlert(error.message);
    }
  };
}

// Register tab hook
registerTabHook('employees', displayEmployees);
