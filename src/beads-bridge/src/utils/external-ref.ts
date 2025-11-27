/**
 * External Reference Parsing Utility
 *
 * Parses external references (URLs, shorthand formats) to determine backend and extract IDs.
 */

export interface ParsedExternalRef {
  /** Detected backend: 'github' or 'shortcut' */
  backend: 'github' | 'shortcut';

  /** For GitHub: repository in format 'owner/repo' */
  repository?: string;

  /** For GitHub: issue number */
  issueNumber?: number;

  /** For Shortcut: story ID */
  storyId?: number;

  /** Full external_ref URL for storage */
  externalRef: string;
}

/**
 * Parse an external reference (URL or shorthand) and determine backend/ID
 *
 * Supported formats:
 * - GitHub URL: https://github.com/owner/repo/issues/123
 * - GitHub shorthand: github:owner/repo#123
 * - Shortcut ID: shortcut:12345
 * - Shortcut URL: https://app.shortcut.com/workspace/story/12345
 *
 * @param ref - The reference string to parse (URL or shorthand)
 * @returns Parsed reference with backend, repository/story info, and normalized URL
 * @throws Error if format is invalid or backend cannot be determined
 */
export function parseExternalRef(ref: string): ParsedExternalRef {
  if (!ref || typeof ref !== 'string') {
    throw new Error('External reference must be a non-empty string');
  }

  // GitHub URL format
  const githubUrlMatch = ref.match(
    /https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/i
  );
  if (githubUrlMatch) {
    const owner = githubUrlMatch[1];
    const repo = githubUrlMatch[2];
    const issueNumber = parseInt(githubUrlMatch[3], 10);

    return {
      backend: 'github',
      repository: `${owner}/${repo}`,
      issueNumber,
      externalRef: `https://github.com/${owner}/${repo}/issues/${issueNumber}`,
    };
  }

  // GitHub shorthand format: github:owner/repo#123
  const githubShorthandMatch = ref.match(/^github:([^#]+)#(\d+)$/i);
  if (githubShorthandMatch) {
    const repository = githubShorthandMatch[1];
    const issueNumber = parseInt(githubShorthandMatch[2], 10);
    const [owner, repo] = repository.split('/');

    return {
      backend: 'github',
      repository,
      issueNumber,
      externalRef: `https://github.com/${owner}/${repo}/issues/${issueNumber}`,
    };
  }

  // Shortcut URL format
  const shortcutUrlMatch = ref.match(
    /https?:\/\/app\.shortcut\.com\/[^\/]+\/story\/(\d+)/i
  );
  if (shortcutUrlMatch) {
    const storyId = parseInt(shortcutUrlMatch[1], 10);

    return {
      backend: 'shortcut',
      storyId,
      externalRef: ref,
    };
  }

  // Shortcut shorthand format: shortcut:12345
  const shortcutShorthandMatch = ref.match(/^shortcut:(\d+)$/i);
  if (shortcutShorthandMatch) {
    const storyId = parseInt(shortcutShorthandMatch[1], 10);

    return {
      backend: 'shortcut',
      storyId,
      externalRef: ref,
    };
  }

  // No match - throw error with helpful message
  throw new Error(
    `Invalid external reference format: ${ref}. ` +
    'Supported formats: ' +
    'https://github.com/owner/repo/issues/123, ' +
    'github:owner/repo#123, ' +
    'https://app.shortcut.com/workspace/story/12345, ' +
    'shortcut:12345'
  );
}

/**
 * Detect backend from an external reference without full parsing
 * Useful for quick backend detection to determine auth requirements
 *
 * @param ref - The reference string to check
 * @returns 'github' or 'shortcut', or undefined if cannot be detected
 */
export function detectBackendFromRef(ref: string): 'github' | 'shortcut' | undefined {
  if (!ref) return undefined;

  const lowerRef = ref.toLowerCase();

  // GitHub patterns
  if (lowerRef.includes('github.com') || lowerRef.startsWith('github:')) {
    return 'github';
  }

  // Shortcut patterns
  if (lowerRef.includes('shortcut.com') || lowerRef.startsWith('shortcut:')) {
    return 'shortcut';
  }

  return undefined;
}

/**
 * Validate that a reference format is supported (without full parsing)
 *
 * @param ref - The reference string to validate
 * @returns true if format appears valid, false otherwise
 */
export function isValidExternalRefFormat(ref: string): boolean {
  try {
    parseExternalRef(ref);
    return true;
  } catch {
    return false;
  }
}
