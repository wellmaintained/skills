import type { CapabilityHandler } from './types.js';
import type { SkillContext, SkillResult } from '../types/skill.js';
import type { ProgressSynthesizer } from '../synthesis/progress-synthesizer.js';

export class StatusQueryHandler implements CapabilityHandler {
  constructor(private readonly progressSynthesizer: ProgressSynthesizer) {}

  async execute(context: SkillContext): Promise<SkillResult> {
    const { repository, issueNumber } = context;

    if (!repository || !issueNumber) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'repository and issueNumber are required'
        }
      };
    }

    const progress = await this.progressSynthesizer.getAggregatedProgress(
      repository,
      issueNumber
    );

    return {
      success: true,
      data: {
        totalTasks: progress.totalMetrics.total,
        completed: progress.totalMetrics.completed,
        inProgress: progress.totalMetrics.inProgress,
        blocked: progress.totalMetrics.blocked,
        open: progress.totalMetrics.open,
        percentComplete: progress.totalMetrics.percentComplete,
        repositories: progress.epics.map(epic => ({
          name: epic.repository,
          completed: epic.metrics.completed,
          total: epic.metrics.total,
          percentComplete: epic.metrics.percentComplete
        })),
        blockers: progress.allBlockers.map(blocker => ({
          id: blocker.id,
          title: blocker.title,
          repository: progress.epics.find(e =>
            e.subtasks.some(t => t.id === blocker.id)
          )?.repository
        }))
      }
    };
  }
}
