const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

const geocodeAddress = async (address) => {
  // Check cache first
  const cached = await prisma.placeCache.findUnique({
    where: { placeName: address }
  });

  if (cached) {
    console.log(`Using cached geocode for: ${address}`);
    return {
      address: cached.address,
      latitude: cached.latitude,
      longitude: cached.longitude,
      placeId: cached.googlePlaceId
    };
  }

  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('Google Maps API key not configured');
    return null;
  }

  // Call Google Maps Geocoding API
  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          address,
          key: GOOGLE_MAPS_API_KEY
        }
      }
    );

    if (response.data.status !== 'OK' || !response.data.results.length) {
      console.error(`Geocoding failed for: ${address}`);
      return null;
    }

    const result = response.data.results[0];
    const location = result.geometry.location;

    // Cache the result
    await prisma.placeCache.create({
      data: {
        placeName: address,
        address: result.formatted_address,
        latitude: location.lat,
        longitude: location.lng,
        googlePlaceId: result.place_id
      }
    });

    console.log(`Geocoded and cached: ${address}`);
    return {
      address: result.formatted_address,
      latitude: location.lat,
      longitude: location.lng,
      placeId: result.place_id
    };
  } catch (error) {
    console.error('Geocoding error:', error.message);
    return null;
  }
};

const calculateDistance = async (fromAddress, toAddress) => {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('Google Maps API key not configured');
    return null;
  }

  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/distancematrix/json',
      {
        params: {
          origins: fromAddress,
          destinations: toAddress,
          units: 'metric',
          key: GOOGLE_MAPS_API_KEY
        }
      }
    );

    if (response.data.status !== 'OK') {
      console.error('Distance calculation failed');
      return null;
    }

    const element = response.data.rows[0].elements[0];
    if (element.status !== 'OK') {
      console.error('Distance calculation failed for route');
      return null;
    }

    // Return distance in kilometers
    const distanceKm = element.distance.value / 1000;
    console.log(`Distance from ${fromAddress} to ${toAddress}: ${distanceKm} km`);
    return distanceKm;
  } catch (error) {
    console.error('Distance calculation error:', error.message);
    return null;
  }
};

module.exports = {
  geocodeAddress,
  calculateDistance
};
