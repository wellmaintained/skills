/**
 * Beads Client Implementation
 *
 * Client for interacting with Beads issue tracking across multiple repositories.
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
 * Beads client for issue tracking
 */
export class BeadsClient {
  private readonly bdCli: BdCli;
  private readonly treeBuilder: DependencyTreeBuilder;
  private readonly statusCalculator: EpicStatusCalculator;

  constructor(config: BeadsConfig & { logger?: Logger }) {
    // bd searches up for .beads/ automatically, so we just use current directory
    this.bdCli = new BdCli({ cwd: process.cwd(), logger: config.logger });

    this.treeBuilder = new DependencyTreeBuilder(this);
    this.statusCalculator = new EpicStatusCalculator(this, this.treeBuilder);
  }

  // ============================================================================
  // Repository Management (removed - single repo only)
  // ============================================================================

  // ============================================================================
  // Issue Operations
  // ============================================================================

  /**
   * Create an epic
   */
  async createEpic(
    params: CreateBeadsIssueParams
  ): Promise<BeadsIssue> {
    const bd = this.bdCli;

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
   * Create a regular issue (task, bug, etc.)
   */
  async createIssue(
    params: CreateBeadsIssueParams
  ): Promise<BeadsIssue> {
    return this.createEpic(params);
  }

  /**
   * Get an issue by ID
   */
  async getIssue(issueId: string): Promise<BeadsIssue> {
    const bd = this.bdCli;

    // Note: bd show doesn't support --json, so we use bd list --id instead
    const result = await bd.execJson<BeadsIssue[]>(['list', '--id', issueId]);

    // bd list returns an array
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
    const bd = this.bdCli;

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
    return this.getIssue(issueId);
  }

  /**
   * List issues with optional filters
   */
  async listIssues(
    query: BeadsListQuery = {}
  ): Promise<BeadsIssue[]> {
    const bd = this.bdCli;

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
    issueId: string,
    reason?: string
  ): Promise<void> {
    const bd = this.bdCli;

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
    epicId: string
  ): Promise<DependencyTreeNode> {
    const bd = this.bdCli;
    return this.treeBuilder.getEpicChildrenTree(epicId, bd);
  }

  /**
   * Calculate epic status
   */
  async getEpicStatus(epicId: string): Promise<EpicStatus> {
    const bd = this.bdCli;
    return this.statusCalculator.getEpicStatus(epicId, bd);
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
    const bd = this.bdCli;

    await bd.exec(['dep', 'add', issueId, dependsOnId, '--type', depType]);
  }

  /**
   * Get dependency tree for an issue
   */
  async getDependencyTree(
    issueId: string
  ): Promise<DependencyTreeNode> {
    const issue = await this.getIssue(issueId);
    return this.treeBuilder.buildDependencyTree(issue, 0);
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
    since?: Date
  ): Promise<BeadsIssue[]> {
    const allIssues = await this.listIssues({ status: 'open' });

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
   * Get all issues (removed multi-repo support)
   */
  async getAllIssues(query: BeadsListQuery = {}): Promise<BeadsIssue[]> {
    return this.listIssues(query);
  }

  /**
   * Get epic with all its subtasks
   */
  async getEpicWithSubtasks(epicId: string): Promise<{
    epic: BeadsIssue;
    subtasks: BeadsIssue[];
  }> {
    const epic = await this.getIssue(epicId);

    // Get all descendant issues (children and grandchildren)
    const tree = await this.getEpicChildrenTree(epicId);
    const subtasks = this.statusCalculator.flattenDependencyTree(tree);

    return { epic, subtasks };
  }

  /**
   * Get epic status by external ref (removed multi-repo support)
   */
  async getEpicStatusByExternalRef(externalRef: string): Promise<EpicStatus | null> {
    // Find epic with this external ref
    const issues = await this.listIssues({});
    const epic = issues.find(i => i.external_ref === externalRef && i.issue_type === 'epic');

    if (!epic) {
      return null;
    }

    return this.getEpicStatus(epic.id);
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================
}
