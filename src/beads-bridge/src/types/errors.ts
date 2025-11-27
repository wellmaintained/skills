/**
 * Error types for the integration
 */

/**
 * Base error class for integration errors
 */
export class IntegrationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'IntegrationError';
  }
}

/**
 * Authentication error (not retryable)
 */
export class AuthenticationError extends IntegrationError {
  constructor(message: string, cause?: Error) {
    super(message, 'AUTH_ERROR', cause);
    this.name = 'AuthenticationError';
  }
}

/**
 * Rate limit error (retryable with specific delay)
 */
export class RateLimitError extends IntegrationError {
  constructor(
    message: string,
    public readonly retryAfter?: number,
    cause?: Error
  ) {
    super(message, 'RATE_LIMIT', cause);
    this.name = 'RateLimitError';
  }
}

/**
 * Not found error (not retryable)
 */
export class NotFoundError extends IntegrationError {
  constructor(message: string, cause?: Error) {
    super(message, 'NOT_FOUND', cause);
    this.name = 'NotFoundError';
  }
}

/**
 * Validation error (not retryable)
 */
export class ValidationError extends IntegrationError {
  constructor(message: string, cause?: Error) {
    super(message, 'VALIDATION_ERROR', cause);
    this.name = 'ValidationError';
  }
}

/**
 * Beads command error
 */
export class BeadsCommandError extends IntegrationError {
  constructor(
    message: string,
    public readonly command: string,
    public readonly exitCode?: number,
    cause?: Error
  ) {
    super(message, 'BEADS_COMMAND_ERROR', cause);
    this.name = 'BeadsCommandError';
  }
}

/**
 * GitHub CLI error
 */
export class GitHubError extends IntegrationError {
  constructor(
    message: string,
    public readonly command: string,
    public readonly statusCode?: number,
    cause?: Error
  ) {
    super(message, 'GITHUB_ERROR', cause);
    this.name = 'GitHubError';
  }
}

/**
 * Not supported error (operation not supported by backend)
 */
export class NotSupportedError extends Error {
  constructor(operation: string) {
    super(`Operation not supported: ${operation}`);
    this.name = 'NotSupportedError';
  }
}

/**
 * Missing external_ref error
 */
export class MissingExternalRefError extends Error {
  public readonly helpText: string;

  constructor(public readonly beadId: string) {
    super(`Bead '${beadId}' has no external_ref set`);
    this.name = 'MissingExternalRefError';
    
    this.helpText = `
To set an external_ref:
  bd update ${beadId} --external-ref "github:owner/repo#123"
  bd update ${beadId} --external-ref "shortcut:12345"

Supported formats:
  - github:owner/repo#123
  - https://github.com/owner/repo/issues/123
  - shortcut:12345
  - https://app.shortcut.com/org/story/12345
`.trim();
  }
}

