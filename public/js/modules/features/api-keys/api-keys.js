/**
 * API Keys management module
 */

import { api } from '../../core/api.js';
import { state } from '../../core/state.js';
import { showModalWithForm, hideModal } from '../../core/modal.js';
import { showAlert, showConfirmation } from '../../core/alerts.js';
import { escapeHtml } from '../../core/dom.js';
import { registerTabHook } from '../../core/navigation.js';

/**
 * Load API keys from the server
 */
export async function loadApiKeys() {
  try {
    const result = await api.get('/api-keys');
    state.set('apiKeys', result.apiKeys);
    if (document.getElementById('apiKeysTab').classList.contains('active')) {
      displayApiKeys();
    }
  } catch (error) {
    console.error('Load API keys error:', error);
  }
}

/**
 * Display API keys list with XSS protection
 */
export function displayApiKeys() {
  const apiKeys = state.get('apiKeys');
  const container = document.getElementById('apiKeysList');

  if (apiKeys.length === 0) {
    container.innerHTML = '<p>No API keys created yet.</p>';
    return;
  }

  const html = `
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Key Prefix</th>
          <th>Created By</th>
          <th>Last Used</th>
          <th>Expires</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${apiKeys.map(k => `
          <tr>
            <td>${escapeHtml(k.name)}</td>
            <td><code>${escapeHtml(k.keyPrefix)}...</code></td>
            <td>${escapeHtml(k.user.name)}</td>
            <td>${k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}</td>
            <td>${k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : 'Never'}</td>
            <td>
              <span class="status-badge ${k.isActive ? 'status-APPROVED' : 'status-LOCKED'}">${k.isActive ? 'Active' : 'Revoked'}</span>
            </td>
            <td>
              ${k.isActive ? `<button class="btn btn-sm btn-danger" onclick="revokeApiKey(${k.id})">Revoke</button>` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  container.innerHTML = html;
}

/**
 * Create a new API key
 */
export async function createApiKey() {
  const form = `
    <form id="apiKeyForm">
      <div class="form-group">
        <label>Key Name</label>
        <input type="text" name="name" required placeholder="e.g., CI/CD Pipeline">
      </div>
      <div class="form-group">
        <label>Expires (optional)</label>
        <input type="date" name="expiresAt">
      </div>
      <button type="submit" class="btn btn-primary">Create API Key</button>
    </form>
  `;

  showModalWithForm('Create API Key', form);

  document.getElementById('apiKeyForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      const result = await api.post('/api-keys', {
        name: formData.get('name'),
        expiresAt: formData.get('expiresAt') || null
      });

      // Show the key once - XSS protection applied
      const keyDisplay = `
        <div style="margin-bottom: 1rem;">
          <p style="color: #27ae60; font-weight: 600;">API Key created successfully!</p>
          <p><strong>Copy this key now - it will not be shown again:</strong></p>
          <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.5rem;">
            <input type="text" id="newApiKeyValue" value="${escapeHtml(result.apiKey.key)}" readonly
              style="font-family: monospace; flex: 1; padding: 0.5rem; background: #f8f9fa; border: 1px solid #dee2e6;">
            <button type="button" class="btn btn-primary" onclick="copyApiKey()">Copy</button>
          </div>
        </div>
        <button type="button" class="btn btn-secondary" onclick="hideModal(); loadApiKeys();">Done</button>
      `;
      document.getElementById('modalBody').innerHTML = `<h2>API Key Created</h2>${keyDisplay}`;
    } catch (error) {
      showAlert(error.message);
    }
  };
}

/**
 * Copy API key to clipboard
 */
export function copyApiKey() {
  const input = document.getElementById('newApiKeyValue');
  input.select();
  navigator.clipboard.writeText(input.value).then(() => {
    const btn = input.nextElementSibling;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
  });
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(id) {
  if (!await showConfirmation('Are you sure you want to revoke this API key? This cannot be undone.')) return;
  try {
    await api.delete(`/api-keys/${id}`);
    loadApiKeys();
  } catch (error) {
    showAlert(error.message);
  }
}

// Register with navigation system
registerTabHook('apiKeys', loadApiKeys);
