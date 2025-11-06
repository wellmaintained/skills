# LiveWebBackend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a live web dashboard backend to beads-bridge that displays real-time dependency graphs for beads issues via a local HTTP server with Server-Sent Events.

**Architecture:** LiveWebBackend implements the read-only subset of ProjectManagementBackend. A PollingService detects changes by hashing `bd dep tree` output every 5 seconds. When changes occur, SSEBroadcaster pushes updates to all connected browser clients. The frontend renders Mermaid diagrams and shows issue details on click.

**Tech Stack:** TypeScript, Express.js, Server-Sent Events (SSE), Mermaid.js (CDN), Vitest for testing

---

## Phase 1: Dependencies & Project Setup

### Task 1: Add Express and Hash Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Add express and types to dependencies**

Add to `package.json` dependencies section:

```json
"dependencies": {
  "@shortcut/client": "^1.1.0",
  "@types/express": "^4.17.21",
  "commander": "^14.0.2",
  "express": "^4.18.2",
  "octokit": "^3.2.2",
  "zod": "^3.22.0"
}
```

**Step 2: Install dependencies**

Run: `cd .claude/skills/beads-bridge && npm install`

Expected: Dependencies installed successfully

**Step 3: Commit**

```bash
git add .claude/skills/beads-bridge/package.json .claude/skills/beads-bridge/package-lock.json
git commit -m "deps(beads-bridge): add express for LiveWebBackend server"
```

---

## Phase 2: SSEBroadcaster - Simple Broadcast Mechanism

### Task 2: SSEBroadcaster Implementation

**Files:**
- Create: `.claude/skills/beads-bridge/src/server/sse-broadcaster.ts`
- Create: `.claude/skills/beads-bridge/tests/sse-broadcaster.test.ts`

**Step 1: Write the failing test**

Create `.claude/skills/beads-bridge/tests/sse-broadcaster.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { SSEBroadcaster, SSEEvent } from '../src/server/sse-broadcaster.js';
import type { Response } from 'express';

describe('SSEBroadcaster', () => {
  it('should add client and send connected event', () => {
    const broadcaster = new SSEBroadcaster();
    const mockRes = createMockResponse();

    broadcaster.addClient(mockRes);

    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
    expect(mockRes.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
    expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('"type":"connected"'));
  });

  it('should broadcast to all connected clients', () => {
    const broadcaster = new SSEBroadcaster();
    const client1 = createMockResponse();
    const client2 = createMockResponse();

    broadcaster.addClient(client1);
    broadcaster.addClient(client2);

    const event: SSEEvent = { type: 'update', issueId: 'test-1', data: { test: true } };
    broadcaster.broadcast(event);

    expect(client1.write).toHaveBeenCalledWith(expect.stringContaining('"type":"update"'));
    expect(client2.write).toHaveBeenCalledWith(expect.stringContaining('"type":"update"'));
  });

  it('should remove client on close event', () => {
    const broadcaster = new SSEBroadcaster();
    const mockRes = createMockResponse();

    broadcaster.addClient(mockRes);

    // Simulate close event
    const closeHandler = (mockRes.on as any).mock.calls.find((call: any) => call[0] === 'close')[1];
    closeHandler();

    broadcaster.broadcast({ type: 'test' });

    // Client should only receive connected event, not test event
    expect(mockRes.write).toHaveBeenCalledTimes(1);
  });
});

function createMockResponse(): Response {
  const listeners: { [key: string]: Function } = {};
  return {
    setHeader: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    on: vi.fn((event: string, handler: Function) => {
      listeners[event] = handler;
    }),
  } as any;
}
```

**Step 2: Run test to verify it fails**

Run: `cd .claude/skills/beads-bridge && npm test sse-broadcaster.test.ts`

Expected: FAIL with "Cannot find module '../src/server/sse-broadcaster.js'"

**Step 3: Write minimal implementation**

Create `.claude/skills/beads-bridge/src/server/sse-broadcaster.ts`:

```typescript
import type { Response } from 'express';

export type SSEEvent =
  | { type: 'connected' }
  | { type: 'update'; issueId: string; data: any }
  | { type: 'error'; message: string };

export class SSEBroadcaster {
  private clients: Set<Response> = new Set();

  addClient(res: Response): void {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial connection event
    this.sendTo(res, { type: 'connected' });

    // Track client
    this.clients.add(res);

    // Remove on disconnect
    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  broadcast(event: SSEEvent): void {
    this.clients.forEach((client) => this.sendTo(client, event));
  }

  closeAll(): void {
    this.clients.forEach((client) => client.end());
    this.clients.clear();
  }

  private sendTo(res: Response, event: SSEEvent): void {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd .claude/skills/beads-bridge && npm test sse-broadcaster.test.ts`

Expected: PASS (3 tests passing)

**Step 5: Commit**

```bash
git add .claude/skills/beads-bridge/src/server/sse-broadcaster.ts .claude/skills/beads-bridge/tests/sse-broadcaster.test.ts
git commit -m "feat(liveweb): add SSEBroadcaster for real-time updates"
```

---

## Phase 3: PollingService - Change Detection

### Task 3: PollingService Implementation

**Files:**
- Create: `.claude/skills/beads-bridge/src/server/polling-service.ts`
- Create: `.claude/skills/beads-bridge/tests/polling-service.test.ts`

**Step 1: Write the failing test**

Create `.claude/skills/beads-bridge/tests/polling-service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PollingService } from '../src/server/polling-service.js';

describe('PollingService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call onUpdate when hash changes', async () => {
    let diagrams = ['diagram1', 'diagram2'];
    let callCount = 0;

    const fetchDiagram = vi.fn(async () => diagrams[callCount++]);
    const onUpdate = vi.fn();

    const service = new PollingService('test-id', fetchDiagram, onUpdate, 5);

    service.start();
    await vi.runOnlyPendingTimersAsync(); // Initial poll

    expect(onUpdate).toHaveBeenCalledTimes(1); // First poll always triggers update

    await vi.advanceTimersByTimeAsync(5000); // Second poll (same diagram)
    diagrams[callCount] = 'diagram1'; // Same as before
    await vi.runOnlyPendingTimersAsync();

    expect(onUpdate).toHaveBeenCalledTimes(1); // No change, no update

    await vi.advanceTimersByTimeAsync(5000); // Third poll (changed diagram)
    await vi.runOnlyPendingTimersAsync();

    expect(onUpdate).toHaveBeenCalledTimes(2); // Changed, trigger update

    service.stop();
  });

  it('should handle errors gracefully', async () => {
    const fetchDiagram = vi.fn(async () => {
      throw new Error('bd command failed');
    });
    const onUpdate = vi.fn();
    const onError = vi.fn();

    const service = new PollingService('test-id', fetchDiagram, onUpdate, 5, onError);

    service.start();
    await vi.runOnlyPendingTimersAsync();

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onUpdate).not.toHaveBeenCalled();

    service.stop();
  });

  it('should stop polling when stop is called', async () => {
    const fetchDiagram = vi.fn(async () => 'diagram');
    const onUpdate = vi.fn();

    const service = new PollingService('test-id', fetchDiagram, onUpdate, 5);

    service.start();
    await vi.runOnlyPendingTimersAsync();

    service.stop();

    await vi.advanceTimersByTimeAsync(10000);

    expect(fetchDiagram).toHaveBeenCalledTimes(1); // Only initial call
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd .claude/skills/beads-bridge && npm test polling-service.test.ts`

Expected: FAIL with "Cannot find module '../src/server/polling-service.js'"

**Step 3: Write minimal implementation**

Create `.claude/skills/beads-bridge/src/server/polling-service.ts`:

```typescript
import crypto from 'crypto';

export class PollingService {
  private intervalId: NodeJS.Timeout | null = null;
  private lastHash: string | null = null;

  constructor(
    private issueId: string,
    private fetchDiagram: () => Promise<string>,
    private onUpdate: () => Promise<void>,
    private intervalSeconds: number,
    private onError?: (error: Error) => void
  ) {}

  start(): void {
    // Poll immediately on start
    this.poll();

    // Then poll on interval
    this.intervalId = setInterval(
      () => this.poll(),
      this.intervalSeconds * 1000
    );
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async poll(): Promise<void> {
    try {
      const diagram = await this.fetchDiagram();
      const hash = this.hashString(diagram);

      // First poll always triggers update, or when hash changes
      if (this.lastHash === null || hash !== this.lastHash) {
        this.lastHash = hash;
        await this.onUpdate();
      }
    } catch (error) {
      if (this.onError) {
        this.onError(error as Error);
      }
      // Don't crash, continue polling
    }
  }

  private hashString(str: string): string {
    return crypto.createHash('sha256').update(str).digest('hex');
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd .claude/skills/beads-bridge && npm test polling-service.test.ts`

Expected: PASS (3 tests passing)

**Step 5: Commit**

```bash
git add .claude/skills/beads-bridge/src/server/polling-service.ts .claude/skills/beads-bridge/tests/polling-service.test.ts
git commit -m "feat(liveweb): add PollingService for change detection"
```

---

## Phase 4: LiveWebBackend - Read-Only Backend

### Task 4: LiveWebBackend Implementation

**Files:**
- Create: `.claude/skills/beads-bridge/src/backends/liveweb.ts`
- Create: `.claude/skills/beads-bridge/tests/liveweb-backend.test.ts`
- Modify: `.claude/skills/beads-bridge/src/backends/index.ts`

**Step 1: Write the failing test**

Create `.claude/skills/beads-bridge/tests/liveweb-backend.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { LiveWebBackend } from '../src/backends/liveweb.js';
import { NotSupportedError } from '../src/types/errors.js';

describe('LiveWebBackend', () => {
  it('should have correct metadata', () => {
    const backend = new LiveWebBackend();

    expect(backend.name).toBe('liveweb');
    expect(backend.supportsProjects).toBe(false);
    expect(backend.supportsSubIssues).toBe(false);
    expect(backend.supportsCustomFields).toBe(false);
  });

  it('should be always authenticated', () => {
    const backend = new LiveWebBackend();

    expect(backend.isAuthenticated()).toBe(true);
  });

  it('should return cached issue via getIssue', async () => {
    const backend = new LiveWebBackend();

    const issueData = {
      id: 'test-1',
      title: 'Test Issue',
      status: 'open' as const,
      url: 'http://localhost:3000/issue/test-1',
    };

    backend.updateState('test-1', {
      diagram: 'graph TD',
      metrics: { total: 1, completed: 0, inProgress: 0, blocked: 0, open: 1 },
      issues: [issueData],
      lastUpdate: new Date(),
    });

    const issue = await backend.getIssue('test-1');

    expect(issue).toEqual(issueData);
  });

  it('should throw NotFoundError for non-existent issue', async () => {
    const backend = new LiveWebBackend();

    await expect(backend.getIssue('nonexistent')).rejects.toThrow('Issue not found');
  });

  it('should search cached issues', async () => {
    const backend = new LiveWebBackend();

    backend.updateState('test-1', {
      diagram: 'graph TD',
      metrics: { total: 2, completed: 1, inProgress: 0, blocked: 0, open: 1 },
      issues: [
        { id: 'test-1', title: 'Parent', status: 'open' as const, url: '' },
        { id: 'test-2', title: 'Child Task', status: 'closed' as const, url: '' },
      ],
      lastUpdate: new Date(),
    });

    const openIssues = await backend.searchIssues({ state: 'open' });
    expect(openIssues).toHaveLength(1);
    expect(openIssues[0].id).toBe('test-1');

    const allIssues = await backend.searchIssues({});
    expect(allIssues).toHaveLength(2);
  });

  it('should throw NotSupportedError for write operations', async () => {
    const backend = new LiveWebBackend();

    await expect(backend.createIssue({ title: 'Test', body: '' })).rejects.toThrow(NotSupportedError);
    await expect(backend.updateIssue('test', {})).rejects.toThrow(NotSupportedError);
    await expect(backend.addComment('test', 'comment')).rejects.toThrow(NotSupportedError);
    await expect(backend.linkIssues('a', 'b', 'blocks')).rejects.toThrow(NotSupportedError);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd .claude/skills/beads-bridge && npm test liveweb-backend.test.ts`

Expected: FAIL with "Cannot find module '../src/backends/liveweb.js'"

**Step 3: Check if NotSupportedError exists**

Run: `cd .claude/skills/beads-bridge && grep -r "NotSupportedError" src/types/`

Expected: If not found, we need to create it. If found, note the import path.

**Step 4: Create NotSupportedError if needed**

If NotSupportedError doesn't exist, add to `.claude/skills/beads-bridge/src/types/errors.ts` (or create if missing):

```typescript
export class NotSupportedError extends Error {
  constructor(operation: string) {
    super(`Operation not supported: ${operation}`);
    this.name = 'NotSupportedError';
  }
}
```

**Step 5: Write minimal LiveWebBackend implementation**

Create `.claude/skills/beads-bridge/src/backends/liveweb.ts`:

```typescript
import type { ProjectManagementBackend } from '../types/backend.js';
import type {
  Comment,
  CreateIssueParams,
  Issue,
  IssueUpdate,
  LinkedIssue,
  LinkType,
  SearchQuery,
} from '../types/core.js';
import { NotFoundError, NotSupportedError } from '../types/errors.js';
import type { SSEBroadcaster } from '../server/sse-broadcaster.js';

export interface IssueState {
  diagram: string;
  metrics: {
    total: number;
    completed: number;
    inProgress: number;
    blocked: number;
    open: number;
  };
  issues: Issue[];
  lastUpdate: Date;
}

export class LiveWebBackend implements ProjectManagementBackend {
  readonly name = 'liveweb';
  readonly supportsProjects = false;
  readonly supportsSubIssues = false;
  readonly supportsCustomFields = false;

  private state = new Map<string, IssueState>();
  private broadcaster?: SSEBroadcaster;

  setBroadcaster(broadcaster: SSEBroadcaster): void {
    this.broadcaster = broadcaster;
  }

  updateState(issueId: string, state: IssueState): void {
    this.state.set(issueId, state);

    if (this.broadcaster) {
      this.broadcaster.broadcast({
        type: 'update',
        issueId,
        data: state,
      });
    }
  }

  getState(issueId: string): IssueState | undefined {
    return this.state.get(issueId);
  }

  // Read-only operations
  async authenticate(): Promise<void> {
    // No-op, always authenticated
  }

  isAuthenticated(): boolean {
    return true;
  }

  async getIssue(issueId: string): Promise<Issue> {
    const state = this.state.get(issueId);
    if (!state) {
      throw new NotFoundError(`Issue not found: ${issueId}`);
    }

    const issue = state.issues.find((i) => i.id === issueId);
    if (!issue) {
      throw new NotFoundError(`Issue not found in state: ${issueId}`);
    }

    return issue;
  }

  async searchIssues(query: SearchQuery): Promise<Issue[]> {
    const allIssues: Issue[] = [];

    for (const state of this.state.values()) {
      allIssues.push(...state.issues);
    }

    return allIssues.filter((issue) => {
      if (query.state && issue.status !== query.state) return false;
      if (query.text && !issue.title.toLowerCase().includes(query.text.toLowerCase())) return false;
      return true;
    });
  }

  async listComments(issueId: string): Promise<Comment[]> {
    // Dashboard doesn't use comments
    return [];
  }

  async getLinkedIssues(issueId: string): Promise<LinkedIssue[]> {
    // Not implemented for dashboard
    return [];
  }

  // Unsupported write operations
  async createIssue(params: CreateIssueParams): Promise<Issue> {
    throw new NotSupportedError('createIssue');
  }

  async updateIssue(issueId: string, updates: IssueUpdate): Promise<Issue> {
    throw new NotSupportedError('updateIssue');
  }

  async addComment(issueId: string, comment: string): Promise<Comment> {
    throw new NotSupportedError('addComment');
  }

  async linkIssues(parentId: string, childId: string, linkType: LinkType): Promise<void> {
    throw new NotSupportedError('linkIssues');
  }
}
```

**Step 6: Update backends index to export LiveWebBackend**

Modify `.claude/skills/beads-bridge/src/backends/index.ts`:

```typescript
export { GitHubBackend } from './github.js';
export { ShortcutBackend } from './shortcut.js';
export { LiveWebBackend } from './liveweb.js';
```

**Step 7: Run test to verify it passes**

Run: `cd .claude/skills/beads-bridge && npm test liveweb-backend.test.ts`

Expected: PASS (all tests passing)

**Step 8: Commit**

```bash
git add .claude/skills/beads-bridge/src/backends/liveweb.ts .claude/skills/beads-bridge/src/backends/index.ts .claude/skills/beads-bridge/tests/liveweb-backend.test.ts .claude/skills/beads-bridge/src/types/errors.ts
git commit -m "feat(liveweb): add LiveWebBackend read-only implementation"
```

---

## Phase 5: Express Server - HTTP API

### Task 5: ExpressServer Implementation

**Files:**
- Create: `.claude/skills/beads-bridge/src/server/express-server.ts`
- Create: `.claude/skills/beads-bridge/src/server/index.ts`
- Create: `.claude/skills/beads-bridge/tests/express-server.test.ts`

**Step 1: Write the failing test**

Create `.claude/skills/beads-bridge/tests/express-server.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ExpressServer } from '../src/server/express-server.js';
import { LiveWebBackend } from '../src/backends/liveweb.js';

describe('ExpressServer', () => {
  let server: ExpressServer;
  let backend: LiveWebBackend;

  beforeEach(() => {
    backend = new LiveWebBackend();
    server = new ExpressServer(backend, 3001); // Use different port for testing
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should start and stop server', async () => {
    await server.start();

    const response = await fetch('http://localhost:3001/api/health');
    expect(response.ok).toBe(true);

    await server.stop();

    // Server should be stopped
    await expect(fetch('http://localhost:3001/api/health')).rejects.toThrow();
  });

  it('should serve issue API endpoint', async () => {
    backend.updateState('test-1', {
      diagram: 'flowchart TD\n  test["Test"]',
      metrics: { total: 1, completed: 0, inProgress: 0, blocked: 0, open: 1 },
      issues: [
        { id: 'test-1', title: 'Test', status: 'open', url: 'http://localhost:3001/issue/test-1' },
      ],
      lastUpdate: new Date('2025-11-05T20:00:00Z'),
    });

    await server.start();

    const response = await fetch('http://localhost:3001/api/issue/test-1');
    const data = await response.json();

    expect(data.issueId).toBe('test-1');
    expect(data.diagram).toContain('flowchart TD');
    expect(data.metrics.total).toBe(1);
    expect(data.issues).toHaveLength(1);
  });

  it('should return 404 for non-existent issue', async () => {
    await server.start();

    const response = await fetch('http://localhost:3001/api/issue/nonexistent');
    expect(response.status).toBe(404);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd .claude/skills/beads-bridge && npm test express-server.test.ts`

Expected: FAIL with "Cannot find module '../src/server/express-server.js'"

**Step 3: Write minimal ExpressServer implementation**

Create `.claude/skills/beads-bridge/src/server/express-server.ts`:

```typescript
import express, { type Express, type Request, type Response } from 'express';
import type { Server } from 'http';
import type { LiveWebBackend } from '../backends/liveweb.js';
import { SSEBroadcaster } from './sse-broadcaster.js';
import { NotFoundError } from '../types/errors.js';

export class ExpressServer {
  private app: Express;
  private server?: Server;
  private broadcaster: SSEBroadcaster;

  constructor(
    private backend: LiveWebBackend,
    private port: number
  ) {
    this.app = express();
    this.broadcaster = new SSEBroadcaster();
    this.backend.setBroadcaster(this.broadcaster);
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/api/health', (req: Request, res: Response) => {
      res.json({ status: 'ok' });
    });

    // Get issue state
    this.app.get('/api/issue/:id', async (req: Request, res: Response) => {
      try {
        const state = this.backend.getState(req.params.id);

        if (!state) {
          res.status(404).json({ error: 'Issue not found' });
          return;
        }

        res.json({
          issueId: req.params.id,
          diagram: state.diagram,
          metrics: state.metrics,
          issues: state.issues,
          lastUpdate: state.lastUpdate,
        });
      } catch (error) {
        if (error instanceof NotFoundError) {
          res.status(404).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    });

    // SSE endpoint
    this.app.get('/api/issue/:id/events', (req: Request, res: Response) => {
      this.broadcaster.addClient(res);
    });

    // Serve dashboard HTML (placeholder for now)
    this.app.get('/issue/:id', (req: Request, res: Response) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Beads Dashboard - ${req.params.id}</title></head>
        <body>
          <h1>Dashboard for ${req.params.id}</h1>
          <p>Coming soon...</p>
        </body>
        </html>
      `);
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`Dashboard running at http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    this.broadcaster.closeAll();

    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => resolve());
      });
    }
  }

  getBroadcaster(): SSEBroadcaster {
    return this.broadcaster;
  }
}
```

**Step 4: Create server index barrel export**

Create `.claude/skills/beads-bridge/src/server/index.ts`:

```typescript
export { ExpressServer } from './express-server.js';
export { SSEBroadcaster, type SSEEvent } from './sse-broadcaster.js';
export { PollingService } from './polling-service.js';
```

**Step 5: Run test to verify it passes**

Run: `cd .claude/skills/beads-bridge && npm test express-server.test.ts`

Expected: PASS (all tests passing)

**Step 6: Commit**

```bash
git add .claude/skills/beads-bridge/src/server/express-server.ts .claude/skills/beads-bridge/src/server/index.ts .claude/skills/beads-bridge/tests/express-server.test.ts
git commit -m "feat(liveweb): add ExpressServer with API endpoints"
```

---

## Phase 6: Serve Command - CLI Integration

### Task 6: Serve Command Implementation

**Files:**
- Create: `.claude/skills/beads-bridge/src/cli/commands/serve.ts`
- Modify: `.claude/skills/beads-bridge/src/cli.ts`

**Step 1: Write serve command**

Create `.claude/skills/beads-bridge/src/cli/commands/serve.ts`:

```typescript
import { Command } from 'commander';
import { LiveWebBackend } from '../../backends/liveweb.js';
import { ExpressServer } from '../../server/express-server.js';
import { PollingService } from '../../server/polling-service.js';
import { BeadsClient } from '../../clients/beads-client.js';
import type { DependencyTreeNode, BeadsIssue, BeadsRepository } from '../../types/beads.js';
import { execBdCommand } from '../../utils/bd-cli.js';
import { readConfig } from '../../config/config-manager.js';
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
        const config = await readConfig();
        const beadsClient = new BeadsClient(config.repositories || []);

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
          const repoName = findRepositoryForIssue(issueId, config.repositories);
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

          const issues = allIssues.map((issue) => ({
            id: issue.id,
            title: issue.title,
            status: issue.status,
            url: `http://localhost:${port}/issue/${issue.id}`,
            description: issue.description,
            labels: issue.labels || [],
            assignees: issue.assignees || [],
          }));

          // Calculate metrics
          const metrics = {
            total: issues.length,
            completed: issues.filter((i) => i.status === 'closed').length,
            inProgress: issues.filter((i) => i.status === 'in_progress').length,
            blocked: issues.filter((i) => i.status === 'blocked').length,
            open: issues.filter((i) => i.status === 'open').length,
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
          issueId,
          fetchDiagram,
          updateState,
          pollInterval,
          onError
        );

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
```

**Step 2: Create open-browser utility**

Create `.claude/skills/beads-bridge/src/utils/open-browser.ts`:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function open(url: string): Promise<void> {
  const command = process.platform === 'darwin'
    ? `open "${url}"`
    : process.platform === 'win32'
    ? `start "${url}"`
    : `xdg-open "${url}"`;

  try {
    await execAsync(command);
  } catch (error) {
    console.warn('Failed to open browser automatically:', error);
  }
}
```

**Step 3: Check if execBdCommand exists in bd-cli utils**

Run: `cd .claude/skills/beads-bridge && cat src/utils/bd-cli.ts`

Expected: Check if `execBdCommand` function exists

**Step 4: Add execBdCommand if missing**

If `execBdCommand` doesn't exist, add to `.claude/skills/beads-bridge/src/utils/bd-cli.ts`:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function execBdCommand(args: string[]): Promise<string> {
  const command = `bd ${args.join(' ')}`;

  try {
    const { stdout } = await execAsync(command);
    return stdout;
  } catch (error: any) {
    throw new Error(`bd command failed: ${error.message}`);
  }
}
```

**Step 5: Register serve command in main CLI**

Modify `.claude/skills/beads-bridge/src/cli.ts` to import and register the serve command:

```typescript
// Add to imports section
import { createServeCommand } from './cli/commands/serve.js';

// Add to command registration section (after other commands)
program.addCommand(createServeCommand());
```

**Step 6: Build and test command registration**

Run: `cd .claude/skills/beads-bridge && npm run build`

Expected: Build succeeds

Run: `cd .claude/skills/beads-bridge && node dist/cli.js serve --help`

Expected: Shows serve command help

**Step 7: Commit**

```bash
git add .claude/skills/beads-bridge/src/cli/commands/serve.ts .claude/skills/beads-bridge/src/utils/open-browser.ts .claude/skills/beads-bridge/src/utils/bd-cli.ts .claude/skills/beads-bridge/src/cli.ts
git commit -m "feat(liveweb): add serve command to CLI"
```

---

## Phase 7: Frontend Dashboard - HTML/CSS/JS

### Task 7: Dashboard Frontend

**Files:**
- Create: `.claude/skills/beads-bridge/src/frontend/dashboard.html`
- Create: `.claude/skills/beads-bridge/src/frontend/dashboard.css`
- Create: `.claude/skills/beads-bridge/src/frontend/dashboard.js`
- Modify: `.claude/skills/beads-bridge/src/server/express-server.ts`

**Step 1: Create dashboard HTML**

Create `.claude/skills/beads-bridge/src/frontend/dashboard.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Beads Dashboard - {{ISSUE_ID}}</title>
  <script type="module" src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs"></script>
  <link rel="stylesheet" href="/static/dashboard.css">
</head>
<body>
  <header>
    <h1>🔮 Beads Dashboard</h1>
    <div id="issue-title" class="issue-id">{{ISSUE_ID}}</div>
    <div id="metrics">
      <span id="completed-metric" class="metric">0/0 completed</span>
      <span id="blocked-metric" class="metric blocked">0 blocked</span>
      <span id="last-update" class="metric">Last update: Never</span>
    </div>
  </header>

  <main>
    <div id="error-banner" class="error-banner hidden"></div>
    <div id="loading" class="loading">Loading...</div>
    <div id="graph-container" class="graph-container hidden">
      <pre class="mermaid" id="graph"></pre>
    </div>
  </main>

  <div id="modal" class="modal hidden">
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <button class="modal-close">&times;</button>
      <h2 id="modal-title"></h2>
      <div class="modal-section">
        <strong>Status:</strong> <span id="modal-status"></span>
      </div>
      <div class="modal-section">
        <strong>Description:</strong>
        <div id="modal-description"></div>
      </div>
      <div id="modal-notes-section" class="modal-section hidden">
        <strong>Notes:</strong>
        <div id="modal-notes"></div>
      </div>
    </div>
  </div>

  <script src="/static/dashboard.js"></script>
</body>
</html>
```

**Step 2: Create dashboard CSS**

Create `.claude/skills/beads-bridge/src/frontend/dashboard.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #f5f5f5;
  color: #333;
}

header {
  background: white;
  border-bottom: 2px solid #e0e0e0;
  padding: 1rem 2rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

h1 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.issue-id {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 1rem;
  color: #666;
  margin-bottom: 0.5rem;
}

#metrics {
  display: flex;
  gap: 1.5rem;
  font-size: 0.9rem;
}

.metric {
  padding: 0.25rem 0.5rem;
  background: #e8f5e9;
  border-radius: 4px;
}

.metric.blocked {
  background: #ffebee;
}

main {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.error-banner {
  background: #ffebee;
  border: 1px solid #f44336;
  color: #c62828;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.error-banner.hidden {
  display: none;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: #999;
  font-size: 1.2rem;
}

.graph-container {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  overflow-x: auto;
}

.graph-container.hidden {
  display: none;
}

.mermaid {
  display: flex;
  justify-content: center;
}

/* Modal */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
}

.modal.hidden {
  display: none;
}

.modal-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
}

.modal-content {
  position: relative;
  background: white;
  max-width: 600px;
  margin: 5rem auto;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  max-height: 70vh;
  overflow-y: auto;
}

.modal-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #999;
}

.modal-close:hover {
  color: #333;
}

.modal-section {
  margin: 1rem 0;
}

.modal-section.hidden {
  display: none;
}

#modal-title {
  margin-bottom: 1rem;
  padding-right: 2rem;
}

#modal-status {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.9rem;
  font-weight: 500;
}
```

**Step 3: Create dashboard JavaScript**

Create `.claude/skills/beads-bridge/src/frontend/dashboard.js`:

```javascript
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';

// Get issue ID from URL
const issueId = window.location.pathname.split('/').pop();

// State
let issuesMap = new Map();
let eventSource = null;

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'default'
});

// Fetch initial state
async function fetchInitialState() {
  try {
    const response = await fetch(`/api/issue/${issueId}`);
    if (!response.ok) {
      throw new Error('Issue not found');
    }

    const data = await response.json();
    updateDashboard(data);
  } catch (error) {
    showError(`Failed to load issue: ${error.message}`);
  }
}

// Connect to SSE
function connectSSE() {
  eventSource = new EventSource(`/api/issue/${issueId}/events`);

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'connected') {
      console.log('Connected to live updates');
    } else if (data.type === 'update') {
      updateDashboard(data.data);
    } else if (data.type === 'error') {
      showError(data.message);
    }
  };

  eventSource.onerror = () => {
    console.error('SSE connection lost, reconnecting...');
    setTimeout(() => {
      if (eventSource) {
        eventSource.close();
      }
      connectSSE();
    }, 2000);
  };
}

// Update dashboard with new data
async function updateDashboard(data) {
  hideError();

  // Update metrics
  document.getElementById('completed-metric').textContent =
    `${data.metrics.completed}/${data.metrics.total} completed`;
  document.getElementById('blocked-metric').textContent =
    `${data.metrics.blocked} blocked`;
  document.getElementById('last-update').textContent =
    `Last update: ${new Date(data.lastUpdate).toLocaleTimeString()}`;

  // Update issues map
  issuesMap = new Map(data.issues.map(issue => [issue.id, issue]));

  // Render mermaid diagram
  await renderDiagram(data.diagram);

  // Hide loading, show graph
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('graph-container').classList.remove('hidden');
}

// Render mermaid diagram with click handlers
async function renderDiagram(diagram) {
  const graphElement = document.getElementById('graph');

  // Add click callbacks to diagram
  const diagramWithCallbacks = diagram.replace(
    /(\w+-\w+)\[/g,
    (match, nodeId) => `${nodeId}["click ${nodeId} showIssueDetails '${nodeId}' "]`
  );

  graphElement.textContent = diagram;

  try {
    await mermaid.run({
      nodes: [graphElement]
    });
  } catch (error) {
    console.error('Mermaid render error:', error);
    showError('Failed to render diagram');
  }
}

// Show issue details modal
window.showIssueDetails = function(nodeId) {
  const issue = issuesMap.get(nodeId);
  if (!issue) return;

  document.getElementById('modal-title').textContent = `${issue.id}: ${issue.title}`;
  document.getElementById('modal-status').textContent = issue.status;
  document.getElementById('modal-description').textContent = issue.description || 'No description';

  // Show/hide notes section
  if (issue.notes) {
    document.getElementById('modal-notes').textContent = issue.notes;
    document.getElementById('modal-notes-section').classList.remove('hidden');
  } else {
    document.getElementById('modal-notes-section').classList.add('hidden');
  }

  document.getElementById('modal').classList.remove('hidden');
};

// Close modal
document.querySelector('.modal-close').addEventListener('click', () => {
  document.getElementById('modal').classList.add('hidden');
});

document.querySelector('.modal-backdrop').addEventListener('click', () => {
  document.getElementById('modal').classList.add('hidden');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('modal').classList.add('hidden');
  }
});

// Error handling
function showError(message) {
  const banner = document.getElementById('error-banner');
  banner.textContent = message;
  banner.classList.remove('hidden');
}

function hideError() {
  document.getElementById('error-banner').classList.add('hidden');
}

// Initialize
fetchInitialState();
connectSSE();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (eventSource) {
    eventSource.close();
  }
});
```

**Step 4: Update ExpressServer to serve static files and HTML**

Modify `.claude/skills/beads-bridge/src/server/express-server.ts` to add static file serving:

```typescript
// Add to imports
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

// Add after constructor
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In setupRoutes(), add before other routes:
private setupRoutes(): void {
  // Serve static files
  const frontendPath = path.join(__dirname, '..', 'frontend');
  this.app.use('/static', express.static(frontendPath));

  // ... rest of routes

  // Update dashboard HTML route to serve actual file:
  this.app.get('/issue/:id', (req: Request, res: Response) => {
    const htmlPath = path.join(__dirname, '..', 'frontend', 'dashboard.html');
    let html = readFileSync(htmlPath, 'utf-8');
    html = html.replace(/{{ISSUE_ID}}/g, req.params.id);
    res.send(html);
  });
```

**Step 5: Test frontend locally**

Run: `cd .claude/skills/beads-bridge && npm run build`

Run: `cd .claude/skills/beads-bridge && node dist/cli.js serve pensive-8e2d --no-open`

Open browser to `http://localhost:3000/issue/pensive-8e2d`

Expected: Dashboard loads, shows graph, metrics update

**Step 6: Commit**

```bash
git add .claude/skills/beads-bridge/src/frontend/ .claude/skills/beads-bridge/src/server/express-server.ts
git commit -m "feat(liveweb): add dashboard frontend with Mermaid rendering"
```

---

## Phase 8: Documentation & Polish

### Task 8: Add Documentation

**Files:**
- Create: `.claude/skills/beads-bridge/docs/LIVEWEB_BACKEND.md`
- Modify: `.claude/skills/beads-bridge/README.md`

**Step 1: Create LiveWeb backend documentation**

Create `.claude/skills/beads-bridge/docs/LIVEWEB_BACKEND.md`:

```markdown
# LiveWeb Backend - Real-time Beads Dashboard

## Overview

The LiveWeb backend provides a local web server that displays real-time dependency graphs for beads issues. Unlike GitHub and Shortcut backends that push updates to external services, LiveWebBackend serves updates to browsers via HTTP and Server-Sent Events (SSE).

## Quick Start

```bash
# Start dashboard for an issue
beads-bridge serve pensive-8e2d

# Custom port
beads-bridge serve pensive-8e2d --port 3001

# Slower polling (every 10 seconds)
beads-bridge serve pensive-8e2d --poll-interval 10

# Don't auto-open browser
beads-bridge serve pensive-8e2d --no-open
```

## Features

- **Real-time updates** - Graph updates automatically when beads issues change
- **Interactive visualization** - Click nodes to see issue details
- **Live metrics** - Completion percentage, blockers, last update time
- **Server-Sent Events** - Efficient one-way push from server to browser
- **No external dependencies** - Runs completely locally

## Architecture

### Components

1. **LiveWebBackend** - Read-only backend implementation
2. **PollingService** - Detects changes by polling `bd dep tree` every 5s
3. **ExpressServer** - HTTP server with API endpoints
4. **SSEBroadcaster** - Pushes updates to connected browsers
5. **Frontend** - Mermaid.js rendering with modal details

### Data Flow

```
bd CLI (source of truth)
  ↓ (poll every 5s)
PollingService (hash comparison)
  ↓ (on change)
LiveWebBackend.updateState()
  ↓
SSEBroadcaster.broadcast()
  ↓
Browser receives update
  ↓
Re-render Mermaid diagram
```

## API Endpoints

### GET /api/health

Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

### GET /api/issue/:id

Get current state for an issue.

**Response:**
```json
{
  "issueId": "pensive-8e2d",
  "diagram": "flowchart TD\n  pensive-8e2d[...]",
  "metrics": {
    "total": 21,
    "completed": 5,
    "inProgress": 3,
    "blocked": 2,
    "open": 11
  },
  "issues": [
    {
      "id": "pensive-8e2d",
      "title": "2025-11-05 Tessier Release",
      "status": "open",
      "url": "http://localhost:3000/issue/pensive-8e2d",
      "description": "...",
      "labels": [],
      "assignees": []
    }
  ],
  "lastUpdate": "2025-11-05T20:30:00Z"
}
```

### GET /api/issue/:id/events

Server-Sent Events endpoint for live updates.

**Event Types:**

```typescript
// Connected
{ "type": "connected" }

// Update
{
  "type": "update",
  "issueId": "pensive-8e2d",
  "data": {
    "diagram": "...",
    "metrics": { ... },
    "issues": [ ... ],
    "lastUpdate": "..."
  }
}

// Error
{
  "type": "error",
  "message": "bd command failed"
}
```

### GET /issue/:id

Serve dashboard HTML page for an issue.

## Use Cases

### 1. Watch Subagents Working

```bash
# Start dashboard for epic
beads-bridge serve pensive-8e2d

# As Claude subagents complete tasks, the graph updates in real-time
# See tasks change from ☐ to ☑
# Watch metrics update
```

### 2. Team Standup Dashboard

```bash
# Start dashboard on shared screen
beads-bridge serve team-sprint-23

# Team sees live progress
# Click nodes for details
# Metrics visible at a glance
```

### 3. Interactive Exploration

```bash
# Start dashboard
beads-bridge serve complex-feature-42

# Click nodes to see:
# - Issue description
# - Current status
# - Notes and context
# - Dependencies
```

## Configuration

No configuration file needed. Everything via command flags.

**Default values:**
- Port: 3000
- Poll interval: 5 seconds
- Auto-open browser: yes

## Troubleshooting

### "Issue not found"

Verify issue exists:
```bash
bd show pensive-8e2d
```

### "Port already in use"

Use different port:
```bash
beads-bridge serve pensive-8e2d --port 3001
```

### "bd command not found"

Install beads CLI:
```bash
# See: https://github.com/steveyegge/beads
```

### Dashboard not updating

Check polling interval:
```bash
beads-bridge serve pensive-8e2d --poll-interval 2
```

### Mermaid render error

Check bd output format:
```bash
bd dep tree pensive-8e2d --reverse --format mermaid
```

## Limitations

- **Read-only** - Dashboard displays data, doesn't modify beads
- **Single issue view** - One issue per server instance
- **Polling-based** - 5 second delay (not instant updates)
- **No persistence** - State lives in memory only
- **Local only** - Not designed for remote access

## Future Enhancements

- Multi-issue list view
- Workspace overview
- Interactive graph library (vis.js, cytoscape.js)
- Filtering and search
- Timeline view
- Filesystem watching instead of polling

## License

MIT
```

**Step 2: Update main README to mention LiveWeb backend**

Add to `.claude/skills/beads-bridge/README.md` in the backends section:

```markdown
### LiveWeb Backend

Real-time local web dashboard for visualizing beads dependency graphs.

```bash
beads-bridge serve pensive-8e2d
```

Opens browser to `http://localhost:3000/issue/pensive-8e2d` with live-updating graph.

See [LiveWeb Backend Documentation](docs/LIVEWEB_BACKEND.md) for details.
```

**Step 3: Commit**

```bash
git add .claude/skills/beads-bridge/docs/LIVEWEB_BACKEND.md .claude/skills/beads-bridge/README.md
git commit -m "docs(liveweb): add LiveWeb backend documentation"
```

---

## Final Checklist

Before considering the implementation complete:

- [ ] All tests passing: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] Type check passes: `npm run type-check`
- [ ] Serve command works: `beads-bridge serve <issue-id>`
- [ ] Dashboard loads in browser
- [ ] Graph renders correctly
- [ ] Metrics display
- [ ] Click node shows modal
- [ ] SSE updates work (change a beads issue, see graph update)
- [ ] Error handling works (try invalid issue ID)
- [ ] Documentation complete

## Success Criteria

The MVP is successful if:

1. ✅ User runs `beads-bridge serve pensive-8e2d` and browser opens
2. ✅ Dashboard shows dependency graph with metrics
3. ✅ Graph updates within 5 seconds when beads changes
4. ✅ Clicking nodes shows issue details
5. ✅ Multiple browser tabs can view simultaneously
6. ✅ Errors handled gracefully

## Estimated Time

- Phase 1 (Dependencies): 15 minutes
- Phase 2 (SSEBroadcaster): 30 minutes
- Phase 3 (PollingService): 30 minutes
- Phase 4 (LiveWebBackend): 45 minutes
- Phase 5 (ExpressServer): 45 minutes
- Phase 6 (Serve Command): 30 minutes
- Phase 7 (Frontend): 1 hour
- Phase 8 (Documentation): 30 minutes

**Total: ~5 hours**

---

*Plan generated: 2025-11-05*
*Design doc: docs/plans/2025-11-05-liveweb-backend-design.md*
