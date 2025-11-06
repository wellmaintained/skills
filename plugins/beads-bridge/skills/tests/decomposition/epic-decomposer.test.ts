/**
 * Unit tests for EpicDecomposer
 *
 * Comprehensive tests for the EpicDecomposer with mocked backend operations,
 * BeadsClient, and IssueParser.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EpicDecomposer } from '../../src/decomposition/epic-decomposer.js';
import { ConfigManager } from '../../src/config/config-manager.js';
import { GitHubBackend } from '../../src/backends/github.js';
import { BeadsClient } from '../../src/clients/beads-client.js';
import { MappingStore } from '../../src/store/mapping-store.js';
import { IssueParser } from '../../src/decomposition/issue-parser.js';
import type { Issue } from '../../src/types/core.js';
import type { BeadsIssue } from '../../src/types/beads.js';
import type { RepositoryConfig } from '../../src/types/config.js';

// Mock all dependencies
vi.mock('../../src/config/config-manager.js');
vi.mock('../../src/backends/github.js');
vi.mock('../../src/clients/beads-client.js');
vi.mock('../../src/store/mapping-store.js');
vi.mock('../../src/decomposition/issue-parser.js');

describe('EpicDecomposer', () => {
  let decomposer: EpicDecomposer;
  let mockConfig: any;
  let mockGitHub: any;
  let mockBeads: any;
  let mockMappingStore: any;
  let mockParser: any;

  const mockRepositories: RepositoryConfig[] = [
    { name: 'frontend', path: '/path/to/frontend' },
    { name: 'backend', path: '/path/to/backend' },
  ];

  const mockGitHubConfig = {
    repository: 'owner/repo',
    projectId: 'PVT_12345',
    customFields: {
      statusField: 'status-field-id',
      completionField: 'completion-field-id',
      blockersField: 'blockers-field-id',
    },
  };

  const mockIssue: Issue = {
    id: 'I_123',
    number: 42,
    title: 'Epic: Implement new feature',
    body: '## Description\nImplement new feature across repositories\n\n- [ ] [frontend] Add UI components\n- [ ] [backend] Add API endpoints',
    state: 'open',
    assignees: [],
    labels: [],
    createdAt: new Date('2025-11-05T10:00:00Z'),
    updatedAt: new Date('2025-11-05T10:00:00Z'),
    url: 'https://github.com/owner/repo/issues/42',
    metadata: {},
  };

  const mockBeadsIssue: BeadsIssue = {
    id: 'test-123',
    content_hash: 'abc123',
    title: 'Test Issue',
    description: 'Test description',
    status: 'open',
    priority: 2,
    issue_type: 'epic',
    created_at: '2025-11-05T10:00:00Z',
    updated_at: '2025-11-05T10:00:00Z',
    labels: [],
    dependencies: [],
    dependents: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup ConfigManager mock
    mockConfig = {
      getRepositories: vi.fn().mockReturnValue(mockRepositories),
      getGitHub: vi.fn().mockReturnValue(mockGitHubConfig),
    };

    // Setup GitHubBackend mock
    mockGitHub = {
      getIssue: vi.fn(),
      addComment: vi.fn(),
      updateProjectField: vi.fn(),
      addToProject: vi.fn(),
    };

    // Setup BeadsClient mock
    mockBeads = {
      createEpic: vi.fn(),
      createIssue: vi.fn(),
      addDependency: vi.fn(),
    };

    // Setup MappingStore mock
    mockMappingStore = {
      create: vi.fn().mockResolvedValue({ id: 'mapping-123' }),
    };

    // Setup IssueParser mock
    mockParser = {
      parse: vi.fn(),
      getRepositoryTasks: vi.fn(),
      getRepository: vi.fn(),
    };

    (IssueParser as any).mockImplementation(() => mockParser);

    decomposer = new EpicDecomposer(
      mockConfig,
      mockGitHub,
      mockBeads,
      mockMappingStore
    );
  });

  // ============================================================================
  // Basic Decomposition
  // ============================================================================

  describe('decompose', () => {
    it('should decompose a simple issue with single repository', async () => {
      const parsedIssue = {
        number: 42,
        title: 'Simple task',
        body: 'Just a simple task',
        tasks: [],
        repositories: [
          { name: 'frontend', tasks: [], explicit: false },
        ],
        url: 'https://github.com/owner/repo/issues/42',
        githubRepository: 'owner/repo',
        projectId: 'PVT_12345',
      };

      mockGitHub.getIssue.mockResolvedValue(mockIssue);
      mockParser.parse.mockReturnValue(parsedIssue);
      mockParser.getRepositoryTasks.mockReturnValue([]);
      mockParser.getRepository.mockReturnValue(mockRepositories[0]);
      mockBeads.createEpic.mockResolvedValue(mockBeadsIssue);
      mockGitHub.addComment.mockResolvedValue(undefined);

      const result = await decomposer.decompose(42);

      expect(result.success).toBe(true);
      expect(result.githubIssue).toBe('owner/repo#42');
      expect(result.epics).toHaveLength(1);
      expect(result.totalTasks).toBe(0);
      expect(mockGitHub.getIssue).toHaveBeenCalledWith('owner/repo#42');
      expect(mockParser.parse).toHaveBeenCalledWith(
        mockIssue,
        'owner/repo',
        'PVT_12345'
      );
      expect(mockBeads.createEpic).toHaveBeenCalled();
    });

    it('should decompose a complex issue with multiple repositories', async () => {
      const parsedIssue = {
        number: 42,
        title: 'Epic: Implement new feature',
        body: mockIssue.body,
        tasks: [
          { description: 'Add UI components', completed: false, repository: 'frontend', originalLine: '- [ ] [frontend] Add UI components' },
          { description: 'Add API endpoints', completed: false, repository: 'backend', originalLine: '- [ ] [backend] Add API endpoints' },
        ],
        repositories: [
          { name: 'frontend', tasks: ['Add UI components'], explicit: false },
          { name: 'backend', tasks: ['Add API endpoints'], explicit: false },
        ],
        url: 'https://github.com/owner/repo/issues/42',
        githubRepository: 'owner/repo',
        projectId: 'PVT_12345',
      };

      mockGitHub.getIssue.mockResolvedValue(mockIssue);
      mockParser.parse.mockReturnValue(parsedIssue);
      mockParser.getRepositoryTasks
        .mockReturnValueOnce(['Add UI components'])
        .mockReturnValueOnce(['Add API endpoints']);
      mockParser.getRepository
        .mockReturnValueOnce(mockRepositories[0])
        .mockReturnValueOnce(mockRepositories[1]);

      const frontendEpic = { ...mockBeadsIssue, id: 'frontend-123' };
      const backendEpic = { ...mockBeadsIssue, id: 'backend-123' };
      const frontendTask = { ...mockBeadsIssue, id: 'frontend-task-1', issue_type: 'task' };
      const backendTask = { ...mockBeadsIssue, id: 'backend-task-1', issue_type: 'task' };

      mockBeads.createEpic
        .mockResolvedValueOnce(frontendEpic)
        .mockResolvedValueOnce(backendEpic);
      mockBeads.createIssue
        .mockResolvedValueOnce(frontendTask)
        .mockResolvedValueOnce(backendTask);
      mockBeads.addDependency.mockResolvedValue(undefined);
      mockGitHub.addComment.mockResolvedValue(undefined);

      const result = await decomposer.decompose(42);

      expect(result.success).toBe(true);
      expect(result.epics).toHaveLength(2);
      expect(result.totalTasks).toBe(2);
      expect(result.epics[0].repository).toBe('frontend');
      expect(result.epics[0].epicId).toBe('frontend-123');
      expect(result.epics[0].childIssueIds).toEqual(['frontend-task-1']);
      expect(result.epics[1].repository).toBe('backend');
      expect(result.epics[1].epicId).toBe('backend-123');
      expect(result.epics[1].childIssueIds).toEqual(['backend-task-1']);
    });

    it('should handle empty description gracefully', async () => {
      const emptyIssue = {
        ...mockIssue,
        body: '',
      };

      const parsedIssue = {
        number: 42,
        title: 'Issue with no body',
        body: '',
        tasks: [],
        repositories: [
          { name: 'frontend', tasks: [], explicit: false },
        ],
        url: 'https://github.com/owner/repo/issues/42',
        githubRepository: 'owner/repo',
      };

      mockGitHub.getIssue.mockResolvedValue(emptyIssue);
      mockParser.parse.mockReturnValue(parsedIssue);
      mockParser.getRepositoryTasks.mockReturnValue([]);
      mockParser.getRepository.mockReturnValue(mockRepositories[0]);
      mockBeads.createEpic.mockResolvedValue(mockBeadsIssue);
      mockGitHub.addComment.mockResolvedValue(undefined);

      const result = await decomposer.decompose(42);

      expect(result.success).toBe(true);
      expect(result.epics).toHaveLength(1);
    });

    it('should handle malformed input gracefully', async () => {
      const malformedIssue = {
        ...mockIssue,
        body: 'Some text\n- [ Unclosed bracket task\n[invalid] prefix',
      };

      const parsedIssue = {
        number: 42,
        title: 'Malformed issue',
        body: malformedIssue.body,
        tasks: [], // Parser should handle malformed input
        repositories: [
          { name: 'frontend', tasks: [], explicit: false },
        ],
        url: 'https://github.com/owner/repo/issues/42',
        githubRepository: 'owner/repo',
      };

      mockGitHub.getIssue.mockResolvedValue(malformedIssue);
      mockParser.parse.mockReturnValue(parsedIssue);
      mockParser.getRepositoryTasks.mockReturnValue([]);
      mockParser.getRepository.mockReturnValue(mockRepositories[0]);
      mockBeads.createEpic.mockResolvedValue(mockBeadsIssue);
      mockGitHub.addComment.mockResolvedValue(undefined);

      const result = await decomposer.decompose(42);

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle GitHub backend failures', async () => {
      mockGitHub.getIssue.mockRejectedValue(new Error('GitHub API error'));

      const result = await decomposer.decompose(42);

      expect(result.success).toBe(false);
      expect(result.error).toBe('GitHub API error');
      expect(result.epics).toEqual([]);
      expect(result.totalTasks).toBe(0);
    });

    it('should handle BeadsClient failures during epic creation', async () => {
      const parsedIssue = {
        number: 42,
        title: 'Test Issue',
        body: 'Test',
        tasks: [],
        repositories: [
          { name: 'frontend', tasks: [], explicit: false },
        ],
        url: 'https://github.com/owner/repo/issues/42',
        githubRepository: 'owner/repo',
      };

      mockGitHub.getIssue.mockResolvedValue(mockIssue);
      mockParser.parse.mockReturnValue(parsedIssue);
      mockParser.getRepositoryTasks.mockReturnValue([]);
      mockParser.getRepository.mockReturnValue(mockRepositories[0]);
      mockBeads.createEpic.mockRejectedValue(new Error('Beads epic creation failed'));

      const result = await decomposer.decompose(42);

      expect(result.success).toBe(true); // Overall success
      expect(result.epics).toHaveLength(1);
      expect(result.epics[0].success).toBe(false);
      expect(result.epics[0].error).toBe('Beads epic creation failed');
    });

    it('should handle BeadsClient failures during task creation', async () => {
      const parsedIssue = {
        number: 42,
        title: 'Test Issue',
        body: 'Test',
        tasks: [
          { description: 'Task 1', completed: false, repository: 'frontend', originalLine: '- [ ] Task 1' },
        ],
        repositories: [
          { name: 'frontend', tasks: ['Task 1'], explicit: false },
        ],
        url: 'https://github.com/owner/repo/issues/42',
        githubRepository: 'owner/repo',
      };

      mockGitHub.getIssue.mockResolvedValue(mockIssue);
      mockParser.parse.mockReturnValue(parsedIssue);
      mockParser.getRepositoryTasks.mockReturnValue(['Task 1']);
      mockParser.getRepository.mockReturnValue(mockRepositories[0]);
      mockBeads.createEpic.mockResolvedValue(mockBeadsIssue);
      mockBeads.createIssue.mockRejectedValue(new Error('Task creation failed'));

      const result = await decomposer.decompose(42);

      expect(result.success).toBe(true);
      expect(result.epics).toHaveLength(1);
      expect(result.epics[0].success).toBe(false);
      expect(result.epics[0].error).toBe('Task creation failed');
    });

    it('should handle mapping store failures gracefully', async () => {
      const parsedIssue = {
        number: 42,
        title: 'Test Issue',
        body: 'Test',
        tasks: [],
        repositories: [
          { name: 'frontend', tasks: [], explicit: false },
        ],
        url: 'https://github.com/owner/repo/issues/42',
        githubRepository: 'owner/repo',
      };

      mockGitHub.getIssue.mockResolvedValue(mockIssue);
      mockParser.parse.mockReturnValue(parsedIssue);
      mockParser.getRepositoryTasks.mockReturnValue([]);
      mockParser.getRepository.mockReturnValue(mockRepositories[0]);
      mockBeads.createEpic.mockResolvedValue(mockBeadsIssue);
      mockMappingStore.create.mockRejectedValue(new Error('Database error'));

      const result = await decomposer.decompose(42);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });

    it('should handle parser errors', async () => {
      mockGitHub.getIssue.mockResolvedValue(mockIssue);
      mockParser.parse.mockImplementation(() => {
        throw new Error('Parser error');
      });

      const result = await decomposer.decompose(42);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Parser error');
    });
  });

  // ============================================================================
  // Subtask Generation
  // ============================================================================

  describe('Subtask Generation', () => {
    it('should generate subtasks from structured description', async () => {
      const parsedIssue = {
        number: 42,
        title: 'Epic with subtasks',
        body: 'Epic description',
        tasks: [
          { description: 'Task 1', completed: false, repository: 'frontend', originalLine: '- [ ] Task 1' },
          { description: 'Task 2', completed: false, repository: 'frontend', originalLine: '- [ ] Task 2' },
          { description: 'Task 3', completed: false, repository: 'frontend', originalLine: '- [ ] Task 3' },
        ],
        repositories: [
          { name: 'frontend', tasks: ['Task 1', 'Task 2', 'Task 3'], explicit: false },
        ],
        url: 'https://github.com/owner/repo/issues/42',
        githubRepository: 'owner/repo',
      };

      mockGitHub.getIssue.mockResolvedValue(mockIssue);
      mockParser.parse.mockReturnValue(parsedIssue);
      mockParser.getRepositoryTasks.mockReturnValue(['Task 1', 'Task 2', 'Task 3']);
      mockParser.getRepository.mockReturnValue(mockRepositories[0]);

      const epic = { ...mockBeadsIssue, id: 'epic-123' };
      const task1 = { ...mockBeadsIssue, id: 'task-1', issue_type: 'task' };
      const task2 = { ...mockBeadsIssue, id: 'task-2', issue_type: 'task' };
      const task3 = { ...mockBeadsIssue, id: 'task-3', issue_type: 'task' };

      mockBeads.createEpic.mockResolvedValue(epic);
      mockBeads.createIssue
        .mockResolvedValueOnce(task1)
        .mockResolvedValueOnce(task2)
        .mockResolvedValueOnce(task3);
      mockBeads.addDependency.mockResolvedValue(undefined);
      mockGitHub.addComment.mockResolvedValue(undefined);

      const result = await decomposer.decompose(42);

      expect(result.success).toBe(true);
      expect(result.epics).toHaveLength(1);
      expect(result.epics[0].childIssueIds).toEqual(['task-1', 'task-2', 'task-3']);
      expect(result.totalTasks).toBe(3);

      // Verify each task was created with correct parameters
      expect(mockBeads.createIssue).toHaveBeenCalledTimes(3);
      expect(mockBeads.createIssue).toHaveBeenCalledWith('frontend', expect.objectContaining({
        title: 'Task 1',
        issue_type: 'task',
      }));
      expect(mockBeads.createIssue).toHaveBeenCalledWith('frontend', expect.objectContaining({
        title: 'Task 2',
        issue_type: 'task',
      }));
      expect(mockBeads.createIssue).toHaveBeenCalledWith('frontend', expect.objectContaining({
        title: 'Task 3',
        issue_type: 'task',
      }));

      // Verify dependencies were added
      expect(mockBeads.addDependency).toHaveBeenCalledTimes(3);
    });

    it('should skip completed tasks', async () => {
      const parsedIssue = {
        number: 42,
        title: 'Epic with mixed tasks',
        body: 'Epic description',
        tasks: [
          { description: 'Task 1', completed: true, repository: 'frontend', originalLine: '- [x] Task 1' },
          { description: 'Task 2', completed: false, repository: 'frontend', originalLine: '- [ ] Task 2' },
        ],
        repositories: [
          { name: 'frontend', tasks: ['Task 2'], explicit: false }, // Parser already filtered
        ],
        url: 'https://github.com/owner/repo/issues/42',
        githubRepository: 'owner/repo',
      };

      mockGitHub.getIssue.mockResolvedValue(mockIssue);
      mockParser.parse.mockReturnValue(parsedIssue);
      mockParser.getRepositoryTasks.mockReturnValue(['Task 2']); // Only uncompleted
      mockParser.getRepository.mockReturnValue(mockRepositories[0]);

      const epic = { ...mockBeadsIssue, id: 'epic-123' };
      const task2 = { ...mockBeadsIssue, id: 'task-2', issue_type: 'task' };

      mockBeads.createEpic.mockResolvedValue(epic);
      mockBeads.createIssue.mockResolvedValue(task2);
      mockBeads.addDependency.mockResolvedValue(undefined);
      mockGitHub.addComment.mockResolvedValue(undefined);

      const result = await decomposer.decompose(42);

      expect(result.success).toBe(true);
      expect(result.totalTasks).toBe(1); // Only uncompleted task
      expect(mockBeads.createIssue).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Epic Creation in Backend
  // ============================================================================

  describe('Epic Creation in Backend', () => {
    it('should create epic with correct parameters', async () => {
      const parsedIssue = {
        number: 42,
        title: 'Test Epic',
        body: 'Short description',
        tasks: [],
        repositories: [
          { name: 'frontend', tasks: [], explicit: false },
        ],
        url: 'https://github.com/owner/repo/issues/42',
        githubRepository: 'owner/repo',
      };

      mockGitHub.getIssue.mockResolvedValue(mockIssue);
      mockParser.parse.mockReturnValue(parsedIssue);
      mockParser.getRepositoryTasks.mockReturnValue([]);
      mockParser.getRepository.mockReturnValue(mockRepositories[0]);
      mockBeads.createEpic.mockResolvedValue(mockBeadsIssue);
      mockGitHub.addComment.mockResolvedValue(undefined);

      await decomposer.decompose(42, { defaultPriority: 1 });

      expect(mockBeads.createEpic).toHaveBeenCalledWith('frontend', expect.objectContaining({
        title: 'Test Epic',
        description: expect.stringContaining('https://github.com/owner/repo/issues/42'),
        priority: 1,
        external_ref: 'https://github.com/owner/repo/issues/42',
      }));
    });

    it('should truncate long descriptions', async () => {
      const longBody = 'a'.repeat(600);
      const issueWithLongBody = {
        ...mockIssue,
        body: longBody,
      };

      const parsedIssue = {
        number: 42,
        title: 'Test Epic',
        body: longBody,
        tasks: [],
        repositories: [
          { name: 'frontend', tasks: [], explicit: false },
        ],
        url: 'https://github.com/owner/repo/issues/42',
        githubRepository: 'owner/repo',
      };

      mockGitHub.getIssue.mockResolvedValue(issueWithLongBody);
      mockParser.parse.mockReturnValue(parsedIssue);
      mockParser.getRepositoryTasks.mockReturnValue([]);
      mockParser.getRepository.mockReturnValue(mockRepositories[0]);
      mockBeads.createEpic.mockResolvedValue(mockBeadsIssue);
      mockGitHub.addComment.mockResolvedValue(undefined);

      await decomposer.decompose(42);

      expect(mockBeads.createEpic).toHaveBeenCalledWith('frontend', expect.objectContaining({
        description: expect.stringContaining('...'),
      }));

      const callArgs = mockBeads.createEpic.mock.calls[0][1];
      expect(callArgs.description).toContain('See full description in GitHub issue');
    });

    it('should create epic with labels', async () => {
      const parsedIssue = {
        number: 42,
        title: 'Test Epic',
        body: 'Description',
        tasks: [],
        repositories: [
          { name: 'frontend', tasks: [], explicit: false },
        ],
        url: 'https://github.com/owner/repo/issues/42',
        githubRepository: 'owner/repo',
      };

      mockGitHub.getIssue.mockResolvedValue(mockIssue);
      mockParser.parse.mockReturnValue(parsedIssue);
      mockParser.getRepositoryTasks.mockReturnValue([]);
      mockParser.getRepository.mockReturnValue(mockRepositories[0]);
      mockBeads.createEpic.mockResolvedValue(mockBeadsIssue);
      mockGitHub.addComment.mockResolvedValue(undefined);

      await decomposer.decompose(42, { labels: ['feature', 'urgent'] });

      expect(mockBeads.createEpic).toHaveBeenCalledWith('frontend', expect.objectContaining({
        labels: ['feature', 'urgent'],
      }));
    });
  });

  // ============================================================================
  // Options and Features
  // ============================================================================

  describe('Options and Features', () => {
    it('should skip posting comment when postComment is false', async () => {
      const parsedIssue = {
        number: 42,
        title: 'Test Issue',
        body: 'Test',
        tasks: [],
        repositories: [
          { name: 'frontend', tasks: [], explicit: false },
        ],
        url: 'https://github.com/owner/repo/issues/42',
        githubRepository: 'owner/repo',
      };

      mockGitHub.getIssue.mockResolvedValue(mockIssue);
      mockParser.parse.mockReturnValue(parsedIssue);
      mockParser.getRepositoryTasks.mockReturnValue([]);
      mockParser.getRepository.mockReturnValue(mockRepositories[0]);
      mockBeads.createEpic.mockResolvedValue(mockBeadsIssue);

      await decomposer.decompose(42, { postComment: false });

      expect(mockGitHub.addComment).not.toHaveBeenCalled();
    });

    it('should add to project when addToProject is true', async () => {
      const parsedIssue = {
        number: 42,
        title: 'Test Issue',
        body: 'Test',
        tasks: [],
        repositories: [
          { name: 'frontend', tasks: [], explicit: false },
        ],
        url: 'https://github.com/owner/repo/issues/42',
        githubRepository: 'owner/repo',
        projectId: 'PVT_12345',
      };

      mockGitHub.getIssue.mockResolvedValue(mockIssue);
      mockParser.parse.mockReturnValue(parsedIssue);
      mockParser.getRepositoryTasks.mockReturnValue([]);
      mockParser.getRepository.mockReturnValue(mockRepositories[0]);
      mockBeads.createEpic.mockResolvedValue(mockBeadsIssue);
      mockGitHub.addComment.mockResolvedValue(undefined);
      mockGitHub.addToProject.mockResolvedValue(undefined);

      await decomposer.decompose(42, { addToProject: true });

      expect(mockGitHub.addToProject).toHaveBeenCalledWith('I_123', 'PVT_12345');
    });

    it('should use default priority when not specified', async () => {
      const parsedIssue = {
        number: 42,
        title: 'Test Issue',
        body: 'Test',
        tasks: [],
        repositories: [
          { name: 'frontend', tasks: [], explicit: false },
        ],
        url: 'https://github.com/owner/repo/issues/42',
        githubRepository: 'owner/repo',
      };

      mockGitHub.getIssue.mockResolvedValue(mockIssue);
      mockParser.parse.mockReturnValue(parsedIssue);
      mockParser.getRepositoryTasks.mockReturnValue([]);
      mockParser.getRepository.mockReturnValue(mockRepositories[0]);
      mockBeads.createEpic.mockResolvedValue(mockBeadsIssue);
      mockGitHub.addComment.mockResolvedValue(undefined);

      await decomposer.decompose(42);

      expect(mockBeads.createEpic).toHaveBeenCalledWith('frontend', expect.objectContaining({
        priority: 2, // Default priority
      }));
    });
  });

  // ============================================================================
  // Confirmation Comment
  // ============================================================================

  describe('Confirmation Comment', () => {
    it('should generate confirmation comment with epic details', async () => {
      const parsedIssue = {
        number: 42,
        title: 'Test Epic',
        body: 'Description',
        tasks: [
          { description: 'Task 1', completed: false, repository: 'frontend', originalLine: '- [ ] Task 1' },
        ],
        repositories: [
          { name: 'frontend', tasks: ['Task 1'], explicit: false },
        ],
        url: 'https://github.com/owner/repo/issues/42',
        githubRepository: 'owner/repo',
      };

      mockGitHub.getIssue.mockResolvedValue(mockIssue);
      mockParser.parse.mockReturnValue(parsedIssue);
      mockParser.getRepositoryTasks.mockReturnValue(['Task 1']);
      mockParser.getRepository.mockReturnValue(mockRepositories[0]);

      const epic = { ...mockBeadsIssue, id: 'epic-123' };
      const task = { ...mockBeadsIssue, id: 'task-1', issue_type: 'task' };

      mockBeads.createEpic.mockResolvedValue(epic);
      mockBeads.createIssue.mockResolvedValue(task);
      mockBeads.addDependency.mockResolvedValue(undefined);
      mockGitHub.addComment.mockResolvedValue(undefined);

      const result = await decomposer.decompose(42);

      expect(result.confirmationComment).toContain('Beads Epic Created');
      expect(result.confirmationComment).toContain('frontend');
      expect(result.confirmationComment).toContain('epic-123');
      expect(result.confirmationComment).toContain('task-1');
      expect(result.confirmationComment).toContain('1 epics, 1 tasks');
      expect(mockGitHub.addComment).toHaveBeenCalledWith('I_123', expect.stringContaining('Beads Epic Created'));
    });

    it('should include error details in confirmation comment', async () => {
      const parsedIssue = {
        number: 42,
        title: 'Test Epic',
        body: 'Description',
        tasks: [],
        repositories: [
          { name: 'frontend', tasks: [], explicit: false },
          { name: 'backend', tasks: [], explicit: false },
        ],
        url: 'https://github.com/owner/repo/issues/42',
        githubRepository: 'owner/repo',
      };

      mockGitHub.getIssue.mockResolvedValue(mockIssue);
      mockParser.parse.mockReturnValue(parsedIssue);
      mockParser.getRepositoryTasks.mockReturnValue([]);
      mockParser.getRepository
        .mockReturnValueOnce(mockRepositories[0])
        .mockReturnValueOnce(mockRepositories[1]);

      mockBeads.createEpic
        .mockResolvedValueOnce(mockBeadsIssue)
        .mockRejectedValueOnce(new Error('Backend creation failed'));
      mockGitHub.addComment.mockResolvedValue(undefined);

      const result = await decomposer.decompose(42);

      expect(result.confirmationComment).toContain('frontend');
      expect(result.confirmationComment).toContain('backend');
      expect(result.confirmationComment).toContain('Backend creation failed');
      expect(result.confirmationComment).toContain('⚠️');
    });
  });

  // ============================================================================
  // Mapping Creation
  // ============================================================================

  describe('Mapping Creation', () => {
    it('should create mapping with all epic details', async () => {
      const parsedIssue = {
        number: 42,
        title: 'Test Epic',
        body: 'Description',
        tasks: [
          { description: 'Task 1', completed: false, repository: 'frontend', originalLine: '- [ ] Task 1' },
          { description: 'Task 2', completed: false, repository: 'backend', originalLine: '- [ ] Task 2' },
        ],
        repositories: [
          { name: 'frontend', tasks: ['Task 1'], explicit: false },
          { name: 'backend', tasks: ['Task 2'], explicit: false },
        ],
        url: 'https://github.com/owner/repo/issues/42',
        githubRepository: 'owner/repo',
        projectId: 'PVT_12345',
      };

      mockGitHub.getIssue.mockResolvedValue(mockIssue);
      mockParser.parse.mockReturnValue(parsedIssue);
      mockParser.getRepositoryTasks
        .mockReturnValueOnce(['Task 1'])
        .mockReturnValueOnce(['Task 2']);
      mockParser.getRepository
        .mockReturnValueOnce(mockRepositories[0])
        .mockReturnValueOnce(mockRepositories[1]);

      const frontendEpic = { ...mockBeadsIssue, id: 'frontend-123' };
      const backendEpic = { ...mockBeadsIssue, id: 'backend-123' };
      const task1 = { ...mockBeadsIssue, id: 'task-1' };
      const task2 = { ...mockBeadsIssue, id: 'task-2' };

      mockBeads.createEpic
        .mockResolvedValueOnce(frontendEpic)
        .mockResolvedValueOnce(backendEpic);
      mockBeads.createIssue
        .mockResolvedValueOnce(task1)
        .mockResolvedValueOnce(task2);
      mockBeads.addDependency.mockResolvedValue(undefined);
      mockGitHub.addComment.mockResolvedValue(undefined);

      const result = await decomposer.decompose(42);

      expect(mockMappingStore.create).toHaveBeenCalledWith({
        githubIssue: 'owner/repo#42',
        githubIssueNumber: 42,
        githubRepository: 'owner/repo',
        githubProjectId: 'PVT_12345',
        beadsEpics: [
          {
            repository: 'frontend',
            epicId: 'frontend-123',
            repositoryPath: '/path/to/frontend',
            createdAt: expect.any(String),
            lastUpdatedAt: expect.any(String),
            status: 'open',
            completedIssues: 0,
            totalIssues: 1,
          },
          {
            repository: 'backend',
            epicId: 'backend-123',
            repositoryPath: '/path/to/backend',
            createdAt: expect.any(String),
            lastUpdatedAt: expect.any(String),
            status: 'open',
            completedIssues: 0,
            totalIssues: 1,
          },
        ],
      });
      expect(result.mappingId).toBe('mapping-123');
    });

    it('should only include successful epics in mapping', async () => {
      const parsedIssue = {
        number: 42,
        title: 'Test Epic',
        body: 'Description',
        tasks: [],
        repositories: [
          { name: 'frontend', tasks: [], explicit: false },
          { name: 'backend', tasks: [], explicit: false },
        ],
        url: 'https://github.com/owner/repo/issues/42',
        githubRepository: 'owner/repo',
      };

      mockGitHub.getIssue.mockResolvedValue(mockIssue);
      mockParser.parse.mockReturnValue(parsedIssue);
      mockParser.getRepositoryTasks.mockReturnValue([]);
      mockParser.getRepository
        .mockReturnValueOnce(mockRepositories[0])
        .mockReturnValue(mockRepositories[1]); // For failed epic (shouldn't be called)

      mockBeads.createEpic
        .mockResolvedValueOnce(mockBeadsIssue)
        .mockRejectedValueOnce(new Error('Failed'));
      mockGitHub.addComment.mockResolvedValue(undefined);

      const result = await decomposer.decompose(42);

      expect(mockMappingStore.create).toHaveBeenCalledWith({
        githubIssue: 'owner/repo#42',
        githubIssueNumber: 42,
        githubRepository: 'owner/repo',
        githubProjectId: undefined,
        beadsEpics: [
          expect.objectContaining({
            repository: 'frontend',
          }),
        ],
      });
    });
  });
});
