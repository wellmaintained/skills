/**
 * Tests for ShortcutBackend
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { ShortcutBackend } from '../src/backends/shortcut.js';
import {
  AuthenticationError,
  NotSupportedError,
  ValidationError
} from '../src/types/index.js';
import { ShortcutClient } from '@shortcut/client';

// Mock ShortcutClient
let mockClientInstance: any;
mock.module('@shortcut/client', () => ({
  ShortcutClient: mock(() => mockClientInstance)
}));

describe('ShortcutBackend with ShortcutClient', () => {
  let backend: ShortcutBackend;

  beforeEach(() => {
    mockClientInstance = {
      getCurrentMemberInfo: mock()
    };
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

    mockClientInstance.getCurrentMemberInfo.mockResolvedValue({
      id: 'member-123',
      name: 'Test User'
    });

    backend = new ShortcutBackend({ credentials });
    await backend.authenticate();

    expect(backend.isAuthenticated()).toBe(true);
    expect(mockClientInstance.getCurrentMemberInfo).toHaveBeenCalled();
  });

  it('should throw error if not authenticated', async () => {
    backend = new ShortcutBackend({});

    try {
      await backend.authenticate();
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message).toContain('Not authenticated with Shortcut');
    }
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
      try {
        await backend.getIssue('123');
        expect(true).toBe(false);
      } catch (e) {
        expect(e).toBeInstanceOf(AuthenticationError);
      }
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
  });

  describe('Story Operations', () => {
    let backend: ShortcutBackend;

    beforeEach(async () => {
      mockClientInstance = {
        getCurrentMemberInfo: mock(),
        createStory: mock(),
        getStory: mock(),
        updateStory: mock(),
        listWorkflows: mock(),
        createStoryComment: mock()
      };

      const credentials = {
        shortcut: { token: 'test_token' }
      };
      mockClientInstance.getCurrentMemberInfo.mockResolvedValue({
        id: 'member-123',
        name: 'Test User'
      });
      backend = new ShortcutBackend({ credentials, defaultProject: 'test-project' });
      await backend.authenticate();
    });

    it('should create story with ShortcutClient', async () => {
      mockClientInstance.createStory.mockResolvedValue({
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
      expect(mockClientInstance.createStory).toHaveBeenCalledWith({
        name: 'Test Story',
        description: 'Test body',
        story_type: 'feature'
      });
    });

    it('should get story by ID with ShortcutClient', async () => {
      mockClientInstance.getStory.mockResolvedValue({
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
      expect(mockClientInstance.getStory).toHaveBeenCalledWith(123);
    });
  });
});
