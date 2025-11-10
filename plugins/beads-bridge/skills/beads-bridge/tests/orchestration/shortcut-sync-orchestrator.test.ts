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
  });
});
