import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchIssueState } from '../api';
import type { IssueResponse } from '../types';
import { ClientLogger } from '../utils/logger';

export function useIssueData(issueId: string, onEventError?: (message: string) => void) {
  const queryClient = useQueryClient();
  const loggerRef = useRef<ClientLogger>();
  if (!loggerRef.current) {
    loggerRef.current = new ClientLogger('IssueData');
  }
  const logger = loggerRef.current;
  const sequenceRef = useRef(0);
  const createMeta = useCallback(
    (phase: string, context?: Record<string, unknown>) => {
      sequenceRef.current += 1;
      return {
        seq: sequenceRef.current,
        at: new Date().toISOString(),
        phase,
        issueId,
        ...context,
      };
    },
    [issueId]
  );

  const query = useQuery({
    queryKey: ['issue', issueId],
    queryFn: () =>
      fetchIssueState(issueId).then((data) => {
        logger.info(
          'Fetched issue snapshot',
          createMeta('query:success', {
            issueCount: data.issues.length,
            edgeCount: data.edges.length,
            lastUpdate: data.lastUpdate,
          })
        );
        return data;
      }),
    enabled: Boolean(issueId),
    onError: (error) => {
      const err = error instanceof Error ? error : undefined;
      const extra: Record<string, unknown> =
        error instanceof Error ? { error: { name: error.name, message: error.message } } : { rawError: error };
      logger.error('Issue snapshot fetch failed', err, createMeta('query:error', extra));
    },
  });

  useEffect(() => {
    if (!issueId) {
      return;
    }

    const source = new EventSource(`/api/issue/${issueId}/events`);
    logger.info('SSE stream subscribed', createMeta('sse:open'));

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.type === 'update') {
          const data = payload.data as IssueResponse;
          logger.info(
            'SSE update received',
            createMeta('sse:update', {
              issueCount: data.issues.length,
              edgeCount: data.edges.length,
              lastUpdate: data.lastUpdate,
            })
          );
          queryClient.setQueryData(['issue', issueId], data);
        } else if (payload.type === 'error') {
          logger.warn(
            'SSE error payload received',
            createMeta('sse:error-payload', {
              message: payload.message ?? 'unknown error',
            })
          );
          onEventError?.(payload.message ?? 'Live updates unavailable');
        }
      } catch {
        logger.error('Failed to parse SSE payload', undefined, createMeta('sse:parse-error', { raw: event.data }));
        onEventError?.('Received malformed live update');
      }
    };

    source.onerror = () => {
      logger.warn('SSE connection error', createMeta('sse:error'));
      onEventError?.('Live updates disconnected. Retrying…');
    };

    return () => {
      logger.info('SSE stream unsubscribed', createMeta('sse:close'));
      source.close();
    };
  }, [createMeta, issueId, logger, onEventError, queryClient]);

  return query;
}
