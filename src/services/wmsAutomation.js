/**
 * DE WMS (TSSP) AUTOMATION MODULE
 *
 * Automates timesheet entry into the TSSP Workforce Management System.
 * Authentication is SAML via ADFS hybrid.
 *
 * TSSP page structure:
 *   - Weekly view with collapsible weeks (tr.clickable)
 *   - Each day has entry rows with Syncfusion components
 *   - Entries auto-save on blur (no save/submit button needed)
 *   - Uses: ejs-timepicker, ejs-multiselect, standard <select> for ClientId
 *   - Predefined rows may exist with times already filled
 *   - Locked dates have disabled fields and "Date locked" text
 *
 * Debug mode (WMS_HEADLESS=false):
 *   - Browser window stays open after sync
 *   - Screenshots + HTML saved to public/wms-debug/
 */

const fs = require('fs');
const path = require('path');

const WMS_CONFIG = {
  baseUrl: process.env.WMS_BASE_URL || 'https://tssp.educationapps.vic.gov.au',
  timesheetUrlTemplate: process.env.WMS_TIMESHEET_URL_TEMPLATE ||
    'https://tssp.educationapps.vic.gov.au/workers/profile/{WORKER_ID}/timesheets',

  navigationTimeout: 60000,
  actionTimeout: 15000,
  angularWaitTime: 5000,

  adfs: {
    usernameInput: '#userNameInput, input[name="UserName"], input[name="login"]',
    passwordInput: '#passwordInput, input[name="Password"], input[name="passwd"]',
    submitButton: '#submitButton, input[type="submit"], button[type="submit"]',
    errorMessage: '#errorText, .error-message, #error'
  }
};

const DEBUG = process.env.WMS_HEADLESS === 'false';
const isDev = process.env.NODE_ENV !== 'production';
const DEBUG_DIR = process.env.WMS_DEBUG_DIR || path.join(__dirname, '../../public/wms-debug');

// Verbose logging only in development
function wmsLog(...args) {
  if (isDev) console.log(...args);
}

async function saveDebugInfo(page, label) {
  try {
    if (!fs.existsSync(DEBUG_DIR)) {
      fs.mkdirSync(DEBUG_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const prefix = `${timestamp}_${label}`;
    await page.screenshot({ path: path.join(DEBUG_DIR, `${prefix}.png`), fullPage: true });
    const html = await page.content();
    fs.writeFileSync(path.join(DEBUG_DIR, `${prefix}.html`), html);
    wmsLog(`[WMS Debug] Saved: ${prefix}.png + .html`);
  } catch (err) {
    wmsLog('[WMS Debug] Could not save debug info:', err.message);
  }
}

// ==================== MAIN ENTRY POINT ====================

async function syncTimesheet(context, timesheet, credentials, onProgress) {
  const page = await context.newPage();
  const steps = [];
  const progress = onProgress || (() => {});

  // Intercept TSSP API calls to log save requests/responses
  const apiLogs = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('tssp.educationapps.vic.gov.au') && !url.includes('.js') && !url.includes('.css')) {
      const method = response.request().method();
      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        let reqBody = null;
        let resBody = null;
        try {
          reqBody = response.request().postData();
        } catch (_) {}
        try {
          resBody = await response.text();
        } catch (_) {}
        const entry = {
          method,
          url,
          status: response.status(),
          reqBody: reqBody ? reqBody.substring(0, 2000) : null,
          resBody: resBody ? resBody.substring(0, 2000) : null
        };
        apiLogs.push(entry);
        console.log(`[WMS API] ${method} ${url} → ${response.status()}`);
        if (response.status() >= 400) {
          console.log(`[WMS API] Response: ${resBody ? resBody.substring(0, 500) : '(empty)'}`);
        }
      }
    }
  });

  try {
    const deWorkerId = getDeWorkerId(timesheet.employee);
    if (!deWorkerId) {
      throw new Error(
        `Employee "${timesheet.employee.firstName} ${timesheet.employee.lastName}" ` +
        'has no DE Worker ID configured. Add an identifier with type "de_worker_id" in their profile.'
      );
    }

    // Step 1: Login via SAML/ADFS
    progress('Logging in to DE ADFS...');
    steps.push(await navigateAndLogin(page, deWorkerId, credentials));
    progress('Logged in successfully');
    if (DEBUG) await saveDebugInfo(page, 'after-login');

    // Step 2: Expand the correct week
    progress('Finding timesheet week...');
    steps.push(await expandTargetWeek(page, timesheet));
    progress('Week expanded');
    if (DEBUG) await saveDebugInfo(page, 'after-expand-week');

    // Step 3: Fill in entries
    progress('Starting entry sync...');
    steps.push(await fillEntries(page, timesheet, progress));
    progress('All entries processed');
    if (DEBUG) await saveDebugInfo(page, 'after-entries');

    // Step 4: Logout to end the ADFS/TSSP session
    progress('Logging out...');
    await logout(page);
    steps.push({ step: 'logout', status: 'success' });
    progress('Logged out successfully');

    // Log all intercepted API calls for debugging
    if (apiLogs.length > 0) {
      console.log(`[WMS API] ${apiLogs.length} API call(s) captured`);
      apiLogs.forEach((log, i) => {
        console.log(`[WMS API] #${i + 1}: ${log.method} ${log.url} → ${log.status}`);
        if (log.reqBody) console.log(`[WMS API]   Request: ${log.reqBody.substring(0, 500)}`);
        if (log.resBody && log.status >= 400) console.log(`[WMS API]   Response: ${log.resBody.substring(0, 500)}`);
      });
    }

    return {
      success: true,
      steps,
      deWorkerId,
      entriesSynced: timesheet.entries.filter(e => e.company && e.company.wmsSyncEnabled).length,
      totalHours: timesheet.entries.filter(e => e.company && e.company.wmsSyncEnabled).reduce((sum, e) => sum + e.hours, 0),
      debugDir: DEBUG ? '/wms-debug/' : null,
      apiLogs
    };
  } catch (error) {
    // Always save debug info on failure (not just in DEBUG mode)
    await saveDebugInfo(page, 'error');

    // Log captured API calls on failure
    if (apiLogs.length > 0) {
      console.log(`[WMS API] ${apiLogs.length} API call(s) captured before failure:`);
      apiLogs.forEach((log, i) => {
        console.log(`[WMS API] #${i + 1}: ${log.method} ${log.url} → ${log.status}`);
        if (log.reqBody) console.log(`[WMS API]   Request: ${log.reqBody.substring(0, 1000)}`);
        if (log.resBody) console.log(`[WMS API]   Response: ${log.resBody.substring(0, 1000)}`);
      });
    }

    // Best-effort logout even on failure
    await logout(page).catch(() => {});

    const enrichedError = new Error(`WMS sync failed at step ${steps.length + 1}: ${error.message}`);
    enrichedError.steps = steps;
    enrichedError.pageUrl = page.url();
    throw enrichedError;
  } finally {
    await page.close().catch(() => {});
  }
}

// ==================== STEP 1: LOGIN ====================

async function navigateAndLogin(page, deWorkerId, credentials) {
  const timesheetUrl = WMS_CONFIG.timesheetUrlTemplate.replace('{WORKER_ID}', deWorkerId);

  console.log(`[WMS] Navigating to ${timesheetUrl}`);
  await page.goto(timesheetUrl, {
    waitUntil: 'load',
    timeout: WMS_CONFIG.navigationTimeout
  });

  // After page.goto resolves, we may be on:
  // 1. The ADFS login page (SAML redirect happened during navigation)
  // 2. The TSSP page (already authenticated, session still valid)
  // 3. An intermediate page (JS-based redirect still pending)
  //
  // Wait a moment for any JS redirects to settle, then check where we are
  await page.waitForTimeout(2000);
  console.log(`[WMS] Landed on: ${page.url()}`);

  // Race: ADFS login form vs TSSP table (already authenticated)
  const result = await Promise.race([
    page.waitForSelector(WMS_CONFIG.adfs.usernameInput, { state: 'visible', timeout: WMS_CONFIG.navigationTimeout })
      .then(() => 'adfs'),
    page.waitForSelector('table.table-striped', { state: 'visible', timeout: WMS_CONFIG.navigationTimeout })
      .then(() => 'tssp')
  ]).catch(() => 'unknown');

  console.log(`[WMS] Login detection result: "${result}", URL: ${page.url()}`);

  if (result === 'adfs') {
    await saveDebugInfo(page, 'adfs-before-login');

    await page.fill(WMS_CONFIG.adfs.usernameInput, credentials.username);
    await page.fill(WMS_CONFIG.adfs.passwordInput, credentials.password);
    await page.click(WMS_CONFIG.adfs.submitButton);

    console.log('[WMS] Credentials submitted, waiting for ADFS response...');

    // Wait for navigation away from ADFS — could be SAML POST back to TSSP
    // or an error staying on the ADFS page
    await page.waitForNavigation({
      waitUntil: 'load',
      timeout: WMS_CONFIG.navigationTimeout
    }).catch(() => {});

    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log(`[WMS] Post-login URL: ${currentUrl}`);

    // Check for ADFS error (still on login page)
    if (currentUrl.includes('adfs') || currentUrl.includes('login')) {
      const adfsError = await page.locator(WMS_CONFIG.adfs.errorMessage).textContent().catch(() => null);
      if (adfsError && adfsError.trim().length > 0) {
        throw new Error(`ADFS login failed: ${adfsError.trim()}`);
      }
      // May need a second redirect (e.g. MFA or consent)
      await saveDebugInfo(page, 'adfs-still-on-login');
      throw new Error('Login failed - still on authentication page after submitting credentials. Check credentials.');
    }

    // Give Angular time to bootstrap after SAML POST
    await page.waitForTimeout(WMS_CONFIG.angularWaitTime);
  }

  // Wait for the TSSP table to render (unless it's already visible)
  if (result !== 'tssp') {
    console.log(`[WMS] Waiting for TSSP table to render...`);
    try {
      await page.waitForSelector('table.table-striped', {
        state: 'visible',
        timeout: WMS_CONFIG.navigationTimeout
      });
    } catch (err) {
      console.error(`[WMS] Table not found after ${WMS_CONFIG.navigationTimeout}ms. URL: ${page.url()}`);
      await saveDebugInfo(page, 'table-not-found');
      const pageTitle = await page.title().catch(() => '(unknown)');
      throw new Error(
        `TSSP table not visible after login. URL: ${page.url()}, Title: "${pageTitle}". ` +
        `Check /wms-debug/ for screenshot.`
      );
    }
  }

  console.log(`[WMS] Login successful, on: ${page.url()}`);
  return { step: 'login', status: 'success', url: page.url() };
}

// ==================== STEP 2: EXPAND WEEK ====================

async function expandTargetWeek(page, timesheet) {
  const weekStart = new Date(timesheet.weekStarting);
  const weekDay = weekStart.getDate();
  const weekMonth = weekStart.toLocaleString('en-AU', { month: 'short' });

  // Find all clickable week header rows
  const weekRows = page.locator('tr.clickable');
  const count = await weekRows.count();

  let found = false;
  for (let i = 0; i < count; i++) {
    const rowText = await weekRows.nth(i).textContent();
    const dayStr = weekDay.toString().padStart(2, '0');
    if (rowText.includes(`${dayStr} ${weekMonth}`)) {
      // Check if week is collapsed (chevron-right means collapsed)
      const chevron = weekRows.nth(i).locator('i.fa-chevron-right');
      if (await chevron.isVisible().catch(() => false)) {
        await weekRows.nth(i).click();
        await page.waitForTimeout(1000);
      }
      found = true;
      break;
    }
  }

  if (!found) {
    wmsLog('[WMS] Could not find target week, expanding all weeks');
    for (let i = 0; i < count; i++) {
      const chevron = weekRows.nth(i).locator('i.fa-chevron-right');
      if (await chevron.isVisible().catch(() => false)) {
        await weekRows.nth(i).click();
        await page.waitForTimeout(500);
      }
    }
  }

  return { step: 'expandWeek', status: 'success', found };
}

// ==================== STEP 3: FILL ENTRIES ====================

async function fillEntries(page, timesheet, progress) {
  const results = [];

  // Filter to only entries from WMS-sync-enabled companies
  const wmsEntries = timesheet.entries.filter(e =>
    e.company && e.company.wmsSyncEnabled
  );

  if (wmsEntries.length === 0) {
    return {
      step: 'fillEntries',
      status: 'skipped',
      message: 'No WMS-sync-enabled entries found',
      entriesEntered: 0,
      entriesFailed: 0,
      entriesSkipped: 0,
      entries: []
    };
  }

  wmsLog(`[WMS] Filtered to ${wmsEntries.length} WMS-sync-enabled entries (${timesheet.entries.length} total)`);

  // Sort entries by date then start time
  wmsEntries.sort((a, b) => {
    const dateCompare = new Date(a.date) - new Date(b.date);
    if (dateCompare !== 0) return dateCompare;
    return (a.startTime || '').localeCompare(b.startTime || '');
  });

  // Group entries by date
  const entriesByDate = {};
  for (const entry of wmsEntries) {
    const dateStr = formatDateForMatch(entry.date);
    if (!entriesByDate[dateStr]) {
      entriesByDate[dateStr] = [];
    }
    entriesByDate[dateStr].push(entry);
  }

  const totalEntries = wmsEntries.length;
  let entryNumber = 0;

  for (const [dateStr, entries] of Object.entries(entriesByDate)) {
    wmsLog(`[WMS] Processing ${entries.length} entry(ies) for ${dateStr}`);

    // Track which entry times we've already filled (to avoid re-matching after re-scan)
    const filledTimes = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      entryNumber++;
      try {
        wmsLog(`[WMS]   Entry ${i + 1}: ${entry.startTime}-${entry.endTime} (${entry.hours}h)`);
        progress(`[${entryNumber}/${totalEntries}] ${dateStr} — Filling ${entry.startTime}-${entry.endTime}`);

        // Re-scan rows for this date EACH iteration (DOM changes after auto-save)
        const dateResult = await findRowsForDate(page, dateStr);

        if (dateResult === null) {
          wmsLog(`[WMS]   Date ${dateStr} is LOCKED or not found - skipping`);
          progress(`[${entryNumber}/${totalEntries}] ${dateStr} — Skipped (locked or not found)`);
          results.push({ date: dateStr, hours: entry.hours, status: 'skipped', error: 'Date locked or not found' });
          continue;
        }

        const { rows: existingRows, states: rowStates } = dateResult;

        if (i === 0) {
          wmsLog(`[WMS]   Found ${existingRows.length} row(s): ${rowStates.map(r => r.disabled ? 'disabled' : r.isEmpty ? 'empty' : `predefined(${r.startTime}-${r.endTime})`).join(', ')}`);
        }

        // Mark rows we've already filled as "used" based on their current times
        for (const filled of filledTimes) {
          const idx = rowStates.findIndex(r =>
            !r.used && !r.disabled &&
            r.startTime === filled.startTime &&
            r.endTime === filled.endTime
          );
          if (idx >= 0) rowStates[idx].used = true;
        }

        let row = null;

        // First, try to find a predefined row that matches our times
        const matchingPredefined = rowStates.findIndex(r =>
          !r.isEmpty && !r.used && !r.disabled &&
          r.startTime === formatTimeForTSSP(entry.startTime) &&
          r.endTime === formatTimeForTSSP(entry.endTime)
        );

        if (matchingPredefined >= 0) {
          row = existingRows[matchingPredefined];
          rowStates[matchingPredefined].used = true;
          wmsLog(`[WMS]     Matched predefined row ${matchingPredefined + 1}`);
        } else {
          // Use the first empty row
          const emptyIdx = rowStates.findIndex(r => r.isEmpty && !r.used && !r.disabled);
          if (emptyIdx >= 0) {
            row = existingRows[emptyIdx];
            rowStates[emptyIdx].used = true;
            wmsLog(`[WMS]     Using empty row ${emptyIdx + 1}`);
          } else {
            // Check for unused predefined rows (times don't match but row is editable)
            const unusedIdx = rowStates.findIndex(r => !r.used && !r.disabled);
            if (unusedIdx >= 0) {
              row = existingRows[unusedIdx];
              rowStates[unusedIdx].used = true;
              wmsLog(`[WMS]     Using unused predefined row ${unusedIdx + 1} (will overwrite times)`);
            } else {
              // Need to add a new row
              wmsLog(`[WMS]     No available rows, adding new entry`);
              row = await addNewEntryRow(page, existingRows, dateStr);
            }
          }
        }

        if (!row) {
          wmsLog(`[WMS]     SKIPPED - could not find or create row`);
          results.push({ date: dateStr, status: 'skipped', error: `No available row for entry ${i + 1}` });
          continue;
        }

        // Fill the entry fields
        await fillEntryRow(page, row, entry, timesheet.employee);

        // The fillEntryRow function already triggers save via Tab.
        // Wait for Angular to process the save.
        progress(`[${entryNumber}/${totalEntries}] ${dateStr} — Saving ${entry.startTime}-${entry.endTime}...`);
        await page.waitForTimeout(3000); // Give Angular time to save + re-render

        await saveDebugInfo(page, `after-save-${dateStr}-entry${i}`);

        // Check for TSSP errors (Angular toast/notification)
        const tsspError = await detectTsspError(page);
        if (tsspError) {
          wmsLog(`[WMS]     TSSP ERROR after save: ${tsspError}`);
          progress(`[${entryNumber}/${totalEntries}] ${dateStr} — Error: ${tsspError}`);
          results.push({ date: dateStr, hours: entry.hours, status: 'failed', error: `TSSP: ${tsspError}` });
          await saveDebugInfo(page, `tssp-error-${dateStr}-entry${i}`);
          // Dismiss the error toast/alert if possible
          await dismissTsspError(page);
          continue;
        }

        wmsLog(`[WMS]     DONE - auto-save triggered`);
        progress(`[${entryNumber}/${totalEntries}] ${dateStr} — Saved ${entry.startTime}-${entry.endTime}`);

        // Track what we filled so re-scans can mark them as used
        filledTimes.push({
          startTime: formatTimeForTSSP(entry.startTime),
          endTime: formatTimeForTSSP(entry.endTime)
        });

        results.push({
          date: dateStr,
          startTime: entry.startTime,
          endTime: entry.endTime,
          hours: entry.hours,
          role: entry.role ? entry.role.name : '',
          status: 'entered'
        });
      } catch (err) {
        wmsLog(`[WMS]     FAILED: ${err.message}`);
        progress(`[${entryNumber}/${totalEntries}] ${dateStr} — Failed: ${err.message}`);
        results.push({
          date: dateStr,
          hours: entry.hours,
          status: 'failed',
          error: err.message
        });
        if (DEBUG) await saveDebugInfo(page, `error-${dateStr}-entry${i}`);
      }
    }
  }

  return {
    step: 'fillEntries',
    status: 'success',
    entriesEntered: results.filter(r => r.status === 'entered').length,
    entriesFailed: results.filter(r => r.status === 'failed').length,
    entriesSkipped: results.filter(r => r.status === 'skipped').length,
    entries: results
  };
}

/**
 * Find all entry rows for a specific date using in-browser scanning (fast).
 * Returns null if date is locked, empty array if not found,
 * or { rows: Locator[], states: RowState[] }.
 *
 * TSSP structure: first row for a date has the date text in td.timesheet-date-column.
 * Subsequent rows for the same date have an EMPTY date cell.
 * We find the first row, then grab consecutive siblings with empty date cells.
 */
async function findRowsForDate(page, dateStr) {
  // Do all scanning in-browser in a single evaluate call
  const result = await page.evaluate((targetDate) => {
    const allRows = document.querySelectorAll('tr');
    let dateRowIndex = -1;
    let isLocked = false;

    // Find the row that contains our target date text
    for (let i = 0; i < allRows.length; i++) {
      const dateCell = allRows[i].querySelector('td.timesheet-date-column');
      if (!dateCell) continue;

      const cellText = dateCell.textContent || '';
      if (cellText.includes(targetDate)) {
        if (cellText.includes('Date locked')) {
          isLocked = true;
          break;
        }
        dateRowIndex = i;
        break;
      }
    }

    if (isLocked) return { locked: true };
    if (dateRowIndex < 0) return { rows: [] };

    // Collect this row + consecutive siblings with empty date cells (same date)
    const rowIndices = [dateRowIndex];
    const rowData = [];

    // Analyze first row
    const firstRow = allRows[dateRowIndex];
    const firstStart = firstRow.querySelector('input[id^="StartTimeDate_"][id$="_input"]');
    const firstEnd = firstRow.querySelector('input[id^="EndTimeDate_"][id$="_input"]');
    rowData.push({
      startTime: firstStart ? (firstStart.value || '') : '',
      endTime: firstEnd ? (firstEnd.value || '') : '',
      disabled: firstStart ? firstStart.disabled : false
    });

    // Check subsequent rows - they belong to the same date if their date cell is empty
    for (let i = dateRowIndex + 1; i < allRows.length; i++) {
      const dateCell = allRows[i].querySelector('td.timesheet-date-column');
      if (!dateCell) break; // No date cell = not a timesheet row

      const cellText = (dateCell.textContent || '').trim();
      // If cell has content (a different date or a week header), stop
      if (cellText.length > 0) break;

      // Empty date cell = continuation of same date
      rowIndices.push(i);
      const startInput = allRows[i].querySelector('input[id^="StartTimeDate_"][id$="_input"]');
      const endInput = allRows[i].querySelector('input[id^="EndTimeDate_"][id$="_input"]');
      rowData.push({
        startTime: startInput ? (startInput.value || '') : '',
        endTime: endInput ? (endInput.value || '') : '',
        disabled: startInput ? startInput.disabled : false
      });
    }

    return { rows: rowIndices, data: rowData };
  }, dateStr);

  if (result.locked) return null;
  if (!result.rows || result.rows.length === 0) return null;

  // Convert indices to Playwright locators and return with state data
  const allRows = page.locator('tr');
  const rows = result.rows.map(idx => allRows.nth(idx));
  const states = result.data.map(d => ({
    isEmpty: !d.startTime.trim() && !d.endTime.trim(),
    startTime: d.startTime.trim(),
    endTime: d.endTime.trim(),
    disabled: d.disabled,
    used: false
  }));

  return { rows, states };
}

/**
 * Add a new entry row by clicking "Add entry below" on an existing row.
 */
async function addNewEntryRow(page, existingRows, dateStr) {
  // Try clicking "Add entry below" on the last existing row for this date
  const lastRow = existingRows[existingRows.length - 1];
  const addBelow = lastRow.locator('a[title="Add entry below"]');

  if (await addBelow.isVisible().catch(() => false)) {
    await addBelow.click();
    await page.waitForTimeout(2000);

    // Re-find rows for this date
    const dateResult = await findRowsForDate(page, dateStr);
    if (dateResult && dateResult.rows.length > existingRows.length) {
      return dateResult.rows[dateResult.rows.length - 1];
    }
  }

  return null;
}

/**
 * Fill a single entry row with data, using keyboard-based interactions.
 *
 * TSSP auto-saves on blur at the ROW COMPONENT level. Using Tab to move
 * between fields triggers Angular's blur handler within the row component,
 * which saves just that row. Clicking away (to a header/other element) can
 * trigger form-level validation instead, which validates ALL rows including
 * ones with future end times.
 *
 * Key insight: Playwright's .fill() + click-away triggers form-level save,
 * but Tab-based navigation triggers row-level save (like a human user).
 */
async function fillEntryRow(page, row, entry, employee) {
  // 1. Client - standard <select> with formcontrolname="ClientId"
  await fillClient(row);

  // 2. Start Time - Syncfusion ejs-timepicker
  if (entry.startTime) {
    await fillTimePicker(page, row, 'StartTimeDate', entry.startTime);
  }

  // 3. End Time - Syncfusion ejs-timepicker
  if (entry.endTime) {
    await fillTimePicker(page, row, 'EndTimeDate', entry.endTime);
  }

  // 4. Tasks - Syncfusion ejs-multiselect
  await fillTasks(page, row, entry);

  // 5. Comments — use evaluate to set value + dispatch events within Angular's zone
  await fillCommentsViaEvaluate(page, row, entry);

  // 6. Reason for Deviation
  await fillReasonForDeviation(page, row, entry, employee);

  // 7. Trigger save by clicking the hours/status column within THIS row.
  //    This triggers focusout on the textarea, which Angular's component
  //    handles as a row-level save. Clicking within the row keeps the
  //    focusout event scoped to the row component.
  const hoursCol = row.locator('td.timesheet-hours-column');
  if (await hoursCol.count() > 0) {
    wmsLog('[WMS]     Clicking hours column to trigger save...');
    await hoursCol.click();
    await page.waitForTimeout(2000);
  }
}

/**
 * Select the client from the ClientId dropdown.
 * For Roaming Specialists, there's typically one option.
 */
async function fillClient(row) {
  const clientSelect = row.locator('select[formcontrolname="ClientId"]');
  if (await clientSelect.count() === 0) return;

  const isDisabled = await clientSelect.getAttribute('disabled');
  if (isDisabled !== null) return;

  // Check if a client is already selected (non-empty value)
  const currentValue = await clientSelect.inputValue().catch(() => '');
  if (currentValue && currentValue !== '' && currentValue !== '--Pick a client--') {
    wmsLog(`[WMS]     Client already selected: ${currentValue}`);
    return;
  }

  // Get all non-disabled options
  const options = clientSelect.locator('option:not([disabled])');
  const optionCount = await options.count();

  if (optionCount > 0) {
    // Select the first non-disabled, non-placeholder option
    for (let i = 0; i < optionCount; i++) {
      const optText = await options.nth(i).textContent();
      const optValue = await options.nth(i).getAttribute('value');
      if (optText && !optText.includes('Pick a client') && optValue) {
        await clientSelect.selectOption({ index: i });
        wmsLog(`[WMS]     Selected client: ${optText.trim()}`);
        break;
      }
    }
  }
}

/**
 * Fill a Syncfusion ejs-timepicker field.
 */
async function fillTimePicker(page, row, fieldPrefix, time24) {
  const input = row.locator(`input[id^="${fieldPrefix}_"][id$="_input"]`);
  if (await input.count() === 0) return;

  const isDisabled = await input.getAttribute('disabled');
  if (isDisabled !== null) return;

  const formatted = formatTimeForTSSP(time24);

  // Check if already has the correct value
  const currentVal = (await input.getAttribute('value') || '').trim();
  if (currentVal === formatted) {
    wmsLog(`[WMS]     ${fieldPrefix} already correct: ${formatted}`);
    return;
  }

  await input.click({ clickCount: 3 }); // Select all existing text
  await input.fill('');
  await input.type(formatted, { delay: 50 });
  await input.press('Enter');
  await page.waitForTimeout(300);
}

/**
 * Fill the Tasks multiselect dropdown.
 */
async function fillTasks(page, row, entry) {
  // Check if task is already selected via data-initial-value or chips
  const taskMultiselect = row.locator('ejs-multiselect[formcontrolname="Tasks"]');
  if (await taskMultiselect.count() === 0) return;

  const existingChips = row.locator('ejs-multiselect[formcontrolname="Tasks"] .e-chips');
  const chipCount = await existingChips.count();
  if (chipCount > 0) {
    const chipTitle = await existingChips.first().getAttribute('title').catch(() => '');
    wmsLog(`[WMS]     Task already selected: ${chipTitle}`);
    return;
  }

  const taskCell = row.locator('td.timesheet-task-column');
  if (await taskCell.count() === 0) return;

  const dropdownIcon = taskCell.locator('.e-ddl-icon, .e-input-group-icon');
  if (!(await dropdownIcon.isVisible().catch(() => false))) return;

  await dropdownIcon.click();
  await page.waitForTimeout(1000);

  // The multiselect popup should now be visible
  const popupList = page.locator('.e-popup.e-multi-select-list-wrapper:visible, .e-dropdownbase-popup:visible, .e-popup:visible');
  if (!(await popupList.first().isVisible({ timeout: 3000 }).catch(() => false))) return;

  const roleName = entry.role ? entry.role.name : '';

  // Try matching by role name
  let taskOption = popupList.locator(`li:has-text("${roleName}")`).first();
  let found = await taskOption.isVisible().catch(() => false);

  if (!found) {
    // Try "General RST Duties" as default for Roaming Specialist Technician
    taskOption = popupList.locator('li:has-text("General RST Duties")').first();
    found = await taskOption.isVisible().catch(() => false);
  }

  if (!found) {
    // Pick the first available option
    taskOption = popupList.locator('li.e-list-item').first();
    found = await taskOption.isVisible().catch(() => false);
  }

  if (found) {
    await taskOption.click();
    await page.waitForTimeout(500);
  }

  // Close dropdown by clicking the comments column
  const commentsCol = row.locator('td.timesheet-comments-column');
  if (await commentsCol.count() > 0) {
    await commentsCol.click();
  }
  await page.waitForTimeout(300);
}

/**
 * Build the comment text from entry data.
 */
function buildCommentText(entry) {
  const parts = [];

  if (entry.startingLocation) {
    parts.push(`[${entry.startingLocation}]`);
  }

  if (entry.locationNotes) {
    try {
      const locNotes = typeof entry.locationNotes === 'string'
        ? JSON.parse(entry.locationNotes)
        : entry.locationNotes;

      if (Array.isArray(locNotes) && locNotes.length > 0) {
        locNotes.forEach(ln => {
          const location = ln.location || 'General';
          const tasks = htmlToBulletPoints(ln.description || '');
          parts.push(`[${location}]\n${tasks}`);
        });
      }
    } catch (e) {
      // Fall through to use notes
    }
  }

  if (parts.length <= (entry.startingLocation ? 1 : 0) && entry.notes) {
    parts.push(htmlToPlainText(entry.notes));
  }

  return parts.join('\n\n');
}

/**
 * Fill the Comments textarea using Playwright's .fill() to stay within
 * Angular's zone, ensuring the FormControl detects the change.
 */
async function fillCommentsViaEvaluate(page, row, entry) {
  const commentText = buildCommentText(entry);
  if (!commentText) return;

  const comments = row.locator('textarea[formcontrolname="Comments"]');
  if (await comments.count() === 0) return;

  const isDisabled = await comments.getAttribute('disabled');
  if (isDisabled !== null) return;

  // Use Playwright's .fill() which triggers proper Angular zone events
  await comments.click();
  await page.waitForTimeout(200);
  await comments.fill(commentText);
  wmsLog(`[WMS]     Comments filled (${commentText.length} chars)`);
  await page.waitForTimeout(300);
}

/**
 * Fill the Reason for Deviation textarea.
 * Uses the user-provided reasonForDeviation from the entry if available.
 * Falls back to auto-generating one if times differ from default schedule.
 * Max 256 characters.
 */
async function fillReasonForDeviation(page, row, entry, employee) {
  const textarea = row.locator('textarea[formcontrolname="ReasonForDeviation"]');
  if (await textarea.count() === 0) return;

  const isDisabled = await textarea.getAttribute('disabled');
  if (isDisabled !== null) return;

  // Check if already has content in TSSP
  const currentValue = await textarea.inputValue().catch(() => '');
  if (currentValue.trim()) return;

  let deviationText = null;

  // Use user-provided reason if available
  if (entry.reasonForDeviation) {
    deviationText = entry.reasonForDeviation.substring(0, 256);
  } else if (employee) {
    // Auto-generate if times differ from default schedule
    const morningStart = employee.morningStart || '08:30';
    const morningEnd = employee.morningEnd || '12:30';
    const afternoonStart = employee.afternoonStart || '13:00';
    const afternoonEnd = employee.afternoonEnd || '17:00';

    const isMorningSlot = entry.startTime === morningStart && entry.endTime === morningEnd;
    const isAfternoonSlot = entry.startTime === afternoonStart && entry.endTime === afternoonEnd;

    if (!isMorningSlot && !isAfternoonSlot) {
      deviationText = '.';
    }
  }

  if (deviationText) {
    await textarea.click();
    await page.waitForTimeout(200);
    await textarea.fill(deviationText);
    wmsLog(`[WMS]     Added reason for deviation: ${deviationText}`);
  }
}

// ==================== TSSP ERROR DETECTION ====================

/**
 * Detect errors shown by TSSP after an auto-save.
 * Angular apps typically show toast/notification on error.
 * Also checks for HTTP 500 error indicators in the page.
 */
async function detectTsspError(page) {
  return await page.evaluate(() => {
    // Check for ngx-toastr and Syncfusion toast notifications
    const toastSelectors = [
      '.toast-error .toast-message',     // ngx-toastr (TSSP uses this)
      '.toast-error',
      '.e-toast-container .e-toast',
      '.e-toast.e-toast-danger',
      '.notification-error',
      '.alert-danger:not([style*="display: none"])',
      '.e-dialog.e-popup .e-dlg-content',
      '.error-message',
      '.toast-message'
    ];

    for (const selector of toastSelectors) {
      const el = document.querySelector(selector);
      if (el && el.offsetParent !== null) {
        const text = (el.textContent || '').trim();
        if (text && (text.toLowerCase().includes('error') ||
                     text.toLowerCase().includes('fail') ||
                     text.toLowerCase().includes('500') ||
                     text.toLowerCase().includes('internal server') ||
                     text.toLowerCase().includes('unable') ||
                     text.toLowerCase().includes('could not'))) {
          return text.substring(0, 300);
        }
      }
    }

    // Check if the page itself shows a server error
    const bodyText = document.body ? (document.body.innerText || '') : '';
    if (bodyText.includes('500 Internal Server Error') ||
        bodyText.includes('Server Error') ||
        bodyText.includes('An error has occurred')) {
      return bodyText.substring(0, 300);
    }

    return null;
  }).catch(() => null);
}

/**
 * Dismiss any visible error toasts/dialogs in TSSP.
 */
async function dismissTsspError(page) {
  try {
    // Try closing ngx-toastr / Syncfusion toast
    const closeBtn = page.locator('.toast-close-button, .e-toast-close-icon, .e-dlg-closeicon-btn').first();
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
  } catch (e) {
    // Ignore - toast may auto-dismiss
  }
}

// ==================== HTML -> TEXT HELPERS ====================

/**
 * Convert HTML content to bullet point format.
 * <ul><li>Item 1</li><li>Item 2</li></ul> -> "- Item 1\n- Item 2"
 * <ol><li>Item 1</li></ol> -> "1. Item 1"
 * <p>Text</p> -> "- Text"
 */
function htmlToBulletPoints(html) {
  if (!html) return '';

  // Handle ordered lists
  let text = html.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, content) => {
    let counter = 0;
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (m, item) => {
      counter++;
      return `${counter}. ${stripTags(item).trim()}`;
    });
  });

  // Handle unordered lists
  text = text.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, content) => {
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (m, item) => {
      return `- ${stripTags(item).trim()}`;
    });
  });

  // Handle remaining <li> tags (outside ul/ol)
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (m, item) => {
    return `- ${stripTags(item).trim()}`;
  });

  // Handle paragraphs as bullet points
  text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (m, content) => {
    const stripped = stripTags(content).trim();
    if (!stripped) return '';
    return `- ${stripped}`;
  });

  // Handle <br> tags
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Strip any remaining tags
  text = stripTags(text);

  // Clean up multiple newlines
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text;
}

/**
 * Convert HTML to plain text, preserving basic structure.
 */
function htmlToPlainText(html) {
  if (!html) return '';

  let text = html;

  // Convert list items to bullet points
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (m, content) => {
    return `- ${stripTags(content).trim()}\n`;
  });

  // Convert paragraphs to text blocks
  text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (m, content) => {
    return `${stripTags(content).trim()}\n`;
  });

  // Convert <br> to newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Strip remaining tags
  text = stripTags(text);

  // Decode HTML entities
  text = text.replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Strip all HTML tags from a string.
 */
function stripTags(html) {
  return html.replace(/<[^>]*>/g, '');
}

// ==================== LOGOUT ====================

/**
 * Logout from TSSP/ADFS to end the session.
 * This ensures no session persists between different users' syncs.
 */
async function logout(page) {
  try {
    // Try clicking a logout link/button on the TSSP page
    const logoutSelectors = [
      'a[href*="logout"]',
      'a[href*="signout"]',
      'button:has-text("Log out")',
      'button:has-text("Sign out")',
      'a:has-text("Log out")',
      'a:has-text("Sign out")',
      '.logout-link',
      '#logout'
    ];

    for (const selector of logoutSelectors) {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        await el.click();
        await page.waitForTimeout(2000);
        console.log(`[WMS] Logged out via: ${selector}`);
        return;
      }
    }

    // Fallback: navigate to common ADFS sign-out URL
    await page.goto(`${WMS_CONFIG.baseUrl}/signout`, { timeout: 10000 }).catch(() => {});
    console.log('[WMS] Logged out via signout URL');
  } catch (err) {
    console.log('[WMS] Logout best-effort failed:', err.message);
    // Non-fatal — the browser context will be destroyed anyway
  }
}

// ==================== HELPERS ====================

function getDeWorkerId(employee) {
  if (!employee.identifiers || employee.identifiers.length === 0) return null;
  const wmsIdentifier = employee.identifiers.find(id => id.identifierType === 'de_worker_id');
  return wmsIdentifier ? wmsIdentifier.identifierValue : null;
}

/**
 * Format date to match TSSP display format: "09 Feb" or "10 Feb"
 */
function formatDateForMatch(date) {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = d.toLocaleString('en-AU', { month: 'short' });
  return `${day} ${month}`;
}

/**
 * Convert 24h time "08:30" to 12h format "8:30 AM" for Syncfusion timepicker
 */
function formatTimeForTSSP(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

module.exports = {
  syncTimesheet,
  WMS_CONFIG
};
