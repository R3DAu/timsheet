/**
 * User management module
 * CRITICAL XSS FIXES: Fixed onclick injection vulnerability at line 2364
 */

import { api } from '../../core/api.js';
import { state } from '../../core/state.js';
import { showSlidePanel, hideSlidePanel } from '../../core/slide-panel.js';
import { showAlert, showConfirmation } from '../../core/alerts.js';
import { escapeHtml } from '../../core/dom.js';
import { registerTabHook } from '../../core/navigation.js';

/**
 * Load users from API
 */
export async function loadUsers() {
  try {
    const result = await api.get('/users');
    state.set('users', result.users);
    if (document.getElementById('usersTab').classList.contains('active')) {
      displayUsers();
    }
  } catch (error) {
    console.error('Load users error:', error);
  }
}

/**
 * Display users list with XSS protection
 * CRITICAL XSS FIX: Changed onclick to data attributes for linkProfileToUser button
 */
export function displayUsers() {
  const users = state.get('users');
  const currentUser = state.get('currentUser');
  const container = document.getElementById('usersList');

  if (users.length === 0) {
    container.innerHTML = '<p>No users found.</p>';
    return;
  }

  const html = `
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Email</th>
          <th>Admin</th>
          <th>Employee Profile</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(u => `
          <tr>
            <td>${u.id}</td>
            <td>${escapeHtml(u.name)}</td>
            <td>${escapeHtml(u.email)}</td>
            <td>${u.isAdmin ? '<span style="color: #27ae60; font-weight: 600;">Yes</span>' : 'No'}</td>
            <td>${u.employee ? `${escapeHtml(u.employee.firstName)} ${escapeHtml(u.employee.lastName)} (ID: ${u.employee.id})` : '<span style="color: #999;">None</span>'}</td>
            <td>${new Date(u.createdAt).toLocaleDateString()}</td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="editUser(${u.id})">Edit</button>
              ${!u.employee ? `<button class="btn btn-sm btn-success user-link-profile-btn"
                data-user-id="${u.id}"
                data-user-name="${escapeHtml(u.name)}"
                data-user-email="${escapeHtml(u.email)}">Link Profile</button>` : ''}
              ${u.id !== currentUser.id ? `<button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})">Delete</button>` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  container.innerHTML = html;

  // CRITICAL XSS FIX: Event delegation for link profile buttons (replaces onclick injection)
  document.querySelectorAll('.user-link-profile-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      linkProfileToUser(
        parseInt(btn.dataset.userId),
        btn.dataset.userName,
        btn.dataset.userEmail
      );
    });
  });
}

/**
 * Create a new user
 */
export async function createUser() {
  const form = `
    <form id="userForm">
      <div class="form-group">
        <label>Name</label>
        <input type="text" name="name" required>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email" required>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" name="password" required minlength="6">
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" name="isAdmin">
          <span>Admin User</span>
        </label>
      </div>
      <button type="submit" class="btn btn-primary">Create User</button>
    </form>
  `;

  showSlidePanel('Add System User', form);

  document.getElementById('userForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await api.post('/users', {
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
        isAdmin: formData.has('isAdmin')
      });
      hideSlidePanel();
      await loadUsers();
      displayUsers();
    } catch (error) {
      showAlert(error.message);
    }
  };
}

/**
 * Edit a user
 */
export async function editUser(id) {
  const users = state.get('users');
  const user = users.find(u => u.id === id);
  if (!user) return;

  const form = `
    <form id="editUserForm">
      <div class="form-group">
        <label>Name</label>
        <input type="text" name="name" value="${escapeHtml(user.name)}" required>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email" value="${escapeHtml(user.email)}" required>
      </div>
      <div class="form-group">
        <label>New Password (leave blank to keep current)</label>
        <input type="password" name="password" minlength="6">
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" name="isAdmin" ${user.isAdmin ? 'checked' : ''}>
          <span>Admin User</span>
        </label>
      </div>
      <button type="submit" class="btn btn-primary">Save Changes</button>
    </form>
  `;

  showSlidePanel('Edit User', form);

  document.getElementById('editUserForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      isAdmin: formData.has('isAdmin')
    };
    const password = formData.get('password');
    if (password) data.password = password;

    try {
      await api.put(`/users/${id}`, data);
      hideSlidePanel();
      await loadUsers();
      displayUsers();
    } catch (error) {
      showAlert(error.message);
    }
  };
}

/**
 * Link employee profile to user
 * CRITICAL XSS FIX: Parameters now safely passed via data attributes
 */
export async function linkProfileToUser(userId, userName, userEmail) {
  const nameParts = userName.split(' ');

  const form = `
    <form id="linkProfileForm">
      <p>Create an employee profile for <strong>${escapeHtml(userName)}</strong> (${escapeHtml(userEmail)})</p>
      <div class="form-group">
        <label>First Name</label>
        <input type="text" name="firstName" value="${escapeHtml(nameParts[0] || '')}" required>
      </div>
      <div class="form-group">
        <label>Last Name</label>
        <input type="text" name="lastName" value="${escapeHtml(nameParts.slice(1).join(' ') || '')}" required>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email" value="${escapeHtml(userEmail)}" required>
      </div>
      <div class="form-group">
        <label>Phone</label>
        <input type="tel" name="phone" placeholder="+61400000000">
      </div>
      <button type="submit" class="btn btn-primary">Create Profile</button>
    </form>
  `;

  showSlidePanel('Link Employee Profile', form);

  document.getElementById('linkProfileForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await api.post('/employees', {
        userId: userId,
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email'),
        phone: formData.get('phone') || null
      });
      hideSlidePanel();
      await loadUsers();
      displayUsers();
      const { loadEmployees } = await import('../employees/employees.js');
      await loadEmployees();
    } catch (error) {
      showAlert(error.message);
    }
  };
}

/**
 * Delete a user
 */
export async function deleteUser(id) {
  if (!await showConfirmation('Delete this user? This cannot be undone.')) return;

  try {
    await api.delete(`/users/${id}`);
    await loadUsers();
    displayUsers();
  } catch (error) {
    showAlert(error.message);
  }
}

// Register tab hook
registerTabHook('users', displayUsers);
