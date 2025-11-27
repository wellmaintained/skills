import { describe, expect, it, vi, beforeEach } from 'bun:test';
import { ExternalRefResolver } from '../../src/utils/external-ref-resolver.js';

describe('ExternalRefResolver', () => {
  const mockBeads = {
    getAllIssues: vi.fn(),
    getEpicStatus: vi.fn()
  } as any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('finds epics by github external ref', async () => {
    mockBeads.getAllIssues.mockResolvedValueOnce(
      new Map([
        [
          'frontend',
          [
            {
              id: 'front-e1',
              issue_type: 'epic',
              external_ref: 'github:org/repo#123'
            }
          ]
        ]
      ])
    );

    mockBeads.getEpicStatus.mockResolvedValueOnce({
      total: 10,
      completed: 4,
      inProgress: 3,
      blocked: 1,
      notStarted: 2,
      percentComplete: 40,
      blockers: [],
      discovered: []
    });

    const resolver = new ExternalRefResolver(mockBeads, {
      configDir: '.beads-bridge'
    });

    const result = await resolver.resolve({ repository: 'org/repo', issueNumber: 123 });

    expect(result.epics).toEqual([
      { repository: 'frontend', epicId: 'front-e1' }
    ]);
    expect(result.metrics.total).toBe(10);
    expect(result.metrics.completed).toBe(4);
  });

  it('handles shortcut external references automatically', async () => {
    mockBeads.getAllIssues.mockResolvedValueOnce(
      new Map([
        [
          'mobile',
          [
            {
              id: 'mobile-e1',
              issue_type: 'epic',
              external_ref: 'shortcut:901'
            }
          ]
        ]
      ])
    );

    mockBeads.getEpicStatus.mockResolvedValueOnce({
      total: 5,
      completed: 2,
      inProgress: 2,
      blocked: 1,
      notStarted: 0,
      percentComplete: 40,
      blockers: [],
      discovered: []
    });

    const resolver = new ExternalRefResolver(mockBeads, {
      configDir: '.beads-bridge'
    });

    const result = await resolver.resolve({ repository: 'shortcut', issueNumber: 901 });

    expect(result.epics).toEqual([
      { repository: 'mobile', epicId: 'mobile-e1' }
    ]);
    expect(mockBeads.getEpicStatus).toHaveBeenCalledWith('mobile', 'mobile-e1');
  });
});
