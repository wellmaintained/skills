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
