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
  UpdateBeadsIssueParams
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

  const mockConfig: BeadsConfig = {};

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

  // ============================================================================
  // List Operations
  // ============================================================================

  describe('List Operations', () => {
    it('should list all issues', async () => {
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      const issues = await client.listIssues();

      expect(mockBdCliInstance.execJson).toHaveBeenCalledWith(['list']);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual(mockIssue);
    });

    it('should list issues with status filter', async () => {
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      await client.listIssues({ status: 'open' });

      expect(mockBdCliInstance.execJson).toHaveBeenCalledWith(['list', '--status', 'open']);
    });

    it('should list issues with priority filter', async () => {
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      await client.listIssues({ priority: 1 });

      expect(mockBdCliInstance.execJson).toHaveBeenCalledWith(['list', '--priority', '1']);
    });

    it('should list issues with type filter', async () => {
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      await client.listIssues({ type: 'bug' });

      expect(mockBdCliInstance.execJson).toHaveBeenCalledWith(['list', '--type', 'bug']);
    });

    it('should list issues with assignee filter', async () => {
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      await client.listIssues({ assignee: 'dev1' });

      expect(mockBdCliInstance.execJson).toHaveBeenCalledWith(['list', '--assignee', 'dev1']);
    });

    it('should list issues with labels filter', async () => {
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      await client.listIssues({ labels: ['bug'] });

      expect(mockBdCliInstance.execJson).toHaveBeenCalledWith(['list', '--label', 'bug']);
    });


  });

  // ============================================================================
  // Get Operations
  // ============================================================================

  describe('Get Operations', () => {
    it('should get issue by ID', async () => {
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      const issue = await client.getIssue('test-123');

      expect(mockBdCliInstance.execJson).toHaveBeenCalledWith(['list', '--id', 'test-123']);
      expect(issue).toEqual(mockIssue);
    });

    it('should throw NotFoundError when issue not found', async () => {
      mockBdCliInstance.execJson.mockResolvedValue([]);

      await expect(client.getIssue('non-existent')).rejects.toThrow(NotFoundError);
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

      const issue = await client.createIssue(params);

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

      await client.createIssue(params);

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

      await client.createEpic(params);

      const call = mockBdCliInstance.execJson.mock.calls[0][0];
      expect(call).toContain('-t');
      expect(call).toContain('epic');
    });

    it('should default to epic type when creating epic without type', async () => {
      const params: CreateBeadsIssueParams = {
        title: 'Epic without type'
      };

      mockBdCliInstance.execJson.mockResolvedValue(mockIssue);

      await client.createEpic(params);

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
        title: 'Updated Title'
      };

      mockBdCliInstance.exec.mockResolvedValue(undefined);
      mockBdCliInstance.execJson.mockResolvedValue([{ ...mockIssue, title: 'Updated Title' }]);

      await client.updateIssue('test-123', updates);

      expect(mockBdCliInstance.exec).toHaveBeenCalledWith(['update', 'test-123', '--title', 'Updated Title']);
    });

    it('should update issue with multiple fields', async () => {
      const updates: UpdateBeadsIssueParams = {
        title: 'Updated Title',
        description: 'Updated description',
        status: 'in_progress',
        priority: 1
      };

      mockBdCliInstance.exec.mockResolvedValue(undefined);
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      await client.updateIssue('test-123', updates);

      const call = mockBdCliInstance.exec.mock.calls[0][0];
      expect(call).toContain('update');
      expect(call).toContain('test-123');
      expect(call).toContain('--title');
      expect(call).toContain('Updated Title');
      expect(call).toContain('--description');
      expect(call).toContain('Updated description');
      expect(call).toContain('--status');
      expect(call).toContain('in_progress');
      expect(call).toContain('--priority');
      expect(call).toContain('1');
    });
  });

  // ============================================================================
  // Close Operations
  // ============================================================================

  describe('Close Operations', () => {
    it('should close issue without reason', async () => {
      mockBdCliInstance.exec.mockResolvedValue(undefined);

      await client.closeIssue('test-123');

      expect(mockBdCliInstance.exec).toHaveBeenCalledWith(['close', 'test-123']);
    });

    it('should close issue with reason', async () => {
      mockBdCliInstance.exec.mockResolvedValue(undefined);

      await client.closeIssue('test-123', 'Completed');

      expect(mockBdCliInstance.exec).toHaveBeenCalledWith(['close', 'test-123', '--reason', 'Completed']);
    });
  });

  // ============================================================================
  // Dependency Operations
  // ============================================================================

  describe('Dependency Operations', () => {
    it('should add dependency with default type', async () => {
      mockBdCliInstance.exec.mockResolvedValue(undefined);

      await client.addDependency('test-123', 'test-456');

      expect(mockBdCliInstance.exec).toHaveBeenCalledWith(['dep', 'add', 'test-123', 'test-456', '--type', 'blocks']);
    });

    it('should add dependency with custom type', async () => {
      mockBdCliInstance.exec.mockResolvedValue(undefined);

      await client.addDependency('test-123', 'test-456', 'discovered-from');

      expect(mockBdCliInstance.exec).toHaveBeenCalledWith(['dep', 'add', 'test-123', 'test-456', '--type', 'discovered-from']);
    });
  });

  // ============================================================================
  // Epic Status Calculation
  // ============================================================================

  describe('Epic Status Calculation', () => {
    it('should get epic children tree', async () => {
      const mockTreeNodes = [
        {
          id: 'epic-1',
          title: 'Epic',
          status: 'open',
          priority: 1,
          issue_type: 'epic',
          created_at: '2025-11-05T10:00:00Z',
          updated_at: '2025-11-05T10:00:00Z',
          depth: 0,
          parent_id: '',
          truncated: false
        },
        {
          id: 'task-1',
          title: 'Task 1',
          status: 'open',
          priority: 2,
          issue_type: 'task',
          created_at: '2025-11-05T10:00:00Z',
          updated_at: '2025-11-05T10:00:00Z',
          depth: 1,
          parent_id: 'epic-1',
          truncated: false
        }
      ];

      mockBdCliInstance.execTreeJson.mockResolvedValue(mockTreeNodes);

      const tree = await client.getEpicChildrenTree('epic-1');

      expect(mockBdCliInstance.execTreeJson).toHaveBeenCalledWith('epic-1', true);
      expect(tree.issue.id).toBe('epic-1');
      expect(tree.dependencies).toHaveLength(1);
      expect(tree.dependencies[0].issue.id).toBe('task-1');
    });

    it('should calculate epic status', async () => {
      const mockTreeNodes = [
        {
          id: 'epic-1',
          title: 'Epic',
          status: 'open',
          priority: 1,
          issue_type: 'epic',
          created_at: '2025-11-05T10:00:00Z',
          updated_at: '2025-11-05T10:00:00Z',
          depth: 0,
          parent_id: '',
          truncated: false
        },
        {
          id: 'task-1',
          title: 'Task 1',
          status: 'closed',
          priority: 2,
          issue_type: 'task',
          created_at: '2025-11-05T10:00:00Z',
          updated_at: '2025-11-05T10:00:00Z',
          depth: 1,
          parent_id: 'epic-1',
          truncated: false
        },
        {
          id: 'task-2',
          title: 'Task 2',
          status: 'in_progress',
          priority: 2,
          issue_type: 'task',
          created_at: '2025-11-05T10:00:00Z',
          updated_at: '2025-11-05T10:00:00Z',
          depth: 1,
          parent_id: 'epic-1',
          truncated: false
        }
      ];

      mockBdCliInstance.execTreeJson.mockResolvedValue(mockTreeNodes);

      const status = await client.getEpicStatus('epic-1');

      expect(status.total).toBe(2);
      expect(status.completed).toBe(1);
      expect(status.inProgress).toBe(1);
      expect(status.percentComplete).toBe(50);
    });
  });

  // ============================================================================
  // Discovery Detection
  // ============================================================================

  describe('Discovery Detection', () => {
    it('should get discovered issues', async () => {
      const discoveredIssue: BeadsIssue = {
        ...mockIssue,
        id: 'discovered-1',
        dependencies: [
          {
            id: 'parent-1',
            content_hash: 'hash1',
            title: 'Parent Issue',
            description: 'Parent description',
            status: 'open',
            priority: 2,
            issue_type: 'task',
            created_at: '2025-11-05T10:00:00Z',
            updated_at: '2025-11-05T10:00:00Z',
            dependency_type: 'discovered-from'
          }
        ]
      };

      mockBdCliInstance.execJson.mockResolvedValue([discoveredIssue]);

      const discovered = await client.getDiscoveredIssues();

      expect(discovered).toHaveLength(1);
      expect(discovered[0].id).toBe('discovered-1');
    });

    it('should filter discovered issues by date', async () => {
      const oldIssue: BeadsIssue = {
        ...mockIssue,
        id: 'old-1',
        created_at: '2025-11-01T10:00:00Z',
        dependencies: [
          {
            id: 'parent-1',
            content_hash: 'hash1',
            title: 'Parent 1',
            description: 'Description',
            status: 'open',
            priority: 2,
            issue_type: 'task',
            created_at: '2025-11-05T10:00:00Z',
            updated_at: '2025-11-05T10:00:00Z',
            dependency_type: 'discovered-from'
          }
        ]
      };

      const newIssue: BeadsIssue = {
        ...mockIssue,
        id: 'new-1',
        created_at: '2025-11-10T10:00:00Z',
        dependencies: [
          {
            id: 'parent-2',
            content_hash: 'hash2',
            title: 'Parent 2',
            description: 'Description',
            status: 'open',
            priority: 2,
            issue_type: 'task',
            created_at: '2025-11-05T10:00:00Z',
            updated_at: '2025-11-05T10:00:00Z',
            dependency_type: 'discovered-from'
          }
        ]
      };

      mockBdCliInstance.execJson.mockResolvedValue([oldIssue, newIssue]);

      const discovered = await client.getDiscoveredIssues(new Date('2025-11-05T00:00:00Z'));

      expect(discovered).toHaveLength(1);
      expect(discovered[0].id).toBe('new-1');
    });
  });
});
