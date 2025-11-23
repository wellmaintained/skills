/**
 * Tests for IssueParser
 */

import { describe, it, expect } from 'vitest';
import { IssueParser } from '../src/decomposition/issue-parser.js';
import { Issue } from '../src/types/core.js';

describe('IssueParser', () => {
  const repositories = [
    { name: 'frontend', path: '/path/to/frontend' },
    { name: 'backend', path: '/path/to/backend' },
  ];

  const parser = new IssueParser(repositories);

  describe('parseTasks', () => {
    it('should parse uncompleted tasks', () => {
      const issue: Issue = {
        id: '1',
        number: 123,
        title: 'Test',
        body: '- [ ] Task 1\n- [ ] Task 2',
        state: 'open',
        assignees: [],
        labels: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/owner/repo/issues/123',
        metadata: {},
      };

      const parsed = parser.parse(issue, 'owner/repo');
      expect(parsed.tasks).toHaveLength(2);
      expect(parsed.tasks[0].completed).toBe(false);
    });

    it('should parse completed tasks', () => {
      const issue: Issue = {
        id: '1',
        number: 123,
        title: 'Test',
        body: '- [x] Done task\n- [ ] Todo task',
        state: 'open',
        assignees: [],
        labels: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/owner/repo/issues/123',
        metadata: {},
      };

      const parsed = parser.parse(issue, 'owner/repo');
      expect(parsed.tasks).toHaveLength(2);
      expect(parsed.tasks[0].completed).toBe(true);
      expect(parsed.tasks[1].completed).toBe(false);
    });

    it('should parse repository prefixes', () => {
      const issue: Issue = {
        id: '1',
        number: 123,
        title: 'Test',
        body: '- [ ] [frontend] Frontend task\n- [ ] [backend] Backend task',
        state: 'open',
        assignees: [],
        labels: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/owner/repo/issues/123',
        metadata: {},
      };

      const parsed = parser.parse(issue, 'owner/repo');
      expect(parsed.tasks).toHaveLength(2);
      expect(parsed.tasks[0].repository).toBe('frontend');
      expect(parsed.tasks[1].repository).toBe('backend');
    });
  });

  describe('parseRepositories', () => {
    it('should parse explicit repository section', () => {
      const issue: Issue = {
        id: '1',
        number: 123,
        title: 'Test',
        body: '## Repositories\n- frontend\n- backend\n\n- [ ] Task 1',
        state: 'open',
        assignees: [],
        labels: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/owner/repo/issues/123',
        metadata: {},
      };

      const parsed = parser.parse(issue, 'owner/repo');
      expect(parsed.repositories).toHaveLength(2);
      expect(parsed.repositories.map(r => r.name)).toContain('frontend');
      expect(parsed.repositories.map(r => r.name)).toContain('backend');
    });

    it('should use all repositories if none specified', () => {
      const issue: Issue = {
        id: '1',
        number: 123,
        title: 'Test',
        body: '- [ ] Task 1',
        state: 'open',
        assignees: [],
        labels: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/owner/repo/issues/123',
        metadata: {},
      };

      const parsed = parser.parse(issue, 'owner/repo');
      expect(parsed.repositories).toHaveLength(2);
    });
  });

  describe('hasTasks', () => {
    it('should detect task lists', () => {
      const issue: Issue = {
        id: '1',
        number: 123,
        title: 'Test',
        body: '- [ ] Task 1',
        state: 'open',
        assignees: [],
        labels: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/owner/repo/issues/123',
        metadata: {},
      };

      expect(parser.hasTasks(issue)).toBe(true);
    });

    it('should return false for no tasks', () => {
      const issue: Issue = {
        id: '1',
        number: 123,
        title: 'Test',
        body: 'Just a description',
        state: 'open',
        assignees: [],
        labels: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/owner/repo/issues/123',
        metadata: {},
      };

      expect(parser.hasTasks(issue)).toBe(false);
    });
  });
});
