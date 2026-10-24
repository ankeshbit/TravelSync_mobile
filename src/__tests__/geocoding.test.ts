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

  it('returns empty object if query is empty', async () => {
    const result = await geocodePlace('   ');
    expect(result).toEqual({});
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns empty object if permission is denied', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
    });

    const result = await geocodePlace('Eiffel Tower');
    expect(result).toEqual({});
  });

  it('returns lat and lng when geocoding succeeds', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'granted',
    });
    (Location.geocodeAsync as jest.Mock).mockResolvedValueOnce([
      { latitude: 48.8584, longitude: 2.2945 },
    ]);

    const result = await geocodePlace('Eiffel Tower', 'Paris');
    expect(result).toEqual({ lat: 48.8584, lng: 2.2945 });
    expect(Location.geocodeAsync).toHaveBeenCalledWith('Eiffel Tower, Paris');
  });

  it('falls back gracefully to empty object when geocoding throws (network/service failure)', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'granted',
    });
    (Location.geocodeAsync as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const result = await geocodePlace('Unknown place');
    expect(result).toEqual({});
  });

  it('tries fallback query if combined query returns no results', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'granted',
    });
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
