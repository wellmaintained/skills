import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchIssueState } from '../api';
import type { IssueResponse } from '../types';

export function useIssueData(issueId: string, onEventError?: (message: string) => void) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['issue', issueId],
    queryFn: () => fetchIssueState(issueId),
    enabled: Boolean(issueId),
  });

  useEffect(() => {
    if (!issueId) {
      return;
    }

    const source = new EventSource(`/api/issue/${issueId}/events`);

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.type === 'update') {
          queryClient.setQueryData(['issue', issueId], payload.data as IssueResponse);
        } else if (payload.type === 'error') {
          onEventError?.(payload.message ?? 'Live updates unavailable');
        }
      } catch {
        onEventError?.('Received malformed live update');
      }
    };

    source.onerror = () => {
      onEventError?.('Live updates disconnected. Retrying…');
    };

    return () => {
      source.close();
    };
  }, [issueId, onEventError, queryClient]);

  return query;
}
