import type { CapabilityHandler } from './types.js';
import type { SkillContext, SkillResult } from '../types/skill.js';
import type { EpicDecomposer } from '../decomposition/epic-decomposer.js';

export class DecomposerHandler implements CapabilityHandler {
  constructor(private readonly epicDecomposer?: EpicDecomposer) {}

  async execute(context: SkillContext): Promise<SkillResult> {
    const { repository, issueNumber, postComment = true, defaultPriority = 2 } = context;

    if (!repository || !issueNumber) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'repository and issueNumber are required'
        }
      };
    }

    if (!this.epicDecomposer) {
      return {
        success: false,
        error: {
          code: 'NOT_SUPPORTED',
          message: 'Decompose is only supported for GitHub backend'
        }
      };
    }

    const result = await this.epicDecomposer.decompose(issueNumber, {
      postComment,
      defaultPriority
    });

    return {
      success: result.success,
      data: result.success ? {
        githubIssue: result.githubIssue,
        epics: result.epics.map(e => ({
          repository: e.repository,
          epicId: e.epicId,
          tasksCreated: e.childIssueIds.length
        })),
        totalTasks: result.totalTasks
      } : undefined,
      error: result.error ? {
        code: 'DECOMPOSE_ERROR',
        message: result.error
      } : undefined
    };
  }
}
