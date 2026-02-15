const express = require('express');
const router = express.Router();
const timesheetController = require('../controllers/timesheetController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/', requireAuth, timesheetController.getAllTimesheets);
router.get('/:id', requireAuth, timesheetController.getTimesheetById);
router.post('/', requireAuth, timesheetController.createTimesheet);
router.put('/:id', requireAuth, timesheetController.updateTimesheet);
router.post('/:id/submit', requireAuth, timesheetController.submitTimesheet);
router.post('/:id/approve', requireAuth, timesheetController.approveTimesheet);
router.post('/:id/lock', requireAdmin, timesheetController.lockTimesheet);
router.delete('/:id', requireAuth, timesheetController.deleteTimesheet);

module.exports = router;
