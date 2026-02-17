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
            apiKeys: [],
            selectedEmployeeId: null,
            // For admin employee selector
            accordionOpen: {},
            // Track open accordion items
            dateAccordionOpen: {}
            // Track open date accordion items
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
  function sanitizeRichText(html) {
    if (!html) return "";
    if (typeof DOMPurify === "undefined") {
      console.error("DOMPurify is not loaded");
      return escapeHtml(html);
    }
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "ol", "ul", "li", "a"],
      ALLOWED_ATTR: ["href", "target", "rel"]
    });
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
  function initQuillEditor(containerId, placeholder) {
    const editor = new Quill(`#${containerId}`, {
      theme: "snow",
      placeholder: placeholder || "Enter details...",
      modules: {
        toolbar: [
          ["bold", "italic", "underline"],
          [{ "list": "ordered" }, { "list": "bullet" }],
          ["link"],
          ["clean"]
        ]
      }
    });
    activeQuillEditors[containerId] = editor;
    return editor;
  }
  function destroyQuillEditors() {
    activeQuillEditors = {};
  }
  function quillGetHtml(editor) {
    if (!editor) return "";
    const html = editor.root.innerHTML || "";
    return html.trim() === "<p><br></p>" ? "" : html;
  }
  function getQuillEditor(containerId) {
    return activeQuillEditors[containerId];
  }
  var activeQuillEditors;
  var init_quill = __esm({
    "public/js/modules/core/quill.js"() {
      activeQuillEditors = {};
    }
  });

  // public/js/modules/core/modal.js
  var modal_exports = {};
  __export(modal_exports, {
    hideModal: () => hideModal,
    registerAutocompleteCleanup: () => registerAutocompleteCleanup,
    showModalWithForm: () => showModalWithForm,
    showModalWithHTML: () => showModalWithHTML
  });
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
        timesheets: "Timesheets",
        // Unified tab
        myTimesheets: "My Timesheets",
        // Legacy (will be removed)
        allTimesheets: "All Timesheets",
        // Legacy (will be removed)
        entries: "Timesheet Entries",
        // Legacy (will be removed)
        employees: "Employees",
        companies: "Companies",
        roles: "Roles",
        users: "Users",
        apiKeys: "API Keys",
        systemTools: "System Tools"
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

  // public/js/modules/core/dateTime.js
  function formatLocalDate(date) {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  function formatTime(timeStr) {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${m} ${ampm}`;
  }
  function calculateHoursPreview(startTime, endTime) {
    if (!startTime || !endTime) return "";
    const [sH, sM] = startTime.split(":").map(Number);
    const [eH, eM] = endTime.split(":").map(Number);
    let startMins = sH * 60 + sM;
    let endMins = eH * 60 + eM;
    if (endMins <= startMins) endMins += 24 * 60;
    const hours = (endMins - startMins) / 60;
    return `${hours.toFixed(2)} hrs`;
  }
  function todayStr() {
    return formatLocalDate(/* @__PURE__ */ new Date());
  }
  function getTimeDefaults(timesheetId) {
    const myTimesheets = state.get("myTimesheets");
    const allTimesheets = state.get("allTimesheets");
    const currentUser2 = state.get("currentUser");
    const ts = [...myTimesheets, ...allTimesheets].find((t) => t.id === parseInt(timesheetId));
    const today = todayStr();
    let todayEntryCount = 0;
    if (ts && ts.entries) {
      todayEntryCount = ts.entries.filter((e) => {
        const d = formatLocalDate(e.date);
        return d === today;
      }).length;
    }
    const emp = currentUser2 && currentUser2.employee;
    const morning = {
      start: emp ? emp.morningStart : "08:30",
      end: emp ? emp.morningEnd : "12:30"
    };
    const afternoon = {
      start: emp ? emp.afternoonStart : "13:00",
      end: emp ? emp.afternoonEnd : "17:00"
    };
    if (todayEntryCount === 0) return morning;
    if (todayEntryCount === 1) return afternoon;
    return { start: "", end: "" };
  }
  var init_dateTime = __esm({
    "public/js/modules/core/dateTime.js"() {
      init_state();
    }
  });

  // public/js/modules/features/wms/wms-sync.js
  function employeeHasWmsSyncRole(employee) {
    if (!employee || !employee.roles) return false;
    return employee.roles.some(
      (r) => r.company && r.company.wmsSyncEnabled
    );
  }
  function timesheetHasWmsSyncEntries(ts) {
    if (!ts.entries || ts.entries.length === 0) return false;
    return ts.entries.some(
      (e) => e.company && e.company.wmsSyncEnabled
    );
  }
  function getWmsSyncButton(ts) {
    const currentUser2 = state.get("currentUser");
    const isOwnTimesheet = currentUser2 && currentUser2.employeeId && ts.employee && ts.employee.id === currentUser2.employeeId;
    if (isOwnTimesheet) {
      const emp = currentUser2.employee;
      if (!emp || !employeeHasWmsSyncRole(emp)) {
        return "";
      }
    }
    const hasWmsEntries = timesheetHasWmsSyncEntries(ts);
    if (!hasWmsEntries) {
      if (isOwnTimesheet) {
        return `<button class="btn btn-sm btn-info" disabled title="No WMS-syncable entries to sync" style="opacity: 0.5; cursor: not-allowed;">Sync to WMS</button>`;
      }
      return "";
    }
    return `<button class="btn btn-sm btn-info" onclick="syncToWms(${ts.id})">Sync to WMS</button>`;
  }
  async function syncToWms(timesheetId) {
    const html = `
    <h3>Sync to DE WMS (TSSP)</h3>
    <div class="alert alert-info">
      Enter your DE (ADFS) login credentials. These are <strong>not stored</strong> on our servers and are only used for this sync session. Your employee profile must have a <strong>DE Worker ID</strong> identifier configured.
    </div>
    <form id="wmsSyncForm">
      <div class="form-group">
        <label>ADFS Username (e.g. domain\\username or email)</label>
        <input type="text" name="wmsUsername" required autocomplete="off" placeholder="EDUCATION\\jsmith or jsmith@education.vic.gov.au">
      </div>
      <div class="form-group">
        <label>ADFS Password</label>
        <input type="password" name="wmsPassword" required autocomplete="off">
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="wmsSyncShowPw">
          <span>Show password</span>
        </label>
      </div>
      <button type="submit" class="btn btn-primary">Start Sync</button>
      <button type="button" class="btn btn-secondary" onclick="hideModal()">Cancel</button>
    </form>
  `;
    showModalWithHTML(html);
    document.getElementById("wmsSyncShowPw").onchange = (e) => {
      const pwInput = document.querySelector('#modalBody input[name="wmsPassword"]');
      pwInput.type = e.target.checked ? "text" : "password";
    };
    document.getElementById("wmsSyncForm").onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target;
      const credentials = {
        username: form.wmsUsername.value,
        password: form.wmsPassword.value
      };
      form.wmsPassword.value = "";
      try {
        const result = await api.post("/wms-sync/start", {
          timesheetId,
          credentials
        });
        showSyncProgress(result.syncLog.id);
      } catch (error) {
        showAlert("Failed to start sync: " + error.message);
      }
    };
  }
  function showSyncProgress(syncLogId) {
    const html = `
    <h3>WMS Sync Progress</h3>
    <div class="sync-progress">
      <div class="alert alert-info" id="syncProgressAlert">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div class="sync-spinner" id="syncSpinner"></div>
          <span id="syncProgressMessage">Initialising sync...</span>
        </div>
      </div>
      <div id="syncProgressLog" style="background: #1a1a2e; border-radius: 6px; padding: 0.75rem; margin: 0.75rem 0; max-height: 200px; overflow-y: auto; font-family: monospace; font-size: 0.85rem; line-height: 1.6;"></div>
      <div id="syncResultDetails"></div>
    </div>
    <button type="button" class="btn btn-secondary" onclick="hideModal()">Close</button>
  `;
    showModalWithHTML(html);
    pollSyncStatus(syncLogId);
  }
  function pollSyncStatus(syncLogId) {
    let attempts = 0;
    const maxAttempts = 120;
    let lastProgressCount = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const result = await api.get("/wms-sync/status/" + syncLogId);
        const log = result.syncLog;
        const alertEl = document.getElementById("syncProgressAlert");
        const messageEl = document.getElementById("syncProgressMessage");
        const spinnerEl = document.getElementById("syncSpinner");
        const logEl = document.getElementById("syncProgressLog");
        const detailsEl = document.getElementById("syncResultDetails");
        if (!alertEl) {
          clearInterval(interval);
          return;
        }
        if (log.progress && log.progress.length > lastProgressCount) {
          for (let i = lastProgressCount; i < log.progress.length; i++) {
            const p = log.progress[i];
            const line = document.createElement("div");
            const isSaved = p.message.includes("Saved ");
            const isError = p.message.includes("Error") || p.message.includes("Failed");
            const isSkipped = p.message.includes("Skipped");
            const color = isError ? "#ff6b6b" : isSkipped ? "#ffd93d" : isSaved ? "#6bcb77" : "#a8b2d1";
            line.style.color = color;
            line.textContent = p.message;
            logEl.appendChild(line);
          }
          logEl.scrollTop = logEl.scrollHeight;
          lastProgressCount = log.progress.length;
          const latest = log.progress[log.progress.length - 1];
          if (latest && messageEl) {
            messageEl.textContent = latest.message;
          }
        }
        if (log.status === "COMPLETED") {
          clearInterval(interval);
          if (spinnerEl) spinnerEl.style.display = "none";
          if (log.syncDetails) {
            try {
              const details = JSON.parse(log.syncDetails);
              const fillStep = details.steps && details.steps.find((s) => s.step === "fillEntries");
              const entered = fillStep ? fillStep.entriesEntered || 0 : details.entriesSynced || 0;
              const failed = fillStep ? fillStep.entriesFailed || 0 : 0;
              const skipped = fillStep ? fillStep.entriesSkipped || 0 : 0;
              const entries = fillStep ? fillStep.entries || [] : [];
              if (failed > 0 && entered === 0) {
                alertEl.className = "alert alert-danger";
                alertEl.innerHTML = "<strong>Sync completed with errors \u2014 no entries were saved.</strong>";
              } else if (failed > 0) {
                alertEl.className = "alert alert-warning";
                alertEl.innerHTML = `<strong>Sync completed with ${failed} error(s).</strong>`;
              } else {
                alertEl.className = "alert alert-success";
                alertEl.innerHTML = "<strong>Timesheet synced to DE WMS successfully!</strong>";
              }
              let summary = `Entries synced: ${entered}`;
              if (failed > 0) summary += ` | Failed: ${failed}`;
              if (skipped > 0) summary += ` | Skipped: ${skipped}`;
              summary += ` | Total hours: ${(details.totalHours || 0).toFixed(2)}`;
              let errorDetails = "";
              const failedEntries = entries.filter((e) => e.status === "failed");
              if (failedEntries.length > 0) {
                errorDetails = '<ul style="margin: 0.5rem 0 0; padding-left: 1.25rem; color: #ff6b6b;">';
                failedEntries.forEach((e) => {
                  errorDetails += `<li>${escapeHtml(e.date)} ${escapeHtml(e.startTime || "")}-${escapeHtml(e.endTime || "")}: ${escapeHtml(e.error)}</li>`;
                });
                errorDetails += "</ul>";
              }
              detailsEl.innerHTML = `<p style="margin-top: 0.5rem;">${escapeHtml(summary)}</p>${errorDetails}`;
            } catch (_) {
              alertEl.className = "alert alert-success";
              alertEl.innerHTML = "<strong>Timesheet synced to DE WMS successfully!</strong>";
            }
          } else {
            alertEl.className = "alert alert-success";
            alertEl.innerHTML = "<strong>Timesheet synced to DE WMS successfully!</strong>";
          }
          refreshTimesheets();
        } else if (log.status === "FAILED") {
          clearInterval(interval);
          if (spinnerEl) spinnerEl.style.display = "none";
          alertEl.className = "alert alert-danger";
          alertEl.innerHTML = "<strong>Sync failed:</strong> " + escapeHtml(log.errorMessage || "Unknown error");
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          if (spinnerEl) spinnerEl.style.display = "none";
          alertEl.className = "alert alert-warning";
          alertEl.innerHTML = "Sync is taking longer than expected. Check sync history later.";
        }
      } catch (error) {
        console.error("Poll error:", error);
      }
    }, 2e3);
  }
  async function viewSyncHistory(timesheetId) {
    try {
      const result = await api.get("/wms-sync/timesheet/" + timesheetId);
      const syncs = result.syncs;
      if (syncs.length === 0) {
        showModalWithHTML("<h3>Sync History</h3><p>No sync history for this timesheet.</p>");
        return;
      }
      const rows = syncs.map((sync) => {
        const started = sync.startedAt ? new Date(sync.startedAt).toLocaleString() : new Date(sync.createdAt).toLocaleString();
        const duration = sync.startedAt && sync.completedAt ? Math.round((new Date(sync.completedAt) - new Date(sync.startedAt)) / 1e3) + "s" : "-";
        return `
        <tr>
          <td>${started}</td>
          <td><span class="status-badge status-${sync.status}">${sync.status}</span></td>
          <td>${escapeHtml(sync.wmsUsername) || "-"}</td>
          <td>${duration}</td>
          <td>${sync.errorMessage ? escapeHtml(sync.errorMessage) : sync.status === "COMPLETED" ? "OK" : "-"}</td>
        </tr>
      `;
      }).join("");
      const html = `
      <h3>Sync History</h3>
      <div class="table-responsive">
        <table>
          <thead>
            <tr><th>Started</th><th>Status</th><th>WMS User</th><th>Duration</th><th>Result</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
      showModalWithHTML(html);
    } catch (error) {
      showAlert("Failed to load sync history: " + error.message);
    }
  }
  async function refreshTimesheets() {
    const currentUser2 = state.get("currentUser");
    const { loadMyTimesheets: loadMyTimesheets2 } = await Promise.resolve().then(() => (init_timesheets(), timesheets_exports));
    if (currentUser2.employeeId) {
      await loadMyTimesheets2();
    }
    if (currentUser2.isAdmin) {
      const { loadAllTimesheets: loadAllTimesheets2 } = await Promise.resolve().then(() => (init_timesheets(), timesheets_exports));
      await loadAllTimesheets2();
    }
  }
  var init_wms_sync = __esm({
    "public/js/modules/features/wms/wms-sync.js"() {
      init_api();
      init_state();
      init_modal();
      init_alerts();
      init_dom();
    }
  });

  // public/js/modules/features/timesheets/timesheets.js
  var timesheets_exports = {};
  __export(timesheets_exports, {
    approveTimesheet: () => approveTimesheet,
    autoCreateTimesheets: () => autoCreateTimesheets,
    combineTimesheetsAndDedupe: () => combineTimesheetsAndDedupe,
    createTimesheet: () => createTimesheet,
    deleteTimesheet: () => deleteTimesheet,
    displayAllTimesheets: () => displayAllTimesheets,
    displayMyTimesheets: () => displayMyTimesheets,
    displayUnifiedTimesheets: () => displayUnifiedTimesheets,
    initEmployeeSelector: () => initEmployeeSelector,
    loadAllTimesheets: () => loadAllTimesheets,
    loadMyTimesheets: () => loadMyTimesheets,
    lockTimesheet: () => lockTimesheet,
    populateTimeSheetSelect: () => populateTimeSheetSelect,
    refreshTimesheets: () => refreshTimesheets2,
    selectEmployee: () => selectEmployee,
    submitTimesheet: () => submitTimesheet,
    toggleAccordion: () => toggleAccordion,
    toggleDateAccordion: () => toggleDateAccordion,
    unlockTimesheet: () => unlockTimesheet
  });
  async function loadMyTimesheets() {
    const currentUser2 = state.get("currentUser");
    const result = await api.get(`/timesheets?employeeId=${currentUser2.employeeId}`);
    state.set("myTimesheets", result.timesheets);
    await combineTimesheetsAndDedupe();
    await autoCreateTimesheets();
    const updatedResult = await api.get(`/timesheets?employeeId=${currentUser2.employeeId}`);
    state.set("myTimesheets", updatedResult.timesheets);
    await combineTimesheetsAndDedupe();
    displayUnifiedTimesheets();
  }
  async function loadAllTimesheets() {
    const result = await api.get("/timesheets");
    state.set("allTimesheets", result.timesheets);
    await combineTimesheetsAndDedupe();
    displayAllTimesheets();
  }
  async function populateTimeSheetSelect() {
    const select = document.getElementById("timesheetSelect");
    let timesheets = state.get("timesheets");
    select.innerHTML = '<option value="">Select a timesheet...</option>' + timesheets.map((ts) => {
      const label = currentUser.isAdmin ? `${escapeHtml(ts.employee.user.name)} - Week ${new Date(ts.weekStarting).toLocaleDateString()} - ${new Date(ts.weekEnding).toLocaleDateString()}` : `Week ${new Date(ts.weekStarting).toLocaleDateString()} - ${new Date(ts.weekEnding).toLocaleDateString()}`;
      return `<option value="${ts.id}">${label}</option>`;
    }).join("");
  }
  async function createTimesheet() {
    const currentUser2 = state.get("currentUser");
    let employeeSelectHtml = "";
    if (currentUser2.isAdmin) {
      const employees = await api.get("/employees");
      employeeSelectHtml = `
            <div class="form-group">
                <label>Employee</label>
                <select name="employeeId" required>
                    <option value="">Select employee...</option>
                    ${employees.filter((e) => e.id !== currentUser2.employeeId).map((e) => `<option value="${e.id}">${escapeHtml(e.user.name)}</option>`).join("")}
                </select>
            </div>
        `;
    }
    const html = `
        <form id="timesheetForm"> 
            ${employeeSelectHtml}
            <div class="form-group">
                <label>Week Starting</label>
                <input type="date" name="weekStarting" required>
            </div>
            <div class="form-group">
                <label>Week Ending</label>
                <input type="date" name="weekEnding" required>
            </div>
            <button type="submit" class="btn btn-primary">Create Timesheet</button>
        </form>
    `;
    showModalWithForm("Create Timesheet", html);
    const timesheetModal = document.getElementById("timesheetForm");
    timesheetModal.onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const employeeId = formData.get("employeeId") ? parseInt(formData.get("employeeId")) : currentUser2.employeeId;
      if (!employeeId) {
        showAlert("No employee profile found. An admin must create an employee profile for your account first.");
      }
      try {
        await api.post("/timesheets", {
          employeeId,
          weekStarting: formData.get("weekStarting"),
          weekEnding: formData.get("weekEnding")
        });
        hideModal();
        await refreshTimesheets2();
      } catch (error) {
        showAlert(error.message);
      }
    };
  }
  async function refreshTimesheets2() {
    const currentUser2 = state.get("currentUser");
    if (currentUser2.isAdmin) await loadAllTimesheets();
    if (currentUser2.employeeId) await loadMyTimesheets();
  }
  function displayMyTimesheets() {
    displayUnifiedTimesheets();
  }
  async function displayAllTimesheets() {
    displayUnifiedTimesheets();
  }
  async function submitTimesheet(id) {
    if (!showConfirmation("Are you sure you want to submit this timesheet?")) return;
    try {
      await api.post(`/timesheets/${id}/submit`);
      await refreshTimesheets2();
      showAlert("Timesheet submitted successfully");
    } catch (error) {
      showAlert(error.message);
    }
  }
  async function approveTimesheet(id) {
    if (!showConfirmation("Approve this timesheet?")) return;
    try {
      await api.post(`/timesheets/${id}/approve`);
      await refreshTimesheets2();
      showAlert("Timesheet approved");
    } catch (error) {
      showAlert(error.message);
    }
  }
  async function lockTimesheet(id) {
    if (!showConfirmation("Lock this timesheet? No further edits will be allowed.")) return;
    try {
      await api.post(`/timesheets/${id}/lock`);
      await refreshTimesheets2();
      showAlert("Timesheet locked");
    } catch (error) {
      showAlert(error.message);
    }
  }
  async function unlockTimesheet(id) {
    if (!showConfirmation("Unlock this timesheet and set status to OPEN? All entries will also be set to OPEN.")) return;
    try {
      await api.post(`/timesheets/${id}/unlock`);
      await refreshTimesheets2();
      showAlert("Timesheet unlocked and set to OPEN");
    } catch (error) {
      showAlert(error.message);
    }
  }
  async function deleteTimesheet(id) {
    if (!showConfirmation("Are you sure you want to delete this timesheet and all its entries?")) return;
    try {
      await api.delete(`/timesheets/${id}`);
      await refreshTimesheets2();
      showAlert("Timesheet deleted successfully");
    } catch (error) {
      showAlert(error.message);
    }
  }
  function combineTimesheetsAndDedupe() {
    const myTimesheets = state.get("myTimesheets");
    const allTimesheets = state.get("allTimesheets");
    const timesheets = [...myTimesheets];
    allTimesheets.forEach((ts) => {
      if (!timesheets.find((t) => t.id === ts.id)) timesheets.push(ts);
    });
    timesheets.sort((a, b) => new Date(b.weekStarting) - new Date(a.weekStarting));
    state.set("timesheets", timesheets);
    return timesheets;
  }
  function displayUnifiedTimesheets() {
    const currentUser2 = state.get("currentUser");
    const selectedEmployeeId = state.get("selectedEmployeeId");
    const container = document.getElementById("timesheetsAccordion");
    if (!container) return;
    let timesheetsToShow;
    if (currentUser2.isAdmin && selectedEmployeeId && selectedEmployeeId !== currentUser2.employeeId) {
      timesheetsToShow = state.get("allTimesheets").filter((ts) => ts.employeeId === selectedEmployeeId);
    } else {
      timesheetsToShow = state.get("myTimesheets");
    }
    timesheetsToShow.sort((a, b) => {
      if (a.status === "OPEN" && b.status !== "OPEN") return -1;
      if (b.status === "OPEN" && a.status !== "OPEN") return 1;
      return new Date(b.weekStarting) - new Date(a.weekStarting);
    });
    if (timesheetsToShow.length === 0) {
      container.innerHTML = '<p style="padding: 1rem; color: var(--muted);">No timesheets found.</p>';
      return;
    }
    const accordionOpen = state.get("accordionOpen") || {};
    container.innerHTML = timesheetsToShow.map((ts) => {
      const isOpen = accordionOpen[ts.id] || ts.status === "OPEN";
      const totalHours = ts.entries.reduce((sum, e) => sum + e.hours, 0);
      const weekLabel = `${new Date(ts.weekStarting).toLocaleDateString()} - ${new Date(ts.weekEnding).toLocaleDateString()}`;
      return `
      <div class="accordion-item ${isOpen ? "open" : ""}" data-ts-id="${ts.id}">
        <div class="accordion-header" onclick="toggleAccordion(${ts.id})">
          <div class="accordion-header-left">
            <span class="accordion-chevron">&#9654;</span>
            <span class="accordion-week">${weekLabel}</span>
            <span class="status-badge status-${ts.status}">${ts.status}</span>
            ${ts.autoCreated ? '<span class="source-badge tsdata-badge">TSDATA</span>' : ""}
          </div>
          <div class="accordion-meta">
            <span>${ts.entries.length} entries</span>
            <span>&middot;</span>
            <span>${totalHours.toFixed(1)} hrs</span>
            <div class="accordion-actions" onclick="event.stopPropagation();">
              ${ts.status === "OPEN" ? `<button class="btn btn-sm btn-success" onclick="submitTimesheet(${ts.id})">Submit</button>` : ""}
              ${ts.status === "SUBMITTED" && currentUser2.isAdmin ? `<button class="btn btn-sm btn-success" onclick="approveTimesheet(${ts.id})">Approve</button>` : ""}
              ${ts.status === "APPROVED" && currentUser2.isAdmin ? `<button class="btn btn-sm btn-secondary" onclick="lockTimesheet(${ts.id})">Lock</button>` : ""}
              ${(ts.status === "LOCKED" || ts.status === "APPROVED" || ts.status === "SUBMITTED") && currentUser2.isAdmin ? `
                <button class="btn btn-sm btn-warning" onclick="unlockTimesheet(${ts.id})" title="Unlock and set to OPEN">\u{1F513} Unlock</button>
              ` : ""}
              ${getWmsSyncButton(ts)}
              ${currentUser2.isAdmin ? `<button class="btn btn-sm btn-danger" onclick="deleteTimesheet(${ts.id})">Delete</button>` : ""}
            </div>
          </div>
        </div>
        <div class="accordion-body">
          <div class="accordion-body-inner">
            ${renderEntriesByDate(ts)}
          </div>
        </div>
      </div>
    `;
    }).join("");
  }
  function toggleAccordion(timesheetId) {
    const accordionOpen = state.get("accordionOpen") || {};
    accordionOpen[timesheetId] = !accordionOpen[timesheetId];
    state.set("accordionOpen", accordionOpen);
    const item = document.querySelector(`.accordion-item[data-ts-id="${timesheetId}"]`);
    if (item) item.classList.toggle("open");
  }
  function renderEntriesByDate(ts) {
    if (ts.entries.length === 0) {
      return `
      <p style="color: var(--muted); font-size: 0.9rem;">No entries yet.</p>
      <button class="add-entry-btn" onclick="createEntryForTimesheet(${ts.id})">
        + Add Entry
      </button>
    `;
    }
    const grouped = {};
    ts.entries.forEach((entry) => {
      const dateKey = formatLocalDate(entry.date);
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(entry);
    });
    const sortedDates = Object.keys(grouped).sort();
    const isEditable = ts.status === "OPEN";
    const dateAccordionOpen = state.get("dateAccordionOpen") || {};
    return sortedDates.map((dateKey) => {
      const dateEntries = grouped[dateKey].sort((a, b) => {
        if (!a.startTime || !b.startTime) return 0;
        return a.startTime.localeCompare(b.startTime);
      });
      const dayTotal = dateEntries.reduce((sum, e) => sum + e.hours, 0);
      const dateLabel = (/* @__PURE__ */ new Date(dateKey + "T00:00:00")).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric"
      });
      const dateId = `${ts.id}-${dateKey}`;
      const isOpen = dateAccordionOpen[dateId] !== false;
      return `
      <div class="date-group ${isOpen ? "open" : ""}" data-date-id="${dateId}">
        <div class="date-group-header" onclick="toggleDateAccordion('${dateId}')">
          <div class="date-group-header-left">
            <span class="date-chevron">&#9654;</span>
            <h4>${dateLabel}</h4>
          </div>
          <span class="date-hours">${dayTotal.toFixed(2)} hrs \xB7 ${dateEntries.length} entries</span>
        </div>
        <div class="date-group-body">
          <div class="date-group-body-inner">
            ${dateEntries.map((entry) => renderEntryCard(entry, ts.id, isEditable)).join("")}
            ${isEditable ? `
              <button class="add-entry-btn" onclick="createEntryForDate(${ts.id}, '${dateKey}'); event.stopPropagation();">
                + Add Entry for ${dateLabel}
              </button>
            ` : ""}
          </div>
        </div>
      </div>
    `;
    }).join("") + (isEditable ? `
    <button class="add-entry-btn" style="margin-top: 0.5rem;" onclick="createEntryForTimesheet(${ts.id})">
      + Add Entry
    </button>
  ` : "");
  }
  function toggleDateAccordion(dateId) {
    const dateAccordionOpen = state.get("dateAccordionOpen") || {};
    dateAccordionOpen[dateId] = !dateAccordionOpen[dateId];
    state.set("dateAccordionOpen", dateAccordionOpen);
    const item = document.querySelector(`.date-group[data-date-id="${dateId}"]`);
    if (item) item.classList.toggle("open");
  }
  function renderEntryCard(entry, timesheetId, isEditable) {
    const timeRange = entry.startTime && entry.endTime ? `${formatTime(entry.startTime)} - ${formatTime(entry.endTime)}` : "No time set";
    const plainNotes = entry.notes ? entry.notes.replace(/<[^>]*>/g, "").substring(0, 100) : "";
    return `
    <div class="entry-card" onclick="viewEntrySlideIn(${entry.id}, ${timesheetId}, ${isEditable})">
      <div class="entry-card-main">
        <div class="entry-card-time">
          ${timeRange}
          <span class="entry-hours">${entry.hours.toFixed(2)} hrs &middot; ${entry.entryType}</span>
        </div>
        <div class="entry-card-role">${escapeHtml(entry.role.name)}</div>
        <div class="entry-card-company">${escapeHtml(entry.company.name)}</div>
        <div class="entry-card-badges">
          <span class="status-badge status-${entry.status}">${entry.status}</span>
          ${entry.tsDataSource ? '<span class="source-badge tsdata-badge">TSDATA</span>' : ""}
          ${entry.privateNotes ? '<span class="private-notes-badge">Private</span>' : ""}
        </div>
        ${entry.startingLocation ? `<div class="entry-card-location">\u{1F4CD} ${escapeHtml(entry.startingLocation)}</div>` : ""}
        ${plainNotes ? `<div class="entry-card-description">${escapeHtml(plainNotes)}</div>` : ""}
      </div>
      <div class="entry-card-actions" onclick="event.stopPropagation();">
        ${isEditable ? `
          <button class="btn-icon" onclick="editEntrySlideIn(${entry.id}, ${timesheetId})" title="Edit">&#9998;</button>
          <button class="btn-icon btn-delete" onclick="deleteEntryFromCard(${entry.id}, ${timesheetId})" title="Delete">&times;</button>
        ` : state.get("currentUser").isAdmin ? `
          <span style="color:#999; font-size:0.75rem; margin-right:0.5rem;">Locked</span>
          <button class="btn-icon btn-delete" onclick="deleteEntryFromCard(${entry.id}, ${timesheetId})" title="Admin Delete">&times;</button>
        ` : '<span style="color:#999; font-size:0.75rem;">Locked</span>'}
      </div>
    </div>
  `;
  }
  function initEmployeeSelector() {
    const currentUser2 = state.get("currentUser");
    if (!currentUser2.isAdmin) return;
    const wrapper = document.getElementById("employeeSelectorWrapper");
    const input = document.getElementById("employeeSearchInput");
    const dropdown = document.getElementById("employeeDropdown");
    if (!wrapper || !input || !dropdown) return;
    wrapper.style.display = "";
    input.placeholder = "My Timesheets - Search to switch employee...";
    input.addEventListener("focus", () => {
      renderEmployeeDropdown("");
      dropdown.style.display = "block";
    });
    input.addEventListener("input", (e) => {
      renderEmployeeDropdown(e.target.value);
    });
    document.addEventListener("click", (e) => {
      if (!wrapper.contains(e.target)) {
        dropdown.style.display = "none";
      }
    });
  }
  function renderEmployeeDropdown(searchTerm) {
    const employees = state.get("employees");
    const currentUser2 = state.get("currentUser");
    const dropdown = document.getElementById("employeeDropdown");
    const selectedId = state.get("selectedEmployeeId");
    if (!dropdown) return;
    const filtered = employees.filter((emp) => {
      const name = emp.user.name.toLowerCase();
      const email = emp.user.email.toLowerCase();
      const term = searchTerm.toLowerCase();
      return name.includes(term) || email.includes(term);
    });
    let html = `
    <div class="employee-dropdown-item employee-dropdown-item-self ${!selectedId || selectedId === currentUser2.employeeId ? "selected" : ""}"
         onclick="selectEmployee(null)">
      <span class="emp-name">My Timesheets</span>
    </div>
  `;
    html += filtered.map((emp) => {
      const allTs = state.get("allTimesheets");
      const tsCount = allTs.filter((ts) => ts.employeeId === emp.id).length;
      return `
      <div class="employee-dropdown-item ${selectedId === emp.id ? "selected" : ""}"
           onclick="selectEmployee(${emp.id})">
        <span class="emp-name">${escapeHtml(emp.user.name)}</span>
        <span class="emp-ts-count">${tsCount} timesheets</span>
      </div>
    `;
    }).join("");
    dropdown.innerHTML = html;
  }
  async function selectEmployee(employeeId) {
    const currentUser2 = state.get("currentUser");
    const input = document.getElementById("employeeSearchInput");
    const dropdown = document.getElementById("employeeDropdown");
    const heading = document.getElementById("timesheetsHeading");
    if (!employeeId || employeeId === currentUser2.employeeId) {
      state.set("selectedEmployeeId", null);
      if (input) input.value = "";
      if (input) input.placeholder = "My Timesheets - Search to switch employee...";
      if (heading) heading.textContent = "My Timesheets";
    } else {
      state.set("selectedEmployeeId", employeeId);
      const employees = state.get("employees");
      const emp = employees.find((e) => e.id === employeeId);
      if (input) input.value = emp ? emp.user.name : "";
      if (heading) heading.textContent = `Timesheets: ${emp ? emp.user.name : ""}`;
    }
    if (dropdown) dropdown.style.display = "none";
    displayUnifiedTimesheets();
  }
  async function autoCreateTimesheets() {
    const currentUser2 = state.get("currentUser");
    if (!currentUser2.employeeId) return;
    const now = /* @__PURE__ */ new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const currentMonday = new Date(now);
    currentMonday.setDate(now.getDate() + mondayOffset);
    currentMonday.setHours(0, 0, 0, 0);
    const currentSunday = new Date(currentMonday);
    currentSunday.setDate(currentMonday.getDate() + 6);
    const nextMonday = new Date(currentMonday);
    nextMonday.setDate(currentMonday.getDate() + 7);
    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);
    const weeks = [
      { start: currentMonday, end: currentSunday },
      { start: nextMonday, end: nextSunday }
    ];
    const myTimesheets = state.get("myTimesheets") || [];
    for (const week of weeks) {
      const weekStartStr = week.start.toISOString().split("T")[0];
      const weekEndStr = week.end.toISOString().split("T")[0];
      const exists = myTimesheets.some((ts) => {
        const tsStart = formatLocalDate(ts.weekStarting);
        return tsStart === weekStartStr;
      });
      if (!exists) {
        try {
          await api.post("/timesheets", {
            employeeId: currentUser2.employeeId,
            weekStarting: weekStartStr,
            weekEnding: weekEndStr
          });
        } catch (error) {
          console.log("Auto-create timesheet skipped:", error.message);
        }
      }
    }
  }
  var init_timesheets = __esm({
    "public/js/modules/features/timesheets/timesheets.js"() {
      init_api();
      init_state();
      init_dom();
      init_navigation();
      init_modal();
      init_alerts();
      init_dateTime();
      init_wms_sync();
      registerTabHook("timesheets", displayUnifiedTimesheets);
      registerTabHook("myTimesheets", displayMyTimesheets);
      registerTabHook("allTimesheets", displayAllTimesheets);
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
    const currentUser2 = state.get("currentUser");
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
              ${u.id !== currentUser2.id ? `<button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})">Delete</button>` : ""}
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

  // public/js/modules/features/api-keys/api-keys.js
  var api_keys_exports = {};
  __export(api_keys_exports, {
    copyApiKey: () => copyApiKey,
    createApiKey: () => createApiKey,
    displayApiKeys: () => displayApiKeys,
    loadApiKeys: () => loadApiKeys,
    revokeApiKey: () => revokeApiKey
  });
  async function loadApiKeys() {
    try {
      const result = await api.get("/api-keys");
      state.set("apiKeys", result.apiKeys);
      if (document.getElementById("apiKeysTab").classList.contains("active")) {
        displayApiKeys();
      }
    } catch (error) {
      console.error("Load API keys error:", error);
    }
  }
  function displayApiKeys() {
    const apiKeys = state.get("apiKeys");
    const container = document.getElementById("apiKeysList");
    if (apiKeys.length === 0) {
      container.innerHTML = "<p>No API keys created yet.</p>";
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
        ${apiKeys.map((k) => `
          <tr>
            <td>${escapeHtml(k.name)}</td>
            <td><code>${escapeHtml(k.keyPrefix)}...</code></td>
            <td>${escapeHtml(k.user.name)}</td>
            <td>${k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never"}</td>
            <td>${k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : "Never"}</td>
            <td>
              <span class="status-badge ${k.isActive ? "status-APPROVED" : "status-LOCKED"}">${k.isActive ? "Active" : "Revoked"}</span>
            </td>
            <td>
              ${k.isActive ? `<button class="btn btn-sm btn-danger" onclick="revokeApiKey(${k.id})">Revoke</button>` : ""}
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
    container.innerHTML = html;
  }
  async function createApiKey() {
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
    showModalWithForm("Create API Key", form);
    document.getElementById("apiKeyForm").onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      try {
        const result = await api.post("/api-keys", {
          name: formData.get("name"),
          expiresAt: formData.get("expiresAt") || null
        });
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
        document.getElementById("modalBody").innerHTML = `<h2>API Key Created</h2>${keyDisplay}`;
      } catch (error) {
        showAlert(error.message);
      }
    };
  }
  function copyApiKey() {
    const input = document.getElementById("newApiKeyValue");
    input.select();
    navigator.clipboard.writeText(input.value).then(() => {
      const btn = input.nextElementSibling;
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.textContent = "Copy";
      }, 2e3);
    });
  }
  async function revokeApiKey(id) {
    if (!showConfirmation("Are you sure you want to revoke this API key? This cannot be undone.")) return;
    try {
      await api.delete(`/api-keys/${id}`);
      loadApiKeys();
    } catch (error) {
      showAlert(error.message);
    }
  }
  var init_api_keys = __esm({
    "public/js/modules/features/api-keys/api-keys.js"() {
      init_api();
      init_state();
      init_modal();
      init_alerts();
      init_dom();
      init_navigation();
      registerTabHook("apiKeys", loadApiKeys);
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

  // public/js/modules/core/slide-panel.js
  init_quill();
  var destroyAutocompletes2 = null;
  function showSlidePanel(title, bodyHtml) {
    const overlay = document.getElementById("slidePanel");
    const titleEl = document.getElementById("slidePanelTitle");
    const bodyEl = document.getElementById("slidePanelBody");
    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHtml;
    overlay.style.display = "block";
    requestAnimationFrame(() => {
      overlay.classList.add("active");
    });
  }
  function hideSlidePanel() {
    const overlay = document.getElementById("slidePanel");
    overlay.classList.remove("active");
    setTimeout(() => {
      overlay.style.display = "none";
      document.getElementById("slidePanelBody").innerHTML = "";
      destroyQuillEditors();
      if (destroyAutocompletes2) destroyAutocompletes2();
    }, 300);
  }
  function initSlidePanel() {
    const closeBtn = document.getElementById("slidePanelClose");
    const overlay = document.getElementById("slidePanel");
    if (closeBtn) {
      closeBtn.addEventListener("click", hideSlidePanel);
    }
    console.log("Slide-in panel initialized");
  }

  // public/js/modules/components/location-autocomplete.js
  init_dom();
  init_state();
  init_api();
  init_quill();
  init_modal();
  var activeAutocompletes = [];
  var autocompleteDebounceTimers = {};
  var locationNoteCounter = 0;
  function destroyAutocompletes3() {
    document.querySelectorAll(".location-autocomplete-dropdown").forEach((el) => el.remove());
    activeAutocompletes = [];
    autocompleteDebounceTimers = {};
  }
  registerAutocompleteCleanup(destroyAutocompletes3);
  function attachLocationAutocomplete(input) {
    const id = "ac_" + Math.random().toString(36).slice(2, 8);
    input.dataset.acId = id;
    activeAutocompletes.push(id);
    const fieldName = input.name;
    const form = input.closest("form");
    const latField = form ? form.querySelector(`input[name="${fieldName}Lat"]`) : null;
    const lngField = form ? form.querySelector(`input[name="${fieldName}Lng"]`) : null;
    const currentUser2 = state.get("currentUser");
    const presets = [];
    if (currentUser2 && currentUser2.employee && currentUser2.employee.presetAddresses) {
      try {
        const pa = typeof currentUser2.employee.presetAddresses === "string" ? JSON.parse(currentUser2.employee.presetAddresses) : currentUser2.employee.presetAddresses;
        if (pa && typeof pa === "object") {
          for (const [label, addr] of Object.entries(pa)) {
            if (typeof addr === "string") {
              presets.push({ label, address: addr });
            } else if (addr.address) {
              presets.push({ label, address: addr.address, lat: addr.lat, lng: addr.lng });
            }
          }
        }
      } catch (e) {
      }
    }
    input.addEventListener("input", () => {
      const query = input.value.trim();
      clearTimeout(autocompleteDebounceTimers[id]);
      if (query.length < 2) {
        removeDropdown(id);
        return;
      }
      autocompleteDebounceTimers[id] = setTimeout(async () => {
        const matchingPresets = presets.filter(
          (p) => p.label.toLowerCase().includes(query.toLowerCase()) || p.address.toLowerCase().includes(query.toLowerCase())
        );
        let places = [];
        try {
          const res = await api.get(`/maps/search?query=${encodeURIComponent(query)}`);
          places = res.results || [];
        } catch (e) {
          console.warn("Location search failed:", e.message || e);
        }
        showDropdown(input, id, matchingPresets, places, query, latField, lngField);
      }, 300);
    });
    input.addEventListener("focus", () => {
      if (input.value.trim().length >= 2) {
        input.dispatchEvent(new Event("input"));
      } else if (presets.length > 0) {
        showDropdown(input, id, presets, [], "", latField, lngField);
      }
    });
    input.addEventListener("blur", () => {
      setTimeout(() => removeDropdown(id), 200);
    });
  }
  function showDropdown(input, id, presets, places, query, latField, lngField) {
    removeDropdown(id);
    const dropdown = document.createElement("div");
    dropdown.className = "location-autocomplete-dropdown";
    dropdown.id = "dropdown_" + id;
    if (presets.length > 0) {
      const header = document.createElement("div");
      header.className = "ac-header";
      header.textContent = "Saved Locations";
      dropdown.appendChild(header);
      for (const p of presets) {
        const item = document.createElement("div");
        item.className = "ac-item";
        item.innerHTML = `<strong>${escapeHtml(p.label)}</strong><br><small style="color:var(--text);">${escapeHtml(p.address)}</small>`;
        item.onmousedown = async (e) => {
          e.preventDefault();
          input.value = p.address;
          if (p.lat && p.lng) {
            if (latField && lngField) {
              latField.value = p.lat;
              lngField.value = p.lng;
            }
          } else if (latField && lngField) {
            try {
              const res = await api.get(`/maps/search?query=${encodeURIComponent(p.address)}`);
              if (res.results && res.results.length > 0) {
                latField.value = res.results[0].lat;
                lngField.value = res.results[0].lon;
                console.log(`Geocoded preset "${p.label}": ${res.results[0].lat}, ${res.results[0].lon}`);
              }
            } catch (err) {
              console.warn("Failed to geocode preset:", err);
            }
          }
          removeDropdown(id);
          input.dispatchEvent(new Event("change", { bubbles: true }));
        };
        item.onmouseenter = () => item.style.background = "#f0f8ff";
        item.onmouseleave = () => item.style.background = "";
        dropdown.appendChild(item);
      }
    }
    if (places.length > 0) {
      const header = document.createElement("div");
      header.className = "ac-header";
      header.textContent = "Search Results";
      dropdown.appendChild(header);
      for (const p of places.slice(0, 5)) {
        const item = document.createElement("div");
        item.className = "ac-item";
        item.innerHTML = `<strong>${escapeHtml(p.mainText)}</strong><br><small style="color:#666;">${escapeHtml(p.secondaryText)}</small>`;
        item.onmousedown = (e) => {
          e.preventDefault();
          input.value = p.displayName || `${p.mainText}, ${p.secondaryText}`;
          if (latField && lngField && p.lat && p.lon) {
            latField.value = p.lat;
            lngField.value = p.lon;
            console.log(`Selected location: ${p.displayName} (${p.lat}, ${p.lon})`);
          }
          removeDropdown(id);
          input.dispatchEvent(new Event("change", { bubbles: true }));
        };
        item.onmouseenter = () => item.style.background = "#f0f8ff";
        item.onmouseleave = () => item.style.background = "";
        dropdown.appendChild(item);
      }
    }
    if (query && query.length >= 1) {
      const useAsIs = document.createElement("div");
      useAsIs.className = "ac-use-as-is";
      useAsIs.innerHTML = `Use "<strong>${escapeHtml(query)}</strong>" as entered`;
      useAsIs.onmousedown = (e) => {
        e.preventDefault();
        removeDropdown(id);
      };
      dropdown.appendChild(useAsIs);
    }
    if (dropdown.children.length === 0) return;
    const position = () => {
      const rect = input.getBoundingClientRect();
      dropdown.style.position = "fixed";
      dropdown.style.top = rect.bottom + 2 + "px";
      dropdown.style.left = rect.left + "px";
      dropdown.style.width = rect.width + "px";
    };
    position();
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    dropdown.addEventListener("remove", () => {
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
    });
    document.body.appendChild(dropdown);
  }
  function removeDropdown(id) {
    const el = document.getElementById("dropdown_" + id);
    if (el) el.remove();
  }
  function attachAllLocationAutocompletes() {
    destroyAutocompletes3();
    const modal = document.getElementById("modalBody");
    const slidePanel = document.getElementById("slidePanelBody");
    const containers = [modal, slidePanel].filter(Boolean);
    if (containers.length === 0) return;
    containers.forEach((container) => {
      const startingLoc = container.querySelector('input[name="startingLocation"]');
      if (startingLoc) attachLocationAutocomplete(startingLoc);
      const travelFrom = container.querySelector('input[name="travelFrom"]');
      if (travelFrom) attachLocationAutocomplete(travelFrom);
      const travelTo = container.querySelector('input[name="travelTo"]');
      if (travelTo) attachLocationAutocomplete(travelTo);
      container.querySelectorAll(".location-name-input").forEach((inp) => {
        if (!inp.dataset.acId) attachLocationAutocomplete(inp);
      });
    });
  }
  function addLocationNoteField(containerId, location, description) {
    const container = document.getElementById(containerId);
    const index = locationNoteCounter++;
    const editorId = `locationEditor_${index}`;
    const div = document.createElement("div");
    div.className = "location-note-item";
    div.id = `locationNote_${index}`;
    div.innerHTML = `
    <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
      <input type="text" class="form-control location-name-input" placeholder="School / Location name" value="${(location || "").replace(/"/g, "&quot;")}" style="flex: 1;">
      <button type="button" class="btn btn-sm btn-danger" onclick="removeLocationNote(${index})">Remove</button>
    </div>
    <div class="quill-wrapper">
      <div id="${editorId}"></div>
    </div>
  `;
    container.appendChild(div);
    const editor = initQuillEditor(editorId, "What was done at this location...");
    if (description) {
      editor.root.innerHTML = description;
    }
    const locInput = div.querySelector(".location-name-input");
    if (locInput) attachLocationAutocomplete(locInput);
    return { index, editorId };
  }
  function removeLocationNote(index) {
    const el = document.getElementById(`locationNote_${index}`);
    if (el) {
      const editorId = `locationEditor_${index}`;
      el.remove();
    }
  }
  function collectLocationNotes(containerId) {
    const container = document.getElementById(containerId);
    const items = container.querySelectorAll(".location-note-item");
    const notes = [];
    items.forEach((item) => {
      const location = item.querySelector(".location-name-input").value.trim();
      const editorDiv = item.querySelector('[id^="locationEditor_"]');
      if (editorDiv) {
        const editor = getQuillEditor(editorDiv.id);
        if (editor) {
          const html = editor.root.innerHTML;
          const description = html === "<p><br></p>" ? "" : html;
          if (location || description) {
            notes.push({ location, description });
          }
        }
      }
    });
    return notes.length > 0 ? JSON.stringify(notes) : null;
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
      console.log("\u{1F50D} Checking auth...");
      const result = await api.get("/auth/me");
      console.log("\u2705 Auth successful, user:", result.user.email);
      state.set("currentUser", result.user);
      await showMainScreen();
      console.log("\u2705 Main screen shown successfully");
    } catch (error) {
      console.log("\u274C Auth failed:", error.message);
      showLoginScreen();
    }
  }
  function showLoginScreen() {
    document.getElementById("loginScreen").style.display = "flex";
    document.getElementById("mainScreen").style.display = "none";
  }
  async function showMainScreen() {
    const currentUser2 = state.get("currentUser");
    console.log("\u{1F4F1} Showing main screen for:", currentUser2.email);
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("mainScreen").style.display = "block";
    document.getElementById("userDisplay").textContent = currentUser2.name;
    const hasProfile = !!currentUser2.employeeId;
    const isAdmin = currentUser2.isAdmin;
    const timesheetsTabBtn = document.querySelector('[data-tab="timesheets"]');
    if (timesheetsTabBtn) timesheetsTabBtn.style.display = "";
    let defaultTabName = "timesheets";
    document.querySelectorAll(".admin-only").forEach((el) => {
      el.style.display = isAdmin ? "" : "none";
    });
    const requested = getRequestedTab();
    const chosen = requested && isTabAvailable(requested) ? requested : defaultTabName;
    activateTab(chosen, { persist: true });
    await loadAllData();
  }
  async function loadAllData() {
    const currentUser2 = state.get("currentUser");
    console.log("\u{1F4E6} Loading data for user:", currentUser2.email);
    try {
      const { loadCompanies: loadCompanies2 } = await Promise.resolve().then(() => (init_companies(), companies_exports));
      const { loadRoles: loadRoles2 } = await Promise.resolve().then(() => (init_roles(), roles_exports));
      await Promise.all([
        loadCompanies2(),
        loadRoles2()
      ]);
      console.log("\u2705 Companies and roles loaded");
      if (currentUser2.employeeId) {
        const { loadMyTimesheets: loadMyTimesheets2 } = await Promise.resolve().then(() => (init_timesheets(), timesheets_exports));
        await loadMyTimesheets2();
        console.log("\u2705 My timesheets loaded");
      }
      if (currentUser2.isAdmin) {
        const { loadEmployees: loadEmployees2 } = await Promise.resolve().then(() => (init_employees(), employees_exports));
        const { loadUsers: loadUsers2 } = await Promise.resolve().then(() => (init_users(), users_exports));
        const { loadAllTimesheets: loadAllTimesheets2 } = await Promise.resolve().then(() => (init_timesheets(), timesheets_exports));
        const { loadApiKeys: loadApiKeys2 } = await Promise.resolve().then(() => (init_api_keys(), api_keys_exports));
        await Promise.all([
          loadAllTimesheets2(),
          loadEmployees2(),
          loadUsers2(),
          loadApiKeys2()
        ]);
        console.log("\u2705 Admin data loaded");
      }
      console.log("\u2705 All data loaded successfully");
    } catch (error) {
      console.error("\u274C Error loading data:", error);
      throw error;
    }
  }

  // public/js/modules/main.js
  init_employees();
  init_users();
  init_timesheets();

  // public/js/modules/features/entries/entries.js
  init_api();
  init_state();
  init_dom();
  init_modal();
  init_alerts();
  init_quill();
  init_dateTime();

  // public/js/modules/features/entries/entry-validation.js
  init_state();
  init_dateTime();
  function timeToMinutes(timeStr) {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  }
  function formatTime2(timeStr) {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${m} ${ampm}`;
  }
  function validateEntry(entry, existingEntries, excludeEntryId, timesheetId) {
    const errors = [];
    const warnings = [];
    const startMins = timeToMinutes(entry.startTime);
    const endMins = timeToMinutes(entry.endTime);
    if (startMins === null || endMins === null) {
      errors.push("Start time and end time are required.");
      return { valid: false, errors, warnings };
    }
    if (endMins <= startMins) {
      errors.push("End time must be after start time.");
    }
    if (startMins >= 23 * 60) {
      errors.push("Start time cannot be 11:00 PM or later.");
    }
    if (errors.length > 0) {
      return { valid: false, errors, warnings };
    }
    const entryHours = (endMins - startMins) / 60;
    if (entryHours > 12) {
      errors.push(`Entry duration of ${entryHours.toFixed(1)} hours exceeds the 12-hour maximum per entry.`);
    }
    const ts = getTimesheetById(timesheetId);
    if (ts) {
      const entryDate2 = new Date(entry.date);
      const weekStart = new Date(ts.weekStarting);
      const weekEnd = new Date(ts.weekEnding);
      weekStart.setHours(0, 0, 0, 0);
      weekEnd.setHours(23, 59, 59, 999);
      if (entryDate2 < weekStart || entryDate2 > weekEnd) {
        errors.push(`Entry date must be within the timesheet week (${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}).`);
      }
    }
    const dayOfWeek = new Date(entry.date).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      warnings.push("This entry is on a weekend. A reason for deviation may be required by DE WMS.");
    }
    const entryDate = entry.date;
    const sameDayEntries = existingEntries.filter((e) => {
      const eDate = formatLocalDate(e.date);
      const matchesDate = eDate === entryDate;
      const notSelf = excludeEntryId ? e.id !== excludeEntryId : true;
      return matchesDate && notSelf && e.startTime && e.endTime;
    });
    for (const other of sameDayEntries) {
      const otherStart = timeToMinutes(other.startTime);
      const otherEnd = timeToMinutes(other.endTime);
      if (otherStart === null || otherEnd === null) continue;
      if (startMins < otherEnd && endMins > otherStart) {
        errors.push(`Overlaps with existing entry ${formatTime2(other.startTime)} - ${formatTime2(other.endTime)} (${other.company ? other.company.name : "unknown"}).`);
      }
    }
    if (sameDayEntries.length > 0) {
      const allDayEntries = [...sameDayEntries.map((e) => ({
        start: timeToMinutes(e.startTime),
        end: timeToMinutes(e.endTime)
      })), { start: startMins, end: endMins }].filter((e) => e.start !== null && e.end !== null);
      allDayEntries.sort((a, b) => a.start - b.start);
      let hasRequiredBreak = false;
      for (let i = 0; i < allDayEntries.length - 1; i++) {
        const gap = allDayEntries[i + 1].start - allDayEntries[i].end;
        if (gap >= 30) {
          hasRequiredBreak = true;
          break;
        }
      }
      if (!hasRequiredBreak) {
        errors.push("At least one 30-minute unpaid break is required when there are multiple entries in a day.");
      }
    }
    const currentUser2 = state.get("currentUser");
    const maxDaily = currentUser2 && currentUser2.employee ? currentUser2.employee.maxDailyHours || 16 : 16;
    const existingDayHours = sameDayEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
    if (existingDayHours + entryHours > maxDaily) {
      errors.push(`Total hours for this day would be ${(existingDayHours + entryHours).toFixed(1)}h, exceeding your ${maxDaily}h daily limit.`);
    }
    return { valid: errors.length === 0, errors, warnings };
  }
  function getTimesheetById(timesheetId) {
    const myTimesheets = state.get("myTimesheets");
    const allTimesheets = state.get("allTimesheets");
    return [...myTimesheets, ...allTimesheets].find((t) => t.id === parseInt(timesheetId)) || null;
  }
  function getTimesheetEntries(timesheetId) {
    const ts = getTimesheetById(timesheetId);
    return ts && ts.entries ? ts.entries : [];
  }

  // public/js/modules/features/entries/entries.js
  init_dom();
  function getEntryCompanyOptions(selectedId) {
    const currentUser2 = state.get("currentUser");
    const companies = state.get("companies");
    const emp = currentUser2 && currentUser2.employee;
    let companyList;
    if (currentUser2 && currentUser2.isAdmin) {
      companyList = companies;
    } else if (emp && emp.roles && emp.roles.length > 0) {
      const assignedCompanyIds = new Set(emp.roles.map((er) => er.company.id));
      companyList = companies.filter((c) => assignedCompanyIds.has(c.id));
    } else {
      companyList = [];
    }
    return companyList.map(
      (c) => `<option value="${c.id}" ${c.id === selectedId ? "selected" : ""}>${escapeHtml(c.name)}</option>`
    );
  }
  function getEntryRolesForCompany(companyId) {
    const currentUser2 = state.get("currentUser");
    const roles = state.get("roles");
    const emp = currentUser2 && currentUser2.employee;
    if (currentUser2 && currentUser2.isAdmin) {
      return roles.filter((r) => r.company.id === companyId);
    } else if (emp && emp.roles && emp.roles.length > 0) {
      return emp.roles.filter((er) => er.company.id === companyId).map((er) => er.role);
    }
    return [];
  }
  async function loadEntries(timesheetId) {
    if (!timesheetId) {
      document.getElementById("entriesList").innerHTML = "<p>Please select a timesheet</p>";
      return;
    }
    try {
      const result = await api.get(`/entries/timesheet/${timesheetId}`);
      displayEntries(result.entries, timesheetId);
    } catch (error) {
      console.error("Load entries error:", error);
    }
  }
  function displayEntries(entries, timesheetId) {
    const container = document.getElementById("entriesList");
    if (entries.length === 0) {
      container.innerHTML = "<p>No entries found</p>";
      return;
    }
    const html = `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Time</th>
          <th>Hours</th>
          <th>Company</th>
          <th>Role</th>
          <th>Status</th>
          <th>Source</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${entries.map((entry) => {
      const isEditable = entry.status === "OPEN";
      const isTsData = entry.tsDataSource || false;
      return `
          <tr>
            <td>${new Date(entry.date).toLocaleDateString()}</td>
            <td>${entry.entryType}${entry.entryType === "TRAVEL" ? `<br><small>${escapeHtml(entry.travelFrom)} &rarr; ${escapeHtml(entry.travelTo)}</small>` : ""}</td>
            <td>${entry.startTime && entry.endTime ? `${formatTime(entry.startTime)}<br>${formatTime(entry.endTime)}` : "-"}</td>
            <td>${entry.hours.toFixed(2)}</td>
            <td>${escapeHtml(entry.company.name)}</td>
            <td>${escapeHtml(entry.role.name)}</td>
            <td>
              <span class="status-badge status-${entry.status}">${entry.status}</span>
              ${entry.privateNotes ? `<br><span class="private-notes-badge">Private</span>` : ""}
            </td>
            <td>
              ${isTsData ? `<span class="source-badge tsdata-badge" title="Synced from TSDATA${entry.tsDataSyncedAt ? " on " + new Date(entry.tsDataSyncedAt).toLocaleString() : ""}">TSDATA</span>` : '<span class="source-badge local-badge">Local</span>'}
            </td>
            <td>
              ${isEditable ? `
                <button class="btn btn-sm btn-primary" onclick="editEntry(${entry.id}, ${timesheetId})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteEntry(${entry.id})">Delete</button>
              ` : `<span style="color:#999; font-size:0.85rem;">Locked</span>`}
            </td>
          </tr>
        `;
    }).join("")}
      </tbody>
    </table>
  `;
    container.innerHTML = html;
  }
  async function createEntry() {
    const timesheetId = document.getElementById("timesheetSelect").value;
    if (!timesheetId) {
      showAlert("Please select a timesheet first");
      return;
    }
    const defaults = getTimeDefaults(timesheetId);
    const form = `
    <form id="entryForm">
      <div class="form-group">
        <label>Entry Type</label>
        <select name="entryType" id="entryTypeSelect" required>
          <option value="GENERAL">General</option>
          <option value="TRAVEL">Travel</option>
        </select>
      </div>
      <div class="form-group">
        <label>Date</label>
        <input type="date" name="date" value="${todayStr()}" required>
      </div>
      <div class="time-row">
        <div class="form-group">
          <label>Start Time</label>
          <input type="time" name="startTime" id="createStartTime" value="${defaults.start}" required>
        </div>
        <div class="form-group">
          <label>End Time</label>
          <input type="time" name="endTime" id="createEndTime" value="${defaults.end}" required>
        </div>
        <div class="calculated-hours" id="createHoursPreview">${defaults.start && defaults.end ? calculateHoursPreview(defaults.start, defaults.end) : "0.00 hrs"}</div>
      </div>
      <div class="form-group">
        <label>Company</label>
        <select name="companyId" id="entryCompanySelect" required>
          <option value="">Select company...</option>
          ${getEntryCompanyOptions().join("")}
        </select>
      </div>
      <div class="form-group">
        <label>Role</label>
        <select name="roleId" id="entryRoleSelect" required>
          <option value="">Select company first...</option>
        </select>
      </div>
      <div class="form-group">
        <label>Starting Location</label>
        <input type="text" name="startingLocation" placeholder="e.g. School name, Home, Office">
        <small style="color: #666;">Where you started from for this entry</small>
      </div>
      <div id="travelFields" style="display:none;">
        <div class="form-group">
          <label>Travel From</label>
          <input type="text" name="travelFrom" placeholder="e.g. Home, Work Place 1, or full address">
        </div>
        <div class="form-group">
          <label>Travel To</label>
          <input type="text" name="travelTo" placeholder="e.g. School 1, or full address">
        </div>
      </div>
      <div class="quill-wrapper">
        <label>Notes / Details</label>
        <div id="createNotesEditor"></div>
      </div>
      <div class="location-notes-section" style="border: 2px solid #3498db; border-radius: 4px; padding: 1rem; margin-bottom: 1rem; background: #f0f8ff;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <label style="font-weight: 600; color: #2c3e50; margin: 0;">Location Notes</label>
          <button type="button" class="btn btn-sm btn-primary" id="addLocationNoteBtn">+ Add Location</button>
        </div>
        <small style="color: #666; display: block; margin-bottom: 0.5rem;">Add notes for each school/location visited</small>
        <div id="createLocationNotesContainer"></div>
      </div>
      <div class="form-group">
        <label>Reason for Deviation</label>
        <textarea name="reasonForDeviation" rows="2" placeholder="If your times differ from your approved schedule, explain why" maxlength="256" style="resize: vertical;"></textarea>
        <small style="color: #666;">Required by DE WMS if entry times deviate from your default schedule</small>
      </div>
      <div class="private-notes-wrapper">
        <label>Private Notes (internal only - not visible to clients)</label>
        <div id="createPrivateNotesEditor"></div>
      </div>
      <button type="submit" class="btn btn-primary">Create Entry</button>
    </form>
  `;
    showModalWithForm("Create Entry", form);
    destroyQuillEditors();
    const notesEditor = initQuillEditor("createNotesEditor", "Enter notes or details...");
    const privateNotesEditor = initQuillEditor("createPrivateNotesEditor", "Internal notes...");
    document.getElementById("addLocationNoteBtn").onclick = () => {
      addLocationNoteField("createLocationNotesContainer");
    };
    const updateHoursPreview = () => {
      const start = document.getElementById("createStartTime").value;
      const end = document.getElementById("createEndTime").value;
      document.getElementById("createHoursPreview").textContent = calculateHoursPreview(start, end) || "0.00 hrs";
    };
    document.getElementById("createStartTime").onchange = updateHoursPreview;
    document.getElementById("createEndTime").onchange = updateHoursPreview;
    document.getElementById("entryTypeSelect").onchange = (e) => {
      document.getElementById("travelFields").style.display = e.target.value === "TRAVEL" ? "block" : "none";
    };
    document.getElementById("entryCompanySelect").onchange = (e) => {
      const companyId = parseInt(e.target.value);
      const roleSelect = document.getElementById("entryRoleSelect");
      if (!companyId) {
        roleSelect.innerHTML = '<option value="">Select company first...</option>';
        return;
      }
      const filteredRoles = getEntryRolesForCompany(companyId);
      roleSelect.innerHTML = '<option value="">Select role...</option>' + filteredRoles.map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join("");
    };
    attachAllLocationAutocompletes();
    document.getElementById("entryForm").onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const existingEntries = getTimesheetEntries(timesheetId);
      const validation = validateEntry({
        date: formData.get("date"),
        startTime: formData.get("startTime"),
        endTime: formData.get("endTime")
      }, existingEntries, null, timesheetId);
      if (!validation.valid) {
        showAlert("Entry validation failed:\n\n" + validation.errors.join("\n"));
        return;
      }
      if (validation.warnings && validation.warnings.length > 0) {
        if (!showConfirmation("Warning:\n\n" + validation.warnings.join("\n") + "\n\nContinue anyway?")) {
          return;
        }
      }
      const notesHtml = quillGetHtml(notesEditor) || null;
      const privateNotesHtml = quillGetHtml(privateNotesEditor) || null;
      const locationNotesJson = collectLocationNotes("createLocationNotesContainer");
      try {
        await api.post("/entries", {
          timesheetId: parseInt(timesheetId),
          entryType: formData.get("entryType"),
          date: formData.get("date"),
          startTime: formData.get("startTime"),
          endTime: formData.get("endTime"),
          companyId: parseInt(formData.get("companyId")),
          roleId: parseInt(formData.get("roleId")),
          startingLocation: formData.get("startingLocation") || null,
          startingLocationLat: formData.get("startingLocationLat") ? parseFloat(formData.get("startingLocationLat")) : null,
          startingLocationLng: formData.get("startingLocationLng") ? parseFloat(formData.get("startingLocationLng")) : null,
          reasonForDeviation: formData.get("reasonForDeviation") || null,
          notes: notesHtml || null,
          privateNotes: privateNotesHtml || null,
          locationNotes: locationNotesJson,
          travelFrom: formData.get("travelFrom") || null,
          travelFromLat: formData.get("travelFromLat") ? parseFloat(formData.get("travelFromLat")) : null,
          travelFromLng: formData.get("travelFromLng") ? parseFloat(formData.get("travelFromLng")) : null,
          travelTo: formData.get("travelTo") || null,
          travelToLat: formData.get("travelToLat") ? parseFloat(formData.get("travelToLat")) : null,
          travelToLng: formData.get("travelToLng") ? parseFloat(formData.get("travelToLng")) : null,
          isBillable: formData.get("isBillable") === "on"
        });
        hideModal();
        if (window.refreshTimesheets) await window.refreshTimesheets();
        loadEntries(timesheetId);
      } catch (error) {
        showAlert(error.message);
      }
    };
  }
  async function editEntry(id, timesheetIdParam) {
    const timesheetId = timesheetIdParam || document.getElementById("timesheetSelect").value;
    let entry;
    try {
      const result = await api.get(`/entries/timesheet/${timesheetId}`);
      entry = result.entries.find((e) => e.id === id);
    } catch (error) {
      showAlert("Failed to load entry");
      return;
    }
    if (!entry) {
      showAlert("Entry not found");
      return;
    }
    const dateStr = formatLocalDate(entry.date);
    const form = `
    <form id="editEntryForm">
      <div class="form-group">
        <label>Entry Type</label>
        <select name="entryType" id="editEntryTypeSelect" required>
          <option value="GENERAL" ${entry.entryType === "GENERAL" ? "selected" : ""}>General</option>
          <option value="TRAVEL" ${entry.entryType === "TRAVEL" ? "selected" : ""}>Travel</option>
        </select>
      </div>
      <div class="form-group">
        <label>Date</label>
        <input type="date" name="date" value="${dateStr}" required>
      </div>
      <div class="time-row">
        <div class="form-group">
          <label>Start Time</label>
          <input type="time" name="startTime" id="editStartTime" value="${entry.startTime || ""}" required>
        </div>
        <div class="form-group">
          <label>End Time</label>
          <input type="time" name="endTime" id="editEndTime" value="${entry.endTime || ""}" required>
        </div>
        <div class="calculated-hours" id="editHoursPreview">${entry.hours.toFixed(2)} hrs</div>
      </div>
      <div class="form-group">
        <label>Company</label>
        <select name="companyId" id="editEntryCompanySelect" required>
          <option value="">Select company...</option>
          ${getEntryCompanyOptions(entry.companyId).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>Role</label>
        <select name="roleId" id="editEntryRoleSelect" required>
          <option value="">Select role...</option>
          ${getEntryRolesForCompany(entry.companyId).map((r) => `<option value="${r.id}" ${r.id === entry.roleId ? "selected" : ""}>${escapeHtml(r.name)}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>Starting Location</label>
        <input type="text" name="startingLocation" value="${escapeHtml(entry.startingLocation || "")}" placeholder="e.g. School name, Home, Office">
        <small style="color: #666;">Where you started from for this entry</small>
      </div>
      <div id="editTravelFields" style="display:${entry.entryType === "TRAVEL" ? "block" : "none"};">
        <div class="form-group">
          <label>Travel From</label>
          <input type="text" name="travelFrom" value="${escapeHtml(entry.travelFrom || "")}">
        </div>
        <div class="form-group">
          <label>Travel To</label>
          <input type="text" name="travelTo" value="${escapeHtml(entry.travelTo || "")}">
        </div>
      </div>
      <div class="quill-wrapper">
        <label>Notes / Details</label>
        <div id="editNotesEditor"></div>
      </div>
      <div class="location-notes-section" style="border: 2px solid #3498db; border-radius: 4px; padding: 1rem; margin-bottom: 1rem; background: #f0f8ff;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <label style="font-weight: 600; color: #2c3e50; margin: 0;">Location Notes</label>
          <button type="button" class="btn btn-sm btn-primary" id="editAddLocationNoteBtn">+ Add Location</button>
        </div>
        <small style="color: #666; display: block; margin-bottom: 0.5rem;">Add notes for each school/location visited</small>
        <div id="editLocationNotesContainer"></div>
      </div>
      <div class="form-group">
        <label>Reason for Deviation</label>
        <textarea name="reasonForDeviation" rows="2" maxlength="256" style="resize: vertical;" placeholder="If your times differ from your approved schedule, explain why">${escapeHtml(entry.reasonForDeviation || "")}</textarea>
        <small style="color: #666;">Required by DE WMS if entry times deviate from your default schedule</small>
      </div>
      <div class="private-notes-wrapper">
        <label>Private Notes (internal only - not visible to clients)</label>
        <div id="editPrivateNotesEditor"></div>
      </div>
      <button type="submit" class="btn btn-primary">Save Changes</button>
    </form>
  `;
    showModalWithForm("Edit Entry", form);
    destroyQuillEditors();
    const notesEditor = initQuillEditor("editNotesEditor", "Enter notes or details...");
    const privateNotesEditor = initQuillEditor("editPrivateNotesEditor", "Internal notes...");
    if (entry.notes) {
      notesEditor.root.innerHTML = entry.notes;
    }
    if (entry.privateNotes) {
      privateNotesEditor.root.innerHTML = entry.privateNotes;
    }
    if (entry.locationNotes) {
      try {
        const locNotes = typeof entry.locationNotes === "string" ? JSON.parse(entry.locationNotes) : entry.locationNotes;
        locNotes.forEach((ln) => {
          addLocationNoteField("editLocationNotesContainer", ln.location, ln.description);
        });
      } catch (e) {
      }
    }
    document.getElementById("editAddLocationNoteBtn").onclick = () => {
      addLocationNoteField("editLocationNotesContainer");
    };
    const updateHoursPreview = () => {
      const start = document.getElementById("editStartTime").value;
      const end = document.getElementById("editEndTime").value;
      document.getElementById("editHoursPreview").textContent = calculateHoursPreview(start, end) || `${entry.hours.toFixed(2)} hrs`;
    };
    document.getElementById("editStartTime").onchange = updateHoursPreview;
    document.getElementById("editEndTime").onchange = updateHoursPreview;
    document.getElementById("editEntryTypeSelect").onchange = (e) => {
      document.getElementById("editTravelFields").style.display = e.target.value === "TRAVEL" ? "block" : "none";
    };
    document.getElementById("editEntryCompanySelect").onchange = (e) => {
      const companyId = parseInt(e.target.value);
      const roleSelect = document.getElementById("editEntryRoleSelect");
      if (!companyId) {
        roleSelect.innerHTML = '<option value="">Select company first...</option>';
        return;
      }
      const filteredRoles = getEntryRolesForCompany(companyId);
      roleSelect.innerHTML = '<option value="">Select role...</option>' + filteredRoles.map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join("");
    };
    attachAllLocationAutocompletes();
    document.getElementById("editEntryForm").onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const existingEntries = getTimesheetEntries(timesheetId);
      const validation = validateEntry({
        date: formData.get("date"),
        startTime: formData.get("startTime"),
        endTime: formData.get("endTime")
      }, existingEntries, id, timesheetId);
      if (!validation.valid) {
        showAlert("Entry validation failed:\n\n" + validation.errors.join("\n"));
        return;
      }
      if (validation.warnings && validation.warnings.length > 0) {
        if (!showConfirmation("Warning:\n\n" + validation.warnings.join("\n") + "\n\nContinue anyway?")) {
          return;
        }
      }
      const notesHtml = quillGetHtml(notesEditor) || null;
      const privateNotesHtml = quillGetHtml(privateNotesEditor) || null;
      const locationNotesJson = collectLocationNotes("editLocationNotesContainer");
      try {
        await api.put(`/entries/${id}`, {
          entryType: formData.get("entryType"),
          date: formData.get("date"),
          startTime: formData.get("startTime"),
          endTime: formData.get("endTime"),
          companyId: parseInt(formData.get("companyId")),
          roleId: parseInt(formData.get("roleId")),
          startingLocation: formData.get("startingLocation") || null,
          reasonForDeviation: formData.get("reasonForDeviation") || null,
          notes: notesHtml || null,
          privateNotes: privateNotesHtml || null,
          locationNotes: locationNotesJson,
          travelFrom: formData.get("travelFrom"),
          travelTo: formData.get("travelTo")
        });
        hideModal();
        if (window.refreshTimesheets) await window.refreshTimesheets();
        loadEntries(timesheetId);
      } catch (error) {
        showAlert(error.message);
      }
    };
  }
  async function deleteEntry(id) {
    if (!showConfirmation("Delete this entry?")) return;
    try {
      await api.delete(`/entries/${id}`);
      const timesheetId = document.getElementById("timesheetSelect").value;
      if (window.refreshTimesheets) await window.refreshTimesheets();
      loadEntries(timesheetId);
    } catch (error) {
      showAlert(error.message);
    }
  }
  async function renderTravelRoute(map, entry) {
    const markers = [];
    const waypoints = [];
    const waypointNames = [];
    waypoints.push({ lat: entry.travelFromLat, lng: entry.travelFromLng });
    waypointNames.push(entry.travelFrom);
    const fromMarker = L.marker([entry.travelFromLat, entry.travelFromLng]).addTo(map).bindPopup(`<strong>From</strong><br>${escapeHtml(entry.travelFrom || "N/A")}`);
    markers.push(fromMarker);
    const locationNotes = [];
    if (entry.locationNotes) {
      try {
        const lnotes = typeof entry.locationNotes === "string" ? JSON.parse(entry.locationNotes) : entry.locationNotes;
        locationNotes.push(...lnotes);
      } catch (e) {
      }
    }
    for (let i = 0; i < locationNotes.length; i++) {
      const ln = locationNotes[i];
      if (ln.location) {
        try {
          const result = await api.get(`/maps/search?query=${encodeURIComponent(ln.location)}`);
          if (result.results && result.results.length > 0) {
            const loc = result.results[0];
            waypoints.push({ lat: loc.lat, lng: loc.lon });
            waypointNames.push(ln.location);
            const marker = L.marker([loc.lat, loc.lon], {
              icon: L.divIcon({
                className: "waypoint-marker",
                html: `<div style="background: #e74c3c; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${i + 1}</div>`,
                iconSize: [30, 30]
              })
            }).addTo(map).bindPopup(`<strong>Stop ${i + 1}</strong><br>${escapeHtml(ln.location)}`);
            markers.push(marker);
          }
        } catch (e) {
          console.warn("Failed to geocode location note:", ln.location);
        }
      }
    }
    waypoints.push({ lat: entry.travelToLat, lng: entry.travelToLng });
    waypointNames.push(entry.travelTo);
    const toMarker = L.marker([entry.travelToLat, entry.travelToLng]).addTo(map).bindPopup(`<strong>To</strong><br>${escapeHtml(entry.travelTo || "N/A")}`);
    markers.push(toMarker);
    const routeDistanceEl = document.getElementById("routeDistance");
    if (routeDistanceEl && waypointNames.length > 2) {
      const routeText = waypointNames.map((name, i) => {
        if (i === 0) return escapeHtml(name);
        if (i === waypointNames.length - 1) return `\u2192 ${escapeHtml(name)}`;
        return `\u2192 <span style="color: #e74c3c; font-weight: 600;">Stop ${i}</span>`;
      }).join(" ");
      routeDistanceEl.previousElementSibling.innerHTML = routeText;
    }
    const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
    try {
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const routeCoords = route.geometry.coordinates.map((c) => [c[1], c[0]]);
        const totalDistanceKm = (route.distance / 1e3).toFixed(1);
        const durationMin = Math.round(route.duration / 60);
        const routeLine = L.polyline(routeCoords, {
          color: "#3498db",
          weight: 4,
          opacity: 0.7
        }).addTo(map);
        if (routeDistanceEl) {
          routeDistanceEl.innerHTML = `<strong>Total Distance:</strong> ${totalDistanceKm} km \xB7 <strong>Duration:</strong> ~${durationMin} min${entry.distance && Math.abs(parseFloat(totalDistanceKm) - entry.distance) > 0.5 ? ` <span style="color: #e67e22;">(Stored: ${entry.distance.toFixed(1)} km - needs update)</span>` : ""}`;
        }
        const group = L.featureGroup([...markers, routeLine]);
        map.fitBounds(group.getBounds().pad(0.1));
      }
    } catch (err) {
      console.warn("OSRM routing failed, using straight line:", err);
      const routeLine = L.polyline(waypoints.map((w) => [w.lat, w.lng]), {
        color: "#3498db",
        weight: 4,
        opacity: 0.7,
        dashArray: "5, 5"
      }).addTo(map);
      if (routeDistanceEl) {
        routeDistanceEl.innerHTML = `<span style="color: #e74c3c;">Route calculation failed - showing straight line</span>`;
      }
      const group = L.featureGroup([...markers, routeLine]);
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }
  async function viewEntrySlideIn(entryId, timesheetId, isEditable) {
    let entry;
    try {
      const result = await api.get(`/entries/timesheet/${timesheetId}`);
      entry = result.entries.find((e) => e.id === entryId);
    } catch (error) {
      showAlert("Failed to load entry");
      return;
    }
    if (!entry) {
      showAlert("Entry not found");
      return;
    }
    const dateStr = new Date(entry.date).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });
    const timeRange = entry.startTime && entry.endTime ? `${formatTime(entry.startTime)} - ${formatTime(entry.endTime)}` : "Not set";
    let locationNotesHtml = "";
    if (entry.locationNotes) {
      try {
        const locNotes = typeof entry.locationNotes === "string" ? JSON.parse(entry.locationNotes) : entry.locationNotes;
        locationNotesHtml = locNotes.map((ln) => `
        <div style="background: #e8f4fd; padding: 0.75rem; border-radius: 6px; border-left: 3px solid #3498db; margin-bottom: 0.5rem;">
          <strong>${escapeHtml(ln.location)}</strong>
          <div class="rich-text-content">${sanitizeRichText(ln.description)}</div>
        </div>
      `).join("");
      } catch (e) {
      }
    }
    const html = `
    <div class="entry-detail-view">
      <div class="entry-detail-row">
        <div class="entry-detail-label">Date</div>
        <div class="entry-detail-value">${dateStr}</div>
      </div>

      <div class="entry-detail-row">
        <div class="entry-detail-label">Entry Type</div>
        <div class="entry-detail-value">
          <span class="status-badge status-${entry.status}">${entry.entryType}</span>
          ${entry.tsDataSource ? ' <span class="source-badge tsdata-badge">TSDATA</span>' : ""}
        </div>
      </div>

      <div class="entry-detail-row">
        <div class="entry-detail-label">Time</div>
        <div class="entry-detail-value">${timeRange} <span style="color: var(--muted);">(${entry.hours.toFixed(2)} hours)</span></div>
      </div>

      <div class="entry-detail-row">
        <div class="entry-detail-label">Company</div>
        <div class="entry-detail-value">${escapeHtml(entry.company.name)}</div>
      </div>

      <div class="entry-detail-row">
        <div class="entry-detail-label">Role</div>
        <div class="entry-detail-value">${escapeHtml(entry.role.name)}</div>
      </div>

      ${entry.startingLocation ? `
        <div class="entry-detail-row">
          <div class="entry-detail-label">Starting Location</div>
          <div class="entry-detail-value">\u{1F4CD} ${escapeHtml(entry.startingLocation)}</div>
        </div>
      ` : ""}

      ${entry.entryType === "TRAVEL" && (entry.travelFrom || entry.travelTo) ? `
        <div class="entry-detail-row">
          <div class="entry-detail-label">Travel Route</div>
          <div class="entry-detail-value">
            <div>${escapeHtml(entry.travelFrom || "N/A")} \u2192 ${escapeHtml(entry.travelTo || "N/A")}</div>
            <div id="routeDistance" style="color: var(--muted); font-size: 0.9rem; margin-top: 0.25rem;">
              ${entry.distance ? `Stored: ${entry.distance.toFixed(1)} km \xB7 ` : ""}Calculating route...
            </div>
            <div style="margin-top: 0.25rem;">
              ${entry.isBillable !== false ? '<span class="billable-badge">Billable</span>' : '<span class="non-billable-badge">Non-billable</span>'}
            </div>
          </div>
        </div>
      ` : ""}

      ${entry.startingLocationLat && entry.startingLocationLng || entry.travelFromLat && entry.travelFromLng && entry.travelToLat && entry.travelToLng ? `
        <div class="entry-detail-row">
          <div class="entry-detail-label">Map</div>
          <div class="entry-detail-value">
            <div id="entryMapContainer" style="width: 100%; height: 300px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border);"></div>
          </div>
        </div>
      ` : ""}

      ${entry.notes ? `
        <div class="entry-detail-row">
          <div class="entry-detail-label">Notes / Details</div>
          <div class="entry-detail-rich-content rich-text-content">
            ${sanitizeRichText(entry.notes)}
          </div>
        </div>
      ` : ""}

      ${locationNotesHtml ? `
        <div class="entry-detail-row">
          <div class="entry-detail-label">Location Notes</div>
          <div>${locationNotesHtml}</div>
        </div>
      ` : ""}

      ${entry.reasonForDeviation ? `
        <div class="entry-detail-row">
          <div class="entry-detail-label">Reason for Deviation</div>
          <div class="entry-detail-value" style="background: #fff3cd; padding: 0.5rem; border-radius: 4px; border-left: 3px solid #ffc107;">
            ${escapeHtml(entry.reasonForDeviation)}
          </div>
        </div>
      ` : ""}

      ${entry.privateNotes ? `
        <div class="entry-detail-row">
          <div class="entry-detail-label">
            Private Notes
            <span class="private-notes-badge" style="margin-left: 0.5rem;">Internal Only</span>
          </div>
          <div class="entry-detail-rich-content rich-text-content" style="background: #fffbf0; border-color: #f0ad4e;">
            ${sanitizeRichText(entry.privateNotes)}
          </div>
        </div>
      ` : ""}

      <div class="entry-detail-row">
        <div class="entry-detail-label">Status</div>
        <div class="entry-detail-value">
          <span class="status-badge status-${entry.status}">${entry.status}</span>
        </div>
      </div>

      ${isEditable ? `
        <div class="slide-panel-actions">
          <button class="btn btn-primary" onclick="editEntrySlideIn(${entryId}, ${timesheetId})">
            Edit Entry
          </button>
          <button class="btn btn-danger" onclick="deleteEntryFromCard(${entryId}, ${timesheetId})">
            Delete Entry
          </button>
          <button class="btn btn-secondary" onclick="hideSlidePanel()">
            Close
          </button>
        </div>
      ` : `
        <div class="slide-panel-actions">
          <button class="btn btn-secondary" onclick="hideSlidePanel()">
            Close
          </button>
        </div>
      `}
    </div>
  `;
    showSlidePanel("Entry Details", html);
    setTimeout(() => {
      const mapContainer = document.getElementById("entryMapContainer");
      if (!mapContainer) return;
      const hasStartingLocation = entry.startingLocationLat && entry.startingLocationLng;
      const hasTravelRoute = entry.travelFromLat && entry.travelFromLng && entry.travelToLat && entry.travelToLng;
      if (!hasStartingLocation && !hasTravelRoute) return;
      let centerLat, centerLng;
      if (hasTravelRoute) {
        centerLat = (entry.travelFromLat + entry.travelToLat) / 2;
        centerLng = (entry.travelFromLng + entry.travelToLng) / 2;
      } else {
        centerLat = entry.startingLocationLat;
        centerLng = entry.startingLocationLng;
      }
      const map = L.map("entryMapContainer").setView([centerLat, centerLng], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);
      if (hasStartingLocation) {
        L.marker([entry.startingLocationLat, entry.startingLocationLng]).addTo(map).bindPopup(`<strong>Starting Location</strong><br>${escapeHtml(entry.startingLocation || "N/A")}`);
      }
      if (hasTravelRoute) {
        renderTravelRoute(map, entry);
      }
    }, 100);
  }
  function getSmartDefaultsForTimesheet(timesheetId) {
    const timesheets = state.get("timesheets");
    const ts = timesheets.find((t) => t.id === parseInt(timesheetId));
    const currentUser2 = state.get("currentUser");
    const emp = currentUser2.employee;
    const morning = {
      start: emp ? emp.morningStart : "08:30",
      end: emp ? emp.morningEnd : "12:30"
    };
    const afternoon = {
      start: emp ? emp.afternoonStart : "13:00",
      end: emp ? emp.afternoonEnd : "17:00"
    };
    if (!ts) {
      return { date: todayStr(), ...morning };
    }
    const weekStart = new Date(ts.weekStarting);
    const weekEnd = new Date(ts.weekEnding);
    const entriesByDate = {};
    if (ts.entries) {
      ts.entries.forEach((entry) => {
        const dateKey = formatLocalDate(entry.date);
        if (!entriesByDate[dateKey]) entriesByDate[dateKey] = [];
        entriesByDate[dateKey].push(entry);
      });
    }
    const currentDate = new Date(weekStart);
    while (currentDate <= weekEnd) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
      const dateKey = currentDate.toISOString().split("T")[0];
      const dayEntries = entriesByDate[dateKey] || [];
      const hasMorning = dayEntries.some(
        (e) => e.startTime && e.startTime >= "06:00" && e.startTime < "13:00"
      );
      if (!hasMorning) {
        return { date: dateKey, ...morning };
      }
      const hasAfternoon = dayEntries.some(
        (e) => e.startTime && e.startTime >= "13:00" && e.startTime < "18:00"
      );
      if (!hasAfternoon) {
        return { date: dateKey, ...afternoon };
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return { date: todayStr(), start: "", end: "" };
  }
  function getTimeDefaultsForTimesheet(timesheetId) {
    return getSmartDefaultsForTimesheet(timesheetId);
  }
  async function createEntryForTimesheet(timesheetId, prefillDate = null) {
    const smartDefaults = getSmartDefaultsForTimesheet(timesheetId);
    const defaultDate = prefillDate || smartDefaults.date;
    const defaults = prefillDate ? getTimeDefaultsForTimesheet(timesheetId) : smartDefaults;
    const form = `
    <form id="entryFormSlide">
      <div class="form-group">
        <label>Entry Type</label>
        <select name="entryType" id="slideEntryTypeSelect" required>
          <option value="GENERAL">General</option>
          <option value="TRAVEL">Travel</option>
        </select>
      </div>
      <div class="form-group">
        <label>Date</label>
        <input type="date" name="date" value="${defaultDate}" required>
      </div>
      <div class="time-row">
        <div class="form-group">
          <label>Start Time</label>
          <input type="time" name="startTime" id="slideStartTime" value="${defaults.start}" required>
        </div>
        <div class="form-group">
          <label>End Time</label>
          <input type="time" name="endTime" id="slideEndTime" value="${defaults.end}" required>
        </div>
        <div class="calculated-hours" id="slideHoursPreview">${defaults.start && defaults.end ? calculateHoursPreview(defaults.start, defaults.end) : "0.00 hrs"}</div>
      </div>
      <div class="form-group">
        <label>Company</label>
        <select name="companyId" id="slideEntryCompanySelect" required>
          <option value="">Select company...</option>
          ${getEntryCompanyOptions().join("")}
        </select>
      </div>
      <div class="form-group">
        <label>Role</label>
        <select name="roleId" id="slideEntryRoleSelect" required>
          <option value="">Select company first...</option>
        </select>
      </div>
      <div id="slideStartingLocationField" class="form-group">
        <label>Starting Location</label>
        <input type="text" name="startingLocation" placeholder="e.g. School name, Home, Office">
        <input type="hidden" name="startingLocationLat">
        <input type="hidden" name="startingLocationLng">
        <small style="color: #666;">Where you started from for this entry</small>
      </div>
      <div id="slideTravelFields" style="display:none;">
        <div class="form-group">
          <label>Travel From</label>
          <input type="text" name="travelFrom" placeholder="e.g. Home, Work Place 1, or full address">
          <input type="hidden" name="travelFromLat">
          <input type="hidden" name="travelFromLng">
        </div>
        <div class="form-group">
          <label>Travel To</label>
          <input type="text" name="travelTo" placeholder="e.g. School 1, or full address">
          <input type="hidden" name="travelToLat">
          <input type="hidden" name="travelToLng">
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" name="isBillable" checked>
            <span>Billable (sync to WMS)</span>
          </label>
          <small style="color: #666;">Uncheck if this travel should not be billed or synced to WMS</small>
        </div>
        <div class="form-group" style="background: #e8f4fd; padding: 0.75rem; border-radius: 6px; border-left: 4px solid #3498db; margin-top: 1rem;">
          <div style="margin-bottom: 0.5rem;">
            <strong style="color: #2c3e50;">\u23F1\uFE0F Auto-Calculate Travel Time</strong>
          </div>
          <div style="color: #555; font-size: 0.85rem; margin-bottom: 0.5rem;">
            1. Enter start time<br>
            2. Type location and <strong>select from dropdown</strong> (both From/To)<br>
            3. Click "Calculate" or wait 1 second
          </div>
          <button type="button" id="manualCalcTravelBtn" class="btn btn-sm btn-primary" style="width: 100%;">
            \u{1F9EE} Calculate End Time from Route
          </button>
        </div>
      </div>
      <div class="quill-wrapper">
        <label>Notes / Details</label>
        <div id="slideNotesEditor"></div>
      </div>
      <div class="location-notes-section" style="border: 2px solid #3498db; border-radius: 4px; padding: 1rem; margin-bottom: 1rem; background: #f0f8ff;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <label style="font-weight: 600; color: #2c3e50; margin: 0;">Location Notes</label>
          <button type="button" class="btn btn-sm btn-primary" id="slideAddLocationNoteBtn">+ Add Location</button>
        </div>
        <small style="color: #666; display: block; margin-bottom: 0.5rem;">Add notes for each school/location visited</small>
        <div id="slideLocationNotesContainer"></div>
      </div>
      <div class="form-group">
        <label>Reason for Deviation</label>
        <textarea name="reasonForDeviation" rows="2" placeholder="If your times differ from your approved schedule, explain why" maxlength="256" style="resize: vertical;"></textarea>
        <small style="color: #666;">Required by DE WMS if entry times deviate from your default schedule</small>
      </div>
      <div class="private-notes-wrapper">
        <label>Private Notes (internal only - not visible to clients)</label>
        <div id="slidePrivateNotesEditor"></div>
      </div>
      <button type="submit" class="btn btn-primary">Create Entry</button>
    </form>
  `;
    showSlidePanel("Create Entry", form);
    destroyQuillEditors();
    const notesEditor = initQuillEditor("slideNotesEditor", "Enter notes or details...");
    const privateNotesEditor = initQuillEditor("slidePrivateNotesEditor", "Internal notes...");
    document.getElementById("slideAddLocationNoteBtn").onclick = () => {
      addLocationNoteField("slideLocationNotesContainer");
    };
    const updateHoursPreview = () => {
      const start = document.getElementById("slideStartTime").value;
      const end = document.getElementById("slideEndTime").value;
      document.getElementById("slideHoursPreview").textContent = calculateHoursPreview(start, end) || "0.00 hrs";
    };
    document.getElementById("slideStartTime").onchange = updateHoursPreview;
    document.getElementById("slideEndTime").onchange = updateHoursPreview;
    const autoCalculateTravelTime = async () => {
      const entryType = document.getElementById("slideEntryTypeSelect").value;
      if (entryType !== "TRAVEL") return;
      const startTime = document.getElementById("slideStartTime").value;
      const travelFromLat = document.querySelector('#slideTravelFields input[name="travelFromLat"]').value;
      const travelFromLng = document.querySelector('#slideTravelFields input[name="travelFromLng"]').value;
      const travelToLat = document.querySelector('#slideTravelFields input[name="travelToLat"]').value;
      const travelToLng = document.querySelector('#slideTravelFields input[name="travelToLng"]').value;
      if (!startTime || !travelFromLat || !travelFromLng || !travelToLat || !travelToLng) {
        console.log("Auto-calc skipped: missing required fields", { startTime, travelFromLat, travelFromLng, travelToLat, travelToLng });
        return;
      }
      console.log("Auto-calculating travel time...");
      const waypoints = [{ lat: parseFloat(travelFromLat), lng: parseFloat(travelFromLng) }];
      const locationNoteItems = document.querySelectorAll("#slideLocationNotesContainer .location-note-item");
      for (const item of locationNoteItems) {
        const locationInput = item.querySelector(".location-name-input").value.trim();
        if (locationInput) {
          try {
            const result = await api.get(`/maps/search?query=${encodeURIComponent(locationInput)}`);
            if (result.results && result.results.length > 0) {
              waypoints.push({ lat: result.results[0].lat, lng: result.results[0].lon });
            }
          } catch (e) {
          }
        }
      }
      waypoints.push({ lat: parseFloat(travelToLat), lng: parseFloat(travelToLng) });
      try {
        const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`);
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
          const durationMinutes = Math.round(data.routes[0].duration / 60);
          console.log(`Route calculated: ${durationMinutes} minutes`);
          const [hours, minutes] = startTime.split(":").map(Number);
          const startMinutes = hours * 60 + minutes;
          const endMinutes = startMinutes + durationMinutes;
          const endHours = Math.floor(endMinutes / 60) % 24;
          const endMins = endMinutes % 60;
          const endTime = `${String(endHours).padStart(2, "0")}:${String(endMins).padStart(2, "0")}`;
          console.log(`Auto-setting end time: ${startTime} + ${durationMinutes}min = ${endTime}`);
          document.getElementById("slideEndTime").value = endTime;
          updateHoursPreview();
          const hoursPreview = document.getElementById("slideHoursPreview");
          hoursPreview.innerHTML += ` <span style="color: #27ae60; font-size: 0.8rem;">(Auto-calculated from ${durationMinutes} min route)</span>`;
          setTimeout(() => updateHoursPreview(), 3e3);
        } else {
          console.warn("OSRM returned no routes");
        }
      } catch (err) {
        console.warn("Failed to auto-calculate travel time:", err);
      }
    };
    document.getElementById("slideEntryTypeSelect").onchange = (e) => {
      const isTravel = e.target.value === "TRAVEL";
      document.getElementById("slideTravelFields").style.display = isTravel ? "block" : "none";
      document.getElementById("slideStartingLocationField").style.display = isTravel ? "none" : "block";
      if (isTravel) {
        document.getElementById("slideEndTime").value = "";
        updateHoursPreview();
        console.log("Switched to TRAVEL - end time cleared, will auto-calculate from route");
        setTimeout(() => {
          console.log("Checking if auto-calc can run immediately...");
          autoCalculateTravelTime();
        }, 100);
      }
    };
    document.getElementById("slideStartTime").addEventListener("change", autoCalculateTravelTime);
    const travelFromField = document.querySelector('#slideTravelFields input[name="travelFrom"]');
    const travelToField = document.querySelector('#slideTravelFields input[name="travelTo"]');
    if (travelFromField) {
      travelFromField.addEventListener("change", () => {
        console.log("Travel From changed, scheduling auto-calc");
        setTimeout(autoCalculateTravelTime, 1e3);
      });
    }
    if (travelToField) {
      travelToField.addEventListener("change", () => {
        console.log("Travel To changed, scheduling auto-calc");
        setTimeout(autoCalculateTravelTime, 1e3);
      });
    }
    const manualCalcBtn = document.getElementById("manualCalcTravelBtn");
    if (manualCalcBtn) {
      manualCalcBtn.addEventListener("click", () => {
        console.log("Manual calculate clicked");
        autoCalculateTravelTime();
      });
    }
    document.getElementById("slideEntryCompanySelect").onchange = (e) => {
      const companyId = parseInt(e.target.value);
      const roleSelect = document.getElementById("slideEntryRoleSelect");
      if (!companyId) {
        roleSelect.innerHTML = '<option value="">Select company first...</option>';
        return;
      }
      const filteredRoles = getEntryRolesForCompany(companyId);
      roleSelect.innerHTML = '<option value="">Select role...</option>' + filteredRoles.map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join("");
    };
    attachAllLocationAutocompletes();
    document.getElementById("entryFormSlide").onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const existingEntries = getTimesheetEntries(timesheetId);
      const validation = validateEntry({
        date: formData.get("date"),
        startTime: formData.get("startTime"),
        endTime: formData.get("endTime")
      }, existingEntries, null, timesheetId);
      if (!validation.valid) {
        showAlert("Entry validation failed:\n\n" + validation.errors.join("\n"));
        return;
      }
      if (validation.warnings && validation.warnings.length > 0) {
        if (!showConfirmation("Warning:\n\n" + validation.warnings.join("\n") + "\n\nContinue anyway?")) {
          return;
        }
      }
      const notesHtml = quillGetHtml(notesEditor) || null;
      const privateNotesHtml = quillGetHtml(privateNotesEditor) || null;
      const locationNotesJson = collectLocationNotes("slideLocationNotesContainer");
      try {
        await api.post("/entries", {
          timesheetId: parseInt(timesheetId),
          entryType: formData.get("entryType"),
          date: formData.get("date"),
          startTime: formData.get("startTime"),
          endTime: formData.get("endTime"),
          companyId: parseInt(formData.get("companyId")),
          roleId: parseInt(formData.get("roleId")),
          startingLocation: formData.get("startingLocation") || null,
          startingLocationLat: formData.get("startingLocationLat") ? parseFloat(formData.get("startingLocationLat")) : null,
          startingLocationLng: formData.get("startingLocationLng") ? parseFloat(formData.get("startingLocationLng")) : null,
          reasonForDeviation: formData.get("reasonForDeviation") || null,
          notes: notesHtml || null,
          privateNotes: privateNotesHtml || null,
          locationNotes: locationNotesJson,
          travelFrom: formData.get("travelFrom") || null,
          travelFromLat: formData.get("travelFromLat") ? parseFloat(formData.get("travelFromLat")) : null,
          travelFromLng: formData.get("travelFromLng") ? parseFloat(formData.get("travelFromLng")) : null,
          travelTo: formData.get("travelTo") || null,
          travelToLat: formData.get("travelToLat") ? parseFloat(formData.get("travelToLat")) : null,
          travelToLng: formData.get("travelToLng") ? parseFloat(formData.get("travelToLng")) : null,
          isBillable: formData.get("isBillable") === "on"
        });
        hideSlidePanel();
        if (window.refreshTimesheets) await window.refreshTimesheets();
      } catch (error) {
        showAlert(error.message);
      }
    };
  }
  async function createEntryForDate(timesheetId, dateStr) {
    await createEntryForTimesheet(timesheetId, dateStr);
  }
  async function editEntrySlideIn(entryId, timesheetId) {
    let entry;
    try {
      const result = await api.get(`/entries/timesheet/${timesheetId}`);
      entry = result.entries.find((e) => e.id === entryId);
    } catch (error) {
      showAlert("Failed to load entry");
      return;
    }
    if (!entry) {
      showAlert("Entry not found");
      return;
    }
    const dateStr = formatLocalDate(entry.date);
    const isTsData = entry.tsDataSource === true;
    const readonly = isTsData ? 'readonly onclick="return false;" style="background-color: #f5f5f5; cursor: not-allowed;"' : "";
    const disabled = isTsData ? 'disabled style="background-color: #f5f5f5; cursor: not-allowed;"' : "";
    const form = `
    <form id="editEntryFormSlide">
      ${isTsData ? `
        <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 0.75rem; margin-bottom: 1rem;">
          <strong style="color: #856404;">\u{1F4CA} TSDATA Entry</strong>
          <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #856404;">
            Date, time, and hours are readonly (imported from TSDATA).
            You can edit notes, descriptions, and location details.
            ${entry.verified ? '<span style="color: #27ae60;">\u2713 Verified</span>' : ""}
          </p>
        </div>
      ` : ""}
      <div class="form-group">
        <label>Entry Type</label>
        <select name="entryType" id="slideEditEntryTypeSelect" required ${disabled}>
          <option value="GENERAL" ${entry.entryType === "GENERAL" ? "selected" : ""}>General</option>
          <option value="TRAVEL" ${entry.entryType === "TRAVEL" ? "selected" : ""}>Travel</option>
        </select>
      </div>
      <div class="form-group">
        <label>Date</label>
        <input type="date" name="date" value="${dateStr}" required ${readonly}>
      </div>
      <div class="time-row">
        <div class="form-group">
          <label>Start Time</label>
          <input type="time" name="startTime" id="slideEditStartTime" value="${entry.startTime || ""}" required ${readonly}>
        </div>
        <div class="form-group">
          <label>End Time</label>
          <input type="time" name="endTime" id="slideEditEndTime" value="${entry.endTime || ""}" required ${readonly}>
        </div>
        <div class="calculated-hours" id="slideEditHoursPreview">${entry.hours.toFixed(2)} hrs</div>
      </div>
      <div class="form-group">
        <label>Company</label>
        <select name="companyId" id="slideEditEntryCompanySelect" required ${disabled}>
          <option value="">Select company...</option>
          ${getEntryCompanyOptions(entry.companyId).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>Role</label>
        <select name="roleId" id="slideEditEntryRoleSelect" required ${disabled}>
          <option value="">Select role...</option>
          ${getEntryRolesForCompany(entry.companyId).map((r) => `<option value="${r.id}" ${r.id === entry.roleId ? "selected" : ""}>${escapeHtml(r.name)}</option>`).join("")}
        </select>
      </div>
      <div id="slideEditStartingLocationField" class="form-group" style="display:${entry.entryType === "TRAVEL" ? "none" : "block"};">
        <label>Starting Location</label>
        <input type="text" name="startingLocation" value="${escapeHtml(entry.startingLocation || "")}" placeholder="e.g. School name, Home, Office">
        <input type="hidden" name="startingLocationLat" value="${entry.startingLocationLat || ""}">
        <input type="hidden" name="startingLocationLng" value="${entry.startingLocationLng || ""}">
        <small style="color: #666;">Where you started from for this entry</small>
      </div>
      <div id="slideEditTravelFields" style="display:${entry.entryType === "TRAVEL" ? "block" : "none"};">
        <div class="form-group">
          <label>Travel From</label>
          <input type="text" name="travelFrom" value="${escapeHtml(entry.travelFrom || "")}">
          <input type="hidden" name="travelFromLat" value="${entry.travelFromLat || ""}">
          <input type="hidden" name="travelFromLng" value="${entry.travelFromLng || ""}">
        </div>
        <div class="form-group">
          <label>Travel To</label>
          <input type="text" name="travelTo" value="${escapeHtml(entry.travelTo || "")}">
          <input type="hidden" name="travelToLat" value="${entry.travelToLat || ""}">
          <input type="hidden" name="travelToLng" value="${entry.travelToLng || ""}">
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" name="isBillable" ${entry.isBillable !== false ? "checked" : ""}>
            <span>Billable (sync to WMS)</span>
          </label>
          <small style="color: #666;">Mark as billable for WMS timesheet sync</small>
        </div>
        <div class="form-group" style="background: #e8f4fd; padding: 0.75rem; border-radius: 6px; border-left: 4px solid #3498db; margin-top: 1rem;">
          <div style="margin-bottom: 0.5rem;">
            <strong style="color: #2c3e50;">\u23F1\uFE0F Auto-Calculate Travel Time</strong>
          </div>
          <div style="color: #555; font-size: 0.85rem; margin-bottom: 0.5rem;">
            1. Enter start time<br>
            2. Type location and <strong>select from dropdown</strong> (both From/To)<br>
            3. Click "Calculate" or wait 1 second
          </div>
          <button type="button" id="manualCalcEditTravelBtn" class="btn btn-sm btn-primary" style="width: 100%;">
            \u{1F9EE} Calculate End Time from Route
          </button>
        </div>
      </div>
      <div class="quill-wrapper">
        <label>Notes / Details</label>
        <div id="slideEditNotesEditor"></div>
      </div>
      <div class="location-notes-section" style="border: 2px solid #3498db; border-radius: 4px; padding: 1rem; margin-bottom: 1rem; background: #f0f8ff;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <label style="font-weight: 600; color: #2c3e50; margin: 0;">Location Notes</label>
          <button type="button" class="btn btn-sm btn-primary" id="slideEditAddLocationNoteBtn">+ Add Location</button>
        </div>
        <small style="color: #666; display: block; margin-bottom: 0.5rem;">Add notes for each school/location visited</small>
        <div id="slideEditLocationNotesContainer"></div>
      </div>
      <div class="form-group">
        <label>Reason for Deviation</label>
        <textarea name="reasonForDeviation" rows="2" maxlength="256" style="resize: vertical;" placeholder="If your times differ from your approved schedule, explain why">${escapeHtml(entry.reasonForDeviation || "")}</textarea>
        <small style="color: #666;">Required by DE WMS if entry times deviate from your default schedule</small>
      </div>
      <div class="private-notes-wrapper">
        <label>Private Notes (internal only - not visible to clients)</label>
        <div id="slideEditPrivateNotesEditor"></div>
      </div>
      <button type="submit" class="btn btn-primary">Save Changes</button>
    </form>
  `;
    showSlidePanel("Edit Entry", form);
    destroyQuillEditors();
    const notesEditor = initQuillEditor("slideEditNotesEditor", "Enter notes or details...");
    const privateNotesEditor = initQuillEditor("slideEditPrivateNotesEditor", "Internal notes...");
    if (entry.notes) {
      notesEditor.root.innerHTML = entry.notes;
    }
    if (entry.privateNotes) {
      privateNotesEditor.root.innerHTML = entry.privateNotes;
    }
    if (entry.locationNotes) {
      try {
        const locNotes = typeof entry.locationNotes === "string" ? JSON.parse(entry.locationNotes) : entry.locationNotes;
        locNotes.forEach((ln) => {
          addLocationNoteField("slideEditLocationNotesContainer", ln.location, ln.description);
        });
      } catch (e) {
      }
    }
    document.getElementById("slideEditAddLocationNoteBtn").onclick = () => {
      addLocationNoteField("slideEditLocationNotesContainer");
    };
    const updateHoursPreview = () => {
      const start = document.getElementById("slideEditStartTime").value;
      const end = document.getElementById("slideEditEndTime").value;
      document.getElementById("slideEditHoursPreview").textContent = calculateHoursPreview(start, end) || `${entry.hours.toFixed(2)} hrs`;
    };
    document.getElementById("slideEditStartTime").onchange = updateHoursPreview;
    document.getElementById("slideEditEndTime").onchange = updateHoursPreview;
    const autoCalculateEditTravelTime = async () => {
      const entryType = document.getElementById("slideEditEntryTypeSelect").value;
      if (entryType !== "TRAVEL") return;
      const startTime = document.getElementById("slideEditStartTime").value;
      const travelFromLat = document.querySelector('#slideEditTravelFields input[name="travelFromLat"]').value;
      const travelFromLng = document.querySelector('#slideEditTravelFields input[name="travelFromLng"]').value;
      const travelToLat = document.querySelector('#slideEditTravelFields input[name="travelToLat"]').value;
      const travelToLng = document.querySelector('#slideEditTravelFields input[name="travelToLng"]').value;
      if (!startTime || !travelFromLat || !travelFromLng || !travelToLat || !travelToLng) {
        console.log("Edit: Auto-calc skipped - missing required fields", { startTime, travelFromLat, travelFromLng, travelToLat, travelToLng });
        return;
      }
      console.log("Edit: Auto-calculating travel time...");
      const waypoints = [{ lat: parseFloat(travelFromLat), lng: parseFloat(travelFromLng) }];
      const locationNoteItems = document.querySelectorAll("#slideEditLocationNotesContainer .location-note-item");
      for (const item of locationNoteItems) {
        const locationInput = item.querySelector(".location-name-input").value.trim();
        if (locationInput) {
          try {
            const result = await api.get(`/maps/search?query=${encodeURIComponent(locationInput)}`);
            if (result.results && result.results.length > 0) {
              waypoints.push({ lat: result.results[0].lat, lng: result.results[0].lon });
            }
          } catch (e) {
          }
        }
      }
      waypoints.push({ lat: parseFloat(travelToLat), lng: parseFloat(travelToLng) });
      try {
        const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`);
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
          const durationMinutes = Math.round(data.routes[0].duration / 60);
          const [hours, minutes] = startTime.split(":").map(Number);
          const startMinutes = hours * 60 + minutes;
          const endMinutes = startMinutes + durationMinutes;
          const endHours = Math.floor(endMinutes / 60) % 24;
          const endMins = endMinutes % 60;
          const endTime = `${String(endHours).padStart(2, "0")}:${String(endMins).padStart(2, "0")}`;
          document.getElementById("slideEditEndTime").value = endTime;
          updateHoursPreview();
          const hoursPreview = document.getElementById("slideEditHoursPreview");
          hoursPreview.innerHTML += ` <span style="color: #27ae60; font-size: 0.8rem;">(Auto-calculated from ${durationMinutes} min route)</span>`;
          setTimeout(() => updateHoursPreview(), 3e3);
        }
      } catch (err) {
        console.warn("Failed to auto-calculate travel time:", err);
      }
    };
    document.getElementById("slideEditEntryTypeSelect").onchange = (e) => {
      const isTravel = e.target.value === "TRAVEL";
      document.getElementById("slideEditTravelFields").style.display = isTravel ? "block" : "none";
      document.getElementById("slideEditStartingLocationField").style.display = isTravel ? "none" : "block";
      if (isTravel) {
        document.getElementById("slideEditEndTime").value = "";
        updateHoursPreview();
        console.log("Switched to TRAVEL - end time cleared, will auto-calculate from route");
        setTimeout(() => {
          console.log("Checking if auto-calc can run immediately...");
          autoCalculateEditTravelTime();
        }, 100);
      }
    };
    document.getElementById("slideEditStartTime").addEventListener("change", autoCalculateEditTravelTime);
    const editTravelFromInput = document.querySelector('#slideEditTravelFields input[name="travelFrom"]');
    const editTravelToInput = document.querySelector('#slideEditTravelFields input[name="travelTo"]');
    if (editTravelFromInput) {
      editTravelFromInput.addEventListener("change", () => {
        console.log("Edit: Travel From changed, scheduling auto-calc");
        setTimeout(autoCalculateEditTravelTime, 1e3);
      });
    }
    if (editTravelToInput) {
      editTravelToInput.addEventListener("change", () => {
        console.log("Edit: Travel To changed, scheduling auto-calc");
        setTimeout(autoCalculateEditTravelTime, 1e3);
      });
    }
    const manualCalcEditBtn = document.getElementById("manualCalcEditTravelBtn");
    if (manualCalcEditBtn) {
      manualCalcEditBtn.addEventListener("click", () => {
        console.log("Edit: Manual calculate clicked");
        autoCalculateEditTravelTime();
      });
    }
    document.getElementById("slideEditEntryCompanySelect").onchange = (e) => {
      const companyId = parseInt(e.target.value);
      const roleSelect = document.getElementById("slideEditEntryRoleSelect");
      if (!companyId) {
        roleSelect.innerHTML = '<option value="">Select company first...</option>';
        return;
      }
      const filteredRoles = getEntryRolesForCompany(companyId);
      roleSelect.innerHTML = '<option value="">Select role...</option>' + filteredRoles.map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join("");
    };
    attachAllLocationAutocompletes();
    document.getElementById("editEntryFormSlide").onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const existingEntries = getTimesheetEntries(timesheetId);
      const validation = validateEntry({
        date: formData.get("date"),
        startTime: formData.get("startTime"),
        endTime: formData.get("endTime")
      }, existingEntries, entryId, timesheetId);
      if (!validation.valid) {
        showAlert("Entry validation failed:\n\n" + validation.errors.join("\n"));
        return;
      }
      if (validation.warnings && validation.warnings.length > 0) {
        if (!showConfirmation("Warning:\n\n" + validation.warnings.join("\n") + "\n\nContinue anyway?")) {
          return;
        }
      }
      const notesHtml = quillGetHtml(notesEditor) || null;
      const privateNotesHtml = quillGetHtml(privateNotesEditor) || null;
      const locationNotesJson = collectLocationNotes("slideEditLocationNotesContainer");
      try {
        await api.put(`/entries/${entryId}`, {
          entryType: formData.get("entryType"),
          date: formData.get("date"),
          startTime: formData.get("startTime"),
          endTime: formData.get("endTime"),
          companyId: parseInt(formData.get("companyId")),
          roleId: parseInt(formData.get("roleId")),
          startingLocation: formData.get("startingLocation") || null,
          startingLocationLat: formData.get("startingLocationLat") ? parseFloat(formData.get("startingLocationLat")) : null,
          startingLocationLng: formData.get("startingLocationLng") ? parseFloat(formData.get("startingLocationLng")) : null,
          reasonForDeviation: formData.get("reasonForDeviation") || null,
          notes: notesHtml || null,
          privateNotes: privateNotesHtml || null,
          locationNotes: locationNotesJson,
          travelFrom: formData.get("travelFrom"),
          travelFromLat: formData.get("travelFromLat") ? parseFloat(formData.get("travelFromLat")) : null,
          travelFromLng: formData.get("travelFromLng") ? parseFloat(formData.get("travelFromLng")) : null,
          travelTo: formData.get("travelTo"),
          travelToLat: formData.get("travelToLat") ? parseFloat(formData.get("travelToLat")) : null,
          travelToLng: formData.get("travelToLng") ? parseFloat(formData.get("travelToLng")) : null,
          isBillable: formData.get("isBillable") === "on"
        });
        hideSlidePanel();
        if (window.refreshTimesheets) await window.refreshTimesheets();
      } catch (error) {
        showAlert(error.message);
      }
    };
  }
  async function deleteEntryFromCard(entryId, timesheetId) {
    if (!showConfirmation("Delete this entry?")) return;
    try {
      await api.delete(`/entries/${entryId}`);
      hideSlidePanel();
      if (window.refreshTimesheets) await window.refreshTimesheets();
    } catch (error) {
      showAlert(error.message);
    }
  }

  // public/js/modules/features/profile/profile.js
  init_api();
  init_state();
  init_modal();
  init_alerts();
  init_dom();
  async function showMyProfile() {
    let currentUser2;
    try {
      const result = await api.get("/auth/me");
      currentUser2 = result.user;
      state.set("currentUser", currentUser2);
    } catch (error) {
      showAlert("Failed to load profile");
      return;
    }
    const emp = currentUser2.employee;
    const form = `
    <form id="profileForm">
      <div class="form-group">
        <label>Name</label>
        <input type="text" name="name" value="${escapeHtml(currentUser2.name)}" required>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" value="${escapeHtml(currentUser2.email)}" disabled>
        <small>Email cannot be changed</small>
      </div>
      <div class="form-group">
        <label>New Password (leave blank to keep current)</label>
        <input type="password" name="password" minlength="6">
      </div>
      ${emp ? `
        <hr>
        <h3>Employee Details</h3>
        <div class="form-group">
          <label>Phone</label>
          <input type="tel" name="phone" value="${escapeHtml(emp.phone || "")}">
        </div>
        <h3>Time Templates</h3>
        <p><small>Default start/end times for new entries</small></p>
        <div style="display: flex; gap: 1rem;">
          <div style="flex: 1; border: 1px solid #ddd; padding: 0.75rem; border-radius: 4px;">
            <strong>Morning</strong>
            <div class="form-group" style="margin-top: 0.5rem;">
              <label>Start</label>
              <input type="time" name="morningStart" value="${emp.morningStart || "08:30"}">
            </div>
            <div class="form-group">
              <label>End</label>
              <input type="time" name="morningEnd" value="${emp.morningEnd || "12:30"}">
            </div>
          </div>
          <div style="flex: 1; border: 1px solid #ddd; padding: 0.75rem; border-radius: 4px;">
            <strong>Afternoon</strong>
            <div class="form-group" style="margin-top: 0.5rem;">
              <label>Start</label>
              <input type="time" name="afternoonStart" value="${emp.afternoonStart || "13:00"}">
            </div>
            <div class="form-group">
              <label>End</label>
              <input type="time" name="afternoonEnd" value="${emp.afternoonEnd || "17:00"}">
            </div>
          </div>
        </div>
        <h3 style="margin-top: 1.5rem;">Saved Locations</h3>
        <p><small>Quick-select locations when creating entries. These appear in the autocomplete dropdown.</small></p>
        <div id="presetAddressesContainer"></div>
        <button type="button" class="btn btn-sm btn-primary" id="addPresetAddressBtn" style="margin-top: 0.5rem;">+ Add Location</button>
      ` : "<p><em>No employee profile linked to your account.</em></p>"}
      <button type="submit" class="btn btn-primary" style="margin-top: 1rem;">Save Profile</button>
    </form>
  `;
    showModalWithForm("My Profile", form);
    if (emp) {
      const container = document.getElementById("presetAddressesContainer");
      let presets = {};
      if (emp.presetAddresses) {
        try {
          presets = typeof emp.presetAddresses === "string" ? JSON.parse(emp.presetAddresses) : emp.presetAddresses;
        } catch (e) {
        }
      }
      let presetIndex = 0;
      const addPresetRow = (label = "", address = "") => {
        const idx = presetIndex++;
        const row = document.createElement("div");
        row.className = "preset-address-row";
        row.id = `presetRow_${idx}`;
        row.style.cssText = "display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem;";
        row.innerHTML = `
        <input type="text" class="form-control preset-label" placeholder="Label (e.g. Home)" value="${escapeHtml(label || "")}" style="flex:1;">
        <input type="text" class="form-control preset-address" placeholder="Address" value="${escapeHtml(address || "")}" style="flex:2;">
        <button type="button" class="btn btn-sm btn-danger" onclick="document.getElementById('presetRow_${idx}').remove()">X</button>
      `;
        container.appendChild(row);
        const addrInput = row.querySelector(".preset-address");
        if (addrInput) attachLocationAutocomplete(addrInput);
      };
      if (presets && typeof presets === "object") {
        for (const [label, addr] of Object.entries(presets)) {
          addPresetRow(label, addr);
        }
      }
      document.getElementById("addPresetAddressBtn").onclick = () => addPresetRow();
    }
    document.getElementById("profileForm").onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = { name: formData.get("name") };
      const password = formData.get("password");
      if (password) data.password = password;
      if (emp) {
        data.phone = formData.get("phone") || null;
        data.morningStart = formData.get("morningStart");
        data.morningEnd = formData.get("morningEnd");
        data.afternoonStart = formData.get("afternoonStart");
        data.afternoonEnd = formData.get("afternoonEnd");
        const presetObj = {};
        document.querySelectorAll(".preset-address-row").forEach((row) => {
          const label = row.querySelector(".preset-label").value.trim();
          const address = row.querySelector(".preset-address").value.trim();
          if (label && address) presetObj[label] = address;
        });
        data.presetAddresses = Object.keys(presetObj).length > 0 ? presetObj : null;
      }
      try {
        const result = await api.put("/auth/profile", data);
        const updatedUser = result.user;
        state.set("currentUser", updatedUser);
        document.getElementById("userDisplay").textContent = updatedUser.name;
        hideModal();
        showAlert("Profile updated successfully");
      } catch (error) {
        showAlert(error.message);
      }
    };
  }

  // public/js/modules/main.js
  init_api_keys();
  init_wms_sync();

  // public/js/modules/features/wms/wms-comparison.js
  init_api();
  init_modal();
  init_alerts();
  init_dom();
  async function showDeWmsEntries(timesheetId) {
    try {
      const result = await api.get(`/timesheets/${timesheetId}`);
      const ts = result.timesheet;
      const employee = ts.employee;
      let workerId = null;
      if (employee.identifiers) {
        const deId = employee.identifiers.find((i) => i.identifierType === "de_worker_id");
        if (deId) workerId = deId.identifierValue;
      }
      const fromDate = new Date(ts.weekStarting).toISOString().split("T")[0];
      const toDate = new Date(ts.weekEnding).toISOString().split("T")[0];
      let wmsEntries = [];
      let fetchError = null;
      try {
        const params = new URLSearchParams({ fromDate, toDate });
        if (workerId) params.set("workerId", workerId);
        const wmsResult = await api.get(`/tsdata/timesheets?${params.toString()}`);
        wmsEntries = wmsResult.timesheets || [];
      } catch (err) {
        fetchError = err.message;
      }
      const ourEntries = ts.entries.map((e) => ({
        date: new Date(e.date).toLocaleDateString(),
        dateRaw: new Date(e.date).toISOString().split("T")[0],
        startTime: e.startTime || "-",
        endTime: e.endTime || "-",
        hours: e.hours,
        company: e.company.name,
        source: "ours"
      }));
      const wmsFormatted = wmsEntries.map((e) => ({
        date: e.date ? new Date(e.date).toLocaleDateString() : "-",
        dateRaw: e.date ? new Date(e.date).toISOString().split("T")[0] : "",
        startTime: e.startTime || e.start_time || "-",
        endTime: e.endTime || e.end_time || "-",
        hours: e.hours || e.totalHours || 0,
        // XSS FIX: Escape company/school name from WMS data
        company: e.company || e.school || "-",
        source: "wms"
      }));
      const allDates = [.../* @__PURE__ */ new Set([...ourEntries.map((e) => e.dateRaw), ...wmsFormatted.map((e) => e.dateRaw)])].sort();
      let comparisonRows = "";
      for (const date of allDates) {
        const ours = ourEntries.filter((e) => e.dateRaw === date);
        const wms = wmsFormatted.filter((e) => e.dateRaw === date);
        const maxRows = Math.max(ours.length, wms.length, 1);
        for (let i = 0; i < maxRows; i++) {
          const ourEntry = ours[i];
          const wmsEntry = wms[i];
          let status = "";
          if (ourEntry && wmsEntry) {
            const hoursMatch = Math.abs(ourEntry.hours - wmsEntry.hours) < 0.05;
            status = hoursMatch ? '<span class="status-badge status-APPROVED">Matched</span>' : '<span class="status-badge status-INCOMPLETE">Hours Differ</span>';
          } else if (ourEntry && !wmsEntry) {
            status = '<span class="status-badge status-SUBMITTED">Missing in WMS</span>';
          } else {
            status = '<span class="status-badge status-LOCKED">Extra in WMS</span>';
          }
          comparisonRows += `
          <tr>
            ${i === 0 ? `<td rowspan="${maxRows}">${new Date(date).toLocaleDateString()}</td>` : ""}
            <td>${ourEntry ? `${ourEntry.startTime} - ${ourEntry.endTime}` : "-"}</td>
            <td>${ourEntry ? ourEntry.hours.toFixed(2) : "-"}</td>
            <td>${ourEntry ? escapeHtml(ourEntry.company) : "-"}</td>
            <td>${wmsEntry ? `${wmsEntry.startTime} - ${wmsEntry.endTime}` : "-"}</td>
            <td>${wmsEntry ? Number(wmsEntry.hours).toFixed(2) : "-"}</td>
            <td>${wmsEntry ? escapeHtml(wmsEntry.company) : "-"}</td>
            <td>${status}</td>
          </tr>
        `;
        }
      }
      const html = `
      <h3>DE WMS Entry Comparison</h3>
      <p>${escapeHtml(ts.employee.user.name)} &mdash; Week ${new Date(ts.weekStarting).toLocaleDateString()} - ${new Date(ts.weekEnding).toLocaleDateString()}</p>
      ${workerId ? `<p><small>DE Worker ID: ${escapeHtml(workerId)}</small></p>` : '<p style="color: #e67e22;"><small>No DE WMS worker identifier found for this employee. Showing all entries for the date range.</small></p>'}
      ${fetchError ? `<div class="alert alert-danger" style="padding: 0.75rem; background: #f8d7da; border-radius: 4px; margin-bottom: 1rem;">Could not fetch WMS data: ${escapeHtml(fetchError)}</div>` : ""}
      ${allDates.length > 0 ? `
        <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th rowspan="2">Date</th>
              <th colspan="3" style="text-align:center; border-bottom: 2px solid #3498db;">Our Entries</th>
              <th colspan="3" style="text-align:center; border-bottom: 2px solid #e67e22;">DE WMS Entries</th>
              <th rowspan="2">Status</th>
            </tr>
            <tr>
              <th>Time</th>
              <th>Hours</th>
              <th>Company</th>
              <th>Time</th>
              <th>Hours</th>
              <th>Company</th>
            </tr>
          </thead>
          <tbody>
            ${comparisonRows}
          </tbody>
        </table>
        </div>
      ` : "<p>No entries found for comparison.</p>"}
    `;
      showModalWithForm("DE WMS Entries", html);
    } catch (error) {
      showAlert("Failed to load DE WMS comparison: " + error.message);
    }
  }

  // public/js/modules/features/system-tools/system-tools.js
  init_api();
  init_alerts();
  function initSystemTools() {
    const cleanupBtn = document.getElementById("cleanupDuplicatesBtn");
    const repairBtn = document.getElementById("repairStatusBtn");
    const syncBtn = document.getElementById("manualSyncBtn");
    const weekendBtn = document.getElementById("removeWeekendBtn");
    const mergeBtn = document.getElementById("mergeDuplicatesBtn");
    if (cleanupBtn) {
      cleanupBtn.addEventListener("click", runCleanupDuplicates);
    }
    if (repairBtn) {
      repairBtn.addEventListener("click", runRepairStatuses);
    }
    if (syncBtn) {
      syncBtn.addEventListener("click", runManualSync);
    }
    if (weekendBtn) {
      weekendBtn.addEventListener("click", runRemoveWeekendEntries);
    }
    if (mergeBtn) {
      mergeBtn.addEventListener("click", runMergeDuplicateTimesheets);
    }
  }
  async function runCleanupDuplicates() {
    const btn = document.getElementById("cleanupDuplicatesBtn");
    const resultDiv = document.getElementById("cleanupDuplicatesResult");
    btn.disabled = true;
    btn.textContent = "\u{1F504} Running cleanup...";
    resultDiv.innerHTML = '<p style="color: #6b7280;">Processing... This may take a moment.</p>';
    try {
      const result = await api.post("/tsdata/cleanup-duplicates", {});
      resultDiv.innerHTML = `
      <div style="background: #d1fae5; border: 1px solid #10b981; border-radius: 6px; padding: 1rem; color: #065f46;">
        <strong>\u2705 Cleanup completed successfully!</strong>
        <ul style="margin: 0.5rem 0 0 1.5rem; font-size: 0.9rem;">
          <li><strong>${result.duplicatesRemoved || 0}</strong> duplicate TSDATA entries removed</li>
          <li><strong>${result.entriesVerified || 0}</strong> local entries marked as verified</li>
          <li><strong>${result.timesheetsUpdated || 0}</strong> timesheets updated</li>
        </ul>
        ${result.errors > 0 ? `<p style="margin-top: 0.5rem; color: #dc2626;">\u26A0\uFE0F ${result.errors} errors occurred</p>` : ""}
      </div>
    `;
      if (result.duplicatesRemoved > 0 || result.entriesVerified > 0) {
        if (window.refreshTimesheets) {
          await window.refreshTimesheets();
        }
      }
    } catch (error) {
      resultDiv.innerHTML = `
      <div style="background: #fee2e2; border: 1px solid #dc2626; border-radius: 6px; padding: 1rem; color: #991b1b;">
        <strong>\u274C Cleanup failed</strong>
        <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem;">${error.message || "Unknown error occurred"}</p>
      </div>
    `;
      console.error("Cleanup error:", error);
    } finally {
      btn.disabled = false;
      btn.textContent = "\u{1F9F9} Run TSDATA Cleanup";
    }
  }
  async function runRepairStatuses() {
    const btn = document.getElementById("repairStatusBtn");
    const resultDiv = document.getElementById("repairStatusResult");
    btn.disabled = true;
    btn.textContent = "\u{1F504} Repairing statuses...";
    resultDiv.innerHTML = '<p style="color: #6b7280;">Processing... This may take a moment.</p>';
    try {
      const result = await api.post("/timesheets/repair/status-inconsistencies", {});
      resultDiv.innerHTML = `
      <div style="background: #d1fae5; border: 1px solid #10b981; border-radius: 6px; padding: 1rem; color: #065f46;">
        <strong>\u2705 Status repair completed successfully!</strong>
        <ul style="margin: 0.5rem 0 0 1.5rem; font-size: 0.9rem;">
          <li><strong>${result.timesheetsChecked || 0}</strong> timesheets checked</li>
          <li><strong>${result.timesheetsFixed || 0}</strong> timesheets had inconsistencies</li>
          <li><strong>${result.entriesUpdated || 0}</strong> entries updated to match parent status</li>
        </ul>
      </div>
    `;
      if (result.entriesUpdated > 0) {
        if (window.refreshTimesheets) {
          await window.refreshTimesheets();
        }
      }
    } catch (error) {
      resultDiv.innerHTML = `
      <div style="background: #fee2e2; border: 1px solid #dc2626; border-radius: 6px; padding: 1rem; color: #991b1b;">
        <strong>\u274C Status repair failed</strong>
        <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem;">${error.message || "Unknown error occurred"}</p>
      </div>
    `;
      console.error("Status repair error:", error);
    } finally {
      btn.disabled = false;
      btn.textContent = "\u{1F504} Repair Entry Statuses";
    }
  }
  async function runRemoveWeekendEntries() {
    const btn = document.getElementById("removeWeekendBtn");
    const resultDiv = document.getElementById("removeWeekendResult");
    btn.disabled = true;
    btn.textContent = "\u{1F504} Removing weekend entries...";
    resultDiv.innerHTML = '<p style="color: #6b7280;">Processing...</p>';
    try {
      const result = await api.post("/tsdata/remove-weekend-entries", {});
      resultDiv.innerHTML = `
      <div style="background: #d1fae5; border: 1px solid #10b981; border-radius: 6px; padding: 1rem; color: #065f46;">
        <strong>\u2705 Weekend entries removed successfully!</strong>
        <ul style="margin: 0.5rem 0 0 1.5rem; font-size: 0.9rem;">
          <li><strong>${result.weekendEntriesRemoved || 0}</strong> weekend entries deleted</li>
          <li><strong>${result.timesheetsUpdated || 0}</strong> timesheets updated</li>
        </ul>
        <p style="margin-top: 0.5rem; font-size: 0.85rem;">Future TSDATA syncs will automatically skip weekend entries.</p>
      </div>
    `;
      if (result.weekendEntriesRemoved > 0 && window.refreshTimesheets) {
        await window.refreshTimesheets();
      }
    } catch (error) {
      resultDiv.innerHTML = `
      <div style="background: #fee2e2; border: 1px solid #dc2626; border-radius: 6px; padding: 1rem; color: #991b1b;">
        <strong>\u274C Weekend removal failed</strong>
        <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem;">${error.message || "Unknown error occurred"}</p>
      </div>
    `;
      console.error("Weekend removal error:", error);
    } finally {
      btn.disabled = false;
      btn.textContent = "\u{1F4C5} Remove Weekend Entries";
    }
  }
  async function runManualSync() {
    const btn = document.getElementById("manualSyncBtn");
    const resultDiv = document.getElementById("manualSyncResult");
    btn.disabled = true;
    btn.textContent = "\u{1F504} Syncing from TSDATA...";
    resultDiv.innerHTML = '<p style="color: #6b7280;">Processing... This may take several minutes.</p>';
    try {
      const result = await api.post("/tsdata/sync", {});
      resultDiv.innerHTML = `
      <div style="background: #d1fae5; border: 1px solid #10b981; border-radius: 6px; padding: 1rem; color: #065f46;">
        <strong>\u2705 TSDATA sync completed successfully!</strong>
        <ul style="margin: 0.5rem 0 0 1.5rem; font-size: 0.9rem;">
          <li><strong>${result.timesheetsCreated || 0}</strong> timesheets created</li>
          <li><strong>${result.timesheetsUpdated || 0}</strong> timesheets updated</li>
          <li><strong>${result.entriesCreated || 0}</strong> entries created</li>
          <li><strong>${result.entriesUpdated || 0}</strong> entries verified/updated</li>
        </ul>
        ${result.errors && result.errors.length > 0 ? `<p style="margin-top: 0.5rem; color: #dc2626;">\u26A0\uFE0F ${result.errors.length} worker(s) had errors</p>` : ""}
      </div>
    `;
      if (window.refreshTimesheets) {
        await window.refreshTimesheets();
      }
    } catch (error) {
      resultDiv.innerHTML = `
      <div style="background: #fee2e2; border: 1px solid #dc2626; border-radius: 6px; padding: 1rem; color: #991b1b;">
        <strong>\u274C TSDATA sync failed</strong>
        <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem;">${error.message || "Unknown error occurred"}</p>
      </div>
    `;
      console.error("Manual sync error:", error);
    } finally {
      btn.disabled = false;
      btn.textContent = "\u{1F504} Run Manual Sync";
    }
  }
  async function runMergeDuplicateTimesheets() {
    const btn = document.getElementById("mergeDuplicatesBtn");
    const resultDiv = document.getElementById("mergeDuplicatesResult");
    btn.disabled = true;
    btn.textContent = "\u{1F504} Merging duplicate timesheets...";
    resultDiv.innerHTML = '<p style="color: #6b7280;">Processing... This may take a moment.</p>';
    try {
      const result = await api.post("/tsdata/merge-duplicate-timesheets", {});
      resultDiv.innerHTML = `
      <div style="background: #d1fae5; border: 1px solid #10b981; border-radius: 6px; padding: 1rem; color: #065f46;">
        <strong>\u2705 Duplicate timesheets merged successfully!</strong>
        <ul style="margin: 0.5rem 0 0 1.5rem; font-size: 0.9rem;">
          <li><strong>${result.employeesProcessed || 0}</strong> employees processed</li>
          <li><strong>${result.timesheetsMerged || 0}</strong> duplicate timesheets merged</li>
          <li><strong>${result.entriesMoved || 0}</strong> entries moved to kept timesheets</li>
        </ul>
      </div>
    `;
      if (window.refreshTimesheets) {
        await window.refreshTimesheets();
      }
    } catch (error) {
      resultDiv.innerHTML = `
      <div style="background: #fee2e2; border: 1px solid #dc2626; border-radius: 6px; padding: 1rem; color: #991b1b;">
        <strong>\u274C Merge failed</strong>
        <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem;">${error.message || "Unknown error occurred"}</p>
      </div>
    `;
      console.error("Merge duplicates error:", error);
    } finally {
      btn.disabled = false;
      btn.textContent = "\u{1F500} Merge Duplicate Timesheets";
    }
  }

  // public/js/modules/features/xero/xero-setup.js
  init_api();
  init_state();
  init_alerts();
  init_dom();
  init_navigation();
  init_modal();
  var currentSetupTab = "companies";
  var selectedEmployeeTenant = null;
  var selectedRoleTenant = null;
  async function initXeroSetup() {
    await loadXeroStatus();
    await loadMappings();
    setupEventListeners();
    switchSetupTab(currentSetupTab);
  }
  function setupEventListeners() {
    document.getElementById("connectXeroBtn")?.addEventListener("click", initiateXeroConnection);
    document.getElementById("refreshTenantsBtn")?.addEventListener("click", loadXeroStatus);
    document.querySelectorAll(".setup-tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tab = e.target.dataset.setupTab;
        switchSetupTab(tab);
      });
    });
    document.getElementById("employeeTenantSelector")?.addEventListener("change", (e) => {
      selectedEmployeeTenant = e.target.value;
      displayEmployeeMappings();
    });
    document.getElementById("roleTenantSelector")?.addEventListener("change", (e) => {
      selectedRoleTenant = e.target.value;
      displayRoleMappings();
    });
    document.getElementById("leaveTypeTenantSelector")?.addEventListener("change", (e) => {
      selectedLeaveTypeTenant = e.target.value;
      displayLeaveTypeMappings();
    });
  }
  function switchSetupTab(tabName) {
    currentSetupTab = tabName;
    document.querySelectorAll(".setup-tab-btn").forEach((btn) => {
      if (btn.dataset.setupTab === tabName) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
    document.querySelectorAll(".setup-tab-content").forEach((content) => {
      content.classList.remove("active");
      content.style.display = "none";
    });
    const activeContent = document.getElementById(`setup${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`);
    if (activeContent) {
      activeContent.classList.add("active");
      activeContent.style.display = "block";
    }
    if (tabName === "companies") {
      displayCompanyMappings();
    } else if (tabName === "employees") {
      displayEmployeeMappings();
    } else if (tabName === "roles") {
      displayRoleMappings();
    } else if (tabName === "leaveTypes") {
      populateLeaveTypeTenantSelector();
      displayLeaveTypeMappings();
    } else if (tabName === "settings") {
      displayEmployeeSettings();
    }
  }
  async function loadXeroStatus() {
    try {
      const tenants = await api.get("/xero/auth/tenants");
      state.set("xeroTenants", tenants);
      displayConnectionStatus(tenants);
      populateTenantSelectors(tenants);
    } catch (error) {
      console.error("Failed to load Xero status:", error);
      displayConnectionStatus([]);
    }
  }
  function displayConnectionStatus(tenants) {
    const statusDiv = document.getElementById("xeroConnectionStatus");
    const connectBtn = document.getElementById("connectXeroBtn");
    const refreshBtn = document.getElementById("refreshTenantsBtn");
    const activeTenants = tenants.filter((t) => t.isActive);
    const inactiveTenants = tenants.filter((t) => !t.isActive);
    if (tenants.length === 0) {
      statusDiv.innerHTML = `
      <div style="padding: 1rem; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px;">
        <strong>\u26A0\uFE0F Not Connected</strong>
        <p style="margin: 0.5rem 0 0 0; color: #92400e;">
          Connect your Xero account to enable payroll sync.
        </p>
      </div>
    `;
      connectBtn.textContent = "Connect Xero";
      connectBtn.style.display = "inline-block";
      refreshBtn.style.display = "none";
    } else {
      const hasInactive = inactiveTenants.length > 0;
      statusDiv.innerHTML = `
      <div style="padding: 1rem; background: ${hasInactive ? "#fef3c7" : "#d1fae5"}; border: 1px solid ${hasInactive ? "#fcd34d" : "#6ee7b7"}; border-radius: 6px;">
        <strong>${hasInactive ? "\u26A0\uFE0F Partial Connection" : "\u2705 Connected"}</strong>

        ${activeTenants.length > 0 ? `
          <p style="margin: 0.5rem 0 0 0; color: ${hasInactive ? "#92400e" : "#065f46"};">
            <strong>Active (${activeTenants.length}):</strong>
          </p>
          <ul style="margin: 0.25rem 0 0 1.5rem; color: ${hasInactive ? "#92400e" : "#065f46"};">
            ${activeTenants.map((t) => `<li>${escapeHtml(t.tenantName)}</li>`).join("")}
          </ul>
        ` : ""}

        ${hasInactive ? `
          <p style="margin: 0.75rem 0 0 0; color: #dc2626;">
            <strong>Inactive (${inactiveTenants.length}):</strong>
          </p>
          <ul style="margin: 0.25rem 0 0 1.5rem; color: #dc2626;">
            ${inactiveTenants.map((t) => `<li>${escapeHtml(t.tenantName)} - Token expired</li>`).join("")}
          </ul>
          <p style="margin: 0.75rem 0 0 0; color: #92400e;">
            Click "Reconnect All" below to refresh all tenant tokens.
          </p>
        ` : ""}
      </div>
    `;
      if (hasInactive) {
        connectBtn.textContent = "Reconnect All Tenants";
        connectBtn.style.display = "inline-block";
        refreshBtn.style.display = "inline-block";
      } else {
        connectBtn.style.display = "none";
        refreshBtn.style.display = "inline-block";
      }
    }
  }
  function populateTenantSelectors(tenants) {
    const employeeSelector = document.getElementById("employeeTenantSelector");
    const roleSelector = document.getElementById("roleTenantSelector");
    const options = tenants.map(
      (t) => `<option value="${escapeHtml(t.tenantId)}">${escapeHtml(t.tenantName)}</option>`
    ).join("");
    if (employeeSelector) {
      employeeSelector.innerHTML = `<option value="">Select a tenant...</option>${options}`;
    }
    if (roleSelector) {
      roleSelector.innerHTML = `<option value="">Select a tenant...</option>${options}`;
    }
  }
  async function initiateXeroConnection() {
    try {
      const result = await api.get("/xero/auth/connect");
      if (result.authUrl) {
        const width = 600;
        const height = 700;
        const left = screen.width / 2 - width / 2;
        const top = screen.height / 2 - height / 2;
        const popup = window.open(
          result.authUrl,
          "XeroAuth",
          `width=${width},height=${height},left=${left},top=${top}`
        );
        const checkPopup = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkPopup);
            setTimeout(() => {
              loadXeroStatus();
              showAlert("Xero connection successful!", "success");
            }, 1e3);
          }
        }, 500);
      }
    } catch (error) {
      console.error("Failed to initiate Xero connection:", error);
      showAlert("Failed to connect to Xero: " + error.message, "error");
    }
  }
  window.disconnectXeroTenant = async function(tenantId) {
    const confirmed = await showConfirmation(
      "Are you sure you want to disconnect this Xero organization? Sync will stop for all employees."
    );
    if (!confirmed) return;
    try {
      await api.post(`/xero/auth/disconnect/${tenantId}`);
      showAlert("Xero organization disconnected", "success");
      await loadXeroStatus();
      await loadMappings();
    } catch (error) {
      console.error("Failed to disconnect tenant:", error);
      showAlert("Failed to disconnect: " + error.message, "error");
    }
  };
  async function loadMappings() {
    try {
      const mappings = await api.get("/xero/setup/mappings");
      state.set("xeroMappings", mappings);
      const [employees, companies, roles] = await Promise.all([
        api.get("/employees"),
        api.get("/companies"),
        api.get("/roles")
      ]);
      state.set("employees", employees.employees);
      state.set("companies", companies.companies);
      state.set("roles", roles.roles);
    } catch (error) {
      console.error("Failed to load mappings:", error);
    }
  }
  function displayCompanyMappings() {
    const container = document.getElementById("companyMappingList");
    const companies = state.get("companies") || [];
    const tenants = state.get("xeroTenants") || [];
    const mappings = state.get("xeroMappings")?.companies || [];
    if (companies.length === 0) {
      container.innerHTML = "<p>No companies found. Create companies first.</p>";
      return;
    }
    if (tenants.length === 0) {
      container.innerHTML = '<p style="color: #dc2626;">\u26A0\uFE0F No Xero tenants connected. Connect Xero first.</p>';
      return;
    }
    container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Company</th>
          <th>Xero Tenant</th>
          <th>Invoice Rate (LT)</th>
          <th>Xero Contact</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${companies.map((company) => {
      const mapping = mappings.find((m) => m.companyId === company.id);
      const tenant = mapping ? tenants.find((t) => t.id === mapping.xeroTokenId) : null;
      return `
            <tr>
              <td>${escapeHtml(company.name)}</td>
              <td>
                ${tenant ? escapeHtml(tenant.tenantName) : '<span style="color: #9ca3af;">Not mapped</span>'}
              </td>
              <td>
                ${mapping?.invoiceRate ? `$${mapping.invoiceRate.toFixed(2)}/hr` : "-"}
              </td>
              <td>
                ${mapping?.xeroContactId ? escapeHtml(mapping.xeroContactId) : "-"}
              </td>
              <td>
                <button class="btn btn-sm btn-primary" onclick="window.editCompanyMapping(${company.id})">
                  ${mapping ? "Edit" : "Map"}
                </button>
              </td>
            </tr>
          `;
    }).join("")}
      </tbody>
    </table>
  `;
  }
  window.editCompanyMapping = async function(companyId) {
    const companies = state.get("companies") || [];
    const tenants = state.get("xeroTenants") || [];
    const mappings = state.get("xeroMappings")?.companies || [];
    const company = companies.find((c) => c.id === companyId);
    const mapping = mappings.find((m) => m.companyId === companyId);
    if (!company) return;
    const { showModalWithForm: showModalWithForm2, hideModal: hideModal2 } = await Promise.resolve().then(() => (init_modal(), modal_exports));
    const form = `
    <form id="companyMappingForm">
      <div class="form-group">
        <label>Company</label>
        <input type="text" value="${escapeHtml(company.name)}" disabled>
      </div>
      <div class="form-group">
        <label>Xero Tenant *</label>
        <select name="xeroTenantId" required>
          <option value="">Select tenant...</option>
          ${tenants.map((t) => `
            <option value="${escapeHtml(t.tenantId)}" ${mapping?.xeroTenantId === t.tenantId ? "selected" : ""}>
              ${escapeHtml(t.tenantName)}
            </option>
          `).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>Invoice Rate (for Local Technicians)</label>
        <input type="number" name="invoiceRate" step="0.01" min="0"
               value="${mapping?.invoiceRate || ""}"
               placeholder="150.00">
        <small>Hourly rate for LT invoice generation (optional)</small>
      </div>
      <div class="form-group">
        <label>Xero Contact ID (for invoicing)</label>
        <input type="text" name="xeroContactId"
               value="${mapping?.xeroContactId || ""}"
               placeholder="Optional">
        <small>Leave blank to select later</small>
      </div>
      <button type="submit" class="btn btn-primary">Save Mapping</button>
    </form>
  `;
    showModalWithForm2(`Map Company: ${company.name}`, form);
    document.getElementById("companyMappingForm").onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      try {
        const xeroTenantId = formData.get("xeroTenantId");
        const xeroToken = tenants.find((t) => t.tenantId === xeroTenantId);
        await api.post("/xero/setup/company-mapping", {
          companyId: company.id,
          xeroTokenId: xeroToken.id,
          xeroTenantId,
          invoiceRate: formData.get("invoiceRate") || null,
          xeroContactId: formData.get("xeroContactId") || null
        });
        showAlert("Company mapping saved successfully", "success");
        await loadMappings();
        displayCompanyMappings();
        hideModal2();
      } catch (error) {
        console.error("Failed to save company mapping:", error);
        showAlert("Failed to save mapping: " + error.message, "error");
      }
    };
  };
  async function displayEmployeeMappings() {
    const container = document.getElementById("employeeMappingList");
    const employees = state.get("employees") || [];
    const mappings = state.get("xeroMappings")?.employees || [];
    if (!selectedEmployeeTenant) {
      container.innerHTML = '<p style="color: #6b7280;">Select a Xero tenant to view/edit employee mappings.</p>';
      return;
    }
    container.innerHTML = "<p>Loading Xero employees...</p>";
    try {
      const xeroEmployees = await api.get(`/xero/setup/employees/${selectedEmployeeTenant}`);
      state.set("xeroEmployees", xeroEmployees);
      container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Local Employee</th>
            <th>Xero Employee</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${employees.map((employee) => {
        const mapping = mappings.find(
          (m) => m.employeeId === employee.id && m.identifierType === "xero_employee_id"
        );
        const xeroEmp = mapping ? xeroEmployees.find(
          (xe) => (xe.EmployeeID || xe.employeeID) === mapping.identifierValue
        ) : null;
        return `
              <tr>
                <td>${escapeHtml(employee.firstName)} ${escapeHtml(employee.lastName)}</td>
                <td>
                  ${xeroEmp ? `${escapeHtml(xeroEmp.FirstName || xeroEmp.firstName || "")} ${escapeHtml(xeroEmp.LastName || xeroEmp.lastName || "")}` : '<span style="color: #9ca3af;">Not mapped</span>'}
                </td>
                <td>
                  ${mapping ? '<span style="color: #10b981;">\u2713 Mapped</span>' : '<span style="color: #f59e0b;">\u26A0 Unmapped</span>'}
                </td>
                <td>
                  <button class="btn btn-sm btn-primary" onclick="window.editEmployeeMapping(${employee.id})">
                    ${mapping ? "Change" : "Map"}
                  </button>
                </td>
              </tr>
            `;
      }).join("")}
        </tbody>
      </table>
    `;
    } catch (error) {
      console.error("Failed to load Xero employees:", error);
      container.innerHTML = `<p style="color: #dc2626;">Failed to load Xero employees: ${escapeHtml(error.message)}</p>`;
    }
  }
  window.editEmployeeMapping = async function(employeeId) {
    const employees = state.get("employees") || [];
    const mappings = state.get("xeroMappings")?.employees || [];
    const employee = employees.find((e) => e.id === employeeId);
    const mapping = mappings.find(
      (m) => m.employeeId === employeeId && m.identifierType === "xero_employee_id"
    );
    if (!employee) return;
    if (!selectedEmployeeTenant) {
      showAlert("Please select a Xero tenant first", "error");
      return;
    }
    const { showModalWithForm: showModalWithForm2, hideModal: hideModal2 } = await Promise.resolve().then(() => (init_modal(), modal_exports));
    try {
      const xeroEmployees = await api.get(`/xero/setup/employees/${selectedEmployeeTenant}`);
      const form = `
      <form id="employeeMappingForm">
        <div class="form-group">
          <label>Local Employee</label>
          <input type="text" value="${escapeHtml(employee.firstName)} ${escapeHtml(employee.lastName)}" disabled>
        </div>
        <div class="form-group">
          <label>Xero Employee *</label>
          <select name="xeroEmployeeId" required>
            <option value="">Select Xero employee...</option>
            ${xeroEmployees.filter((xe) => xe.employeeID || xe.EmployeeID).map((xe) => {
        const empId = xe.employeeID || xe.EmployeeID;
        const firstName = xe.firstName || xe.FirstName || "";
        const lastName = xe.lastName || xe.LastName || "";
        return `
                <option value="${escapeHtml(empId)}" ${mapping?.identifierValue === empId ? "selected" : ""}>
                  ${escapeHtml(firstName)} ${escapeHtml(lastName)} (${escapeHtml(empId.substring(0, 8))})
                </option>
              `;
      }).join("")}
          </select>
        </div>
        <button type="submit" class="btn btn-primary">Save Mapping</button>
      </form>
    `;
      showModalWithForm2(`Map Employee: ${employee.firstName} ${employee.lastName}`, form);
      document.getElementById("employeeMappingForm").onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        try {
          await api.post("/xero/setup/employees/map", {
            employeeId: employee.id,
            xeroEmployeeId: formData.get("xeroEmployeeId"),
            companyId: null
          });
          showAlert("Employee mapping saved successfully", "success");
          await loadMappings();
          displayEmployeeMappings();
          hideModal2();
        } catch (error) {
          console.error("Failed to save employee mapping:", error);
          showAlert("Failed to save mapping: " + error.message, "error");
        }
      };
    } catch (error) {
      console.error("Failed to load Xero employees:", error);
      showAlert("Failed to load Xero employees: " + error.message, "error");
    }
  };
  async function displayRoleMappings() {
    const container = document.getElementById("roleMappingList");
    const roles = state.get("roles") || [];
    const mappings = state.get("xeroMappings")?.earningsRates || [];
    if (!selectedRoleTenant) {
      container.innerHTML = '<p style="color: #6b7280;">Select a Xero tenant to view/edit role mappings.</p>';
      return;
    }
    container.innerHTML = "<p>Loading Xero earnings rates...</p>";
    try {
      const earningsRates = await api.get(`/xero/setup/earnings-rates/${selectedRoleTenant}`);
      state.set("xeroEarningsRates", earningsRates);
      container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Local Role</th>
            <th>Company</th>
            <th>Xero Earnings Rate</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${roles.map((role) => {
        const mapping = mappings.find(
          (m) => m.roleId === role.id && m.xeroTenantId === selectedRoleTenant
        );
        const earningsRate = mapping ? earningsRates.find(
          (er) => (er.EarningsRateID || er.earningsRateID) === mapping.xeroEarningsRateId
        ) : null;
        return `
              <tr>
                <td>${escapeHtml(role.name)}</td>
                <td>${escapeHtml(role.company?.name || "N/A")}</td>
                <td>
                  ${earningsRate ? escapeHtml(earningsRate.Name || earningsRate.name || "(Unnamed)") : '<span style="color: #9ca3af;">Not mapped</span>'}
                </td>
                <td>
                  ${mapping ? '<span style="color: #10b981;">\u2713 Mapped</span>' : '<span style="color: #f59e0b;">\u26A0 Unmapped</span>'}
                </td>
                <td>
                  <button class="btn btn-sm btn-primary" onclick="window.editRoleMapping(${role.id})">
                    ${mapping ? "Change" : "Map"}
                  </button>
                </td>
              </tr>
            `;
      }).join("")}
        </tbody>
      </table>
    `;
    } catch (error) {
      console.error("Failed to load earnings rates:", error);
      container.innerHTML = `<p style="color: #dc2626;">Failed to load earnings rates: ${escapeHtml(error.message)}</p>`;
    }
  }
  window.editRoleMapping = async function(roleId) {
    const roles = state.get("roles") || [];
    const earningsRates = state.get("xeroEarningsRates") || [];
    const mappings = state.get("xeroMappings")?.earningsRates || [];
    const role = roles.find((r) => r.id === roleId);
    const mapping = mappings.find(
      (m) => m.roleId === roleId && m.xeroTenantId === selectedRoleTenant
    );
    if (!role) return;
    const { showModalWithForm: showModalWithForm2, hideModal: hideModal2 } = await Promise.resolve().then(() => (init_modal(), modal_exports));
    const form = `
    <form id="roleMappingForm">
      <div class="form-group">
        <label>Local Role</label>
        <input type="text" value="${escapeHtml(role.name)} (${escapeHtml(role.company?.name || "N/A")})" disabled>
      </div>
      <div class="form-group">
        <label>Xero Earnings Rate *</label>
        <select name="xeroEarningsRateId" required>
          <option value="">Select earnings rate...</option>
          ${earningsRates.map((er) => {
      const rateId = er.EarningsRateID || er.earningsRateID;
      const name = er.Name || er.name || "(Unnamed)";
      const rateType = er.RateType || er.rateType || "Standard";
      return `
              <option value="${escapeHtml(rateId)}" ${mapping?.xeroEarningsRateId === rateId ? "selected" : ""}>
                ${escapeHtml(name)} (${escapeHtml(rateType)})
              </option>
            `;
    }).join("")}
        </select>
      </div>
      <button type="submit" class="btn btn-primary">Save Mapping</button>
    </form>
  `;
    showModalWithForm2(`Map Role: ${role.name}`, form);
    document.getElementById("roleMappingForm").onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      try {
        const xeroEarningsRateId = formData.get("xeroEarningsRateId");
        const earningsRate = earningsRates.find(
          (er) => (er.EarningsRateID || er.earningsRateID) === xeroEarningsRateId
        );
        await api.post("/xero/setup/earnings-rates/map", {
          roleId: role.id,
          xeroTenantId: selectedRoleTenant,
          xeroEarningsRateId,
          earningsRateName: earningsRate.Name || earningsRate.name
        });
        showAlert("Role mapping saved successfully", "success");
        await loadMappings();
        displayRoleMappings();
        hideModal2();
      } catch (error) {
        console.error("Failed to save role mapping:", error);
        showAlert("Failed to save mapping: " + error.message, "error");
      }
    };
  };
  function displayEmployeeSettings() {
    const container = document.getElementById("employeeSettingsList");
    const employees = state.get("employees") || [];
    const settings = state.get("xeroMappings")?.settings || [];
    container.innerHTML = `
    <h3 style="margin-bottom: 1rem;">General Settings</h3>
    <table>
      <thead>
        <tr>
          <th>Employee</th>
          <th>Type</th>
          <th>Salaried</th>
          <th>Auto-Approve</th>
          <th>Sync Enabled</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${employees.map((employee) => {
      const empSettings = settings.find((s) => s.employeeId === employee.id);
      return `
            <tr>
              <td>${escapeHtml(employee.firstName)} ${escapeHtml(employee.lastName)}</td>
              <td>
                ${empSettings?.employeeType === "LT" ? '<span style="color: #3b82f6;">Local Tech</span>' : '<span style="color: #10b981;">Specialist Tech</span>'}
              </td>
              <td>
                ${empSettings?.isSalaried ? '<span style="color: #f59e0b;">\u2713 Salaried</span>' : "\u2717 No"}
              </td>
              <td>${empSettings?.autoApprove ? "\u2713 Yes" : "\u2717 No"}</td>
              <td>${empSettings?.syncEnabled !== false ? "\u2713 Enabled" : "\u2717 Disabled"}</td>
              <td>
                <button class="btn btn-sm btn-primary" onclick="window.editEmployeeSettings(${employee.id})">
                  Configure
                </button>
              </td>
            </tr>
          `;
    }).join("")}
      </tbody>
    </table>

    <h3 style="margin: 2rem 0 1rem 0;">Employee-Specific Earnings Rates</h3>
    <p style="color: #6b7280; margin-bottom: 1rem;">
      Override the default earnings rate for specific employees. If not set, the role's default rate is used.
    </p>
    <div id="employeeEarningsRatesList"></div>
  `;
    displayEmployeeEarningsRates();
  }
  function displayEmployeeEarningsRates() {
    const container = document.getElementById("employeeEarningsRatesList");
    const employees = state.get("employees") || [];
    const roles = state.get("roles") || [];
    const earningsRateMappings = state.get("xeroMappings")?.earningsRates || [];
    const employeeEarningsRates = state.get("xeroMappings")?.employeeEarningsRates || [];
    const tenants = state.get("xeroTenants") || [];
    if (tenants.length === 0) {
      container.innerHTML = '<p style="color: #6b7280;">Connect to Xero first to configure earnings rates.</p>';
      return;
    }
    const employeeRoles = [];
    employees.forEach((employee) => {
      employee.roles?.forEach((empRole) => {
        const role = roles.find((r) => r.id === empRole.roleId);
        if (role) {
          employeeRoles.push({
            employee,
            role,
            empRole
          });
        }
      });
    });
    if (employeeRoles.length === 0) {
      container.innerHTML = '<p style="color: #6b7280;">No employee role assignments found.</p>';
      return;
    }
    container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Employee</th>
          <th>Role</th>
          <th>Xero Tenant</th>
          <th>Current Rate</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${employeeRoles.map(({ employee, role }) => {
      return tenants.filter((t) => t.isActive).map((tenant) => {
        const customRate = employeeEarningsRates.find(
          (er) => er.employeeId === employee.id && er.roleId === role.id && er.xeroTenantId === tenant.tenantId
        );
        const defaultRate = earningsRateMappings.find(
          (m) => m.roleId === role.id && m.xeroTenantId === tenant.tenantId
        );
        const currentRate = customRate || defaultRate;
        const isCustom = !!customRate;
        return `
              <tr>
                <td>${escapeHtml(employee.firstName)} ${escapeHtml(employee.lastName)}</td>
                <td>${escapeHtml(role.name)}</td>
                <td>${escapeHtml(tenant.tenantName)}</td>
                <td>
                  ${currentRate ? `
                    <span style="${isCustom ? "color: #3b82f6; font-weight: 500;" : ""}">
                      ${escapeHtml(currentRate.earningsRateName)}
                    </span>
                    ${isCustom ? '<span style="color: #3b82f6; font-size: 0.75rem; margin-left: 0.5rem;">(CUSTOM)</span>' : ""}
                    ${!isCustom ? '<span style="color: #6b7280; font-size: 0.75rem; margin-left: 0.5rem;">(default)</span>' : ""}
                  ` : '<span style="color: #dc2626;">Not mapped</span>'}
                </td>
                <td>
                  ${currentRate ? `
                    <button class="btn btn-sm btn-primary"
                      onclick="window.setCustomEarningsRate(${employee.id}, ${role.id}, '${tenant.tenantId}', '${tenant.tenantName}')">
                      ${isCustom ? "Change" : "Set Custom"}
                    </button>
                    ${isCustom ? `
                      <button class="btn btn-sm btn-secondary"
                        onclick="window.removeCustomEarningsRate(${customRate.id}, ${employee.id}, ${role.id})">
                        Revert to Default
                      </button>
                    ` : ""}
                  ` : '<span style="color: #9ca3af;">Map role first</span>'}
                </td>
              </tr>
            `;
      }).join("");
    }).join("")}
      </tbody>
    </table>
  `;
  }
  window.setCustomEarningsRate = async function(employeeId, roleId, xeroTenantId, tenantName) {
    const employees = state.get("employees") || [];
    const roles = state.get("roles") || [];
    const employee = employees.find((e) => e.id === employeeId);
    const role = roles.find((r) => r.id === roleId);
    if (!employee || !role) return;
    const { showModalWithForm: showModalWithForm2, hideModal: hideModal2 } = await Promise.resolve().then(() => (init_modal(), modal_exports));
    try {
      const earningsRates = await api.get(`/xero/setup/earnings-rates/${xeroTenantId}`);
      const form = `
      <form id="customEarningsRateForm">
        <div class="form-group">
          <label>Employee</label>
          <input type="text" value="${escapeHtml(employee.firstName)} ${escapeHtml(employee.lastName)}" disabled>
        </div>
        <div class="form-group">
          <label>Role</label>
          <input type="text" value="${escapeHtml(role.name)}" disabled>
        </div>
        <div class="form-group">
          <label>Xero Tenant</label>
          <input type="text" value="${escapeHtml(tenantName)}" disabled>
        </div>
        <div class="form-group">
          <label>Custom Earnings Rate *</label>
          <select name="xeroEarningsRateId" required>
            <option value="">Select earnings rate...</option>
            ${earningsRates.map((er) => {
        const rateId = er.EarningsRateID || er.earningsRateID;
        const name = er.Name || er.name || "(Unnamed)";
        const rateType = er.RateType || er.rateType || "Standard";
        return `
                <option value="${escapeHtml(rateId)}">
                  ${escapeHtml(name)} (${escapeHtml(rateType)})
                </option>
              `;
      }).join("")}
          </select>
          <small>This will override the role's default rate for this employee</small>
        </div>
        <button type="submit" class="btn btn-primary">Save Custom Rate</button>
      </form>
    `;
      showModalWithForm2(`Set Custom Rate: ${employee.firstName} ${employee.lastName}`, form);
      document.getElementById("customEarningsRateForm").onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        try {
          const xeroEarningsRateId = formData.get("xeroEarningsRateId");
          const earningsRate = earningsRates.find(
            (er) => (er.EarningsRateID || er.earningsRateID) === xeroEarningsRateId
          );
          await api.post("/xero/setup/employee-earnings-rate", {
            employeeId,
            roleId,
            xeroTenantId,
            xeroEarningsRateId,
            earningsRateName: earningsRate.Name || earningsRate.name
          });
          showAlert("Custom earnings rate saved successfully", "success");
          await loadMappings();
          displayEmployeeSettings();
          hideModal2();
        } catch (error) {
          console.error("Failed to save custom earnings rate:", error);
          showAlert("Failed to save custom rate: " + error.message, "error");
        }
      };
    } catch (error) {
      console.error("Failed to load earnings rates:", error);
      showAlert("Failed to load earnings rates: " + error.message, "error");
    }
  };
  window.removeCustomEarningsRate = async function(customRateId, employeeId, roleId) {
    const employees = state.get("employees") || [];
    const roles = state.get("roles") || [];
    const employee = employees.find((e) => e.id === employeeId);
    const role = roles.find((r) => r.id === roleId);
    const confirmed = confirm(
      `Remove custom earnings rate for ${employee.firstName} ${employee.lastName} - ${role.name}?

This will revert to using the role's default rate.`
    );
    if (!confirmed) return;
    try {
      await api.delete(`/xero/setup/employee-earnings-rate/${customRateId}`);
      showAlert("Custom earnings rate removed - reverted to role default", "success");
      await loadMappings();
      displayEmployeeSettings();
    } catch (error) {
      console.error("Failed to remove custom earnings rate:", error);
      showAlert("Failed to remove custom rate: " + error.message, "error");
    }
  };
  window.editEmployeeSettings = async function(employeeId) {
    const employees = state.get("employees") || [];
    const settings = state.get("xeroMappings")?.settings || [];
    const employee = employees.find((e) => e.id === employeeId);
    const empSettings = settings.find((s) => s.employeeId === employeeId);
    if (!employee) return;
    const { showModalWithForm: showModalWithForm2, hideModal: hideModal2 } = await Promise.resolve().then(() => (init_modal(), modal_exports));
    const form = `
    <form id="employeeSettingsForm">
      <div class="form-group">
        <label>Employee</label>
        <input type="text" value="${escapeHtml(employee.firstName)} ${escapeHtml(employee.lastName)}" disabled>
      </div>
      <div class="form-group">
        <label>Employee Type *</label>
        <select name="employeeType" required>
          <option value="ST" ${!empSettings || empSettings.employeeType === "ST" ? "selected" : ""}>
            Specialist Tech (ST) - Payroll only
          </option>
          <option value="LT" ${empSettings?.employeeType === "LT" ? "selected" : ""}>
            Local Tech (LT) - Payroll + Monthly Invoices
          </option>
        </select>
        <small>LT employees will have monthly invoices generated for client billing</small>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" name="autoApprove" ${empSettings?.autoApprove ? "checked" : ""}>
          Auto-approve timesheets (skip manual approval)
        </label>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" name="syncEnabled" ${empSettings?.syncEnabled !== false ? "checked" : ""}>
          Enable Xero sync for this employee
        </label>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" name="isSalaried" ${empSettings?.isSalaried ? "checked" : ""}>
          Employee is salaried (skip timesheet sync)
        </label>
        <small>Salaried employees won't have timesheets synced to Xero, but can still create timesheets for tracking</small>
      </div>
      <button type="submit" class="btn btn-primary">Save Settings</button>
    </form>
  `;
    showModalWithForm2(`Configure: ${employee.firstName} ${employee.lastName}`, form);
    document.getElementById("employeeSettingsForm").onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      try {
        await api.post("/xero/setup/employee-settings", {
          employeeId: employee.id,
          employeeType: formData.get("employeeType"),
          autoApprove: formData.get("autoApprove") === "on",
          syncEnabled: formData.get("syncEnabled") === "on",
          isSalaried: formData.get("isSalaried") === "on"
        });
        showAlert("Employee settings saved successfully", "success");
        await loadMappings();
        displayEmployeeSettings();
        hideModal2();
      } catch (error) {
        console.error("Failed to save employee settings:", error);
        showAlert("Failed to save settings: " + error.message, "error");
      }
    };
  };
  registerTabHook("xeroSetup", initXeroSetup);
  var selectedLeaveTypeTenant = null;
  async function displayLeaveTypeMappings() {
    const container = document.getElementById("leaveTypeMappingsList");
    if (!container) return;
    if (!selectedLeaveTypeTenant) {
      container.innerHTML = '<p style="color: #6b7280;">Please select a Xero tenant above.</p>';
      return;
    }
    try {
      const xeroLeaveTypes = await api.get(`/xero/setup/leave-types/${selectedLeaveTypeTenant}`);
      const mappings = state.get("xeroMappings") || {};
      const leaveTypeMappings = mappings.leaveTypes || [];
      const internalLeaveTypes = [
        { code: "ANNUAL", name: "Annual Leave" },
        { code: "SICK", name: "Sick Leave" },
        { code: "PERSONAL", name: "Personal Leave" },
        { code: "UNPAID", name: "Unpaid Leave" }
      ];
      container.innerHTML = `
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
            <th style="padding: 1rem; text-align: left;">Leave Type</th>
            <th style="padding: 1rem; text-align: left;">Xero Leave Type</th>
            <th style="padding: 1rem; text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${internalLeaveTypes.map((leaveType) => {
        const mapping = leaveTypeMappings.find(
          (m) => m.xeroTenantId === selectedLeaveTypeTenant && m.leaveType === leaveType.code
        );
        return `
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 1rem; font-weight: 500;">${leaveType.name}</td>
                <td style="padding: 1rem;">
                  ${mapping ? `
                    <span style="color: #10b981;">\u2713 ${mapping.leaveTypeName}</span>
                  ` : `
                    <span style="color: #f59e0b;">Not mapped</span>
                  `}
                </td>
                <td style="padding: 1rem; text-align: right;">
                  <button
                    class="btn btn-sm btn-primary"
                    onclick="xeroSetup.editLeaveTypeMapping('${leaveType.code}', '${leaveType.name}')"
                  >
                    ${mapping ? "Change" : "Map"}
                  </button>
                </td>
              </tr>
            `;
      }).join("")}
        </tbody>
      </table>
    `;
    } catch (error) {
      console.error("[XeroSetup] Error displaying leave type mappings:", error);
      showAlert("Failed to load leave type mappings", "error");
    }
  }
  window.xeroSetup = window.xeroSetup || {};
  window.xeroSetup.editLeaveTypeMapping = async function(leaveTypeCode, leaveTypeName) {
    if (!selectedLeaveTypeTenant) {
      showAlert("Please select a Xero tenant first", "error");
      return;
    }
    try {
      const xeroTypes = await api.get(`/xero/setup/leave-types/${selectedLeaveTypeTenant}`);
      const mappings = state.get("xeroMappings") || {};
      const leaveTypeMappings = mappings.leaveTypes || [];
      const currentMapping = leaveTypeMappings.find(
        (m) => m.xeroTenantId === selectedLeaveTypeTenant && m.leaveType === leaveTypeCode
      );
      const modalContent = `
      <h2>Map ${leaveTypeName}</h2>
      <form id="leave-type-mapping-form">
        <input type="hidden" name="leaveType" value="${leaveTypeCode}" />

        <div class="form-group">
          <label>Xero Leave Type</label>
          <select name="xeroLeaveTypeId" class="form-control" required>
            <option value="">Select Xero leave type...</option>
            ${xeroTypes.map((lt) => {
        const ltId = lt.leaveTypeID || lt.LeaveTypeID;
        const ltName = lt.name || lt.Name || "(Unnamed)";
        const selected = currentMapping && currentMapping.xeroLeaveTypeId === ltId ? "selected" : "";
        return `<option value="${ltId}" ${selected}>${ltName}</option>`;
      }).join("")}
          </select>
        </div>

        <div class="form-actions" style="margin-top: 1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="hideModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Mapping</button>
        </div>
      </form>
    `;
      showModalWithForm("Map Leave Type", modalContent);
      document.getElementById("leave-type-mapping-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const xeroLeaveTypeId = formData.get("xeroLeaveTypeId");
        const selectedType = xeroTypes.find(
          (lt) => (lt.leaveTypeID || lt.LeaveTypeID) === xeroLeaveTypeId
        );
        const leaveTypeNameXero = selectedType ? selectedType.name || selectedType.Name : "";
        try {
          await api.post("/xero/setup/leave-type-mapping", {
            xeroTenantId: selectedLeaveTypeTenant,
            leaveType: leaveTypeCode,
            xeroLeaveTypeId,
            leaveTypeName: leaveTypeNameXero
          });
          showAlert(`${leaveTypeName} mapped successfully!`, "success");
          hideModal();
          await loadMappings();
          await displayLeaveTypeMappings();
        } catch (error) {
          console.error("[XeroSetup] Error saving leave type mapping:", error);
          showAlert("Failed to save mapping", "error");
        }
      });
    } catch (error) {
      console.error("[XeroSetup] Error loading leave types:", error);
      showAlert("Failed to load Xero leave types", "error");
    }
  };
  function populateLeaveTypeTenantSelector() {
    const selector = document.getElementById("leaveTypeTenantSelector");
    if (!selector) return;
    const tenants = state.get("xeroTenants") || [];
    selector.innerHTML = '<option value="">Select tenant...</option>' + tenants.map((t) => `<option value="${t.tenantId}">${t.tenantName}</option>`).join("");
    if (tenants.length === 1) {
      selector.value = tenants[0].tenantId;
      selectedLeaveTypeTenant = tenants[0].tenantId;
      displayLeaveTypeMappings();
    } else if (selectedLeaveTypeTenant) {
      selector.value = selectedLeaveTypeTenant;
    }
  }

  // public/js/modules/features/xero/xero-sync-logs.js
  init_api();
  init_state();
  init_alerts();
  init_dom();
  init_navigation();
  var currentFilters = {
    status: "",
    type: ""
  };
  async function initXeroSyncLogs() {
    setupEventListeners2();
    await loadSyncStats();
    await loadSyncLogs();
  }
  function setupEventListeners2() {
    document.getElementById("refreshSyncLogsBtn")?.addEventListener("click", async () => {
      await loadSyncStats();
      await loadSyncLogs();
    });
    document.getElementById("syncLogStatusFilter")?.addEventListener("change", (e) => {
      currentFilters.status = e.target.value;
      loadSyncLogs();
    });
    document.getElementById("syncLogTypeFilter")?.addEventListener("change", (e) => {
      currentFilters.type = e.target.value;
      loadSyncLogs();
    });
  }
  async function loadSyncStats() {
    try {
      const stats = await api.get("/xero/sync/stats");
      displaySyncStats(stats);
    } catch (error) {
      console.error("Failed to load sync stats:", error);
    }
  }
  function displaySyncStats(stats) {
    const container = document.getElementById("syncStatsCards");
    container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
      <div class="stat-card" style="padding: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; color: white;">
        <div style="font-size: 2rem; font-weight: bold;">${stats.total || 0}</div>
        <div style="opacity: 0.9;">Total Syncs</div>
      </div>

      <div class="stat-card" style="padding: 1rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px; color: white;">
        <div style="font-size: 2rem; font-weight: bold;">${stats.successful || 0}</div>
        <div style="opacity: 0.9;">Successful</div>
        <div style="font-size: 0.875rem; opacity: 0.8; margin-top: 0.25rem;">
          ${stats.total > 0 ? Math.round(stats.successRate) : 0}% success rate
        </div>
      </div>

      <div class="stat-card" style="padding: 1rem; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 8px; color: white;">
        <div style="font-size: 2rem; font-weight: bold;">${stats.failed || 0}</div>
        <div style="opacity: 0.9;">Failed</div>
      </div>

      <div class="stat-card" style="padding: 1rem; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 8px; color: white;">
        <div style="font-size: 2rem; font-weight: bold;">${stats.pending || 0}</div>
        <div style="opacity: 0.9;">Pending</div>
      </div>
    </div>

    ${stats.recentFailures && stats.recentFailures.length > 0 ? `
      <div style="margin-top: 1.5rem; padding: 1rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
        <h4 style="margin: 0 0 0.5rem 0; color: #dc2626;">Recent Failures (${stats.recentFailures.length})</h4>
        <div style="font-size: 0.875rem;">
          ${stats.recentFailures.slice(0, 5).map((failure) => `
            <div style="padding: 0.5rem 0; border-bottom: 1px solid #fecaca;">
              <strong>${escapeHtml(failure.timesheet?.employee?.firstName || "Unknown")} ${escapeHtml(failure.timesheet?.employee?.lastName || "")}</strong>
              - Week ${failure.timesheet?.weekStarting ? new Date(failure.timesheet.weekStarting).toLocaleDateString() : "Unknown"}
              <div style="color: #991b1b; margin-top: 0.25rem;">${escapeHtml(failure.errorMessage || "Unknown error")}</div>
            </div>
          `).join("")}
        </div>
      </div>
    ` : ""}
  `;
  }
  async function loadSyncLogs() {
    try {
      const params = new URLSearchParams({
        limit: "50",
        offset: "0",
        ...currentFilters.status && { status: currentFilters.status },
        ...currentFilters.type && { syncType: currentFilters.type }
      });
      const result = await api.get(`/xero/sync/logs?${params}`);
      displaySyncLogs(result.logs);
    } catch (error) {
      console.error("Failed to load sync logs:", error);
    }
  }
  function displaySyncLogs(logs) {
    const container = document.getElementById("syncLogsList");
    if (!logs || logs.length === 0) {
      container.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 2rem;">No sync logs found.</p>';
      return;
    }
    container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Date/Time</th>
          <th>Type</th>
          <th>Employee</th>
          <th>Week</th>
          <th>Records</th>
          <th>Status</th>
          <th>Duration</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${logs.map((log) => {
      const statusColors = {
        SUCCESS: "#10b981",
        ERROR: "#ef4444",
        PENDING: "#f59e0b",
        PARTIAL: "#3b82f6"
      };
      const statusColor = statusColors[log.status] || "#6b7280";
      const duration = log.completedAt && log.startedAt ? Math.round((new Date(log.completedAt) - new Date(log.startedAt)) / 1e3) : null;
      return `
            <tr>
              <td>${new Date(log.startedAt).toLocaleString()}</td>
              <td>${escapeHtml(log.syncType)}</td>
              <td>
                ${log.timesheet?.employee ? `${escapeHtml(log.timesheet.employee.firstName)} ${escapeHtml(log.timesheet.employee.lastName)}` : "-"}
              </td>
              <td>
                ${log.timesheet?.weekStarting ? new Date(log.timesheet.weekStarting).toLocaleDateString() : "-"}
              </td>
              <td>
                <span title="Processed: ${log.recordsProcessed}, Success: ${log.recordsSuccess}, Failed: ${log.recordsFailed}">
                  ${log.recordsSuccess}/${log.recordsProcessed}
                </span>
              </td>
              <td>
                <span style="display: inline-block; padding: 0.25rem 0.5rem; background: ${statusColor}22; color: ${statusColor}; border-radius: 4px; font-size: 0.875rem; font-weight: 500;">
                  ${escapeHtml(log.status)}
                </span>
              </td>
              <td>${duration !== null ? `${duration}s` : "-"}</td>
              <td>
                <button class="btn btn-sm btn-secondary" onclick="window.viewSyncLog(${log.id})">View</button>
                ${log.timesheet ? `
                  <button class="btn btn-sm btn-primary" onclick="window.retrySyncLog(${log.timesheetId})">Retry</button>
                ` : ""}
              </td>
            </tr>
          `;
    }).join("")}
      </tbody>
    </table>
  `;
  }
  window.viewSyncLog = async function(logId) {
    try {
      const log = await api.get(`/xero/sync/logs/${logId}`);
      const { showModalWithHTML: showModalWithHTML2 } = await Promise.resolve().then(() => (init_modal(), modal_exports));
      const details = log.syncDetails ? JSON.parse(log.syncDetails) : {};
      const html = `
      <h2>Sync Log Details</h2>
      <div style="max-width: 600px;">
        <table style="width: 100%; margin-bottom: 1rem;">
          <tr>
            <td style="font-weight: 500; padding: 0.5rem 0;">Status:</td>
            <td>${escapeHtml(log.status)}</td>
          </tr>
          <tr>
            <td style="font-weight: 500; padding: 0.5rem 0;">Type:</td>
            <td>${escapeHtml(log.syncType)}</td>
          </tr>
          <tr>
            <td style="font-weight: 500; padding: 0.5rem 0;">Started:</td>
            <td>${new Date(log.startedAt).toLocaleString()}</td>
          </tr>
          ${log.completedAt ? `
            <tr>
              <td style="font-weight: 500; padding: 0.5rem 0;">Completed:</td>
              <td>${new Date(log.completedAt).toLocaleString()}</td>
            </tr>
          ` : ""}
          <tr>
            <td style="font-weight: 500; padding: 0.5rem 0;">Records Processed:</td>
            <td>${log.recordsProcessed}</td>
          </tr>
          <tr>
            <td style="font-weight: 500; padding: 0.5rem 0;">Successful:</td>
            <td>${log.recordsSuccess}</td>
          </tr>
          <tr>
            <td style="font-weight: 500; padding: 0.5rem 0;">Failed:</td>
            <td>${log.recordsFailed}</td>
          </tr>
          ${log.xeroTimesheetId ? `
            <tr>
              <td style="font-weight: 500; padding: 0.5rem 0;">Xero Timesheet ID:</td>
              <td style="font-family: monospace; font-size: 0.875rem;">${escapeHtml(log.xeroTimesheetId)}</td>
            </tr>
          ` : ""}
          ${log.xeroToken ? `
            <tr>
              <td style="font-weight: 500; padding: 0.5rem 0;">Xero Tenant:</td>
              <td>${escapeHtml(log.xeroToken.tenantName)}</td>
            </tr>
          ` : ""}
        </table>

        ${log.errorMessage ? `
          <div style="padding: 1rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; margin-bottom: 1rem;">
            <strong style="color: #dc2626;">Error:</strong>
            <pre style="margin: 0.5rem 0 0 0; white-space: pre-wrap; font-size: 0.875rem;">${escapeHtml(log.errorMessage)}</pre>
          </div>
        ` : ""}

        ${Object.keys(details).length > 0 ? `
          <div style="padding: 1rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px;">
            <strong>Sync Details:</strong>
            <pre style="margin: 0.5rem 0 0 0; white-space: pre-wrap; font-size: 0.875rem; max-height: 300px; overflow-y: auto;">${JSON.stringify(details, null, 2)}</pre>
          </div>
        ` : ""}
      </div>
    `;
      showModalWithHTML2(html);
    } catch (error) {
      console.error("Failed to load sync log:", error);
      showAlert("Failed to load sync log: " + error.message, "error");
    }
  };
  window.retrySyncLog = async function(timesheetId) {
    try {
      await api.post(`/xero/sync/timesheet/${timesheetId}`);
      showAlert("Sync initiated successfully", "success");
      setTimeout(async () => {
        await loadSyncStats();
        await loadSyncLogs();
      }, 2e3);
    } catch (error) {
      console.error("Failed to retry sync:", error);
      showAlert("Failed to retry sync: " + error.message, "error");
    }
  };
  registerTabHook("xeroSyncLogs", initXeroSyncLogs);

  // public/js/modules/features/xero/xero-leave.js
  init_api();
  init_state();
  init_alerts();
  init_navigation();
  init_quill();
  var leaveBalances = null;
  async function initLeaveManagement() {
    const currentUser2 = state.get("currentUser");
    if (!currentUser2) return;
    if (currentUser2.employeeId) {
      await showEmployeeLeaveView();
    }
    if (currentUser2.isAdmin) {
      await showAdminLeaveView();
    }
  }
  async function showEmployeeLeaveView() {
    const container = document.getElementById("xero-leave-employee");
    if (!container) return;
    const requests = await fetchMyLeaveRequests();
    leaveBalances = await fetchLeaveBalances();
    const hasBalances = leaveBalances && Array.isArray(leaveBalances) && leaveBalances.length > 0;
    container.innerHTML = `
    <div class="leave-employee-view">
      <div class="leave-header">
        <h2>My Leave Requests</h2>
        <button class="btn btn-primary" onclick="xeroLeave.showNewLeaveRequestPanel()">
          New Leave Request
        </button>
      </div>

      ${hasBalances ? `
        <div class="leave-balances">
          <h3>Your Leave Balances</h3>
          <div class="balance-grid">
            ${formatLeaveBalances(leaveBalances)}
          </div>
        </div>
      ` : ""}

      <div class="leave-requests">
        <h3>Your Leave Requests</h3>
        ${requests.length > 0 ? `
          <table class="leave-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Hours</th>
                <th>Status</th>
                <th>Approved By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${requests.map((req) => `
                <tr class="leave-request-row status-${req.status.toLowerCase()}">
                  <td>${formatLeaveType(req.leaveType)}</td>
                  <td>${formatDate(req.startDate)}</td>
                  <td>${formatDate(req.endDate)}</td>
                  <td>${req.totalHours}h</td>
                  <td><span class="status-badge status-${req.status.toLowerCase()}">${req.status}</span></td>
                  <td>${req.approvedBy ? req.approvedBy.name : "-"}</td>
                  <td>
                    ${req.status === "PENDING" ? `
                      <button class="btn btn-sm btn-danger" onclick="xeroLeave.deleteLeaveRequest(${req.id})">
                        Delete
                      </button>
                    ` : "-"}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : '<p class="no-data">No leave requests yet.</p>'}
      </div>
    </div>
  `;
  }
  async function showAdminLeaveView() {
    const container = document.getElementById("xero-leave-admin");
    if (!container) return;
    const requests = await fetchAllLeaveRequests();
    const allBalances = await fetchAllEmployeeBalances();
    const pending = requests.filter((r) => r.status === "PENDING");
    const processed = requests.filter((r) => r.status !== "PENDING");
    container.innerHTML = `
    <div class="leave-admin-view">
      <h2>Leave Request Management (Admin)</h2>

      ${allBalances.length > 0 ? `
        <div class="leave-section" style="margin-bottom: 2rem;">
          <h3>Employee Leave Balances</h3>
          <div style="display: grid; gap: 1.5rem;">
            ${allBalances.map((emp) => `
              <div style="background: white; border-radius: 8px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                  <div>
                    <h4 style="margin: 0; color: #111827;">${emp.employeeName}</h4>
                    <p style="margin: 0.25rem 0 0 0; color: #6b7280; font-size: 0.875rem;">${emp.email}</p>
                  </div>
                </div>
                <div class="balance-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                  ${emp.balances.map((bal) => {
      const name = bal.leaveName || bal.LeaveName || bal.name || bal.Name || "Unknown";
      const units = bal.numberOfUnits || bal.NumberOfUnits || 0;
      return `
                      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 1rem; color: white; text-align: center;">
                        <div style="font-size: 0.75rem; opacity: 0.9; margin-bottom: 0.5rem;">${name}</div>
                        <div style="font-size: 1.75rem; font-weight: 700;">${units}h</div>
                        <div style="font-size: 0.75rem; opacity: 0.8;">available</div>
                      </div>
                    `;
    }).join("")}
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}

      <h2>Leave Request Management (Admin)</h2>

      <div class="leave-section">
        <h3>Pending Approval (${pending.length})</h3>
        ${pending.length > 0 ? `
          <table class="leave-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Hours</th>
                <th>Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${pending.map((req) => `
                <tr>
                  <td>${req.employee.firstName} ${req.employee.lastName}</td>
                  <td>${formatLeaveType(req.leaveType)}</td>
                  <td>${formatDate(req.startDate)}</td>
                  <td>${formatDate(req.endDate)}</td>
                  <td>${req.totalHours}h</td>
                  <td style="max-width: 300px;">
                    <div class="leave-notes-preview">${req.notes ? req.notes : "-"}</div>
                  </td>
                  <td>
                    <button class="btn btn-sm btn-success" onclick="xeroLeave.approveLeaveRequest(${req.id})">
                      Approve
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="xeroLeave.rejectLeaveRequest(${req.id})">
                      Reject
                    </button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : '<p class="no-data">No pending leave requests.</p>'}
      </div>

      <div class="leave-section">
        <h3>Processed Requests (${processed.length})</h3>
        ${processed.length > 0 ? `
          <table class="leave-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Hours</th>
                <th>Status</th>
                <th>Processed By</th>
                <th>Xero Sync</th>
              </tr>
            </thead>
            <tbody>
              ${processed.map((req) => `
                <tr class="status-${req.status.toLowerCase()}">
                  <td>${req.employee.firstName} ${req.employee.lastName}</td>
                  <td>${formatLeaveType(req.leaveType)}</td>
                  <td>${formatDate(req.startDate)}</td>
                  <td>${formatDate(req.endDate)}</td>
                  <td>${req.totalHours}h</td>
                  <td><span class="status-badge status-${req.status.toLowerCase()}">${req.status}</span></td>
                  <td>${req.approvedBy ? req.approvedBy.name : "-"}</td>
                  <td>${req.xeroLeaveId ? "\u2713 Synced" : "-"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : '<p class="no-data">No processed requests.</p>'}
      </div>
    </div>
  `;
  }
  function showNewLeaveRequestPanel() {
    const tomorrow = /* @__PURE__ */ new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    const panelContent = `
    <form id="new-leave-form" style="padding: 1.5rem;">
      <div class="form-group">
        <label for="leave-type">Leave Type</label>
        <select id="leave-type" name="leaveType" class="form-control" required>
          <option value="">Select type...</option>
          <option value="ANNUAL">Annual Leave</option>
          <option value="SICK">Sick Leave</option>
          <option value="PERSONAL">Personal Leave</option>
          <option value="UNPAID">Unpaid Leave</option>
        </select>
      </div>

      <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label for="start-date">Start Date</label>
          <input type="date" id="start-date" name="startDate" class="form-control" value="${tomorrowStr}" required />
        </div>

        <div class="form-group">
          <label for="end-date">End Date</label>
          <input type="date" id="end-date" name="endDate" class="form-control" value="${tomorrowStr}" required />
        </div>
      </div>

      <div class="form-group">
        <label for="leave-hours">Total Hours</label>
        <input type="number" id="leave-hours" name="totalHours" class="form-control" value="7.6" step="0.1" min="0" required />
        <small style="color: #6b7280; font-size: 0.875rem;">Default: 7.6 hours per day</small>
      </div>

      <div class="form-group">
        <label for="leave-reason">Reason for Leave</label>
        <div id="leaveReasonEditor" style="height: 150px; background: white;"></div>
      </div>

      <div class="form-actions" style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
        <button type="button" class="btn btn-secondary" onclick="hideSlidePanel()">Cancel</button>
        <button type="submit" class="btn btn-primary">Submit Request</button>
      </div>
    </form>
  `;
    showSlidePanel("New Leave Request", panelContent);
    requestAnimationFrame(() => {
      const reasonEditor = initQuillEditor("leaveReasonEditor", "Enter the reason for your leave request...");
      const form = document.getElementById("new-leave-form");
      if (form) {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          const reasonHtml = quillGetHtml(reasonEditor);
          const data = {
            leaveType: formData.get("leaveType"),
            startDate: formData.get("startDate"),
            endDate: formData.get("endDate"),
            totalHours: parseFloat(formData.get("totalHours")),
            notes: reasonHtml
          };
          await submitLeaveRequest(data);
        });
      }
    });
  }
  async function submitLeaveRequest(data) {
    try {
      await api.post("/xero/leave/request", data);
      showAlert("Leave request submitted successfully!", "success");
      hideSlidePanel();
      await showEmployeeLeaveView();
    } catch (error) {
      console.error("Error submitting leave request:", error);
      showAlert(error.message || "Failed to create leave request", "error");
    }
  }
  async function approveLeaveRequest(id) {
    if (!confirm("Approve this leave request? It will be synced to Xero.")) {
      return;
    }
    try {
      await api.post(`/xero/leave/approve/${id}`);
      showAlert("Leave request approved and synced to Xero!", "success");
      await showAdminLeaveView();
    } catch (error) {
      console.error("Error approving leave request:", error);
      showAlert(error.message || "Failed to approve leave request", "error");
    }
  }
  async function rejectLeaveRequest(id) {
    if (!confirm("Reject this leave request?")) {
      return;
    }
    try {
      await api.post(`/xero/leave/reject/${id}`);
      showAlert("Leave request rejected.", "success");
      await showAdminLeaveView();
    } catch (error) {
      console.error("Error rejecting leave request:", error);
      showAlert(error.message || "Failed to reject leave request", "error");
    }
  }
  async function deleteLeaveRequest(id) {
    if (!confirm("Delete this leave request?")) {
      return;
    }
    try {
      await api.delete(`/xero/leave/request/${id}`);
      showAlert("Leave request deleted.", "success");
      await showEmployeeLeaveView();
    } catch (error) {
      console.error("Error deleting leave request:", error);
      showAlert(error.message || "Failed to delete leave request", "error");
    }
  }
  async function fetchMyLeaveRequests() {
    try {
      return await api.get("/xero/leave/my-requests");
    } catch (error) {
      console.error("Error fetching leave requests:", error);
      showAlert("Failed to load leave requests", "error");
      return [];
    }
  }
  async function fetchAllLeaveRequests() {
    try {
      return await api.get("/xero/leave/requests");
    } catch (error) {
      console.error("Error fetching leave requests:", error);
      showAlert("Failed to load leave requests", "error");
      return [];
    }
  }
  async function fetchLeaveBalances() {
    try {
      const data = await api.get("/xero/leave/balances");
      return data.message ? null : data;
    } catch (error) {
      console.error("Error fetching leave balances:", error);
      return null;
    }
  }
  async function fetchAllEmployeeBalances() {
    try {
      return await api.get("/xero/leave/all-balances");
    } catch (error) {
      console.error("Error fetching all employee balances:", error);
      return [];
    }
  }
  function formatLeaveBalances(balances) {
    if (!balances || !Array.isArray(balances) || balances.length === 0) {
      return '<p class="no-data">No leave balances available from Xero</p>';
    }
    return balances.map((balance) => {
      const leaveName = balance.leaveName || balance.LeaveName || balance.leaveType || balance.LeaveType || balance.name || balance.Name || "Unknown Leave";
      const units = balance.numberOfUnits || balance.NumberOfUnits || 0;
      return `
      <div class="balance-card">
        <div class="balance-type">${leaveName}</div>
        <div class="balance-hours">${units}h</div>
        <div class="balance-label">available</div>
      </div>
    `;
    }).join("");
  }
  function formatLeaveType(type) {
    const types = {
      "ANNUAL": "Annual Leave",
      "SICK": "Sick Leave",
      "PERSONAL": "Personal Leave",
      "UNPAID": "Unpaid Leave"
    };
    return types[type] || type;
  }
  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-AU", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }
  window.xeroLeave = {
    showNewLeaveRequestPanel,
    approveLeaveRequest,
    rejectLeaveRequest,
    deleteLeaveRequest
  };
  registerTabHook("leaveManagement", initLeaveManagement);

  // public/js/modules/main.js
  Object.assign(window, {
    // Modal functions
    hideModal,
    hideSlidePanel,
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
    // Timesheets
    createTimesheet,
    submitTimesheet,
    approveTimesheet,
    lockTimesheet,
    unlockTimesheet,
    deleteTimesheet,
    refreshTimesheets: refreshTimesheets2,
    toggleAccordion,
    toggleDateAccordion,
    selectEmployee,
    // Entries
    createEntry,
    editEntry,
    deleteEntry,
    loadEntries,
    createEntryForTimesheet,
    createEntryForDate,
    viewEntrySlideIn,
    editEntrySlideIn,
    deleteEntryFromCard,
    // Profile
    showMyProfile,
    // API Keys
    createApiKey,
    copyApiKey,
    revokeApiKey,
    loadApiKeys,
    // WMS
    syncToWms,
    viewSyncHistory,
    showDeWmsEntries,
    // Location autocomplete
    removeLocationNote
  });
  async function init() {
    console.log("Initializing timesheet application...");
    initNavigation();
    initSlidePanel();
    document.querySelectorAll(".sidebar .nav-item[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tabName = btn.dataset.tab;
        activateTab(tabName);
      });
    });
    const closeBtn = document.querySelector(".modal .close");
    if (closeBtn) {
      closeBtn.addEventListener("click", hideModal);
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
      myProfileBtn.addEventListener("click", () => showMyProfile());
    }
    const createEntryBtn = document.getElementById("createEntryBtn");
    if (createEntryBtn) {
      createEntryBtn.addEventListener("click", () => createEntry());
    }
    const createApiKeyBtn = document.getElementById("createApiKeyBtn");
    if (createApiKeyBtn) {
      createApiKeyBtn.addEventListener("click", () => createApiKey());
    }
    initSystemTools();
    const timesheetSelect = document.getElementById("timesheetSelect");
    if (timesheetSelect) {
      timesheetSelect.addEventListener("change", (e) => {
        if (e.target.value) {
          loadEntries(e.target.value);
        }
      });
    }
    const createTimesheetBtn = document.getElementById("createTimesheetBtn");
    if (createTimesheetBtn) {
      createTimesheetBtn.addEventListener("click", () => createTimesheet());
    }
    await checkAuth();
    const currentUser2 = state.get("currentUser");
    if (currentUser2 && currentUser2.isAdmin) {
      initEmployeeSelector();
    }
    console.log("Application initialized");
  }
  document.addEventListener("DOMContentLoaded", init);
  console.log("Main module loaded");
})();
