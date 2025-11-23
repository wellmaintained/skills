# LiveWebBackend Design - Real-time Beads Dashboard

**Date:** 2025-11-05
**Author:** David Laing
**Status:** Design Validated

## Overview

Add a live web dashboard backend to beads-bridge that displays real-time dependency graphs for beads issues. Unlike GitHub and Shortcut backends that push updates to external services, LiveWebBackend serves updates to browsers via a local HTTP server.

## Use Cases

The dashboard serves three primary purposes:

1. **Real-time monitoring** - Watch Claude subagents update beads issues as they work
2. **Manual exploration** - Interactively explore dependency graphs and issue details
3. **Team dashboard** - Share live progress view with stakeholders during meetings

## Architecture

### Key Components

1. **LiveWebBackend** - Implements read-only subset of ProjectManagementBackend interface
2. **PollingService** - Periodically runs `bd` commands to detect changes
3. **ExpressServer** - HTTP server serving static dashboard and API endpoints
4. **SSEBroadcaster** - Pushes updates to connected browsers via Server-Sent Events
5. **MermaidRenderer** - Frontend component rendering live Mermaid diagrams

### Data Flow

```
bd CLI (source of truth)
  ↓ (poll every 5s)
PollingService detects changes
  ↓
LiveWebBackend updates in-memory state
  ↓
SSEBroadcaster pushes to browsers
  ↓
Dashboard re-renders graph
```

The server runs in the background once started, lives until process ends. No persistent storage needed - all data comes from beads repositories via `bd` CLI.

## Command Interface

### New Command

```bash
beads-bridge serve <issue-id> [options]

# Examples:
beads-bridge serve pensive-8e2d
beads-bridge serve pensive-8e2d --port 3000
beads-bridge serve pensive-8e2d --poll-interval 10
```

### Command Behavior

1. Validates issue-id exists (via `bd show <issue-id>`)
2. Starts Express server on specified port (default: 3000)
3. Initializes PollingService with issue-id
4. Opens browser to `http://localhost:3000/issue/<issue-id>`
5. Prints: "Dashboard running at http://localhost:3000/issue/pensive-8e2d"
6. Server runs until Ctrl+C

### Command Options

- `--port <number>` - Server port (default: 3000)
- `--poll-interval <seconds>` - How often to check for changes (default: 5)
- `--no-open` - Don't auto-open browser

### Server Lifecycle

- Server starts synchronously (blocks until running)
- Auto-opens browser tab to issue view
- Polling starts immediately (first poll on startup)
- SSE connections accepted from any browser tab
- Graceful shutdown on SIGINT (Ctrl+C) - closes connections, stops polling

## Backend Implementation

### LiveWebBackend Class

```typescript
export class LiveWebBackend implements ProjectManagementBackend {
  readonly name = "liveweb";
  readonly supportsProjects = false;
  readonly supportsSubIssues = false;
  readonly supportsCustomFields = false;

  private state: Map<string, IssueState>;
  private broadcaster: SSEBroadcaster;

  // IssueState = { diagram: string, metrics: Metrics, issues: Issue[] }
}
```

### Implemented Methods (Read-Only)

- `getIssue(id)` - Returns cached issue from state map
- `searchIssues(query)` - Searches cached issues by title/status
- `listComments(id)` - Returns empty array (not applicable for dashboard)

### Unimplemented Methods

These methods throw `NotSupportedError`:
- `createIssue()`, `updateIssue()`, `addComment()`, `linkIssues()`, `authenticate()`, etc.

The LiveWebBackend is read-only. It consumes data from beads but doesn't modify it.

### Update State Method

```typescript
async updateState(issueId: string): Promise<void> {
  // 1. Run: bd dep tree <id> --reverse --format mermaid
  // 2. Run: bd dep tree <id> --reverse (text format)
  // 3. Parse issue IDs from tree
  // 4. Run: bd show <id> --json for each issue
  // 5. Calculate metrics (total, completed, blocked, etc.)
  // 6. Store in state map
  // 7. Broadcast via SSE: { type: 'update', issueId, data }
}
```

This method is called by PollingService when changes are detected.

## Polling Service

### PollingService Class

```typescript
class PollingService {
  private intervalId: NodeJS.Timeout | null = null;
  private lastHash: string | null = null;

  constructor(
    private backend: LiveWebBackend,
    private issueId: string,
    private intervalSeconds: number
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
    }
  }

  private async poll(): Promise<void> {
    // 1. Run: bd dep tree <issueId> --reverse --format mermaid
    // 2. Hash the output
    // 3. Compare to lastHash
    // 4. If changed: backend.updateState(issueId)
    // 5. Store new hash
  }
}
```

### Change Detection Strategy

Use simple string hash of Mermaid output. If hash changes, something in the dependency tree changed (task completed, new issue added, status updated, etc.). This avoids parsing the tree twice.

### Error Handling

- If `bd` command fails, log error and continue polling
- Don't crash server on transient failures
- Broadcast error event to UI: `{ type: 'error', message }`

## Express Server & API

### ExpressServer Class

```typescript
class ExpressServer {
  private app: express.Application;
  private server: http.Server;
  private broadcaster: SSEBroadcaster;

  constructor(private backend: LiveWebBackend, private port: number) {
    this.app = express();
    this.broadcaster = new SSEBroadcaster();
    this.setupRoutes();
  }

  start(): void {
    this.server = this.app.listen(this.port);
    console.log(`Dashboard: http://localhost:${this.port}`);
  }

  stop(): void {
    this.broadcaster.closeAll();
    this.server.close();
  }
}
```

### API Endpoints

1. **GET /issue/:id** - Serve dashboard HTML page
2. **GET /api/issue/:id** - Get current issue state (JSON)
3. **GET /api/issue/:id/events** - SSE endpoint for live updates
4. **GET /static/** - Serve bundled frontend assets (CSS, JS)

### API Response Format

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
      "description": "...",
      "notes": "..."
    }
  ],
  "lastUpdate": "2025-11-05T20:30:00Z"
}
```

## Server-Sent Events

### SSEBroadcaster Class

```typescript
class SSEBroadcaster {
  private clients: Set<express.Response> = new Set();

  addClient(res: express.Response): void {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial connection event
    this.sendTo(res, { type: 'connected' });

    // Track client
    this.clients.add(res);

    // Remove on disconnect
    res.on('close', () => this.clients.delete(res));
  }

  broadcast(event: SSEEvent): void {
    this.clients.forEach(client => this.sendTo(client, event));
  }

  private sendTo(res: express.Response, event: SSEEvent): void {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  closeAll(): void {
    this.clients.forEach(client => client.end());
    this.clients.clear();
  }
}
```

### Event Types

```typescript
type SSEEvent =
  | { type: 'connected' }
  | { type: 'update', issueId: string, data: IssueState }
  | { type: 'error', message: string };
```

### Usage Flow

1. Browser connects to `/api/issue/pensive-8e2d/events`
2. Server adds response to clients set
3. PollingService detects change → calls `broadcaster.broadcast({ type: 'update', ... })`
4. All connected browsers receive update event
5. Browser disconnects → automatic cleanup via 'close' event

## Frontend Dashboard

### Tech Stack

- Plain HTML/CSS/JavaScript (no build step needed)
- Mermaid.js CDN for diagram rendering
- Native EventSource API for SSE
- Vanilla JS modal for node details

### HTML Structure

```html
<!DOCTYPE html>
<html>
<head>
  <title>Beads Dashboard - {issueId}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <link rel="stylesheet" href="/static/dashboard.css">
</head>
<body>
  <header>
    <h1>Beads Dashboard</h1>
    <div id="issue-title">{issueId}</div>
    <div id="metrics">
      <span id="completed">0/0 completed</span>
      <span id="blocked">0 blocked</span>
      <span id="last-update">Never</span>
    </div>
  </header>

  <main>
    <div id="graph-container">
      <div class="mermaid" id="graph"></div>
    </div>
  </main>

  <div id="modal" class="hidden">
    <!-- Issue details popup -->
  </div>

  <script src="/static/dashboard.js"></script>
</body>
</html>
```

### JavaScript Flow

```javascript
// 1. Fetch initial state: GET /api/issue/:id
// 2. Render Mermaid diagram
// 3. Connect to SSE: /api/issue/:id/events
// 4. On 'update' event: re-render diagram + metrics
// 5. On node click: show modal with issue details
```

### Design Principles

- **Minimal and focused** - Graph-first, details on demand
- **Clean interface** - Good for "watching subagents work"
- **No framework overhead** - Vanilla JS keeps it simple

## Interactive Node Details

### Mermaid Click Events

Mermaid supports click callbacks on nodes for showing issue details in a modal.

### Implementation

```javascript
// After rendering Mermaid diagram, attach click handlers
mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose' // Required for click events
});

// Render with click callbacks
const graphDefinition = `
flowchart TD
  pensive-8e2d["☐ pensive-8e2d: Title"]
  click pensive-8e2d callback "pensive-8e2d"
  ...
`;

mermaid.render('graph', graphDefinition);

// Click callback shows modal
window.callback = function(nodeId) {
  const issue = issuesMap.get(nodeId);
  showModal(issue);
};

function showModal(issue) {
  document.getElementById('modal-title').textContent = issue.title;
  document.getElementById('modal-status').textContent = issue.status;
  document.getElementById('modal-description').textContent = issue.description;
  // Show notes, dependencies, etc.
  document.getElementById('modal').classList.remove('hidden');
}
```

### Modal Content

- Issue ID and title
- Status (open/in_progress/blocked/closed)
- Description
- Notes (if present)
- Dependencies (blocks/blocked by)
- Close button

### Styling

Simple modal overlay with backdrop, centered card, close on backdrop click or ESC key.

## Error Handling & Edge Cases

### Server Startup Errors

- **Port already in use**: Exit with clear error "Port 3000 in use, try --port 3001"
- **Invalid issue ID**: Validate with `bd show <id>` before starting server, exit if not found
- **bd CLI not found**: Check `bd --version` on startup, exit with installation instructions

### Runtime Errors

- **Polling failure**: Log error, show error banner in UI, continue polling
- **Mermaid parse error**: Show "Invalid diagram" message in graph container, log raw Mermaid
- **SSE connection lost**: Frontend auto-reconnects with exponential backoff (1s, 2s, 4s, 8s max)

### Edge Cases

- **Empty dependency tree**: Show single node for root issue, message "No dependencies yet"
- **Circular dependencies**: Mermaid handles this, but log warning
- **Large graphs (100+ nodes)**: Mermaid may be slow, show loading spinner, consider pagination later
- **Concurrent serves**: Each `beads-bridge serve` command starts separate server on different port

### Graceful Shutdown

```typescript
process.on('SIGINT', () => {
  console.log('\nShutting down dashboard...');
  pollingService.stop();
  server.stop(); // Closes SSE connections, stops HTTP server
  process.exit(0);
});
```

## Testing Strategy

### Unit Tests (Vitest)

1. **LiveWebBackend**
   - `getIssue()` returns cached state
   - `searchIssues()` filters by query
   - Unimplemented methods throw NotSupported error

2. **PollingService**
   - Detects changes via hash comparison
   - Calls `updateState()` only when hash changes
   - Handles `bd` command failures gracefully

3. **SSEBroadcaster**
   - Adds/removes clients correctly
   - Broadcasts to all connected clients
   - Cleanup on client disconnect

4. **ExpressServer**
   - API endpoints return correct JSON
   - SSE endpoint sets proper headers
   - Serves static files

### Integration Tests

1. **End-to-end serve command**
   - Mock `bd` CLI responses
   - Start server, verify endpoints respond
   - Simulate change, verify SSE broadcast

2. **Frontend (manual testing initially)**
   - Initial load fetches and renders diagram
   - SSE updates trigger re-render
   - Click nodes shows modal with details

### Test Coverage Goal

80%+ for backend, manual testing for frontend in MVP.

## File Structure

```
.claude/skills/beads-bridge/
├── src/
│   ├── backends/
│   │   └── liveweb-backend.ts          # LiveWebBackend implementation
│   ├── server/
│   │   ├── express-server.ts            # HTTP server
│   │   ├── sse-broadcaster.ts           # SSE handling
│   │   └── polling-service.ts           # Change detection
│   ├── commands/
│   │   └── serve.ts                     # CLI serve command
│   └── frontend/
│       ├── dashboard.html               # Static HTML
│       ├── dashboard.css                # Minimal styling
│       └── dashboard.js                 # SSE + Mermaid rendering
├── tests/
│   ├── liveweb-backend.test.ts
│   ├── sse-broadcaster.test.ts
│   └── polling-service.test.ts
└── docs/
    └── plans/
        └── 2025-11-05-liveweb-backend-design.md
```

## Implementation Phases

### Phase 1 - Basic Server (Days 1-2)

- ExpressServer with API endpoints
- Static frontend with hardcoded data
- Manual testing: `curl http://localhost:3000/api/issue/pensive-8e2d`

### Phase 2 - Backend Integration (Days 3-4)

- LiveWebBackend implementation
- Integrate with existing bd CLI calls
- Test: Server returns real beads data

### Phase 3 - Live Updates (Days 5-6)

- PollingService implementation
- SSEBroadcaster implementation
- Test: Browser updates when beads changes

### Phase 4 - Polish (Day 7)

- Error handling
- Modal for node details
- Auto-open browser on serve
- Documentation

**Estimated Total: 1-2 weeks to MVP**

## Future Enhancements (Post-MVP)

These features are explicitly out of scope for the MVP but could be added later:

1. **Multi-issue view** - List all active epics, navigate between them
2. **Workspace overview** - See all beads repositories
3. **Interactive graph library** - Upgrade from Mermaid to vis.js/cytoscape.js for more interaction
4. **Filtering/search** - Filter graph by status, repository, labels
5. **Timeline view** - Show issue completion over time
6. **Collaborative features** - Multiple users viewing same dashboard
7. **Filesystem watching** - Replace polling with inotify/chokidar for instant updates

## Design Decisions & Rationale

### Why SSE instead of WebSocket?

**SSE is simpler for one-way communication**. We only need server → browser updates, not bidirectional messaging. SSE auto-reconnects, works over HTTP/2, and has native EventSource API in browsers.

### Why polling instead of filesystem watching?

**Polling is simpler and more portable**. No inotify/chokidar dependencies, works across platforms, easier to test. The 5-second default is responsive enough for the use cases. We can optimize later if needed.

### Why Mermaid instead of D3/vis.js/cytoscape?

**Reuse what works**. The skill already generates Mermaid diagrams for GitHub and Shortcut. Starting with Mermaid live rendering means we can get to a working demo quickly. We can upgrade to interactive libraries later if the use case demands it.

### Why vanilla JS instead of React/Vue?

**No build step needed**. Keep the frontend simple - one HTML file, one CSS file, one JS file. No webpack, no npm install for frontend. This reduces complexity and makes the skill more maintainable.

### Why read-only backend?

**The dashboard displays data, doesn't modify it**. Beads is the source of truth. Claude and users modify beads via `bd` CLI. The dashboard just observes and visualizes. This keeps responsibilities clear.

### Why single issue view first?

**YAGNI**. The primary use case is watching one epic/initiative evolve (like "2025-11-05 Tessier Release"). Multi-issue navigation can be added later if needed. Starting simple lets us validate the core concept.

## Success Criteria

The MVP is successful if:

1. ✅ User runs `beads-bridge serve pensive-8e2d` and browser opens to live dashboard
2. ✅ Dashboard shows current dependency graph with metrics
3. ✅ When beads issue changes (via `bd` CLI), dashboard updates within 5 seconds
4. ✅ Clicking a node shows issue details in modal
5. ✅ Multiple browser tabs can view the same issue simultaneously
6. ✅ Server handles errors gracefully and continues running

## References

- [beads-bridge SKILL.md](../SKILL.md)
- [ProjectManagementBackend interface](../../src/types/backend.ts)
- [Mermaid.js documentation](https://mermaid.js.org/)
- [Server-Sent Events spec](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [Existing /yak-map command](../../../../.claude/commands/yak-map.md)
