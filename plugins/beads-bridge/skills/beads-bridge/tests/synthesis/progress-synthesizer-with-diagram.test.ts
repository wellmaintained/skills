import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProgressSynthesizer } from '../../src/synthesis/progress-synthesizer.js';
import { MermaidGenerator } from '../../src/diagrams/mermaid-generator.js';
import type { AggregatedProgress } from '../../src/types/progress.js';

describe('ProgressSynthesizer with diagram integration', () => {
  let synthesizer: ProgressSynthesizer;
  let mockBeads: any;
  let mockBackend: any;
  let mockMappings: any;
  let mockMermaid: MermaidGenerator;

  beforeEach(() => {
    mockBeads = {
      getEpicWithSubtasks: vi.fn(),
      getDependencyTree: vi.fn()
    };
    mockBackend = { name: 'shortcut' };
    mockMappings = {};
    mockMermaid = {
      generate: vi.fn()
    } as any;

    synthesizer = new ProgressSynthesizer(mockBeads, mockBackend, mockMappings);
  });

  it('should include diagram section when includeDiagram is true', async () => {
    const progress: AggregatedProgress = {
      epics: [{
        repository: 'pensive',
        epicId: 'pensive-8e2d',
        title: 'Test Epic',
        subtasks: [],
        metrics: { total: 10, completed: 5, inProgress: 2, blocked: 1, open: 2, percentComplete: 50 },
        blockers: []
      }],
      totalMetrics: { total: 10, completed: 5, inProgress: 2, blocked: 1, open: 2, percentComplete: 50 },
      allBlockers: [],
      hasBlockers: false
    };

    const comment = synthesizer.generateProgressComment(progress, {
      includeDiagram: true,
      diagramMermaid: 'graph TD\n  A[Start] --> B[End]'
    });

    expect(comment).toContain('## 📸 Dependency Diagram');
    expect(comment).toContain('```mermaid');
    expect(comment).toContain('graph TD');
    expect(comment).toContain('## Progress Update');
  });

  it('should not include diagram section when includeDiagram is false', async () => {
    const progress: AggregatedProgress = {
      epics: [{
        repository: 'pensive',
        epicId: 'pensive-8e2d',
        title: 'Test Epic',
        subtasks: [],
        metrics: { total: 10, completed: 5, inProgress: 2, blocked: 1, open: 2, percentComplete: 50 },
        blockers: []
      }],
      totalMetrics: { total: 10, completed: 5, inProgress: 2, blocked: 1, open: 2, percentComplete: 50 },
      allBlockers: [],
      hasBlockers: false
    };

    const comment = synthesizer.generateProgressComment(progress, {
      includeDiagram: false
    });

    expect(comment).not.toContain('## 📸 Dependency Diagram');
    expect(comment).not.toContain('```mermaid');
    expect(comment).toContain('## Progress Update');
  });

  it('should handle missing diagramMermaid when includeDiagram is true', async () => {
    const progress: AggregatedProgress = {
      epics: [{
        repository: 'pensive',
        epicId: 'pensive-8e2d',
        title: 'Test Epic',
        subtasks: [],
        metrics: { total: 10, completed: 5, inProgress: 2, blocked: 1, open: 2, percentComplete: 50 },
        blockers: []
      }],
      totalMetrics: { total: 10, completed: 5, inProgress: 2, blocked: 1, open: 2, percentComplete: 50 },
      allBlockers: [],
      hasBlockers: false
    };

    const comment = synthesizer.generateProgressComment(progress, {
      includeDiagram: true
      // diagramMermaid is missing
    });

    // Should gracefully skip diagram section
    expect(comment).not.toContain('## 📸 Dependency Diagram');
    expect(comment).toContain('## Progress Update');
  });

  it('should generate and include diagram when updating issue progress', async () => {
    const mockMapping = {
      id: 'test-mapping',
      beadsEpics: [{ repository: 'pensive', epicId: 'pensive-8e2d' }]
    };

    mockMappings.findByGitHubIssue = vi.fn().mockResolvedValue(mockMapping);
    mockMappings.update = vi.fn().mockResolvedValue(undefined);

    mockBeads.getEpicWithSubtasks = vi.fn().mockResolvedValue({
      epic: { id: 'pensive-8e2d', title: 'Test Epic', status: 'open' },
      subtasks: [
        { id: 'pensive-8e2d.1', title: 'Task 1', status: 'closed', dependencies: [] },
        { id: 'pensive-8e2d.2', title: 'Task 2', status: 'open', dependencies: [] }
      ]
    });

    mockMermaid.generate = vi.fn().mockResolvedValue('graph TD\n  A[Epic] --> B[Task 1]\n  A --> C[Task 2]');

    mockBackend.getIssue = vi.fn().mockResolvedValue({ id: '89216', number: 89216 });
    mockBackend.addComment = vi.fn().mockResolvedValue({ url: 'https://app.shortcut.com/story/89216/comment/1' });

    const synthesizerWithDiagram = new ProgressSynthesizer(
      mockBeads,
      mockBackend,
      mockMappings,
      mockMermaid
    );

    const result = await synthesizerWithDiagram.updateIssueProgress(
      'shortcut',
      89216,
      { includeDiagram: true }
    );

    expect(result.success).toBe(true);
    expect(mockMermaid.generate).toHaveBeenCalledWith('pensive', 'pensive-8e2d', expect.any(Object));
    expect(mockBackend.addComment).toHaveBeenCalled();

    const commentArg = mockBackend.addComment.mock.calls[0][1];
    expect(commentArg).toContain('## 📸 Dependency Diagram');
    expect(commentArg).toContain('```mermaid');
    expect(commentArg).toContain('## Progress Update');
  });
});
