import { describe, it, expect, mock, spyOn, beforeEach } from 'bun:test';
import { SyncService } from '../../src/services/sync-service.js';
import * as bdCli from '../../src/utils/bd-cli.js';
import type { ProjectManagementBackend } from '../../src/types/index.js';

describe('SyncService', () => {
  const mockBeads = [
    { id: 'bead-1', title: 'Bead 1', external_ref: 'github:owner/repo#1' },
    { id: 'bead-2', title: 'Bead 2' }, // No external ref
    { id: 'bead-3', title: 'Bead 3', external_ref: 'shortcut:123' }
  ];

  const mockBackend = {
    name: 'github',
    getIssue: mock(async () => ({ body: 'Original description', id: 'gh-1', url: 'http://github.com/owner/repo/issues/1' })),
    updateIssue: mock(async () => ({})),
    addComment: mock(async () => ({}))
  } as unknown as ProjectManagementBackend;

  const mockResolver = mock(async (type: string) => mockBackend);

  beforeEach(() => {
    spyOn(bdCli, 'execBdCommand').mockImplementation(async (args) => {
      // Check if asking for specific bead (bd show <id> --json)
      if (args[0] === 'show' && args[1] && !args[1].startsWith('-')) {
        const id = args[1];
        const found = mockBeads.find(b => b.id === id);
        return JSON.stringify(found ? [found] : []);
      }
      if (args[0] === 'dep') {
        return "graph TD; A-->B;";
      }
      return JSON.stringify(mockBeads);
    });

    (mockBackend.getIssue as any).mockClear();
    (mockBackend.updateIssue as any).mockClear();
    mockResolver.mockClear();
  });

  it('should get bead with external_ref', async () => {
    const service = new SyncService(mockResolver);
    const result = await service.getBead('bead-1');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('bead-1');
    expect(result?.external_ref).toBe('github:owner/repo#1');
  });

  it('should return null for bead without external_ref', async () => {
    const service = new SyncService(mockResolver);
    const result = await service.getBead('bead-2');

    expect(result).toBeNull();
  });

  it('should sync specific bead', async () => {
    const service = new SyncService(mockResolver);

    const report = await service.sync('bead-1');

    expect(report.synced).toBe(1);
    expect(report.total).toBe(1);
    expect(report.errors).toBe(0);

    // Verify diagram generation was triggered
    expect(bdCli.execBdCommand).toHaveBeenCalledWith(
      expect.arrayContaining(['dep', 'tree', 'bead-1', '--format', 'mermaid', '--reverse'])
    );

    // Verify backend interaction
    expect(mockResolver).toHaveBeenCalledWith('github');
    expect(mockBackend.getIssue).toHaveBeenCalled();
    expect(mockBackend.updateIssue).toHaveBeenCalled();
  });

  it('should skip bead without external_ref', async () => {
    const service = new SyncService(mockResolver);

    const report = await service.sync('bead-2');

    expect(report.synced).toBe(0);
    expect(report.skipped).toBe(1);
    expect(report.total).toBe(1);
    expect(report.details[0].status).toBe('skipped');
    expect(report.details[0].message).toContain('external_ref');
  });

  it('should handle dry-run mode', async () => {
    const service = new SyncService(mockResolver);

    const report = await service.sync('bead-1', { dryRun: true });

    expect(report.synced).toBe(1);
    // Should NOT call backend in dry-run mode
    expect(mockResolver).not.toHaveBeenCalled();
    expect(mockBackend.getIssue).not.toHaveBeenCalled();
    expect(mockBackend.updateIssue).not.toHaveBeenCalled();
  });
});
