const express = require('express');
const router = express.Router();
const entryController = require('../controllers/entryController');
const { requireAuth } = require('../middleware/auth');

router.post('/', requireAuth, entryController.createEntry);
router.put('/:id', requireAuth, entryController.updateEntry);
router.delete('/:id', requireAuth, entryController.deleteEntry);
router.get('/timesheet/:timesheetId', requireAuth, entryController.getEntriesByTimesheet);

module.exports = router;
