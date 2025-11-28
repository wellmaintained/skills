import { describe, expect, it } from 'bun:test';
import { STATUS_STYLES, STATUS_OPTIONS } from '../../src/client/src/status';
import type { IssueStatus } from '../../src/client/src/types';

describe('STATUS_STYLES', () => {
  it('should apply opacity-70 to closed status', () => {
    const closedStyle = STATUS_STYLES.closed;
    expect(closedStyle.cardOpacity).toBe('opacity-70');
  });

  it('should not apply opacity to non-closed statuses', () => {
    const statuses: IssueStatus[] = ['open', 'in_progress', 'blocked'];
    statuses.forEach((status) => {
      expect(STATUS_STYLES[status].cardOpacity).toBeUndefined();
    });
  });

  it('should have all required style properties for all statuses', () => {
    const statuses: IssueStatus[] = ['open', 'in_progress', 'blocked', 'closed'];
    statuses.forEach((status) => {
      const style = STATUS_STYLES[status];
      expect(style.bg).toBeDefined();
      expect(style.border).toBeDefined();
      expect(style.text).toBeDefined();
      expect(typeof style.bg).toBe('string');
      expect(typeof style.border).toBe('string');
      expect(typeof style.text).toBe('string');
    });
  });

  it('should have consistent styling structure', () => {
    expect(STATUS_STYLES.open.bg).toBe('bg-slate-100');
    expect(STATUS_STYLES.in_progress.bg).toBe('bg-blue-100');
    expect(STATUS_STYLES.blocked.bg).toBe('bg-red-100');
    expect(STATUS_STYLES.closed.bg).toBe('bg-green-100');
  });
});

describe('STATUS_OPTIONS', () => {
  it('should have all status options', () => {
    expect(STATUS_OPTIONS).toHaveLength(4);
    const values = STATUS_OPTIONS.map((opt) => opt.value);
    expect(values).toContain('open');
    expect(values).toContain('in_progress');
    expect(values).toContain('blocked');
    expect(values).toContain('closed');
  });

  it('should have labels for all options', () => {
    STATUS_OPTIONS.forEach((option) => {
      expect(option.label).toBeDefined();
      expect(typeof option.label).toBe('string');
      expect(option.label.length).toBeGreaterThan(0);
    });
  });

  it('should use "Completed" label for closed status', () => {
    const closedOption = STATUS_OPTIONS.find((opt) => opt.value === 'closed');
    expect(closedOption).toBeDefined();
    expect(closedOption?.label).toBe('Completed');
  });
});
