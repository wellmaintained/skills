/**
 * Tests for external reference parsing utility
 */

import { describe, it, expect } from 'bun:test';
import {
  parseExternalRef,
  detectBackendFromRef,
  isValidExternalRefFormat,
} from '../../src/utils/external-ref-parser.js';

describe('parseExternalRef', () => {
  describe('GitHub URLs', () => {
    it('parses GitHub issue URL', () => {
      const result = parseExternalRef('https://github.com/owner/repo/issues/123');

      expect(result).toEqual({
        backend: 'github',
        owner: 'owner',
        repo: 'repo',
        repository: 'owner/repo',
        issueNumber: 123,
        externalRef: 'https://github.com/owner/repo/issues/123',
      });
    });

    it('parses GitHub issue URL with uppercase protocol', () => {
      const result = parseExternalRef('HTTPS://GITHUB.COM/owner/repo/issues/123');

      expect(result.backend).toBe('github');
      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('repo');
      expect(result.issueNumber).toBe(123);
    });

    it('parses GitHub URL with complex repository names', () => {
      const result = parseExternalRef(
        'https://github.com/acme-corp/auth-service-v2/issues/456'
      );

      expect(result.backend).toBe('github');
      expect(result.owner).toBe('acme-corp');
      expect(result.repo).toBe('auth-service-v2');
      expect(result.repository).toBe('acme-corp/auth-service-v2');
      expect(result.issueNumber).toBe(456);
    });

    it('normalizes GitHub URL in externalRef field', () => {
      const result = parseExternalRef('https://github.com/foo/bar/issues/99');

      expect(result.externalRef).toBe('https://github.com/foo/bar/issues/99');
    });

    it('parses GitHub PR URL', () => {
      const result = parseExternalRef('https://github.com/owner/repo/pull/789');

      expect(result).toEqual({
        backend: 'github',
        owner: 'owner',
        repo: 'repo',
        repository: 'owner/repo',
        issueNumber: 789,
        externalRef: 'https://github.com/owner/repo/pull/789',
      });
    });
  });

  describe('GitHub shorthand format', () => {
    it('parses github:owner/repo#123 format', () => {
      const result = parseExternalRef('github:owner/repo#123');

      expect(result).toEqual({
        backend: 'github',
        owner: 'owner',
        repo: 'repo',
        repository: 'owner/repo',
        issueNumber: 123,
        externalRef: 'https://github.com/owner/repo/issues/123',
      });
    });

    it('parses github shorthand with complex repo name', () => {
      const result = parseExternalRef('github:acme-corp/auth-service#789');

      expect(result.backend).toBe('github');
      expect(result.owner).toBe('acme-corp');
      expect(result.repo).toBe('auth-service');
      expect(result.repository).toBe('acme-corp/auth-service');
      expect(result.issueNumber).toBe(789);
    });

    it('handles uppercase github prefix', () => {
      const result = parseExternalRef('GITHUB:owner/repo#42');

      expect(result.backend).toBe('github');
      expect(result.issueNumber).toBe(42);
    });

    it('generates correct externalRef URL from shorthand', () => {
      const result = parseExternalRef('github:my-org/my-repo#100');

      expect(result.externalRef).toBe(
        'https://github.com/my-org/my-repo/issues/100'
      );
    });
  });

  describe('Shortcut URLs', () => {
    it('parses Shortcut story URL', () => {
      const result = parseExternalRef('https://app.shortcut.com/workspace/story/12345');

      expect(result).toEqual({
        backend: 'shortcut',
        storyId: 12345,
        externalRef: 'https://app.shortcut.com/workspace/story/12345',
      });
    });

    it('parses Shortcut URL with different workspace names', () => {
      const result = parseExternalRef(
        'https://app.shortcut.com/my-team/story/67890'
      );

      expect(result.backend).toBe('shortcut');
      expect(result.storyId).toBe(67890);
    });

    it('preserves Shortcut URL as-is', () => {
      const url = 'https://app.shortcut.com/myworkspace/story/999';
      const result = parseExternalRef(url);

      expect(result.externalRef).toBe(url);
    });

    it('parses Shortcut URL with slug', () => {
      const url = 'https://app.shortcut.com/imogen/story/89216/2025-11-05-tessier-release';
      const result = parseExternalRef(url);

      expect(result).toEqual({
        backend: 'shortcut',
        storyId: 89216,
        externalRef: url,
      });
    });
  });

  describe('Shortcut shorthand format', () => {
    it('parses shortcut:12345 format', () => {
      const result = parseExternalRef('shortcut:12345');

      expect(result).toEqual({
        backend: 'shortcut',
        storyId: 12345,
        externalRef: 'shortcut:12345',
      });
    });

    it('handles uppercase shortcut prefix', () => {
      const result = parseExternalRef('SHORTCUT:99999');

      expect(result.backend).toBe('shortcut');
      expect(result.storyId).toBe(99999);
    });

    it('parses large story IDs', () => {
      const result = parseExternalRef('shortcut:9876543210');

      expect(result.backend).toBe('shortcut');
      expect(result.storyId).toBe(9876543210);
    });
  });

  describe('Error cases', () => {
    it('throws on empty string', () => {
      expect(() => parseExternalRef('')).toThrow('non-empty string');
    });

    it('throws on null', () => {
      expect(() => parseExternalRef(null as any)).toThrow();
    });

    it('throws on undefined', () => {
      expect(() => parseExternalRef(undefined as any)).toThrow();
    });

    it('throws on invalid GitHub URL format', () => {
      expect(() => parseExternalRef('https://github.com/owner/repo')).toThrow(
        'Invalid external reference format'
      );
    });

    it('throws on malformed shortcut URL', () => {
      expect(() =>
        parseExternalRef('https://app.shortcut.com/workspace/invalid/12345')
      ).toThrow('Invalid external reference format');
    });

    it('throws on completely invalid format', () => {
      expect(() => parseExternalRef('random-text-123')).toThrow(
        'Invalid external reference format'
      );
    });

    it('throws on invalid GitHub shorthand', () => {
      expect(() => parseExternalRef('github:invalid-format')).toThrow(
        'Invalid external reference format'
      );
    });

    it('error message includes supported formats', () => {
      try {
        parseExternalRef('invalid');
        throw new Error('Should have thrown');
      } catch (error: any) {
        const message = error.message;
        expect(message).toContain('github.com');
        expect(message).toContain('github:');
        expect(message).toContain('shortcut:');
      }
    });
  });

  describe('Edge cases', () => {
    it('preserves issue numbers with leading zeros', () => {
      const result = parseExternalRef('https://github.com/owner/repo/issues/0123');

      expect(result.issueNumber).toBe(123);
    });

    it('handles very large issue numbers', () => {
      const result = parseExternalRef('https://github.com/owner/repo/issues/999999999');

      expect(result.issueNumber).toBe(999999999);
    });

    it('is case-insensitive for protocol', () => {
      const result = parseExternalRef('HTTP://github.com/owner/repo/issues/123');

      expect(result.backend).toBe('github');
    });
  });
});

describe('detectBackendFromRef', () => {
  it('detects GitHub from URL', () => {
    expect(detectBackendFromRef('https://github.com/owner/repo/issues/123')).toBe(
      'github'
    );
  });

  it('detects GitHub from shorthand', () => {
    expect(detectBackendFromRef('github:owner/repo#123')).toBe('github');
  });

  it('detects Shortcut from URL', () => {
    expect(detectBackendFromRef('https://app.shortcut.com/workspace/story/123')).toBe(
      'shortcut'
    );
  });

  it('detects Shortcut from shorthand', () => {
    expect(detectBackendFromRef('shortcut:123')).toBe('shortcut');
  });

  it('returns undefined for empty string', () => {
    expect(detectBackendFromRef('')).toBeUndefined();
  });

  it('returns undefined for invalid format', () => {
    expect(detectBackendFromRef('random-text')).toBeUndefined();
  });

  it('is case-insensitive', () => {
    expect(detectBackendFromRef('GITHUB:owner/repo#123')).toBe('github');
    expect(detectBackendFromRef('SHORTCUT:123')).toBe('shortcut');
  });
});

describe('isValidExternalRefFormat', () => {
  it('returns true for valid GitHub URL', () => {
    expect(
      isValidExternalRefFormat('https://github.com/owner/repo/issues/123')
    ).toBe(true);
  });

  it('returns true for valid GitHub shorthand', () => {
    expect(isValidExternalRefFormat('github:owner/repo#123')).toBe(true);
  });

  it('returns true for valid Shortcut URL', () => {
    expect(
      isValidExternalRefFormat('https://app.shortcut.com/workspace/story/123')
    ).toBe(true);
  });

  it('returns true for valid Shortcut shorthand', () => {
    expect(isValidExternalRefFormat('shortcut:123')).toBe(true);
  });

  it('returns false for invalid format', () => {
    expect(isValidExternalRefFormat('invalid-format')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidExternalRefFormat('')).toBe(false);
  });

  it('returns false for incomplete URLs', () => {
    expect(isValidExternalRefFormat('https://github.com/owner/repo')).toBe(false);
  });
});
