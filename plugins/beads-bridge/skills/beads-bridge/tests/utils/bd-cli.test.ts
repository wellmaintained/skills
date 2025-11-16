/**
 * Unit tests for BdCli
 *
 * Tests for the BdCli wrapper with focus on syncState functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BdCli, type SyncStateResult } from '../../src/utils/bd-cli.js';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

// Mock node:child_process
vi.mock('node:child_process', () => ({
  execFile: vi.fn()
}));

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true)
}));

const execFileAsync = promisify(execFile);

describe('BdCli', () => {
  let bdCli: BdCli;
  const mockCwd = '/path/to/repo';

  beforeEach(() => {
    vi.clearAllMocks();
    bdCli = new BdCli({ cwd: mockCwd });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // syncState - Basic functionality
  // ============================================================================

  describe('syncState', () => {
    it('should return empty result when no commits exist', async () => {
      // Mock git log to return empty output
      vi.mocked(execFile).mockImplementation((file, args, options, callback: any) => {
        if (args && args[0] === 'log') {
          callback(null, { stdout: '', stderr: '' });
        } else if (args && args[0] === 'diff') {
          callback(null, { stdout: '', stderr: '' });
        } else {
          callback(new Error('Unexpected git command'));
        }
      });

      const result = await bdCli.syncState('HEAD~1');

      expect(result).toEqual({
        affectedIssues: [],
        externalRefs: [],
        diffStat: '',
        since: 'HEAD~1',
        head: 'HEAD'
      });
    });

    it('should detect GitHub issue URLs in commit messages', async () => {
      const gitLogOutput = 'abc123\0feat: add feature\0Related to https://github.com/owner/repo/issues/123\0\0';
      const gitDiffOutput = ' src/file.ts | 10 +++++++';
      const bdListOutput = JSON.stringify([
        {
          id: 'test-1',
          external_ref: 'https://github.com/owner/repo/issues/123'
        },
        {
          id: 'test-2',
          external_ref: 'https://github.com/owner/repo/issues/456'
        }
      ]);

      vi.mocked(execFile).mockImplementation((file, args, options, callback: any) => {
        const command = args?.[0];

        if (command === 'log') {
          callback(null, { stdout: gitLogOutput, stderr: '' });
        } else if (command === 'diff') {
          callback(null, { stdout: gitDiffOutput, stderr: '' });
        } else if (file === 'bd' && args?.[0] === 'list') {
          callback(null, { stdout: bdListOutput, stderr: '' });
        } else {
          callback(new Error(`Unexpected command: ${file} ${args?.join(' ')}`));
        }
      });

      const result = await bdCli.syncState('HEAD~1');

      expect(result.externalRefs).toContain('https://github.com/owner/repo/issues/123');
      expect(result.affectedIssues).toContain('test-1');
      expect(result.affectedIssues).not.toContain('test-2');
      expect(result.diffStat).toBe(gitDiffOutput);
    });

    it('should detect GitHub PR URLs in commit messages', async () => {
      const gitLogOutput = 'def456\0fix: resolve bug\0Closes https://github.com/owner/repo/pull/789\0\0';
      const gitDiffOutput = ' src/bugfix.ts | 5 +++--';
      const bdListOutput = JSON.stringify([
        {
          id: 'test-pr-1',
          external_ref: 'https://github.com/owner/repo/pull/789'
        }
      ]);

      vi.mocked(execFile).mockImplementation((file, args, options, callback: any) => {
        const command = args?.[0];

        if (command === 'log') {
          callback(null, { stdout: gitLogOutput, stderr: '' });
        } else if (command === 'diff') {
          callback(null, { stdout: gitDiffOutput, stderr: '' });
        } else if (file === 'bd' && args?.[0] === 'list') {
          callback(null, { stdout: bdListOutput, stderr: '' });
        } else {
          callback(new Error(`Unexpected command: ${file} ${args?.join(' ')}`));
        }
      });

      const result = await bdCli.syncState('HEAD~1');

      expect(result.externalRefs).toContain('https://github.com/owner/repo/pull/789');
      expect(result.affectedIssues).toContain('test-pr-1');
    });

    it('should handle multiple commits with different issue references', async () => {
      const gitLogOutput = [
        'abc123\0feat: feature 1\0Related to https://github.com/owner/repo/issues/111\0\0',
        'def456\0feat: feature 2\0Fixes https://github.com/owner/repo/issues/222\0\0',
        'ghi789\0chore: update\0No issue reference\0\0'
      ].join('');

      const gitDiffOutput = ' src/file1.ts | 10 +++++++\n src/file2.ts | 5 +++--';
      const bdListOutput = JSON.stringify([
        {
          id: 'test-111',
          external_ref: 'https://github.com/owner/repo/issues/111'
        },
        {
          id: 'test-222',
          external_ref: 'https://github.com/owner/repo/issues/222'
        }
      ]);

      vi.mocked(execFile).mockImplementation((file, args, options, callback: any) => {
        const command = args?.[0];

        if (command === 'log') {
          callback(null, { stdout: gitLogOutput, stderr: '' });
        } else if (command === 'diff') {
          callback(null, { stdout: gitDiffOutput, stderr: '' });
        } else if (file === 'bd' && args?.[0] === 'list') {
          callback(null, { stdout: bdListOutput, stderr: '' });
        } else {
          callback(new Error(`Unexpected command: ${file} ${args?.join(' ')}`));
        }
      });

      const result = await bdCli.syncState('HEAD~3');

      expect(result.externalRefs).toHaveLength(2);
      expect(result.externalRefs).toContain('https://github.com/owner/repo/issues/111');
      expect(result.externalRefs).toContain('https://github.com/owner/repo/issues/222');
      expect(result.affectedIssues).toHaveLength(2);
      expect(result.affectedIssues).toContain('test-111');
      expect(result.affectedIssues).toContain('test-222');
    });

    it('should deduplicate same issue referenced in multiple commits', async () => {
      const gitLogOutput = [
        'abc123\0feat: part 1\0Related to https://github.com/owner/repo/issues/100\0\0',
        'def456\0feat: part 2\0Related to https://github.com/owner/repo/issues/100\0\0',
        'ghi789\0feat: part 3\0Closes https://github.com/owner/repo/issues/100\0\0'
      ].join('');

      const gitDiffOutput = ' src/file.ts | 30 +++++++';
      const bdListOutput = JSON.stringify([
        {
          id: 'test-100',
          external_ref: 'https://github.com/owner/repo/issues/100'
        }
      ]);

      vi.mocked(execFile).mockImplementation((file, args, options, callback: any) => {
        const command = args?.[0];

        if (command === 'log') {
          callback(null, { stdout: gitLogOutput, stderr: '' });
        } else if (command === 'diff') {
          callback(null, { stdout: gitDiffOutput, stderr: '' });
        } else if (file === 'bd' && args?.[0] === 'list') {
          callback(null, { stdout: bdListOutput, stderr: '' });
        } else {
          callback(new Error(`Unexpected command: ${file} ${args?.join(' ')}`));
        }
      });

      const result = await bdCli.syncState('HEAD~3');

      // Should only have one entry for the issue despite 3 commits
      expect(result.externalRefs).toHaveLength(1);
      expect(result.affectedIssues).toHaveLength(1);
      expect(result.affectedIssues[0]).toBe('test-100');
    });

    it('should not match beads issues without matching external_ref', async () => {
      const gitLogOutput = 'abc123\0feat: add feature\0Related to https://github.com/owner/repo/issues/123\0\0';
      const gitDiffOutput = ' src/file.ts | 10 +++++++';
      const bdListOutput = JSON.stringify([
        {
          id: 'test-1',
          external_ref: 'https://github.com/owner/repo/issues/456' // Different issue
        },
        {
          id: 'test-2'
          // No external_ref
        }
      ]);

      vi.mocked(execFile).mockImplementation((file, args, options, callback: any) => {
        const command = args?.[0];

        if (command === 'log') {
          callback(null, { stdout: gitLogOutput, stderr: '' });
        } else if (command === 'diff') {
          callback(null, { stdout: gitDiffOutput, stderr: '' });
        } else if (file === 'bd' && args?.[0] === 'list') {
          callback(null, { stdout: bdListOutput, stderr: '' });
        } else {
          callback(new Error(`Unexpected command: ${file} ${args?.join(' ')}`));
        }
      });

      const result = await bdCli.syncState('HEAD~1');

      expect(result.externalRefs).toHaveLength(1);
      expect(result.externalRefs[0]).toBe('https://github.com/owner/repo/issues/123');
      expect(result.affectedIssues).toHaveLength(0); // No matching beads
    });

    it('should handle commits without GitHub references', async () => {
      const gitLogOutput = [
        'abc123\0feat: add feature\0Just a regular commit\0\0',
        'def456\0fix: bug\0No external references here\0\0',
        'ghi789\0chore: update deps\0Updated dependencies\0\0'
      ].join('');

      const gitDiffOutput = ' package.json | 2 +-';
      const bdListOutput = JSON.stringify([
        {
          id: 'test-1',
          external_ref: 'https://github.com/owner/repo/issues/123'
        }
      ]);

      vi.mocked(execFile).mockImplementation((file, args, options, callback: any) => {
        const command = args?.[0];

        if (command === 'log') {
          callback(null, { stdout: gitLogOutput, stderr: '' });
        } else if (command === 'diff') {
          callback(null, { stdout: gitDiffOutput, stderr: '' });
        } else if (file === 'bd' && args?.[0] === 'list') {
          callback(null, { stdout: bdListOutput, stderr: '' });
        } else {
          callback(new Error(`Unexpected command: ${file} ${args?.join(' ')}`));
        }
      });

      const result = await bdCli.syncState('HEAD~3');

      expect(result.externalRefs).toHaveLength(0);
      expect(result.affectedIssues).toHaveLength(0);
      expect(result.diffStat).toBe(gitDiffOutput);
    });

    it('should handle invalid git ref gracefully', async () => {
      vi.mocked(execFile).mockImplementation((file, args, options, callback: any) => {
        const error: any = new Error('fatal: bad revision \'invalid-ref\'');
        error.code = 128;
        callback(error, { stdout: '', stderr: 'fatal: bad revision' });
      });

      const result = await bdCli.syncState('invalid-ref');

      // Should return empty result instead of throwing
      expect(result).toEqual({
        affectedIssues: [],
        externalRefs: [],
        diffStat: '',
        since: 'invalid-ref',
        head: 'HEAD'
      });
    });

    it('should extract URLs from commit body as well as subject', async () => {
      const gitLogOutput = 'abc123\0feat: add feature\0Long commit body with details.\n\nThis fixes https://github.com/owner/repo/issues/999\n\nAlso relates to https://github.com/owner/repo/pull/888\0\0';
      const gitDiffOutput = ' src/file.ts | 10 +++++++';
      const bdListOutput = JSON.stringify([
        {
          id: 'test-999',
          external_ref: 'https://github.com/owner/repo/issues/999'
        },
        {
          id: 'test-888',
          external_ref: 'https://github.com/owner/repo/pull/888'
        }
      ]);

      vi.mocked(execFile).mockImplementation((file, args, options, callback: any) => {
        const command = args?.[0];

        if (command === 'log') {
          callback(null, { stdout: gitLogOutput, stderr: '' });
        } else if (command === 'diff') {
          callback(null, { stdout: gitDiffOutput, stderr: '' });
        } else if (file === 'bd' && args?.[0] === 'list') {
          callback(null, { stdout: bdListOutput, stderr: '' });
        } else {
          callback(new Error(`Unexpected command: ${file} ${args?.join(' ')}`));
        }
      });

      const result = await bdCli.syncState('HEAD~1');

      expect(result.externalRefs).toHaveLength(2);
      expect(result.externalRefs).toContain('https://github.com/owner/repo/issues/999');
      expect(result.externalRefs).toContain('https://github.com/owner/repo/pull/888');
      expect(result.affectedIssues).toHaveLength(2);
    });

    it('should handle empty beads list', async () => {
      const gitLogOutput = 'abc123\0feat: add feature\0Related to https://github.com/owner/repo/issues/123\0\0';
      const gitDiffOutput = ' src/file.ts | 10 +++++++';
      const bdListOutput = JSON.stringify([]); // Empty beads list

      vi.mocked(execFile).mockImplementation((file, args, options, callback: any) => {
        const command = args?.[0];

        if (command === 'log') {
          callback(null, { stdout: gitLogOutput, stderr: '' });
        } else if (command === 'diff') {
          callback(null, { stdout: gitDiffOutput, stderr: '' });
        } else if (file === 'bd' && args?.[0] === 'list') {
          callback(null, { stdout: bdListOutput, stderr: '' });
        } else {
          callback(new Error(`Unexpected command: ${file} ${args?.join(' ')}`));
        }
      });

      const result = await bdCli.syncState('HEAD~1');

      expect(result.externalRefs).toHaveLength(1);
      expect(result.affectedIssues).toHaveLength(0); // No beads to match
    });

    it('should use correct git ref range', async () => {
      let capturedGitLogArgs: string[] = [];

      vi.mocked(execFile).mockImplementation((file, args, options, callback: any) => {
        const command = args?.[0];

        if (command === 'log') {
          capturedGitLogArgs = args || [];
          callback(null, { stdout: '', stderr: '' });
        } else if (command === 'diff') {
          callback(null, { stdout: '', stderr: '' });
        } else {
          callback(new Error(`Unexpected command: ${file} ${args?.join(' ')}`));
        }
      });

      await bdCli.syncState('HEAD~5');

      expect(capturedGitLogArgs).toContain('HEAD~5..HEAD');
    });
  });
});
