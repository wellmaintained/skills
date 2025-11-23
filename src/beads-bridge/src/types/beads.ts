/**
 * Beads-specific type definitions
 *
 * Types for working with Beads issue tracking across multiple repositories.
 */

/**
 * Beads issue status
 */
export type BeadsStatus = 'open' | 'in_progress' | 'blocked' | 'closed';

/**
 * Beads issue type
 */
export type BeadsIssueType = 'bug' | 'feature' | 'task' | 'epic' | 'chore';

/**
 * Beads issue priority (0 = critical, 4 = backlog)
 */
export type BeadsPriority = 0 | 1 | 2 | 3 | 4;

/**
 * Beads dependency type
 */
export type BeadsDependencyType = 'blocks' | 'related' | 'parent-child' | 'discovered-from';

/**
 * Core Beads issue representation
 */
export interface BeadsIssue {
  /** Issue ID (e.g., "pensive-8010" or hash-based) */
  id: string;

  /** Content hash for change detection */
  content_hash: string;

  /** Issue title */
  title: string;

  /** Issue description */
  description: string;

  /** Design notes (optional) */
  design?: string;

  /** Acceptance criteria (optional) */
  acceptance_criteria?: string;

  /** General notes (optional) */
  notes?: string;

  /** External reference (e.g., GitHub issue URL) */
  external_ref?: string;

  /** Current status */
  status: BeadsStatus;

  /** Priority level */
  priority: BeadsPriority;

  /** Issue type */
  issue_type: BeadsIssueType;

  /** Creation timestamp */
  created_at: string;

  /** Last update timestamp */
  updated_at: string;

  /** Closed timestamp (if closed) */
  closed_at?: string;

  /** Assigned user */
  assignee?: string;

  /** Labels */
  labels: string[];

  /** Dependencies (issues this depends on) */
  dependencies: BeadsDependency[];

  /** Dependents (issues that depend on this) */
  dependents: BeadsDependency[];
}

/**
 * Beads dependency relationship
 */
export interface BeadsDependency {
  /** Referenced issue ID */
  id: string;

  /** Content hash */
  content_hash: string;

  /** Issue title */
  title: string;

  /** Issue description */
  description: string;

  /** Status */
  status: BeadsStatus;

  /** Priority */
  priority: BeadsPriority;

  /** Issue type */
  issue_type: BeadsIssueType;

  /** Creation timestamp */
  created_at: string;

  /** Last update timestamp */
  updated_at: string;

  /** Dependency type (available since bd v0.21.3) */
  dependency_type: BeadsDependencyType;
}

/**
 * Parameters for creating a Beads issue
 */
export interface CreateBeadsIssueParams {
  /** Issue title (required) */
  title: string;

  /** Issue description */
  description?: string;

  /** Design notes */
  design?: string;

  /** Acceptance criteria */
  acceptance_criteria?: string;

  /** Issue type */
  issue_type?: BeadsIssueType;

  /** Priority (0-4) */
  priority?: BeadsPriority;

  /** Assignee */
  assignee?: string;

  /** Labels */
  labels?: string[];

  /** Dependencies (issue IDs this depends on) */
  dependencies?: string[];

  /** External reference */
  external_ref?: string;
}

/**
 * Parameters for updating a Beads issue
 */
export interface UpdateBeadsIssueParams {
  /** Updated title */
  title?: string;

  /** Updated description */
  description?: string;

  /** Updated design */
  design?: string;

  /** Updated acceptance criteria */
  acceptance_criteria?: string;

  /** Updated status */
  status?: BeadsStatus;

  /** Updated priority */
  priority?: BeadsPriority;

  /** Updated assignee */
  assignee?: string;

  /** Updated notes */
  notes?: string;

  /** Updated external reference */
  external_ref?: string;
}

/**
 * Epic status calculation
 */
export interface EpicStatus {
  /** Total child issues */
  total: number;

  /** Completed issues */
  completed: number;

  /** In-progress issues */
  inProgress: number;

  /** Blocked issues */
  blocked: number;

  /** Not started issues */
  notStarted: number;

  /** Completion percentage (0-100) */
  percentComplete: number;

  /** List of blocking dependencies */
  blockers: BeadsIssue[];

  /** List of discovered issues */
  discovered: BeadsIssue[];
}

/**
 * Repository configuration for Beads
 */
export interface BeadsRepository {
  /** Repository name (e.g., "auth-service") */
  name: string;

  /** Absolute path to repository */
  path: string;

  /** GitHub repository (e.g., "acme-corp/auth-service") */
  githubRepo?: string;

  /** Beads prefix (e.g., "auth") */
  prefix?: string;
}

/**
 * Beads configuration
 */
export interface BeadsConfig {
  /** List of repositories to track */
  repositories: BeadsRepository[];

  /** Default issue type when creating issues */
  defaultIssueType?: BeadsIssueType;

  /** Default priority when creating issues */
  defaultPriority?: BeadsPriority;
}

/**
 * Dependency tree node
 */
export interface DependencyTreeNode {
  /** Issue */
  issue: BeadsIssue;

  /** Child dependencies */
  dependencies: DependencyTreeNode[];

  /** Dependency type from parent */
  dependencyType?: BeadsDependencyType;

  /** Depth in tree */
  depth: number;
}

/**
 * Query parameters for listing Beads issues
 */
export interface BeadsListQuery {
  /** Filter by status */
  status?: BeadsStatus;

  /** Filter by priority */
  priority?: BeadsPriority;

  /** Filter by type */
  type?: BeadsIssueType;

  /** Filter by assignee */
  assignee?: string;

  /** Filter by label */
  labels?: string[];

  /** Limit number of results */
  limit?: number;
}
