# Troubleshooting Guide

Common issues and solutions for beads-bridge.

## Mapping Issues

### "No mapping found for repository#issue"

**Problem**: You're trying to query status or sync progress, but no mapping exists linking the GitHub issue/Shortcut story to Beads epics.

**Solution**: Create a mapping first:

```bash
# GitHub
beads-bridge mapping create \
  --repository owner/repo \
  --issue 123 \
  --epics '[{"repository":"frontend","epicId":"frontend-e99","repositoryPath":"../frontend"}]'

# Shortcut
beads-bridge shortcut-mapping create \
  --story 89216 \
  --epics '[{"repository":"pensive","epicId":"pensive-8e2d","repositoryPath":"/path/to/repo"}]'
```

### Mapping not persisting

**Problem**: Mappings created but disappear after CLI restart.

**Possible causes**:
1. `.beads-bridge/mappings/` directory not in git
2. Config file `repositoryPath` is incorrect
3. Permission issues writing to mappings directory

**Solution**:
```bash
# Verify mappings directory exists and is writable
ls -la .beads-bridge/mappings/
# Should show github/ or shortcut/ subdirectories

# Check config has correct paths
cat .beads-bridge/config.json

# Ensure mappings are tracked in git
git add .beads-bridge/mappings/
git commit -m "Add beads-bridge mappings"
```

## Repository Access

### "Permission denied when accessing repository"

**Problem**: CLI cannot read Beads data from configured repositories.

**Solutions**:

1. **Verify repository paths in config are correct**:
```bash
cat .beads-bridge/config.json
# Check "repositories" array has valid absolute paths
```

2. **Ensure you have read access**:
```bash
ls /absolute/path/to/repository/.beads/
# Should list Beads tracking directory
```

3. **Verify bd CLI is installed**:
```bash
which bd
bd --version
# Should be >= v0.21.3
```

4. **Check Beads is initialized**:
```bash
cd /path/to/repository
bd status
# Should show Beads is tracking the repository
```

## GitHub Integration

### Diagrams not updating

**Problem**: Generated diagrams don't appear in GitHub issues or comments.

**Solutions**:

1. **Check GitHub token permissions**:
```bash
gh auth status
# Should show "Logged in to github.com as <username>"
# Required scopes: repo (for private repos), public_repo (for public repos)

# Refresh auth if needed
gh auth refresh -s repo
```

2. **Verify issue exists and is accessible**:
```bash
gh issue view 123 --repo owner/repo
# Should display issue details
```

3. **Check network connectivity**:
```bash
gh api /user
# Should return your GitHub user info
```

4. **Review CLI output for errors**:
```bash
beads-bridge diagram --repository owner/repo --issue 123 --verbose
# Look for error messages about API failures
```

### Progress updates missing diagrams

**Problem**: Progress comments appear but don't include Mermaid diagrams.

**Root causes**:

1. **MermaidGenerator not wired in ProgressSynthesizer**:
   - Check `skill.ts` constructor passes `MermaidGenerator` to `ProgressSynthesizer`
   - Verify `updateIssueProgress()` receives `includeDiagram: true` parameter

2. **bd command not generating valid Mermaid**:
```bash
# Test diagram generation manually
cd /path/to/repository
bd dep tree --format mermaid --reverse <epic-id>
# Should output valid Mermaid syntax starting with "graph TD"
```

3. **Epic has no tasks**:
   - Empty epics or epics without dependency trees produce no diagram
   - Verify epic has at least one task: `bd show <epic-id>`

4. **Generation errors being silently caught**:
   - Check console output for diagram generation warnings
   - Enable debug logging: set `logging.level: "debug"` in config

**Expected behavior**: If diagram generation fails, progress update still posts with metrics only (graceful degradation).

## Shortcut Integration

### Authentication failures

**Problem**: `AUTHENTICATION_ERROR` when running Shortcut commands.

**Solution**:
```bash
# Re-authenticate
beads-bridge auth shortcut
# Enter your Shortcut API token when prompted

# Verify authentication
beads-bridge auth status
# Should show "Shortcut: Authenticated"
```

### Story description not updating

**Problem**: Sync succeeds but Shortcut story description doesn't show Yak Map.

**Possible causes**:
1. API token lacks write permissions
2. Story is archived or in invalid state
3. Rate limit exceeded

**Solution**:
```bash
# Verify token permissions via Shortcut web UI:
# Settings → API Tokens → Check token has "Write" access

# Check story status
beads-bridge shortcut-status --story 89216

# Retry with exponential backoff
beads-bridge sync --repository shortcut --issue 89216 --retry
```

## Metrics and Velocity

### Velocity metrics seem wrong

**Problem**: Progress percentages or completion estimates don't match reality.

**Verification steps**:

1. **Verify mapping includes all relevant epics**:
```bash
beads-bridge mapping get --repository owner/repo --issue 123
# Should list all epics that contribute to the initiative
```

2. **Check epic dependency trees are complete**:
```bash
cd /path/to/repository
bd dep tree <epic-id>
# Should show all tasks and their dependencies
```

3. **Ensure issue statuses are current in Beads**:
```bash
bd show <task-id>
# Verify status field matches actual state (open, in-progress, completed, blocked)
```

4. **Look for orphaned tasks** (tasks not linked to epics):
```bash
bd list --status all
# Compare against tasks shown in epic trees
```

## Discovery Detection

### New work not being detected

**Problem**: `detect_discoveries` returns empty results despite new tasks being added.

**Requirements**:
- Beads CLI version >= v0.21.3 (includes `dependency_type` field)
- Tasks must have `discovered-from` relationships

**Solution**:

1. **Verify Beads version**:
```bash
bd --version
# Must be >= v0.21.3
```

2. **Check tasks have discovery metadata**:
```bash
bd show <task-id> --json | jq '.discovered_from'
# Should show the task ID that triggered discovery
```

3. **Manually tag discovered tasks**:
```bash
bd dep add <new-task-id> --discovered-from <triggering-task-id>
```

## CLI Issues

### Command not found

**Problem**: `beads-bridge: command not found`

**Solution**:

1. **For local installation** (development):
```bash
cd /path/to/beads-bridge
npm install
npm run build
# Run via node
node dist/cli.js --version
```

2. **For global installation**:
```bash
npm install -g beads-bridge
# Verify PATH includes npm global bin
echo $PATH | grep npm
```

### JSON parsing errors

**Problem**: CLI returns invalid JSON or parsing errors.

**Causes**:
- stdout contaminated with debug logs
- Malformed JSON from bd CLI
- Unexpected error output mixed with JSON

**Solution**:
```bash
# Redirect stderr to separate file
beads-bridge status --repository owner/repo --issue 123 2>error.log

# Check error.log for underlying issues
cat error.log

# Validate JSON output
beads-bridge status --repository owner/repo --issue 123 | jq .
# Should parse cleanly, shows where JSON is malformed
```

## Performance Issues

### Slow query times

**Problem**: Status queries taking >5 seconds per epic.

**Optimization steps**:

1. **Enable local caching** (add to config):
```json
{
  "cache": {
    "enabled": true,
    "ttl": 300,
    "maxSize": 100
  }
}
```

2. **Reduce parallelism** if I/O bound:
```json
{
  "sync": {
    "maxConcurrency": 2
  }
}
```

3. **Optimize Beads repository**:
```bash
cd /path/to/repository
# Clean up old issue files
bd gc

# Rebuild indexes
bd reindex
```

## Beads Core Issues

### "Database out of sync with JSONL" error

**Problem**: `bd ready` or other commands fail with "Database out of sync with JSONL" even after running `bd sync --import-only`.

**Cause**: `bd` detects that `issues.jsonl` has a newer timestamp than the last import in the database, but `bd sync` skips updating the database metadata because the file content (hashes) hasn't changed. This leaves the database thinking it's stale.

**Solution**:
Force a metadata update by re-importing with the `--force` flag:
```bash
bd import -i .beads/issues.jsonl --force
```

## Getting Help

If none of these solutions work:

1. **Enable debug logging**:
```json
{
  "logging": {
    "level": "debug",
    "file": "/tmp/beads-bridge-debug.log"
  }
}
```

2. **Capture full command output**:
```bash
beads-bridge status --repository owner/repo --issue 123 --verbose &> debug.txt
```

3. **Check system requirements**:
```bash
node --version    # Should be >= 18.0.0
bd --version      # Should be >= v0.21.3
gh --version      # Should be >= 2.0.0 (if using GitHub)
```

4. **File an issue** with:
   - Full command that failed
   - Debug log output
   - Config file (redact sensitive paths)
   - beads-bridge version: `beads-bridge --version`
