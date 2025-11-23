/**
 * Tests for MappingStore
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { promises as fs } from 'fs';
import { join } from 'path';
import { MappingStore } from '../src/store/mapping-store.js';
import { CreateMappingParams, UpdateMappingParams, MappingStatus } from '../src/types/mapping.js';

describe('MappingStore', () => {
  const testStoragePath = join(process.cwd(), 'test-storage');
  let store: MappingStore;

  beforeEach(async () => {
    // Create test storage
    store = new MappingStore({
      storagePath: testStoragePath,
      autoCommit: false,
    });
    await store.initialize();
  });

  afterEach(async () => {
    // Clean up test storage
    try {
      await fs.rm(testStoragePath, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors
    }
  });

  describe('initialization', () => {
    it('should create storage directory and index', async () => {
      const indexPath = join(testStoragePath, 'index.json');
      const indexData = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(indexData);

      expect(index.version).toBe('1.0');
      expect(index.mappings).toEqual([]);
    });

    it('should create .gitignore file', async () => {
      const gitignorePath = join(testStoragePath, '.gitignore');
      const content = await fs.readFile(gitignorePath, 'utf-8');
      expect(content).toContain('*.tmp');
    });
  });

  describe('create', () => {
    it('should create a new mapping', async () => {
      const params: CreateMappingParams = {
        githubIssue: 'owner/repo#123',
        githubIssueNumber: 123,
        githubRepository: 'owner/repo',
        beadsEpics: [
          {
            repository: 'frontend',
            epicId: 'frontend-e100',
            repositoryPath: '/path/to/frontend',
          },
        ],
      };

      const mapping = await store.create(params);

      expect(mapping.id).toBeDefined();
      expect(mapping.githubIssue).toBe('owner/repo#123');
      expect(mapping.githubIssueNumber).toBe(123);
      expect(mapping.status).toBe('active');
      expect(mapping.beadsEpics).toHaveLength(1);
      expect(mapping.beadsEpics[0].epicId).toBe('frontend-e100');
    });

    it('should throw error if mapping already exists', async () => {
      const params: CreateMappingParams = {
        githubIssue: 'owner/repo#123',
        githubIssueNumber: 123,
        githubRepository: 'owner/repo',
        beadsEpics: [],
      };

      await store.create(params);

      try {
        await store.create(params);
        expect(true).toBe(false);
      } catch (e: any) {
        expect(e.message).toContain('Mapping already exists');
      }
    });

    it('should save mapping to file', async () => {
      const params: CreateMappingParams = {
        githubIssue: 'owner/repo#123',
        githubIssueNumber: 123,
        githubRepository: 'owner/repo',
        beadsEpics: [],
      };

      const mapping = await store.create(params);
      const filePath = join(testStoragePath, 'mappings', 'owner-repo-123.json');
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const savedMapping = JSON.parse(fileContent);

      expect(savedMapping.id).toBe(mapping.id);
    });
  });

  describe('get', () => {
    it('should retrieve mapping by ID', async () => {
      const params: CreateMappingParams = {
        githubIssue: 'owner/repo#123',
        githubIssueNumber: 123,
        githubRepository: 'owner/repo',
        beadsEpics: [],
      };

      const created = await store.create(params);
      const retrieved = await store.get(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
    });

    it('should return null for non-existent ID', async () => {
      const mapping = await store.get('non-existent-id');
      expect(mapping).toBeNull();
    });
  });

  describe('findByGitHubIssue', () => {
    it('should find mapping by GitHub issue', async () => {
      const params: CreateMappingParams = {
        githubIssue: 'owner/repo#123',
        githubIssueNumber: 123,
        githubRepository: 'owner/repo',
        beadsEpics: [],
      };

      await store.create(params);
      const found = await store.findByGitHubIssue('owner/repo', 123);

      expect(found).not.toBeNull();
      expect(found!.githubIssueNumber).toBe(123);
    });

    it('should return null if not found', async () => {
      const found = await store.findByGitHubIssue('owner/repo', 999);
      expect(found).toBeNull();
    });
  });

  describe('findByBeadsEpic', () => {
    it('should find mapping by Beads epic ID', async () => {
      const params: CreateMappingParams = {
        githubIssue: 'owner/repo#123',
        githubIssueNumber: 123,
        githubRepository: 'owner/repo',
        beadsEpics: [
          {
            repository: 'frontend',
            epicId: 'frontend-e100',
            repositoryPath: '/path/to/frontend',
          },
        ],
      };

      await store.create(params);
      const found = await store.findByBeadsEpic('frontend', 'frontend-e100');

      expect(found).not.toBeNull();
      expect(found!.beadsEpics[0].epicId).toBe('frontend-e100');
    });

    it('should return null if not found', async () => {
      const found = await store.findByBeadsEpic('frontend', 'non-existent');
      expect(found).toBeNull();
    });
  });

  describe('update', () => {
    it('should update mapping status', async () => {
      const params: CreateMappingParams = {
        githubIssue: 'owner/repo#123',
        githubIssueNumber: 123,
        githubRepository: 'owner/repo',
        beadsEpics: [],
      };

      const created = await store.create(params);
      const updates: UpdateMappingParams = {
        status: 'syncing',
      };

      const updated = await store.update(created.id, updates);
      expect(updated.status).toBe('syncing');
    });

    it('should add sync history entry', async () => {
      const params: CreateMappingParams = {
        githubIssue: 'owner/repo#123',
        githubIssueNumber: 123,
        githubRepository: 'owner/repo',
        beadsEpics: [],
      };

      const created = await store.create(params);
      const updates: UpdateMappingParams = {
        syncHistoryEntry: {
          timestamp: new Date().toISOString(),
          direction: 'github_to_beads',
          success: true,
          itemsSynced: 5,
        },
      };

      const updated = await store.update(created.id, updates);
      expect(updated.syncHistory).toHaveLength(1);
      expect(updated.syncHistory[0].direction).toBe('github_to_beads');
      expect(updated.lastSyncedAt).toBeDefined();
    });

    it('should limit sync history entries', async () => {
      const storeWithLimit = new MappingStore({
        storagePath: join(testStoragePath, 'limit-test'),
        maxHistoryEntries: 3,
      });
      await storeWithLimit.initialize();

      const params: CreateMappingParams = {
        githubIssue: 'owner/repo#456',
        githubIssueNumber: 456,
        githubRepository: 'owner/repo',
        beadsEpics: [],
      };

      let mapping = await storeWithLimit.create(params);

      // Add 5 sync history entries
      for (let i = 0; i < 5; i++) {
        mapping = await storeWithLimit.update(mapping.id, {
          syncHistoryEntry: {
            timestamp: new Date().toISOString(),
            direction: 'bidirectional',
            success: true,
          },
        });
      }

      expect(mapping.syncHistory).toHaveLength(3);
    });

    it('should throw error for non-existent mapping', async () => {
      try {
        await store.update('non-existent', { status: 'active' });
        expect(true).toBe(false);
      } catch (e: any) {
        expect(e.message).toContain('Mapping not found');
      }
    });
  });

  describe('delete', () => {
    it('should delete mapping', async () => {
      const params: CreateMappingParams = {
        githubIssue: 'owner/repo#123',
        githubIssueNumber: 123,
        githubRepository: 'owner/repo',
        beadsEpics: [],
      };

      const created = await store.create(params);
      await store.delete(created.id);

      const retrieved = await store.get(created.id);
      expect(retrieved).toBeNull();
    });

    it('should remove file', async () => {
      const params: CreateMappingParams = {
        githubIssue: 'owner/repo#123',
        githubIssueNumber: 123,
        githubRepository: 'owner/repo',
        beadsEpics: [],
      };

      const created = await store.create(params);
      const filePath = join(testStoragePath, 'mappings', 'owner-repo-123.json');

      await store.delete(created.id);

      try {
        await fs.access(filePath);
        expect(true).toBe(false);
      } catch (e) {
        // Expected
      }
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      // Create test mappings
      await store.create({
        githubIssue: 'owner/repo#1',
        githubIssueNumber: 1,
        githubRepository: 'owner/repo',
        beadsEpics: [{ repository: 'frontend', epicId: 'frontend-e1', repositoryPath: '/path' }],
      });

      await store.create({
        githubIssue: 'owner/repo#2',
        githubIssueNumber: 2,
        githubRepository: 'owner/repo',
        beadsEpics: [{ repository: 'backend', epicId: 'backend-e1', repositoryPath: '/path' }],
      });

      await store.create({
        githubIssue: 'other/repo#1',
        githubIssueNumber: 1,
        githubRepository: 'other/repo',
        beadsEpics: [],
      });
    });

    it('should list all mappings', async () => {
      const mappings = await store.list({});
      expect(mappings).toHaveLength(3);
    });

    it('should filter by GitHub repository', async () => {
      const mappings = await store.list({ githubRepository: 'owner/repo' });
      expect(mappings).toHaveLength(2);
    });

    it('should filter by Beads repository', async () => {
      const mappings = await store.list({ beadsRepository: 'frontend' });
      expect(mappings).toHaveLength(1);
      expect(mappings[0].beadsEpics[0].repository).toBe('frontend');
    });

    it('should filter by Beads epic ID', async () => {
      const mappings = await store.list({ beadsEpicId: 'backend-e1' });
      expect(mappings).toHaveLength(1);
    });

    it('should apply limit', async () => {
      const mappings = await store.list({ limit: 2 });
      expect(mappings.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await store.create({
        githubIssue: 'owner/repo#1',
        githubIssueNumber: 1,
        githubRepository: 'owner/repo',
        beadsEpics: [{ repository: 'frontend', epicId: 'frontend-e1', repositoryPath: '/path' }],
      });

      const mapping2 = await store.create({
        githubIssue: 'owner/repo#2',
        githubIssueNumber: 2,
        githubRepository: 'owner/repo',
        beadsEpics: [],
      });

      // Add conflict to second mapping
      await store.update(mapping2.id, {
        status: 'conflict',
        conflict: {
          detectedAt: new Date().toISOString(),
          type: 'concurrent_update',
          description: 'Test conflict',
        },
      });
    });

    it('should return correct statistics', async () => {
      const stats = await store.getStats();

      expect(stats.total).toBe(2);
      expect(stats.byStatus.active).toBe(1);
      expect(stats.byStatus.conflict).toBe(1);
      expect(stats.conflicts).toBe(1);
      expect(stats.repositories.github).toContain('owner/repo');
      expect(stats.repositories.beads).toContain('frontend');
    });
  });

  describe('resolveConflict', () => {
    it('should resolve conflict', async () => {
      const created = await store.create({
        githubIssue: 'owner/repo#1',
        githubIssueNumber: 1,
        githubRepository: 'owner/repo',
        beadsEpics: [],
      });

      // Create conflict
      await store.update(created.id, {
        status: 'conflict',
        conflict: {
          detectedAt: new Date().toISOString(),
          type: 'concurrent_update',
          description: 'Test conflict',
        },
      });

      const resolved = await store.resolveConflict(created.id, 'github_wins', {});

      expect(resolved.status).toBe('active');
      expect(resolved.conflict).toBeUndefined();
      expect(resolved.syncHistory[0].changes?.githubUpdates).toContain('Conflict resolved: github_wins');
    });

    it('should throw error if not in conflict state', async () => {
      const created = await store.create({
        githubIssue: 'owner/repo#1',
        githubIssueNumber: 1,
        githubRepository: 'owner/repo',
        beadsEpics: [],
      });

      try {
        await store.resolveConflict(created.id, 'github_wins', {});
        expect(true).toBe(false);
      } catch (e: any) {
        expect(e.message).toContain('not in conflict state');
      }
    });
  });
});
