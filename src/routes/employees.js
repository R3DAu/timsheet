const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/', requireAuth, employeeController.getAllEmployees);
router.get('/:id', requireAuth, employeeController.getEmployeeById);
router.post('/', requireAdmin, employeeController.createEmployee);
router.put('/:id', requireAuth, employeeController.updateEmployee);
router.delete('/:id', requireAdmin, employeeController.deleteEmployee);
router.post('/:id/identifiers', requireAdmin, employeeController.addEmployeeIdentifier);
router.post('/:id/roles', requireAdmin, employeeController.assignRole);

module.exports = router;
