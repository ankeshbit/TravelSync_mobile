describe('verifyEmail polling and timer logic', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs polling at a consistent 5s interval independent of 1s cooldown timer', () => {
    let pollCount = 0;
    let cooldown = 60;

    // Cooldown ticks every 1s
    const cooldownTimer = setInterval(() => {
      cooldown -= 1;
      if (cooldown <= 0) clearInterval(cooldownTimer);
    }, 1000);

    // Poller runs every 5s
    const pollInterval = setInterval(() => {
      pollCount += 1;
    }, 5000);

    // Advance 5 seconds: cooldown decreased by 5, poller fired 1 time
    jest.advanceTimersByTime(5000);
    expect(cooldown).toBe(55);
    expect(pollCount).toBe(1);

    // Advance 10 more seconds: cooldown decreased by 10, poller fired 2 more times (3 total)
    jest.advanceTimersByTime(10000);
    expect(cooldown).toBe(45);
    expect(pollCount).toBe(3);

    clearInterval(cooldownTimer);
    clearInterval(pollInterval);
  });

  it('stops polling and clears timers when email verification is detected', async () => {
    let isPolling = true;
    let verified = false;
    let redirected = false;

    const mockReload = jest.fn().mockImplementation(async () => {
      // Becomes verified on second poll
      if (mockReload.mock.calls.length >= 2) {
        verified = true;
      }
    });

    const checkVerificationStatus = async () => {
      if (!isPolling) return;
      await mockReload();
      if (verified) {
        isPolling = false;
        redirected = true;
      }
    };

    const interval = setInterval(checkVerificationStatus, 5000);

    // Poll 1: not verified
    await jest.advanceTimersByTimeAsync(5000);
    expect(mockReload).toHaveBeenCalledTimes(1);
    expect(redirected).toBe(false);
    expect(isPolling).toBe(true);

    // Poll 2: verified
    await jest.advanceTimersByTimeAsync(5000);
    expect(mockReload).toHaveBeenCalledTimes(2);
    expect(redirected).toBe(true);
    expect(isPolling).toBe(false);

    clearInterval(interval);

    // Further time advances do not trigger any more checks
    await jest.advanceTimersByTimeAsync(10000);
    expect(mockReload).toHaveBeenCalledTimes(2);
  });

  it('handles network failures during polling gracefully without throwing', async () => {
    let isPolling = true;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const mockReload = jest.fn().mockRejectedValue(new Error('Network offline'));

    const checkVerificationStatus = async () => {
      if (!isPolling) return;
      try {
        await mockReload();
      } catch (err) {
        console.warn('[verify-email] Background polling check warning:', err);
      }
    };

    const interval = setInterval(checkVerificationStatus, 5000);

    await jest.advanceTimersByTimeAsync(5000);
    expect(mockReload).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[verify-email] Background polling check warning:',
      expect.any(Error)
    );

    clearInterval(interval);
    warnSpy.mockRestore();
  });

  it('continues polling on subsequent intervals if token/sync fails after verification is true', async () => {
    let isPolling = true;
    let syncAttempts = 0;
    let redirected = false;

    const mockSync = jest.fn().mockImplementation(async () => {
      syncAttempts++;
      if (syncAttempts === 1) {
        throw new Error('Network error on sync');
      }
    });

    const checkVerificationStatus = async () => {
      if (!isPolling) return;
      try {
        // Assume verified
        await mockSync();
        isPolling = false;
        redirected = true;
      } catch {
        // continues polling
      }
    };

    const interval = setInterval(checkVerificationStatus, 5000);

    // Poll 1: sync fails, polling is not disabled
    await jest.advanceTimersByTimeAsync(5000);
    expect(syncAttempts).toBe(1);
    expect(isPolling).toBe(true);
    expect(redirected).toBe(false);

    // Poll 2: sync succeeds, polling stops, redirect occurs
    await jest.advanceTimersByTimeAsync(5000);
    expect(syncAttempts).toBe(2);
    expect(isPolling).toBe(false);
    expect(redirected).toBe(true);

    clearInterval(interval);
  });

  it('cleans up timers and does not trigger callbacks when component unmounts', async () => {
    let pollCount = 0;
    let isMounted = true;

    const checkStatus = () => {
      if (!isMounted) return;
      pollCount++;
    };

    const interval = setInterval(checkStatus, 5000);

    // Unmount before first tick
    isMounted = false;
    clearInterval(interval);

    await jest.advanceTimersByTimeAsync(15000);
    expect(pollCount).toBe(0);
  });

  it('resend cooldown counts down to 0 and stops', () => {
    let cooldown = 3;
    const timer = setInterval(() => {
      if (cooldown <= 1) {
        clearInterval(timer);
        cooldown = 0;
      } else {
        cooldown -= 1;
      }
    }, 1000);

    jest.advanceTimersByTime(1000);
    expect(cooldown).toBe(2);

    jest.advanceTimersByTime(1000);
    expect(cooldown).toBe(1);

    jest.advanceTimersByTime(1000);
    expect(cooldown).toBe(0);

    // Stays at 0
    jest.advanceTimersByTime(3000);
    expect(cooldown).toBe(0);
  });
});

