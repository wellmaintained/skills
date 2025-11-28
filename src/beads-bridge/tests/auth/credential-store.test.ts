// tests/auth/credential-store.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { CredentialStore } from '../../src/auth/credential-store.js';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('CredentialStore', () => {
  let testDir: string;
  let store: CredentialStore;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'beads-bridge-test-'));
    // Skip validation for test paths in /tmp
    store = new CredentialStore(join(testDir, 'credentials.json'), { skipValidation: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should save and load credentials', async () => {
    const creds = {
      github: {
        token: 'gho_test123',
        scopes: ['repo', 'read:org'],
      },
      shortcut: {
        token: 'shortcut_test_token',
      },
    };

    await store.save(creds);
    const loaded = await store.load();

    expect(loaded).toEqual(creds);
  });

  it('should return empty object when no credentials exist', async () => {
    const loaded = await store.load();
    expect(loaded).toEqual({});
  });

  it('should clear credentials', async () => {
    await store.save({
      github: { token: 'test', scopes: ['repo'] },
    });
    await store.clear();
    const loaded = await store.load();
    expect(loaded).toEqual({});
  });

  it('should encrypt credentials on disk', async () => {
    const { readFile } = await import('fs/promises');

    await store.save({
      github: { token: 'secret_token_123', scopes: ['repo'] },
    });

    const fileContent = await readFile(join(testDir, 'credentials.json'), 'utf-8');

    // Should not contain plain text token
    expect(fileContent).not.toContain('secret_token_123');
    // Should contain encryption metadata
    expect(fileContent).toContain('encrypted');
  });

  describe('Path Validation', () => {
    it('should reject paths in .claude/skills directory', () => {
      expect(() => {
        new CredentialStore('/home/user/.claude/skills/beads-bridge/credentials.json');
      }).toThrow(/Invalid credential path.*plugin or temporary directory/);
    });

    it('should reject paths in node_modules directory', () => {
      expect(() => {
        new CredentialStore('/var/project/node_modules/beads-bridge/credentials.json');
      }).toThrow(/Invalid credential path.*plugin or temporary directory/);
    });

    it('should reject paths in /tmp directory', () => {
      expect(() => {
        new CredentialStore('/tmp/beads-bridge/credentials.json');
      }).toThrow(/Invalid credential path.*plugin or temporary directory/);
    });

    it('should reject paths in Windows temp directory', () => {
      expect(() => {
        new CredentialStore('C:\\Users\\username\\AppData\\Local\\Temp\\credentials.json');
      }).toThrow(/Invalid credential path.*plugin or temporary directory/);
    });

    it('should accept path in .config directory', () => {
      expect(() => {
        new CredentialStore('/home/user/.config/beads-bridge/credentials.json');
      }).not.toThrow();
    });

    it('should accept path in user home directory', () => {
      expect(() => {
        new CredentialStore('/home/user/.beads-bridge-credentials.json');
      }).not.toThrow();
    });

    it('should accept Windows AppData/Roaming path', () => {
      expect(() => {
        new CredentialStore('C:\\Users\\username\\AppData\\Roaming\\beads-bridge\\credentials.json');
      }).not.toThrow();
    });

    it('should use default path when no path provided and no env var', () => {
      // Save and restore original env var
      const originalEnv = process.env.CREDENTIAL_STORE_PATH;
      delete process.env.CREDENTIAL_STORE_PATH;

      const defaultStore = new CredentialStore();
      // Access private filePath for testing
      const filePath = (defaultStore as any).filePath;

      expect(filePath).toContain('.config/beads-bridge/credentials.json');

      // Restore env var
      if (originalEnv) {
        process.env.CREDENTIAL_STORE_PATH = originalEnv;
      }
    });
  });
});
