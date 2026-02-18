/**
 * Employee management module
 * CRITICAL XSS FIXES: Fixed onclick injection vulnerability at line 2013
 */

import { api } from '../../core/api.js';
import { state } from '../../core/state.js';
import { showSlidePanel, hideSlidePanel } from '../../core/slide-panel.js';
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

  showSlidePanel('Add Employee', form);

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
      hideSlidePanel();
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

      <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid var(--border, #e5e7eb);">
      <h3 style="margin: 0 0 0.75rem 0; display: flex; align-items: center; gap: 0.5rem;">
        Xero Configuration
        <span id="xeroLoadingSpinner" style="font-size:0.75rem; color: var(--muted); font-weight:400;">Loading…</span>
      </h3>
      <div id="xeroConfigSection_${emp.id}"></div>
    `;

    showSlidePanel(`Employee: ${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}`, html);

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

    // Async-load the Xero configuration section
    loadEmployeeXeroSection(emp.id, emp).catch(err => {
      const el = document.getElementById(`xeroConfigSection_${emp.id}`);
      if (el) el.innerHTML = `<p style="color:var(--muted); font-size:0.875rem;">Xero not configured or not connected.</p>`;
      const spinner = document.getElementById('xeroLoadingSpinner');
      if (spinner) spinner.remove();
    });
  } catch (error) {
    showAlert(error.message);
  }
}

/**
 * Load and render the Xero configuration section inside the employee modal.
 */
async function loadEmployeeXeroSection(empId, emp) {
  const container = document.getElementById(`xeroConfigSection_${empId}`);
  const spinner = document.getElementById('xeroLoadingSpinner');
  if (!container) return;

  // Fetch tenants and all mappings in parallel
  const [tenantsRes, mappingsRes] = await Promise.all([
    api.get('/xero/auth/tenants'),
    api.get('/xero/setup/mappings')
  ]);

  if (spinner) spinner.remove();

  const tenants = tenantsRes.tenants || [];
  if (tenants.length === 0) {
    container.innerHTML = `<p style="color:var(--muted); font-size:0.875rem;">No Xero organization connected. Connect one in the Xero Setup tab.</p>`;
    return;
  }

  // Find this employee's current Xero mapping and settings
  const currentMapping = (mappingsRes.employeeMappings || []).find(m => m.employeeId === empId);
  const currentSettings = (mappingsRes.employeeSettings || []).find(s => s.employeeId === empId);

  // Xero employee ID from the identifier (identifierValue = Xero UUID)
  const xeroId = currentMapping ? currentMapping.identifierValue : null;

  // Determine which tenant this employee belongs to via their company's Xero mapping
  const companyMappings = mappingsRes.companyMappings || [];
  const empRoles = emp.roles || [];
  const empCompanyIds = empRoles.map(r => r.companyId || r.company?.id).filter(Boolean);
  const matchedTenant = companyMappings.find(cm => empCompanyIds.includes(cm.companyId));
  const defaultTenantId = matchedTenant?.xeroToken?.tenantId || tenants[0]?.tenantId;

  // Build tenant options
  const tenantOptions = tenants.map(t =>
    `<option value="${escapeHtml(t.tenantId)}" ${t.tenantId === defaultTenantId ? 'selected' : ''}>${escapeHtml(t.tenantName)}</option>`
  ).join('');

  // Render settings summary
  const syncEnabled = currentSettings?.syncEnabled ?? false;
  const empType = currentSettings?.employeeType ?? 'LT';
  const autoApprove = currentSettings?.autoApprove ?? false;
  const isSalaried = currentSettings?.isSalaried ?? false;

  container.innerHTML = `
    <div style="display:grid; gap:1rem;">
      <!-- Employee ID Mapping -->
      <div style="background:var(--bg,#f3f4f6); border-radius:8px; padding:1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
          <strong style="font-size:0.875rem;">Xero Employee Mapping</strong>
          <button class="btn btn-sm btn-secondary" id="toggleXeroMapForm_${empId}">
            ${xeroId ? 'Change' : 'Map to Xero'}
          </button>
        </div>
        <p style="margin:0; font-size:0.875rem; color:${xeroId ? 'var(--text)' : 'var(--muted)'};">
          ${xeroId ? `Mapped — Xero ID: <code>${escapeHtml(xeroId.slice(0,8))}…</code>` : 'Not mapped to a Xero employee.'}
        </p>
        <div id="xeroMapForm_${empId}" style="display:none; margin-top:0.75rem; border-top:1px solid var(--border,#e5e7eb); padding-top:0.75rem;">
          <div style="display:grid; gap:0.5rem;">
            <label style="font-size:0.8125rem; font-weight:500;">Organisation</label>
            <select id="xeroTenantPick_${empId}" class="form-control" style="font-size:0.875rem;">
              ${tenantOptions}
            </select>
            <label style="font-size:0.8125rem; font-weight:500; margin-top:0.25rem;">Xero Employee</label>
            <select id="xeroEmpPick_${empId}" class="form-control" style="font-size:0.875rem;">
              <option value="">Loading…</option>
            </select>
            <button class="btn btn-sm btn-primary" id="saveXeroMap_${empId}" style="margin-top:0.25rem; align-self:start;">Save Mapping</button>
          </div>
        </div>
      </div>

      <!-- Sync Settings -->
      <div style="background:var(--bg,#f3f4f6); border-radius:8px; padding:1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
          <strong style="font-size:0.875rem;">Xero Sync Settings</strong>
        </div>
        <form id="xeroSettingsForm_${empId}" style="display:grid; gap:0.5rem;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
            <label style="font-size:0.8125rem; font-weight:500;">Employee Type</label>
            <select name="employeeType" class="form-control" style="font-size:0.875rem;">
              <option value="LT" ${empType === 'LT' ? 'selected' : ''}>LT (Local Tech)</option>
              <option value="ST" ${empType === 'ST' ? 'selected' : ''}>ST (Specialist Tech)</option>
            </select>
          </div>
          <label style="display:flex; gap:0.5rem; align-items:center; font-size:0.875rem; cursor:pointer;">
            <input type="checkbox" name="syncEnabled" ${syncEnabled ? 'checked' : ''}> Enable Xero Sync
          </label>
          <label style="display:flex; gap:0.5rem; align-items:center; font-size:0.875rem; cursor:pointer;">
            <input type="checkbox" name="autoApprove" ${autoApprove ? 'checked' : ''}> Auto-approve timesheets
          </label>
          <label style="display:flex; gap:0.5rem; align-items:center; font-size:0.875rem; cursor:pointer;">
            <input type="checkbox" name="isSalaried" ${isSalaried ? 'checked' : ''}> Salaried employee
          </label>
          <button type="submit" class="btn btn-sm btn-primary" style="align-self:start; margin-top:0.25rem;">Save Settings</button>
        </form>
      </div>
    </div>
  `;

  // ── Wire up mapping form toggle ──
  const toggleBtn = document.getElementById(`toggleXeroMapForm_${empId}`);
  const mapForm = document.getElementById(`xeroMapForm_${empId}`);
  const tenantPick = document.getElementById(`xeroTenantPick_${empId}`);
  const empPick = document.getElementById(`xeroEmpPick_${empId}`);

  const loadXeroEmployees = async (tenantId) => {
    empPick.innerHTML = '<option value="">Loading…</option>';
    try {
      const res = await api.get(`/xero/setup/employees/${tenantId}`);
      const xeroEmps = res.employees || [];
      empPick.innerHTML = '<option value="">— Select Xero employee —</option>' +
        xeroEmps.map(xe => {
          const xeId = xe.EmployeeID || xe.employeeID || xe.employeeId || '';
          const name = `${xe.FirstName || xe.firstName || ''} ${xe.LastName || xe.lastName || ''}`.trim();
          return `<option value="${escapeHtml(xeId)}" ${xeId === xeroId ? 'selected' : ''}>${escapeHtml(name)}</option>`;
        }).join('');
    } catch (e) {
      empPick.innerHTML = '<option value="">Failed to load</option>';
    }
  };

  toggleBtn.addEventListener('click', () => {
    const open = mapForm.style.display === 'none';
    mapForm.style.display = open ? 'block' : 'none';
    if (open && tenantPick.value) loadXeroEmployees(tenantPick.value);
  });

  tenantPick.addEventListener('change', () => loadXeroEmployees(tenantPick.value));

  document.getElementById(`saveXeroMap_${empId}`).addEventListener('click', async () => {
    const tenantId = tenantPick.value;
    const xeroEmployeeId = empPick.value;
    if (!xeroEmployeeId) { showAlert('Please select a Xero employee', 'warning'); return; }
    try {
      await api.post('/xero/setup/employees/map', { employeeId: empId, xeroEmployeeId, tenantId });
      showAlert('Xero employee mapping saved', 'success');
      mapForm.style.display = 'none';
      // Refresh the section
      await loadEmployeeXeroSection(empId, emp);
    } catch (e) {
      showAlert(e.message || 'Failed to save mapping', 'error');
    }
  });

  // ── Wire up settings form ──
  document.getElementById(`xeroSettingsForm_${empId}`).addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.post('/xero/setup/employee-settings', {
        employeeId: empId,
        employeeType: fd.get('employeeType'),
        syncEnabled: fd.has('syncEnabled'),
        autoApprove: fd.has('autoApprove'),
        isSalaried: fd.has('isSalaried')
      });
      showAlert('Xero settings saved', 'success');
    } catch (err) {
      showAlert(err.message || 'Failed to save settings', 'error');
    }
  });
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

  showSlidePanel('Edit Employee', form);

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
      hideSlidePanel();
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
  if (!await showConfirmation('Delete this employee? This will also delete their timesheets.')) return;

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

  showSlidePanel('Add Identifier', form);

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
      hideSlidePanel();
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

  showSlidePanel('Edit Identifier', form);

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
      hideSlidePanel();
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
  if (!await showConfirmation('Delete this identifier?')) return;
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

  showSlidePanel('Assign Role to Employee', form);

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
      hideSlidePanel();
      await loadEmployees();
      viewEmployee(employeeId);
    } catch (error) {
      showAlert(error.message);
    }
  };
}

// Register tab hook
registerTabHook('employees', displayEmployees);
