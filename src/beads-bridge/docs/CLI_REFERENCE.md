# CLI Reference

Complete command-line interface reference for beads-bridge.

## Unified Commands

### Sync

Sync a bead to its external system (GitHub/Shortcut) using the bead's `external_ref`:

```bash
# Sync a bead by ID
beads-bridge sync <bead-id>

# Example: Sync epic with external_ref set
beads-bridge sync wms-123

# Dry run to see what would be synced
beads-bridge sync wms-123 --dry-run
```

The sync command automatically:
- Reads the bead's `external_ref` field
- Detects the backend (GitHub or Shortcut)
- Generates a Mermaid dependency diagram
- Posts updates to the linked issue/story

### Decompose

Decompose an external issue (GitHub or Shortcut) into Beads epics and tasks:

```bash
# Decompose using URL
beads-bridge decompose https://github.com/owner/repo/issues/123

# Decompose using shorthand format
beads-bridge decompose github:owner/repo#123
beads-bridge decompose shortcut:12345

# Decompose without posting confirmation comment
beads-bridge decompose github:owner/repo#123 --no-comment

# Decompose with custom priority for created beads
beads-bridge decompose github:owner/repo#123 --priority 1
```

The decompose command automatically:
- Detects the backend from the reference format
- Creates an epic with `external_ref` set
- Creates child tasks from the issue/story body

## Global Options

- `-c, --config <path>` - Path to config file (default: `config.yaml`)
- `-h, --help` - Show help for any command
- `-V, --version` - Show CLI version

## Output Format

All commands return JSON:

**Success:**
```json
{
  "success": true,
  "data": { /* capability-specific data */ }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

Exit codes: `0` for success, `1` for failure.

## Error Codes

- `VALIDATION_ERROR` - Invalid input parameters
- `NOT_FOUND` - External reference or resource doesn't exist
- `EXECUTION_ERROR` - Operation failed during execution
- `AUTHENTICATION_ERROR` - Not authenticated with backend (run `beads-bridge auth`)
- `RATE_LIMIT_ERROR` - API rate limit exceeded
