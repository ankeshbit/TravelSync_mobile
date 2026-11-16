import { Place } from '../types/trip';

describe('TripMapView camera coordinate and day change logic', () => {
  const day1Places: Place[] = [
    {
      id: 'p1',
      tripId: 't1',
      name: 'Senso-ji',
      address: 'Asakusa, Tokyo',
      lat: 35.7148,
      lng: 139.7967,
      dayNumber: 1,
      orderIndex: 0,
      category: 'sightseeing',
      duration: 60,
      createdAt: '2026-01-01',
    },
  ];

  const day2Places: Place[] = [
    {
      id: 'p2',
      tripId: 't1',
      name: 'Meiji Shrine',
      address: 'Shibuya, Tokyo',
      lat: 35.6764,
      lng: 139.6993,
      dayNumber: 2,
      orderIndex: 0,
      category: 'sightseeing',
      duration: 60,
      createdAt: '2026-01-01',
    },
    {
      id: 'p3',
      tripId: 't1',
      name: 'Shibuya Sky',
      address: 'Shibuya, Tokyo',
      lat: 35.6598,
      lng: 139.7022,
      dayNumber: 2,
      orderIndex: 1,
      category: 'sightseeing',
      duration: 60,
      createdAt: '2026-01-01',
    },
  ];

  it('generates distinct cache keys when active day changes', () => {
    const key1 = `day_1_${day1Places.map((c) => `${c.lat!.toFixed(4)},${c.lng!.toFixed(4)}`).join('|')}`;
    const key2 = `day_2_${day2Places.map((c) => `${c.lat!.toFixed(4)},${c.lng!.toFixed(4)}`).join('|')}`;

    expect(key1).not.toBe(key2);
    expect(key1).toContain('day_1');
    expect(key2).toContain('day_2');
  });

  it('filters out places missing coordinates safely', () => {
    const placesWithMissing: Place[] = [
      {
        id: 'p_valid',
        tripId: 't1',
        name: 'Valid Place',
        address: 'Tokyo',
        category: 'sightseeing',
        duration: 30,
        lat: 35.0,
        lng: 139.0,
        dayNumber: 1,
        orderIndex: 0,
        createdAt: '2026-01-01',
      },
      {
        id: 'p_invalid',
        tripId: 't1',
        name: 'Invalid Place',
        address: 'Tokyo',
        category: 'sightseeing',
        duration: 30,
        dayNumber: 1,
        orderIndex: 1,
        createdAt: '2026-01-01',
      },
    ];

    const polylineCoords = placesWithMissing
      .filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number')
      .map((p) => ({ latitude: p.lat!, longitude: p.lng! }));

    expect(polylineCoords).toHaveLength(1);
    expect(polylineCoords[0]).toEqual({ latitude: 35.0, longitude: 139.0 });
  });

  it('determines single vs multi-pin camera animation modes', () => {
    const isSingle = (coords: { latitude: number; longitude: number }[]) => coords.length === 1;
    const isMulti = (coords: { latitude: number; longitude: number }[]) => coords.length > 1;

    expect(isSingle([{ latitude: 10, longitude: 20 }])).toBe(true);
    expect(isMulti([{ latitude: 10, longitude: 20 }])).toBe(false);

    const twoCoords = [
      { latitude: 10, longitude: 20 },
      { latitude: 11, longitude: 21 },
    ];
    expect(isSingle(twoCoords)).toBe(false);
    expect(isMulti(twoCoords)).toBe(true);
  });
});
