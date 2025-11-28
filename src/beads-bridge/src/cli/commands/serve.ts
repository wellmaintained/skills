import { Command } from 'commander';
import { createServer } from 'node:net';
import { LiveWebBackend } from '../../backends/liveweb.js';
import { ExpressServer } from '../../server/express-server.js';
import { PollingService } from '../../server/polling-service.js';
import { BeadsClient } from '../../clients/beads-client.js';
import type { DependencyTreeNode, BeadsIssue } from '../../types/beads.js';
import { execBdCommand } from '../../utils/bd-cli.js';
import { open } from '../../utils/open-browser.js';
import { Logger, type LogLevel } from '../../monitoring/logger.js';

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = createServer();
    tester.unref();

    tester.once('error', () => {
      resolve(false);
    });

    tester.once('listening', () => {
      tester.close(() => resolve(true));
    });

    tester.listen(port, '0.0.0.0');
  });
}

export async function findAvailablePortInRange(start: number, end: number): Promise<number> {
  for (let port = start; port < end; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`No available ports found between ${start} and ${end - 1}`);
}

function parseLogLevel(level: string): LogLevel {
  const upperLevel = level.toUpperCase() as LogLevel;
  if (['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(upperLevel)) {
    return upperLevel;
  }
  throw new Error(`Invalid log level: ${level}. Must be one of: DEBUG, INFO, WARN, ERROR`);
}

export function createServeCommand(): Command {
  return new Command('serve')
    .description('Start live web dashboard for a beads issue')
    .argument('<issue-id>', 'Beads issue ID to visualize')
    .option('-p, --port <number>', 'Server port')
    .option('--poll-interval <seconds>', 'Polling interval in seconds', '5')
    .option('--log-level <level>', 'Log level (DEBUG|INFO|WARN|ERROR)', 'INFO')
    .option('--no-open', 'Do not auto-open browser')
    .action(async (issueId: string, options) => {
      // Parse and validate log level early so we can use logger in error handler
      let logLevel: LogLevel;
      try {
        logLevel = parseLogLevel(options.logLevel);
      } catch (error) {
        console.error(`Invalid log level: ${options.logLevel}. Must be one of: DEBUG, INFO, WARN, ERROR`);
        process.exit(1);
      }
      const baseLogger = new Logger({ level: logLevel });
      const logger = baseLogger.withScope('ServeCommand');

      try {

        const requestedPort = options.port ? parseInt(options.port, 10) : undefined;
        const port =
          typeof requestedPort === 'number' && Number.isFinite(requestedPort)
            ? requestedPort
            : await findAvailablePortInRange(3000, 4000);

        if (!requestedPort && port !== 3000) {
          logger.info(`Port 3000 is busy, using ${port} instead.`);
        }

        const pollInterval = parseInt(options.pollInterval, 10);

        // Validate issue exists
        logger.info(`Validating issue ${issueId}...`);
        try {
          await execBdCommand(['show', issueId], logger);
        } catch (error) {
          logger.error(`Error: Issue ${issueId} not found`, error as Error);
          process.exit(1);
        }

        // Initialize BeadsClient (bd auto-detects .beads/ directory)
        const beadsClient = new BeadsClient({ logger: baseLogger });

        // Initialize backend and server (uses current directory)
        const backendLogger = baseLogger.withScope('LiveWebBackend');
        const backend = new LiveWebBackend(process.cwd(), undefined, backendLogger);
        const serverLogger = baseLogger.withScope('ExpressServer');
        const server = new ExpressServer(backend, port, undefined, serverLogger);



        const updateState = async () => {
          logger.info(`Updating state for ${issueId}...`);

          // Get all issues in tree using bd dep tree
          const tree = await beadsClient.getEpicChildrenTree(issueId);

          type FlattenedNode = { issue: BeadsIssue; parentId?: string; depth: number };
          const flattenTree = (node: DependencyTreeNode, parentId?: string, depth: number = 0): FlattenedNode[] => {
            const current: FlattenedNode = { issue: node.issue, parentId, depth };
            const children = node.dependencies.flatMap((child) =>
              flattenTree(child, node.issue.id, depth + 1)
            );
            return [current, ...children];
          };

          const flattened = flattenTree(tree);

          // Create parent-child edges
          const parentChildEdges = flattened
            .filter((entry) => entry.parentId)
            .map((entry) => ({
              id: `parent-${entry.parentId}-${entry.issue.id}`,
              source: entry.parentId as string,
              target: entry.issue.id,
              type: 'parent-child' as const,
            }));

          // Create blocking edges - for each issue, check if it has blocking dependencies
          const blockingEdges: Array<{ id: string; source: string; target: string; type: 'blocks' }> = [];
          for (const entry of flattened) {
            if (entry.issue.dependencies && Array.isArray(entry.issue.dependencies)) {
              for (const dep of entry.issue.dependencies) {
                if (dep.dependency_type === 'blocks') {
                  blockingEdges.push({
                    id: `blocks-${entry.issue.id}-${dep.id}`,
                    source: entry.issue.id,
                    target: dep.id,
                    type: 'blocks' as const,
                  });
                }
              }
            }
          }

          // Combine all edges
          const edges = [...parentChildEdges, ...blockingEdges];

          // Deduplicate issues by ID (with --show-all-paths, same issue may appear multiple times)
          const issueMap = new Map<string, typeof flattened[0]>();
          for (const entry of flattened) {
            if (!issueMap.has(entry.issue.id)) {
              issueMap.set(entry.issue.id, entry);
            }
          }
          const uniqueIssues = Array.from(issueMap.values());

          const issues = uniqueIssues.map((entry, idx) => ({
            id: entry.issue.id,
            number: idx + 1,
            title: entry.issue.title,
            body: entry.issue.description || '',
            state: entry.issue.status === 'closed' ? ('closed' as const) : ('open' as const),
            url: `http://localhost:${port}/issue/${entry.issue.id}`,
            labels: (entry.issue.labels || []).map(label => ({ id: label, name: label })),
            assignees: entry.issue.assignee ? [{ id: entry.issue.assignee, login: entry.issue.assignee }] : [],
            createdAt: new Date(entry.issue.created_at),
            updatedAt: new Date(entry.issue.updated_at),
            metadata: {
              beadsStatus: entry.issue.status,
              beadsPriority: entry.issue.priority,
              beadsType: entry.issue.issue_type,
              parentId: entry.parentId ?? null,
              depth: entry.depth,
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
            metrics,
            issues,
            edges,
            rootId: tree.issue.id,
            lastUpdate: new Date(),
          });
        };

        const onError = (error: Error) => {
          logger.error('Polling error:', error);
          server.getBroadcaster().broadcast({
            type: 'error',
            message: error.message,
          });
        };

        const polling = new PollingService(
          updateState,
          pollInterval,
          onError
        );

        // Initialize state before starting server so dashboard can load immediately
        logger.info('Initializing state...');
        try {
          await updateState();
        } catch (error) {
          logger.error('Failed to initialize state:', error as Error);
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

        logger.info(`Dashboard running at http://localhost:${port}/issue/${issueId}`);
        logger.info('Press Ctrl+C to stop');

        // Graceful shutdown
        process.on('SIGINT', () => {
          logger.info('Shutting down dashboard...');
          polling.stop();
          server.stop().then(() => {
            process.exit(0);
          });
        });
      } catch (error) {
        const errorLogger = new Logger({ level: logLevel }).withScope('ServeCommand');
        errorLogger.error('Failed to start server:', error as Error);
        process.exit(1);
      }
    });
}
