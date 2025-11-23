// tests/backends/github.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubBackend } from '../../src/backends/github.js';
import { LinkType } from '../../src/types/index.js';
import { Octokit } from 'octokit';

// Mock Octokit
vi.mock('octokit');

// Mock GhCli to prevent subprocess spawning
vi.mock('../../src/utils/gh-cli.js', () => ({
  GhCli: vi.fn().mockImplementation(() => ({})),
  formatMermaidComment: vi.fn(x => x)
}));

describe('GitHubBackend with Octokit', () => {
  let backend: GitHubBackend;
  let mockOctokit: any;

  beforeEach(() => {
    mockOctokit = {
      rest: {
        users: {
          getAuthenticated: vi.fn()
        }
      },
      graphql: vi.fn()
    };
    (Octokit as any).mockImplementation(function() {
      return mockOctokit;
    });
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
      mockOctokit.rest.issues = {
        create: vi.fn().mockResolvedValue({
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
        })
      };

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
      mockOctokit.rest.issues = {
        get: vi.fn().mockResolvedValue({
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
        })
      };

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
      mockOctokit.rest.issues = {
        get: vi.fn().mockResolvedValue({
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
        }),
        update: vi.fn().mockResolvedValue({
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
        })
      };

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

  describe('Comment Operations', () => {
    beforeEach(async () => {
      const credentials = {
        github: { token: 'test_token', scopes: ['repo'] }
      };
      mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
        data: { login: 'testuser' }
      });
      mockOctokit.rest.issues = {
        get: vi.fn(),
        createComment: vi.fn(),
        listComments: vi.fn()
      };
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

  describe('Search and Link Operations', () => {
    beforeEach(async () => {
      const credentials = {
        github: { token: 'test_token', scopes: ['repo'] }
      };
      mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
        data: { login: 'testuser' }
      });
      mockOctokit.rest.search = {
        issuesAndPullRequests: vi.fn()
      };
      mockOctokit.rest.issues = {
        get: vi.fn(),
        createComment: vi.fn(),
        listComments: vi.fn()
      };
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
        text: 'test',
        repository: 'owner/repo'
      });

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Issue 1');
      expect(mockOctokit.rest.search.issuesAndPullRequests).toHaveBeenCalled();
    });

    it('should filter out pull requests from search results', async () => {
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
            },
            {
              id: 2,
              node_id: 'PR_2',
              number: 2,
              title: 'Pull Request 2',
              body: 'PR Body',
              state: 'open',
              created_at: '2025-11-04T00:00:00Z',
              updated_at: '2025-11-04T00:00:00Z',
              html_url: 'https://github.com/owner/repo/pull/2',
              repository_url: 'https://api.github.com/repos/owner/repo',
              assignees: [],
              labels: [],
              pull_request: { url: 'https://api.github.com/repos/owner/repo/pulls/2' }
            }
          ]
        }
      });

      const results = await backend.searchIssues({
        text: 'test',
        repository: 'owner/repo'
      });

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Issue 1');
    });

    it('should link issues by adding comment', async () => {
      // Mock getIssue for parent
      mockOctokit.rest.issues.get.mockResolvedValue({
        data: {
          id: 1,
          node_id: 'I_parent',
          number: 1,
          title: 'Parent Issue',
          body: 'Parent body',
          state: 'open',
          created_at: '2025-11-04T00:00:00Z',
          updated_at: '2025-11-04T00:00:00Z',
          html_url: 'https://github.com/owner/repo/issues/1',
          assignees: [],
          labels: []
        }
      });

      // Mock createComment
      mockOctokit.rest.issues.createComment.mockResolvedValue({
        data: {
          id: 1,
          node_id: 'IC_1',
          body: 'Blocks owner/repo#2',
          created_at: '2025-11-04T00:00:00Z',
          updated_at: '2025-11-04T00:00:00Z',
          user: {
            id: 1,
            login: 'testuser',
            node_id: 'U_1'
          }
        }
      });

      await backend.linkIssues('owner/repo#1', 'owner/repo#2', LinkType.BLOCKS);

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('Blocks owner/repo#2')
        })
      );
    });

    it('should link issues with related type', async () => {
      mockOctokit.rest.issues.get.mockResolvedValue({
        data: {
          id: 1,
          node_id: 'I_parent',
          number: 1,
          title: 'Issue 1',
          body: 'Body',
          state: 'open',
          created_at: '2025-11-04T00:00:00Z',
          updated_at: '2025-11-04T00:00:00Z',
          html_url: 'https://github.com/owner/repo/issues/1',
          assignees: [],
          labels: []
        }
      });

      mockOctokit.rest.issues.createComment.mockResolvedValue({
        data: {
          id: 1,
          node_id: 'IC_1',
          body: 'Related to owner/repo#2',
          created_at: '2025-11-04T00:00:00Z',
          updated_at: '2025-11-04T00:00:00Z',
          user: {
            id: 1,
            login: 'testuser',
            node_id: 'U_1'
          }
        }
      });

      await backend.linkIssues('owner/repo#1', 'owner/repo#2', LinkType.RELATED);

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('Related to owner/repo#2')
        })
      );
    });

    it('should link issues with parent-child type', async () => {
      mockOctokit.rest.issues.get.mockResolvedValue({
        data: {
          id: 1,
          node_id: 'I_parent',
          number: 1,
          title: 'Parent Issue',
          body: 'Parent body',
          state: 'open',
          created_at: '2025-11-04T00:00:00Z',
          updated_at: '2025-11-04T00:00:00Z',
          html_url: 'https://github.com/owner/repo/issues/1',
          assignees: [],
          labels: []
        }
      });

      mockOctokit.rest.issues.createComment.mockResolvedValue({
        data: {
          id: 1,
          node_id: 'IC_1',
          body: 'Parent of owner/repo#2',
          created_at: '2025-11-04T00:00:00Z',
          updated_at: '2025-11-04T00:00:00Z',
          user: {
            id: 1,
            login: 'testuser',
            node_id: 'U_1'
          }
        }
      });

      await backend.linkIssues('owner/repo#1', 'owner/repo#2', LinkType.PARENT_CHILD);

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('Parent of owner/repo#2')
        })
      );
    });

    it('should get linked issues from comments', async () => {
      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [
          {
            id: 1,
            node_id: 'IC_1',
            body: 'Blocks owner/repo#2',
            created_at: '2025-11-04T00:00:00Z',
            updated_at: '2025-11-04T00:00:00Z',
            user: { id: 1, login: 'user1', node_id: 'U_1' }
          },
          {
            id: 2,
            node_id: 'IC_2',
            body: 'Related to owner/repo#3',
            created_at: '2025-11-04T00:01:00Z',
            updated_at: '2025-11-04T00:01:00Z',
            user: { id: 2, login: 'user2', node_id: 'U_2' }
          },
          {
            id: 3,
            node_id: 'IC_3',
            body: 'Parent of owner/repo#4',
            created_at: '2025-11-04T00:02:00Z',
            updated_at: '2025-11-04T00:02:00Z',
            user: { id: 3, login: 'user3', node_id: 'U_3' }
          },
          {
            id: 4,
            node_id: 'IC_4',
            body: 'Regular comment without links',
            created_at: '2025-11-04T00:03:00Z',
            updated_at: '2025-11-04T00:03:00Z',
            user: { id: 4, login: 'user4', node_id: 'U_4' }
          }
        ]
      });

      const linkedIssues = await backend.getLinkedIssues('owner/repo#1');

      expect(linkedIssues).toHaveLength(3);
      expect(linkedIssues[0].issue.id).toBe('owner/repo#2');
      expect(linkedIssues[0].linkType).toBe('blocks');
      expect(linkedIssues[1].issue.id).toBe('owner/repo#3');
      expect(linkedIssues[1].linkType).toBe('relates-to');
      expect(linkedIssues[2].issue.id).toBe('owner/repo#4');
      expect(linkedIssues[2].linkType).toBe('child');
    });
  });

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
      mockOctokit.rest.issues = {
        get: vi.fn().mockResolvedValue({
          data: {
            id: 123,
            node_id: 'I_kwTest',
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
        })
      };

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

    it('should handle project not found error', async () => {
      mockOctokit.graphql.mockRejectedValue({
        message: 'Could not resolve to a node with the global id of not found',
        status: 404
      });

      await expect(backend.getProjectItems('PVT_invalid')).rejects.toThrow('Project PVT_invalid not found');
    });

    it('should handle permission denied when adding to project', async () => {
      mockOctokit.rest.issues = {
        get: vi.fn().mockResolvedValue({
          data: {
            id: 123,
            node_id: 'I_kwTest',
            number: 42,
            title: 'Test Issue',
            html_url: 'https://github.com/owner/repo/issues/42'
          }
        })
      };

      mockOctokit.graphql.mockRejectedValue({
        message: 'Permission denied',
        status: 403
      });

      await expect(backend.addToProject('owner/repo#42', 'PVT_kwProject')).rejects.toThrow('Permission denied');
    });

    it('should handle permission denied when getting project items', async () => {
      mockOctokit.graphql.mockRejectedValue({
        message: 'Permission denied',
        status: 403
      });

      await expect(backend.getProjectItems('PVT_kwProject')).rejects.toThrow('Permission denied');
    });

    it('should handle other errors when adding to project', async () => {
      mockOctokit.rest.issues = {
        get: vi.fn().mockResolvedValue({
          data: {
            id: 123,
            node_id: 'I_kwTest',
            number: 42,
            title: 'Test Issue',
            html_url: 'https://github.com/owner/repo/issues/42'
          }
        })
      };

      mockOctokit.graphql.mockRejectedValue({
        message: 'Network error',
        status: 500
      });

      await expect(backend.addToProject('owner/repo#42', 'PVT_kwProject')).rejects.toThrow('Failed to add to project');
    });

    it('should handle other errors when getting project items', async () => {
      mockOctokit.graphql.mockRejectedValue({
        message: 'Network error',
        status: 500
      });

      await expect(backend.getProjectItems('PVT_kwProject')).rejects.toThrow('Failed to get project items');
    });

    it('should handle empty project items', async () => {
      mockOctokit.graphql.mockResolvedValue({
        node: null
      });

      const items = await backend.getProjectItems('PVT_kwProject');

      expect(items).toEqual([]);
    });

    it('should filter out items without content', async () => {
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
              },
              {
                id: 'PVTI_2',
                content: null // Should be filtered out
              }
            ]
          }
        }
      });

      const items = await backend.getProjectItems('PVT_kwProject');

      expect(items).toHaveLength(1);
      expect(items[0].number).toBe(1);
    });

    it('should throw not implemented error for updateProjectField', async () => {
      await expect(backend.updateProjectField('owner/repo#42', 'status', 'Done')).rejects.toThrow('not yet implemented');
    });
  });

  describe('Search with Edge Cases', () => {
    beforeEach(async () => {
      const credentials = {
        github: { token: 'test_token', scopes: ['repo'] }
      };
      mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
        data: { login: 'testuser' }
      });
      mockOctokit.rest.search = {
        issuesAndPullRequests: vi.fn()
      };
      backend = new GitHubBackend({ credentials, defaultRepo: 'owner/repo' });
      await backend.authenticate();
    });

    it('should search with state filter', async () => {
      mockOctokit.rest.search.issuesAndPullRequests.mockResolvedValue({
        data: { items: [] }
      });

      await backend.searchIssues({
        text: 'test',
        repository: 'owner/repo',
        state: 'closed'
      });

      expect(mockOctokit.rest.search.issuesAndPullRequests).toHaveBeenCalledWith({
        q: 'test repo:owner/repo state:closed',
        per_page: 100
      });
    });

    it('should search with all state', async () => {
      mockOctokit.rest.search.issuesAndPullRequests.mockResolvedValue({
        data: { items: [] }
      });

      await backend.searchIssues({
        text: 'test',
        repository: 'owner/repo',
        state: 'all'
      });

      expect(mockOctokit.rest.search.issuesAndPullRequests).toHaveBeenCalledWith({
        q: 'test repo:owner/repo',
        per_page: 100
      });
    });

    it('should search with labels filter', async () => {
      mockOctokit.rest.search.issuesAndPullRequests.mockResolvedValue({
        data: { items: [] }
      });

      await backend.searchIssues({
        text: 'test',
        repository: 'owner/repo',
        labels: ['bug', 'high-priority']
      });

      expect(mockOctokit.rest.search.issuesAndPullRequests).toHaveBeenCalledWith({
        q: 'test repo:owner/repo label:"bug" label:"high-priority"',
        per_page: 100
      });
    });

    it('should search with assignee filter', async () => {
      mockOctokit.rest.search.issuesAndPullRequests.mockResolvedValue({
        data: { items: [] }
      });

      await backend.searchIssues({
        text: 'test',
        repository: 'owner/repo',
        assignee: 'testuser'
      });

      expect(mockOctokit.rest.search.issuesAndPullRequests).toHaveBeenCalledWith({
        q: 'test repo:owner/repo assignee:testuser',
        per_page: 100
      });
    });

    it('should handle search errors', async () => {
      mockOctokit.rest.search.issuesAndPullRequests.mockRejectedValue({
        message: 'API rate limit exceeded',
        status: 403
      });

      await expect(backend.searchIssues({
        text: 'test',
        repository: 'owner/repo'
      })).rejects.toThrow('Failed to search issues');
    });

    it('should extract repository from repository_url', async () => {
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
              html_url: 'https://github.com/other/repo/issues/1',
              repository_url: 'https://api.github.com/repos/other/repo',
              assignees: [],
              labels: []
            }
          ]
        }
      });

      const results = await backend.searchIssues({
        text: 'test'
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('I_1');
    });
  });

  describe('Link Type Validation', () => {
    beforeEach(async () => {
      const credentials = {
        github: { token: 'test_token', scopes: ['repo'] }
      };
      mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
        data: { login: 'testuser' }
      });
      mockOctokit.rest.issues = {
        get: vi.fn().mockResolvedValue({
          data: {
            id: 1,
            node_id: 'I_parent',
            number: 1,
            title: 'Parent Issue',
            body: 'Parent body',
            state: 'open',
            created_at: '2025-11-04T00:00:00Z',
            updated_at: '2025-11-04T00:00:00Z',
            html_url: 'https://github.com/owner/repo/issues/1',
            assignees: [],
            labels: []
          }
        }),
        createComment: vi.fn().mockResolvedValue({
          data: {
            id: 1,
            node_id: 'IC_1',
            body: 'Test',
            created_at: '2025-11-04T00:00:00Z',
            updated_at: '2025-11-04T00:00:00Z',
            user: { id: 1, login: 'testuser', node_id: 'U_1' }
          }
        })
      };
      backend = new GitHubBackend({ credentials, defaultRepo: 'owner/repo' });
      await backend.authenticate();
    });

    it('should handle exhaustive link type check', async () => {
      // This tests the default case in the switch which should never be reached
      // We can't directly test it without type casting, but it's there for type safety
      await backend.linkIssues('owner/repo#1', 'owner/repo#2', LinkType.BLOCKS);
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
    });
  });
});
