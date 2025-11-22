import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Node } from 'reactflow';
import { updateIssueStatus, createSubtask, reparentIssue } from './api';
import { useIssueData } from './hooks/useIssueData';
import { useTreeLayout, type IssueNodeData } from './hooks/useTreeLayout';
import type {
  BeadsIssueResponse,
  CreateSubtaskPayload,
  DashboardIssue,
  IssueResponse,
  IssueStatus,
} from './types';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { DetailModal } from './components/DetailModal';
import { CreateModal } from './components/CreateModal';
import type { IssueNodeComponentData } from './components/NodeCard';
import type { DashboardMetrics } from './types';

const QUERY_KEY = (issueId: string) => ['issue', issueId];

/**
 * Recalculate metrics from the current issues array
 */
function recalculateMetrics(issues: DashboardIssue[]): DashboardMetrics {
  const metrics: DashboardMetrics = {
    total: issues.length,
    completed: 0,
    inProgress: 0,
    blocked: 0,
    open: 0,
  };

  for (const issue of issues) {
    const status = issue.metadata?.beadsStatus as IssueStatus | undefined;
    if (!status) {
      metrics.open++;
      continue;
    }

    switch (status) {
      case 'closed':
        metrics.completed++;
        break;
      case 'in_progress':
        metrics.inProgress++;
        break;
      case 'blocked':
        metrics.blocked++;
        break;
      case 'open':
      default:
        metrics.open++;
        break;
    }
  }

  return metrics;
}

function getIssueIdFromPath(): string {
  const segments = window.location.pathname.split('/');
  return segments[segments.length - 1] || '';
}

function toDashboardIssue(
  beads: BeadsIssueResponse,
  parentId: string | null,
  number: number
): DashboardIssue {
  return {
    id: beads.id,
    number,
    title: beads.title,
    body: beads.description ?? '',
    state: beads.status === 'closed' ? 'closed' : 'open',
    url: `/issue/${beads.id}`,
    labels: (beads.labels ?? []).map((label) => ({ id: label, name: label })),
    assignees: beads.assignee ? [{ id: beads.assignee, login: beads.assignee }] : [],
    createdAt: beads.created_at,
    updatedAt: beads.updated_at,
    metadata: {
      beadsStatus: beads.status,
      beadsPriority: beads.priority,
      beadsType: beads.issue_type,
      parentId,
    },
  };
}

function useCollapsedNodes(issueId: string) {
  const storageKey = `beads-collapsed-${issueId}`;
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (!saved) return new Set();
      const ids = JSON.parse(saved) as string[];
      return new Set(ids);
    } catch {
      return new Set();
    }
  });

  const toggle = useCallback(
    (id: string) => {
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        window.localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
        return next;
      });
    },
    [storageKey]
  );

  return { collapsed, toggle };
}

export default function App() {
  const issueId = getIssueIdFromPath();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [fitViewFn, setFitViewFn] = useState<(() => void) | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { collapsed, toggle } = useCollapsedNodes(issueId);
  const registerFit = useCallback((fn: () => void) => setFitViewFn(() => fn), []);

  const query = useIssueData(issueId, setToast);

  const layout = useTreeLayout(query.data?.issues, query.data?.edges, collapsed);

  const updateCache = useCallback(
    (updater: (current: IssueResponse) => IssueResponse) => {
      queryClient.setQueryData<IssueResponse | undefined>(QUERY_KEY(issueId), (current) => {
        if (!current) return current;
        return updater(current);
      });
    },
    [issueId, queryClient]
  );

  const statusMutation = useMutation({
    mutationFn: async ({ targetId, status }: { targetId: string; status: IssueStatus }) => {
      await updateIssueStatus(targetId, status);
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY(issueId) });
      const previous = queryClient.getQueryData<IssueResponse>(QUERY_KEY(issueId));

      updateCache((current) => {
        const updatedIssues = current.issues.map((issue) =>
          issue.id === variables.targetId
            ? { ...issue, metadata: { ...issue.metadata, beadsStatus: variables.status } }
            : issue
        );
        return {
          ...current,
          issues: updatedIssues,
          metrics: recalculateMetrics(updatedIssues),
        };
      });

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY(issueId), context.previous);
      }
      setToast('Failed to update status. Please refresh.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY(issueId) });
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ parentId, payload }: { parentId: string; payload: CreateSubtaskPayload }) => {
      console.log('[CreateSubtask] Creating subtask with parentId:', parentId, 'payload:', payload);
      return createSubtask(parentId, payload);
    },
    onMutate: async ({ parentId, payload }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY(issueId) });
      const previous = queryClient.getQueryData<IssueResponse>(QUERY_KEY(issueId));
      const tempId = `temp-${Date.now()}`;

      updateCache((current) => {
        const optimisticIssue: DashboardIssue = {
          id: tempId,
          number: current.issues.length + 1,
          title: payload.title,
          body: payload.description ?? '',
          state: 'open',
          url: '#',
          labels: [],
          assignees: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: {
            beadsStatus: payload.status ?? 'open',
            beadsPriority: payload.priority,
            beadsType: payload.type,
            parentId,
          },
        };

        const updatedIssues = [...current.issues, optimisticIssue];
        return {
          ...current,
          issues: updatedIssues,
          edges: [...current.edges, { id: `${parentId}-${tempId}`, source: parentId, target: tempId }],
          metrics: recalculateMetrics(updatedIssues),
        };
      });

      return { previous, tempId, parentId };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY(issueId), context.previous);
      }
      setToast('Failed to create subtask. Please refresh.');
    },
    onSuccess: (result, _variables, context) => {
      if (!context) return;
      updateCache((current) => {
        const filteredEdges = current.edges.filter((edge) => edge.target !== context.tempId);
        const filteredIssues = current.issues.filter((issue) => issue.id !== context.tempId);

        const normalized = toDashboardIssue(result, context.parentId, filteredIssues.length + 1);
        const updatedIssues = [...filteredIssues, normalized];

        return {
          ...current,
          issues: updatedIssues,
          edges: [...filteredEdges, { id: `${context.parentId}-${normalized.id}`, source: context.parentId, target: normalized.id }],
          metrics: recalculateMetrics(updatedIssues),
        };
      });
      setCreateParentId(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY(issueId) });
    },
  });

  const reparentMutation = useMutation({
    mutationFn: async ({ targetId, newParentId }: { targetId: string; newParentId: string }) => {
      await reparentIssue(targetId, newParentId);
    },
    onMutate: async ({ targetId, newParentId }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY(issueId) });
      const previous = queryClient.getQueryData<IssueResponse>(QUERY_KEY(issueId));

      updateCache((current) => {
        const updatedIssues = current.issues.map((issue) =>
          issue.id === targetId ? { ...issue, metadata: { ...issue.metadata, parentId: newParentId || null } } : issue
        );

        const remainingEdges = current.edges.filter((edge) => edge.target !== targetId);
        const newEdges = newParentId
          ? [...remainingEdges, { id: `${newParentId}-${targetId}`, source: newParentId, target: targetId }]
          : remainingEdges;

        return {
          ...current,
          issues: updatedIssues,
          edges: newEdges,
        };
      });

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY(issueId), context.previous);
      }
      setToast('Failed to reparent issue. Please refresh.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY(issueId) });
    },
  });

  const nodesWithActions: Node<IssueNodeComponentData>[] = useMemo(() => {
    return layout.nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onToggleCollapse: toggle,
        onSelect: setSelectedId,
        onCreateChild: setCreateParentId,
        onStatusChange: (id: string, status: IssueStatus) => statusMutation.mutate({ targetId: id, status }),
      },
    }));
  }, [layout.nodes, statusMutation, toggle]);

  const { nodes, edges } = useMemo(() => {
    return {
      nodes: nodesWithActions,
      edges: layout.edges,
    };
  }, [layout.edges, nodesWithActions]);

  const handleReparent = useCallback(
    (childId: string, newParentId: string) => {
      if (childId === newParentId) {
        setToast('Cannot set issue as its own parent.');
        return;
      }

      const descendants = new Set<string>();
      const collect = (id: string) => {
        const children = layout.childrenMap.get(id) ?? [];
        children.forEach((child) => {
          descendants.add(child);
          collect(child);
        });
      };
      collect(childId);

      if (descendants.has(newParentId)) {
        setToast('Cannot move issue under its descendant.');
        return;
      }

      reparentMutation.mutate({ targetId: childId, newParentId });
    },
    [layout.childrenMap, reparentMutation]
  );

  const selectedIssue = useMemo(
    () => query.data?.issues.find((issue) => issue.id === selectedId),
    [query.data?.issues, selectedId]
  );

  const parentIssue = useMemo(
    () => query.data?.issues.find((issue) => issue.id === createParentId),
    [createParentId, query.data?.issues]
  );

  if (query.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
        Loading issue graph…
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 bg-slate-950 text-white">
        <p>Failed to load issue.</p>
        <button
          className="rounded-full bg-white/10 px-4 py-2 text-sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: QUERY_KEY(issueId) })}
        >
          Retry
        </button>
      </div>
    );
  }

  const toolbarError = toast;

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <Toolbar
        metrics={query.data.metrics}
        lastUpdate={query.data.lastUpdate}
        onFitView={() => fitViewFn?.()}
        errorMessage={toolbarError}
        onDismissError={() => setToast(null)}
      />

      <div className="flex-1">
        <Canvas
          nodes={nodes}
          edges={edges}
          onRegisterFit={registerFit}
          onDropReparent={handleReparent}
        />
      </div>

      <DetailModal
        issue={selectedIssue}
        isOpen={Boolean(selectedIssue)}
        onClose={() => setSelectedId(null)}
        onStatusChange={(id, status) => statusMutation.mutate({ targetId: id, status })}
        onReparent={handleReparent}
        parentOptions={(query.data?.issues ?? []).map((issue) => ({ id: issue.id, title: issue.title }))}
      />

      {createParentId && (
        <CreateModal
          parentId={createParentId}
          parentTitle={parentIssue?.title}
          isOpen={true}
          isSubmitting={createMutation.isPending}
          onClose={() => setCreateParentId(null)}
          onSubmit={(parentId, payload) => {
            console.log('[CreateModal] onSubmit called with parentId:', parentId, 'payload:', payload);
            createMutation.mutate({ parentId, payload });
          }}
        />
      )}
    </div>
  );
}
