const express = require('express');
const router = express.Router();
const wmsSyncController = require('../controllers/wmsSyncController');
const { requireAuth } = require('../middleware/auth');

/**
 * @swagger
 * /api/wms-sync/start:
 *   post:
 *     summary: Start WMS sync for a timesheet
 *     tags: [WMS Sync]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [timesheetId, credentials]
 *             properties:
 *               timesheetId:
 *                 type: integer
 *               credentials:
 *                 type: object
 *                 properties:
 *                   username:
 *                     type: string
 *                   password:
 *                     type: string
 *     responses:
 *       202:
 *         description: Sync started
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Not authorized to sync this timesheet
 */
router.post('/start', requireAuth, wmsSyncController.startSync);

/**
 * @swagger
 * /api/wms-sync/status/{syncLogId}:
 *   get:
 *     summary: Get sync job status
 *     tags: [WMS Sync]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: syncLogId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Sync status details
 */
router.get('/status/:syncLogId', requireAuth, wmsSyncController.getSyncStatus);

/**
 * @swagger
 * /api/wms-sync/timesheet/{timesheetId}:
 *   get:
 *     summary: Get all sync logs for a timesheet
 *     tags: [WMS Sync]
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
 *         description: List of sync logs
 */
router.get('/timesheet/:timesheetId', requireAuth, wmsSyncController.getTimesheetSyncs);

module.exports = router;
