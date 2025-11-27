import { describe, expect, it, mock } from 'bun:test';
import { mkdtemp, mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { checkLegacyMappingDir } from '../../src/utils/legacy-mapping-warning.js';

describe('checkLegacyMappingDir', () => {
  it('warns when mappings directory exists', async () => {
    const baseDir = await mkdtemp(join(tmpdir(), 'legacy-mappings-'));
    await mkdir(join(baseDir, 'mappings'), { recursive: true });

    const warn = mock();
    const result = await checkLegacyMappingDir(baseDir, warn as any);

    expect(result).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('mappings'));

    await rm(baseDir, { recursive: true, force: true });
  });

  it('returns false when directory is missing', async () => {
    const baseDir = await mkdtemp(join(tmpdir(), 'legacy-mappings-'));

    const warn = mock();
    const result = await checkLegacyMappingDir(baseDir, warn as any);

    expect(result).toBe(false);
    expect(warn).not.toHaveBeenCalled();

    await rm(baseDir, { recursive: true, force: true });
  });
});
