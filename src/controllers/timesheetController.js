const { PrismaClient } = require('@prisma/client');
const emailService = require('../services/emailService');

const prisma = new PrismaClient();

const getAllTimesheets = async (req, res) => {
  try {
    const { employeeId, status, weekStarting } = req.query;

    const where = {};
    if (employeeId) where.employeeId = parseInt(employeeId);
    if (status) where.status = status;
    if (weekStarting) where.weekStarting = new Date(weekStarting);

    const timesheets = await prisma.timesheet.findMany({
      where,
      include: {
        employee: {
          include: {
            user: {
              select: { name: true, email: true }
            }
          }
        },
        entries: {
          include: {
            role: true,
            company: true
          }
        },
        approvedBy: {
          select: { id: true, name: true, email: true }
        },
        xeroSyncLogs: {
          where: { syncType: 'TIMESHEET_SYNC' },
          orderBy: { startedAt: 'desc' },
          take: 1,
          select: { status: true, errorMessage: true }
        }
      },
      orderBy: { weekStarting: 'desc' }
    });

    res.json({ timesheets });
  } catch (error) {
    console.error('Get timesheets error:', error);
    res.status(500).json({ error: 'Failed to fetch timesheets' });
  }
};

const getTimesheetById = async (req, res) => {
  try {
    const { id } = req.params;
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: parseInt(id) },
      include: {
        employee: {
          include: {
            user: {
              select: { name: true, email: true }
            },
            identifiers: true
          }
        },
        entries: {
          include: {
            role: true,
            company: true
          },
          orderBy: { date: 'asc' }
        },
        approvedBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!timesheet) {
      return res.status(404).json({ error: 'Timesheet not found' });
    }

    res.json({ timesheet });
  } catch (error) {
    console.error('Get timesheet error:', error);
    res.status(500).json({ error: 'Failed to fetch timesheet' });
  }
};

const createTimesheet = async (req, res) => {
  try {
    const { employeeId, weekStarting, weekEnding } = req.body;

    if (!employeeId || !weekStarting || !weekEnding) {
      return res.status(400).json({ error: 'employeeId, weekStarting, and weekEnding are required' });
    }

    // Check if timesheet already exists for this week
    const existing = await prisma.timesheet.findUnique({
      where: {
        employeeId_weekStarting: {
          employeeId: parseInt(employeeId),
          weekStarting: new Date(weekStarting)
        }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Timesheet for this week already exists' });
    }

    const timesheet = await prisma.timesheet.create({
      data: {
        employeeId: parseInt(employeeId),
        weekStarting: new Date(weekStarting),
        weekEnding: new Date(weekEnding),
        status: 'OPEN'
      },
      include: {
        employee: {
          include: {
            user: {
              select: { name: true, email: true }
            }
          }
        }
      }
    });

    res.status(201).json({ message: 'Timesheet created successfully', timesheet });
  } catch (error) {
    console.error('Create timesheet error:', error);
    res.status(500).json({ error: 'Failed to create timesheet' });
  }
};

const updateTimesheet = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const timesheet = await prisma.timesheet.update({
      where: { id: parseInt(id) },
      data: {
        ...(status && { status })
      },
      include: {
        employee: {
          include: {
            user: {
              select: { name: true, email: true }
            }
          }
        },
        entries: true
      }
    });

    res.json({ message: 'Timesheet updated successfully', timesheet });
  } catch (error) {
    console.error('Update timesheet error:', error);
    res.status(500).json({ error: 'Failed to update timesheet' });
  }
};

const submitTimesheet = async (req, res) => {
  try {
    const { id } = req.params;

    // Get timesheet with entries
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: parseInt(id) },
      include: {
        entries: true,
        employee: {
          include: {
            user: true
          }
        }
      }
    });

    if (!timesheet) {
      return res.status(404).json({ error: 'Timesheet not found' });
    }

    // Check if timesheet has entries
    if (timesheet.entries.length === 0) {
      return res.status(400).json({ error: 'Cannot submit timesheet with no entries' });
    }

    // Update timesheet status
    const updatedTimesheet = await prisma.timesheet.update({
      where: { id: parseInt(id) },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date()
      },
      include: {
        employee: {
          include: {
            user: {
              select: { name: true, email: true }
            }
          }
        },
        entries: {
          include: {
            role: true,
            company: true
          }
        }
      }
    });

    // Update all entries to submitted status
    await prisma.timesheetEntry.updateMany({
      where: { timesheetId: parseInt(id) },
      data: { status: 'SUBMITTED' }
    });

    // Get unique companies from entries
    const companyIds = [...new Set(updatedTimesheet.entries.map(e => e.companyId))];

    // Send notification emails to approvers
    try {
      for (const companyId of companyIds) {
        const approvers = await prisma.timesheetApprover.findMany({
          where: { companyId },
          include: {
            user: true
          }
        });

        for (const approver of approvers) {
          await emailService.sendTimesheetSubmittedNotification(
            approver.email,
            updatedTimesheet,
            approver.user.name
          );
        }
      }
    } catch (emailError) {
      console.error('Failed to send notification emails:', emailError);
      // Don't fail the submission if email fails
    }

    res.json({ message: 'Timesheet submitted successfully', timesheet: updatedTimesheet });
  } catch (error) {
    console.error('Submit timesheet error:', error);
    res.status(500).json({ error: 'Failed to submit timesheet' });
  }
};

const approveTimesheet = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId;

    const timesheet = await prisma.timesheet.update({
      where: { id: parseInt(id) },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedById: userId
      },
      include: {
        employee: {
          include: {
            user: {
              select: { name: true, email: true }
            }
          }
        },
        entries: true,
        approvedBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Update all entries to approved status
    await prisma.timesheetEntry.updateMany({
      where: { timesheetId: parseInt(id) },
      data: { status: 'APPROVED' }
    });

    // Send approval notification to employee
    try {
      await emailService.sendTimesheetApprovedNotification(
        timesheet.employee.email,
        timesheet
      );
    } catch (emailError) {
      console.error('Failed to send approval notification:', emailError);
    }

    // Trigger Xero sync (non-blocking - failures won't prevent approval)
    if (process.env.XERO_SYNC_ENABLED === 'true') {
      try {
        const xeroSyncService = require('../services/xeroSyncService');
        // Don't await - sync happens in background
        xeroSyncService.processApprovedTimesheet(timesheet).catch(xeroError => {
          console.error('[Timesheet] Xero sync failed:', xeroError);
          // Failure is logged in XeroSyncLog - will retry via scheduled job
        });
      } catch (xeroError) {
        console.error('[Timesheet] Error initiating Xero sync:', xeroError);
      }
    }

    res.json({ message: 'Timesheet approved successfully', timesheet });
  } catch (error) {
    console.error('Approve timesheet error:', error);
    res.status(500).json({ error: 'Failed to approve timesheet' });
  }
};

const lockTimesheet = async (req, res) => {
  try {
    const { id } = req.params;

    const timesheet = await prisma.timesheet.update({
      where: { id: parseInt(id) },
      data: { status: 'LOCKED' }
    });

    await prisma.timesheetEntry.updateMany({
      where: { timesheetId: parseInt(id) },
      data: { status: 'LOCKED' }
    });

    res.json({ message: 'Timesheet locked successfully', timesheet });
  } catch (error) {
    console.error('Lock timesheet error:', error);
    res.status(500).json({ error: 'Failed to lock timesheet' });
  }
};

/**
 * Unlock a timesheet (admin only)
 * Sets status to UNLOCKED so it can be re-locked without re-submitting
 */
const unlockTimesheet = async (req, res) => {
  try {
    const { id } = req.params;

    const timesheet = await prisma.timesheet.update({
      where: { id: parseInt(id) },
      data: { status: 'UNLOCKED' }
    });

    // Cascade status change to all entries
    await prisma.timesheetEntry.updateMany({
      where: { timesheetId: parseInt(id) },
      data: { status: 'UNLOCKED' }
    });

    res.json({ message: 'Timesheet unlocked successfully', timesheet });
  } catch (error) {
    console.error('Unlock timesheet error:', error);
    res.status(500).json({ error: 'Failed to unlock timesheet' });
  }
};

/**
 * Change timesheet status (admin only)
 * Allows admin to set any status and cascades to entries
 */
const changeTimesheetStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['OPEN', 'INCOMPLETE', 'SUBMITTED', 'AWAITING_APPROVAL', 'APPROVED', 'LOCKED', 'UNLOCKED', 'PROCESSED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const timesheet = await prisma.timesheet.update({
      where: { id: parseInt(id) },
      data: { status }
    });

    // Cascade status change to all entries
    await prisma.timesheetEntry.updateMany({
      where: { timesheetId: parseInt(id) },
      data: { status }
    });

    res.json({ message: `Timesheet status changed to ${status}`, timesheet });
  } catch (error) {
    console.error('Change timesheet status error:', error);
    res.status(500).json({ error: 'Failed to change timesheet status' });
  }
};

const deleteTimesheet = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.timesheet.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Timesheet deleted successfully' });
  } catch (error) {
    console.error('Delete timesheet error:', error);
    res.status(500).json({ error: 'Failed to delete timesheet' });
  }
};

/**
 * Repair status inconsistencies across all timesheets.
 * Ensures all entries match their parent timesheet status.
 * This fixes legacy data where entries weren't properly cascaded.
 */
const repairStatusInconsistencies = async (req, res) => {
  try {
    console.log('[Status Repair] Starting status consistency repair...');

    // Get all timesheets
    const timesheets = await prisma.timesheet.findMany({
      include: {
        entries: {
          select: { id: true, status: true }
        }
      }
    });

    let timesheetsFixed = 0;
    let entriesUpdated = 0;

    for (const timesheet of timesheets) {
      // Find entries with status different from timesheet
      const inconsistentEntries = timesheet.entries.filter(
        e => e.status !== timesheet.status
      );

      if (inconsistentEntries.length > 0) {
        console.log(`[Status Repair] Fixing ${inconsistentEntries.length} entries for timesheet ${timesheet.id} (${timesheet.status})`);

        // Update all entries to match timesheet status
        await prisma.timesheetEntry.updateMany({
          where: {
            timesheetId: timesheet.id
          },
          data: {
            status: timesheet.status
          }
        });

        timesheetsFixed++;
        entriesUpdated += inconsistentEntries.length;
      }
    }

    const result = {
      timesheetsChecked: timesheets.length,
      timesheetsFixed,
      entriesUpdated
    };

    console.log('[Status Repair] Completed:', result);
    res.json({
      message: 'Status repair completed successfully',
      ...result
    });
  } catch (error) {
    console.error('[Status Repair] Error:', error);
    res.status(500).json({ error: 'Failed to repair statuses: ' + error.message });
  }
};

module.exports = {
  getAllTimesheets,
  getTimesheetById,
  createTimesheet,
  updateTimesheet,
  submitTimesheet,
  approveTimesheet,
  lockTimesheet,
  unlockTimesheet,
  changeTimesheetStatus,
  deleteTimesheet,
  repairStatusInconsistencies
};
