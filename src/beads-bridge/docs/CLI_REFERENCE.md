# CLI Reference

Complete command-line interface reference for beads-bridge.

## GitHub Commands

### Status Query

```bash
# Query status
beads-bridge status --repository owner/repo --issue 123

# Query status with blockers
beads-bridge status --repository owner/repo --issue 123 --blockers
```

### Sync Progress

```bash
# Sync progress updates
beads-bridge sync --repository owner/repo --issue 123
```

### Generate Diagrams

```bash
# Generate diagram (in comment)
beads-bridge diagram --repository owner/repo --issue 123

# Generate diagram (in description)
beads-bridge diagram --repository owner/repo --issue 123 --placement description
```

### Detect Discoveries

```bash
# Detect scope discoveries
beads-bridge discoveries --repository owner/repo --issue 123
```


### Decompose Issues

```bash
# Decompose GitHub issue into Beads epics and tasks
beads-bridge decompose --repository owner/repo --issue 789

# Decompose without posting confirmation comment
beads-bridge decompose --repository owner/repo --issue 789 --no-comment

# Decompose with custom priority for created beads
beads-bridge decompose --repository owner/repo --issue 789 --priority 1

# Decompose and skip already completed tasks
beads-bridge decompose --repository owner/repo --issue 789 --skip-completed
```

## Shortcut Commands

### Status Query

```bash
# Query status for Shortcut story
beads-bridge shortcut-status --story 89216

# Query status with blockers
beads-bridge shortcut-status --story 89216 --blockers
```

### Decompose Stories

```bash
# Decompose Shortcut story into Beads epics and tasks
beads-bridge shortcut-decompose --story 89216

# Decompose without posting confirmation comment
beads-bridge shortcut-decompose --story 89216 --no-comment

# Decompose with custom priority for created beads
beads-bridge shortcut-decompose --story 89216 --priority 1
```

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
