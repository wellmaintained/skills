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

