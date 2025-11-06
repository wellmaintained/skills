// tests/config-migration.test.ts
import { describe, it, expect } from 'vitest';
import { migrateConfig, needsMigration } from '../src/config/migration.js';
import type { Config } from '../src/types/config.js';

describe('Config Migration', () => {
  it('should detect v1.0 config needs migration', () => {
    const v1Config = {
      version: '1.0',
      backend: 'github',
      github: {
        cliPath: 'gh',
        repository: 'owner/repo'
      }
    };

    expect(needsMigration(v1Config)).toBe(true);
  });

  it('should detect v2.0 config does not need migration', () => {
    const v2Config = {
      version: '2.0',
      backend: 'github',
      github: {
        repository: 'owner/repo'
      }
    };

    expect(needsMigration(v2Config)).toBe(false);
  });

  it('should migrate v1.0 to v2.0', () => {
    const v1Config = {
      version: '1.0',
      backend: 'github',
      github: {
        cliPath: 'gh',
        repository: 'owner/repo',
        projectId: 'PVT_123'
      },
      repositories: [],
      mappingStoragePath: '.beads-bridge',
      sync: { enabled: true },
      notifications: { enabled: true },
      logging: { level: 'info' }
    };

    const v2Config = migrateConfig(v1Config);

    expect(v2Config.version).toBe('2.0');
    expect(v2Config.github).not.toHaveProperty('cliPath');
    expect(v2Config.github.repository).toBe('owner/repo');
    expect(v2Config.github.projectId).toBe('PVT_123');
  });

  it('should preserve all settings during migration', () => {
    const v1Config = {
      version: '1.0',
      backend: 'github',
      github: { repository: 'owner/repo' },
      repositories: [{ name: 'test', path: '/test', enabled: true }],
      mappingStoragePath: '.custom-path',
      sync: { enabled: false },
      notifications: { enabled: false },
      logging: { level: 'debug' },
      metadata: { custom: 'value' }
    };

    const v2Config = migrateConfig(v1Config);

    expect(v2Config.repositories).toEqual(v1Config.repositories);
    expect(v2Config.mappingStoragePath).toBe('.custom-path');
    expect(v2Config.sync.enabled).toBe(false);
    expect(v2Config.logging.level).toBe('debug');
    expect(v2Config.metadata).toEqual({ custom: 'value' });
  });
});
