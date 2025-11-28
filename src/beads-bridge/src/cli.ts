#!/usr/bin/env node

/**
 * Beads-GitHub Integration CLI
 *
 * Command-line interface for executing integration capabilities.
 */

import { Command } from 'commander';
import { CredentialStore } from './auth/credential-store.js';
import { GitHubOAuth } from './auth/github-oauth.js';
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



// ============================================================================
// Sync Command
// ============================================================================

program.addCommand(createSyncCommand());

// ============================================================================
// Decompose Command (Unified)
// ============================================================================

program
  .command('decompose')
  .description('Decompose GitHub issue into Beads epic and tasks')
  .argument('<ref>', 'External reference (URL or shorthand: https://github.com/owner/repo/issues/123, github:owner/repo#123)')
  .option('--no-comment', 'skip posting confirmation comment')
  .option('--priority <number>', 'default priority for created beads', '2')
  .option('--project-id <id>', 'GitHub Project ID to add issues to')
  .action(async (ref, options) => {
    const {  parseExternalRef } = await import('./utils/external-ref-parser.js');
    const { GitHubBackend } = await import('./backends/github.js');
    const { BeadsClient } = await import('./clients/beads-client.js');
    const { EpicDecomposer } = await import('./decomposition/epic-decomposer.js');
    const { CredentialStore } = await import('./auth/credential-store.js');

    try {
      // Parse external ref
      const parsed = parseExternalRef(ref);
      
      if (parsed.backend !== 'github') {
        console.error('Error: Only GitHub issues are supported for decompose');
        process.exit(1);
      }

      if (!parsed.repository || !parsed.issueNumber) {
        console.error('Error: Invalid GitHub reference');
        process.exit(1);
      }

      // Load credentials and create backend
      const store = new CredentialStore();
      const creds = await store.load();
      const github = new GitHubBackend({ credentials: creds });
      await github.authenticate();

      // Create decomposer
      const beads = new BeadsClient({});
      const decomposer = new EpicDecomposer(github, beads);

      // Decompose
      const result = await decomposer.decompose(parsed.repository, parsed.issueNumber, {
        postComment: options.comment,
        defaultPriority: parseInt(options.priority),
        projectId: options.projectId ? parseInt(options.projectId) : undefined
      });

      if (result.success) {
        console.log(`✅ Decomposed ${result.githubIssue}`);
        console.log(`   Created ${result.epics.length} epic(s) with ${result.totalTasks} total tasks`);
      } else {
        console.error(`❌ Decomposition failed: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
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
// Serve Command - Live Web Dashboard
// ============================================================================

program.addCommand(createServeCommand());

// ============================================================================
// Parse and Execute
// ============================================================================

program.parse();
