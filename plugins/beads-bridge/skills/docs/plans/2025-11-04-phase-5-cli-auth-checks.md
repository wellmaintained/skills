# Phase 5: CLI Command Updates with Authentication Checks

**Related Bead**: pensive-b7c4 (Phase 5/9)
**Date**: 2025-11-04
**Status**: Ready for implementation

## Overview

This phase updates the CLI commands to properly check authentication before executing operations that require backend access. With the migration to native SDKs (Octokit and @shortcut/client), we need to ensure all commands that interact with backends verify credentials are available before attempting operations.

## Current State

The CLI has authentication commands already implemented:
- `auth github`: OAuth device flow
- `auth shortcut`: API token prompt
- `auth status`: Show authentication status
- `auth clear`: Clear stored credentials

However, commands that require authentication currently don't check for valid credentials before attempting backend operations, leading to unclear error messages.

## Goals

1. Add authentication verification wrapper for commands
2. Update all backend-dependent commands to check auth
3. Improve error messages with actionable guidance
4. Maintain backward compatibility with existing command behavior
5. Add tests for authentication flow

## Architecture Changes

### Auth Wrapper Pattern

```typescript
// src/cli/auth-wrapper.ts
async function withAuth(
  backendType: BackendType,
  operation: () => Promise<void>
): Promise<void> {
  const credStore = new CredentialStore();
  const hasAuth = await credStore.hasCredentials(backendType);

  if (!hasAuth) {
    console.error(`❌ Not authenticated with ${backendType}`);
    console.error(`Run: beads-bridge auth ${backendType}`);
    process.exit(1);
  }

  await operation();
}
```

### Commands Requiring Auth

From `src/cli.ts`, these commands need auth checks:
- `status` (lines 60-73): Query aggregated status
- `sync` (lines 75-88): Post progress update
- `diagram` (lines 90-110): Generate Mermaid diagrams
- `discoveries` (lines 112-125): Detect newly discovered work
- `mapping get` (lines 136-148): Get mapping by bead ID
- `mapping create` (lines 150-163): Create new mapping
- `decompose` (lines 165-184): Decompose issue into epic
- `force-sync` (lines 186-197): Force immediate sync

## Implementation Tasks

### Task 1: Create Auth Wrapper Module

**File**: `src/cli/auth-wrapper.ts` (new file)

Create a reusable authentication wrapper that:
- Checks if credentials exist for the specified backend
- Provides clear error messages with next steps
- Exits gracefully if not authenticated
- Allows operation to proceed if authenticated

**Implementation**:

```typescript
import { BackendType } from '../types/config.js';
import { CredentialStore } from '../auth/credential-store.js';

/**
 * Wraps a CLI operation that requires authentication.
 * Checks for valid credentials before executing the operation.
 *
 * @param backendType - The backend type to check authentication for
 * @param operation - The async operation to execute if authenticated
 */
export async function withAuth(
  backendType: BackendType,
  operation: () => Promise<void>
): Promise<void> {
  const credStore = new CredentialStore();

  try {
    const hasAuth = await credStore.hasCredentials(backendType);

    if (!hasAuth) {
      console.error(`\n❌ Not authenticated with ${backendType}`);
      console.error(`\nTo authenticate, run:`);
      console.error(`  beads-bridge auth ${backendType}\n`);
      process.exit(1);
    }

    await operation();
  } catch (error) {
    if (error instanceof Error && error.message.includes('credentials')) {
      console.error(`\n❌ Authentication error: ${error.message}`);
      console.error(`\nTo re-authenticate, run:`);
      console.error(`  beads-bridge auth ${backendType}\n`);
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Gets the backend type from the loaded config.
 * Used by commands that need to determine which backend to authenticate against.
 *
 * @param configPath - Optional path to config file
 * @returns The backend type from the config
 */
export async function getBackendFromConfig(configPath?: string): Promise<BackendType> {
  const { ConfigManager } = await import('../config/config-manager.js');
  const manager = new ConfigManager();
  const config = await manager.loadConfig(configPath);
  return config.backend;
}
```

**Test File**: `tests/cli/auth-wrapper.test.ts`

```typescript
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
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
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

      await withAuth('github', operation);

      expect(mockHasCredentials).toHaveBeenCalledWith('github');
      expect(operation).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Not authenticated with github'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('beads-bridge auth github'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle credential errors during operation', async () => {
      const mockHasCredentials = vi.fn().mockResolvedValue(true);
      vi.mocked(CredentialStore).mockImplementation(() => ({
        hasCredentials: mockHasCredentials,
      } as any));

      const credError = new Error('Invalid credentials');
      const operation = vi.fn().mockRejectedValue(credError);

      await expect(withAuth('github', operation)).rejects.toThrow('Invalid credentials');
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should provide helpful error for credential-related errors', async () => {
      const mockHasCredentials = vi.fn().mockResolvedValue(true);
      vi.mocked(CredentialStore).mockImplementation(() => ({
        hasCredentials: mockHasCredentials,
      } as any));

      const credError = new Error('Failed to load credentials from store');
      const operation = vi.fn().mockRejectedValue(credError);

      await withAuth('shortcut', operation);

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
      const mockConfig = { backend: 'github' as const };
      const mockLoadConfig = vi.fn().mockResolvedValue(mockConfig);
      vi.mocked(ConfigManager).mockImplementation(() => ({
        loadConfig: mockLoadConfig,
      } as any));

      const backend = await getBackendFromConfig();

      expect(backend).toBe('github');
      expect(mockLoadConfig).toHaveBeenCalledWith(undefined);
    });

    it('should pass config path to loadConfig', async () => {
      const mockConfig = { backend: 'shortcut' as const };
      const mockLoadConfig = vi.fn().mockResolvedValue(mockConfig);
      vi.mocked(ConfigManager).mockImplementation(() => ({
        loadConfig: mockLoadConfig,
      } as any));

      const backend = await getBackendFromConfig('/custom/path/config.json');

      expect(backend).toBe('shortcut');
      expect(mockLoadConfig).toHaveBeenCalledWith('/custom/path/config.json');
    });
  });
});
```

**Success Criteria**:
- ✅ `withAuth` checks credentials before executing operation
- ✅ Provides clear error messages with authentication commands
- ✅ Exits gracefully (process.exit(1)) when not authenticated
- ✅ Allows operation to proceed when authenticated
- ✅ Handles credential errors during operation execution
- ✅ `getBackendFromConfig` correctly loads backend type from config
- ✅ All tests pass with `npm test -- --run`

**Dependencies**: None (first task)

**Estimated Time**: 30 minutes

---

### Task 2: Update Status Command

**File**: `src/cli.ts` (lines 60-73)

Update the `status` command to check authentication before querying status.

**Changes**:

```typescript
// Add import at top of file
import { withAuth, getBackendFromConfig } from './cli/auth-wrapper.js';

// Update status command (around line 60)
program
  .command('status')
  .description('Query aggregated status of beads and backend issues')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    const backend = await getBackendFromConfig(options.config);

    await withAuth(backend, async () => {
      await executeCapability('status', {
        config: options.config,
      });
    });
  });
```

**Test Updates**: Update `tests/cli/status.test.ts` (if exists) or add to integration tests

```typescript
// Add to existing test suite
describe('status command with auth', () => {
  it('should check authentication before executing', async () => {
    // Mock credentials don't exist
    const mockHasCredentials = vi.fn().mockResolvedValue(false);
    vi.mocked(CredentialStore).mockImplementation(() => ({
      hasCredentials: mockHasCredentials,
    } as any));

    // Execute command
    await execCli(['status']);

    // Should exit without calling executeCapability
    expect(mockHasCredentials).toHaveBeenCalled();
    expect(mockExecuteCapability).not.toHaveBeenCalled();
  });

  it('should execute when authenticated', async () => {
    // Mock credentials exist
    const mockHasCredentials = vi.fn().mockResolvedValue(true);
    vi.mocked(CredentialStore).mockImplementation(() => ({
      hasCredentials: mockHasCredentials,
    } as any));

    const mockExecuteCapability = vi.fn().mockResolvedValue({ success: true });

    // Execute command
    await execCli(['status']);

    expect(mockExecuteCapability).toHaveBeenCalledWith('status', expect.any(Object));
  });
});
```

**Success Criteria**:
- ✅ Command checks authentication before executing
- ✅ Shows helpful error message when not authenticated
- ✅ Executes normally when authenticated
- ✅ Tests pass

**Dependencies**: Task 1 (auth wrapper)

**Estimated Time**: 15 minutes

---

### Task 3: Update Sync Command

**File**: `src/cli.ts` (lines 75-88)

Update the `sync` command to check authentication before syncing.

**Changes**:

```typescript
// Update sync command (around line 75)
program
  .command('sync')
  .description('Post progress update to backend')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-d, --dry-run', 'Preview changes without syncing')
  .option('-m, --message <message>', 'Sync message')
  .action(async (options) => {
    const backend = await getBackendFromConfig(options.config);

    await withAuth(backend, async () => {
      await executeCapability('sync', {
        config: options.config,
        dryRun: options.dryRun,
        message: options.message,
      });
    });
  });
```

**Test Updates**: Similar pattern to status command

**Success Criteria**:
- ✅ Command checks authentication before executing
- ✅ Shows helpful error message when not authenticated
- ✅ Executes normally when authenticated
- ✅ Tests pass

**Dependencies**: Task 1 (auth wrapper)

**Estimated Time**: 15 minutes

---

### Task 4: Update Diagram Command

**File**: `src/cli.ts` (lines 90-110)

Update the `diagram` command to check authentication before generating diagrams.

**Changes**:

```typescript
// Update diagram command (around line 90)
program
  .command('diagram')
  .description('Generate Mermaid diagram of issue dependencies')
  .argument('[issue-id]', 'Specific issue ID to diagram')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-o, --output <path>', 'Output file path (defaults to stdout)')
  .option('--max-nodes <number>', 'Maximum nodes to include', parseInt)
  .option('--no-legend', 'Exclude legend from diagram')
  .action(async (issueId, options) => {
    const backend = await getBackendFromConfig(options.config);

    await withAuth(backend, async () => {
      await executeCapability('diagram', {
        issueId,
        config: options.config,
        output: options.output,
        maxNodes: options.maxNodes,
        includeLegend: options.legend,
      });
    });
  });
```

**Test Updates**: Similar pattern to previous commands

**Success Criteria**:
- ✅ Command checks authentication before executing
- ✅ Shows helpful error message when not authenticated
- ✅ Executes normally when authenticated
- ✅ Tests pass

**Dependencies**: Task 1 (auth wrapper)

**Estimated Time**: 15 minutes

---

### Task 5: Update Discoveries Command

**File**: `src/cli.ts` (lines 112-125)

Update the `discoveries` command to check authentication before detecting work.

**Changes**:

```typescript
// Update discoveries command (around line 112)
program
  .command('discoveries')
  .description('Detect newly discovered work')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--notify', 'Send notifications about discoveries')
  .action(async (options) => {
    const backend = await getBackendFromConfig(options.config);

    await withAuth(backend, async () => {
      await executeCapability('discoveries', {
        config: options.config,
        notify: options.notify,
      });
    });
  });
```

**Test Updates**: Similar pattern to previous commands

**Success Criteria**:
- ✅ Command checks authentication before executing
- ✅ Shows helpful error message when not authenticated
- ✅ Executes normally when authenticated
- ✅ Tests pass

**Dependencies**: Task 1 (auth wrapper)

**Estimated Time**: 15 minutes

---

### Task 6: Update Mapping Commands

**File**: `src/cli.ts` (lines 127-163)

Update both `mapping get` and `mapping create` commands to check authentication.

**Changes**:

```typescript
// Update mapping command group (around line 127)
const mappingCmd = program
  .command('mapping')
  .description('Manage mappings between beads and backend issues');

// Update mapping get subcommand (around line 136)
mappingCmd
  .command('get')
  .description('Get mapping by bead ID')
  .argument('<bead-id>', 'Bead ID to look up')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (beadId, options) => {
    const backend = await getBackendFromConfig(options.config);

    await withAuth(backend, async () => {
      await executeCapability('mapping-get', {
        beadId,
        config: options.config,
      });
    });
  });

// Update mapping create subcommand (around line 150)
mappingCmd
  .command('create')
  .description('Create new mapping')
  .argument('<bead-id>', 'Bead ID')
  .argument('<issue-id>', 'Backend issue ID')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (beadId, issueId, options) => {
    const backend = await getBackendFromConfig(options.config);

    await withAuth(backend, async () => {
      await executeCapability('mapping-create', {
        beadId,
        issueId,
        config: options.config,
      });
    });
  });
```

**Test Updates**: Test both subcommands with auth checks

**Success Criteria**:
- ✅ Both subcommands check authentication before executing
- ✅ Show helpful error messages when not authenticated
- ✅ Execute normally when authenticated
- ✅ Tests pass

**Dependencies**: Task 1 (auth wrapper)

**Estimated Time**: 20 minutes

---

### Task 7: Update Decompose Command

**File**: `src/cli.ts` (lines 165-184)

Update the `decompose` command to check authentication before decomposing issues.

**Changes**:

```typescript
// Update decompose command (around line 165)
program
  .command('decompose')
  .description('Decompose issue into epic with subtasks')
  .argument('<issue-id>', 'Issue ID to decompose')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--dry-run', 'Preview decomposition without creating issues')
  .action(async (issueId, options) => {
    const backend = await getBackendFromConfig(options.config);

    await withAuth(backend, async () => {
      await executeCapability('decompose', {
        issueId,
        config: options.config,
        dryRun: options.dryRun,
      });
    });
  });
```

**Test Updates**: Similar pattern to previous commands

**Success Criteria**:
- ✅ Command checks authentication before executing
- ✅ Shows helpful error message when not authenticated
- ✅ Executes normally when authenticated
- ✅ Tests pass

**Dependencies**: Task 1 (auth wrapper)

**Estimated Time**: 15 minutes

---

### Task 8: Update Force-Sync Command

**File**: `src/cli.ts` (lines 186-197)

Update the `force-sync` command to check authentication before forcing sync.

**Changes**:

```typescript
// Update force-sync command (around line 186)
program
  .command('force-sync')
  .description('Force immediate synchronization')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--all', 'Sync all repositories')
  .action(async (options) => {
    const backend = await getBackendFromConfig(options.config);

    await withAuth(backend, async () => {
      await executeCapability('force-sync', {
        config: options.config,
        all: options.all,
      });
    });
  });
```

**Test Updates**: Similar pattern to previous commands

**Success Criteria**:
- ✅ Command checks authentication before executing
- ✅ Shows helpful error message when not authenticated
- ✅ Executes normally when authenticated
- ✅ Tests pass

**Dependencies**: Task 1 (auth wrapper)

**Estimated Time**: 15 minutes

---

### Task 9: Integration Tests

**File**: `tests/cli/cli-integration.test.ts` (new file)

Create comprehensive integration tests for the CLI with authentication flow.

**Implementation**:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CredentialStore } from '../../src/auth/credential-store.js';
import { ConfigManager } from '../../src/config/config-manager.js';

vi.mock('../../src/auth/credential-store.js');
vi.mock('../../src/config/config-manager.js');

describe('CLI Integration Tests with Auth', () => {
  beforeEach(() => {
    // Mock config manager to return test config
    const mockConfig = {
      backend: 'github' as const,
      github: { repository: 'test/repo' },
      repositories: [],
      mappingStoragePath: '.beads-bridge',
    };

    vi.mocked(ConfigManager).mockImplementation(() => ({
      loadConfig: vi.fn().mockResolvedValue(mockConfig),
    } as any));
  });

  describe('Unauthenticated flow', () => {
    beforeEach(() => {
      // Mock no credentials
      vi.mocked(CredentialStore).mockImplementation(() => ({
        hasCredentials: vi.fn().mockResolvedValue(false),
      } as any));
    });

    const commandsRequiringAuth = [
      'status',
      'sync',
      'diagram',
      'discoveries',
      'mapping get test-123',
      'mapping create test-123 456',
      'decompose test-123',
      'force-sync',
    ];

    commandsRequiringAuth.forEach((cmd) => {
      it(`should block '${cmd}' when not authenticated`, async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

        // Execute command (would need CLI test helper)
        // await execCli(cmd.split(' '));

        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Not authenticated'));
        expect(processExitSpy).toHaveBeenCalledWith(1);

        consoleErrorSpy.mockRestore();
        processExitSpy.mockRestore();
      });
    });
  });

  describe('Authenticated flow', () => {
    beforeEach(() => {
      // Mock credentials exist
      vi.mocked(CredentialStore).mockImplementation(() => ({
        hasCredentials: vi.fn().mockResolvedValue(true),
      } as any));
    });

    it('should allow status command when authenticated', async () => {
      // Test that command proceeds to executeCapability
      // This would need actual CLI execution test helper
    });

    it('should allow sync command when authenticated', async () => {
      // Test that command proceeds
    });

    // Similar tests for other commands
  });

  describe('Auth commands', () => {
    it('should not require auth check for auth commands', async () => {
      // Test that 'auth github', 'auth status', etc. don't require existing auth
    });
  });
});
```

**Success Criteria**:
- ✅ All commands requiring auth are tested
- ✅ Unauthenticated flow blocks and shows error
- ✅ Authenticated flow proceeds normally
- ✅ Auth commands themselves don't require auth
- ✅ All tests pass with `npm test -- --run`

**Dependencies**: Tasks 1-8 (all command updates)

**Estimated Time**: 45 minutes

---

## Verification Steps

After completing all tasks:

1. **Build Check**: Run `npm run build` - must succeed with no errors
2. **Type Check**: Run `npm run type-check` - must succeed with no errors
3. **Test Suite**: Run `npm test -- --run` - all tests must pass
4. **Manual Testing**:
   ```bash
   # Test unauthenticated flow
   beads-bridge auth clear
   beads-bridge status  # Should show auth error with help

   # Test authenticated flow
   beads-bridge auth github
   beads-bridge status  # Should work

   # Test different backend
   beads-bridge auth shortcut
   beads-bridge sync  # Should work with shortcut backend
   ```

## Dependencies

- Phase 4 (Configuration v2.0) must be complete
- CredentialStore implementation from previous phase
- All SDK migrations (GitHub Octokit, Shortcut client) complete

## Testing Strategy

- Unit tests for auth wrapper function
- Unit tests for getBackendFromConfig helper
- Integration tests for each command with auth flow
- Manual testing of authentication error messages
- Manual testing of successful command execution

## Success Criteria

- ✅ All commands requiring backend access check authentication first
- ✅ Clear, actionable error messages when not authenticated
- ✅ Graceful handling of missing or invalid credentials
- ✅ No breaking changes to command behavior when authenticated
- ✅ All tests pass with >90% coverage of new code
- ✅ Build and type-check pass without errors
- ✅ Manual testing confirms improved user experience

## Notes

- Auth wrapper pattern allows consistent error handling across commands
- Error messages guide users to the correct authentication command
- Integration with existing CredentialStore for auth checks
- Maintains backward compatibility - commands work the same when authenticated
- Sets foundation for better error handling in future phases
