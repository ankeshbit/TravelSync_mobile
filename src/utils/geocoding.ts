import * as Location from 'expo-location';

/**
 * Geocode a place name/address using expo-location.
 * Returns lat/lng if geocoding succeeds, or empty object if permissions denied, lookup fails, or offline.
 */
export async function geocodePlace(
  address: string,
  destinationFallback?: string
): Promise<{ lat?: number; lng?: number }> {
  try {
    const trimmedAddress = address.trim();
    const trimmedFallback = destinationFallback?.trim();

    const query = [trimmedAddress, trimmedFallback].filter(Boolean).join(', ');
    if (!query) {
      return {};
    }

    // Request foreground location permissions safely
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return {};
    }

    const results = await Location.geocodeAsync(query);
    if (results && results.length > 0) {
      const { latitude, longitude } = results[0];
      if (typeof latitude === 'number' && typeof longitude === 'number' && (latitude !== 0 || longitude !== 0)) {
        return { lat: latitude, lng: longitude };
      }
    }

    // Fallback attempt with address string alone
    if (trimmedFallback && trimmedAddress !== trimmedFallback) {
      const fallbackResults = await Location.geocodeAsync(trimmedAddress);
      if (fallbackResults && fallbackResults.length > 0) {
        const { latitude, longitude } = fallbackResults[0];
        if (typeof latitude === 'number' && typeof longitude === 'number' && (latitude !== 0 || longitude !== 0)) {
          return { lat: latitude, lng: longitude };
        }
      }
    }

    return {};
  } catch (err) {
    // Graceful fallback when network or geocoding fails
    console.warn('[geocoding] Geocode lookup unavailable:', err);
    return {};
  }
}
