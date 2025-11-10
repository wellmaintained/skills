/**
 * Utility functions for manipulating markdown sections marked with HTML comments
 *
 * These functions allow finding, updating, and appending content within
 * markdown documents using HTML comment markers like <!-- START --> and <!-- END -->
 */

/**
 * Finds and returns the content between start and end markers
 *
 * @param markdown - The markdown content to search
 * @param startMarker - The start marker (e.g., "<!-- START_SECTION -->")
 * @param endMarker - The end marker (e.g., "<!-- END_SECTION -->")
 * @returns The content between markers (excluding the markers themselves),
 *          or null if either marker is not found
 */
export function findSection(
  markdown: string,
  startMarker: string,
  endMarker: string
): string | null {
  const startIndex = markdown.indexOf(startMarker);
  if (startIndex === -1) {
    return null;
  }

  const contentStart = startIndex + startMarker.length;
  const endIndex = markdown.indexOf(endMarker, contentStart);
  if (endIndex === -1) {
    return null;
  }

  // Extract content between markers
  let content = markdown.substring(contentStart, endIndex);

  // Remove leading newline if present
  if (content.startsWith('\n')) {
    content = content.substring(1);
  }

  return content;
}

/**
 * Updates the content between start and end markers
 *
 * @param markdown - The markdown content to update
 * @param startMarker - The start marker (e.g., "<!-- START_SECTION -->")
 * @param endMarker - The end marker (e.g., "<!-- END_SECTION -->")
 * @param newContent - The new content to insert between markers
 * @returns The updated markdown content
 * @throws Error if the section is not found
 */
export function updateSection(
  markdown: string,
  startMarker: string,
  endMarker: string,
  newContent: string
): string {
  const startIndex = markdown.indexOf(startMarker);
  if (startIndex === -1) {
    throw new Error('Section not found: start marker not found');
  }

  const contentStart = startIndex + startMarker.length;
  const endIndex = markdown.indexOf(endMarker, contentStart);
  if (endIndex === -1) {
    throw new Error('Section not found: end marker not found');
  }

  // Build the updated content
  const before = markdown.substring(0, contentStart);
  const after = markdown.substring(endIndex);

  // Add newline before content if it's not empty
  const formattedContent = newContent ? '\n' + newContent : '\n';

  return before + formattedContent + after;
}

/**
 * Appends a new section to the end of the markdown document
 *
 * @param markdown - The markdown content to append to
 * @param startMarker - The start marker (e.g., "<!-- START_SECTION -->")
 * @param endMarker - The end marker (e.g., "<!-- END_SECTION -->")
 * @param content - The content to include in the new section
 * @returns The markdown with the new section appended
 */
export function appendSection(
  markdown: string,
  startMarker: string,
  endMarker: string,
  content: string
): string {
  // Ensure markdown ends with newline (or is empty)
  let result = markdown;
  if (result.length > 0 && !result.endsWith('\n')) {
    result += '\n';
  }

  // Add blank line before section (unless document is empty)
  if (result.length > 0) {
    result += '\n';
  }

  // Add the section
  result += startMarker + '\n';
  result += content;
  result += endMarker + '\n';

  return result;
}
