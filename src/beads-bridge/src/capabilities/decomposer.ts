import type { CapabilityHandler } from './types.js';
import type { SkillContext, SkillResult } from '../types/skill.js';
import type { EpicDecomposer } from '../decomposition/epic-decomposer.js';
import { parseExternalRef } from '../utils/external-ref-parser.js';

export class DecomposerHandler implements CapabilityHandler {
  constructor(private readonly epicDecomposer?: EpicDecomposer) {}

  async execute(context: SkillContext): Promise<SkillResult> {
    const { postComment = true, defaultPriority = 2, externalRef } = context;
    let repository: string | undefined;
    let issueNumber: number | undefined;

    if (!externalRef) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'externalRef is required'
        }
      };
    }

    // Try to parse externalRef
    try {
      const parsed = parseExternalRef(externalRef);

      if (parsed.backend === 'github') {
        repository = parsed.repository;
        issueNumber = parsed.issueNumber;
      } else if (parsed.backend === 'shortcut') {
        // Shortcut decompose not yet supported through new endpoint
        return {
          success: false,
          error: {
            code: 'NOT_SUPPORTED',
            message: 'Shortcut decompose is not yet supported'
          }
        };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid external reference: ${(error as Error).message}`
        }
      };
    }

    // Validate we have required parameters
    if (!repository || !issueNumber) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Either externalRef or (repository and issueNumber) are required'
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

    const result = await this.epicDecomposer.decompose(repository, issueNumber, {
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
