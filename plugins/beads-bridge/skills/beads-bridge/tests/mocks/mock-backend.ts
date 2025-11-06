/**
 * Mock implementation of ProjectManagementBackend for testing
 */

import type {
  Comment,
  CreateIssueParams,
  Issue,
  IssueUpdate,
  LinkedIssue,
  LinkType,
  ProjectManagementBackend,
  SearchQuery,
  User
} from '../../src/types/index.js';
import { NotFoundError, ValidationError } from '../../src/types/index.js';

export class MockBackend implements ProjectManagementBackend {
  readonly name = 'mock';
  readonly supportsProjects = true;
  readonly supportsSubIssues = true;
  readonly supportsCustomFields = true;

  private authenticated = true;
  private issues = new Map<string, Issue>();
  private comments = new Map<string, Comment[]>();
  private links = new Map<string, LinkedIssue[]>();
  private projects = new Map<string, Set<string>>();
  private projectFields = new Map<string, Map<string, unknown>>();
  private nextNumber = 1;

  // Test helpers
  reset(): void {
    this.issues.clear();
    this.comments.clear();
    this.links.clear();
    this.projects.clear();
    this.projectFields.clear();
    this.nextNumber = 1;
    this.authenticated = true;
  }

  setAuthenticated(auth: boolean): void {
    this.authenticated = auth;
  }

  // Authentication
  async authenticate(): Promise<void> {
    this.authenticated = true;
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  // Issue Operations
  async createIssue(params: CreateIssueParams): Promise<Issue> {
    if (!this.authenticated) {
      throw new Error('Not authenticated');
    }

    if (!params.title) {
      throw new ValidationError('Title is required');
    }

    const id = `mock-${this.nextNumber}`;
    const issue: Issue = {
      id,
      number: this.nextNumber++,
      title: params.title,
      body: params.body || '',
      state: 'open',
      assignees: params.assignees?.map(login => ({ id: login, login })) || [],
      labels: params.labels?.map(name => ({ id: name, name })) || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      url: `https://mock.test/issue/${id}`,
      metadata: params.metadata || {}
    };

    this.issues.set(id, issue);

    if (params.projectId) {
      await this.addToProject?.(id, params.projectId);
    }

    return issue;
  }

  async getIssue(issueId: string): Promise<Issue> {
    const issue = this.issues.get(issueId);
    if (!issue) {
      throw new NotFoundError(`Issue ${issueId} not found`);
    }
    return issue;
  }

  async updateIssue(issueId: string, updates: IssueUpdate): Promise<Issue> {
    const issue = await this.getIssue(issueId);

    if (updates.title !== undefined) issue.title = updates.title;
    if (updates.body !== undefined) issue.body = updates.body;
    if (updates.state !== undefined) issue.state = updates.state;
    if (updates.assignees !== undefined) {
      issue.assignees = updates.assignees.map(login => ({ id: login, login }));
    }
    if (updates.labels !== undefined) {
      issue.labels = updates.labels.map(name => ({ id: name, name }));
    }
    if (updates.metadata !== undefined) {
      issue.metadata = { ...issue.metadata, ...updates.metadata };
    }

    issue.updatedAt = new Date();
    this.issues.set(issueId, issue);

    return issue;
  }

  // Comments
  async addComment(issueId: string, comment: string): Promise<Comment> {
    await this.getIssue(issueId); // Verify issue exists

    const commentObj: Comment = {
      id: `comment-${Date.now()}`,
      body: comment,
      author: { id: 'mock-user', login: 'mockuser' },
      createdAt: new Date(),
      updatedAt: new Date(),
      url: `https://mock.test/comment/${Date.now()}`
    };

    const existing = this.comments.get(issueId) || [];
    existing.push(commentObj);
    this.comments.set(issueId, existing);

    return commentObj;
  }

  async listComments(issueId: string): Promise<Comment[]> {
    await this.getIssue(issueId); // Verify issue exists
    return this.comments.get(issueId) || [];
  }

  // Relationships
  async linkIssues(parentId: string, childId: string, linkType: LinkType): Promise<void> {
    const parent = await this.getIssue(parentId);
    const child = await this.getIssue(childId);

    // Add to parent's links
    const parentLinks = this.links.get(parentId) || [];
    parentLinks.push({
      issue: child,
      linkType: linkType === 'parent-child' ? 'child' : 'blocks'
    });
    this.links.set(parentId, parentLinks);

    // Add reverse link to child
    const childLinks = this.links.get(childId) || [];
    childLinks.push({
      issue: parent,
      linkType: linkType === 'parent-child' ? 'parent' : 'blocked-by'
    });
    this.links.set(childId, childLinks);
  }

  async getLinkedIssues(issueId: string): Promise<LinkedIssue[]> {
    await this.getIssue(issueId); // Verify issue exists
    return this.links.get(issueId) || [];
  }

  // Project Operations
  async addToProject(issueId: string, projectId: string): Promise<void> {
    await this.getIssue(issueId); // Verify issue exists

    const projectIssues = this.projects.get(projectId) || new Set();
    projectIssues.add(issueId);
    this.projects.set(projectId, projectIssues);
  }

  async updateProjectField(
    issueId: string,
    fieldName: string,
    value: unknown
  ): Promise<void> {
    await this.getIssue(issueId); // Verify issue exists

    const fields = this.projectFields.get(issueId) || new Map();
    fields.set(fieldName, value);
    this.projectFields.set(issueId, fields);
  }

  async getProjectItems(projectId: string): Promise<Issue[]> {
    const issueIds = this.projects.get(projectId);
    if (!issueIds) return [];

    const issues: Issue[] = [];
    for (const id of issueIds) {
      try {
        issues.push(await this.getIssue(id));
      } catch {
        // Issue was deleted, skip
      }
    }
    return issues;
  }

  // Search
  async searchIssues(query: SearchQuery): Promise<Issue[]> {
    let results = Array.from(this.issues.values());

    if (query.text) {
      const text = query.text.toLowerCase();
      results = results.filter(
        issue =>
          issue.title.toLowerCase().includes(text) ||
          issue.body.toLowerCase().includes(text)
      );
    }

    if (query.state && query.state !== 'all') {
      results = results.filter(issue => issue.state === query.state);
    }

    if (query.labels && query.labels.length > 0) {
      results = results.filter(issue =>
        query.labels!.every(label =>
          issue.labels.some(l => l.name === label)
        )
      );
    }

    if (query.assignee) {
      results = results.filter(issue =>
        issue.assignees.some(a => a.login === query.assignee)
      );
    }

    return results;
  }

  // Test helpers
  getProjectField(issueId: string, fieldName: string): unknown {
    return this.projectFields.get(issueId)?.get(fieldName);
  }

  getAllIssues(): Issue[] {
    return Array.from(this.issues.values());
  }
}
