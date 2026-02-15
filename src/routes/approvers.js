const express = require('express');
const router = express.Router();
const approverController = require('../controllers/approverController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/', requireAuth, approverController.getAllApprovers);
router.post('/', requireAdmin, approverController.createApprover);
router.delete('/:id', requireAdmin, approverController.deleteApprover);

module.exports = router;
