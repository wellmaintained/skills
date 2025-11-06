# Phase 4: Configuration Updates for v2.0 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Update configuration system to document v2.0 architecture with SDK-based backends and separate credential management.

**Architecture:** The config system already works well. Phase 4 focuses on version bumping to 2.0, updating documentation, and ensuring the separation between config (project settings) and credentials (authentication tokens) is clear.

**Tech Stack:** TypeScript, existing Config types, YAML configuration files

---

## Context

**Current State (v1.0):**
- Config stored in YAML files (e.g., `.beads-bridge/config.yaml`)
- Credentials stored separately in `~/.config/beads-bridge/credentials.json` (from Phase 1)
- Backends receive credentials via constructor (Phases 2-3)
- Config includes GitHub-specific settings (cliPath, projectId, repository)

**Target State (v2.0):**
- Version field updated to '2.0'
- Remove CLI-specific config options (cliPath no longer needed)
- Add Shortcut backend config support
- Document the credential separation clearly
- Maintain backward compatibility with existing configs

**Key Insight:** Most work is already done! Backends use credentials from CredentialStore. Config just needs version bump and cleanup.

---

## Task 1: Update Config Version and Remove CLI Options

**Files:**
- Modify: `.claude/skills/beads-bridge/src/types/config.ts:245-360`
- Modify: `.claude/skills/beads-bridge/tests/config-manager.test.ts`

### Step 1: Write failing test for v2.0 config

Add to test file:

```typescript
describe('Config v2.0', () => {
  it('should support version 2.0', () => {
    const config: Config = {
      version: '2.0',
      backend: 'github',
      github: {
        repository: 'owner/repo',
        projectId: 'PVT_123'
      },
      repositories: [],
      mappingStoragePath: '.beads-bridge',
      sync: { enabled: true },
      notifications: { enabled: true },
      logging: { level: 'info' }
    };

    expect(config.version).toBe('2.0');
  });

  it('should not include cliPath in GitHubConfig', () => {
    const config: GitHubConfig = {
      repository: 'owner/repo',
      projectId: 'PVT_123'
    };

    // TypeScript should not allow cliPath property
    expect(config).not.toHaveProperty('cliPath');
  });

  it('should support shortcut backend', () => {
    const config: Config = {
      version: '2.0',
      backend: 'shortcut',
      github: { repository: '' }, // Still required in type
      shortcut: {
        workspace: 'my-workspace',
        projectId: 123
      },
      repositories: [],
      mappingStoragePath: '.beads-bridge',
      sync: { enabled: true },
      notifications: { enabled: true },
      logging: { level: 'info' }
    };

    expect(config.backend).toBe('shortcut');
    expect(config.shortcut).toBeDefined();
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test tests/config-manager.test.ts -- --run`

Expected: FAIL - Type errors for cliPath and missing shortcut config

### Step 3: Update Config types

Modify `src/types/config.ts`:

```typescript
/**
 * GitHub-specific configuration
 */
export interface GitHubConfig {
  /** GitHub Projects v2 project ID */
  projectId?: string;

  /** GitHub repository for creating issues (e.g., 'owner/repo') */
  repository: string;

  /** Custom field names in GitHub Projects */
  customFields?: {
    /** Field name for completion percentage */
    completionField?: string;

    /** Field name for status */
    statusField?: string;

    /** Field name for blockers count */
    blockersField?: string;
  };

  /** Rate limiting configuration */
  rateLimit?: {
    /** Maximum requests per hour */
    maxRequestsPerHour: number;

    /** Enable automatic rate limit handling */
    autoRetry: boolean;
  };
}

/**
 * Shortcut-specific configuration
 */
export interface ShortcutConfig {
  /** Shortcut workspace name */
  workspace: string;

  /** Shortcut project ID (optional) */
  projectId?: number;

  /** Default workflow state for new stories */
  defaultWorkflowState?: string;

  /** Custom field mappings */
  customFields?: {
    /** Field ID for completion percentage */
    completionField?: string;

    /** Field ID for status */
    statusField?: string;
  };
}

/**
 * Main configuration schema for v2.0
 */
export interface Config {
  /** Configuration version */
  version: string;

  /** Backend type */
  backend: BackendType;

  /** GitHub configuration */
  github: GitHubConfig;

  /** Shortcut configuration (v2.0+) */
  shortcut?: ShortcutConfig;

  /** Beads repositories */
  repositories: RepositoryConfig[];

  /** Mapping database storage path */
  mappingStoragePath: string;

  /** Sync schedule */
  sync: SyncSchedule;

  /** Notification preferences */
  notifications: NotificationConfig;

  /** Logging configuration */
  logging: LoggingConfig;

  /** Mermaid diagram configuration */
  diagrams?: DiagramConfig;

  /** Conflict resolution configuration */
  conflictResolution?: ConflictResolutionConfig;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Default configuration values for v2.0
 */
export const DEFAULT_CONFIG: Config = {
  version: '2.0',
  backend: 'github',
  github: {
    repository: '',
    rateLimit: {
      maxRequestsPerHour: 5000,
      autoRetry: true,
    },
  },
  repositories: [],
  mappingStoragePath: '.beads-bridge',
  sync: {
    enabled: true,
    workHours: {
      enabled: true,
      startHour: 9,
      endHour: 17,
      daysOfWeek: [1, 2, 3, 4, 5],
      timezone: 'UTC',
      workHourInterval: 60,
      offHoursInterval: 480,
    },
  },
  notifications: {
    enabled: true,
    channels: {
      githubComments: true,
      githubLabels: true,
    },
    triggers: {
      scopeDiscovery: true,
      conflicts: true,
      completion: true,
      blockers: true,
    },
    scopeDiscoveryThreshold: {
      percentageThreshold: 20,
      countThreshold: 5,
    },
  },
  logging: {
    level: 'info',
    outputs: {
      console: true,
      file: true,
      filePath: 'logs/beads-bridge.log',
    },
    format: 'text',
    timestamp: true,
    rotation: {
      maxSize: 10,
      maxFiles: 10,
      compress: true,
    },
  },
  diagrams: {
    enabled: true,
    maxNodes: 50,
    includeLegend: true,
    updateStrategy: {
      onScopeChange: true,
      weekly: true,
      onManualCommand: true,
    },
    placement: {
      updateDescription: true,
      createSnapshots: true,
    },
  },
  conflictResolution: {
    autoResolve: 'manual',
    retryFailedSyncs: true,
    maxRetries: 3,
    retryBackoff: 2,
  },
};
```

### Step 4: Run tests to verify they pass

Run: `npm test tests/config-manager.test.ts -- --run`

Expected: All config tests PASS

### Step 5: Commit config type updates

```bash
git add src/types/config.ts tests/config-manager.test.ts
git commit -m "feat(config): update to v2.0 with SDK-based backends

- Bump default version to 2.0
- Remove cliPath from GitHubConfig (no longer needed)
- Add ShortcutConfig interface for Shortcut backend
- Add shortcut field to main Config interface
- Update tests to verify v2.0 config structure
- Credentials managed separately via CredentialStore

🤖 Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 2: Add Config Migration Helper

**Files:**
- Create: `.claude/skills/beads-bridge/src/config/migration.ts`
- Modify: `.claude/skills/beads-bridge/src/config/config-manager.ts`
- Create: `.claude/skills/beads-bridge/tests/config-migration.test.ts`

### Step 1: Write failing test for config migration

Create test file:

```typescript
// tests/config-migration.test.ts
import { describe, it, expect } from 'vitest';
import { migrateConfig, needsMigration } from '../src/config/migration.js';
import type { Config } from '../src/types/config.js';

describe('Config Migration', () => {
  it('should detect v1.0 config needs migration', () => {
    const v1Config = {
      version: '1.0',
      backend: 'github',
      github: {
        cliPath: 'gh',
        repository: 'owner/repo'
      }
    };

    expect(needsMigration(v1Config)).toBe(true);
  });

  it('should detect v2.0 config does not need migration', () => {
    const v2Config = {
      version: '2.0',
      backend: 'github',
      github: {
        repository: 'owner/repo'
      }
    };

    expect(needsMigration(v2Config)).toBe(false);
  });

  it('should migrate v1.0 to v2.0', () => {
    const v1Config = {
      version: '1.0',
      backend: 'github',
      github: {
        cliPath: 'gh',
        repository: 'owner/repo',
        projectId: 'PVT_123'
      },
      repositories: [],
      mappingStoragePath: '.beads-bridge',
      sync: { enabled: true },
      notifications: { enabled: true },
      logging: { level: 'info' }
    };

    const v2Config = migrateConfig(v1Config);

    expect(v2Config.version).toBe('2.0');
    expect(v2Config.github).not.toHaveProperty('cliPath');
    expect(v2Config.github.repository).toBe('owner/repo');
    expect(v2Config.github.projectId).toBe('PVT_123');
  });

  it('should preserve all settings during migration', () => {
    const v1Config = {
      version: '1.0',
      backend: 'github',
      github: { repository: 'owner/repo' },
      repositories: [{ name: 'test', path: '/test', enabled: true }],
      mappingStoragePath: '.custom-path',
      sync: { enabled: false },
      notifications: { enabled: false },
      logging: { level: 'debug' },
      metadata: { custom: 'value' }
    };

    const v2Config = migrateConfig(v1Config);

    expect(v2Config.repositories).toEqual(v1Config.repositories);
    expect(v2Config.mappingStoragePath).toBe('.custom-path');
    expect(v2Config.sync.enabled).toBe(false);
    expect(v2Config.logging.level).toBe('debug');
    expect(v2Config.metadata).toEqual({ custom: 'value' });
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test tests/config-migration.test.ts -- --run`

Expected: FAIL - migration.ts does not exist

### Step 3: Implement migration helper

Create `src/config/migration.ts`:

```typescript
/**
 * Configuration migration utilities for v1.0 → v2.0
 */

import type { Config } from '../types/config.js';

/**
 * Check if a config needs migration to v2.0
 */
export function needsMigration(config: any): boolean {
  // Missing version or version 1.0 needs migration
  return !config.version || config.version === '1.0';
}

/**
 * Migrate v1.0 config to v2.0
 */
export function migrateConfig(v1Config: any): Config {
  // Start with v1 config
  const v2Config = { ...v1Config };

  // Update version
  v2Config.version = '2.0';

  // Remove CLI-specific options from GitHub config
  if (v2Config.github?.cliPath) {
    const { cliPath, ...githubConfigWithoutCli } = v2Config.github;
    v2Config.github = githubConfigWithoutCli;
  }

  // No other changes needed - credential separation already handled

  return v2Config as Config;
}

/**
 * Get migration notes for user
 */
export function getMigrationNotes(): string[] {
  return [
    'Configuration migrated from v1.0 to v2.0',
    'Removed CLI-specific options (cliPath) - now using SDK clients',
    'Authentication credentials managed separately in ~/.config/beads-bridge/credentials.json',
    'Run "beads-bridge auth status" to check authentication',
    'No action required - migration is automatic'
  ];
}
```

### Step 4: Update ConfigManager to use migration

Modify `src/config/config-manager.ts`:

```typescript
// Add import at top
import { needsMigration, migrateConfig, getMigrationNotes } from './migration.js';

// In the load() method, after loading config:
async load(): Promise<Config> {
  // ... existing load logic ...

  const loadedConfig = // ... loaded from file or defaults ...

  // Auto-migrate if needed
  if (needsMigration(loadedConfig)) {
    console.log('Migrating configuration from v1.0 to v2.0...');
    const migratedConfig = migrateConfig(loadedConfig);

    // Save migrated config
    await this.save(migratedConfig);

    // Show migration notes
    const notes = getMigrationNotes();
    notes.forEach(note => console.log(`  ℹ ${note}`));
    console.log('✓ Configuration migrated successfully\n');

    return migratedConfig;
  }

  return loadedConfig;
}
```

### Step 5: Run tests to verify they pass

Run: `npm test tests/config-migration.test.ts -- --run`

Expected: All migration tests PASS

### Step 6: Commit migration implementation

```bash
git add src/config/migration.ts src/config/config-manager.ts tests/config-migration.test.ts
git commit -m "feat(config): add automatic v1.0 to v2.0 migration

- Implement needsMigration() to detect v1.0 configs
- Implement migrateConfig() to upgrade to v2.0
- Remove cliPath during migration (SDK clients don't need it)
- Add migration notes to inform users
- Auto-migrate on first load in ConfigManager
- Preserve all user settings during migration

🤖 Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 3: Update Configuration Documentation

**Files:**
- Create: `.claude/skills/beads-bridge/docs/CONFIGURATION.md`
- Modify: `.claude/skills/beads-bridge/README.md`

### Step 1: Create comprehensive configuration guide

Create `docs/CONFIGURATION.md`:

```markdown
# Configuration Guide

## Overview

Beads-bridge v2.0 uses two separate configuration systems:

1. **Project Configuration** (`.beads-bridge/config.yaml`) - Project settings, repositories, sync schedules
2. **Authentication Credentials** (`~/.config/beads-bridge/credentials.json`) - API tokens, encrypted

This separation keeps sensitive credentials out of project files.

## Configuration File Location

Default: `.beads-bridge/config.yaml` in your project root

Override with environment variable:
```bash
export BEADS_PM_SYNC_CONFIG=/path/to/config.yaml
```

## Configuration Schema (v2.0)

### Minimal Configuration

```yaml
version: "2.0"
backend: github  # or 'shortcut'

github:
  repository: owner/repo
  projectId: PVT_kwDOAbc123  # Optional: GitHub Projects v2 ID

repositories:
  - name: my-project
    path: /absolute/path/to/repo
    prefix: myproject  # For issue IDs like myproject-e123
    enabled: true

mappingStoragePath: .beads-bridge
sync:
  enabled: true
notifications:
  enabled: true
logging:
  level: info
```

### Backend-Specific Configuration

#### GitHub Backend

```yaml
github:
  repository: owner/repo
  projectId: PVT_kwDOAbc123  # Projects v2 ID

  customFields:
    completionField: Completion
    statusField: Status
    blockersField: Blockers

  rateLimit:
    maxRequestsPerHour: 5000
    autoRetry: true
```

#### Shortcut Backend

```yaml
backend: shortcut

shortcut:
  workspace: my-workspace
  projectId: 12345  # Optional
  defaultWorkflowState: Unstarted

  customFields:
    completionField: completion_percentage
    statusField: current_status
```

### Authentication

Authentication is managed separately. See [AUTHENTICATION.md](./AUTHENTICATION.md).

**Setup:**
```bash
# GitHub (OAuth)
beads-bridge auth github

# Shortcut (API token)
beads-bridge auth shortcut

# Check status
beads-bridge auth status
```

### Sync Configuration

```yaml
sync:
  enabled: true

  # Optional: Cron expression
  cronExpression: "0 * * * *"  # Every hour

  # Optional: Work hours mode
  workHours:
    enabled: true
    startHour: 9    # 9 AM
    endHour: 17     # 5 PM
    daysOfWeek: [1, 2, 3, 4, 5]  # Monday-Friday
    timezone: America/Los_Angeles
    workHourInterval: 60      # Sync every 60 min during work
    offHoursInterval: 480     # Sync every 8 hours outside work
```

### Notifications

```yaml
notifications:
  enabled: true

  channels:
    githubComments: true
    githubLabels: true

  triggers:
    scopeDiscovery: true
    conflicts: true
    completion: true
    blockers: true

  scopeDiscoveryThreshold:
    percentageThreshold: 20  # Notify if >20% scope increase
    countThreshold: 5        # Notify if >5 new issues
```

### Diagrams

```yaml
diagrams:
  enabled: true
  maxNodes: 50
  includeLegend: true

  updateStrategy:
    onScopeChange: true
    weekly: true
    onManualCommand: true

  placement:
    updateDescription: true   # Update issue description
    createSnapshots: true     # Create snapshot comments
```

### Conflict Resolution

```yaml
conflictResolution:
  autoResolve: manual  # or 'github_wins', 'beads_wins'
  retryFailedSyncs: true
  maxRetries: 3
  retryBackoff: 2  # Exponential backoff multiplier
```

## Migration from v1.0

**Automatic:** When you upgrade to v2.0, the config will auto-migrate on first run.

**Changes:**
- `version` updated from `1.0` to `2.0`
- `github.cliPath` removed (SDK clients don't need it)
- Authentication moved to separate credential store

**No action required** - your existing config will be preserved and upgraded automatically.

## Environment Variables

Override config values with environment variables:

```bash
export BEADS_PM_SYNC_CONFIG=/path/to/config.yaml
export BEADS_PM_SYNC_GITHUB_REPO=owner/repo
export BEADS_PM_SYNC_GITHUB_PROJECT_ID=PVT_kwDOAbc123
export BEADS_PM_SYNC_STORAGE_PATH=/custom/path
export BEADS_PM_SYNC_LOG_LEVEL=debug
export BEADS_PM_SYNC_ENABLED=true
```

## Validation

Config is validated on load. Common errors:

- **Missing required fields:** `github.repository` is required
- **Invalid backend:** Must be 'github', 'shortcut', or 'jira'
- **Invalid log level:** Must be 'error', 'warn', 'info', or 'debug'
- **Invalid paths:** Repository paths must be absolute

## Troubleshooting

**Config not found:**
```bash
# Create default config
beads-bridge init

# Specify custom location
export BEADS_PM_SYNC_CONFIG=/path/to/config.yaml
```

**Authentication errors:**
```bash
# Check auth status
beads-bridge auth status

# Re-authenticate
beads-bridge auth github
```

**Config validation errors:**
Check logs at `logs/beads-bridge.log` for detailed error messages.
```

### Step 2: Update README with v2.0 info

Update README.md section about configuration:

```markdown
## Configuration

Beads-bridge v2.0 uses two separate configuration systems:

1. **Project Config** (`.beads-bridge/config.yaml`) - Project settings
2. **Credentials** (`~/.config/beads-bridge/credentials.json`) - API tokens

### Quick Start

```bash
# Initialize project config
beads-bridge init

# Authenticate
beads-bridge auth github    # For GitHub
beads-bridge auth shortcut  # For Shortcut

# Verify setup
beads-bridge auth status
```

See [Configuration Guide](./docs/CONFIGURATION.md) for complete documentation.

### No CLI Dependencies

v2.0 uses native SDK clients (Octokit, @shortcut/client). No need to install `gh` or `short` CLI tools.

**Requirements:**
- Node.js >= 18.0.0
- That's it!
```

### Step 3: Commit documentation

```bash
git add docs/CONFIGURATION.md README.md
git commit -m "docs: add comprehensive v2.0 configuration guide

- Create CONFIGURATION.md with complete schema documentation
- Document credential separation and authentication
- Add migration notes from v1.0 to v2.0
- Update README with v2.0 quick start
- Document all config options with examples
- Add troubleshooting section

🤖 Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Verification Checklist

After completing all tasks, verify:

- [ ] Config version defaults to 2.0
- [ ] GitHubConfig no longer has cliPath field
- [ ] ShortcutConfig interface exists and is documented
- [ ] Migration automatically upgrades v1.0 → v2.0
- [ ] All existing tests pass
- [ ] CONFIGURATION.md provides complete documentation
- [ ] README updated with v2.0 quick start

---

## Next Steps

After Phase 4 is complete:

- **Phase 5** (pensive-0a3d): Add auth checks to all CLI commands
- **Phase 6** (pensive-aa99): Update test coverage to >90%
- **Phase 7** (pensive-92e3): Documentation updates (AUTHENTICATION.md, MIGRATION guide)

---

## Notes for Engineer

**Key Points:**

1. **Minimal Changes:** Most work already done in Phases 1-3. Config just needs version bump and cleanup.
2. **Separation:** Config (project settings) vs Credentials (auth tokens) - already separated!
3. **Migration:** Simple - just remove cliPath and bump version
4. **Backward Compatibility:** Auto-migration preserves all settings

**Testing Strategy:**

- Test config type changes (TypeScript compilation)
- Test migration logic (v1.0 → v2.0)
- Test config loading with auto-migration
- Verify all existing configs still work
