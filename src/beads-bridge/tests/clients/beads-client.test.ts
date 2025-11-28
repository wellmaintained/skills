/**
 * Unit tests for BeadsClient
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

// Mock BdCli module
let mockBdCliInstance: any;
mock.module('../../src/utils/bd-cli.js', () => ({
  BdCli: mock(() => mockBdCliInstance)
}));

describe('BeadsClient', () => {
  let client: BeadsClient;

  const mockConfig: BeadsConfig = {
    repositoryPath: '/path/to/test-repo',
    prefix: 'test'
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
  // Repository Info
  // ============================================================================

  describe('Repository Info', () => {
    it('should return repository path', () => {
      expect(client.getRepositoryPath()).toBe('/path/to/test-repo');
    });

    it('should return prefix', () => {
      expect(client.getPrefix()).toBe('test');
    });
  });

  // ============================================================================
  // List Operations
  // ============================================================================

  describe('List Operations', () => {
    it('should list all issues without filters', async () => {
      const mockIssues = [mockIssue, { ...mockIssue, id: 'test-456' }];
      mockBdCliInstance.execJson.mockResolvedValue(mockIssues);

      const issues = await client.listIssues();

      expect(mockBdCliInstance.execJson).toHaveBeenCalledWith(['list']);
      expect(issues).toEqual(mockIssues);
    });

    it('should list issues with status filter', async () => {
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      await client.listIssues({ status: 'open' });

      expect(mockBdCliInstance.execJson).toHaveBeenCalledWith(['list', '--status', 'open']);
    });

    it('should list issues with multiple filters', async () => {
      mockBdCliInstance.execJson.mockResolvedValue([mockIssue]);

      await client.listIssues({
        status: 'in_progress',
        priority: 1,
        type: 'feature',
        assignee: 'dev1'
      });

      const call = mockBdCliInstance.execJson.mock.calls[0][0];
      expect(call).toContain('list');
      expect(call).toContain('--status');
      expect(call).toContain('in_progress');
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

    it('should throw NotFoundError when issue does not exist', async () => {
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

      const issue = await client.updateIssue('test-123', updates);

      expect(mockBdCliInstance.exec).toHaveBeenCalledWith(['update', 'test-123', '--status', 'in_progress']);
      expect(issue.status).toBe('in_progress');
    });
  });

  // ============================================================================
  // Close Operations
  // ============================================================================

  describe('Close Operations', () => {
    it('should close issue without reason', async () => {
      mockBdCliInstance.exec.mockResolvedValue({ stdout: '', stderr: '' });

      await client.closeIssue('test-123');

      expect(mockBdCliInstance.exec).toHaveBeenCalledWith(['close', 'test-123']);
    });

    it('should close issue with reason', async () => {
      mockBdCliInstance.exec.mockResolvedValue({ stdout: '', stderr: '' });

      await client.closeIssue('test-123', 'Duplicate');

      expect(mockBdCliInstance.exec).toHaveBeenCalledWith(['close', 'test-123', '--reason', 'Duplicate']);
    });
  });

  // ============================================================================
  // Dependency Operations
  // ============================================================================

  describe('Dependency Operations', () => {
    it('should add dependency with default type', async () => {
      mockBdCliInstance.exec.mockResolvedValue({ stdout: '', stderr: '' });

      await client.addDependency('test-123', 'test-456');

      expect(mockBdCliInstance.exec).toHaveBeenCalledWith(['dep', 'add', 'test-123', 'test-456', '--type', 'blocks']);
    });
  });
});