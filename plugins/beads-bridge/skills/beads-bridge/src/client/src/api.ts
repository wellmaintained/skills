import type {
  BeadsIssueResponse,
  CreateSubtaskPayload,
  IssueResponse,
  IssueStatus,
} from './types';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = typeof errorBody.error === 'string' ? errorBody.error : response.statusText;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function fetchIssueState(issueId: string): Promise<IssueResponse> {
  return handleResponse<IssueResponse>(await fetch(`/api/issue/${issueId}`));
}

export async function updateIssueStatus(issueId: string, status: IssueStatus): Promise<void> {
  await handleResponse(
    await fetch(`/api/issue/${issueId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  );
}

export async function createSubtask(
  parentId: string,
  payload: CreateSubtaskPayload
): Promise<BeadsIssueResponse> {
  return handleResponse<BeadsIssueResponse>(
    await fetch(`/api/issue/${parentId}/create-child`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  );
}

export async function reparentIssue(issueId: string, newParentId: string): Promise<void> {
  await handleResponse(
    await fetch(`/api/issue/${issueId}/reparent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newParentId }),
    })
  );
}
