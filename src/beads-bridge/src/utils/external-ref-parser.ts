/**
 * External reference parser utilities
 *
 * Parses external_ref strings to extract backend-specific information.
 */

export interface ParsedExternalRef {
  /** Detected backend */
  backend: 'github' | 'shortcut';

  /** GitHub owner (e.g. "wellmaintained") */
  owner?: string;

  /** GitHub repo (e.g. "skills") */
  repo?: string;

  /** GitHub repository (e.g. "wellmaintained/skills") - convenience field */
  repository?: string;

  /** GitHub issue/PR number */
  issueNumber?: number;

  /** Shortcut story ID */
  storyId?: number;

  /** Full normalized external reference URL */
  externalRef: string;
}

/**
 * Parse an external reference (URL or shorthand) and determine backend/ID
 *
 * Supported formats:
 * - GitHub URL: https://github.com/owner/repo/issues/123
 * - GitHub PR: https://github.com/owner/repo/pull/123
 * - GitHub shorthand: github:owner/repo#123
 * - Shortcut ID: shortcut:12345
 * - Shortcut URL: https://app.shortcut.com/workspace/story/12345
 * - Shortcut URL with slug: https://app.shortcut.com/workspace/story/12345/slug
 *
 * @param ref - The reference string to parse (URL or shorthand)
 * @returns Parsed reference with backend, repository/story info, and normalized URL
 * @throws Error if format is invalid or backend cannot be determined
 */
export function parseExternalRef(ref: string): ParsedExternalRef {
  if (!ref || typeof ref !== 'string') {
    throw new Error('External reference must be a non-empty string');
  }

  // GitHub URL format (issues or pull)
  const githubUrlMatch = ref.match(
    /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/(issues|pull)\/(\d+)/i
  );
  if (githubUrlMatch) {
    const owner = githubUrlMatch[1];
    const repo = githubUrlMatch[2];
    const type = githubUrlMatch[3].toLowerCase();
    const issueNumber = parseInt(githubUrlMatch[4], 10);

    // Normalize URL
    const normalizedUrl = `https://github.com/${owner}/${repo}/${type}/${issueNumber}`;

    return {
      backend: 'github',
      owner,
      repo,
      repository: `${owner}/${repo}`,
      issueNumber,
      externalRef: normalizedUrl,
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
      owner,
      repo,
      repository,
      issueNumber,
      externalRef: `https://github.com/${owner}/${repo}/issues/${issueNumber}`,
    };
  }

  // Shortcut URL format (optional slug)
  const shortcutUrlMatch = ref.match(
    /^https?:\/\/app\.shortcut\.com\/[^\/]+\/story\/(\d+)(?:\/[^\/]+)?$/i
  );
  if (shortcutUrlMatch) {
    const storyId = parseInt(shortcutUrlMatch[1], 10);

    return {
      backend: 'shortcut',
      storyId,
      externalRef: ref, // Keep original URL
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
