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
 * Result from syncState operation
 */
export interface SyncStateResult {
  /** List of Beads issue IDs that should be synced */
  affectedIssues: string[];

  /** External references (GitHub URLs) found in commits */
  externalRefs: string[];

  /** Git diff stat summary */
  diffStat: string;

  /** Starting git ref */
  since: string;

  /** Ending git ref */
  head: string;
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
   * Sync repository state by detecting recent git changes and updating related issues
   *
   * POC A: Auto-sync implementation that:
   * 1. Detects git diff changes since last sync
   * 2. Parses commit messages for external_ref links (GitHub issues/PRs)
   * 3. Returns list of affected issues that need sync
   *
   * @param since - Git ref to compare from (default: 'HEAD~1' for last commit)
   * @returns List of issue IDs that should be synced
   */
  async syncState(since: string = 'HEAD~1'): Promise<SyncStateResult> {
    const affectedIssues = new Set<string>();
    const externalRefs = new Set<string>();

    try {
      // Get git log with commit messages since the specified ref
      // Use %x00 as delimiter to avoid issues with pipes in commit messages
      const { stdout: gitLog } = await execFileAsync('git',
        ['log', `${since}..HEAD`, '--pretty=format:%H%x00%s%x00%b%x00'],
        { cwd: this.cwd, timeout: this.timeout }
      );

      // Parse commit messages for GitHub issue/PR references
      // Split by null byte delimiter
      const commits = gitLog.split('\0\0').filter(commit => commit.trim());
      for (const commit of commits) {
        const parts = commit.split('\0');
        if (parts.length >= 3) {
          const subject = parts[1] || '';
          const body = parts[2] || '';
          const fullMessage = `${subject}\n${body}`;

          // Extract GitHub issue/PR URLs
          // Matches: https://github.com/owner/repo/issues/123
          //          https://github.com/owner/repo/pull/456
          const githubUrlPattern = /https:\/\/github\.com\/[\w-]+\/[\w-]+\/(issues|pull)\/\d+/g;
          const matches = fullMessage.match(githubUrlPattern);

          if (matches) {
            matches.forEach(url => externalRefs.add(url));
          }
        }
      }

      // Get changed files for context
      const { stdout: diffStat } = await execFileAsync('git',
        ['diff', '--stat', `${since}..HEAD`],
        { cwd: this.cwd, timeout: this.timeout }
      );

      // Query beads for issues with matching external_refs
      if (externalRefs.size > 0) {
        const { stdout: listOutput } = await this.exec(['list', '--json']);
        const issues = JSON.parse(listOutput) as Array<{ id: string; external_ref?: string }>;

        for (const issue of issues) {
          if (issue.external_ref && externalRefs.has(issue.external_ref)) {
            affectedIssues.add(issue.id);
          }
        }
      }

      return {
        affectedIssues: Array.from(affectedIssues),
        externalRefs: Array.from(externalRefs),
        diffStat: diffStat.trimEnd(), // Only trim trailing whitespace, preserve leading spaces
        since,
        head: 'HEAD'
      };

    } catch (error: any) {
      // If git command fails (e.g., no commits yet, invalid ref), return empty result
      if (error.code === 128 || error.message?.includes('unknown revision')) {
        return {
          affectedIssues: [],
          externalRefs: [],
          diffStat: '',
          since,
          head: 'HEAD'
        };
      }
      throw this.handleExecError(error, ['syncState']);
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
