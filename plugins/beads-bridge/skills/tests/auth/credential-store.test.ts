// tests/auth/credential-store.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CredentialStore } from '../../src/auth/credential-store.js';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('CredentialStore', () => {
  let testDir: string;
  let store: CredentialStore;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'beads-bridge-test-'));
    store = new CredentialStore(join(testDir, 'credentials.json'));
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
});
