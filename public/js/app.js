var App = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // public/js/modules/core/api.js
  var api;
  var init_api = __esm({
    "public/js/modules/core/api.js"() {
      api = {
        /**
         * Make an API call
         * @param {string} endpoint - API endpoint (e.g., '/timesheets')
         * @param {Object} options - Fetch options
         * @returns {Promise<Object>} - Response data
         */
        async call(endpoint, options = {}) {
          const response = await fetch(`/api${endpoint}`, {
            ...options,
            headers: {
              "Content-Type": "application/json",
              ...options.headers
            },
            credentials: "include"
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || "Request failed");
          }
          return data;
        },
        /**
         * GET request
         * @param {string} endpoint - API endpoint
         * @returns {Promise<Object>} - Response data
         */
        get(endpoint) {
          return this.call(endpoint);
        },
        /**
         * POST request
         * @param {string} endpoint - API endpoint
         * @param {Object} body - Request body
         * @returns {Promise<Object>} - Response data
         */
        post(endpoint, body) {
          return this.call(endpoint, {
            method: "POST",
            body: JSON.stringify(body)
          });
        },
        /**
         * PUT request
         * @param {string} endpoint - API endpoint
         * @param {Object} body - Request body
         * @returns {Promise<Object>} - Response data
         */
        put(endpoint, body) {
          return this.call(endpoint, {
            method: "PUT",
            body: JSON.stringify(body)
          });
        },
        /**
         * DELETE request
         * @param {string} endpoint - API endpoint
         * @returns {Promise<Object>} - Response data
         */
        delete(endpoint) {
          return this.call(endpoint, {
            method: "DELETE"
          });
        }
      };
    }
  });

  // public/js/modules/core/state.js
  var AppState, state;
  var init_state = __esm({
    "public/js/modules/core/state.js"() {
      AppState = class {
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
          return () => {
            this._listeners[key] = this._listeners[key].filter((cb) => cb !== callback);
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
          listeners.forEach((cb) => cb(value));
        }
        /**
         * Get all state (for debugging)
         * @returns {Object} - Complete state object
         */
        getAll() {
          return { ...this._state };
        }
      };
      state = new AppState();
    }
  });

  // public/js/modules/core/dom.js
  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  var init_dom = __esm({
    "public/js/modules/core/dom.js"() {
    }
  });

  // public/js/modules/core/alerts.js
  function showAlert(message, type = "info", timeout = 5e3) {
    alert(message);
  }
  function showConfirmation(message, callback) {
    if (!callback || typeof callback !== "function") {
      return confirm(message);
    }
    if (!confirm(message)) return false;
    return callback();
  }
  var init_alerts = __esm({
    "public/js/modules/core/alerts.js"() {
    }
  });

  // public/js/modules/core/quill.js
  function destroyQuillEditors() {
    activeQuillEditors = {};
  }
  var activeQuillEditors;
  var init_quill = __esm({
    "public/js/modules/core/quill.js"() {
      activeQuillEditors = {};
    }
  });

  // public/js/modules/core/modal.js
  function registerAutocompleteCleanup(fn) {
    destroyAutocompletes = fn;
  }
  function showModalWithHTML(html) {
    const modal = document.getElementById("modal");
    const modalBody = document.getElementById("modalBody");
    modalBody.innerHTML = html;
    modal.style.display = "block";
  }
  function showModalWithForm(title, form) {
    const modal = document.getElementById("modal");
    const modalBody = document.getElementById("modalBody");
    modal.style.display = "block";
    modalBody.innerHTML = `<h2>${title}</h2>${form}`;
  }
  function hideModal() {
    document.getElementById("modal").style.display = "none";
    destroyQuillEditors();
    if (destroyAutocompletes) {
      destroyAutocompletes();
    }
  }
  var destroyAutocompletes;
  var init_modal = __esm({
    "public/js/modules/core/modal.js"() {
      init_quill();
      destroyAutocompletes = null;
    }
  });

  // public/js/modules/core/navigation.js
  function registerTabHook(tabName, callback) {
    tabHooks[tabName] = callback;
  }
  function setNavTitle(tabName) {
    const el = document.getElementById("navPageTitle");
    if (!el) return;
    el.textContent = TAB_TITLES[tabName] || "Dashboard";
  }
  function getRequestedTab() {
    const raw = (window.location.hash || "").replace("#", "").trim();
    if (raw) {
      if (raw.startsWith("tab=")) return raw.slice(4);
      return raw;
    }
    try {
      return localStorage.getItem(TAB_STORAGE_KEY);
    } catch (_) {
      return null;
    }
  }
  function setRequestedTab(tabName) {
    try {
      localStorage.setItem(TAB_STORAGE_KEY, tabName);
    } catch (_) {
    }
    const newHash = `tab=${tabName}`;
    if ((window.location.hash || "").replace("#", "") !== newHash) {
      history.replaceState(null, "", `#${newHash}`);
    }
  }
  function isTabAvailable(tabName) {
    const btn = document.querySelector(`.sidebar .nav-item[data-tab="${tabName}"]`);
    const content = document.getElementById(`${tabName}Tab`);
    if (!btn || !content) return false;
    return btn.style.display !== "none";
  }
  function activateTab(tabName, { persist = true } = {}) {
    if (!tabName) return;
    const btn = document.querySelector(`.sidebar .nav-item[data-tab="${tabName}"]`);
    const content = document.getElementById(`${tabName}Tab`);
    if (!btn || !content) return;
    document.querySelectorAll(".sidebar .nav-item[data-tab]").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((tc) => tc.classList.remove("active"));
    btn.classList.add("active");
    content.classList.add("active");
    setNavTitle(tabName);
    if (persist) setRequestedTab(tabName);
    if (tabHooks[tabName]) {
      tabHooks[tabName]();
    }
  }
  function initNavigation() {
    window.addEventListener("hashchange", () => {
      const requested = getRequestedTab();
      if (requested && isTabAvailable(requested)) {
        activateTab(requested, { persist: true });
      }
    });
  }
  var TAB_STORAGE_KEY, TAB_TITLES, tabHooks;
  var init_navigation = __esm({
    "public/js/modules/core/navigation.js"() {
      TAB_STORAGE_KEY = "ts_active_tab";
      TAB_TITLES = {
        myTimesheets: "My Timesheets",
        allTimesheets: "All Timesheets",
        entries: "Timesheet Entries",
        employees: "Employees",
        companies: "Companies",
        roles: "Roles",
        users: "Users",
        apiKeys: "API Keys"
      };
      tabHooks = {};
    }
  });

  // public/js/modules/features/companies/companies.js
  var companies_exports = {};
  __export(companies_exports, {
    createCompany: () => createCompany,
    deleteCompany: () => deleteCompany,
    displayCompanies: () => displayCompanies,
    editCompany: () => editCompany,
    loadCompanies: () => loadCompanies
  });
  async function loadCompanies() {
    try {
      const result = await api.get("/companies");
      state.set("companies", result.companies);
      if (document.getElementById("companiesTab").classList.contains("active")) {
        displayCompanies();
      }
    } catch (error) {
      console.error("Load companies error:", error);
    }
  }
  function displayCompanies() {
    const companies = state.get("companies");
    const container = document.getElementById("companiesList");
    if (companies.length === 0) {
      container.innerHTML = "<p>No companies found. Add your first company.</p>";
      return;
    }
    const html = `
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Billable</th>
          <th>WMS Sync</th>
          <th>Roles</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${companies.map((c) => `
          <tr>
            <td>${escapeHtml(c.name)}</td>
            <td>${c.isBillable ? "Yes" : "No"}</td>
            <td>${c.wmsSyncEnabled ? "Yes" : "No"}</td>
            <td>${c._count.roles}</td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="editCompany(${c.id})">Edit</button>
              <button class="btn btn-sm btn-danger" onclick="deleteCompany(${c.id})">Delete</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
    container.innerHTML = html;
  }
  async function createCompany() {
    const form = `
    <form id="companyForm">
      <div class="form-group">
        <label>Company Name</label>
        <input type="text" name="name" required>
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" name="isBillable" checked>
          <span>Billable</span>
        </label>
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" name="wmsSyncEnabled">
          <span>Allow DE WMS Timesheet Sync</span>
        </label>
      </div>
      <button type="submit" class="btn btn-primary">Create Company</button>
    </form>
  `;
    showModalWithForm("Add Company", form);
    document.getElementById("companyForm").onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      try {
        await api.post("/companies", {
          name: formData.get("name"),
          isBillable: formData.has("isBillable"),
          wmsSyncEnabled: formData.has("wmsSyncEnabled")
        });
        hideModal();
        await loadCompanies();
        displayCompanies();
      } catch (error) {
        showAlert(error.message);
      }
    };
  }
  async function editCompany(id) {
    const companies = state.get("companies");
    const company = companies.find((c) => c.id === id);
    if (!company) return;
    const form = `
    <form id="editCompanyForm">
      <div class="form-group">
        <label>Company Name</label>
        <input type="text" name="name" value="${escapeHtml(company.name)}" required>
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" name="isBillable" ${company.isBillable ? "checked" : ""}>
          <span>Billable</span>
        </label>
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" name="wmsSyncEnabled" ${company.wmsSyncEnabled ? "checked" : ""}>
          <span>Allow DE WMS Timesheet Sync</span>
        </label>
      </div>
      <button type="submit" class="btn btn-primary">Save Changes</button>
    </form>
  `;
    showModalWithForm("Edit Company", form);
    document.getElementById("editCompanyForm").onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      try {
        await api.put(`/companies/${id}`, {
          name: formData.get("name"),
          isBillable: formData.has("isBillable"),
          wmsSyncEnabled: formData.has("wmsSyncEnabled")
        });
        hideModal();
        await loadCompanies();
        displayCompanies();
      } catch (error) {
        showAlert(error.message);
      }
    };
  }
  async function deleteCompany(id) {
    if (!showConfirmation("Delete this company? This will also delete all associated roles.")) return;
    try {
      await api.delete(`/companies/${id}`);
      await loadCompanies();
      displayCompanies();
    } catch (error) {
      showAlert(error.message);
    }
  }
  var init_companies = __esm({
    "public/js/modules/features/companies/companies.js"() {
      init_api();
      init_state();
      init_modal();
      init_alerts();
      init_dom();
      init_navigation();
      registerTabHook("companies", displayCompanies);
    }
  });

  // public/js/modules/features/roles/roles.js
  var roles_exports = {};
  __export(roles_exports, {
    createRole: () => createRole,
    deleteRole: () => deleteRole,
    displayRoles: () => displayRoles,
    editRole: () => editRole,
    loadRoles: () => loadRoles
  });
  async function loadRoles() {
    try {
      const result = await api.get("/roles");
      state.set("roles", result.roles);
      if (document.getElementById("rolesTab").classList.contains("active")) {
        displayRoles();
      }
    } catch (error) {
      console.error("Load roles error:", error);
    }
  }
  function displayRoles() {
    const roles = state.get("roles");
    const container = document.getElementById("rolesList");
    if (roles.length === 0) {
      container.innerHTML = "<p>No roles found. Add your first role.</p>";
      return;
    }
    const html = `
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Company</th>
          <th>Pay Rate</th>
          <th>Employees</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${roles.map((r) => `
          <tr>
            <td>${escapeHtml(r.name)}</td>
            <td>${escapeHtml(r.company.name)}</td>
            <td>$${r.payRate.toFixed(2)}/hr</td>
            <td>${r._count.employeeRoles}</td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="editRole(${r.id})">Edit</button>
              <button class="btn btn-sm btn-danger" onclick="deleteRole(${r.id})">Delete</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
    container.innerHTML = html;
  }
  async function createRole() {
    const companies = state.get("companies");
    const form = `
    <form id="roleForm">
      <div class="form-group">
        <label>Role Name</label>
        <input type="text" name="name" required placeholder="e.g. Specialist Technician">
      </div>
      <div class="form-group">
        <label>Company</label>
        <select name="companyId" required>
          <option value="">Select company...</option>
          ${companies.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>Pay Rate ($/hr)</label>
        <input type="number" name="payRate" step="0.01" min="0" required>
      </div>
      <button type="submit" class="btn btn-primary">Create Role</button>
    </form>
  `;
    showModalWithForm("Add Role", form);
    document.getElementById("roleForm").onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      try {
        await api.post("/roles", {
          name: formData.get("name"),
          companyId: parseInt(formData.get("companyId")),
          payRate: parseFloat(formData.get("payRate"))
        });
        hideModal();
        await loadRoles();
        displayRoles();
      } catch (error) {
        showAlert(error.message);
      }
    };
  }
  async function editRole(id) {
    const roles = state.get("roles");
    const role = roles.find((r) => r.id === id);
    if (!role) return;
    const form = `
    <form id="editRoleForm">
      <div class="form-group">
        <label>Role Name</label>
        <input type="text" name="name" value="${escapeHtml(role.name)}" required>
      </div>
      <div class="form-group">
        <label>Company</label>
        <select name="companyId" disabled>
          <option>${escapeHtml(role.company.name)}</option>
        </select>
        <small>Company cannot be changed after creation</small>
      </div>
      <div class="form-group">
        <label>Pay Rate ($/hr)</label>
        <input type="number" name="payRate" step="0.01" min="0" value="${role.payRate}" required>
      </div>
      <button type="submit" class="btn btn-primary">Save Changes</button>
    </form>
  `;
    showModalWithForm("Edit Role", form);
    document.getElementById("editRoleForm").onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      try {
        await api.put(`/roles/${id}`, {
          name: formData.get("name"),
          payRate: parseFloat(formData.get("payRate"))
        });
        hideModal();
        await loadRoles();
        displayRoles();
      } catch (error) {
        showAlert(error.message);
      }
    };
  }
  async function deleteRole(id) {
    if (!showConfirmation("Delete this role?")) return;
    try {
      await api.delete(`/roles/${id}`);
      await loadRoles();
      displayRoles();
    } catch (error) {
      showAlert(error.message);
    }
  }
  var init_roles = __esm({
    "public/js/modules/features/roles/roles.js"() {
      init_api();
      init_state();
      init_modal();
      init_alerts();
      init_dom();
      init_navigation();
      registerTabHook("roles", displayRoles);
    }
  });

  // public/js/modules/features/users/users.js
  var users_exports = {};
  __export(users_exports, {
    createUser: () => createUser,
    deleteUser: () => deleteUser,
    displayUsers: () => displayUsers,
    editUser: () => editUser,
    linkProfileToUser: () => linkProfileToUser,
    loadUsers: () => loadUsers
  });
  async function loadUsers() {
    try {
      const result = await api.get("/users");
      state.set("users", result.users);
      if (document.getElementById("usersTab").classList.contains("active")) {
        displayUsers();
      }
    } catch (error) {
      console.error("Load users error:", error);
    }
  }
  function displayUsers() {
    const users = state.get("users");
    const currentUser = state.get("currentUser");
    const container = document.getElementById("usersList");
    if (users.length === 0) {
      container.innerHTML = "<p>No users found.</p>";
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
        ${users.map((u) => `
          <tr>
            <td>${u.id}</td>
            <td>${escapeHtml(u.name)}</td>
            <td>${escapeHtml(u.email)}</td>
            <td>${u.isAdmin ? '<span style="color: #27ae60; font-weight: 600;">Yes</span>' : "No"}</td>
            <td>${u.employee ? `${escapeHtml(u.employee.firstName)} ${escapeHtml(u.employee.lastName)} (ID: ${u.employee.id})` : '<span style="color: #999;">None</span>'}</td>
            <td>${new Date(u.createdAt).toLocaleDateString()}</td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="editUser(${u.id})">Edit</button>
              ${!u.employee ? `<button class="btn btn-sm btn-success user-link-profile-btn"
                data-user-id="${u.id}"
                data-user-name="${escapeHtml(u.name)}"
                data-user-email="${escapeHtml(u.email)}">Link Profile</button>` : ""}
              ${u.id !== currentUser.id ? `<button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})">Delete</button>` : ""}
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
    container.innerHTML = html;
    document.querySelectorAll(".user-link-profile-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        linkProfileToUser(
          parseInt(btn.dataset.userId),
          btn.dataset.userName,
          btn.dataset.userEmail
        );
      });
    });
  }
  async function createUser() {
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
    showModalWithForm("Add System User", form);
    document.getElementById("userForm").onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      try {
        await api.post("/users", {
          name: formData.get("name"),
          email: formData.get("email"),
          password: formData.get("password"),
          isAdmin: formData.has("isAdmin")
        });
        hideModal();
        await loadUsers();
        displayUsers();
      } catch (error) {
        showAlert(error.message);
      }
    };
  }
  async function editUser(id) {
    const users = state.get("users");
    const user = users.find((u) => u.id === id);
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
          <input type="checkbox" name="isAdmin" ${user.isAdmin ? "checked" : ""}>
          <span>Admin User</span>
        </label>
      </div>
      <button type="submit" class="btn btn-primary">Save Changes</button>
    </form>
  `;
    showModalWithForm("Edit User", form);
    document.getElementById("editUserForm").onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = {
        name: formData.get("name"),
        email: formData.get("email"),
        isAdmin: formData.has("isAdmin")
      };
      const password = formData.get("password");
      if (password) data.password = password;
      try {
        await api.put(`/users/${id}`, data);
        hideModal();
        await loadUsers();
        displayUsers();
      } catch (error) {
        showAlert(error.message);
      }
    };
  }
  async function linkProfileToUser(userId, userName, userEmail) {
    const nameParts = userName.split(" ");
    const form = `
    <form id="linkProfileForm">
      <p>Create an employee profile for <strong>${escapeHtml(userName)}</strong> (${escapeHtml(userEmail)})</p>
      <div class="form-group">
        <label>First Name</label>
        <input type="text" name="firstName" value="${escapeHtml(nameParts[0] || "")}" required>
      </div>
      <div class="form-group">
        <label>Last Name</label>
        <input type="text" name="lastName" value="${escapeHtml(nameParts.slice(1).join(" ") || "")}" required>
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
    showModalWithForm("Link Employee Profile", form);
    document.getElementById("linkProfileForm").onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      try {
        await api.post("/employees", {
          userId,
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          email: formData.get("email"),
          phone: formData.get("phone") || null
        });
        hideModal();
        await loadUsers();
        displayUsers();
        const { loadEmployees: loadEmployees2 } = await Promise.resolve().then(() => (init_employees(), employees_exports));
        await loadEmployees2();
      } catch (error) {
        showAlert(error.message);
      }
    };
  }
  async function deleteUser(id) {
    if (!showConfirmation("Delete this user? This cannot be undone.")) return;
    try {
      await api.delete(`/users/${id}`);
      await loadUsers();
      displayUsers();
    } catch (error) {
      showAlert(error.message);
    }
  }
  var init_users = __esm({
    "public/js/modules/features/users/users.js"() {
      init_api();
      init_state();
      init_modal();
      init_alerts();
      init_dom();
      init_navigation();
      registerTabHook("users", displayUsers);
    }
  });

  // public/js/modules/features/employees/employees.js
  var employees_exports = {};
  __export(employees_exports, {
    addIdentifierForm: () => addIdentifierForm,
    assignRoleForm: () => assignRoleForm,
    createEmployee: () => createEmployee,
    deleteEmployee: () => deleteEmployee,
    deleteIdentifier: () => deleteIdentifier,
    displayEmployees: () => displayEmployees,
    editEmployee: () => editEmployee,
    editIdentifierForm: () => editIdentifierForm,
    loadEmployees: () => loadEmployees,
    viewEmployee: () => viewEmployee
  });
  async function loadEmployees() {
    try {
      const result = await api.get("/employees");
      state.set("employees", result.employees);
      if (document.getElementById("employeesTab").classList.contains("active")) {
        displayEmployees();
      }
    } catch (error) {
      console.error("Load employees error:", error);
    }
  }
  function displayEmployees() {
    const employees = state.get("employees");
    const container = document.getElementById("employeesList");
    if (employees.length === 0) {
      container.innerHTML = "<p>No employees found. Add your first employee.</p>";
      return;
    }
    const html = `
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Phone</th>
          <th>Roles</th>
          <th>IDs</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${employees.map((e) => `
          <tr>
            <td>${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</td>
            <td>${escapeHtml(e.email)}</td>
            <td>${escapeHtml(e.phone) || "-"}</td>
            <td>${e.roles.map((r) => `${escapeHtml(r.role.name)} (${escapeHtml(r.company.name)})`).join(", ") || "-"}</td>
            <td>${e.identifiers.length}</td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="viewEmployee(${e.id})">View</button>
              <button class="btn btn-sm btn-primary" onclick="editEmployee(${e.id})">Edit</button>
              <button class="btn btn-sm btn-danger" onclick="deleteEmployee(${e.id})">Delete</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
    container.innerHTML = html;
  }
  async function createEmployee() {
    const users = state.get("users");
    const usersWithoutProfiles = users.filter((u) => !u.employee);
    const form = `
    <form id="employeeForm">
      <div class="form-group">
        <label>Link to User Account</label>
        <select name="userId" required>
          <option value="">Select user...</option>
          ${usersWithoutProfiles.map((u) => `<option value="${u.id}">${escapeHtml(u.name)} (${escapeHtml(u.email)})</option>`).join("")}
        </select>
        ${usersWithoutProfiles.length === 0 ? '<small style="color: #e74c3c;">All users already have profiles. Create a new user first.</small>' : ""}
      </div>
      <div class="form-group">
        <label>First Name</label>
        <input type="text" name="firstName" required>
      </div>
      <div class="form-group">
        <label>Last Name</label>
        <input type="text" name="lastName" required>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email" required>
      </div>
      <div class="form-group">
        <label>Phone</label>
        <input type="tel" name="phone" placeholder="+61400000000">
      </div>
      <button type="submit" class="btn btn-primary">Create Employee</button>
    </form>
  `;
    showModalWithForm("Add Employee", form);
    document.querySelector('#employeeForm select[name="userId"]').onchange = (e) => {
      const userId = parseInt(e.target.value);
      const user = users.find((u) => u.id === userId);
      if (user) {
        const nameParts = user.name.split(" ");
        document.querySelector('#employeeForm input[name="firstName"]').value = nameParts[0] || "";
        document.querySelector('#employeeForm input[name="lastName"]').value = nameParts.slice(1).join(" ") || "";
        document.querySelector('#employeeForm input[name="email"]').value = user.email;
      }
    };
    document.getElementById("employeeForm").onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      try {
        await api.post("/employees", {
          userId: parseInt(formData.get("userId")),
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          email: formData.get("email"),
          phone: formData.get("phone") || null
        });
        hideModal();
        await loadEmployees();
        displayEmployees();
        const { loadUsers: loadUsers2 } = await Promise.resolve().then(() => (init_users(), users_exports));
        await loadUsers2();
      } catch (error) {
        showAlert(error.message);
      }
    };
  }
  async function viewEmployee(id) {
    try {
      const result = await api.get(`/employees/${id}`);
      const emp = result.employee;
      let presetAddresses = null;
      if (emp.presetAddresses) {
        try {
          presetAddresses = typeof emp.presetAddresses === "string" ? JSON.parse(emp.presetAddresses) : emp.presetAddresses;
        } catch (e) {
        }
      }
      const html = `
      <p><strong>Name:</strong> ${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(emp.email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(emp.phone) || "-"}</p>
      <p><strong>Max Daily Hours:</strong> ${emp.maxDailyHours || 16}h</p>
      <p><strong>Linked User:</strong> ${escapeHtml(emp.user.name)} (${escapeHtml(emp.user.email)})</p>

      <h3>Roles</h3>
      ${emp.roles.length > 0 ? `
        <table>
          <thead><tr><th>Role</th><th>Company</th><th>Active</th></tr></thead>
          <tbody>
            ${emp.roles.map((r) => `
              <tr>
                <td>${escapeHtml(r.role.name)}</td>
                <td>${escapeHtml(r.company.name)}</td>
                <td>${r.isActive ? "Yes" : "No"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : "<p>No roles assigned</p>"}

      <h3>Identifiers</h3>
      ${emp.identifiers.length > 0 ? `
        <table>
          <thead><tr><th>Type</th><th>Value</th><th>Company</th><th>Actions</th></tr></thead>
          <tbody>
            ${emp.identifiers.map((i) => `
              <tr>
                <td>${escapeHtml(i.identifierType)}</td>
                <td>${escapeHtml(i.identifierValue)}</td>
                <td>${i.company ? escapeHtml(i.company.name) : "-"}</td>
                <td>
                  <button class="btn btn-sm btn-primary emp-edit-id-btn"
                    data-emp-id="${emp.id}"
                    data-id="${i.id}"
                    data-type="${escapeHtml(i.identifierType)}"
                    data-value="${escapeHtml(i.identifierValue)}"
                    data-company-id="${i.companyId || ""}">Edit</button>
                  <button class="btn btn-sm btn-danger" onclick="deleteIdentifier(${emp.id}, ${i.id})">Delete</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : "<p>No identifiers</p>"}

      ${presetAddresses ? `
        <h3>Preset Addresses</h3>
        <table>
          <thead><tr><th>Label</th><th>Address</th></tr></thead>
          <tbody>
            ${Object.entries(presetAddresses).map(([key, val]) => `
              <tr><td>${escapeHtml(key)}</td><td>${escapeHtml(val)}</td></tr>
            `).join("")}
          </tbody>
        </table>
      ` : ""}

      <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
        <button class="btn btn-sm btn-primary" onclick="addIdentifierForm(${emp.id})">Add Identifier</button>
        <button class="btn btn-sm btn-primary" onclick="assignRoleForm(${emp.id})">Assign Role</button>
      </div>
    `;
      showModalWithForm(`Employee: ${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}`, html);
      document.querySelectorAll(".emp-edit-id-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          editIdentifierForm(
            parseInt(btn.dataset.empId),
            parseInt(btn.dataset.id),
            btn.dataset.type,
            btn.dataset.value,
            btn.dataset.companyId ? parseInt(btn.dataset.companyId) : null
          );
        });
      });
    } catch (error) {
      showAlert(error.message);
    }
  }
  async function editEmployee(id) {
    const employees = state.get("employees");
    const emp = employees.find((e) => e.id === id);
    if (!emp) return;
    const form = `
    <form id="editEmployeeForm">
      <div class="form-group">
        <label>First Name</label>
        <input type="text" name="firstName" value="${escapeHtml(emp.firstName)}" required>
      </div>
      <div class="form-group">
        <label>Last Name</label>
        <input type="text" name="lastName" value="${escapeHtml(emp.lastName)}" required>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email" value="${escapeHtml(emp.email)}" required>
      </div>
      <div class="form-group">
        <label>Phone</label>
        <input type="tel" name="phone" value="${escapeHtml(emp.phone) || ""}">
      </div>
      <div class="form-group">
        <label>Max Daily Hours</label>
        <input type="number" name="maxDailyHours" step="0.5" min="1" max="24" value="${emp.maxDailyHours || 16}">
        <small style="color: #666;">Maximum billable hours per day for this employee</small>
      </div>
      <button type="submit" class="btn btn-primary">Save Changes</button>
    </form>
  `;
    showModalWithForm("Edit Employee", form);
    document.getElementById("editEmployeeForm").onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      try {
        await api.put(`/employees/${id}`, {
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          email: formData.get("email"),
          phone: formData.get("phone") || null,
          maxDailyHours: parseFloat(formData.get("maxDailyHours")) || 16
        });
        hideModal();
        await loadEmployees();
        displayEmployees();
      } catch (error) {
        showAlert(error.message);
      }
    };
  }
  async function deleteEmployee(id) {
    if (!showConfirmation("Delete this employee? This will also delete their timesheets.")) return;
    try {
      await api.delete(`/employees/${id}`);
      await loadEmployees();
      displayEmployees();
      const { loadUsers: loadUsers2 } = await Promise.resolve().then(() => (init_users(), users_exports));
      await loadUsers2();
    } catch (error) {
      showAlert(error.message);
    }
  }
  async function addIdentifierForm(employeeId) {
    const companies = state.get("companies");
    const form = `
    <form id="identifierForm">
      <div class="form-group">
        <label>Identifier Type</label>
        <select name="identifierType" id="addIdType" required>
          <option value="de_worker_id">DE Worker ID</option>
          <option value="payroll">Payroll ID</option>
          <option value="contractor_id">Contractor ID</option>
          <option value="hr_system">HR System ID</option>
          <option value="badge">Badge Number</option>
          <option value="other">Other...</option>
        </select>
      </div>
      <div class="form-group" id="addIdCustomGroup" style="display:none;">
        <label>Custom Type Name</label>
        <input type="text" id="addIdCustomType" placeholder="e.g. tax_file_number">
      </div>
      <div class="form-group">
        <label>Identifier Value</label>
        <input type="text" name="identifierValue" required>
      </div>
      <div class="form-group">
        <label>Company (optional)</label>
        <select name="companyId">
          <option value="">None</option>
          ${companies.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}
        </select>
      </div>
      <button type="submit" class="btn btn-primary">Add Identifier</button>
    </form>
  `;
    showModalWithHTML(form);
    document.getElementById("addIdType").onchange = (e) => {
      const customGroup = document.getElementById("addIdCustomGroup");
      const customInput = document.getElementById("addIdCustomType");
      if (e.target.value === "other") {
        customGroup.style.display = "";
        customInput.required = true;
      } else {
        customGroup.style.display = "none";
        customInput.required = false;
      }
    };
    document.getElementById("identifierForm").onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      let identifierType = formData.get("identifierType");
      if (identifierType === "other") {
        identifierType = document.getElementById("addIdCustomType").value.trim();
        if (!identifierType) {
          showAlert("Please enter a custom type name");
          return;
        }
      }
      try {
        await api.post(`/employees/${employeeId}/identifiers`, {
          identifierType,
          identifierValue: formData.get("identifierValue"),
          companyId: formData.get("companyId") ? parseInt(formData.get("companyId")) : null
        });
        hideModal();
        viewEmployee(employeeId);
      } catch (error) {
        showAlert(error.message);
      }
    };
  }
  async function editIdentifierForm(employeeId, identifierId, type, value, companyId) {
    const companies = state.get("companies");
    const knownTypes = ["de_worker_id", "payroll", "contractor_id", "hr_system", "badge"];
    const isCustomType = !knownTypes.includes(type);
    const form = `
    <form id="editIdentifierForm">
      <div class="form-group">
        <label>Identifier Type</label>
        <select name="identifierType" id="editIdType" required>
          <option value="de_worker_id" ${type === "de_worker_id" ? "selected" : ""}>DE Worker ID</option>
          <option value="payroll" ${type === "payroll" ? "selected" : ""}>Payroll ID</option>
          <option value="contractor_id" ${type === "contractor_id" ? "selected" : ""}>Contractor ID</option>
          <option value="hr_system" ${type === "hr_system" ? "selected" : ""}>HR System ID</option>
          <option value="badge" ${type === "badge" ? "selected" : ""}>Badge Number</option>
          <option value="other" ${isCustomType ? "selected" : ""}>Other...</option>
        </select>
      </div>
      <div class="form-group" id="editIdCustomGroup" style="${isCustomType ? "" : "display:none;"}">
        <label>Custom Type Name</label>
        <input type="text" id="editIdCustomType" value="${escapeHtml(isCustomType ? type : "")}" ${isCustomType ? "required" : ""}>
      </div>
      <div class="form-group">
        <label>Identifier Value</label>
        <input type="text" name="identifierValue" value="${escapeHtml(value)}" required>
      </div>
      <div class="form-group">
        <label>Company (optional)</label>
        <select name="companyId">
          <option value="">None</option>
          ${companies.map((c) => `<option value="${c.id}" ${c.id === companyId ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}
        </select>
      </div>
      <button type="submit" class="btn btn-primary">Save Changes</button>
    </form>
  `;
    showModalWithHTML(form);
    document.getElementById("editIdType").onchange = (e) => {
      const customGroup = document.getElementById("editIdCustomGroup");
      const customInput = document.getElementById("editIdCustomType");
      if (e.target.value === "other") {
        customGroup.style.display = "";
        customInput.required = true;
      } else {
        customGroup.style.display = "none";
        customInput.required = false;
      }
    };
    document.getElementById("editIdentifierForm").onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      let identifierType = formData.get("identifierType");
      if (identifierType === "other") {
        identifierType = document.getElementById("editIdCustomType").value.trim();
        if (!identifierType) {
          showAlert("Please enter a custom type name");
          return;
        }
      }
      try {
        await api.put(`/employees/identifiers/${identifierId}`, {
          identifierType,
          identifierValue: formData.get("identifierValue"),
          companyId: formData.get("companyId") ? parseInt(formData.get("companyId")) : null
        });
        hideModal();
        viewEmployee(employeeId);
      } catch (error) {
        showAlert(error.message);
      }
    };
  }
  async function deleteIdentifier(employeeId, identifierId) {
    if (!showConfirmation("Delete this identifier?")) return;
    try {
      await api.delete(`/employees/identifiers/${identifierId}`);
      viewEmployee(employeeId);
    } catch (error) {
      showAlert(error.message);
    }
  }
  async function assignRoleForm(employeeId) {
    const companies = state.get("companies");
    const roles = state.get("roles");
    const form = `
    <form id="assignRoleForm">
      <div class="form-group">
        <label>Company</label>
        <select name="companyId" id="assignRoleCompanySelect" required>
          <option value="">Select company...</option>
          ${companies.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>Role</label>
        <select name="roleId" id="assignRoleRoleSelect" required>
          <option value="">Select role...</option>
          ${roles.map((r) => `<option value="${r.id}" data-company="${r.company.id}">${escapeHtml(r.name)} - ${escapeHtml(r.company.name)}</option>`).join("")}
        </select>
      </div>
      <button type="submit" class="btn btn-primary">Assign Role</button>
    </form>
  `;
    showModalWithForm("Assign Role to Employee", form);
    document.getElementById("assignRoleCompanySelect").onchange = (e) => {
      const companyId = parseInt(e.target.value);
      const roleSelect = document.getElementById("assignRoleRoleSelect");
      const filteredRoles = companyId ? roles.filter((r) => r.company.id === companyId) : roles;
      roleSelect.innerHTML = '<option value="">Select role...</option>' + filteredRoles.map((r) => `<option value="${r.id}">${escapeHtml(r.name)} - ${escapeHtml(r.company.name)}</option>`).join("");
    };
    document.getElementById("assignRoleForm").onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      try {
        await api.post(`/employees/${employeeId}/roles`, {
          roleId: parseInt(formData.get("roleId")),
          companyId: parseInt(formData.get("companyId"))
        });
        hideModal();
        await loadEmployees();
        viewEmployee(employeeId);
      } catch (error) {
        showAlert(error.message);
      }
    };
  }
  var init_employees = __esm({
    "public/js/modules/features/employees/employees.js"() {
      init_api();
      init_state();
      init_modal();
      init_alerts();
      init_dom();
      init_navigation();
      registerTabHook("employees", displayEmployees);
    }
  });

  // public/js/modules/main.js
  init_api();
  init_state();
  init_dom();
  init_alerts();
  init_modal();
  init_quill();
  init_navigation();

  // public/js/modules/components/location-autocomplete.js
  init_dom();
  init_state();
  init_api();
  init_quill();
  init_modal();
  var activeAutocompletes = [];
  var autocompleteDebounceTimers = {};
  function destroyAutocompletes2() {
    document.querySelectorAll(".location-autocomplete-dropdown").forEach((el) => el.remove());
    activeAutocompletes = [];
    autocompleteDebounceTimers = {};
  }
  registerAutocompleteCleanup(destroyAutocompletes2);
  function removeLocationNote(index) {
    const el = document.getElementById(`locationNote_${index}`);
    if (el) {
      const editorId = `locationEditor_${index}`;
      el.remove();
    }
  }

  // public/js/modules/main.js
  init_companies();
  init_roles();

  // public/js/modules/features/auth/auth.js
  init_api();
  init_state();
  init_dom();
  init_navigation();
  async function login(email, password) {
    try {
      const result = await api.post("/auth/login", { email, password });
      state.set("currentUser", result.user);
      await showMainScreen();
    } catch (error) {
      document.getElementById("loginError").textContent = error.message;
    }
  }
  async function logout() {
    try {
      await api.post("/auth/logout");
      state.set("currentUser", null);
      showLoginScreen();
    } catch (error) {
      console.error("Logout error:", error);
    }
  }
  async function checkAuth() {
    try {
      const result = await api.get("/auth/me");
      state.set("currentUser", result.user);
      await showMainScreen();
    } catch (error) {
      showLoginScreen();
    }
  }
  function showLoginScreen() {
    document.getElementById("loginScreen").style.display = "flex";
    document.getElementById("mainScreen").style.display = "none";
  }
  async function showMainScreen() {
    const currentUser = state.get("currentUser");
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("mainScreen").style.display = "block";
    document.getElementById("userDisplay").textContent = currentUser.name;
    const hasProfile = !!currentUser.employeeId;
    const isAdmin = currentUser.isAdmin;
    const myTimesheetsTabBtn = document.querySelector('[data-tab="myTimesheets"]');
    const allTimesheetsTabBtn = document.querySelector('[data-tab="allTimesheets"]');
    let defaultTabName = "entries";
    if (isAdmin && !hasProfile) {
      myTimesheetsTabBtn.style.display = "none";
      allTimesheetsTabBtn.style.display = "";
      defaultTabName = "allTimesheets";
    } else if (isAdmin && hasProfile) {
      myTimesheetsTabBtn.style.display = "";
      allTimesheetsTabBtn.style.display = "";
      defaultTabName = "myTimesheets";
    } else {
      myTimesheetsTabBtn.style.display = "";
      allTimesheetsTabBtn.style.display = "none";
      defaultTabName = "myTimesheets";
    }
    document.querySelectorAll(".admin-only").forEach((el) => {
      el.style.display = isAdmin ? "" : "none";
    });
    const requested = getRequestedTab();
    const chosen = requested && isTabAvailable(requested) ? requested : defaultTabName;
    activateTab(chosen, { persist: true });
    await loadAllData();
  }
  async function loadAllData() {
    const currentUser = state.get("currentUser");
    const { loadCompanies: loadCompanies2 } = await Promise.resolve().then(() => (init_companies(), companies_exports));
    const { loadRoles: loadRoles2 } = await Promise.resolve().then(() => (init_roles(), roles_exports));
    await Promise.all([
      loadCompanies2(),
      loadRoles2()
    ]);
    if (currentUser.employeeId) {
    }
    if (currentUser.isAdmin) {
      const { loadEmployees: loadEmployees2 } = await Promise.resolve().then(() => (init_employees(), employees_exports));
      const { loadUsers: loadUsers2 } = await Promise.resolve().then(() => (init_users(), users_exports));
      await Promise.all([
        // loadAllTimesheets(), // TODO: implement when timesheets module is ready
        loadEmployees2(),
        loadUsers2()
        // loadApiKeys() // TODO: implement when api-keys module is ready
      ]);
    }
  }

  // public/js/modules/main.js
  init_employees();
  init_users();

  // public/js/modules/features/entries/entry-validation.js
  init_state();

  // public/js/modules/main.js
  Object.assign(window, {
    // Modal functions
    hideModal,
    // Auth
    login,
    logout,
    // Companies
    createCompany,
    editCompany,
    deleteCompany,
    // Roles
    createRole,
    editRole,
    deleteRole,
    // Employees
    createEmployee,
    viewEmployee,
    editEmployee,
    deleteEmployee,
    addIdentifierForm,
    deleteIdentifier,
    assignRoleForm,
    // Users
    createUser,
    editUser,
    linkProfileToUser,
    deleteUser,
    // Location autocomplete
    removeLocationNote
  });
  async function init() {
    console.log("Initializing timesheet application...");
    initNavigation();
    const closeBtn = document.querySelector(".modal .close");
    if (closeBtn) {
      closeBtn.addEventListener("click", hideModal);
    }
    const modal = document.getElementById("modal");
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) hideModal();
      });
    }
    const createCompanyBtn = document.getElementById("createCompanyBtn");
    if (createCompanyBtn) {
      createCompanyBtn.addEventListener("click", () => createCompany());
    }
    const createRoleBtn = document.getElementById("createRoleBtn");
    if (createRoleBtn) {
      createRoleBtn.addEventListener("click", () => createRole());
    }
    const createEmployeeBtn = document.getElementById("createEmployeeBtn");
    if (createEmployeeBtn) {
      createEmployeeBtn.addEventListener("click", () => createEmployee());
    }
    const createUserBtn = document.getElementById("createUserBtn");
    if (createUserBtn) {
      createUserBtn.addEventListener("click", () => createUser());
    }
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("loginEmail").value;
        const password = document.getElementById("loginPassword").value;
        await login(email, password);
      });
    }
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => logout());
    }
    const myProfileBtn = document.getElementById("myProfileBtn");
    if (myProfileBtn) {
      myProfileBtn.addEventListener("click", () => {
        showAlert("Profile functionality coming soon");
      });
    }
    await checkAuth();
    console.log("Application initialized");
  }
  document.addEventListener("DOMContentLoaded", init);
  console.log("Main module loaded");
})();
