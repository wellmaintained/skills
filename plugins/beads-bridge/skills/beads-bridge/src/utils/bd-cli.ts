/**
 * Beads CLI wrapper utilities
 *
 * Provides a type-safe wrapper around the bd CLI for executing
 * commands across multiple repositories.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BackendError, NotFoundError } from '../types/index.js';

const execFileAsync = promisify(execFile);

export interface BdCliOptions {
  /** Working directory (repository path) */
  cwd: string;

  /** Maximum timeout for bd commands in milliseconds */
  timeout?: number;
}

export interface BdExecResult {
  stdout: string;
  stderr: string;
}

/**
 * Execute a bd CLI command and return parsed JSON output
 */
export class BdCli {
  private readonly cwd: string;
  private readonly timeout: number;

  constructor(options: BdCliOptions) {
    this.cwd = options.cwd;
    this.timeout = options.timeout || 30000; // 30s default
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
    try {
      const { stdout, stderr } = await execFileAsync('bd', args, {
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

    // bd not installed
    if (error.code === 'ENOENT' || message.includes('ENOENT')) {
      return new BackendError(
        'bd CLI not found. Please install Beads: https://github.com/steveyegge/beads',
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
