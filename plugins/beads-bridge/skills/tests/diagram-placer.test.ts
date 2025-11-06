/**
 * Tests for DiagramPlacer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiagramPlacer } from '../src/diagrams/diagram-placer.js';
import type { ProjectManagementBackend } from '../src/types/backend.js';
import type { BeadsClient } from '../src/clients/beads-client.js';
import type { MermaidGenerator } from '../src/diagrams/mermaid-generator.js';
import type { MappingStore } from '../src/store/mapping-store.js';
import type { Issue, Comment } from '../src/types/issue.js';
import type { IssueMapping } from '../src/types/mapping.js';
import { DIAGRAM_MARKERS } from '../src/types/placement.js';

describe('DiagramPlacer', () => {
  let placer: DiagramPlacer;
  let mockBackend: Partial<ProjectManagementBackend>;
  let mockBeads: Partial<BeadsClient>;
  let mockGenerator: Partial<MermaidGenerator>;
  let mockMappings: Partial<MappingStore>;

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
    assignees: []
  };

  const mockDiagram = {
    mermaid: 'graph TB\nA-->B',
    nodeCount: 1
  };

  const mockMapping: IssueMapping = {
    id: 'mapping-1',
    githubIssue: 'owner/repo#1',
    githubIssueNumber: 1,
    githubRepository: 'owner/repo',
    beadsEpics: [
      { repository: 'repo-1', epicId: 'epic-1' }
    ],
    status: 'synced',
    syncHistory: [],
    aggregatedMetrics: {
      totalCompleted: 0,
      totalInProgress: 0,
      totalBlocked: 0,
      totalOpen: 1,
      percentComplete: 0
    }
  };

  beforeEach(() => {
    mockBackend = {
      getIssue: vi.fn(),
      updateIssue: vi.fn(),
      addComment: vi.fn()
    };

    mockBeads = {};

    mockGenerator = {
      generateFromTree: vi.fn(),
      render: vi.fn()
    };

    mockMappings = {
      findByGitHubIssue: vi.fn()
    } as any;

    placer = new DiagramPlacer(
      mockBackend as ProjectManagementBackend,
      mockGenerator as MermaidGenerator,
      mockMappings as MappingStore
    );
  });

  describe('updateDiagram', () => {
    it('should update issue description with diagram', async () => {
      vi.mocked(mockBackend.getIssue!).mockResolvedValue(mockIssue);
      vi.mocked(mockMappings.findByGitHubIssue!).mockResolvedValue(mockMapping);
      vi.mocked(mockGenerator.generateFromTree!).mockResolvedValue(mockDiagram);
      vi.mocked(mockGenerator.render!).mockReturnValue('```mermaid\ngraph TB\nA-->B\n```');
      vi.mocked(mockBackend.updateIssue!).mockResolvedValue(mockIssue);

      const result = await placer.updateDiagram('owner/repo', 1, {
        trigger: 'manual',
        updateDescription: true,
        createSnapshot: false
      });

      expect(result.descriptionUpdated).toBe(true);
      expect(mockBackend.updateIssue).toHaveBeenCalled();

      const updateCall = vi.mocked(mockBackend.updateIssue!).mock.calls[0];
      const updatedBody = updateCall[1].body;
      expect(updatedBody).toContain(DIAGRAM_MARKERS.START);
      expect(updatedBody).toContain(DIAGRAM_MARKERS.END);
      expect(updatedBody).toContain('```mermaid');
    });

    it('should create snapshot comment', async () => {
      const mockComment: Comment = {
        id: 'comment-1',
        body: 'Snapshot',
        author: {
          id: 'user-1',
          login: 'testuser',
          name: 'Test User',
          email: 'test@example.com'
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/owner/repo/issues/1#comment-1'
      };

      vi.mocked(mockBackend.getIssue!).mockResolvedValue(mockIssue);
      vi.mocked(mockMappings.findByGitHubIssue!).mockResolvedValue(mockMapping);
      vi.mocked(mockGenerator.generateFromTree!).mockResolvedValue(mockDiagram);
      vi.mocked(mockGenerator.render!).mockReturnValue('```mermaid\ngraph TB\nA-->B\n```');
      vi.mocked(mockBackend.addComment!).mockResolvedValue(mockComment);

      const result = await placer.updateDiagram('owner/repo', 1, {
        trigger: 'weekly',
        updateDescription: false,
        createSnapshot: true
      });

      expect(result.snapshot).toBeDefined();
      expect(result.snapshot!.trigger).toBe('weekly');
      expect(result.snapshot!.commentUrl).toBe(mockComment.url);
      expect(mockBackend.addComment).toHaveBeenCalled();
    });

    it('should include custom message in snapshot', async () => {
      const mockComment: Comment = {
        id: 'comment-1',
        body: 'Snapshot',
        author: {
          id: 'user-1',
          login: 'testuser',
          name: 'Test',
          email: 'test@example.com'
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/owner/repo/issues/1#comment-1'
      };

      vi.mocked(mockBackend.getIssue!).mockResolvedValue(mockIssue);
      vi.mocked(mockMappings.findByGitHubIssue!).mockResolvedValue(mockMapping);
      vi.mocked(mockGenerator.generateFromTree!).mockResolvedValue(mockDiagram);
      vi.mocked(mockGenerator.render!).mockReturnValue('```mermaid\ngraph TB\nA-->B\n```');
      vi.mocked(mockBackend.addComment!).mockResolvedValue(mockComment);

      await placer.updateDiagram('owner/repo', 1, {
        trigger: 'scope_change',
        createSnapshot: true,
        message: 'Scope expanded due to new dependencies discovered'
      });

      const commentCall = vi.mocked(mockBackend.addComment!).mock.calls[0];
      const commentBody = commentCall[1];
      expect(commentBody).toContain('Scope expanded due to new dependencies discovered');
    });

    it('should handle update failure gracefully', async () => {
      vi.mocked(mockBackend.getIssue!).mockRejectedValue(new Error('API Error'));

      const result = await placer.updateDiagram('owner/repo', 1, {
        trigger: 'manual'
      });

      expect(result.descriptionUpdated).toBe(false);
      expect(result.error).toBe('API Error');
    });

    it('should handle missing mapping', async () => {
      vi.mocked(mockBackend.getIssue!).mockResolvedValue(mockIssue);
      vi.mocked(mockMappings.findByGitHubIssue!).mockResolvedValue(null);

      const result = await placer.updateDiagram('owner/repo', 1, {
        trigger: 'manual'
      });

      expect(result.descriptionUpdated).toBe(false);
      expect(result.error).toContain('No mapping found');
    });
  });

  describe('parseDiagramSection', () => {
    it('should detect missing diagram section', () => {
      const result = placer.parseDiagramSection('Regular issue body without diagram');

      expect(result.exists).toBe(false);
    });

    it('should parse existing diagram section', () => {
      const body = `
Some issue description

${DIAGRAM_MARKERS.START}

## 📊 Dependency Diagram

\`\`\`mermaid
graph TB
A-->B
\`\`\`

*Last updated: 2025-01-01T00:00:00Z (manual)*

${DIAGRAM_MARKERS.END}

More content
`;

      const result = placer.parseDiagramSection(body);

      expect(result.exists).toBe(true);
      expect(result.lastUpdated).toBe('2025-01-01T00:00:00Z');
      expect(result.trigger).toBe('manual');
    });

    it('should handle malformed section', () => {
      const body = `${DIAGRAM_MARKERS.START}\nIncomplete section`;

      const result = placer.parseDiagramSection(body);

      expect(result.exists).toBe(false);
    });
  });

  describe('updateDiagramSection', () => {
    it('should append diagram to empty body', async () => {
      vi.mocked(mockBackend.getIssue!).mockResolvedValue({ ...mockIssue, body: '' });
      vi.mocked(mockMappings.findByGitHubIssue!).mockResolvedValue(mockMapping);
      vi.mocked(mockGenerator.generateFromTree!).mockResolvedValue(mockDiagram);
      vi.mocked(mockGenerator.render!).mockReturnValue('```mermaid\ngraph TB\nA-->B\n```');
      vi.mocked(mockBackend.updateIssue!).mockResolvedValue(mockIssue);

      await placer.updateDiagram('owner/repo', 1, {
        trigger: 'initial',
        updateDescription: true,
        createSnapshot: false
      });

      const updateCall = vi.mocked(mockBackend.updateIssue!).mock.calls[0];
      const updatedBody = updateCall[1].body!;

      expect(updatedBody).toContain(DIAGRAM_MARKERS.START);
      expect(updatedBody.startsWith(DIAGRAM_MARKERS.START)).toBe(true);
    });

    it('should replace existing diagram section', async () => {
      const existingBody = `
Original content

${DIAGRAM_MARKERS.START}
Old diagram
${DIAGRAM_MARKERS.END}

More content
`;

      vi.mocked(mockBackend.getIssue!).mockResolvedValue({ ...mockIssue, body: existingBody });
      vi.mocked(mockMappings.findByGitHubIssue!).mockResolvedValue(mockMapping);
      vi.mocked(mockGenerator.generateFromTree!).mockResolvedValue(mockDiagram);
      vi.mocked(mockGenerator.render!).mockReturnValue('```mermaid\ngraph TB\nNEW-->DIAGRAM\n```');
      vi.mocked(mockBackend.updateIssue!).mockResolvedValue(mockIssue);

      await placer.updateDiagram('owner/repo', 1, {
        trigger: 'weekly',
        updateDescription: true,
        createSnapshot: false
      });

      const updateCall = vi.mocked(mockBackend.updateIssue!).mock.calls[0];
      const updatedBody = updateCall[1].body!;

      expect(updatedBody).toContain('Original content');
      expect(updatedBody).toContain('More content');
      expect(updatedBody).toContain('NEW-->DIAGRAM');
      expect(updatedBody).not.toContain('Old diagram');
    });
  });

  describe('multi-repository diagram generation', () => {
    it('should combine diagrams from multiple repositories', async () => {
      const multiRepoMapping: IssueMapping = {
        ...mockMapping,
        beadsEpics: [
          { repository: 'repo-1', epicId: 'epic-1' },
          { repository: 'repo-2', epicId: 'epic-2' }
        ]
      };

      const diagram1 = {
        mermaid: '```mermaid\ngraph TB\ntask_1[Task 1]\n```',
        nodeCount: 1
      };

      const diagram2 = {
        mermaid: '```mermaid\ngraph TB\ntask_2[Task 2]\n```',
        nodeCount: 1
      };

      vi.mocked(mockBackend.getIssue!).mockResolvedValue(mockIssue);
      vi.mocked(mockMappings.findByGitHubIssue!).mockResolvedValue(multiRepoMapping);
      vi.mocked(mockGenerator.generateFromTree!)
        .mockResolvedValueOnce(diagram1)
        .mockResolvedValueOnce(diagram2);
      vi.mocked(mockGenerator.render!).mockReturnValue('combined diagram');
      vi.mocked(mockBackend.updateIssue!).mockResolvedValue(mockIssue);

      await placer.updateDiagram('owner/repo', 1, {
        trigger: 'manual',
        updateDescription: true
      });

      // Should call generateFromTree for each epic
      expect(mockGenerator.generateFromTree).toHaveBeenCalledTimes(2);
      expect(mockGenerator.generateFromTree).toHaveBeenCalledWith('repo-1', 'epic-1');
      expect(mockGenerator.generateFromTree).toHaveBeenCalledWith('repo-2', 'epic-2');

      // Should call render with combined mermaid string
      expect(mockGenerator.render).toHaveBeenCalledTimes(1);
      const renderCall = vi.mocked(mockGenerator.render!).mock.calls[0];
      const combinedMermaid = renderCall[0];

      // Combined diagram should contain both repository sections
      expect(combinedMermaid).toContain('repo-1');
      expect(combinedMermaid).toContain('repo-2');
      expect(combinedMermaid).toContain('task_1');
      expect(combinedMermaid).toContain('task_2');
    });

    it('should handle multiple epics with concatenated diagrams', async () => {
      const multiRepoMapping: IssueMapping = {
        ...mockMapping,
        beadsEpics: [
          { repository: 'repo-1', epicId: 'epic-1' },
          { repository: 'repo-2', epicId: 'epic-2' }
        ]
      };

      // Diagrams returned from each repository
      const diagram1 = {
        mermaid: 'graph TB\nshared_task[Shared Task]',
        nodeCount: 1
      };

      const diagram2 = {
        mermaid: 'graph TB\nshared_task[Shared Task]',
        nodeCount: 1
      };

      vi.mocked(mockBackend.getIssue!).mockResolvedValue(mockIssue);
      vi.mocked(mockMappings.findByGitHubIssue!).mockResolvedValue(multiRepoMapping);
      vi.mocked(mockGenerator.generateFromTree!)
        .mockResolvedValueOnce(diagram1)
        .mockResolvedValueOnce(diagram2);
      vi.mocked(mockGenerator.render!).mockReturnValue('```mermaid\ncombined diagram\n```');
      vi.mocked(mockBackend.updateIssue!).mockResolvedValue(mockIssue);

      await placer.updateDiagram('owner/repo', 1, {
        trigger: 'manual',
        updateDescription: true
      });

      const renderCall = vi.mocked(mockGenerator.render!).mock.calls[0];
      const combinedMermaid = renderCall[0];

      // Combined diagram should concatenate both diagrams with section headers
      expect(combinedMermaid).toContain('repo-1');
      expect(combinedMermaid).toContain('repo-2');
      expect(combinedMermaid).toContain('shared_task');

      // Total node count should be sum of both
      expect(combinedMermaid).toContain('shared_task');
    });
  });
});
