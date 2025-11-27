/**
 * Beads Client Implementation
 *
 * Client for interacting with Beads issue tracking across multiple repositories.
 */

import type {
  BeadsConfig,
  BeadsIssue,
  BeadsRepository,
  CreateBeadsIssueParams,
  UpdateBeadsIssueParams,
  EpicStatus,
  DependencyTreeNode,
  BeadsListQuery,
  BeadsDependencyType
} from '../types/beads.js';
import { NotFoundError } from '../types/index.js';
import { BdCli } from '../utils/bd-cli.js';
import type { Logger } from '../monitoring/logger.js';
import { DependencyTreeBuilder } from '../services/dependency-tree-builder.js';
import { EpicStatusCalculator } from '../services/epic-status-calculator.js';

/**
 * Beads client for multi-repository issue tracking
 */
export class BeadsClient {
  private readonly repositories: Map<string, BeadsRepository>;
  private readonly bdClients: Map<string, BdCli>;
  private readonly treeBuilder: DependencyTreeBuilder;
  private readonly statusCalculator: EpicStatusCalculator;

  constructor(config: BeadsConfig & { logger?: Logger }) {
    this.repositories = new Map();
    this.bdClients = new Map();

    // Initialize repositories
    for (const repo of config.repositories) {
      this.repositories.set(repo.name, repo);
      this.bdClients.set(repo.name, new BdCli({ cwd: repo.path, logger: config.logger }));
    }

    this.treeBuilder = new DependencyTreeBuilder(this);
    this.statusCalculator = new EpicStatusCalculator(this, this.treeBuilder);
  }

  // ============================================================================
  // Repository Management
  // ============================================================================

  /**
   * Get all configured repositories
   */
  getRepositories(): BeadsRepository[] {
    return Array.from(this.repositories.values());
  }

  /**
   * Get repository by name
   */
  getRepository(name: string): BeadsRepository | undefined {
    return this.repositories.get(name);
  }

  /**
   * Get repository path
   */
  getRepositoryPath(name: string): string {
    const repo = this.repositories.get(name);
    if (!repo) {
      throw new NotFoundError(`Repository ${name} not configured`);
    }
    return repo.path;
  }

  // ============================================================================
  // Issue Operations
  // ============================================================================

  /**
   * Create an epic in a specific repository
   */
  async createEpic(
    repository: string,
    params: CreateBeadsIssueParams
  ): Promise<BeadsIssue> {
    const bd = this.getBdCli(repository);

    const args = ['create', params.title];

    if (params.description) {
      args.push('-d', params.description);
    }

    if (params.design) {
      args.push('--design', params.design);
    }

    if (params.acceptance_criteria) {
      args.push('--acceptance', params.acceptance_criteria);
    }

    args.push('-t', params.issue_type || 'epic');

    if (params.priority !== undefined) {
      args.push('-p', params.priority.toString());
    }

    if (params.assignee) {
      args.push('--assignee', params.assignee);
    }

    if (params.labels && params.labels.length > 0) {
      for (const label of params.labels) {
        args.push('--label', label);
      }
    }

    if (params.dependencies && params.dependencies.length > 0) {
      args.push('--deps', params.dependencies.join(','));
    }

    if (params.external_ref) {
      args.push('--external-ref', params.external_ref);
    }

    const issue = await bd.execJson<BeadsIssue>(args);
    return issue;
  }

  /**
   * Create a regular issue (task, bug, etc.) in a specific repository
   */
  async createIssue(
    repository: string,
    params: CreateBeadsIssueParams
  ): Promise<BeadsIssue> {
    return this.createEpic(repository, params);
  }

  /**
   * Get an issue by ID from a specific repository
   */
  async getIssue(repository: string, issueId: string): Promise<BeadsIssue> {
    const bd = this.getBdCli(repository);

    // Note: bd show doesn't support --json, so we use bd list --id instead
    const result = await bd.execJson<BeadsIssue[]>(['list', '--id', issueId]);

    // bd list returns an array
    if (!result || result.length === 0) {
      throw new NotFoundError(`Issue ${issueId} not found in ${repository}`);
    }

    return result[0];
  }

  /**
   * Update an issue in a specific repository
   */
  async updateIssue(
    repository: string,
    issueId: string,
    updates: UpdateBeadsIssueParams
  ): Promise<BeadsIssue> {
    const bd = this.getBdCli(repository);

    const args = ['update', issueId];

    if (updates.title !== undefined) {
      args.push('--title', updates.title);
    }

    if (updates.description !== undefined) {
      args.push('--description', updates.description);
    }

    if (updates.design !== undefined) {
      args.push('--design', updates.design);
    }

    if (updates.acceptance_criteria !== undefined) {
      args.push('--acceptance-criteria', updates.acceptance_criteria);
    }

    if (updates.status !== undefined) {
      args.push('--status', updates.status);
    }

    if (updates.priority !== undefined) {
      args.push('--priority', updates.priority.toString());
    }

    if (updates.assignee !== undefined) {
      args.push('--assignee', updates.assignee);
    }

    if (updates.notes !== undefined) {
      args.push('--notes', updates.notes);
    }

    if (updates.external_ref !== undefined) {
      args.push('--external-ref', updates.external_ref);
    }

    await bd.exec(args);

    // Fetch updated issue
    return this.getIssue(repository, issueId);
  }

  /**
   * List issues in a repository with optional filters
   */
  async listIssues(
    repository: string,
    query: BeadsListQuery = {}
  ): Promise<BeadsIssue[]> {
    const bd = this.getBdCli(repository);

    const args = ['list'];

    if (query.status) {
      args.push('--status', query.status);
    }

    if (query.priority !== undefined) {
      args.push('--priority', query.priority.toString());
    }

    if (query.type) {
      args.push('--type', query.type);
    }

    if (query.assignee) {
      args.push('--assignee', query.assignee);
    }

    if (query.labels && query.labels.length > 0) {
      for (const label of query.labels) {
        args.push('--label', label);
      }
    }

    if (query.limit) {
      args.push('--limit', query.limit.toString());
    }

    return bd.execJson<BeadsIssue[]>(args);
  }

  /**
   * Close an issue
   */
  async closeIssue(
    repository: string,
    issueId: string,
    reason?: string
  ): Promise<void> {
    const bd = this.getBdCli(repository);

    const args = ['close', issueId];

    if (reason) {
      args.push('--reason', reason);
    }

    await bd.exec(args);
  }

  // ============================================================================
  // Epic Status Calculation
  // ============================================================================

  /**
   * Get epic children as full dependency tree
   */
  async getEpicChildrenTree(
    repository: string,
    epicId: string
  ): Promise<DependencyTreeNode> {
    const bd = this.getBdCli(repository);
    return this.treeBuilder.getEpicChildrenTree(repository, epicId, bd);
  }

  /**
   * Calculate epic status across a repository
   */
  async getEpicStatus(repository: string, epicId: string): Promise<EpicStatus> {
    const bd = this.getBdCli(repository);
    return this.statusCalculator.getEpicStatus(repository, epicId, bd);
  }

  // ============================================================================
  // Dependency Operations
  // ============================================================================

  /**
   * Add a dependency between two issues
   */
  async addDependency(
    repository: string,
    issueId: string,
    dependsOnId: string,
    depType: BeadsDependencyType = 'blocks'
  ): Promise<void> {
    const bd = this.getBdCli(repository);

    await bd.exec(['dep', 'add', issueId, dependsOnId, '--type', depType]);
  }

  /**
   * Get dependency tree for an issue
   */
  async getDependencyTree(
    repository: string,
    issueId: string
  ): Promise<DependencyTreeNode> {
    const issue = await this.getIssue(repository, issueId);
    return this.treeBuilder.buildDependencyTree(repository, issue, 0);
  }

  // ============================================================================
  // Discovery Detection
  // ============================================================================
  // Discovery Detection
  // ============================================================================

  /**
   * Get all discovered issues since a given date
   */
  async getDiscoveredIssues(
    repository: string,
    since?: Date
  ): Promise<BeadsIssue[]> {
    const allIssues = await this.listIssues(repository, { status: 'open' });

    const discovered: BeadsIssue[] = [];

    for (const issue of allIssues) {
      // Check if issue has discovered-from dependency (if dependencies exist)
      if (issue.dependencies && Array.isArray(issue.dependencies)) {
        const hasDiscoveredFrom = issue.dependencies.some(
          d => d.dependency_type === 'discovered-from'
        );

        if (hasDiscoveredFrom) {
          // Check date if provided
          if (since) {
            const createdAt = new Date(issue.created_at);
            if (createdAt >= since) {
              discovered.push(issue);
            }
          } else {
            discovered.push(issue);
          }
        }
      }
    }

    return discovered;
  }

  /**
   * Get all issues across multiple repositories
   */
  async getAllIssues(query: BeadsListQuery = {}): Promise<Map<string, BeadsIssue[]>> {
    const results = new Map<string, BeadsIssue[]>();

    for (const [repoName] of this.repositories) {
      try {
        const issues = await this.listIssues(repoName, query);
        results.set(repoName, issues);
      } catch (error) {
        // Skip repositories that fail
        results.set(repoName, []);
      }
    }

    return results;
  }

  /**
   * Get epic with all its subtasks
   */
  async getEpicWithSubtasks(repository: string, epicId: string): Promise<{
    epic: BeadsIssue;
    subtasks: BeadsIssue[];
  }> {
    const epic = await this.getIssue(repository, epicId);

    // Get all descendant issues (children and grandchildren)
    const tree = await this.getEpicChildrenTree(repository, epicId);
    const subtasks = this.statusCalculator.flattenDependencyTree(tree);

    return { epic, subtasks };
  }

  /**
   * Get epic status across all repositories for issues with the same external ref
   */
  async getMultiRepoEpicStatus(externalRef: string): Promise<{
    repositories: Map<string, EpicStatus>;
    totalStatus: EpicStatus;
  }> {
    const repositories = new Map<string, EpicStatus>();
    let totalCompleted = 0;
    let totalInProgress = 0;
    let totalBlocked = 0;
    let totalNotStarted = 0;
    let totalCount = 0;
    const allBlockers: BeadsIssue[] = [];
    const allDiscovered: BeadsIssue[] = [];

    for (const [repoName] of this.repositories) {
      try {
        // Find epic with this external ref
        const issues = await this.listIssues(repoName, {});
        const epic = issues.find(i => i.external_ref === externalRef && i.issue_type === 'epic');

        if (epic) {
          const status = await this.getEpicStatus(repoName, epic.id);
          repositories.set(repoName, status);

          // Aggregate totals
          totalCompleted += status.completed;
          totalInProgress += status.inProgress;
          totalBlocked += status.blocked;
          totalNotStarted += status.notStarted;
          totalCount += status.total;
          allBlockers.push(...status.blockers);
          allDiscovered.push(...status.discovered);
        }
      } catch (error) {
        // Skip repositories that fail
        continue;
      }
    }

    const percentComplete = totalCount > 0 ? Math.round((totalCompleted / totalCount) * 100) : 0;

    return {
      repositories,
      totalStatus: {
        total: totalCount,
        completed: totalCompleted,
        inProgress: totalInProgress,
        blocked: totalBlocked,
        notStarted: totalNotStarted,
        percentComplete,
        blockers: allBlockers,
        discovered: allDiscovered
      }
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Get bd CLI client for repository
   */
  private getBdCli(repository: string): BdCli {
    const bd = this.bdClients.get(repository);
    if (!bd) {
      throw new NotFoundError(`Repository ${repository} not configured`);
    }
    return bd;
  }
}
