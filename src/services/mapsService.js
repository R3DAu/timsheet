const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Nominatim (OpenStreetMap) — free, no API key required
// Usage policy: max 1 req/sec, identify with User-Agent
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const NOMINATIM_HEADERS = { 'User-Agent': 'TimesheetSystem/1.0' };

/**
 * Format Nominatim address to clean format
 * Example: "28 Allan Close, Pakenham, Victoria, 3810"
 */
const formatCleanAddress = (result) => {
  const addr = result.address || {};
  const cleanParts = [];

  // Street address (house_number + road)
  if (addr.house_number && addr.road) {
    cleanParts.push(`${addr.house_number} ${addr.road}`);
  } else if (addr.road) {
    cleanParts.push(addr.road);
  }

  // Suburb/City
  const locality = addr.suburb || addr.city || addr.town || addr.village;
  if (locality) cleanParts.push(locality);

  // State
  if (addr.state) cleanParts.push(addr.state);

  // Postcode
  if (addr.postcode) cleanParts.push(addr.postcode);

  return cleanParts.length > 0 ? cleanParts.join(', ') : result.display_name;
};

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
    const cleanAddress = formatCleanAddress(result);

    // Cache the result
    await prisma.placeCache.create({
      data: {
        placeName: address,
        address: cleanAddress,
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        googlePlaceId: `osm_${result.osm_type}_${result.osm_id}`
      }
    });

    return {
      address: cleanAddress,
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      placeId: `osm_${result.osm_type}_${result.osm_id}`
    };
  } catch (error) {
    console.error('Geocoding error:', error.message);
    return null;
  }
};

/**
 * Calculate driving distance and route using OSRM (Open Source Routing Machine)
 * @param {Array} waypoints - Array of {lat, lng} objects representing route waypoints
 * @returns {Object} - {distance: km, duration: seconds, geometry: encoded polyline}
 */
const calculateDrivingRoute = async (waypoints) => {
  try {
    if (!waypoints || waypoints.length < 2) {
      return null;
    }

    // Build coordinates string: lng,lat;lng,lat;...
    const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(';');

    const response = await axios.get(`https://router.project-osrm.org/route/v1/driving/${coords}`, {
      params: {
        overview: 'full',
        geometries: 'geojson'
      },
      headers: { 'User-Agent': 'TimesheetSystem/1.0' }
    });

    if (!response.data || !response.data.routes || response.data.routes.length === 0) {
      return null;
    }

    const route = response.data.routes[0];
    return {
      distance: Math.round(route.distance / 10) / 100, // meters to km, rounded to 2 decimals
      duration: Math.round(route.duration / 60), // seconds to minutes
      geometry: route.geometry.coordinates // GeoJSON LineString coordinates [[lng,lat], ...]
    };
  } catch (error) {
    console.error('OSRM routing error:', error.message);
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

    // Use OSRM for actual driving distance
    const route = await calculateDrivingRoute([
      { lat: from.latitude, lng: from.longitude },
      { lat: to.latitude, lng: to.longitude }
    ]);

    return route ? route.distance : null;
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
      const cleanAddress = formatCleanAddress(r);

      // Build a short secondary text from address parts
      const parts = [addr.suburb, addr.city || addr.town || addr.village, addr.state].filter(Boolean);

      return {
        placeId: `osm_${r.osm_type}_${r.osm_id}`,
        description: r.display_name,
        displayName: cleanAddress, // Clean formatted address for storage
        mainText: r.name || r.display_name.split(',')[0],
        secondaryText: parts.join(', '),
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon)
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
  calculateDrivingRoute,
  searchPlaces
};
