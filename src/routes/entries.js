const express = require('express');
const router = express.Router();
const entryController = require('../controllers/entryController');
const { requireAuth } = require('../middleware/auth');

/**
 * @swagger
 * /api/entries:
 *   post:
 *     summary: Create a timesheet entry
 *     tags: [Entries]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [timesheetId, entryType, date, roleId, companyId]
 *             properties:
 *               timesheetId:
 *                 type: integer
 *               entryType:
 *                 type: string
 *                 enum: [GENERAL, TRAVEL]
 *               date:
 *                 type: string
 *                 format: date
 *               startTime:
 *                 type: string
 *                 description: "HH:MM format e.g. 07:00"
 *               endTime:
 *                 type: string
 *                 description: "HH:MM format e.g. 17:00"
 *               hours:
 *                 type: number
 *                 description: Fallback if startTime/endTime not provided
 *               roleId:
 *                 type: integer
 *               companyId:
 *                 type: integer
 *               notes:
 *                 type: string
 *                 description: Rich HTML content
 *               privateNotes:
 *                 type: string
 *                 description: Internal-only notes
 *               locationNotes:
 *                 type: string
 *                 description: JSON array of {location, description} pairs
 *               travelFrom:
 *                 type: string
 *               travelTo:
 *                 type: string
 *     responses:
 *       201:
 *         description: Entry created
 */
router.post('/', requireAuth, entryController.createEntry);

/**
 * @swagger
 * /api/entries/{id}:
 *   put:
 *     summary: Update a timesheet entry
 *     tags: [Entries]
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
 *               date:
 *                 type: string
 *                 format: date
 *               startTime:
 *                 type: string
 *               endTime:
 *                 type: string
 *               hours:
 *                 type: number
 *               roleId:
 *                 type: integer
 *               companyId:
 *                 type: integer
 *               notes:
 *                 type: string
 *               privateNotes:
 *                 type: string
 *               locationNotes:
 *                 type: string
 *               travelFrom:
 *                 type: string
 *               travelTo:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Entry updated
 */
router.put('/:id', requireAuth, entryController.updateEntry);

/**
 * @swagger
 * /api/entries/{id}:
 *   delete:
 *     summary: Delete a timesheet entry
 *     tags: [Entries]
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
 *         description: Entry deleted
 */
router.delete('/:id', requireAuth, entryController.deleteEntry);

/**
 * @swagger
 * /api/entries/timesheet/{timesheetId}:
 *   get:
 *     summary: Get all entries for a timesheet
 *     tags: [Entries]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: timesheetId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of entries
 */
router.get('/timesheet/:timesheetId', requireAuth, entryController.getEntriesByTimesheet);

module.exports = router;
