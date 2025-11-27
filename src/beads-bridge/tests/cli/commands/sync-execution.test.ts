import { describe, it, expect, mock, spyOn, beforeEach, afterEach } from 'bun:test';
import { createSyncCommand } from '../../../src/cli/commands/sync.js';
import { MissingExternalRefError } from '../../../src/types/errors.js';

// Mock SyncService
const mockSync = mock(() => Promise.resolve({ synced: 1, errors: 0, skipped: 0, details: [] }));
mock.module('../../../src/services/sync-service.js', () => {
  return {
    SyncService: class {
      constructor() {}
      sync = mockSync;
    }
  };
});

describe('SyncCommand Execution', () => {
  let originalExit: any;
  let exitCode: number | undefined;
  let consoleErrorSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    originalExit = process.exit;
    exitCode = undefined;
    process.exit = ((code?: number) => {
      exitCode = code;
      // Don't actually exit
    }) as any;

    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    mockSync.mockClear();
  });

  afterEach(() => {
    process.exit = originalExit;
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('should display helpful error when MissingExternalRefError is thrown', async () => {
    const error = new MissingExternalRefError('bead-missing-ref');
    mockSync.mockRejectedValue(error);

    const cmd = createSyncCommand();
    // Simulate parsing arguments to trigger action
    await cmd.parseAsync(['node', 'test', 'bead-missing-ref']);

    expect(mockSync).toHaveBeenCalledWith('bead-missing-ref', expect.any(Object));
    expect(exitCode).toBe(1);
    
    // Verify console output contains help text (checking partial match due to multiple calls)
    const calls = consoleErrorSpy.mock.calls.flat().join('\n');
    expect(calls).toContain("Bead 'bead-missing-ref' has no external_ref set");
    expect(calls).toContain('To set an external_ref:');
    expect(calls).toContain('Supported formats:');
  });
});
