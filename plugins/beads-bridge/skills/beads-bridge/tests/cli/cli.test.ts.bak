// tests/cli/cli.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

/**
 * Unit tests for CLI command parsing and framework
 *
 * These tests focus on the CLI framework itself (command parsing, options, help)
 * Integration tests for command execution are in cli-integration.test.ts
 */

// Mock dependencies
vi.mock('../../src/skill.js', () => ({
  createSkill: vi.fn().mockResolvedValue({
    execute: vi.fn().mockResolvedValue({ success: true, data: {} })
  })
}));

vi.mock('../../src/cli/auth-wrapper.js', () => ({
  withAuth: vi.fn((backend, fn) => fn()),
  getBackendFromConfig: vi.fn().mockResolvedValue('github')
}));

vi.mock('../../src/auth/credential-store.js', () => ({
  CredentialStore: vi.fn().mockImplementation(() => ({
    load: vi.fn().mockResolvedValue({}),
    save: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('../../src/auth/github-oauth.js', () => ({
  GitHubOAuth: vi.fn().mockImplementation(() => ({
    authenticate: vi.fn().mockResolvedValue({
      accessToken: 'test_token',
      scopes: ['repo']
    })
  }))
}));

describe('CLI Framework Tests', () => {
  let program: Command;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    // Create a fresh command instance for each test
    program = new Command();
    program.exitOverride(); // Prevent actual process.exit() in tests

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('Program Metadata', () => {
    it('should have correct name and version', () => {
      program
        .name('beads-bridge')
        .description('CLI for Beads-GitHub Projects v2 integration')
        .version('0.1.0');

      expect(program.name()).toBe('beads-bridge');
      expect(program.version()).toBe('0.1.0');
    });

    it('should have correct description', () => {
      program
        .name('beads-bridge')
        .description('CLI for Beads-GitHub Projects v2 integration')
        .version('0.1.0');

      expect(program.description()).toBe('CLI for Beads-GitHub Projects v2 integration');
    });
  });

  describe('Global Options', () => {
    it('should accept --config option', () => {
      program.option('-c, --config <path>', 'path to config file');
      program.parse(['node', 'test', '--config', 'custom.yaml']);

      const opts = program.opts();
      expect(opts.config).toBe('custom.yaml');
    });

    it('should use default config from environment', () => {
      const originalEnv = process.env.BEADS_GITHUB_CONFIG;
      process.env.BEADS_GITHUB_CONFIG = 'env-config.yaml';

      program.option(
        '-c, --config <path>',
        'path to config file',
        process.env.BEADS_GITHUB_CONFIG || 'config.yaml'
      );
      program.parse(['node', 'test']);

      const opts = program.opts();
      expect(opts.config).toBe('env-config.yaml');

      // Restore
      if (originalEnv) {
        process.env.BEADS_GITHUB_CONFIG = originalEnv;
      } else {
        delete process.env.BEADS_GITHUB_CONFIG;
      }
    });

    it('should fall back to config.yaml if no env var', () => {
      const originalEnv = process.env.BEADS_GITHUB_CONFIG;
      delete process.env.BEADS_GITHUB_CONFIG;

      program.option(
        '-c, --config <path>',
        'path to config file',
        process.env.BEADS_GITHUB_CONFIG || 'config.yaml'
      );
      program.parse(['node', 'test']);

      const opts = program.opts();
      expect(opts.config).toBe('config.yaml');

      // Restore
      if (originalEnv) {
        process.env.BEADS_GITHUB_CONFIG = originalEnv;
      }
    });
  });

  describe('Status Command', () => {
    it('should parse status command with required options', () => {
      const statusCmd = program
        .command('status')
        .description('Query aggregated status across GitHub Issue and Beads epics')
        .requiredOption('-r, --repository <owner/repo>', 'GitHub repository')
        .requiredOption('-i, --issue <number>', 'GitHub issue number')
        .option('-b, --blockers', 'include blocker details', false);

      statusCmd.parse(['node', 'status', '-r', 'owner/repo', '-i', '123']);

      const opts = statusCmd.opts();
      expect(opts.repository).toBe('owner/repo');
      expect(opts.issue).toBe('123');
      expect(opts.blockers).toBe(false);
    });

    it('should parse status command with blockers flag', () => {
      const statusCmd = program
        .command('status')
        .requiredOption('-r, --repository <owner/repo>', 'GitHub repository')
        .requiredOption('-i, --issue <number>', 'GitHub issue number')
        .option('-b, --blockers', 'include blocker details', false);

      statusCmd.parse(['node', 'status', '-r', 'owner/repo', '-i', '123', '-b']);

      const opts = statusCmd.opts();
      expect(opts.blockers).toBe(true);
    });

    it('should error on missing required repository option', () => {
      const statusCmd = program
        .command('status')
        .requiredOption('-r, --repository <owner/repo>', 'GitHub repository')
        .requiredOption('-i, --issue <number>', 'GitHub issue number');

      expect(() => {
        statusCmd.parse(['node', 'status', '-i', '123']);
      }).toThrow();
    });

    it('should error on missing required issue option', () => {
      const statusCmd = program
        .command('status')
        .requiredOption('-r, --repository <owner/repo>', 'GitHub repository')
        .requiredOption('-i, --issue <number>', 'GitHub issue number');

      expect(() => {
        statusCmd.parse(['node', 'status', '-r', 'owner/repo']);
      }).toThrow();
    });
  });

  describe('Sync Command', () => {
    it('should parse sync command with all options', () => {
      const syncCmd = program
        .command('sync')
        .description('Post progress update to GitHub Issue')
        .requiredOption('-r, --repository <owner/repo>', 'GitHub repository')
        .requiredOption('-i, --issue <number>', 'GitHub issue number')
        .option('-b, --blockers', 'include blocker details', false);

      syncCmd.parse(['node', 'sync', '-r', 'owner/repo', '-i', '456', '-b']);

      const opts = syncCmd.opts();
      expect(opts.repository).toBe('owner/repo');
      expect(opts.issue).toBe('456');
      expect(opts.blockers).toBe(true);
    });
  });

  describe('Diagram Command', () => {
    it('should parse diagram command with default placement', () => {
      const diagramCmd = program
        .command('diagram')
        .description('Generate and place Mermaid dependency diagram')
        .requiredOption('-r, --repository <owner/repo>', 'GitHub repository')
        .requiredOption('-i, --issue <number>', 'GitHub issue number')
        .option('-p, --placement <mode>', 'where to place diagram', 'comment');

      diagramCmd.parse(['node', 'diagram', '-r', 'owner/repo', '-i', '789']);

      const opts = diagramCmd.opts();
      expect(opts.repository).toBe('owner/repo');
      expect(opts.issue).toBe('789');
      expect(opts.placement).toBe('comment');
    });

    it('should parse diagram command with custom placement', () => {
      const diagramCmd = program
        .command('diagram')
        .requiredOption('-r, --repository <owner/repo>', 'GitHub repository')
        .requiredOption('-i, --issue <number>', 'GitHub issue number')
        .option('-p, --placement <mode>', 'where to place diagram', 'comment');

      diagramCmd.parse(['node', 'diagram', '-r', 'owner/repo', '-i', '789', '-p', 'description']);

      const opts = diagramCmd.opts();
      expect(opts.placement).toBe('description');
    });
  });

  describe('Discoveries Command', () => {
    it('should parse discoveries command', () => {
      const discoveriesCmd = program
        .command('discoveries')
        .description('Detect newly discovered work during implementation')
        .requiredOption('-r, --repository <owner/repo>', 'GitHub repository')
        .requiredOption('-i, --issue <number>', 'GitHub issue number');

      discoveriesCmd.parse(['node', 'discoveries', '-r', 'owner/repo', '-i', '111']);

      const opts = discoveriesCmd.opts();
      expect(opts.repository).toBe('owner/repo');
      expect(opts.issue).toBe('111');
    });
  });

  describe('Mapping Commands', () => {
    it('should parse mapping get command', () => {
      const mappingCmd = program.command('mapping');
      const getCmd = mappingCmd
        .command('get')
        .description('Get existing mapping for GitHub Issue')
        .requiredOption('-r, --repository <owner/repo>', 'GitHub repository')
        .requiredOption('-i, --issue <number>', 'GitHub issue number');

      getCmd.parse(['node', 'get', '-r', 'owner/repo', '-i', '222']);

      const opts = getCmd.opts();
      expect(opts.repository).toBe('owner/repo');
      expect(opts.issue).toBe('222');
    });

    it('should parse mapping create command', () => {
      const mappingCmd = program.command('mapping');
      const createCmd = mappingCmd
        .command('create')
        .description('Create mapping linking GitHub Issue to Beads epics')
        .requiredOption('-r, --repository <owner/repo>', 'GitHub repository')
        .requiredOption('-i, --issue <number>', 'GitHub issue number')
        .requiredOption('-e, --epics <json>', 'JSON array of epic definitions');

      const epicJson = JSON.stringify([{ repository: 'test', epicId: 'epic-1', repositoryPath: '/path' }]);
      createCmd.parse(['node', 'create', '-r', 'owner/repo', '-i', '333', '-e', epicJson]);

      const opts = createCmd.opts();
      expect(opts.repository).toBe('owner/repo');
      expect(opts.issue).toBe('333');
      expect(opts.epics).toBe(epicJson);
    });
  });

  describe('Decompose Command', () => {
    it('should parse decompose command with default options', () => {
      const decomposeCmd = program
        .command('decompose')
        .description('Decompose GitHub issue into Beads epic and tasks')
        .requiredOption('-r, --repository <owner/repo>', 'GitHub repository')
        .requiredOption('-i, --issue <number>', 'GitHub issue number')
        .option('--no-comment', 'skip posting confirmation comment to GitHub')
        .option('--priority <number>', 'default priority for created beads', '2');

      decomposeCmd.parse(['node', 'decompose', '-r', 'owner/repo', '-i', '444']);

      const opts = decomposeCmd.opts();
      expect(opts.repository).toBe('owner/repo');
      expect(opts.issue).toBe('444');
      expect(opts.priority).toBe('2');
    });

    it('should parse decompose command with custom priority', () => {
      const decomposeCmd = program
        .command('decompose')
        .requiredOption('-r, --repository <owner/repo>', 'GitHub repository')
        .requiredOption('-i, --issue <number>', 'GitHub issue number')
        .option('--no-comment', 'skip posting confirmation comment to GitHub')
        .option('--priority <number>', 'default priority for created beads', '2');

      decomposeCmd.parse(['node', 'decompose', '-r', 'owner/repo', '-i', '444', '--priority', '1']);

      const opts = decomposeCmd.opts();
      expect(opts.priority).toBe('1');
    });

    it('should parse decompose command with no-comment flag', () => {
      const decomposeCmd = program
        .command('decompose')
        .requiredOption('-r, --repository <owner/repo>', 'GitHub repository')
        .requiredOption('-i, --issue <number>', 'GitHub issue number')
        .option('--no-comment', 'skip posting confirmation comment to GitHub')
        .option('--priority <number>', 'default priority for created beads', '2');

      decomposeCmd.parse(['node', 'decompose', '-r', 'owner/repo', '-i', '444', '--no-comment']);

      const opts = decomposeCmd.opts();
      expect(opts.comment).toBe(false);
    });
  });

  describe('Force Sync Command', () => {
    it('should parse force-sync command with default operations', () => {
      const forceSyncCmd = program
        .command('force-sync')
        .description('Force immediate sync of multiple operations')
        .requiredOption('-r, --repository <owner/repo>', 'GitHub repository')
        .requiredOption('-i, --issue <number>', 'GitHub issue number')
        .option(
          '-o, --operations <ops>',
          'comma-separated operations',
          'progress,diagram,discovery'
        );

      forceSyncCmd.parse(['node', 'force-sync', '-r', 'owner/repo', '-i', '555']);

      const opts = forceSyncCmd.opts();
      expect(opts.repository).toBe('owner/repo');
      expect(opts.issue).toBe('555');
      expect(opts.operations).toBe('progress,diagram,discovery');
    });

    it('should parse force-sync command with custom operations', () => {
      const forceSyncCmd = program
        .command('force-sync')
        .requiredOption('-r, --repository <owner/repo>', 'GitHub repository')
        .requiredOption('-i, --issue <number>', 'GitHub issue number')
        .option(
          '-o, --operations <ops>',
          'comma-separated operations',
          'progress,diagram,discovery'
        );

      forceSyncCmd.parse(['node', 'force-sync', '-r', 'owner/repo', '-i', '555', '-o', 'progress']);

      const opts = forceSyncCmd.opts();
      expect(opts.operations).toBe('progress');
    });
  });

  describe('Authentication Commands', () => {
    it('should parse auth github command with default client ID', () => {
      const authCmd = program.command('auth');
      const githubCmd = authCmd
        .command('github')
        .description('Authenticate with GitHub using OAuth device flow')
        .option('--client-id <id>', 'GitHub OAuth app client ID', process.env.GITHUB_CLIENT_ID)
        .option('--scopes <scopes>', 'Comma-separated list of scopes', 'repo,read:org,read:project');

      githubCmd.parse(['node', 'github']);

      const opts = githubCmd.opts();
      expect(opts.scopes).toBe('repo,read:org,read:project');
    });

    it('should parse auth github command with custom scopes', () => {
      const authCmd = program.command('auth');
      const githubCmd = authCmd
        .command('github')
        .option('--client-id <id>', 'GitHub OAuth app client ID')
        .option('--scopes <scopes>', 'Comma-separated list of scopes', 'repo,read:org,read:project');

      githubCmd.parse(['node', 'github', '--scopes', 'repo,admin:org']);

      const opts = githubCmd.opts();
      expect(opts.scopes).toBe('repo,admin:org');
    });

    it('should parse auth shortcut command with token', () => {
      const authCmd = program.command('auth');
      const shortcutCmd = authCmd
        .command('shortcut')
        .description('Authenticate with Shortcut using API token')
        .option('--token <token>', 'Shortcut API token');

      shortcutCmd.parse(['node', 'shortcut', '--token', 'test_token_123']);

      const opts = shortcutCmd.opts();
      expect(opts.token).toBe('test_token_123');
    });

    it('should parse auth status command', () => {
      const authCmd = program.command('auth');
      const statusCmd = authCmd
        .command('status')
        .description('Show authentication status');

      statusCmd.parse(['node', 'status']);

      expect(statusCmd.name()).toBe('status');
    });

    it('should parse auth clear command with confirm flag', () => {
      const authCmd = program.command('auth');
      const clearCmd = authCmd
        .command('clear')
        .description('Clear all stored credentials')
        .option('--confirm', 'Skip confirmation prompt');

      clearCmd.parse(['node', 'clear', '--confirm']);

      const opts = clearCmd.opts();
      expect(opts.confirm).toBe(true);
    });

    it('should parse auth clear command without confirm flag', () => {
      const authCmd = program.command('auth');
      const clearCmd = authCmd
        .command('clear')
        .option('--confirm', 'Skip confirmation prompt');

      clearCmd.parse(['node', 'clear']);

      const opts = clearCmd.opts();
      expect(opts.confirm).toBeUndefined();
    });
  });

  describe('Command Validation', () => {
    it('should reject unknown commands', () => {
      program.command('status');

      expect(() => {
        program.parse(['node', 'test', 'unknown-command']);
      }).toThrow();
    });

    it('should handle invalid option values gracefully', () => {
      const statusCmd = program
        .command('status')
        .requiredOption('-r, --repository <owner/repo>', 'GitHub repository')
        .requiredOption('-i, --issue <number>', 'GitHub issue number');

      // Should not throw - commander accepts any string for number
      statusCmd.parse(['node', 'status', '-r', 'owner/repo', '-i', 'not-a-number']);

      const opts = statusCmd.opts();
      expect(opts.issue).toBe('not-a-number'); // Will be validated later in execution
    });
  });

  describe('Help Text', () => {
    it('should generate help text for main program', () => {
      program
        .name('beads-bridge')
        .description('CLI for Beads-GitHub Projects v2 integration')
        .version('0.1.0');

      const helpText = program.helpInformation();
      expect(helpText).toContain('beads-bridge');
      expect(helpText).toContain('CLI for Beads-GitHub Projects v2 integration');
    });

    it('should generate help text for status command', () => {
      const statusCmd = program
        .command('status')
        .description('Query aggregated status across GitHub Issue and Beads epics')
        .requiredOption('-r, --repository <owner/repo>', 'GitHub repository')
        .requiredOption('-i, --issue <number>', 'GitHub issue number')
        .option('-b, --blockers', 'include blocker details');

      const helpText = statusCmd.helpInformation();
      expect(helpText).toContain('status');
      expect(helpText).toContain('Query aggregated status');
      expect(helpText).toContain('--repository');
      expect(helpText).toContain('--issue');
      expect(helpText).toContain('--blockers');
    });

    it('should generate help text for auth commands', () => {
      const authCmd = program
        .command('auth')
        .description('Manage authentication credentials');

      const helpText = authCmd.helpInformation();
      expect(helpText).toContain('auth');
      expect(helpText).toContain('authentication');
    });
  });

  describe('Version Command', () => {
    it('should display version', () => {
      program.version('0.1.0');

      // Note: Commander's version() output goes to stdout
      // In tests, we can check that version is set
      expect(program.version()).toBe('0.1.0');
    });
  });
});
