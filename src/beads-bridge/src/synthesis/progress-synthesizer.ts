/**
 * Progress Synthesizer
 *
 * Aggregates progress across multiple Beads repositories and generates
 * formatted progress updates for GitHub Issues.
 */

import type { BeadsClient } from '../clients/beads-client.js';
import type { ProjectManagementBackend } from '../types/backend.js';
import type { MermaidGenerator } from '../diagrams/mermaid-generator.js';
import type { ExternalRefResolver } from '../utils/external-ref-resolver.js';
import type {
  ProgressMetrics,
  EpicProgress,
  AggregatedProgress,
  ProgressCommentOptions,
  ProgressUpdateResult
} from '../types/progress.js';
import type { BeadsIssue } from '../types/beads.js';
import { NotFoundError } from '../types/errors.js';

/**
 * ProgressSynthesizer aggregates progress across repositories
 */
export class ProgressSynthesizer {
  constructor(
    private readonly beads: BeadsClient,
    private readonly backend: ProjectManagementBackend,
    private readonly resolver: ExternalRefResolver,
    private readonly mermaid?: MermaidGenerator
  ) {}

  /**
   * Calculate progress metrics from a list of issues
   */
  calculateMetrics(issues: BeadsIssue[]): ProgressMetrics {
    const total = issues.length;
    const completed = issues.filter(i => i.status === 'closed').length;
    const inProgress = issues.filter(i => i.status === 'in_progress').length;
    const blocked = issues.filter(i => i.status === 'blocked').length;
    const open = issues.filter(i => i.status === 'open').length;

    const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      inProgress,
      blocked,
      open,
      percentComplete
    };
  }

  /**
   * Get progress for a single repository epic
   */
  async getEpicProgress(repository: string, epicId: string): Promise<EpicProgress> {
    const { epic, subtasks } = await this.beads.getEpicWithSubtasks(epicId);

    const metrics = this.calculateMetrics(subtasks);

    // Find blockers - issues with unresolved blocking dependencies
    const blockers = subtasks.filter(issue => {
      const blockingDeps = (issue.dependencies || []).filter(
        d => d.dependency_type === 'blocks' && d.status !== 'closed'
      );
      return blockingDeps.length > 0;
    });

    return {
      repository,
      epicId,
      title: epic.title,
      subtasks,
      metrics,
      blockers
    };
  }

  /**
   * Get aggregated progress across all repository epics for a GitHub issue
   */
  async getAggregatedProgress(githubRepository: string, githubIssueNumber: number): Promise<AggregatedProgress> {
    const resolution = await this.resolver.resolve({
      repository: githubRepository,
      issueNumber: githubIssueNumber
    });

    if (resolution.epics.length === 0) {
      throw new NotFoundError(`No external_ref found for ${githubRepository}#${githubIssueNumber}`);
    }

    // Get progress for each epic
    const epics: EpicProgress[] = [];
    for (const repoEpic of resolution.epics) {
      try {
        // repository parameter is no longer used (single-repo mode)
        const progress = await this.getEpicProgress('', repoEpic.epicId);
        epics.push(progress);
      } catch (error) {
        console.error(`Failed to get progress for ${repoEpic.epicId}:`, error);
        continue;
      }
    }

    // Aggregate metrics
    const allSubtasks = epics.flatMap(e => e.subtasks);
    const totalMetrics = this.calculateMetrics(allSubtasks);

    // Collect all blockers
    const allBlockers = epics.flatMap(e => e.blockers);
    const hasBlockers = allBlockers.length > 0;

    return {
      epics,
      totalMetrics,
      allBlockers,
      hasBlockers
    };
  }

  /**
   * Generate a progress comment for GitHub
   */
  generateProgressComment(progress: AggregatedProgress, options: ProgressCommentOptions = {}): string {
    const {
      includeRepositoryBreakdown = true,
      includeBlockers = true,
      includeInProgress = false,
      maxItemsToShow = 5,
      includeDiagram = false,
      diagramMermaid
    } = options;

    const lines: string[] = [];

    // Diagram section (diagram-first structure per SKILL.md)
    if (includeDiagram && diagramMermaid) {
      lines.push('## 📸 Dependency Diagram');
      lines.push('');
      lines.push('```mermaid');
      lines.push(diagramMermaid);
      lines.push('```');
      lines.push('');
      lines.push('**Legend:**');
      lines.push('- ☑ = Completed tasks');
      lines.push('- 🔄 = In progress tasks');
      lines.push('- ☐ = Open tasks');
      lines.push('- Dotted lines = discovered/blocking relationships');
      lines.push('- Orange borders = recently discovered work');
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    // Header with overall progress
    lines.push('## Progress Update');
    lines.push('');
    lines.push(this.formatProgressBar(progress.totalMetrics.percentComplete));
    lines.push('');
    lines.push(`**Overall:** ${progress.totalMetrics.completed}/${progress.totalMetrics.total} tasks completed (${progress.totalMetrics.percentComplete}%)`);
    lines.push('');

    // Summary by status
    lines.push('### Summary');
    lines.push(`- ✅ Completed: ${progress.totalMetrics.completed}`);
    lines.push(`- 🔄 In Progress: ${progress.totalMetrics.inProgress}`);
    lines.push(`- 🚧 Blocked: ${progress.totalMetrics.blocked}`);
    lines.push(`- 📝 Open: ${progress.totalMetrics.open}`);
    lines.push('');

    // Repository breakdown
    if (includeRepositoryBreakdown && progress.epics.length > 1) {
      lines.push('### Progress by Repository');
      lines.push('');
      for (const epic of progress.epics) {
        lines.push(`#### ${epic.repository}`);
        lines.push(`${epic.metrics.completed}/${epic.metrics.total} tasks completed (${epic.metrics.percentComplete}%)`);
        lines.push('');
      }
    }

    // Blockers
    if (includeBlockers && progress.hasBlockers) {
      lines.push('### ⚠️ Blockers');
      lines.push('');
      const blockersToShow = progress.allBlockers.slice(0, maxItemsToShow);
      for (const blocker of blockersToShow) {
        const blockingDeps = (blocker.dependencies || []).filter(
          d => d.dependency_type === 'blocks' && d.status !== 'closed'
        );
        lines.push(`- **${blocker.id}**: ${blocker.title}`);
        for (const dep of blockingDeps) {
          lines.push(`  - Blocked by: ${dep.id} (${dep.status})`);
        }
      }

      if (progress.allBlockers.length > maxItemsToShow) {
        lines.push(`- ...and ${progress.allBlockers.length - maxItemsToShow} more blocked tasks`);
      }
      lines.push('');
    }

    // In-progress items
    if (includeInProgress && progress.totalMetrics.inProgress > 0) {
      lines.push('### 🔄 In Progress');
      lines.push('');
      const inProgressIssues = progress.epics
        .flatMap(e => e.subtasks)
        .filter(i => i.status === 'in_progress')
        .slice(0, maxItemsToShow);

      for (const issue of inProgressIssues) {
        lines.push(`- **${issue.id}**: ${issue.title}`);
      }

      const totalInProgress = progress.epics.flatMap(e => e.subtasks).filter(i => i.status === 'in_progress').length;
      if (totalInProgress > maxItemsToShow) {
        lines.push(`- ...and ${totalInProgress - maxItemsToShow} more in-progress tasks`);
      }
      lines.push('');
    }

    // Footer
    lines.push('---');
    lines.push(`*Last updated: ${new Date().toISOString()}*`);

    return lines.join('\n');
  }

  /**
   * Format a progress bar using Unicode characters
   */
  private formatProgressBar(percent: number): string {
    const filled = Math.round(percent / 5); // 20 blocks = 100%
    const empty = 20 - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `\`${bar}\` ${percent}%`;
  }

  /**
   * Update issue with progress (works with GitHub or Shortcut)
   */
  async updateIssueProgress(
    repository: string,
    issueNumber: number,
    commentOptions: ProgressCommentOptions = {}
  ): Promise<ProgressUpdateResult> {
    try {
      // Get aggregated progress
      const progress = await this.getAggregatedProgress(repository, issueNumber);

      // Generate diagram if requested and MermaidGenerator is available
      let diagramMermaid: string | undefined;
      if (commentOptions.includeDiagram && this.mermaid && progress.epics.length > 0) {
        try {
          // Generate diagram for the first epic (primary epic)
          const primaryEpic = progress.epics[0];
          diagramMermaid = await this.mermaid.generate(
            primaryEpic.epicId,
            { maxNodes: 50, includeLegend: false }
          );
        } catch (error) {
          // Log error but continue without diagram
          console.error('Failed to generate diagram:', error);
        }
      }

      // Generate comment with diagram
      const commentBody = this.generateProgressComment(progress, {
        ...commentOptions,
        diagramMermaid
      });

      // Post comment to backend (GitHub or Shortcut)
      const issueId = this.backend.name === 'shortcut'
        ? issueNumber.toString()
        : `${repository}#${issueNumber}`;
      const issue = await this.backend.getIssue(issueId);
      const comment = await this.backend.addComment(issue.id, commentBody);

      return {
        success: true,
        commentUrl: comment.url,
        fieldsUpdated: ['aggregatedMetrics', 'lastSyncedAt']
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * @deprecated Use updateIssueProgress instead
   */
  async updateGitHubProgress(
    githubRepository: string,
    githubIssueNumber: number,
    commentOptions: ProgressCommentOptions = {}
  ): Promise<ProgressUpdateResult> {
    return this.updateIssueProgress(githubRepository, githubIssueNumber, commentOptions);
  }
}
