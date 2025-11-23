# Shortcut Backend for Beads Integration

This document describes how to use the Shortcut backend with the Beads-GitHub integration skill.

## Overview

The Shortcut backend enables bidirectional synchronization between Beads (git-backed multi-repository issue tracker) and [Shortcut.com](https://shortcut.com) (formerly Clubhouse). This allows teams using Shortcut for project management to maintain unified project tracking while preserving detailed technical implementation tracking in Beads.

## Features

- ✅ Create and update Shortcut stories from Beads epics
- ✅ Sync story status, owners, and labels
- ✅ Add progress comments with Mermaid diagrams
- ✅ Link stories with relationship types (blocks, relates to)
- ✅ Search stories by project, owner, state, and labels
- ✅ Map Shortcut workflow states to generic open/closed states
- ⚠️  **Note**: Shortcut doesn't support sub-issues natively (uses story links instead)

## Prerequisites

### 1. Install shortcut-cli

The Shortcut backend uses the [shortcut-cli](https://github.com/shortcut-cli/shortcut-cli) tool to interact with the Shortcut API.

**Installation:**

```bash
# macOS (Homebrew)
brew install shortcut-cli/homebrew-shortcut-cli/shortcut-cli

# Or install from source
go install github.com/shortcut-cli/shortcut-cli/cmd/short@latest
```

**Verify installation:**

```bash
short --version
```

### 2. Authenticate with Shortcut

```bash
short install
```

This will prompt you for your Shortcut API token. You can generate a token at:
https://app.shortcut.com/settings/account/api-tokens

The token will be stored in `~/.shortcut/config.yml` and used automatically by the backend.

**Verify authentication:**

```bash
short workflows
```

This should list your workspace's workflow states.

## Configuration

Update your `config.yaml` to use the Shortcut backend:

```yaml
# Shortcut configuration
backend: shortcut  # Use 'github' for GitHub Projects v2

shortcut:
  # Default project name for new stories
  defaultProject: "Product Initiatives"

  # Default workflow state for new stories
  defaultState: "Ready for Development"

  # Default story type (feature, bug, chore)
  defaultType: feature

  # Timeout for CLI commands (milliseconds)
  timeout: 30000

# Beads repositories
repositories:
  - name: "frontend"
    path: "../frontend"
    prefix: "frontend"

  - name: "backend"
    path: "../backend"
    prefix: "backend"

# Mapping storage
mappingStoragePath: ".beads-bridge"

# Diagram settings
diagrams:
  placement:
    updateDescription: false  # Shortcut doesn't support updating story descriptions easily
    createSnapshots: true     # Post diagrams as comments instead
```

## Usage

### Create Mapping Between Shortcut Story and Beads Epics

```bash
beads-bridge mapping create \
  --backend shortcut \
  --story 12345 \
  --epics '[
    {"repository":"frontend","epicId":"frontend-e99","repositoryPath":"../frontend"},
    {"repository":"backend","epicId":"backend-e42","repositoryPath":"../backend"}
  ]'
```

### Query Status

```bash
beads-bridge status \
  --backend shortcut \
  --story 12345 \
  --blockers
```

**Output:**
```json
{
  "totalTasks": 47,
  "completed": 28,
  "inProgress": 12,
  "blocked": 3,
  "open": 4,
  "completionPercentage": 59.6,
  "blockers": [
    {
      "id": "backend-t156",
      "title": "Database migration stuck",
      "repository": "backend"
    }
  ]
}
```

### Sync Progress to Shortcut

```bash
beads-bridge sync \
  --backend shortcut \
  --story 12345
```

This will post a comment to the Shortcut story with:
- Mermaid dependency diagram
- Progress metrics
- Recently completed tasks
- Current blockers
- Velocity trends (if available)

### Generate Standalone Diagram

```bash
beads-bridge diagram \
  --backend shortcut \
  --story 12345
```

### Detect Scope Discoveries

```bash
beads-bridge discoveries \
  --backend shortcut \
  --story 12345
```

### Decompose Shortcut Story into Beads Epics

```bash
# First, create a Shortcut story with a task list in the description:
#
# Tasks:
# - [ ] [frontend] Add login form
# - [ ] [frontend] OAuth callback
# - [ ] [backend] Auth endpoints
# - [ ] [backend] JWT generation

beads-bridge decompose \
  --backend shortcut \
  --story 12345
```

This will:
1. Parse the story description for task lists
2. Create Beads epics per repository
3. Create Beads tasks under each epic
4. Store the mapping
5. Post a confirmation comment to the Shortcut story

## Shortcut-Specific Features

### Workflow State Mapping

Shortcut workflow states are customizable per workspace. The backend maps them to generic states:

| Shortcut State Type | Generic State |
|---------------------|---------------|
| `unstarted`        | `open`        |
| `started`          | `open`        |
| `done`             | `closed`      |

### Story Types

Shortcut supports three story types:
- **feature** - New functionality
- **bug** - Bug fixes
- **chore** - Maintenance work

Set the default type in config or specify per-story:

```typescript
backend.createIssue({
  title: "Fix login bug",
  body: "Users cannot login",
  metadata: {
    type: "bug",
    state: "In Progress"
  }
});
```

### Story Links

Shortcut has native support for story relationships:

| Our Link Type | Shortcut Verb |
|---------------|---------------|
| `blocks`      | `blocks`      |
| `parent-child`| `relates to`  |
| `related`     | `relates to`  |

Example:
```typescript
// Story 123 blocks story 456
backend.linkIssues("123", "456", LinkType.BLOCKS);
```

### Search Capabilities

The Shortcut backend supports rich search:

```typescript
backend.searchIssues({
  text: "authentication",        // Search in title/description
  state: "open",                  // Filter by state
  labels: ["backend", "urgent"],  // Filter by labels (AND)
  assignee: "alice",              // Filter by owner
  projectId: "Product Work",      // Filter by project
});
```

## Programmatic Usage

### TypeScript/JavaScript

```typescript
import { ShortcutBackend } from '@acme/beads-bridge';

// Initialize backend
const backend = new ShortcutBackend({
  defaultProject: "Product Work",
  defaultState: "In Progress",
  defaultType: "feature",
  timeout: 30000
});

// Authenticate
await backend.authenticate();

// Create a story
const story = await backend.createIssue({
  title: "Implement OAuth",
  body: "Add OAuth2 authentication flow",
  assignees: ["alice", "bob"],
  labels: ["backend", "security"],
  metadata: {
    project: "Product Work",
    type: "feature",
    state: "Ready for Development"
  }
});

console.log(`Created story: ${story.url}`);
// Output: Created story: https://app.shortcut.com/acme/story/12345

// Add a progress comment
await backend.addComment(
  story.id,
  "✅ Completed OAuth callback implementation"
);

// Update story state
await backend.updateIssue(story.id, {
  state: "closed"  // Maps to "Done" workflow state
});

// Search for stories
const bugs = await backend.searchIssues({
  labels: ["bug"],
  state: "open",
  projectId: "Product Work"
});

console.log(`Found ${bugs.length} open bugs`);
```

## Configuration Options

### ShortcutBackendConfig

```typescript
interface ShortcutBackendConfig {
  /** Default project name */
  defaultProject?: string;

  /** Default workflow state for new stories */
  defaultState?: string;

  /** Default story type (feature, bug, chore) */
  defaultType?: 'feature' | 'bug' | 'chore';

  /** Timeout for CLI commands in milliseconds */
  timeout?: number;
}
```

**Default values:**
- `timeout`: 30000 (30 seconds)
- `defaultType`: "feature"
- `defaultState`: undefined (uses workspace default)
- `defaultProject`: undefined (required for creating stories)

**Authentication:**
Authentication is handled via `short install` which stores your API token in `~/.shortcut/config.yml`. The backend reads from this configuration automatically.

## Troubleshooting

### "Not authenticated with Shortcut"

**Solution:**
```bash
# Run authentication
short install

# Verify
short workflows
```

The backend relies on `short install` to configure authentication. Ensure you've run this command and can successfully execute `short` CLI commands.

### "Command not found: short"

**Solution:**
```bash
# Install shortcut-cli
brew install shortcut-cli/homebrew-shortcut-cli/shortcut-cli

# Or via Go
go install github.com/shortcut-cli/shortcut-cli/cmd/short@latest

# Verify
short --version
```

### "Story not found: 123"

**Possible causes:**
- Story ID is incorrect
- Story belongs to different workspace
- You don't have access to the story

**Solution:**
```bash
# Verify story exists
short story 123

# Check your workspace
short search -q "story-title"
```

### "Rate limit exceeded"

Shortcut has API rate limits. The backend will throw a `RateLimitError` with retry-after information.

**Solution:**
Wait and retry, or reduce sync frequency in your configuration.

### Workflow state not found

If you specify a workflow state that doesn't exist in your workspace:

**Solution:**
```bash
# List available workflow states
short workflows

# Use an exact state name from the list
beads-bridge sync --story 123
```

## Differences from GitHub Backend

| Feature | GitHub | Shortcut |
|---------|--------|----------|
| Sub-issues | ✅ Native | ❌ Uses story links |
| Custom fields | ✅ Projects v2 | ⚠️  Limited support |
| Diagram placement | ✅ Description or comment | ⚠️  Comment only |
| Workflow states | Fixed (open/closed) | ✅ Customizable |
| Story types | N/A | ✅ Feature/bug/chore |
| Native linking | ❌ Comment-based | ✅ Story links |
| Projects | ✅ Projects v2 | ✅ Projects |

## Best Practices

### 1. Use Projects for Organization

Organize your stories into Shortcut projects that match your team structure:

```yaml
shortcut:
  defaultProject: "Backend Team Q1 2024"
```

### 2. Keep Workflow States Consistent

Define clear workflow states in your Shortcut workspace:
- **To Do** (unstarted)
- **In Progress** (started)
- **Code Review** (started)
- **Done** (done)

### 3. Use Labels for Categorization

Use labels to categorize work across different dimensions:
- **Type**: `backend`, `frontend`, `infrastructure`
- **Priority**: `urgent`, `normal`, `low`
- **Category**: `security`, `performance`, `ux`

### 4. Link Related Stories

Use story links to track dependencies:
```bash
# Story 123 blocks story 456
beads-bridge link \
  --backend shortcut \
  --from 123 \
  --to 456 \
  --type blocks
```

### 5. Regular Progress Updates

Set up automated sync during work hours:

```yaml
sync:
  schedule:
    enabled: true
    workHours:
      enabled: true
      startHour: 9
      endHour: 18
      workHourInterval: 30  # Every 30 minutes
```

## API Reference

See the main [Backend Interface Documentation](../src/types/backend.ts) for the full API contract that ShortcutBackend implements.

## Support

For issues specific to the Shortcut backend:
1. Check this documentation
2. Verify shortcut-cli is working: `short workflows`
3. Test authentication: `short search -q "test"`
4. Review logs with `--verbose` flag

For shortcut-cli issues:
- [shortcut-cli GitHub](https://github.com/shortcut-cli/shortcut-cli)
- [Shortcut API Documentation](https://shortcut.com/api)

## Examples

See the [examples/](../examples/) directory for complete working examples:
- `examples/shortcut-basic.ts` - Basic Shortcut operations
- `examples/shortcut-sync.ts` - Full sync workflow
- `examples/shortcut-decompose.ts` - Story decomposition

## License

MIT
