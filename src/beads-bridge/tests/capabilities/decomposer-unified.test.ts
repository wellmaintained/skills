/**
 * Tests for unified decompose capability handler
 */

import { describe, it, expect, mock } from 'bun:test';
import { DecomposerHandler } from '../../src/capabilities/decomposer.js';
import type { SkillContext } from '../../src/types/skill.js';

// Mock the EpicDecomposer
const mockEpicDecomposer = {
  decompose: mock(async (_issueNumber, _options) => ({
    githubIssue: 'owner/repo#123',
    mappingId: 'mapping-1',
    epics: [
      {
        repository: 'repo1',
        epicId: 'epic-1',
        childIssueIds: ['task-1', 'task-2'],
        success: true,
      },
    ],
    totalTasks: 2,
    confirmationComment: '## Comment',
    success: true,
  })),
};

describe('DecomposerHandler', () => {
  describe('externalRef support (new unified command)', () => {
    it('accepts GitHub URL in externalRef', async () => {
      const handler = new DecomposerHandler(mockEpicDecomposer as any);
      const context: SkillContext = {
        externalRef: 'https://github.com/owner/repo/issues/123',
        postComment: true,
        defaultPriority: 2,
      };

      const result = await handler.execute(context);

      expect(result.success).toBe(true);
      expect(result.data?.githubIssue).toBe('owner/repo#123');
      expect(mockEpicDecomposer.decompose).toHaveBeenCalledWith('owner/repo', 123, {
        postComment: true,
        defaultPriority: 2,
      });
    });

    it('accepts GitHub shorthand in externalRef', async () => {
      const handler = new DecomposerHandler(mockEpicDecomposer as any);
      const context: SkillContext = {
        externalRef: 'github:owner/repo#456',
        postComment: true,
        defaultPriority: 3,
      };

      const result = await handler.execute(context);

      expect(result.success).toBe(true);
      expect(mockEpicDecomposer.decompose).toHaveBeenCalledWith('owner/repo', 456, {
        postComment: true,
        defaultPriority: 3,
      });
    });

    it('rejects Shortcut externalRef with not-supported error', async () => {
      const handler = new DecomposerHandler(mockEpicDecomposer as any);
      const context: SkillContext = {
        externalRef: 'shortcut:12345',
        postComment: true,
      };

      const result = await handler.execute(context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_SUPPORTED');
      expect(result.error?.message).toContain('Shortcut');
    });

    it('returns validation error for invalid externalRef', async () => {
      const handler = new DecomposerHandler(mockEpicDecomposer as any);
      const context: SkillContext = {
        externalRef: 'invalid-format-123',
        postComment: true,
      };

      const result = await handler.execute(context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('Invalid external reference');
    });

    it('uses default options when not provided', async () => {
      const handler = new DecomposerHandler(mockEpicDecomposer as any);
      const context: SkillContext = {
        externalRef: 'https://github.com/test/repo/issues/789',
      };

      const result = await handler.execute(context);

      expect(result.success).toBe(true);
      expect(mockEpicDecomposer.decompose).toHaveBeenCalledWith('test/repo', 789, {
        postComment: true, // default
        defaultPriority: 2, // default
      });
    });
  });

  describe('Validation', () => {
    it('returns validation error when externalRef is missing', async () => {
      const handler = new DecomposerHandler(mockEpicDecomposer as any);
      const context: SkillContext = {
        postComment: true,
      };

      const result = await handler.execute(context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toBe('externalRef is required');
    });
  });

  describe('error handling', () => {
    it('returns error when epicDecomposer is undefined', async () => {
      const handler = new DecomposerHandler(undefined);
      const context: SkillContext = {
        externalRef: 'https://github.com/owner/repo/issues/123',
      };

      const result = await handler.execute(context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_SUPPORTED');
    });

    it('maps decomposer errors to capability response', async () => {
      const errorMock = {
        decompose: mock(async () => ({
          githubIssue: 'owner/repo#123',
          mappingId: '',
          epics: [],
          totalTasks: 0,
          confirmationComment: '',
          success: false,
          error: 'Failed to create epic',
        })),
      };

      const handler = new DecomposerHandler(errorMock as any);
      const context: SkillContext = {
        externalRef: 'https://github.com/owner/repo/issues/123',
      };

      const result = await handler.execute(context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DECOMPOSE_ERROR');
      expect(result.error?.message).toBe('Failed to create epic');
    });
  });

  describe('response format', () => {
    it('formats success response correctly', async () => {
      const handler = new DecomposerHandler(mockEpicDecomposer as any);
      const context: SkillContext = {
        externalRef: 'https://github.com/owner/repo/issues/123',
      };

      const result = await handler.execute(context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.githubIssue).toBe('owner/repo#123');
      expect(result.data?.epics).toBeDefined();
      expect(result.data?.epics.length).toBe(1);
      expect(result.data?.totalTasks).toBe(2);
    });

    it('includes epic details in response', async () => {
      const handler = new DecomposerHandler(mockEpicDecomposer as any);
      const context: SkillContext = {
        externalRef: 'https://github.com/owner/repo/issues/123',
      };

      const result = await handler.execute(context);

      expect(result.data?.epics[0]).toEqual({
        repository: 'repo1',
        epicId: 'epic-1',
        tasksCreated: 2,
      });
    });
  });
});
