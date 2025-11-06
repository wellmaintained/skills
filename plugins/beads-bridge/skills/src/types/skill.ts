/**
 * Types for Claude Skill interface
 */

/**
 * Available skill capabilities
 */
export type SkillCapability =
  | 'query_status'
  | 'sync_progress'
  | 'generate_diagrams'
  | 'manage_mappings'
  | 'decompose'
  | 'force_sync';

/**
 * Context passed to skill execution
 */
export interface SkillContext {
  /** GitHub repository (owner/repo) */
  repository?: string;

  /** GitHub issue number */
  issueNumber?: number;

  /** Include blockers in output (query_status, sync_progress) */
  includeBlockers?: boolean;

  /** Where to place diagram (generate_diagrams) */
  placement?: 'description' | 'comment';

  /** Action to perform (manage_mappings) */
  action?: 'get' | 'create';

  /** Epic IDs to link (manage_mappings create action) */
  epicIds?: Array<{
    repository: string;
    epicId: string;
    repositoryPath: string;
  }>;

  /** Operations to execute (force_sync) */
  operations?: Array<'progress' | 'diagram'>;

  /** Whether to post confirmation comment (decompose) */
  postComment?: boolean;

  /** Default priority for created beads (decompose) */
  defaultPriority?: number;

  /** Additional context properties */
  [key: string]: any;
}

/**
 * Result returned from skill execution
 */
export interface SkillResult {
  /** Whether the operation succeeded */
  success: boolean;

  /** Result data (if successful) */
  data?: any;

  /** Error information (if failed) */
  error?: {
    /** Error code */
    code: string;

    /** Human-readable error message */
    message: string;
  };
}

/**
 * Skill metadata
 */
export interface SkillMetadata {
  /** Skill name */
  name: string;

  /** Skill version */
  version: string;

  /** Available capabilities */
  capabilities: SkillCapability[];
}

/**
 * Performance trace for a skill operation
 */
export interface SkillTrace {
  /** Operation ID */
  id: string;

  /** Capability executed */
  capability: SkillCapability;

  /** Start timestamp */
  startTime: number;

  /** End timestamp */
  endTime?: number;

  /** Duration in milliseconds */
  duration?: number;

  /** Whether operation succeeded */
  success?: boolean;

  /** Error message (if failed) */
  error?: string;
}

/**
 * Log entry from skill execution
 */
export interface SkillLogEntry {
  /** Log level */
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

  /** Log message */
  message: string;

  /** Timestamp */
  timestamp: string;

  /** Operation ID (if part of traced operation) */
  operationId?: string;

  /** Additional context */
  context?: any;

  /** Error object (if level is ERROR) */
  error?: Error;
}
