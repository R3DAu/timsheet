const { PrismaClient } = require('@prisma/client');
const tsDataService = require('./tsDataService');

const prisma = new PrismaClient();

const STATUS_PRIORITY = {
  'OPEN': 0,
  'INCOMPLETE': 1,
  'SUBMITTED': 2,
  'APPROVED': 3,
  'LOCKED': 4,
  'PROCESSED': 5
};

/**
 * Get the Monday 00:00 UTC for the week containing a given date.
 */
function getWeekStart(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

/**
 * Get Sunday 00:00 UTC for the week containing a given date.
 */
function getWeekEnd(date) {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return end;
}

/**
 * Parse TSDATA hours_logged (HH:MM:SS or HH:MM) into decimal hours.
 */
function parseHoursLogged(hoursStr) {
  if (!hoursStr) return 0;
  const parts = hoursStr.split(':').map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;
  return h + m / 60 + s / 3600;
}

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
    const weekMap = new Map(); // weekStartISO → { weekStarting, weekEnding, rows[] }
    for (const row of tsRows) {
      const entryDate = new Date(row.entry_date);
      const weekStarting = getWeekStart(entryDate);
      const weekEnding = getWeekEnd(entryDate);
      const key = weekStarting.toISOString();

      if (!weekMap.has(key)) {
        weekMap.set(key, { weekStarting, weekEnding, rows: [] });
      }
      weekMap.get(key).rows.push(row);
    }

    // Process each week
    for (const [, week] of weekMap) {
      try {
        // Determine the "highest" status across all rows in this week
        const weekStatus = this.highestStatus(week.rows.map(r => tsDataService.mapStatus(r.status)));

        // Ensure local timesheet
        const { timesheet, created } = await this.ensureTimesheet(
          worker, week.weekStarting, week.weekEnding, periodId, weekStatus
        );
        if (created) results.timesheetsCreated++;
        else results.timesheetsUpdated++;

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
      } catch (error) {
        console.error(`[TSDATA Sync] Error syncing week for worker ${worker.id}:`, error.message);
      }
    }

    return results;
  }

  /**
   * Ensure a local Timesheet exists for employee + weekStarting. Returns { timesheet, created }.
   */
  async ensureTimesheet(worker, weekStarting, weekEnding, periodId, tsDataStatus) {
    const existing = await prisma.timesheet.findUnique({
      where: {
        employeeId_weekStarting: { employeeId: worker.id, weekStarting }
      }
    });

    if (existing) {
      const updateData = {
        tsDataPeriodId: periodId,
        tsDataStatus,
        tsDataSyncedAt: new Date()
      };
      if (this.shouldUpdateStatus(existing.status, tsDataStatus)) {
        updateData.status = tsDataStatus;
      }
      const timesheet = await prisma.timesheet.update({ where: { id: existing.id }, data: updateData });
      return { timesheet, created: false };
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
   * TSDATA row shape:
   *   { id, worker_id, period_id, assignment_id, school_id, school_name,
   *     entry_date, hours_worked, hours_logged ("HH:MM:SS"), status, notes, ... }
   */
  async syncEntry(localTimesheet, worker, tsRow) {
    const tsEntryId = String(tsRow.id);
    const entryStatus = tsDataService.mapStatus(tsRow.status);

    // Map fields
    const entryData = this.mapEntryData(worker, tsRow);

    // Check if entry already exists
    const existing = await prisma.timesheetEntry.findUnique({
      where: { tsDataEntryId: tsEntryId }
    });

    if (existing) {
      await prisma.timesheetEntry.update({
        where: { id: existing.id },
        data: {
          ...entryData,
          status: this.shouldUpdateStatus(existing.status, entryStatus) ? entryStatus : existing.status,
          tsDataSyncedAt: new Date()
        }
      });
      return { created: false, updated: true };
    }

    await prisma.timesheetEntry.create({
      data: {
        timesheetId: localTimesheet.id,
        ...entryData,
        status: entryStatus,
        tsDataSource: true,
        tsDataEntryId: tsEntryId,
        tsDataSyncedAt: new Date()
      }
    });
    return { created: true, updated: false };
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

    const date = new Date(tsRow.entry_date);
    const hours = parseHoursLogged(tsRow.hours_logged);

    return {
      entryType: 'GENERAL',
      date,
      startTime: null,  // TSDATA doesn't provide start/end times, only hours_logged
      endTime: null,
      hours,
      roleId,
      companyId,
      notes: tsRow.notes || null,
      startingLocation: tsRow.school_name || null
    };
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
}

module.exports = new TsDataSyncService();
