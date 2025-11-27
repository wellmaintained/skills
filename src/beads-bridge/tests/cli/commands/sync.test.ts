import { describe, it, expect } from 'bun:test';
import { createSyncCommand } from '../../../src/cli/commands/sync.js';
import { Command } from 'commander';

describe('SyncCommand', () => {
  it('should create a command named "sync"', () => {
    const cmd = createSyncCommand();
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe('sync');
  });

  it('should have required bead-id argument', () => {
    const cmd = createSyncCommand();
    // Commander stores arguments in private fields, but we can check the help output or registered args
    // inspecting internal structure of commander object:
    const args = (cmd as any)._args;
    expect(args.length).toBe(1);
    expect(args[0].name()).toBe('bead-id');
    expect(args[0].required).toBe(true);
  });

  it('should have dry-run option', () => {
    const cmd = createSyncCommand();
    const options = (cmd as any).options;
    const dryRun = options.find((o: any) => o.long === '--dry-run');
    expect(dryRun).toBeDefined();
  });
});
