/**
 * Type definitions for issue decomposition (GitHub → Beads)
 */

/**
 * Parsed repository reference from issue body
 */
export interface RepositoryReference {
  /** Repository name from config */
  name: string;

  /** Tasks specific to this repository */
  tasks: string[];

  /** Whether this is explicitly mentioned or inferred */
  explicit: boolean;
}

/**
 * Parsed task from issue body
 */
export interface ParsedTask {
  /** Task description */
  description: string;

  /** Whether task is already completed (checked) */
  completed: boolean;

  /** Repository this task belongs to (if specified) */
  repository?: string;

  /** Original line from issue body */
  originalLine: string;
}

/**
 * Parsed GitHub issue for decomposition
 */
export interface ParsedIssue {
  /** GitHub issue number */
  number: number;

  /** Issue title */
  title: string;

  /** Issue body (raw markdown) */
  body: string;

  /** Parsed task list */
  tasks: ParsedTask[];

  /** Repositories affected (parsed from body) */
  repositories: RepositoryReference[];

  /** GitHub issue URL */
  url: string;

  /** GitHub repository (owner/repo) */
  githubRepository: string;

  /** GitHub project ID (if tracked) */
  projectId?: string;
}

/**
 * Epic creation request for a single repository
 */
export interface EpicCreationRequest {
  /** Repository name */
  repository: string;

  /** Epic title */
  title: string;

  /** Epic description */
  description: string;

  /** Tasks to create as child issues */
  tasks: string[];

  /** Priority (0-4) */
  priority: number;

  /** External reference (GitHub issue) */
  externalRef: string;

  /** Labels to apply */
  labels?: string[];
}

/**
 * Result of epic creation
 */
export interface EpicCreationResult {
  /** Repository name */
  repository: string;

  /** Created epic ID */
  epicId: string;

  /** Created child issue IDs */
  childIssueIds: string[];

  /** Whether creation succeeded */
  success: boolean;

  /** Error message if failed */
  error?: string;
}

/**
 * Complete decomposition result
 */
export interface DecompositionResult {
  /** GitHub issue that was decomposed */
  githubIssue: string;

  /** Epic creation results per repository */
  epics: EpicCreationResult[];

  /** Total tasks created across all repositories */
  totalTasks: number;

  /** Confirmation comment markdown */
  confirmationComment: string;

  /** Whether decomposition succeeded */
  success: boolean;

  /** Error message if failed */
  error?: string;
}

/**
 * Decomposition options
 */
export interface DecompositionOptions {
  /** Whether to post confirmation comment */
  postComment?: boolean;

  /** Whether to update project fields */
  updateProjectFields?: boolean;

  /** Whether to add to project */
  addToProject?: boolean;

  /** Default priority for created epics */
  defaultPriority?: number;

  /** Labels to add to GitHub issue */
  labels?: string[];
}
