const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/', requireAuth, roleController.getAllRoles);
router.get('/:id', requireAuth, roleController.getRoleById);
router.post('/', requireAdmin, roleController.createRole);
router.put('/:id', requireAdmin, roleController.updateRole);
router.delete('/:id', requireAdmin, roleController.deleteRole);

module.exports = router;
