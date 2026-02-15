const { PrismaClient } = require('@prisma/client');
const mapsService = require('../services/mapsService');

const prisma = new PrismaClient();

// Calculate hours from start and end time strings (HH:MM format)
function calculateHoursFromTimes(startTime, endTime) {
  if (!startTime || !endTime) return null;

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;

  // Handle overnight shifts (e.g. 22:00 -> 06:00)
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  return (endMinutes - startMinutes) / 60;
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
      travelFrom,
      travelTo
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
        error: 'Either startTime/endTime or hours must be provided'
      });
    }

    // Validate travel entries
    if (entryType === 'TRAVEL' && (!travelFrom || !travelTo)) {
      return res.status(400).json({
        error: 'travelFrom and travelTo are required for travel entries'
      });
    }

    let distance = null;
    if (entryType === 'TRAVEL') {
      try {
        distance = await mapsService.calculateDistance(travelFrom, travelTo);
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
        notes: notes || null,
        privateNotes: privateNotes || null,
        ...(entryType === 'TRAVEL' && {
          travelFrom,
          travelTo,
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
      travelFrom,
      travelTo,
      status
    } = req.body;

    const existingEntry = await prisma.timesheetEntry.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingEntry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    // Recalculate hours if times are provided
    let calculatedHours = hours;
    const newStartTime = startTime !== undefined ? startTime : existingEntry.startTime;
    const newEndTime = endTime !== undefined ? endTime : existingEntry.endTime;
    if (newStartTime && newEndTime && (startTime !== undefined || endTime !== undefined)) {
      calculatedHours = calculateHoursFromTimes(newStartTime, newEndTime);
    }

    let distance = existingEntry.distance;
    if (existingEntry.entryType === 'TRAVEL' && (travelFrom || travelTo)) {
      const from = travelFrom || existingEntry.travelFrom;
      const to = travelTo || existingEntry.travelTo;
      try {
        distance = await mapsService.calculateDistance(from, to);
      } catch (error) {
        console.error('Failed to calculate distance:', error);
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
        ...(notes !== undefined && { notes }),
        ...(privateNotes !== undefined && { privateNotes }),
        ...(travelFrom && { travelFrom }),
        ...(travelTo && { travelTo }),
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
