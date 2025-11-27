/**
 * External reference parser utilities
 *
 * Parses external_ref strings to extract backend-specific information.
 */

export interface ParsedExternalRef {
  backend: 'github' | 'shortcut';
  owner?: string;
  repo?: string;
  issueNumber?: number;
  storyId?: number;
}

/**
 * Parse external_ref string to extract backend and identifiers
 *
 * Supported formats:
 * - GitHub: "github:owner/repo#123" or "https://github.com/owner/repo/issues/123"
 * - Shortcut: "shortcut:12345" or "https://app.shortcut.com/story/12345"
 *
 * @param externalRef - External reference string
 * @returns Parsed external reference
 * @throws Error if format is not recognized
 */
export function parseExternalRef(externalRef: string): ParsedExternalRef {
  // GitHub format: "github:owner/repo#123"
  const githubPrefixMatch = externalRef.match(/^github:([^/]+)\/([^#]+)#(\d+)$/);
  if (githubPrefixMatch) {
    return {
      backend: 'github',
      owner: githubPrefixMatch[1],
      repo: githubPrefixMatch[2],
      issueNumber: parseInt(githubPrefixMatch[3], 10)
    };
  }

  // GitHub URL format: "https://github.com/owner/repo/issues/123" or ".../pull/123"
  const githubUrlMatch = externalRef.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)$/);
  if (githubUrlMatch) {
    return {
      backend: 'github',
      owner: githubUrlMatch[1],
      repo: githubUrlMatch[2],
      issueNumber: parseInt(githubUrlMatch[4], 10)
    };
  }

  // Shortcut prefix format: "shortcut:12345"
  const shortcutPrefixMatch = externalRef.match(/^shortcut:(\d+)$/);
  if (shortcutPrefixMatch) {
    return {
      backend: 'shortcut',
      storyId: parseInt(shortcutPrefixMatch[1], 10)
    };
  }

  // Shortcut URL format: "https://app.shortcut.com/org/story/12345" or with slug "https://app.shortcut.com/org/story/12345/story-title"
  const shortcutUrlMatch = externalRef.match(/^https:\/\/app\.shortcut\.com\/[^/]+\/story\/(\d+)(?:\/[^/]+)?$/);
  if (shortcutUrlMatch) {
    return {
      backend: 'shortcut',
      storyId: parseInt(shortcutUrlMatch[1], 10)
    };
  }

  throw new Error(`Unknown external_ref format: ${externalRef}`);
}
