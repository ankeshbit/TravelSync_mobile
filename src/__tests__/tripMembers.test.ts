import { filterTripMembers, getTripMemberCount } from '../utils/tripMembers';

describe('filterTripMembers', () => {
  it('returns empty array when passed null or empty list', () => {
    expect(filterTripMembers(null)).toEqual([]);
    expect(filterTripMembers([])).toEqual([]);
  });

  it('deduplicates members with identical userIds', () => {
    const members = [
      { id: 'm1', userId: 'u1', user: { name: 'Alice' } },
      { id: 'm2', userId: 'u1', user: { name: 'Alice Duplicate' } },
      { id: 'm3', userId: 'u2', user: { name: 'Bob' } },
    ];
    const filtered = filterTripMembers(members);
    expect(filtered).toHaveLength(2);
    expect(filtered[0].id).toBe('m1');
    expect(filtered[1].id).toBe('m3');
  });

  it('filters out the owner when ownerId is provided', () => {
    const members = [
      { id: 'm1', userId: 'owner-123', user: { name: 'Owner' } },
      { id: 'm2', userId: 'u2', user: { name: 'Bob' } },
      { id: 'm3', userId: 'u3', user: { name: 'Charlie' } },
    ];
    const filtered = filterTripMembers(members, 'owner-123');
    expect(filtered).toHaveLength(2);
    expect(filtered.map(m => m.userId)).toEqual(['u2', 'u3']);
  });

  it('correctly handles member without userId using user.id or id', () => {
    const members = [
      { id: 'user-a', user: { id: 'user-a', name: 'User A' } },
      { id: 'user-b', user: { id: 'user-b', name: 'User B' } },
      { id: 'user-a-dup', user: { id: 'user-a', name: 'User A Dup' } },
    ];
    const filtered = filterTripMembers(members);
    expect(filtered).toHaveLength(2);
  });
});

describe('getTripMemberCount', () => {
  it('returns at least 1 when members is empty and owner is present', () => {
    expect(getTripMemberCount([], 'owner-1')).toBe(1);
    expect(getTripMemberCount(null, 'owner-1')).toBe(1);
  });

  it('calculates 1 (owner) + unique non-owner count without duplicates', () => {
    const members = [
      { userId: 'owner-1' }, // included by backend
      { userId: 'user-2' },
      { userId: 'user-2' }, // accidental duplicate
      { userId: 'user-3' },
    ];
    // owner-1 is filtered out, leaving 2 unique members + 1 owner = 3
    expect(getTripMemberCount(members, 'owner-1')).toBe(3);
  });
});
