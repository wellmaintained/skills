/**
 * Types for Mermaid diagram generation
 */

import { BeadsIssue, BeadsStatus } from './beads.js';

/**
 * Mermaid diagram node representing a Beads issue
 */
export interface MermaidNode {
  /** Node ID (sanitized issue ID) */
  id: string;

  /** Display label */
  label: string;

  /** Repository name */
  repository: string;

  /** Issue status for color coding */
  status: BeadsStatus;

  /** Original Beads issue */
  issue: BeadsIssue;
}

/**
 * Mermaid diagram edge representing a dependency
 */
export interface MermaidEdge {
  /** Source node ID */
  from: string;

  /** Target node ID */
  to: string;

  /** Dependency type */
  type: 'blocks' | 'related' | 'parent-child' | 'discovered-from';

  /** Whether this is a cross-repository dependency */
  crossRepo: boolean;
}

/**
 * Options for Mermaid diagram generation
 */
export interface MermaidOptions {
  /** Maximum number of nodes to include (default: 50) */
  maxNodes?: number;

  /** Include legend (default: true) */
  includeLegend?: boolean;

  /** Group by repository using subgraphs (default: true) */
  groupByRepository?: boolean;

  /** Direction of graph (TB, BT, LR, RL) (default: TB) */
  direction?: 'TB' | 'BT' | 'LR' | 'RL';

  /** Show only specific repositories */
  repositories?: string[];

  /** Show only specific statuses */
  statuses?: BeadsStatus[];
}

/**
 * Mermaid diagram structure
 */
export interface MermaidDiagram {
  /** All nodes in the diagram */
  nodes: MermaidNode[];

  /** All edges in the diagram */
  edges: MermaidEdge[];

  /** Repositories present in the diagram */
  repositories: string[];

  /** Whether nodes were truncated due to limit */
  truncated: boolean;

  /** Number of nodes omitted if truncated */
  omittedCount?: number;
}

/**
 * Status to color mapping for diagram styling
 */
export const STATUS_COLORS: Record<BeadsStatus, string> = {
  open: '#E8F4FF',       // Light blue
  in_progress: '#FFF4E8', // Light orange
  blocked: '#FFE8E8',     // Light red
  closed: '#E8FFE8'       // Light green
};

/**
 * Status to CSS class mapping
 */
export const STATUS_CLASSES: Record<BeadsStatus, string> = {
  open: 'status-open',
  in_progress: 'status-in-progress',
  blocked: 'status-blocked',
  closed: 'status-closed'
};
