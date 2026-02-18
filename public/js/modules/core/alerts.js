/**
 * Alert and confirmation dialogs
 * Toast-style notifications and Promise-based confirmation modals.
 */

// ─── Toast container ──────────────────────────────────────────────────────────

let toastContainer = null;

function getContainer() {
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'info'|'success'|'warning'|'error'} type
 * @param {number} timeout - ms before auto-dismiss (0 = no auto-dismiss)
 */
export function showAlert(message, type = 'info', timeout = 4000) {
  const container = getContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const icon = icons[type] || icons.info;

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-msg">${escapeForToast(message)}</span>
    <button class="toast-close" aria-label="Dismiss">×</button>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => dismissToast(toast));

  container.appendChild(toast);

  // Trigger enter animation on next frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
  });

  if (timeout > 0) {
    setTimeout(() => dismissToast(toast), timeout);
  }
}

/**
 * Show a Promise-based confirmation dialog.
 * Replaces window.confirm() — callers must use `await`.
 * @param {string} message
 * @param {Object} [opts]
 * @param {string} [opts.confirmLabel='Confirm']
 * @param {string} [opts.cancelLabel='Cancel']
 * @param {'danger'|'primary'} [opts.confirmStyle='danger']
 * @returns {Promise<boolean>}
 */
export function showConfirmation(message, opts = {}) {
  const {
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    confirmStyle = 'danger',
  } = opts;

  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';

    overlay.innerHTML = `
      <div class="confirm-dialog" role="dialog" aria-modal="true">
        <p class="confirm-message">${escapeForToast(message)}</p>
        <div class="confirm-actions">
          <button class="btn btn-secondary confirm-cancel">${escapeForToast(cancelLabel)}</button>
          <button class="btn btn-${confirmStyle} confirm-ok">${escapeForToast(confirmLabel)}</button>
        </div>
      </div>
    `;

    const close = (result) => {
      overlay.classList.remove('confirm-visible');
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };

    overlay.querySelector('.confirm-ok').addEventListener('click', () => close(true));
    overlay.querySelector('.confirm-cancel').addEventListener('click', () => close(false));

    // Click outside = cancel
    overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });

    // Escape = cancel
    const onKey = e => { if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(false); } };
    document.addEventListener('keydown', onKey);

    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add('confirm-visible'));
    });

    // Focus confirm button
    overlay.querySelector('.confirm-ok').focus();
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dismissToast(toast) {
  if (toast.classList.contains('toast-leaving')) return;
  toast.classList.add('toast-leaving');
  toast.classList.remove('toast-visible');
  setTimeout(() => toast.remove(), 300);
}

function escapeForToast(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}
