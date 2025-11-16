/**
 * Beads CLI wrapper utilities
 *
 * Provides a type-safe wrapper around the bd CLI for executing
 * commands across multiple repositories.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { BackendError, NotFoundError } from '../types/index.js';
import type { Logger } from '../monitoring/logger.js';

const execFileAsync = promisify(execFile);

/**
 * Check if we're currently in a git worktree
 * Worktrees have git directories like .git/worktrees/<name>
 */
async function isGitWorktree(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--git-dir'], {
      timeout: 5000,
    });
    return stdout.trim().includes('/worktrees/');
  } catch {
    // Not in a git repo or git not available
    return false;
  }
}

// Cache the worktree detection result for performance
let isWorktreeCache: boolean | null = null;
async function shouldUseAllowStale(): Promise<boolean> {
  if (isWorktreeCache === null) {
    isWorktreeCache = await isGitWorktree();
  }
  return isWorktreeCache;
}

function logBdCommand(args: string[], logger?: Logger, cwd?: string): void {
  if (logger) {
    const commandStr = args.join(' ');
    logger.debug(`bd ${commandStr}`, cwd ? { cwd } : undefined);
  } else {
    const prefix = cwd ? `[bd:${cwd}]` : '[bd]';
    console.log(prefix, 'bd', args.join(' '));
  }
}

/**
 * Execute a bd command in the current working directory
 * Simple wrapper for CLI commands that don't need repository context
 */
export async function execBdCommand(args: string[], logger?: Logger): Promise<string> {
  try {
    // Add --allow-stale flag to work around staleness issues in git worktrees
    const finalArgs = [...args];
    if (await shouldUseAllowStale() && !finalArgs.includes('--allow-stale')) {
      finalArgs.push('--allow-stale');
    }

    logBdCommand(finalArgs, logger);
    const { stdout } = await execFileAsync('bd', finalArgs, {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    return stdout;
  } catch (error: any) {
    throw new BackendError(
      `bd command failed: ${error.message}`,
      'BD_CLI_ERROR',
      undefined,
      error
    );
  }
}

export interface BdCliOptions {
  /** Working directory (repository path) */
  cwd: string;

  /** Maximum timeout for bd commands in milliseconds */
  timeout?: number;

  /** Optional logger for command execution logging */
  logger?: Logger;
}

export interface BdExecResult {
  stdout: string;
  stderr: string;
}

/**
 * Result from detectChangedIssues operation
 */
export interface ChangedIssuesResult {
  /** List of Beads issue IDs that changed */
  changedIssueIds: string[];

  /** Map of external_ref to epic issue ID */
  affectedEpics: Map<string, string>;
}

/**
 * Execute a bd CLI command and return parsed JSON output
 */
export class BdCli {
  private readonly cwd: string;
  private readonly timeout: number;
  private readonly logger?: Logger;

  constructor(options: BdCliOptions & { logger?: Logger }) {
    this.cwd = options.cwd;
    this.timeout = options.timeout || 30000; // 30s default
    // Create a scoped logger for BdCli if a logger is provided
    this.logger = options.logger ? options.logger.withScope('BdCli') : undefined;
  }

  /**
   * Execute a bd CLI command
   *
   * @param args - Command arguments (e.g., ['list', '--status', 'open', '--json'])
   * @returns Command output
   * @throws {NotFoundError} if resource not found
   * @throws {BackendError} for other errors
   */
  async exec(args: string[]): Promise<BdExecResult> {
    // Validate that the working directory exists before attempting to execute
    if (!existsSync(this.cwd)) {
      throw new BackendError(
        `Repository path does not exist: ${this.cwd}. Check your .beads-bridge/config.json`,
        'INVALID_REPO_PATH'
      );
    }

    try {
      // Add --allow-stale flag to work around staleness issues in git worktrees
      const finalArgs = [...args];
      if (await shouldUseAllowStale() && !finalArgs.includes('--allow-stale')) {
        finalArgs.push('--allow-stale');
      }

      logBdCommand(finalArgs, this.logger, this.cwd);
      const { stdout, stderr } = await execFileAsync('bd', finalArgs, {
        timeout: this.timeout,
        cwd: this.cwd,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large responses
      });

      return { stdout, stderr };
    } catch (error: any) {
      throw this.handleExecError(error, args);
    }
  }

  /**
   * Execute a bd CLI command and parse JSON output
   *
   * @param args - Command arguments (must include --json flag)
   * @returns Parsed JSON result
   */
  async execJson<T = any>(args: string[]): Promise<T> {
    // Ensure --json flag is present
    if (!args.includes('--json')) {
      args.push('--json');
    }

    const { stdout } = await this.exec(args);

    try {
      return JSON.parse(stdout) as T;
    } catch (error) {
      throw new BackendError(
        `Failed to parse JSON response from bd CLI`,
        'JSON_PARSE_ERROR',
        undefined,
        error as Error
      );
    }
  }

  /**
   * Get the current working directory
   */
  getCwd(): string {
    return this.cwd;
  }


  /**
   * Detect changed beads issues by comparing local and remote beads-metadata branches
   *
   * POC A: Correct implementation that:
   * 1. Compares local beads-metadata with origin/beads-metadata
   * 2. Parses git diff to find changed issue IDs
   * 3. Walks up dependency tree to find external_ref for each changed issue
   * 4. Returns map of external_ref to epic issue ID
   *
   * @returns Changed issue IDs and affected epics with external_ref
   */
  async detectChangedIssues(): Promise<ChangedIssuesResult> {
    const gitDiff = await this.getBeadsMetadataDiff();
    const changedIssueIds = this.parseChangedIssueIds(gitDiff);

    if (changedIssueIds.length === 0) {
      return { changedIssueIds: [], affectedEpics: new Map() };
    }

    const affectedEpics = await this.mapIssuesToExternalRefs(changedIssueIds);

    return { changedIssueIds, affectedEpics };
  }

  /**
   * Get git diff between local and remote beads-metadata branches
   * @returns Git diff output or empty string on error
   */
  private async getBeadsMetadataDiff(): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git',
        ['diff', 'origin/beads-metadata', 'beads-metadata', '--', '.beads/issues.jsonl'],
        { cwd: this.cwd, timeout: this.timeout }
      );
      return stdout;
    } catch (error: any) {
      // Branch doesn't exist or other git error - return empty diff
      if (error.code === 128 || error.message?.includes('unknown revision')) {
        return '';
      }
      throw this.handleExecError(error, ['diff beads-metadata']);
    }
  }

  /**
   * Parse git diff to extract changed issue IDs
   * @param gitDiff - Git diff output
   * @returns Array of changed issue IDs
   */
  private parseChangedIssueIds(gitDiff: string): string[] {
    if (!gitDiff) return [];

    const issueIds = new Set<string>();

    for (const line of gitDiff.split('\n')) {
      if (!line.startsWith('+{')) continue;

      try {
        const json = JSON.parse(line.substring(1));
        if (json.id) {
          issueIds.add(json.id);
        }
      } catch {
        // Skip invalid JSON lines
      }
    }

    return Array.from(issueIds);
  }

  /**
   * Map changed issues to their external_refs by walking dependency tree
   * @param issueIds - Array of changed issue IDs
   * @returns Map of external_ref to epic issue ID
   */
  private async mapIssuesToExternalRefs(issueIds: string[]): Promise<Map<string, string>> {
    const affectedEpics = new Map<string, string>();

    // Cache the list of all issues to avoid repeated calls
    const allIssues = await this.getAllIssues();

    for (const issueId of issueIds) {
      const externalRef = await this.findExternalRef(issueId);
      if (!externalRef) continue;

      // Find epic with this external_ref (if not already in map)
      if (!affectedEpics.has(externalRef)) {
        const epic = allIssues.find(issue => issue.external_ref === externalRef);
        if (epic) {
          affectedEpics.set(externalRef, epic.id);
        }
      }
    }

    return affectedEpics;
  }

  /**
   * Get all issues from beads (cached helper)
   * @returns Array of all issues
   */
  private async getAllIssues(): Promise<Array<{ id: string; external_ref?: string }>> {
    try {
      return await this.execJson<any[]>(['list', '--no-daemon', '--no-db']);
    } catch {
      return [];
    }
  }

  /**
   * Walk up dependency tree to find external_ref
   *
   * Recursively walks parent-child dependencies until it finds an issue
   * with an external_ref, or exhausts all parents.
   *
   * @param issueId - Issue ID to start from
   * @param visited - Set of visited issue IDs to prevent infinite loops
   * @returns external_ref if found, null otherwise
   */
  async findExternalRef(
    issueId: string,
    visited = new Set<string>()
  ): Promise<string | null> {
    // Prevent infinite loops in circular dependencies
    if (visited.has(issueId)) return null;
    visited.add(issueId);

    const issue = await this.getIssue(issueId);
    if (!issue) return null;

    // Found external_ref at this level
    if (issue.external_ref) {
      return issue.external_ref;
    }

    // Walk up to parent issues
    const parents = this.getParentDependencies(issue);
    for (const parentId of parents) {
      const parentRef = await this.findExternalRef(parentId, visited);
      if (parentRef) return parentRef;
    }

    return null;
  }

  /**
   * Get a single issue by ID
   * @param issueId - Issue ID
   * @returns Issue object or null if not found
   */
  private async getIssue(issueId: string): Promise<any | null> {
    try {
      const issues = await this.execJson<any[]>(['show', issueId, '--no-daemon']);
      return issues[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * Extract parent issue IDs from dependencies
   * @param issue - Issue object with dependencies
   * @returns Array of parent issue IDs
   */
  private getParentDependencies(issue: any): string[] {
    if (!issue.dependencies || !Array.isArray(issue.dependencies)) {
      return [];
    }

    return issue.dependencies
      .filter((dep: any) => dep.dependency_type === 'parent-child')
      .map((dep: any) => dep.id);
  }

  /**
   * Find issue by external_ref
   *
   * @param externalRef - External reference to search for
   * @returns Issue if found, null otherwise
   */
  async findIssueByExternalRef(externalRef: string): Promise<{ id: string } | null> {
    const issues = await this.getAllIssues();
    const issue = issues.find(i => i.external_ref === externalRef);
    return issue ? { id: issue.id } : null;
  }

  /**
   * Execute bd dep tree command
   *
   * @param issueId - Issue ID to get tree for
   * @param reverse - If true, shows dependents tree (children), otherwise shows dependencies tree
   * @returns Tree output as text
   */
  async execTree(issueId: string, reverse: boolean = true): Promise<string> {
    const args = ['dep', 'tree', issueId];
    if (reverse) {
      args.push('--reverse');
    }

    const { stdout } = await this.exec(args);
    return stdout;
  }

  /**
   * Execute bd dep tree command with JSON output
   *
   * @param issueId - Issue ID to get tree for
   * @param reverse - If true, shows dependents tree (children), otherwise shows dependencies tree
   * @returns Tree as array of issues with parent_id and depth
   */
  async execTreeJson<T = any>(issueId: string, reverse: boolean = true): Promise<T> {
    const args = ['dep', 'tree', issueId];
    if (reverse) {
      args.push('--reverse');
    }

    return this.execJson<T>(args);
  }


  /**
   * Handle execution errors and convert to typed errors
   */
  private handleExecError(error: any, args: string[]): Error {
    const message = error.message || String(error);
    const stderr = error.stderr || '';

    // Not found errors (issue doesn't exist)
    if (
      message.includes('not found') ||
      message.includes('does not exist') ||
      stderr.includes('not found')
    ) {
      return new NotFoundError(`Beads resource not found`, error);
    }

    // Timeout errors
    if (error.code === 'ETIMEDOUT' || message.includes('timeout')) {
      return new BackendError(
        `Command timed out after ${this.timeout}ms: bd ${args.join(' ')}`,
        'TIMEOUT',
        undefined,
        error
      );
    }

    // bd not installed or invalid working directory
    if (error.code === 'ENOENT' || message.includes('ENOENT')) {
      // Check if the error is about the working directory not existing
      if (error.path && error.syscall === 'spawn bd') {
        return new BackendError(
          `bd CLI not found. Please install Beads: https://github.com/steveyegge/beads`,
          'BD_NOT_FOUND',
          undefined,
          error
        );
      } else if (error.syscall === 'chdir') {
        return new BackendError(
          `Invalid repository path: ${this.cwd}. Check your .beads-bridge/config.json`,
          'INVALID_REPO_PATH',
          undefined,
          error
        );
      }
      return new BackendError(
        `bd CLI not found or invalid path: ${this.cwd}. Check installation and config.`,
        'BD_NOT_FOUND',
        undefined,
        error
      );
    }

    // Not a beads repository
    if (
      message.includes('not a beads repo') ||
      stderr.includes('.beads') ||
      stderr.includes('bd init')
    ) {
      return new BackendError(
        `Not a Beads repository: ${this.cwd}. Run: bd init`,
        'NOT_BEADS_REPO',
        undefined,
        error
      );
    }

    // Generic backend error
    return new BackendError(
      `bd CLI command failed: ${message}`,
      'BD_CLI_ERROR',
      undefined,
      error
    );
  }
}
