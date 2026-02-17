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
    console.log('🔍 Checking auth...');
    const result = await api.get('/auth/me');
    console.log('✅ Auth successful, user:', result.user.email);
    state.set('currentUser', result.user);
    await showMainScreen();
    console.log('✅ Main screen shown successfully');
  } catch (error) {
    console.log('❌ Auth failed:', error.message);
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

  console.log('📱 Showing main screen for:', currentUser.email);

  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('mainScreen').style.display = 'block';

  // XSS FIX: Escape user name before displaying
  document.getElementById('userDisplay').textContent = currentUser.name;

  const hasProfile = !!currentUser.employeeId;
  const isAdmin = currentUser.isAdmin;

  // Configure tabs visibility - show unified timesheets tab for all users
  const timesheetsTabBtn = document.querySelector('[data-tab="timesheets"]');
  if (timesheetsTabBtn) timesheetsTabBtn.style.display = '';

  // Default tab - always start with timesheets
  let defaultTabName = 'timesheets';

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
  console.log('📦 Loading data for user:', currentUser.email);

  try {
    // Import and call load functions from feature modules
    const { loadCompanies } = await import('../companies/companies.js');
    const { loadRoles } = await import('../roles/roles.js');

    await Promise.all([
      loadCompanies(),
      loadRoles()
    ]);
    console.log('✅ Companies and roles loaded');

    // Load user-specific data
    if (currentUser.employeeId) {
      const { loadMyTimesheets } = await import('../timesheets/timesheets.js');
      await loadMyTimesheets();
      console.log('✅ My timesheets loaded');
    }

    if (currentUser.isAdmin) {
      const { loadEmployees } = await import('../employees/employees.js');
      const { loadUsers } = await import('../users/users.js');
      const { loadAllTimesheets } = await import('../timesheets/timesheets.js');
      const { loadApiKeys } = await import('../api-keys/api-keys.js');

      await Promise.all([
        loadAllTimesheets(),
        loadEmployees(),
        loadUsers(),
        loadApiKeys()
      ]);
      console.log('✅ Admin data loaded');
    }

    console.log('✅ All data loaded successfully');
  } catch (error) {
    console.error('❌ Error loading data:', error);
    throw error; // Re-throw to be caught by checkAuth
  }
}
