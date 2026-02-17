/**
 * Xero Setup Module
 * Handles OAuth connection and mapping configuration
 */

import { api } from '../../core/api.js';
import { state } from '../../core/state.js';
import { showAlert, showConfirmation } from '../../core/alerts.js';
import { escapeHtml } from '../../core/dom.js';
import { registerTabHook } from '../../core/navigation.js';
import { showModalWithForm, hideModal } from '../../core/modal.js';

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

  document.getElementById('leaveTypeTenantSelector')?.addEventListener('change', (e) => {
    selectedLeaveTypeTenant = e.target.value;
    displayLeaveTypeMappings();
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
  } else if (tabName === 'leaveTypes') {
    populateLeaveTypeTenantSelector();
    displayLeaveTypeMappings();
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

  const activeTenants = tenants.filter(t => t.isActive);
  const inactiveTenants = tenants.filter(t => !t.isActive);

  if (tenants.length === 0) {
    statusDiv.innerHTML = `
      <div style="padding: 1rem; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px;">
        <strong>⚠️ Not Connected</strong>
        <p style="margin: 0.5rem 0 0 0; color: #92400e;">
          Connect your Xero account to enable payroll sync.
        </p>
      </div>
    `;
    connectBtn.textContent = 'Connect Xero';
    connectBtn.style.display = 'inline-block';
    refreshBtn.style.display = 'none';
  } else {
    const hasInactive = inactiveTenants.length > 0;

    statusDiv.innerHTML = `
      <div style="padding: 1rem; background: ${hasInactive ? '#fef3c7' : '#d1fae5'}; border: 1px solid ${hasInactive ? '#fcd34d' : '#6ee7b7'}; border-radius: 6px;">
        <strong>${hasInactive ? '⚠️ Partial Connection' : '✅ Connected'}</strong>

        ${activeTenants.length > 0 ? `
          <p style="margin: 0.5rem 0 0 0; color: ${hasInactive ? '#92400e' : '#065f46'};">
            <strong>Active (${activeTenants.length}):</strong>
          </p>
          <ul style="margin: 0.25rem 0 0 1.5rem; color: ${hasInactive ? '#92400e' : '#065f46'};">
            ${activeTenants.map(t => `<li>${escapeHtml(t.tenantName)}</li>`).join('')}
          </ul>
        ` : ''}

        ${hasInactive ? `
          <p style="margin: 0.75rem 0 0 0; color: #dc2626;">
            <strong>Inactive (${inactiveTenants.length}):</strong>
          </p>
          <ul style="margin: 0.25rem 0 0 1.5rem; color: #dc2626;">
            ${inactiveTenants.map(t => `<li>${escapeHtml(t.tenantName)} - Token expired</li>`).join('')}
          </ul>
          <p style="margin: 0.75rem 0 0 0; color: #92400e;">
            Click "Reconnect All" below to refresh all tenant tokens.
          </p>
        ` : ''}
      </div>
    `;

    if (hasInactive) {
      connectBtn.textContent = 'Reconnect All Tenants';
      connectBtn.style.display = 'inline-block';
      refreshBtn.style.display = 'inline-block';
    } else {
      connectBtn.style.display = 'none';
      refreshBtn.style.display = 'inline-block';
    }
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
        <div style="padding: 1rem; background: ${tenant.isActive ? '#f9fafb' : '#fef2f2'}; border: 1px solid ${tenant.isActive ? '#e5e7eb' : '#fecaca'}; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>${escapeHtml(tenant.tenantName)}</strong>
            <span style="margin-left: 0.5rem; padding: 0.25rem 0.5rem; background: ${tenant.isActive ? '#10b981' : '#dc2626'}; color: white; border-radius: 4px; font-size: 0.75rem; font-weight: 500;">
              ${tenant.isActive ? 'ACTIVE' : 'INACTIVE'}
            </span>
            <div style="font-size: 0.875rem; color: #6b7280; margin-top: 0.25rem;">
              Tenant ID: ${escapeHtml(tenant.tenantId)}
            </div>
            ${tenant.lastSyncedAt ? `
              <div style="font-size: 0.875rem; color: #6b7280;">
                Last synced: ${new Date(tenant.lastSyncedAt).toLocaleString()}
              </div>
            ` : ''}
            ${!tenant.isActive ? `
              <div style="font-size: 0.875rem; color: #dc2626; margin-top: 0.25rem; font-weight: 500;">
                ⚠️ Token expired - use "Reconnect All" to refresh
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

  showModalWithForm(`Map Company: ${company.name}`, form);

  // Attach form submit handler
  document.getElementById('companyMappingForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    try {
      const xeroTenantId = formData.get('xeroTenantId');
      const xeroToken = tenants.find(t => t.tenantId === xeroTenantId);

      await api.post('/xero/setup/company-mapping', {
        companyId: company.id,
        xeroTokenId: xeroToken.id,
        xeroTenantId: xeroTenantId,
        invoiceRate: formData.get('invoiceRate') || null,
        xeroContactId: formData.get('xeroContactId') || null
      });

      showAlert('Company mapping saved successfully', 'success');
      await loadMappings();
      displayCompanyMappings();
      hideModal();
    } catch (error) {
      console.error('Failed to save company mapping:', error);
      showAlert('Failed to save mapping: ' + error.message, 'error');
    }
  };
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

            const xeroEmp = mapping ? xeroEmployees.find(xe =>
              (xe.EmployeeID || xe.employeeID) === mapping.identifierValue
            ) : null;

            return `
              <tr>
                <td>${escapeHtml(employee.firstName)} ${escapeHtml(employee.lastName)}</td>
                <td>
                  ${xeroEmp ?
                    `${escapeHtml(xeroEmp.FirstName || xeroEmp.firstName || '')} ${escapeHtml(xeroEmp.LastName || xeroEmp.lastName || '')}` :
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
  const mappings = state.get('xeroMappings')?.employees || [];

  const employee = employees.find(e => e.id === employeeId);
  const mapping = mappings.find(m =>
    m.employeeId === employeeId &&
    m.identifierType === 'xero_employee_id'
  );

  if (!employee) return;

  if (!selectedEmployeeTenant) {
    showAlert('Please select a Xero tenant first', 'error');
    return;
  }

  const { showModalWithForm, hideModal } = await import('../../core/modal.js');

  try {
    // Fetch fresh Xero employees for the selected tenant
    const xeroEmployees = await api.get(`/xero/setup/employees/${selectedEmployeeTenant}`);

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
            ${xeroEmployees.filter(xe => xe.employeeID || xe.EmployeeID).map(xe => {
              const empId = xe.employeeID || xe.EmployeeID;
              const firstName = xe.firstName || xe.FirstName || '';
              const lastName = xe.lastName || xe.LastName || '';
              return `
                <option value="${escapeHtml(empId)}" ${mapping?.identifierValue === empId ? 'selected' : ''}>
                  ${escapeHtml(firstName)} ${escapeHtml(lastName)} (${escapeHtml(empId.substring(0, 8))})
                </option>
              `;
            }).join('')}
          </select>
        </div>
        <button type="submit" class="btn btn-primary">Save Mapping</button>
      </form>
    `;

    showModalWithForm(`Map Employee: ${employee.firstName} ${employee.lastName}`, form);

    // Attach form submit handler
    document.getElementById('employeeMappingForm').onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);

      try {
        await api.post('/xero/setup/employees/map', {
          employeeId: employee.id,
          xeroEmployeeId: formData.get('xeroEmployeeId'),
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
    };
  } catch (error) {
    console.error('Failed to load Xero employees:', error);
    showAlert('Failed to load Xero employees: ' + error.message, 'error');
  }
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

            const earningsRate = mapping ? earningsRates.find(er =>
              (er.EarningsRateID || er.earningsRateID) === mapping.xeroEarningsRateId
            ) : null;

            return `
              <tr>
                <td>${escapeHtml(role.name)}</td>
                <td>${escapeHtml(role.company?.name || 'N/A')}</td>
                <td>
                  ${earningsRate ?
                    escapeHtml(earningsRate.Name || earningsRate.name || '(Unnamed)') :
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
          ${earningsRates.map(er => {
            const rateId = er.EarningsRateID || er.earningsRateID;
            const name = er.Name || er.name || '(Unnamed)';
            const rateType = er.RateType || er.rateType || 'Standard';
            return `
              <option value="${escapeHtml(rateId)}" ${mapping?.xeroEarningsRateId === rateId ? 'selected' : ''}>
                ${escapeHtml(name)} (${escapeHtml(rateType)})
              </option>
            `;
          }).join('')}
        </select>
      </div>
      <button type="submit" class="btn btn-primary">Save Mapping</button>
    </form>
  `;

  showModalWithForm(`Map Role: ${role.name}`, form);

  // Attach form submit handler
  document.getElementById('roleMappingForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    try {
      const xeroEarningsRateId = formData.get('xeroEarningsRateId');
      const earningsRate = earningsRates.find(er =>
        (er.EarningsRateID || er.earningsRateID) === xeroEarningsRateId
      );

      await api.post('/xero/setup/earnings-rates/map', {
        roleId: role.id,
        xeroTenantId: selectedRoleTenant,
        xeroEarningsRateId: xeroEarningsRateId,
        earningsRateName: earningsRate.Name || earningsRate.name
      });

      showAlert('Role mapping saved successfully', 'success');
      await loadMappings();
      displayRoleMappings();
      hideModal();
    } catch (error) {
      console.error('Failed to save role mapping:', error);
      showAlert('Failed to save mapping: ' + error.message, 'error');
    }
  };
};

/**
 * Display employee settings
 */
function displayEmployeeSettings() {
  const container = document.getElementById('employeeSettingsList');
  const employees = state.get('employees') || [];
  const settings = state.get('xeroMappings')?.settings || [];

  container.innerHTML = `
    <h3 style="margin-bottom: 1rem;">General Settings</h3>
    <table>
      <thead>
        <tr>
          <th>Employee</th>
          <th>Type</th>
          <th>Salaried</th>
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
              <td>
                ${empSettings?.isSalaried ?
                  '<span style="color: #f59e0b;">✓ Salaried</span>' :
                  '✗ No'
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

    <h3 style="margin: 2rem 0 1rem 0;">Employee-Specific Earnings Rates</h3>
    <p style="color: #6b7280; margin-bottom: 1rem;">
      Override the default earnings rate for specific employees. If not set, the role's default rate is used.
    </p>
    <div id="employeeEarningsRatesList"></div>
  `;

  // Load the earnings rates section
  displayEmployeeEarningsRates();
}

/**
 * Display employee-specific earnings rates
 */
function displayEmployeeEarningsRates() {
  const container = document.getElementById('employeeEarningsRatesList');
  const employees = state.get('employees') || [];
  const roles = state.get('roles') || [];
  const earningsRateMappings = state.get('xeroMappings')?.earningsRates || [];
  const employeeEarningsRates = state.get('xeroMappings')?.employeeEarningsRates || [];
  const tenants = state.get('xeroTenants') || [];

  if (tenants.length === 0) {
    container.innerHTML = '<p style="color: #6b7280;">Connect to Xero first to configure earnings rates.</p>';
    return;
  }

  // Group employees by their roles
  const employeeRoles = [];
  employees.forEach(employee => {
    employee.roles?.forEach(empRole => {
      const role = roles.find(r => r.id === empRole.roleId);
      if (role) {
        employeeRoles.push({
          employee,
          role,
          empRole
        });
      }
    });
  });

  if (employeeRoles.length === 0) {
    container.innerHTML = '<p style="color: #6b7280;">No employee role assignments found.</p>';
    return;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Employee</th>
          <th>Role</th>
          <th>Xero Tenant</th>
          <th>Current Rate</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${employeeRoles.map(({ employee, role }) => {
          return tenants.filter(t => t.isActive).map(tenant => {
            // Find custom rate for this employee/role/tenant
            const customRate = employeeEarningsRates.find(
              er => er.employeeId === employee.id &&
                    er.roleId === role.id &&
                    er.xeroTenantId === tenant.tenantId
            );

            // Find default rate for this role/tenant
            const defaultRate = earningsRateMappings.find(
              m => m.roleId === role.id && m.xeroTenantId === tenant.tenantId
            );

            const currentRate = customRate || defaultRate;
            const isCustom = !!customRate;

            return `
              <tr>
                <td>${escapeHtml(employee.firstName)} ${escapeHtml(employee.lastName)}</td>
                <td>${escapeHtml(role.name)}</td>
                <td>${escapeHtml(tenant.tenantName)}</td>
                <td>
                  ${currentRate ? `
                    <span style="${isCustom ? 'color: #3b82f6; font-weight: 500;' : ''}">
                      ${escapeHtml(currentRate.earningsRateName)}
                    </span>
                    ${isCustom ? '<span style="color: #3b82f6; font-size: 0.75rem; margin-left: 0.5rem;">(CUSTOM)</span>' : ''}
                    ${!isCustom ? '<span style="color: #6b7280; font-size: 0.75rem; margin-left: 0.5rem;">(default)</span>' : ''}
                  ` : '<span style="color: #dc2626;">Not mapped</span>'}
                </td>
                <td>
                  ${currentRate ? `
                    <button class="btn btn-sm btn-primary"
                      onclick="window.setCustomEarningsRate(${employee.id}, ${role.id}, '${tenant.tenantId}', '${tenant.tenantName}')">
                      ${isCustom ? 'Change' : 'Set Custom'}
                    </button>
                    ${isCustom ? `
                      <button class="btn btn-sm btn-secondary"
                        onclick="window.removeCustomEarningsRate(${customRate.id}, ${employee.id}, ${role.id})">
                        Revert to Default
                      </button>
                    ` : ''}
                  ` : '<span style="color: #9ca3af;">Map role first</span>'}
                </td>
              </tr>
            `;
          }).join('');
        }).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Set custom earnings rate for an employee/role
 */
window.setCustomEarningsRate = async function(employeeId, roleId, xeroTenantId, tenantName) {
  const employees = state.get('employees') || [];
  const roles = state.get('roles') || [];
  const employee = employees.find(e => e.id === employeeId);
  const role = roles.find(r => r.id === roleId);

  if (!employee || !role) return;

  const { showModalWithForm, hideModal } = await import('../../core/modal.js');

  // Fetch earnings rates for this tenant
  try {
    const earningsRates = await api.get(`/xero/setup/earnings-rates/${xeroTenantId}`);

    const form = `
      <form id="customEarningsRateForm">
        <div class="form-group">
          <label>Employee</label>
          <input type="text" value="${escapeHtml(employee.firstName)} ${escapeHtml(employee.lastName)}" disabled>
        </div>
        <div class="form-group">
          <label>Role</label>
          <input type="text" value="${escapeHtml(role.name)}" disabled>
        </div>
        <div class="form-group">
          <label>Xero Tenant</label>
          <input type="text" value="${escapeHtml(tenantName)}" disabled>
        </div>
        <div class="form-group">
          <label>Custom Earnings Rate *</label>
          <select name="xeroEarningsRateId" required>
            <option value="">Select earnings rate...</option>
            ${earningsRates.map(er => {
              const rateId = er.EarningsRateID || er.earningsRateID;
              const name = er.Name || er.name || '(Unnamed)';
              const rateType = er.RateType || er.rateType || 'Standard';
              return `
                <option value="${escapeHtml(rateId)}">
                  ${escapeHtml(name)} (${escapeHtml(rateType)})
                </option>
              `;
            }).join('')}
          </select>
          <small>This will override the role's default rate for this employee</small>
        </div>
        <button type="submit" class="btn btn-primary">Save Custom Rate</button>
      </form>
    `;

    showModalWithForm(`Set Custom Rate: ${employee.firstName} ${employee.lastName}`, form);

    // Attach form submit handler
    document.getElementById('customEarningsRateForm').onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);

      try {
        const xeroEarningsRateId = formData.get('xeroEarningsRateId');
        const earningsRate = earningsRates.find(er =>
          (er.EarningsRateID || er.earningsRateID) === xeroEarningsRateId
        );

        await api.post('/xero/setup/employee-earnings-rate', {
          employeeId,
          roleId,
          xeroTenantId,
          xeroEarningsRateId,
          earningsRateName: earningsRate.Name || earningsRate.name
        });

        showAlert('Custom earnings rate saved successfully', 'success');
        await loadMappings();
        displayEmployeeSettings();
        hideModal();
      } catch (error) {
        console.error('Failed to save custom earnings rate:', error);
        showAlert('Failed to save custom rate: ' + error.message, 'error');
      }
    };
  } catch (error) {
    console.error('Failed to load earnings rates:', error);
    showAlert('Failed to load earnings rates: ' + error.message, 'error');
  }
};

/**
 * Remove custom earnings rate (revert to role default)
 */
window.removeCustomEarningsRate = async function(customRateId, employeeId, roleId) {
  const employees = state.get('employees') || [];
  const roles = state.get('roles') || [];
  const employee = employees.find(e => e.id === employeeId);
  const role = roles.find(r => r.id === roleId);

  const confirmed = confirm(
    `Remove custom earnings rate for ${employee.firstName} ${employee.lastName} - ${role.name}?\n\n` +
    `This will revert to using the role's default rate.`
  );

  if (!confirmed) return;

  try {
    await api.delete(`/xero/setup/employee-earnings-rate/${customRateId}`);
    showAlert('Custom earnings rate removed - reverted to role default', 'success');
    await loadMappings();
    displayEmployeeSettings();
  } catch (error) {
    console.error('Failed to remove custom earnings rate:', error);
    showAlert('Failed to remove custom rate: ' + error.message, 'error');
  }
};

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
      <div class="form-group">
        <label>
          <input type="checkbox" name="isSalaried" ${empSettings?.isSalaried ? 'checked' : ''}>
          Employee is salaried (skip timesheet sync)
        </label>
        <small>Salaried employees won't have timesheets synced to Xero, but can still create timesheets for tracking</small>
      </div>
      <button type="submit" class="btn btn-primary">Save Settings</button>
    </form>
  `;

  showModalWithForm(`Configure: ${employee.firstName} ${employee.lastName}`, form);

  // Attach form submit handler
  document.getElementById('employeeSettingsForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    try {
      await api.post('/xero/setup/employee-settings', {
        employeeId: employee.id,
        employeeType: formData.get('employeeType'),
        autoApprove: formData.get('autoApprove') === 'on',
        syncEnabled: formData.get('syncEnabled') === 'on',
        isSalaried: formData.get('isSalaried') === 'on'
      });

      showAlert('Employee settings saved successfully', 'success');
      await loadMappings();
      displayEmployeeSettings();
      hideModal();
    } catch (error) {
      console.error('Failed to save employee settings:', error);
      showAlert('Failed to save settings: ' + error.message, 'error');
    }
  };
};

// Register tab hook
registerTabHook('xeroSetup', initXeroSetup);

// ==================== LEAVE TYPE MAPPING ====================

let selectedLeaveTypeTenant = null;

/**
 * Display leave type mappings for selected tenant
 */
async function displayLeaveTypeMappings() {
  const container = document.getElementById('leaveTypeMappingsList');
  if (!container) return;

  if (!selectedLeaveTypeTenant) {
    container.innerHTML = '<p style="color: #6b7280;">Please select a Xero tenant above.</p>';
    return;
  }

  try {
    // Fetch Xero leave types for this tenant
    const xeroLeaveTypes = await api.get(`/xero/setup/leave-types/${selectedLeaveTypeTenant}`);

    const mappings = state.get('xeroMappings') || {};
    const leaveTypeMappings = mappings.leaveTypes || [];

    // Our internal leave types
    const internalLeaveTypes = [
      { code: 'ANNUAL', name: 'Annual Leave' },
      { code: 'SICK', name: 'Sick Leave' },
      { code: 'PERSONAL', name: 'Personal Leave' },
      { code: 'UNPAID', name: 'Unpaid Leave' }
    ];

    container.innerHTML = `
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
            <th style="padding: 1rem; text-align: left;">Leave Type</th>
            <th style="padding: 1rem; text-align: left;">Xero Leave Type</th>
            <th style="padding: 1rem; text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${internalLeaveTypes.map(leaveType => {
            const mapping = leaveTypeMappings.find(
              m => m.xeroTenantId === selectedLeaveTypeTenant && m.leaveType === leaveType.code
            );

            return `
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 1rem; font-weight: 500;">${leaveType.name}</td>
                <td style="padding: 1rem;">
                  ${mapping ? `
                    <span style="color: #10b981;">✓ ${mapping.leaveTypeName}</span>
                  ` : `
                    <span style="color: #f59e0b;">Not mapped</span>
                  `}
                </td>
                <td style="padding: 1rem; text-align: right;">
                  <button
                    class="btn btn-sm btn-primary"
                    onclick="xeroSetup.editLeaveTypeMapping('${leaveType.code}', '${leaveType.name}')"
                  >
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
    console.error('[XeroSetup] Error displaying leave type mappings:', error);
    showAlert('Failed to load leave type mappings', 'error');
  }
}

/**
 * Edit leave type mapping
 */
window.xeroSetup = window.xeroSetup || {};
window.xeroSetup.editLeaveTypeMapping = async function(leaveTypeCode, leaveTypeName) {
  if (!selectedLeaveTypeTenant) {
    showAlert('Please select a Xero tenant first', 'error');
    return;
  }

  try {
    // Fetch Xero leave types for this tenant
    const xeroTypes = await api.get(`/xero/setup/leave-types/${selectedLeaveTypeTenant}`);

    // Get current mapping
    const mappings = state.get('xeroMappings') || {};
    const leaveTypeMappings = mappings.leaveTypes || [];
    const currentMapping = leaveTypeMappings.find(
      m => m.xeroTenantId === selectedLeaveTypeTenant && m.leaveType === leaveTypeCode
    );

    const modalContent = `
      <h2>Map ${leaveTypeName}</h2>
      <form id="leave-type-mapping-form">
        <input type="hidden" name="leaveType" value="${leaveTypeCode}" />

        <div class="form-group">
          <label>Xero Leave Type</label>
          <select name="xeroLeaveTypeId" class="form-control" required>
            <option value="">Select Xero leave type...</option>
            ${xeroTypes.map(lt => {
              const ltId = lt.leaveTypeID || lt.LeaveTypeID;
              const ltName = lt.name || lt.Name || '(Unnamed)';
              const selected = currentMapping && currentMapping.xeroLeaveTypeId === ltId ? 'selected' : '';
              return `<option value="${ltId}" ${selected}>${ltName}</option>`;
            }).join('')}
          </select>
        </div>

        <div class="form-actions" style="margin-top: 1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="hideModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Mapping</button>
        </div>
      </form>
    `;

    showModalWithForm('Map Leave Type', modalContent);

    document.getElementById('leave-type-mapping-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(e.target);
      const xeroLeaveTypeId = formData.get('xeroLeaveTypeId');

      // Find the selected leave type name
      const selectedType = xeroTypes.find(lt =>
        (lt.leaveTypeID || lt.LeaveTypeID) === xeroLeaveTypeId
      );
      const leaveTypeNameXero = selectedType ? (selectedType.name || selectedType.Name) : '';

      try {
        await api.post('/xero/setup/leave-type-mapping', {
          xeroTenantId: selectedLeaveTypeTenant,
          leaveType: leaveTypeCode,
          xeroLeaveTypeId: xeroLeaveTypeId,
          leaveTypeName: leaveTypeNameXero
        });

        showAlert(`${leaveTypeName} mapped successfully!`, 'success');
        hideModal();

        // Reload mappings
        await loadMappings();
        await displayLeaveTypeMappings();
      } catch (error) {
        console.error('[XeroSetup] Error saving leave type mapping:', error);
        showAlert('Failed to save mapping', 'error');
      }
    });
  } catch (error) {
    console.error('[XeroSetup] Error loading leave types:', error);
    showAlert('Failed to load Xero leave types', 'error');
  }
};


/**
 * Populate leave type tenant selector with available tenants
 */
function populateLeaveTypeTenantSelector() {
  const selector = document.getElementById('leaveTypeTenantSelector');
  if (!selector) return;

  const tenants = state.get('xeroTenants') || [];

  selector.innerHTML = '<option value="">Select tenant...</option>' +
    tenants.map(t => `<option value="${t.tenantId}">${t.tenantName}</option>`).join('');

  // Auto-select first tenant if only one
  if (tenants.length === 1) {
    selector.value = tenants[0].tenantId;
    selectedLeaveTypeTenant = tenants[0].tenantId;
    displayLeaveTypeMappings();
  } else if (selectedLeaveTypeTenant) {
    // Restore previous selection
    selector.value = selectedLeaveTypeTenant;
  }
}
