const { PrismaClient } = require('@prisma/client');
const mapsService = require('../services/mapsService');

const prisma = new PrismaClient();

const createEntry = async (req, res) => {
  try {
    const {
      timesheetId,
      entryType,
      date,
      hours,
      roleId,
      companyId,
      notes,
      travelFrom,
      travelTo
    } = req.body;

    if (!timesheetId || !entryType || !date || hours === undefined || !roleId || !companyId) {
      return res.status(400).json({
        error: 'timesheetId, entryType, date, hours, roleId, and companyId are required'
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
        // Calculate distance using Google Maps API
        distance = await mapsService.calculateDistance(travelFrom, travelTo);
      } catch (error) {
        console.error('Failed to calculate distance:', error);
        // Continue without distance if API fails
      }
    }

    const entry = await prisma.timesheetEntry.create({
      data: {
        timesheetId: parseInt(timesheetId),
        entryType,
        date: new Date(date),
        hours: parseFloat(hours),
        roleId: parseInt(roleId),
        companyId: parseInt(companyId),
        notes,
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
      hours,
      roleId,
      companyId,
      notes,
      travelFrom,
      travelTo,
      status
    } = req.body;

    // Get existing entry to check type
    const existingEntry = await prisma.timesheetEntry.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingEntry) {
      return res.status(404).json({ error: 'Entry not found' });
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
        ...(hours !== undefined && { hours: parseFloat(hours) }),
        ...(roleId && { roleId: parseInt(roleId) }),
        ...(companyId && { companyId: parseInt(companyId) }),
        ...(notes !== undefined && { notes }),
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
      orderBy: { date: 'asc' }
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
