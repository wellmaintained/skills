import type { BeadsClient } from '../clients/beads-client.js';
import type { EpicStatus } from '../types/beads.js';

export interface ResolveParams {
  repository?: string;
  issueNumber?: number;
  externalRef?: string;
}

export interface EpicLink {
  repository: string;
  epicId: string;
}

export interface ResolutionResult {
  externalRef: string;
  epics: EpicLink[];
  metrics: EpicStatus;
}

/**
 * Resolve external references (github:owner/repo#123, shortcut:123) to the
 * underlying Beads epics across all configured repositories.
 */
export class ExternalRefResolver {
  constructor(private readonly beads: BeadsClient) {}

  async resolve(params: ResolveParams): Promise<ResolutionResult> {
    const targetRef = this.buildExternalRef(params);
    const epics = await this.findEpics(targetRef);

    if (epics.length === 0) {
      return {
        externalRef: targetRef,
        epics,
        metrics: this.emptyMetrics()
      };
    }

    const metrics = await this.aggregateEpicStatus(epics);

    return {
      externalRef: targetRef,
      epics,
      metrics
    };
  }

  private buildExternalRef(params: ResolveParams): string {
    if (params.externalRef) {
      return params.externalRef;
    }

    if (!params.repository || typeof params.issueNumber !== 'number') {
      throw new Error('repository and issueNumber are required to resolve external references');
    }

    if (params.repository.toLowerCase() === 'shortcut' || params.repository.startsWith('shortcut:')) {
      return `shortcut:${params.issueNumber}`;
    }

    return `github:${params.repository}#${params.issueNumber}`;
  }

  private async findEpics(externalRef: string): Promise<EpicLink[]> {
    const repositories = await this.beads.getAllIssues();
    const matches: EpicLink[] = [];

    for (const [repositoryName, issues] of repositories.entries()) {
      const epic = issues.find(
        issue => issue.issue_type === 'epic' && issue.external_ref === externalRef
      );

      if (epic) {
        matches.push({ repository: repositoryName, epicId: epic.id });
      }
    }

    return matches;
  }

  private async aggregateEpicStatus(epics: EpicLink[]): Promise<EpicStatus> {
    const aggregate = this.emptyMetrics();

    for (const epic of epics) {
      const status = await this.beads.getEpicStatus(epic.repository, epic.epicId);
      aggregate.total += status.total;
      aggregate.completed += status.completed;
      aggregate.inProgress += status.inProgress;
      aggregate.blocked += status.blocked;
      aggregate.notStarted += status.notStarted;
      aggregate.blockers.push(...status.blockers);
      aggregate.discovered.push(...status.discovered);
    }

    aggregate.percentComplete = aggregate.total > 0
      ? Math.round((aggregate.completed / aggregate.total) * 100)
      : 0;

    return aggregate;
  }

  private emptyMetrics(): EpicStatus {
    return {
      total: 0,
      completed: 0,
      inProgress: 0,
      blocked: 0,
      notStarted: 0,
      percentComplete: 0,
      blockers: [],
      discovered: []
    };
  }
}
