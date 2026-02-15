const mapsService = require('../services/mapsService');

const geocode = async (req, res) => {
  try {
    const { address } = req.query;

    if (!address) {
      return res.status(400).json({ error: 'address query parameter is required' });
    }

    const result = await mapsService.geocodeAddress(address);

    if (!result) {
      return res.status(404).json({ error: 'Address not found' });
    }

    res.json({ result });
  } catch (error) {
    console.error('Geocode error:', error);
    res.status(500).json({ error: 'Failed to geocode address' });
  }
};

const calculateDistance = async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'from and to query parameters are required' });
    }

    const distance = await mapsService.calculateDistance(from, to);

    if (distance === null) {
      return res.status(404).json({ error: 'Could not calculate distance' });
    }

    res.json({ distance, unit: 'km' });
  } catch (error) {
    console.error('Calculate distance error:', error);
    res.status(500).json({ error: 'Failed to calculate distance' });
  }
};

const searchPlaces = async (req, res) => {
  try {
    const { query, lat, lng } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'query parameter is required' });
    }

    const results = await mapsService.searchPlaces(query, {
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined
    });

    res.json({ results });
  } catch (error) {
    console.error('Search places error:', error);
    res.status(500).json({ error: 'Failed to search places' });
  }
};

module.exports = {
  geocode,
  calculateDistance,
  searchPlaces
};
