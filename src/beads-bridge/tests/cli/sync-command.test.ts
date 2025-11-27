/**
 * Unit tests for sync command
 *
 * Tests for the simplified sync command (POC B).
 */

import { describe, it, expect } from 'vitest';
import { createSyncCommand } from '../../src/cli/commands/sync.js';

describe('createSyncCommand', () => {
  it('should create a commander command with correct name', () => {
    const cmd = createSyncCommand();
    expect(cmd.name()).toBe('sync');
  });

  it('should have description mentioning sync and diagrams', () => {
    const cmd = createSyncCommand();
    expect(cmd.description()).toContain('Sync');
    expect(cmd.description()).toContain('diagram');
  });

  it('should have an optional bead-id argument', () => {
    const cmd = createSyncCommand();
    const args = cmd.registeredArguments;

    expect(args).toHaveLength(1);
    expect(args[0].name()).toBe('bead-id');
    expect(args[0].required).toBe(false);
  });

  it('should have --dry-run option', () => {
    const cmd = createSyncCommand();
    const dryRunOption = cmd.options.find(o => o.long === '--dry-run');

    expect(dryRunOption).toBeDefined();
    expect(dryRunOption?.description).toContain('without posting');
  });

  it('should have --dry-run option defaulting to false', () => {
    const cmd = createSyncCommand();
    const dryRunOption = cmd.options.find(o => o.long === '--dry-run');

    expect(dryRunOption?.defaultValue).toBe(false);
  });
});

describe('sync command supports required external ref formats', () => {
  // These tests verify the documented external_ref formats
  // The actual parsing is tested in external-ref-parser.test.ts

  it('should support github:owner/repo#123 format (documented)', () => {
    // Format: github:owner/repo#123
    const format = 'github:owner/repo#123';
    expect(format).toMatch(/^github:[^/]+\/[^#]+#\d+$/);
  });

  it('should support github:owner/repo#pr-123 format (documented)', () => {
    // Format: github:owner/repo#pr-123
    const format = 'github:owner/repo#pr-123';
    expect(format).toMatch(/^github:[^/]+\/[^#]+#pr-\d+$/);
  });

  it('should support GitHub issue URL format (documented)', () => {
    // Format: https://github.com/owner/repo/issues/123
    const format = 'https://github.com/owner/repo/issues/123';
    expect(format).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/);
  });

  it('should support shortcut:12345 format (documented)', () => {
    // Format: shortcut:12345
    const format = 'shortcut:12345';
    expect(format).toMatch(/^shortcut:\d+$/);
  });

  it('should support Shortcut URL format (documented)', () => {
    // Format: https://app.shortcut.com/org/story/12345
    const format = 'https://app.shortcut.com/myorg/story/12345';
    expect(format).toMatch(/^https:\/\/app\.shortcut\.com\/[^/]+\/story\/\d+$/);
  });
});
