/**
 * Centralized application state management
 * Replaces global variables with a reactive state store
 */

class AppState {
  constructor() {
    this._state = {
      currentUser: null,
      companies: [],
      roles: [],
      employees: [],
      timesheets: [],
      myTimesheets: [],
      allTimesheets: [],
      users: [],
      apiKeys: []
    };
    this._listeners = {};
  }

  /**
   * Get a state value
   * @param {string} key - State key
   * @returns {*} - State value
   */
  get(key) {
    return this._state[key];
  }

  /**
   * Set a state value and notify listeners
   * @param {string} key - State key
   * @param {*} value - New value
   */
  set(key, value) {
    this._state[key] = value;
    this._notify(key, value);
  }

  /**
   * Register a change listener for a state key
   * @param {string} key - State key to watch
   * @param {Function} callback - Callback function(value)
   * @returns {Function} - Unsubscribe function
   */
  onChange(key, callback) {
    if (!this._listeners[key]) {
      this._listeners[key] = [];
    }
    this._listeners[key].push(callback);

    // Return unsubscribe function
    return () => {
      this._listeners[key] = this._listeners[key].filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all listeners for a state key
   * @param {string} key - State key
   * @param {*} value - New value
   * @private
   */
  _notify(key, value) {
    const listeners = this._listeners[key] || [];
    listeners.forEach(cb => cb(value));
  }

  /**
   * Get all state (for debugging)
   * @returns {Object} - Complete state object
   */
  getAll() {
    return { ...this._state };
  }
}

// Export singleton instance
export const state = new AppState();
