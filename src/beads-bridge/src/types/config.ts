/**
 * Configuration type definitions for the Beads-GitHub integration
 */

/**
 * Log level for application logging
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Backend type for project management
 */
export type BackendType = 'github' | 'shortcut';


/**
 * Repository configuration for Beads
 */
export interface RepositoryConfig {
  /** Repository name (identifier) */
  name: string;

  /** Absolute path to repository on filesystem */
  path: string;

  /** GitHub repository (e.g., 'owner/repo') if different from Beads repo */
  githubRepo?: string;

  /** Beads issue prefix (e.g., 'frontend' for 'frontend-e123') */
  prefix?: string;

  /** Whether this repository is enabled for syncing */
  enabled?: boolean;
}

/**
 * GitHub-specific configuration
 */
export interface GitHubConfig {
  /** GitHub Projects v2 project ID */
  projectId?: string;

  /** GitHub repository for creating issues (e.g., 'owner/repo') */
  repository: string;
}

/**
 * Shortcut-specific configuration
 */
export interface ShortcutConfig {
  /** Shortcut workspace name */
  workspace: string;
}


/**
 * Logging configuration
 */
export interface LoggingConfig {
  /** Log level */
  level: LogLevel;

  /** Log output destinations */
  outputs?: {
    /** Enable console logging */
    console?: boolean;

    /** Enable file logging */
    file?: boolean;
  };
}

/**
 * Mermaid diagram configuration
 */
export interface DiagramConfig {
  /** Enable diagram generation */
  enabled: boolean;

  /** Maximum nodes to include in diagram */
  maxNodes?: number;

  /** Include legend in diagram */
  includeLegend?: boolean;

  /** Diagram update strategy */
  updateStrategy?: {
    /** Update on scope changes */
    onScopeChange?: boolean;

    /** Update weekly */
    weekly?: boolean;

    /** Update on manual command */
    onManualCommand?: boolean;
  };

  /** Placement strategy */
  placement?: {
    /** Update issue description */
    updateDescription?: boolean;

    /** Create snapshot comments */
    createSnapshots?: boolean;
  };
}


/**
 * Main configuration schema for v2.0
 */
export interface Config {
  /** Configuration version */
  version: string;

  /** Backend type (default backend to use) */
  backend: BackendType;

  /** GitHub configuration */
  github: GitHubConfig;

  /** Shortcut configuration (v2.0+) */
  shortcut?: ShortcutConfig;

  /** Beads repositories */
  repositories: RepositoryConfig[];

  /** Mapping database storage path */
  mappingStoragePath: string;

  /** Logging configuration */
  logging: LoggingConfig;

  /** Mermaid diagram configuration */
  diagrams?: DiagramConfig;
}

/**
 * Default configuration values for v2.0
 */
export const DEFAULT_CONFIG: Config = {
  version: '2.0',
  backend: 'github',
  github: {
    repository: ''
  },
  repositories: [],
  mappingStoragePath: '.beads-bridge',
  logging: {
    level: 'info',
    outputs: {
      console: true,
      file: false
    }
  },
  diagrams: {
    enabled: true,
    maxNodes: 50,
    includeLegend: true,
    updateStrategy: {
      onScopeChange: true,
      weekly: true,
      onManualCommand: true
    },
    placement: {
      updateDescription: true,
      createSnapshots: true
    }
  }
};

/**
 * Environment variable names
 */
export const ENV_VARS = {
  CONFIG_PATH: 'BEADS_PM_SYNC_CONFIG',
  GITHUB_REPO: 'BEADS_PM_SYNC_GITHUB_REPO',
  GITHUB_PROJECT_ID: 'BEADS_PM_SYNC_GITHUB_PROJECT_ID',
  MAPPING_STORAGE_PATH: 'BEADS_PM_SYNC_STORAGE_PATH',
  LOG_LEVEL: 'BEADS_PM_SYNC_LOG_LEVEL',
} as const;

/**
 * Configuration validation error
 */
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public value?: unknown
  ) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}
