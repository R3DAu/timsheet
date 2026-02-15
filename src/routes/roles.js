const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

/**
 * @swagger
 * /api/roles:
 *   get:
 *     summary: List all roles
 *     tags: [Roles]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: List of roles with company info
 */
router.get('/', requireAuth, roleController.getAllRoles);

/**
 * @swagger
 * /api/roles/{id}:
 *   get:
 *     summary: Get role by ID
 *     tags: [Roles]
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
 *         description: Role details
 */
router.get('/:id', requireAuth, roleController.getRoleById);

/**
 * @swagger
 * /api/roles:
 *   post:
 *     summary: Create a new role (admin only)
 *     tags: [Roles]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, companyId, payRate]
 *             properties:
 *               name:
 *                 type: string
 *               companyId:
 *                 type: integer
 *               payRate:
 *                 type: number
 *     responses:
 *       201:
 *         description: Role created
 */
router.post('/', requireAdmin, roleController.createRole);

/**
 * @swagger
 * /api/roles/{id}:
 *   put:
 *     summary: Update a role (admin only)
 *     tags: [Roles]
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
 *               name:
 *                 type: string
 *               payRate:
 *                 type: number
 *     responses:
 *       200:
 *         description: Role updated
 */
router.put('/:id', requireAdmin, roleController.updateRole);

/**
 * @swagger
 * /api/roles/{id}:
 *   delete:
 *     summary: Delete a role (admin only)
 *     tags: [Roles]
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
 *         description: Role deleted
 */
router.delete('/:id', requireAdmin, roleController.deleteRole);

module.exports = router;
