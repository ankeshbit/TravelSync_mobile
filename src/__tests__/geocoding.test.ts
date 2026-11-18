import { geocodePlace } from '../utils/geocoding';
import * as Location from 'expo-location';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  geocodeAsync: jest.fn(),
}));

describe('geocodePlace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty object if address is empty, even when destination fallback is provided', async () => {
    const resultWithFallback = await geocodePlace('   ', 'Tokyo, Japan');
    expect(resultWithFallback).toEqual({});
    expect(Location.geocodeAsync).not.toHaveBeenCalled();

    const resultEmpty = await geocodePlace('');
    expect(resultEmpty).toEqual({});
    expect(Location.geocodeAsync).not.toHaveBeenCalled();
  });

  it('does not request location permissions and returns coordinates when geocoding succeeds', async () => {
    (Location.geocodeAsync as jest.Mock).mockResolvedValueOnce([
      { latitude: 48.8584, longitude: 2.2945 },
    ]);

    const result = await geocodePlace('Eiffel Tower', 'Paris');
    expect(result).toEqual({ lat: 48.8584, lng: 2.2945 });
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.geocodeAsync).toHaveBeenCalledWith('Eiffel Tower, Paris');
  });

  it('falls back gracefully to empty object when geocoding throws (network/service failure)', async () => {
    (Location.geocodeAsync as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const result = await geocodePlace('Unknown place');
    expect(result).toEqual({});
  });

  it('tries fallback query if combined query returns no results', async () => {
    // First call (combined) returns []
    (Location.geocodeAsync as jest.Mock).mockResolvedValueOnce([]);
    // Second call (fallback) returns coordinates
    (Location.geocodeAsync as jest.Mock).mockResolvedValueOnce([
      { latitude: 12.9716, longitude: 77.5946 },
    ]);

    const result = await geocodePlace('Bangalore Fort', 'Bangalore, Karnataka');
    expect(result).toEqual({ lat: 12.9716, lng: 77.5946 });
    expect(Location.geocodeAsync).toHaveBeenCalledTimes(2);
  });
});
