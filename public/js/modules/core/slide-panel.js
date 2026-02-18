/**
 * Slide-in Panel Component
 * Modern UI pattern for editing forms (replaces modals for entry editing)
 */

import { destroyQuillEditors } from './quill.js';

let destroyAutocompletes = null;

/**
 * Register cleanup function for autocompletes
 * @param {Function} fn - Cleanup function from location-autocomplete module
 */
export function registerPanelAutocompleteCleanup(fn) {
  destroyAutocompletes = fn;
}

/**
 * Show the slide-in panel with content
 * @param {string} title - Panel title
 * @param {string} bodyHtml - HTML content for panel body
 * @param {Object} [options={}] - Options
 * @param {boolean} [options.wide] - If true, use wider panel layout
 */
export function showSlidePanel(title, bodyHtml, options = {}) {
  const overlay = document.getElementById('slidePanel');
  const titleEl = document.getElementById('slidePanelTitle');
  const bodyEl = document.getElementById('slidePanelBody');
  const panel = overlay.querySelector('.slide-panel');

  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHtml;

  if (options.wide) {
    panel.classList.add('wide');
  }

  overlay.style.display = 'block';
  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });
}

/**
 * Hide the slide-in panel and cleanup
 */
export function hideSlidePanel() {
  const overlay = document.getElementById('slidePanel');
  const panel = overlay.querySelector('.slide-panel');
  overlay.classList.remove('active');

  setTimeout(() => {
    overlay.style.display = 'none';
    panel.classList.remove('wide');
    document.getElementById('slidePanelBody').innerHTML = '';
    destroyQuillEditors();
    if (destroyAutocompletes) destroyAutocompletes();
  }, 300);
}

/**
 * Initialize slide-in panel event listeners
 */
export function initSlidePanel() {
  const closeBtn = document.getElementById('slidePanelClose');
  const overlay = document.getElementById('slidePanel');

  if (closeBtn) {
    closeBtn.addEventListener('click', hideSlidePanel);
  }

  // Removed: Don't close on outside click - user must use close button
  // if (overlay) {
  //   overlay.addEventListener('click', (e) => {
  //     if (e.target === overlay) hideSlidePanel();
  //   });
  // }

  console.log('Slide-in panel initialized');
}
