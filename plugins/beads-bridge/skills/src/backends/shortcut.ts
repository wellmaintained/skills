/**
 * Shortcut Backend Implementation
 *
 * Implements ProjectManagementBackend using @shortcut/client SDK.
 * Maps Shortcut stories to the common Issue interface.
 */

import type {
  Comment,
  CreateIssueParams,
  Issue,
  IssueUpdate,
  LinkedIssue,
  LinkedIssueRelation,
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
 * Shortcut API response types
 */
interface ShortcutStory {
  id: number;
  name: string;
  description?: string;
  story_type: string;
  workflow_state_id: number;
  workflow_state?: {
    name: string;
    type: 'unstarted' | 'started' | 'done';
  };
  owners?: Array<{
    id: string;
    name: string;
    mention_name: string;
    email_address?: string;
  }>;
  labels?: Array<{
    id: number;
    name: string;
    color?: string;
    description?: string;
  }>;
  created_at: string;
  updated_at: string;
  app_url: string;
  comments?: ShortcutComment[];
  story_links?: Array<{
    object_id: number;
    subject_id: number;
    verb: string; // 'blocks', 'relates to', 'duplicates'
  }>;
}

interface ShortcutComment {
  id: number;
  text: string;
  author_id: string;
  author?: {
    id: string;
    name: string;
    mention_name: string;
    email_address?: string;
  };
  created_at: string;
  updated_at: string;
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
    this.config = {
      defaultType: 'feature',
      ...config
    };

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

  // ============================================================================
  // Issue Operations
  // ============================================================================

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
      const response = await this.client.createStory({
        name: params.title,
        description: params.body || '',
        story_type: storyType,
        project_id: params.projectId ? parseInt(params.projectId) : undefined,
        owner_ids: params.assignees,
        labels: params.labels?.map(label => ({ name: label }))
      });

      return this.parseShortcutStory(response.data);
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
      const response = await this.client.getStory(storyId);
      return this.parseShortcutStory(response.data);
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
        const workflowsResponse = await this.client.listWorkflows();
        const defaultWorkflow = workflowsResponse.data[0];

        let targetState;
        if (updates.state === 'open') {
          targetState = defaultWorkflow.states.find((s: any) => s.type === 'unstarted');
        } else if (updates.state === 'closed') {
          targetState = defaultWorkflow.states.find((s: any) => s.type === 'done');
        } else {
          targetState = defaultWorkflow.states.find((s: any) => s.type === 'started');
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

      const response = await this.client.updateStory(storyId, updateParams);
      return this.parseShortcutStory(response.data);
    } catch (error: any) {
      if (error.status === 404) {
        throw new NotFoundError(`Story ${issueId} not found`);
      } else if (error.status === 401 || error.status === 403) {
        throw new AuthenticationError('Permission denied. Check token.');
      }
      throw new BackendError(`Failed to update story: ${error.message}`, 'UPDATE_FAILED');
    }
  }

  // ============================================================================
  // Comments
  // ============================================================================

  async addComment(issueId: string, comment: string): Promise<Comment> {
    this.ensureAuthenticated();

    const storyId = parseInt(issueId);
    if (isNaN(storyId)) {
      throw new ValidationError(`Invalid story ID: ${issueId}`);
    }

    try {
      const response = await this.client.createStoryComment(storyId, {
        text: comment
      });

      return this.parseShortcutComment(response.data);
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

      if (!story.data.comments) {
        return [];
      }

      return story.data.comments.map((c: any) => this.parseShortcutComment(c));
    } catch (error: any) {
      if (error.status === 404) {
        throw new NotFoundError(`Story ${issueId} not found`);
      }
      throw new BackendError(`Failed to list comments: ${error.message}`, 'LIST_FAILED');
    }
  }

  // ============================================================================
  // Relationships
  // ============================================================================

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
      case 'blocks':
        verb = 'blocks';
        break;
      case 'related':
        verb = 'relates to';
        break;
      case 'parent-child':
        verb = 'relates to'; // Shortcut doesn't have parent-child, use relates to
        break;
      default:
        verb = 'relates to';
    }

    try {
      await this.client.createStoryLink({
        subject_id: subjectId,
        object_id: objectId,
        verb: verb as any
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

      if (!story.data.story_links || story.data.story_links.length === 0) {
        return [];
      }

      const linkedIssues: LinkedIssue[] = [];

      for (const link of story.data.story_links) {
        try {
          // Determine which story is the linked one (subject or object)
          const linkedStoryId = link.subject_id === storyId ? link.object_id : link.subject_id;

          const linkedStory = await this.client.getStory(linkedStoryId);

          // Map Shortcut verb to LinkType
          let linkType: LinkedIssueRelation;
          if (link.verb === 'blocks') {
            linkType = 'blocks';
          } else {
            linkType = 'relates-to';
          }

          linkedIssues.push({
            issue: this.parseStory(linkedStory.data as any),
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

  // ============================================================================
  // Search
  // ============================================================================

  async searchIssues(query: SearchQuery): Promise<Issue[]> {
    this.ensureAuthenticated();

    try {
      // Build Shortcut search query
      const searchParams: any = {
        query: (query as any).query || query.text || ''
      };

      // Shortcut API doesn't support all the same filters as GitHub
      // but we can add basic filtering
      const result = await this.client.searchStories(searchParams);

      if (!result.data) {
        return [];
      }

      // Apply client-side filtering for unsupported parameters
      let stories = result.data as unknown as any[];

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
      if ((query as any).limit) {
        stories = stories.slice(0, (query as any).limit);
      }

      return stories.map((story: any) => this.parseStory(story));
    } catch (error: any) {
      throw new BackendError(`Failed to search stories: ${error.message}`, 'SEARCH_FAILED');
    }
  }

  // ============================================================================
  // Project Operations (Optional)
  // ============================================================================

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
      const stories = await this.client.listStories(
        projectIdNum,
        { project_id: projectIdNum } as any
      );

      return stories.data.map((story: any) => this.parseShortcutStory(story));
    } catch (error: any) {
      if (error.status === 404) {
        throw new NotFoundError(`Project ${projectId} not found`);
      }
      throw new BackendError(`Failed to get project items: ${error.message}`, 'PROJECT_GET_FAILED');
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Parse Shortcut story to common Issue format
   */
  private parseStory(story: ShortcutStory): Issue {
    return {
      id: `shortcut-${story.id}`,
      number: story.id,
      title: story.name,
      body: story.description || '',
      state: this.mapWorkflowState(story.workflow_state?.type),
      assignees: this.parseOwners(story.owners),
      labels: this.parseLabels(story.labels),
      createdAt: new Date(story.created_at),
      updatedAt: new Date(story.updated_at),
      url: story.app_url,
      metadata: {
        storyType: story.story_type,
        workflowStateId: story.workflow_state_id,
        workflowStateName: story.workflow_state?.name
      }
    };
  }

  /**
   * Map Shortcut workflow state type to generic Issue state
   */
  private mapWorkflowState(stateType?: 'unstarted' | 'started' | 'done'): 'open' | 'closed' {
    if (!stateType || stateType === 'unstarted' || stateType === 'started') {
      return 'open';
    }
    return 'closed';
  }

  /**
   * Parse Shortcut owners to common User format
   */
  private parseOwners(owners?: ShortcutStory['owners']): User[] {
    if (!owners) return [];

    return owners.map(owner => ({
      id: owner.id,
      login: owner.mention_name,
      name: owner.name,
      email: owner.email_address
    }));
  }

  /**
   * Parse Shortcut labels to common Label format
   */
  private parseLabels(labels?: ShortcutStory['labels']): Label[] {
    if (!labels) return [];

    return labels.map(label => ({
      id: label.id.toString(),
      name: label.name,
      color: label.color,
      description: label.description
    }));
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
      } : {
        id: 'unknown',
        login: 'unknown',
        name: 'Unknown User'
      }
    };
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
        name: owner.name,
        email: owner.email_address
      })) || [],
      labels: story.labels?.map((label: any) => ({
        id: label.id.toString(),
        name: label.name,
        color: label.color,
        description: label.description
      })) || [],
      metadata: {
        storyType: story.story_type,
        workflowStateId: story.workflow_state_id,
        workflowStateName: story.workflow_state?.name
      }
    };
  }

  /**
   * Map Shortcut workflow state type to Beads state
   */
  private mapWorkflowStateToBeads(workflowState: any): 'open' | 'closed' {
    if (!workflowState) return 'open';

    switch (workflowState.type) {
      case 'unstarted':
      case 'started':
        return 'open';
      case 'done':
        return 'closed';
      default:
        return 'open';
    }
  }
}
