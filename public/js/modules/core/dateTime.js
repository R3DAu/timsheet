/**
 * Core date and time utilities
 */

import { state } from './state.js';

/**
 * Format a Date object to YYYY-MM-DD string in LOCAL timezone.
 * Prevents UTC conversion issues where dates shift by one day.
 *
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} - Date string in YYYY-MM-DD format
 *
 * @example
 * formatLocalDate(new Date('2026-02-06T00:00:00')) // "2026-02-06" (not "2026-02-05"!)
 */
export function formatLocalDate(date) {
    if (!date) return '';

    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

// Time helpers
export function formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${m} ${ampm}`;
}

export function calculateHoursPreview(startTime, endTime) {
    if (!startTime || !endTime) return '';
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    let startMins = sH * 60 + sM;
    let endMins = eH * 60 + eM;
    if (endMins <= startMins) endMins += 24 * 60;
    const hours = (endMins - startMins) / 60;
    return `${hours.toFixed(2)} hrs`;
}

export function todayStr() {
    return formatLocalDate(new Date());
}

/**
 * Get default time values for new entries based on employee preferences
 * and number of entries already created today
 */
export function getTimeDefaults(timesheetId) {
    const myTimesheets = state.get('myTimesheets');
    const allTimesheets = state.get('allTimesheets');
    const currentUser = state.get('currentUser');

    // Check how many entries exist for today on this timesheet
    const ts = [...myTimesheets, ...allTimesheets].find(t => t.id === parseInt(timesheetId));
    const today = todayStr();
    let todayEntryCount = 0;
    if (ts && ts.entries) {
        todayEntryCount = ts.entries.filter(e => {
            const d = formatLocalDate(e.date);
            return d === today;
        }).length;
    }

    const emp = currentUser && currentUser.employee;
    const morning = {
        start: emp ? emp.morningStart : '08:30',
        end: emp ? emp.morningEnd : '12:30'
    };
    const afternoon = {
        start: emp ? emp.afternoonStart : '13:00',
        end: emp ? emp.afternoonEnd : '17:00'
    };

    // First entry of the day → morning, second → afternoon, else blank
    if (todayEntryCount === 0) return morning;
    if (todayEntryCount === 1) return afternoon;
    return { start: '', end: '' };
}