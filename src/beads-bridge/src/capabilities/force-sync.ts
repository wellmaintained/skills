import type { CapabilityHandler } from './types.js';
import type { SkillContext, SkillResult } from '../types/skill.js';

export class ForceSyncHandler implements CapabilityHandler {
  constructor(
    private readonly progressSyncHandler: CapabilityHandler,
    private readonly diagramGeneratorHandler: CapabilityHandler
  ) {}

  async execute(context: SkillContext): Promise<SkillResult> {
    const {
      repository,
      issueNumber,
      operations = ['progress', 'diagram']
    } = context;

    if (!repository || !issueNumber) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'repository and issueNumber are required'
        }
      };
    }

    const startTime = Date.now();
    const results: Record<string, boolean> = {};

    // Execute requested operations
    for (const op of operations) {
      try {
        switch (op) {
          case 'progress': {
            const progressResult = await this.progressSyncHandler.execute({ repository, issueNumber });
            results.progress = progressResult.success;
            break;
          }

          case 'diagram': {
            const diagramResult = await this.diagramGeneratorHandler.execute({ repository, issueNumber });
            results.diagram = diagramResult.success;
            break;
          }
        }
      } catch (error) {
        results[op] = false;
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: Object.values(results).some(v => v),
      data: {
        operations: results,
        duration
      }
    };
  }
}
