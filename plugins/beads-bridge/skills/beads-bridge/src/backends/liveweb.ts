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
import { NotFoundError, NotSupportedError, ValidationError } from '../types/errors.js';
import type { SSEBroadcaster } from '../server/sse-broadcaster.js';
import { execBdCommand } from '../utils/bd-cli.js';
import type { BeadsIssue, BeadsIssueType, BeadsPriority, BeadsStatus } from '../types/beads.js';

export interface IssueGraphEdge {
  id: string;
  source: string;
  target: string;
}

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
  edges: IssueGraphEdge[];
  rootId: string;
  lastUpdate: Date;
}

export interface CreateSubtaskParams {
  title: string;
  type: BeadsIssueType;
  priority: BeadsPriority;
  description?: string;
  status?: BeadsStatus;
}

type BdCommandRunner = (args: string[]) => Promise<string>;

export class LiveWebBackend implements ProjectManagementBackend {
  readonly name = 'liveweb';
  readonly supportsProjects = false;
  readonly supportsSubIssues = false;
  readonly supportsCustomFields = false;

  private state = new Map<string, IssueState>();
  private broadcaster?: SSEBroadcaster;

  constructor(private readonly runCommand: BdCommandRunner = execBdCommand) {}

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

  private findIssueEntry(issueId: string): { rootId: string; state: IssueState; issue: Issue } | undefined {
    for (const [rootId, state] of this.state.entries()) {
      const issue = state.issues.find((i) => i.id === issueId);
      if (issue) {
        return { rootId, state, issue };
      }
    }
    return undefined;
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

  async updateIssueStatus(issueId: string, status: BeadsStatus): Promise<void> {
    if (!issueId) {
      throw new ValidationError('issueId is required for status updates');
    }
    if (!status) {
      throw new ValidationError('status is required');
    }

    await this.runCommand(['update', issueId, '--status', status]);
  }

  async createSubtask(parentId: string, params: CreateSubtaskParams): Promise<BeadsIssue> {
    if (!parentId) {
      throw new ValidationError('parentId is required');
    }

    if (!params.title) {
      throw new ValidationError('title is required to create a subtask');
    }

    if (!params.type) {
      throw new ValidationError('type is required to create a subtask');
    }

    if (params.priority === undefined || params.priority === null) {
      throw new ValidationError('priority is required to create a subtask');
    }

    const args = ['create', params.title, '-t', params.type, '-p', params.priority.toString(), '--json'];

    if (params.description) {
      args.push('-d', params.description);
    }

    if (params.status) {
      args.push('--status', params.status);
    }

    const raw = await this.runCommand(args);
    const createdIssue = JSON.parse(raw.trim()) as BeadsIssue;

    await this.runCommand(['dep', 'add', createdIssue.id, parentId, '-t', 'parent-child']);

    return createdIssue;
  }

  async reparentIssue(issueId: string, newParentId: string): Promise<void> {
    if (!issueId) {
      throw new ValidationError('issueId is required to reparent');
    }

    if (!newParentId) {
      throw new ValidationError('newParentId is required to reparent');
    }

    const entry = this.findIssueEntry(issueId);
    const currentParentId =
      entry && typeof entry.issue.metadata?.parentId === 'string'
        ? (entry.issue.metadata.parentId as string)
        : null;

    if (currentParentId === newParentId) {
      return;
    }

    if (currentParentId) {
      let removed = false;

      try {
        await this.runCommand(['dep', 'remove', issueId, currentParentId]);
        removed = true;
      } catch (error) {
        if (!isMissingDependencyError(error)) {
          throw error;
        }
      }

      if (!removed) {
        try {
          await this.runCommand(['dep', 'remove', currentParentId, issueId]);
          removed = true;
        } catch (error) {
          if (!isMissingDependencyError(error)) {
            throw error;
          }
        }
      }
    }

    await this.runCommand(['dep', 'add', issueId, newParentId, '-t', 'parent-child']);
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
function isMissingDependencyError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message || '';
  return /does not exist/i.test(message) || /failed to dep remove/i.test(message);
}
