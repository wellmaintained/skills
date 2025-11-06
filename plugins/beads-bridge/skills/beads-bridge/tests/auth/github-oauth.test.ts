// tests/auth/github-oauth.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubOAuth } from '../../src/auth/github-oauth.js';

describe('GitHubOAuth', () => {
  let oauth: GitHubOAuth;

  beforeEach(() => {
    vi.useFakeTimers();
    oauth = new GitHubOAuth({
      clientId: 'test-client-id',
      scopes: ['repo', 'read:org'],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should request device code', async () => {
    // Mock fetch for device code request
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        device_code: 'device_abc123',
        user_code: 'ABCD-1234',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5,
      }),
    });

    const deviceCode = await oauth.requestDeviceCode();

    expect(deviceCode).toEqual({
      deviceCode: 'device_abc123',
      userCode: 'ABCD-1234',
      verificationUri: 'https://github.com/login/device',
      expiresIn: 900,
      interval: 5,
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://github.com/login/device/code',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('client_id=test-client-id'),
      })
    );
  });

  it('should poll for authorization', async () => {
    // Mock fetch for polling
    global.fetch = vi.fn()
      // First poll: pending
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: 'authorization_pending',
        }),
      })
      // Second poll: success
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'gho_test_token_123',
          token_type: 'bearer',
          scope: 'repo read:org',
        }),
      });

    const pollPromise = oauth.pollForToken('device_abc123', 1); // 1s interval for testing

    // Advance timers to trigger the polling
    await vi.advanceTimersByTimeAsync(3000); // Advance enough for 2 polls

    const result = await pollPromise;

    expect(result).toEqual({
      accessToken: 'gho_test_token_123',
      scopes: ['repo', 'read:org'],
    });
  });

  it('should handle expired device code', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        error: 'expired_token',
      }),
    });

    // Create the polling promise and immediately wrap it in expect
    // This ensures the rejection handler is registered before we advance timers
    const pollPromise = oauth.pollForToken('device_abc123', 1, 2);
    const expectPromise = expect(pollPromise).rejects.toThrow('Device code expired');

    // Now advance timers to trigger the polling
    await vi.advanceTimersByTimeAsync(2200);

    // Await the expect to complete
    await expectPromise;
  });

  it('should handle slow down requests', async () => {
    const sleepSpy = vi.spyOn(oauth as any, 'sleep');

    global.fetch = vi.fn()
      // Slow down response
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: 'slow_down' }),
      })
      // Success
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'gho_token',
          scope: 'repo',
        }),
      });

    const pollPromise = oauth.pollForToken('device_code', 1);

    // Advance timers to allow both polls (with increased interval on second)
    await vi.advanceTimersByTimeAsync(10000);

    await pollPromise;

    // Should have increased interval on slow_down
    expect(sleepSpy).toHaveBeenCalled();
  });
});
