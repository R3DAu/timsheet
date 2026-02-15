const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getAllApprovers = async (req, res) => {
  try {
    const { companyId } = req.query;

    const where = companyId ? { companyId: parseInt(companyId) } : {};

    const approvers = await prisma.timesheetApprover.findMany({
      where,
      include: {
        company: true,
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.json({ approvers });
  } catch (error) {
    console.error('Get approvers error:', error);
    res.status(500).json({ error: 'Failed to fetch approvers' });
  }
};

const createApprover = async (req, res) => {
  try {
    const { companyId, userId, email } = req.body;

    if (!companyId || !userId || !email) {
      return res.status(400).json({ error: 'companyId, userId, and email are required' });
    }

    const approver = await prisma.timesheetApprover.create({
      data: {
        companyId: parseInt(companyId),
        userId: parseInt(userId),
        email
      },
      include: {
        company: true,
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.status(201).json({ message: 'Approver added successfully', approver });
  } catch (error) {
    console.error('Create approver error:', error);
    res.status(500).json({ error: 'Failed to add approver' });
  }
};

const deleteApprover = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.timesheetApprover.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Approver removed successfully' });
  } catch (error) {
    console.error('Delete approver error:', error);
    res.status(500).json({ error: 'Failed to remove approver' });
  }
};

module.exports = {
  getAllApprovers,
  createApprover,
  deleteApprover
};
