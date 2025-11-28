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
  RepositoryPathConfig,
  GitHubConfig,
  ShortcutConfig,
} from '../types/config.js';
import { detectRepository, extractPrefixFromIssues } from '../utils/repo-detector.js';
import { needsMigration, migrateConfig, getMigrationNotes } from './migration.js';

/**
 * ConfigManager handles configuration loading, validation, and access
 */
export class ConfigManager {
  private config: Config;
  private resolvedRepositoryPath: string | null = null;
  private resolvedPrefix: string | undefined;

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

    if (process.env[ENV_VARS.GITHUB_REPO]) {
      envConfig.github = {
        ...DEFAULT_CONFIG.github,
        repository: process.env[ENV_VARS.GITHUB_REPO]!,
      };
    }

    if (process.env[ENV_VARS.GITHUB_PROJECT_ID]) {
      envConfig.github = {
        ...(envConfig.github || DEFAULT_CONFIG.github),
        projectId: process.env[ENV_VARS.GITHUB_PROJECT_ID],
      };
    }

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
   * Load configuration with auto-detection
   * Priority: file config -> env vars -> auto-detect -> defaults
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

    // Auto-detect repository if not configured
    await manager.autoDetectRepository();

    // Validate configuration
    manager.validate();

    return manager;
  }

  /**
   * Auto-detect repository path if not explicitly configured
   */
  private async autoDetectRepository(): Promise<void> {
    // If repository path is explicitly configured, use it
    if (this.config.repository?.path) {
      this.resolvedRepositoryPath = isAbsolute(this.config.repository.path)
        ? this.config.repository.path
        : resolve(this.config.repository.path);
      this.resolvedPrefix = this.config.repository.prefix;
      return;
    }

    // Auto-detect from current working directory
    const detected = detectRepository();
    if (detected) {
      this.resolvedRepositoryPath = detected.path;
      // Auto-detect prefix if not configured
      this.resolvedPrefix = this.config.repository?.prefix || extractPrefixFromIssues(detected.path);
    }
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
   * Get repository path (resolved, absolute)
   */
  getRepositoryPath(): string | null {
    return this.resolvedRepositoryPath;
  }

  /**
   * Get issue prefix
   */
  getPrefix(): string | undefined {
    return this.resolvedPrefix;
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

    // Repository path is optional - can be auto-detected
    // Only validate if explicitly provided
    if (this.config.repository?.path && !this.resolvedRepositoryPath) {
      throw new ConfigValidationError(
        `Repository path does not exist or is not a beads repo: ${this.config.repository.path}`,
        'repository.path',
        this.config.repository.path
      );
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
    };
  }

  /**
   * Apply environment variable overrides
   */
  private applyEnvironmentOverrides(): void {
    if (process.env[ENV_VARS.GITHUB_REPO]) {
      this.config.github.repository = process.env[ENV_VARS.GITHUB_REPO]!;
    }

    if (process.env[ENV_VARS.GITHUB_PROJECT_ID]) {
      this.config.github.projectId = process.env[ENV_VARS.GITHUB_PROJECT_ID];
    }

    if (process.env[ENV_VARS.LOG_LEVEL]) {
      this.config.logging.level = process.env[ENV_VARS.LOG_LEVEL]!.toLowerCase() as LogLevel;
    }
  }
}