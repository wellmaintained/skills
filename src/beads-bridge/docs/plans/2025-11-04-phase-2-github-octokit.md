# Phase 2: GitHub Backend Rewrite with Octokit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all `gh` CLI calls in GitHubBackend with direct Octokit SDK calls to eliminate CLI dependencies.

**Architecture:** Convert GitHubBackend from using GhCli wrapper (subprocess calls to `gh`) to using Octokit REST and GraphQL APIs directly. Maintain the existing ProjectManagementBackend interface contract so consumers remain unchanged.

**Tech Stack:** Octokit v3.2+ (already installed), TypeScript, Vitest for testing

---

## Context

**Current Architecture:**
- `src/backends/github.ts` (661 lines) - Uses `GhCli` wrapper for all GitHub operations
- `src/utils/gh-cli.ts` (312 lines) - Wrapper that spawns `gh` CLI subprocess
- 13 async methods use gh CLI: authenticate, createIssue, getIssue, getIssueByNumber, updateIssue, addComment, listComments, linkIssues, getLinkedIssues, searchIssues, addToProject, updateProjectField, getProjectItems
- GraphQL used via gh CLI for Projects v2 and some issue queries

**Target Architecture:**
- Replace `GhCli` with `Octokit` client
- Use `octokit.rest.*` for REST API operations
- Use `octokit.graphql()` for GraphQL operations
- Load credentials from `CredentialStore` (from Phase 1)
- Maintain all existing interfaces and method signatures

**Dependencies:**
- Phase 1 complete (authentication infrastructure available)
- Octokit already installed (added in Phase 1)

---

## Task 1: Update Constructor and Authentication

**Files:**
- Modify: `.claude/skills/beads-bridge/src/backends/github.ts:1-90`
- Modify: `.claude/skills/beads-bridge/tests/backends/github.test.ts` (or create if not exists)

### Step 1: Write failing test for Octokit initialization

Create or update test file:

```typescript
// tests/backends/github.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubBackend } from '../../src/backends/github.js';
import { Octokit } from 'octokit';

// Mock Octokit
vi.mock('octokit');

describe('GitHubBackend with Octokit', () => {
  let backend: GitHubBackend;
  let mockOctokit: any;

  beforeEach(() => {
    mockOctokit = {
      rest: {
        users: {
          getAuthenticated: vi.fn()
        }
      }
    };
    (Octokit as any).mockImplementation(() => mockOctokit);
  });

  it('should initialize with credentials', async () => {
    const credentials = {
      github: {
        token: 'test_token_123',
        scopes: ['repo', 'read:org']
      }
    };

    backend = new GitHubBackend({ credentials });

    expect(Octokit).toHaveBeenCalledWith({
      auth: 'test_token_123'
    });
  });

  it('should authenticate successfully', async () => {
    const credentials = {
      github: {
        token: 'test_token_123',
        scopes: ['repo']
      }
    };

    mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
      data: { login: 'testuser' }
    });

    backend = new GitHubBackend({ credentials });
    await backend.authenticate();

    expect(backend.isAuthenticated()).toBe(true);
    expect(mockOctokit.rest.users.getAuthenticated).toHaveBeenCalled();
  });

  it('should throw error if not authenticated', async () => {
    backend = new GitHubBackend({});

    await expect(backend.authenticate()).rejects.toThrow('Not authenticated with GitHub');
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test tests/backends/github.test.ts`

Expected: FAIL - Constructor signature mismatch, Octokit not imported

### Step 3: Update GitHubBackend constructor and authentication

Modify the github.ts file:

```typescript
// src/backends/github.ts
import type {
  Comment,
  CreateIssueParams,
  Issue,
  IssueUpdate,
  LinkedIssue,
  LinkType,
  ProjectManagementBackend,
  SearchQuery,
  User,
  Label
} from '../types/index.js';
import { AuthenticationError, NotFoundError, ValidationError, BackendError } from '../types/index.js';
import { Octokit } from 'octokit';
import type { Credentials } from '../auth/credential-store.js';
import * as GitHubProjects from './github-projects.js';

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
  private projectCache = new Map<string, any>();

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

  // ... rest of methods will be updated in following tasks
}
```

### Step 4: Run tests to verify they pass

Run: `npm test tests/backends/github.test.ts`

Expected: All authentication tests PASS

### Step 5: Commit constructor and authentication changes

```bash
git add src/backends/github.ts tests/backends/github.test.ts
git commit -m "refactor(github): replace GhCli with Octokit initialization

- Replace GhCli wrapper with Octokit client
- Update constructor to accept credentials from Phase 1
- Implement authentication via octokit.rest.users.getAuthenticated()
- Update tests to mock Octokit instead of gh CLI
- Remove gh CLI dependency from authentication flow

🤖 Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 2: Convert Issue CRUD Operations (createIssue, getIssue, updateIssue)

**Files:**
- Modify: `.claude/skills/beads-bridge/src/backends/github.ts:96-270`
- Update: `.claude/skills/beads-bridge/tests/backends/github.test.ts`

### Step 1: Write failing tests for issue operations

Add to test file:

```typescript
describe('Issue Operations', () => {
  beforeEach(async () => {
    const credentials = {
      github: { token: 'test_token', scopes: ['repo'] }
    };
    mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
      data: { login: 'testuser' }
    });
    backend = new GitHubBackend({ credentials, defaultRepo: 'owner/repo' });
    await backend.authenticate();
  });

  it('should create issue with Octokit', async () => {
    mockOctokit.rest.issues.create.mockResolvedValue({
      data: {
        id: 123,
        node_id: 'I_kwDOTest',
        number: 42,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        created_at: '2025-11-04T00:00:00Z',
        updated_at: '2025-11-04T00:00:00Z',
        html_url: 'https://github.com/owner/repo/issues/42',
        assignees: [],
        labels: []
      }
    });

    const issue = await backend.createIssue({
      title: 'Test Issue',
      body: 'Test body'
    });

    expect(issue.title).toBe('Test Issue');
    expect(issue.number).toBe(42);
    expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      title: 'Test Issue',
      body: 'Test body'
    });
  });

  it('should get issue by number with Octokit', async () => {
    mockOctokit.rest.issues.get.mockResolvedValue({
      data: {
        id: 123,
        node_id: 'I_kwDOTest',
        number: 42,
        title: 'Existing Issue',
        body: 'Issue body',
        state: 'open',
        created_at: '2025-11-04T00:00:00Z',
        updated_at: '2025-11-04T00:00:00Z',
        html_url: 'https://github.com/owner/repo/issues/42',
        assignees: [],
        labels: []
      }
    });

    const issue = await backend.getIssueByNumber('owner/repo', 42);

    expect(issue.title).toBe('Existing Issue');
    expect(mockOctokit.rest.issues.get).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      issue_number: 42
    });
  });

  it('should update issue with Octokit', async () => {
    // First mock getIssue to extract repo
    mockOctokit.rest.issues.get.mockResolvedValue({
      data: {
        id: 123,
        node_id: 'I_kwDOTest',
        number: 42,
        title: 'Old Title',
        body: 'Old body',
        state: 'open',
        created_at: '2025-11-04T00:00:00Z',
        updated_at: '2025-11-04T00:00:00Z',
        html_url: 'https://github.com/owner/repo/issues/42',
        assignees: [],
        labels: []
      }
    });

    // Mock update
    mockOctokit.rest.issues.update.mockResolvedValue({
      data: {
        id: 123,
        node_id: 'I_kwDOTest',
        number: 42,
        title: 'Updated Title',
        body: 'Old body',
        state: 'open',
        created_at: '2025-11-04T00:00:00Z',
        updated_at: '2025-11-04T00:00:01Z',
        html_url: 'https://github.com/owner/repo/issues/42',
        assignees: [],
        labels: []
      }
    });

    const issue = await backend.updateIssue('owner/repo#42', {
      title: 'Updated Title'
    });

    expect(issue.title).toBe('Updated Title');
    expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      issue_number: 42,
      title: 'Updated Title'
    });
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test tests/backends/github.test.ts`

Expected: FAIL - Methods not yet converted to Octokit

### Step 3: Convert createIssue, getIssue, updateIssue to use Octokit

Replace the methods in github.ts:

```typescript
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
  const repoIssueMatch = issueId.match(/^([^\/]+\/[^#]+)#(\d+)$/);
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
  const repoMatch = issue.url.match(/github\.com\/([^\/]+\/[^\/]+)\//);
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
      username: a.login,
      name: a.name || a.login
    })) || [],
    labels: data.labels?.map((l: any) => ({
      id: l.node_id || l.id?.toString(),
      name: l.name,
      color: l.color,
      description: l.description
    })) || [],
    repository
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
      username: a.login,
      name: a.name || a.login
    })) || [],
    labels: node.labels?.nodes?.map((l: any) => ({
      id: l.id,
      name: l.name,
      color: l.color,
      description: l.description
    })) || [],
    repository: node.repository?.nameWithOwner
  };
}
```

### Step 4: Run tests to verify they pass

Run: `npm test tests/backends/github.test.ts`

Expected: All issue CRUD tests PASS

### Step 5: Commit issue operations changes

```bash
git add src/backends/github.ts tests/backends/github.test.ts
git commit -m "refactor(github): convert issue CRUD to Octokit

- Replace gh CLI calls with octokit.rest.issues.* methods
- Implement createIssue, getIssue, getIssueByNumber, updateIssue with Octokit
- Add parseOctokitIssue helper for REST API responses
- Add parseGraphQLIssue helper for GraphQL responses
- Maintain existing interface and error handling
- Update tests to mock Octokit REST API

🤖 Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 3: Convert Comment Operations (addComment, listComments)

**Files:**
- Modify: `.claude/skills/beads-bridge/src/backends/github.ts:271-353`
- Update: `.claude/skills/beads-bridge/tests/backends/github.test.ts`

### Step 1: Write failing tests for comment operations

Add to test file:

```typescript
describe('Comment Operations', () => {
  beforeEach(async () => {
    const credentials = {
      github: { token: 'test_token', scopes: ['repo'] }
    };
    mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
      data: { login: 'testuser' }
    });
    backend = new GitHubBackend({ credentials, defaultRepo: 'owner/repo' });
    await backend.authenticate();
  });

  it('should add comment with Octokit', async () => {
    // Mock getIssue to extract repo
    mockOctokit.rest.issues.get.mockResolvedValue({
      data: {
        node_id: 'I_kwDOTest',
        number: 42,
        html_url: 'https://github.com/owner/repo/issues/42'
      }
    });

    mockOctokit.rest.issues.createComment.mockResolvedValue({
      data: {
        id: 999,
        node_id: 'IC_kwDOTest',
        body: 'Test comment',
        created_at: '2025-11-04T00:00:00Z',
        updated_at: '2025-11-04T00:00:00Z',
        user: {
          id: 1,
          login: 'testuser',
          node_id: 'U_kwTest'
        }
      }
    });

    const comment = await backend.addComment('owner/repo#42', 'Test comment');

    expect(comment.body).toBe('Test comment');
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      issue_number: 42,
      body: 'Test comment'
    });
  });

  it('should list comments with Octokit', async () => {
    mockOctokit.rest.issues.listComments.mockResolvedValue({
      data: [
        {
          id: 1,
          node_id: 'IC_1',
          body: 'First comment',
          created_at: '2025-11-04T00:00:00Z',
          updated_at: '2025-11-04T00:00:00Z',
          user: { id: 1, login: 'user1', node_id: 'U_1' }
        },
        {
          id: 2,
          node_id: 'IC_2',
          body: 'Second comment',
          created_at: '2025-11-04T00:01:00Z',
          updated_at: '2025-11-04T00:01:00Z',
          user: { id: 2, login: 'user2', node_id: 'U_2' }
        }
      ]
    });

    const comments = await backend.listComments('owner/repo#42');

    expect(comments).toHaveLength(2);
    expect(comments[0].body).toBe('First comment');
    expect(mockOctokit.rest.issues.listComments).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      issue_number: 42
    });
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test tests/backends/github.test.ts`

Expected: FAIL - Comment methods not converted

### Step 3: Convert comment methods to use Octokit

Replace methods in github.ts:

```typescript
async addComment(issueId: string, comment: string): Promise<Comment> {
  this.ensureAuthenticated();

  // Get issue to extract repo and number
  const issue = await this.getIssue(issueId);
  const repoMatch = issue.url.match(/github\.com\/([^\/]+\/[^\/]+)\//);
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
  const match = issueId.match(/^([^\/]+)\/([^#]+)#(\d+)$/);
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

    return data.map(c => this.parseOctokitComment(c));
  } catch (error: any) {
    if (error.status === 404) {
      throw new NotFoundError(`Issue ${issueId} not found`);
    }
    throw new BackendError(`Failed to list comments: ${error.message}`, 'LIST_FAILED');
  }
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
      username: data.user.login,
      name: data.user.name || data.user.login
    } : undefined
  };
}
```

### Step 4: Run tests to verify they pass

Run: `npm test tests/backends/github.test.ts`

Expected: All comment tests PASS

### Step 5: Commit comment operations

```bash
git add src/backends/github.ts tests/backends/github.test.ts
git commit -m "refactor(github): convert comment operations to Octokit

- Replace gh CLI with octokit.rest.issues.createComment
- Replace gh CLI with octokit.rest.issues.listComments
- Add parseOctokitComment helper
- Maintain existing error handling
- Update tests to mock Octokit comment APIs

🤖 Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 4: Convert Search and Link Operations

**Files:**
- Modify: `.claude/skills/beads-bridge/src/backends/github.ts:355-448`
- Update: `.claude/skills/beads-bridge/tests/backends/github.test.ts`

### Step 1: Write failing tests for search and link operations

Add to test file:

```typescript
describe('Search and Link Operations', () => {
  beforeEach(async () => {
    const credentials = {
      github: { token: 'test_token', scopes: ['repo'] }
    };
    mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
      data: { login: 'testuser' }
    });
    backend = new GitHubBackend({ credentials, defaultRepo: 'owner/repo' });
    await backend.authenticate();
  });

  it('should search issues with Octokit', async () => {
    mockOctokit.rest.search.issuesAndPullRequests.mockResolvedValue({
      data: {
        items: [
          {
            id: 1,
            node_id: 'I_1',
            number: 1,
            title: 'Issue 1',
            body: 'Body 1',
            state: 'open',
            created_at: '2025-11-04T00:00:00Z',
            updated_at: '2025-11-04T00:00:00Z',
            html_url: 'https://github.com/owner/repo/issues/1',
            repository_url: 'https://api.github.com/repos/owner/repo',
            assignees: [],
            labels: []
          }
        ]
      }
    });

    const results = await backend.searchIssues({
      query: 'test',
      repository: 'owner/repo'
    });

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Issue 1');
    expect(mockOctokit.rest.search.issuesAndPullRequests).toHaveBeenCalled();
  });

  it('should link issues by adding comment', async () => {
    // Mock getIssue for parent
    mockOctokit.rest.issues.get.mockResolvedValue({
      data: {
        node_id: 'I_parent',
        number: 1,
        html_url: 'https://github.com/owner/repo/issues/1'
      }
    });

    // Mock createComment
    mockOctokit.rest.issues.createComment.mockResolvedValue({
      data: {
        id: 1,
        body: 'Blocks owner/repo#2'
      }
    });

    await backend.linkIssues('owner/repo#1', 'owner/repo#2', 'blocks');

    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('Blocks owner/repo#2')
      })
    );
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test tests/backends/github.test.ts`

Expected: FAIL - Methods not yet converted

### Step 3: Convert search and link methods to Octokit

Replace methods in github.ts:

```typescript
async linkIssues(parentId: string, childId: string, linkType: LinkType): Promise<void> {
  this.ensureAuthenticated();

  // GitHub doesn't have native issue linking, so we add a comment
  const linkText = linkType === 'blocks' ? 'Blocks' : 'Related to';
  const comment = `${linkText} ${childId}`;

  await this.addComment(parentId, comment);
}

async getLinkedIssues(issueId: string): Promise<LinkedIssue[]> {
  this.ensureAuthenticated();

  // Get all comments and parse for issue references
  const comments = await this.listComments(issueId);
  const linkedIssues: LinkedIssue[] = [];

  for (const comment of comments) {
    // Look for "Blocks owner/repo#123" or "Related to owner/repo#456"
    const blockMatch = comment.body.match(/Blocks\s+([^\/\s]+\/[^#\s]+#\d+)/);
    if (blockMatch) {
      linkedIssues.push({
        id: blockMatch[1],
        type: 'blocks',
        title: '', // Would need additional API call to get title
        url: ''
      });
    }

    const relatedMatch = comment.body.match(/Related to\s+([^\/\s]+\/[^#\s]+#\d+)/);
    if (relatedMatch) {
      linkedIssues.push({
        id: relatedMatch[1],
        type: 'related',
        title: '',
        url: ''
      });
    }
  }

  return linkedIssues;
}

async searchIssues(query: SearchQuery): Promise<Issue[]> {
  this.ensureAuthenticated();

  // Build GitHub search query
  const parts: string[] = [query.query];

  if (query.repository) {
    parts.push(`repo:${query.repository}`);
  }

  if (query.state) {
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
      per_page: query.limit || 30
    });

    // Filter out pull requests (we only want issues)
    const issues = data.items.filter(item => !item.pull_request);

    return issues.map(item => {
      // Extract owner/repo from repository_url
      const repoMatch = item.repository_url?.match(/repos\/([^\/]+\/[^\/]+)$/);
      const repository = repoMatch ? repoMatch[1] : query.repository || '';

      return this.parseOctokitIssue(item, repository);
    });
  } catch (error: any) {
    throw new BackendError(`Failed to search issues: ${error.message}`, 'SEARCH_FAILED');
  }
}
```

### Step 4: Run tests to verify they pass

Run: `npm test tests/backends/github.test.ts`

Expected: All search and link tests PASS

### Step 5: Commit search and link operations

```bash
git add src/backends/github.ts tests/backends/github.test.ts
git commit -m "refactor(github): convert search and link operations to Octokit

- Replace gh CLI with octokit.rest.search.issuesAndPullRequests
- Implement linkIssues via comments (GitHub doesn't have native links)
- Implement getLinkedIssues by parsing comments
- Maintain existing interface and error handling
- Update tests to mock Octokit search API

🤖 Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 5: Convert GitHub Projects v2 Operations (GraphQL)

**Files:**
- Modify: `.claude/skills/beads-bridge/src/backends/github.ts:449-661`
- Update: `.claude/skills/beads-bridge/tests/backends/github.test.ts`

### Step 1: Write failing tests for Projects v2 operations

Add to test file:

```typescript
describe('GitHub Projects v2 Operations', () => {
  beforeEach(async () => {
    const credentials = {
      github: { token: 'test_token', scopes: ['repo', 'read:project'] }
    };
    mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
      data: { login: 'testuser' }
    });
    backend = new GitHubBackend({ credentials });
    await backend.authenticate();
  });

  it('should add issue to project with GraphQL', async () => {
    // Mock issue lookup
    mockOctokit.rest.issues.get.mockResolvedValue({
      data: {
        node_id: 'I_kwTest',
        number: 42,
        html_url: 'https://github.com/owner/repo/issues/42'
      }
    });

    // Mock GraphQL mutation
    mockOctokit.graphql.mockResolvedValue({
      addProjectV2ItemById: {
        item: {
          id: 'PVTI_kwTest'
        }
      }
    });

    await backend.addToProject('owner/repo#42', 'PVT_kwProject');

    expect(mockOctokit.graphql).toHaveBeenCalledWith(
      expect.stringContaining('addProjectV2ItemById'),
      expect.objectContaining({
        projectId: 'PVT_kwProject',
        contentId: 'I_kwTest'
      })
    );
  });

  it('should get project items with GraphQL', async () => {
    mockOctokit.graphql.mockResolvedValue({
      node: {
        items: {
          nodes: [
            {
              id: 'PVTI_1',
              content: {
                id: 'I_1',
                number: 1,
                title: 'Issue 1',
                body: 'Body',
                state: 'OPEN',
                createdAt: '2025-11-04T00:00:00Z',
                updatedAt: '2025-11-04T00:00:00Z',
                url: 'https://github.com/owner/repo/issues/1',
                repository: {
                  nameWithOwner: 'owner/repo'
                },
                assignees: { nodes: [] },
                labels: { nodes: [] }
              }
            }
          ]
        }
      }
    });

    const items = await backend.getProjectItems('PVT_kwProject');

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Issue 1');
    expect(mockOctokit.graphql).toHaveBeenCalled();
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test tests/backends/github.test.ts`

Expected: FAIL - Projects methods not converted

### Step 3: Convert Projects v2 methods to use Octokit GraphQL

Replace methods in github.ts:

```typescript
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
  issueId: string,
  fieldName: string,
  value: unknown
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
```

### Step 4: Run tests to verify they pass

Run: `npm test tests/backends/github.test.ts`

Expected: All Projects v2 tests PASS

### Step 5: Commit Projects v2 operations

```bash
git add src/backends/github.ts tests/backends/github.test.ts
git commit -m "refactor(github): convert Projects v2 operations to Octokit GraphQL

- Replace gh CLI with octokit.graphql for Projects v2
- Implement addToProject via GraphQL mutation
- Implement getProjectItems via GraphQL query
- Add placeholder for updateProjectField (complex, needs design)
- Maintain existing error handling for 404/403
- Update tests to mock Octokit GraphQL API

🤖 Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 6: Remove GhCli Dependency and Update Existing Tests

**Files:**
- Modify: `.claude/skills/beads-bridge/src/backends/github.ts` (remove GhCli import and references)
- Modify: `.claude/skills/beads-bridge/tests/backends/github.test.ts` (ensure all existing tests work)
- Note: `src/utils/gh-cli.ts` can remain for now (may be used by other code)

### Step 1: Verify all tests pass with new implementation

Run: `npm test tests/backends/github.test.ts`

Expected: All tests PASS

### Step 2: Remove GhCli import and any remaining references

In github.ts, remove:

```typescript
// OLD - Remove these lines
import { GhCli, formatMermaidComment } from '../utils/gh-cli.js';
private readonly gh: GhCli;
```

Ensure no other references to `this.gh` remain in the file.

### Step 3: Run full test suite

Run: `npm test`

Expected: All 213+ tests still pass

### Step 4: Commit cleanup

```bash
git add src/backends/github.ts
git commit -m "refactor(github): remove GhCli dependency completely

- Remove GhCli import and gh property
- GitHub backend now 100% using Octokit
- All gh CLI subprocess calls eliminated
- Maintains existing ProjectManagementBackend interface

Phase 2 complete: GitHub backend converted to Octokit!

🤖 Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Verification Checklist

After completing all tasks, verify:

- [ ] All 213+ tests pass (no regressions)
- [ ] GitHub backend no longer imports GhCli
- [ ] All 13 async methods converted to Octokit
- [ ] Authentication uses CredentialStore from Phase 1
- [ ] Error handling covers 401, 403, 404, 429
- [ ] GraphQL Projects v2 queries work
- [ ] Existing consumers of GitHubBackend unchanged

---

## Next Steps

After Phase 2 is complete:

- **Phase 3** (pensive-8e19): Replace `short` CLI with @shortcut/client in Shortcut backend
- **Phase 4** (pensive-23c8): Update configuration schema for v2.0
- **Phase 5** (pensive-0a3d): Add auth checks to all CLI commands

---

## Notes for Engineer

**Key Design Decisions:**

1. **Octokit REST vs GraphQL**: Use REST API for most operations, GraphQL only for Projects v2 and node ID lookups
2. **Error Handling**: Consistent pattern checking error.status and mapping to our custom error types
3. **Parser Helpers**: Separate `parseOctokitIssue` (REST) and `parseGraphQLIssue` (GraphQL) for maintainability
4. **Interface Preservation**: All method signatures remain identical - consumers don't need changes

**Common Pitfalls:**

- Don't forget to await Octokit calls (they're all async)
- GraphQL responses have different structure than REST (data.node vs data directly)
- Repository format must be "owner/repo" - validate early
- Issue numbers are integers in API but strings in our interface

**Testing Strategy:**

- Mock Octokit at module level with vi.mock()
- Mock both `octokit.rest.*` and `octokit.graphql`
- Each test should mock exactly what it needs
- Integration tests would require real credentials (skip for now)
