/**
 * Mermaid Diagram Generator
 *
 * Uses bd CLI's built-in Mermaid diagram generation via:
 * bd dep tree --format mermaid --reverse
 */

import type { BeadsClient } from '../clients/beads-client.js';
import type { MermaidOptions } from '../types/diagram.js';

/**
 * Default options for Mermaid diagram generation
 */
const DEFAULT_OPTIONS: Required<MermaidOptions> = {
  maxNodes: 50,
  includeLegend: true,
  groupByRepository: true,
  direction: 'TB',
  repositories: [],
  statuses: []
};

/**
 * MermaidGenerator creates visual dependency diagrams using bd CLI
 */
export class MermaidGenerator {
  constructor(private readonly beads: BeadsClient) {}

  /**
   * Generate a Mermaid diagram from a dependency tree
   *
   * Uses bd's built-in diagram generation:
   * bd dep tree <issue-id> --format mermaid --reverse
   */
  async generate(
    repository: string,
    rootIssueId: string,
    options: MermaidOptions = {}
  ): Promise<string> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Get the bd CLI instance for this repository
    const bdCli = this.beads['getBdCli'](repository);

    // Build command arguments
    const args = ['dep', 'tree', rootIssueId, '--format', 'mermaid', '--reverse'];

    // Apply max depth if maxNodes is specified
    if (opts.maxNodes && opts.maxNodes < 50) {
      // Convert maxNodes to a reasonable depth
      // Assume average branching factor of 3-5
      const maxDepth = Math.max(1, Math.floor(Math.log(opts.maxNodes) / Math.log(3)));
      args.push('--max-depth', maxDepth.toString());
    }

    // Execute bd command to get Mermaid diagram
    const { stdout } = await bdCli.exec(args);

    return stdout.trim();
  }

  /**
   * Legacy method for backwards compatibility
   * Redirects to generate()
   */
  async generateFromTree(
    repository: string,
    rootIssueId: string,
    options: MermaidOptions = {}
  ): Promise<{ mermaid: string; nodeCount: number }> {
    const mermaid = await this.generate(repository, rootIssueId, options);

    // Count nodes by counting lines that define nodes
    const nodeCount = (mermaid.match(/^\s+\w+-\w+\[/gm) || []).length;

    return {
      mermaid,
      nodeCount
    };
  }

  /**
   * Render diagram with markdown code fence
   */
  render(mermaid: string): string {
    return `\`\`\`mermaid\n${mermaid}\n\`\`\``;
  }
}
