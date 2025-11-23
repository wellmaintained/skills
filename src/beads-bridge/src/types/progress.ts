/**
 * Types for progress synthesis and aggregation
 */

import { BeadsIssue } from './beads.js';

/**
 * Progress metrics for a single epic or aggregated across multiple epics
 */
export interface ProgressMetrics {
  /** Total number of issues */
  total: number;

  /** Number of completed issues */
  completed: number;

  /** Number of in-progress issues */
  inProgress: number;

  /** Number of blocked issues */
  blocked: number;

  /** Number of open/ready issues */
  open: number;

  /** Completion percentage (0-100) */
  percentComplete: number;
}

/**
 * Progress for a single repository epic
 */
export interface EpicProgress {
  /** Repository name */
  repository: string;

  /** Epic ID in Beads */
  epicId: string;

  /** Epic title */
  title: string;

  /** All subtasks under this epic */
  subtasks: BeadsIssue[];

  /** Progress metrics for this epic */
  metrics: ProgressMetrics;

  /** Issues blocking progress */
  blockers: BeadsIssue[];
}

/**
 * Aggregated progress across multiple repository epics
 */
export interface AggregatedProgress {
  /** Progress for each repository epic */
  epics: EpicProgress[];

  /** Aggregated metrics across all epics */
  totalMetrics: ProgressMetrics;

  /** All blockers across all epics */
  allBlockers: BeadsIssue[];

  /** Whether any epic has blockers */
  hasBlockers: boolean;
}

/**
 * Options for generating progress comments
 */
export interface ProgressCommentOptions {
  /** Include detailed breakdown per repository */
  includeRepositoryBreakdown?: boolean;

  /** Include list of blockers */
  includeBlockers?: boolean;

  /** Include list of in-progress items */
  includeInProgress?: boolean;

  /** Maximum number of items to show in lists */
  maxItemsToShow?: number;

  /** Include Mermaid dependency diagram in comment */
  includeDiagram?: boolean;

  /** Pre-generated Mermaid diagram code (when includeDiagram is true) */
  diagramMermaid?: string;
}

/**
 * Result of updating GitHub issue with progress
 */
export interface ProgressUpdateResult {
  /** Whether the update was successful */
  success: boolean;

  /** Comment posted to GitHub (if any) */
  commentUrl?: string;

  /** Fields updated in GitHub Projects (if any) */
  fieldsUpdated?: string[];

  /** Error message (if failed) */
  error?: string;
}
