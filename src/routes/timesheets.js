const express = require('express');
const router = express.Router();
const timesheetController = require('../controllers/timesheetController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

/**
 * @swagger
 * /api/timesheets:
 *   get:
 *     summary: List timesheets (all for admin, own for employees)
 *     tags: [Timesheets]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: query
 *         name: employeeId
 *         schema:
 *           type: integer
 *         description: Filter by employee ID
 *     responses:
 *       200:
 *         description: List of timesheets with entries
 */
router.get('/', requireAuth, timesheetController.getAllTimesheets);

/**
 * @swagger
 * /api/timesheets/{id}:
 *   get:
 *     summary: Get timesheet by ID with entries
 *     tags: [Timesheets]
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
 *         description: Timesheet details with all entries
 */
router.get('/:id', requireAuth, timesheetController.getTimesheetById);

/**
 * @swagger
 * /api/timesheets:
 *   post:
 *     summary: Create a new timesheet
 *     tags: [Timesheets]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [employeeId, weekStarting, weekEnding]
 *             properties:
 *               employeeId:
 *                 type: integer
 *               weekStarting:
 *                 type: string
 *                 format: date
 *               weekEnding:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Timesheet created
 */
router.post('/', requireAuth, timesheetController.createTimesheet);

/**
 * @swagger
 * /api/timesheets/{id}:
 *   put:
 *     summary: Update a timesheet
 *     tags: [Timesheets]
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
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Timesheet updated
 */
router.put('/:id', requireAuth, timesheetController.updateTimesheet);

/**
 * @swagger
 * /api/timesheets/{id}/submit:
 *   post:
 *     summary: Submit a timesheet for approval
 *     tags: [Timesheets]
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
 *         description: Timesheet submitted and approvers notified
 */
router.post('/:id/submit', requireAuth, timesheetController.submitTimesheet);

/**
 * @swagger
 * /api/timesheets/{id}/approve:
 *   post:
 *     summary: Approve a submitted timesheet
 *     tags: [Timesheets]
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
 *         description: Timesheet approved
 */
router.post('/:id/approve', requireAuth, timesheetController.approveTimesheet);

/**
 * @swagger
 * /api/timesheets/{id}/lock:
 *   post:
 *     summary: Lock an approved timesheet (admin only)
 *     tags: [Timesheets]
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
 *         description: Timesheet locked
 */
router.post('/:id/lock', requireAdmin, timesheetController.lockTimesheet);

/**
 * @swagger
 * /api/timesheets/{id}/unlock:
 *   post:
 *     summary: Unlock a timesheet and set status to OPEN (admin only)
 *     tags: [Timesheets]
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
 *         description: Timesheet unlocked
 */
router.post('/:id/unlock', requireAdmin, timesheetController.unlockTimesheet);

/**
 * @swagger
 * /api/timesheets/{id}/change-status:
 *   post:
 *     summary: Change timesheet status to any valid state (admin only)
 *     tags: [Timesheets]
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [OPEN, INCOMPLETE, SUBMITTED, AWAITING_APPROVAL, APPROVED, LOCKED, UNLOCKED, PROCESSED]
 *     responses:
 *       200:
 *         description: Timesheet status changed
 */
router.post('/:id/change-status', requireAdmin, timesheetController.changeTimesheetStatus);

/**
 * @swagger
 * /api/timesheets/{id}:
 *   delete:
 *     summary: Delete a timesheet
 *     tags: [Timesheets]
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
 *         description: Timesheet deleted
 */
router.delete('/:id', requireAuth, timesheetController.deleteTimesheet);

/**
 * @swagger
 * /api/timesheets/repair/status-inconsistencies:
 *   post:
 *     summary: Repair status inconsistencies (admin only)
 *     tags: [Timesheets]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: Status repair completed
 */
router.post('/repair/status-inconsistencies', requireAdmin, timesheetController.repairStatusInconsistencies);

module.exports = router;
