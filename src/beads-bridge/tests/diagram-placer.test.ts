import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { DiagramPlacer } from '../src/diagrams/diagram-placer.js';
import type { ProjectManagementBackend } from '../src/types/backend.js';
import type { MermaidGenerator } from '../src/diagrams/mermaid-generator.js';
import type { ExternalRefResolver } from '../src/utils/external-ref-resolver.js';
import type { Issue, Comment } from '../src/types/core.js';
import { DIAGRAM_MARKERS } from '../src/types/placement.js';

describe('DiagramPlacer', () => {
  let placer: DiagramPlacer;
  let mockBackend: Partial<ProjectManagementBackend>;
  let mockGenerator: Partial<MermaidGenerator>;
  let mockResolver: Partial<ExternalRefResolver>;

  const mockIssue: Issue = {
    id: 'issue-1',
    number: 1,
    title: 'Test Issue',
    body: 'Original issue body',
    state: 'open',
    url: 'https://github.com/owner/repo/issues/1',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    labels: [],
    assignees: [],
    metadata: {}
  };

  const mockComment: Comment = {
    id: 'comment-1',
    body: 'Snapshot',
    author: {
      id: 'user-1',
      login: 'tester'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    url: 'https://github.com/owner/repo/issues/1#comment-1'
  };

  beforeEach(() => {
    mockBackend = {
      getIssue: mock().mockResolvedValue({ ...mockIssue }),
      updateIssue: mock().mockResolvedValue(mockIssue),
      addComment: mock().mockResolvedValue(mockComment)
    };

    mockGenerator = {
      generateFromTree: mock().mockResolvedValue({ mermaid: 'graph TB\nA-->B', nodeCount: 2 }),
      render: mock().mockReturnValue('```mermaid\ngraph TB\nA-->B\n```')
    };

    mockResolver = {
      resolve: mock().mockResolvedValue({
        externalRef: 'github:owner/repo#1',
        epics: [{ repository: 'repo-1', epicId: 'epic-1' }],
        metrics: {
          total: 2,
          completed: 1,
          inProgress: 0,
          blocked: 0,
          notStarted: 1,
          percentComplete: 50,
          blockers: [],
          discovered: []
        }
      })
    };

    placer = new DiagramPlacer(
      mockBackend as ProjectManagementBackend,
      mockGenerator as MermaidGenerator,
      mockResolver as ExternalRefResolver
    );
  });

  it('updates the issue description with rendered diagram', async () => {
    const result = await placer.updateDiagram('owner/repo', 1, {
      updateDescription: true,
      createSnapshot: false,
      trigger: 'manual'
    });

    expect(result.descriptionUpdated).toBe(true);
    expect((mockBackend.updateIssue as any)).toHaveBeenCalledWith(mockIssue.id, {
      body: expect.stringContaining(DIAGRAM_MARKERS.START)
    });
  });

  it('creates snapshot comments when requested', async () => {
    const result = await placer.updateDiagram('owner/repo', 1, {
      updateDescription: false,
      createSnapshot: true,
      trigger: 'manual',
      message: 'Progress snapshot'
    });

    expect(result.snapshot).toBeDefined();
    expect((mockBackend.addComment as any)).toHaveBeenCalled();
  });

  it('returns error when resolver finds no epics', async () => {
    (mockResolver.resolve as any).mockResolvedValueOnce({
      externalRef: 'github:owner/repo#1',
      epics: [],
      metrics: {
        total: 0,
        completed: 0,
        inProgress: 0,
        blocked: 0,
        notStarted: 0,
        percentComplete: 0,
        blockers: [],
        discovered: []
      }
    });

    const result = await placer.updateDiagram('owner/repo', 1, {
      updateDescription: true,
      createSnapshot: false,
      trigger: 'manual'
    });

    expect(result.error).toContain('external_ref');
  });

  describe('parseDiagramSection', () => {
    it('detects existing section with timestamp', () => {
      const body = [
        DIAGRAM_MARKERS.START,
        '',
        DIAGRAM_MARKERS.SECTION_HEADER,
        '',
        '```mermaid',
        'graph TB',
        'A-->B',
        '```',
        '',
        `${DIAGRAM_MARKERS.LAST_UPDATED_PREFIX} 2025-01-01T00:00:00.000Z (manual)*`,
        '',
        DIAGRAM_MARKERS.END
      ].join('\n');

      const result = placer.parseDiagramSection(body);

      expect(result.exists).toBe(true);
      expect(result.lastUpdated).toBe('2025-01-01T00:00:00.000Z');
      expect(result.trigger).toBe('manual');
    });

    it('returns false when markers missing', () => {
      const result = placer.parseDiagramSection('No diagram here');
      expect(result.exists).toBe(false);
    });
  });
});
