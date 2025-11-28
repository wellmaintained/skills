import { describe, it, expect, mock } from 'bun:test';
import { DependencyTreeBuilder } from '../../src/services/dependency-tree-builder.js';
import { BeadsClient } from '../../src/clients/beads-client.js';
import type { BeadsIssue } from '../../src/types/beads.js';

describe('DependencyTreeBuilder', () => {
  it('sorts children with closed status first', async () => {
    const mockClient = {
      getIssue: mock(async () => ({})),
    } as unknown as BeadsClient;

    const builder = new DependencyTreeBuilder(mockClient);

    const mockBdCli = {
      execTreeJson: mock(async () => [
        {
          id: 'parent-1',
          title: 'Parent',
          status: 'open',
          priority: 2,
          issue_type: 'task',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
          depth: 0,
          parent_id: '',
          truncated: false,
        },
        {
          id: 'child-closed',
          title: 'Closed Child',
          status: 'closed',
          priority: 2,
          issue_type: 'task',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
          depth: 1,
          parent_id: 'parent-1',
          truncated: false,
        },
        {
          id: 'child-open',
          title: 'Open Child',
          status: 'open',
          priority: 2,
          issue_type: 'task',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
          depth: 1,
          parent_id: 'parent-1',
          truncated: false,
        },
        {
          id: 'child-blocked',
          title: 'Blocked Child',
          status: 'blocked',
          priority: 2,
          issue_type: 'task',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
          depth: 1,
          parent_id: 'parent-1',
          truncated: false,
        },
      ]),
    };

    const tree = await builder.getEpicChildrenTree('parent-1', mockBdCli as any);

    // Verify closed children appear first
    expect(tree.dependencies).toHaveLength(3);
    expect(tree.dependencies[0].issue.id).toBe('child-closed');
    expect(tree.dependencies[0].issue.status).toBe('closed');

    // Verify non-closed children are sorted by ID
    expect(tree.dependencies[1].issue.id).toBe('child-blocked');
    expect(tree.dependencies[2].issue.id).toBe('child-open');
  });

  it('handles undefined status as open', async () => {
    const mockClient = {
      getIssue: mock(async () => ({})),
    } as unknown as BeadsClient;

    const builder = new DependencyTreeBuilder(mockClient);

    const mockBdCli = {
      execTreeJson: mock(async () => [
        {
          id: 'parent-1',
          title: 'Parent',
          status: 'open',
          priority: 2,
          issue_type: 'task',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
          depth: 0,
          parent_id: '',
          truncated: false,
        },
        {
          id: 'child-closed',
          title: 'Closed Child',
          status: 'closed',
          priority: 2,
          issue_type: 'task',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
          depth: 1,
          parent_id: 'parent-1',
          truncated: false,
        },
        {
          id: 'child-undefined',
          title: 'Undefined Status Child',
          status: undefined as any,
          priority: 2,
          issue_type: 'task',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
          depth: 1,
          parent_id: 'parent-1',
          truncated: false,
        },
      ]),
    };

    const tree = await builder.getEpicChildrenTree('parent-1', mockBdCli as any);

    // Verify closed child appears first, undefined treated as open
    expect(tree.dependencies).toHaveLength(2);
    expect(tree.dependencies[0].issue.id).toBe('child-closed');
    expect(tree.dependencies[1].issue.id).toBe('child-undefined');
  });

  it('maintains stable sort order within same status', async () => {
    const mockClient = {
      getIssue: mock(async () => ({})),
    } as unknown as BeadsClient;

    const builder = new DependencyTreeBuilder(mockClient);

    const mockBdCli = {
      execTreeJson: mock(async () => [
        {
          id: 'parent-1',
          title: 'Parent',
          status: 'open',
          priority: 2,
          issue_type: 'task',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
          depth: 0,
          parent_id: '',
          truncated: false,
        },
        {
          id: 'child-z',
          title: 'Child Z',
          status: 'open',
          priority: 2,
          issue_type: 'task',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
          depth: 1,
          parent_id: 'parent-1',
          truncated: false,
        },
        {
          id: 'child-a',
          title: 'Child A',
          status: 'open',
          priority: 2,
          issue_type: 'task',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
          depth: 1,
          parent_id: 'parent-1',
          truncated: false,
        },
        {
          id: 'child-m',
          title: 'Child M',
          status: 'open',
          priority: 2,
          issue_type: 'task',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
          depth: 1,
          parent_id: 'parent-1',
          truncated: false,
        },
      ]),
    };

    const tree = await builder.getEpicChildrenTree('parent-1', mockBdCli as any);

    // Verify alphabetical sorting by ID within same status
    expect(tree.dependencies).toHaveLength(3);
    expect(tree.dependencies[0].issue.id).toBe('child-a');
    expect(tree.dependencies[1].issue.id).toBe('child-m');
    expect(tree.dependencies[2].issue.id).toBe('child-z');
  });
});
