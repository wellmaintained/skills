# Interactive Beads Visualization Design

**Date:** 2025-11-20
**Status:** Approved

## Overview

Upgrade `beads-bridge serve` from read-only Mermaid visualization to interactive React/reactflow editor. Users can expand/collapse tree sections, change issue status, create subtasks, and reparent nodes through a visual interface writing directly to beads.

## Architecture

### Single Command Evolution

`beads-bridge serve <issue-id>` becomes an interactive editor (replaces current Mermaid view).

### Component Structure

1. **Express Server** - Extends with write endpoints alongside existing read endpoints
2. **LiveWebBackend** - Gains write operations via `bd` CLI (removes read-only limitation)
3. **React + reactflow Frontend** - Replaces simple Mermaid HTML
4. **Shared Infrastructure** - Reuses SSEBroadcaster, PollingService, AssetManager

### API Endpoints

**Existing (keep):**
- `GET /api/health`
- `GET /api/issue/:id` - Current state
- `GET /api/issue/:id/events` - SSE updates

**New (add):**
- `POST /api/issue/:id/status` - Update issue status (write-through)
- `POST /api/issue/:id/create-child` - Create new subtask (write-through)
- `POST /api/issue/:id/reparent` - Move issue to new parent (write-through)

## User Interactions

### Core UI Elements

- **Canvas** - Reactflow canvas showing tree as hierarchical graph
- **Node cards** - Each bead as a card with: title, status badge, expand/collapse toggle, "+" button
- **Toolbar** - Top bar with "Fit view" button
- **Detail modal** - Opens when clicking a node, shows full details with edit form

### Interaction Patterns

**Expand/Collapse:**
- Click chevron icon to toggle children visibility
- Browser stores state locally
- Collapsed nodes show count badge: "3 children hidden"

**Status Changes (write-through):**
- Click status badge → dropdown menu
- Select new status → immediate API call → `bd update <id> --status <new-status>`
- UI updates immediately, reverts on API failure
- SSE broadcasts change to connected clients

**Creating Subtasks (write-through):**
- Click "+" button on any node → modal opens
- Enter title, type, priority → "Create" button
- Executes: `bd create <title> -t <type> -p <priority> --json`
- Then: `bd dep add <new-id> <parent-id> -t parent-child`
- New node appears under parent immediately

**Viewing/Editing Details:**
- Click node card → modal opens
- Shows: full title, description, status dropdown, parent selector, all metadata
- Edit any field → "Save" button → write-through to `bd update`
- Parent change via dropdown → same as drag-and-drop reparenting

**Reparenting (write-through):**
- Drag node, drop on new parent → optimistic update
- OR change parent dropdown in detail modal
- POST `/api/issue/:id/reparent` with `{newParentId: "..."}`
- Server removes old parent-child deps, adds new ones
- SSE broadcasts update

## State Management

### Frontend State Layers

1. **Server state** - Latest data from `bd` via API/SSE (source of truth)
2. **UI state** - Expand/collapse, selected node, modal state (local)

### Data Flow

```
bd CLI (source of truth)
  ↓ (PollingService every 5s)
LiveWebBackend.updateState()
  ↓ (SSE broadcast)
React app receives update
  ↓
Render reactflow graph
```

### Write-Through Operations

All operations follow same pattern:

```
User action in UI
  ↓ (optimistic update)
UI updates immediately
  ↓ (POST request)
Server executes bd command(s)
  ↓ (polling detects change)
SSE broadcasts update
  ↓
UI reconciles (should match optimistic update)
```

## Implementation Details

### Backend Changes

**LiveWebBackend write operations:**

```typescript
async updateIssueStatus(issueId: string, status: string): Promise<void> {
  await execBdCommand(['update', issueId, '--status', status]);
}

async createSubtask(parentId: string, params: CreateParams): Promise<Issue> {
  const result = await execBdCommand(['create', params.title, '-t', params.type, '-p', params.priority, '--json']);
  const newIssue = JSON.parse(result);
  await execBdCommand(['dep', 'add', newIssue.id, parentId, '-t', 'parent-child']);
  return newIssue;
}

async reparentIssue(issueId: string, newParentId: string): Promise<void> {
  // Find current parent-child deps
  const deps = await execBdCommand(['dep', 'list', issueId, '--format', 'json']);
  const parentDeps = JSON.parse(deps).filter(d => d.type === 'parent-child');

  // Remove old parent-child relationships
  for (const dep of parentDeps) {
    await execBdCommand(['dep', 'remove', issueId, dep.target, '-t', 'parent-child']);
  }

  // Add new parent
  await execBdCommand(['dep', 'add', issueId, newParentId, '-t', 'parent-child']);
}
```

**Express Server routes:**

```typescript
this.app.post('/api/issue/:id/status', async (req, res) => {
  const { status } = req.body;
  await this.backend.updateIssueStatus(req.params.id, status);
  res.json({ success: true });
});

this.app.post('/api/issue/:id/create-child', async (req, res) => {
  const issue = await this.backend.createSubtask(req.params.id, req.body);
  res.json(issue);
});

this.app.post('/api/issue/:id/reparent', async (req, res) => {
  const { newParentId } = req.body;
  await this.backend.reparentIssue(req.params.id, newParentId);
  res.json({ success: true });
});
```

### Frontend Stack

- **React 18** - Component model and state
- **reactflow** - Interactive graph library
- **Vite** - Build tool (fast, simple config)
- **TanStack Query** - API calls and optimistic updates
- **Tailwind CSS** - Styling

### Frontend Structure

```
src/client/
├── App.tsx                 # Root component
├── components/
│   ├── Canvas.tsx          # Reactflow canvas wrapper
│   ├── NodeCard.tsx        # Custom node component
│   ├── DetailModal.tsx     # Issue detail/edit modal
│   ├── CreateModal.tsx     # Create subtask modal
│   └── Toolbar.tsx         # Top toolbar
├── hooks/
│   ├── useIssueData.ts     # SSE + API integration
│   └── useTreeLayout.ts    # Layout algorithm
└── api.ts                  # API client functions
```

## Layout & Visualization

### Graph Layout

Use reactflow's hierarchical layout (dagre) with top-to-bottom flow:
- Root issue at top
- Children flow downward
- Siblings arranged horizontally
- Auto-spacing to prevent overlap

### Node Visual Design

Each node card:
```
┌─────────────────────────────┐
│ [Status Badge]  [+ button]  │
│                              │
│ Issue Title (truncated)      │
│                              │
│ [chevron] 3 children         │
└─────────────────────────────┘
```

**Status Badge Colors:**
- `open` - Gray
- `in_progress` - Blue
- `blocked` - Red
- `completed` - Green

**Node States:**
- Default: white background, gray border
- Hovered: shadow effect, cursor pointer
- Dragging: semi-transparent, blue outline
- Selected: blue border, highlighted

### Expand/Collapse Behavior

**Collapsed:**
- Children nodes hidden
- Edge connects to collapsed node
- Badge: "▶ 5 children"

**Expanded:**
- Children nodes visible
- Edges connect to each child
- Badge: "▼ 5 children"

### Interactive Features

- **Pan** - Click and drag canvas background
- **Zoom** - Mouse wheel or pinch gesture
- **Fit view** - Button in toolbar to center and fit entire tree
- **Drag nodes** - Smooth animation for reparenting
- **Mini-map** - Small overview in corner for large trees

## Testing Strategy

### Backend Testing

**Unit tests for LiveWebBackend write operations:**
- Mock `execBdCommand` function
- Test `updateIssueStatus` generates correct `bd update` command
- Test `createSubtask` creates issue and links dependency
- Test `reparentIssue` removes old deps and adds new ones
- Test error handling when `bd` commands fail

**Integration tests for Express routes:**
- Test POST endpoints call backend correctly
- Test response formats
- Test SSE broadcasts after write operations
- Mock LiveWebBackend, verify route behavior

**E2E tests with real `bd` CLI:**
- Start server with test beads repository
- Make API calls via HTTP client
- Verify actual beads data changed: `bd show <id>`, `bd dep tree`
- Verify SSE updates propagate correctly

**Frontend testing:**
- Manual testing only (no automated tests)

## Error Handling

### Backend Errors

**`bd` command failures:**
- Any `bd` command error → Return 500 with error message from `bd`
- Log full command and output to console

### Frontend Errors

**API failures:**
- Show toast: "Error: [message]. Refresh the page."
- Revert optimistic update
- Manual recovery only

**SSE connection issues:**
- Show banner: "Connection lost. Refresh the page."
- Manual reconnection only

### Edge Cases

Accept current behavior:
- Circular dependencies → `bd` will error, show toast
- Multiple users editing → Last write wins
- Stale data → User refreshes to get current state
- Large trees → Reactflow handles it, or it's slow (acceptable for v1)

**Philosophy: When anything goes wrong, show error and tell user to refresh.**

## Future Enhancements (Not in Scope)

- Multi-issue list view
- Workspace overview
- Advanced filtering and search
- Timeline view
- Automatic reconnection for SSE
- Undo/redo
- Keyboard shortcuts
- Bulk operations
