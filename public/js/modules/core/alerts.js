/**
 * Alert and confirmation dialogs
 * Simple implementations using browser native dialogs
 * TODO: Replace with custom modal dialogs in the future
 */

/**
 * Show an alert message
 * @param {string} message - Message to display
 * @param {string} type - Alert type ('info', 'success', 'warning', 'error')
 * @param {number} timeout - Auto-dismiss timeout in milliseconds
 */
export function showAlert(message, type = 'info', timeout = 5000) {
  alert(message);
}

/**
 * Show a confirmation dialog
 * @param {string} message - Message to display
 * @param {Function} callback - Optional callback to execute if confirmed
 * @returns {boolean} - True if confirmed, false otherwise
 */
export function showConfirmation(message, callback) {
  if (!callback || typeof callback !== 'function') {
    return confirm(message);
  }

  if (!confirm(message)) return false;
  return callback();
}
