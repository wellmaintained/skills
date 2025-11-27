/**
 * Simplified Sync Command (POC B)
 *
 * Read-only, one-way push of beads state to external systems.
 * No git diffing, no change detection - just read beads and post diagrams.
 */

import { Command } from 'commander';
import { execBdCommand } from '../../utils/bd-cli.js';
import { parseExternalRef, type ParsedExternalRef } from '../../utils/external-ref-parser.js';
import { GitHubBackend } from '../../backends/github.js';
import { CredentialStore } from '../../auth/credential-store.js';

/**
 * Bead structure from bd list/show --json
 */
interface BeadJson {
  id: string;
  title: string;
  status: string;
  issue_type: string;
  external_ref?: string;
  dependencies?: Array<{
    target_id: string;
    dependency_type: string;
  }>;
}

/**
 * Result of sync operation
 */
interface SyncResult {
  beadId: string;
  title: string;
  externalRef: string;
  parsed: ParsedExternalRef;
  diagram?: string;
  posted: boolean;
  error?: string;
}

/**
 * Generate Mermaid diagram for a bead using bd CLI
 */
async function generateDiagram(beadId: string): Promise<string> {
  const output = await execBdCommand([
    'dep', 'tree', beadId, '--format', 'mermaid', '--reverse'
  ]);
  return output.trim();
}

/**
 * Format the diagram comment for posting
 */
function formatDiagramComment(diagram: string, beadId: string): string {
  const timestamp = new Date().toISOString();
  return `## Dependency Diagram

\`\`\`mermaid
${diagram}
\`\`\`

*Auto-synced from bead \`${beadId}\` at ${timestamp}*

---
*Posted by beads-bridge sync*`;
}

/**
 * Sync a single bead to its external reference
 */
async function syncBead(
  bead: BeadJson,
  dryRun: boolean
): Promise<SyncResult> {
  const result: SyncResult = {
    beadId: bead.id,
    title: bead.title,
    externalRef: bead.external_ref!,
    parsed: parseExternalRef(bead.external_ref!),
    posted: false
  };

  try {
    // Generate diagram
    result.diagram = await generateDiagram(bead.id);

    if (dryRun) {
      console.log(`\n[DRY RUN] Would sync ${bead.id} to ${bead.external_ref}`);
      console.log(`Diagram preview:\n${result.diagram}`);
      return result;
    }

    // Post to external system based on backend
    if (result.parsed.backend === 'github') {
      const credentials = await CredentialStore.load();
      const backend = new GitHubBackend({ credentials });
      await backend.authenticate();

      const issueId = `${result.parsed.owner}/${result.parsed.repo}#${result.parsed.issueNumber}`;
      const comment = formatDiagramComment(result.diagram, bead.id);

      await backend.addComment(issueId, comment);
      result.posted = true;
      console.log(`Synced ${bead.id} to GitHub ${issueId}`);
    } else if (result.parsed.backend === 'shortcut') {
      // Shortcut support is a future enhancement
      result.error = 'Shortcut backend not yet implemented';
      console.log(`Skipping ${bead.id}: Shortcut backend not yet implemented`);
    }
  } catch (error: any) {
    result.error = error.message;
    console.error(`Failed to sync ${bead.id}: ${error.message}`);
  }

  return result;
}

/**
 * Get beads to sync - either specific bead or all with external_ref
 */
async function getBeadsToSync(beadId?: string): Promise<BeadJson[]> {
  if (beadId) {
    // Get specific bead
    const output = await execBdCommand(['list', '--id', beadId, '--json']);
    const beads = JSON.parse(output) as BeadJson[];
    if (beads.length === 0) {
      throw new Error(`Bead ${beadId} not found`);
    }
    if (!beads[0].external_ref) {
      throw new Error(`Bead ${beadId} has no external_ref`);
    }
    return beads;
  }

  // Get all beads with external_ref
  const output = await execBdCommand(['list', '--json']);
  const allBeads = JSON.parse(output) as BeadJson[];
  return allBeads.filter(b => b.external_ref);
}

/**
 * Create the sync command
 */
export function createSyncCommand(): Command {
  const cmd = new Command('sync')
    .description('Sync bead diagrams to external issue trackers (GitHub, Shortcut)')
    .argument('[bead-id]', 'Specific bead ID to sync (syncs all with external_ref if omitted)')
    .option('--dry-run', 'Show what would be synced without posting', false)
    .action(async (beadId: string | undefined, options: { dryRun: boolean }) => {
      try {
        const beads = await getBeadsToSync(beadId);

        if (beads.length === 0) {
          console.log('No beads with external_ref found');
          process.exit(0);
        }

        console.log(`Found ${beads.length} bead(s) to sync${options.dryRun ? ' (dry run)' : ''}`);

        const results: SyncResult[] = [];

        for (const bead of beads) {
          const result = await syncBead(bead, options.dryRun);
          results.push(result);
        }

        // Summary
        const synced = results.filter(r => r.posted).length;
        const failed = results.filter(r => r.error && !options.dryRun).length;
        const skipped = results.filter(r => !r.posted && !r.error).length;

        console.log('\n--- Summary ---');
        if (options.dryRun) {
          console.log(`Would sync: ${beads.length} bead(s)`);
        } else {
          console.log(`Synced: ${synced}, Failed: ${failed}, Skipped: ${skipped}`);
        }

        // Output JSON result
        console.log(JSON.stringify({ results }, null, 2));

        process.exit(failed > 0 ? 1 : 0);
      } catch (error: any) {
        console.error(JSON.stringify({
          success: false,
          error: {
            code: 'SYNC_ERROR',
            message: error.message
          }
        }, null, 2));
        process.exit(1);
      }
    });

  return cmd;
}
