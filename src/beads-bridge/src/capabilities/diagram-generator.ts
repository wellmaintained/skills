import type { CapabilityHandler } from './types.js';
import type { SkillContext, SkillResult } from '../types/skill.js';
import type { ExternalRefResolver } from '../utils/external-ref-resolver.js';
import type { BeadsClient } from '../clients/beads-client.js';
import type { DiagramPlacer } from '../diagrams/diagram-placer.js';

export class DiagramGeneratorHandler implements CapabilityHandler {
  constructor(
    private readonly resolver: ExternalRefResolver,
    private readonly beads: BeadsClient,
    private readonly diagramPlacer: DiagramPlacer
  ) {}

  async execute(context: SkillContext): Promise<SkillResult> {
    const { repository, issueNumber, placement = 'description' } = context;

    if (!repository || !issueNumber) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'repository and issueNumber are required'
        }
      };
    }

    const resolution = await this.resolver.resolve({ repository, issueNumber });
    if (resolution.epics.length === 0) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `No external_ref found for ${repository}#${issueNumber}`
        }
      };
    }

    // Get dependency tree
    const primaryEpic = resolution.epics[0];
    const tree = await this.beads.getDependencyTree(primaryEpic.repository, primaryEpic.epicId);

    // Place diagram
    const result = await this.diagramPlacer.updateDiagram(
      repository,
      issueNumber,
      {
        updateDescription: placement !== 'comment',
        createSnapshot: placement === 'comment',
        trigger: 'manual'
      }
    );

    return {
      success: true,
      data: {
        diagramUrl: result.issueUrl,
        descriptionUpdated: result.descriptionUpdated,
        snapshotCreated: !!result.snapshot,
        complexity: this.calculateComplexity(tree)
      }
    };
  }

  /**
   * Calculate complexity rating based on dependency tree
   */
  private calculateComplexity(tree: any): 'low' | 'medium' | 'high' {
    // Count all nodes in the tree recursively
    const countNodes = (node: any): number => {
      if (!node) return 0;
      const childCount = (node.children || []).reduce((sum: number, child: any) =>
        sum + countNodes(child), 0);
      return 1 + childCount;
    };

    const nodeCount = countNodes(tree);

    if (nodeCount > 50) return 'high';
    if (nodeCount > 20) return 'medium';
    return 'low';
  }
}
