/**
 * Repository auto-detection utilities
 * 
 * Detects beads repository by looking for .beads/ directory
 * in current working directory or parent directories.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export interface DetectedRepository {
  /** Absolute path to the repository root */
  path: string;
  /** Whether the path was auto-detected (vs explicit config) */
  detected: boolean;
}

/**
 * Detect a beads repository starting from the given directory.
 * Walks up the directory tree looking for .beads/ directory.
 * 
 * @param startDir - Directory to start searching from (defaults to cwd)
 * @returns DetectedRepository if found, null otherwise
 */
export function detectRepository(startDir?: string): DetectedRepository | null {
  let currentDir = resolve(startDir || process.cwd());
  const root = dirname(currentDir) === currentDir ? currentDir : '/';
  
  while (currentDir !== root) {
    const beadsDir = join(currentDir, '.beads');
    if (existsSync(beadsDir)) {
      return {
        path: currentDir,
        detected: true,
      };
    }
    
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break; // Reached filesystem root
    }
    currentDir = parentDir;
  }
  
  // Check root directory too
  const beadsDir = join(currentDir, '.beads');
  if (existsSync(beadsDir)) {
    return {
      path: currentDir,
      detected: true,
    };
  }
  
  return null;
}

/**
 * Extract the issue prefix from existing issues in the repository.
 * Reads the first issue from .beads/issues.jsonl to determine the prefix.
 * 
 * @param repoPath - Path to the repository root
 * @returns The prefix (e.g., "wms" from "wms-123") or undefined
 */
export function extractPrefixFromIssues(repoPath: string): string | undefined {
  const issuesPath = join(repoPath, '.beads', 'issues.jsonl');
  
  if (!existsSync(issuesPath)) {
    return undefined;
  }
  
  try {
    const content = readFileSync(issuesPath, 'utf-8');
    const firstLine = content.split('\n').find(line => line.trim());
    
    if (!firstLine) {
      return undefined;
    }
    
    const issue = JSON.parse(firstLine);
    if (issue.id && typeof issue.id === 'string') {
      const match = issue.id.match(/^([a-z]+)-/i);
      return match ? match[1].toLowerCase() : undefined;
    }
  } catch {
    return undefined;
  }
  
  return undefined;
}