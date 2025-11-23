---
name: "beads-bridge"
description: "Use when tracking Beads epic status, syncing progress to GitHub/Shortcut, generating dependency diagrams, or monitoring multi-repo work. Bridges Beads issue tracking with project management tools."
version: "1.6.0"
author: "David Laing"
category: ["Development", "Project Management"]
tags: ["beads", "github", "shortcut", "project-management", "issue-tracking", "multi-repo", "progress-tracking"]
required_permissions:
  - "bash"
---

## Skill Overview

This skill bridges Beads (git-backed multi-repository issue tracker) with project management tools like GitHub Projects v2 and Shortcut. It enables teams working across multiple repositories to maintain a unified view of work while preserving detailed technical tracking in Beads.

**How Claude Uses This Skill:**

1. **Check if beads-bridge is installed:** Run `beads-bridge --version`
2. **If not found:** Show helpful error message directing user to installation instructions
3. **Execute commands:** Use `beads-bridge <command> <args>` via Bash tool
4. **Parse output:** Commands return JSON that can be presented to the user

**IMPORTANT:**
- The `beads-bridge` CLI must be installed and available in PATH
- Always run commands from the project root so the CLI can find `.beads-bridge/config.json`
- If `beads-bridge` command not found, instruct user to install it (see Installation section below)

### Key Capabilities

Works with both **GitHub Issues/Projects** and **Shortcut Stories**:

1. **Query Status** - Get aggregated progress across issues/stories and Beads epics
2. **Sync Progress** - Post progress updates from Beads to GitHub/Shortcut
3. **Generate Diagrams** - Create Mermaid dependency visualizations
4. **Detect Discoveries** - Identify newly discovered work during implementation
5. **Manage Mappings** - Create/query links between issues/stories and Beads epics
6. **Interactive Visualization** - Serve interactive web dashboard for beads exploration
7. **Decompose** - Convert issue/story task lists into Beads epics and tasks
8. **Force Sync** - Immediate synchronization of multiple operations

### Use Cases

- **Tech Leads**: Monitor progress across 5+ repositories from a single GitHub Projects board
- **Product Managers**: Get accurate completion estimates based on actual dependency analysis
- **Engineering Teams**: Automatically propagate discovered work to project tracking
- **Stakeholders**: View real-time progress with auto-updating diagrams and metrics

## Installation

If `beads-bridge` is not found in PATH, provide this message to the user:

```
The beads-bridge CLI is not installed. Please install it first:

# Download and install the latest release:
curl -fsSL https://raw.githubusercontent.com/wellmaintained/skills/main/src/beads-bridge/scripts/install-beads-bridge.sh | bash

# Or install as Claude Code plugin (will install CLI automatically):
claude-code plugin install wellmaintained/skills/beads-bridge

After installation, beads-bridge should be available in your PATH.
```

## Command Usage

### Before Running Commands

Always verify beads-bridge is available:

```bash
beads-bridge --version
```

If this fails, show the installation message above and stop.

### GitHub Commands

All commands should be run from the project root directory:

```bash
# Get status for a GitHub issue
beads-bridge status --repository owner/repo --issue 123

# Sync progress to GitHub
beads-bridge sync --repository owner/repo --issue 123

# Generate dependency diagram
beads-bridge diagram --repository owner/repo --issue 123

# Detect new discoveries
beads-bridge discover --repository owner/repo --issue 123

# Create mapping between GitHub issue and Beads epics
beads-bridge mapping create -r owner/repo -i 123 -e '[{"repository":"repo-name","epicId":"epic-id","repositoryPath":"/path/to/repo"}]'

# Query existing mapping
beads-bridge mapping query -r owner/repo -i 123

# Decompose GitHub issue task list into Beads epics
beads-bridge decompose --repository owner/repo --issue 123

# Force sync multiple operations
beads-bridge force-sync --repository owner/repo --issue 123 --operations progress,diagram,discovery
```

### Shortcut Commands

```bash
# Get status for a Shortcut story
beads-bridge shortcut-status --story 89216

# Sync progress to Shortcut
beads-bridge shortcut-sync --story 89216

# Create mapping between Shortcut story and Beads epics
beads-bridge shortcut-mapping create -s 89216 -e '[{"repository":"repo-name","epicId":"epic-id","repositoryPath":"/path/to/repo"}]'

# Query existing mapping
beads-bridge shortcut-mapping query -s 89216

# Decompose Shortcut story task list into Beads epics
beads-bridge shortcut-decompose --story 89216
```

### Interactive Visualization

```bash
# Serve interactive web dashboard for a bead
beads-bridge serve <bead-id>

# Example:
beads-bridge serve wms-123
```

This starts a local web server (typically at http://localhost:3000) showing:
- Interactive dependency graph
- Task status and progress
- Real-time updates via SSE
- Drag-and-drop canvas for exploring relationships

## Capability Implementation

When user requests a beads-bridge operation, use the corresponding CLI command:

### 1. Query Status

```bash
# For GitHub
beads-bridge status --repository owner/repo --issue 123 [--include-blockers]

# For Shortcut
beads-bridge shortcut-status --story 89216 [--include-blockers]
```

Parse the JSON output and present key information to the user:
- Overall completion percentage
- Number of tasks completed/remaining
- Epic status breakdown
- Blockers (if requested)

### 2. Sync Progress

```bash
# For GitHub
beads-bridge sync --repository owner/repo --issue 123

# For Shortcut
beads-bridge shortcut-sync --story 89216
```

Confirm to user that progress was synced successfully.

### 3. Generate Diagrams

```bash
# For GitHub
beads-bridge diagram --repository owner/repo --issue 123 [--placement comment|description]

# For Shortcut
beads-bridge shortcut-diagram --story 89216 [--placement comment|description]
```

Inform user where the diagram was posted (comment or description).

### 4. Detect Discoveries

```bash
beads-bridge discover --repository owner/repo --issue 123
```

Present any newly discovered work to the user, including:
- New tasks/epics found
- Discovered dependencies
- Scope changes

### 5. Manage Mappings

**Create mapping:**
```bash
beads-bridge mapping create -r owner/repo -i 123 -e '[
  {"repository":"frontend","epicId":"fe-e42","repositoryPath":"/path/to/frontend"},
  {"repository":"backend","epicId":"be-e15","repositoryPath":"/path/to/backend"}
]'
```

**Query mapping:**
```bash
beads-bridge mapping query -r owner/repo -i 123
```

### 6. Interactive Visualization

```bash
beads-bridge serve wms-123
```

Inform user that the server is starting and provide the URL to access the visualization.

### 7. Decompose

```bash
# For GitHub
beads-bridge decompose --repository owner/repo --issue 123

# For Shortcut
beads-bridge shortcut-decompose --story 89216
```

Confirm that task lists were decomposed into Beads epics and tasks.

### 8. Force Sync

```bash
beads-bridge force-sync --repository owner/repo --issue 123 --operations progress,diagram,discovery
```

Confirm all requested operations completed successfully.

## Error Handling

If `beads-bridge` command fails:

1. **Command not found**: Show installation instructions (see Installation section)
2. **Config file missing**: User needs to create `.beads-bridge/config.json` in project root
3. **Authentication errors**: User needs to run `beads-bridge auth` for GitHub/Shortcut
4. **Invalid arguments**: Check command syntax in this SKILL.md

Always provide helpful guidance based on the error message from the CLI.

## Best Practices

### For Product Managers

1. **Create mappings early** - Link GitHub Issues to Beads epics at initiative start
2. **Review discoveries weekly** - Check `discover` output during standups
3. **Use interactive visualization** - Run `beads-bridge serve` for visual progress tracking

### For Tech Leads

1. **Keep diagrams current** - Run `diagram` after major scope changes
2. **Track blockers actively** - Use `status --include-blockers`
3. **Verify cross-repo deps** - Discovery detector flags missing coordination

### For Engineering Teams

1. **Use Beads for technical work** - Detailed tracking stays in repositories
2. **Let sync handle GitHub** - Don't manually update tracking issues
3. **Tag discoveries properly** - Beads issues with `discovered-from` relationships

## Troubleshooting

### CLI Not Found

```bash
# Check if beads-bridge is in PATH
which beads-bridge

# If not found, install it
curl -fsSL https://raw.githubusercontent.com/wellmaintained/skills/main/src/beads-bridge/scripts/install-beads-bridge.sh | bash
```

### Authentication Issues

```bash
# GitHub: Set up authentication
beads-bridge auth --backend github

# Shortcut: Set up authentication
beads-bridge auth --backend shortcut
```

### Config File Missing

Create `.beads-bridge/config.json` in your project root:

```json
{
  "repositories": {
    "repo-name": {
      "path": "/absolute/path/to/repository"
    }
  },
  "backend": "github",
  "githubRepository": "owner/repo"
}
```

See the beads-bridge documentation for complete configuration options.

## Output Format

All commands output JSON that can be parsed and presented to the user. Example:

```json
{
  "completionPercentage": 65,
  "totalTasks": 23,
  "completedTasks": 15,
  "epics": [
    {
      "id": "frontend-e42",
      "repository": "frontend",
      "status": "in_progress",
      "completion": 80
    }
  ]
}
```

Parse this JSON and present key information in a user-friendly format.

## Related Documentation

For detailed information:
- **Installation**: See src/beads-bridge/README.md
- **CLI Reference**: See src/beads-bridge/docs/CLI_REFERENCE.md
- **Configuration**: See src/beads-bridge/docs/CONFIGURATION.md
- **Troubleshooting**: See src/beads-bridge/docs/TROUBLESHOOTING.md
