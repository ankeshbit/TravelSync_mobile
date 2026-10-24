import { withKeyLock, offlineStorage } from '../services/offlineStorage';

describe('offlineStorage withKeyLock', () => {
  it('serializes concurrent operations on the same key', async () => {
    const sequence: number[] = [];
    const key = 'test_key_1';

    const op1 = withKeyLock(key, async () => {
      await new Promise((r) => setTimeout(r, 50));
      sequence.push(1);
      return 1;
    });

    const op2 = withKeyLock(key, async () => {
      await new Promise((r) => setTimeout(r, 10));
      sequence.push(2);
      return 2;
    });

    const results = await Promise.all([op1, op2]);
    expect(results).toEqual([1, 2]);
    expect(sequence).toEqual([1, 2]);
  });

  it('allows parallel operations across different keys', async () => {
    const sequence: string[] = [];

    const op1 = withKeyLock('key_A', async () => {
      await new Promise((r) => setTimeout(r, 60));
      sequence.push('A');
    });

    const op2 = withKeyLock('key_B', async () => {
      await new Promise((r) => setTimeout(r, 10));
      sequence.push('B');
    });

    await Promise.all([op1, op2]);
    // key_B finishes before key_A because they run concurrently
    expect(sequence).toEqual(['B', 'A']);
  });

  it('releases lock even when an operation throws', async () => {
    const key = 'failing_key';

    await expect(
      withKeyLock(key, async () => {
        throw new Error('Lock error');
      })
    ).rejects.toThrow('Lock error');

    // Next operation on same key must still succeed without deadlock
    const nextResult = await withKeyLock(key, async () => 'recovered');
    expect(nextResult).toBe('recovered');
  });
});

describe('offlineStorage pending sync queue', () => {
  const userId = 'test_user_sync_1';
  const tripId = 'test_trip_sync_1';

  beforeEach(async () => {
    await offlineStorage.clearPendingSyncQueue(userId, tripId);
  });

  it('queues items and selectively clears only acknowledged IDs', async () => {
    const item1 = { id: 'item_1', tripId, type: 'place_note' as const, payload: { placeId: 'p1', note: 'n1' }, timestamp: '2026-01-01' };
    const item2 = { id: 'item_2', tripId, type: 'place_note' as const, payload: { placeId: 'p2', note: 'n2' }, timestamp: '2026-01-02' };
    const item3 = { id: 'item_3', tripId, type: 'place_note' as const, payload: { placeId: 'p3', note: 'n3' }, timestamp: '2026-01-03' };

    await offlineStorage.queuePendingSync(userId, tripId, item1);
    await offlineStorage.queuePendingSync(userId, tripId, item2);
    await offlineStorage.queuePendingSync(userId, tripId, item3);

    const queueBefore = await offlineStorage.getPendingSyncQueue(userId, tripId);
    expect(queueBefore).toHaveLength(3);

    // Acknowledge item1 and item3 (e.g. successfully synced)
    await offlineStorage.clearPendingSyncQueue(userId, tripId, ['item_1', 'item_3']);

    const queueAfter = await offlineStorage.getPendingSyncQueue(userId, tripId);
    expect(queueAfter).toHaveLength(1);
    expect(queueAfter[0].id).toBe('item_2');
    expect(queueAfter[0].payload.note).toBe('n2');
  });

  it('returns empty array when userId or tripId is missing', async () => {
    const res = await offlineStorage.getPendingSyncQueue('', '');
    expect(res).toEqual([]);
  });
});
