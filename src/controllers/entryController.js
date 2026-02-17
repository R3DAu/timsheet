const { PrismaClient } = require('@prisma/client');
const mapsService = require('../services/mapsService');

const prisma = new PrismaClient();

function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// Calculate hours from start and end time strings (HH:MM format)
function calculateHoursFromTimes(startTime, endTime) {
  if (!startTime || !endTime) return null;

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  if (endMinutes <= startMinutes) {
    return null; // No midnight crossing allowed
  }

  return (endMinutes - startMinutes) / 60;
}

/**
 * Validate entry times against existing entries on the same day.
 * Returns array of error strings (empty = valid).
 */
async function validateEntryTimes(timesheetId, date, startTime, endTime, excludeEntryId) {
  const errors = [];
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);

  if (startMins === null || endMins === null) return errors;

  if (endMins <= startMins) {
    errors.push('End time must be after start time. Times cannot cross midnight.');
    return errors;
  }

  if (startMins >= 23 * 60) {
    errors.push('Start time cannot be 11:00 PM or later.');
    return errors;
  }

  if ((endMins - startMins) / 60 > 12) {
    errors.push('Entry duration cannot exceed 12 hours.');
    return errors;
  }

  // Get timesheet with employee details
  const timesheet = await prisma.timesheet.findUnique({
    where: { id: parseInt(timesheetId) },
    include: { employee: true }
  });

  if (!timesheet) return errors;

  // Date must fall within the timesheet's week range
  const entryDate = new Date(date);
  const weekStart = new Date(timesheet.weekStarting);
  const weekEnd = new Date(timesheet.weekEnding);
  weekStart.setHours(0, 0, 0, 0);
  weekEnd.setHours(23, 59, 59, 999);

  if (entryDate < weekStart || entryDate > weekEnd) {
    errors.push(`Entry date must be within the timesheet week (${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}).`);
    return errors;
  }

  // Get ALL entries for the same day across all timesheets for this employee
  const dayStart = new Date(entryDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(entryDate);
  dayEnd.setHours(23, 59, 59, 999);

  const sameDayEntries = await prisma.timesheetEntry.findMany({
    where: {
      timesheet: { employeeId: timesheet.employeeId },
      date: { gte: dayStart, lte: dayEnd },
      ...(excludeEntryId ? { id: { not: parseInt(excludeEntryId) } } : {}),
      startTime: { not: null },
      endTime: { not: null }
    },
    include: { company: true }
  });

  for (const other of sameDayEntries) {
    const otherStart = timeToMinutes(other.startTime);
    const otherEnd = timeToMinutes(other.endTime);
    if (otherStart === null || otherEnd === null) continue;

    // Overlap check
    if (startMins < otherEnd && endMins > otherStart) {
      const companyName = other.company ? other.company.name : 'unknown';
      errors.push(`Overlaps with existing entry ${other.startTime}-${other.endTime} (${companyName}).`);
    }

  }

  // 30-minute break check: at least one gap >= 30 min must exist when 2+ entries
  if (sameDayEntries.length > 0) {
    const allDayEntries = [...sameDayEntries.map(e => ({
      start: timeToMinutes(e.startTime),
      end: timeToMinutes(e.endTime)
    })), { start: startMins, end: endMins }].filter(e => e.start !== null && e.end !== null);

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
      errors.push('At least one 30-minute unpaid break is required when there are multiple entries in a day.');
    }
  }

  // Max daily hours check (employee-configurable)
  const maxDaily = timesheet.employee.maxDailyHours || 16;
  const existingDayHours = sameDayEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
  const newEntryHours = (endMins - startMins) / 60;
  if (existingDayHours + newEntryHours > maxDaily) {
    errors.push(`Total hours for this day would be ${(existingDayHours + newEntryHours).toFixed(1)}h, exceeding the ${maxDaily}h daily limit.`);
  }

  return errors;
}

const createEntry = async (req, res) => {
  try {
    const {
      timesheetId,
      entryType,
      date,
      startTime,
      endTime,
      hours,
      roleId,
      companyId,
      notes,
      privateNotes,
      locationNotes,
      startingLocation,
      startingLocationLat,
      startingLocationLng,
      reasonForDeviation,
      travelFrom,
      travelFromLat,
      travelFromLng,
      travelTo,
      travelToLat,
      travelToLng,
      isBillable
    } = req.body;

    if (!timesheetId || !entryType || !date || !roleId || !companyId) {
      return res.status(400).json({
        error: 'timesheetId, entryType, date, roleId, and companyId are required'
      });
    }

    // Calculate hours from times, or use directly provided hours as fallback
    let calculatedHours = hours;
    if (startTime && endTime) {
      calculatedHours = calculateHoursFromTimes(startTime, endTime);
    }

    if (calculatedHours === null || calculatedHours === undefined) {
      return res.status(400).json({
        error: 'End time must be after start time. Times cannot cross midnight.'
      });
    }

    // Validate entry times against existing entries
    if (startTime && endTime) {
      const timeErrors = await validateEntryTimes(timesheetId, date, startTime, endTime, null);
      if (timeErrors.length > 0) {
        return res.status(400).json({ error: timeErrors.join(' ') });
      }
    }

    // Validate travel entries
    if (entryType === 'TRAVEL' && (!travelFrom || !travelTo)) {
      return res.status(400).json({
        error: 'travelFrom and travelTo are required for travel entries'
      });
    }

    let distance = null;
    if (entryType === 'TRAVEL' && travelFromLat && travelFromLng && travelToLat && travelToLng) {
      try {
        // Build waypoint list: from → location notes → to
        const waypoints = [{ lat: parseFloat(travelFromLat), lng: parseFloat(travelFromLng) }];

        // Add location notes as waypoints
        if (locationNotes) {
          const lnotes = typeof locationNotes === 'string' ? JSON.parse(locationNotes) : locationNotes;
          for (const ln of lnotes) {
            if (ln.location) {
              const geocoded = await mapsService.geocodeAddress(ln.location);
              if (geocoded) {
                waypoints.push({ lat: geocoded.latitude, lng: geocoded.longitude });
              }
            }
          }
        }

        waypoints.push({ lat: parseFloat(travelToLat), lng: parseFloat(travelToLng) });

        // Calculate route with all waypoints
        const route = await mapsService.calculateDrivingRoute(waypoints);
        distance = route ? route.distance : null;
      } catch (error) {
        console.error('Failed to calculate distance:', error);
      }
    }

    const entry = await prisma.timesheetEntry.create({
      data: {
        timesheetId: parseInt(timesheetId),
        entryType,
        date: new Date(date),
        startTime: startTime || null,
        endTime: endTime || null,
        hours: parseFloat(calculatedHours),
        roleId: parseInt(roleId),
        companyId: parseInt(companyId),
        startingLocation: startingLocation || null,
        startingLocationLat: startingLocationLat ? parseFloat(startingLocationLat) : null,
        startingLocationLng: startingLocationLng ? parseFloat(startingLocationLng) : null,
        reasonForDeviation: reasonForDeviation || null,
        notes: notes || null,
        privateNotes: privateNotes || null,
        locationNotes: locationNotes ? (typeof locationNotes === 'string' ? locationNotes : JSON.stringify(locationNotes)) : null,
        isBillable: isBillable !== undefined ? isBillable : true,
        ...(entryType === 'TRAVEL' && {
          travelFrom,
          travelFromLat: travelFromLat ? parseFloat(travelFromLat) : null,
          travelFromLng: travelFromLng ? parseFloat(travelFromLng) : null,
          travelTo,
          travelToLat: travelToLat ? parseFloat(travelToLat) : null,
          travelToLng: travelToLng ? parseFloat(travelToLng) : null,
          distance
        })
      },
      include: {
        timesheet: true,
        role: true,
        company: true
      }
    });

    res.status(201).json({ message: 'Entry created successfully', entry });
  } catch (error) {
    console.error('Create entry error:', error);
    res.status(500).json({ error: 'Failed to create entry' });
  }
};

const updateEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      date,
      startTime,
      endTime,
      hours,
      roleId,
      companyId,
      notes,
      privateNotes,
      locationNotes,
      startingLocation,
      startingLocationLat,
      startingLocationLng,
      reasonForDeviation,
      travelFrom,
      travelFromLat,
      travelFromLng,
      travelTo,
      travelToLat,
      travelToLng,
      isBillable,
      status
    } = req.body;

    const existingEntry = await prisma.timesheetEntry.findUnique({
      where: { id: parseInt(id) },
      include: { timesheet: true }
    });

    if (!existingEntry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    // Block edits on non-OPEN entries
    if (existingEntry.status !== 'OPEN') {
      return res.status(403).json({
        error: 'Entry cannot be edited',
        reason: `Entry status is ${existingEntry.status}. Only OPEN entries can be edited.`
      });
    }

    // Block edits if timesheet's TSDATA status is read-only
    if (existingEntry.timesheet.tsDataStatus &&
        ['SUBMITTED', 'APPROVED', 'LOCKED', 'PROCESSED'].includes(existingEntry.timesheet.tsDataStatus)) {
      return res.status(403).json({
        error: 'Timesheet is locked by TSDATA',
        reason: `TSDATA status is ${existingEntry.timesheet.tsDataStatus}`
      });
    }

    // Recalculate hours if times are provided
    let calculatedHours = hours;
    const newStartTime = startTime !== undefined ? startTime : existingEntry.startTime;
    const newEndTime = endTime !== undefined ? endTime : existingEntry.endTime;
    if (newStartTime && newEndTime && (startTime !== undefined || endTime !== undefined)) {
      calculatedHours = calculateHoursFromTimes(newStartTime, newEndTime);
      if (calculatedHours === null) {
        return res.status(400).json({
          error: 'End time must be after start time. Times cannot cross midnight.'
        });
      }
    }

    // Validate entry times against existing entries (exclude self)
    const newDate = date || existingEntry.date;
    if (newStartTime && newEndTime && (startTime !== undefined || endTime !== undefined || date !== undefined)) {
      const timeErrors = await validateEntryTimes(
        existingEntry.timesheetId, newDate, newStartTime, newEndTime, id
      );
      if (timeErrors.length > 0) {
        return res.status(400).json({ error: timeErrors.join(' ') });
      }
    }

    let distance = existingEntry.distance;
    // Recalculate distance if travel entry and any location data changed
    if (existingEntry.entryType === 'TRAVEL' &&
        (travelFromLat !== undefined || travelFromLng !== undefined ||
         travelToLat !== undefined || travelToLng !== undefined ||
         locationNotes !== undefined)) {

      const fromLat = travelFromLat !== undefined ? parseFloat(travelFromLat) : existingEntry.travelFromLat;
      const fromLng = travelFromLng !== undefined ? parseFloat(travelFromLng) : existingEntry.travelFromLng;
      const toLat = travelToLat !== undefined ? parseFloat(travelToLat) : existingEntry.travelToLat;
      const toLng = travelToLng !== undefined ? parseFloat(travelToLng) : existingEntry.travelToLng;

      if (fromLat && fromLng && toLat && toLng) {
        try {
          // Build waypoint list: from → location notes → to
          const waypoints = [{ lat: fromLat, lng: fromLng }];

          // Add location notes as waypoints
          const lnotes = locationNotes !== undefined
            ? (typeof locationNotes === 'string' ? JSON.parse(locationNotes) : locationNotes)
            : (existingEntry.locationNotes ? JSON.parse(existingEntry.locationNotes) : []);

          if (lnotes && Array.isArray(lnotes)) {
            for (const ln of lnotes) {
              if (ln.location) {
                const geocoded = await mapsService.geocodeAddress(ln.location);
                if (geocoded) {
                  waypoints.push({ lat: geocoded.latitude, lng: geocoded.longitude });
                }
              }
            }
          }

          waypoints.push({ lat: toLat, lng: toLng });

          // Calculate route with all waypoints
          const route = await mapsService.calculateDrivingRoute(waypoints);
          distance = route ? route.distance : null;
        } catch (error) {
          console.error('Failed to calculate distance:', error);
        }
      }
    }

    const entry = await prisma.timesheetEntry.update({
      where: { id: parseInt(id) },
      data: {
        ...(date && { date: new Date(date) }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(calculatedHours !== undefined && { hours: parseFloat(calculatedHours) }),
        ...(roleId && { roleId: parseInt(roleId) }),
        ...(companyId && { companyId: parseInt(companyId) }),
        ...(startingLocation !== undefined && { startingLocation: startingLocation || null }),
        ...(startingLocationLat !== undefined && { startingLocationLat: startingLocationLat ? parseFloat(startingLocationLat) : null }),
        ...(startingLocationLng !== undefined && { startingLocationLng: startingLocationLng ? parseFloat(startingLocationLng) : null }),
        ...(reasonForDeviation !== undefined && { reasonForDeviation: reasonForDeviation || null }),
        ...(notes !== undefined && { notes }),
        ...(privateNotes !== undefined && { privateNotes }),
        ...(locationNotes !== undefined && { locationNotes: locationNotes ? (typeof locationNotes === 'string' ? locationNotes : JSON.stringify(locationNotes)) : null }),
        ...(travelFrom !== undefined && { travelFrom }),
        ...(travelFromLat !== undefined && { travelFromLat: travelFromLat ? parseFloat(travelFromLat) : null }),
        ...(travelFromLng !== undefined && { travelFromLng: travelFromLng ? parseFloat(travelFromLng) : null }),
        ...(travelTo !== undefined && { travelTo }),
        ...(travelToLat !== undefined && { travelToLat: travelToLat ? parseFloat(travelToLat) : null }),
        ...(travelToLng !== undefined && { travelToLng: travelToLng ? parseFloat(travelToLng) : null }),
        ...(isBillable !== undefined && { isBillable }),
        ...(distance !== null && { distance }),
        ...(status && { status })
      },
      include: {
        timesheet: true,
        role: true,
        company: true
      }
    });

    res.json({ message: 'Entry updated successfully', entry });
  } catch (error) {
    console.error('Update entry error:', error);
    res.status(500).json({ error: 'Failed to update entry' });
  }
};

const deleteEntry = async (req, res) => {
  try {
    const { id } = req.params;

    const entry = await prisma.timesheetEntry.findUnique({
      where: { id: parseInt(id) },
      include: { timesheet: true }
    });

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    // Block deletes on non-OPEN entries
    if (entry.status !== 'OPEN') {
      return res.status(403).json({
        error: 'Entry cannot be deleted',
        reason: `Entry status is ${entry.status}. Only OPEN entries can be deleted.`
      });
    }

    // Block deletes if timesheet's TSDATA status is read-only
    if (entry.timesheet.tsDataStatus &&
        ['SUBMITTED', 'APPROVED', 'LOCKED', 'PROCESSED'].includes(entry.timesheet.tsDataStatus)) {
      return res.status(403).json({
        error: 'Timesheet is locked by TSDATA',
        reason: `TSDATA status is ${entry.timesheet.tsDataStatus}`
      });
    }

    await prisma.timesheetEntry.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('Delete entry error:', error);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
};

const getEntriesByTimesheet = async (req, res) => {
  try {
    const { timesheetId } = req.params;

    const entries = await prisma.timesheetEntry.findMany({
      where: { timesheetId: parseInt(timesheetId) },
      include: {
        role: true,
        company: true
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }]
    });

    res.json({ entries });
  } catch (error) {
    console.error('Get entries error:', error);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
};

module.exports = {
  createEntry,
  updateEntry,
  deleteEntry,
  getEntriesByTimesheet
};
