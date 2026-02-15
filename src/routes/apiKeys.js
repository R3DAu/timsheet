const express = require('express');
const router = express.Router();
const apiKeyController = require('../controllers/apiKeyController');
const { requireAdmin } = require('../middleware/auth');

// All routes require admin
router.post('/', requireAdmin, apiKeyController.createApiKey);
router.get('/', requireAdmin, apiKeyController.listApiKeys);
router.delete('/:id', requireAdmin, apiKeyController.revokeApiKey);

module.exports = router;
