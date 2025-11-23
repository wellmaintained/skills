import type { CapabilityHandler } from './types.js';
import type { SkillContext, SkillResult } from '../types/skill.js';
import type { ProgressSynthesizer } from '../synthesis/progress-synthesizer.js';
import type { ShortcutSyncOrchestrator } from '../orchestration/shortcut-sync-orchestrator.js';
import type { ProjectManagementBackend } from '../types/backend.js';

export class ProgressSyncHandler implements CapabilityHandler {
  constructor(
    private readonly backend: ProjectManagementBackend,
    private readonly progressSynthesizer: ProgressSynthesizer,
    private readonly shortcutSyncOrchestrator?: ShortcutSyncOrchestrator
  ) {}

  async execute(context: SkillContext): Promise<SkillResult> {
    const { repository, issueNumber, includeBlockers = true, userNarrative } = context;

    if (!repository || !issueNumber) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'repository and issueNumber are required'
        }
      };
    }

    // Route to ShortcutSyncOrchestrator for Shortcut backend
    if (this.backend.name === 'shortcut' && this.shortcutSyncOrchestrator) {
      const syncResult = await this.shortcutSyncOrchestrator.syncStory(
        issueNumber,
        { userNarrative }
      );

      return {
        success: syncResult.success,
        data: syncResult.success ? {
          storyUrl: syncResult.storyUrl,
          commentUrl: syncResult.commentUrl,
          syncedAt: syncResult.syncedAt
        } : undefined,
        error: syncResult.error ? {
          code: 'SYNC_ERROR',
          message: syncResult.error
        } : undefined
      };
    }

    // Fall back to ProgressSynthesizer for GitHub backend
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
