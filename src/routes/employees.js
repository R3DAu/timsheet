const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

/**
 * @swagger
 * /api/employees:
 *   get:
 *     summary: List all employees
 *     tags: [Employees]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: List of employees with roles and identifiers
 */
router.get('/', requireAuth, employeeController.getAllEmployees);

/**
 * @swagger
 * /api/employees/{id}:
 *   get:
 *     summary: Get employee by ID
 *     tags: [Employees]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Employee details with roles and identifiers
 *       404:
 *         description: Employee not found
 */
router.get('/:id', requireAuth, employeeController.getEmployeeById);

/**
 * @swagger
 * /api/employees:
 *   post:
 *     summary: Create a new employee (admin only)
 *     tags: [Employees]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, firstName, lastName, email]
 *             properties:
 *               userId:
 *                 type: integer
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               presetAddresses:
 *                 type: string
 *                 description: JSON string of preset address labels
 *     responses:
 *       201:
 *         description: Employee created
 */
router.post('/', requireAdmin, employeeController.createEmployee);

/**
 * @swagger
 * /api/employees/{id}:
 *   put:
 *     summary: Update an employee
 *     tags: [Employees]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Employee updated
 */
router.put('/:id', requireAuth, employeeController.updateEmployee);

/**
 * @swagger
 * /api/employees/{id}:
 *   delete:
 *     summary: Delete an employee (admin only)
 *     tags: [Employees]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Employee deleted
 */
router.delete('/:id', requireAdmin, employeeController.deleteEmployee);

/**
 * @swagger
 * /api/employees/{id}/identifiers:
 *   post:
 *     summary: Add an identifier to an employee (admin only)
 *     tags: [Employees]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifierType, identifierValue]
 *             properties:
 *               identifierType:
 *                 type: string
 *                 description: e.g. payroll, contractor_id, hr_system
 *               identifierValue:
 *                 type: string
 *               companyId:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Identifier added
 */
router.post('/:id/identifiers', requireAdmin, employeeController.addEmployeeIdentifier);

/**
 * @swagger
 * /api/employees/identifiers/{identifierId}:
 *   put:
 *     summary: Update an employee identifier (admin only)
 *     tags: [Employees]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: identifierId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               identifierType:
 *                 type: string
 *               identifierValue:
 *                 type: string
 *               companyId:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Identifier updated
 */
router.put('/identifiers/:identifierId', requireAdmin, employeeController.updateIdentifier);

/**
 * @swagger
 * /api/employees/identifiers/{identifierId}:
 *   delete:
 *     summary: Delete an employee identifier (admin only)
 *     tags: [Employees]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: identifierId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Identifier deleted
 */
router.delete('/identifiers/:identifierId', requireAdmin, employeeController.deleteIdentifier);

/**
 * @swagger
 * /api/employees/{id}/roles:
 *   post:
 *     summary: Assign a role to an employee (admin only)
 *     tags: [Employees]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roleId, companyId]
 *             properties:
 *               roleId:
 *                 type: integer
 *               companyId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Role assigned
 */
router.post('/:id/roles', requireAdmin, employeeController.assignRole);

module.exports = router;
