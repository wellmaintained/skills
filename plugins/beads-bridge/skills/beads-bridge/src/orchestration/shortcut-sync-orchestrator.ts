/**
 * Shortcut Sync Orchestrator
 *
 * Orchestrates the workflow for syncing Beads epic progress to Shortcut stories.
 *
 * Workflow:
 * 1. Fetch mapping for story → beads epics
 * 2. Calculate progress across all beads epics
 * 3. Generate progress narrative (auto + user)
 * 4. Generate/update Mermaid diagram
 * 5. Post comment with narrative + diagram
 * 6. Update mapping with sync result
 */

import type { BeadsClient } from '../clients/beads-client.js';
import type { ShortcutBackend } from '../backends/shortcut.js';
import type { MermaidGenerator } from '../diagrams/mermaid-generator.js';
import type { MappingStore } from '../store/mapping-store.js';
import type { SyncOptions, SyncResult, NarrativeSections } from '../types/sync.js';
import { findSection, updateSection, appendSection } from '../utils/section-updater.js';
import { NotFoundError } from '../types/errors.js';

const YAK_MAP_START = '<!-- YAK_MAP_START -->';
const YAK_MAP_END = '<!-- YAK_MAP_END -->';

/**
 * Orchestrates the Shortcut sync workflow
 */
export class ShortcutSyncOrchestrator {
  constructor(
    private readonly beads: BeadsClient,
    private readonly backend: ShortcutBackend,
    private readonly mermaid: MermaidGenerator,
    private readonly mappings: MappingStore
  ) {}

  /**
   * Sync progress from Beads to a Shortcut story
   *
   * @param storyId - The Shortcut story ID
   * @param options - Optional sync options (e.g., user narrative)
   * @returns Sync result with success status and URLs
   */
  async syncStory(storyId: number, options?: SyncOptions): Promise<SyncResult> {
    try {
      const syncedAt = new Date().toISOString();

      // 1. Find mapping for this story
      const mapping = await this.mappings.findByGitHubIssue('shortcut', storyId);
      if (!mapping) {
        throw new NotFoundError(`Mapping not found for story ${storyId}`);
      }

      // 2. Get the story from Shortcut
      const story = await this.backend.getIssue(storyId.toString());

      // 3. Generate Mermaid diagram from the first (primary) epic
      const primaryEpic = mapping.beadsEpics[0];
      const diagram = await this.mermaid.generate(primaryEpic.repository, primaryEpic.epicId);

      // 4. Update Yak Map section in story description
      const updatedDescription = await this.updateYakMapSection(
        story.body,
        diagram,
        syncedAt
      );

      // 5. Update the story with the new description
      await this.backend.updateIssue(storyId.toString(), {
        body: updatedDescription
      });

      // 6. Post narrative comment (stub for Task 6)
      await this.backend.addComment(storyId.toString(), 'Progress update placeholder');

      return {
        success: true,
        storyId,
        storyUrl: story.url,
        syncedAt
      };
    } catch (error: any) {
      // Error handling - return failure result
      return {
        success: false,
        storyId,
        error: error.message || 'Unknown error during sync',
        syncedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Update or append the Yak Map section in the description
   *
   * @param currentDescription - Current story description
   * @param diagram - Mermaid diagram content
   * @param timestamp - Timestamp for "Last updated"
   * @returns Updated description with Yak Map section
   */
  private async updateYakMapSection(
    currentDescription: string,
    diagram: string,
    timestamp: string
  ): Promise<string> {
    const yakMapContent = this.formatYakMapSection(diagram, timestamp);

    // Check if Yak Map section already exists
    const existingSection = findSection(currentDescription, YAK_MAP_START, YAK_MAP_END);

    if (existingSection !== null) {
      // Update existing section
      return updateSection(currentDescription, YAK_MAP_START, YAK_MAP_END, yakMapContent);
    } else {
      // Append new section
      return appendSection(currentDescription, YAK_MAP_START, YAK_MAP_END, yakMapContent);
    }
  }

  /**
   * Format the Yak Map section content
   *
   * @param diagram - Mermaid diagram content
   * @param timestamp - Timestamp for "Last updated"
   * @returns Formatted Yak Map section (without markers)
   */
  private formatYakMapSection(diagram: string, timestamp: string): string {
    return `---

## Yak Map

\`\`\`mermaid
${diagram}
\`\`\`

*Last updated: ${timestamp}*
`;
  }
}
