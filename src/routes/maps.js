const express = require('express');
const router = express.Router();
const mapsController = require('../controllers/mapsController');
const { requireAuth } = require('../middleware/auth');

router.get('/geocode', requireAuth, mapsController.geocode);
router.get('/distance', requireAuth, mapsController.calculateDistance);

module.exports = router;
