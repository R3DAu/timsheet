const express = require('express');
const router = express.Router();
const mapsController = require('../controllers/mapsController');
const { requireAuth } = require('../middleware/auth');

/**
 * @swagger
 * /api/maps/geocode:
 *   get:
 *     summary: Geocode an address using Google Maps API
 *     tags: [Maps]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: query
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Address to geocode
 *     responses:
 *       200:
 *         description: Geocoded location data
 */
router.get('/geocode', requireAuth, mapsController.geocode);

/**
 * @swagger
 * /api/maps/distance:
 *   get:
 *     summary: Calculate distance between two locations
 *     tags: [Maps]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *         description: Origin address
 *       - in: query
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *         description: Destination address
 *     responses:
 *       200:
 *         description: Distance in kilometers
 */
router.get('/distance', requireAuth, mapsController.calculateDistance);

/**
 * @swagger
 * /api/maps/search:
 *   get:
 *     summary: Search for places (schools, businesses) via Google Places Autocomplete
 *     tags: [Maps]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query (e.g. school name)
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: Latitude to bias results toward
 *       - in: query
 *         name: lng
 *         schema:
 *           type: number
 *         description: Longitude to bias results toward
 *     responses:
 *       200:
 *         description: Array of place predictions
 */
router.get('/search', requireAuth, mapsController.searchPlaces);

module.exports = router;
