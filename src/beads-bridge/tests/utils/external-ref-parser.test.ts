/**
 * Unit tests for external-ref-parser
 *
 * Tests for parsing external_ref strings to extract backend information.
 */

import { describe, it, expect } from 'vitest';
import { parseExternalRef } from '../../src/utils/external-ref-parser.js';

describe('parseExternalRef', () => {
  describe('GitHub format', () => {
    it('should parse github:owner/repo#123 format', () => {
      const result = parseExternalRef('github:owner/repo#123');

      expect(result).toEqual({
        backend: 'github',
        owner: 'owner',
        repo: 'repo',
        issueNumber: 123
      });
    });

    it('should parse GitHub issue URL format', () => {
      const result = parseExternalRef('https://github.com/owner/repo/issues/456');

      expect(result).toEqual({
        backend: 'github',
        owner: 'owner',
        repo: 'repo',
        issueNumber: 456
      });
    });

    it('should parse GitHub PR URL format', () => {
      const result = parseExternalRef('https://github.com/owner/repo/pull/789');

      expect(result).toEqual({
        backend: 'github',
        owner: 'owner',
        repo: 'repo',
        issueNumber: 789
      });
    });

    it('should handle owner/repo with hyphens', () => {
      const result = parseExternalRef('github:my-org/my-repo#100');

      expect(result).toEqual({
        backend: 'github',
        owner: 'my-org',
        repo: 'my-repo',
        issueNumber: 100
      });
    });
  });

  describe('Shortcut format', () => {
    it('should parse shortcut:12345 format', () => {
      const result = parseExternalRef('shortcut:12345');

      expect(result).toEqual({
        backend: 'shortcut',
        storyId: 12345
      });
    });

    it('should parse Shortcut URL format', () => {
      const result = parseExternalRef('https://app.shortcut.com/workspace/story/67890');

      expect(result).toEqual({
        backend: 'shortcut',
        storyId: 67890
      });
    });
  });

  describe('Error handling', () => {
    it('should throw error for invalid format', () => {
      expect(() => parseExternalRef('invalid-format')).toThrow(
        'Unknown external_ref format: invalid-format'
      );
    });

    it('should throw error for malformed GitHub URL', () => {
      expect(() => parseExternalRef('https://github.com/owner')).toThrow();
    });

    it('should throw error for empty string', () => {
      expect(() => parseExternalRef('')).toThrow();
    });
  });
});
