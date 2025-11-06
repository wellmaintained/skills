# Configuration Guide

## Overview

Beads-bridge v2.0 uses two separate configuration systems:

1. **Project Configuration** (`.beads-bridge/config.yaml`) - Project settings, repositories, sync schedules
2. **Authentication Credentials** (`~/.config/beads-bridge/credentials.json`) - API tokens, encrypted

This separation keeps sensitive credentials out of project files.

## Configuration File Location

Default: `.beads-bridge/config.yaml` in your project root

Override with environment variable:
```bash
export BEADS_PM_SYNC_CONFIG=/path/to/config.yaml
```

## Configuration Schema (v2.0)

### Minimal Configuration

```yaml
version: "2.0"
backend: github  # or 'shortcut'

github:
  repository: owner/repo
  projectId: PVT_kwDOAbc123  # Optional: GitHub Projects v2 ID

repositories:
  - name: my-project
    path: /absolute/path/to/repo
    prefix: myproject  # For issue IDs like myproject-e123
    enabled: true

mappingStoragePath: .beads-bridge
sync:
  enabled: true
notifications:
  enabled: true
logging:
  level: info
```

### Backend-Specific Configuration

#### GitHub Backend

```yaml
github:
  repository: owner/repo
  projectId: PVT_kwDOAbc123  # Projects v2 ID

  customFields:
    completionField: Completion
    statusField: Status
    blockersField: Blockers

  rateLimit:
    maxRequestsPerHour: 5000
    autoRetry: true
```

#### Shortcut Backend

```yaml
backend: shortcut

shortcut:
  workspace: my-workspace
  projectId: 12345  # Optional
  defaultWorkflowState: Unstarted

  customFields:
    completionField: completion_percentage
    statusField: current_status
```

### Authentication

Authentication is managed separately. See [AUTHENTICATION.md](./AUTHENTICATION.md).

**Setup:**
```bash
# GitHub (OAuth)
beads-bridge auth github

# Shortcut (API token)
beads-bridge auth shortcut

# Check status
beads-bridge auth status
```

### Diagrams

```yaml
diagrams:
  enabled: true
  maxNodes: 50
  includeLegend: true

  updateStrategy:
    onScopeChange: true
    weekly: true
    onManualCommand: true

  placement:
    updateDescription: true   # Update issue description
    createSnapshots: true     # Create snapshot comments
```

## Migration from v1.0

**Automatic:** When you upgrade to v2.0, the config will auto-migrate on first run.

**Changes:**
- `version` updated from `1.0` to `2.0`
- `github.cliPath` removed (SDK clients don't need it)
- Authentication moved to separate credential store

**No action required** - your existing config will be preserved and upgraded automatically.

## Environment Variables

Override config values with environment variables:

```bash
export BEADS_PM_SYNC_CONFIG=/path/to/config.yaml
export BEADS_PM_SYNC_GITHUB_REPO=owner/repo
export BEADS_PM_SYNC_GITHUB_PROJECT_ID=PVT_kwDOAbc123
export BEADS_PM_SYNC_STORAGE_PATH=/custom/path
export BEADS_PM_SYNC_LOG_LEVEL=debug
```

## Validation

Config is validated on load. Common errors:

- **Missing required fields:** `github.repository` is required
- **Invalid backend:** Must be 'github' or 'shortcut'
- **Invalid log level:** Must be 'error', 'warn', 'info', or 'debug'
- **Invalid paths:** Repository paths must be absolute

## Troubleshooting

**Config not found:**
```bash
# Create default config
beads-bridge init

# Specify custom location
export BEADS_PM_SYNC_CONFIG=/path/to/config.yaml
```

**Authentication errors:**
```bash
# Check auth status
beads-bridge auth status

# Re-authenticate
beads-bridge auth github
```

**Config validation errors:**
Check logs at `logs/beads-bridge.log` for detailed error messages.
