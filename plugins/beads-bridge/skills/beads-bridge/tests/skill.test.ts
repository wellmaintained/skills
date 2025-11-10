// tests/skill.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BeadsSkill, createSkill } from '../src/skill.js';
import { ConfigManager } from '../src/config/config-manager.js';
import type { SkillContext } from '../src/types/skill.js';

/**
 * Unit tests for skill orchestration
 *
 * Tests the BeadsSkill class and createSkill factory function
 */

// Mock all dependencies
vi.mock('../src/clients/beads-client.js');
vi.mock('../src/backends/github.js');
vi.mock('../src/backends/shortcut.js');
vi.mock('../src/store/mapping-store.js');
vi.mock('../src/synthesis/progress-synthesizer.js');
vi.mock('../src/diagrams/mermaid-generator.js');
vi.mock('../src/diagrams/diagram-placer.js');
vi.mock('../src/discovery/scope-discovery-detector.js');
vi.mock('../src/decomposition/epic-decomposer.js');
vi.mock('../src/orchestration/shortcut-sync-orchestrator.js');
vi.mock('../src/monitoring/logger.js');
vi.mock('../src/auth/credential-store.js');

describe('BeadsSkill', () => {
  let skill: BeadsSkill;
  let mockConfig: ConfigManager;

  beforeEach(() => {
    // Create mock config
    mockConfig = {
      getConfig: vi.fn().mockReturnValue({
        version: '2.0',
        backend: 'github',
        github: {
          repository: 'test/test'
        },
        repositories: [
          {
            name: 'test-beads',
            path: '/path/to/beads',
            prefix: 'TEST'
          }
        ],
        mappingStoragePath: '/path/to/mappings',
        logging: {
          level: 'info'
        }
      })
    } as any;

    const credentials = {
      github: { token: 'test_token', scopes: ['repo'] }
    };

    skill = new BeadsSkill(mockConfig, credentials);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with config and credentials', () => {
      expect(skill).toBeDefined();
      expect(mockConfig.getConfig).toHaveBeenCalled();
    });

    it('should instantiate ShortcutSyncOrchestrator when backend is shortcut', () => {
      // Create mock config with shortcut backend
      const shortcutConfig = {
        getConfig: vi.fn().mockReturnValue({
          version: '2.0',
          backend: 'shortcut',
          repositories: [
            {
              name: 'test-beads',
              path: '/path/to/beads',
              prefix: 'TEST'
            }
          ],
          mappingStoragePath: '/path/to/mappings',
          logging: {
            level: 'info'
          }
        })
      } as any;

      const credentials = {
        shortcut: { token: 'test_token' }
      };

      const shortcutSkill = new BeadsSkill(shortcutConfig, credentials);

      // Access private property for testing
      expect((shortcutSkill as any).shortcutSyncOrchestrator).toBeDefined();
    });

    it('should not instantiate ShortcutSyncOrchestrator when backend is github', () => {
      // Access private property for testing
      expect((skill as any).shortcutSyncOrchestrator).toBeUndefined();
    });
  });

  describe('execute()', () => {
    it('should throw error for unknown capability', async () => {
      const context: SkillContext = {
        repository: 'test/test',
        issueNumber: 1
      };

      const result = await skill.execute('unknown_capability' as any, context);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Unknown capability');
    });
  });

  describe('queryStatus()', () => {
    it('should return error if repository missing', async () => {
      const context: SkillContext = {
        issueNumber: 1
      };

      const result = await skill.execute('query_status', context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should return error if issueNumber missing', async () => {
      const context: SkillContext = {
        repository: 'test/test'
      };

      const result = await skill.execute('query_status', context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('syncProgress()', () => {
    it('should validate required fields', async () => {
      const context: SkillContext = {};

      const result = await skill.execute('sync_progress', context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should route to ShortcutSyncOrchestrator when backend is shortcut', async () => {
      // Create mock config with shortcut backend
      const shortcutConfig = {
        getConfig: vi.fn().mockReturnValue({
          version: '2.0',
          backend: 'shortcut',
          repositories: [
            {
              name: 'test-beads',
              path: '/path/to/beads',
              prefix: 'TEST'
            }
          ],
          mappingStoragePath: '/path/to/mappings',
          logging: {
            level: 'info'
          }
        })
      } as any;

      const credentials = {
        shortcut: { token: 'test_token' }
      };

      const shortcutSkill = new BeadsSkill(shortcutConfig, credentials);

      // Mock the orchestrator's syncStory method
      const mockSyncStory = vi.fn().mockResolvedValue({
        success: true,
        storyId: 123,
        storyUrl: 'https://shortcut.com/story/123',
        commentUrl: 'https://shortcut.com/story/123#comment-456',
        syncedAt: '2025-11-10T12:00:00Z'
      });
      (shortcutSkill as any).shortcutSyncOrchestrator = {
        syncStory: mockSyncStory
      };

      // Mock backend name property
      (shortcutSkill as any).backend = { name: 'shortcut' };

      const context: SkillContext = {
        repository: 'shortcut',
        issueNumber: 123,
        userNarrative: 'Test narrative'
      };

      const result = await shortcutSkill.execute('sync_progress', context);

      expect(mockSyncStory).toHaveBeenCalledWith(123, {
        userNarrative: 'Test narrative'
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        commentUrl: 'https://shortcut.com/story/123#comment-456',
        fieldsUpdated: undefined
      });
    });

    it('should use ProgressSynthesizer for GitHub backend', async () => {
      const context: SkillContext = {
        repository: 'test/test',
        issueNumber: 123
      };

      // Mock the progressSynthesizer's updateIssueProgress method
      const mockUpdateIssueProgress = vi.fn().mockResolvedValue({
        success: true,
        commentUrl: 'https://github.com/test/test/issues/123#issuecomment-456'
      });
      (skill as any).progressSynthesizer = {
        updateIssueProgress: mockUpdateIssueProgress
      };

      // Mock backend name property
      (skill as any).backend = { name: 'github' };

      const result = await skill.execute('sync_progress', context);

      expect(mockUpdateIssueProgress).toHaveBeenCalledWith(
        'test/test',
        123,
        {
          includeBlockers: true,
          includeDiagram: true
        }
      );
      expect(result.success).toBe(true);
    });

    it('should pass userNarrative to orchestrator', async () => {
      // Create mock config with shortcut backend
      const shortcutConfig = {
        getConfig: vi.fn().mockReturnValue({
          version: '2.0',
          backend: 'shortcut',
          repositories: [
            {
              name: 'test-beads',
              path: '/path/to/beads',
              prefix: 'TEST'
            }
          ],
          mappingStoragePath: '/path/to/mappings',
          logging: {
            level: 'info'
          }
        })
      } as any;

      const credentials = {
        shortcut: { token: 'test_token' }
      };

      const shortcutSkill = new BeadsSkill(shortcutConfig, credentials);

      // Mock the orchestrator's syncStory method
      const mockSyncStory = vi.fn().mockResolvedValue({
        success: true,
        storyId: 123,
        storyUrl: 'https://shortcut.com/story/123',
        syncedAt: '2025-11-10T12:00:00Z'
      });
      (shortcutSkill as any).shortcutSyncOrchestrator = {
        syncStory: mockSyncStory
      };

      // Mock backend name property
      (shortcutSkill as any).backend = { name: 'shortcut' };

      const context: SkillContext = {
        repository: 'shortcut',
        issueNumber: 123,
        userNarrative: 'My custom narrative for this update'
      };

      await shortcutSkill.execute('sync_progress', context);

      expect(mockSyncStory).toHaveBeenCalledWith(123, {
        userNarrative: 'My custom narrative for this update'
      });
    });
  });

  describe('generateDiagrams()', () => {
    it('should validate required fields', async () => {
      const context: SkillContext = {};

      const result = await skill.execute('generate_diagrams', context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('manageMappings()', () => {
    it('should validate required fields', async () => {
      const context: SkillContext = {
        action: 'get'
      };

      const result = await skill.execute('manage_mappings', context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should validate epicIds for create action', async () => {
      const context: SkillContext = {
        repository: 'test/test',
        issueNumber: 1,
        action: 'create'
      };

      const result = await skill.execute('manage_mappings', context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('epicIds array is required');
    });

    it('should validate epic structure', async () => {
      const context: SkillContext = {
        repository: 'test/test',
        issueNumber: 1,
        action: 'create',
        epicIds: [
          { repository: 'test' } // Missing epicId and repositoryPath
        ] as any
      };

      const result = await skill.execute('manage_mappings', context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('repository, epicId, and repositoryPath');
    });
  });

  describe('decompose()', () => {
    it('should validate required fields', async () => {
      const context: SkillContext = {};

      const result = await skill.execute('decompose', context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('forceSync()', () => {
    it('should validate required fields', async () => {
      const context: SkillContext = {};

      const result = await skill.execute('force_sync', context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('getMetadata()', () => {
    it('should return skill metadata', () => {
      const metadata = skill.getMetadata();

      expect(metadata.name).toBe('beads-bridge-integration');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.capabilities).toContain('query_status');
      expect(metadata.capabilities).toContain('sync_progress');
      expect(metadata.capabilities).toContain('generate_diagrams');
      expect(metadata.capabilities).toContain('manage_mappings');
      expect(metadata.capabilities).toContain('decompose');
      expect(metadata.capabilities).toContain('force_sync');
    });
  });
});

describe('createSkill()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create skill instance', async () => {
    vi.mock('../src/config/config-manager.js', async () => {
      const actual = await vi.importActual('../src/config/config-manager.js');
      return {
        ...actual,
        ConfigManager: {
          load: vi.fn().mockResolvedValue({
            getConfig: vi.fn().mockReturnValue({
              version: '2.0',
              backend: 'github',
              github: { repository: 'test/test' },
              repositories: [{ name: 'test', path: '/path', prefix: 'TEST' }],
              mappingStoragePath: '/path',
              logging: { level: 'info' }
            })
          })
        }
      };
    });

    const skill = await createSkill();

    expect(skill).toBeDefined();
    expect(skill).toBeInstanceOf(BeadsSkill);
  });
});
