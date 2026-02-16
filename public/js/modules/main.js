/**
 * Main entry point for the timesheet application
 * Imports all modules and wires up event listeners
 */

// Core modules
import { api } from './core/api.js';
import { state } from './core/state.js';
import { escapeHtml, sanitizeRichText } from './core/dom.js';
import { showAlert, showConfirmation } from './core/alerts.js';
import { showModalWithHTML, showModalWithForm, hideModal } from './core/modal.js';
import { initQuillEditor, destroyQuillEditors, quillGetHtml, getQuillEditor } from './core/quill.js';
import { initNavigation, activateTab, getRequestedTab, isTabAvailable } from './core/navigation.js';

// Components
import {
  attachLocationAutocomplete,
  attachAllLocationAutocompletes,
  addLocationNoteField,
  removeLocationNote,
  collectLocationNotes
} from './components/location-autocomplete.js';

// Feature modules
import * as companies from './features/companies/companies.js';
import * as roles from './features/roles/roles.js';
import * as auth from './features/auth/auth.js';
import * as employees from './features/employees/employees.js';
import * as users from './features/users/users.js';
import * as timesheets from './features/timesheets/timesheets.js';
import * as wmsSync from './features/wms/wms-sync.js';
import * as wmsComparison from './features/wms/wms-comparison.js';

// Validation
import { validateEntry, getTimesheetById, getTimesheetEntries, formatTime } from './features/entries/entry-validation.js';

//  ==================== TEMPORARY: Load remaining functions from original app.js ====================
// These will be migrated to feature modules in subsequent steps
// For now, we expose core functionality to allow the app to partially function

// Expose to window for onclick handlers (Phase 1 bridge)
Object.assign(window, {
  // Modal functions
  hideModal,

  // Auth
  login: auth.login,
  logout: auth.logout,

  // Companies
  createCompany: companies.createCompany,
  editCompany: companies.editCompany,
  deleteCompany: companies.deleteCompany,

  // Roles
  createRole: roles.createRole,
  editRole: roles.editRole,
  deleteRole: roles.deleteRole,

  // Employees
  createEmployee: employees.createEmployee,
  viewEmployee: employees.viewEmployee,
  editEmployee: employees.editEmployee,
  deleteEmployee: employees.deleteEmployee,
  addIdentifierForm: employees.addIdentifierForm,
  deleteIdentifier: employees.deleteIdentifier,
  assignRoleForm: employees.assignRoleForm,

  // Users
  createUser: users.createUser,
  editUser: users.editUser,
  linkProfileToUser: users.linkProfileToUser,
  deleteUser: users.deleteUser,

  // Timesheets
  createTimesheet: timesheets.createTimesheet,
  viewTimesheet: timesheets.viewTimesheet,
  submitTimesheet: timesheets.submitTimesheet,
  approveTimesheet: timesheets.approveTimesheet,
  lockTimesheet: timesheets.lockTimesheet,
  deleteTimesheet: timesheets.deleteTimesheet,

  // WMS
  syncToWms: wmsSync.syncToWms,
  viewSyncHistory: wmsSync.viewSyncHistory,
  showDeWmsEntries: wmsComparison.showDeWmsEntries,

  // Location autocomplete
  removeLocationNote,
});

// ==================== INITIALIZATION ====================

async function init() {
  console.log('Initializing timesheet application...');

  // Initialize navigation system
  initNavigation();

  // Set up modal close button
  const closeBtn = document.querySelector('.modal .close');
  if (closeBtn) {
    closeBtn.addEventListener('click', hideModal);
  }

  // Close modal when clicking outside
  const modal = document.getElementById('modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) hideModal();
    });
  }

  // Set up company creation button
  const createCompanyBtn = document.getElementById('createCompanyBtn');
  if (createCompanyBtn) {
    createCompanyBtn.addEventListener('click', () => companies.createCompany());
  }

  // Set up role creation button
  const createRoleBtn = document.getElementById('createRoleBtn');
  if (createRoleBtn) {
    createRoleBtn.addEventListener('click', () => roles.createRole());
  }

  // Set up employee creation button
  const createEmployeeBtn = document.getElementById('createEmployeeBtn');
  if (createEmployeeBtn) {
    createEmployeeBtn.addEventListener('click', () => employees.createEmployee());
  }

  // Set up user creation button
  const createUserBtn = document.getElementById('createUserBtn');
  if (createUserBtn) {
    createUserBtn.addEventListener('click', () => users.createUser());
  }

  // Set up login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      await auth.login(email, password);
    });
  }

  // Set up logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => auth.logout());
  }

  // Set up My Profile button
  const myProfileBtn = document.getElementById('myProfileBtn');
  if (myProfileBtn) {
    myProfileBtn.addEventListener('click', () => {
      // TODO: implement when profile module is ready
      showAlert('Profile functionality coming soon');
    });
  }

  // Check authentication status
  await auth.checkAuth();

  console.log('Application initialized');
}

// Start the application when DOM is ready
document.addEventListener('DOMContentLoaded', init);

console.log('Main module loaded');
