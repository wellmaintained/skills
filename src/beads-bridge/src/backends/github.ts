/**
 * GitHub Projects v2 Backend Implementation
 *
 * Implements ProjectManagementBackend using Octokit and
 * GitHub's GraphQL API for Projects v2.
 */

import type {
  Comment,
  CreateIssueParams,
  Issue,
  IssueUpdate,
  LinkedIssue,
  ProjectManagementBackend,
  SearchQuery
} from '../types/index.js';
import { LinkType, AuthenticationError, NotFoundError, ValidationError, BackendError } from '../types/index.js';
import { Octokit } from 'octokit';
import type { Credentials } from '../auth/credential-store.js';

export interface GitHubBackendConfig {
  /** Default organization or user (e.g., "acme-corp") */
  defaultOrg?: string;

  /** Default repository (e.g., "acme-corp/api-server") */
  defaultRepo?: string;

  /** Default project number */
  defaultProject?: {
    owner: string;
    number: number;
  };

  /** Credentials for authentication */
  credentials?: Credentials;
}

/**
 * GitHub Backend implementation using Octokit
 */
export class GitHubBackend implements ProjectManagementBackend {
  readonly name = 'github';
  readonly supportsProjects = true;
  readonly supportsSubIssues = true;
  readonly supportsCustomFields = true;

  private readonly octokit: Octokit;
  private readonly config: GitHubBackendConfig;
  private authenticated = false;

  constructor(config: GitHubBackendConfig = {}) {
    this.config = config;

    // Initialize Octokit with credentials if available
    const token = config.credentials?.github?.token;
    this.octokit = new Octokit({
      auth: token
    });
  }

  // ============================================================================
  // Authentication
  // ============================================================================

  async authenticate(): Promise<void> {
    // Check if we have credentials
    if (!this.config.credentials?.github?.token) {
      throw new AuthenticationError(
        'Not authenticated with GitHub. Run: beads-bridge auth github'
      );
    }

    // Verify token works by making a test API call
    try {
      await this.octokit.rest.users.getAuthenticated();
      this.authenticated = true;
    } catch (error: any) {
      if (error.status === 401) {
        throw new AuthenticationError(
          'GitHub token is invalid or expired. Run: beads-bridge auth github'
        );
      }
      throw new AuthenticationError(
        `GitHub authentication failed: ${error.message}`
      );
    }
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  private ensureAuthenticated(): void {
    if (!this.authenticated) {
      throw new AuthenticationError(
        'Not authenticated. Call authenticate() first.'
      );
    }
  }

  // ============================================================================
  // Issue Operations
  // ============================================================================

  async createIssue(params: CreateIssueParams): Promise<Issue> {
    this.ensureAuthenticated();

    if (!params.title) {
      throw new ValidationError('Issue title is required');
    }

    const repo = params.repository || this.config.defaultRepo;
    if (!repo) {
      throw new ValidationError(
        'Repository is required (either in params or config.defaultRepo)'
      );
    }

    // Parse owner/repo
    const [owner, repoName] = repo.split('/');
    if (!owner || !repoName) {
      throw new ValidationError(`Invalid repository format: ${repo}. Expected: owner/repo`);
    }

    try {
      const { data } = await this.octokit.rest.issues.create({
        owner,
        repo: repoName,
        title: params.title,
        body: params.body || '',
        assignees: params.assignees,
        labels: params.labels
      });

      const issue = this.parseOctokitIssue(data, repo);

      // Add to project if specified
      if (params.projectId) {
        await this.addToProject(issue.id, params.projectId);
      }

      return issue;
    } catch (error: any) {
      if (error.status === 404) {
        throw new NotFoundError(`Repository ${repo} not found`);
      } else if (error.status === 403) {
        throw new AuthenticationError('Permission denied. Check token scopes.');
      }
      throw new BackendError(`Failed to create issue: ${error.message}`, 'CREATE_FAILED');
    }
  }

  async getIssue(issueId: string): Promise<Issue> {
    this.ensureAuthenticated();

    // Check if issueId is in owner/repo#number format or a node ID
    const repoIssueMatch = issueId.match(/^([^/]+\/[^#]+)#(\d+)$/);
    if (repoIssueMatch) {
      const [, repo, issueNumber] = repoIssueMatch;
      return this.getIssueByNumber(repo, parseInt(issueNumber));
    }

    // Use GraphQL to get issue by node ID
    const query = `
      query($id: ID!) {
        node(id: $id) {
          ... on Issue {
            id
            number
            title
            body
            state
            createdAt
            updatedAt
            url
            repository {
              nameWithOwner
            }
            assignees(first: 100) {
              nodes {
                id
                login
                name
              }
            }
            labels(first: 100) {
              nodes {
                id
                name
                color
                description
              }
            }
          }
        }
      }
    `;

    try {
      const data: any = await this.octokit.graphql(query, { id: issueId });

      if (!data.node) {
        throw new NotFoundError(`Issue ${issueId} not found`);
      }

      return this.parseGraphQLIssue(data.node);
    } catch (error: any) {
      if (error.status === 404 || error.message?.includes('not found')) {
        throw new NotFoundError(`Issue ${issueId} not found`);
      }
      throw new BackendError(`Failed to get issue: ${error.message}`, 'GET_FAILED');
    }
  }

  async getIssueByNumber(repository: string, issueNumber: number): Promise<Issue> {
    this.ensureAuthenticated();

    const [owner, repo] = repository.split('/');
    if (!owner || !repo) {
      throw new ValidationError(`Invalid repository format: ${repository}`);
    }

    try {
      const { data } = await this.octokit.rest.issues.get({
        owner,
        repo,
        issue_number: issueNumber
      });

      return this.parseOctokitIssue(data, repository);
    } catch (error: any) {
      if (error.status === 404) {
        throw new NotFoundError(`Issue ${repository}#${issueNumber} not found`);
      }
      throw new BackendError(`Failed to get issue: ${error.message}`, 'GET_FAILED');
    }
  }

  async updateIssue(issueId: string, updates: IssueUpdate): Promise<Issue> {
    this.ensureAuthenticated();

    // First get the issue to extract repo and number
    const issue = await this.getIssue(issueId);
    const repoMatch = issue.url.match(/github\.com\/([^/]+\/[^/]+)\//);
    if (!repoMatch) {
      throw new BackendError('Could not extract repository from issue URL', 'INVALID_URL');
    }
    const repo = repoMatch[1];
    const [owner, repoName] = repo.split('/');

    try {
      // Build update params
      const updateParams: any = {
        owner,
        repo: repoName,
        issue_number: issue.number
      };

      if (updates.title !== undefined) {
        updateParams.title = updates.title;
      }

      if (updates.body !== undefined) {
        updateParams.body = updates.body;
      }

      if (updates.state !== undefined) {
        updateParams.state = updates.state === 'closed' ? 'closed' : 'open';
      }

      if (updates.assignees !== undefined) {
        updateParams.assignees = updates.assignees;
      }

      if (updates.labels !== undefined) {
        updateParams.labels = updates.labels;
      }

      const { data } = await this.octokit.rest.issues.update(updateParams);

      return this.parseOctokitIssue(data, repo);
    } catch (error: any) {
      if (error.status === 404) {
        throw new NotFoundError(`Issue ${issueId} not found`);
      } else if (error.status === 403) {
        throw new AuthenticationError('Permission denied. Check token scopes.');
      }
      throw new BackendError(`Failed to update issue: ${error.message}`, 'UPDATE_FAILED');
    }
  }

  // ============================================================================
  // Comments
  // ============================================================================

  async addComment(issueId: string, comment: string): Promise<Comment> {
    this.ensureAuthenticated();

    // Get issue to extract repo and number
    const issue = await this.getIssue(issueId);
    const repoMatch = issue.url.match(/github\.com\/([^/]+\/[^/]+)\//);
    if (!repoMatch) {
      throw new BackendError('Could not extract repository from issue URL', 'INVALID_URL');
    }

    const [owner, repo] = repoMatch[1].split('/');

    try {
      const { data } = await this.octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: issue.number,
        body: comment
      });

      return this.parseOctokitComment(data);
    } catch (error: any) {
      if (error.status === 404) {
        throw new NotFoundError(`Issue ${issueId} not found`);
      } else if (error.status === 403) {
        throw new AuthenticationError('Permission denied. Check token scopes.');
      }
      throw new BackendError(`Failed to add comment: ${error.message}`, 'COMMENT_FAILED');
    }
  }

  async listComments(issueId: string): Promise<Comment[]> {
    this.ensureAuthenticated();

    // Parse issueId as owner/repo#number
    const match = issueId.match(/^([^/]+)\/([^#]+)#(\d+)$/);
    if (!match) {
      throw new ValidationError(`Invalid issueId format: ${issueId}. Expected: owner/repo#number`);
    }

    const [, owner, repo, numberStr] = match;
    const issueNumber = parseInt(numberStr);

    try {
      const { data } = await this.octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: issueNumber
      });

      return data.map((c: any) => this.parseOctokitComment(c));
    } catch (error: any) {
      if (error.status === 404) {
        throw new NotFoundError(`Issue ${issueId} not found`);
      }
      throw new BackendError(`Failed to list comments: ${error.message}`, 'LIST_FAILED');
    }
  }

  // ============================================================================
  // Relationships (to be continued in next part)
  // ============================================================================

  async linkIssues(parentId: string, childId: string, linkType: LinkType): Promise<void> {
    this.ensureAuthenticated();

    // GitHub doesn't have native issue linking, so we add a comment
    let linkText: string;
    switch (linkType) {
      case LinkType.BLOCKS:
        linkText = 'Blocks';
        break;
      case LinkType.PARENT_CHILD:
        linkText = 'Parent of';
        break;
      case LinkType.RELATED:
        linkText = 'Related to';
        break;
      default: {
        // Exhaustive check - this should never happen
        const exhaustiveCheck: never = linkType;
        throw new ValidationError(`Unknown link type: ${exhaustiveCheck}`);
      }
    }
    const comment = `${linkText} ${childId}`;

    await this.addComment(parentId, comment);
  }

  async getLinkedIssues(issueId: string): Promise<LinkedIssue[]> {
    this.ensureAuthenticated();

    // Get all comments and parse for issue references
    const comments = await this.listComments(issueId);
    const linkedIssues: LinkedIssue[] = [];

    for (const comment of comments) {
      // Look for "Blocks owner/repo#123", "Related to owner/repo#456", or "Parent of owner/repo#789"
      const blockMatch = comment.body.match(/Blocks\s+([^/\s]+\/[^#\s]+#\d+)/);
      if (blockMatch) {
        // Create minimal issue stub - full implementation would fetch the issue
        const linkedIssueId = blockMatch[1];
        linkedIssues.push({
          issue: {
            id: linkedIssueId,
            number: 0, // Would need to parse or fetch
            title: '',
            body: '',
            state: 'open' as const,
            assignees: [],
            labels: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            url: '',
            metadata: {}
          },
          linkType: 'blocks'
        });
      }

      const relatedMatch = comment.body.match(/Related to\s+([^/\s]+\/[^#\s]+#\d+)/);
      if (relatedMatch) {
        const linkedIssueId = relatedMatch[1];
        linkedIssues.push({
          issue: {
            id: linkedIssueId,
            number: 0,
            title: '',
            body: '',
            state: 'open' as const,
            assignees: [],
            labels: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            url: '',
            metadata: {}
          },
          linkType: 'relates-to'
        });
      }

      const parentMatch = comment.body.match(/Parent of\s+([^/\s]+\/[^#\s]+#\d+)/);
      if (parentMatch) {
        const linkedIssueId = parentMatch[1];
        linkedIssues.push({
          issue: {
            id: linkedIssueId,
            number: 0,
            title: '',
            body: '',
            state: 'open' as const,
            assignees: [],
            labels: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            url: '',
            metadata: {}
          },
          linkType: 'child'
        });
      }
    }

    return linkedIssues;
  }

  // ============================================================================
  // Search (to be continued)
  // ============================================================================

  async searchIssues(query: SearchQuery): Promise<Issue[]> {
    this.ensureAuthenticated();

    // Build GitHub search query
    const parts: string[] = [];

    if (query.text) {
      parts.push(query.text);
    }

    if (query.repository) {
      parts.push(`repo:${query.repository}`);
    }

    if (query.state && query.state !== 'all') {
      parts.push(`state:${query.state}`);
    }

    if (query.labels && query.labels.length > 0) {
      parts.push(...query.labels.map(label => `label:"${label}"`));
    }

    if (query.assignee) {
      parts.push(`assignee:${query.assignee}`);
    }

    const searchQuery = parts.join(' ');

    try {
      const { data } = await this.octokit.rest.search.issuesAndPullRequests({
        q: searchQuery,
        per_page: 100
      });

      // Filter out pull requests (we only want issues)
      const issues = data.items.filter((item: any) => !item.pull_request);

      return issues.map((item: any) => {
         // Extract owner/repo from repository_url
         const repoMatch = item.repository_url?.match(/repos\/([^/]+\/[^/]+)$/);
        const repository = repoMatch ? repoMatch[1] : query.repository || '';

        return this.parseOctokitIssue(item, repository);
      });
    } catch (error: any) {
      throw new BackendError(`Failed to search issues: ${error.message}`, 'SEARCH_FAILED');
    }
  }

  // ============================================================================
  // Project Operations (to be implemented next)
  // ============================================================================

  async addToProject(issueId: string, projectId: string): Promise<void> {
    this.ensureAuthenticated();

    // Get issue to get its node ID
    const issue = await this.getIssue(issueId);

    const mutation = `
      mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
          item {
            id
          }
        }
      }
    `;

    try {
      await this.octokit.graphql(mutation, {
        projectId,
        contentId: issue.id
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        throw new NotFoundError(`Project ${projectId} not found`);
      } else if (error.status === 403) {
        throw new AuthenticationError('Permission denied. Need read:project scope.');
      }
      throw new BackendError(`Failed to add to project: ${error.message}`, 'PROJECT_ADD_FAILED');
    }
  }

  async updateProjectField(
    _issueId: string,
    _fieldName: string,
    _value: unknown
  ): Promise<void> {
    this.ensureAuthenticated();

    // This is a placeholder - actual implementation would require:
    // 1. Get project field ID by name
    // 2. Get project item ID for this issue
    // 3. Update the field value
    // This is complex and depends on project structure

    throw new BackendError(
      'updateProjectField not yet implemented for Octokit',
      'NOT_IMPLEMENTED'
    );
  }

  async getProjectItems(projectId: string): Promise<Issue[]> {
    this.ensureAuthenticated();

    const query = `
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: 100) {
              nodes {
                id
                content {
                  ... on Issue {
                    id
                    number
                    title
                    body
                    state
                    createdAt
                    updatedAt
                    url
                    repository {
                      nameWithOwner
                    }
                    assignees(first: 100) {
                      nodes {
                        id
                        login
                        name
                      }
                    }
                    labels(first: 100) {
                      nodes {
                        id
                        name
                        color
                        description
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const data: any = await this.octokit.graphql(query, { projectId });

      if (!data.node || !data.node.items) {
        return [];
      }

      return data.node.items.nodes
        .filter((item: any) => item.content) // Filter out items without content
        .map((item: any) => this.parseGraphQLIssue(item.content));
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        throw new NotFoundError(`Project ${projectId} not found`);
      } else if (error.status === 403) {
        throw new AuthenticationError('Permission denied. Need read:project scope.');
      }
      throw new BackendError(`Failed to get project items: ${error.message}`, 'PROJECT_GET_FAILED');
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Parse Octokit REST API issue response to our Issue type
   */
  private parseOctokitIssue(data: any, repository: string): Issue {
    return {
      id: data.node_id,
      number: data.number,
      title: data.title,
      body: data.body || '',
      state: data.state,
      url: data.html_url,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      assignees: data.assignees?.map((a: any) => ({
        id: a.node_id,
        login: a.login,
        name: a.name || a.login
      })) || [],
      labels: data.labels?.map((l: any) => ({
        id: l.node_id || l.id?.toString(),
        name: l.name,
        color: l.color,
        description: l.description
      })) || [],
      metadata: {
        repository
      }
    };
  }

  /**
   * Parse Octokit comment response to our Comment type
   */
  private parseOctokitComment(data: any): Comment {
    return {
      id: data.node_id,
      body: data.body,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      author: data.user ? {
        id: data.user.node_id,
        login: data.user.login,
        name: data.user.name || data.user.login
      } : {
        id: 'unknown',
        login: 'unknown',
        name: 'Unknown'
      }
    };
  }

  /**
   * Parse GraphQL issue response to our Issue type
   */
  private parseGraphQLIssue(node: any): Issue {
    return {
      id: node.id,
      number: node.number,
      title: node.title,
      body: node.body || '',
      state: node.state.toLowerCase(),
      url: node.url,
      createdAt: new Date(node.createdAt),
      updatedAt: new Date(node.updatedAt),
      assignees: node.assignees?.nodes?.map((a: any) => ({
        id: a.id,
        login: a.login,
        name: a.name || a.login
      })) || [],
      labels: node.labels?.nodes?.map((l: any) => ({
        id: l.id,
        name: l.name,
        color: l.color,
        description: l.description
      })) || [],
      metadata: {
        repository: node.repository?.nameWithOwner
      }
    };
  }
}
