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
import { ProgressSynthesizer } from './synthesis/progress-synthesizer.js';
import { MermaidGenerator } from './diagrams/mermaid-generator.js';
import { DiagramPlacer } from './diagrams/diagram-placer.js';
import { EpicDecomposer } from './decomposition/epic-decomposer.js';
import { ExternalRefResolver } from './utils/external-ref-resolver.js';
import { LegacyMappingWarning } from './utils/legacy-mapping-warning.js';
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
import { DecomposerHandler } from './capabilities/decomposer.js';


/**
 * Claude Skill for Beads Integration (supports GitHub and Shortcut backends)
 */
export class BeadsSkill {
  private config: ConfigManager;
  private beads: BeadsClient;
  private backend: ProjectManagementBackend;
  private resolver: ExternalRefResolver;
  private progressSynthesizer: ProgressSynthesizer;
  private mermaidGenerator: MermaidGenerator;
  private diagramPlacer: DiagramPlacer;
  private epicDecomposer?: EpicDecomposer;
  private logger: Logger;
  private legacyWarning: LegacyMappingWarning;
  private warnableCapabilities: Set<SkillCapability>;

  // Handlers
  private statusQueryHandler: StatusQueryHandler;
  private progressSyncHandler: ProgressSyncHandler;
  private diagramGeneratorHandler: DiagramGeneratorHandler;
  private decomposerHandler: DecomposerHandler;

  constructor(configManager: ConfigManager, credentials?: Credentials) {
    this.config = configManager;
    const config = configManager.getConfig();

    // Simple logger configuration
    const loggerConfig = {
      level: config.logging.level.toUpperCase() as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
    };

    this.logger = new Logger(loggerConfig);

    // Initialize BeadsClient (bd auto-detects .beads/ directory)
    this.beads = new BeadsClient({});

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

    this.legacyWarning = new LegacyMappingWarning(config.mappingStoragePath);
    this.warnableCapabilities = new Set(['query_status', 'sync_progress', 'generate_diagrams', 'decompose']);

    this.resolver = new ExternalRefResolver(this.beads);

    this.mermaidGenerator = new MermaidGenerator(this.beads);

    this.progressSynthesizer = new ProgressSynthesizer(
      this.beads,
      this.backend,
      this.resolver,
      this.mermaidGenerator
    );

    // DiagramPlacer takes 3 arguments: backend, generator, resolver
    this.diagramPlacer = new DiagramPlacer(
      this.backend,
      this.mermaidGenerator,
      this.resolver
    );

    // EpicDecomposer is only available for GitHub backend
    if (config.backend === 'github') {
      this.epicDecomposer = new EpicDecomposer(
        this.config,
        this.backend as GitHubBackend,
        this.beads
      );
    }

    // Initialize Handlers
    this.statusQueryHandler = new StatusQueryHandler(this.progressSynthesizer);
    this.progressSyncHandler = new ProgressSyncHandler(
      this.progressSynthesizer
    );
    this.diagramGeneratorHandler = new DiagramGeneratorHandler(
      this.resolver,
      this.beads,
      this.diagramPlacer
    );
    this.decomposerHandler = new DecomposerHandler(this.epicDecomposer);
  }

  /**
   * Execute a skill capability
   */
  async execute(capability: SkillCapability, context: SkillContext): Promise<SkillResult> {
    this.logger.info(`Executing ${capability}`, context);

    try {
      await this.warnLegacyMappingsIfNeeded(capability);
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

        case 'decompose':
          result = await this.decomposerHandler.execute(context);
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
        'decompose'
      ]
    };
  }

  private async warnLegacyMappingsIfNeeded(capability: SkillCapability): Promise<void> {
    if (this.warnableCapabilities.has(capability)) {
      await this.legacyWarning.maybeWarn();
    }
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
