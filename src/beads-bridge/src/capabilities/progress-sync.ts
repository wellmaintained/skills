import type { CapabilityHandler } from './types.js';
import type { SkillContext, SkillResult } from '../types/skill.js';
import type { ProgressSynthesizer } from '../synthesis/progress-synthesizer.js';

export class ProgressSyncHandler implements CapabilityHandler {
  constructor(
    private readonly progressSynthesizer: ProgressSynthesizer
  ) {}

  async execute(context: SkillContext): Promise<SkillResult> {
    const { repository, issueNumber, includeBlockers = true } = context;

    if (!repository || !issueNumber) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'repository and issueNumber are required'
        }
      };
    }

    // Run progress synthesizer for both GitHub and Shortcut backends
    const result = await this.progressSynthesizer.updateIssueProgress(
      repository,
      issueNumber,
      {
        includeBlockers,
        includeDiagram: true  // Enable diagram by default
      }
    );

    return {
      success: result.success,
      data: result.success ? {
        commentUrl: result.commentUrl,
        fieldsUpdated: result.fieldsUpdated
      } : undefined,
      error: result.error ? {
        code: 'SYNC_ERROR',
        message: result.error
      } : undefined
    };
  }
}
