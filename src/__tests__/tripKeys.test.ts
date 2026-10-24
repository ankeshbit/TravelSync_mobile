import { TRIP_KEYS } from '../constants/tripKeys';

describe('TRIP_KEYS query key mapping', () => {
  it('generates consistent keys for all entity types', () => {
    const tripId = 'trip-123';

    expect(TRIP_KEYS.all).toEqual(['trips']);
    expect(TRIP_KEYS.lists()).toEqual(['trips', 'list']);
    expect(TRIP_KEYS.list('tokyo')).toEqual(['trips', 'list', { search: 'tokyo' }]);
    expect(TRIP_KEYS.list()).toEqual(['trips', 'list', { search: '' }]);
    expect(TRIP_KEYS.summary()).toEqual(['trips', 'summary']);
    expect(TRIP_KEYS.detail(tripId)).toEqual(['trips', 'detail', 'trip-123']);
    expect(TRIP_KEYS.places(tripId)).toEqual(['trips', 'places', 'trip-123']);
    expect(TRIP_KEYS.expenses(tripId)).toEqual(['trips', 'expenses', 'trip-123']);
    expect(TRIP_KEYS.balances(tripId)).toEqual(['trips', 'balances', 'trip-123']);
    expect(TRIP_KEYS.members(tripId)).toEqual(['trips', 'members', 'trip-123']);
    expect(TRIP_KEYS.activity(tripId)).toEqual(['trips', 'activity', 'trip-123']);
  });

  it('matches explore query structure', () => {
    expect(TRIP_KEYS.explore('paris')).toEqual(['explore', 'paris']);
    expect(TRIP_KEYS.explore()).toEqual(['explore', '']);
  });
});
