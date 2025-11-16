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
    try {
      // Compare local beads-metadata with remote to detect changes
      const { stdout: gitDiff } = await execFileAsync('git',
        ['diff', 'origin/beads-metadata', 'beads-metadata', '--', '.beads/issues.jsonl'],
        { cwd: this.cwd, timeout: this.timeout }
      );

      // Parse diff to extract changed issue IDs
      const changedIssueIds = new Set<string>();

      for (const line of gitDiff.split('\n')) {
        if (line.startsWith('+{')) {
          try {
            // Remove the leading '+' and parse JSON
            const json = JSON.parse(line.substring(1));
            if (json.id) {
              changedIssueIds.add(json.id);
            }
          } catch (e) {
            // Skip lines that aren't valid JSON
            continue;
          }
        }
      }

      // Find unique external_refs affected
      const affectedEpics = new Map<string, string>(); // external_ref -> epic issue ID

      for (const issueId of changedIssueIds) {
        const externalRef = await this.findExternalRef(issueId);
        if (externalRef) {
          // Find which issue has this external_ref (the epic)
          const epicIssue = await this.findIssueByExternalRef(externalRef);
          if (epicIssue) {
            affectedEpics.set(externalRef, epicIssue.id);
          }
        }
      }

      return {
        changedIssueIds: Array.from(changedIssueIds),
        affectedEpics
      };

    } catch (error: any) {
      // If git command fails (e.g., branch doesn't exist), return empty result
      if (error.code === 128 || error.message?.includes('unknown revision')) {
        return {
          changedIssueIds: [],
          affectedEpics: new Map()
        };
      }
      throw this.handleExecError(error, ['detectChangedIssues']);
    }
  }

  /**
   * Walk up dependency tree to find external_ref
   *
   * @param issueId - Issue ID to start from
   * @param visited - Set of visited issue IDs to prevent infinite loops
   * @returns external_ref if found, null otherwise
   */
  async findExternalRef(
    issueId: string,
    visited = new Set<string>()
  ): Promise<string | null> {
    // Prevent infinite loops
    if (visited.has(issueId)) {
      return null;
    }
    visited.add(issueId);

    try {
      // Get issue with dependencies
      const issues = await this.execJson<any[]>(['show', issueId, '--no-daemon']);
      const issue = issues[0];

      if (!issue) {
        return null;
      }

      // Check if this issue has external_ref
      if (issue.external_ref) {
        return issue.external_ref;
      }

      // Walk up to parents
      if (issue.dependencies && issue.dependencies.length > 0) {
        for (const dep of issue.dependencies) {
          if (dep.dependency_type === 'parent-child') {
            // dep.id is the parent
            const parentRef = await this.findExternalRef(dep.id, visited);
            if (parentRef) {
              return parentRef;
            }
          }
        }
      }

      return null;
    } catch (error: any) {
      // Issue not found or other error
      return null;
    }
  }

  /**
   * Find issue by external_ref
   *
   * @param externalRef - External reference to search for
   * @returns Issue if found, null otherwise
   */
  async findIssueByExternalRef(externalRef: string): Promise<{ id: string } | null> {
    try {
      // Get all issues (use --no-db to ensure external_ref is included)
      const issues = await this.execJson<any[]>(['list', '--no-daemon', '--no-db']);

      // Find issue with matching external_ref
      for (const issue of issues) {
        if (issue.external_ref === externalRef) {
          return { id: issue.id };
        }
      }

      return null;
    } catch (error: any) {
      return null;
    }
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
