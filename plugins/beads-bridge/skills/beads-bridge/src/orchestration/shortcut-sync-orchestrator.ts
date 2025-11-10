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

      // 6. Generate and post narrative comment
      const narrative = await this.generateNarrativeComment(mapping, options?.userNarrative);
      await this.backend.addComment(storyId.toString(), narrative);

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

  /**
   * Generate narrative comment from epic state
   *
   * @param mapping - The mapping containing epic information
   * @param userNarrative - Optional user-provided narrative
   * @returns Formatted comment with progress narrative
   */
  private async generateNarrativeComment(
    mapping: any,
    userNarrative?: string
  ): Promise<string> {
    // Generate narrative sections from epic state
    const sections = await this.generateNarrativeSections(mapping);

    // Build comment parts
    const parts: string[] = ['## Progress Update', '', sections.summary];

    // Add blockers section if any exist
    if (sections.blockers.length > 0) {
      parts.push('', '**Current Blockers:**');
      parts.push(...sections.blockers.map(b => `- ${b}`));
    }

    // Add what's next section
    if (sections.whatsNext.length > 0) {
      parts.push('', "**What's Next:**");
      parts.push(...sections.whatsNext.map(n => `- ${n}`));
    }

    // Append user narrative if provided
    if (userNarrative) {
      parts.push('', userNarrative);
    }

    return parts.join('\n');
  }

  /**
   * Generate narrative sections by analyzing epic state
   *
   * @param mapping - The mapping containing epic information
   * @returns Narrative sections with summary, blockers, and next steps
   */
  private async generateNarrativeSections(mapping: any): Promise<NarrativeSections> {
    let totalCompleted = 0;
    let totalInProgress = 0;
    let totalBlocked = 0;
    let totalOpen = 0;
    const allBlockers: Array<{ id: string; title: string; deps: string[] }> = [];

    // Analyze all epics in the mapping
    for (const epicInfo of mapping.beadsEpics) {
      const { subtasks } = await this.beads.getEpicWithSubtasks(
        epicInfo.repository,
        epicInfo.epicId
      );

      // Count by status
      for (const task of subtasks) {
        if (task.status === 'closed') {
          totalCompleted++;
        } else if (task.status === 'in_progress') {
          totalInProgress++;
        } else if (task.status === 'open') {
          // Check if task has blocking dependencies
          if (task.dependencies && task.dependencies.length > 0) {
            totalBlocked++;
            allBlockers.push({
              id: task.id,
              title: task.title,
              deps: task.dependencies.map((d: any) => d.id)
            });
          } else {
            totalOpen++;
          }
        }
      }
    }

    // Generate summary
    const taskWord = totalCompleted === 1 ? 'task' : 'tasks';
    const summary = `Completed ${totalCompleted} ${taskWord}, ${totalInProgress} in progress, ${totalBlocked} blocked, ${totalOpen} open.`;

    // Generate blockers list
    const blockers = allBlockers.map(b =>
      `${b.id}: ${b.title} (blocked by: ${b.deps.join(', ')})`
    );

    // Generate what's next list
    const whatsNext: string[] = [];
    if (totalInProgress > 0) {
      const taskWord = totalInProgress === 1 ? 'task' : 'tasks';
      whatsNext.push(`Continue ${totalInProgress} in-progress ${taskWord}`);
    }
    if (totalOpen > 0) {
      const taskWord = totalOpen === 1 ? 'task' : 'tasks';
      whatsNext.push(`Start ${totalOpen} open ${taskWord}`);
    }

    return {
      summary,
      blockers,
      whatsNext
    };
  }
}
