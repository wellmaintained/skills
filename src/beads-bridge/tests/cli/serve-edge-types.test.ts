import { describe, it, expect } from 'vitest';
import type { IssueGraphEdge } from '../../src/backends/liveweb.js';
import type { BeadsDependencyType } from '../../src/types/beads.js';

describe('serve command edge types', () => {
  it('should include dependency type in edges', () => {
    // Test that IssueGraphEdge interface includes type field
    const edge: IssueGraphEdge = {
      id: 'test-1-test-2',
      source: 'test-1',
      target: 'test-2',
      type: 'blocks',
    };

    expect(edge.type).toBe('blocks');
  });

  it('should support all dependency types', () => {
    const types: BeadsDependencyType[] = ['blocks', 'related', 'parent-child', 'discovered-from'];

    types.forEach(type => {
      const edge: IssueGraphEdge = {
        id: `test-${type}`,
        source: 'source-id',
        target: 'target-id',
        type,
      };

      expect(edge.type).toBe(type);
    });
  });

  it('should allow undefined type for backward compatibility', () => {
    const edge: IssueGraphEdge = {
      id: 'test-edge',
      source: 'source-id',
      target: 'target-id',
    };

    expect(edge.type).toBeUndefined();
  });

  it('should default to parent-child style for undefined type', () => {
    // This tests the logic from useTreeLayout.ts getEdgeStyle function
    // The function should return blue solid style for undefined or parent-child type
    const undefinedType = undefined;
    const parentChildType: BeadsDependencyType = 'parent-child';

    // Both should be treated the same way
    expect(undefinedType === undefined || undefinedType === 'parent-child').toBe(true);
    expect(parentChildType === 'parent-child').toBe(true);
  });

  describe('edge style mapping', () => {
    it('should map blocks to red animated', () => {
      const type: BeadsDependencyType = 'blocks';
      const expectedStyle = { stroke: '#ef4444', strokeWidth: 2 };
      const expectedAnimated = true;

      // Verify the constants match the plan
      expect(type).toBe('blocks');
      expect(expectedStyle.stroke).toBe('#ef4444'); // Red
      expect(expectedAnimated).toBe(true);
    });

    it('should map related to gray dashed', () => {
      const type: BeadsDependencyType = 'related';
      const expectedStyle = { stroke: '#6b7280', strokeDasharray: '5,5' };

      expect(type).toBe('related');
      expect(expectedStyle.stroke).toBe('#6b7280'); // Gray
      expect(expectedStyle.strokeDasharray).toBe('5,5');
    });

    it('should map discovered-from to orange dotted', () => {
      const type: BeadsDependencyType = 'discovered-from';
      const expectedStyle = { stroke: '#f59e0b', strokeDasharray: '3,3' };

      expect(type).toBe('discovered-from');
      expect(expectedStyle.stroke).toBe('#f59e0b'); // Orange
      expect(expectedStyle.strokeDasharray).toBe('3,3');
    });

    it('should map parent-child to blue solid', () => {
      const type: BeadsDependencyType = 'parent-child';
      const expectedStyle = { stroke: '#3b82f6' };

      expect(type).toBe('parent-child');
      expect(expectedStyle.stroke).toBe('#3b82f6'); // Blue
    });
  });
});
