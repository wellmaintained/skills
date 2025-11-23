/**
 * Epic decomposer - orchestrates GitHub issue → Beads epic creation
 */

import { ConfigManager } from '../config/config-manager.js';
import { GitHubBackend } from '../backends/github.js';
import { BeadsClient } from '../clients/beads-client.js';
import { MappingStore } from '../store/mapping-store.js';
import { IssueParser } from './issue-parser.js';
import {
  DecompositionResult,
  DecompositionOptions,
  EpicCreationRequest,
  EpicCreationResult,
  ParsedIssue,
} from '../types/decomposition.js';

/**
 * EpicDecomposer handles the complete workflow of decomposing a GitHub issue
 * into Beads epics across multiple repositories
 */
export class EpicDecomposer {
  private config: ConfigManager;
  private github: GitHubBackend;
  private beads: BeadsClient;
  private mappingStore: MappingStore;
  private parser: IssueParser;

  constructor(
    config: ConfigManager,
    github: GitHubBackend,
    beads: BeadsClient,
    mappingStore: MappingStore
  ) {
    this.config = config;
    this.github = github;
    this.beads = beads;
    this.mappingStore = mappingStore;
    this.parser = new IssueParser([...config.getRepositories()]);
  }

  /**
   * Decompose a GitHub issue into Beads epics
   */
  async decompose(
    issueNumber: number,
    options: DecompositionOptions = {}
  ): Promise<DecompositionResult> {
    try {
      // 1. Fetch GitHub issue
      const githubRepo = this.config.getGitHub().repository;
      const issue = await this.github.getIssue(`${githubRepo}#${issueNumber}`);

      // 2. Parse issue
      const parsed = this.parser.parse(
        issue,
        githubRepo,
        this.config.getGitHub().projectId
      );

      // 3. Create epics in each repository
      const epicResults = await this.createEpics(parsed, options);

      // 4. Create mapping
      const mappingId = await this.createMapping(parsed, epicResults);

      // 5. Generate confirmation comment
      const confirmationComment = this.generateConfirmationComment(parsed, epicResults);

      // 6. Post confirmation comment
      if (options.postComment !== false) {
        await this.github.addComment(issue.id, confirmationComment);
      }

      // 7. Add to project
      if (options.addToProject && parsed.projectId) {
        await this.github.addToProject?.(issue.id, parsed.projectId);
      }

      // 9. Add labels
      if (options.labels && options.labels.length > 0) {
        await this.addLabels(issue.id, options.labels);
      }

      const totalTasks = epicResults.reduce((sum, r) => sum + r.childIssueIds.length, 0);

      return {
        githubIssue: `${githubRepo}#${issueNumber}`,
        mappingId,
        epics: epicResults,
        totalTasks,
        confirmationComment,
        success: true,
      };
    } catch (error) {
      return {
        githubIssue: `${this.config.getGitHub().repository}#${issueNumber}`,
        mappingId: '',
        epics: [],
        totalTasks: 0,
        confirmationComment: '',
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Create epics in all affected repositories
   */
  private async createEpics(
    parsed: ParsedIssue,
    options: DecompositionOptions
  ): Promise<EpicCreationResult[]> {
    const requests = this.buildEpicRequests(parsed, options);
    const results: EpicCreationResult[] = [];

    for (const request of requests) {
      try {
        const result = await this.createEpicInRepository(request);
        results.push(result);
      } catch (error) {
        results.push({
          repository: request.repository,
          epicId: '',
          childIssueIds: [],
          success: false,
          error: (error as Error).message,
        });
      }
    }

    return results;
  }

  /**
   * Build epic creation requests for each repository
   */
  private buildEpicRequests(
    parsed: ParsedIssue,
    options: DecompositionOptions
  ): EpicCreationRequest[] {
    const requests: EpicCreationRequest[] = [];

    for (const repo of parsed.repositories) {
      const tasks = this.parser.getRepositoryTasks(parsed, repo.name);

      requests.push({
        repository: repo.name,
        title: parsed.title,
        description: this.buildEpicDescription(parsed, repo.name),
        tasks,
        priority: options.defaultPriority ?? 2,
        externalRef: parsed.url,
        labels: options.labels,
      });
    }

    return requests;
  }

  /**
   * Build epic description with link to GitHub issue
   */
  private buildEpicDescription(parsed: ParsedIssue, _repositoryName: string): string {
    const lines: string[] = [];

    lines.push(`Tracked in GitHub: ${parsed.url}`);
    lines.push('');

    // Add original description if not too long
    if (parsed.body.length < 500) {
      lines.push(parsed.body);
    } else {
      lines.push(parsed.body.substring(0, 497) + '...');
      lines.push('');
      lines.push('_See full description in GitHub issue_');
    }

    return lines.join('\n');
  }

  /**
   * Create epic in a single repository
   */
  private async createEpicInRepository(
    request: EpicCreationRequest
  ): Promise<EpicCreationResult> {
    // Create epic
    const epic = await this.beads.createEpic(request.repository, {
      title: request.title,
      description: request.description,
      priority: request.priority as 0 | 1 | 2 | 3 | 4,
      external_ref: request.externalRef,
      labels: request.labels,
    });

    // Create child issues for each task
    const childIssueIds: string[] = [];

    for (const task of request.tasks) {
      const childIssue = await this.beads.createIssue(request.repository, {
        title: task,
        description: `Part of epic: ${epic.id}`,
        priority: request.priority as 0 | 1 | 2 | 3 | 4,
        issue_type: 'task',
      });

      // Link to epic
      await this.beads.addDependency(
        request.repository,
        childIssue.id,
        epic.id,
        'parent-child'
      );

      childIssueIds.push(childIssue.id);
    }

    return {
      repository: request.repository,
      epicId: epic.id,
      childIssueIds,
      success: true,
    };
  }

  /**
   * Create mapping in database
   */
  private async createMapping(
    parsed: ParsedIssue,
    epicResults: EpicCreationResult[]
  ): Promise<string> {
    const mapping = await this.mappingStore.create({
      githubIssue: `${parsed.githubRepository}#${parsed.number}`,
      githubIssueNumber: parsed.number,
      githubRepository: parsed.githubRepository,
      githubProjectId: parsed.projectId,
      beadsEpics: epicResults
        .filter(r => r.success)
        .map(r => {
          const repoConfig = this.parser.getRepository(r.repository)!;
          return {
            repository: r.repository,
            epicId: r.epicId,
            repositoryPath: repoConfig.path,
            createdAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString(),
            status: 'open',
            completedIssues: 0,
            totalIssues: r.childIssueIds.length,
          };
        }),
    });

    return mapping.id;
  }

  /**
   * Generate confirmation comment markdown
   */
  private generateConfirmationComment(
    _parsed: ParsedIssue,
    epicResults: EpicCreationResult[]
  ): string {
    const lines: string[] = [];

    lines.push('## 🤖 Beads Epic Created');
    lines.push('');
    lines.push('This GitHub issue has been decomposed into Beads epics for implementation tracking:');
    lines.push('');

    for (const result of epicResults) {
      if (result.success) {
        lines.push(`### ${result.repository}`);
        lines.push(`- **Epic:** \`${result.epicId}\``);
        lines.push(`- **Tasks:** ${result.childIssueIds.length} child issues created`);

        if (result.childIssueIds.length > 0) {
          lines.push('- **Child Issues:**');
          for (const childId of result.childIssueIds) {
            lines.push(`  - \`${childId}\``);
          }
        }
        lines.push('');
      } else {
        lines.push(`### ⚠️ ${result.repository}`);
        lines.push(`- **Error:** ${result.error}`);
        lines.push('');
      }
    }

    const totalTasks = epicResults
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.childIssueIds.length, 0);

    lines.push(`**Total:** ${epicResults.filter(r => r.success).length} epics, ${totalTasks} tasks`);
    lines.push('');
    lines.push('---');
    lines.push('_Automated by Beads-PM Sync_');

    return lines.join('\n');
  }

  /**
   * Add labels to GitHub issue
   */
  private async addLabels(_issueId: string, _labels: string[]): Promise<void> {
    // Note: This would require implementing addLabels in GitHubBackend
    // For now, we'll skip this as it's not critical
  }
}
