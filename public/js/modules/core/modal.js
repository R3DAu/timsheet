/**
 * Modal dialog management
 */

import { destroyQuillEditors } from './quill.js';

// Will be set by location-autocomplete module to avoid circular dependency
let destroyAutocompletes = null;

/**
 * Register the destroyAutocompletes function from location-autocomplete module
 * @param {Function} fn - destroyAutocompletes function
 */
export function registerAutocompleteCleanup(fn) {
  destroyAutocompletes = fn;
}

/**
 * Show modal with raw HTML content
 * @param {string} html - HTML content to display
 */
export function showModalWithHTML(html) {
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modalBody');

  modalBody.innerHTML = html;
  modal.style.display = 'block';
}

/**
 * Show modal with a title and form
 * @param {string} title - Modal title
 * @param {string} form - Form HTML
 */
export function showModalWithForm(title, form) {
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modalBody');

  modal.style.display = 'block';
  modalBody.innerHTML = `<h2>${title}</h2>${form}`;
}

/**
 * Hide the modal and clean up editors/autocompletes
 */
export function hideModal() {
  document.getElementById('modal').style.display = 'none';
  destroyQuillEditors();

  // Clean up autocompletes if the function is registered
  if (destroyAutocompletes) {
    destroyAutocompletes();
  }
}
