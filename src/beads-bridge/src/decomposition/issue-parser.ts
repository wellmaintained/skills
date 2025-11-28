/**
 * GitHub issue parser for extracting tasks and repository references
 */

import { Issue } from '../types/core.js';
import { RepositoryConfig } from '../types/config.js';
import {
  ParsedIssue,
  ParsedTask,
  RepositoryReference,
} from '../types/decomposition.js';

/**
 * Parse GitHub issue into structured format for decomposition
 */
export class IssueParser {
  private repositories: Map<string, RepositoryConfig>;

  constructor(repositories: RepositoryConfig[]) {
    this.repositories = new Map(repositories.map(r => [r.name, r]));
  }

  /**
   * Parse a GitHub issue
   */
  parse(issue: Issue, githubRepository: string, projectId?: string): ParsedIssue {
    const tasks = this.parseTasks(issue.body);
    const repositories = this.parseRepositories(issue.body, tasks);

    return {
      number: issue.number,
      title: issue.title,
      body: issue.body,
      tasks,
      repositories,
      url: issue.url,
      githubRepository,
      projectId,
    };
  }

  /**
   * Parse task list from issue body
   *
   * Supports:
   * - [ ] Uncompleted task
   * - [x] Completed task
   * - [X] Completed task (uppercase)
   * - Repository prefix: [repo-name] Task description
   */
  private parseTasks(body: string): ParsedTask[] {
    const tasks: ParsedTask[] = [];
    const lines = body.split('\n');

    // Match checkbox markdown: - [ ] or - [x] or - [X]
    const taskRegex = /^[\s-]*\[([xX\s])\]\s+(.+)$/;

     // Match repository prefix: [repo-name] or (repo-name)
     const repoRegex = /^[[(]([a-zA-Z0-9_-]+)[)\]]\s+(.+)$/;

    for (const line of lines) {
      const trimmedLine = line.trim();
      const taskMatch = trimmedLine.match(taskRegex);

      if (taskMatch) {
        const [, checkbox, description] = taskMatch;
        const completed = checkbox.toLowerCase() === 'x';

        // Check for repository prefix
        const repoMatch = description.match(repoRegex);
        let repository: string | undefined;
        let taskDescription = description;

        if (repoMatch) {
          const [, repoName, desc] = repoMatch;
          if (this.repositories.has(repoName)) {
            repository = repoName;
            taskDescription = desc;
          }
        }

        tasks.push({
          description: taskDescription,
          completed,
          repository,
          originalLine: trimmedLine,
        });
      }
    }

    return tasks;
  }

  /**
   * Parse repository references from issue body
   *
   * Looks for:
   * 1. Explicit section: ## Repositories or ### Affected Repositories
   * 2. Task prefixes: [repo-name] Task
   * 3. Mentions in body: @repo-name or `repo-name`
   */
  private parseRepositories(body: string, tasks: ParsedTask[]): RepositoryReference[] {
    const repoMap = new Map<string, RepositoryReference>();

    // 1. Parse explicit repository section
    const repoSectionRegex = /##\s*(Repositories|Affected\s+Repositories)[:\s]*\n((?:[-*]\s+.+\n?)+)/i;
    const repoSectionMatch = body.match(repoSectionRegex);

    if (repoSectionMatch) {
      const [, , repoList] = repoSectionMatch;
      const repoLines = repoList.split('\n');

      for (const line of repoLines) {
        const repoMatch = line.match(/[-*]\s+([a-zA-Z0-9_-]+)/);
        if (repoMatch) {
          const repoName = repoMatch[1];
          if (this.repositories.has(repoName)) {
            repoMap.set(repoName, {
              name: repoName,
              tasks: [],
              explicit: true,
            });
          }
        }
      }
    }

    // 2. Parse repository prefixes from tasks
    for (const task of tasks) {
      if (task.repository) {
        if (!repoMap.has(task.repository)) {
          repoMap.set(task.repository, {
            name: task.repository,
            tasks: [],
            explicit: false,
          });
        }
        repoMap.get(task.repository)!.tasks.push(task.description);
      }
    }

    // 3. If no explicit repositories found, try to infer from mentions
    if (repoMap.size === 0) {
      const mentionRegex = /[@`]([a-zA-Z0-9_-]+)[`]?/g;
      let match;

      while ((match = mentionRegex.exec(body)) !== null) {
        const repoName = match[1];
        if (this.repositories.has(repoName) && !repoMap.has(repoName)) {
          repoMap.set(repoName, {
            name: repoName,
            tasks: [],
            explicit: false,
          });
        }
      }
    }

    // 4. If still no repositories, use all configured repositories
    if (repoMap.size === 0) {
      for (const [name] of this.repositories) {
        repoMap.set(name, {
          name,
          tasks: [],
          explicit: false,
        });
      }
    }

    // Assign unassigned tasks to repositories
    const unassignedTasks = tasks.filter(t => !t.repository && !t.completed);
    if (unassignedTasks.length > 0 && repoMap.size > 0) {
      // If only one repository, assign all tasks to it
      if (repoMap.size === 1) {
        const [repo] = repoMap.values();
        repo.tasks.push(...unassignedTasks.map(t => t.description));
      }
      // Otherwise, tasks need manual assignment or stay at epic level
    }

    return Array.from(repoMap.values());
  }

  /**
   * Extract repository-specific tasks
   */
  getRepositoryTasks(parsed: ParsedIssue, repositoryName: string): string[] {
    const repo = parsed.repositories.find(r => r.name === repositoryName);
    if (repo && repo.tasks.length > 0) {
      return repo.tasks;
    }

    // Fallback: all uncompleted tasks if this is the only repository
    if (parsed.repositories.length === 1) {
      return parsed.tasks
        .filter(t => !t.completed)
        .map(t => t.description);
    }

    // Fallback: empty task list (epic only)
    return [];
  }

  /**
   * Check if issue has task list
   */
  hasTasks(issue: Issue): boolean {
    return /[\s-]*\[[xX\s]\]/.test(issue.body);
  }

  /**
   * Check if issue mentions multiple repositories
   */
  isMultiRepository(parsed: ParsedIssue): boolean {
    return parsed.repositories.length > 1;
  }

  /**
   * Get repository configuration
   */
  getRepository(name: string): RepositoryConfig | undefined {
    return this.repositories.get(name);
  }
}
