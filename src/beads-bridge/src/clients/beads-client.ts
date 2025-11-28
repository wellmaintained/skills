/**
 * Beads Client Implementation
 *
 * Client for interacting with Beads issue tracking.
 */

import type {
  BeadsConfig,
  BeadsIssue,
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
 * Beads client for single-repository issue tracking
 */
export class BeadsClient {
  private readonly bdCli: BdCli;
  private readonly repositoryPath: string;
  private readonly prefix?: string;
  private readonly treeBuilder: DependencyTreeBuilder;
  private readonly statusCalculator: EpicStatusCalculator;

  constructor(config: BeadsConfig & { logger?: Logger }) {
    this.repositoryPath = config.repositoryPath;
    this.prefix = config.prefix;
    this.bdCli = new BdCli({ cwd: config.repositoryPath, logger: config.logger });
    this.treeBuilder = new DependencyTreeBuilder(this);
    this.statusCalculator = new EpicStatusCalculator(this, this.treeBuilder);
  }

  // ============================================================================
  // Repository Info
  // ============================================================================

  /**
   * Get the repository path
   */
  getRepositoryPath(): string {
    return this.repositoryPath;
  }

  /**
   * Get the issue prefix
   */
  getPrefix(): string | undefined {
    return this.prefix;
  }

  // ============================================================================
  // Issue Operations
  // ============================================================================

  /**
   * Create an epic
   */
  async createEpic(params: CreateBeadsIssueParams): Promise<BeadsIssue> {
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

    const issue = await this.bdCli.execJson<BeadsIssue>(args);
    return issue;
  }

  /**
   * Create a regular issue (task, bug, etc.)
   */
  async createIssue(params: CreateBeadsIssueParams): Promise<BeadsIssue> {
    return this.createEpic(params);
  }

  /**
   * Get an issue by ID
   */
  async getIssue(issueId: string): Promise<BeadsIssue> {
    const result = await this.bdCli.execJson<BeadsIssue[]>(['list', '--id', issueId]);

    if (!result || result.length === 0) {
      throw new NotFoundError(`Issue ${issueId} not found`);
    }

    return result[0];
  }

  /**
   * Update an issue
   */
  async updateIssue(
    issueId: string,
    updates: UpdateBeadsIssueParams
  ): Promise<BeadsIssue> {
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

    await this.bdCli.exec(args);

    return this.getIssue(issueId);
  }

  /**
   * List issues with optional filters
   */
  async listIssues(query: BeadsListQuery = {}): Promise<BeadsIssue[]> {
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

    return this.bdCli.execJson<BeadsIssue[]>(args);
  }

  /**
   * Close an issue
   */
  async closeIssue(issueId: string, reason?: string): Promise<void> {
    const args = ['close', issueId];

    if (reason) {
      args.push('--reason', reason);
    }

    await this.bdCli.exec(args);
  }

  // ============================================================================
  // Epic Status Calculation
  // ============================================================================

  /**
   * Get epic children as full dependency tree
   */
  async getEpicChildrenTree(epicId: string): Promise<DependencyTreeNode> {
    return this.treeBuilder.getEpicChildrenTree(this.repositoryPath, epicId, this.bdCli);
  }

  /**
   * Calculate epic status
   */
  async getEpicStatus(epicId: string): Promise<EpicStatus> {
    return this.statusCalculator.getEpicStatus(this.repositoryPath, epicId, this.bdCli);
  }

  // ============================================================================
  // Dependency Operations
  // ============================================================================

  /**
   * Add a dependency between two issues
   */
  async addDependency(
    issueId: string,
    dependsOnId: string,
    depType: BeadsDependencyType = 'blocks'
  ): Promise<void> {
    await this.bdCli.exec(['dep', 'add', issueId, dependsOnId, '--type', depType]);
  }

  /**
   * Get dependency tree for an issue
   */
  async getDependencyTree(issueId: string): Promise<DependencyTreeNode> {
    const issue = await this.getIssue(issueId);
    return this.treeBuilder.buildDependencyTree(this.repositoryPath, issue, 0);
  }

  // ============================================================================
  // Discovery Detection
  // ============================================================================

  /**
   * Get all discovered issues since a given date
   */
  async getDiscoveredIssues(since?: Date): Promise<BeadsIssue[]> {
    const allIssues = await this.listIssues({ status: 'open' });

    const discovered: BeadsIssue[] = [];

    for (const issue of allIssues) {
      if (issue.dependencies && Array.isArray(issue.dependencies)) {
        const hasDiscoveredFrom = issue.dependencies.some(
          d => d.dependency_type === 'discovered-from'
        );

        if (hasDiscoveredFrom) {
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
   * Get epic with all its subtasks
   */
  async getEpicWithSubtasks(epicId: string): Promise<{
    epic: BeadsIssue;
    subtasks: BeadsIssue[];
  }> {
    const epic = await this.getIssue(epicId);
    const tree = await this.getEpicChildrenTree(epicId);
    const subtasks = this.statusCalculator.flattenDependencyTree(tree);

    return { epic, subtasks };
  }

  // ============================================================================
  // Internal accessor for BdCli (used by tree builder and status calculator)
  // ============================================================================
  
  /** @internal */
  getBdCli(): BdCli {
    return this.bdCli;
  }
}