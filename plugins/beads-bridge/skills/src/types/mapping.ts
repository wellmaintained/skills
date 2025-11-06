/**
 * Type definitions for the mapping database that tracks relationships
 * between GitHub Issues and Beads Epics across multiple repositories.
 */

/**
 * Status of a mapping indicating sync state
 */
export type MappingStatus =
  | 'active'      // Normal active mapping
  | 'syncing'     // Currently being synchronized
  | 'conflict'    // Conflict detected, needs resolution
  | 'archived';   // Mapping archived (GitHub issue closed)

/**
 * Sync direction for tracking last sync operation
 */
export type SyncDirection = 'github_to_beads' | 'beads_to_github' | 'bidirectional';

/**
 * Repository-specific epic information
 */
export interface RepositoryEpic {
  /** Repository name (e.g., 'frontend', 'backend') */
  repository: string;

  /** Beads epic ID (e.g., 'frontend-e123') */
  epicId: string;

  /** Path to repository on filesystem */
  repositoryPath: string;

  /** When this epic was created */
  createdAt: string;

  /** When this epic was last updated in Beads */
  lastUpdatedAt: string;

  /** Current epic status in Beads */
  status: 'open' | 'in_progress' | 'blocked' | 'closed';

  /** Number of completed child issues */
  completedIssues: number;

  /** Total number of child issues */
  totalIssues: number;
}

/**
 * Conflict information when mapping has sync conflicts
 */
export interface MappingConflict {
  /** When conflict was detected */
  detectedAt: string;

  /** Type of conflict */
  type: 'concurrent_update' | 'state_mismatch' | 'missing_resource' | 'data_corruption';

  /** Human-readable description */
  description: string;

  /** GitHub state at time of conflict */
  githubState?: {
    title?: string;
    state?: string;
    updatedAt?: string;
  };

  /** Beads state at time of conflict */
  beadsState?: {
    epicIds?: string[];
    updatedAt?: string;
  };

  /** Resolution strategy to apply */
  suggestedResolution?: 'github_wins' | 'beads_wins' | 'manual' | 'merge';
}

/**
 * Sync history entry tracking synchronization events
 */
export interface SyncHistoryEntry {
  /** Timestamp of sync operation */
  timestamp: string;

  /** Direction of sync */
  direction: SyncDirection;

  /** Whether sync succeeded */
  success: boolean;

  /** Error message if sync failed */
  error?: string;

  /** Number of items synced */
  itemsSynced?: number;

  /** Changes made during sync */
  changes?: {
    githubUpdates?: string[];
    beadsUpdates?: string[];
    diagramUpdated?: boolean;
    commentsAdded?: number;
  };
}

/**
 * Core mapping between GitHub Issue and Beads Epics
 */
export interface IssueMapping {
  /** Unique mapping ID (UUID) */
  id: string;

  /** GitHub issue URL or ID (e.g., 'owner/repo#123') */
  githubIssue: string;

  /** GitHub issue number */
  githubIssueNumber: number;

  /** GitHub repository (e.g., 'owner/repo') */
  githubRepository: string;

  /** GitHub Projects v2 project ID (if tracked in a project) */
  githubProjectId?: string;

  /** Beads epics across multiple repositories */
  beadsEpics: RepositoryEpic[];

  /** Current status of this mapping */
  status: MappingStatus;

  /** When mapping was created */
  createdAt: string;

  /** When mapping was last updated */
  updatedAt: string;

  /** When last synchronized */
  lastSyncedAt?: string;

  /** Direction of last sync */
  lastSyncDirection?: SyncDirection;

  /** Conflict information if status is 'conflict' */
  conflict?: MappingConflict;

  /** Sync history (limited to last 50 entries) */
  syncHistory: SyncHistoryEntry[];

  /** Aggregated completion metrics across all repositories */
  aggregatedMetrics: {
    totalCompleted: number;
    totalInProgress: number;
    totalBlocked: number;
    totalNotStarted: number;
    percentComplete: number;
    lastCalculatedAt: string;
  };

  /** External metadata for extensibility */
  metadata: Record<string, unknown>;
}

/**
 * Query parameters for searching mappings
 */
export interface MappingQuery {
  /** Filter by GitHub repository */
  githubRepository?: string;

  /** Filter by status */
  status?: MappingStatus;

  /** Filter by GitHub project ID */
  githubProjectId?: string;

  /** Filter by Beads repository */
  beadsRepository?: string;

  /** Filter by Beads epic ID */
  beadsEpicId?: string;

  /** Only include mappings synced after this date */
  syncedAfter?: Date;

  /** Only include mappings with conflicts */
  hasConflicts?: boolean;

  /** Maximum results to return */
  limit?: number;
}

/**
 * Parameters for creating a new mapping
 */
export interface CreateMappingParams {
  /** GitHub issue identifier (e.g., 'owner/repo#123') */
  githubIssue: string;

  /** GitHub issue number */
  githubIssueNumber: number;

  /** GitHub repository */
  githubRepository: string;

  /** GitHub project ID (optional) */
  githubProjectId?: string;

  /** Initial Beads epics */
  beadsEpics: Array<{
    repository: string;
    epicId: string;
    repositoryPath: string;
  }>;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Parameters for updating a mapping
 */
export interface UpdateMappingParams {
  /** Update status */
  status?: MappingStatus;

  /** Add or update Beads epics */
  beadsEpics?: RepositoryEpic[];

  /** Update GitHub project ID */
  githubProjectId?: string;

  /** Update conflict information */
  conflict?: MappingConflict;

  /** Add sync history entry */
  syncHistoryEntry?: SyncHistoryEntry;

  /** Update aggregated metrics */
  aggregatedMetrics?: IssueMapping['aggregatedMetrics'];

  /** Update metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Storage configuration for the mapping database
 */
export interface MappingStoreConfig {
  /** Path to store mapping files (default: .beads-bridge/) */
  storagePath: string;

  /** Maximum sync history entries to keep per mapping */
  maxHistoryEntries?: number;

  /** Auto-commit mappings to git */
  autoCommit?: boolean;

  /** Git commit message prefix */
  commitMessagePrefix?: string;
}

/**
 * Statistics about the mapping database
 */
export interface MappingStats {
  /** Total number of mappings */
  total: number;

  /** Breakdown by status */
  byStatus: Record<MappingStatus, number>;

  /** Number of mappings with conflicts */
  conflicts: number;

  /** Number of mappings synced in last 24 hours */
  recentlySynced: number;

  /** Average sync success rate (percentage) */
  syncSuccessRate: number;

  /** Repositories involved */
  repositories: {
    github: string[];
    beads: string[];
  };
}
