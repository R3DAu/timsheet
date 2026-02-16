# Frontend Refactoring Completion Guide

## Status Summary

### ✅ COMPLETED (Critical XSS Vulnerabilities Fixed)

**Core Infrastructure:**
- All 7 core modules (api, state, dom, alerts, modal, quill, navigation)
- Location autocomplete component
- Main entry point with event wiring
- Build system (esbuild) operational

**Feature Modules with XSS Fixes:**
- ✅ **auth.js** - 1 XSS fix (user display name)
- ✅ **companies.js** - 3 XSS fixes (company names in table/forms)
- ✅ **roles.js** - 4 XSS fixes (role/company names)
- ✅ **employees.js** - 15+ XSS fixes including **CRITICAL onclick injection** (line 2013)
- ✅ **users.js** - 8 XSS fixes including **CRITICAL onclick injection** (line 2364)
- ✅ **entry-validation.js** - Validation logic (no XSS issues)

**Current bundle size:** 52.0kb (down from 3,299 lines of unorganized code)

---

## 📋 Remaining Modules to Complete

### HIGH PRIORITY (Core Functionality)

#### 1. `features/timesheets/timesheets.js` (Lines 754-963)
**Complexity:** MEDIUM | **XSS Fixes:** 6 | **Size:** ~210 lines

**Functions to extract:**
- `loadMyTimesheets()` - Load user's timesheets
- `loadAllTimesheets()` - Load all timesheets (admin)
- `displayMyTimesheets()` - Display user's timesheets
- `displayAllTimesheets()` - Display all timesheets (admin)
- `populateTimesheetSelect()` - Populate timesheet dropdown
- `createTimesheet()` - Create new timesheet
- `viewTimesheet(id)` - View timesheet details
- `submitTimesheet(id)` - Submit for approval
- `approveTimesheet(id)` - Approve (admin)
- `lockTimesheet(id)` - Lock (admin)
- `deleteTimesheet(id)` - Delete

**XSS Fixes Required:**
```javascript
// Line 802: Employee name in table
<td>${escapeHtml(ts.employee.user.name)}</td>

// Line 971: Employee name in view modal
<p><strong>Employee:</strong> ${escapeHtml(ts.employee.firstName)} ${escapeHtml(ts.employee.lastName)}</p>

// Line 974: Approver name
<p><strong>Approved By:</strong> ${escapeHtml(ts.approvedBy.name)}</p>

// Line 997: Company name
<td>${escapeHtml(e.company.name)}</td>

// Line 1001: Entry notes (CRITICAL - use sanitizeRichText)
${sanitizeRichText(entry.notes)}

// Lines 1002-1003: Travel locations and reason
${escapeHtml(entry.travelFrom)} → ${escapeHtml(entry.travelTo)}
${escapeHtml(entry.reasonForDeviation)}

// Lines 1007-1009: Location notes (use sanitizeRichText for description)
${escapeHtml(ln.location)}
${sanitizeRichText(ln.description)}
```

**Template:**
```javascript
import { api } from '../../core/api.js';
import { state } from '../../core/state.js';
import { showModalWithForm, hideModal } from '../../core/modal.js';
import { showAlert, showConfirmation } from '../../core/alerts.js';
import { escapeHtml, sanitizeRichText } from '../../core/dom.js';
import { registerTabHook } from '../../core/navigation.js';

export async function loadMyTimesheets() {
  const currentUser = state.get('currentUser');
  const result = await api.get(`/timesheets?employeeId=${currentUser.employeeId}`);
  state.set('myTimesheets', result.timesheets);
  displayMyTimesheets();
  populateTimesheetSelect();
}

// ... implement remaining functions with XSS fixes ...

registerTabHook('myTimesheets', displayMyTimesheets);
registerTabHook('allTimesheets', displayAllTimesheets);
```

---

#### 2. `features/entries/entries.js` (Lines 1030-1539)
**Complexity:** HIGH | **XSS Fixes:** 10+ | **Size:** ~510 lines (LARGEST MODULE)

**Functions to extract:**
- `displayEntries()` - Display entries for selected timesheet
- `createEntry()` - Create entry form (complex)
- `editEntry(id)` - Edit entry form
- `deleteEntry(id)` - Delete entry
- Helper functions for entry type toggling, time calculations

**XSS Fixes Required:**
```javascript
// Use escapeHtml for ALL user-entered text:
- startingLocation
- travelFrom, travelTo
- reasonForDeviation
- Company/role names in dropdowns

// Use sanitizeRichText for Quill content:
- entry.notes
- entry.privateNotes
- Location note descriptions
```

**Key Dependencies:**
- `entry-validation.js` (validateEntry)
- `location-autocomplete.js` (attachAllLocationAutocompletes, addLocationNoteField, collectLocationNotes)
- `quill.js` (initQuillEditor, quillGetHtml)

---

### MEDIUM PRIORITY (Admin Features)

#### 3. `features/profile/profile.js` (Lines 2533-2678)
**Complexity:** LOW | **XSS Fixes:** 5 | **Size:** ~145 lines

**Functions:**
- `showMyProfile()` - Display profile modal
- Update profile (name, email, password, time templates, preset addresses)

**XSS Fixes:**
```javascript
// Lines 2551-2555: Current user display
${escapeHtml(currentUser.name)}
${escapeHtml(currentUser.email)}

// Lines 2624-2625: Preset addresses
${escapeHtml(label)}
${escapeHtml(address)}
```

---

#### 4. `features/api-keys/api-keys.js` (Lines 2680-2800)
**Complexity:** LOW | **XSS Fixes:** 4 | **Size:** ~120 lines

**Functions:**
- `loadApiKeys()` - Load API keys
- `displayApiKeys()` - Display API keys table
- `createApiKey()` - Create new key
- `revokeApiKey(id)` - Revoke key

**XSS Fixes:**
```javascript
// Lines 2717-2719: API key display
${escapeHtml(k.name)}
${escapeHtml(k.keyPrefix)}
${escapeHtml(k.user.name)}

// Line 2768: Full key in readonly input
value="${escapeHtml(result.apiKey.key)}"
```

---

### LOW PRIORITY (WMS Features)

#### 5. `features/wms/wms-comparison.js` (Lines 2802-2929)
**Complexity:** MEDIUM | **XSS Fixes:** 5 | **Size:** ~127 lines

**Functions:**
- `displayWmsComparison()` - Show comparison view
- Fetch and compare WMS data with timesheet entries

**XSS Fixes:**
```javascript
// Line 2849: Company/school from WMS data
${escapeHtml(e.company || e.school)}

// Lines 2895-2896: Worker ID and employee name
${escapeHtml(employeeData.workerId)}
${escapeHtml(employeeData.name)}

// Line 2897: Error message (CRITICAL)
${escapeHtml(fetchError)}
```

---

#### 6. `features/wms/wms-sync.js` (Lines 2931-3211)
**Complexity:** MEDIUM | **XSS Fixes:** 3 CRITICAL | **Size:** ~280 lines

**Functions:**
- `employeeHasWmsSyncRole()` - Check if employee can sync
- `timesheetHasWmsSyncEntries()` - Check if timesheet has sync-eligible entries
- `getWmsSyncButton()` - Generate sync button HTML
- `syncToWms(timesheetId)` - Initiate sync
- `showSyncProgress(syncId)` - Show sync progress modal
- `pollSyncStatus(syncId)` - Poll for sync completion
- `viewSyncHistory(timesheetId)` - View sync history

**XSS Fixes (CRITICAL - server-controlled error messages):**
```javascript
// Line 3137: Sync entry error
${escapeHtml(e.error)}

// Line 3156: Sync log error message (CRITICAL)
${escapeHtml(log.errorMessage)}

// Any other sync status/error messages from API
```

---

## 🔧 Implementation Steps for Each Module

### Step 1: Extract Code
1. Copy function code from `app.original.js` (reference line numbers in plan)
2. Create module file in appropriate directory

### Step 2: Add Imports
```javascript
import { api } from '../../core/api.js';
import { state } from '../../core/state.js';
import { showModalWithForm, showModalWithHTML, hideModal } from '../../core/modal.js';
import { showAlert, showConfirmation } from '../../core/alerts.js';
import { escapeHtml, sanitizeRichText } from '../../core/dom.js';
import { registerTabHook } from '../../core/navigation.js';
```

### Step 3: Replace Global Variables
```javascript
// OLD (app.original.js)
companies = result.companies;

// NEW (module)
state.set('companies', result.companies);

// Access:
const companies = state.get('companies');
```

### Step 4: Apply XSS Fixes
- **User-entered text:** Use `escapeHtml(str)`
- **Quill editor HTML:** Use `sanitizeRichText(html)`
- **onclick with user data:** Convert to data attributes + event delegation

### Step 5: Export Functions
```javascript
export async function loadTimesheet() { ... }
export function displayTimesheet() { ... }
```

### Step 6: Register Tab Hooks
```javascript
registerTabHook('myTimesheets', displayMyTimesheets);
```

### Step 7: Update main.js
```javascript
import * as timesheets from './features/timesheets/timesheets.js';

Object.assign(window, {
  createTimesheet: timesheets.createTimesheet,
  viewTimesheet: timesheets.viewTimesheet,
  // ... other functions
});
```

### Step 8: Update auth.js loadAllData
```javascript
if (currentUser.employeeId) {
  const { loadMyTimesheets } = await import('../timesheets/timesheets.js');
  await loadMyTimesheets();
}
```

### Step 9: Rebuild and Test
```bash
npm run build
# Manually test the feature in browser
```

---

## 🎯 Quick Win: Timesheets Module (Next Step)

To get the app fully functional quickly, implement `timesheets.js` next:

1. **Extract from app.original.js lines 754-963**
2. **Apply 6 XSS fixes** (see above)
3. **Wire up in main.js and auth.js**
4. **Test:** Login → Create Timesheet → View Entries

This unlocks the core workflow and allows testing the full stack.

---

## 🧪 Testing Checklist

After each module is implemented:

### Functional Testing
- [ ] Tab activates correctly
- [ ] List displays data
- [ ] Create form opens and saves
- [ ] Edit form pre-populates and updates
- [ ] Delete prompts and removes

### XSS Testing
Create test data with these payloads:
- `<script>alert('XSS')</script>`
- `<img src=x onerror=alert(1)>`
- `'; alert('XSS'); //`
- `"><svg onload=alert(1)>`

Verify all display as plain text (no JavaScript execution).

### Rich Text Testing (Quill fields)
- Test that safe formatting (bold, lists, links) is preserved
- Test that `<script>` tags are stripped by DOMPurify
- Verify allowed tags: p, br, strong, em, u, ol, ul, li, a

---

## 📊 Final Steps (After All Modules Complete)

### Step 22: Build and Test
```bash
npm run build
```

Manual test all features using verification checklist from plan.

### Step 23: Cleanup
```bash
# Remove original backup
rm public/js/app.original.js

# Commit changes
git add .
git commit -m "Refactor frontend to modular ES6 architecture with XSS fixes"
```

---

## 🏆 Success Metrics

When complete, you will have:

✅ **60+ HIGH-severity XSS vulnerabilities fixed**
✅ **Code organized into 22 logical modules** (vs 1 monolithic file)
✅ **Centralized state management** (vs 12 global variables)
✅ **Safe DOM utilities** (escapeHtml, sanitizeRichText, h)
✅ **DOMPurify for rich text** (industry-standard sanitization)
✅ **Event delegation pattern** (no onclick injection vulnerabilities)
✅ **Developer-friendly architecture** (clear module boundaries, easy to navigate)
✅ **Fast build system** (esbuild bundles in <50ms)

---

## 💡 Tips

- **Follow the pattern:** Use completed modules (companies.js, roles.js) as templates
- **Test incrementally:** Build and test after each module
- **Commit often:** Commit after each working module
- **Use XSS payloads:** Actual test data catches bugs
- **Read the plan:** Detailed XSS fix locations in original plan document

---

## 🆘 Need Help?

If you encounter issues:

1. **Build errors:** Check import paths, ensure all exports are declared
2. **XSS not fixed:** Verify escapeHtml/sanitizeRichText applied correctly
3. **onclick handlers broken:** Ensure functions exposed in window bridge (main.js)
4. **State not persisting:** Use state.set() and state.get() correctly
5. **Modal issues:** Import hideModal, ensure Quill cleanup registered

---

**You're 70% complete! Keep going! 🚀**
