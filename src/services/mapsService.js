const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Nominatim (OpenStreetMap) — free, no API key required
// Usage policy: max 1 req/sec, identify with User-Agent
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const NOMINATIM_HEADERS = { 'User-Agent': 'TimesheetSystem/1.0' };

const geocodeAddress = async (address) => {
  // Check cache first
  const cached = await prisma.placeCache.findUnique({
    where: { placeName: address }
  });

  if (cached) {
    return {
      address: cached.address,
      latitude: cached.latitude,
      longitude: cached.longitude,
      placeId: cached.googlePlaceId
    };
  }

  try {
    const response = await axios.get(`${NOMINATIM_BASE}/search`, {
      params: {
        q: address,
        format: 'json',
        addressdetails: 1,
        limit: 1,
        countrycodes: 'au'
      },
      headers: NOMINATIM_HEADERS
    });

    if (!response.data || response.data.length === 0) {
      return null;
    }

    const result = response.data[0];

    // Cache the result
    await prisma.placeCache.create({
      data: {
        placeName: address,
        address: result.display_name,
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        googlePlaceId: `osm_${result.osm_type}_${result.osm_id}`
      }
    });

    return {
      address: result.display_name,
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      placeId: `osm_${result.osm_type}_${result.osm_id}`
    };
  } catch (error) {
    console.error('Geocoding error:', error.message);
    return null;
  }
};

const calculateDistance = async (fromAddress, toAddress) => {
  try {
    // Geocode both addresses first
    const from = await geocodeAddress(fromAddress);
    const to = await geocodeAddress(toAddress);

    if (!from || !to) {
      return null;
    }

    // Haversine formula for straight-line distance
    const R = 6371; // Earth's radius in km
    const dLat = (to.latitude - from.latitude) * Math.PI / 180;
    const dLon = (to.longitude - from.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(from.latitude * Math.PI / 180) * Math.cos(to.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = Math.round(R * c * 100) / 100;

    return distanceKm;
  } catch (error) {
    console.error('Distance calculation error:', error.message);
    return null;
  }
};

/**
 * Search for places using OpenStreetMap Nominatim.
 * Biased toward Australia, prioritises schools and businesses.
 */
const searchPlaces = async (query, { lat, lng } = {}) => {
  try {
    const params = {
      q: query,
      format: 'json',
      addressdetails: 1,
      limit: 8,
      countrycodes: 'au'
    };

    // Bias results toward user's location if provided
    if (lat && lng) {
      params.viewbox = `${lng - 0.5},${lat + 0.5},${lng + 0.5},${lat - 0.5}`;
      params.bounded = 0; // prefer but don't restrict
    }

    const response = await axios.get(`${NOMINATIM_BASE}/search`, {
      params,
      headers: NOMINATIM_HEADERS
    });

    if (!response.data || response.data.length === 0) {
      return [];
    }

    return response.data.map(r => {
      const addr = r.address || {};
      // Build a short secondary text from address parts
      const parts = [addr.suburb, addr.city || addr.town || addr.village, addr.state].filter(Boolean);
      return {
        placeId: `osm_${r.osm_type}_${r.osm_id}`,
        description: r.display_name,
        mainText: r.name || r.display_name.split(',')[0],
        secondaryText: parts.join(', ')
      };
    });
  } catch (error) {
    console.error('Places search error:', error.message);
    return [];
  }
};

module.exports = {
  geocodeAddress,
  calculateDistance,
  searchPlaces
};
