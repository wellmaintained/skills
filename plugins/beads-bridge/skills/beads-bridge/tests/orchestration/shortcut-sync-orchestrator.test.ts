/**
 * Tests for ShortcutSyncOrchestrator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShortcutSyncOrchestrator } from '../../src/orchestration/shortcut-sync-orchestrator.js';
import type { BeadsClient } from '../../src/clients/beads-client.js';
import type { ShortcutBackend } from '../../src/backends/shortcut.js';
import type { MermaidGenerator } from '../../src/diagrams/mermaid-generator.js';
import type { MappingStore } from '../../src/store/mapping-store.js';

describe('ShortcutSyncOrchestrator', () => {
  let orchestrator: ShortcutSyncOrchestrator;
  let mockBeads: Partial<BeadsClient>;
  let mockBackend: Partial<ShortcutBackend>;
  let mockMermaid: Partial<MermaidGenerator>;
  let mockMappings: Partial<MappingStore>;

  beforeEach(() => {
    // Create mocks for all dependencies
    mockBeads = {
      getEpicWithSubtasks: vi.fn()
    };

    mockBackend = {
      getIssue: vi.fn(),
      addComment: vi.fn()
    };

    mockMermaid = {
      generate: vi.fn()
    };

    mockMappings = {
      findByGitHubIssue: vi.fn(),
      update: vi.fn()
    };

    orchestrator = new ShortcutSyncOrchestrator(
      mockBeads as BeadsClient,
      mockBackend as ShortcutBackend,
      mockMermaid as MermaidGenerator,
      mockMappings as MappingStore
    );
  });

  describe('constructor', () => {
    it('should instantiate with dependencies', () => {
      expect(orchestrator).toBeInstanceOf(ShortcutSyncOrchestrator);
    });
  });

  describe('syncStory', () => {
    it('should exist and return SyncResult', async () => {
      const result = await orchestrator.syncStory(12345);

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.storyId).toBe(12345);
      expect(result.syncedAt).toBeDefined();
    });

    it('should accept optional SyncOptions', async () => {
      const result = await orchestrator.syncStory(12345, {
        userNarrative: 'Test narrative'
      });

      expect(result).toBeDefined();
      expect(result.storyId).toBe(12345);
    });

    it('should handle errors gracefully', async () => {
      // This test verifies that try-catch wraps the implementation
      const result = await orchestrator.syncStory(12345);

      // Even if implementation fails, should return structured result
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('storyId');
      expect(result).toHaveProperty('syncedAt');
    });

    describe('Yak Map section update', () => {
      it('should update Yak Map section in story description', async () => {
        const storyId = 89216;
        const epicRepo = 'pensive';
        const epicId = 'pensive-8e2d';

        // Mock mapping lookup
        mockMappings.findByGitHubIssue = vi.fn().mockResolvedValue({
          id: 'mapping-1',
          githubIssue: 'shortcut#89216',
          githubIssueNumber: 89216,
          githubRepository: 'shortcut',
          beadsEpics: [{
            repository: epicRepo,
            epicId: epicId,
            repositoryPath: '/path/to/pensive',
            createdAt: '2025-11-01T00:00:00.000Z',
            lastUpdatedAt: '2025-11-01T00:00:00.000Z',
            status: 'open',
            completedIssues: 0,
            totalIssues: 0
          }],
          status: 'active',
          createdAt: '2025-11-01T00:00:00.000Z',
          updatedAt: '2025-11-01T00:00:00.000Z',
          syncHistory: [],
          aggregatedMetrics: {
            totalCompleted: 0,
            totalInProgress: 0,
            totalBlocked: 0,
            totalNotStarted: 0,
            percentComplete: 0,
            lastCalculatedAt: '2025-11-01T00:00:00.000Z'
          },
          metadata: {}
        });

        // Mock story fetch
        mockBackend.getIssue = vi.fn().mockResolvedValue({
          id: storyId.toString(),
          number: storyId,
          title: 'Test Story',
          body: 'Existing description\n\nMore content',
          state: 'open',
          url: 'https://app.shortcut.com/story/89216',
          createdAt: new Date(),
          updatedAt: new Date(),
          assignees: [],
          labels: []
        });

        // Mock diagram generation
        const mockDiagram = 'graph TD\n  A["Task A"]:::completed\n  B["Task B"]:::in_progress';
        mockMermaid.generate = vi.fn().mockResolvedValue(mockDiagram);

        // Mock story update
        mockBackend.updateIssue = vi.fn().mockResolvedValue({
          id: storyId.toString(),
          number: storyId,
          title: 'Test Story',
          body: 'Updated body with Yak Map',
          state: 'open',
          url: 'https://app.shortcut.com/story/89216',
          createdAt: new Date(),
          updatedAt: new Date(),
          assignees: [],
          labels: []
        });

        // Mock comment posting (stub for now)
        mockBackend.addComment = vi.fn().mockResolvedValue({
          id: 'comment-1',
          body: 'Progress update',
          createdAt: new Date(),
          updatedAt: new Date(),
          author: { id: 'user-1', login: 'bot', name: 'Bot' }
        });

        const result = await orchestrator.syncStory(storyId);

        // Verify success
        expect(result.success).toBe(true);
        expect(result.storyId).toBe(storyId);
        expect(result.storyUrl).toBe('https://app.shortcut.com/story/89216');

        // Verify mapping lookup was called
        expect(mockMappings.findByGitHubIssue).toHaveBeenCalledWith('shortcut', storyId);

        // Verify diagram was generated from primary epic
        expect(mockMermaid.generate).toHaveBeenCalledWith(epicRepo, epicId);

        // Verify story description was updated
        expect(mockBackend.updateIssue).toHaveBeenCalledWith(
          storyId.toString(),
          expect.objectContaining({
            body: expect.stringContaining('<!-- YAK_MAP_START -->')
          })
        );

        // Verify the updated body has correct Yak Map section format
        const updateCall = mockBackend.updateIssue.mock.calls[0];
        const updatedBody = updateCall[1].body;

        expect(updatedBody).toContain('<!-- YAK_MAP_START -->');
        expect(updatedBody).toContain('<!-- YAK_MAP_END -->');
        expect(updatedBody).toContain('## Yak Map');
        expect(updatedBody).toContain('```mermaid');
        expect(updatedBody).toContain(mockDiagram);
        expect(updatedBody).toContain('```');
        expect(updatedBody).toMatch(/Last updated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });

      it('should append Yak Map section when it does not exist', async () => {
        const storyId = 89216;

        // Setup mocks
        mockMappings.findByGitHubIssue = vi.fn().mockResolvedValue({
          id: 'mapping-1',
          githubIssue: 'shortcut#89216',
          githubIssueNumber: 89216,
          githubRepository: 'shortcut',
          beadsEpics: [{
            repository: 'pensive',
            epicId: 'pensive-8e2d',
            repositoryPath: '/path/to/pensive',
            createdAt: '2025-11-01T00:00:00.000Z',
            lastUpdatedAt: '2025-11-01T00:00:00.000Z',
            status: 'open',
            completedIssues: 0,
            totalIssues: 0
          }],
          status: 'active',
          createdAt: '2025-11-01T00:00:00.000Z',
          updatedAt: '2025-11-01T00:00:00.000Z',
          syncHistory: [],
          aggregatedMetrics: {
            totalCompleted: 0,
            totalInProgress: 0,
            totalBlocked: 0,
            totalNotStarted: 0,
            percentComplete: 0,
            lastCalculatedAt: '2025-11-01T00:00:00.000Z'
          },
          metadata: {}
        });

        mockBackend.getIssue = vi.fn().mockResolvedValue({
          id: storyId.toString(),
          number: storyId,
          title: 'Test Story',
          body: 'Description without Yak Map section',
          state: 'open',
          url: 'https://app.shortcut.com/story/89216',
          createdAt: new Date(),
          updatedAt: new Date(),
          assignees: [],
          labels: []
        });

        mockMermaid.generate = vi.fn().mockResolvedValue('graph TD\n  A --> B');
        mockBackend.updateIssue = vi.fn().mockResolvedValue({
          id: storyId.toString(),
          number: storyId,
          title: 'Test Story',
          body: 'Updated',
          state: 'open',
          url: 'https://app.shortcut.com/story/89216',
          createdAt: new Date(),
          updatedAt: new Date(),
          assignees: [],
          labels: []
        });
        mockBackend.addComment = vi.fn().mockResolvedValue({
          id: 'comment-1',
          body: 'Progress',
          createdAt: new Date(),
          updatedAt: new Date(),
          author: { id: 'user-1', login: 'bot', name: 'Bot' }
        });

        await orchestrator.syncStory(storyId);

        // Verify the section was appended (not updated in place)
        const updateCall = mockBackend.updateIssue.mock.calls[0];
        const updatedBody = updateCall[1].body;

        expect(updatedBody).toContain('Description without Yak Map section');
        expect(updatedBody).toContain('<!-- YAK_MAP_START -->');
      });

      it('should update existing Yak Map section in place', async () => {
        const storyId = 89216;
        const existingBody = `Description

<!-- YAK_MAP_START -->
## Yak Map

\`\`\`mermaid
graph TD
  Old["Old Diagram"]
\`\`\`

Last updated: 2025-11-01T00:00:00.000Z
<!-- YAK_MAP_END -->

More content below`;

        // Setup mocks
        mockMappings.findByGitHubIssue = vi.fn().mockResolvedValue({
          id: 'mapping-1',
          githubIssue: 'shortcut#89216',
          githubIssueNumber: 89216,
          githubRepository: 'shortcut',
          beadsEpics: [{
            repository: 'pensive',
            epicId: 'pensive-8e2d',
            repositoryPath: '/path/to/pensive',
            createdAt: '2025-11-01T00:00:00.000Z',
            lastUpdatedAt: '2025-11-01T00:00:00.000Z',
            status: 'open',
            completedIssues: 0,
            totalIssues: 0
          }],
          status: 'active',
          createdAt: '2025-11-01T00:00:00.000Z',
          updatedAt: '2025-11-01T00:00:00.000Z',
          syncHistory: [],
          aggregatedMetrics: {
            totalCompleted: 0,
            totalInProgress: 0,
            totalBlocked: 0,
            totalNotStarted: 0,
            percentComplete: 0,
            lastCalculatedAt: '2025-11-01T00:00:00.000Z'
          },
          metadata: {}
        });

        mockBackend.getIssue = vi.fn().mockResolvedValue({
          id: storyId.toString(),
          number: storyId,
          title: 'Test Story',
          body: existingBody,
          state: 'open',
          url: 'https://app.shortcut.com/story/89216',
          createdAt: new Date(),
          updatedAt: new Date(),
          assignees: [],
          labels: []
        });

        mockMermaid.generate = vi.fn().mockResolvedValue('graph TD\n  New["New Diagram"]');
        mockBackend.updateIssue = vi.fn().mockResolvedValue({
          id: storyId.toString(),
          number: storyId,
          title: 'Test Story',
          body: 'Updated',
          state: 'open',
          url: 'https://app.shortcut.com/story/89216',
          createdAt: new Date(),
          updatedAt: new Date(),
          assignees: [],
          labels: []
        });
        mockBackend.addComment = vi.fn().mockResolvedValue({
          id: 'comment-1',
          body: 'Progress',
          createdAt: new Date(),
          updatedAt: new Date(),
          author: { id: 'user-1', login: 'bot', name: 'Bot' }
        });

        await orchestrator.syncStory(storyId);

        // Verify the section was updated in place
        const updateCall = mockBackend.updateIssue.mock.calls[0];
        const updatedBody = updateCall[1].body;

        expect(updatedBody).toContain('Description');
        expect(updatedBody).toContain('More content below');
        expect(updatedBody).toContain('New["New Diagram"]');
        expect(updatedBody).not.toContain('Old["Old Diagram"]');
      });

      it('should throw NotFoundError when mapping is not found', async () => {
        const storyId = 99999;

        mockMappings.findByGitHubIssue = vi.fn().mockResolvedValue(null);

        const result = await orchestrator.syncStory(storyId);

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });
    });
  });
});
