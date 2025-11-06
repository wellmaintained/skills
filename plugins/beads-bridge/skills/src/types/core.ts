/**
 * Core type definitions for the Beads-PM integration
 *
 * These types define the common data structures used across all
 * project management backend implementations.
 */

/**
 * Basic user information
 */
export interface User {
  id: string;
  login: string;
  name?: string;
  email?: string;
}

/**
 * Issue label
 */
export interface Label {
  id: string;
  name: string;
  color?: string;
  description?: string;
}

/**
 * Comment on an issue
 */
export interface Comment {
  id: string;
  body: string;
  author: User;
  createdAt: Date;
  updatedAt: Date;
  url?: string;
}

/**
 * Core issue state
 */
export type IssueState = 'open' | 'closed';

/**
 * Issue type for linking relationships
 */
export enum LinkType {
  PARENT_CHILD = 'parent-child',
  BLOCKS = 'blocks',
  RELATED = 'related'
}

/**
 * Relationship type for linked issues
 */
export type LinkedIssueRelation = 'parent' | 'child' | 'blocks' | 'blocked-by' | 'relates-to';

/**
 * Core issue representation
 */
export interface Issue {
  /** Unique identifier (backend-specific format) */
  id: string;

  /** Issue number (human-readable) */
  number: number;

  /** Issue title */
  title: string;

  /** Issue body/description (markdown) */
  body: string;

  /** Current state */
  state: IssueState;

  /** Assigned users */
  assignees: User[];

  /** Labels attached to issue */
  labels: Label[];

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /** URL to view issue in PM tool */
  url: string;

  /** Backend-specific metadata (custom fields, etc.) */
  metadata: Record<string, unknown>;
}

/**
 * Parameters for creating a new issue
 */
export interface CreateIssueParams {
  /** Issue title (required) */
  title: string;

  /** Issue body/description (markdown) */
  body: string;

  /** Repository identifier (GitHub: "owner/repo", may not apply to all backends) */
  repository?: string;

  /** Project identifier to add issue to */
  projectId?: string;

  /** User logins to assign */
  assignees?: string[];

  /** Label names to apply */
  labels?: string[];

  /** Backend-specific parameters */
  metadata?: Record<string, unknown>;
}

/**
 * Parameters for updating an existing issue
 */
export interface IssueUpdate {
  /** Updated title */
  title?: string;

  /** Updated body */
  body?: string;

  /** Updated state */
  state?: IssueState;

  /** Updated assignees (replaces existing) */
  assignees?: string[];

  /** Updated labels (replaces existing) */
  labels?: string[];

  /** Backend-specific updates */
  metadata?: Record<string, unknown>;
}

/**
 * Issue with relationship information
 */
export interface LinkedIssue {
  /** The linked issue */
  issue: Issue;

  /** Type of relationship */
  linkType: LinkedIssueRelation;
}

/**
 * Search/query parameters
 */
export interface SearchQuery {
  /** Text search in title/body */
  text?: string;

  /** Filter by state */
  state?: 'open' | 'closed' | 'all';

  /** Filter by labels (AND - must have all) */
  labels?: string[];

  /** Filter by assignee */
  assignee?: string;

  /** Filter by repository (GitHub-specific) */
  repository?: string;

  /** Filter by project */
  projectId?: string;

  /** Backend-specific filters */
  customFilters?: Record<string, unknown>;
}

/**
 * Base error class for backend operations
 *
 * Note: Specific error types (AuthenticationError, RateLimitError, etc.)
 * are defined in errors.ts to avoid duplication.
 */
export class BackendError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'BackendError';
  }
}
