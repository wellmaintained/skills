import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ClientLogger } from './utils/logger';

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

function extractErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error.trim();
  }

  return undefined;
}

function buildUserFacingError(action: string, error: unknown): string {
  const detail = extractErrorMessage(error);
  const suffix = 'Reverting UI to match the beads backend state.';

  if (detail) {
    const cleanedDetail = detail.replace(/[.!?\s]+$/, '');
    return `Failed to ${action}: ${cleanedDetail}. ${suffix}`;
  }

  return `Failed to ${action}. ${suffix}`;
}

interface PendingStatusInfo {
  transitionId: string;
  targetStatus: IssueStatus;
  previousStatus?: IssueStatus;
  requestedAt: number;
  confirmedAt?: number;
  serverSettledAt?: number;
}

function createTransitionId(issueId: string): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `status-${issueId}-${timestamp}-${randomPart}`;
}

type StatusMutationVariables = { targetId: string; status: IssueStatus };

interface StatusMutationContext {
  previous?: IssueResponse;
  previousStatus?: IssueStatus;
  transitionId: string;
  requestedAt: number;
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
  const logger = useMemo(() => new ClientLogger('App'), []);
  const logSequenceRef = useRef(0);
  const nextLogMeta = useCallback(
    (phase: string, context?: Record<string, unknown>) => {
      logSequenceRef.current += 1;
      return {
        seq: logSequenceRef.current,
        at: new Date().toISOString(),
        phase,
        ...context,
      };
    },
    []
  );
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [fitViewFn, setFitViewFn] = useState<(() => void) | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingStatuses, setPendingStatuses] = useState<Record<string, PendingStatusInfo>>({});
  const { collapsed, toggle } = useCollapsedNodes(issueId);
  const registerFit = useCallback((fn: () => void) => setFitViewFn(() => fn), []);

  const query = useIssueData(issueId, setToast);

  const optimisticIssues = useMemo(() => {
    if (!query.data?.issues) {
      return undefined;
    }

    const pendingEntries = Object.entries(pendingStatuses);
    if (pendingEntries.length === 0) {
      return query.data.issues;
    }

    let changed = false;
    const updatedIssues = query.data.issues.map((issue) => {
      const pending = pendingStatuses[issue.id];
      if (pending && issue.metadata?.beadsStatus !== pending.targetStatus) {
        changed = true;
        return {
          ...issue,
          metadata: { ...issue.metadata, beadsStatus: pending.targetStatus },
        };
      }
      return issue;
    });

    return changed ? updatedIssues : query.data.issues;
  }, [pendingStatuses, query.data?.issues]);

  const optimisticMetrics = useMemo(() => {
    if (!query.data) {
      return undefined;
    }

    if (!optimisticIssues || optimisticIssues === query.data.issues) {
      return query.data.metrics;
    }

    return recalculateMetrics(optimisticIssues);
  }, [optimisticIssues, query.data]);

  const layout = useTreeLayout(optimisticIssues ?? query.data?.issues, query.data?.edges, collapsed);

  const updateCache = useCallback(
    (updater: (current: IssueResponse) => IssueResponse) => {
      queryClient.setQueryData<IssueResponse | undefined>(QUERY_KEY(issueId), (current) => {
        if (!current) return current;
        return updater(current);
      });
    },
    [issueId, queryClient]
  );

  const statusMutation = useMutation<void, unknown, StatusMutationVariables, StatusMutationContext>({
    mutationFn: async ({ targetId, status }) => {
      await updateIssueStatus(targetId, status);
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY(issueId) });
      const previous = queryClient.getQueryData<IssueResponse>(QUERY_KEY(issueId));
      const previousStatus = previous?.issues.find((issue) => issue.id === variables.targetId)?.metadata
        ?.beadsStatus as IssueStatus | undefined;
      const requestedAt = Date.now();
      const transitionId = createTransitionId(variables.targetId);
      const pendingCountBefore = Object.keys(pendingStatuses).length;
      const hadExistingPending = Boolean(pendingStatuses[variables.targetId]);

      logger.info(
        'Status change requested',
        nextLogMeta('status:request', {
          rootIssueId: issueId,
          transitionId,
          issueId: variables.targetId,
          previousStatus: previousStatus ?? 'unknown',
          nextStatus: variables.status,
          pendingCountBefore,
        })
      );

      setPendingStatuses((prev) => ({
        ...prev,
        [variables.targetId]: {
          transitionId,
          targetStatus: variables.status,
          previousStatus,
          requestedAt,
        },
      }));

      const pendingCountAfter = hadExistingPending ? pendingCountBefore : pendingCountBefore + 1;

      logger.debug(
        'Recorded pending status transition',
        nextLogMeta('status:pending-added', {
          rootIssueId: issueId,
          transitionId,
          issueId: variables.targetId,
          requestedStatus: variables.status,
          previousStatus: previousStatus ?? 'unknown',
          pendingCountAfter,
        })
      );

      // We do NOT update the cache directly here.
      // Instead, we rely on pendingStatuses to overlay the optimistic state on the UI.
      // This ensures that query.data continues to reflect the last known SERVER state.
      // The useEffect hook then compares query.data (server) vs pendingStatuses (target)
      // to decide when to remove the pending status.
      // If we updated the cache here, query.data would match the target immediately,
      // causing the useEffect to remove the pending status prematurely, leading to a flicker
      // when the query is invalidated and refetched (returning the old server state).

      return { previous, previousStatus, transitionId, requestedAt };
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY(issueId), context.previous);
      }
      const pendingCountBefore = Object.keys(pendingStatuses).length;
      const hadPending = Boolean(pendingStatuses[variables.targetId]);
      setPendingStatuses((prev) => {
        if (!(variables.targetId in prev)) {
          return prev;
        }
        const { [variables.targetId]: _removed, ...rest } = prev;
        return rest;
      });
      const pendingCountAfter = hadPending ? Math.max(0, pendingCountBefore - 1) : pendingCountBefore;

      logger.warn(
        'Pending status removed due to error',
        nextLogMeta('status:pending-removed', {
          rootIssueId: issueId,
          transitionId: context?.transitionId,
          issueId: variables.targetId,
          requestedStatus: variables.status,
          pendingCountBefore,
          pendingCountAfter,
        })
      );

      const elapsedMs = context?.requestedAt ? Date.now() - context.requestedAt : undefined;
      const errorForLog = error instanceof Error ? error : undefined;
      const metaContext: Record<string, unknown> = {
        rootIssueId: issueId,
        transitionId: context?.transitionId,
        issueId: variables.targetId,
        requestedStatus: variables.status,
        previousStatus: context?.previousStatus ?? 'unknown',
        elapsedMs,
        pendingCountBefore,
        pendingCountAfter,
      };
      if (!(error instanceof Error)) {
        metaContext.rawError = error;
      }
      logger.error('Status update failed', errorForLog, nextLogMeta('status:error', metaContext));
      setToast(buildUserFacingError('update status', error));
    },
    onSuccess: (_result, variables, context) => {
      const now = Date.now();
      const elapsedMs = context?.requestedAt ? now - context.requestedAt : undefined;
      let serverSettledAtForLog: number | null = null;
      let serverElapsedMs: number | undefined;
      let pendingCountBefore: number | undefined;
      let pendingCountAfter: number | undefined;

      setPendingStatuses((prev) => {
        pendingCountBefore = Object.keys(prev).length;
        const current = prev[variables.targetId];
        if (!current) {
          logger.debug(
            'Pending status missing during success',
            nextLogMeta('status:pending-missing', {
              rootIssueId: issueId,
              transitionId: context?.transitionId,
              issueId: variables.targetId,
            })
          );
          pendingCountAfter = pendingCountBefore;
          return prev;
        }

        serverSettledAtForLog = current.serverSettledAt ?? null;
        if (current.serverSettledAt != null && context?.requestedAt) {
          serverElapsedMs = current.serverSettledAt - context.requestedAt;
        }

        logger.debug(
          'Pending status marked confirmed',
          nextLogMeta('status:pending-confirmed', {
            rootIssueId: issueId,
            transitionId: current.transitionId,
            issueId: variables.targetId,
            elapsedMs,
            serverSettledAt: serverSettledAtForLog,
            serverElapsedMs,
          })
        );

        // Do NOT remove the pending status yet.
        // We wait for the server state (via polling) to match the target status.
        // This prevents the UI from flickering back to the old status if the poll happens
        // before the server has fully settled.
        return {
          ...prev,
          [variables.targetId]: {
            ...current,
            confirmedAt: now,
          },
        };
      });

      logger.info(
        'Status update confirmed (waiting for server settlement)',
        nextLogMeta('status:confirmed', {
          rootIssueId: issueId,
          transitionId: context?.transitionId,
          issueId: variables.targetId,
          status: variables.status,
          previousStatus: context?.previousStatus ?? 'unknown',
          elapsedMs,
          serverSettledAt: serverSettledAtForLog,
          serverElapsedMs,
          pendingCountBefore,
          pendingCountAfter: pendingCountBefore, // Count hasn't changed yet
        })
      );
    },
    onSettled: (_result, error, variables, context) => {
      logger.debug(
        'Status mutation settled, invalidating cache',
        nextLogMeta('status:settled-callback', {
          rootIssueId: issueId,
          transitionId: context?.transitionId,
          issueId: variables?.targetId,
          hasError: Boolean(error),
        })
      );
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY(issueId) });
    },
  });

  useEffect(() => {
    const pendingIds = Object.keys(pendingStatuses);
    if (!query.data?.issues || pendingIds.length === 0) {
      return;
    }

    const snapshot = pendingIds.map((pendingId) => {
      const info = pendingStatuses[pendingId];
      const serverStatus = query.data.issues.find((issue) => issue.id === pendingId)?.metadata?.beadsStatus as
        | IssueStatus
        | undefined;
      return {
        issueId: pendingId,
        transitionId: info.transitionId,
        targetStatus: info.targetStatus,
        serverStatus: serverStatus ?? 'unknown',
        previousStatus: info.previousStatus ?? 'unknown',
        requestedAt: info.requestedAt,
        confirmedAt: info.confirmedAt ?? null,
        serverSettledAt: info.serverSettledAt ?? null,
      };
    });

    logger.debug(
      'Pending status snapshot',
      nextLogMeta('status:snapshot', {
        rootIssueId: issueId,
        snapshot,
      })
    );

    const settled = snapshot.filter((entry) => entry.serverStatus === entry.targetStatus);

    if (settled.length === 0) {
      return;
    }

    logger.info(
      'Server indicates pending statuses reached target value',
      nextLogMeta('status:server-settled', {
        rootIssueId: issueId,
        settled,
      })
    );

    setPendingStatuses((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const entry of settled) {
        if (next[entry.issueId]) {
          delete next[entry.issueId];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pendingStatuses, query.data?.issues, issueId, logger, nextLogMeta]);

  const createMutation = useMutation({
    mutationFn: async ({ parentId, payload }: { parentId: string; payload: CreateSubtaskPayload }) => {
      logger.debug('Creating subtask', { parentId, payload });
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
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY(issueId), context.previous);
      }
      const errorForLog = error instanceof Error ? error : undefined;
      const logContext: Record<string, unknown> = variables && variables.parentId ? { parentId: variables.parentId } : {};
      if (!(error instanceof Error)) {
        logContext.error = error;
      }
      logger.error('Subtask creation failed', errorForLog, logContext);
      setToast(buildUserFacingError('create subtask', error));
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
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY(issueId) });
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
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY(issueId), context.previous);
      }
      const errorForLog = error instanceof Error ? error : undefined;
      const logContext: Record<string, unknown> =
        variables && (variables.targetId || variables.newParentId)
          ? {
            targetId: variables.targetId,
            newParentId: variables.newParentId,
          }
          : {};
      if (!(error instanceof Error)) {
        logContext.error = error;
      }
      logger.error('Issue reparent failed', errorForLog, logContext);
      setToast(buildUserFacingError('move issue', error));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY(issueId) });
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
    () => optimisticIssues?.find((issue) => issue.id === selectedId),
    [optimisticIssues, selectedId]
  );

  const parentIssue = useMemo(
    () => optimisticIssues?.find((issue) => issue.id === createParentId),
    [createParentId, optimisticIssues]
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
        metrics={optimisticMetrics ?? query.data.metrics}
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
        parentOptions={(optimisticIssues ?? query.data?.issues ?? []).map((issue) => ({
          id: issue.id,
          title: issue.title,
        }))}
      />

      {createParentId && (
        <CreateModal
          parentId={createParentId}
          parentTitle={parentIssue?.title}
          isOpen={true}
          isSubmitting={createMutation.isPending}
          onClose={() => setCreateParentId(null)}
          onSubmit={(parentId, payload) => {
            logger.debug('onSubmit called', { parentId, payload });
            createMutation.mutate({ parentId, payload });
          }}
        />
      )}
    </div>
  );
}
