// tests/cli/auth-commands.test.ts
import { describe, it, expect } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

describe('Auth CLI Commands', () => {
  describe('help output', () => {
    it('should show all auth subcommands', async () => {
      const result = await execFileAsync('node', ['dist/cli.js', 'auth', '--help']).catch(e => e);
      const output = result.stdout || result.message || '';

      // Check for command names (not "auth github" but just "github")
      expect(output).toContain('github');
      expect(output).toContain('shortcut');
      expect(output).toContain('status');
      expect(output).toContain('clear');
      expect(output).toContain('Manage authentication credentials');
    });
  });

  describe('auth status', () => {
    it('should execute without crashing', async () => {
      // Test that auth status runs successfully (exit code 0)
      // Don't test credential content since it depends on local state
      const { stdout } = await execFileAsync('node', ['dist/cli.js', 'auth', 'status']);

      expect(stdout).toContain('Authentication Status');
      // Should show either authenticated or not authenticated for each service
      expect(stdout).toMatch(/GitHub:.*authenticated/i);
      expect(stdout).toMatch(/Shortcut:.*authenticated/i);
    });
  });

  describe('auth clear', () => {
    it('should execute with --confirm flag', async () => {
      // Test that command structure works
      // Uses --confirm to avoid interactive prompt
      const { stdout } = await execFileAsync('node', ['dist/cli.js', 'auth', 'clear', '--confirm']);

      expect(stdout).toContain('credentials cleared');
    });

    it('should have proper command structure', async () => {
      // Verify the command is properly registered
      const result = await execFileAsync('node', ['dist/cli.js', 'auth', 'clear', '--help']).catch(e => e);
      const output = result.stdout || result.message || '';

      expect(output).toContain('Clear all stored credentials');
      expect(output).toContain('--confirm');
    });
  });

  describe('command structure verification', () => {
    it('should have auth command with subcommands', async () => {
      const result = await execFileAsync('node', ['dist/cli.js', 'auth', '--help']).catch(e => e);
      const output = result.stdout || result.message || '';

      // Verify all subcommands are present
      expect(output).toContain('github');
      expect(output).toContain('shortcut');
      expect(output).toContain('status');
      expect(output).toContain('clear');
    });

    it('should provide proper help text for auth github', async () => {
      const result = await execFileAsync('node', ['dist/cli.js', 'auth', 'github', '--help']).catch(e => e);
      const output = result.stdout || result.message || '';

      expect(output).toContain('Authenticate with GitHub');
      expect(output).toContain('--client-id');
      expect(output).toContain('--scopes');
    });

    it('should provide proper help text for auth shortcut', async () => {
      const result = await execFileAsync('node', ['dist/cli.js', 'auth', 'shortcut', '--help']).catch(e => e);
      const output = result.stdout || result.message || '';

      expect(output).toContain('Authenticate with Shortcut');
      expect(output).toContain('--token');
    });

    it('should provide proper help text for auth status', async () => {
      const result = await execFileAsync('node', ['dist/cli.js', 'auth', 'status', '--help']).catch(e => e);
      const output = result.stdout || result.message || '';

      expect(output).toContain('Show authentication status');
    });

    it('should provide proper help text for auth clear', async () => {
      const result = await execFileAsync('node', ['dist/cli.js', 'auth', 'clear', '--help']).catch(e => e);
      const output = result.stdout || result.message || '';

      expect(output).toContain('Clear all stored credentials');
      expect(output).toContain('--confirm');
    });

    it('should have main CLI with auth command', async () => {
      const result = await execFileAsync('node', ['dist/cli.js', '--help']).catch(e => e);
      const output = result.stdout || result.message || '';

      expect(output).toContain('beads-bridge');
      expect(output).toContain('auth');
    });
  });
});
