/**
 * Xero Setup Module
 * Handles OAuth connection and mapping configuration
 */

import { api } from '../../core/api.js';
import { state } from '../../core/state.js';
import { showAlert, showConfirmation } from '../../core/alerts.js';
import { escapeHtml } from '../../core/dom.js';
import { registerTabHook } from '../../core/navigation.js';

let currentSetupTab = 'companies';
let selectedEmployeeTenant = null;
let selectedRoleTenant = null;

/**
 * Initialize Xero setup when tab is opened
 */
export async function initXeroSetup() {
  await loadXeroStatus();
  await loadMappings();
  setupEventListeners();
  switchSetupTab(currentSetupTab);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Connection buttons
  document.getElementById('connectXeroBtn')?.addEventListener('click', initiateXeroConnection);
  document.getElementById('refreshTenantsBtn')?.addEventListener('click', loadXeroStatus);

  // Setup tab switcher
  document.querySelectorAll('.setup-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = e.target.dataset.setupTab;
      switchSetupTab(tab);
    });
  });

  // Tenant selectors
  document.getElementById('employeeTenantSelector')?.addEventListener('change', (e) => {
    selectedEmployeeTenant = e.target.value;
    displayEmployeeMappings();
  });

  document.getElementById('roleTenantSelector')?.addEventListener('change', (e) => {
    selectedRoleTenant = e.target.value;
    displayRoleMappings();
  });
}

/**
 * Switch between setup tabs
 */
function switchSetupTab(tabName) {
  currentSetupTab = tabName;

  // Update tab buttons
  document.querySelectorAll('.setup-tab-btn').forEach(btn => {
    if (btn.dataset.setupTab === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update tab content
  document.querySelectorAll('.setup-tab-content').forEach(content => {
    content.classList.remove('active');
    content.style.display = 'none';
  });

  const activeContent = document.getElementById(`setup${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`);
  if (activeContent) {
    activeContent.classList.add('active');
    activeContent.style.display = 'block';
  }

  // Load data for specific tabs
  if (tabName === 'companies') {
    displayCompanyMappings();
  } else if (tabName === 'employees') {
    displayEmployeeMappings();
  } else if (tabName === 'roles') {
    displayRoleMappings();
  } else if (tabName === 'settings') {
    displayEmployeeSettings();
  }
}

/**
 * Load Xero connection status and tenants
 */
async function loadXeroStatus() {
  try {
    const tenants = await api.get('/xero/auth/tenants');
    state.set('xeroTenants', tenants);
    displayConnectionStatus(tenants);
    populateTenantSelectors(tenants);
  } catch (error) {
    console.error('Failed to load Xero status:', error);
    displayConnectionStatus([]);
  }
}

/**
 * Display connection status
 */
function displayConnectionStatus(tenants) {
  const statusDiv = document.getElementById('xeroConnectionStatus');
  const connectBtn = document.getElementById('connectXeroBtn');
  const refreshBtn = document.getElementById('refreshTenantsBtn');

  if (tenants.length === 0) {
    statusDiv.innerHTML = `
      <div style="padding: 1rem; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px;">
        <strong>⚠️ Not Connected</strong>
        <p style="margin: 0.5rem 0 0 0; color: #92400e;">
          Connect your Xero account to enable payroll sync.
        </p>
      </div>
    `;
    connectBtn.style.display = 'inline-block';
    refreshBtn.style.display = 'none';
  } else {
    statusDiv.innerHTML = `
      <div style="padding: 1rem; background: #d1fae5; border: 1px solid #6ee7b7; border-radius: 6px;">
        <strong>✅ Connected</strong>
        <p style="margin: 0.5rem 0 0 0; color: #065f46;">
          ${tenants.length} organization${tenants.length > 1 ? 's' : ''} connected
        </p>
      </div>
    `;
    connectBtn.style.display = 'none';
    refreshBtn.style.display = 'inline-block';
  }
}

/**
 * Display connected tenants
 */
function displayTenants(tenants) {
  const container = document.getElementById('xeroTenantsList');

  if (tenants.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <h4 style="margin: 1.5rem 0 0.5rem 0;">Connected Organizations:</h4>
    <div style="display: grid; gap: 1rem;">
      ${tenants.map(tenant => `
        <div style="padding: 1rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>${escapeHtml(tenant.tenantName)}</strong>
            <div style="font-size: 0.875rem; color: #6b7280; margin-top: 0.25rem;">
              Tenant ID: ${escapeHtml(tenant.tenantId)}
            </div>
            ${tenant.lastSyncedAt ? `
              <div style="font-size: 0.875rem; color: #6b7280;">
                Last synced: ${new Date(tenant.lastSyncedAt).toLocaleString()}
              </div>
            ` : ''}
          </div>
          <button class="btn btn-danger btn-sm" onclick="window.disconnectXeroTenant('${escapeHtml(tenant.tenantId)}')">
            Disconnect
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Populate tenant selectors
 */
function populateTenantSelectors(tenants) {
  const employeeSelector = document.getElementById('employeeTenantSelector');
  const roleSelector = document.getElementById('roleTenantSelector');

  const options = tenants.map(t =>
    `<option value="${escapeHtml(t.tenantId)}">${escapeHtml(t.tenantName)}</option>`
  ).join('');

  if (employeeSelector) {
    employeeSelector.innerHTML = `<option value="">Select a tenant...</option>${options}`;
  }

  if (roleSelector) {
    roleSelector.innerHTML = `<option value="">Select a tenant...</option>${options}`;
  }
}

/**
 * Initiate Xero OAuth connection
 */
async function initiateXeroConnection() {
  try {
    const result = await api.get('/xero/auth/connect');

    if (result.authUrl) {
      // Open auth URL in popup
      const width = 600;
      const height = 700;
      const left = (screen.width / 2) - (width / 2);
      const top = (screen.height / 2) - (height / 2);

      const popup = window.open(
        result.authUrl,
        'XeroAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Poll for popup close
      const checkPopup = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopup);
          // Reload status after connection
          setTimeout(() => {
            loadXeroStatus();
            showAlert('Xero connection successful!', 'success');
          }, 1000);
        }
      }, 500);
    }
  } catch (error) {
    console.error('Failed to initiate Xero connection:', error);
    showAlert('Failed to connect to Xero: ' + error.message, 'error');
  }
}

/**
 * Disconnect a Xero tenant
 */
window.disconnectXeroTenant = async function(tenantId) {
  const confirmed = await showConfirmation(
    'Are you sure you want to disconnect this Xero organization? Sync will stop for all employees.'
  );

  if (!confirmed) return;

  try {
    await api.post(`/xero/auth/disconnect/${tenantId}`);
    showAlert('Xero organization disconnected', 'success');
    await loadXeroStatus();
    await loadMappings();
  } catch (error) {
    console.error('Failed to disconnect tenant:', error);
    showAlert('Failed to disconnect: ' + error.message, 'error');
  }
};

/**
 * Load all mappings
 */
async function loadMappings() {
  try {
    const mappings = await api.get('/xero/setup/mappings');
    state.set('xeroMappings', mappings);

    // Also load employees, companies, roles for mapping
    const [employees, companies, roles] = await Promise.all([
      api.get('/employees'),
      api.get('/companies'),
      api.get('/roles')
    ]);

    state.set('employees', employees.employees);
    state.set('companies', companies.companies);
    state.set('roles', roles.roles);
  } catch (error) {
    console.error('Failed to load mappings:', error);
  }
}

/**
 * Display company mappings
 */
function displayCompanyMappings() {
  const container = document.getElementById('companyMappingList');
  const companies = state.get('companies') || [];
  const tenants = state.get('xeroTenants') || [];
  const mappings = state.get('xeroMappings')?.companies || [];

  if (companies.length === 0) {
    container.innerHTML = '<p>No companies found. Create companies first.</p>';
    return;
  }

  if (tenants.length === 0) {
    container.innerHTML = '<p style="color: #dc2626;">⚠️ No Xero tenants connected. Connect Xero first.</p>';
    return;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Company</th>
          <th>Xero Tenant</th>
          <th>Invoice Rate (LT)</th>
          <th>Xero Contact</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${companies.map(company => {
          const mapping = mappings.find(m => m.companyId === company.id);
          const tenant = mapping ? tenants.find(t => t.id === mapping.xeroTokenId) : null;

          return `
            <tr>
              <td>${escapeHtml(company.name)}</td>
              <td>
                ${tenant ? escapeHtml(tenant.tenantName) : '<span style="color: #9ca3af;">Not mapped</span>'}
              </td>
              <td>
                ${mapping?.invoiceRate ? `$${mapping.invoiceRate.toFixed(2)}/hr` : '-'}
              </td>
              <td>
                ${mapping?.xeroContactId ? escapeHtml(mapping.xeroContactId) : '-'}
              </td>
              <td>
                <button class="btn btn-sm btn-primary" onclick="window.editCompanyMapping(${company.id})">
                  ${mapping ? 'Edit' : 'Map'}
                </button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Edit company mapping
 */
window.editCompanyMapping = async function(companyId) {
  const companies = state.get('companies') || [];
  const tenants = state.get('xeroTenants') || [];
  const mappings = state.get('xeroMappings')?.companies || [];

  const company = companies.find(c => c.id === companyId);
  const mapping = mappings.find(m => m.companyId === companyId);

  if (!company) return;

  const { showModalWithForm, hideModal } = await import('../../core/modal.js');

  const form = `
    <form id="companyMappingForm">
      <div class="form-group">
        <label>Company</label>
        <input type="text" value="${escapeHtml(company.name)}" disabled>
      </div>
      <div class="form-group">
        <label>Xero Tenant *</label>
        <select name="xeroTenantId" required>
          <option value="">Select tenant...</option>
          ${tenants.map(t => `
            <option value="${escapeHtml(t.tenantId)}" ${mapping?.xeroTenantId === t.tenantId ? 'selected' : ''}>
              ${escapeHtml(t.tenantName)}
            </option>
          `).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Invoice Rate (for Local Technicians)</label>
        <input type="number" name="invoiceRate" step="0.01" min="0"
               value="${mapping?.invoiceRate || ''}"
               placeholder="150.00">
        <small>Hourly rate for LT invoice generation (optional)</small>
      </div>
      <div class="form-group">
        <label>Xero Contact ID (for invoicing)</label>
        <input type="text" name="xeroContactId"
               value="${mapping?.xeroContactId || ''}"
               placeholder="Optional">
        <small>Leave blank to select later</small>
      </div>
      <button type="submit" class="btn btn-primary">Save Mapping</button>
    </form>
  `;

  showModalWithForm(`Map Company: ${company.name}`, form, async (formData) => {
    try {
      const xeroToken = tenants.find(t => t.tenantId === formData.xeroTenantId);

      await api.post('/xero/setup/company-mapping', {
        companyId: company.id,
        xeroTokenId: xeroToken.id,
        xeroTenantId: formData.xeroTenantId,
        invoiceRate: formData.invoiceRate || null,
        xeroContactId: formData.xeroContactId || null
      });

      showAlert('Company mapping saved successfully', 'success');
      await loadMappings();
      displayCompanyMappings();
      hideModal();
    } catch (error) {
      console.error('Failed to save company mapping:', error);
      showAlert('Failed to save mapping: ' + error.message, 'error');
    }
  });
};

/**
 * Display employee mappings
 */
async function displayEmployeeMappings() {
  const container = document.getElementById('employeeMappingList');
  const employees = state.get('employees') || [];
  const mappings = state.get('xeroMappings')?.employees || [];

  if (!selectedEmployeeTenant) {
    container.innerHTML = '<p style="color: #6b7280;">Select a Xero tenant to view/edit employee mappings.</p>';
    return;
  }

  container.innerHTML = '<p>Loading Xero employees...</p>';

  try {
    const xeroEmployees = await api.get(`/xero/setup/employees/${selectedEmployeeTenant}`);
    state.set('xeroEmployees', xeroEmployees);

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Local Employee</th>
            <th>Xero Employee</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${employees.map(employee => {
            const mapping = mappings.find(m =>
              m.employeeId === employee.id &&
              m.identifierType === 'xero_employee_id'
            );

            const xeroEmp = mapping ? xeroEmployees.find(xe => xe.EmployeeID === mapping.identifierValue) : null;

            return `
              <tr>
                <td>${escapeHtml(employee.firstName)} ${escapeHtml(employee.lastName)}</td>
                <td>
                  ${xeroEmp ?
                    `${escapeHtml(xeroEmp.FirstName)} ${escapeHtml(xeroEmp.LastName)}` :
                    '<span style="color: #9ca3af;">Not mapped</span>'
                  }
                </td>
                <td>
                  ${mapping ?
                    '<span style="color: #10b981;">✓ Mapped</span>' :
                    '<span style="color: #f59e0b;">⚠ Unmapped</span>'
                  }
                </td>
                <td>
                  <button class="btn btn-sm btn-primary" onclick="window.editEmployeeMapping(${employee.id})">
                    ${mapping ? 'Change' : 'Map'}
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error('Failed to load Xero employees:', error);
    container.innerHTML = `<p style="color: #dc2626;">Failed to load Xero employees: ${escapeHtml(error.message)}</p>`;
  }
}

/**
 * Edit employee mapping
 */
window.editEmployeeMapping = async function(employeeId) {
  const employees = state.get('employees') || [];
  const xeroEmployees = state.get('xeroEmployees') || [];
  const mappings = state.get('xeroMappings')?.employees || [];

  const employee = employees.find(e => e.id === employeeId);
  const mapping = mappings.find(m =>
    m.employeeId === employeeId &&
    m.identifierType === 'xero_employee_id'
  );

  if (!employee) return;

  const { showModalWithForm, hideModal } = await import('../../core/modal.js');

  const form = `
    <form id="employeeMappingForm">
      <div class="form-group">
        <label>Local Employee</label>
        <input type="text" value="${escapeHtml(employee.firstName)} ${escapeHtml(employee.lastName)}" disabled>
      </div>
      <div class="form-group">
        <label>Xero Employee *</label>
        <select name="xeroEmployeeId" required>
          <option value="">Select Xero employee...</option>
          ${xeroEmployees.map(xe => `
            <option value="${escapeHtml(xe.EmployeeID)}" ${mapping?.identifierValue === xe.EmployeeID ? 'selected' : ''}>
              ${escapeHtml(xe.FirstName)} ${escapeHtml(xe.LastName)} (${escapeHtml(xe.EmployeeID.substring(0, 8))})
            </option>
          `).join('')}
        </select>
      </div>
      <button type="submit" class="btn btn-primary">Save Mapping</button>
    </form>
  `;

  showModalWithForm(`Map Employee: ${employee.firstName} ${employee.lastName}`, form, async (formData) => {
    try {
      await api.post('/xero/setup/employees/map', {
        employeeId: employee.id,
        xeroEmployeeId: formData.xeroEmployeeId,
        companyId: null
      });

      showAlert('Employee mapping saved successfully', 'success');
      await loadMappings();
      displayEmployeeMappings();
      hideModal();
    } catch (error) {
      console.error('Failed to save employee mapping:', error);
      showAlert('Failed to save mapping: ' + error.message, 'error');
    }
  });
};

/**
 * Display role mappings
 */
async function displayRoleMappings() {
  const container = document.getElementById('roleMappingList');
  const roles = state.get('roles') || [];
  const mappings = state.get('xeroMappings')?.earningsRates || [];

  if (!selectedRoleTenant) {
    container.innerHTML = '<p style="color: #6b7280;">Select a Xero tenant to view/edit role mappings.</p>';
    return;
  }

  container.innerHTML = '<p>Loading Xero earnings rates...</p>';

  try {
    const earningsRates = await api.get(`/xero/setup/earnings-rates/${selectedRoleTenant}`);
    state.set('xeroEarningsRates', earningsRates);

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Local Role</th>
            <th>Company</th>
            <th>Xero Earnings Rate</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${roles.map(role => {
            const mapping = mappings.find(m =>
              m.roleId === role.id &&
              m.xeroTenantId === selectedRoleTenant
            );

            const earningsRate = mapping ? earningsRates.find(er => er.EarningsRateID === mapping.xeroEarningsRateId) : null;

            return `
              <tr>
                <td>${escapeHtml(role.name)}</td>
                <td>${escapeHtml(role.company?.name || 'N/A')}</td>
                <td>
                  ${earningsRate ?
                    escapeHtml(earningsRate.Name) :
                    '<span style="color: #9ca3af;">Not mapped</span>'
                  }
                </td>
                <td>
                  ${mapping ?
                    '<span style="color: #10b981;">✓ Mapped</span>' :
                    '<span style="color: #f59e0b;">⚠ Unmapped</span>'
                  }
                </td>
                <td>
                  <button class="btn btn-sm btn-primary" onclick="window.editRoleMapping(${role.id})">
                    ${mapping ? 'Change' : 'Map'}
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error('Failed to load earnings rates:', error);
    container.innerHTML = `<p style="color: #dc2626;">Failed to load earnings rates: ${escapeHtml(error.message)}</p>`;
  }
}

/**
 * Edit role mapping
 */
window.editRoleMapping = async function(roleId) {
  const roles = state.get('roles') || [];
  const earningsRates = state.get('xeroEarningsRates') || [];
  const mappings = state.get('xeroMappings')?.earningsRates || [];

  const role = roles.find(r => r.id === roleId);
  const mapping = mappings.find(m =>
    m.roleId === roleId &&
    m.xeroTenantId === selectedRoleTenant
  );

  if (!role) return;

  const { showModalWithForm, hideModal } = await import('../../core/modal.js');

  const form = `
    <form id="roleMappingForm">
      <div class="form-group">
        <label>Local Role</label>
        <input type="text" value="${escapeHtml(role.name)} (${escapeHtml(role.company?.name || 'N/A')})" disabled>
      </div>
      <div class="form-group">
        <label>Xero Earnings Rate *</label>
        <select name="xeroEarningsRateId" required>
          <option value="">Select earnings rate...</option>
          ${earningsRates.map(er => `
            <option value="${escapeHtml(er.EarningsRateID)}" ${mapping?.xeroEarningsRateId === er.EarningsRateID ? 'selected' : ''}>
              ${escapeHtml(er.Name)} (${escapeHtml(er.RateType || 'Standard')})
            </option>
          `).join('')}
        </select>
      </div>
      <button type="submit" class="btn btn-primary">Save Mapping</button>
    </form>
  `;

  showModalWithForm(`Map Role: ${role.name}`, form, async (formData) => {
    try {
      const earningsRate = earningsRates.find(er => er.EarningsRateID === formData.xeroEarningsRateId);

      await api.post('/xero/setup/earnings-rates/map', {
        roleId: role.id,
        xeroTenantId: selectedRoleTenant,
        xeroEarningsRateId: formData.xeroEarningsRateId,
        earningsRateName: earningsRate.Name
      });

      showAlert('Role mapping saved successfully', 'success');
      await loadMappings();
      displayRoleMappings();
      hideModal();
    } catch (error) {
      console.error('Failed to save role mapping:', error);
      showAlert('Failed to save mapping: ' + error.message, 'error');
    }
  });
};

/**
 * Display employee settings
 */
function displayEmployeeSettings() {
  const container = document.getElementById('employeeSettingsList');
  const employees = state.get('employees') || [];
  const settings = state.get('xeroMappings')?.settings || [];

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Employee</th>
          <th>Type</th>
          <th>Auto-Approve</th>
          <th>Sync Enabled</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${employees.map(employee => {
          const empSettings = settings.find(s => s.employeeId === employee.id);

          return `
            <tr>
              <td>${escapeHtml(employee.firstName)} ${escapeHtml(employee.lastName)}</td>
              <td>
                ${empSettings?.employeeType === 'LT' ?
                  '<span style="color: #3b82f6;">Local Tech</span>' :
                  '<span style="color: #10b981;">Specialist Tech</span>'
                }
              </td>
              <td>${empSettings?.autoApprove ? '✓ Yes' : '✗ No'}</td>
              <td>${empSettings?.syncEnabled !== false ? '✓ Enabled' : '✗ Disabled'}</td>
              <td>
                <button class="btn btn-sm btn-primary" onclick="window.editEmployeeSettings(${employee.id})">
                  Configure
                </button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Edit employee settings
 */
window.editEmployeeSettings = async function(employeeId) {
  const employees = state.get('employees') || [];
  const settings = state.get('xeroMappings')?.settings || [];

  const employee = employees.find(e => e.id === employeeId);
  const empSettings = settings.find(s => s.employeeId === employeeId);

  if (!employee) return;

  const { showModalWithForm, hideModal } = await import('../../core/modal.js');

  const form = `
    <form id="employeeSettingsForm">
      <div class="form-group">
        <label>Employee</label>
        <input type="text" value="${escapeHtml(employee.firstName)} ${escapeHtml(employee.lastName)}" disabled>
      </div>
      <div class="form-group">
        <label>Employee Type *</label>
        <select name="employeeType" required>
          <option value="ST" ${!empSettings || empSettings.employeeType === 'ST' ? 'selected' : ''}>
            Specialist Tech (ST) - Payroll only
          </option>
          <option value="LT" ${empSettings?.employeeType === 'LT' ? 'selected' : ''}>
            Local Tech (LT) - Payroll + Monthly Invoices
          </option>
        </select>
        <small>LT employees will have monthly invoices generated for client billing</small>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" name="autoApprove" ${empSettings?.autoApprove ? 'checked' : ''}>
          Auto-approve timesheets (skip manual approval)
        </label>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" name="syncEnabled" ${empSettings?.syncEnabled !== false ? 'checked' : ''}>
          Enable Xero sync for this employee
        </label>
      </div>
      <button type="submit" class="btn btn-primary">Save Settings</button>
    </form>
  `;

  showModalWithForm(`Configure: ${employee.firstName} ${employee.lastName}`, form, async (formData) => {
    try {
      await api.post('/xero/setup/employee-settings', {
        employeeId: employee.id,
        employeeType: formData.employeeType,
        autoApprove: formData.autoApprove === 'on',
        syncEnabled: formData.syncEnabled === 'on'
      });

      showAlert('Employee settings saved successfully', 'success');
      await loadMappings();
      displayEmployeeSettings();
      hideModal();
    } catch (error) {
      console.error('Failed to save employee settings:', error);
      showAlert('Failed to save settings: ' + error.message, 'error');
    }
  });
};

// Register tab hook
registerTabHook('xeroSetup', initXeroSetup);
