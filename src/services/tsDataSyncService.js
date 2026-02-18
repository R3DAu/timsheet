const { PrismaClient } = require('@prisma/client');
const tsDataService = require('./tsDataService');
const { parseLocalDate, formatLocalDate, isWeekend, getWeekStart, getWeekEnd, parseTimeToHours } = require('../utils/dateUtils');

const prisma = new PrismaClient();

const STATUS_PRIORITY = {
  'OPEN': 0,
  'INCOMPLETE': 1,
  'SUBMITTED': 2,
  'APPROVED': 3,
  'LOCKED': 4,
  'PROCESSED': 5
};

// Week start/end and time parsing now handled by dateUtils.js

class TsDataSyncService {
  constructor() {
    this.syncInProgress = false;
  }

  /**
   * Main sync — called by scheduler or manually.
   *
   * TSDATA returns flat rows: each "timesheet" is a single day entry with
   * { id, worker_id, entry_date, hours_logged, status, school_name, ... }.
   *
   * We group these by week (Mon–Sun) → one local Timesheet per week,
   * and import each row as a TimesheetEntry.
   */
  async performSync() {
    if (this.syncInProgress) {
      console.log('[TSDATA Sync] Already in progress, skipping');
      return { skipped: true };
    }

    this.syncInProgress = true;
    const startedAt = new Date();

    const results = {
      success: false,
      timesheetsCreated: 0,
      timesheetsUpdated: 0,
      entriesCreated: 0,
      entriesUpdated: 0,
      errors: []
    };

    try {
      console.log(`[TSDATA Sync] Starting at ${startedAt.toISOString()}`);

      // Step 1: Get current period
      const currentPeriod = await tsDataService.getCurrentPeriod();
      if (!currentPeriod) throw new Error('No current period returned from TSDATA');

      const periodId = currentPeriod.id;
      console.log(`[TSDATA Sync] Period: ${periodId} (${currentPeriod.start_date} to ${currentPeriod.end_date})`);

      // Step 2: Find local employees with de_worker_id
      const deWorkers = await this.findDeWorkers();
      console.log(`[TSDATA Sync] Found ${deWorkers.length} DE workers`);

      // Step 3: Sync each worker
      for (const worker of deWorkers) {
        try {
          const r = await this.syncWorker(worker, currentPeriod);
          results.timesheetsCreated += r.timesheetsCreated;
          results.timesheetsUpdated += r.timesheetsUpdated;
          results.entriesCreated += r.entriesCreated;
          results.entriesUpdated += r.entriesUpdated;
        } catch (error) {
          console.error(`[TSDATA Sync] Error syncing worker ${worker.id} (${worker.user.name}):`, error.message);
          results.errors.push({ employeeId: worker.id, name: worker.user.name, error: error.message });
        }
      }

      results.success = true;
      results.duration = Date.now() - startedAt.getTime();

      await this.logSync({
        syncType: 'FULL_SYNC',
        status: results.errors.length > 0 ? 'PARTIAL' : 'SUCCESS',
        recordsProcessed: deWorkers.length,
        recordsCreated: results.timesheetsCreated + results.entriesCreated,
        recordsUpdated: results.timesheetsUpdated + results.entriesUpdated,
        errorMessage: results.errors.length > 0 ? `${results.errors.length} worker(s) had errors` : null,
        syncDetails: JSON.stringify(results)
      });

      console.log(`[TSDATA Sync] Completed in ${results.duration}ms:`, {
        timesheetsCreated: results.timesheetsCreated,
        timesheetsUpdated: results.timesheetsUpdated,
        entriesCreated: results.entriesCreated,
        entriesUpdated: results.entriesUpdated,
        errors: results.errors.length
      });

      return results;
    } catch (error) {
      console.error('[TSDATA Sync] Fatal error:', error);
      await this.logSync({ syncType: 'FULL_SYNC', status: 'ERROR', errorMessage: error.message });
      return { success: false, error: error.message };
    } finally {
      this.syncInProgress = false;
    }
  }

  async findDeWorkers() {
    return prisma.employee.findMany({
      where: {
        identifiers: { some: { identifierType: 'de_worker_id' } }
      },
      include: {
        identifiers: true,
        user: { select: { name: true, email: true } },
        roles: {
          where: { isActive: true },
          include: { role: true, company: true }
        }
      }
    });
  }

  /**
   * Sync a single worker.
   *
   * 1. Fetch all TSDATA rows for worker + period (each row = one day entry).
   * 2. Group by week (Mon–Sun).
   * 3. For each week: ensure a local Timesheet exists, then upsert entries.
   */
  async syncWorker(worker, currentPeriod) {
    const results = { timesheetsCreated: 0, timesheetsUpdated: 0, entriesCreated: 0, entriesUpdated: 0 };

    const deIdentifier = worker.identifiers.find(i => i.identifierType === 'de_worker_id');
    if (!deIdentifier) return results;

    const tsDataWorkerId = deIdentifier.identifierValue;
    const periodId = String(currentPeriod.id);

    // Fetch all TSDATA entries for this worker in the current period
    const tsRows = await tsDataService.getTimesheets({
      workerId: tsDataWorkerId,
      periodId
    });

    console.log(`[TSDATA Sync] Worker ${worker.id} (${worker.user.name}): ${tsRows.length} TSDATA entries`);

    if (tsRows.length === 0) return results;

    // Group rows by week (Mon–Sun based on entry_date)
    // Also filter out weekend entries early to avoid processing them
    const weekMap = new Map(); // weekStartISO → { weekStarting, weekEnding, rows[] }
    let weekendSkipped = 0;

    for (const row of tsRows) {
      // Check for weekend entries early and skip them
      let dateStr = row.entry_date;
      if (dateStr.includes('T')) {
        dateStr = dateStr.split('T')[0];
      }

      if (isWeekend(dateStr)) {
        weekendSkipped++;
        continue; // Skip weekend entries entirely
      }

      const entryDate = parseLocalDate(row.entry_date);
      const weekStarting = getWeekStart(entryDate);
      const weekEnding = getWeekEnd(entryDate);
      const key = weekStarting.toISOString();

      if (!weekMap.has(key)) {
        weekMap.set(key, { weekStarting, weekEnding, rows: [] });
      }
      weekMap.get(key).rows.push(row);
    }

    if (weekendSkipped > 0) {
      console.log(`[TSDATA Sync] ⏭️  Filtered out ${weekendSkipped} weekend entries before processing`);
    }

    // Process each week
    for (const [, week] of weekMap) {
      try {
        // Determine the "highest" status across all rows in this week
        const weekStatus = this.highestStatus(week.rows.map(r => tsDataService.mapStatus(r.status)));

        // Ensure local timesheet
        const { timesheet, created, skipEntries } = await this.ensureTimesheet(
          worker, week.weekStarting, week.weekEnding, periodId, weekStatus
        );
        if (created) results.timesheetsCreated++;
        else results.timesheetsUpdated++;

        // Skip entry import for APPROVED or higher timesheets (already finalised)
        if (skipEntries) continue;

        // Upsert each entry
        for (const row of week.rows) {
          try {
            const r = await this.syncEntry(timesheet, worker, row);
            if (r.created) results.entriesCreated++;
            if (r.updated) results.entriesUpdated++;
          } catch (error) {
            console.error(`[TSDATA Sync] Error syncing entry ${row.id}:`, error.message);
          }
        }

        // Check if all entries are verified and update timesheet verification status
        await this.updateTimesheetVerification(timesheet.id);
      } catch (error) {
        console.error(`[TSDATA Sync] Error syncing week for worker ${worker.id}:`, error.message);
      }
    }

    return results;
  }

  /**
   * Ensure a local Timesheet exists for employee + weekStarting. Returns { timesheet, created, skipEntries }.
   *
   * Uses a date-range lookup (±1 day window) instead of an exact timestamp match to avoid
   * timezone-offset mismatches where the stored weekStarting differs by UTC offset but
   * represents the same Monday (e.g. 2026-02-09T00:00 local vs 2026-02-08T13:00Z UTC).
   *
   * Sets skipEntries=true when the existing timesheet is APPROVED or higher — those are
   * "done" timesheets (Xero-synced, etc.) and should not have TSDATA entries imported into them.
   */
  async ensureTimesheet(worker, weekStarting, weekEnding, periodId, tsDataStatus) {
    // Date-range window covers the full local Monday regardless of UTC offset stored
    const dayStart = new Date(weekStarting);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(weekStarting);
    dayEnd.setHours(23, 59, 59, 999);

    const existing = await prisma.timesheet.findFirst({
      where: {
        employeeId: worker.id,
        weekStarting: { gte: dayStart, lte: dayEnd }
      }
    });

    if (existing) {
      const updateData = {
        tsDataPeriodId: periodId,
        tsDataStatus,
        tsDataSyncedAt: new Date()
      };

      // Don't touch the status of APPROVED or higher timesheets — they're finalised
      const isApprovedOrHigher = (STATUS_PRIORITY[existing.status] ?? 0) >= STATUS_PRIORITY['APPROVED'];
      if (!isApprovedOrHigher && this.shouldUpdateStatus(existing.status, tsDataStatus)) {
        updateData.status = tsDataStatus;
      }

      const timesheet = await prisma.timesheet.update({ where: { id: existing.id }, data: updateData });

      if (isApprovedOrHigher) {
        console.log(`[TSDATA Sync] Skipping entry import for timesheet ${existing.id} — status is ${existing.status}`);
        return { timesheet, created: false, skipEntries: true };
      }

      return { timesheet, created: false, skipEntries: false };
    }

    const timesheet = await prisma.timesheet.create({
      data: {
        employeeId: worker.id,
        weekStarting,
        weekEnding,
        status: tsDataStatus || 'OPEN',
        tsDataPeriodId: periodId,
        tsDataStatus: tsDataStatus || 'OPEN',
        tsDataSyncedAt: new Date(),
        autoCreated: true
      }
    });
    console.log(`[TSDATA Sync] Created timesheet ${timesheet.id} for employee ${worker.id} (week ${weekStarting.toISOString().slice(0, 10)})`);
    return { timesheet, created: true };
  }

  /**
   * Upsert a single TSDATA row as a local TimesheetEntry.
   *
   * Smart matching strategy:
   * 1. If tsDataEntryId already exists, update it
   * 2. Otherwise, try to match existing entry by date + hours (±0.25h tolerance)
   * 3. If match found, mark as verified (don't overwrite data)
   * 4. If no match, create new TSDATA entry
   *
   * Weekend filter: Skip entries on Saturday (6) or Sunday (0) to avoid importing
   * weekend work that typically shouldn't exist.
   *
   * TSDATA row shape:
   *   { id, worker_id, period_id, assignment_id, school_id, school_name,
   *     entry_date, hours_worked, hours_logged ("HH:MM:SS"), status, notes, ... }
   */
  async syncEntry(localTimesheet, worker, tsRow) {
    // Extract date string - handle both ISO format and plain YYYY-MM-DD
    let dateStr = tsRow.entry_date;
    if (dateStr.includes('T')) {
      dateStr = dateStr.split('T')[0];
    }

    // Skip weekend entries (Saturday & Sunday) using dateUtils
    if (isWeekend(dateStr)) {
      const dayName = parseLocalDate(dateStr).toLocaleDateString('en-US', { weekday: 'long' });
      console.log(`[TSDATA Sync] ⏭️  SKIPPING weekend entry: ${dateStr} (${dayName}) - TSDATA ID: ${tsRow.id}`);
      return { created: false, updated: false, skipped: true };
    }
    const tsEntryId = String(tsRow.id);
    const entryStatus = tsDataService.mapStatus(tsRow.status);

    // Map fields
    const entryData = this.mapEntryData(worker, tsRow);

    // Check if entry already exists by tsDataEntryId
    const existingById = await prisma.timesheetEntry.findUnique({
      where: { tsDataEntryId: tsEntryId }
    });

    if (existingById) {
      // Update existing TSDATA entry
      console.log(`[TSDATA Sync] Updating existing entry ${existingById.id} for ${dateStr} (TSDATA ID: ${tsEntryId})`);
      await prisma.timesheetEntry.update({
        where: { id: existingById.id },
        data: {
          ...entryData,
          status: this.shouldUpdateStatus(existingById.status, entryStatus) ? entryStatus : existingById.status,
          tsDataSyncedAt: new Date(),
          verified: true
        }
      });
      return { created: false, updated: true };
    }

    // Try to match existing local entry by date + hours (reuse dateStr from above)
    const matchingEntry = await this.findMatchingLocalEntry(localTimesheet.id, dateStr, entryData.hours);

    if (matchingEntry) {
      // Found a match! Mark it as verified and link to TSDATA
      await prisma.timesheetEntry.update({
        where: { id: matchingEntry.id },
        data: {
          verified: true,
          tsDataEntryId: tsEntryId,
          tsDataSyncedAt: new Date()
        }
      });
      console.log(`[TSDATA Sync] Verified entry ${matchingEntry.id} matches TSDATA entry ${tsEntryId}`);
      return { created: false, updated: true };
    }

    // No match found — create new TSDATA entry
    console.log(`[TSDATA Sync] ✨ Creating NEW TSDATA entry for ${dateStr} (TSDATA ID: ${tsEntryId})`);
    await prisma.timesheetEntry.create({
      data: {
        timesheetId: localTimesheet.id,
        ...entryData,
        status: entryStatus,
        tsDataSource: true,
        tsDataEntryId: tsEntryId,
        tsDataSyncedAt: new Date(),
        verified: true // TSDATA entries are verified by definition
      }
    });
    console.log(`[TSDATA Sync] ✅ Created new TSDATA entry ${tsEntryId} (no local match)`);
    return { created: true, updated: false };
  }

  /**
   * Find a local entry that matches by date + hours (±0.25h tolerance).
   * Returns first match or null.
   */
  async findMatchingLocalEntry(timesheetId, dateStr, hours) {
    // Get all entries for this timesheet on this date (use local timezone)
    const dateStart = parseLocalDate(dateStr);
    const dateEnd = new Date(dateStart);
    dateEnd.setHours(23, 59, 59, 999);

    const entries = await prisma.timesheetEntry.findMany({
      where: {
        timesheetId,
        date: {
          gte: dateStart,
          lte: dateEnd
        },
        tsDataSource: false, // Only match local entries, not TSDATA entries
        verified: false // Don't re-match already verified entries
      }
    });

    // Find entry with matching hours (±15 minutes = 0.25h)
    const TOLERANCE = 0.25;
    for (const entry of entries) {
      if (Math.abs(entry.hours - hours) <= TOLERANCE) {
        return entry;
      }
    }

    return null;
  }

  /**
   * Check if all entries in a timesheet are verified.
   * If so, mark the timesheet as verified.
   */
  async updateTimesheetVerification(timesheetId) {
    const entries = await prisma.timesheetEntry.findMany({
      where: { timesheetId },
      select: { verified: true }
    });

    if (entries.length === 0) {
      // No entries, timesheet not verified
      await prisma.timesheet.update({
        where: { id: timesheetId },
        data: { verified: false }
      });
      return;
    }

    const allVerified = entries.every(e => e.verified);

    await prisma.timesheet.update({
      where: { id: timesheetId },
      data: { verified: allVerified }
    });

    if (allVerified) {
      console.log(`[TSDATA Sync] Timesheet ${timesheetId} fully verified (${entries.length}/${entries.length} entries)`);
    } else {
      const verifiedCount = entries.filter(e => e.verified).length;
      console.log(`[TSDATA Sync] Timesheet ${timesheetId} partially verified (${verifiedCount}/${entries.length} entries)`);
    }
  }

  /**
   * Map a TSDATA row to local TimesheetEntry fields.
   */
  mapEntryData(worker, tsRow) {
    // Find matching role/company
    const activeRole = worker.roles[0];
    if (!activeRole) {
      throw new Error(`Employee ${worker.id} has no active roles — cannot import entry`);
    }

    let roleId = activeRole.roleId;
    let companyId = activeRole.companyId;

    // Try to match by school_name → company name
    if (tsRow.school_name) {
      const match = worker.roles.find(r =>
        r.company.name.toLowerCase() === tsRow.school_name.toLowerCase()
      );
      if (match) {
        roleId = match.roleId;
        companyId = match.companyId;
      }
    }

    // Parse date using dateUtils to handle timezone correctly
    const date = parseLocalDate(tsRow.entry_date);
    const hours = parseTimeToHours(tsRow.hours_logged);

    // Calculate start/end times from employee's default schedule + hours_logged
    const { startTime, endTime } = this.calculateTimesFromSchedule(worker, hours);

    return {
      entryType: 'GENERAL',
      date,
      startTime,
      endTime,
      hours,
      roleId,
      companyId,
      notes: tsRow.notes || null,
      startingLocation: tsRow.school_name || null
    };
  }

  /**
   * Calculate start/end times from employee's default schedule and hours duration.
   * If hours <= 4, use morning session. If > 4, use full day starting from morningStart.
   */
  calculateTimesFromSchedule(worker, hours) {
    const morningStart = worker.morningStart || '08:30';
    const morningEnd = worker.morningEnd || '12:30';
    const afternoonStart = worker.afternoonStart || '13:00';
    const afternoonEnd = worker.afternoonEnd || '17:00';

    // If 4 hours or less, assume morning session
    if (hours <= 4) {
      return { startTime: morningStart, endTime: morningEnd };
    }

    // If 4-8 hours, start from morning and calculate end time
    const startMinutes = this.timeToMinutes(morningStart);
    const endMinutes = startMinutes + Math.round(hours * 60);
    const endTime = this.minutesToTime(endMinutes);

    return { startTime: morningStart, endTime };
  }

  /**
   * Convert HH:MM to minutes since midnight
   */
  timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }

  /**
   * Convert minutes since midnight to HH:MM
   */
  minutesToTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /**
   * Return the highest-priority status from an array.
   */
  highestStatus(statuses) {
    let highest = 'OPEN';
    for (const s of statuses) {
      if ((STATUS_PRIORITY[s] ?? 0) > (STATUS_PRIORITY[highest] ?? 0)) {
        highest = s;
      }
    }
    return highest;
  }

  shouldUpdateStatus(currentStatus, newStatus) {
    return (STATUS_PRIORITY[newStatus] ?? 0) > (STATUS_PRIORITY[currentStatus] ?? 0);
  }

  async logSync({ syncType, status, employeeId, timesheetId, recordsProcessed = 0, recordsCreated = 0, recordsUpdated = 0, recordsSkipped = 0, errorMessage = null, syncDetails = null }) {
    try {
      await prisma.tsDataSyncLog.create({
        data: {
          syncType, status,
          employeeId: employeeId || null,
          timesheetId: timesheetId || null,
          recordsProcessed, recordsCreated, recordsUpdated, recordsSkipped,
          errorMessage, syncDetails,
          completedAt: new Date()
        }
      });
    } catch (error) {
      console.error('[TSDATA Sync] Failed to log sync:', error.message);
    }
  }

  /**
   * One-time cleanup: Remove duplicate TSDATA entries and verify matching local entries.
   *
   * This fixes entries imported before smart matching was implemented.
   * Groups TSDATA entries by matching local entry, keeps one link, deletes all duplicates.
   */
  /**
   * Merge duplicate timesheets that have the same employee + week.
   * This can happen when timezone handling changes or TSDATA creates duplicates.
   */
  async mergeDuplicateTimesheets() {
    console.log('[TSDATA Cleanup] Merging duplicate timesheets...');

    try {
      // Get all timesheets grouped by employee
      const employees = await prisma.employee.findMany({
        include: {
          timesheets: {
            orderBy: { id: 'asc' },
            include: {
              entries: true
            }
          }
        }
      });

      let timesheetsMerged = 0;
      let timesheetsDeleted = 0;
      let entriesMoved = 0;

      for (const employee of employees) {
        // Group timesheets by week (using formatLocalDate for consistent comparison)
        const weekMap = new Map(); // weekKey -> [timesheets]

        for (const ts of employee.timesheets) {
          const weekStart = getWeekStart(ts.weekStarting);
          const weekKey = formatLocalDate(weekStart);

          if (!weekMap.has(weekKey)) {
            weekMap.set(weekKey, []);
          }
          weekMap.get(weekKey).push(ts);
        }

        // For each week with duplicates, merge them
        for (const [weekKey, timesheets] of weekMap) {
          if (timesheets.length <= 1) continue; // No duplicates

          console.log(`[TSDATA Cleanup] Employee ${employee.id}: ${timesheets.length} timesheets for week ${weekKey}`);

          // Sort: keep the one with most entries, or oldest if tied
          timesheets.sort((a, b) => {
            if (b.entries.length !== a.entries.length) {
              return b.entries.length - a.entries.length; // Most entries first
            }
            return a.id - b.id; // Oldest first
          });

          const keepTimesheet = timesheets[0];
          const duplicates = timesheets.slice(1);

          console.log(`[TSDATA Cleanup] Keeping timesheet ${keepTimesheet.id} (${keepTimesheet.entries.length} entries)`);

          // Move entries from duplicates to the kept timesheet
          for (const duplicate of duplicates) {
            if (duplicate.entries.length > 0) {
              await prisma.timesheetEntry.updateMany({
                where: { timesheetId: duplicate.id },
                data: { timesheetId: keepTimesheet.id }
              });
              entriesMoved += duplicate.entries.length;
              console.log(`[TSDATA Cleanup] Moved ${duplicate.entries.length} entries from timesheet ${duplicate.id}`);
            }

            // Delete the duplicate timesheet
            await prisma.timesheet.delete({
              where: { id: duplicate.id }
            });
            timesheetsDeleted++;
            console.log(`[TSDATA Cleanup] Deleted duplicate timesheet ${duplicate.id}`);
          }

          timesheetsMerged++;
        }
      }

      const result = {
        timesheetsMerged,
        timesheetsDeleted,
        entriesMoved
      };

      console.log('[TSDATA Cleanup] Merge completed:', result);
      return result;
    } catch (error) {
      console.error('[TSDATA Cleanup] Merge error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove all weekend TSDATA entries (Saturday & Sunday).
   * These are typically data quality issues from TSDATA.
   */
  async removeWeekendTsDataEntries() {
    console.log('[TSDATA Cleanup] Removing weekend TSDATA entries...');

    try {
      // Get all TSDATA entries
      const tsDataEntries = await prisma.timesheetEntry.findMany({
        where: { tsDataSource: true },
        select: { id: true, date: true }
      });

      let removed = 0;
      const toDelete = [];

      for (const entry of tsDataEntries) {
        // Use formatLocalDate to get YYYY-MM-DD string, then check if weekend
        const dateStr = formatLocalDate(entry.date);
        if (isWeekend(dateStr)) {
          toDelete.push(entry.id);
        }
      }

      console.log(`[TSDATA Cleanup] Found ${toDelete.length} weekend entries to remove`);

      // Delete in batches
      if (toDelete.length > 0) {
        await prisma.timesheetEntry.deleteMany({
          where: { id: { in: toDelete } }
        });
        removed = toDelete.length;
      }

      // Update verification for affected timesheets
      const affectedTimesheets = await prisma.timesheet.findMany({
        where: { verified: true },
        select: { id: true }
      });

      for (const ts of affectedTimesheets) {
        await this.updateTimesheetVerification(ts.id);
      }

      const result = {
        weekendEntriesRemoved: removed,
        timesheetsUpdated: affectedTimesheets.length
      };

      console.log('[TSDATA Cleanup] Weekend removal completed:', result);
      return result;
    } catch (error) {
      console.error('[TSDATA Cleanup] Weekend removal error:', error);
      return { success: false, error: error.message };
    }
  }

  async cleanupDuplicateTsDataEntries() {
    console.log('[TSDATA Cleanup] Starting duplicate entry cleanup...');

    let duplicatesRemoved = 0;
    let entriesVerified = 0;
    let errors = [];

    try {
      // Get all timesheets with entries
      const timesheets = await prisma.timesheet.findMany({
        include: {
          entries: {
            orderBy: { id: 'asc' }
          }
        }
      });

      console.log(`[TSDATA Cleanup] Checking ${timesheets.length} timesheets...`);

      // Track deleted entry IDs to avoid double-deletion
      const deletedEntryIds = new Set();

      for (const timesheet of timesheets) {
        try {
          // Separate TSDATA and local entries
          const tsDataEntries = timesheet.entries.filter(e => e.tsDataSource === true);
          const localEntries = timesheet.entries.filter(e => e.tsDataSource === false);

          if (tsDataEntries.length === 0 || localEntries.length === 0) continue;

          console.log(`[TSDATA Cleanup] Timesheet ${timesheet.id}: ${tsDataEntries.length} TSDATA, ${localEntries.length} local`);

          // For each local entry, find matching TSDATA duplicates
          for (const localEntry of localEntries) {
            const dateStr = formatLocalDate(localEntry.date);
            const TOLERANCE = 0.25;

            // Find all TSDATA entries that match this local entry (and haven't been deleted yet)
            const matchingTsDataEntries = tsDataEntries.filter(tsEntry => {
              if (deletedEntryIds.has(tsEntry.id)) return false; // Skip already deleted
              const tsDateStr = formatLocalDate(tsEntry.date);
              return tsDateStr === dateStr && Math.abs(tsEntry.hours - localEntry.hours) <= TOLERANCE;
            });

            if (matchingTsDataEntries.length > 0) {
              console.log(`[TSDATA Cleanup] Local entry ${localEntry.id}: found ${matchingTsDataEntries.length} TSDATA duplicates`);

              // Pick the first TSDATA entry to link (or the one with most recent sync)
              const linkEntry = matchingTsDataEntries.reduce((latest, curr) =>
                !latest || (curr.tsDataSyncedAt && curr.tsDataSyncedAt > latest.tsDataSyncedAt) ? curr : latest
              );

              // IMPORTANT: Delete ALL TSDATA duplicates FIRST (to free up the tsDataEntryId unique constraint)
              for (const tsEntry of matchingTsDataEntries) {
                if (!deletedEntryIds.has(tsEntry.id)) {
                  await prisma.timesheetEntry.delete({
                    where: { id: tsEntry.id }
                  });
                  deletedEntryIds.add(tsEntry.id); // Track deletion
                  duplicatesRemoved++;
                  console.log(`[TSDATA Cleanup] ✓ Deleted TSDATA duplicate ${tsEntry.id}`);
                }
              }

              // THEN mark local entry as verified and link to chosen TSDATA entry
              // (now safe because tsDataEntryId is freed from the deleted entries)
              await prisma.timesheetEntry.update({
                where: { id: localEntry.id },
                data: {
                  verified: true,
                  tsDataEntryId: linkEntry.tsDataEntryId,
                  tsDataSyncedAt: linkEntry.tsDataSyncedAt || new Date()
                }
              });
              entriesVerified++;
              console.log(`[TSDATA Cleanup] ✓ Verified local entry ${localEntry.id}, linked to TSDATA ${linkEntry.tsDataEntryId}`);
            }
          }
        } catch (error) {
          console.error(`[TSDATA Cleanup] Error processing timesheet ${timesheet.id}:`, error.message);
          errors.push({ timesheetId: timesheet.id, error: error.message });
        }
      }

      // Update timesheet verification status for affected timesheets
      const affectedTimesheets = await prisma.timesheet.findMany({
        where: {
          entries: {
            some: { verified: true }
          }
        },
        select: { id: true }
      });

      for (const ts of affectedTimesheets) {
        await this.updateTimesheetVerification(ts.id);
      }

      const results = {
        duplicatesRemoved,
        entriesVerified,
        timesheetsUpdated: affectedTimesheets.length,
        errors: errors.length,
        errorDetails: errors
      };

      await this.logSync({
        syncType: 'CLEANUP_DUPLICATES',
        status: errors.length > 0 ? 'PARTIAL' : 'SUCCESS',
        recordsProcessed: timesheets.length,
        recordsCreated: 0,
        recordsUpdated: entriesVerified,
        recordsSkipped: duplicatesRemoved,
        errorMessage: errors.length > 0 ? `${errors.length} errors occurred` : null,
        syncDetails: JSON.stringify(results)
      });

      console.log('[TSDATA Cleanup] Completed:', results);
      return results;
    } catch (error) {
      console.error('[TSDATA Cleanup] Fatal error:', error);
      await this.logSync({
        syncType: 'CLEANUP_DUPLICATES',
        status: 'ERROR',
        errorMessage: error.message
      });
      return { success: false, error: error.message };
    }
  }
}

module.exports = new TsDataSyncService();
