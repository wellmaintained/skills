/**
 * Tests for ConfigManager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ConfigManager } from '../src/config/config-manager.js';
import { Config, GitHubConfig, ConfigValidationError, ENV_VARS, DEFAULT_CONFIG } from '../src/types/config.js';

describe('ConfigManager', () => {
  const testConfigPath = join(process.cwd(), 'test-config.json');
  const originalEnv = { ...process.env };

  afterEach(async () => {
    // Clean up test config file
    try {
      await fs.unlink(testConfigPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }

    // Restore environment
    process.env = { ...originalEnv };
  });

  describe('constructor', () => {
    it('should create config with defaults', () => {
      const manager = new ConfigManager();
      const config = manager.getConfig();

      expect(config.version).toBe('2.0');
      expect(config.backend).toBe('github');
      expect(config.repositories).toEqual([]);
    });

    it('should merge partial config with defaults', () => {
      const manager = new ConfigManager({
        github: {
          repository: 'owner/repo',
        },
        repositories: [
          {
            name: 'test',
            path: '/absolute/path',
          },
        ],
      });

      const config = manager.getConfig();
      expect(config.github.repository).toBe('owner/repo');
      expect(config.repositories).toHaveLength(1);
      expect(config.logging.level).toBe('info'); // From defaults
    });
  });

  describe('fromFile', () => {
    it('should load configuration from file', async () => {
      const testConfig: Partial<Config> = {
        version: '2.0',
        backend: 'github',
        github: {
          repository: 'owner/repo',
        },
        repositories: [
          {
            name: 'test',
            path: '/absolute/path',
          },
        ],
        mappingStoragePath: '.beads-bridge',
      };

      await fs.writeFile(testConfigPath, JSON.stringify(testConfig, null, 2));

      const manager = await ConfigManager.fromFile(testConfigPath);
      const config = manager.getConfig();

      expect(config.github.repository).toBe('owner/repo');
      expect(config.repositories[0].name).toBe('test');
    });

    it('should throw error for non-existent file', async () => {
      await expect(ConfigManager.fromFile('non-existent.json')).rejects.toThrow(
        ConfigValidationError
      );
    });

    it('should throw error for invalid JSON', async () => {
      await fs.writeFile(testConfigPath, 'invalid json');

      await expect(ConfigManager.fromFile(testConfigPath)).rejects.toThrow(ConfigValidationError);
    });
  });

  describe('fromEnvironment', () => {
    it('should load configuration from environment variables', () => {
      process.env[ENV_VARS.GITHUB_REPO] = 'owner/repo';
      process.env[ENV_VARS.GITHUB_PROJECT_ID] = 'PVT_123';
      process.env[ENV_VARS.LOG_LEVEL] = 'debug';
      process.env[ENV_VARS.SYNC_ENABLED] = 'false';

      const manager = ConfigManager.fromEnvironment();
      const config = manager.getConfig();

      expect(config.github.repository).toBe('owner/repo');
      expect(config.github.projectId).toBe('PVT_123');
      expect(config.logging.level).toBe('debug');
    });
  });

  describe('load', () => {
    it('should load from file and apply env overrides', async () => {
      const testConfig: Partial<Config> = {
        version: '2.0',
        backend: 'github',
        github: {
          repository: 'file/repo',
        },
        repositories: [
          {
            name: 'test',
            path: '/absolute/path',
          },
        ],
        mappingStoragePath: '.beads-bridge',
      };

      await fs.writeFile(testConfigPath, JSON.stringify(testConfig, null, 2));

      process.env[ENV_VARS.GITHUB_REPO] = 'env/repo';
      process.env[ENV_VARS.LOG_LEVEL] = 'debug';

      const manager = await ConfigManager.load(testConfigPath);
      const config = manager.getConfig();

      expect(config.github.repository).toBe('env/repo'); // Env overrides file
      expect(config.logging.level).toBe('debug'); // From env
    });

    it('should throw error if missing required fields', async () => {
      // load() calls validate(), which requires github.repository and repositories
      await expect(ConfigManager.load()).rejects.toThrow(
        'GitHub repository is required in github configuration'
      );
    });
  });

  describe('getters', () => {
    let manager: ConfigManager;

    beforeEach(() => {
      manager = new ConfigManager({
        github: {
          repository: 'owner/repo',
          projectId: 'PVT_123',
        },
        repositories: [
          {
            name: 'frontend',
            path: '/path/to/frontend',
          },
          {
            name: 'backend',
            path: '/path/to/backend',
          },
        ],
      });
    });

    it('should get backend type', () => {
      expect(manager.getBackend()).toBe('github');
    });

    it('should get GitHub config', () => {
      const github = manager.getGitHub();
      expect(github.repository).toBe('owner/repo');
      expect(github.projectId).toBe('PVT_123');
    });

    it('should get repositories', () => {
      const repos = manager.getRepositories();
      expect(repos).toHaveLength(2);
      expect(repos[0].name).toBe('frontend');
    });

    it('should get mapping storage path', () => {
      expect(manager.getMappingStoragePath()).toBe('.beads-bridge');
    });

    it('should get logging config', () => {
      const logging = manager.getLogging();
      expect(logging.level).toBe('info');
      expect(logging.outputs).toBeDefined();
    });

    it('should get diagrams config', () => {
      const diagrams = manager.getDiagrams();
      expect(diagrams).toBeDefined();
      expect(diagrams!.enabled).toBe(true);
    });
  });

  describe('validate', () => {
    it('should validate GitHub repository format', () => {
      const manager = new ConfigManager({
        github: {
          repository: 'invalid',
        },
        repositories: [
          {
            name: 'test',
            path: '/path',
          },
        ],
      });

      expect(() => manager.validate()).toThrow('Invalid GitHub repository format');
    });

    it('should require at least one repository', () => {
      const manager = new ConfigManager({
        github: {
          repository: 'owner/repo',
        },
        repositories: [],
      });

      expect(() => manager.validate()).toThrow('At least one repository must be configured');
    });

    it('should require absolute repository paths', () => {
      const manager = new ConfigManager({
        github: {
          repository: 'owner/repo',
        },
        repositories: [
          {
            name: 'test',
            path: 'relative/path',
          },
        ],
      });

      expect(() => manager.validate()).toThrow('Repository path must be absolute');
    });

    it('should detect duplicate repository names', () => {
      const manager = new ConfigManager({
        github: {
          repository: 'owner/repo',
        },
        repositories: [
          {
            name: 'test',
            path: '/path1',
          },
          {
            name: 'test',
            path: '/path2',
          },
        ],
      });

      expect(() => manager.validate()).toThrow('Duplicate repository names');
    });

    it('should validate log level', () => {
      const manager = new ConfigManager({
        github: {
          repository: 'owner/repo',
        },
        repositories: [
          {
            name: 'test',
            path: '/path',
          },
        ],
        logging: {
          level: 'invalid' as any,
          outputs: { console: true },
        },
      });

      expect(() => manager.validate()).toThrow('Invalid log level');
    });
  });

  describe('v2.0 config structure', () => {
    it('should accept version 2.0 config', () => {
      const config: Config = {
        version: '2.0',
        backend: 'github',
        github: {
          repository: 'owner/repo',
          projectId: 'PVT_123'
        },
        repositories: [],
        mappingStoragePath: '.beads-bridge',
        sync: { enabled: true },
        notifications: { enabled: true },
        logging: { level: 'info' }
      };

      expect(config.version).toBe('2.0');
    });

    it('should not include cliPath in GitHubConfig', () => {
      const config: GitHubConfig = {
        repository: 'owner/repo',
        projectId: 'PVT_123'
      };

      // TypeScript should not allow cliPath property
      expect(config).not.toHaveProperty('cliPath');
    });

    it('should support shortcut backend', () => {
      const config: Config = {
        version: '2.0',
        backend: 'shortcut',
        github: { repository: '' }, // Still required in type
        shortcut: {
          workspace: 'my-workspace',
          projectId: 123
        },
        repositories: [],
        mappingStoragePath: '.beads-bridge',
        sync: { enabled: true },
        notifications: { enabled: true },
        logging: { level: 'info' }
      };

      expect(config.backend).toBe('shortcut');
      expect(config.shortcut).toBeDefined();
    });
  });
});
