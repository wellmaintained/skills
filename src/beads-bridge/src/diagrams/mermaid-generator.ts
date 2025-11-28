/**
 * Mermaid Diagram Generator
 *
 * Uses bd CLI's built-in Mermaid diagram generation via:
 * bd dep tree --format mermaid --reverse
 */

import type { BeadsClient } from '../clients/beads-client.js';
import type { MermaidOptions } from '../types/diagram.js';

/**
 * Live dashboard colors - matches the colors used in src/frontend/dashboard.js
 * These provide consistent visual styling across all Mermaid diagrams
 *
 * Using Mermaid init directive format to ensure colors are applied before graph definition
 */
const MERMAID_INIT_DIRECTIVE = `%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#d4edda',
    'primaryTextColor': '#155724',
    'primaryBorderColor': '#c3e6cb',
    'secondaryColor': '#cce5ff',
    'secondaryTextColor': '#004085',
    'secondaryBorderColor': '#b8daff',
    'tertiaryColor': '#f8d7da',
    'tertiaryTextColor': '#721c24',
    'tertiaryBorderColor': '#f5c6cb'
  }
}}%%`;

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
 * Average branching factor for dependency trees
 * Typical beads dependency trees have around 3 children per node
 * Used to estimate max depth from desired max nodes
 */
const AVERAGE_BRANCHING_FACTOR = 3;

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
    rootIssueId: string,
    options: MermaidOptions = {}
  ): Promise<string> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Get the bd CLI instance (single repo only)
    const bdCli = this.beads.getBdCli();

     // Build command arguments
     const args = ['dep', 'tree', rootIssueId, '--format', 'mermaid', '--direction=up', '--show-all-paths'];

    // Apply max depth if maxNodes is specified
    if (opts.maxNodes && opts.maxNodes < 50) {
      // Convert maxNodes to a reasonable depth using logarithmic estimate
      const maxDepth = Math.max(1, Math.floor(Math.log(opts.maxNodes) / Math.log(AVERAGE_BRANCHING_FACTOR)));
      args.push('--max-depth', maxDepth.toString());
    }

    // Execute bd command to get Mermaid diagram
    const { stdout } = await bdCli.exec(args);

    // Post-process diagram to add status-based styling
    const diagram = this.addStatusStyling(stdout.trim());

    // Prepend Mermaid init directive BEFORE diagram for colors to be applied
    return `${MERMAID_INIT_DIRECTIVE}\n${diagram}`;
  }

  /**
   * Add status-based styling to Mermaid nodes
   * Parses status symbols and adds appropriate style directives
   */
  private addStatusStyling(diagram: string): string {
    const lines = diagram.split('\n');
    const nodeStyles: string[] = [];

    // Parse node definitions to extract status and ID
    for (const line of lines) {
      const match = line.match(/^\s+([\w.-]+)\["([☑◧☐⊗])/);
      if (match) {
        const [, nodeId, statusSymbol] = match;
        const style = this.getStyleForStatus(statusSymbol);
        if (style) {
          nodeStyles.push(`  style ${nodeId} ${style}`);
        }
      }
    }

    // Add style directives at the end of the diagram
    if (nodeStyles.length > 0) {
      return diagram + '\n\n' + nodeStyles.join('\n');
    }

    return diagram;
  }

  /**
   * Get Mermaid style string for a given status symbol
   */
  private getStyleForStatus(statusSymbol: string): string | null {
    switch (statusSymbol) {
      case '☑': // closed/completed
        return 'fill:#d4edda,stroke:#c3e6cb,color:#155724';
      case '◧': // in_progress
        return 'fill:#cce5ff,stroke:#b8daff,color:#004085';
      case '☐': // open/pending
        return 'fill:#f8f9fa,stroke:#dee2e6,color:#495057';
      case '⊗': // blocked
        return 'fill:#f8d7da,stroke:#f5c6cb,color:#721c24';
      default:
        return null;
    }
  }

  /**
   * Legacy method for backwards compatibility
   * Redirects to generate()
   */
  async generateFromTree(
    rootIssueId: string,
    options: MermaidOptions = {}
  ): Promise<{ mermaid: string; nodeCount: number }> {
    const mermaid = await this.generate(rootIssueId, options);

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
