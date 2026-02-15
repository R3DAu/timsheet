const express = require('express');
const router = express.Router();
const approverController = require('../controllers/approverController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

/**
 * @swagger
 * /api/approvers:
 *   get:
 *     summary: List all timesheet approvers
 *     tags: [Approvers]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: List of approvers with company info
 */
router.get('/', requireAuth, approverController.getAllApprovers);

/**
 * @swagger
 * /api/approvers:
 *   post:
 *     summary: Add a timesheet approver (admin only)
 *     tags: [Approvers]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [companyId, userId, email]
 *             properties:
 *               companyId:
 *                 type: integer
 *               userId:
 *                 type: integer
 *               email:
 *                 type: string
 *     responses:
 *       201:
 *         description: Approver added
 */
router.post('/', requireAdmin, approverController.createApprover);

/**
 * @swagger
 * /api/approvers/{id}:
 *   delete:
 *     summary: Remove a timesheet approver (admin only)
 *     tags: [Approvers]
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
 *         description: Approver removed
 */
router.delete('/:id', requireAdmin, approverController.deleteApprover);

module.exports = router;
