import { describe, it, expect, mock } from 'bun:test';
import { LiveWebBackend } from '../src/backends/liveweb.js';
import { NotSupportedError, ValidationError } from '../src/types/errors.js';

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
      edges: [],
      rootId: 'test-1',
      lastUpdate: new Date(),
    });

    const issue = await backend.getIssue('test-1');

    expect(issue).toEqual(issueData);
  });

  it('should throw NotFoundError for non-existent issue', async () => {
    const backend = new LiveWebBackend();

    // expect(...).rejects.toThrow() syntax in Bun
    try {
      await backend.getIssue('nonexistent');
      expect(true).toBe(false); // Should not reach here
    } catch (e: any) {
      expect(e.message).toContain('Issue not found');
    }
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
      edges: [{ id: 'test-1-test-2', source: 'test-1', target: 'test-2' }],
      rootId: 'test-1',
      lastUpdate: new Date(),
    });

    const openIssues = await backend.searchIssues({ state: 'open' });
    expect(openIssues).toHaveLength(1);
    expect(openIssues[0].id).toBe('test-1');

    const allIssues = await backend.searchIssues({});
    expect(allIssues).toHaveLength(2);
  });

  it('should throw NotSupportedError for generic write operations', async () => {
    const backend = new LiveWebBackend();

    try {
      await backend.createIssue({ title: 'Test', body: '' });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(NotSupportedError);
    }

    try {
      await backend.updateIssue('test', {});
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      if (e instanceof ValidationError) {
        expect(e.message).toContain('At least one field');
      }
    }

    try {
      await backend.addComment('test', 'comment');
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(NotSupportedError);
    }

    try {
      await backend.linkIssues('a', 'b', 'blocks');
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(NotSupportedError);
    }
  });

  it('should execute bd update when updating issue status', async () => {
    const runCommand = mock(async () => '');
    const backend = new LiveWebBackend(undefined, runCommand);

    await backend.updateIssueStatus('issue-1', 'in_progress');

    expect(runCommand).toHaveBeenCalledWith(['update', 'issue-1', '--status', 'in_progress']);
  });

  it('should create subtasks and wire dependencies', async () => {
    const createdIssue = {
      id: 'child-1',
      title: 'Child',
      status: 'open',
    };
    const runCommand = mock(async () => '');
    runCommand.mockResolvedValueOnce(JSON.stringify(createdIssue));
    runCommand.mockResolvedValueOnce('');

    const backend = new LiveWebBackend(undefined, runCommand);

    const issue = await backend.createSubtask('parent-1', {
      title: 'Child',
      type: 'task',
      priority: 2,
    } as any);

    expect(issue).toEqual(createdIssue);
    expect(runCommand).toHaveBeenNthCalledWith(1, [
      'create',
      'Child',
      '-t',
      'task',
      '-p',
      '2',
      '--json',
    ]);
    expect(runCommand).toHaveBeenNthCalledWith(2, [
      'dep',
      'add',
      'child-1',
      'parent-1',
      '-t',
      'parent-child',
    ]);
  });

  it('should reparent issues by removing old deps first', async () => {
    const runCommand = mock(async () => '');

    const backend = new LiveWebBackend(undefined, runCommand);
    backend.updateState('root-issue', {
      diagram: 'graph TD',
      metrics: { total: 1, completed: 0, inProgress: 0, blocked: 0, open: 1 },
      issues: [
        {
          id: 'child-1',
          title: 'Child',
          number: 1,
          body: '',
          state: 'open',
          url: '',
          labels: [],
          metadata: { parentId: 'old-parent' },
        } as any,
      ],
      edges: [],
      rootId: 'root-issue',
      lastUpdate: new Date(),
    });

    await backend.reparentIssue('child-1', 'parent-2');

    expect(runCommand).toHaveBeenNthCalledWith(1, ['dep', 'remove', 'child-1', 'old-parent']);
    expect(runCommand).toHaveBeenNthCalledWith(2, [
      'dep',
      'add',
      'child-1',
      'parent-2',
      '-t',
      'parent-child',
    ]);
  });

  it('should tolerate missing dependency during reparent', async () => {
    const runCommand = mock(async () => '');
    runCommand.mockRejectedValueOnce(new Error('dependency from child-1 to old-parent does not exist'));
    runCommand.mockResolvedValueOnce('');
    runCommand.mockResolvedValueOnce('');

    const backend = new LiveWebBackend(undefined, runCommand);
    backend.updateState('root', {
      diagram: '',
      metrics: { total: 1, completed: 0, inProgress: 0, blocked: 0, open: 1 },
      issues: [
        {
          id: 'child-1',
          title: 'x',
          number: 1,
          body: '',
          state: 'open',
          url: '',
          labels: [],
          metadata: { parentId: 'old-parent' },
        } as any,
      ],
      edges: [],
      rootId: 'root',
      lastUpdate: new Date(),
    });

    await backend.reparentIssue('child-1', 'parent-2');

    expect(runCommand).toHaveBeenNthCalledWith(2, ['dep', 'remove', 'old-parent', 'child-1']);
    expect(runCommand).toHaveBeenNthCalledWith(3, [
      'dep',
      'add',
      'child-1',
      'parent-2',
      '-t',
      'parent-child',
    ]);
  });
});
