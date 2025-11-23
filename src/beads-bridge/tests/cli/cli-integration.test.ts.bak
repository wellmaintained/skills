// tests/cli/cli-integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { CredentialStore } from '../../src/auth/credential-store.js';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const execFileAsync = promisify(execFile);

/**
 * Integration tests for CLI authentication flow
 *
 * These tests verify that:
 * 1. Commands requiring auth are properly blocked when not authenticated
 * 2. Commands work normally when authenticated
 * 3. Auth commands themselves don't require existing auth
 */
describe('CLI Integration Tests with Auth', () => {
  let testDir: string;
  let originalCredPath: string | undefined;

  beforeAll(async () => {
    // Create a temporary directory for test credentials
    testDir = join(tmpdir(), `beads-bridge-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Save original credential path
    originalCredPath = process.env.CREDENTIAL_STORE_PATH;

    // Set up test credential path
    process.env.CREDENTIAL_STORE_PATH = join(testDir, '.beads-credentials.json');

    // Create a minimal test config file (JSON format)
    const testConfig = {
      version: '2.0',
      backend: 'github',
      github: {
        repository: 'test/repo',
      },
      repositories: [
        {
          name: 'test-beads',
          path: join(testDir, '.beads'),
        },
      ],
      mappingStoragePath: join(testDir, '.beads-bridge'),
    };

    await writeFile(
      join(testDir, 'config.json'),
      JSON.stringify(testConfig, null, 2)
    );
  });

  afterAll(async () => {
    // Restore original credential path
    if (originalCredPath) {
      process.env.CREDENTIAL_STORE_PATH = originalCredPath;
    } else {
      delete process.env.CREDENTIAL_STORE_PATH;
    }

    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Unauthenticated flow', () => {
    beforeAll(async () => {
      // Ensure no credentials exist
      const store = new CredentialStore();
      await store.clear();
    });

    beforeEach(async () => {
      // Recreate config file for each test (in case migration corrupted it)
      const testConfig = {
        version: '2.0',
        backend: 'github',
        github: {
          repository: 'test/repo',
        },
        repositories: [
          {
            name: 'test-beads',
            path: join(testDir, '.beads'),
          },
        ],
        mappingStoragePath: join(testDir, '.beads-bridge'),
      };

      await writeFile(
        join(testDir, 'config.json'),
        JSON.stringify(testConfig, null, 2)
      );
    });

    const commandsRequiringAuth = [
      {
        args: ['status', '-r', 'test/repo', '-i', '123'],
        name: 'status',
      },
      {
        args: ['sync', '-r', 'test/repo', '-i', '123'],
        name: 'sync',
      },
      {
        args: ['diagram', '-r', 'test/repo', '-i', '123'],
        name: 'diagram',
      },
      {
        args: ['mapping', 'get', '-r', 'test/repo', '-i', '123'],
        name: 'mapping get',
      },
      {
        args: ['mapping', 'create', '-r', 'test/repo', '-i', '123', '-e', '["epic-1"]'],
        name: 'mapping create',
      },
      {
        args: ['decompose', '-r', 'test/repo', '-i', '123'],
        name: 'decompose',
      },
      {
        args: ['force-sync', '-r', 'test/repo', '-i', '123'],
        name: 'force-sync',
      },
    ];

    commandsRequiringAuth.forEach(({ args, name }) => {
      it(`should block '${name}' when not authenticated`, async () => {
        const result = await execFileAsync('node', [
          'dist/cli.js',
          '-c',
          join(testDir, 'config.json'),
          ...args,
        ]).catch((error) => error);

        // Command should fail
        expect(result.code).toBe(1);

        // Should show authentication error
        const stderr = result.stderr || '';
        const stdout = result.stdout || '';
        const output = stderr + stdout;

        expect(output).toMatch(/not authenticated/i);
        expect(output).toMatch(/beads-bridge auth/i);
      });
    });

    it('should show helpful error message for unauthenticated status command', async () => {
      const result = await execFileAsync('node', [
        'dist/cli.js',
        '-c',
        join(testDir, 'config.json'),
        'status',
        '-r',
        'test/repo',
        '-i',
        '123',
      ]).catch((error) => error);

      const stderr = result.stderr || '';
      const stdout = result.stdout || '';
      const output = stderr + stdout;

      // Should mention how to authenticate
      expect(output).toMatch(/beads-bridge auth github/i);
    });
  });

  describe('Authenticated flow', () => {
    beforeAll(async () => {
      // Set up mock credentials
      const store = new CredentialStore();
      await store.save({
        github: {
          token: 'test-token-123',
          scopes: ['repo', 'read:org', 'read:project'],
        },
      });
    });

    afterAll(async () => {
      // Clean up credentials
      const store = new CredentialStore();
      await store.clear();
    });

    it('should allow status command when authenticated', async () => {
      // This will fail due to invalid token/repo, but should pass auth check
      const result = await execFileAsync('node', [
        'dist/cli.js',
        '-c',
        join(testDir, 'config.json'),
        'status',
        '-r',
        'test/repo',
        '-i',
        '123',
      ], { env: process.env }).catch((error) => error);

      // Should not fail with auth error
      const stderr = result.stderr || '';
      const stdout = result.stdout || '';
      const output = stderr + stdout;

      // Should NOT have auth error (may have other errors due to test setup)
      expect(output).not.toMatch(/not authenticated.*github/i);
    });

    it('should allow sync command when authenticated', async () => {
      const result = await execFileAsync('node', [
        'dist/cli.js',
        '-c',
        join(testDir, 'config.json'),
        'sync',
        '-r',
        'test/repo',
        '-i',
        '123',
      ], { env: process.env }).catch((error) => error);

      const stderr = result.stderr || '';
      const stdout = result.stdout || '';
      const output = stderr + stdout;

      // Should NOT have auth error
      expect(output).not.toMatch(/not authenticated.*github/i);
    });

    it('should allow diagram command when authenticated', async () => {
      const result = await execFileAsync('node', [
        'dist/cli.js',
        '-c',
        join(testDir, 'config.json'),
        'diagram',
        '-r',
        'test/repo',
        '-i',
        '123',
      ], { env: process.env }).catch((error) => error);

      const stderr = result.stderr || '';
      const stdout = result.stdout || '';
      const output = stderr + stdout;

      // Should NOT have auth error
      expect(output).not.toMatch(/not authenticated.*github/i);
    });

    it('should allow mapping get command when authenticated', async () => {
      const result = await execFileAsync('node', [
        'dist/cli.js',
        '-c',
        join(testDir, 'config.json'),
        'mapping',
        'get',
        '-r',
        'test/repo',
        '-i',
        '123',
      ], { env: process.env }).catch((error) => error);

      const stderr = result.stderr || '';
      const stdout = result.stdout || '';
      const output = stderr + stdout;

      // Should NOT have auth error
      expect(output).not.toMatch(/not authenticated.*github/i);
    });

    it('should allow mapping create command when authenticated', async () => {
      const result = await execFileAsync('node', [
        'dist/cli.js',
        '-c',
        join(testDir, 'config.json'),
        'mapping',
        'create',
        '-r',
        'test/repo',
        '-i',
        '123',
        '-e',
        '["epic-1"]',
      ], { env: process.env }).catch((error) => error);

      const stderr = result.stderr || '';
      const stdout = result.stdout || '';
      const output = stderr + stdout;

      // Should NOT have auth error
      expect(output).not.toMatch(/not authenticated.*github/i);
    });

    it('should allow decompose command when authenticated', async () => {
      const result = await execFileAsync('node', [
        'dist/cli.js',
        '-c',
        join(testDir, 'config.json'),
        'decompose',
        '-r',
        'test/repo',
        '-i',
        '123',
      ], { env: process.env }).catch((error) => error);

      const stderr = result.stderr || '';
      const stdout = result.stdout || '';
      const output = stderr + stdout;

      // Should NOT have auth error
      expect(output).not.toMatch(/not authenticated.*github/i);
    });

    it('should allow force-sync command when authenticated', async () => {
      const result = await execFileAsync('node', [
        'dist/cli.js',
        '-c',
        join(testDir, 'config.json'),
        'force-sync',
        '-r',
        'test/repo',
        '-i',
        '123',
      ], { env: process.env }).catch((error) => error);

      const stderr = result.stderr || '';
      const stdout = result.stdout || '';
      const output = stderr + stdout;

      // Should NOT have auth error
      expect(output).not.toMatch(/not authenticated.*github/i);
    });
  });

  describe('Auth commands', () => {
    it('should not require auth for auth status command', async () => {
      // Clear any existing credentials
      const store = new CredentialStore();
      await store.clear();

      const result = await execFileAsync('node', [
        'dist/cli.js',
        'auth',
        'status',
      ]).catch((error) => error);

      // Should execute successfully (exit code 0 or normal execution)
      const stderr = result.stderr || '';
      const stdout = result.stdout || '';
      const output = stderr + stdout;

      // Should show status, not require auth
      expect(output).toMatch(/Authentication Status/i);
      expect(output).toMatch(/GitHub.*not authenticated/i);

      // Should not block with "Not authenticated with" error message
      // (it's OK to show "Run: beads-bridge auth" as helpful hint)
      expect(output).not.toMatch(/Not authenticated with github/i);
    });

    it('should not require auth for auth clear command', async () => {
      const result = await execFileAsync('node', [
        'dist/cli.js',
        'auth',
        'clear',
        '--confirm',
      ]).catch((error) => error);

      const stderr = result.stderr || '';
      const stdout = result.stdout || '';
      const output = stderr + stdout;

      // Should execute successfully
      expect(output).toMatch(/credentials cleared/i);

      // Should not block with auth required error
      expect(output).not.toMatch(/not authenticated/i);
    });

    it('should not require auth for auth github help', async () => {
      const result = await execFileAsync('node', [
        'dist/cli.js',
        'auth',
        'github',
        '--help',
      ]).catch((error) => error);

      const stderr = result.stderr || '';
      const stdout = result.stdout || '';
      const output = stderr + stdout;

      // Should show help
      expect(output).toMatch(/Authenticate with GitHub/i);

      // Should not block with auth required error
      expect(output).not.toMatch(/not authenticated/i);
    });

    it('should not require auth for auth shortcut help', async () => {
      const result = await execFileAsync('node', [
        'dist/cli.js',
        'auth',
        'shortcut',
        '--help',
      ]).catch((error) => error);

      const stderr = result.stderr || '';
      const stdout = result.stdout || '';
      const output = stderr + stdout;

      // Should show help
      expect(output).toMatch(/Authenticate with Shortcut/i);

      // Should not block with auth required error
      expect(output).not.toMatch(/not authenticated/i);
    });
  });

  describe('Help commands', () => {
    it('should not require auth for main help', async () => {
      const result = await execFileAsync('node', [
        'dist/cli.js',
        '--help',
      ]).catch((error) => error);

      const stderr = result.stderr || '';
      const stdout = result.stdout || '';
      const output = stderr + stdout;

      // Should show help
      expect(output).toMatch(/beads-bridge/i);
      expect(output).toMatch(/Commands:/i);

      // Should not block with auth required error
      expect(output).not.toMatch(/not authenticated/i);
    });

    it('should not require auth for command help', async () => {
      const result = await execFileAsync('node', [
        'dist/cli.js',
        'status',
        '--help',
      ]).catch((error) => error);

      const stderr = result.stderr || '';
      const stdout = result.stdout || '';
      const output = stderr + stdout;

      // Should show help
      expect(output).toMatch(/Query aggregated status/i);

      // Should not block with auth required error
      expect(output).not.toMatch(/not authenticated/i);
    });
  });

  describe('Error messages', () => {
    beforeAll(async () => {
      // Clear credentials
      const store = new CredentialStore();
      await store.clear();
    });

    beforeEach(async () => {
      // Recreate config file for each test (in case migration corrupted it)
      const testConfig = {
        version: '2.0',
        backend: 'github',
        github: {
          repository: 'test/repo',
        },
        repositories: [
          {
            name: 'test-beads',
            path: join(testDir, '.beads'),
          },
        ],
        mappingStoragePath: join(testDir, '.beads-bridge'),
      };

      await writeFile(
        join(testDir, 'config.json'),
        JSON.stringify(testConfig, null, 2)
      );
    });

    it('should provide clear instructions when not authenticated', async () => {
      const result = await execFileAsync('node', [
        'dist/cli.js',
        '-c',
        join(testDir, 'config.json'),
        'status',
        '-r',
        'test/repo',
        '-i',
        '123',
      ]).catch((error) => error);

      const stderr = result.stderr || '';
      const stdout = result.stdout || '';
      const output = stderr + stdout;

      // Should tell user how to authenticate
      expect(output).toMatch(/beads-bridge auth github/i);

      // Should be clear about the problem
      expect(output).toMatch(/not authenticated/i);
    });

    it('should indicate which backend needs authentication', async () => {
      const result = await execFileAsync('node', [
        'dist/cli.js',
        '-c',
        join(testDir, 'config.json'),
        'sync',
        '-r',
        'test/repo',
        '-i',
        '123',
      ]).catch((error) => error);

      const stderr = result.stderr || '';
      const stdout = result.stdout || '';
      const output = stderr + stdout;

      // Should mention github since that's the backend in test config
      expect(output).toMatch(/github/i);
    });
  });
});
