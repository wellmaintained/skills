import type { BeadsIssue, DependencyTreeNode } from '../types/beads.js';
import type { BdCli } from '../utils/bd-cli.js';
import type { BeadsClient } from '../clients/beads-client.js';

export class DependencyTreeBuilder {
  constructor(private readonly client: BeadsClient) {}

  /**
   * Get epic children as full dependency tree using bd dep tree
   */
  async getEpicChildrenTree(
    epicId: string,
    bdCli: BdCli
  ): Promise<DependencyTreeNode> {
    try {
      // Use bd dep tree --json to get all issue details in one call
      interface DepTreeNode {
        id: string;
        title: string;
        description?: string;
        notes?: string;
        design?: string;
        acceptance_criteria?: string;
        external_ref?: string;
        status: string;
        priority: number;
        issue_type: string;
        created_at: string;
        updated_at: string;
        closed_at?: string;
        assignee?: string;
        labels?: string[];
        depth: number;
        parent_id: string;
        truncated: boolean;
      }

      const treeNodes = await bdCli.execTreeJson<DepTreeNode[]>(epicId, true);

      // Convert to BeadsIssue map
      const issuesMap = new Map<string, BeadsIssue>();
      for (const node of treeNodes) {
        const issue: BeadsIssue = {
          id: node.id,
          content_hash: '', // Not provided by dep tree
          title: node.title,
          description: node.description || '',
          design: node.design,
          acceptance_criteria: node.acceptance_criteria,
          notes: node.notes,
          external_ref: node.external_ref,
          status: node.status as any,
          priority: node.priority as any,
          issue_type: node.issue_type as any,
          created_at: node.created_at,
          updated_at: node.updated_at,
          closed_at: node.closed_at,
          assignee: node.assignee,
          labels: node.labels || [],
          dependencies: [], // Will populate if needed
          dependents: []
        };
        issuesMap.set(node.id, issue);
      }

      const rootIssue = issuesMap.get(epicId);
      if (!rootIssue) {
        // Should not happen if epic exists
        const epic = await this.client.getIssue(epicId);
        return { issue: epic, dependencies: [], depth: 0 };
      }

      // Build tree based on parent_id from the flat structure
      const childrenMap = new Map<string, BeadsIssue[]>();

      for (const node of treeNodes) {
        if (node.parent_id && node.id !== epicId) {
          const issue = issuesMap.get(node.id);
          if (issue) {
            const children = childrenMap.get(node.parent_id) || [];
            children.push(issue);
            childrenMap.set(node.parent_id, children);
          }
        }
      }

      const buildNode = (issue: BeadsIssue, depth: number): DependencyTreeNode => {
        const children = childrenMap.get(issue.id) || [];
        // Sort children: completed first (left), then by ID for stability
        children.sort((a, b) => {
          // Closed status comes first (will appear on left)
          const aIsClosed = (a.status ?? 'open') === 'closed' ? 0 : 1;
          const bIsClosed = (b.status ?? 'open') === 'closed' ? 0 : 1;

          if (aIsClosed !== bIsClosed) {
            return aIsClosed - bIsClosed;
          }

          // Within same status, sort by ID for stability
          return a.id.localeCompare(b.id);
        });

        const dependencyNodes = children.map(child => buildNode(child, depth + 1));

        return {
          issue,
          dependencies: dependencyNodes,
          depth
        };
      };

      return buildNode(rootIssue, 0);

    } catch (error) {
      console.error('Error building tree:', error);
      // Fallback to simple view
      const epic = await this.client.getIssue(epicId);
      return { issue: epic, dependencies: [], depth: 0 };
    }
  }

  /**
   * Build dependency tree recursively for a single issue
   */
  async buildDependencyTree(
    issue: BeadsIssue,
    depth: number
  ): Promise<DependencyTreeNode> {
    const dependencies: DependencyTreeNode[] = [];

    // Recursively build trees for dependencies (if they exist)
    if (issue.dependencies && Array.isArray(issue.dependencies)) {
      for (const dep of issue.dependencies) {
        try {
          const depIssue = await this.client.getIssue(dep.id);
          const depTree = await this.buildDependencyTree(depIssue, depth + 1);
          depTree.dependencyType = dep.dependency_type;
          dependencies.push(depTree);
        } catch (error) {
          // Skip if dependency can't be fetched
          continue;
        }
      }
    }

    return {
      issue,
      dependencies,
      depth
    };
  }
}
