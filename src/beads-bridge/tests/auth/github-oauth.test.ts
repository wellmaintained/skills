// tests/auth/github-oauth.test.ts
import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { GitHubOAuth } from '../../src/auth/github-oauth.js';

describe('GitHubOAuth', () => {
  let oauth: GitHubOAuth;
  let sleepSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    oauth = new GitHubOAuth({
      clientId: 'test-client-id',
      scopes: ['repo', 'read:org'],
    });
    // Mock sleep to resolve immediately
    sleepSpy = spyOn(oauth as any, 'sleep').mockResolvedValue(undefined);
  });

  afterEach(() => {
    mock.restore();
  });

  it('should request device code', async () => {
    // Mock fetch for device code request
    global.fetch = mock().mockResolvedValueOnce({
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
    global.fetch = mock()
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

    const result = await oauth.pollForToken('device_abc123', 1);

    expect(result).toEqual({
      accessToken: 'gho_test_token_123',
      scopes: ['repo', 'read:org'],
    });
    
    // Should have slept once between polls
    expect(sleepSpy).toHaveBeenCalled();
  });

  it('should handle expired device code', async () => {
    global.fetch = mock().mockResolvedValue({
      ok: true,
      json: async () => ({
        error: 'expired_token',
      }),
    });

    try {
      await oauth.pollForToken('device_abc123', 1, 2);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message).toContain('Device code expired');
    }
  });

  it('should handle slow down requests', async () => {
    global.fetch = mock()
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

    await oauth.pollForToken('device_code', 1);

    // Should have slept twice (once for slow_down, once for next poll)
    expect(sleepSpy).toHaveBeenCalledTimes(2);
  });
});
