const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/', requireAuth, companyController.getAllCompanies);
router.get('/:id', requireAuth, companyController.getCompanyById);
router.post('/', requireAdmin, companyController.createCompany);
router.put('/:id', requireAdmin, companyController.updateCompany);
router.delete('/:id', requireAdmin, companyController.deleteCompany);

module.exports = router;
