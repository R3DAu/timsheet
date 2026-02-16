/**
 * Authentication module
 */

import { api } from '../../core/api.js';
import { state } from '../../core/state.js';
import { escapeHtml } from '../../core/dom.js';
import { activateTab, getRequestedTab, isTabAvailable } from '../../core/navigation.js';

/**
 * Login with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 */
export async function login(email, password) {
  try {
    const result = await api.post('/auth/login', { email, password });
    state.set('currentUser', result.user);
    await showMainScreen();
  } catch (error) {
    document.getElementById('loginError').textContent = error.message;
  }
}

/**
 * Logout current user
 */
export async function logout() {
  try {
    await api.post('/auth/logout');
    state.set('currentUser', null);
    showLoginScreen();
  } catch (error) {
    console.error('Logout error:', error);
  }
}

/**
 * Check if user is authenticated
 */
export async function checkAuth() {
  try {
    const result = await api.get('/auth/me');
    state.set('currentUser', result.user);
    await showMainScreen();
  } catch (error) {
    showLoginScreen();
  }
}

/**
 * Show login screen
 */
export function showLoginScreen() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('mainScreen').style.display = 'none';
}

/**
 * Show main screen and load data
 */
export async function showMainScreen() {
  const currentUser = state.get('currentUser');

  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('mainScreen').style.display = 'block';

  // XSS FIX: Escape user name before displaying
  document.getElementById('userDisplay').textContent = currentUser.name;

  const hasProfile = !!currentUser.employeeId;
  const isAdmin = currentUser.isAdmin;

  // Configure tabs visibility
  const myTimesheetsTabBtn = document.querySelector('[data-tab="myTimesheets"]');
  const allTimesheetsTabBtn = document.querySelector('[data-tab="allTimesheets"]');

  // Default tab for this user type
  let defaultTabName = 'entries';

  if (isAdmin && !hasProfile) {
    // Admin without profile: All Timesheets only
    myTimesheetsTabBtn.style.display = 'none';
    allTimesheetsTabBtn.style.display = '';
    defaultTabName = 'allTimesheets';
  } else if (isAdmin && hasProfile) {
    // Admin with profile: show both, default to My Timesheets
    myTimesheetsTabBtn.style.display = '';
    allTimesheetsTabBtn.style.display = '';
    defaultTabName = 'myTimesheets';
  } else {
    // Regular user: My Timesheets only
    myTimesheetsTabBtn.style.display = '';
    allTimesheetsTabBtn.style.display = 'none';
    defaultTabName = 'myTimesheets';
  }

  // Show/hide admin tabs
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });

  // Restore requested tab (hash / localStorage), but fall back safely
  const requested = getRequestedTab();
  const chosen = (requested && isTabAvailable(requested)) ? requested : defaultTabName;
  activateTab(chosen, { persist: true });

  await loadAllData();
}

/**
 * Load all data for the current user
 */
export async function loadAllData() {
  const currentUser = state.get('currentUser');

  // Import and call load functions from feature modules
  const { loadCompanies } = await import('../companies/companies.js');
  const { loadRoles } = await import('../roles/roles.js');

  await Promise.all([
    loadCompanies(),
    loadRoles()
  ]);

  // Load user-specific data
  if (currentUser.employeeId) {
    // await loadMyTimesheets(); // TODO: implement when timesheets module is ready
  }

  if (currentUser.isAdmin) {
    const { loadEmployees } = await import('../employees/employees.js');
    const { loadUsers } = await import('../users/users.js');

    await Promise.all([
      // loadAllTimesheets(), // TODO: implement when timesheets module is ready
      loadEmployees(),
      loadUsers(),
      // loadApiKeys() // TODO: implement when api-keys module is ready
    ]);
  }
}
