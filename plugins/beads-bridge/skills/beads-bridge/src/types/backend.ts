/**
 * Project Management Backend Interface
 *
 * This interface defines the contract that all project management
 * backend implementations must fulfill. It provides a common abstraction
 * over different PM tools (GitHub Projects, Shortcut, Jira, Linear, etc.)
 */

import type {
  Comment,
  CreateIssueParams,
  Issue,
  IssueUpdate,
  LinkedIssue,
  LinkType,
  SearchQuery
} from './core.js';

/**
 * Core interface that all project management backends must implement
 */
export interface ProjectManagementBackend {
  // ============================================================================
  // Metadata
  // ============================================================================

  /** Backend name (e.g., "github", "shortcut", "jira") */
  readonly name: string;

  /** Whether this backend supports projects/boards */
  readonly supportsProjects: boolean;

  /** Whether this backend supports sub-issues/subtasks */
  readonly supportsSubIssues: boolean;

  /** Whether this backend supports custom fields */
  readonly supportsCustomFields: boolean;

  // ============================================================================
  // Authentication
  // ============================================================================

  /**
   * Authenticate with the backend service
   * @throws {AuthenticationError} if authentication fails
   */
  authenticate(): Promise<void>;

  /**
   * Check if currently authenticated
   * @returns true if authenticated and ready to make API calls
   */
  isAuthenticated(): boolean;

  // ============================================================================
  // Issue Operations
  // ============================================================================

  /**
   * Create a new issue
   * @param params - Issue creation parameters
   * @returns The created issue
   * @throws {ValidationError} if parameters are invalid
   * @throws {AuthenticationError} if not authenticated
   * @throws {RateLimitError} if rate limit exceeded
   */
  createIssue(params: CreateIssueParams): Promise<Issue>;

  /**
   * Get an issue by ID
   * @param issueId - The issue identifier
   * @returns The issue
   * @throws {NotFoundError} if issue doesn't exist
   * @throws {AuthenticationError} if not authenticated
   */
  getIssue(issueId: string): Promise<Issue>;

  /**
   * Update an existing issue
   * @param issueId - The issue identifier
   * @param updates - Fields to update
   * @returns The updated issue
   * @throws {NotFoundError} if issue doesn't exist
   * @throws {ValidationError} if updates are invalid
   * @throws {AuthenticationError} if not authenticated
   */
  updateIssue(issueId: string, updates: IssueUpdate): Promise<Issue>;

  // ============================================================================
  // Comments
  // ============================================================================

  /**
   * Add a comment to an issue
   * @param issueId - The issue identifier
   * @param comment - Comment body (markdown)
   * @returns The created comment
   * @throws {NotFoundError} if issue doesn't exist
   * @throws {AuthenticationError} if not authenticated
   */
  addComment(issueId: string, comment: string): Promise<Comment>;

  /**
   * List comments on an issue
   * @param issueId - The issue identifier
   * @returns Array of comments, ordered by creation time
   * @throws {NotFoundError} if issue doesn't exist
   * @throws {AuthenticationError} if not authenticated
   */
  listComments(issueId: string): Promise<Comment[]>;

  // ============================================================================
  // Relationships
  // ============================================================================

  /**
   * Create a link between two issues
   * @param parentId - The parent/blocking issue
   * @param childId - The child/blocked issue
   * @param linkType - Type of relationship
   * @throws {NotFoundError} if either issue doesn't exist
   * @throws {ValidationError} if relationship is invalid
   * @throws {AuthenticationError} if not authenticated
   */
  linkIssues(parentId: string, childId: string, linkType: LinkType): Promise<void>;

  /**
   * Get all issues linked to this issue
   * @param issueId - The issue identifier
   * @returns Array of linked issues with relationship types
   * @throws {NotFoundError} if issue doesn't exist
   * @throws {AuthenticationError} if not authenticated
   */
  getLinkedIssues(issueId: string): Promise<LinkedIssue[]>;

  // ============================================================================
  // Project Operations (Optional - only if supportsProjects is true)
  // ============================================================================

  /**
   * Add an issue to a project
   * @param issueId - The issue identifier
   * @param projectId - The project identifier
   * @throws {NotFoundError} if issue or project doesn't exist
   * @throws {AuthenticationError} if not authenticated
   */
  addToProject?(issueId: string, projectId: string): Promise<void>;

  /**
   * Update a custom field value for an issue in a project
   * @param issueId - The issue identifier
   * @param fieldName - The field name
   * @param value - The new value
   * @throws {NotFoundError} if issue, project, or field doesn't exist
   * @throws {ValidationError} if value is invalid for field type
   * @throws {AuthenticationError} if not authenticated
   */
  updateProjectField?(
    issueId: string,
    fieldName: string,
    value: unknown
  ): Promise<void>;

  /**
   * Get all issues in a project
   * @param projectId - The project identifier
   * @returns Array of issues in the project
   * @throws {NotFoundError} if project doesn't exist
   * @throws {AuthenticationError} if not authenticated
   */
  getProjectItems?(projectId: string): Promise<Issue[]>;

  // ============================================================================
  // Search/Query
  // ============================================================================

  /**
   * Search for issues matching criteria
   * @param query - Search parameters
   * @returns Array of matching issues
   * @throws {ValidationError} if query is invalid
   * @throws {AuthenticationError} if not authenticated
   */
  searchIssues(query: SearchQuery): Promise<Issue[]>;

}
