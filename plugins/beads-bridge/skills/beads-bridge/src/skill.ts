/**
 * Claude Skill Entrypoint
 *
 * Exposes Beads integration functionality as a Claude Skill
 * with natural language interface. Supports GitHub and Shortcut backends.
 */

import { BeadsClient } from './clients/beads-client.js';
import { GitHubBackend } from './backends/github.js';
import { ShortcutBackend } from './backends/shortcut.js';
import type { ProjectManagementBackend } from './types/backend.js';
import { MappingStore } from './store/mapping-store.js';
import { ProgressSynthesizer } from './synthesis/progress-synthesizer.js';
import { MermaidGenerator } from './diagrams/mermaid-generator.js';
import { DiagramPlacer } from './diagrams/diagram-placer.js';
import { EpicDecomposer } from './decomposition/epic-decomposer.js';
import { ConfigManager } from './config/config-manager.js';
import { Logger } from './monitoring/logger.js';
import { CredentialStore, type Credentials } from './auth/credential-store.js';
import type {
  SkillCapability,
  SkillContext,
  SkillResult
} from './types/skill.js';

/**
 * Claude Skill for Beads Integration (supports GitHub and Shortcut backends)
 */
export class BeadsSkill {
  private config: ConfigManager;
  private beads: BeadsClient;
  private backend: ProjectManagementBackend;
  private mappings: MappingStore;
  private progressSynthesizer: ProgressSynthesizer;
  private mermaidGenerator: MermaidGenerator;
  private diagramPlacer: DiagramPlacer;
  private epicDecomposer?: EpicDecomposer;
  private logger: Logger;

  constructor(configManager: ConfigManager, credentials?: Credentials) {
    this.config = configManager;
    const config = configManager.getConfig();

    // Simple logger configuration
    const loggerConfig = {
      level: config.logging.level.toUpperCase() as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
    };

    this.logger = new Logger(loggerConfig);

    // Convert RepositoryConfig[] to BeadsRepository[] format
    const beadsRepos = config.repositories.map(repo => ({
      name: repo.name,
      path: repo.path,
      prefix: repo.prefix || repo.name
    }));

    this.beads = new BeadsClient({ repositories: beadsRepos });

    // Initialize backend based on config
    if (config.backend === 'shortcut') {
      this.backend = new ShortcutBackend({
        credentials: credentials
      });
    } else {
      // Default to GitHub
      const [owner] = config.github.repository.split('/');
      this.backend = new GitHubBackend({
        defaultOrg: owner,
        defaultRepo: config.github.repository,
        credentials: credentials
      });
    }

    this.mappings = new MappingStore({ storagePath: config.mappingStoragePath });

    this.mermaidGenerator = new MermaidGenerator(this.beads);

    this.progressSynthesizer = new ProgressSynthesizer(
      this.beads,
      this.backend,
      this.mappings,
      this.mermaidGenerator
    );

    // DiagramPlacer takes 3 arguments: backend, generator, mappings
    this.diagramPlacer = new DiagramPlacer(
      this.backend,
      this.mermaidGenerator,
      this.mappings
    );

    // EpicDecomposer is only available for GitHub backend
    if (config.backend === 'github') {
      this.epicDecomposer = new EpicDecomposer(
        this.config,
        this.backend as GitHubBackend,
        this.beads,
        this.mappings
      );
    }
  }

  /**
   * Execute a skill capability
   */
  async execute(capability: SkillCapability, context: SkillContext): Promise<SkillResult> {
    this.logger.info(`Executing ${capability}`, context);

    try {
      let result: SkillResult;

      switch (capability) {
        case 'query_status':
          result = await this.queryStatus(context);
          break;

        case 'sync_progress':
          result = await this.syncProgress(context);
          break;

        case 'generate_diagrams':
          result = await this.generateDiagrams(context);
          break;

        case 'manage_mappings':
          result = await this.manageMappings(context);
          break;

        case 'decompose':
          result = await this.decompose(context);
          break;

        case 'force_sync':
          result = await this.forceSync(context);
          break;

        default:
          throw new Error(`Unknown capability: ${capability}`);
      }

      this.logger.info(`Completed ${capability}`, { success: result.success });

      return result;
    } catch (error) {
      this.logger.error(`Failed ${capability}`, error as Error, context);

      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: (error as Error).message
        }
      };
    }
  }

  /**
   * Query status capability
   */
  private async queryStatus(context: SkillContext): Promise<SkillResult> {
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

  /**
   * Sync progress capability
   */
  private async syncProgress(context: SkillContext): Promise<SkillResult> {
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

  /**
   * Generate diagrams capability
   */
  private async generateDiagrams(context: SkillContext): Promise<SkillResult> {
    const { repository, issueNumber, placement = 'description' } = context;

    if (!repository || !issueNumber) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'repository and issueNumber are required'
        }
      };
    }

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

    // Get dependency tree
    const tree = await this.beads.getDependencyTree(
      mapping.beadsEpics[0].repository,
      mapping.beadsEpics[0].epicId
    );

    // Place diagram
    const result = await this.diagramPlacer.updateDiagram(
      repository,
      issueNumber,
      {
        updateDescription: placement !== 'comment',
        createSnapshot: placement === 'comment',
        trigger: 'manual'
      }
    );

    return {
      success: true,
      data: {
        diagramUrl: result.issueUrl,
        descriptionUpdated: result.descriptionUpdated,
        snapshotCreated: !!result.snapshot,
        complexity: this.calculateComplexity(tree)
      }
    };
  }

  /**
   * Manage mappings capability
   */
  private async manageMappings(context: SkillContext): Promise<SkillResult> {
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

  /**
   * Decompose capability
   */
  private async decompose(context: SkillContext): Promise<SkillResult> {
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
        mappingId: result.mappingId,
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

  /**
   * Force sync capability
   */
  private async forceSync(context: SkillContext): Promise<SkillResult> {
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
          case 'progress':
            const progressResult = await this.syncProgress({ repository, issueNumber });
            results.progress = progressResult.success;
            break;

          case 'diagram':
            const diagramResult = await this.generateDiagrams({ repository, issueNumber });
            results.diagram = diagramResult.success;
            break;
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

  /**
   * Calculate complexity rating based on dependency tree
   */
  private calculateComplexity(tree: any): 'low' | 'medium' | 'high' {
    // Count all nodes in the tree recursively
    const countNodes = (node: any): number => {
      if (!node) return 0;
      const childCount = (node.children || []).reduce((sum: number, child: any) =>
        sum + countNodes(child), 0);
      return 1 + childCount;
    };

    const nodeCount = countNodes(tree);

    if (nodeCount > 50) return 'high';
    if (nodeCount > 20) return 'medium';
    return 'low';
  }

  /**
   * Get skill metadata
   */
  getMetadata() {
    return {
      name: 'beads-bridge-integration',
      version: '1.0.0',
      capabilities: [
        'query_status',
        'sync_progress',
        'generate_diagrams',
        'manage_mappings',
        'decompose',
        'force_sync'
      ]
    };
  }
}

/**
 * Create and export skill instance
 */
export async function createSkill(
  configPath?: string,
  backendOverride?: 'github' | 'shortcut'
): Promise<BeadsSkill> {
  const manager = await ConfigManager.load(configPath);

  // Load credentials from credential store
  const credStore = new CredentialStore();
  const credentials = await credStore.load();

  // Override backend if specified
  if (backendOverride) {
    const config = manager.getConfig();
    // Create a new ConfigManager with overridden backend
    const overriddenConfig = { ...config, backend: backendOverride };
    const overriddenManager = new ConfigManager(overriddenConfig);
    const skill = new BeadsSkill(overriddenManager, credentials);
    await skill['backend'].authenticate();
    return skill;
  }

  const skill = new BeadsSkill(manager, credentials);

  // Authenticate with backend
  await skill['backend'].authenticate();

  return skill;
}

// Default export for skill loading
export default createSkill;
