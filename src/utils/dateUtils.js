/**
 * Date utility functions with timezone awareness
 *
 * All date parsing should go through these utilities to ensure
 * consistent timezone handling across the application.
 */

// Default timezone from environment, fallback to Australia/Melbourne
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Australia/Melbourne';

/**
 * Parse a date string as a local date in the app timezone.
 * Prevents UTC conversion issues where "2026-01-31" becomes Jan 30 in Australia.
 *
 * @param {string} dateString - Date string in format "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss"
 * @returns {Date} - Date object at midnight in local timezone
 *
 * @example
 * parseLocalDate("2026-01-31") // Jan 31 00:00 in Australia, not Jan 30!
 */
function parseLocalDate(dateString) {
  if (!dateString) return null;

  // Extract just the date part (YYYY-MM-DD)
  const dateStr = dateString.split('T')[0];
  const [year, month, day] = dateStr.split('-').map(Number);

  // Create date at local midnight (not UTC)
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Format a Date object to YYYY-MM-DD string (local date).
 *
 * @param {Date} date - Date object
 * @returns {string} - Date string in YYYY-MM-DD format
 *
 * @example
 * formatLocalDate(new Date(2026, 0, 31)) // "2026-01-31"
 */
function formatLocalDate(date) {
  if (!date) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Get the day of week for a date string (0 = Sunday, 6 = Saturday).
 * Uses local timezone to avoid off-by-one errors.
 *
 * @param {string} dateString - Date string in format "YYYY-MM-DD"
 * @returns {number} - Day of week (0-6)
 *
 * @example
 * getDayOfWeek("2026-02-01") // 0 (Sunday) in local timezone
 */
function getDayOfWeek(dateString) {
  const date = parseLocalDate(dateString);
  return date.getDay();
}

/**
 * Check if a date string is a weekend (Saturday or Sunday).
 *
 * @param {string} dateString - Date string in format "YYYY-MM-DD"
 * @returns {boolean} - True if weekend
 *
 * @example
 * isWeekend("2026-02-01") // true (Sunday)
 * isWeekend("2026-01-30") // false (Friday)
 */
function isWeekend(dateString) {
  const dayOfWeek = getDayOfWeek(dateString);
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/**
 * Get Monday of the week containing the given date.
 *
 * @param {Date|string} date - Date object or string
 * @returns {Date} - Monday at 00:00 local time
 */
function getWeekStart(date) {
  const d = typeof date === 'string' ? parseLocalDate(date) : new Date(date);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ...
  const diff = day === 0 ? -6 : 1 - day; // Shift to Monday

  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);

  return monday;
}

/**
 * Get Sunday of the week containing the given date.
 *
 * @param {Date|string} date - Date object or string
 * @returns {Date} - Sunday at 00:00 local time
 */
function getWeekEnd(date) {
  const monday = getWeekStart(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return sunday;
}

/**
 * Get the app's configured timezone.
 *
 * @returns {string} - Timezone string (e.g., "Australia/Melbourne")
 */
function getAppTimezone() {
  return APP_TIMEZONE;
}

/**
 * Parse HH:MM:SS or HH:MM time string to decimal hours.
 *
 * @param {string} timeString - Time in format "HH:MM:SS" or "HH:MM"
 * @returns {number} - Decimal hours
 *
 * @example
 * parseTimeToHours("04:30:00") // 4.5
 * parseTimeToHours("02:15") // 2.25
 */
function parseTimeToHours(timeString) {
  if (!timeString) return 0;

  const parts = timeString.split(':').map(Number);
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  const seconds = parts[2] || 0;

  return hours + minutes / 60 + seconds / 3600;
}

module.exports = {
  parseLocalDate,
  formatLocalDate,
  getDayOfWeek,
  isWeekend,
  getWeekStart,
  getWeekEnd,
  getAppTimezone,
  parseTimeToHours
};
