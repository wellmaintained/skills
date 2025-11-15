/**
 * Unit tests for BeadsClient
 *
 * Comprehensive tests for the BeadsClient with mocked bd CLI calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BeadsClient } from '../../src/clients/beads-client.js';
import type {
  BeadsConfig,
  BeadsIssue,
  CreateBeadsIssueParams,
  UpdateBeadsIssueParams,
  BeadsDependency
} from '../../src/types/beads.js';
import { NotFoundError, BackendError } from '../../src/types/index.js';

// Mock the BdCli module
vi.mock('../../src/utils/bd-cli.js', () => {
  return {
    BdCli: vi.fn().mockImplementation(function() {
      return {
        exec: vi.fn(),
        execJson: vi.fn(),
        execTree: vi.fn(),
        getCwd: vi.fn()
      };
    })
  };
});

import { BdCli } from '../../src/utils/bd-cli.js';

describe('BeadsClient', () => {
  let client: BeadsClient;
  let mockBdCli: any;

  const mockConfig: BeadsConfig = {
    repositories: [
      { name: 'test-repo', path: '/path/to/test-repo' },
      { name: 'other-repo', path: '/path/to/other-repo' }
    ]
  };

  const mockIssue: BeadsIssue = {
    id: 'test-123',
    content_hash: 'abc123',
    title: 'Test Issue',
    description: 'Test description',
    status: 'open',
    priority: 2,
    issue_type: 'task',
    created_at: '2025-11-05T10:00:00Z',
    updated_at: '2025-11-05T10:00:00Z',
    labels: [],
    dependencies: [],
    dependents: []
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock BdCli
    mockBdCli = {
      exec: vi.fn(),
      execJson: vi.fn(),
      execTree: vi.fn(),
      getCwd: vi.fn()
    };

    (BdCli as any).mockImplementation(function() {
      return mockBdCli;
    });

    client = new BeadsClient(mockConfig);
  });

  // ============================================================================
  // Repository Management
  // ============================================================================

  describe('Repository Management', () => {
    it('should initialize with configured repositories', () => {
      expect(client.getRepositories()).toHaveLength(2);
      expect(client.getRepositories()[0].name).toBe('test-repo');
      expect(client.getRepositories()[1].name).toBe('other-repo');
    });

    it('should get repository by name', () => {
      const repo = client.getRepository('test-repo');
      expect(repo).toBeDefined();
      expect(repo?.name).toBe('test-repo');
      expect(repo?.path).toBe('/path/to/test-repo');
    });

    it('should return undefined for non-existent repository', () => {
      const repo = client.getRepository('non-existent');
      expect(repo).toBeUndefined();
    });

    it('should get repository path', () => {
      const path = client.getRepositoryPath('test-repo');
      expect(path).toBe('/path/to/test-repo');
    });

    it('should throw NotFoundError for non-existent repository path', () => {
      expect(() => client.getRepositoryPath('non-existent')).toThrow(NotFoundError);
      expect(() => client.getRepositoryPath('non-existent')).toThrow('Repository non-existent not configured');
    });
  });

  // ============================================================================
  // List Operations
  // ============================================================================

  describe('List Operations', () => {
    it('should list all issues without filters', async () => {
      const mockIssues = [mockIssue, { ...mockIssue, id: 'test-456' }];
      mockBdCli.execJson.mockResolvedValue(mockIssues);

      const issues = await client.listIssues('test-repo');

      expect(mockBdCli.execJson).toHaveBeenCalledWith(['list']);
      expect(issues).toEqual(mockIssues);
    });

    it('should list issues with status filter', async () => {
      mockBdCli.execJson.mockResolvedValue([mockIssue]);

      await client.listIssues('test-repo', { status: 'open' });

      expect(mockBdCli.execJson).toHaveBeenCalledWith(['list', '--status', 'open']);
    });

    it('should list issues with priority filter', async () => {
      mockBdCli.execJson.mockResolvedValue([mockIssue]);

      await client.listIssues('test-repo', { priority: 1 });

      expect(mockBdCli.execJson).toHaveBeenCalledWith(['list', '--priority', '1']);
    });

    it('should list issues with type filter', async () => {
      mockBdCli.execJson.mockResolvedValue([mockIssue]);

      await client.listIssues('test-repo', { type: 'epic' });

      expect(mockBdCli.execJson).toHaveBeenCalledWith(['list', '--type', 'epic']);
    });

    it('should list issues with assignee filter', async () => {
      mockBdCli.execJson.mockResolvedValue([mockIssue]);

      await client.listIssues('test-repo', { assignee: 'user1' });

      expect(mockBdCli.execJson).toHaveBeenCalledWith(['list', '--assignee', 'user1']);
    });

    it('should list issues with labels filter', async () => {
      mockBdCli.execJson.mockResolvedValue([mockIssue]);

      await client.listIssues('test-repo', { labels: ['bug', 'critical'] });

      expect(mockBdCli.execJson).toHaveBeenCalledWith(['list', '--label', 'bug', '--label', 'critical']);
    });

    it('should list issues with limit', async () => {
      mockBdCli.execJson.mockResolvedValue([mockIssue]);

      await client.listIssues('test-repo', { limit: 10 });

      expect(mockBdCli.execJson).toHaveBeenCalledWith(['list', '--limit', '10']);
    });

    it('should list issues with multiple filters', async () => {
      mockBdCli.execJson.mockResolvedValue([mockIssue]);

      await client.listIssues('test-repo', {
        status: 'in_progress',
        priority: 1,
        type: 'feature',
        assignee: 'dev1'
      });

      const call = mockBdCli.execJson.mock.calls[0][0];
      expect(call).toContain('list');
      expect(call).toContain('--status');
      expect(call).toContain('in_progress');
      expect(call).toContain('--priority');
      expect(call).toContain('1');
      expect(call).toContain('--type');
      expect(call).toContain('feature');
      expect(call).toContain('--assignee');
      expect(call).toContain('dev1');
    });
  });

  // ============================================================================
  // Get Operations
  // ============================================================================

  describe('Get Operations', () => {
    it('should get issue by ID', async () => {
      mockBdCli.execJson.mockResolvedValue([mockIssue]);

      const issue = await client.getIssue('test-repo', 'test-123');

      expect(mockBdCli.execJson).toHaveBeenCalledWith(['list', '--id', 'test-123']);
      expect(issue).toEqual(mockIssue);
    });

    it('should throw NotFoundError when issue does not exist', async () => {
      mockBdCli.execJson.mockResolvedValue([]);

      await expect(client.getIssue('test-repo', 'non-existent')).rejects.toThrow(NotFoundError);
      await expect(client.getIssue('test-repo', 'non-existent')).rejects.toThrow('Issue non-existent not found in test-repo');
    });

    it('should throw NotFoundError for invalid repository', async () => {
      await expect(client.getIssue('invalid-repo', 'test-123')).rejects.toThrow(NotFoundError);
      await expect(client.getIssue('invalid-repo', 'test-123')).rejects.toThrow('Repository invalid-repo not configured');
    });
  });

  // ============================================================================
  // Create Operations
  // ============================================================================

  describe('Create Operations', () => {
    it('should create issue with minimal fields', async () => {
      const params: CreateBeadsIssueParams = {
        title: 'New Issue'
      };

      mockBdCli.execJson.mockResolvedValue(mockIssue);

      const issue = await client.createIssue('test-repo', params);

      expect(mockBdCli.execJson).toHaveBeenCalledWith(expect.arrayContaining([
        'create',
        'New Issue'
      ]));
      expect(issue).toEqual(mockIssue);
    });

    it('should create issue with all fields', async () => {
      const params: CreateBeadsIssueParams = {
        title: 'Complete Issue',
        description: 'Full description',
        design: 'Design notes',
        acceptance_criteria: 'Acceptance criteria',
        issue_type: 'feature',
        priority: 1,
        assignee: 'dev1',
        labels: ['backend', 'api'],
        dependencies: ['dep-1', 'dep-2'],
        external_ref: 'https://github.com/org/repo/issues/123'
      };

      mockBdCli.execJson.mockResolvedValue(mockIssue);

      await client.createIssue('test-repo', params);

      const call = mockBdCli.execJson.mock.calls[0][0];
      expect(call).toContain('create');
      expect(call).toContain('Complete Issue');
      expect(call).toContain('-d');
      expect(call).toContain('Full description');
      expect(call).toContain('--design');
      expect(call).toContain('Design notes');
      expect(call).toContain('--acceptance');
      expect(call).toContain('Acceptance criteria');
      expect(call).toContain('-t');
      expect(call).toContain('feature');
      expect(call).toContain('-p');
      expect(call).toContain('1');
      expect(call).toContain('--assignee');
      expect(call).toContain('dev1');
      expect(call).toContain('--label');
      expect(call).toContain('backend');
      expect(call).toContain('api');
      expect(call).toContain('--deps');
      expect(call).toContain('dep-1,dep-2');
      expect(call).toContain('--external-ref');
      expect(call).toContain('https://github.com/org/repo/issues/123');
    });

    it('should create epic with epic type', async () => {
      const params: CreateBeadsIssueParams = {
        title: 'Epic Issue',
        issue_type: 'epic'
      };

      mockBdCli.execJson.mockResolvedValue({ ...mockIssue, issue_type: 'epic' });

      await client.createEpic('test-repo', params);

      const call = mockBdCli.execJson.mock.calls[0][0];
      expect(call).toContain('-t');
      expect(call).toContain('epic');
    });

    it('should default to epic type when creating epic without type', async () => {
      const params: CreateBeadsIssueParams = {
        title: 'Epic without type'
      };

      mockBdCli.execJson.mockResolvedValue(mockIssue);

      await client.createEpic('test-repo', params);

      const call = mockBdCli.execJson.mock.calls[0][0];
      expect(call).toContain('-t');
      expect(call).toContain('epic');
    });
  });

  // ============================================================================
  // Update Operations
  // ============================================================================

  describe('Update Operations', () => {
    it('should update issue with single field', async () => {
      const updates: UpdateBeadsIssueParams = {
        status: 'in_progress'
      };

      mockBdCli.exec.mockResolvedValue({ stdout: '', stderr: '' });
      mockBdCli.execJson.mockResolvedValue([{ ...mockIssue, status: 'in_progress' }]);

      const issue = await client.updateIssue('test-repo', 'test-123', updates);

      expect(mockBdCli.exec).toHaveBeenCalledWith(['update', 'test-123', '--status', 'in_progress']);
      expect(issue.status).toBe('in_progress');
    });

    it('should update issue with multiple fields', async () => {
      const updates: UpdateBeadsIssueParams = {
        title: 'Updated Title',
        description: 'Updated description',
        status: 'blocked',
        priority: 0,
        assignee: 'dev2',
        notes: 'Updated notes'
      };

      mockBdCli.exec.mockResolvedValue({ stdout: '', stderr: '' });
      mockBdCli.execJson.mockResolvedValue([{ ...mockIssue, ...updates }]);

      await client.updateIssue('test-repo', 'test-123', updates);

      const call = mockBdCli.exec.mock.calls[0][0];
      expect(call).toContain('update');
      expect(call).toContain('test-123');
      expect(call).toContain('--title');
      expect(call).toContain('Updated Title');
      expect(call).toContain('--description');
      expect(call).toContain('Updated description');
      expect(call).toContain('--status');
      expect(call).toContain('blocked');
      expect(call).toContain('--priority');
      expect(call).toContain('0');
      expect(call).toContain('--assignee');
      expect(call).toContain('dev2');
      expect(call).toContain('--notes');
      expect(call).toContain('Updated notes');
    });

    it('should update design and acceptance criteria', async () => {
      const updates: UpdateBeadsIssueParams = {
        design: 'New design',
        acceptance_criteria: 'New criteria'
      };

      mockBdCli.exec.mockResolvedValue({ stdout: '', stderr: '' });
      mockBdCli.execJson.mockResolvedValue([mockIssue]);

      await client.updateIssue('test-repo', 'test-123', updates);

      const call = mockBdCli.exec.mock.calls[0][0];
      expect(call).toContain('--design');
      expect(call).toContain('New design');
      expect(call).toContain('--acceptance-criteria');
      expect(call).toContain('New criteria');
    });

    it('should update external reference', async () => {
      const updates: UpdateBeadsIssueParams = {
        external_ref: 'https://github.com/org/repo/issues/456'
      };

      mockBdCli.exec.mockResolvedValue({ stdout: '', stderr: '' });
      mockBdCli.execJson.mockResolvedValue([mockIssue]);

      await client.updateIssue('test-repo', 'test-123', updates);

      const call = mockBdCli.exec.mock.calls[0][0];
      expect(call).toContain('--external-ref');
      expect(call).toContain('https://github.com/org/repo/issues/456');
    });
  });

  // ============================================================================
  // Close Operations
  // ============================================================================

  describe('Close Operations', () => {
    it('should close issue without reason', async () => {
      mockBdCli.exec.mockResolvedValue({ stdout: '', stderr: '' });

      await client.closeIssue('test-repo', 'test-123');

      expect(mockBdCli.exec).toHaveBeenCalledWith(['close', 'test-123']);
    });

    it('should close issue with reason', async () => {
      mockBdCli.exec.mockResolvedValue({ stdout: '', stderr: '' });

      await client.closeIssue('test-repo', 'test-123', 'Duplicate');

      expect(mockBdCli.exec).toHaveBeenCalledWith(['close', 'test-123', '--reason', 'Duplicate']);
    });
  });

  // ============================================================================
  // Dependency Operations
  // ============================================================================

  describe('Dependency Operations', () => {
    it('should add dependency with default type', async () => {
      mockBdCli.exec.mockResolvedValue({ stdout: '', stderr: '' });

      await client.addDependency('test-repo', 'test-123', 'test-456');

      expect(mockBdCli.exec).toHaveBeenCalledWith(['dep', 'add', 'test-123', 'test-456', '--type', 'blocks']);
    });

    it('should add dependency with custom type', async () => {
      mockBdCli.exec.mockResolvedValue({ stdout: '', stderr: '' });

      await client.addDependency('test-repo', 'test-123', 'test-456', 'related');

      expect(mockBdCli.exec).toHaveBeenCalledWith(['dep', 'add', 'test-123', 'test-456', '--type', 'related']);
    });

    it('should add discovered-from dependency', async () => {
      mockBdCli.exec.mockResolvedValue({ stdout: '', stderr: '' });

      await client.addDependency('test-repo', 'test-123', 'test-456', 'discovered-from');

      const call = mockBdCli.exec.mock.calls[0][0];
      expect(call).toContain('--type');
      expect(call).toContain('discovered-from');
    });

    it('should build dependency tree', async () => {
      const issueWithDeps: BeadsIssue = {
        ...mockIssue,
        dependencies: [
          {
            id: 'dep-1',
            content_hash: 'hash1',
            title: 'Dependency 1',
            description: 'Dep 1 desc',
            status: 'open',
            priority: 2,
            issue_type: 'task',
            created_at: '2025-11-05T09:00:00Z',
            updated_at: '2025-11-05T09:00:00Z',
            dependency_type: 'blocks'
          }
        ] as BeadsDependency[]
      };

      const depIssue: BeadsIssue = {
        id: 'dep-1',
        content_hash: 'hash1',
        title: 'Dependency 1',
        description: 'Dep 1 desc',
        status: 'open',
        priority: 2,
        issue_type: 'task',
        created_at: '2025-11-05T09:00:00Z',
        updated_at: '2025-11-05T09:00:00Z',
        labels: [],
        dependencies: [],
        dependents: []
      };

      mockBdCli.execJson
        .mockResolvedValueOnce([issueWithDeps])
        .mockResolvedValueOnce([depIssue]);

      const tree = await client.getDependencyTree('test-repo', 'test-123');

      expect(tree.issue.id).toBe('test-123');
      expect(tree.depth).toBe(0);
      expect(tree.dependencies).toHaveLength(1);
      expect(tree.dependencies[0].issue.id).toBe('dep-1');
      expect(tree.dependencies[0].dependencyType).toBe('blocks');
    });

    it('should handle issues without dependencies field', async () => {
      const issueNoDeps = { ...mockIssue };
      delete (issueNoDeps as any).dependencies;

      mockBdCli.execJson.mockResolvedValue([issueNoDeps]);

      const tree = await client.getDependencyTree('test-repo', 'test-123');

      expect(tree.issue.id).toBe('test-123');
      expect(tree.dependencies).toHaveLength(0);
    });
  });

  // ============================================================================
  // Epic Status
  // ============================================================================

  describe('Epic Status Calculation', () => {
    it('should calculate epic status with no subtasks', async () => {
      mockBdCli.execJson.mockResolvedValue([mockIssue]);

      const status = await client.getEpicStatus('test-repo', 'test-123');

      expect(status.total).toBe(0);
      expect(status.completed).toBe(0);
      expect(status.inProgress).toBe(0);
      expect(status.blocked).toBe(0);
      expect(status.notStarted).toBe(0);
      expect(status.percentComplete).toBe(0);
      expect(status.blockers).toHaveLength(0);
      expect(status.discovered).toHaveLength(0);
    });

    it('should calculate epic status with subtasks', async () => {
      // Mock tree output
      const treeOutput = `→ test-123: Epic Issue
  → sub-1: Closed Subtask
  → sub-2: In Progress Subtask
  → sub-3: Open Subtask
  → sub-4: Blocked Subtask`;

      mockBdCli.execTree.mockResolvedValue(treeOutput);

      // Mock getIssue calls for parsing
      mockBdCli.execJson.mockImplementation((args: string[]) => {
        if (args.includes('sub-1')) {
          return Promise.resolve([{ ...mockIssue, id: 'sub-1', status: 'closed' }]);
        }
        if (args.includes('sub-2')) {
          return Promise.resolve([{ ...mockIssue, id: 'sub-2', status: 'in_progress' }]);
        }
        if (args.includes('sub-3')) {
          return Promise.resolve([{ ...mockIssue, id: 'sub-3', status: 'open' }]);
        }
        if (args.includes('sub-4')) {
          return Promise.resolve([{ ...mockIssue, id: 'sub-4', status: 'blocked' }]);
        }
        return Promise.resolve([{ ...mockIssue, issue_type: 'epic' }]);
      });

      const status = await client.getEpicStatus('test-repo', 'test-123');

      expect(status.total).toBe(4);
      expect(status.completed).toBe(1);
      expect(status.inProgress).toBe(1);
      expect(status.blocked).toBe(1);
      expect(status.notStarted).toBe(1);
      expect(status.percentComplete).toBe(25); // 1/4 = 25%
    });

    it('should identify blockers in subtasks', async () => {
      const treeOutput = `→ test-123: Epic Issue
  → sub-1: Subtask 1`;

      mockBdCli.execTree.mockResolvedValue(treeOutput);

      const subtaskWithBlocker: BeadsIssue = {
        id: 'sub-1',
        content_hash: 'hash',
        title: 'Subtask 1',
        description: 'Desc',
        status: 'in_progress',
        priority: 2,
        issue_type: 'task',
        created_at: '2025-11-05T10:00:00Z',
        updated_at: '2025-11-05T10:00:00Z',
        labels: [],
        dependencies: [
          { id: 'blocker-1', status: 'open', dependency_type: 'blocks' } as BeadsDependency
        ],
        dependents: []
      };

      mockBdCli.execJson.mockImplementation((args: string[]) => {
        if (args.includes('sub-1')) {
          return Promise.resolve([subtaskWithBlocker]);
        }
        return Promise.resolve([{ ...mockIssue, issue_type: 'epic' }]);
      });

      const status = await client.getEpicStatus('test-repo', 'test-123');

      expect(status.blockers).toHaveLength(1);
      expect(status.blockers[0].id).toBe('sub-1');
    });

    it('should identify discovered issues', async () => {
      const treeOutput = `→ test-123: Epic Issue
  → sub-1: Discovered Issue`;

      mockBdCli.execTree.mockResolvedValue(treeOutput);

      const discoveredSubtask: BeadsIssue = {
        id: 'sub-1',
        content_hash: 'hash',
        title: 'Discovered Issue',
        description: 'Desc',
        status: 'open',
        priority: 2,
        issue_type: 'task',
        created_at: '2025-11-05T10:00:00Z',
        updated_at: '2025-11-05T10:00:00Z',
        labels: [],
        dependencies: [
          { id: 'original-1', status: 'closed', dependency_type: 'discovered-from' } as BeadsDependency
        ],
        dependents: []
      };

      mockBdCli.execJson.mockImplementation((args: string[]) => {
        if (args.includes('sub-1')) {
          return Promise.resolve([discoveredSubtask]);
        }
        return Promise.resolve([{ ...mockIssue, issue_type: 'epic' }]);
      });

      const status = await client.getEpicStatus('test-repo', 'test-123');

      expect(status.discovered).toHaveLength(1);
      expect(status.discovered[0].id).toBe('sub-1');
    });
  });

  // ============================================================================
  // Discovery Detection
  // ============================================================================

  describe('Discovery Detection', () => {
    it('should get discovered issues without date filter', async () => {
      const discoveredIssue: BeadsIssue = {
        ...mockIssue,
        dependencies: [
          { id: 'orig-1', dependency_type: 'discovered-from' } as BeadsDependency
        ]
      };

      const normalIssue: BeadsIssue = {
        ...mockIssue,
        id: 'normal-1',
        dependencies: []
      };

      mockBdCli.execJson.mockResolvedValue([discoveredIssue, normalIssue]);

      const discovered = await client.getDiscoveredIssues('test-repo');

      expect(discovered).toHaveLength(1);
      expect(discovered[0].id).toBe('test-123');
    });

    it('should get discovered issues with date filter', async () => {
      const oldDiscovered: BeadsIssue = {
        ...mockIssue,
        id: 'old-1',
        created_at: '2025-11-01T10:00:00Z',
        dependencies: [
          { id: 'orig-1', dependency_type: 'discovered-from' } as BeadsDependency
        ]
      };

      const newDiscovered: BeadsIssue = {
        ...mockIssue,
        id: 'new-1',
        created_at: '2025-11-05T10:00:00Z',
        dependencies: [
          { id: 'orig-2', dependency_type: 'discovered-from' } as BeadsDependency
        ]
      };

      mockBdCli.execJson.mockResolvedValue([oldDiscovered, newDiscovered]);

      const since = new Date('2025-11-04T00:00:00Z');
      const discovered = await client.getDiscoveredIssues('test-repo', since);

      expect(discovered).toHaveLength(1);
      expect(discovered[0].id).toBe('new-1');
    });

    it('should handle issues without dependencies field', async () => {
      const issueNoDeps = { ...mockIssue };
      delete (issueNoDeps as any).dependencies;

      mockBdCli.execJson.mockResolvedValue([issueNoDeps]);

      const discovered = await client.getDiscoveredIssues('test-repo');

      expect(discovered).toHaveLength(0);
    });
  });

  // ============================================================================
  // Multi-Repository Operations
  // ============================================================================

  describe('Multi-Repository Operations', () => {
    it('should get all issues across repositories', async () => {
      mockBdCli.execJson.mockResolvedValue([mockIssue]);

      const allIssues = await client.getAllIssues();

      expect(allIssues.size).toBe(2);
      expect(allIssues.get('test-repo')).toHaveLength(1);
      expect(allIssues.get('other-repo')).toHaveLength(1);
    });

    it('should handle repository failures gracefully', async () => {
      mockBdCli.execJson
        .mockRejectedValueOnce(new Error('Repository error'))
        .mockResolvedValueOnce([mockIssue]);

      const allIssues = await client.getAllIssues();

      expect(allIssues.size).toBe(2);
      expect(allIssues.get('test-repo')).toHaveLength(0);
      expect(allIssues.get('other-repo')).toHaveLength(1);
    });

    it('should get epic with subtasks', async () => {
      const treeOutput = `→ test-123: Epic Issue
  → sub-1: Subtask 1
  → sub-2: Subtask 2`;

      mockBdCli.execTree.mockResolvedValue(treeOutput);

      const subtask1: BeadsIssue = { ...mockIssue, id: 'sub-1', title: 'Subtask 1' };
      const subtask2: BeadsIssue = { ...mockIssue, id: 'sub-2', title: 'Subtask 2' };

      mockBdCli.execJson.mockImplementation((args: string[]) => {
        if (args.includes('sub-1')) {
          return Promise.resolve([subtask1]);
        }
        if (args.includes('sub-2')) {
          return Promise.resolve([subtask2]);
        }
        return Promise.resolve([{ ...mockIssue, issue_type: 'epic' }]);
      });

      const result = await client.getEpicWithSubtasks('test-repo', 'test-123');

      expect(result.epic.id).toBe('test-123');
      expect(result.subtasks).toHaveLength(2);
      expect(result.subtasks[0].id).toBe('sub-1');
      expect(result.subtasks[1].id).toBe('sub-2');
    });

    it('should handle missing subtasks gracefully', async () => {
      const treeOutput = `→ test-123: Epic Issue
  → sub-1: Subtask 1
  → missing: Missing Subtask`;

      mockBdCli.execTree.mockResolvedValue(treeOutput);

      const subtask1: BeadsIssue = { ...mockIssue, id: 'sub-1' };

      mockBdCli.execJson.mockImplementation((args: string[]) => {
        if (args.includes('sub-1')) {
          return Promise.resolve([subtask1]);
        }
        if (args.includes('missing')) {
          return Promise.reject(new Error('Not found'));
        }
        return Promise.resolve([{ ...mockIssue, issue_type: 'epic' }]);
      });

      const result = await client.getEpicWithSubtasks('test-repo', 'test-123');

      expect(result.subtasks).toHaveLength(1);
      expect(result.subtasks[0].id).toBe('sub-1');
    });
  });
});
