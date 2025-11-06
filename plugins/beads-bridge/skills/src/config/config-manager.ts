/**
 * Configuration manager for loading, validating, and accessing configuration
 */

import { promises as fs } from 'fs';
import { resolve, isAbsolute } from 'path';
import {
  Config,
  DEFAULT_CONFIG,
  ENV_VARS,
  ConfigValidationError,
  LogLevel,
  BackendType,
  RepositoryConfig,
  GitHubConfig,
  ShortcutConfig,
} from '../types/config.js';
import { needsMigration, migrateConfig, getMigrationNotes } from './migration.js';

/**
 * ConfigManager handles configuration loading, validation, and access
 */
export class ConfigManager {
  private config: Config;

  constructor(config?: Partial<Config>) {
    this.config = this.mergeWithDefaults(config || {});
  }

  /**
   * Load configuration from file
   */
  static async fromFile(configPath: string): Promise<ConfigManager> {
    const absolutePath = isAbsolute(configPath) ? configPath : resolve(configPath);

    try {
      const fileContent = await fs.readFile(absolutePath, 'utf-8');
      let fileConfig = JSON.parse(fileContent);

      // Auto-migrate if needed
      if (needsMigration(fileConfig)) {
        console.log('Migrating configuration from v1.0 to v2.0...');
        fileConfig = migrateConfig(fileConfig);

        // Save migrated config
        await fs.writeFile(absolutePath, JSON.stringify(fileConfig, null, 2), 'utf-8');

        // Show migration notes
        const notes = getMigrationNotes();
        notes.forEach(note => console.log(`  ℹ ${note}`));
        console.log('✓ Configuration migrated successfully\n');
      }

      const manager = new ConfigManager(fileConfig);

      return manager;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new ConfigValidationError(`Configuration file not found: ${absolutePath}`);
      }
      throw new ConfigValidationError(`Failed to load configuration: ${(error as Error).message}`);
    }
  }

  /**
   * Load configuration from environment variables
   */
  static fromEnvironment(): ConfigManager {
    const envConfig: Partial<Config> = {};

    // Load GitHub repository
    if (process.env[ENV_VARS.GITHUB_REPO]) {
      envConfig.github = {
        ...DEFAULT_CONFIG.github,
        repository: process.env[ENV_VARS.GITHUB_REPO]!,
      };
    }

    // Load GitHub project ID
    if (process.env[ENV_VARS.GITHUB_PROJECT_ID]) {
      envConfig.github = {
        ...(envConfig.github || DEFAULT_CONFIG.github),
        projectId: process.env[ENV_VARS.GITHUB_PROJECT_ID],
      };
    }

    // Load mapping storage path
    if (process.env[ENV_VARS.MAPPING_STORAGE_PATH]) {
      envConfig.mappingStoragePath = process.env[ENV_VARS.MAPPING_STORAGE_PATH];
    }

    // Load log level
    if (process.env[ENV_VARS.LOG_LEVEL]) {
      const logLevel = process.env[ENV_VARS.LOG_LEVEL]!.toLowerCase() as LogLevel;
      envConfig.logging = {
        ...DEFAULT_CONFIG.logging,
        level: logLevel,
      };
    }

    return new ConfigManager(envConfig);
  }

  /**
   * Load configuration with precedence: file → env vars → defaults
   */
  static async load(configPath?: string): Promise<ConfigManager> {
    let manager: ConfigManager;

    // Try to load from file if path provided or env var set
    const filePath = configPath || process.env[ENV_VARS.CONFIG_PATH];
    if (filePath) {
      try {
        manager = await ConfigManager.fromFile(filePath);
      } catch (error) {
        // If file not found, start with defaults
        manager = new ConfigManager();
      }
    } else {
      manager = new ConfigManager();
    }

    // Override with environment variables
    manager.applyEnvironmentOverrides();

    // Validate configuration
    manager.validate();

    return manager;
  }

  /**
   * Get full configuration
   */
  getConfig(): Readonly<Config> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Get backend type
   */
  getBackend(): BackendType {
    return this.config.backend;
  }

  /**
   * Get GitHub configuration
   */
  getGitHub(): Readonly<GitHubConfig> {
    return Object.freeze({ ...this.config.github });
  }

  /**
   * Get Shortcut configuration
   */
  getShortcut(): Readonly<ShortcutConfig> | undefined {
    return this.config.shortcut ? Object.freeze({ ...this.config.shortcut }) : undefined;
  }

  /**
   * Get repositories configuration
   */
  getRepositories(): ReadonlyArray<RepositoryConfig> {
    return this.config.repositories.map(repo => Object.freeze({ ...repo }));
  }

  /**
   * Get mapping storage path
   */
  getMappingStoragePath(): string {
    return this.config.mappingStoragePath;
  }

  /**
   * Get logging configuration
   */
  getLogging(): Readonly<Config['logging']> {
    return Object.freeze({ ...this.config.logging });
  }

  /**
   * Get diagrams configuration
   */
  getDiagrams(): Readonly<Config['diagrams']> | undefined {
    return this.config.diagrams ? Object.freeze({ ...this.config.diagrams }) : undefined;
  }

  /**
   * Validate configuration
   */
  validate(): void {
    // Validate version
    if (!this.config.version) {
      throw new ConfigValidationError('Configuration version is required', 'version');
    }

    // Validate backend
    const validBackends: BackendType[] = ['github', 'shortcut'];
    if (!validBackends.includes(this.config.backend)) {
      throw new ConfigValidationError(
        `Invalid backend: ${this.config.backend}`,
        'backend',
        this.config.backend
      );
    }

    // Validate GitHub configuration (only if GitHub config is present)
    if (this.config.github) {
      if (!this.config.github.repository) {
        throw new ConfigValidationError(
          'GitHub repository is required in github configuration',
          'github.repository'
        );
      }

      // Validate repository format (owner/repo)
      if (!/^[\w.-]+\/[\w.-]+$/.test(this.config.github.repository)) {
        throw new ConfigValidationError(
          `Invalid GitHub repository format: ${this.config.github.repository}`,
          'github.repository',
          this.config.github.repository
        );
      }
    }

    // Validate Shortcut configuration (only if Shortcut config is present)
    if (this.config.shortcut) {
      if (!this.config.shortcut.workspace) {
        throw new ConfigValidationError(
          'Shortcut workspace is required in shortcut configuration',
          'shortcut.workspace'
        );
      }
    }

    // Validate repositories
    if (this.config.repositories.length === 0) {
      throw new ConfigValidationError('At least one repository must be configured', 'repositories');
    }

    for (const repo of this.config.repositories) {
      if (!repo.name) {
        throw new ConfigValidationError('Repository name is required', 'repositories[].name');
      }

      if (!repo.path) {
        throw new ConfigValidationError(
          `Repository path is required for ${repo.name}`,
          'repositories[].path'
        );
      }

      if (!isAbsolute(repo.path)) {
        throw new ConfigValidationError(
          `Repository path must be absolute: ${repo.path}`,
          'repositories[].path',
          repo.path
        );
      }
    }

    // Check for duplicate repository names
    const names = this.config.repositories.map(r => r.name);
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    if (duplicates.length > 0) {
      throw new ConfigValidationError(
        `Duplicate repository names: ${duplicates.join(', ')}`,
        'repositories'
      );
    }

    // Validate mapping storage path
    if (!this.config.mappingStoragePath) {
      throw new ConfigValidationError('Mapping storage path is required', 'mappingStoragePath');
    }

    // Validate log level
    const validLogLevels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
    if (!validLogLevels.includes(this.config.logging.level)) {
      throw new ConfigValidationError(
        `Invalid log level: ${this.config.logging.level}`,
        'logging.level',
        this.config.logging.level
      );
    }

  }

  /**
   * Merge configuration with defaults
   */
  private mergeWithDefaults(config: Partial<Config>): Config {
    return {
      ...DEFAULT_CONFIG,
      ...config,
      github: { ...DEFAULT_CONFIG.github, ...config.github },
      logging: { ...DEFAULT_CONFIG.logging, ...config.logging },
      repositories: config.repositories || DEFAULT_CONFIG.repositories
    };
  }

  /**
   * Apply environment variable overrides
   */
  private applyEnvironmentOverrides(): void {
    // Override GitHub repository
    if (process.env[ENV_VARS.GITHUB_REPO]) {
      this.config.github.repository = process.env[ENV_VARS.GITHUB_REPO]!;
    }

    // Override GitHub project ID
    if (process.env[ENV_VARS.GITHUB_PROJECT_ID]) {
      this.config.github.projectId = process.env[ENV_VARS.GITHUB_PROJECT_ID];
    }

    // Override mapping storage path
    if (process.env[ENV_VARS.MAPPING_STORAGE_PATH]) {
      this.config.mappingStoragePath = process.env[ENV_VARS.MAPPING_STORAGE_PATH]!;
    }

    // Override log level
    if (process.env[ENV_VARS.LOG_LEVEL]) {
      this.config.logging.level = process.env[ENV_VARS.LOG_LEVEL]!.toLowerCase() as LogLevel;
    }

  }
}
