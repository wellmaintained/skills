/**
 * Unit tests for BdCli
 *
 * Tests for the BdCli wrapper with focus on detectChangedIssues functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BdCli, type ChangedIssuesResult } from '../../src/utils/bd-cli.js';
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
  // detectChangedIssues - Core functionality
  // ============================================================================

  describe('detectChangedIssues', () => {
    it('should return empty result when no changes detected', async () => {
      // Mock git diff to return empty output
      vi.mocked(execFile).mockImplementation((file, args, options, callback: any) => {
        if (file === 'git' && args?.[0] === 'diff') {
          callback(null, { stdout: '', stderr: '' });
        } else {
          callback(new Error(`Unexpected command: ${file} ${args?.join(' ')}`));
        }
      });

      const result = await bdCli.detectChangedIssues();

      expect(result).toEqual({
        changedIssueIds: [],
        affectedEpics: new Map()
      });
    });

    it('should detect changed issue from git diff', async () => {
      const gitDiffOutput = [
        '-{"id":"old-issue","title":"Old"}',
        '+{"id":"new-issue","title":"New","status":"open"}'
      ].join('\n');

      const bdShowOutput = JSON.stringify([{
        id: 'new-issue',
        external_ref: 'github:owner/repo#123',
        dependencies: []
      }]);

      const bdListOutput = JSON.stringify([{
        id: 'epic-1',
        external_ref: 'github:owner/repo#123'
      }]);

      vi.mocked(execFile).mockImplementation((file, args, options, callback: any) => {
        const command = file === 'git' ? args?.[0] : args?.[0];

        if (file === 'git' && command === 'diff') {
          callback(null, { stdout: gitDiffOutput, stderr: '' });
        } else if (file === 'bd' && command === 'show') {
          callback(null, { stdout: bdShowOutput, stderr: '' });
        } else if (file === 'bd' && command === 'list') {
          callback(null, { stdout: bdListOutput, stderr: '' });
        } else {
          callback(new Error(`Unexpected command: ${file} ${args?.join(' ')}`));
        }
      });

      const result = await bdCli.detectChangedIssues();

      expect(result.changedIssueIds).toContain('new-issue');
      expect(result.affectedEpics.size).toBe(1);
      expect(result.affectedEpics.get('github:owner/repo#123')).toBe('epic-1');
    });

    it('should handle multiple changed issues', async () => {
      const gitDiffOutput = [
        '+{"id":"issue-1","title":"First"}',
        '+{"id":"issue-2","title":"Second"}',
        '+{"id":"issue-3","title":"Third"}'
      ].join('\n');

      // All issues have same external_ref
      const bdShowIssue1 = JSON.stringify([{
        id: 'issue-1',
        external_ref: 'github:owner/repo#100',
        dependencies: []
      }]);

      const bdShowIssue2 = JSON.stringify([{
        id: 'issue-2',
        external_ref: 'github:owner/repo#100',
        dependencies: []
      }]);

      const bdShowIssue3 = JSON.stringify([{
        id: 'issue-3',
        external_ref: 'github:owner/repo#200',
        dependencies: []
      }]);

      const bdListOutput = JSON.stringify([
        { id: 'epic-100', external_ref: 'github:owner/repo#100' },
        { id: 'epic-200', external_ref: 'github:owner/repo#200' }
      ]);

      let showCallCount = 0;
      vi.mocked(execFile).mockImplementation((file, args, options, callback: any) => {
        const command = file === 'git' ? args?.[0] : args?.[0];

        if (file === 'git' && command === 'diff') {
          callback(null, { stdout: gitDiffOutput, stderr: '' });
        } else if (file === 'bd' && command === 'show') {
          showCallCount++;
          const output = showCallCount === 1 ? bdShowIssue1 :
                        showCallCount === 2 ? bdShowIssue2 :
                        bdShowIssue3;
          callback(null, { stdout: output, stderr: '' });
        } else if (file === 'bd' && command === 'list') {
          callback(null, { stdout: bdListOutput, stderr: '' });
        } else {
          callback(new Error(`Unexpected command: ${file} ${args?.join(' ')}`));
        }
      });

      const result = await bdCli.detectChangedIssues();

      expect(result.changedIssueIds).toHaveLength(3);
      expect(result.affectedEpics.size).toBe(2);
      expect(result.affectedEpics.get('github:owner/repo#100')).toBe('epic-100');
      expect(result.affectedEpics.get('github:owner/repo#200')).toBe('epic-200');
    });

    it('should walk up dependency tree to find external_ref', async () => {
      const gitDiffOutput = '+{"id":"child-task","title":"Child Task"}';

      // child-task depends on parent-epic which has external_ref
      const bdShowChild = JSON.stringify([{
        id: 'child-task',
        dependencies: [{
          id: 'parent-epic',
          dependency_type: 'parent-child'
        }]
      }]);

      const bdShowParent = JSON.stringify([{
        id: 'parent-epic',
        external_ref: 'github:owner/repo#456',
        dependencies: []
      }]);

      const bdListOutput = JSON.stringify([{
        id: 'parent-epic',
        external_ref: 'github:owner/repo#456'
      }]);

      let showCallCount = 0;
      vi.mocked(execFile).mockImplementation((file, args, options, callback: any) => {
        const command = file === 'git' ? args?.[0] : args?.[0];

        if (file === 'git' && command === 'diff') {
          callback(null, { stdout: gitDiffOutput, stderr: '' });
        } else if (file === 'bd' && command === 'show') {
          showCallCount++;
          const output = showCallCount === 1 ? bdShowChild : bdShowParent;
          callback(null, { stdout: output, stderr: '' });
        } else if (file === 'bd' && command === 'list') {
          callback(null, { stdout: bdListOutput, stderr: '' });
        } else {
          callback(new Error(`Unexpected command: ${file} ${args?.join(' ')}`));
        }
      });

      const result = await bdCli.detectChangedIssues();

      expect(result.changedIssueIds).toContain('child-task');
      expect(result.affectedEpics.get('github:owner/repo#456')).toBe('parent-epic');
    });

    it('should handle issues without external_ref', async () => {
      const gitDiffOutput = '+{"id":"orphan-issue","title":"Orphan"}';

      const bdShowOutput = JSON.stringify([{
        id: 'orphan-issue',
        dependencies: []
        // No external_ref
      }]);

      vi.mocked(execFile).mockImplementation((file, args, options, callback: any) => {
        const command = file === 'git' ? args?.[0] : args?.[0];

        if (file === 'git' && command === 'diff') {
          callback(null, { stdout: gitDiffOutput, stderr: '' });
        } else if (file === 'bd' && command === 'show') {
          callback(null, { stdout: bdShowOutput, stderr: '' });
        } else {
          callback(new Error(`Unexpected command: ${file} ${args?.join(' ')}`));
        }
      });

      const result = await bdCli.detectChangedIssues();

      expect(result.changedIssueIds).toContain('orphan-issue');
      expect(result.affectedEpics.size).toBe(0); // No external_ref found
    });

    it('should skip invalid JSON lines in diff', async () => {
      const gitDiffOutput = [
        '+{"id":"valid-issue","title":"Valid"}',
        '+not valid json at all',
        '+{"incomplete json',
        '+{"id":"another-valid","title":"Another"}'
      ].join('\n');

      const bdShowValid = JSON.stringify([{
        id: 'valid-issue',
        external_ref: 'github:owner/repo#1',
        dependencies: []
      }]);

      const bdShowAnother = JSON.stringify([{
        id: 'another-valid',
        external_ref: 'github:owner/repo#1',
        dependencies: []
      }]);

      const bdListOutput = JSON.stringify([{
        id: 'epic-1',
        external_ref: 'github:owner/repo#1'
      }]);

      let showCallCount = 0;
      vi.mocked(execFile).mockImplementation((file, args, options, callback: any) => {
        const command = file === 'git' ? args?.[0] : args?.[0];

        if (file === 'git' && command === 'diff') {
          callback(null, { stdout: gitDiffOutput, stderr: '' });
        } else if (file === 'bd' && command === 'show') {
          showCallCount++;
          const output = showCallCount === 1 ? bdShowValid : bdShowAnother;
          callback(null, { stdout: output, stderr: '' });
        } else if (file === 'bd' && command === 'list') {
          callback(null, { stdout: bdListOutput, stderr: '' });
        } else {
          callback(new Error(`Unexpected command: ${file} ${args?.join(' ')}`));
        }
      });

      const result = await bdCli.detectChangedIssues();

      // Should only parse valid JSON lines
      expect(result.changedIssueIds).toHaveLength(2);
      expect(result.changedIssueIds).toContain('valid-issue');
      expect(result.changedIssueIds).toContain('another-valid');
    });

    it('should handle git error gracefully', async () => {
      vi.mocked(execFile).mockImplementation((file, args, options, callback: any) => {
        const error: any = new Error('fatal: bad revision');
        error.code = 128;
        callback(error, { stdout: '', stderr: 'fatal: bad revision' });
      });

      const result = await bdCli.detectChangedIssues();

      expect(result).toEqual({
        changedIssueIds: [],
        affectedEpics: new Map()
      });
    });

    it('should prevent infinite loops in dependency walking', async () => {
      const gitDiffOutput = '+{"id":"circular-1","title":"Circular"}';

      // Create circular dependency: circular-1 -> circular-2 -> circular-1
      const bdShowCircular1 = JSON.stringify([{
        id: 'circular-1',
        dependencies: [{
          id: 'circular-2',
          dependency_type: 'parent-child'
        }]
      }]);

      const bdShowCircular2 = JSON.stringify([{
        id: 'circular-2',
        dependencies: [{
          id: 'circular-1',
          dependency_type: 'parent-child'
        }]
      }]);

      let showCallCount = 0;
      vi.mocked(execFile).mockImplementation((file, args, options, callback: any) => {
        const command = file === 'git' ? args?.[0] : args?.[0];

        if (file === 'git' && command === 'diff') {
          callback(null, { stdout: gitDiffOutput, stderr: '' });
        } else if (file === 'bd' && command === 'show') {
          showCallCount++;
          // Alternate between the two issues
          const output = showCallCount % 2 === 1 ? bdShowCircular1 : bdShowCircular2;
          callback(null, { stdout: output, stderr: '' });
        } else {
          callback(new Error(`Unexpected command: ${file} ${args?.join(' ')}`));
        }
      });

      const result = await bdCli.detectChangedIssues();

      // Should not hang, should return empty affectedEpics
      expect(result.changedIssueIds).toContain('circular-1');
      expect(result.affectedEpics.size).toBe(0);
      // Should have called show max 3 times (initial + 2 for circular check)
      expect(showCallCount).toBeLessThan(5);
    });
  });

  // ============================================================================
  // findExternalRef - Dependency tree walking
  // ============================================================================

  describe('findExternalRef', () => {
    it('should return external_ref when issue has one', async () => {
      const bdShowOutput = JSON.stringify([{
        id: 'test-issue',
        external_ref: 'github:owner/repo#789',
        dependencies: []
      }]);

      vi.mocked(execFile).mockImplementation((file, args, options, callback: any) => {
        if (file === 'bd' && args?.[0] === 'show') {
          callback(null, { stdout: bdShowOutput, stderr: '' });
        } else {
          callback(new Error(`Unexpected command: ${file} ${args?.join(' ')}`));
        }
      });

      const externalRef = await bdCli.findExternalRef('test-issue');

      expect(externalRef).toBe('github:owner/repo#789');
    });

    it('should return null when issue not found', async () => {
      vi.mocked(execFile).mockImplementation((file, args, options, callback: any) => {
        const error: any = new Error('Issue not found');
        callback(error, { stdout: '', stderr: '' });
      });

      const externalRef = await bdCli.findExternalRef('nonexistent');

      expect(externalRef).toBeNull();
    });
  });

  // ============================================================================
  // findIssueByExternalRef - Reverse lookup
  // ============================================================================

  describe('findIssueByExternalRef', () => {
    it('should find issue with matching external_ref', async () => {
      const bdListOutput = JSON.stringify([
        { id: 'epic-1', external_ref: 'github:owner/repo#100' },
        { id: 'epic-2', external_ref: 'github:owner/repo#200' },
        { id: 'epic-3', external_ref: 'shortcut:300' }
      ]);

      vi.mocked(execFile).mockImplementation((file, args, options, callback: any) => {
        if (file === 'bd' && args?.[0] === 'list') {
          callback(null, { stdout: bdListOutput, stderr: '' });
        } else {
          callback(new Error(`Unexpected command: ${file} ${args?.join(' ')}`));
        }
      });

      const issue = await bdCli.findIssueByExternalRef('github:owner/repo#200');

      expect(issue).toEqual({ id: 'epic-2' });
    });

    it('should return null when no matching external_ref found', async () => {
      const bdListOutput = JSON.stringify([
        { id: 'epic-1', external_ref: 'github:owner/repo#100' }
      ]);

      vi.mocked(execFile).mockImplementation((file, args, options, callback: any) => {
        if (file === 'bd' && args?.[0] === 'list') {
          callback(null, { stdout: bdListOutput, stderr: '' });
        } else {
          callback(new Error(`Unexpected command: ${file} ${args?.join(' ')}`));
        }
      });

      const issue = await bdCli.findIssueByExternalRef('github:owner/repo#999');

      expect(issue).toBeNull();
    });
  });
});
