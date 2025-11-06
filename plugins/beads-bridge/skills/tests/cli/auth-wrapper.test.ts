import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withAuth, getBackendFromConfig } from '../../src/cli/auth-wrapper.js';
import { CredentialStore } from '../../src/auth/credential-store.js';
import { ConfigManager } from '../../src/config/config-manager.js';

vi.mock('../../src/auth/credential-store.js');
vi.mock('../../src/config/config-manager.js');

describe('auth-wrapper', () => {
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Mock process.exit to throw so it stops execution like real exit would
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(((code: number) => {
      throw new Error(`process.exit(${code})`);
    }) as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('withAuth', () => {
    it('should execute operation when credentials exist', async () => {
      const mockHasCredentials = vi.fn().mockResolvedValue(true);
      vi.mocked(CredentialStore).mockImplementation(() => ({
        hasCredentials: mockHasCredentials,
      } as any));

      const operation = vi.fn().mockResolvedValue(undefined);

      await withAuth('github', operation);

      expect(mockHasCredentials).toHaveBeenCalledWith('github');
      expect(operation).toHaveBeenCalled();
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should exit with error when credentials do not exist', async () => {
      const mockHasCredentials = vi.fn().mockResolvedValue(false);
      vi.mocked(CredentialStore).mockImplementation(() => ({
        hasCredentials: mockHasCredentials,
      } as any));

      const operation = vi.fn();

      await expect(withAuth('github', operation)).rejects.toThrow('process.exit(1)');

      expect(mockHasCredentials).toHaveBeenCalledWith('github');
      expect(operation).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Not authenticated with github'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('beads-bridge auth github'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle non-credential errors during operation', async () => {
      const mockHasCredentials = vi.fn().mockResolvedValue(true);
      vi.mocked(CredentialStore).mockImplementation(() => ({
        hasCredentials: mockHasCredentials,
      } as any));

      const nonCredError = new Error('Network timeout');
      const operation = vi.fn().mockRejectedValue(nonCredError);

      await expect(withAuth('github', operation)).rejects.toThrow('Network timeout');
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should provide helpful error for credential-related errors', async () => {
      const mockHasCredentials = vi.fn().mockResolvedValue(true);
      vi.mocked(CredentialStore).mockImplementation(() => ({
        hasCredentials: mockHasCredentials,
      } as any));

      const credError = new Error('Failed to load credentials from store');
      const operation = vi.fn().mockRejectedValue(credError);

      await expect(withAuth('shortcut', operation)).rejects.toThrow('process.exit(1)');

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Authentication error'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('beads-bridge auth shortcut'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should work with different backend types', async () => {
      const mockHasCredentials = vi.fn().mockResolvedValue(true);
      vi.mocked(CredentialStore).mockImplementation(() => ({
        hasCredentials: mockHasCredentials,
      } as any));

      const operation = vi.fn().mockResolvedValue(undefined);

      await withAuth('shortcut', operation);

      expect(mockHasCredentials).toHaveBeenCalledWith('shortcut');
      expect(operation).toHaveBeenCalled();
    });
  });

  describe('getBackendFromConfig', () => {
    it('should return backend type from config', async () => {
      const mockManager = {
        getBackend: vi.fn().mockReturnValue('github'),
      };
      vi.mocked(ConfigManager.load).mockResolvedValue(mockManager as any);

      const backend = await getBackendFromConfig();

      expect(backend).toBe('github');
      expect(ConfigManager.load).toHaveBeenCalledWith(undefined);
    });

    it('should pass config path to loadConfig', async () => {
      const mockManager = {
        getBackend: vi.fn().mockReturnValue('shortcut'),
      };
      vi.mocked(ConfigManager.load).mockResolvedValue(mockManager as any);

      const backend = await getBackendFromConfig('/custom/path/config.json');

      expect(backend).toBe('shortcut');
      expect(ConfigManager.load).toHaveBeenCalledWith('/custom/path/config.json');
    });
  });
});
