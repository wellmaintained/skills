/**
 * Mapping database for tracking GitHub Issue to Beads Epic relationships.
 *
 * Storage Strategy:
 * - Each mapping stored as individual JSON file in .beads-bridge/mappings/
 * - Filename: <github-repo-slug>-<issue-number>.json
 * - Git-committable for version control and collaboration
 * - Index file for fast querying: .beads-bridge/index.json
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { randomUUID } from 'crypto';
import {
  IssueMapping,
  CreateMappingParams,
  UpdateMappingParams,
  MappingQuery,
  MappingStatus,
  MappingStoreConfig,
  MappingStats
} from '../types/mapping.js';

const execAsync = promisify(exec);

/**
 * Index entry for fast lookups
 */
interface IndexEntry {
  id: string;
  githubIssue: string;
  githubRepository: string;
  status: MappingStatus;
  lastSyncedAt?: string;
  filePath: string;
}

/**
 * In-memory index for fast queries
 */
interface MappingIndex {
  version: string;
  lastUpdated: string;
  mappings: IndexEntry[];
}

/**
 * MappingStore manages the mapping database with git-committable storage
 */
export class MappingStore {
  private config: Required<MappingStoreConfig>;
  private index: MappingIndex | null = null;
  private indexPath: string;
  private mappingsDir: string;

  constructor(config: MappingStoreConfig) {
    this.config = {
      maxHistoryEntries: 50,
      autoCommit: false,
      commitMessagePrefix: 'sync: ',
      ...config,
    };

    this.indexPath = join(this.config.storagePath, 'index.json');
    this.mappingsDir = join(this.config.storagePath, 'mappings');
  }

  /**
   * Initialize storage directory and index
   */
  async initialize(): Promise<void> {
    // Create directories if they don't exist
    await fs.mkdir(this.mappingsDir, { recursive: true });

    // Load or create index
    try {
      const indexData = await fs.readFile(this.indexPath, 'utf-8');
      this.index = JSON.parse(indexData);
    } catch (error) {
      // Create new index
      this.index = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        mappings: [],
      };
      await this.saveIndex();
    }

    // Add .gitignore if it doesn't exist
    const gitignorePath = join(this.config.storagePath, '.gitignore');
    try {
      await fs.access(gitignorePath);
    } catch {
      await fs.writeFile(gitignorePath, '# Mapping store is git-tracked\n# Add any temp files here\n*.tmp\n*.swp\n');
    }
  }

  /**
   * Create a new mapping
   */
  async create(params: CreateMappingParams): Promise<IssueMapping> {
    await this.ensureInitialized();

    // Check for existing mapping
    const existing = await this.findByGitHubIssue(params.githubRepository, params.githubIssueNumber);
    if (existing) {
      throw new Error(`Mapping already exists for ${params.githubRepository}#${params.githubIssueNumber}`);
    }

    const now = new Date().toISOString();
    const mapping: IssueMapping = {
      id: randomUUID(),
      githubIssue: params.githubIssue,
      githubIssueNumber: params.githubIssueNumber,
      githubRepository: params.githubRepository,
      githubProjectId: params.githubProjectId,
      beadsEpics: params.beadsEpics.map(epic => ({
        ...epic,
        createdAt: now,
        lastUpdatedAt: now,
        status: 'open',
        completedIssues: 0,
        totalIssues: 0,
      })),
      status: 'active',
      createdAt: now,
      updatedAt: now,
      syncHistory: [],
      aggregatedMetrics: {
        totalCompleted: 0,
        totalInProgress: 0,
        totalBlocked: 0,
        totalNotStarted: 0,
        percentComplete: 0,
        lastCalculatedAt: now,
      },
      metadata: params.metadata || {},
    };

    // Save to file
    await this.saveMappingFile(mapping);

    // Update index
    await this.addToIndex(mapping);

    // Auto-commit if enabled
    if (this.config.autoCommit) {
      await this.commitChanges(`${this.config.commitMessagePrefix}create mapping for ${params.githubIssue}`);
    }

    return mapping;
  }

  /**
   * Get mapping by ID
   */
  async get(id: string): Promise<IssueMapping | null> {
    await this.ensureInitialized();

    const indexEntry = this.index!.mappings.find(m => m.id === id);
    if (!indexEntry) {
      return null;
    }

    return this.loadMappingFile(indexEntry.filePath);
  }

  /**
   * Find mapping by GitHub issue
   */
  async findByGitHubIssue(repository: string, issueNumber: number): Promise<IssueMapping | null> {
    await this.ensureInitialized();

    const githubIssue = `${repository}#${issueNumber}`;
    const indexEntry = this.index!.mappings.find(m => m.githubIssue === githubIssue);
    if (!indexEntry) {
      return null;
    }

    return this.loadMappingFile(indexEntry.filePath);
  }

  /**
   * Find mapping by Beads epic ID
   */
  async findByBeadsEpic(repository: string, epicId: string): Promise<IssueMapping | null> {
    await this.ensureInitialized();

    // Need to scan all mappings (could optimize with better indexing)
    const mappings = await this.list({});
    return mappings.find(m =>
      m.beadsEpics.some(epic => epic.repository === repository && epic.epicId === epicId)
    ) || null;
  }

  /**
   * Update an existing mapping
   */
  async update(id: string, updates: UpdateMappingParams): Promise<IssueMapping> {
    await this.ensureInitialized();

    const mapping = await this.get(id);
    if (!mapping) {
      throw new Error(`Mapping not found: ${id}`);
    }

    const now = new Date().toISOString();

    // Apply updates
    if (updates.status !== undefined) {
      mapping.status = updates.status;
    }

    if (updates.beadsEpics !== undefined) {
      mapping.beadsEpics = updates.beadsEpics;
    }

    if (updates.githubProjectId !== undefined) {
      mapping.githubProjectId = updates.githubProjectId;
    }

    if ('conflict' in updates) {
      if (updates.conflict === undefined) {
        // Explicitly delete the conflict property
        delete mapping.conflict;
      } else {
        mapping.conflict = updates.conflict;
        if (mapping.status !== 'conflict') {
          mapping.status = 'conflict';
        }
      }
    }

    if (updates.aggregatedMetrics !== undefined) {
      mapping.aggregatedMetrics = updates.aggregatedMetrics;
    }

    if (updates.metadata !== undefined) {
      mapping.metadata = { ...mapping.metadata, ...updates.metadata };
    }

    // Add sync history entry
    if (updates.syncHistoryEntry !== undefined) {
      mapping.syncHistory.unshift(updates.syncHistoryEntry);
      // Trim history to max entries
      if (mapping.syncHistory.length > this.config.maxHistoryEntries) {
        mapping.syncHistory = mapping.syncHistory.slice(0, this.config.maxHistoryEntries);
      }
      mapping.lastSyncedAt = updates.syncHistoryEntry.timestamp;
      mapping.lastSyncDirection = updates.syncHistoryEntry.direction;
    }

    mapping.updatedAt = now;

    // Save to file
    await this.saveMappingFile(mapping);

    // Update index
    await this.updateIndex(mapping);

    // Auto-commit if enabled
    if (this.config.autoCommit) {
      await this.commitChanges(`${this.config.commitMessagePrefix}update mapping ${mapping.githubIssue}`);
    }

    return mapping;
  }

  /**
   * Delete a mapping
   */
  async delete(id: string): Promise<void> {
    await this.ensureInitialized();

    const indexEntry = this.index!.mappings.find(m => m.id === id);
    if (!indexEntry) {
      throw new Error(`Mapping not found: ${id}`);
    }

    // Delete file
    const filePath = join(this.config.storagePath, indexEntry.filePath);
    await fs.unlink(filePath);

    // Remove from index
    this.index!.mappings = this.index!.mappings.filter(m => m.id !== id);
    await this.saveIndex();

    // Auto-commit if enabled
    if (this.config.autoCommit) {
      await this.commitChanges(`${this.config.commitMessagePrefix}delete mapping ${indexEntry.githubIssue}`);
    }
  }

  /**
   * List mappings matching query
   */
  async list(query: MappingQuery): Promise<IssueMapping[]> {
    await this.ensureInitialized();

    let entries = this.index!.mappings;

    // Apply filters to index
    if (query.githubRepository) {
      entries = entries.filter(m => m.githubRepository === query.githubRepository);
    }

    if (query.status) {
      entries = entries.filter(m => m.status === query.status);
    }

    if (query.hasConflicts) {
      entries = entries.filter(m => m.status === 'conflict');
    }

    if (query.syncedAfter) {
      const afterTime = query.syncedAfter.toISOString();
      entries = entries.filter(m => m.lastSyncedAt && m.lastSyncedAt > afterTime);
    }

    // Apply limit
    if (query.limit) {
      entries = entries.slice(0, query.limit);
    }

    // Load full mappings
    const mappings = await Promise.all(
      entries.map(entry => this.loadMappingFile(entry.filePath))
    );

    // Apply additional filters that require full mapping
    let filtered = mappings.filter((m): m is IssueMapping => m !== null);

    if (query.githubProjectId) {
      filtered = filtered.filter(m => m.githubProjectId === query.githubProjectId);
    }

    if (query.beadsRepository) {
      filtered = filtered.filter(m =>
        m.beadsEpics.some(epic => epic.repository === query.beadsRepository)
      );
    }

    if (query.beadsEpicId) {
      filtered = filtered.filter(m =>
        m.beadsEpics.some(epic => epic.epicId === query.beadsEpicId)
      );
    }

    return filtered;
  }

  /**
   * Get statistics about mappings
   */
  async getStats(): Promise<MappingStats> {
    await this.ensureInitialized();

    const mappings = await this.list({});

    const byStatus: Record<MappingStatus, number> = {
      active: 0,
      syncing: 0,
      conflict: 0,
      archived: 0,
    };

    let conflicts = 0;
    let recentlySynced = 0;
    let totalSyncs = 0;
    let successfulSyncs = 0;
    const githubRepos = new Set<string>();
    const beadsRepos = new Set<string>();

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    for (const mapping of mappings) {
      byStatus[mapping.status]++;

      if (mapping.status === 'conflict') {
        conflicts++;
      }

      if (mapping.lastSyncedAt && mapping.lastSyncedAt > oneDayAgo) {
        recentlySynced++;
      }

      githubRepos.add(mapping.githubRepository);
      mapping.beadsEpics.forEach(epic => beadsRepos.add(epic.repository));

      // Calculate sync success rate
      for (const entry of mapping.syncHistory) {
        totalSyncs++;
        if (entry.success) {
          successfulSyncs++;
        }
      }
    }

    return {
      total: mappings.length,
      byStatus,
      conflicts,
      recentlySynced,
      syncSuccessRate: totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 100,
      repositories: {
        github: Array.from(githubRepos),
        beads: Array.from(beadsRepos),
      },
    };
  }

  /**
   * Resolve a conflict
   */
  async resolveConflict(
    id: string,
    resolution: 'github_wins' | 'beads_wins' | 'merged',
    resolvedData: Partial<IssueMapping>
  ): Promise<IssueMapping> {
    const mapping = await this.get(id);
    if (!mapping) {
      throw new Error(`Mapping not found: ${id}`);
    }

    if (mapping.status !== 'conflict') {
      throw new Error(`Mapping is not in conflict state: ${id}`);
    }

    // Apply resolution
    const updates: UpdateMappingParams = {
      status: 'active',
      conflict: undefined,
      ...resolvedData,
      syncHistoryEntry: {
        timestamp: new Date().toISOString(),
        direction: 'bidirectional',
        success: true,
        changes: {
          githubUpdates: [`Conflict resolved: ${resolution}`],
        },
      },
    };

    return this.update(id, updates);
  }

  /**
   * Commit changes to git
   */
  private async commitChanges(message: string): Promise<void> {
    try {
      const cwd = this.config.storagePath;
      await execAsync('git add .', { cwd });
      await execAsync(`git commit -m "${message}"`, { cwd });
    } catch (error) {
      // Ignore errors (e.g., no changes to commit)
    }
  }

  /**
   * Ensure store is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.index) {
      await this.initialize();
    }
  }

  /**
   * Get file path for a mapping
   */
  private getMappingFilePath(mapping: IssueMapping): string {
    // Sanitize repository name for filename
    const repoSlug = mapping.githubRepository.replace(/\//g, '-');
    const filename = `${repoSlug}-${mapping.githubIssueNumber}.json`;
    return join('mappings', filename);
  }

  /**
   * Save mapping to file
   */
  private async saveMappingFile(mapping: IssueMapping): Promise<void> {
    const relativePath = this.getMappingFilePath(mapping);
    const filePath = join(this.config.storagePath, relativePath);

    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(mapping, null, 2), 'utf-8');
  }

  /**
   * Load mapping from file
   */
  private async loadMappingFile(relativePath: string): Promise<IssueMapping | null> {
    try {
      const filePath = join(this.config.storagePath, relativePath);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  /**
   * Add mapping to index
   */
  private async addToIndex(mapping: IssueMapping): Promise<void> {
    this.index!.mappings.push({
      id: mapping.id,
      githubIssue: mapping.githubIssue,
      githubRepository: mapping.githubRepository,
      status: mapping.status,
      lastSyncedAt: mapping.lastSyncedAt,
      filePath: this.getMappingFilePath(mapping),
    });

    await this.saveIndex();
  }

  /**
   * Update mapping in index
   */
  private async updateIndex(mapping: IssueMapping): Promise<void> {
    const index = this.index!.mappings.findIndex(m => m.id === mapping.id);
    if (index !== -1) {
      this.index!.mappings[index] = {
        id: mapping.id,
        githubIssue: mapping.githubIssue,
        githubRepository: mapping.githubRepository,
        status: mapping.status,
        lastSyncedAt: mapping.lastSyncedAt,
        filePath: this.getMappingFilePath(mapping),
      };
      await this.saveIndex();
    }
  }

  /**
   * Save index to file
   */
  private async saveIndex(): Promise<void> {
    this.index!.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.indexPath, JSON.stringify(this.index, null, 2), 'utf-8');
  }
}
