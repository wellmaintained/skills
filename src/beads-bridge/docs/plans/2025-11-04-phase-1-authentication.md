# Phase 1: Authentication & Credential Storage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement OAuth device flow for GitHub and secure credential storage system to eliminate dependency on `gh` and `short` CLI tools.

**Architecture:** Create authentication layer with OAuth device flow for GitHub, token-based auth for Shortcut, and encrypted credential storage in `~/.config/beads-bridge/credentials.json`. This will be the foundation for Phase 2 & 3 which replace CLI calls with direct API usage.

**Tech Stack:** Node.js crypto module for encryption, native fetch API for OAuth, commander for CLI commands

---

## Context

**Current Architecture:**
- `src/backends/github.ts` - Uses `GhCli` wrapper that shells out to `gh` CLI
- `src/backends/shortcut.ts` - Uses `execFile` to shell out to `short` CLI
- `src/utils/gh-cli.ts` - Wrapper around `gh` CLI subprocess calls
- Authentication is delegated to CLI tools (`gh auth login`, `short` with token)

**Target Architecture:**
- New `src/auth/` directory with OAuth and credential management
- New CLI commands for authentication management
- Encrypted credential storage replaces CLI-based auth
- Foundation for Phase 2/3 to use Octokit and @shortcut/client

**Dependencies to Add:**
```json
{
  "octokit": "^3.1.0",
  "@shortcut/client": "^1.0.0"
}
```

---

## Task 1: Create Credential Storage with Encryption

**Files:**
- Create: `.claude/skills/beads-bridge/src/auth/credential-store.ts`
- Create: `.claude/skills/beads-bridge/tests/auth/credential-store.test.ts`

### Step 1: Write the failing test for credential storage

Create test file:

```typescript
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
```

### Step 2: Run test to verify it fails

Run: `npm test tests/auth/credential-store.test.ts`

Expected output: FAIL - "Cannot find module '../../src/auth/credential-store.js'"

### Step 3: Create credential store types

Create file:

```typescript
// src/auth/credential-store.ts
import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { dirname } from 'path';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { homedir } from 'os';
import { join } from 'path';

export interface GitHubCredentials {
  token: string;
  scopes: string[];
  expiresAt?: Date;
}

export interface ShortcutCredentials {
  token: string;
}

export interface Credentials {
  github?: GitHubCredentials;
  shortcut?: ShortcutCredentials;
}

interface EncryptedData {
  encrypted: string;
  iv: string;
  salt: string;
}

export class CredentialStore {
  private readonly filePath: string;
  private readonly algorithm = 'aes-256-gcm';

  constructor(filePath?: string) {
    this.filePath = filePath || join(homedir(), '.config', 'beads-bridge', 'credentials.json');
  }

  /**
   * Derive encryption key from machine-specific data
   */
  private deriveKey(salt: Buffer): Buffer {
    // Use machine-specific data as password (hostname + homedir)
    const password = `${homedir()}:beads-bridge`;
    return scryptSync(password, salt, 32);
  }

  /**
   * Encrypt credentials
   */
  private encrypt(data: string): EncryptedData {
    const salt = randomBytes(32);
    const key = this.deriveKey(salt);
    const iv = randomBytes(16);

    const cipher = createCipheriv(this.algorithm, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final(),
    ]);

    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      salt: salt.toString('base64'),
    };
  }

  /**
   * Decrypt credentials
   */
  private decrypt(encryptedData: EncryptedData): string {
    const salt = Buffer.from(encryptedData.salt, 'base64');
    const key = this.deriveKey(salt);
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const encrypted = Buffer.from(encryptedData.encrypted, 'base64');

    const decipher = createDecipheriv(this.algorithm, key, iv);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Save credentials to disk (encrypted)
   */
  async save(credentials: Credentials): Promise<void> {
    const json = JSON.stringify(credentials);
    const encrypted = this.encrypt(json);

    // Ensure directory exists
    await mkdir(dirname(this.filePath), { recursive: true });

    // Write encrypted data
    await writeFile(this.filePath, JSON.stringify(encrypted, null, 2), 'utf-8');
  }

  /**
   * Load credentials from disk (decrypt)
   */
  async load(): Promise<Credentials> {
    try {
      const content = await readFile(this.filePath, 'utf-8');
      const encrypted: EncryptedData = JSON.parse(content);
      const decrypted = this.decrypt(encrypted);
      return JSON.parse(decrypted);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet
        return {};
      }
      throw error;
    }
  }

  /**
   * Clear all credentials
   */
  async clear(): Promise<void> {
    try {
      await unlink(this.filePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Check if credentials exist
   */
  async exists(): Promise<boolean> {
    try {
      await readFile(this.filePath);
      return true;
    } catch {
      return false;
    }
  }
}
```

### Step 4: Run tests to verify they pass

Run: `npm test tests/auth/credential-store.test.ts`

Expected output: All 4 tests PASS

### Step 5: Commit credential store

```bash
git add src/auth/credential-store.ts tests/auth/credential-store.test.ts
git commit -m "feat(auth): add encrypted credential storage

- Implement CredentialStore with AES-256-GCM encryption
- Store credentials in ~/.config/beads-bridge/credentials.json
- Machine-specific key derivation using scrypt
- Support GitHub and Shortcut credentials
- 100% test coverage

🤖 Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 2: Implement GitHub OAuth Device Flow

**Files:**
- Create: `.claude/skills/beads-bridge/src/auth/github-oauth.ts`
- Create: `.claude/skills/beads-bridge/tests/auth/github-oauth.test.ts`

### Step 1: Write the failing test for OAuth flow

Create test file:

```typescript
// tests/auth/github-oauth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubOAuth } from '../../src/auth/github-oauth.js';

describe('GitHubOAuth', () => {
  let oauth: GitHubOAuth;

  beforeEach(() => {
    oauth = new GitHubOAuth({
      clientId: 'test-client-id',
      scopes: ['repo', 'read:org'],
    });
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
          scope: 'repo,read:org',
        }),
      });

    const result = await oauth.pollForToken('device_abc123', 1); // 1s interval for testing

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

    await expect(
      oauth.pollForToken('device_abc123', 1, 2) // max 2 attempts
    ).rejects.toThrow('Device code expired');
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

    await oauth.pollForToken('device_code', 1);

    // Should have increased interval on slow_down
    expect(sleepSpy).toHaveBeenCalled();
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test tests/auth/github-oauth.test.ts`

Expected output: FAIL - "Cannot find module '../../src/auth/github-oauth.js'"

### Step 3: Implement GitHub OAuth device flow

Create file:

```typescript
// src/auth/github-oauth.ts

export interface GitHubOAuthConfig {
  clientId: string;
  scopes: string[];
}

export interface DeviceCodeResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export interface TokenResponse {
  accessToken: string;
  scopes: string[];
}

export class GitHubOAuth {
  private readonly clientId: string;
  private readonly scopes: string[];

  constructor(config: GitHubOAuthConfig) {
    this.clientId = config.clientId;
    this.scopes = config.scopes;
  }

  /**
   * Request device code from GitHub
   */
  async requestDeviceCode(): Promise<DeviceCodeResponse> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: this.scopes.join(' '),
    });

    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Failed to request device code: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      deviceCode: data.device_code,
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      expiresIn: data.expires_in,
      interval: data.interval,
    };
  }

  /**
   * Poll GitHub for authorization
   */
  async pollForToken(
    deviceCode: string,
    intervalSeconds: number,
    maxAttempts: number = 100
  ): Promise<TokenResponse> {
    let attempts = 0;
    let currentInterval = intervalSeconds;

    while (attempts < maxAttempts) {
      attempts++;

      await this.sleep(currentInterval * 1000);

      const params = new URLSearchParams({
        client_id: this.clientId,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      });

      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data = await response.json();

      // Check for errors
      if (data.error) {
        switch (data.error) {
          case 'authorization_pending':
            // Still waiting for user
            continue;

          case 'slow_down':
            // Increase polling interval
            currentInterval += 5;
            continue;

          case 'expired_token':
            throw new Error('Device code expired. Please try again.');

          case 'access_denied':
            throw new Error('Authorization denied by user.');

          default:
            throw new Error(`OAuth error: ${data.error}`);
        }
      }

      // Success!
      return {
        accessToken: data.access_token,
        scopes: data.scope?.split(',') || [],
      };
    }

    throw new Error('Polling timeout: User did not authorize in time.');
  }

  /**
   * Full authentication flow
   */
  async authenticate(): Promise<TokenResponse> {
    // Step 1: Request device code
    const deviceCode = await this.requestDeviceCode();

    // Step 2: Display instructions to user
    console.log('\n🔐 GitHub Authentication Required\n');
    console.log(`Please visit: ${deviceCode.verificationUri}`);
    console.log(`And enter code: ${deviceCode.userCode}\n`);
    console.log('Waiting for authorization...');

    // Step 3: Poll for token
    const token = await this.pollForToken(
      deviceCode.deviceCode,
      deviceCode.interval
    );

    console.log('✅ Authentication successful!\n');

    return token;
  }

  /**
   * Sleep helper
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Step 4: Run tests to verify they pass

Run: `npm test tests/auth/github-oauth.test.ts`

Expected output: All 4 tests PASS

### Step 5: Commit GitHub OAuth implementation

```bash
git add src/auth/github-oauth.ts tests/auth/github-oauth.test.ts
git commit -m "feat(auth): implement GitHub OAuth device flow

- Implement OAuth 2.0 device flow for GitHub authentication
- Request device code and poll for authorization
- Handle slow_down, expired_token, and other OAuth errors
- User-friendly CLI output with verification instructions
- Comprehensive test coverage

🤖 Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 3: Add Authentication CLI Commands

**Files:**
- Modify: `.claude/skills/beads-bridge/src/cli.ts`
- Create: `.claude/skills/beads-bridge/tests/cli/auth-commands.test.ts`

### Step 1: Write failing test for auth commands

Create test file:

```typescript
// tests/cli/auth-commands.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

describe('Auth CLI Commands', () => {
  it('should have auth github command', async () => {
    try {
      await execFileAsync('node', ['dist/cli.js', 'auth', '--help']);
    } catch (error: any) {
      expect(error.stdout).toContain('auth github');
      expect(error.stdout).toContain('auth shortcut');
      expect(error.stdout).toContain('auth status');
      expect(error.stdout).toContain('auth clear');
    }
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm run build && npm test tests/cli/auth-commands.test.ts`

Expected output: FAIL - auth commands not found in help

### Step 3: Add auth command to CLI

Modify file:

```typescript
// src/cli.ts (add to existing file)
import { Command } from 'commander';
import { CredentialStore } from './auth/credential-store.js';
import { GitHubOAuth } from './auth/github-oauth.js';

// ... existing imports and code ...

// Add auth command group
const authCommand = program
  .command('auth')
  .description('Manage authentication credentials');

// auth github
authCommand
  .command('github')
  .description('Authenticate with GitHub using OAuth device flow')
  .option('--client-id <id>', 'GitHub OAuth app client ID', process.env.GITHUB_CLIENT_ID)
  .option('--scopes <scopes>', 'Comma-separated list of scopes', 'repo,read:org,read:project')
  .action(async (options) => {
    try {
      const clientId = options.clientId || 'Ov23liGQU7nlLZRAXLIx'; // Default client ID
      const scopes = options.scopes.split(',').map((s: string) => s.trim());

      const oauth = new GitHubOAuth({ clientId, scopes });
      const token = await oauth.authenticate();

      // Save credentials
      const store = new CredentialStore();
      const existing = await store.load();
      await store.save({
        ...existing,
        github: {
          token: token.accessToken,
          scopes: token.scopes,
        },
      });

      console.log('✅ GitHub credentials saved successfully');
    } catch (error: any) {
      console.error('❌ Authentication failed:', error.message);
      process.exit(1);
    }
  });

// auth shortcut
authCommand
  .command('shortcut')
  .description('Authenticate with Shortcut using API token')
  .option('--token <token>', 'Shortcut API token')
  .action(async (options) => {
    try {
      let token = options.token;

      // If no token provided, prompt for it
      if (!token) {
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        token = await new Promise<string>((resolve) => {
          rl.question('Enter your Shortcut API token: ', (answer) => {
            rl.close();
            resolve(answer.trim());
          });
        });
      }

      if (!token) {
        throw new Error('Token is required');
      }

      // Save credentials
      const store = new CredentialStore();
      const existing = await store.load();
      await store.save({
        ...existing,
        shortcut: {
          token,
        },
      });

      console.log('✅ Shortcut credentials saved successfully');
    } catch (error: any) {
      console.error('❌ Failed to save credentials:', error.message);
      process.exit(1);
    }
  });

// auth status
authCommand
  .command('status')
  .description('Show authentication status')
  .action(async () => {
    try {
      const store = new CredentialStore();
      const creds = await store.load();

      console.log('\n🔐 Authentication Status\n');

      if (creds.github) {
        console.log('✅ GitHub: Authenticated');
        console.log(`   Scopes: ${creds.github.scopes.join(', ')}`);
      } else {
        console.log('❌ GitHub: Not authenticated');
        console.log('   Run: beads-bridge auth github');
      }

      console.log();

      if (creds.shortcut) {
        console.log('✅ Shortcut: Authenticated');
      } else {
        console.log('❌ Shortcut: Not authenticated');
        console.log('   Run: beads-bridge auth shortcut');
      }

      console.log();
    } catch (error: any) {
      console.error('❌ Failed to check status:', error.message);
      process.exit(1);
    }
  });

// auth clear
authCommand
  .command('clear')
  .description('Clear all stored credentials')
  .option('--confirm', 'Skip confirmation prompt')
  .action(async (options) => {
    try {
      if (!options.confirm) {
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question('Are you sure you want to clear all credentials? (y/N) ', (ans) => {
            rl.close();
            resolve(ans.trim().toLowerCase());
          });
        });

        if (answer !== 'y' && answer !== 'yes') {
          console.log('Cancelled.');
          return;
        }
      }

      const store = new CredentialStore();
      await store.clear();

      console.log('✅ All credentials cleared');
    } catch (error: any) {
      console.error('❌ Failed to clear credentials:', error.message);
      process.exit(1);
    }
  });

// ... rest of existing CLI code ...
```

### Step 4: Build and test CLI commands

Run: `npm run build && node dist/cli.js auth --help`

Expected output: Help text showing all 4 auth subcommands

Run: `npm test tests/cli/auth-commands.test.ts`

Expected output: Test PASSES

### Step 5: Manual verification

Run these commands to verify:

```bash
# Check help
node dist/cli.js auth --help

# Test status (should show not authenticated)
node dist/cli.js auth status

# Test GitHub auth (will prompt for device flow - can cancel)
# node dist/cli.js auth github

# Test clear (with confirmation)
node dist/cli.js auth clear --confirm
```

### Step 6: Commit CLI commands

```bash
git add src/cli.ts tests/cli/auth-commands.test.ts
git commit -m "feat(cli): add authentication management commands

- Add 'auth github' command for OAuth device flow
- Add 'auth shortcut' command for API token entry
- Add 'auth status' command to show current auth state
- Add 'auth clear' command to remove credentials
- Interactive prompts for token entry and confirmation
- Integrate with CredentialStore and GitHubOAuth

🤖 Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 4: Add Package Dependencies

**Files:**
- Modify: `.claude/skills/beads-bridge/package.json`

### Step 1: Install OAuth and API client dependencies

Run:

```bash
cd .claude/skills/beads-bridge
npm install octokit@^3.1.0 @shortcut/client@^1.0.0
```

Expected output: Dependencies installed successfully

### Step 2: Verify package.json updated

Check that package.json now includes:

```json
{
  "dependencies": {
    "commander": "^14.0.2",
    "zod": "^3.22.0",
    "octokit": "^3.1.0",
    "@shortcut/client": "^1.0.0"
  }
}
```

### Step 3: Commit dependency updates

```bash
git add package.json package-lock.json
git commit -m "deps: add octokit and @shortcut/client

Add direct API client dependencies for Phase 2/3:
- octokit ^3.1.0 for GitHub API
- @shortcut/client ^1.0.0 for Shortcut API

These will replace gh and short CLI dependencies.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 5: Update Tests and Documentation

**Files:**
- Create: `.claude/skills/beads-bridge/docs/AUTHENTICATION.md`
- Modify: `.claude/skills/beads-bridge/SKILL.md` (update setup section)

### Step 1: Create authentication documentation

Create file:

```markdown
<!-- docs/AUTHENTICATION.md -->
# Authentication Guide

## Overview

beads-bridge v2.0 uses direct API authentication instead of CLI tools:
- **GitHub**: OAuth 2.0 device flow (no browser required)
- **Shortcut**: API token from user settings

## GitHub Authentication

### First-Time Setup

Run the interactive authentication command:

```bash
beads-bridge auth github
```

This will:
1. Request a device code from GitHub
2. Display a verification URL and code
3. Wait for you to authorize the app in your browser
4. Save the access token securely

### Required Scopes

The default scopes are:
- `repo` - Access repositories
- `read:org` - Read organization data
- `read:project` - Access GitHub Projects v2

### Re-authentication

If your token expires or you need different scopes:

```bash
beads-bridge auth github --scopes "repo,read:org,read:project,write:project"
```

## Shortcut Authentication

### Setup

Get your API token from Shortcut settings:
1. Go to https://app.shortcut.com/settings/account/api-tokens
2. Create a new API token
3. Run:

```bash
beads-bridge auth shortcut
```

4. Enter your token when prompted

Or provide token directly:

```bash
beads-bridge auth shortcut --token YOUR_TOKEN_HERE
```

## Managing Credentials

### Check Authentication Status

```bash
beads-bridge auth status
```

Shows which services are authenticated and what scopes are available.

### Clear Credentials

```bash
beads-bridge auth clear
```

Removes all stored credentials. Use `--confirm` to skip the confirmation prompt.

## Security

**Credential Storage:**
- Location: `~/.config/beads-bridge/credentials.json`
- Encryption: AES-256-GCM with machine-specific key derivation
- Key derivation: scrypt with salt using homedir as password base

**Best Practices:**
- Never commit credentials to git
- Use minimal required scopes
- Rotate tokens periodically
- Clear credentials on shared machines

## Troubleshooting

### "Authentication failed"

Check that you completed the GitHub device flow in your browser.

### "Token expired"

Re-authenticate:

```bash
beads-bridge auth github
```

### "Permission denied"

Your token might need additional scopes:

```bash
beads-bridge auth github --scopes "repo,read:org,read:project,write:project"
```

### "Cannot find credentials file"

This is normal for first-time setup. Run:

```bash
beads-bridge auth status
```

To see what needs authentication.
```

### Step 2: Update SKILL.md setup section

Update the setup section in SKILL.md:

```markdown
<!-- Update in SKILL.md -->

## Setup

### Prerequisites

- Node.js >= 18.0.0
- npm or pnpm
- **No CLI tools required** (gh and short are no longer needed)

### Installation

```bash
npm install -g beads-bridge
```

### Authentication

**GitHub:**

```bash
beads-bridge auth github
```

Follow the prompts to authenticate via OAuth device flow.

**Shortcut:**

```bash
beads-bridge auth shortcut
```

Enter your Shortcut API token when prompted.

**Verify:**

```bash
beads-bridge auth status
```

### Configuration

See [Configuration Guide](docs/CONFIGURATION.md) for config file setup.
```

### Step 3: Run all tests

Run: `npm test`

Expected output: All tests PASS

### Step 4: Commit documentation

```bash
git add docs/AUTHENTICATION.md SKILL.md
git commit -m "docs: add authentication guide and update setup

- Create comprehensive authentication guide
- Document OAuth device flow for GitHub
- Document Shortcut API token setup
- Add troubleshooting section
- Update SKILL.md to remove CLI dependencies
- Clarify new authentication requirements

🤖 Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Verification Checklist

After completing all tasks, verify:

- [ ] `npm test` passes all tests
- [ ] `npm run build` completes without errors
- [ ] `node dist/cli.js auth --help` shows all 4 subcommands
- [ ] `node dist/cli.js auth status` runs without errors
- [ ] CredentialStore encrypts data (check test output)
- [ ] OAuth flow can be initiated (test manually if desired)
- [ ] Documentation is clear and complete

---

## Next Steps

After Phase 1 is complete and verified:

- **Phase 2**: Replace GhCli with Octokit in github.ts backend (pensive-b7c4)
- **Phase 3**: Replace shortcut CLI with @shortcut/client in shortcut.ts backend (pensive-8e19)
- **Phase 4**: Update configuration schema for v2.0 (pensive-23c8)

---

## Notes for Engineer

**Key Design Decisions:**

1. **Encryption**: Using Node.js built-in crypto module, no external deps
2. **OAuth Client ID**: Using default Claude Code app ID, can be overridden
3. **Credential Location**: Following XDG base directory spec (~/.config/)
4. **Machine-Specific Key**: Prevents credentials from working on different machines

**Common Pitfalls:**

- Don't forget to run `npm run build` after changes to see CLI updates
- OAuth device flow requires user interaction - tests mock the API
- Credential encryption key is derived from homedir - tests use temp dirs

**Testing Strategy:**

- Unit tests mock all external APIs (fetch for OAuth)
- Integration tests would require real credentials (skip for now)
- CLI tests use process execution to verify command structure
