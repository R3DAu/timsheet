/**
 * Entry validation logic
 */

import { state } from '../../core/state.js';
import { formatLocalDate } from '../../core/dateTime.js';

/**
 * Convert HH:MM to minutes since midnight for comparison
 * @param {string} timeStr - Time string in HH:MM format
 * @returns {number|null} - Minutes since midnight or null
 */
export function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Format time string to 12-hour format with AM/PM
 * @param {string} timeStr - Time string in HH:MM format
 * @returns {string} - Formatted time string
 */
export function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

/**
 * Validate a timesheet entry against all rules
 *
 * Rules:
 * 1. End time must be after start time
 * 2. Times cannot cross midnight
 * 3. No overlapping times on the same day (across ALL companies)
 * 4. At least one 30-minute unpaid break required in a day (when 2+ entries)
 * 5. No start time at 11:00 PM or later
 * 6. Max 12 hours per single entry
 * 7. Max daily hours (employee-configurable)
 * 8. Entry date must fall within the timesheet's week range
 * 9. Weekend entries should have a reason for deviation
 *
 * @param {Object} entry - Entry to validate
 * @param {Array} existingEntries - All existing entries for the day
 * @param {number|null} excludeEntryId - Entry ID to exclude from overlap check (when editing)
 * @param {number} timesheetId - Timesheet ID
 * @returns {Object} - { valid: boolean, errors: string[], warnings: string[] }
 */
export function validateEntry(entry, existingEntries, excludeEntryId, timesheetId) {
  const errors = [];
  const warnings = [];
  const startMins = timeToMinutes(entry.startTime);
  const endMins = timeToMinutes(entry.endTime);

  if (startMins === null || endMins === null) {
    errors.push('Start time and end time are required.');
    return { valid: false, errors, warnings };
  }

  // Rule 1: End time must be after start time
  if (endMins <= startMins) {
    errors.push('End time must be after start time.');
  }

  // Rule 2: No start time at 11pm or later
  if (startMins >= 23 * 60) {
    errors.push('Start time cannot be 11:00 PM or later.');
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  // Rule 6: Max 12 hours per single entry
  const entryHours = (endMins - startMins) / 60;
  if (entryHours > 12) {
    errors.push(`Entry duration of ${entryHours.toFixed(1)} hours exceeds the 12-hour maximum per entry.`);
  }

  // Rule 8: Entry date must fall within the timesheet's week range
  const ts = getTimesheetById(timesheetId);
  if (ts) {
    const entryDate = new Date(entry.date);
    const weekStart = new Date(ts.weekStarting);
    const weekEnd = new Date(ts.weekEnding);
    weekStart.setHours(0, 0, 0, 0);
    weekEnd.setHours(23, 59, 59, 999);

    if (entryDate < weekStart || entryDate > weekEnd) {
      errors.push(`Entry date must be within the timesheet week (${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}).`);
    }
  }

  // Rule 9: Weekend check
  const dayOfWeek = new Date(entry.date).getDay(); // 0=Sun, 6=Sat
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    warnings.push('This entry is on a weekend. A reason for deviation may be required by DE WMS.');
  }

  // Get all entries for the same day (across ALL companies)
  const entryDate = entry.date;
  const sameDayEntries = existingEntries.filter(e => {
    const eDate = formatLocalDate(e.date);
    const matchesDate = eDate === entryDate;
    const notSelf = excludeEntryId ? e.id !== excludeEntryId : true;
    return matchesDate && notSelf && e.startTime && e.endTime;
  });

  // Rule 3: No overlapping times
  for (const other of sameDayEntries) {
    const otherStart = timeToMinutes(other.startTime);
    const otherEnd = timeToMinutes(other.endTime);
    if (otherStart === null || otherEnd === null) continue;

    if (startMins < otherEnd && endMins > otherStart) {
      errors.push(`Overlaps with existing entry ${formatTime(other.startTime)} - ${formatTime(other.endTime)} (${other.company ? other.company.name : 'unknown'}).`);
    }
  }

  // Rule 4: At least one 30-minute unpaid break must exist in the day (when 2+ entries)
  if (sameDayEntries.length > 0) {
    const allDayEntries = [...sameDayEntries.map(e => ({
      start: timeToMinutes(e.startTime),
      end: timeToMinutes(e.endTime)
    })), { start: startMins, end: endMins }].filter(e => e.start !== null && e.end !== null);

    // Sort by start time
    allDayEntries.sort((a, b) => a.start - b.start);

    // Check if ANY gap between consecutive entries is >= 30 minutes
    let hasRequiredBreak = false;
    for (let i = 0; i < allDayEntries.length - 1; i++) {
      const gap = allDayEntries[i + 1].start - allDayEntries[i].end;
      if (gap >= 30) {
        hasRequiredBreak = true;
        break;
      }
    }

    if (!hasRequiredBreak) {
      errors.push('At least one 30-minute unpaid break is required when there are multiple entries in a day.');
    }
  }

  // Rule 7: Max daily hours (employee-configurable)
  const currentUser = state.get('currentUser');
  const maxDaily = (currentUser && currentUser.employee) ? (currentUser.employee.maxDailyHours || 16) : 16;
  const existingDayHours = sameDayEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
  if (existingDayHours + entryHours > maxDaily) {
    errors.push(`Total hours for this day would be ${(existingDayHours + entryHours).toFixed(1)}h, exceeding your ${maxDaily}h daily limit.`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Get a timesheet by ID from loaded data
 * @param {number} timesheetId - Timesheet ID
 * @returns {Object|null} - Timesheet object or null
 */
export function getTimesheetById(timesheetId) {
  const myTimesheets = state.get('myTimesheets');
  const allTimesheets = state.get('allTimesheets');
  return [...myTimesheets, ...allTimesheets].find(t => t.id === parseInt(timesheetId)) || null;
}

/**
 * Get all entries for a given timesheet
 * @param {number} timesheetId - Timesheet ID
 * @returns {Array} - Array of entries
 */
export function getTimesheetEntries(timesheetId) {
  const ts = getTimesheetById(timesheetId);
  return ts && ts.entries ? ts.entries : [];
}
