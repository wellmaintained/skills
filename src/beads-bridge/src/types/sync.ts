/**
 * Types for Shortcut sync workflow orchestration
 */

/**
 * Options for syncing a story to Shortcut
 */
export interface SyncOptions {
  /** Optional user-provided narrative to include in the update */
  userNarrative?: string;
}

/**
 * Result of syncing a story to Shortcut
 */
export interface SyncResult {
  /** Whether the sync operation succeeded */
  success: boolean;

  /** Story ID that was synced */
  storyId: number;

  /** URL of the updated story in Shortcut */
  storyUrl?: string;

  /** URL of the posted comment (if any) */
  commentUrl?: string;

  /** Error message if sync failed */
  error?: string;

  /** ISO 8601 timestamp when sync occurred */
  syncedAt: string;
}

/**
 * Auto-generated sections for narrative construction
 */
export interface NarrativeSections {
  /** Summary of changes since last sync */
  summary: string;

  /** List of current blockers preventing progress */
  blockers: string[];

  /** List of next steps planned */
  whatsNext: string[];
}
