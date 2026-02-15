// Global state
let currentUser = null;
let companies = [];
let roles = [];
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

// Timesheets
async function loadTimesheets() {
  try {
    const result = await api.get(`/timesheets?employeeId=${currentUser.employeeId}`);
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

  const html = `
    <table>
      <thead>
        <tr>
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
            <td>${new Date(ts.weekStarting).toLocaleDateString()} - ${new Date(ts.weekEnding).toLocaleDateString()}</td>
            <td><span class="status-badge status-${ts.status}">${ts.status}</span></td>
            <td>${ts.entries.length}</td>
            <td>${ts.submittedAt ? new Date(ts.submittedAt).toLocaleString() : '-'}</td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="viewTimesheet(${ts.id})">View</button>
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
    timesheets.map(ts => `
      <option value="${ts.id}">Week ${new Date(ts.weekStarting).toLocaleDateString()} - ${new Date(ts.weekEnding).toLocaleDateString()}</option>
    `).join('');
}

async function createTimesheet() {
  const form = `
    <form id="timesheetForm">
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
    try {
      await api.post('/timesheets', {
        employeeId: currentUser.employeeId,
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
      <h3>Week ${new Date(ts.weekStarting).toLocaleDateString()} - ${new Date(ts.weekEnding).toLocaleDateString()}</h3>
      <p><strong>Status:</strong> <span class="status-badge status-${ts.status}">${ts.status}</span></p>
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
                <td>${entry.notes || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p>No entries yet</p>'}
    `;

    showModal('Timesheet Details', html);
  } catch (error) {
    alert(error.message);
  }
}

// Entries
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
            <td>${entry.entryType}</td>
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
        <select name="companyId" id="companySelect" required>
          <option value="">Select company...</option>
          ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Role</label>
        <select name="roleId" required>
          <option value="">Select role...</option>
          ${roles.map(r => `<option value="${r.id}">${r.name} - ${r.company.name}</option>`).join('')}
        </select>
      </div>
      <div id="travelFields" style="display:none;">
        <div class="form-group">
          <label>Travel From</label>
          <input type="text" name="travelFrom">
        </div>
        <div class="form-group">
          <label>Travel To</label>
          <input type="text" name="travelTo">
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

// Companies
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

// Roles
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

// Event listeners
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

      // Load data if needed
      if (tabName === 'companies') displayCompanies();
      if (tabName === 'roles') displayRoles();
    };
  });

  // Timesheet select
  document.getElementById('timesheetSelect').onchange = (e) => {
    loadEntries(e.target.value);
  };

  // Create buttons
  document.getElementById('createTimesheetBtn').onclick = createTimesheet;
  document.getElementById('createEntryBtn').onclick = createEntry;

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
