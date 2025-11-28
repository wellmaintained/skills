import { useMemo } from 'react';
import dagre from 'dagre';
import type { Edge, Node } from 'reactflow';
import type { DashboardEdge, DashboardIssue } from '../types';

const NODE_WIDTH = 260;
const NODE_HEIGHT = 150;

export interface IssueNodeData {
  issue: DashboardIssue;
  isCollapsed: boolean;
  childCount: number;
}

export function useTreeLayout(
  issues: DashboardIssue[] | undefined,
  edges: DashboardEdge[] | undefined,
  collapsedNodes: Set<string>
): { nodes: Node<IssueNodeData>[]; edges: Edge[]; childrenMap: Map<string, string[]> } {
  return useMemo(() => {
    if (!issues || !edges) {
      return { nodes: [], edges: [], childrenMap: new Map() };
    }

    const childrenMap = new Map<string, string[]>();
    for (const issue of issues) {
      const parentId = issue.metadata?.parentId;
      if (typeof parentId === 'string' && parentId.length > 0) {
        const existing = childrenMap.get(parentId) ?? [];
        existing.push(issue.id);
        childrenMap.set(parentId, existing);
      }
    }

    const hiddenNodes = new Set<string>();
    const hideDescendants = (id: string) => {
      const children = childrenMap.get(id) ?? [];
      for (const childId of children) {
        hiddenNodes.add(childId);
        hideDescendants(childId);
      }
    };

    collapsedNodes.forEach((id) => hideDescendants(id));

    const visibleIssues = issues.filter((issue) => !hiddenNodes.has(issue.id));
    const visibleEdges = edges.filter(
      (edge) => !hiddenNodes.has(edge.source) && !hiddenNodes.has(edge.target)
    );

    const graph = new dagre.graphlib.Graph();
    graph.setDefaultEdgeLabel(() => ({}));
    graph.setGraph({
      rankdir: 'LR', // Left-to-right: completed beads on left, active on right
      nodesep: 80,
      ranksep: 160,
    });

    visibleIssues.forEach((issue) => {
      graph.setNode(issue.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    });

    visibleEdges.forEach((edge) => {
      graph.setEdge(edge.source, edge.target);
    });

    dagre.layout(graph);

    const reactFlowNodes: Node<IssueNodeData>[] = visibleIssues.map((issue) => {
      const position = graph.node(issue.id) ?? { x: 0, y: 0 };
      return {
        id: issue.id,
        type: 'issueNode',
        position: {
          x: position.x - NODE_WIDTH / 2,
          y: position.y - NODE_HEIGHT / 2,
        },
        draggable: true,
        data: {
          issue,
          isCollapsed: collapsedNodes.has(issue.id),
          childCount: (childrenMap.get(issue.id) ?? []).length,
        },
      };
    });

    const reactFlowEdges: Edge[] = visibleEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
    }));

    return { nodes: reactFlowNodes, edges: reactFlowEdges, childrenMap };
  }, [issues, edges, collapsedNodes]);
}
