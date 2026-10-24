import { withKeyLock } from '../services/offlineStorage';

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
