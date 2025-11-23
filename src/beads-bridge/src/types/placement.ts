/**
 * Types for diagram placement in GitHub Issues
 */

/**
 * Update trigger types
 */
export type UpdateTrigger = 'scope_change' | 'weekly' | 'manual' | 'initial';

/**
 * Diagram snapshot metadata
 */
export interface DiagramSnapshot {
  /** Timestamp of snapshot */
  timestamp: string;

  /** Trigger that caused this snapshot */
  trigger: UpdateTrigger;

  /** GitHub comment ID where snapshot was posted */
  commentId: string;

  /** GitHub comment URL */
  commentUrl: string;

  /** Number of nodes in diagram */
  nodeCount: number;

  /** Whether diagram was truncated */
  truncated: boolean;
}

/**
 * Diagram section in issue description
 */
export interface DiagramSection {
  /** Mermaid diagram markdown */
  diagram: string;

  /** Last updated timestamp */
  lastUpdated: string;

  /** Update trigger */
  trigger: UpdateTrigger;

  /** Link to latest snapshot comment */
  snapshotUrl?: string;
}

/**
 * Placement options for diagram updates
 */
export interface PlacementOptions {
  /** Update issue description (default: true) */
  updateDescription?: boolean;

  /** Create snapshot comment (default: true) */
  createSnapshot?: boolean;

  /** Update trigger */
  trigger: UpdateTrigger;

  /** Additional message to include in snapshot comment */
  message?: string;

  /** Pin the snapshot comment (requires permissions) */
  pinComment?: boolean;
}

/**
 * Result of diagram placement operation
 */
export interface PlacementResult {
  /** Whether description was updated */
  descriptionUpdated: boolean;

  /** Snapshot created (if any) */
  snapshot?: DiagramSnapshot;

  /** Updated issue URL */
  issueUrl: string;

  /** Error message (if failed) */
  error?: string;
}

/**
 * Diagram section markers for parsing issue descriptions
 */
export const DIAGRAM_MARKERS = {
  START: '<!-- BEADS-DIAGRAM-START -->',
  END: '<!-- BEADS-DIAGRAM-END -->',
  SECTION_HEADER: '## 📊 Dependency Diagram',
  LAST_UPDATED_PREFIX: '*Last updated:',
  SNAPSHOT_LINK_PREFIX: '[View snapshot history]'
} as const;

/**
 * Snapshot comment template markers
 */
export const SNAPSHOT_MARKERS = {
  HEADER: '## 📸 Dependency Diagram Snapshot',
  TRIGGER_PREFIX: '**Trigger:**',
  TIMESTAMP_PREFIX: '**Timestamp:**',
  NODE_COUNT_PREFIX: '**Nodes:**',
  TRUNCATED_NOTICE: '⚠️ Diagram truncated'
} as const;
