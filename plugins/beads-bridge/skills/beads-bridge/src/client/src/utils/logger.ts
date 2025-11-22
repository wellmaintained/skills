/**
 * Client-side logger for browser console
 * Reads log level from window.__LOG_LEVEL__ (set by server)
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

/**
 * Get log level from window or default to INFO
 */
function getLogLevel(): LogLevel {
  if (typeof window !== 'undefined' && (window as any).__LOG_LEVEL__) {
    const level = (window as any).__LOG_LEVEL__.toUpperCase() as LogLevel;
    if (['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(level)) {
      return level;
    }
  }
  return 'INFO';
}

/**
 * Client-side logger with same interface as server logger
 */
export class ClientLogger {
  private level: LogLevel;
  private scope?: string;

  constructor(scope?: string) {
    this.level = getLogLevel();
    this.scope = scope;
  }

  /**
   * Create a child logger with a specific scope
   */
  withScope(scope: string): ClientLogger {
    const child = new ClientLogger(scope);
    return child;
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
            stack: error.stack,
          },
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
    if (PRIORITY[level] < PRIORITY[this.level]) {
      return;
    }

    const scopeStr = this.scope ? `[${this.scope}]` : '';
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    const logMessage = `${level}${scopeStr} ${message}${contextStr}`;

    // Use appropriate console method
    switch (level) {
      case 'DEBUG':
        console.debug(logMessage);
        break;
      case 'INFO':
        console.info(logMessage);
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

// Export singleton instance
export const logger = new ClientLogger();

