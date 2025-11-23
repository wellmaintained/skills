/**
 * Unit tests for BeadsClient
 *
 * Comprehensive tests for the BeadsClient with mocked bd CLI calls.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { BeadsClient } from '../../src/clients/beads-client.js';
import type {
  BeadsConfig,
  BeadsIssue,
  CreateBeadsIssueParams,
  UpdateBeadsIssueParams,
  BeadsDependency
} from '../../src/types/beads.js';
import { NotFoundError } from '../../src/types/index.js';
import { BdCli } from '../../src/utils/bd-cli.js';

// Mock the BdCli module
let mockBdCliInstance: any;
mock.module('../../src/utils/bd-cli.js', () => ({
  BdCli: mock(() => mockBdCliInstance)
}));

describe('BeadsClient', () => {
  let client: BeadsClient;

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
    // Setup mock BdCli
    mockBdCliInstance = {
      exec: mock(),
      execJson: mock(),
      execTree: mock(),
      execTreeJson: mock(),
      getCwd: mock()
    };

    client = new BeadsClient(mockConfig);
  });

  // ... (Repository Management, List Operations, Get Operations, Create Operations, Update Operations, Close Operations, Dependency Operations - same as before)
  // I will copy them to ensure file is complete

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
      mockBdCliInstance.execJson.mockResolvedValue(mockIssues);

      const issues = await client.listIssues('test-repo');

      expect(mockBdCliInstance.execJson).toHaveBeenCalledWith(['list']);
      expect(issues).toEqual(mockIssues);
    });

    it('should list issues with status filter', async () => {
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      await client.listIssues('test-repo', { status: 'open' });

      expect(mockBdCliInstance.execJson).toHaveBeenCalledWith(['list', '--status', 'open']);
    });

    it('should list issues with priority filter', async () => {
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      await client.listIssues('test-repo', { priority: 1 });

      expect(mockBdCliInstance.execJson).toHaveBeenCalledWith(['list', '--priority', '1']);
    });

    it('should list issues with type filter', async () => {
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      await client.listIssues('test-repo', { type: 'epic' });

      expect(mockBdCliInstance.execJson).toHaveBeenCalledWith(['list', '--type', 'epic']);
    });

    it('should list issues with assignee filter', async () => {
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      await client.listIssues('test-repo', { assignee: 'user1' });

      expect(mockBdCliInstance.execJson).toHaveBeenCalledWith(['list', '--assignee', 'user1']);
    });

    it('should list issues with labels filter', async () => {
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      await client.listIssues('test-repo', { labels: ['bug', 'critical'] });

      expect(mockBdCliInstance.execJson).toHaveBeenCalledWith(['list', '--label', 'bug', '--label', 'critical']);
    });

    it('should list issues with limit', async () => {
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      await client.listIssues('test-repo', { limit: 10 });

      expect(mockBdCliInstance.execJson).toHaveBeenCalledWith(['list', '--limit', '10']);
    });

    it('should list issues with multiple filters', async () => {
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      await client.listIssues('test-repo', {
        status: 'in_progress',
        priority: 1,
        type: 'feature',
        assignee: 'dev1'
      });

      const call = mockBdCliInstance.execJson.mock.calls[0][0];
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
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      const issue = await client.getIssue('test-repo', 'test-123');

      expect(mockBdCliInstance.execJson).toHaveBeenCalledWith(['list', '--id', 'test-123']);
      expect(issue).toEqual(mockIssue);
    });

    it('should throw NotFoundError when issue does not exist', async () => {
      mockBdCliInstance.execJson.mockResolvedValue([]);

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

      mockBdCliInstance.execJson.mockResolvedValue(mockIssue);

      const issue = await client.createIssue('test-repo', params);

      expect(mockBdCliInstance.execJson).toHaveBeenCalledWith(expect.arrayContaining([
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

      mockBdCliInstance.execJson.mockResolvedValue(mockIssue);

      await client.createIssue('test-repo', params);

      const call = mockBdCliInstance.execJson.mock.calls[0][0];
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

      mockBdCliInstance.execJson.mockResolvedValue({ ...mockIssue, issue_type: 'epic' });

      await client.createEpic('test-repo', params);

      const call = mockBdCliInstance.execJson.mock.calls[0][0];
      expect(call).toContain('-t');
      expect(call).toContain('epic');
    });

    it('should default to epic type when creating epic without type', async () => {
      const params: CreateBeadsIssueParams = {
        title: 'Epic without type'
      };

      mockBdCliInstance.execJson.mockResolvedValue(mockIssue);

      await client.createEpic('test-repo', params);

      const call = mockBdCliInstance.execJson.mock.calls[0][0];
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

      mockBdCliInstance.exec.mockResolvedValue({ stdout: '', stderr: '' });
      mockBdCliInstance.execJson.mockResolvedValue([{ ...mockIssue, status: 'in_progress' }]);

      const issue = await client.updateIssue('test-repo', 'test-123', updates);

      expect(mockBdCliInstance.exec).toHaveBeenCalledWith(['update', 'test-123', '--status', 'in_progress']);
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

      mockBdCliInstance.exec.mockResolvedValue({ stdout: '', stderr: '' });
      mockBdCliInstance.execJson.mockResolvedValue([{ ...mockIssue, ...updates }]);

      await client.updateIssue('test-repo', 'test-123', updates);

      const call = mockBdCliInstance.exec.mock.calls[0][0];
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

      mockBdCliInstance.exec.mockResolvedValue({ stdout: '', stderr: '' });
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      await client.updateIssue('test-repo', 'test-123', updates);

      const call = mockBdCliInstance.exec.mock.calls[0][0];
      expect(call).toContain('--design');
      expect(call).toContain('New design');
      expect(call).toContain('--acceptance-criteria');
      expect(call).toContain('New criteria');
    });

    it('should update external reference', async () => {
      const updates: UpdateBeadsIssueParams = {
        external_ref: 'https://github.com/org/repo/issues/456'
      };

      mockBdCliInstance.exec.mockResolvedValue({ stdout: '', stderr: '' });
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      await client.updateIssue('test-repo', 'test-123', updates);

      const call = mockBdCliInstance.exec.mock.calls[0][0];
      expect(call).toContain('--external-ref');
      expect(call).toContain('https://github.com/org/repo/issues/456');
    });
  });

  // ============================================================================
  // Close Operations
  // ============================================================================

  describe('Close Operations', () => {
    it('should close issue without reason', async () => {
      mockBdCliInstance.exec.mockResolvedValue({ stdout: '', stderr: '' });

      await client.closeIssue('test-repo', 'test-123');

      expect(mockBdCliInstance.exec).toHaveBeenCalledWith(['close', 'test-123']);
    });

    it('should close issue with reason', async () => {
      mockBdCliInstance.exec.mockResolvedValue({ stdout: '', stderr: '' });

      await client.closeIssue('test-repo', 'test-123', 'Duplicate');

      expect(mockBdCliInstance.exec).toHaveBeenCalledWith(['close', 'test-123', '--reason', 'Duplicate']);
    });
  });

  // ============================================================================
  // Dependency Operations
  // ============================================================================

  describe('Dependency Operations', () => {
    it('should add dependency with default type', async () => {
      mockBdCliInstance.exec.mockResolvedValue({ stdout: '', stderr: '' });

      await client.addDependency('test-repo', 'test-123', 'test-456');

      expect(mockBdCliInstance.exec).toHaveBeenCalledWith(['dep', 'add', 'test-123', 'test-456', '--type', 'blocks']);
    });

    it('should add dependency with custom type', async () => {
      mockBdCliInstance.exec.mockResolvedValue({ stdout: '', stderr: '' });

      await client.addDependency('test-repo', 'test-123', 'test-456', 'related');

      expect(mockBdCliInstance.exec).toHaveBeenCalledWith(['dep', 'add', 'test-123', 'test-456', '--type', 'related']);
    });

    it('should add discovered-from dependency', async () => {
      mockBdCliInstance.exec.mockResolvedValue({ stdout: '', stderr: '' });

      await client.addDependency('test-repo', 'test-123', 'test-456', 'discovered-from');

      const call = mockBdCliInstance.exec.mock.calls[0][0];
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

      mockBdCliInstance.execJson
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

      mockBdCliInstance.execJson.mockResolvedValue([issueNoDeps]);

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
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);
      mockBdCliInstance.execTreeJson.mockResolvedValue([
        { ...mockIssue, depth: 0, parent_id: '' }
      ]);

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
      const treeNodes = [
        { ...mockIssue, id: 'test-123', title: 'Epic Issue', depth: 0, parent_id: '', issue_type: 'epic' },
        { ...mockIssue, id: 'sub-1', title: 'Closed Subtask', depth: 1, parent_id: 'test-123', status: 'closed' },
        { ...mockIssue, id: 'sub-2', title: 'In Progress Subtask', depth: 1, parent_id: 'test-123', status: 'in_progress' },
        { ...mockIssue, id: 'sub-3', title: 'Open Subtask', depth: 1, parent_id: 'test-123', status: 'open' },
        { ...mockIssue, id: 'sub-4', title: 'Blocked Subtask', depth: 1, parent_id: 'test-123', status: 'blocked' }
      ];

      mockBdCliInstance.execTreeJson.mockResolvedValue(treeNodes);
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]); // For getIssue calls if any

      const status = await client.getEpicStatus('test-repo', 'test-123');

      expect(status.total).toBe(4);
      expect(status.completed).toBe(1);
      expect(status.inProgress).toBe(1);
      expect(status.blocked).toBe(1);
      expect(status.notStarted).toBe(1);
      expect(status.percentComplete).toBe(25); // 1/4 = 25%
    });

    it('should identify blockers in subtasks', async () => {
      const subtaskWithBlocker = {
        ...mockIssue,
        id: 'sub-1',
        title: 'Subtask 1',
        status: 'in_progress',
        dependencies: [
          { id: 'blocker-1', status: 'open', dependency_type: 'blocks' }
        ]
      };

      const treeNodes = [
        { ...mockIssue, id: 'test-123', title: 'Epic Issue', depth: 0, parent_id: '', issue_type: 'epic' },
        { ...subtaskWithBlocker, depth: 1, parent_id: 'test-123' }
      ];

      mockBdCliInstance.execTreeJson.mockResolvedValue(treeNodes);

      // Mock getIssue for full details check
      mockBdCliInstance.execJson.mockImplementation((args: string[]) => {
        if (args.includes('sub-1')) {
          return Promise.resolve([subtaskWithBlocker]);
        }
        return Promise.resolve([mockIssue]);
      });

      const status = await client.getEpicStatus('test-repo', 'test-123');

      expect(status.blockers).toHaveLength(1);
      expect(status.blockers[0].id).toBe('sub-1');
    });

    it('should identify discovered issues', async () => {
      const discoveredSubtask = {
        ...mockIssue,
        id: 'sub-1',
        title: 'Discovered Issue',
        status: 'open',
        dependencies: [
          { id: 'original-1', status: 'closed', dependency_type: 'discovered-from' }
        ]
      };

      const treeNodes = [
        { ...mockIssue, id: 'test-123', title: 'Epic Issue', depth: 0, parent_id: '', issue_type: 'epic' },
        { ...discoveredSubtask, depth: 1, parent_id: 'test-123' }
      ];

      mockBdCliInstance.execTreeJson.mockResolvedValue(treeNodes);

      // Mock getIssue for full details check
      mockBdCliInstance.execJson.mockImplementation((args: string[]) => {
        if (args.includes('sub-1')) {
          return Promise.resolve([discoveredSubtask]);
        }
        return Promise.resolve([mockIssue]);
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

      mockBdCliInstance.execJson.mockResolvedValue([discoveredIssue, normalIssue]);

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

      mockBdCliInstance.execJson.mockResolvedValue([oldDiscovered, newDiscovered]);

      const since = new Date('2025-11-04T00:00:00Z');
      const discovered = await client.getDiscoveredIssues('test-repo', since);

      expect(discovered).toHaveLength(1);
      expect(discovered[0].id).toBe('new-1');
    });

    it('should handle issues without dependencies field', async () => {
      const issueNoDeps = { ...mockIssue };
      delete (issueNoDeps as any).dependencies;

      mockBdCliInstance.execJson.mockResolvedValue([issueNoDeps]);

      const discovered = await client.getDiscoveredIssues('test-repo');

      expect(discovered).toHaveLength(0);
    });
  });

  // ============================================================================
  // Multi-Repository Operations
  // ============================================================================

  describe('Multi-Repository Operations', () => {
    it('should get all issues across repositories', async () => {
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      const allIssues = await client.getAllIssues();

      expect(allIssues.size).toBe(2);
      expect(allIssues.get('test-repo')).toHaveLength(1);
      expect(allIssues.get('other-repo')).toHaveLength(1);
    });

    it('should handle repository failures gracefully', async () => {
      mockBdCliInstance.execJson
        .mockRejectedValueOnce(new Error('Repository error'))
        .mockResolvedValueOnce([mockIssue]);

      const allIssues = await client.getAllIssues();

      expect(allIssues.size).toBe(2);
      expect(allIssues.get('test-repo')).toHaveLength(0);
      expect(allIssues.get('other-repo')).toHaveLength(1);
    });

    it('should get epic with subtasks', async () => {
      const treeNodes = [
        { ...mockIssue, id: 'test-123', title: 'Epic Issue', depth: 0, parent_id: '', issue_type: 'epic' },
        { ...mockIssue, id: 'sub-1', title: 'Subtask 1', depth: 1, parent_id: 'test-123' },
        { ...mockIssue, id: 'sub-2', title: 'Subtask 2', depth: 1, parent_id: 'test-123' }
      ];

      mockBdCliInstance.execTreeJson.mockResolvedValue(treeNodes);
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      const result = await client.getEpicWithSubtasks('test-repo', 'test-123');

      expect(result.epic.id).toBe('test-123');
      expect(result.subtasks).toHaveLength(2);
      expect(result.subtasks[0].id).toBe('sub-1');
      expect(result.subtasks[1].id).toBe('sub-2');
    });

    it('should handle missing subtasks gracefully', async () => {
      const treeNodes = [
        { ...mockIssue, id: 'test-123', title: 'Epic Issue', depth: 0, parent_id: '', issue_type: 'epic' },
        { ...mockIssue, id: 'sub-1', title: 'Subtask 1', depth: 1, parent_id: 'test-123' }
      ];

      mockBdCliInstance.execTreeJson.mockResolvedValue(treeNodes);
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      const result = await client.getEpicWithSubtasks('test-repo', 'test-123');

      expect(result.subtasks).toHaveLength(1);
      expect(result.subtasks[0].id).toBe('sub-1');
    });
  });
});
