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
import { withAuth, getBackendFromConfig } from './cli/auth-wrapper.js';
import { createServeCommand } from './cli/commands/serve.js';
import { createSyncCommand } from './cli/commands/sync.js';

const program = new Command();

program
  .name('beads-bridge')
  .description('CLI for Beads-GitHub Projects v2 integration')
  .version('0.1.0');

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
// Status Command
// ============================================================================

program
  .command('status')
  .description('Query aggregated status across GitHub Issue and Beads epics')
  .requiredOption('-r, --repository <owner/repo>', 'GitHub repository')
  .requiredOption('-i, --issue <number>', 'GitHub issue number')
  .option('-b, --blockers', 'include blocker details', false)
  .action(async (options) => {
    const backend = await getBackendFromConfig(program.opts().config);

    await withAuth(backend, async () => {
      const context: SkillContext = {
        repository: options.repository,
        issueNumber: parseInt(options.issue),
        includeBlockers: options.blockers
      };
      await executeCapability('query_status', context, program.opts());
    });
  });

// ============================================================================
// Sync Command (POC B - Simplified)
// ============================================================================

// Add the simplified sync command that reads beads and posts diagrams
program.addCommand(createSyncCommand());

// ============================================================================
// Diagram Command
// ============================================================================

program
  .command('diagram')
  .description('Generate and place Mermaid dependency diagram')
  .requiredOption('-r, --repository <owner/repo>', 'GitHub repository')
  .requiredOption('-i, --issue <number>', 'GitHub issue number')
  .option('-p, --placement <mode>', 'where to place diagram (description|comment)', 'comment')
  .action(async (options) => {
    const backend = await getBackendFromConfig(program.opts().config);

    await withAuth(backend, async () => {
      const context: SkillContext = {
        repository: options.repository,
        issueNumber: parseInt(options.issue),
        placement: options.placement as 'description' | 'comment'
      };
      await executeCapability('generate_diagrams', context, program.opts());
    });
  });

// ============================================================================
// Mapping Commands
// ============================================================================

const mapping = program
  .command('mapping')
  .description('Manage mappings between GitHub Issues and Beads epics');

mapping
  .command('get')
  .description('Get existing mapping for GitHub Issue')
  .requiredOption('-r, --repository <owner/repo>', 'GitHub repository')
  .requiredOption('-i, --issue <number>', 'GitHub issue number')
  .action(async (options) => {
    const backend = await getBackendFromConfig(program.opts().config);

    await withAuth(backend, async () => {
      const context: SkillContext = {
        repository: options.repository,
        issueNumber: parseInt(options.issue),
        action: 'get'
      };
      await executeCapability('manage_mappings', context, program.opts());
    });
  });

mapping
  .command('create')
  .description('Create mapping linking GitHub Issue to Beads epics')
  .requiredOption('-r, --repository <owner/repo>', 'GitHub repository')
  .requiredOption('-i, --issue <number>', 'GitHub issue number')
  .requiredOption('-e, --epics <json>', 'JSON array of epic definitions')
  .action(async (options) => {
    const backend = await getBackendFromConfig(program.opts().config);

    await withAuth(backend, async () => {
      let epicIds;
      try {
        epicIds = JSON.parse(options.epics);
      } catch (error) {
        console.error(JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid JSON for --epics: ${(error as Error).message}`
          }
        }, null, 2));
        process.exit(1);
      }

      const context: SkillContext = {
        repository: options.repository,
        issueNumber: parseInt(options.issue),
        action: 'create',
        epicIds
      };
      await executeCapability('manage_mappings', context, program.opts());
    });
  });

// ============================================================================
// Decompose Command
// ============================================================================

program
  .command('decompose')
  .description('Decompose GitHub issue into Beads epic and tasks')
  .requiredOption('-r, --repository <owner/repo>', 'GitHub repository')
  .requiredOption('-i, --issue <number>', 'GitHub issue number')
  .option('--no-comment', 'skip posting confirmation comment to GitHub')
  .option('--priority <number>', 'default priority for created beads', '2')
  .action(async (options) => {
    const backend = await getBackendFromConfig(program.opts().config);

    await withAuth(backend, async () => {
      const context: SkillContext = {
        repository: options.repository,
        issueNumber: parseInt(options.issue),
        postComment: options.comment,
        defaultPriority: parseInt(options.priority)
      };
      await executeCapability('decompose', context, program.opts());
    });
  });

// ============================================================================
// Force Sync Command
// ============================================================================

program
  .command('force-sync')
  .description('Force immediate sync of multiple operations')
  .requiredOption('-r, --repository <owner/repo>', 'GitHub repository')
  .requiredOption('-i, --issue <number>', 'GitHub issue number')
  .option(
    '-o, --operations <ops>',
    'comma-separated operations (progress,diagram)',
    'progress,diagram'
  )
  .action(async (options) => {
    const backend = await getBackendFromConfig(program.opts().config);

    await withAuth(backend, async () => {
      const operations = options.operations.split(',').map((s: string) => s.trim());

      const context: SkillContext = {
        repository: options.repository,
        issueNumber: parseInt(options.issue),
        operations
      };
      await executeCapability('force_sync', context, program.opts());
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

      // Get absolute path to current directory
      const currentDir = path.resolve(process.cwd());
      const dirName = path.basename(currentDir);

      // Create minimal config
      const config = {
        version: '2.0',
        backend: options.backend,
        [options.backend]: {
          repository: repository
        },
        repositories: [
          {
            name: dirName,
            path: currentDir
          }
        ],
        logging: {
          level: 'info'
        }
      };

      // Write config file as JSON
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

      console.log(`✅ Created ${configPath}`);
      console.log(`   Repository: ${dirName} (${currentDir})`);
      console.log(`\nNext steps:`);
      console.log(`1. Authenticate: beads-bridge auth ${options.backend}`);
      console.log(`2. Test status:   beads-bridge status -r ${repository} -i 1`);
      console.log(`\nConfig location: ${path.resolve(configPath)}`);

      process.exit(0);
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// ============================================================================
// Shortcut Commands
// ============================================================================

program
  .command('shortcut-status')
  .description('Query aggregated status for Shortcut story and Beads epics')
  .requiredOption('-s, --story <id>', 'Shortcut story ID')
  .option('-b, --blockers', 'include blocker details', false)
  .action(async (options) => {
    // Shortcut commands always use 'shortcut' backend
    await withAuth('shortcut', async () => {
      const context: SkillContext = {
        repository: 'shortcut',  // Use 'shortcut' as identifier
        issueNumber: parseInt(options.story),
        includeBlockers: options.blockers
      };
      await executeCapability('query_status', context, program.opts(), 'shortcut');
    });
  });

// Shortcut mapping commands
const shortcutMapping = program
  .command('shortcut-mapping')
  .description('Manage mappings between Shortcut stories and Beads epics');

shortcutMapping
  .command('get')
  .description('Get existing mapping for Shortcut story')
  .requiredOption('-s, --story <id>', 'Shortcut story ID')
  .action(async (options) => {
    // Shortcut commands always use 'shortcut' backend
    await withAuth('shortcut', async () => {
      const context: SkillContext = {
        repository: 'shortcut',
        issueNumber: parseInt(options.story),
        action: 'get'
      };
      await executeCapability('manage_mappings', context, program.opts(), 'shortcut');
    });
  });

shortcutMapping
  .command('create')
  .description('Create mapping linking Shortcut story to Beads epics')
  .requiredOption('-s, --story <id>', 'Shortcut story ID')
  .requiredOption('-e, --epics <json>', 'JSON array of epic definitions')
  .action(async (options) => {
    // Shortcut commands always use 'shortcut' backend
    await withAuth('shortcut', async () => {
      let epicIds;
      try {
        epicIds = JSON.parse(options.epics);
      } catch (error) {
        console.error(JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid JSON for --epics: ${(error as Error).message}`
          }
        }, null, 2));
        process.exit(1);
      }

      const context: SkillContext = {
        repository: 'shortcut',
        issueNumber: parseInt(options.story),
        action: 'create',
        epicIds
      };
      await executeCapability('manage_mappings', context, program.opts(), 'shortcut');
    });
  });

program
  .command('shortcut-decompose')
  .description('Decompose Shortcut story into Beads epic and tasks')
  .requiredOption('-s, --story <id>', 'Shortcut story ID')
  .option('--no-comment', 'skip posting confirmation comment to Shortcut')
  .option('--priority <number>', 'default priority for created beads', '2')
  .action(async (options) => {
    // Shortcut commands always use 'shortcut' backend
    await withAuth('shortcut', async () => {
      const context: SkillContext = {
        repository: 'shortcut',
        issueNumber: parseInt(options.story),
        postComment: options.comment,
        defaultPriority: parseInt(options.priority)
      };
      await executeCapability('decompose', context, program.opts(), 'shortcut');
    });
  });

// ============================================================================
// Shortcut Sync Command
// ============================================================================

program
  .command('shortcut-sync')
  .description('Post progress update to Shortcut story')
  .requiredOption('-s, --story <id>', 'Shortcut story ID')
  .option('-b, --blockers', 'include blocker details', false)
  .action(async (options) => {
    // Shortcut commands always use 'shortcut' backend
    await withAuth('shortcut', async () => {
      const context: SkillContext = {
        repository: 'shortcut',
        issueNumber: parseInt(options.story),
        includeBlockers: options.blockers
      };
      await executeCapability('sync_progress', context, program.opts(), 'shortcut');
    });
  });

// ============================================================================
// Shortcut Force Sync Command
// ============================================================================

program
  .command('shortcut-force-sync')
  .description('Force immediate sync of multiple operations for Shortcut story')
  .requiredOption('-s, --story <id>', 'Shortcut story ID')
  .option(
    '-o, --operations <ops>',
    'comma-separated operations (progress,diagram)',
    'progress,diagram'
  )
  .action(async (options) => {
    // Shortcut commands always use 'shortcut' backend
    await withAuth('shortcut', async () => {
      const operations = options.operations.split(',').map((s: string) => s.trim());

      const context: SkillContext = {
        repository: 'shortcut',
        issueNumber: parseInt(options.story),
        operations
      };
      await executeCapability('force_sync', context, program.opts(), 'shortcut');
    });
  });

// ============================================================================
// Shortcut Diagram Command
// ============================================================================

program
  .command('shortcut-diagram')
  .description('Generate and place Mermaid dependency diagram for Shortcut story')
  .requiredOption('-s, --story <id>', 'Shortcut story ID')
  .option('-p, --placement <mode>', 'where to place diagram (description|comment)', 'comment')
  .action(async (options) => {
    // Shortcut commands always use 'shortcut' backend
    await withAuth('shortcut', async () => {
      const context: SkillContext = {
        repository: 'shortcut',
        issueNumber: parseInt(options.story),
        placement: options.placement as 'description' | 'comment'
      };
      await executeCapability('generate_diagrams', context, program.opts(), 'shortcut');
    });
  });

// ============================================================================
// Serve Command - Live Web Dashboard
// ============================================================================

program.addCommand(createServeCommand());

// ============================================================================
// Parse and Execute
// ============================================================================

program.parse();
