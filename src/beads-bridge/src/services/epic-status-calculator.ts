import type { BeadsIssue, EpicStatus, DependencyTreeNode } from '../types/beads.js';
import type { BeadsClient } from '../clients/beads-client.js';
import type { DependencyTreeBuilder } from './dependency-tree-builder.js';
import type { BdCli } from '../utils/bd-cli.js';

export class EpicStatusCalculator {
  constructor(
    private readonly client: BeadsClient,
    private readonly treeBuilder: DependencyTreeBuilder
  ) {}

  /**
   * Calculate epic status across a repository
   */
  async getEpicStatus(
    epicId: string,
    bdCli: BdCli
  ): Promise<EpicStatus> {
    // Get all descendant issues (children and grandchildren)
    const tree = await this.treeBuilder.getEpicChildrenTree(epicId, bdCli);
    const dependents = this.flattenDependencyTree(tree);

    // Count by status
    const total = dependents.length;
    const completed = dependents.filter(d => d.status === 'closed').length;
    const inProgress = dependents.filter(d => d.status === 'in_progress').length;
    const blocked = dependents.filter(d => d.status === 'blocked').length;
    const notStarted = total - completed - inProgress - blocked;

    // Calculate percentage
    const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Find blockers (issues with blocking dependencies)
    const blockers: BeadsIssue[] = [];
    const discovered: BeadsIssue[] = [];

    for (const dep of dependents) {
      // Fetch full issue details if we need to check dependencies
      try {
        const fullIssue = await this.client.getIssue(dep.id);

        // Check for blocking dependencies (if they exist)
        if (fullIssue.dependencies && Array.isArray(fullIssue.dependencies)) {
          const hasBlockingDeps = fullIssue.dependencies.some(
            d => d.status !== 'closed'
          );
          if (hasBlockingDeps) {
            blockers.push(fullIssue);
          }

          // Check if this was discovered during work
          const isDiscovered = fullIssue.dependencies.some(
            d => d.dependency_type === 'discovered-from'
          );
          if (isDiscovered) {
            discovered.push(fullIssue);
          }
        }
      } catch (error) {
        // Skip if issue can't be fetched
        continue;
      }
    }

    return {
      total,
      completed,
      inProgress,
      blocked,
      notStarted,
      percentComplete,
      blockers,
      discovered
    };
  }

  /**
   * Flatten dependency tree into array of all descendant issues
   */
  flattenDependencyTree(tree: DependencyTreeNode): BeadsIssue[] {
    const result: BeadsIssue[] = [];

    const traverse = (node: DependencyTreeNode) => {
      result.push(node.issue);
      for (const child of node.dependencies) {
        traverse(child);
      }
    };

    traverse(tree);

    // Remove root epic from results (first item)
    return result.slice(1);
  }
}
