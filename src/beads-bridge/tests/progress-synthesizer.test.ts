/**
 * Tests for ProgressSynthesizer
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { ProgressSynthesizer } from '../src/synthesis/progress-synthesizer.js';
import type { BeadsClient } from '../src/clients/beads-client.js';
import type { ProjectManagementBackend } from '../src/types/backend.js';
import type { MappingStore } from '../src/store/mapping-store.js';
import type { BeadsIssue } from '../src/types/beads.js';
import type { IssueMapping } from '../src/types/mapping.js';
import type { Issue, Comment } from '../src/types/issue.js';

describe('ProgressSynthesizer', () => {
  let synthesizer: ProgressSynthesizer;
  let mockBeads: Partial<BeadsClient>;
  let mockBackend: Partial<ProjectManagementBackend>;
  let mockMappings: Partial<MappingStore>;

  const createMockIssue = (overrides: Partial<BeadsIssue> = {}): BeadsIssue => ({
    id: 'test-1',
    title: 'Test Issue',
    description: '',
    status: 'open',
    priority: 1,
    issue_type: 'task',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    dependencies: [],
    dependents: [],
    labels: [],
    ...overrides
  });

  beforeEach(() => {
    mockBeads = {
      getEpicWithSubtasks: mock()
    };

    mockBackend = {
      getIssue: mock(),
      addComment: mock()
    };

    mockMappings = {
      findByGitHubIssue: mock(),
      update: mock()
    };

    synthesizer = new ProgressSynthesizer(
      mockBeads as BeadsClient,
      mockBackend as ProjectManagementBackend,
      mockMappings as MappingStore
    );
  });

  describe('calculateMetrics', () => {
    it('should calculate metrics for empty list', () => {
      const metrics = synthesizer.calculateMetrics([]);

      expect(metrics.total).toBe(0);
      expect(metrics.completed).toBe(0);
      expect(metrics.inProgress).toBe(0);
      expect(metrics.blocked).toBe(0);
      expect(metrics.open).toBe(0);
      expect(metrics.percentComplete).toBe(0);
    });

    it('should calculate metrics for mixed status issues', () => {
      const issues: BeadsIssue[] = [
        createMockIssue({ id: '1', status: 'closed' }),
        createMockIssue({ id: '2', status: 'closed' }),
        createMockIssue({ id: '3', status: 'in_progress' }),
        createMockIssue({ id: '4', status: 'blocked' }),
        createMockIssue({ id: '5', status: 'open' })
      ];

      const metrics = synthesizer.calculateMetrics(issues);

      expect(metrics.total).toBe(5);
      expect(metrics.completed).toBe(2);
      expect(metrics.inProgress).toBe(1);
      expect(metrics.blocked).toBe(1);
      expect(metrics.open).toBe(1);
      expect(metrics.percentComplete).toBe(40); // 2/5 = 40%
    });

    it('should calculate 100% for all completed', () => {
      const issues: BeadsIssue[] = [
        createMockIssue({ id: '1', status: 'closed' }),
        createMockIssue({ id: '2', status: 'closed' })
      ];

      const metrics = synthesizer.calculateMetrics(issues);

      expect(metrics.percentComplete).toBe(100);
    });
  });

  describe('getEpicProgress', () => {
    it('should get progress for an epic', async () => {
      const epic = createMockIssue({ id: 'epic-1', title: 'Test Epic', issue_type: 'epic' });
      const subtasks: BeadsIssue[] = [
        createMockIssue({ id: 'task-1', status: 'closed' }),
        createMockIssue({ id: 'task-2', status: 'in_progress' }),
        createMockIssue({ id: 'task-3', status: 'open' })
      ];

      (mockBeads.getEpicWithSubtasks as any).mockResolvedValue({
        epic,
        subtasks
      });

      const progress = await synthesizer.getEpicProgress('test-repo', 'epic-1');

      expect(progress.repository).toBe('test-repo');
      expect(progress.epicId).toBe('epic-1');
      expect(progress.title).toBe('Test Epic');
      expect(progress.subtasks).toHaveLength(3);
      expect(progress.metrics.total).toBe(3);
      expect(progress.metrics.completed).toBe(1);
      expect(progress.blockers).toHaveLength(0);
    });

    it('should identify blockers', async () => {
      const epic = createMockIssue({ id: 'epic-1', issue_type: 'epic' });
      const subtasks: BeadsIssue[] = [
        createMockIssue({
          id: 'task-1',
          status: 'blocked',
          dependencies: [
            { id: 'dep-1', dependency_type: 'blocks', status: 'open', title: 'Blocking Task' } as any
          ]
        }),
        createMockIssue({ id: 'task-2', status: 'open' })
      ];

      (mockBeads.getEpicWithSubtasks as any).mockResolvedValue({
        epic,
        subtasks
      });

      const progress = await synthesizer.getEpicProgress('test-repo', 'epic-1');

      expect(progress.blockers).toHaveLength(1);
      expect(progress.blockers[0].id).toBe('task-1');
    });
  });

  describe('getAggregatedProgress', () => {
    it('should aggregate progress across multiple repos', async () => {
      const mapping: IssueMapping = {
        id: 'mapping-1',
        githubIssue: 'owner/repo#1',
        githubIssueNumber: 1,
        githubRepository: 'owner/repo',
        beadsEpics: [
          { repository: 'repo-1', epicId: 'epic-1' },
          { repository: 'repo-2', epicId: 'epic-2' }
        ],
        status: 'synced',
        syncHistory: [],
        aggregatedMetrics: {
          totalCompleted: 0,
          totalInProgress: 0,
          totalBlocked: 0,
          totalOpen: 0,
          percentComplete: 0
        }
      };

      (mockMappings.findByGitHubIssue as any).mockResolvedValue(mapping);

      // Mock epic progress for repo-1
      (mockBeads.getEpicWithSubtasks as any).mockResolvedValueOnce({
        epic: createMockIssue({ id: 'epic-1', issue_type: 'epic' }),
        subtasks: [
          createMockIssue({ id: 'task-1', status: 'closed' }),
          createMockIssue({ id: 'task-2', status: 'open' })
        ]
      });

      // Mock epic progress for repo-2
      (mockBeads.getEpicWithSubtasks as any).mockResolvedValueOnce({
        epic: createMockIssue({ id: 'epic-2', issue_type: 'epic' }),
        subtasks: [
          createMockIssue({ id: 'task-3', status: 'closed' }),
          createMockIssue({ id: 'task-4', status: 'in_progress' })
        ]
      });

      const progress = await synthesizer.getAggregatedProgress('owner/repo', 1);

      expect(progress.epics).toHaveLength(2);
      expect(progress.totalMetrics.total).toBe(4);
      expect(progress.totalMetrics.completed).toBe(2);
      expect(progress.totalMetrics.inProgress).toBe(1);
      expect(progress.totalMetrics.percentComplete).toBe(50);
    });
  });

  describe('generateProgressComment', () => {
    it('should generate basic progress comment', () => {
      const progress = {
        epics: [
          {
            repository: 'repo-1',
            epicId: 'epic-1',
            title: 'Epic 1',
            subtasks: [
              createMockIssue({ id: 'task-1', status: 'closed' }),
              createMockIssue({ id: 'task-2', status: 'open' })
            ],
            metrics: {
              total: 2,
              completed: 1,
              inProgress: 0,
              blocked: 0,
              open: 1,
              percentComplete: 50
            },
            blockers: []
          }
        ],
        totalMetrics: {
          total: 2,
          completed: 1,
          inProgress: 0,
          blocked: 0,
          open: 1,
          percentComplete: 50
        },
        allBlockers: [],
        hasBlockers: false
      };

      const comment = synthesizer.generateProgressComment(progress);

      expect(comment).toContain('## Progress Update');
      expect(comment).toContain('50%');
      expect(comment).toContain('1/2 tasks completed');
      expect(comment).toContain('✅ Completed: 1');
      expect(comment).toContain('📝 Open: 1');
    });

    it('should include repository breakdown for multi-repo progress', () => {
      const progress = {
        epics: [
          {
            repository: 'repo-1',
            epicId: 'epic-1',
            title: 'Epic 1',
            subtasks: [],
            metrics: {
              total: 2,
              completed: 1,
              inProgress: 0,
              blocked: 0,
              open: 1,
              percentComplete: 50
            },
            blockers: []
          },
          {
            repository: 'repo-2',
            epicId: 'epic-2',
            title: 'Epic 2',
            subtasks: [],
            metrics: {
              total: 3,
              completed: 2,
              inProgress: 1,
              blocked: 0,
              open: 0,
              percentComplete: 67
            },
            blockers: []
          }
        ],
        totalMetrics: {
          total: 5,
          completed: 3,
          inProgress: 1,
          blocked: 0,
          open: 1,
          percentComplete: 60
        },
        allBlockers: [],
        hasBlockers: false
      };

      const comment = synthesizer.generateProgressComment(progress, {
        includeRepositoryBreakdown: true
      });

      expect(comment).toContain('Progress by Repository');
      expect(comment).toContain('repo-1');
      expect(comment).toContain('repo-2');
    });

    it('should include blockers when present', () => {
      const blockedTask = createMockIssue({
        id: 'task-1',
        title: 'Blocked Task',
        status: 'blocked',
        dependencies: [
          { id: 'dep-1', dependency_type: 'blocks', status: 'open', title: 'Blocker' } as any
        ]
      });

      const progress = {
        epics: [],
        totalMetrics: {
          total: 1,
          completed: 0,
          inProgress: 0,
          blocked: 1,
          open: 0,
          percentComplete: 0
        },
        allBlockers: [blockedTask],
        hasBlockers: true
      };

      const comment = synthesizer.generateProgressComment(progress, {
        includeBlockers: true
      });

      expect(comment).toContain('⚠️ Blockers');
      expect(comment).toContain('task-1');
      expect(comment).toContain('Blocked Task');
      expect(comment).toContain('Blocked by: dep-1');
    });
  });

  describe('updateGitHubProgress', () => {
    it('should update GitHub issue with progress', async () => {
      const mapping: IssueMapping = {
        id: 'mapping-1',
        githubIssue: 'owner/repo#1',
        githubIssueNumber: 1,
        githubRepository: 'owner/repo',
        beadsEpics: [
          { repository: 'repo-1', epicId: 'epic-1' }
        ],
        status: 'synced',
        syncHistory: [],
        aggregatedMetrics: {
          totalCompleted: 0,
          totalInProgress: 0,
          totalBlocked: 0,
          totalOpen: 0,
          percentComplete: 0
        }
      };

      const issue: Issue = {
        id: 'issue-1',
        number: 1,
        title: 'Test Issue',
        body: '',
        state: 'open',
        url: 'https://github.com/owner/repo/issues/1',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        labels: [],
        assignees: []
      };

      const comment: Comment = {
        id: 'comment-1',
        body: 'Progress update',
        author: {
          id: 'user-1',
          login: 'testuser',
          name: 'Test User',
          email: 'test@example.com'
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/owner/repo/issues/1#comment-1'
      };

      (mockMappings.findByGitHubIssue as any).mockResolvedValue(mapping);
      (mockBeads.getEpicWithSubtasks as any).mockResolvedValue({
        epic: createMockIssue({ id: 'epic-1', issue_type: 'epic' }),
        subtasks: [
          createMockIssue({ id: 'task-1', status: 'closed' }),
          createMockIssue({ id: 'task-2', status: 'open' })
        ]
      });
      (mockBackend.getIssue as any).mockResolvedValue(issue);
      (mockBackend.addComment as any).mockResolvedValue(comment);
      (mockMappings.update as any).mockResolvedValue(mapping);

      const result = await synthesizer.updateGitHubProgress('owner/repo', 1);

      expect(result.success).toBe(true);
      expect(result.commentUrl).toBe(comment.url);
      expect(result.fieldsUpdated).toContain('aggregatedMetrics');
      expect(mockMappings.update).toHaveBeenCalled();
    });
  });
});
