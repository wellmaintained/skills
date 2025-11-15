/**
 * Tests for ShortcutBackend
 *
 * Tests the Shortcut backend implementation.
 * Note: These tests focus on parsing and mapping logic.
 * Integration tests with actual shortcut-cli would require mocking execFile.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShortcutBackend } from '../src/backends/shortcut.js';
import {
  AuthenticationError,
  NotFoundError,
  ValidationError
} from '../src/types/index.js';
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
    (ShortcutClient as any).mockImplementation(function() {
      return mockClient;
    });
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

describe('ShortcutBackend', () => {
  let backend: ShortcutBackend;

  beforeEach(() => {
    backend = new ShortcutBackend({
      defaultProject: 'test-project',
      defaultState: 'In Progress',
      defaultType: 'feature'
    });
  });

  describe('Metadata', () => {
    it('should expose correct backend name', () => {
      expect(backend.name).toBe('shortcut');
    });

    it('should expose capability flags', () => {
      expect(backend.supportsProjects).toBe(true);
      expect(backend.supportsSubIssues).toBe(false);
      expect(backend.supportsCustomFields).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('should start unauthenticated', () => {
      expect(backend.isAuthenticated()).toBe(false);
    });

    it('should require authentication before operations', async () => {
      // Try to get an issue without authenticating
      await expect(backend.getIssue('123')).rejects.toThrow(AuthenticationError);
    });
  });


  describe('Story Parsing', () => {
    it('should parse Shortcut story to Issue format', () => {
      const backend = new ShortcutBackend();
      const parseStory = (backend as any).parseStory.bind(backend);

      const shortcutStory = {
        id: 123,
        name: 'Test Story',
        description: 'Story description',
        story_type: 'feature',
        workflow_state_id: 500,
        workflow_state: {
          name: 'In Progress',
          type: 'started' as const
        },
        owners: [
          {
            id: 'user-1',
            name: 'Test User',
            mention_name: 'testuser',
            email_address: 'test@example.com'
          }
        ],
        labels: [
          {
            id: 1,
            name: 'bug',
            color: '#ff0000',
            description: 'Bug label'
          }
        ],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        app_url: 'https://app.shortcut.com/org/story/123'
      };

      const issue = parseStory(shortcutStory);

      expect(issue.id).toBe('shortcut-123');
      expect(issue.number).toBe(123);
      expect(issue.title).toBe('Test Story');
      expect(issue.body).toBe('Story description');
      expect(issue.state).toBe('open');
      expect(issue.url).toBe('https://app.shortcut.com/org/story/123');

      expect(issue.assignees).toHaveLength(1);
      expect(issue.assignees[0].id).toBe('user-1');
      expect(issue.assignees[0].login).toBe('testuser');
      expect(issue.assignees[0].name).toBe('Test User');
      expect(issue.assignees[0].email).toBe('test@example.com');

      expect(issue.labels).toHaveLength(1);
      expect(issue.labels[0].id).toBe('1');
      expect(issue.labels[0].name).toBe('bug');
      expect(issue.labels[0].color).toBe('#ff0000');

      expect(issue.metadata.storyType).toBe('feature');
      expect(issue.metadata.workflowStateId).toBe(500);
      expect(issue.metadata.workflowStateName).toBe('In Progress');
    });

    it('should map workflow states correctly', () => {
      const backend = new ShortcutBackend();
      const mapWorkflowState = (backend as any).mapWorkflowState.bind(backend);

      expect(mapWorkflowState('unstarted')).toBe('open');
      expect(mapWorkflowState('started')).toBe('open');
      expect(mapWorkflowState('done')).toBe('closed');
      expect(mapWorkflowState(undefined)).toBe('open');
    });

    it('should handle story without optional fields', () => {
      const backend = new ShortcutBackend();
      const parseStory = (backend as any).parseStory.bind(backend);

      const minimalStory = {
        id: 456,
        name: 'Minimal Story',
        story_type: 'bug',
        workflow_state_id: 100,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        app_url: 'https://app.shortcut.com/org/story/456'
      };

      const issue = parseStory(minimalStory);

      expect(issue.id).toBe('shortcut-456');
      expect(issue.body).toBe('');
      expect(issue.assignees).toHaveLength(0);
      expect(issue.labels).toHaveLength(0);
      expect(issue.state).toBe('open'); // Default when no workflow_state
    });
  });

  describe('Comment Parsing', () => {
    it('should parse Shortcut comment to Comment format', () => {
      const backend = new ShortcutBackend();
      const parseComment = (backend as any).parseShortcutComment.bind(backend);

      const shortcutComment = {
        id: 789,
        text: 'This is a test comment',
        author_id: 'user-123',
        author: {
          id: 'user-123',
          name: 'Comment Author',
          mention_name: 'cauthor',
          email_address: 'cauthor@example.com'
        },
        created_at: '2024-01-01T12:00:00Z',
        updated_at: '2024-01-01T12:30:00Z'
      };

      const comment = parseComment(shortcutComment);

      expect(comment.id).toBe('789');
      expect(comment.body).toBe('This is a test comment');
      expect(comment.author.id).toBe('user-123');
      expect(comment.author.login).toBe('cauthor');
      expect(comment.author.name).toBe('Comment Author');
      expect(comment.createdAt).toEqual(new Date('2024-01-01T12:00:00Z'));
      expect(comment.updatedAt).toEqual(new Date('2024-01-01T12:30:00Z'));
    });

    it('should handle comment without author details', () => {
      const backend = new ShortcutBackend();
      const parseComment = (backend as any).parseShortcutComment.bind(backend);

      const minimalComment = {
        id: 999,
        text: 'Minimal comment',
        author_id: 'user-456',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const comment = parseComment(minimalComment);

      expect(comment.id).toBe('999');
      expect(comment.body).toBe('Minimal comment');
      expect(comment.author.id).toBe('unknown');
      expect(comment.author.login).toBe('unknown');
      expect(comment.author.name).toBe('Unknown User');
    });
  });

  describe('Configuration', () => {
    it('should use default configuration values', () => {
      const backend = new ShortcutBackend();
      expect((backend as any).config.defaultType).toBe('feature');
    });

    it('should accept custom configuration', () => {
      const backend = new ShortcutBackend({
        defaultProject: 'my-project',
        defaultState: 'To Do',
        defaultType: 'bug'
      });

      const config = (backend as any).config;
      expect(config.defaultProject).toBe('my-project');
      expect(config.defaultState).toBe('To Do');
      expect(config.defaultType).toBe('bug');
    });
  });


  describe('Owners and Labels Parsing', () => {
    it('should parse empty owners array', () => {
      const backend = new ShortcutBackend();
      const parseOwners = (backend as any).parseOwners.bind(backend);

      expect(parseOwners(undefined)).toEqual([]);
      expect(parseOwners([])).toEqual([]);
    });

    it('should parse empty labels array', () => {
      const backend = new ShortcutBackend();
      const parseLabels = (backend as any).parseLabels.bind(backend);

      expect(parseLabels(undefined)).toEqual([]);
      expect(parseLabels([])).toEqual([]);
    });

    it('should parse multiple owners', () => {
      const backend = new ShortcutBackend();
      const parseOwners = (backend as any).parseOwners.bind(backend);

      const owners = [
        { id: '1', name: 'User One', mention_name: 'user1', email_address: 'one@example.com' },
        { id: '2', name: 'User Two', mention_name: 'user2', email_address: 'two@example.com' }
      ];

      const parsed = parseOwners(owners);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe('1');
      expect(parsed[0].login).toBe('user1');
      expect(parsed[1].id).toBe('2');
      expect(parsed[1].login).toBe('user2');
    });

    it('should parse multiple labels', () => {
      const backend = new ShortcutBackend();
      const parseLabels = (backend as any).parseLabels.bind(backend);

      const labels = [
        { id: 1, name: 'bug', color: '#ff0000', description: 'Bug reports' },
        { id: 2, name: 'feature', color: '#00ff00', description: 'New features' }
      ];

      const parsed = parseLabels(labels);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe('1');
      expect(parsed[0].name).toBe('bug');
      expect(parsed[1].id).toBe('2');
      expect(parsed[1].name).toBe('feature');
    });
  });

  describe('Story Operations', () => {
    let backend: ShortcutBackend;
    let mockClient: any;

    beforeEach(async () => {
      mockClient = {
        getCurrentMemberInfo: vi.fn(),
        createStory: vi.fn(),
        getStory: vi.fn(),
        updateStory: vi.fn(),
        listWorkflows: vi.fn(),
        createStoryComment: vi.fn()
      };
      (ShortcutClient as any).mockImplementation(function() {
        return mockClient;
      });

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
        data: {
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
        }
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
        data: {
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
        }
      });

      const issue = await backend.getIssue('123');

      expect(issue.title).toBe('Existing Story');
      expect(mockClient.getStory).toHaveBeenCalledWith(123);
    });

    it('should update story with ShortcutClient', async () => {
      mockClient.getStory.mockResolvedValue({
        data: {
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
        }
      });

      mockClient.updateStory.mockResolvedValue({
        data: {
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
        }
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

  describe('Comment Operations', () => {
    let backend: ShortcutBackend;
    let mockClient: any;

    beforeEach(async () => {
      mockClient = {
        getCurrentMemberInfo: vi.fn(),
        createStoryComment: vi.fn(),
        getStory: vi.fn()
      };
      (ShortcutClient as any).mockImplementation(function() {
        return mockClient;
      });

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
        data: {
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
        data: {
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
        }
      });

      const comments = await backend.listComments('123');

      expect(comments).toHaveLength(2);
      expect(comments[0].body).toBe('First comment');
      expect(comments[1].body).toBe('Second comment');
      expect(mockClient.getStory).toHaveBeenCalledWith(123);
    });

    it('should return empty array when no comments', async () => {
      mockClient.getStory.mockResolvedValue({
        data: {
          id: 123,
          name: 'Test Story',
          comments: undefined
        }
      });

      const comments = await backend.listComments('123');

      expect(comments).toEqual([]);
    });
  });

  describe('Search and Link Operations', () => {
    let backend: ShortcutBackend;
    let mockClient: any;

    beforeEach(async () => {
      mockClient = {
        getCurrentMemberInfo: vi.fn(),
        searchStories: vi.fn(),
        createStoryLink: vi.fn(),
        getStory: vi.fn(),
        updateStory: vi.fn(),
        listStories: vi.fn()
      };
      (ShortcutClient as any).mockImplementation(function() {
        return mockClient;
      });

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
      mockClient.getStory.mockResolvedValueOnce({
        data: {
          id: 123,
          name: 'Parent Story',
          story_links: [
            {
              subject_id: 123,
              object_id: 456,
              verb: 'blocks'
            }
          ]
        }
      }).mockResolvedValueOnce({
        data: {
          id: 456,
          name: 'Linked Story',
          description: 'Linked body',
          story_type: 'feature',
          workflow_state_id: 500,
          workflow_state: {
            name: 'Ready',
            type: 'unstarted'
          },
          created_at: '2025-11-04T00:00:00Z',
          updated_at: '2025-11-04T00:00:00Z',
          app_url: 'https://app.shortcut.com/test/story/456',
          owners: [],
          labels: []
        }
      });

      const linked = await backend.getLinkedIssues('123');

      expect(linked).toHaveLength(1);
      expect(linked[0].linkType).toBe('blocks');
    });
  });

  describe('Project Operations', () => {
    let backend: ShortcutBackend;
    let mockClient: any;

    beforeEach(async () => {
      mockClient = {
        getCurrentMemberInfo: vi.fn(),
        updateStory: vi.fn(),
        listStories: vi.fn()
      };
      (ShortcutClient as any).mockImplementation(function() {
        return mockClient;
      });

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
      mockClient.listStories.mockResolvedValue({
        data: [
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
        ]
      });

      const stories = await backend.getProjectItems('456');

      expect(stories).toHaveLength(1);
      expect(mockClient.listStories).toHaveBeenCalledWith(456, {
        project_id: 456
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let mockClient: any;

    beforeEach(async () => {
      mockClient = {
        getCurrentMemberInfo: vi.fn(),
        createStory: vi.fn(),
        getStory: vi.fn(),
        updateStory: vi.fn(),
        listStories: vi.fn(),
        searchStories: vi.fn(),
        createStoryComment: vi.fn()
      };
      (ShortcutClient as any).mockImplementation(function() {
        return mockClient;
      });

      const credentials = {
        shortcut: { token: 'test_token_123' }
      };
      mockClient.getCurrentMemberInfo.mockResolvedValue({
        id: 'user-123',
        name: 'Test User'
      });
      backend = new ShortcutBackend({ credentials });
      await backend.authenticate();
    });

    it('should handle create story errors', async () => {
      mockClient.createStory.mockRejectedValue(new Error('API error'));

      await expect(backend.createIssue({
        title: 'Test Story',
        body: 'Body'
      })).rejects.toThrow('Failed to create story');
    });

    it('should handle get story errors', async () => {
      mockClient.getStory.mockRejectedValue(new Error('Story not found'));

      await expect(backend.getIssue('123')).rejects.toThrow('Failed to get story');
    });

    it('should handle update story errors', async () => {
      mockClient.updateStory.mockRejectedValue(new Error('Update failed'));

      await expect(backend.updateIssue('123', {
        title: 'New Title'
      })).rejects.toThrow('Failed to update story');
    });

    it('should handle list stories errors', async () => {
      mockClient.listStories.mockRejectedValue(new Error('List failed'));

      await expect(backend.searchIssues({
        text: 'test'
      })).rejects.toThrow('Failed to search stories');
    });

    it('should handle create comment errors', async () => {
      mockClient.createStoryComment.mockRejectedValue(new Error('Comment failed'));

      await expect(backend.addComment('123', 'Test comment')).rejects.toThrow('Failed to add comment');
    });

    it('should handle list comments errors', async () => {
      mockClient.getStory.mockRejectedValue(new Error('Get story failed'));

      await expect(backend.listComments('123')).rejects.toThrow('Failed to list comments');
    });

    it('should handle add to project errors', async () => {
      mockClient.updateStory.mockRejectedValue(new Error('Update failed'));

      await expect(backend.addToProject('123', '456')).rejects.toThrow('Failed to add to project');
    });

    it('should handle get project items errors', async () => {
      mockClient.listStories.mockRejectedValue(new Error('List failed'));

      await expect(backend.getProjectItems('456')).rejects.toThrow('Failed to get project items');
    });

    it('should handle stories with missing workflow state', async () => {
      mockClient.searchStories.mockResolvedValue({
        data: [
          {
            id: 1,
            name: 'Story without state',
            description: 'Body',
            story_type: 'feature',
            workflow_state_id: 500,
            // workflow_state is missing
            created_at: '2025-11-04T00:00:00Z',
            updated_at: '2025-11-04T00:00:00Z',
            app_url: 'https://app.shortcut.com/test/story/1',
            owners: [],
            labels: []
          }
        ]
      });

      const stories = await backend.searchIssues({ text: 'test' });

      expect(stories).toHaveLength(1);
      expect(stories[0].state).toBe('open'); // Should default to 'open'
    });

    it('should handle stories with done workflow type', async () => {
      mockClient.getStory.mockResolvedValue({
        data: {
          id: 1,
          name: 'Completed Story',
          description: 'Body',
          story_type: 'feature',
          workflow_state_id: 500,
          workflow_state: {
            name: 'Completed',
            type: 'done'
          },
          created_at: '2025-11-04T00:00:00Z',
          updated_at: '2025-11-04T00:00:00Z',
          app_url: 'https://app.shortcut.com/test/story/1',
          owners: [],
          labels: []
        }
      });

      const story = await backend.getIssue('1');

      expect(story.state).toBe('closed');
    });

    it('should handle stories without description', async () => {
      mockClient.getStory.mockResolvedValue({
        data: {
          id: 1,
          name: 'Story without description',
          // description is missing
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
      });

      const story = await backend.getIssue('1');

      expect(story.body).toBe('');
    });

    it('should handle search with multiple filters', async () => {
      mockClient.searchStories.mockResolvedValue({ data: [] });

      await backend.searchIssues({
        text: 'test',
        state: 'closed',
        labels: ['bug', 'urgent'],
        assignee: 'user-123'
      });

      expect(mockClient.searchStories).toHaveBeenCalledWith({
        query: 'test'
      });
    });

    it('should handle empty search results', async () => {
      mockClient.searchStories.mockResolvedValue({ data: [] });

      const results = await backend.searchIssues({ text: 'nonexistent' });

      expect(results).toEqual([]);
    });

    it('should handle stories with labels', async () => {
      mockClient.getStory.mockResolvedValue({
        data: {
        id: 1,
        name: 'Story with labels',
        description: 'Body',
        story_type: 'bug',
        workflow_state_id: 500,
        workflow_state: {
          name: 'In Progress',
          type: 'started'
        },
        created_at: '2025-11-04T00:00:00Z',
        updated_at: '2025-11-04T00:00:00Z',
        app_url: 'https://app.shortcut.com/test/story/1',
        owners: [],
        labels: [
          { id: 1, name: 'bug', color: '#ff0000', description: 'Bug label' },
          { id: 2, name: 'urgent', color: '#ff9900' }
        ]
        }
      });

      const story = await backend.getIssue('1');

      expect(story.labels).toHaveLength(2);
      expect(story.labels[0].name).toBe('bug');
      expect(story.labels[0].color).toBe('#ff0000');
      expect(story.labels[1].name).toBe('urgent');
    });

    it('should handle stories with owners', async () => {
      mockClient.getStory.mockResolvedValue({
        data: {
        id: 1,
        name: 'Story with owners',
        description: 'Body',
        story_type: 'feature',
        workflow_state_id: 500,
        workflow_state: {
          name: 'Ready',
          type: 'unstarted'
        },
        created_at: '2025-11-04T00:00:00Z',
        updated_at: '2025-11-04T00:00:00Z',
        app_url: 'https://app.shortcut.com/test/story/1',
        owners: [
          { id: 'user-1', name: 'User One', mention_name: 'user1', email_address: 'user1@example.com' },
          { id: 'user-2', name: 'User Two', mention_name: 'user2' }
        ],
        labels: []
        }
      });

      const story = await backend.getIssue('1');

      expect(story.assignees).toHaveLength(2);
      expect(story.assignees[0].id).toBe('user-1');
      expect(story.assignees[0].name).toBe('User One');
      expect(story.assignees[0].email).toBe('user1@example.com');
      expect(story.assignees[1].id).toBe('user-2');
      expect(story.assignees[1].email).toBeUndefined();
    });

    it('should handle comments with authors', async () => {
      mockClient.getStory.mockResolvedValue({
        data: {
          id: 1,
          name: 'Story',
          description: 'Body',
          story_type: 'feature',
          workflow_state_id: 500,
          workflow_state: { name: 'Ready', type: 'unstarted' },
          created_at: '2025-11-04T00:00:00Z',
          updated_at: '2025-11-04T00:00:00Z',
          app_url: 'https://app.shortcut.com/test/story/1',
          owners: [],
          labels: [],
          comments: [
            {
              id: 1,
              text: 'Comment 1',
              author_id: 'user-1',
              author: {
                id: 'user-1',
                name: 'Author One',
                mention_name: 'author1',
                email_address: 'author1@example.com'
              },
              created_at: '2025-11-04T00:00:00Z',
              updated_at: '2025-11-04T00:00:00Z'
            }
          ]
        }
      });

      const comments = await backend.listComments('1');

      expect(comments).toHaveLength(1);
      expect(comments[0].body).toBe('Comment 1');
      expect(comments[0].author?.id).toBe('user-1');
      expect(comments[0].author?.name).toBe('Author One');
    });

    it('should handle comments without authors', async () => {
      mockClient.getStory.mockResolvedValue({
        data: {
          id: 1,
          name: 'Story',
          description: 'Body',
          story_type: 'feature',
          workflow_state_id: 500,
          workflow_state: { name: 'Ready', type: 'unstarted' },
          created_at: '2025-11-04T00:00:00Z',
          updated_at: '2025-11-04T00:00:00Z',
          app_url: 'https://app.shortcut.com/test/story/1',
          owners: [],
          labels: [],
          comments: [
            {
              id: 1,
              text: 'Comment without author',
              author_id: 'user-1',
              created_at: '2025-11-04T00:00:00Z',
              updated_at: '2025-11-04T00:00:00Z'
            }
          ]
        }
      });

      const comments = await backend.listComments('1');

      expect(comments).toHaveLength(1);
      expect(comments[0].author.id).toBe('unknown');
      expect(comments[0].author.login).toBe('unknown');
      expect(comments[0].author.name).toBe('Unknown User');
    });

    it('should handle story with metadata', async () => {
      mockClient.getStory.mockResolvedValue({
        data: {
        id: 1,
        name: 'Story',
        description: 'Body',
        story_type: 'chore',
        workflow_state_id: 500,
        workflow_state: { name: 'Ready', type: 'unstarted' },
        created_at: '2025-11-04T00:00:00Z',
        updated_at: '2025-11-04T00:00:00Z',
        app_url: 'https://app.shortcut.com/test/story/1',
        owners: [],
        labels: []
        }
      });

      const story = await backend.getIssue('1');

      expect(story.metadata?.storyType).toBe('chore');
      expect(story.metadata?.workflowStateId).toBe(500);
    });
  });

  describe('Additional Features', () => {
    let mockClient: any;

    beforeEach(async () => {
      mockClient = {
        getCurrentMemberInfo: vi.fn(),
        createStoryLink: vi.fn(),
        getStory: vi.fn(),
        updateStory: vi.fn()
      };
      (ShortcutClient as any).mockImplementation(function() {
        return mockClient;
      });

      const credentials = {
        shortcut: { token: 'test_token_123' }
      };
      mockClient.getCurrentMemberInfo.mockResolvedValue({
        id: 'user-123',
        name: 'Test User'
      });
      backend = new ShortcutBackend({ credentials });
      await backend.authenticate();
    });

    it('should link issues successfully', async () => {
      mockClient.createStoryLink.mockResolvedValue({});

      await backend.linkIssues('1', '2', 'blocks' as any);

      expect(mockClient.createStoryLink).toHaveBeenCalledWith({
        subject_id: 1,
        object_id: 2,
        verb: 'blocks'
      });
    });

    it('should get linked issues successfully', async () => {
      mockClient.getStory.mockResolvedValue({
        data: {
          id: 1,
          name: 'Story',
          story_links: []
        }
      });

      const linked = await backend.getLinkedIssues('1');

      expect(linked).toEqual([]);
      expect(mockClient.getStory).toHaveBeenCalledWith(1);
    });

    it('should update project field successfully', async () => {
      mockClient.updateStory.mockResolvedValue({});

      await backend.updateProjectField('1', 'status', 'Done');

      expect(mockClient.updateStory).toHaveBeenCalledWith(1, {
        custom_fields: { status: 'Done' }
      });
    });
  });
});
