#!/usr/bin/env node

/**
 * Beads-GitHub Integration CLI
 *
 * Command-line interface for executing integration capabilities.
 */

import { Command } from 'commander';
import { createSkill } from './skill.js';
import type { SkillCapability, SkillContext } from './types/skill.js';
import { CredentialStore } from './auth/credential-store.js';
import { GitHubOAuth } from './auth/github-oauth.js';
import { withAuth } from './cli/auth-wrapper.js';
import { createServeCommand } from './cli/commands/serve.js';
import { createSyncCommand } from './cli/commands/sync.js';

const program = new Command();

// BUILD_VERSION is injected at build time via define
declare const BUILD_VERSION: string;
const version = typeof BUILD_VERSION !== 'undefined' ? BUILD_VERSION : 'dev';

program
  .name('beads-bridge')
  .description('CLI for Beads-GitHub Projects v2 integration')
  .version(version);

// Configuration option available to all commands
program.option(
  '-c, --config <path>',
  'path to config file',
  process.env.BEADS_GITHUB_CONFIG || '.beads-bridge/config.json'
);

/**
 * Execute a capability and output JSON result
 */
async function executeCapability(
  capability: SkillCapability,
  context: SkillContext,
  options: { config: string },
  backendOverride?: 'github' | 'shortcut'
) {
  try {
    const skill = await createSkill(options.config, backendOverride);
    const result = await skill.execute(capability, context);

    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: {
        code: 'CLI_ERROR',
        message: (error as Error).message,
        stack: (error as Error).stack
      }
    }, null, 2));
    process.exit(1);
  }
}

// ============================================================================
// Sync Command
// ============================================================================

program.addCommand(createSyncCommand());

// ============================================================================
// Decompose Command (Unified)
// ============================================================================

program
  .command('decompose')
  .description('Decompose external issue (GitHub or Shortcut) into Beads epic and tasks')
  .argument('<ref>', 'External reference (URL or shorthand: https://github.com/owner/repo/issues/123, github:owner/repo#123, shortcut:12345)')
  .option('--no-comment', 'skip posting confirmation comment')
  .option('--priority <number>', 'default priority for created beads', '2')
  .action(async (ref, options) => {
    const externalRef = ref;

    // Auto-detect backend from reference
    const { detectBackendFromRef } = await import('./utils/external-ref-parser.js');
    const detectedBackend = detectBackendFromRef(externalRef);
    
    if (!detectedBackend) {
      console.error(JSON.stringify({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Cannot determine backend from reference: ${externalRef}`
        }
      }, null, 2));
      process.exit(1);
    }

    await withAuth(detectedBackend, async () => {
      const context: SkillContext = {
        externalRef,
        postComment: options.comment,
        defaultPriority: parseInt(options.priority)
      };
      await executeCapability('decompose', context, program.opts());
    });
  });

// ============================================================================
// Authentication Commands
// ============================================================================

const authCommand = program
  .command('auth')
  .description('Manage authentication credentials');

// auth github
authCommand
  .command('github')
  .description('Authenticate with GitHub using OAuth device flow')
  .option('--client-id <id>', 'GitHub OAuth app client ID', process.env.GITHUB_CLIENT_ID)
  .option('--scopes <scopes>', 'Comma-separated list of scopes', 'repo,read:org,read:project')
  .action(async (options) => {
    try {
      const clientId = options.clientId || 'Ov23liGQU7nlLZRAXLIx'; // Default client ID
      const scopes = options.scopes.split(',').map((s: string) => s.trim());

      const oauth = new GitHubOAuth({ clientId, scopes });
      const token = await oauth.authenticate();

      // Save credentials
      const store = new CredentialStore();
      const existing = await store.load();
      await store.save({
        ...existing,
        github: {
          token: token.accessToken,
          scopes: token.scopes,
        },
      });

      console.log('✅ GitHub credentials saved successfully');
    } catch (error: any) {
      console.error('❌ Authentication failed:', error.message);
      process.exit(1);
    }
  });

// auth shortcut
authCommand
  .command('shortcut')
  .description('Authenticate with Shortcut using API token')
  .option('--token <token>', 'Shortcut API token')
  .action(async (options) => {
    try {
      let token = options.token;

      // If no token provided, prompt for it
      if (!token) {
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        token = await new Promise<string>((resolve) => {
          rl.question('Enter your Shortcut API token: ', (answer) => {
            rl.close();
            resolve(answer.trim());
          });
        });
      }

      if (!token) {
        throw new Error('Token is required');
      }

      // Save credentials
      const store = new CredentialStore();
      const existing = await store.load();
      await store.save({
        ...existing,
        shortcut: {
          token,
        },
      });

      console.log('✅ Shortcut credentials saved successfully');
    } catch (error: any) {
      console.error('❌ Failed to save credentials:', error.message);
      process.exit(1);
    }
  });

// auth status
authCommand
  .command('status')
  .description('Show authentication status')
  .action(async () => {
    try {
      const store = new CredentialStore();
      const creds = await store.load();

      console.log('\n🔐 Authentication Status\n');

      if (creds.github) {
        console.log('✅ GitHub: Authenticated');
        console.log(`   Scopes: ${creds.github.scopes.join(', ')}`);
      } else {
        console.log('❌ GitHub: Not authenticated');
        console.log('   Run: beads-bridge auth github');
      }

      console.log();

      if (creds.shortcut) {
        console.log('✅ Shortcut: Authenticated');
      } else {
        console.log('❌ Shortcut: Not authenticated');
        console.log('   Run: beads-bridge auth shortcut');
      }

      console.log();
    } catch (error: any) {
      console.error('❌ Failed to check status:', error.message);
      process.exit(1);
    }
  });

// auth clear
authCommand
  .command('clear')
  .description('Clear all stored credentials')
  .option('--confirm', 'Skip confirmation prompt')
  .action(async (options) => {
    try {
      if (!options.confirm) {
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question('Are you sure you want to clear all credentials? (y/N) ', (ans) => {
            rl.close();
            resolve(ans.trim().toLowerCase());
          });
        });

        if (answer !== 'y' && answer !== 'yes') {
          console.log('Cancelled.');
          return;
        }
      }

      const store = new CredentialStore();
      await store.clear();

      console.log('✅ All credentials cleared');
    } catch (error: any) {
      console.error('❌ Failed to clear credentials:', error.message);
      process.exit(1);
    }
  });

// ============================================================================
// Init Command
// ============================================================================

program
  .command('init')
  .description('Initialize .beads-bridge/config.json in current directory')
  .option('-r, --repository <owner/repo>', 'GitHub repository (e.g., mrdavidlaing/pensive)')
  .option('-b, --backend <type>', 'Backend type (github or shortcut)', 'github')
  .action(async (options) => {
    const fs = await import('fs/promises');
    const path = await import('path');

    try {
      // Create .beads-bridge directory if it doesn't exist
      await fs.mkdir('.beads-bridge', { recursive: true });

      const configPath = '.beads-bridge/config.json';

      // Check if config already exists
      try {
        await fs.access(configPath);
        console.error(`Error: Configuration file already exists at ${configPath}`);
        console.error('Use a different directory or remove the existing config first.');
        process.exit(1);
      } catch {
        // Config doesn't exist, we can create it
      }

      // Prompt for repository if not provided
      const repository = options.repository;
      if (!repository) {
        console.log('\nNo repository specified. Please provide:');
        console.log('  beads-bridge init -r owner/repo');
        console.log('\nExample:');
        console.log('  beads-bridge init -r mrdavidlaing/pensive');
        process.exit(1);
      }



      // Create minimal config
      const config = {
        version: '2.0',
        backend: options.backend,
        [options.backend]: {
          repository: repository
        },
        repository: {
          path: '.'
        },
        logging: {
          level: 'info'
        }
      };

      // Write config file as JSON
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

      console.log(`✅ Created ${configPath}`);
      console.log(`   Repository path: . (auto-detected from current directory)`);
      console.log(`\nNext steps:`);
      console.log(`1. Authenticate: beads-bridge auth ${options.backend}`);
      console.log(`2. Test sync:    beads-bridge sync <bead-id>`);
      console.log(`\nConfig location: ${path.resolve(configPath)}`);

      process.exit(0);
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// ============================================================================
// Serve Command - Live Web Dashboard
// ============================================================================

program.addCommand(createServeCommand());

// ============================================================================
// Parse and Execute
// ============================================================================

program.parse();
