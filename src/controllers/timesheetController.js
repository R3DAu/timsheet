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

module.exports = {
  getAllTimesheets,
  getTimesheetById,
  createTimesheet,
  updateTimesheet,
  submitTimesheet,
  approveTimesheet,
  lockTimesheet,
  deleteTimesheet
};
