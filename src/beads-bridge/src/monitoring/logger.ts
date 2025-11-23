/**
 * Simple Logger
 *
 * Console-only logging for CLI tool.
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LoggerConfig {
  level: LogLevel;
}

const PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

/**
 * Simple console logger for CLI
 */
export class Logger {
  constructor(
    private readonly config: LoggerConfig,
    private readonly scope?: string
  ) {}

  /**
   * Create a child logger with a specific scope
   */
  withScope(scope: string): Logger {
    return new Logger(this.config, scope);
  }

  /**
   * Get the current log level
   */
  getLevel(): LogLevel {
    return this.config.level;
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log('DEBUG', message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, any>): void {
    this.log('INFO', message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log('WARN', message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, context?: Record<string, any>): void {
    const errorContext = error
      ? {
          ...context,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack
          }
        }
      : context;

    this.log('ERROR', message, errorContext);
  }

  /**
   * Internal log method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>
  ): void {
    // Filter by log level
    if (PRIORITY[level] < PRIORITY[this.config.level]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const scopeStr = this.scope ? `[${this.scope}]` : '';
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    const logMessage = `[${timestamp}] ${level}${scopeStr} ${message}${contextStr}`;

    // Use appropriate console method
    // Note: Use console.log for INFO to ensure visibility in Node.js terminal
    switch (level) {
      case 'DEBUG':
        console.debug(logMessage);
        break;
      case 'INFO':
        console.log(logMessage);
        break;
      case 'WARN':
        console.warn(logMessage);
        break;
      case 'ERROR':
        console.error(logMessage);
        break;
    }
  }
}
