import { describe, it, expect } from 'vitest';
import { LiveWebBackend } from '../src/backends/liveweb.js';
import { NotSupportedError } from '../src/types/errors.js';

describe('LiveWebBackend', () => {
  it('should have correct metadata', () => {
    const backend = new LiveWebBackend();

    expect(backend.name).toBe('liveweb');
    expect(backend.supportsProjects).toBe(false);
    expect(backend.supportsSubIssues).toBe(false);
    expect(backend.supportsCustomFields).toBe(false);
  });

  it('should be always authenticated', () => {
    const backend = new LiveWebBackend();

    expect(backend.isAuthenticated()).toBe(true);
  });

  it('should return cached issue via getIssue', async () => {
    const backend = new LiveWebBackend();

    const issueData = {
      id: 'test-1',
      number: 1,
      title: 'Test Issue',
      body: '',
      state: 'open' as const,
      url: 'http://localhost:3000/issue/test-1',
      labels: [],
    };

    backend.updateState('test-1', {
      diagram: 'graph TD',
      metrics: { total: 1, completed: 0, inProgress: 0, blocked: 0, open: 1 },
      issues: [issueData],
      lastUpdate: new Date(),
    });

    const issue = await backend.getIssue('test-1');

    expect(issue).toEqual(issueData);
  });

  it('should throw NotFoundError for non-existent issue', async () => {
    const backend = new LiveWebBackend();

    await expect(backend.getIssue('nonexistent')).rejects.toThrow('Issue not found');
  });

  it('should search cached issues', async () => {
    const backend = new LiveWebBackend();

    backend.updateState('test-1', {
      diagram: 'graph TD',
      metrics: { total: 2, completed: 1, inProgress: 0, blocked: 0, open: 1 },
      issues: [
        { id: 'test-1', title: 'Parent', number: 1, body: '', state: 'open' as const, url: '', labels: [] },
        { id: 'test-2', title: 'Child Task', number: 2, body: '', state: 'closed' as const, url: '', labels: [] },
      ],
      lastUpdate: new Date(),
    });

    const openIssues = await backend.searchIssues({ state: 'open' });
    expect(openIssues).toHaveLength(1);
    expect(openIssues[0].id).toBe('test-1');

    const allIssues = await backend.searchIssues({});
    expect(allIssues).toHaveLength(2);
  });

  it('should throw NotSupportedError for write operations', async () => {
    const backend = new LiveWebBackend();

    await expect(backend.createIssue({ title: 'Test', body: '' })).rejects.toThrow(NotSupportedError);
    await expect(backend.updateIssue('test', {})).rejects.toThrow(NotSupportedError);
    await expect(backend.addComment('test', 'comment')).rejects.toThrow(NotSupportedError);
    await expect(backend.linkIssues('a', 'b', 'blocks')).rejects.toThrow(NotSupportedError);
  });
});
