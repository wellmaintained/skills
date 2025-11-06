import { Command } from 'commander';
import { LiveWebBackend } from '../../backends/liveweb.js';
import { ExpressServer } from '../../server/express-server.js';
import { PollingService } from '../../server/polling-service.js';
import { BeadsClient } from '../../clients/beads-client.js';
import type { DependencyTreeNode, BeadsIssue, BeadsRepository } from '../../types/beads.js';
import { execBdCommand } from '../../utils/bd-cli.js';
import { ConfigManager } from '../../config/config-manager.js';
import { open } from '../../utils/open-browser.js';

// Helper: Find which repository contains an issue by checking the prefix
function findRepositoryForIssue(issueId: string, repositories: BeadsRepository[]): string | null {
  // Extract prefix from issue ID (e.g., "pensive-8e2d" -> "pensive")
  const prefix = issueId.split('-')[0];

  for (const repo of repositories) {
    // Match by repository prefix field, or fall back to name
    if (repo.prefix === prefix || repo.name === prefix) {
      return repo.name;
    }
  }

  return null;
}

export function createServeCommand(): Command {
  return new Command('serve')
    .description('Start live web dashboard for a beads issue')
    .argument('<issue-id>', 'Beads issue ID to visualize')
    .option('-p, --port <number>', 'Server port', '3000')
    .option('--poll-interval <seconds>', 'Polling interval in seconds', '5')
    .option('--no-open', 'Do not auto-open browser')
    .action(async (issueId: string, options) => {
      try {
        const port = parseInt(options.port, 10);
        const pollInterval = parseInt(options.pollInterval, 10);

        // Validate issue exists
        console.log(`Validating issue ${issueId}...`);
        try {
          await execBdCommand(['show', issueId]);
        } catch (error) {
          console.error(`Error: Issue ${issueId} not found`);
          process.exit(1);
        }

        // Load config to find repository paths
        const configManager = await ConfigManager.load(process.env.BEADS_GITHUB_CONFIG || '.beads-bridge/config.json');
        const repositories = configManager.getRepositories();

        const beadsClient = new BeadsClient({ repositories: repositories as BeadsRepository[] });

        // Initialize backend and server
        const backend = new LiveWebBackend();
        const server = new ExpressServer(backend, port);

        // Create polling service
        const fetchDiagram = async () => {
          const result = await execBdCommand(['dep', 'tree', issueId, '--reverse', '--format', 'mermaid']);
          return result.trim();
        };

        const updateState = async () => {
          console.log(`Updating state for ${issueId}...`);

          // Get dependency tree
          const diagram = await fetchDiagram();

          // Find which repository contains this issue
          const repoName = findRepositoryForIssue(issueId, repositories as BeadsRepository[]);
          if (!repoName) {
            throw new Error(`Cannot find repository for issue ${issueId}`);
          }

          // Get all issues in tree using bd dep tree
          const tree = await beadsClient.getEpicChildrenTree(repoName, issueId);

          // Flatten tree to get all issues
          const flattenTree = (node: DependencyTreeNode): BeadsIssue[] => {
            const result = [node.issue];
            for (const child of node.dependencies) {
              result.push(...flattenTree(child));
            }
            return result;
          };

          const allIssues = flattenTree(tree);

          const issues = allIssues.map((issue, idx) => ({
            id: issue.id,
            number: idx + 1,
            title: issue.title,
            body: issue.description || '',
            state: issue.status === 'closed' ? 'closed' as const : 'open' as const,
            url: `http://localhost:${port}/issue/${issue.id}`,
            labels: (issue.labels || []).map(label => ({ id: label, name: label })),
            assignees: issue.assignee ? [{ id: issue.assignee, login: issue.assignee }] : [],
            createdAt: new Date(issue.created_at),
            updatedAt: new Date(issue.updated_at),
            metadata: {
              beadsStatus: issue.status,
              beadsPriority: issue.priority,
              beadsType: issue.issue_type,
            },
          }));

          // Calculate metrics
          const metrics = {
            total: issues.length,
            completed: issues.filter((i) => i.metadata.beadsStatus === 'closed').length,
            inProgress: issues.filter((i) => i.metadata.beadsStatus === 'in_progress').length,
            blocked: issues.filter((i) => i.metadata.beadsStatus === 'blocked').length,
            open: issues.filter((i) => i.metadata.beadsStatus === 'open').length,
          };

          backend.updateState(issueId, {
            diagram,
            metrics,
            issues,
            lastUpdate: new Date(),
          });
        };

        const onError = (error: Error) => {
          console.error('Polling error:', error.message);
          server.getBroadcaster().broadcast({
            type: 'error',
            message: error.message,
          });
        };

        const polling = new PollingService(
          fetchDiagram,
          updateState,
          pollInterval,
          onError
        );

        // Initialize state before starting server so dashboard can load immediately
        console.log('Initializing state...');
        try {
          await updateState();
        } catch (error) {
          console.error('Failed to initialize state:', error);
          process.exit(1);
        }

        // Start server
        await server.start();

        // Start polling
        polling.start();

        // Open browser
        if (options.open) {
          const url = `http://localhost:${port}/issue/${issueId}`;
          await open(url);
        }

        console.log(`\nDashboard running at http://localhost:${port}/issue/${issueId}`);
        console.log('Press Ctrl+C to stop\n');

        // Graceful shutdown
        process.on('SIGINT', () => {
          console.log('\nShutting down dashboard...');
          polling.stop();
          server.stop().then(() => {
            process.exit(0);
          });
        });
      } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
      }
    });
}
