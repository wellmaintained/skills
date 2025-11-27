import { execBdCommand } from '../utils/bd-cli.js';
import type { BeadsIssue } from '../types/beads.js';
import { Logger } from '../monitoring/logger.js';
import { parseExternalRef } from '../utils/external-ref-parser.js';
import type { ProjectManagementBackend } from '../types/index.js';
import { MissingExternalRefError } from '../types/errors.js';

export interface SyncReport {
  total: number;
  synced: number;
  skipped: number;
  errors: number;
  details: Array<{ id: string; status: 'synced' | 'skipped' | 'error'; message?: string }>;
}

export type BackendResolver = (type: string) => Promise<ProjectManagementBackend>;

const MERMAID_INIT_DIRECTIVE = `%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#d4edda',
    'primaryTextColor': '#155724',
    'primaryBorderColor': '#c3e6cb',
    'secondaryColor': '#cce5ff',
    'secondaryTextColor': '#004085',
    'secondaryBorderColor': '#b8daff',
    'tertiaryColor': '#f8d7da',
    'tertiaryTextColor': '#721c24',
    'tertiaryBorderColor': '#f5c6cb'
  }
}}%%`;

// Markers for diagram section in issue description
const DIAGRAM_MARKERS = {
  START: '<!-- beads-diagram-start -->',
  END: '<!-- beads-diagram-end -->',
  SECTION_HEADER: '## Dependency Diagram',
  LAST_UPDATED_PREFIX: '*Last updated:'
};

export class SyncService {
  private logger: Logger;

  constructor(
    private backendResolver?: BackendResolver,
    logger?: Logger
  ) {
    this.logger = logger || new Logger({ level: 'INFO' });
  }

  async getBead(beadId: string): Promise<BeadsIssue | null> {
    try {
      const output = await execBdCommand(['show', beadId, '--json']);
      const result = JSON.parse(output);
      const bead = Array.isArray(result) ? result[0] : result;
      // Return bead regardless of external_ref presence
      return bead || null;
    } catch (error) {
      this.logger.error(`Failed to fetch bead ${beadId}`, error as Error);
      throw error;
    }
  }

  async sync(beadId: string, options: { dryRun?: boolean } = {}): Promise<SyncReport> {
    const report: SyncReport = {
      total: 1,
      synced: 0,
      skipped: 0,
      errors: 0,
      details: []
    };

    let bead: BeadsIssue | null = null;
    try {
      bead = await this.getBead(beadId);
    } catch (error) {
      this.logger.error(`Failed to get bead ${beadId}`, error as Error);
      report.errors++;
      report.details.push({ id: beadId, status: 'error', message: (error as Error).message });
      return report;
    }

    if (!bead) {
      report.errors++;
      report.details.push({ id: beadId, status: 'error', message: `Bead ${beadId} not found` });
      this.logger.error(`Bead ${beadId} not found`);
      return report;
    }

    if (!bead.external_ref) {
      throw new MissingExternalRefError(bead.id);
    }

    try {
      const ref = parseExternalRef(bead.external_ref!);

      if (options.dryRun) {
        this.logger.info(`[DRY RUN] Would sync ${bead.id} to ${ref.backend} (${bead.external_ref})`);
      } else {
        this.logger.info(`Syncing ${bead.id} to ${ref.backend}`);
        const mermaid = await this.generateDiagram(bead.id);

        if (this.backendResolver) {
          const backend = await this.backendResolver(ref.backend);
          let issueId = '';
          if (ref.backend === 'github' && ref.owner && ref.repo && ref.issueNumber) {
            issueId = `${ref.owner}/${ref.repo}#${ref.issueNumber}`;
          } else if (ref.backend === 'shortcut' && ref.storyId) {
            issueId = ref.storyId.toString();
          }

          if (issueId) {
            await this.postUpdate(backend, issueId, mermaid);
          } else {
            throw new Error(`Could not determine issue ID from ref: ${bead.external_ref}`);
          }
        } else {
          this.logger.warn('No backend resolver provided, skipping post');
        }
      }

      report.synced++;
      report.details.push({ id: bead.id, status: 'synced' });
    } catch (error) {
      report.errors++;
      report.details.push({ id: bead.id, status: 'error', message: (error as Error).message });
      this.logger.error(`Error syncing ${bead.id}`, error as Error);
    }

    return report;
  }

  private async generateDiagram(beadId: string): Promise<string> {
    const output = await execBdCommand(['dep', 'tree', beadId, '--format', 'mermaid', '--reverse']);
    const diagram = this.addStatusStyling(output.trim());
    const rendered = `${MERMAID_INIT_DIRECTIVE}\n${diagram}`;
    return `\`\`\`mermaid\n${rendered}\n\`\`\``;
  }

  private async postUpdate(backend: ProjectManagementBackend, issueId: string, mermaidMarkdown: string): Promise<void> {
      try {
          const issue = await backend.getIssue(issueId);
          const updatedBody = this.updateDiagramSection(issue.body || '', mermaidMarkdown);
          
          if (updatedBody !== issue.body) {
              await backend.updateIssue(issue.id, { body: updatedBody });
              this.logger.info(`Updated description for ${issueId}`);
          } else {
              this.logger.info(`Description up to date for ${issueId}`);
          }
      } catch (error) {
          this.logger.error(`Failed to post update to ${issueId}`, error as Error);
          throw error;
      }
  }

  private updateDiagramSection(currentBody: string, mermaidMarkdown: string): string {
    const timestamp = new Date().toISOString();
    
    const lines: string[] = [
      DIAGRAM_MARKERS.START,
      '',
      DIAGRAM_MARKERS.SECTION_HEADER,
      '',
      mermaidMarkdown,
      '',
      `${DIAGRAM_MARKERS.LAST_UPDATED_PREFIX} ${timestamp}`,
      '',
      DIAGRAM_MARKERS.END
    ];
    const section = lines.join('\n');

    const startMarker = DIAGRAM_MARKERS.START;
    const endMarker = DIAGRAM_MARKERS.END;

    if (currentBody.includes(startMarker) && currentBody.includes(endMarker)) {
      const before = currentBody.substring(0, currentBody.indexOf(startMarker));
      const after = currentBody.substring(currentBody.indexOf(endMarker) + endMarker.length);
      return before + section + after;
    } else {
      const separator = currentBody.trim() ? '\n\n' : '';
      return currentBody + separator + section;
    }
  }

  private addStatusStyling(diagram: string): string {
    const lines = diagram.split('\n');
    const nodeStyles: string[] = [];

    for (const line of lines) {
      const match = line.match(/^\s+([\w.-]+)\["([☑◧☐⊗])/);
      if (match) {
        const [, nodeId, statusSymbol] = match;
        const style = this.getStyleForStatus(statusSymbol);
        if (style) {
          nodeStyles.push(`  style ${nodeId} ${style}`);
        }
      }
    }

    if (nodeStyles.length > 0) {
      return diagram + '\n\n' + nodeStyles.join('\n');
    }

    return diagram;
  }

  private getStyleForStatus(statusSymbol: string): string | null {
    switch (statusSymbol) {
      case '☑': // closed/completed
        return 'fill:#d4edda,stroke:#c3e6cb,color:#155724';
      case '◧': // in_progress
        return 'fill:#cce5ff,stroke:#b8daff,color:#004085';
      case '☐': // open/pending
        return 'fill:#f8f9fa,stroke:#dee2e6,color:#495057';
      case '⊗': // blocked
        return 'fill:#f8d7da,stroke:#f5c6cb,color:#721c24';
      default:
        return null;
    }
  }
}
