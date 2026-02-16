/**
 * Core date and time utilities
 */

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
    return new Date().toISOString().split('T')[0];
}