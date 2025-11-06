/**
 * Tests for ProjectManagementBackend interface contract
 *
 * These tests verify that backend implementations correctly
 * implement the interface contract.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockBackend } from './mocks/mock-backend.js';
import { LinkType, NotFoundError, ValidationError } from '../src/types/index.js';

describe('ProjectManagementBackend Interface Contract', () => {
  let backend: MockBackend;

  beforeEach(() => {
    backend = new MockBackend();
    backend.reset();
  });

  describe('Metadata', () => {
    it('should expose backend name', () => {
      expect(backend.name).toBe('mock');
    });

    it('should expose capability flags', () => {
      expect(backend.supportsProjects).toBe(true);
      expect(backend.supportsSubIssues).toBe(true);
      expect(backend.supportsCustomFields).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('should authenticate successfully', async () => {
      backend.setAuthenticated(false);
      expect(backend.isAuthenticated()).toBe(false);

      await backend.authenticate();
      expect(backend.isAuthenticated()).toBe(true);
    });

    it('should check authentication state', () => {
      expect(backend.isAuthenticated()).toBe(true);
      backend.setAuthenticated(false);
      expect(backend.isAuthenticated()).toBe(false);
    });
  });

  describe('Issue Operations', () => {
    describe('createIssue', () => {
      it('should create a basic issue', async () => {
        const issue = await backend.createIssue({
          title: 'Test Issue',
          body: 'Test description'
        });

        expect(issue).toBeDefined();
        expect(issue.id).toBeDefined();
        expect(issue.number).toBeGreaterThan(0);
        expect(issue.title).toBe('Test Issue');
        expect(issue.body).toBe('Test description');
        expect(issue.state).toBe('open');
        expect(issue.url).toBeDefined();
      });

      it('should create issue with assignees and labels', async () => {
        const issue = await backend.createIssue({
          title: 'Assigned Issue',
          body: 'Description',
          assignees: ['user1', 'user2'],
          labels: ['bug', 'priority-high']
        });

        expect(issue.assignees).toHaveLength(2);
        expect(issue.assignees[0].login).toBe('user1');
        expect(issue.labels).toHaveLength(2);
        expect(issue.labels[0].name).toBe('bug');
      });

      it('should throw ValidationError for missing title', async () => {
        await expect(
          backend.createIssue({ title: '', body: 'Test' })
        ).rejects.toThrow(ValidationError);
      });

      it('should auto-add to project if projectId provided', async () => {
        const issue = await backend.createIssue({
          title: 'Test',
          body: 'Test',
          projectId: 'project-1'
        });

        const items = await backend.getProjectItems?.('project-1');
        expect(items).toHaveLength(1);
        expect(items![0].id).toBe(issue.id);
      });
    });

    describe('getIssue', () => {
      it('should retrieve existing issue', async () => {
        const created = await backend.createIssue({
          title: 'Test Issue',
          body: 'Description'
        });

        const retrieved = await backend.getIssue(created.id);
        expect(retrieved.id).toBe(created.id);
        expect(retrieved.title).toBe('Test Issue');
      });

      it('should throw NotFoundError for non-existent issue', async () => {
        await expect(backend.getIssue('non-existent')).rejects.toThrow(
          NotFoundError
        );
      });
    });

    describe('updateIssue', () => {
      it('should update issue title and body', async () => {
        const issue = await backend.createIssue({
          title: 'Original',
          body: 'Original body'
        });

        const updated = await backend.updateIssue(issue.id, {
          title: 'Updated',
          body: 'Updated body'
        });

        expect(updated.title).toBe('Updated');
        expect(updated.body).toBe('Updated body');
        expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
          issue.createdAt.getTime()
        );
      });

      it('should update issue state', async () => {
        const issue = await backend.createIssue({
          title: 'Test',
          body: 'Test'
        });

        const updated = await backend.updateIssue(issue.id, {
          state: 'closed'
        });

        expect(updated.state).toBe('closed');
      });

      it('should update assignees and labels', async () => {
        const issue = await backend.createIssue({
          title: 'Test',
          body: 'Test'
        });

        const updated = await backend.updateIssue(issue.id, {
          assignees: ['newuser'],
          labels: ['newlabel']
        });

        expect(updated.assignees).toHaveLength(1);
        expect(updated.assignees[0].login).toBe('newuser');
        expect(updated.labels).toHaveLength(1);
        expect(updated.labels[0].name).toBe('newlabel');
      });
    });
  });

  describe('Comments', () => {
    it('should add comment to issue', async () => {
      const issue = await backend.createIssue({
        title: 'Test',
        body: 'Test'
      });

      const comment = await backend.addComment(
        issue.id,
        'This is a test comment'
      );

      expect(comment).toBeDefined();
      expect(comment.id).toBeDefined();
      expect(comment.body).toBe('This is a test comment');
      expect(comment.author).toBeDefined();
    });

    it('should list comments on issue', async () => {
      const issue = await backend.createIssue({
        title: 'Test',
        body: 'Test'
      });

      await backend.addComment(issue.id, 'Comment 1');
      await backend.addComment(issue.id, 'Comment 2');

      const comments = await backend.listComments(issue.id);
      expect(comments).toHaveLength(2);
      expect(comments[0].body).toBe('Comment 1');
      expect(comments[1].body).toBe('Comment 2');
    });

    it('should throw NotFoundError when commenting on non-existent issue', async () => {
      await expect(
        backend.addComment('non-existent', 'Comment')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Relationships', () => {
    it('should link issues with PARENT_CHILD relationship', async () => {
      const parent = await backend.createIssue({
        title: 'Parent Epic',
        body: 'Epic description'
      });
      const child = await backend.createIssue({
        title: 'Child Task',
        body: 'Task description'
      });

      await backend.linkIssues(parent.id, child.id, LinkType.PARENT_CHILD);

      const parentLinks = await backend.getLinkedIssues(parent.id);
      expect(parentLinks).toHaveLength(1);
      expect(parentLinks[0].issue.id).toBe(child.id);
      expect(parentLinks[0].linkType).toBe('child');

      const childLinks = await backend.getLinkedIssues(child.id);
      expect(childLinks).toHaveLength(1);
      expect(childLinks[0].issue.id).toBe(parent.id);
      expect(childLinks[0].linkType).toBe('parent');
    });

    it('should link issues with BLOCKS relationship', async () => {
      const blocker = await backend.createIssue({
        title: 'Blocker',
        body: 'Must complete first'
      });
      const blocked = await backend.createIssue({
        title: 'Blocked',
        body: 'Depends on blocker'
      });

      await backend.linkIssues(blocker.id, blocked.id, LinkType.BLOCKS);

      const blockerLinks = await backend.getLinkedIssues(blocker.id);
      expect(blockerLinks[0].linkType).toBe('blocks');

      const blockedLinks = await backend.getLinkedIssues(blocked.id);
      expect(blockedLinks[0].linkType).toBe('blocked-by');
    });

    it('should return empty array for issue with no links', async () => {
      const issue = await backend.createIssue({
        title: 'Isolated',
        body: 'No links'
      });

      const links = await backend.getLinkedIssues(issue.id);
      expect(links).toHaveLength(0);
    });
  });

  describe('Project Operations', () => {
    it('should add issue to project', async () => {
      const issue = await backend.createIssue({
        title: 'Test',
        body: 'Test'
      });

      await backend.addToProject?.(issue.id, 'project-1');

      const items = await backend.getProjectItems?.('project-1');
      expect(items).toHaveLength(1);
      expect(items![0].id).toBe(issue.id);
    });

    it('should update project custom field', async () => {
      const issue = await backend.createIssue({
        title: 'Test',
        body: 'Test'
      });

      await backend.updateProjectField?.(issue.id, 'Status', 'In Progress');
      await backend.updateProjectField?.(issue.id, 'Progress', 45);

      expect(backend.getProjectField(issue.id, 'Status')).toBe('In Progress');
      expect(backend.getProjectField(issue.id, 'Progress')).toBe(45);
    });

    it('should list all issues in project', async () => {
      const issue1 = await backend.createIssue({
        title: 'Issue 1',
        body: 'Test'
      });
      const issue2 = await backend.createIssue({
        title: 'Issue 2',
        body: 'Test'
      });

      await backend.addToProject?.(issue1.id, 'project-1');
      await backend.addToProject?.(issue2.id, 'project-1');

      const items = await backend.getProjectItems?.('project-1');
      expect(items).toHaveLength(2);
    });
  });

  describe('Search', () => {
    beforeEach(async () => {
      await backend.createIssue({
        title: 'Authentication Bug',
        body: 'Login fails',
        labels: ['bug', 'auth'],
        assignees: ['user1']
      });
      await backend.createIssue({
        title: 'Authentication Feature',
        body: 'Add OAuth',
        labels: ['feature', 'auth']
      });
      await backend.createIssue({
        title: 'Unrelated Task',
        body: 'Something else',
        labels: ['task'],
        state: 'open'
      });
    });

    it('should search by text in title', async () => {
      const results = await backend.searchIssues({ text: 'authentication' });
      expect(results).toHaveLength(2);
    });

    it('should search by text in body', async () => {
      const results = await backend.searchIssues({ text: 'oauth' });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Authentication Feature');
    });

    it('should filter by state', async () => {
      const issue = backend.getAllIssues()[0];
      await backend.updateIssue(issue.id, { state: 'closed' });

      const open = await backend.searchIssues({ state: 'open' });
      expect(open).toHaveLength(2);

      const closed = await backend.searchIssues({ state: 'closed' });
      expect(closed).toHaveLength(1);
    });

    it('should filter by labels (AND)', async () => {
      const results = await backend.searchIssues({ labels: ['auth', 'bug'] });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Authentication Bug');
    });

    it('should filter by assignee', async () => {
      const results = await backend.searchIssues({ assignee: 'user1' });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Authentication Bug');
    });

    it('should combine multiple filters', async () => {
      const results = await backend.searchIssues({
        text: 'authentication',
        labels: ['feature'],
        state: 'open'
      });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Authentication Feature');
    });
  });
});
