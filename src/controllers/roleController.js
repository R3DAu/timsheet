const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getAllRoles = async (req, res) => {
  try {
    const { companyId } = req.query;

    const where = companyId ? { companyId: parseInt(companyId) } : {};

    const roles = await prisma.role.findMany({
      where,
      include: {
        company: true,
        _count: {
          select: { employeeRoles: true }
        }
      }
    });

    res.json({ roles });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
};

const getRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await prisma.role.findUnique({
      where: { id: parseInt(id) },
      include: {
        company: true,
        employeeRoles: {
          include: {
            employee: {
              include: {
                user: {
                  select: { name: true, email: true }
                }
              }
            }
          },
          where: { isActive: true }
        }
      }
    });

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    res.json({ role });
  } catch (error) {
    console.error('Get role error:', error);
    res.status(500).json({ error: 'Failed to fetch role' });
  }
};

const createRole = async (req, res) => {
  try {
    const { name, companyId, payRate } = req.body;

    if (!name || !companyId || payRate === undefined) {
      return res.status(400).json({ error: 'name, companyId, and payRate are required' });
    }

    const role = await prisma.role.create({
      data: {
        name,
        companyId: parseInt(companyId),
        payRate: parseFloat(payRate)
      },
      include: {
        company: true
      }
    });

    res.status(201).json({ message: 'Role created successfully', role });
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
};

const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, payRate } = req.body;

    const role = await prisma.role.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(payRate !== undefined && { payRate: parseFloat(payRate) })
      },
      include: {
        company: true
      }
    });

    res.json({ message: 'Role updated successfully', role });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
};

const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.role.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
};

module.exports = {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole
};
