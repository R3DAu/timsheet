const { PrismaClient } = require('@prisma/client');
const xeroLeaveService = require('../services/xeroLeaveService');

const prisma = new PrismaClient();

/**
 * Create a new leave request
 */
exports.createLeaveRequest = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, totalHours, notes } = req.body;
    const userId = req.session.userId;

    // Get employee for this user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true }
    });

    if (!user || !user.employee) {
      return res.status(400).json({ error: 'User not linked to an employee' });
    }

    const employeeId = user.employee.id;

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    // Validate total hours
    const hours = parseFloat(totalHours);
    if (isNaN(hours) || hours <= 0) {
      return res.status(400).json({ error: 'Total hours must be a positive number' });
    }

    // Create leave request
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveType,
        startDate: start,
        endDate: end,
        totalHours: hours,
        notes: notes || null,
        status: 'PENDING'
      }
    });

    res.json(leaveRequest);
  } catch (error) {
    console.error('[Leave] Error creating leave request:', error);
    res.status(500).json({ error: 'Failed to create leave request' });
  }
};

/**
 * Get all leave requests (admin only)
 */
exports.getAllLeaveRequests = async (req, res) => {
  try {
    const { status } = req.query;

    const where = {};
    if (status) {
      where.status = status;
    }

    const requests = await prisma.leaveRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        approvedBy: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(requests);
  } catch (error) {
    console.error('[Leave] Error fetching leave requests:', error);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
};

/**
 * Get employee's own leave requests
 */
exports.getMyLeaveRequests = async (req, res) => {
  try {
    const userId = req.session.userId;

    // Get employee for this user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true }
    });

    if (!user || !user.employee) {
      // User is not linked to an employee (e.g., admin-only user)
      return res.json([]);
    }

    const employeeId = user.employee.id;

    const requests = await prisma.leaveRequest.findMany({
      where: { employeeId },
      include: {
        approvedBy: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(requests);
  } catch (error) {
    console.error('[Leave] Error fetching leave requests:', error);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
};

/**
 * Approve leave request and sync to Xero
 */
exports.approveLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId;

    // Check if request exists and is pending
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: parseInt(id) }
    });

    if (!leaveRequest) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    if (leaveRequest.status !== 'PENDING') {
      return res.status(400).json({ error: `Leave request is already ${leaveRequest.status.toLowerCase()}` });
    }

    // Update status to APPROVED
    const updatedRequest = await prisma.leaveRequest.update({
      where: { id: parseInt(id) },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date()
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Sync to Xero (async, don't block approval)
    try {
      await xeroLeaveService.processApprovedLeave(updatedRequest);
    } catch (xeroError) {
      console.error('[Leave] Error syncing to Xero:', xeroError);
      // Don't fail the approval if Xero sync fails
    }

    res.json(updatedRequest);
  } catch (error) {
    console.error('[Leave] Error approving leave request:', error);
    res.status(500).json({ error: 'Failed to approve leave request' });
  }
};

/**
 * Reject leave request (admin can reject PENDING or APPROVED)
 * If already synced to Xero, attempts to cancel the Xero leave application
 */
exports.rejectLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId;

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: parseInt(id) }
    });

    if (!leaveRequest) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    if (!['PENDING', 'APPROVED'].includes(leaveRequest.status)) {
      return res.status(400).json({ error: `Leave request is already ${leaveRequest.status.toLowerCase()}` });
    }

    // If synced to Xero, attempt to cancel there first
    if (leaveRequest.xeroLeaveId) {
      await xeroLeaveService.cancelLeave(leaveRequest.id);
    }

    // Update status to REJECTED
    const updatedRequest = await prisma.leaveRequest.update({
      where: { id: parseInt(id) },
      data: {
        status: 'REJECTED',
        approvedById: userId,
        approvedAt: new Date()
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.json(updatedRequest);
  } catch (error) {
    console.error('[Leave] Error rejecting leave request:', error);
    res.status(500).json({ error: 'Failed to reject leave request' });
  }
};

/**
 * Get employee's leave balances from Xero
 */
exports.getLeaveBalances = async (req, res) => {
  try {
    const userId = req.session.userId;

    // Get employee for this user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true }
    });

    if (!user || !user.employee) {
      // User is not linked to an employee
      return res.json({ message: 'Not linked to an employee' });
    }

    const employeeId = user.employee.id;

    const balances = await xeroLeaveService.getLeaveBalances(employeeId);

    if (!balances) {
      return res.json({ message: 'No leave balances available (Xero sync may be disabled)' });
    }

    res.json(balances);
  } catch (error) {
    console.error('[Leave] Error fetching leave balances:', error);
    res.status(500).json({ error: 'Failed to fetch leave balances' });
  }
};

/**
 * Get all employee leave balances (admin only)
 */
exports.getAllEmployeeBalances = async (req, res) => {
  try {
    // Get ALL employees — don't filter by syncEnabled so admins see everyone
    const employees = await prisma.employee.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        xeroSettings: true,
        identifiers: true
      },
      orderBy: {
        firstName: 'asc'
      }
    });

    const balanceData = [];

    for (const employee of employees) {
      try {
        const balances = await xeroLeaveService.getLeaveBalances(employee.id);

        balanceData.push({
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          email: employee.email,
          balances: balances && Array.isArray(balances) ? balances : null,
          notConfigured: !balances || !Array.isArray(balances)
        });
      } catch (error) {
        console.error(`[Leave] Error fetching balances for employee ${employee.id}:`, error);
        balanceData.push({
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          email: employee.email,
          balances: null,
          notConfigured: true
        });
      }
    }

    res.json(balanceData);
  } catch (error) {
    console.error('[Leave] Error fetching all employee balances:', error);
    res.status(500).json({ error: 'Failed to fetch employee balances' });
  }
};

/**
 * Delete a leave request (only if pending)
 */
exports.deleteLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId;
    const isAdmin = req.session.isAdmin;

    // Get employee for this user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true }
    });

    const employeeId = user?.employee?.id;

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: parseInt(id) }
    });

    if (!leaveRequest) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    // Only allow deletion if:
    // 1. User is admin, OR
    // 2. User owns the request AND it's still pending
    if (!isAdmin && (leaveRequest.employeeId !== employeeId || leaveRequest.status !== 'PENDING')) {
      return res.status(403).json({ error: 'Cannot delete this leave request' });
    }

    // If synced to Xero, attempt to cancel the leave application there first
    if (leaveRequest.xeroLeaveId) {
      await xeroLeaveService.cancelLeave(leaveRequest.id);
    }

    await prisma.leaveRequest.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Leave request deleted successfully' });
  } catch (error) {
    console.error('[Leave] Error deleting leave request:', error);
    res.status(500).json({ error: 'Failed to delete leave request' });
  }
};
