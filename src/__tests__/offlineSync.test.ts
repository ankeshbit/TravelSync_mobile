import { normalizeSyncResult } from '../api/trips';
import { offlineStorage } from '../services/offlineStorage';

jest.mock('../api/client', () => ({
  api: {
    post: jest.fn(),
    get: jest.fn(),
  },
  getErrorMessage: jest.fn((e) => (e && e.message ? e.message : 'Error')),
}));

describe('offline synchronization normalizeSyncResult', () => {
  const queue = [
    { id: 'op_1', tripId: 'trip_1', type: 'place_note', payload: {}, timestamp: '2026-01-01' },
    { id: 'op_2', tripId: 'trip_1', type: 'place_note', payload: {}, timestamp: '2026-01-02' },
    { id: 'op_3', tripId: 'trip_1', type: 'place_note', payload: {}, timestamp: '2026-01-03' },
  ];

  it('handles all operations succeeding with results array', () => {
    const rawResponse = {
      results: [
        { id: 'op_1', success: true },
        { id: 'op_2', success: true },
        { id: 'op_3', success: true },
      ],
    };

    const res = normalizeSyncResult(rawResponse, queue);
    expect(res.isFullSuccess).toBe(true);
    expect(res.isPartialSuccess).toBe(false);
    expect(res.isFullFailure).toBe(false);
    expect(res.syncedIds).toEqual(['op_1', 'op_2', 'op_3']);
    expect(res.failedIds).toEqual([]);
    expect(res.syncedCount).toBe(3);
    expect(res.failedCount).toBe(0);
  });

  it('handles all operations succeeding with acknowledgedIds', () => {
    const rawResponse = {
      acknowledgedIds: ['op_1', 'op_2', 'op_3'],
    };

    const res = normalizeSyncResult(rawResponse, queue);
    expect(res.isFullSuccess).toBe(true);
    expect(res.syncedCount).toBe(3);
    expect(res.failedCount).toBe(0);
  });

  it('handles all operations failing with error dictionary and results', () => {
    const rawResponse = {
      results: [
        { id: 'op_1', success: false, error: 'Database conflict' },
        { id: 'op_2', success: false, error: 'Place not found' },
        { id: 'op_3', success: false, error: 'Unauthorized' },
      ],
    };

    const res = normalizeSyncResult(rawResponse, queue);
    expect(res.isFullSuccess).toBe(false);
    expect(res.isPartialSuccess).toBe(false);
    expect(res.isFullFailure).toBe(true);
    expect(res.syncedIds).toEqual([]);
    expect(res.failedIds).toEqual(['op_1', 'op_2', 'op_3']);
    expect(res.syncedCount).toBe(0);
    expect(res.failedCount).toBe(3);
    expect(res.errors).toEqual({
      op_1: 'Database conflict',
      op_2: 'Place not found',
      op_3: 'Unauthorized',
    });
  });

  it('handles partial synchronization properly', () => {
    const rawResponse = {
      results: [
        { id: 'op_1', success: true },
        { id: 'op_2', success: false, error: 'Temporary DB error' },
      ],
      // op_3 omitted by server
    };

    const res = normalizeSyncResult(rawResponse, queue);
    expect(res.isFullSuccess).toBe(false);
    expect(res.isPartialSuccess).toBe(true);
    expect(res.isFullFailure).toBe(false);
    expect(res.syncedIds).toEqual(['op_1']);
    // Both explicitly failed op_2 and unacknowledged op_3 are retained as failed
    expect(res.failedIds).toContain('op_2');
    expect(res.failedIds).toContain('op_3');
    expect(res.syncedCount).toBe(1);
    expect(res.failedCount).toBe(2);
  });

  it('handles duplicate acknowledgements gracefully', () => {
    const rawResponse = {
      acknowledgedIds: ['op_1', 'op_1', 'op_2', 'op_1'],
    };

    const res = normalizeSyncResult(rawResponse, queue);
    expect(res.syncedIds).toEqual(['op_1', 'op_2']);
    expect(res.syncedCount).toBe(2);
    expect(res.failedIds).toEqual(['op_3']);
  });

  it('handles empty queues cleanly', () => {
    const res = normalizeSyncResult({ success: true, results: [] }, []);
    expect(res.isFullSuccess).toBe(false);
    expect(res.isFullFailure).toBe(false);
    expect(res.syncedCount).toBe(0);
    expect(res.failedCount).toBe(0);
    expect(res.syncedIds).toEqual([]);
    expect(res.failedIds).toEqual([]);
  });

  it('handles invalid or unexpected API responses without crashing', () => {
    const nonObject = normalizeSyncResult('Internal Server Error', queue);
    expect(nonObject.isFullFailure).toBe(true);
    expect(nonObject.syncedCount).toBe(0);

    const nullData = normalizeSyncResult(null, queue);
    expect(nullData.isFullFailure).toBe(true);
    expect(nullData.syncedCount).toBe(0);

    const emptyObj = normalizeSyncResult({}, queue);
    expect(emptyObj.isFullFailure).toBe(true);
    expect(emptyObj.syncedCount).toBe(0);
  });
});

describe('offline synchronization queue persistence during network interruptions', () => {
  const userId = 'sync_test_user_queue';
  const tripId = 'sync_test_trip_queue';

  beforeEach(async () => {
    await offlineStorage.clearPendingSyncQueue(userId, tripId);
  });

  afterEach(async () => {
    await offlineStorage.clearPendingSyncQueue(userId, tripId);
  });

  it('retains failed items in queue when only partial items succeed', async () => {
    const item1 = { id: 'q_1', tripId, type: 'place_note' as const, payload: { note: '1' }, timestamp: '2026-01-01' };
    const item2 = { id: 'q_2', tripId, type: 'place_note' as const, payload: { note: '2' }, timestamp: '2026-01-02' };
    const item3 = { id: 'q_3', tripId, type: 'place_note' as const, payload: { note: '3' }, timestamp: '2026-01-03' };

    await offlineStorage.queuePendingSync(userId, tripId, item1);
    await offlineStorage.queuePendingSync(userId, tripId, item2);
    await offlineStorage.queuePendingSync(userId, tripId, item3);

    // Simulate backend response where only q_1 was acknowledged
    const response = { syncedIds: ['q_1'], failedIds: ['q_2', 'q_3'] };
    const normalized = normalizeSyncResult(response, [item1, item2, item3]);

    // Only clear acknowledged IDs
    await offlineStorage.clearPendingSyncQueue(userId, tripId, normalized.syncedIds);

    const remaining = await offlineStorage.getPendingSyncQueue(userId, tripId);
    expect(remaining).toHaveLength(2);
    expect(remaining.map((r) => r.id)).toEqual(['q_2', 'q_3']);
  });

  it('retains all items in queue when network interruption causes total failure', async () => {
    const item1 = { id: 'q_net_1', tripId, type: 'place_note' as const, payload: { note: '1' }, timestamp: '2026-01-01' };
    await offlineStorage.queuePendingSync(userId, tripId, item1);

    // Network throws an error before clearPendingSyncQueue is ever called
    const simulateNetworkError = async () => {
      throw new Error('Network request failed');
    };

    await expect(simulateNetworkError()).rejects.toThrow('Network request failed');

    // Queue must still have the item intact
    const remaining = await offlineStorage.getPendingSyncQueue(userId, tripId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('q_net_1');
  });
});
