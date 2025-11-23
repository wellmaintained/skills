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
import { ShortcutSyncOrchestrator } from './orchestration/shortcut-sync-orchestrator.js';
import { ConfigManager } from './config/config-manager.js';
import { Logger } from './monitoring/logger.js';
import { CredentialStore, type Credentials } from './auth/credential-store.js';
import type {
  SkillCapability,
  SkillContext,
  SkillResult
} from './types/skill.js';

// Capability Handlers
import { StatusQueryHandler } from './capabilities/status-query.js';
import { ProgressSyncHandler } from './capabilities/progress-sync.js';
import { DiagramGeneratorHandler } from './capabilities/diagram-generator.js';
import { MappingManagerHandler } from './capabilities/mapping-manager.js';
import { DecomposerHandler } from './capabilities/decomposer.js';
import { ForceSyncHandler } from './capabilities/force-sync.js';

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
  private shortcutSyncOrchestrator?: ShortcutSyncOrchestrator;
  private logger: Logger;

  // Handlers
  private statusQueryHandler: StatusQueryHandler;
  private progressSyncHandler: ProgressSyncHandler;
  private diagramGeneratorHandler: DiagramGeneratorHandler;
  private mappingManagerHandler: MappingManagerHandler;
  private decomposerHandler: DecomposerHandler;
  private forceSyncHandler: ForceSyncHandler;

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

    // ShortcutSyncOrchestrator is only available for Shortcut backend
    if (config.backend === 'shortcut') {
      this.shortcutSyncOrchestrator = new ShortcutSyncOrchestrator(
        this.beads,
        this.backend as ShortcutBackend,
        this.mermaidGenerator,
        this.mappings
      );
    }

    // Initialize Handlers
    this.statusQueryHandler = new StatusQueryHandler(this.progressSynthesizer);
    this.progressSyncHandler = new ProgressSyncHandler(
      this.backend,
      this.progressSynthesizer,
      this.shortcutSyncOrchestrator
    );
    this.diagramGeneratorHandler = new DiagramGeneratorHandler(
      this.mappings,
      this.beads,
      this.diagramPlacer
    );
    this.mappingManagerHandler = new MappingManagerHandler(this.mappings);
    this.decomposerHandler = new DecomposerHandler(this.epicDecomposer);
    this.forceSyncHandler = new ForceSyncHandler(
      this.progressSyncHandler,
      this.diagramGeneratorHandler
    );
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
          result = await this.statusQueryHandler.execute(context);
          break;

        case 'sync_progress':
          result = await this.progressSyncHandler.execute(context);
          break;

        case 'generate_diagrams':
          result = await this.diagramGeneratorHandler.execute(context);
          break;

        case 'manage_mappings':
          result = await this.mappingManagerHandler.execute(context);
          break;

        case 'decompose':
          result = await this.decomposerHandler.execute(context);
          break;

        case 'force_sync':
          result = await this.forceSyncHandler.execute(context);
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
