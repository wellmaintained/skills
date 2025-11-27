# Implementation Architecture

This document describes the technical architecture and implementation details of beads-bridge.

## Core Components

### 1. BeadsClient
Reads issues/epics from git repositories using the `bd` CLI. Provides abstraction layer for querying Beads data structures including epics, tasks, and dependency relationships.

### 2. GitHubBackend
Manages GitHub Issues and Projects v2 via the `gh` CLI. Handles:
- Issue reading and updating
- Comment creation and management
- Project board integration
- Description updates with HTML markers

### 3. ShortcutBackend
Manages Shortcut stories via REST API. Handles:
- Story reading and updating
- Comment creation
- Description updates with "Yak Map" sections
- Workflow state mapping

### 4. ExternalRefResolver
Discovers Beads epics by scanning repositories for matching `external_ref` values (e.g., `github:owner/repo#123`, `shortcut:98765`). Provides a normalized view of all epics associated with a GitHub issue or Shortcut story without requiring a separate mappings database.

### 5. ProgressSynthesizer
Aggregates metrics across multiple repositories and epics. Calculates:
- Total task counts (completed, in progress, blocked, open)
- Percentage completion
- Cross-repository blocker analysis
- Timeline impact estimates

### 6. MermaidGenerator
Creates dependency tree visualizations in Mermaid format. Features:
- Task status visualization with color coding
- Dependency relationships (blocks/blocked-by)
- Cross-repository relationships
- Collapsible epic groups
- Status-based styling classes

### 7. DiagramPlacer
Updates GitHub issue descriptions or comments with generated diagrams. Handles:
- HTML marker-based content replacement
- Comment creation with proper formatting
- Version tracking with timestamps
- Graceful handling of concurrent updates

### 8. ScopeDiscoveryDetector
Identifies newly discovered work during implementation by analyzing:
- Task dependency relationships
- `discovered-from` metadata in Beads
- Cross-repository impacts
- Timeline and critical path effects

## Data Flow

### Query Status Flow

```
query_status request
  → Resolve external reference (GitHub #123 → Beads epics)
  → For each epic:
      → Get dependency tree from Beads
      → Calculate metrics (completed/blocked/in-progress)
  → Aggregate across all epics
  → Return unified status
```

### Sync Progress Flow

```
sync_progress request
  → Resolve external reference
  → For each epic:
      → Query current status from Beads
      → Generate Mermaid diagram
  → Aggregate progress metrics
  → Update issue/story description or comment
  → Post narrative comment (optional)
```

### Decompose Flow

```
decompose request
  → Parse issue/story body for task lists
  → Group tasks by repository prefix [repo-name]
  → For each repository:
      → Create Beads epic
      → Create child tasks
      → Preserve completion status
  → Post confirmation comment
```

## Backend Integration

### GitHub Integration

Uses GitHub's REST API v3 and GraphQL API v4 via `gh` CLI:

- **Issues**: Read/update issue body, create comments
- **Projects v2**: Link issues to project items (optional)
- **Authentication**: OAuth via `gh auth login`
- **Rate Limits**: 5000 requests/hour for authenticated users

### Shortcut Integration

Uses Shortcut's REST API v3:

- **Stories**: Read/update story description, create comments
- **Workflows**: Map Beads status to Shortcut workflow states
- **Authentication**: API token via OAuth device flow
- **Rate Limits**: 200 requests/minute for standard accounts

### Beads Integration

Uses local `bd` CLI commands:

- `bd show --json` - Get epic/task details
- `bd dep tree` - Get dependency graph
- `bd create` - Create epics and tasks
- `bd status` - Update task status
- No network calls, all data in git repositories

## External Reference Storage

Each Beads epic or story stores its upstream linkage via the `external_ref` field, e.g. `github:owner/repo#123` or `shortcut:90123`. The ExternalRefResolver queries every configured repository for issues with matching references, so no additional mapping database is required. History tracking happens naturally through the `.beads/issues.jsonl` file managed by Beads.

## Scheduling System (Optional)

Optional background sync via cron-like scheduling:

```yaml
sync:
  schedule:
    enabled: true
    cronExpression: "0 */2 * * *"  # Every 2 hours
    workHours:
      enabled: true
      timezone: "America/Los_Angeles"
      startHour: 9
      endHour: 18
      workHourInterval: 30      # 30 min during work hours
      offHoursInterval: 240     # 4 hours off-hours
```

Runs in background as systemd service (Linux) or launchd agent (macOS).

## Performance Characteristics

- **Query status**: ~500ms per epic (with local Beads caching)
- **Generate diagram**: ~1-2s for 50 nodes
- **Detect discoveries**: ~300ms per epic
- **Sync operations**: Parallelized across epics (3 concurrent max)
- **Mapping lookup**: ~10ms (in-memory cache)

## Security Model

### Credential Storage

- Location: `~/.config/beads-bridge/credentials.json`
- Encryption: AES-256-GCM with machine-specific key
- Key derivation: PBKDF2 from machine ID + username
- OAuth tokens: Refreshable via `beads-bridge auth` commands

### Access Control

- GitHub: Requires `repo` scope for private repositories
- Shortcut: Requires `write` permission on stories
- Beads: Requires filesystem read/write access to repositories
- No privilege escalation (runs with user permissions)

### Data Privacy

- Mapping data stored in project git repositories (not secrets)
- No telemetry or external network calls (except backend APIs)
- Credentials never logged or transmitted unencrypted
- Local-only caching of Beads data

## Extension Points

### Custom Backends

Implement `Backend` interface to support additional project management tools:

```typescript
interface Backend {
  getIssue(id: string): Promise<Issue>;
  updateIssue(id: string, updates: IssueUpdate): Promise<void>;
  createComment(id: string, body: string): Promise<void>;
}
```

### Custom Synthesizers

Extend `ProgressSynthesizer` to customize metrics calculation:

```typescript
class CustomSynthesizer extends ProgressSynthesizer {
  calculateVelocity(history: TaskHistory[]): number {
    // Custom velocity calculation
  }
}
```

### Custom Diagram Formats

Extend `DiagramGenerator` to support formats beyond Mermaid:

```typescript
interface DiagramGenerator {
  generate(tree: DependencyTree): string;
  format(): string; // 'mermaid' | 'dot' | 'plantuml'
}
```
