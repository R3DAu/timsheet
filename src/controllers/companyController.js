const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getAllCompanies = async (req, res) => {
  try {
    const companies = await prisma.company.findMany({
      include: {
        _count: {
          select: { roles: true, employeeRoles: true }
        }
      }
    });
    res.json({ companies });
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
};

const getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await prisma.company.findUnique({
      where: { id: parseInt(id) },
      include: {
        roles: true,
        approvers: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({ company });
  } catch (error) {
    console.error('Get company error:', error);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
};

const createCompany = async (req, res) => {
  try {
    const { name, isBillable, wmsSyncEnabled } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const company = await prisma.company.create({
      data: {
        name,
        isBillable: isBillable !== undefined ? isBillable : true,
        wmsSyncEnabled: wmsSyncEnabled !== undefined ? wmsSyncEnabled : false
      }
    });

    res.status(201).json({ message: 'Company created successfully', company });
  } catch (error) {
    console.error('Create company error:', error);
    res.status(500).json({ error: 'Failed to create company' });
  }
};

const updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, isBillable, wmsSyncEnabled } = req.body;

    const company = await prisma.company.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(isBillable !== undefined && { isBillable }),
        ...(wmsSyncEnabled !== undefined && { wmsSyncEnabled })
      }
    });

    res.json({ message: 'Company updated successfully', company });
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ error: 'Failed to update company' });
  }
};

const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.company.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    console.error('Delete company error:', error);
    res.status(500).json({ error: 'Failed to delete company' });
  }
};

module.exports = {
  getAllCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany
};
