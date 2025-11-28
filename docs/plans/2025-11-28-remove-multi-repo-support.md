# Remove Multi-Repo Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove multi-repository support from beads-bridge and implement auto-detection of repository path from current working directory.

**Architecture:** Replace the `repositories[]` array with a single `repositoryPath` that defaults to auto-detecting `.beads/` in cwd. This simplifies BeadsClient, ConfigManager, and the serve command by eliminating repository lookup logic.

**Tech Stack:** TypeScript, Bun test runner, Commander.js CLI

**Issue:** wms-v5e

---

## Summary of Changes

| Component | Before | After |
|-----------|--------|-------|
| ConfigManager | Manages `repositories[]` array | Single `repositoryPath`, auto-detects cwd |
| BeadsClient | `Map<string, BeadsRepository>`, all methods take `repository` param | Single `BdCli` instance, no repository param |
| serve command | `findRepositoryForIssue()` prefix matching | Uses auto-detected path directly |
| Config types | `RepositoryConfig[]`, `BeadsConfig.repositories` | `repositoryPath: string` |

---

## Task 1: Add Repository Auto-Detection Utility

**Files:**
- Create: `src/beads-bridge/src/utils/repo-detector.ts`
- Test: `src/beads-bridge/tests/utils/repo-detector.test.ts`

**Step 1: Write the failing test**

Create `src/beads-bridge/tests/utils/repo-detector.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectRepository, extractPrefixFromIssues } from '../../src/utils/repo-detector.js';

describe('repo-detector', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `repo-detector-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('detectRepository', () => {
    it('should detect repository when .beads/ exists in cwd', () => {
      mkdirSync(join(tempDir, '.beads'));
      
      const result = detectRepository(tempDir);
      
      expect(result).toEqual({
        path: tempDir,
        detected: true,
      });
    });

    it('should return null when .beads/ does not exist', () => {
      const result = detectRepository(tempDir);
      
      expect(result).toBeNull();
    });

    it('should detect repository in parent directory', () => {
      const subDir = join(tempDir, 'src', 'components');
      mkdirSync(subDir, { recursive: true });
      mkdirSync(join(tempDir, '.beads'));
      
      const result = detectRepository(subDir);
      
      expect(result).toEqual({
        path: tempDir,
        detected: true,
      });
    });

    it('should stop at filesystem root without finding .beads/', () => {
      const result = detectRepository('/tmp/definitely-not-a-beads-repo');
      
      expect(result).toBeNull();
    });
  });

  describe('extractPrefixFromIssues', () => {
    it('should extract prefix from issues.jsonl', () => {
      mkdirSync(join(tempDir, '.beads'));
      writeFileSync(
        join(tempDir, '.beads', 'issues.jsonl'),
        '{"id":"wms-123","title":"Test"}\n{"id":"wms-456","title":"Another"}\n'
      );
      
      const prefix = extractPrefixFromIssues(tempDir);
      
      expect(prefix).toBe('wms');
    });

    it('should return undefined when issues.jsonl is empty', () => {
      mkdirSync(join(tempDir, '.beads'));
      writeFileSync(join(tempDir, '.beads', 'issues.jsonl'), '');
      
      const prefix = extractPrefixFromIssues(tempDir);
      
      expect(prefix).toBeUndefined();
    });

    it('should return undefined when issues.jsonl does not exist', () => {
      mkdirSync(join(tempDir, '.beads'));
      
      const prefix = extractPrefixFromIssues(tempDir);
      
      expect(prefix).toBeUndefined();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd src/beads-bridge && bun test tests/utils/repo-detector.test.ts`

Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `src/beads-bridge/src/utils/repo-detector.ts`:

```typescript
/**
 * Repository auto-detection utilities
 * 
 * Detects beads repository by looking for .beads/ directory
 * in current working directory or parent directories.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export interface DetectedRepository {
  /** Absolute path to the repository root */
  path: string;
  /** Whether the path was auto-detected (vs explicit config) */
  detected: boolean;
}

/**
 * Detect a beads repository starting from the given directory.
 * Walks up the directory tree looking for .beads/ directory.
 * 
 * @param startDir - Directory to start searching from (defaults to cwd)
 * @returns DetectedRepository if found, null otherwise
 */
export function detectRepository(startDir?: string): DetectedRepository | null {
  let currentDir = resolve(startDir || process.cwd());
  const root = dirname(currentDir) === currentDir ? currentDir : '/';
  
  while (currentDir !== root) {
    const beadsDir = join(currentDir, '.beads');
    if (existsSync(beadsDir)) {
      return {
        path: currentDir,
        detected: true,
      };
    }
    
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break; // Reached filesystem root
    }
    currentDir = parentDir;
  }
  
  // Check root directory too
  const beadsDir = join(currentDir, '.beads');
  if (existsSync(beadsDir)) {
    return {
      path: currentDir,
      detected: true,
    };
  }
  
  return null;
}

/**
 * Extract the issue prefix from existing issues in the repository.
 * Reads the first issue from .beads/issues.jsonl to determine the prefix.
 * 
 * @param repoPath - Path to the repository root
 * @returns The prefix (e.g., "wms" from "wms-123") or undefined
 */
export function extractPrefixFromIssues(repoPath: string): string | undefined {
  const issuesPath = join(repoPath, '.beads', 'issues.jsonl');
  
  if (!existsSync(issuesPath)) {
    return undefined;
  }
  
  try {
    const content = readFileSync(issuesPath, 'utf-8');
    const firstLine = content.split('\n').find(line => line.trim());
    
    if (!firstLine) {
      return undefined;
    }
    
    const issue = JSON.parse(firstLine);
    if (issue.id && typeof issue.id === 'string') {
      const match = issue.id.match(/^([a-z]+)-/i);
      return match ? match[1].toLowerCase() : undefined;
    }
  } catch {
    return undefined;
  }
  
  return undefined;
}
```

**Step 4: Run test to verify it passes**

Run: `cd src/beads-bridge && bun test tests/utils/repo-detector.test.ts`

Expected: PASS

**Step 5: Export from utils/index.ts**

Add to `src/beads-bridge/src/utils/index.ts` (create if doesn't exist):

```typescript
export { detectRepository, extractPrefixFromIssues } from './repo-detector.js';
export type { DetectedRepository } from './repo-detector.js';
```

**Step 6: Commit**

```bash
git add src/beads-bridge/src/utils/repo-detector.ts src/beads-bridge/tests/utils/repo-detector.test.ts
git commit -m "feat(beads-bridge): add repository auto-detection utility"
```

---

## Task 2: Simplify Config Types

**Files:**
- Modify: `src/beads-bridge/src/types/config.ts`
- Modify: `src/beads-bridge/src/types/beads.ts`

**Step 1: Update config.ts to use single repositoryPath**

In `src/beads-bridge/src/types/config.ts`, replace the `repositories` array with a single path:

```typescript
// REMOVE these lines:
// /**
//  * Repository configuration for Beads
//  */
// export interface RepositoryConfig {
//   /** Repository name (identifier) */
//   name: string;
//   /** Absolute path to repository on filesystem */
//   path: string;
//   /** GitHub repository (e.g., 'owner/repo') if different from Beads repo */
//   githubRepo?: string;
//   /** Beads issue prefix (e.g., 'frontend' for 'frontend-e123') */
//   prefix?: string;
//   /** Whether this repository is enabled for syncing */
//   enabled?: boolean;
// }

// ADD this after GitHubConfig:
/**
 * Repository path configuration
 * Can be explicit path or auto-detected from cwd
 */
export interface RepositoryPathConfig {
  /** Path to the beads repository (absolute or relative) */
  path?: string;
  /** Issue prefix (auto-detected from issues.jsonl if not specified) */
  prefix?: string;
}
```

Update the Config interface:

```typescript
export interface Config {
  /** Configuration version */
  version: string;

  /** Backend type (default backend to use) */
  backend: BackendType;

  /** GitHub configuration */
  github: GitHubConfig;

  /** Shortcut configuration (v2.0+) */
  shortcut?: ShortcutConfig;

  /** Repository path (auto-detected if not specified) */
  repository?: RepositoryPathConfig;

  /** Logging configuration */
  logging: LoggingConfig;

  /** Mermaid diagram configuration */
  diagrams?: DiagramConfig;
}
```

Update DEFAULT_CONFIG:

```typescript
export const DEFAULT_CONFIG: Config = {
  version: '2.0',
  backend: 'github',
  github: {
    repository: ''
  },
  // repository is optional - will be auto-detected
  logging: {
    level: 'info',
    outputs: {
      console: true,
      file: false
    }
  },
  diagrams: {
    enabled: true,
    maxNodes: 50,
    includeLegend: true,
    updateStrategy: {
      onScopeChange: true,
      weekly: true,
      onManualCommand: true
    },
    placement: {
      updateDescription: true,
      createSnapshots: true
    }
  }
};
```

Remove `mappingStoragePath` from Config (no longer needed - legacy mapping warning can be removed entirely or kept simple).

**Step 2: Update beads.ts to simplify BeadsConfig**

In `src/beads-bridge/src/types/beads.ts`, simplify BeadsConfig:

```typescript
// CHANGE from:
// export interface BeadsConfig {
//   /** List of repositories to track */
//   repositories: BeadsRepository[];
// }

// TO:
export interface BeadsConfig {
  /** Path to the beads repository */
  repositoryPath: string;
  /** Issue prefix (optional, auto-detected if not provided) */
  prefix?: string;
}
```

Remove BeadsRepository interface if it only served multi-repo:

```typescript
// REMOVE if only used for multi-repo:
// export interface BeadsRepository {
//   name: string;
//   path: string;
//   prefix?: string;
// }
```

**Step 3: Run existing tests to see what breaks**

Run: `cd src/beads-bridge && bun test`

Expected: Multiple failures in tests that use old config structure

**Step 4: Commit type changes**

```bash
git add src/beads-bridge/src/types/config.ts src/beads-bridge/src/types/beads.ts
git commit -m "refactor(beads-bridge): simplify config types for single-repo"
```

---

## Task 3: Simplify BeadsClient

**Files:**
- Modify: `src/beads-bridge/src/clients/beads-client.ts`
- Modify: `src/beads-bridge/tests/clients/beads-client.test.ts`

**Step 1: Rewrite BeadsClient for single repository**

Replace `src/beads-bridge/src/clients/beads-client.ts`:

```typescript
/**
 * Beads Client Implementation
 *
 * Client for interacting with Beads issue tracking.
 */

import type {
  BeadsConfig,
  BeadsIssue,
  CreateBeadsIssueParams,
  UpdateBeadsIssueParams,
  EpicStatus,
  DependencyTreeNode,
  BeadsListQuery,
  BeadsDependencyType
} from '../types/beads.js';
import { NotFoundError } from '../types/index.js';
import { BdCli } from '../utils/bd-cli.js';
import type { Logger } from '../monitoring/logger.js';
import { DependencyTreeBuilder } from '../services/dependency-tree-builder.js';
import { EpicStatusCalculator } from '../services/epic-status-calculator.js';

/**
 * Beads client for single-repository issue tracking
 */
export class BeadsClient {
  private readonly bdCli: BdCli;
  private readonly repositoryPath: string;
  private readonly prefix?: string;
  private readonly treeBuilder: DependencyTreeBuilder;
  private readonly statusCalculator: EpicStatusCalculator;

  constructor(config: BeadsConfig & { logger?: Logger }) {
    this.repositoryPath = config.repositoryPath;
    this.prefix = config.prefix;
    this.bdCli = new BdCli({ cwd: config.repositoryPath, logger: config.logger });
    this.treeBuilder = new DependencyTreeBuilder(this);
    this.statusCalculator = new EpicStatusCalculator(this, this.treeBuilder);
  }

  // ============================================================================
  // Repository Info
  // ============================================================================

  /**
   * Get the repository path
   */
  getRepositoryPath(): string {
    return this.repositoryPath;
  }

  /**
   * Get the issue prefix
   */
  getPrefix(): string | undefined {
    return this.prefix;
  }

  // ============================================================================
  // Issue Operations
  // ============================================================================

  /**
   * Create an epic
   */
  async createEpic(params: CreateBeadsIssueParams): Promise<BeadsIssue> {
    const args = ['create', params.title];

    if (params.description) {
      args.push('-d', params.description);
    }

    if (params.design) {
      args.push('--design', params.design);
    }

    if (params.acceptance_criteria) {
      args.push('--acceptance', params.acceptance_criteria);
    }

    args.push('-t', params.issue_type || 'epic');

    if (params.priority !== undefined) {
      args.push('-p', params.priority.toString());
    }

    if (params.assignee) {
      args.push('--assignee', params.assignee);
    }

    if (params.labels && params.labels.length > 0) {
      for (const label of params.labels) {
        args.push('--label', label);
      }
    }

    if (params.dependencies && params.dependencies.length > 0) {
      args.push('--deps', params.dependencies.join(','));
    }

    if (params.external_ref) {
      args.push('--external-ref', params.external_ref);
    }

    const issue = await this.bdCli.execJson<BeadsIssue>(args);
    return issue;
  }

  /**
   * Create a regular issue (task, bug, etc.)
   */
  async createIssue(params: CreateBeadsIssueParams): Promise<BeadsIssue> {
    return this.createEpic(params);
  }

  /**
   * Get an issue by ID
   */
  async getIssue(issueId: string): Promise<BeadsIssue> {
    const result = await this.bdCli.execJson<BeadsIssue[]>(['list', '--id', issueId]);

    if (!result || result.length === 0) {
      throw new NotFoundError(`Issue ${issueId} not found`);
    }

    return result[0];
  }

  /**
   * Update an issue
   */
  async updateIssue(
    issueId: string,
    updates: UpdateBeadsIssueParams
  ): Promise<BeadsIssue> {
    const args = ['update', issueId];

    if (updates.title !== undefined) {
      args.push('--title', updates.title);
    }

    if (updates.description !== undefined) {
      args.push('--description', updates.description);
    }

    if (updates.design !== undefined) {
      args.push('--design', updates.design);
    }

    if (updates.acceptance_criteria !== undefined) {
      args.push('--acceptance-criteria', updates.acceptance_criteria);
    }

    if (updates.status !== undefined) {
      args.push('--status', updates.status);
    }

    if (updates.priority !== undefined) {
      args.push('--priority', updates.priority.toString());
    }

    if (updates.assignee !== undefined) {
      args.push('--assignee', updates.assignee);
    }

    if (updates.notes !== undefined) {
      args.push('--notes', updates.notes);
    }

    if (updates.external_ref !== undefined) {
      args.push('--external-ref', updates.external_ref);
    }

    await this.bdCli.exec(args);

    return this.getIssue(issueId);
  }

  /**
   * List issues with optional filters
   */
  async listIssues(query: BeadsListQuery = {}): Promise<BeadsIssue[]> {
    const args = ['list'];

    if (query.status) {
      args.push('--status', query.status);
    }

    if (query.priority !== undefined) {
      args.push('--priority', query.priority.toString());
    }

    if (query.type) {
      args.push('--type', query.type);
    }

    if (query.assignee) {
      args.push('--assignee', query.assignee);
    }

    if (query.labels && query.labels.length > 0) {
      for (const label of query.labels) {
        args.push('--label', label);
      }
    }

    if (query.limit) {
      args.push('--limit', query.limit.toString());
    }

    return this.bdCli.execJson<BeadsIssue[]>(args);
  }

  /**
   * Close an issue
   */
  async closeIssue(issueId: string, reason?: string): Promise<void> {
    const args = ['close', issueId];

    if (reason) {
      args.push('--reason', reason);
    }

    await this.bdCli.exec(args);
  }

  // ============================================================================
  // Epic Status Calculation
  // ============================================================================

  /**
   * Get epic children as full dependency tree
   */
  async getEpicChildrenTree(epicId: string): Promise<DependencyTreeNode> {
    return this.treeBuilder.getEpicChildrenTree(this.repositoryPath, epicId, this.bdCli);
  }

  /**
   * Calculate epic status
   */
  async getEpicStatus(epicId: string): Promise<EpicStatus> {
    return this.statusCalculator.getEpicStatus(this.repositoryPath, epicId, this.bdCli);
  }

  // ============================================================================
  // Dependency Operations
  // ============================================================================

  /**
   * Add a dependency between two issues
   */
  async addDependency(
    issueId: string,
    dependsOnId: string,
    depType: BeadsDependencyType = 'blocks'
  ): Promise<void> {
    await this.bdCli.exec(['dep', 'add', issueId, dependsOnId, '--type', depType]);
  }

  /**
   * Get dependency tree for an issue
   */
  async getDependencyTree(issueId: string): Promise<DependencyTreeNode> {
    const issue = await this.getIssue(issueId);
    return this.treeBuilder.buildDependencyTree(this.repositoryPath, issue, 0);
  }

  // ============================================================================
  // Discovery Detection
  // ============================================================================

  /**
   * Get all discovered issues since a given date
   */
  async getDiscoveredIssues(since?: Date): Promise<BeadsIssue[]> {
    const allIssues = await this.listIssues({ status: 'open' });

    const discovered: BeadsIssue[] = [];

    for (const issue of allIssues) {
      if (issue.dependencies && Array.isArray(issue.dependencies)) {
        const hasDiscoveredFrom = issue.dependencies.some(
          d => d.dependency_type === 'discovered-from'
        );

        if (hasDiscoveredFrom) {
          if (since) {
            const createdAt = new Date(issue.created_at);
            if (createdAt >= since) {
              discovered.push(issue);
            }
          } else {
            discovered.push(issue);
          }
        }
      }
    }

    return discovered;
  }

  /**
   * Get epic with all its subtasks
   */
  async getEpicWithSubtasks(epicId: string): Promise<{
    epic: BeadsIssue;
    subtasks: BeadsIssue[];
  }> {
    const epic = await this.getIssue(epicId);
    const tree = await this.getEpicChildrenTree(epicId);
    const subtasks = this.statusCalculator.flattenDependencyTree(tree);

    return { epic, subtasks };
  }

  // ============================================================================
  // Internal accessor for BdCli (used by tree builder and status calculator)
  // ============================================================================
  
  /** @internal */
  getBdCli(): BdCli {
    return this.bdCli;
  }
}
```

**Step 2: Update BeadsClient tests**

Rewrite `src/beads-bridge/tests/clients/beads-client.test.ts` to use the simplified API:

```typescript
/**
 * Unit tests for BeadsClient
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { BeadsClient } from '../../src/clients/beads-client.js';
import type {
  BeadsConfig,
  BeadsIssue,
  CreateBeadsIssueParams,
  UpdateBeadsIssueParams,
  BeadsDependency
} from '../../src/types/beads.js';
import { NotFoundError } from '../../src/types/index.js';
import { BdCli } from '../../src/utils/bd-cli.js';

// Mock the BdCli module
let mockBdCliInstance: any;
mock.module('../../src/utils/bd-cli.js', () => ({
  BdCli: mock(() => mockBdCliInstance)
}));

describe('BeadsClient', () => {
  let client: BeadsClient;

  const mockConfig: BeadsConfig = {
    repositoryPath: '/path/to/test-repo',
    prefix: 'test'
  };

  const mockIssue: BeadsIssue = {
    id: 'test-123',
    content_hash: 'abc123',
    title: 'Test Issue',
    description: 'Test description',
    status: 'open',
    priority: 2,
    issue_type: 'task',
    created_at: '2025-11-05T10:00:00Z',
    updated_at: '2025-11-05T10:00:00Z',
    labels: [],
    dependencies: [],
    dependents: []
  };

  beforeEach(() => {
    mockBdCliInstance = {
      exec: mock(),
      execJson: mock(),
      execTree: mock(),
      execTreeJson: mock(),
      getCwd: mock()
    };

    client = new BeadsClient(mockConfig);
  });

  // ============================================================================
  // Repository Info
  // ============================================================================

  describe('Repository Info', () => {
    it('should return repository path', () => {
      expect(client.getRepositoryPath()).toBe('/path/to/test-repo');
    });

    it('should return prefix', () => {
      expect(client.getPrefix()).toBe('test');
    });
  });

  // ============================================================================
  // List Operations
  // ============================================================================

  describe('List Operations', () => {
    it('should list all issues without filters', async () => {
      const mockIssues = [mockIssue, { ...mockIssue, id: 'test-456' }];
      mockBdCliInstance.execJson.mockResolvedValue(mockIssues);

      const issues = await client.listIssues();

      expect(mockBdCliInstance.execJson).toHaveBeenCalledWith(['list']);
      expect(issues).toEqual(mockIssues);
    });

    it('should list issues with status filter', async () => {
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      await client.listIssues({ status: 'open' });

      expect(mockBdCliInstance.execJson).toHaveBeenCalledWith(['list', '--status', 'open']);
    });

    it('should list issues with multiple filters', async () => {
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      await client.listIssues({
        status: 'in_progress',
        priority: 1,
        type: 'feature',
        assignee: 'dev1'
      });

      const call = mockBdCliInstance.execJson.mock.calls[0][0];
      expect(call).toContain('list');
      expect(call).toContain('--status');
      expect(call).toContain('in_progress');
    });
  });

  // ============================================================================
  // Get Operations
  // ============================================================================

  describe('Get Operations', () => {
    it('should get issue by ID', async () => {
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      const issue = await client.getIssue('test-123');

      expect(mockBdCliInstance.execJson).toHaveBeenCalledWith(['list', '--id', 'test-123']);
      expect(issue).toEqual(mockIssue);
    });

    it('should throw NotFoundError when issue does not exist', async () => {
      mockBdCliInstance.execJson.mockResolvedValue([]);

      await expect(client.getIssue('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  // ============================================================================
  // Create Operations
  // ============================================================================

  describe('Create Operations', () => {
    it('should create issue with minimal fields', async () => {
      const params: CreateBeadsIssueParams = {
        title: 'New Issue'
      };

      mockBdCliInstance.execJson.mockResolvedValue(mockIssue);

      const issue = await client.createIssue(params);

      expect(mockBdCliInstance.execJson).toHaveBeenCalledWith(expect.arrayContaining([
        'create',
        'New Issue'
      ]));
      expect(issue).toEqual(mockIssue);
    });
  });

  // ============================================================================
  // Update Operations
  // ============================================================================

  describe('Update Operations', () => {
    it('should update issue with single field', async () => {
      const updates: UpdateBeadsIssueParams = {
        status: 'in_progress'
      };

      mockBdCliInstance.exec.mockResolvedValue({ stdout: '', stderr: '' });
      mockBdCliInstance.execJson.mockResolvedValue([{ ...mockIssue, status: 'in_progress' }]);

      const issue = await client.updateIssue('test-123', updates);

      expect(mockBdCliInstance.exec).toHaveBeenCalledWith(['update', 'test-123', '--status', 'in_progress']);
      expect(issue.status).toBe('in_progress');
    });
  });

  // ============================================================================
  // Close Operations
  // ============================================================================

  describe('Close Operations', () => {
    it('should close issue without reason', async () => {
      mockBdCliInstance.exec.mockResolvedValue({ stdout: '', stderr: '' });

      await client.closeIssue('test-123');

      expect(mockBdCliInstance.exec).toHaveBeenCalledWith(['close', 'test-123']);
    });

    it('should close issue with reason', async () => {
      mockBdCliInstance.exec.mockResolvedValue({ stdout: '', stderr: '' });

      await client.closeIssue('test-123', 'Duplicate');

      expect(mockBdCliInstance.exec).toHaveBeenCalledWith(['close', 'test-123', '--reason', 'Duplicate']);
    });
  });

  // ============================================================================
  // Dependency Operations
  // ============================================================================

  describe('Dependency Operations', () => {
    it('should add dependency with default type', async () => {
      mockBdCliInstance.exec.mockResolvedValue({ stdout: '', stderr: '' });

      await client.addDependency('test-123', 'test-456');

      expect(mockBdCliInstance.exec).toHaveBeenCalledWith(['dep', 'add', 'test-123', 'test-456', '--type', 'blocks']);
    });
  });
});
```

**Step 3: Run tests**

Run: `cd src/beads-bridge && bun test tests/clients/beads-client.test.ts`

Expected: PASS

**Step 4: Commit**

```bash
git add src/beads-bridge/src/clients/beads-client.ts src/beads-bridge/tests/clients/beads-client.test.ts
git commit -m "refactor(beads-bridge): simplify BeadsClient for single repository"
```

---

## Task 4: Update ConfigManager with Auto-Detection

**Files:**
- Modify: `src/beads-bridge/src/config/config-manager.ts`

**Step 1: Update ConfigManager to auto-detect repository**

Replace validation and loading logic in `src/beads-bridge/src/config/config-manager.ts`:

```typescript
/**
 * Configuration manager for loading, validating, and accessing configuration
 */

import { promises as fs } from 'fs';
import { resolve, isAbsolute } from 'path';
import {
  Config,
  DEFAULT_CONFIG,
  ENV_VARS,
  ConfigValidationError,
  LogLevel,
  BackendType,
  RepositoryPathConfig,
  GitHubConfig,
  ShortcutConfig,
} from '../types/config.js';
import { detectRepository, extractPrefixFromIssues } from '../utils/repo-detector.js';
import { needsMigration, migrateConfig, getMigrationNotes } from './migration.js';

/**
 * ConfigManager handles configuration loading, validation, and access
 */
export class ConfigManager {
  private config: Config;
  private resolvedRepositoryPath: string | null = null;
  private resolvedPrefix: string | undefined;

  constructor(config?: Partial<Config>) {
    this.config = this.mergeWithDefaults(config || {});
  }

  /**
   * Load configuration from file
   */
  static async fromFile(configPath: string): Promise<ConfigManager> {
    const absolutePath = isAbsolute(configPath) ? configPath : resolve(configPath);

    try {
      const fileContent = await fs.readFile(absolutePath, 'utf-8');
      let fileConfig = JSON.parse(fileContent);

      // Auto-migrate if needed
      if (needsMigration(fileConfig)) {
        console.log('Migrating configuration from v1.0 to v2.0...');
        fileConfig = migrateConfig(fileConfig);

        // Save migrated config
        await fs.writeFile(absolutePath, JSON.stringify(fileConfig, null, 2), 'utf-8');

        const notes = getMigrationNotes();
        notes.forEach(note => console.log(`  i ${note}`));
        console.log('Configuration migrated successfully\n');
      }

      const manager = new ConfigManager(fileConfig);
      return manager;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new ConfigValidationError(`Configuration file not found: ${absolutePath}`);
      }
      throw new ConfigValidationError(`Failed to load configuration: ${(error as Error).message}`);
    }
  }

  /**
   * Load configuration from environment variables
   */
  static fromEnvironment(): ConfigManager {
    const envConfig: Partial<Config> = {};

    if (process.env[ENV_VARS.GITHUB_REPO]) {
      envConfig.github = {
        ...DEFAULT_CONFIG.github,
        repository: process.env[ENV_VARS.GITHUB_REPO]!,
      };
    }

    if (process.env[ENV_VARS.GITHUB_PROJECT_ID]) {
      envConfig.github = {
        ...(envConfig.github || DEFAULT_CONFIG.github),
        projectId: process.env[ENV_VARS.GITHUB_PROJECT_ID],
      };
    }

    if (process.env[ENV_VARS.LOG_LEVEL]) {
      const logLevel = process.env[ENV_VARS.LOG_LEVEL]!.toLowerCase() as LogLevel;
      envConfig.logging = {
        ...DEFAULT_CONFIG.logging,
        level: logLevel,
      };
    }

    return new ConfigManager(envConfig);
  }

  /**
   * Load configuration with auto-detection
   * Priority: file config -> env vars -> auto-detect -> defaults
   */
  static async load(configPath?: string): Promise<ConfigManager> {
    let manager: ConfigManager;

    // Try to load from file if path provided or env var set
    const filePath = configPath || process.env[ENV_VARS.CONFIG_PATH];
    if (filePath) {
      try {
        manager = await ConfigManager.fromFile(filePath);
      } catch (error) {
        // If file not found, start with defaults
        manager = new ConfigManager();
      }
    } else {
      manager = new ConfigManager();
    }

    // Override with environment variables
    manager.applyEnvironmentOverrides();

    // Auto-detect repository if not configured
    await manager.autoDetectRepository();

    // Validate configuration
    manager.validate();

    return manager;
  }

  /**
   * Auto-detect repository path if not explicitly configured
   */
  private async autoDetectRepository(): Promise<void> {
    // If repository path is explicitly configured, use it
    if (this.config.repository?.path) {
      this.resolvedRepositoryPath = isAbsolute(this.config.repository.path)
        ? this.config.repository.path
        : resolve(this.config.repository.path);
      this.resolvedPrefix = this.config.repository.prefix;
      return;
    }

    // Auto-detect from current working directory
    const detected = detectRepository();
    if (detected) {
      this.resolvedRepositoryPath = detected.path;
      // Auto-detect prefix if not configured
      this.resolvedPrefix = this.config.repository?.prefix || extractPrefixFromIssues(detected.path);
    }
  }

  /**
   * Get full configuration
   */
  getConfig(): Readonly<Config> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Get backend type
   */
  getBackend(): BackendType {
    return this.config.backend;
  }

  /**
   * Get GitHub configuration
   */
  getGitHub(): Readonly<GitHubConfig> {
    return Object.freeze({ ...this.config.github });
  }

  /**
   * Get Shortcut configuration
   */
  getShortcut(): Readonly<ShortcutConfig> | undefined {
    return this.config.shortcut ? Object.freeze({ ...this.config.shortcut }) : undefined;
  }

  /**
   * Get repository path (resolved, absolute)
   */
  getRepositoryPath(): string | null {
    return this.resolvedRepositoryPath;
  }

  /**
   * Get issue prefix
   */
  getPrefix(): string | undefined {
    return this.resolvedPrefix;
  }

  /**
   * Get logging configuration
   */
  getLogging(): Readonly<Config['logging']> {
    return Object.freeze({ ...this.config.logging });
  }

  /**
   * Get diagrams configuration
   */
  getDiagrams(): Readonly<Config['diagrams']> | undefined {
    return this.config.diagrams ? Object.freeze({ ...this.config.diagrams }) : undefined;
  }

  /**
   * Validate configuration
   */
  validate(): void {
    // Validate version
    if (!this.config.version) {
      throw new ConfigValidationError('Configuration version is required', 'version');
    }

    // Validate backend
    const validBackends: BackendType[] = ['github', 'shortcut'];
    if (!validBackends.includes(this.config.backend)) {
      throw new ConfigValidationError(
        `Invalid backend: ${this.config.backend}`,
        'backend',
        this.config.backend
      );
    }

    // Validate GitHub configuration (only if GitHub config is present)
    if (this.config.github) {
      if (!this.config.github.repository) {
        throw new ConfigValidationError(
          'GitHub repository is required in github configuration',
          'github.repository'
        );
      }

      // Validate repository format (owner/repo)
      if (!/^[\w.-]+\/[\w.-]+$/.test(this.config.github.repository)) {
        throw new ConfigValidationError(
          `Invalid GitHub repository format: ${this.config.github.repository}`,
          'github.repository',
          this.config.github.repository
        );
      }
    }

    // Validate Shortcut configuration (only if Shortcut config is present)
    if (this.config.shortcut) {
      if (!this.config.shortcut.workspace) {
        throw new ConfigValidationError(
          'Shortcut workspace is required in shortcut configuration',
          'shortcut.workspace'
        );
      }
    }

    // Repository path is optional - can be auto-detected
    // Only validate if explicitly provided
    if (this.config.repository?.path && !this.resolvedRepositoryPath) {
      throw new ConfigValidationError(
        `Repository path does not exist or is not a beads repo: ${this.config.repository.path}`,
        'repository.path',
        this.config.repository.path
      );
    }

    // Validate log level
    const validLogLevels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
    if (!validLogLevels.includes(this.config.logging.level)) {
      throw new ConfigValidationError(
        `Invalid log level: ${this.config.logging.level}`,
        'logging.level',
        this.config.logging.level
      );
    }
  }

  /**
   * Merge configuration with defaults
   */
  private mergeWithDefaults(config: Partial<Config>): Config {
    return {
      ...DEFAULT_CONFIG,
      ...config,
      github: { ...DEFAULT_CONFIG.github, ...config.github },
      logging: { ...DEFAULT_CONFIG.logging, ...config.logging },
    };
  }

  /**
   * Apply environment variable overrides
   */
  private applyEnvironmentOverrides(): void {
    if (process.env[ENV_VARS.GITHUB_REPO]) {
      this.config.github.repository = process.env[ENV_VARS.GITHUB_REPO]!;
    }

    if (process.env[ENV_VARS.GITHUB_PROJECT_ID]) {
      this.config.github.projectId = process.env[ENV_VARS.GITHUB_PROJECT_ID];
    }

    if (process.env[ENV_VARS.LOG_LEVEL]) {
      this.config.logging.level = process.env[ENV_VARS.LOG_LEVEL]!.toLowerCase() as LogLevel;
    }
  }
}
```

**Step 2: Run tests**

Run: `cd src/beads-bridge && bun test`

Expected: Some tests may still fail due to downstream dependencies

**Step 3: Commit**

```bash
git add src/beads-bridge/src/config/config-manager.ts
git commit -m "refactor(beads-bridge): add auto-detection to ConfigManager"
```

---

## Task 5: Update Serve Command

**Files:**
- Modify: `src/beads-bridge/src/cli/commands/serve.ts`

**Step 1: Simplify serve command to use auto-detected path**

Replace `src/beads-bridge/src/cli/commands/serve.ts`:

```typescript
import { Command } from 'commander';
import { createServer } from 'node:net';
import { LiveWebBackend } from '../../backends/liveweb.js';
import { ExpressServer } from '../../server/express-server.js';
import { PollingService } from '../../server/polling-service.js';
import { BeadsClient } from '../../clients/beads-client.js';
import type { DependencyTreeNode, BeadsIssue } from '../../types/beads.js';
import { execBdCommand } from '../../utils/bd-cli.js';
import { ConfigManager } from '../../config/config-manager.js';
import { open } from '../../utils/open-browser.js';
import { Logger, type LogLevel } from '../../monitoring/logger.js';

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = createServer();
    tester.unref();

    tester.once('error', () => {
      resolve(false);
    });

    tester.once('listening', () => {
      tester.close(() => resolve(true));
    });

    tester.listen(port, '0.0.0.0');
  });
}

export async function findAvailablePortInRange(start: number, end: number): Promise<number> {
  for (let port = start; port < end; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`No available ports found between ${start} and ${end - 1}`);
}

function parseLogLevel(level: string): LogLevel {
  const upperLevel = level.toUpperCase() as LogLevel;
  if (['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(upperLevel)) {
    return upperLevel;
  }
  throw new Error(`Invalid log level: ${level}. Must be one of: DEBUG, INFO, WARN, ERROR`);
}

export function createServeCommand(): Command {
  return new Command('serve')
    .description('Start live web dashboard for a beads issue')
    .argument('<issue-id>', 'Beads issue ID to visualize')
    .option('-p, --port <number>', 'Server port')
    .option('--poll-interval <seconds>', 'Polling interval in seconds', '5')
    .option('--log-level <level>', 'Log level (DEBUG|INFO|WARN|ERROR)', 'INFO')
    .option('--no-open', 'Do not auto-open browser')
    .action(async (issueId: string, options) => {
      let logLevel: LogLevel;
      try {
        logLevel = parseLogLevel(options.logLevel);
      } catch (error) {
        console.error(`Invalid log level: ${options.logLevel}. Must be one of: DEBUG, INFO, WARN, ERROR`);
        process.exit(1);
      }
      const baseLogger = new Logger({ level: logLevel });
      const logger = baseLogger.withScope('ServeCommand');

      try {
        const requestedPort = options.port ? parseInt(options.port, 10) : undefined;
        const port =
          typeof requestedPort === 'number' && Number.isFinite(requestedPort)
            ? requestedPort
            : await findAvailablePortInRange(3000, 4000);

        if (!requestedPort && port !== 3000) {
          logger.info(`Port 3000 is busy, using ${port} instead.`);
        }

        const pollInterval = parseInt(options.pollInterval, 10);

        // Validate issue exists
        logger.info(`Validating issue ${issueId}...`);
        try {
          await execBdCommand(['show', issueId], logger);
        } catch (error) {
          logger.error(`Error: Issue ${issueId} not found`, error as Error);
          process.exit(1);
        }

        // Load config with auto-detection
        const configManager = await ConfigManager.load(process.env.BEADS_GITHUB_CONFIG || '.beads-bridge/config.json');
        const repositoryPath = configManager.getRepositoryPath();

        if (!repositoryPath) {
          logger.error('Could not detect beads repository. Run from a directory with .beads/ or configure repository.path in config.json');
          process.exit(1);
        }

        const beadsClient = new BeadsClient({
          repositoryPath,
          prefix: configManager.getPrefix(),
          logger: baseLogger
        });

        // Initialize backend and server with repository path
        const backendLogger = baseLogger.withScope('LiveWebBackend');
        const backend = new LiveWebBackend(repositoryPath, undefined, backendLogger);
        const serverLogger = baseLogger.withScope('ExpressServer');
        const server = new ExpressServer(backend, port, undefined, serverLogger);

        const updateState = async () => {
          logger.info(`Updating state for ${issueId}...`);

          // Get all issues in tree using bd dep tree
          const tree = await beadsClient.getEpicChildrenTree(issueId);

          type FlattenedNode = { issue: BeadsIssue; parentId?: string; depth: number };
          const flattenTree = (node: DependencyTreeNode, parentId?: string, depth: number = 0): FlattenedNode[] => {
            const current: FlattenedNode = { issue: node.issue, parentId, depth };
            const children = node.dependencies.flatMap((child) =>
              flattenTree(child, node.issue.id, depth + 1)
            );
            return [current, ...children];
          };

          const flattened = flattenTree(tree);

          const edges = flattened
            .filter((entry) => entry.parentId)
            .map((entry) => ({
              id: `${entry.parentId}-${entry.issue.id}`,
              source: entry.parentId as string,
              target: entry.issue.id,
            }));

          const issues = flattened.map((entry, idx) => ({
            id: entry.issue.id,
            number: idx + 1,
            title: entry.issue.title,
            body: entry.issue.description || '',
            state: entry.issue.status === 'closed' ? ('closed' as const) : ('open' as const),
            url: `http://localhost:${port}/issue/${entry.issue.id}`,
            labels: (entry.issue.labels || []).map(label => ({ id: label, name: label })),
            assignees: entry.issue.assignee ? [{ id: entry.issue.assignee, login: entry.issue.assignee }] : [],
            createdAt: new Date(entry.issue.created_at),
            updatedAt: new Date(entry.issue.updated_at),
            metadata: {
              beadsStatus: entry.issue.status,
              beadsPriority: entry.issue.priority,
              beadsType: entry.issue.issue_type,
              parentId: entry.parentId ?? null,
              depth: entry.depth,
            },
          }));

          const metrics = {
            total: issues.length,
            completed: issues.filter((i) => i.metadata.beadsStatus === 'closed').length,
            inProgress: issues.filter((i) => i.metadata.beadsStatus === 'in_progress').length,
            blocked: issues.filter((i) => i.metadata.beadsStatus === 'blocked').length,
            open: issues.filter((i) => i.metadata.beadsStatus === 'open').length,
          };

          backend.updateState(issueId, {
            metrics,
            issues,
            edges,
            rootId: tree.issue.id,
            lastUpdate: new Date(),
          });
        };

        const onError = (error: Error) => {
          logger.error('Polling error:', error);
          server.getBroadcaster().broadcast({
            type: 'error',
            message: error.message,
          });
        };

        const polling = new PollingService(updateState, pollInterval, onError);

        logger.info('Initializing state...');
        try {
          await updateState();
        } catch (error) {
          logger.error('Failed to initialize state:', error as Error);
          process.exit(1);
        }

        await server.start();
        polling.start();

        if (options.open) {
          const url = `http://localhost:${port}/issue/${issueId}`;
          await open(url);
        }

        logger.info(`Dashboard running at http://localhost:${port}/issue/${issueId}`);
        logger.info('Press Ctrl+C to stop');

        process.on('SIGINT', () => {
          logger.info('Shutting down dashboard...');
          polling.stop();
          server.stop().then(() => {
            process.exit(0);
          });
        });
      } catch (error) {
        const errorLogger = new Logger({ level: logLevel }).withScope('ServeCommand');
        errorLogger.error('Failed to start server:', error as Error);
        process.exit(1);
      }
    });
}
```

**Step 2: Commit**

```bash
git add src/beads-bridge/src/cli/commands/serve.ts
git commit -m "refactor(beads-bridge): simplify serve command with auto-detection"
```

---

## Task 6: Update Dependent Components

**Files:**
- Modify: `src/beads-bridge/src/skill.ts`
- Modify: `src/beads-bridge/src/services/dependency-tree-builder.ts`
- Modify: `src/beads-bridge/src/services/epic-status-calculator.ts`
- Modify: `src/beads-bridge/src/utils/external-ref-resolver.ts`

**Step 1: Update skill.ts**

In `src/beads-bridge/src/skill.ts`, update BeadsClient initialization:

```typescript
// Change from:
// const beadsRepos = config.repositories.map(repo => ({
//   name: repo.name,
//   path: repo.path,
//   prefix: repo.prefix || repo.name
// }));
// this.beads = new BeadsClient({ repositories: beadsRepos });

// To:
const repositoryPath = configManager.getRepositoryPath();
if (!repositoryPath) {
  throw new Error('Repository path not configured and could not be auto-detected');
}
this.beads = new BeadsClient({
  repositoryPath,
  prefix: configManager.getPrefix()
});
```

**Step 2: Update DependencyTreeBuilder**

The tree builder methods take `repository: string` as first param. Since we now have single-repo, we can simplify by removing the repository parameter or keeping it for interface consistency but ignoring it.

For minimal changes, we can keep the signature but the BeadsClient will just ignore the repository name since it's single-repo.

**Step 3: Update external-ref-resolver.ts**

This file iterates over `repositories`. Simplify to work with single repo.

**Step 4: Run all tests**

Run: `cd src/beads-bridge && bun test`

Fix any remaining failures.

**Step 5: Commit**

```bash
git add src/beads-bridge/src/skill.ts src/beads-bridge/src/services/ src/beads-bridge/src/utils/external-ref-resolver.ts
git commit -m "refactor(beads-bridge): update dependent components for single-repo"
```

---

## Task 7: Remove Legacy Multi-Repo Code

**Files:**
- Modify: `src/beads-bridge/src/clients/beads-client.ts` (remove getMultiRepoEpicStatus, getAllIssues)
- Delete or modify: Files that only supported multi-repo

**Step 1: Remove multi-repo methods from BeadsClient**

Remove these methods if they exist:
- `getMultiRepoEpicStatus()`
- `getAllIssues()` (the multi-repo version that returns `Map<string, BeadsIssue[]>`)

**Step 2: Clean up tests**

Remove test cases for multi-repo functionality.

**Step 3: Commit**

```bash
git add -u
git commit -m "chore(beads-bridge): remove legacy multi-repo code"
```

---

## Task 8: Update Documentation and Config Examples

**Files:**
- Modify: `.beads-bridge/config.json` (simplify example)
- Modify: `plugins/beads-bridge/README.md`

**Step 1: Update example config**

Change `.beads-bridge/config.json` to minimal:

```json
{
  "version": "2.0",
  "backend": "github",
  "github": {
    "repository": "mrdavidlaing/wellmaintained-skills"
  },
  "logging": {
    "level": "info"
  }
}
```

Note: `repository` section is now optional - it auto-detects from cwd.

**Step 2: Update README**

Document the new auto-detection behavior.

**Step 3: Commit**

```bash
git add .beads-bridge/config.json plugins/beads-bridge/README.md
git commit -m "docs(beads-bridge): update config examples for auto-detection"
```

---

## Task 9: Final Verification

**Step 1: Run all tests**

Run: `cd src/beads-bridge && bun test`

Expected: All tests pass

**Step 2: Test serve command manually**

Run: `cd /home/mrdavidlaing/arch-workspace/wellmaintained-skills && bun run src/beads-bridge/src/cli.ts serve wms-yun --no-open`

Expected: Server starts without requiring explicit repository config

**Step 3: Close the issue**

```bash
bd close wms-v5e --reason "Implemented auto-detection, removed multi-repo support"
```

---

## Verification Checklist

- [ ] `bun test` passes in `src/beads-bridge`
- [ ] `beads-bridge serve <issue-id>` works without config file
- [ ] `beads-bridge sync <issue-id>` works without config file
- [ ] Config file with explicit `repository.path` still works
- [ ] Auto-detection finds `.beads/` in parent directories
- [ ] Prefix is auto-detected from `issues.jsonl`

---

Plan complete and saved to `docs/plans/2025-11-28-remove-multi-repo-support.md`.

**Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
