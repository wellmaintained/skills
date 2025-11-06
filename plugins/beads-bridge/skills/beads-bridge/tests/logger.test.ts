/**
 * Tests for simplified Logger
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '../src/monitoring/logger.js';

describe('Logger', () => {
  let logger: Logger;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic logging', () => {
    it('should log debug messages to console', () => {
      logger = new Logger({ level: 'DEBUG' });
      logger.debug('Debug message');

      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
      const call = consoleDebugSpy.mock.calls[0][0];
      expect(call).toContain('DEBUG');
      expect(call).toContain('Debug message');
    });

    it('should log info messages to console', () => {
      logger = new Logger({ level: 'INFO' });
      logger.info('Info message');

      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      const call = consoleInfoSpy.mock.calls[0][0];
      expect(call).toContain('INFO');
      expect(call).toContain('Info message');
    });

    it('should log warning messages to console', () => {
      logger = new Logger({ level: 'WARN' });
      logger.warn('Warning message');

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const call = consoleWarnSpy.mock.calls[0][0];
      expect(call).toContain('WARN');
      expect(call).toContain('Warning message');
    });

    it('should log error messages to console', () => {
      logger = new Logger({ level: 'ERROR' });
      const error = new Error('Test error');
      logger.error('Error message', error);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const call = consoleErrorSpy.mock.calls[0][0];
      expect(call).toContain('ERROR');
      expect(call).toContain('Error message');
      expect(call).toContain('Test error');
    });
  });

  describe('log level filtering', () => {
    it('should filter by log level - WARN level', () => {
      logger = new Logger({ level: 'WARN' });
      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warning');
      logger.error('Error');

      // Only WARN and ERROR should be logged
      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should allow all levels when set to DEBUG', () => {
      logger = new Logger({ level: 'DEBUG' });
      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warning');
      logger.error('Error');

      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should only allow ERROR when set to ERROR', () => {
      logger = new Logger({ level: 'ERROR' });
      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warning');
      logger.error('Error');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('context handling', () => {
    it('should include context in log output', () => {
      logger = new Logger({ level: 'INFO' });
      logger.info('Message', { userId: '123', action: 'login' });

      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      const call = consoleInfoSpy.mock.calls[0][0];
      expect(call).toContain('userId');
      expect(call).toContain('123');
      expect(call).toContain('action');
      expect(call).toContain('login');
    });

    it('should handle empty context', () => {
      logger = new Logger({ level: 'INFO' });
      logger.info('Message without context');

      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      const call = consoleInfoSpy.mock.calls[0][0];
      expect(call).toContain('Message without context');
    });

    it('should include error details in context', () => {
      logger = new Logger({ level: 'ERROR' });
      const error = new Error('Test error');
      error.stack = 'stack trace here';
      logger.error('Failed operation', error, { operation: 'test' });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const call = consoleErrorSpy.mock.calls[0][0];
      expect(call).toContain('Failed operation');
      expect(call).toContain('Test error');
      expect(call).toContain('stack trace here');
      expect(call).toContain('operation');
    });
  });

  describe('timestamp formatting', () => {
    it('should include ISO timestamp in log output', () => {
      logger = new Logger({ level: 'INFO' });
      logger.info('Test message');

      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      const call = consoleInfoSpy.mock.calls[0][0];
      // Check for ISO 8601 format: YYYY-MM-DDTHH:MM:SS.sssZ
      expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
    });
  });

  describe('error handling', () => {
    it('should handle error without stack trace', () => {
      logger = new Logger({ level: 'ERROR' });
      const error = new Error('Test error');
      delete error.stack;
      logger.error('Error message', error);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const call = consoleErrorSpy.mock.calls[0][0];
      expect(call).toContain('Error message');
      expect(call).toContain('Test error');
    });

    it('should handle error with additional context', () => {
      logger = new Logger({ level: 'ERROR' });
      const error = new Error('Test error');
      logger.error('Operation failed', error, { userId: '456', retry: 3 });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const call = consoleErrorSpy.mock.calls[0][0];
      expect(call).toContain('Operation failed');
      expect(call).toContain('Test error');
      expect(call).toContain('userId');
      expect(call).toContain('456');
      expect(call).toContain('retry');
      expect(call).toContain('3');
    });
  });
});
