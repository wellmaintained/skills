/**
 * Diagram Placer
 *
 * Manages placement of Mermaid diagrams in GitHub Issues using a hybrid approach:
 * 1. Updates a dedicated section in the issue description (always current)
 * 2. Creates snapshot comments for historical timeline
 */

import type { ProjectManagementBackend } from '../types/backend.js';
import type { MermaidGenerator } from './mermaid-generator.js';
import type { ExternalRefResolver } from '../utils/external-ref-resolver.js';
import type {
  PlacementOptions,
  PlacementResult,
  DiagramSnapshot,
  UpdateTrigger
} from '../types/placement.js';
import { DIAGRAM_MARKERS, SNAPSHOT_MARKERS } from '../types/placement.js';
import { NotFoundError } from '../types/errors.js';

/**
 * DiagramPlacer manages diagram placement in GitHub Issues
 */
export class DiagramPlacer {
  constructor(
    private readonly backend: ProjectManagementBackend,
    private readonly generator: MermaidGenerator,
    private readonly resolver: ExternalRefResolver
  ) {}

  /**
   * Update diagram in GitHub issue
   */
  async updateDiagram(
    githubRepository: string,
    githubIssueNumber: number,
    options: PlacementOptions
  ): Promise<PlacementResult> {
    const {
      updateDescription = true,
      createSnapshot = true,
      trigger,
      message
    } = options;

    try {
      // Get the GitHub issue
      const issue = await this.backend.getIssue(`${githubRepository}#${githubIssueNumber}`);

      // Resolve external reference to discover Beads epics
      const resolution = await this.resolver.resolve({
        repository: githubRepository,
        issueNumber: githubIssueNumber
      });

      if (resolution.epics.length === 0) {
        throw new NotFoundError(`No external_ref found for ${githubRepository}#${githubIssueNumber}`);
      }

      // Generate diagram from all repository epics
      const diagram = await this.generateCombinedDiagram(resolution.epics);
      const mermaidMarkdown = this.generator.render(diagram.mermaid);

      let descriptionUpdated = false;
      let snapshot: DiagramSnapshot | undefined;

      // Update issue description
      if (updateDescription) {
        const updatedBody = this.updateDiagramSection(
          issue.body || '',
          mermaidMarkdown,
          trigger
        );

        await this.backend.updateIssue(issue.id, { body: updatedBody });
        descriptionUpdated = true;
      }

      // Create snapshot comment
      if (createSnapshot) {
        const snapshotComment = this.formatSnapshotComment(
          mermaidMarkdown,
          diagram,
          trigger,
          message
        );

        const comment = await this.backend.addComment(issue.id, snapshotComment);

        snapshot = {
          timestamp: new Date().toISOString(),
          trigger,
          commentId: comment.id,
          commentUrl: comment.url ?? '',
          nodeCount: diagram.nodeCount,
          truncated: diagram.truncated
        };

        // TODO: Pin comment if requested (requires additional backend support)
      }

      return {
        descriptionUpdated,
        snapshot,
        issueUrl: issue.url
      };
    } catch (error) {
      return {
        descriptionUpdated: false,
        issueUrl: `https://github.com/${githubRepository}/issues/${githubIssueNumber}`,
        error: (error as Error).message
      };
    }
  }

  /**
   * Generate combined diagram from multiple epics
   */
  private async generateCombinedDiagram(
    epics: Array<{ epicId: string }>
  ): Promise<{ mermaid: string; nodeCount: number; truncated: boolean }> {
    // For single epic, just generate directly
    if (epics.length === 1) {
      const { mermaid, nodeCount } = await this.generator.generateFromTree(
        epics[0].epicId
      );
      return { mermaid, nodeCount, truncated: false };
    }

    // For multiple epics, concatenate diagrams with section headers
    const diagrams: string[] = [];
    let totalNodes = 0;

    for (const epic of epics) {
      const { mermaid, nodeCount } = await this.generator.generateFromTree(
        epic.epicId
      );
      // Use epic ID as header since repository is no longer meaningful (single-repo mode)
      diagrams.push(`### ${epic.epicId}\n\n${mermaid}`);
      totalNodes += nodeCount;
    }

    const combinedMermaid = diagrams.join('\n\n');
    const truncated = totalNodes > 50;

    return {
      mermaid: combinedMermaid,
      nodeCount: totalNodes,
      truncated
    };
  }

  /**
   * Update or insert diagram section in issue description
   */
  private updateDiagramSection(
    currentBody: string,
    mermaidMarkdown: string,
    trigger: UpdateTrigger
  ): string {
    const timestamp = new Date().toISOString();
    const section = this.formatDiagramSection(mermaidMarkdown, timestamp, trigger);

    // Check if diagram section already exists
    const startMarker = DIAGRAM_MARKERS.START;
    const endMarker = DIAGRAM_MARKERS.END;

    if (currentBody.includes(startMarker) && currentBody.includes(endMarker)) {
      // Replace existing section
      const before = currentBody.substring(0, currentBody.indexOf(startMarker));
      const after = currentBody.substring(currentBody.indexOf(endMarker) + endMarker.length);

      return before + section + after;
    } else {
      // Append new section
      const separator = currentBody.trim() ? '\n\n' : '';
      return currentBody + separator + section;
    }
  }

  /**
   * Format diagram section for issue description
   */
  private formatDiagramSection(
    mermaidMarkdown: string,
    timestamp: string,
    trigger: UpdateTrigger
  ): string {
    const lines: string[] = [
      DIAGRAM_MARKERS.START,
      '',
      DIAGRAM_MARKERS.SECTION_HEADER,
      '',
      mermaidMarkdown,
      '',
      `${DIAGRAM_MARKERS.LAST_UPDATED_PREFIX} ${timestamp} (${trigger})*`,
      '',
      DIAGRAM_MARKERS.END
    ];

    return lines.join('\n');
  }

  /**
   * Format snapshot comment
   */
  private formatSnapshotComment(
    mermaidMarkdown: string,
    diagram: { nodeCount: number; truncated: boolean },
    trigger: UpdateTrigger,
    message?: string
  ): string {
    const lines: string[] = [
      SNAPSHOT_MARKERS.HEADER,
      ''
    ];

    if (message) {
      lines.push(message, '');
    }

    lines.push(
      `${SNAPSHOT_MARKERS.TRIGGER_PREFIX} ${trigger}`,
      `${SNAPSHOT_MARKERS.TIMESTAMP_PREFIX} ${new Date().toISOString()}`,
      `${SNAPSHOT_MARKERS.NODE_COUNT_PREFIX} ${diagram.nodeCount}`
    );

    if (diagram.truncated) {
      lines.push(SNAPSHOT_MARKERS.TRUNCATED_NOTICE);
    }

    lines.push('', mermaidMarkdown);

    return lines.join('\n');
  }

  /**
   * Parse existing diagram section from issue description
   */
  parseDiagramSection(issueBody: string): { exists: boolean; lastUpdated?: string; trigger?: UpdateTrigger } {
    if (!issueBody.includes(DIAGRAM_MARKERS.START)) {
      return { exists: false };
    }

    const startIdx = issueBody.indexOf(DIAGRAM_MARKERS.START);
    const endIdx = issueBody.indexOf(DIAGRAM_MARKERS.END);

    if (endIdx === -1) {
      return { exists: false };
    }

    const section = issueBody.substring(startIdx, endIdx + DIAGRAM_MARKERS.END.length);

    // Extract timestamp
    const timestampMatch = section.match(/\*Last updated:\s*([^\s]+)/);
    const lastUpdated = timestampMatch ? timestampMatch[1] : undefined;

    // Extract trigger
    const triggerMatch = section.match(/\(([^)]+)\)\*/);
    const trigger = triggerMatch ? triggerMatch[1] as UpdateTrigger : undefined;

    return {
      exists: true,
      lastUpdated,
      trigger
    };
  }
}
