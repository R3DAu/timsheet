// Global state
let currentUser = null;
let companies = [];
let roles = [];
let employees = [];
let timesheets = [];

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

  // Show admin tabs if user is admin
  if (currentUser.isAdmin) {
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = '';
    });
  }

  loadTimesheets();
  loadCompanies();
  loadRoles();
  if (currentUser.isAdmin) {
    loadEmployees();
  }
}

// Modal management
function showModal(title, content) {
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = `<h2>${title}</h2>${content}`;
  modal.style.display = 'block';
}

function hideModal() {
  document.getElementById('modal').style.display = 'none';
}

// ==================== TIMESHEETS ====================

async function loadTimesheets() {
  try {
    // Admin sees all timesheets, employees see only their own
    const query = (currentUser.isAdmin)
      ? '/timesheets'
      : `/timesheets?employeeId=${currentUser.employeeId}`;
    const result = await api.get(query);
    timesheets = result.timesheets;
    displayTimesheets();
    populateTimesheetSelect();
  } catch (error) {
    console.error('Load timesheets error:', error);
  }
}

function displayTimesheets() {
  const container = document.getElementById('timesheetsList');
  if (timesheets.length === 0) {
    container.innerHTML = '<p>No timesheets found. Create your first timesheet to get started.</p>';
    return;
  }

  const isAdmin = currentUser.isAdmin;

  const html = `
    <table>
      <thead>
        <tr>
          ${isAdmin ? '<th>Employee</th>' : ''}
          <th>Week</th>
          <th>Status</th>
          <th>Entries</th>
          <th>Submitted</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${timesheets.map(ts => `
          <tr>
            ${isAdmin ? `<td>${ts.employee.user.name}</td>` : ''}
            <td>${new Date(ts.weekStarting).toLocaleDateString()} - ${new Date(ts.weekEnding).toLocaleDateString()}</td>
            <td><span class="status-badge status-${ts.status}">${ts.status}</span></td>
            <td>${ts.entries.length}</td>
            <td>${ts.submittedAt ? new Date(ts.submittedAt).toLocaleString() : '-'}</td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="viewTimesheet(${ts.id})">View</button>
              ${ts.status === 'SUBMITTED' && isAdmin ? `
                <button class="btn btn-sm btn-success" onclick="approveTimesheet(${ts.id})">Approve</button>
              ` : ''}
              ${ts.status === 'APPROVED' && isAdmin ? `
                <button class="btn btn-sm btn-secondary" onclick="lockTimesheet(${ts.id})">Lock</button>
              ` : ''}
              ${ts.status === 'OPEN' ? `
                <button class="btn btn-sm btn-success" onclick="submitTimesheet(${ts.id})">Submit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteTimesheet(${ts.id})">Delete</button>
              ` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  container.innerHTML = html;
}

function populateTimesheetSelect() {
  const select = document.getElementById('timesheetSelect');
  select.innerHTML = '<option value="">Select a timesheet...</option>' +
    timesheets.map(ts => {
      const label = currentUser.isAdmin
        ? `${ts.employee.user.name} - Week ${new Date(ts.weekStarting).toLocaleDateString()} - ${new Date(ts.weekEnding).toLocaleDateString()}`
        : `Week ${new Date(ts.weekStarting).toLocaleDateString()} - ${new Date(ts.weekEnding).toLocaleDateString()}`;
      return `<option value="${ts.id}">${label}</option>`;
    }).join('');
}

async function createTimesheet() {
  // If admin, let them pick an employee
  let employeeSelectHtml = '';
  if (currentUser.isAdmin && employees.length > 0) {
    employeeSelectHtml = `
      <div class="form-group">
        <label>Employee</label>
        <select name="employeeId" required>
          ${employees.map(e => `<option value="${e.id}">${e.firstName} ${e.lastName}</option>`).join('')}
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
      loadTimesheets();
    } catch (error) {
      alert(error.message);
    }
  };
}

async function submitTimesheet(id) {
  if (!confirm('Are you sure you want to submit this timesheet?')) return;

  try {
    await api.post(`/timesheets/${id}/submit`);
    loadTimesheets();
    alert('Timesheet submitted successfully');
  } catch (error) {
    alert(error.message);
  }
}

async function approveTimesheet(id) {
  if (!confirm('Approve this timesheet?')) return;

  try {
    await api.post(`/timesheets/${id}/approve`);
    loadTimesheets();
    alert('Timesheet approved');
  } catch (error) {
    alert(error.message);
  }
}

async function lockTimesheet(id) {
  if (!confirm('Lock this timesheet? No further edits will be allowed.')) return;

  try {
    await api.post(`/timesheets/${id}/lock`);
    loadTimesheets();
    alert('Timesheet locked');
  } catch (error) {
    alert(error.message);
  }
}

async function deleteTimesheet(id) {
  if (!confirm('Are you sure you want to delete this timesheet?')) return;

  try {
    await api.delete(`/timesheets/${id}`);
    loadTimesheets();
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
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Hours</th>
              <th>Company</th>
              <th>Role</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${ts.entries.map(entry => `
              <tr>
                <td>${new Date(entry.date).toLocaleDateString()}</td>
                <td>${entry.entryType}</td>
                <td>${entry.hours}</td>
                <td>${entry.company.name}</td>
                <td>${entry.role.name}</td>
                <td>
                  ${entry.notes || '-'}
                  ${entry.entryType === 'TRAVEL' ? `<br><small>${entry.travelFrom} &rarr; ${entry.travelTo}${entry.distance ? ` (${entry.distance.toFixed(1)} km)` : ''}</small>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p><strong>Total Hours:</strong> ${ts.entries.reduce((sum, e) => sum + e.hours, 0).toFixed(2)}</p>
      ` : '<p>No entries yet</p>'}
    `;

    showModal('Timesheet Details', html);
  } catch (error) {
    alert(error.message);
  }
}

// ==================== ENTRIES ====================

async function loadEntries(timesheetId) {
  if (!timesheetId) {
    document.getElementById('entriesList').innerHTML = '<p>Please select a timesheet</p>';
    return;
  }

  try {
    const result = await api.get(`/entries/timesheet/${timesheetId}`);
    displayEntries(result.entries);
  } catch (error) {
    console.error('Load entries error:', error);
  }
}

function displayEntries(entries) {
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
          <th>Hours</th>
          <th>Company</th>
          <th>Role</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${entries.map(entry => `
          <tr>
            <td>${new Date(entry.date).toLocaleDateString()}</td>
            <td>${entry.entryType}${entry.entryType === 'TRAVEL' ? `<br><small>${entry.travelFrom} &rarr; ${entry.travelTo}</small>` : ''}</td>
            <td>${entry.hours}</td>
            <td>${entry.company.name}</td>
            <td>${entry.role.name}</td>
            <td><span class="status-badge status-${entry.status}">${entry.status}</span></td>
            <td>
              ${entry.status === 'OPEN' ? `
                <button class="btn btn-sm btn-primary" onclick="editEntry(${entry.id})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteEntry(${entry.id})">Delete</button>
              ` : ''}
            </td>
          </tr>
        `).join('')}
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
        <input type="date" name="date" required>
      </div>
      <div class="form-group">
        <label>Hours</label>
        <input type="number" name="hours" step="0.25" min="0" required>
      </div>
      <div class="form-group">
        <label>Company</label>
        <select name="companyId" id="entryCompanySelect" required>
          <option value="">Select company...</option>
          ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Role</label>
        <select name="roleId" id="entryRoleSelect" required>
          <option value="">Select role...</option>
          ${roles.map(r => `<option value="${r.id}">${r.name} - ${r.company.name}</option>`).join('')}
        </select>
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
      <div class="form-group">
        <label>Notes</label>
        <textarea name="notes"></textarea>
      </div>
      <button type="submit" class="btn btn-primary">Create Entry</button>
    </form>
  `;

  showModal('Create Entry', form);

  // Show/hide travel fields based on entry type
  document.getElementById('entryTypeSelect').onchange = (e) => {
    document.getElementById('travelFields').style.display =
      e.target.value === 'TRAVEL' ? 'block' : 'none';
  };

  // Filter roles when company changes
  document.getElementById('entryCompanySelect').onchange = (e) => {
    const companyId = parseInt(e.target.value);
    const roleSelect = document.getElementById('entryRoleSelect');
    const filteredRoles = companyId
      ? roles.filter(r => r.company.id === companyId)
      : roles;
    roleSelect.innerHTML = '<option value="">Select role...</option>' +
      filteredRoles.map(r => `<option value="${r.id}">${r.name} - ${r.company.name}</option>`).join('');
  };

  document.getElementById('entryForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await api.post('/entries', {
        timesheetId: parseInt(timesheetId),
        entryType: formData.get('entryType'),
        date: formData.get('date'),
        hours: parseFloat(formData.get('hours')),
        companyId: parseInt(formData.get('companyId')),
        roleId: parseInt(formData.get('roleId')),
        notes: formData.get('notes'),
        travelFrom: formData.get('travelFrom'),
        travelTo: formData.get('travelTo')
      });
      hideModal();
      loadEntries(timesheetId);
      loadTimesheets();
    } catch (error) {
      alert(error.message);
    }
  };
}

async function editEntry(id) {
  // Fetch current entry data from the entries list in the DOM isn't ideal,
  // so we'll use the timesheet's entries
  const timesheetId = document.getElementById('timesheetSelect').value;
  const ts = timesheets.find(t => t.id === parseInt(timesheetId));
  const entry = ts ? ts.entries.find(e => e.id === id) : null;

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
      <div class="form-group">
        <label>Hours</label>
        <input type="number" name="hours" step="0.25" min="0" value="${entry.hours}" required>
      </div>
      <div class="form-group">
        <label>Company</label>
        <select name="companyId" required>
          ${companies.map(c => `<option value="${c.id}" ${c.id === entry.companyId ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Role</label>
        <select name="roleId" required>
          ${roles.map(r => `<option value="${r.id}" ${r.id === entry.roleId ? 'selected' : ''}>${r.name} - ${r.company.name}</option>`).join('')}
        </select>
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
      <div class="form-group">
        <label>Notes</label>
        <textarea name="notes">${entry.notes || ''}</textarea>
      </div>
      <button type="submit" class="btn btn-primary">Save Changes</button>
    </form>
  `;

  showModal('Edit Entry', form);

  document.getElementById('editEntryTypeSelect').onchange = (e) => {
    document.getElementById('editTravelFields').style.display =
      e.target.value === 'TRAVEL' ? 'block' : 'none';
  };

  document.getElementById('editEntryForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await api.put(`/entries/${id}`, {
        entryType: formData.get('entryType'),
        date: formData.get('date'),
        hours: parseFloat(formData.get('hours')),
        companyId: parseInt(formData.get('companyId')),
        roleId: parseInt(formData.get('roleId')),
        notes: formData.get('notes'),
        travelFrom: formData.get('travelFrom'),
        travelTo: formData.get('travelTo')
      });
      hideModal();
      loadEntries(timesheetId);
      loadTimesheets();
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
    loadEntries(timesheetId);
    loadTimesheets();
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
          <th>Roles</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${companies.map(c => `
          <tr>
            <td>${c.name}</td>
            <td>${c.isBillable ? 'Yes' : 'No'}</td>
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
        <label>
          <input type="checkbox" name="isBillable" checked> Billable
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
        isBillable: formData.has('isBillable')
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
        <label>
          <input type="checkbox" name="isBillable" ${company.isBillable ? 'checked' : ''}> Billable
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
        isBillable: formData.has('isBillable')
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
  // First, we need the list of users without employee profiles
  const form = `
    <form id="employeeForm">
      <div class="form-group">
        <label>User ID (linked user account)</label>
        <input type="number" name="userId" required placeholder="User account ID">
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
          <thead><tr><th>Type</th><th>Value</th><th>Company</th></tr></thead>
          <tbody>
            ${emp.identifiers.map(i => `
              <tr>
                <td>${i.identifierType}</td>
                <td>${i.identifierValue}</td>
                <td>${i.company ? i.company.name : '-'}</td>
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
        phone: formData.get('phone') || null
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
  } catch (error) {
    alert(error.message);
  }
}

async function addIdentifierForm(employeeId) {
  const form = `
    <form id="identifierForm">
      <div class="form-group">
        <label>Identifier Type</label>
        <select name="identifierType" required>
          <option value="payroll">Payroll ID</option>
          <option value="contractor_id">Contractor ID</option>
          <option value="hr_system">HR System ID</option>
          <option value="badge">Badge Number</option>
          <option value="other">Other</option>
        </select>
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

  showModal('Add Employee Identifier', form);

  document.getElementById('identifierForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await api.post(`/employees/${employeeId}/identifiers`, {
        identifierType: formData.get('identifierType'),
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

  // Filter roles when company changes
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

  // Tab navigation
  document.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = () => {
      const tabName = tab.dataset.tab;

      // Update active tab
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update active content
      document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
      document.getElementById(`${tabName}Tab`).classList.add('active');

      // Load data for the tab
      if (tabName === 'companies') displayCompanies();
      if (tabName === 'roles') displayRoles();
      if (tabName === 'employees') displayEmployees();
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

  // Modal close
  document.querySelector('.close').onclick = hideModal;
  window.onclick = (e) => {
    if (e.target === document.getElementById('modal')) {
      hideModal();
    }
  };

  // Check authentication
  checkAuth();
});
