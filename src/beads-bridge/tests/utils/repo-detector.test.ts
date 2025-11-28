import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectRepository, extractPrefixFromIssues } from '../../src/utils/repo-detector.js';

describe('repo-detector', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `repo-detector-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('detectRepository', () => {
    it('should detect repository when .beads/ exists in cwd', () => {
      mkdirSync(join(tempDir, '.beads'));
      
      const result = detectRepository(tempDir);
      
      expect(result).toEqual({
        path: tempDir,
        detected: true,
      });
    });

    it('should return null when .beads/ does not exist', () => {
      const result = detectRepository(tempDir);
      
      expect(result).toBeNull();
    });

    it('should detect repository in parent directory', () => {
      const subDir = join(tempDir, 'src', 'components');
      mkdirSync(subDir, { recursive: true });
      mkdirSync(join(tempDir, '.beads'));
      
      const result = detectRepository(subDir);
      
      expect(result).toEqual({
        path: tempDir,
        detected: true,
      });
    });

    it('should stop at filesystem root without finding .beads/', () => {
      const result = detectRepository('/tmp/definitely-not-a-beads-repo');
      
      expect(result).toBeNull();
    });
  });

  describe('extractPrefixFromIssues', () => {
    it('should extract prefix from issues.jsonl', () => {
      mkdirSync(join(tempDir, '.beads'));
      writeFileSync(
        join(tempDir, '.beads', 'issues.jsonl'),
        '{"id":"wms-123","title":"Test"}\n{"id":"wms-456","title":"Another"}\n'
      );
      
      const prefix = extractPrefixFromIssues(tempDir);
      
      expect(prefix).toBe('wms');
    });

    it('should return undefined when issues.jsonl is empty', () => {
      mkdirSync(join(tempDir, '.beads'));
      writeFileSync(join(tempDir, '.beads', 'issues.jsonl'), '');
      
      const prefix = extractPrefixFromIssues(tempDir);
      
      expect(prefix).toBeUndefined();
    });

    it('should return undefined when issues.jsonl does not exist', () => {
      mkdirSync(join(tempDir, '.beads'));
      
      const prefix = extractPrefixFromIssues(tempDir);
      
      expect(prefix).toBeUndefined();
    });
  });
});