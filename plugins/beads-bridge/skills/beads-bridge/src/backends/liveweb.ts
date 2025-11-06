import type { ProjectManagementBackend } from '../types/backend.js';
import type {
  Comment,
  CreateIssueParams,
  Issue,
  IssueUpdate,
  LinkedIssue,
  LinkType,
  SearchQuery,
} from '../types/core.js';
import { NotFoundError, NotSupportedError } from '../types/errors.js';
import type { SSEBroadcaster } from '../server/sse-broadcaster.js';

export interface IssueState {
  diagram: string;
  metrics: {
    total: number;
    completed: number;
    inProgress: number;
    blocked: number;
    open: number;
  };
  issues: Issue[];
  lastUpdate: Date;
}

export class LiveWebBackend implements ProjectManagementBackend {
  readonly name = 'liveweb';
  readonly supportsProjects = false;
  readonly supportsSubIssues = false;
  readonly supportsCustomFields = false;

  private state = new Map<string, IssueState>();
  private broadcaster?: SSEBroadcaster;

  setBroadcaster(broadcaster: SSEBroadcaster): void {
    this.broadcaster = broadcaster;
  }

  updateState(issueId: string, state: IssueState): void {
    this.state.set(issueId, state);

    if (this.broadcaster) {
      this.broadcaster.broadcast({
        type: 'update',
        issueId,
        data: state,
      });
    }
  }

  getState(issueId: string): IssueState | undefined {
    return this.state.get(issueId);
  }

  // Read-only operations
  async authenticate(): Promise<void> {
    // No-op, always authenticated
  }

  isAuthenticated(): boolean {
    return true;
  }

  async getIssue(issueId: string): Promise<Issue> {
    const state = this.state.get(issueId);
    if (!state) {
      throw new NotFoundError(`Issue not found: ${issueId}`);
    }

    const issue = state.issues.find((i) => i.id === issueId);
    if (!issue) {
      throw new NotFoundError(`Issue not found in state: ${issueId}`);
    }

    return issue;
  }

  async searchIssues(query: SearchQuery): Promise<Issue[]> {
    const allIssues: Issue[] = [];

    for (const state of this.state.values()) {
      allIssues.push(...state.issues);
    }

    return allIssues.filter((issue) => {
      if (query.state && issue.state !== query.state) return false;
      if (query.text && !issue.title.toLowerCase().includes(query.text.toLowerCase())) return false;
      return true;
    });
  }

  async listComments(_issueId: string): Promise<Comment[]> {
    // Dashboard doesn't use comments
    return [];
  }

  async getLinkedIssues(_issueId: string): Promise<LinkedIssue[]> {
    // Not implemented for dashboard
    return [];
  }

  // Unsupported write operations
  async createIssue(_params: CreateIssueParams): Promise<Issue> {
    throw new NotSupportedError('createIssue');
  }

  async updateIssue(_issueId: string, _updates: IssueUpdate): Promise<Issue> {
    throw new NotSupportedError('updateIssue');
  }

  async addComment(_issueId: string, _comment: string): Promise<Comment> {
    throw new NotSupportedError('addComment');
  }

  async linkIssues(_parentId: string, _childId: string, _linkType: LinkType): Promise<void> {
    throw new NotSupportedError('linkIssues');
  }
}
