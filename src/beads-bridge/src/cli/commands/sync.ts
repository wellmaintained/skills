import { Command } from 'commander';
import { SyncService } from '../../services/sync-service.js';
import { CredentialStore } from '../../auth/credential-store.js';
import { GitHubBackend } from '../../backends/github.js';
import { ShortcutBackend } from '../../backends/shortcut.js';
import type { ProjectManagementBackend } from '../../types/backend.js';

export function createSyncCommand(): Command {
  return new Command('sync')
    .description('Sync a bead to its external system (GitHub/Shortcut)')
    .argument('<bead-id>', 'Bead ID to sync')
    .option('--dry-run', 'Show what would be synced without posting')
    .action(async (beadId: string, options) => {
      const resolver = async (type: string): Promise<ProjectManagementBackend> => {
          const store = new CredentialStore();
          const creds = await store.load();
          
          if (type === 'github') {
              const backend = new GitHubBackend({ credentials: creds });
              await backend.authenticate();
              return backend;
          } else if (type === 'shortcut') {
              const backend = new ShortcutBackend({ credentials: creds });
              await backend.authenticate();
              return backend;
          }
          throw new Error(`Unsupported backend type: ${type}`);
      };

      const service = new SyncService(resolver);
      
      try {
          const report = await service.sync(beadId, options);
          console.log(`Sync complete: ${report.synced} synced, ${report.errors} errors, ${report.skipped} skipped.`);
          
          if (report.errors > 0) {
              console.error('Errors occurred during sync:');
              report.details.filter(d => d.status === 'error').forEach(d => {
                  console.error(`  ${d.id}: ${d.message}`);
              });
              process.exit(1);
          }
      } catch (error) {
          console.error('Sync failed:', error);
          process.exit(1);
      }
    });
}
