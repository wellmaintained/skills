import type { CapabilityHandler } from './types.js';
import type { SkillContext, SkillResult } from '../types/skill.js';
import type { MappingStore } from '../store/mapping-store.js';

export class MappingManagerHandler implements CapabilityHandler {
  constructor(private readonly mappings: MappingStore) {}

  async execute(context: SkillContext): Promise<SkillResult> {
    const { repository, issueNumber, action = 'get', epicIds } = context;

    if (!repository || !issueNumber) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'repository and issueNumber are required'
        }
      };
    }

    if (action === 'create') {
      if (!epicIds || !Array.isArray(epicIds)) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'epicIds array is required for create action'
          }
        };
      }

      // Validate epic IDs have required fields
      const invalidEpic = epicIds.find(e => !e.repository || !e.epicId || !e.repositoryPath);
      if (invalidEpic) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Each epic must have repository, epicId, and repositoryPath'
          }
        };
      }

      const mapping = await this.mappings.create({
        githubIssue: `${repository}#${issueNumber}`,
        githubRepository: repository,
        githubIssueNumber: issueNumber,
        beadsEpics: epicIds
      });

      return {
        success: true,
        data: {
          mappingId: mapping.id,
          epicsLinked: epicIds.length
        }
      };
    } else {
      const mapping = await this.mappings.findByGitHubIssue(repository, issueNumber);

      if (!mapping) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `No mapping found for ${repository}#${issueNumber}`
          }
        };
      }

      return {
        success: true,
        data: {
          mappingId: mapping.id,
          beadsEpics: mapping.beadsEpics,
          createdAt: mapping.createdAt,
          updatedAt: mapping.updatedAt
        }
      };
    }
  }
}
