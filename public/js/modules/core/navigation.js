/**
 * Tab navigation and routing
 */

const TAB_STORAGE_KEY = 'ts_active_tab';

const TAB_TITLES = {
  timesheets: 'Timesheets',        // Unified tab
  myTimesheets: 'My Timesheets',   // Legacy (will be removed)
  allTimesheets: 'All Timesheets', // Legacy (will be removed)
  entries: 'Timesheet Entries',    // Legacy (will be removed)
  employees: 'Employees',
  companies: 'Companies',
  roles: 'Roles',
  users: 'Users',
  apiKeys: 'API Keys',
  systemTools: 'System Tools',
  approvals: 'Approvals',
  leaveManagement: 'Leave Requests',
  xeroSetup: 'Xero Setup',
  xeroSyncLogs: 'Xero Sync Logs',
  xeroInvoices: 'LT Invoices',
};

// Tab activation hooks - feature modules register their display functions here
const tabHooks = {};

/**
 * Register a hook to be called when a tab is activated
 * @param {string} tabName - Tab name
 * @param {Function} callback - Function to call when tab is activated
 */
export function registerTabHook(tabName, callback) {
  tabHooks[tabName] = callback;
}

/**
 * Set the navigation title
 * @param {string} tabName - Tab name
 */
export function setNavTitle(tabName) {
  const el = document.getElementById('navPageTitle');
  if (!el) return;
  el.textContent = TAB_TITLES[tabName] || 'Dashboard';
}

/**
 * Get the requested tab from URL hash or localStorage
 * @returns {string|null} - Tab name or null
 */
export function getRequestedTab() {
  const raw = (window.location.hash || '').replace('#', '').trim();
  if (raw) {
    if (raw.startsWith('tab=')) return raw.slice(4);
    return raw;
  }
  try {
    return localStorage.getItem(TAB_STORAGE_KEY);
  } catch (_) {
    return null;
  }
}

/**
 * Set the requested tab in URL hash and localStorage
 * @param {string} tabName - Tab name
 */
export function setRequestedTab(tabName) {
  try {
    localStorage.setItem(TAB_STORAGE_KEY, tabName);
  } catch (_) {}

  const newHash = `tab=${tabName}`;
  if ((window.location.hash || '').replace('#', '') !== newHash) {
    history.replaceState(null, '', `#${newHash}`);
  }
}

/**
 * Check if a tab is available (visible and exists in DOM)
 * @param {string} tabName - Tab name
 * @returns {boolean} - True if tab is available
 */
export function isTabAvailable(tabName) {
  const btn = document.querySelector(`.sidebar .nav-item[data-tab="${tabName}"]`);
  const content = document.getElementById(`${tabName}Tab`);
  if (!btn || !content) return false;
  return btn.style.display !== 'none';
}

/**
 * Activate a tab
 * @param {string} tabName - Tab name
 * @param {Object} options - Options
 * @param {boolean} options.persist - Whether to persist the tab selection
 */
export function activateTab(tabName, { persist = true } = {}) {
  if (!tabName) return;

  const btn = document.querySelector(`.sidebar .nav-item[data-tab="${tabName}"]`);
  const content = document.getElementById(`${tabName}Tab`);
  if (!btn || !content) return;

  // Remove active class from all tabs
  document.querySelectorAll('.sidebar .nav-item[data-tab]').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

  // Add active class to selected tab
  btn.classList.add('active');
  content.classList.add('active');

  setNavTitle(tabName);
  if (persist) setRequestedTab(tabName);

  // Call registered hook for this tab
  if (tabHooks[tabName]) {
    tabHooks[tabName]();
  }
}

/**
 * Initialize navigation system
 * Sets up hashchange listener to keep title in sync with back/forward navigation
 */
export function initNavigation() {
  // Keep title in sync with back/forward navigation
  window.addEventListener('hashchange', () => {
    const requested = getRequestedTab();
    if (requested && isTabAvailable(requested)) {
      activateTab(requested, { persist: true });
    }
  });
}
