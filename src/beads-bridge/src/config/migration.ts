/**
 * Configuration migration utilities for v1.0 → v2.0
 */

import type { Config } from '../types/config.js';

/**
 * Check if a config needs migration to v2.0
 */
export function needsMigration(config: any): boolean {
  // Missing version or version 1.0 needs migration
  return !config.version || config.version === '1.0';
}

/**
 * Migrate v1.0 config to v2.0
 */
export function migrateConfig(v1Config: any): Config {
  // Start with v1 config
  const v2Config = { ...v1Config };

  // Update version
  v2Config.version = '2.0';

  // Remove CLI-specific options from GitHub config
  if (v2Config.github?.cliPath) {
    const { cliPath: _cliPath, ...githubConfigWithoutCli } = v2Config.github;
    v2Config.github = githubConfigWithoutCli;
  }

  // No other changes needed - credential separation already handled

  return v2Config as Config;
}

/**
 * Get migration notes for user
 */
export function getMigrationNotes(): string[] {
  return [
    'Configuration migrated from v1.0 to v2.0',
    'Removed CLI-specific options (cliPath) - now using SDK clients',
    'Authentication credentials managed separately in ~/.config/beads-bridge/credentials.json',
    'Run "beads-bridge auth status" to check authentication',
    'No action required - migration is automatic'
  ];
}
