# Phase 3: Shortcut Backend Rewrite with @shortcut/client Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace all `short` CLI calls in ShortcutBackend with direct @shortcut/client SDK calls to eliminate CLI dependencies.

**Architecture:** Convert ShortcutBackend from using CLI subprocess calls to using @shortcut/client SDK directly. Maintain the existing ProjectManagementBackend interface contract so consumers remain unchanged.

**Tech Stack:** @shortcut/client v1.11.0 (already installed), TypeScript, Vitest for testing

---

## Context

**Current Architecture:**
- `src/backends/shortcut.ts` (612 lines) - Uses CLI subprocess calls for all Shortcut operations
- 13 async methods use CLI: authenticate, createIssue, getIssue, updateIssue, addComment, listComments, linkIssues, getLinkedIssues, searchIssues, addToProject, updateProjectField, getProjectItems
- All operations use `execFile('short', [...args])` pattern

**Target Architecture:**
- Replace CLI calls with `@shortcut/client` SDK
- Use `client.getStory()`, `client.createStory()`, etc. for operations
- Load credentials from `CredentialStore` (from Phase 1)
- Maintain all existing interfaces and method signatures

**Dependencies:**
- Phase 1 complete (authentication infrastructure available)
- @shortcut/client already installed (added in Phase 1)

---

## Task 1: Update Constructor and Authentication

**Files:**
- Modify: `.claude/skills/beads-bridge/src/backends/shortcut.ts:1-140`
- Modify: `.claude/skills/beads-bridge/tests/shortcut-backend.test.ts` (update existing tests)

### Step 1: Write failing test for ShortcutClient initialization

Update test file to test new Shortcut client initialization:

```typescript
// tests/shortcut-backend.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShortcutBackend } from '../src/backends/shortcut.js';
import { ShortcutClient } from '@shortcut/client';

// Mock ShortcutClient
vi.mock('@shortcut/client');

describe('ShortcutBackend with ShortcutClient', () => {
  let backend: ShortcutBackend;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      getCurrentMemberInfo: vi.fn()
    };
    (ShortcutClient as any).mockImplementation(() => mockClient);
  });

  it('should initialize with credentials', () => {
    const credentials = {
      shortcut: {
        token: 'test_token_123'
      }
    };

    backend = new ShortcutBackend({ credentials });

    expect(ShortcutClient).toHaveBeenCalledWith('test_token_123');
  });

  it('should authenticate successfully', async () => {
    const credentials = {
      shortcut: {
        token: 'test_token_123'
      }
    };

    mockClient.getCurrentMemberInfo.mockResolvedValue({
      id: 'member-123',
      name: 'Test User'
    });

    backend = new ShortcutBackend({ credentials });
    await backend.authenticate();

    expect(backend.isAuthenticated()).toBe(true);
    expect(mockClient.getCurrentMemberInfo).toHaveBeenCalled();
  });

  it('should throw error if not authenticated', async () => {
    backend = new ShortcutBackend({});

    await expect(backend.authenticate()).rejects.toThrow('Not authenticated with Shortcut');
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test tests/shortcut-backend.test.ts`

Expected: FAIL - Constructor signature mismatch, ShortcutClient not imported

### Step 3: Update ShortcutBackend constructor and authentication

Modify the shortcut.ts file:

```typescript
// src/backends/shortcut.ts
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
import { ShortcutClient } from '@shortcut/client';
import type { Credentials } from '../auth/credential-store.js';

export interface ShortcutBackendConfig {
  /** Default project name */
  defaultProject?: string;

  /** Default workflow state for new stories */
  defaultState?: string;

  /** Default story type (feature, bug, chore) */
  defaultType?: 'feature' | 'bug' | 'chore';

  /** Credentials for authentication */
  credentials?: Credentials;
}

/**
 * Shortcut Backend implementation using @shortcut/client
 */
export class ShortcutBackend implements ProjectManagementBackend {
  readonly name = 'shortcut';
  readonly supportsProjects = true;
  readonly supportsSubIssues = false;
  readonly supportsCustomFields = true;

  private readonly client: ShortcutClient;
  private readonly config: ShortcutBackendConfig;
  private authenticated = false;

  constructor(config: ShortcutBackendConfig = {}) {
    this.config = config;

    // Initialize ShortcutClient with credentials if available
    const token = config.credentials?.shortcut?.token || '';
    this.client = new ShortcutClient(token);
  }

  // ============================================================================
  // Authentication
  // ============================================================================

  async authenticate(): Promise<void> {
    // Check if we have credentials
    if (!this.config.credentials?.shortcut?.token) {
      throw new AuthenticationError(
        'Not authenticated with Shortcut. Run: beads-bridge auth shortcut'
      );
    }

    // Verify token works by making a test API call
    try {
      await this.client.getCurrentMemberInfo();
      this.authenticated = true;
    } catch (error: any) {
      if (error.status === 401 || error.message?.includes('Unauthorized')) {
        throw new AuthenticationError(
          'Shortcut token is invalid or expired. Run: beads-bridge auth shortcut'
        );
      }
      throw new AuthenticationError(
        `Shortcut authentication failed: ${error.message}`
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

Run: `npm test tests/shortcut-backend.test.ts`

Expected: All authentication tests PASS

### Step 5: Commit constructor and authentication changes

```bash
git add src/backends/shortcut.ts tests/shortcut-backend.test.ts
git commit -m "refactor(shortcut): replace CLI with ShortcutClient initialization

- Replace CLI subprocess calls with ShortcutClient SDK
- Update constructor to accept credentials from Phase 1
- Implement authentication via client.getCurrentMemberInfo()
- Update tests to mock ShortcutClient instead of CLI
- Remove CLI dependency from authentication flow

🤖 Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 2: Convert Story CRUD Operations (createIssue, getIssue, updateIssue)

**Files:**
- Modify: `.claude/skills/beads-bridge/src/backends/shortcut.ts:137-240`
- Update: `.claude/skills/beads-bridge/tests/shortcut-backend.test.ts`

### Step 1: Write failing tests for story operations

Add to test file:

```typescript
describe('Story Operations', () => {
  beforeEach(async () => {
    const credentials = {
      shortcut: { token: 'test_token' }
    };
    mockClient.getCurrentMemberInfo.mockResolvedValue({
      id: 'member-123',
      name: 'Test User'
    });
    backend = new ShortcutBackend({ credentials, defaultProject: 'test-project' });
    await backend.authenticate();
  });

  it('should create story with ShortcutClient', async () => {
    mockClient.createStory.mockResolvedValue({
      id: 123,
      name: 'Test Story',
      description: 'Test body',
      story_type: 'feature',
      workflow_state_id: 500,
      workflow_state: {
        name: 'Ready for Development',
        type: 'unstarted'
      },
      created_at: '2025-11-04T00:00:00Z',
      updated_at: '2025-11-04T00:00:00Z',
      app_url: 'https://app.shortcut.com/test/story/123',
      owners: [],
      labels: []
    });

    const issue = await backend.createIssue({
      title: 'Test Story',
      body: 'Test body'
    });

    expect(issue.title).toBe('Test Story');
    expect(issue.number).toBe(123);
    expect(mockClient.createStory).toHaveBeenCalledWith({
      name: 'Test Story',
      description: 'Test body',
      story_type: 'feature'
    });
  });

  it('should get story by ID with ShortcutClient', async () => {
    mockClient.getStory.mockResolvedValue({
      id: 123,
      name: 'Existing Story',
      description: 'Story body',
      story_type: 'feature',
      workflow_state_id: 500,
      workflow_state: {
        name: 'Ready for Development',
        type: 'unstarted'
      },
      created_at: '2025-11-04T00:00:00Z',
      updated_at: '2025-11-04T00:00:00Z',
      app_url: 'https://app.shortcut.com/test/story/123',
      owners: [],
      labels: []
    });

    const issue = await backend.getIssue('123');

    expect(issue.title).toBe('Existing Story');
    expect(mockClient.getStory).toHaveBeenCalledWith(123);
  });

  it('should update story with ShortcutClient', async () => {
    mockClient.getStory.mockResolvedValue({
      id: 123,
      name: 'Old Title',
      description: 'Old body',
      story_type: 'feature',
      workflow_state_id: 500,
      workflow_state: {
        name: 'Ready for Development',
        type: 'unstarted'
      },
      created_at: '2025-11-04T00:00:00Z',
      updated_at: '2025-11-04T00:00:00Z',
      app_url: 'https://app.shortcut.com/test/story/123',
      owners: [],
      labels: []
    });

    mockClient.updateStory.mockResolvedValue({
      id: 123,
      name: 'Updated Title',
      description: 'Old body',
      story_type: 'feature',
      workflow_state_id: 500,
      workflow_state: {
        name: 'Ready for Development',
        type: 'unstarted'
      },
      created_at: '2025-11-04T00:00:00Z',
      updated_at: '2025-11-04T00:00:01Z',
      app_url: 'https://app.shortcut.com/test/story/123',
      owners: [],
      labels: []
    });

    const issue = await backend.updateIssue('123', {
      title: 'Updated Title'
    });

    expect(issue.title).toBe('Updated Title');
    expect(mockClient.updateStory).toHaveBeenCalledWith(123, {
      name: 'Updated Title'
    });
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test tests/shortcut-backend.test.ts`

Expected: FAIL - Methods not yet converted to ShortcutClient

### Step 3: Convert createIssue, getIssue, updateIssue to use ShortcutClient

Replace the methods in shortcut.ts:

```typescript
async createIssue(params: CreateIssueParams): Promise<Issue> {
  this.ensureAuthenticated();

  if (!params.title) {
    throw new ValidationError('Story title is required');
  }

  // Determine story type from params or use default
  const storyType = params.labels?.includes('bug')
    ? 'bug'
    : params.labels?.includes('chore')
    ? 'chore'
    : this.config.defaultType || 'feature';

  try {
    const story = await this.client.createStory({
      name: params.title,
      description: params.body || '',
      story_type: storyType,
      project_id: params.projectId ? parseInt(params.projectId) : undefined,
      owner_ids: params.assignees,
      labels: params.labels?.map(label => ({ name: label }))
    });

    return this.parseShortcutStory(story);
  } catch (error: any) {
    if (error.status === 404) {
      throw new NotFoundError(`Project not found`);
    } else if (error.status === 401 || error.status === 403) {
      throw new AuthenticationError('Permission denied. Check token.');
    }
    throw new BackendError(`Failed to create story: ${error.message}`, 'CREATE_FAILED');
  }
}

async getIssue(issueId: string): Promise<Issue> {
  this.ensureAuthenticated();

  const storyId = parseInt(issueId);
  if (isNaN(storyId)) {
    throw new ValidationError(`Invalid story ID: ${issueId}`);
  }

  try {
    const story = await this.client.getStory(storyId);
    return this.parseShortcutStory(story);
  } catch (error: any) {
    if (error.status === 404) {
      throw new NotFoundError(`Story ${issueId} not found`);
    }
    throw new BackendError(`Failed to get story: ${error.message}`, 'GET_FAILED');
  }
}

async updateIssue(issueId: string, updates: IssueUpdate): Promise<Issue> {
  this.ensureAuthenticated();

  const storyId = parseInt(issueId);
  if (isNaN(storyId)) {
    throw new ValidationError(`Invalid story ID: ${issueId}`);
  }

  try {
    // Build update params
    const updateParams: any = {};

    if (updates.title !== undefined) {
      updateParams.name = updates.title;
    }

    if (updates.body !== undefined) {
      updateParams.description = updates.body;
    }

    if (updates.state !== undefined) {
      // Map Beads state to Shortcut workflow state
      // This requires fetching workflow states first
      const workflows = await this.client.listWorkflows();
      const defaultWorkflow = workflows[0];

      let targetState;
      if (updates.state === 'open') {
        targetState = defaultWorkflow.states.find(s => s.type === 'unstarted');
      } else if (updates.state === 'in_progress') {
        targetState = defaultWorkflow.states.find(s => s.type === 'started');
      } else if (updates.state === 'closed') {
        targetState = defaultWorkflow.states.find(s => s.type === 'done');
      }

      if (targetState) {
        updateParams.workflow_state_id = targetState.id;
      }
    }

    if (updates.assignees !== undefined) {
      updateParams.owner_ids = updates.assignees;
    }

    if (updates.labels !== undefined) {
      updateParams.labels = updates.labels.map(label => ({ name: label }));
    }

    const story = await this.client.updateStory(storyId, updateParams);
    return this.parseShortcutStory(story);
  } catch (error: any) {
    if (error.status === 404) {
      throw new NotFoundError(`Story ${issueId} not found`);
    } else if (error.status === 401 || error.status === 403) {
      throw new AuthenticationError('Permission denied. Check token.');
    }
    throw new BackendError(`Failed to update story: ${error.message}`, 'UPDATE_FAILED');
  }
}

/**
 * Parse Shortcut story to our Issue type
 */
private parseShortcutStory(story: any): Issue {
  return {
    id: story.id.toString(),
    number: story.id,
    title: story.name,
    body: story.description || '',
    state: this.mapWorkflowStateToBeads(story.workflow_state),
    url: story.app_url,
    createdAt: new Date(story.created_at),
    updatedAt: new Date(story.updated_at),
    assignees: story.owners?.map((owner: any) => ({
      id: owner.id,
      login: owner.mention_name,
      name: owner.name
    })) || [],
    labels: story.labels?.map((label: any) => ({
      id: label.id.toString(),
      name: label.name,
      color: label.color,
      description: label.description
    })) || []
  };
}

/**
 * Map Shortcut workflow state type to Beads state
 */
private mapWorkflowStateToBeads(workflowState: any): 'open' | 'in_progress' | 'closed' {
  if (!workflowState) return 'open';

  switch (workflowState.type) {
    case 'unstarted':
      return 'open';
    case 'started':
      return 'in_progress';
    case 'done':
      return 'closed';
    default:
      return 'open';
  }
}
```

### Step 4: Run tests to verify they pass

Run: `npm test tests/shortcut-backend.test.ts`

Expected: All story CRUD tests PASS

### Step 5: Commit story operations changes

```bash
git add src/backends/shortcut.ts tests/shortcut-backend.test.ts
git commit -m "refactor(shortcut): convert story CRUD to ShortcutClient

- Replace CLI calls with client.createStory(), client.getStory(), client.updateStory()
- Add parseShortcutStory helper for consistent story parsing
- Add mapWorkflowStateToBeads helper for state mapping
- Maintain existing interface and error handling
- Update tests to mock ShortcutClient methods

🤖 Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 3: Convert Comment Operations (addComment, listComments)

**Files:**
- Modify: `.claude/skills/beads-bridge/src/backends/shortcut.ts:240-282`
- Update: `.claude/skills/beads-bridge/tests/shortcut-backend.test.ts`

### Step 1: Write failing tests for comment operations

Add to test file:

```typescript
describe('Comment Operations', () => {
  beforeEach(async () => {
    const credentials = {
      shortcut: { token: 'test_token' }
    };
    mockClient.getCurrentMemberInfo.mockResolvedValue({
      id: 'member-123',
      name: 'Test User'
    });
    backend = new ShortcutBackend({ credentials });
    await backend.authenticate();
  });

  it('should add comment with ShortcutClient', async () => {
    mockClient.createStoryComment.mockResolvedValue({
      id: 999,
      text: 'Test comment',
      created_at: '2025-11-04T00:00:00Z',
      updated_at: '2025-11-04T00:00:00Z',
      author_id: 'author-123',
      author: {
        id: 'author-123',
        name: 'Test Author',
        mention_name: 'testauthor'
      }
    });

    const comment = await backend.addComment('123', 'Test comment');

    expect(comment.body).toBe('Test comment');
    expect(mockClient.createStoryComment).toHaveBeenCalledWith(123, {
      text: 'Test comment'
    });
  });

  it('should list comments with ShortcutClient', async () => {
    mockClient.getStory.mockResolvedValue({
      id: 123,
      name: 'Test Story',
      comments: [
        {
          id: 1,
          text: 'First comment',
          created_at: '2025-11-04T00:00:00Z',
          updated_at: '2025-11-04T00:00:00Z',
          author_id: 'author-1',
          author: {
            id: 'author-1',
            name: 'User 1',
            mention_name: 'user1'
          }
        },
        {
          id: 2,
          text: 'Second comment',
          created_at: '2025-11-04T00:01:00Z',
          updated_at: '2025-11-04T00:01:00Z',
          author_id: 'author-2',
          author: {
            id: 'author-2',
            name: 'User 2',
            mention_name: 'user2'
          }
        }
      ]
    });

    const comments = await backend.listComments('123');

    expect(comments).toHaveLength(2);
    expect(comments[0].body).toBe('First comment');
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test tests/shortcut-backend.test.ts`

Expected: FAIL - Comment methods not converted

### Step 3: Convert comment methods to use ShortcutClient

Replace methods in shortcut.ts:

```typescript
async addComment(issueId: string, comment: string): Promise<Comment> {
  this.ensureAuthenticated();

  const storyId = parseInt(issueId);
  if (isNaN(storyId)) {
    throw new ValidationError(`Invalid story ID: ${issueId}`);
  }

  try {
    const shortcutComment = await this.client.createStoryComment(storyId, {
      text: comment
    });

    return this.parseShortcutComment(shortcutComment);
  } catch (error: any) {
    if (error.status === 404) {
      throw new NotFoundError(`Story ${issueId} not found`);
    } else if (error.status === 401 || error.status === 403) {
      throw new AuthenticationError('Permission denied. Check token.');
    }
    throw new BackendError(`Failed to add comment: ${error.message}`, 'COMMENT_FAILED');
  }
}

async listComments(issueId: string): Promise<Comment[]> {
  this.ensureAuthenticated();

  const storyId = parseInt(issueId);
  if (isNaN(storyId)) {
    throw new ValidationError(`Invalid story ID: ${issueId}`);
  }

  try {
    // Shortcut API requires fetching the full story to get comments
    const story = await this.client.getStory(storyId);

    if (!story.comments) {
      return [];
    }

    return story.comments.map(c => this.parseShortcutComment(c));
  } catch (error: any) {
    if (error.status === 404) {
      throw new NotFoundError(`Story ${issueId} not found`);
    }
    throw new BackendError(`Failed to list comments: ${error.message}`, 'LIST_FAILED');
  }
}

/**
 * Parse Shortcut comment to our Comment type
 */
private parseShortcutComment(comment: any): Comment {
  return {
    id: comment.id.toString(),
    body: comment.text,
    createdAt: new Date(comment.created_at),
    updatedAt: new Date(comment.updated_at),
    author: comment.author ? {
      id: comment.author.id,
      login: comment.author.mention_name,
      name: comment.author.name
    } : undefined
  };
}
```

### Step 4: Run tests to verify they pass

Run: `npm test tests/shortcut-backend.test.ts`

Expected: All comment tests PASS

### Step 5: Commit comment operations

```bash
git add src/backends/shortcut.ts tests/shortcut-backend.test.ts
git commit -m "refactor(shortcut): convert comment operations to ShortcutClient

- Replace CLI with client.createStoryComment()
- Use client.getStory() to fetch comments (Shortcut API requirement)
- Add parseShortcutComment helper
- Maintain existing error handling
- Update tests to mock ShortcutClient comment methods

🤖 Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 4: Convert Search and Link Operations

**Files:**
- Modify: `.claude/skills/beads-bridge/src/backends/shortcut.ts:282-397`
- Update: `.claude/skills/beads-bridge/tests/shortcut-backend.test.ts`

### Step 1: Write failing tests for search and link operations

Add to test file:

```typescript
describe('Search and Link Operations', () => {
  beforeEach(async () => {
    const credentials = {
      shortcut: { token: 'test_token' }
    };
    mockClient.getCurrentMemberInfo.mockResolvedValue({
      id: 'member-123',
      name: 'Test User'
    });
    backend = new ShortcutBackend({ credentials });
    await backend.authenticate();
  });

  it('should search stories with ShortcutClient', async () => {
    mockClient.searchStories.mockResolvedValue({
      data: [
        {
          id: 1,
          name: 'Story 1',
          description: 'Body 1',
          story_type: 'feature',
          workflow_state_id: 500,
          workflow_state: {
            name: 'Ready',
            type: 'unstarted'
          },
          created_at: '2025-11-04T00:00:00Z',
          updated_at: '2025-11-04T00:00:00Z',
          app_url: 'https://app.shortcut.com/test/story/1',
          owners: [],
          labels: []
        }
      ]
    });

    const results = await backend.searchIssues({
      query: 'test'
    });

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Story 1');
  });

  it('should link stories with ShortcutClient', async () => {
    mockClient.createStoryLink.mockResolvedValue({
      id: 1,
      subject_id: 123,
      object_id: 456,
      verb: 'blocks'
    });

    await backend.linkIssues('123', '456', 'blocks');

    expect(mockClient.createStoryLink).toHaveBeenCalledWith({
      subject_id: 123,
      object_id: 456,
      verb: 'blocks'
    });
  });

  it('should get linked stories with ShortcutClient', async () => {
    mockClient.getStory.mockResolvedValue({
      id: 123,
      name: 'Parent Story',
      story_links: [
        {
          subject_id: 123,
          object_id: 456,
          verb: 'blocks'
        }
      ]
    });

    mockClient.getStory.mockResolvedValueOnce({
      id: 123,
      name: 'Parent Story',
      story_links: [
        {
          subject_id: 123,
          object_id: 456,
          verb: 'blocks'
        }
      ]
    }).mockResolvedValueOnce({
      id: 456,
      name: 'Linked Story',
      app_url: 'https://app.shortcut.com/test/story/456'
    });

    const linked = await backend.getLinkedIssues('123');

    expect(linked).toHaveLength(1);
    expect(linked[0].linkType).toBe('blocks');
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test tests/shortcut-backend.test.ts`

Expected: FAIL - Methods not yet converted

### Step 3: Convert search and link methods to ShortcutClient

Replace methods in shortcut.ts:

```typescript
async linkIssues(parentId: string, childId: string, linkType: LinkType): Promise<void> {
  this.ensureAuthenticated();

  const subjectId = parseInt(parentId);
  const objectId = parseInt(childId);

  if (isNaN(subjectId) || isNaN(objectId)) {
    throw new ValidationError('Invalid story IDs');
  }

  // Map LinkType to Shortcut verb
  let verb: string;
  switch (linkType) {
    case LinkType.BLOCKS:
      verb = 'blocks';
      break;
    case LinkType.RELATED:
      verb = 'relates to';
      break;
    case LinkType.PARENT_CHILD:
      verb = 'duplicates'; // Shortcut doesn't have parent-child, use duplicates
      break;
    default:
      verb = 'relates to';
  }

  try {
    await this.client.createStoryLink({
      subject_id: subjectId,
      object_id: objectId,
      verb
    });
  } catch (error: any) {
    if (error.status === 404) {
      throw new NotFoundError('Story not found');
    } else if (error.status === 401 || error.status === 403) {
      throw new AuthenticationError('Permission denied. Check token.');
    }
    throw new BackendError(`Failed to link stories: ${error.message}`, 'LINK_FAILED');
  }
}

async getLinkedIssues(issueId: string): Promise<LinkedIssue[]> {
  this.ensureAuthenticated();

  const storyId = parseInt(issueId);
  if (isNaN(storyId)) {
    throw new ValidationError(`Invalid story ID: ${issueId}`);
  }

  try {
    const story = await this.client.getStory(storyId);

    if (!story.story_links || story.story_links.length === 0) {
      return [];
    }

    const linkedIssues: LinkedIssue[] = [];

    for (const link of story.story_links) {
      // Determine which story is the linked one (subject or object)
      const linkedStoryId = link.subject_id === storyId ? link.object_id : link.subject_id;

      try {
        const linkedStory = await this.client.getStory(linkedStoryId);

        // Map Shortcut verb to LinkType
        let linkType: 'blocks' | 'related' | 'child';
        if (link.verb === 'blocks') {
          linkType = 'blocks';
        } else if (link.verb === 'duplicates') {
          linkType = 'child';
        } else {
          linkType = 'related';
        }

        linkedIssues.push({
          issue: this.parseShortcutStory(linkedStory),
          linkType
        });
      } catch (error: any) {
        // Skip linked stories that can't be fetched
        continue;
      }
    }

    return linkedIssues;
  } catch (error: any) {
    if (error.status === 404) {
      throw new NotFoundError(`Story ${issueId} not found`);
    }
    throw new BackendError(`Failed to get linked stories: ${error.message}`, 'GET_LINKS_FAILED');
  }
}

async searchIssues(query: SearchQuery): Promise<Issue[]> {
  this.ensureAuthenticated();

  try {
    // Build Shortcut search query
    const searchParams: any = {
      query: query.query
    };

    // Shortcut API doesn't support all the same filters as GitHub
    // but we can add basic filtering
    const result = await this.client.searchStories(searchParams);

    if (!result.data) {
      return [];
    }

    // Apply client-side filtering for unsupported parameters
    let stories = result.data;

    if (query.state) {
      const stateType = query.state === 'open' ? 'unstarted' : query.state === 'closed' ? 'done' : 'started';
      stories = stories.filter((s: any) => s.workflow_state?.type === stateType);
    }

    if (query.labels && query.labels.length > 0) {
      stories = stories.filter((s: any) =>
        query.labels!.some(label =>
          s.labels?.some((l: any) => l.name === label)
        )
      );
    }

    if (query.assignee) {
      stories = stories.filter((s: any) =>
        s.owners?.some((o: any) => o.mention_name === query.assignee)
      );
    }

    // Apply limit
    if (query.limit) {
      stories = stories.slice(0, query.limit);
    }

    return stories.map((story: any) => this.parseShortcutStory(story));
  } catch (error: any) {
    throw new BackendError(`Failed to search stories: ${error.message}`, 'SEARCH_FAILED');
  }
}
```

### Step 4: Run tests to verify they pass

Run: `npm test tests/shortcut-backend.test.ts`

Expected: All search and link tests PASS

### Step 5: Commit search and link operations

```bash
git add src/backends/shortcut.ts tests/shortcut-backend.test.ts
git commit -m "refactor(shortcut): convert search and link operations to ShortcutClient

- Replace CLI with client.searchStories()
- Replace CLI with client.createStoryLink()
- Fetch linked stories with client.getStory()
- Map LinkType enum to Shortcut verbs
- Add client-side filtering for search (Shortcut API limitations)
- Update tests to mock ShortcutClient search/link methods

🤖 Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 5: Convert Project Operations (addToProject, updateProjectField, getProjectItems)

**Files:**
- Modify: `.claude/skills/beads-bridge/src/backends/shortcut.ts:397-453`
- Update: `.claude/skills/beads-bridge/tests/shortcut-backend.test.ts`

### Step 1: Write failing tests for project operations

Add to test file:

```typescript
describe('Project Operations', () => {
  beforeEach(async () => {
    const credentials = {
      shortcut: { token: 'test_token' }
    };
    mockClient.getCurrentMemberInfo.mockResolvedValue({
      id: 'member-123',
      name: 'Test User'
    });
    backend = new ShortcutBackend({ credentials });
    await backend.authenticate();
  });

  it('should add story to project with ShortcutClient', async () => {
    mockClient.updateStory.mockResolvedValue({
      id: 123,
      name: 'Test Story',
      project_id: 456
    });

    await backend.addToProject('123', '456');

    expect(mockClient.updateStory).toHaveBeenCalledWith(123, {
      project_id: 456
    });
  });

  it('should get project stories with ShortcutClient', async () => {
    mockClient.listStories.mockResolvedValue([
      {
        id: 1,
        name: 'Story 1',
        description: 'Body',
        story_type: 'feature',
        workflow_state_id: 500,
        workflow_state: {
          name: 'Ready',
          type: 'unstarted'
        },
        project_id: 456,
        created_at: '2025-11-04T00:00:00Z',
        updated_at: '2025-11-04T00:00:00Z',
        app_url: 'https://app.shortcut.com/test/story/1',
        owners: [],
        labels: []
      }
    ]);

    const stories = await backend.getProjectItems('456');

    expect(stories).toHaveLength(1);
    expect(mockClient.listStories).toHaveBeenCalledWith({
      project_id: 456
    });
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test tests/shortcut-backend.test.ts`

Expected: FAIL - Project methods not converted

### Step 3: Convert project methods to ShortcutClient

Replace methods in shortcut.ts:

```typescript
async addToProject(issueId: string, projectId: string): Promise<void> {
  this.ensureAuthenticated();

  const storyId = parseInt(issueId);
  const projectIdNum = parseInt(projectId);

  if (isNaN(storyId) || isNaN(projectIdNum)) {
    throw new ValidationError('Invalid story or project ID');
  }

  try {
    await this.client.updateStory(storyId, {
      project_id: projectIdNum
    });
  } catch (error: any) {
    if (error.status === 404) {
      throw new NotFoundError('Story or project not found');
    } else if (error.status === 401 || error.status === 403) {
      throw new AuthenticationError('Permission denied. Check token.');
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

  // Shortcut custom fields work differently than GitHub Projects v2
  // This is a simplified implementation
  const storyId = parseInt(issueId);
  if (isNaN(storyId)) {
    throw new ValidationError(`Invalid story ID: ${issueId}`);
  }

  try {
    // Update custom field via story update
    const customFields: any = {};
    customFields[fieldName] = value;

    await this.client.updateStory(storyId, {
      custom_fields: customFields
    });
  } catch (error: any) {
    if (error.status === 404) {
      throw new NotFoundError(`Story ${issueId} not found`);
    } else if (error.status === 401 || error.status === 403) {
      throw new AuthenticationError('Permission denied. Check token.');
    }
    throw new BackendError(
      `Failed to update field: ${error.message}`,
      'FIELD_UPDATE_FAILED'
    );
  }
}

async getProjectItems(projectId: string): Promise<Issue[]> {
  this.ensureAuthenticated();

  const projectIdNum = parseInt(projectId);
  if (isNaN(projectIdNum)) {
    throw new ValidationError(`Invalid project ID: ${projectId}`);
  }

  try {
    const stories = await this.client.listStories({
      project_id: projectIdNum
    });

    return stories.map((story: any) => this.parseShortcutStory(story));
  } catch (error: any) {
    if (error.status === 404) {
      throw new NotFoundError(`Project ${projectId} not found`);
    }
    throw new BackendError(`Failed to get project items: ${error.message}`, 'PROJECT_GET_FAILED');
  }
}
```

### Step 4: Run tests to verify they pass

Run: `npm test tests/shortcut-backend.test.ts`

Expected: All project tests PASS

### Step 5: Commit project operations

```bash
git add src/backends/shortcut.ts tests/shortcut-backend.test.ts
git commit -m "refactor(shortcut): convert project operations to ShortcutClient

- Replace CLI with client.updateStory() for addToProject
- Implement updateProjectField with custom_fields support
- Replace CLI with client.listStories() for getProjectItems
- Maintain existing error handling
- Update tests to mock ShortcutClient project methods

🤖 Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 6: Remove CLI Dependencies and Update Existing Tests

**Files:**
- Modify: `.claude/skills/beads-bridge/src/backends/shortcut.ts` (remove execFile imports and usage)
- Modify: `.claude/skills/beads-bridge/tests/shortcut-backend.test.ts` (ensure all existing tests work)

### Step 1: Verify all tests pass with new implementation

Run: `npm test tests/shortcut-backend.test.ts`

Expected: All tests PASS

### Step 2: Remove CLI imports and references

In shortcut.ts, remove:

```typescript
// OLD - Remove these lines
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// And remove the private execShort method (around line 453)
```

Also remove timeout config option since it's no longer needed.

### Step 3: Run full test suite

Run: `npm test`

Expected: All 229+ tests still pass

### Step 4: Commit cleanup

```bash
git add src/backends/shortcut.ts
git commit -m "refactor(shortcut): remove CLI dependency completely

- Remove execFile and child_process imports
- Remove execShort helper method
- Remove timeout config option (no longer needed)
- Shortcut backend now 100% using @shortcut/client SDK
- All CLI subprocess calls eliminated
- Maintains existing ProjectManagementBackend interface

Phase 3 complete: Shortcut backend converted to @shortcut/client!

🤖 Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Verification Checklist

After completing all tasks, verify:

- [ ] All 229+ tests pass (no regressions)
- [ ] Shortcut backend no longer uses execFile or CLI
- [ ] All 13 async methods converted to @shortcut/client
- [ ] Authentication uses CredentialStore from Phase 1
- [ ] Error handling covers 401, 403, 404
- [ ] Story links work with proper verb mapping
- [ ] Existing consumers of ShortcutBackend unchanged

---

## Next Steps

After Phase 3 is complete:

- **Phase 4** (pensive-23c8): Update configuration schema for v2.0
- **Phase 5** (pensive-0a3d): Add auth checks to all CLI commands
- **Phase 6** (pensive-aa99): Update test coverage to >90%

---

## Notes for Engineer

**Key Design Decisions:**

1. **@shortcut/client API**: The SDK provides methods like `getStory()`, `createStory()`, `updateStory()`, `searchStories()`, etc.
2. **Workflow State Mapping**: Shortcut uses workflow states (unstarted, started, done) which map to Beads states (open, in_progress, closed)
3. **Story Links**: Shortcut has native story linking with verbs like 'blocks', 'relates to', 'duplicates'
4. **Custom Fields**: Shortcut supports custom fields differently than GitHub Projects v2

**Common Pitfalls:**

- Story IDs are numbers in Shortcut, convert strings with parseInt()
- Comments require fetching the full story (no separate listComments endpoint)
- Search API has limitations, may need client-side filtering
- Workflow state changes require looking up workflow state IDs

**Testing Strategy:**

- Mock @shortcut/client at module level with vi.mock()
- Each test should mock exactly what it needs
- Integration tests would require real credentials (skip for now)
