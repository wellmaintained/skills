## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Auto-syncs to JSONL for version control
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**
```bash
bd ready --json
```

**Create new issues:**
```bash
bd create "Issue title" -t bug|feature|task -p 0-4 --json
bd create "Issue title" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**
```bash
bd update bd-42 --status in_progress --json
bd update bd-42 --priority 1 --json
```

**Complete work:**
```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task**: `bd update <id> --status in_progress`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`
6. **Commit together**: Always commit the `.beads/issues.jsonl` file together with the code changes so issue state stays in sync with code state

### Auto-Sync

bd automatically syncs with git:
- Exports to `.beads/issues.jsonl` after changes (5s debounce)
- Imports from JSONL when newer (e.g., after `git pull`)
- No manual export/import needed!

**Known harmless warning:**
You may see warnings like:
```
⚠️  WARNING: JSONL file hash mismatch detected (bd-160)
  This indicates JSONL and export_hashes are out of sync.
  Clearing export_hashes to force full re-export.
```

This is **expected behavior and can be safely ignored**. It appears when:
- JSONL changes via import/sync from git
- Next operation triggers export validation
- The `export_hashes` table feature is deprecated (intentionally unused since bd v0.19.0)
- The warning is cosmetic - bd auto-recovers by doing a full export to be safe
- Your data is protected; no action needed

### Troubleshooting Staleness Errors

If you see "Database out of sync with JSONL" errors even after running `bd sync --import-only`:

**Root cause:** The staleness check compares `issues.jsonl` mtime against `metadata.last_import_time`. When content hasn't changed, `bd import` skips DB writes as an optimization, which means `last_import_time` doesn't get updated even though the file's mtime may have changed.

**Fix:**
```bash
bd import -i .beads/issues.jsonl --force
```

The `--force` flag forces the metadata update even when content is unchanged.

**Other troubleshooting steps:**
```bash
# Check for configuration issues
bd doctor

# Auto-fix detected issues (interactive)
echo "Y" | bd doctor --fix

# Verify metadata matches actual files
cat .beads/metadata.json
```

### Git Worktrees and Multi-Agent Configuration

**IMPORTANT**: This project is configured for git worktrees and multiple concurrent agents using a shared database approach.

**Why a shared database:**
- Each worktree previously had its own isolated `.beads/beads.db`
- This caused constant import/export cycles and hash mismatch errors
- Now all worktrees use the main repo's `.beads/beads.db`
- This eliminates staleness errors and provides real-time visibility

**How it works:**
- Main repo has the single source-of-truth database: `.beads/beads.db`
- Each worktree's `.beads/config.yaml` points to the shared database
- Actor tracking (`actor: <worktree-name>`) identifies which worktree made changes
- SQLite WAL mode handles concurrent access safely
- Worktree config changes are git-ignored via `.git/info/exclude`

**Why daemon is disabled:**
- Git worktrees share the same `.git` directory
- The daemon cannot track which branch each worktree has checked out
- This could cause commits to go to the wrong branch
- Daemon is disabled repo-wide in `.beads/config.yaml` (`no-daemon: true`)

**Setting up beads in new worktrees:**

The project includes a setup script to properly initialize beads for worktree usage:

```bash
./scripts/setup-beads-worktree.sh
```

This script:
1. Creates symlink: node_modules/.bin/bd → scripts/bd (optional logging wrapper)
2. Detects if running in worktree or main repo
3. For worktrees:
   - Configures `.beads/config.yaml` to use shared database from main repo
   - Sets `actor: <worktree-name>` for audit trail
   - Adds `config.yaml` to `.git/info/exclude` to prevent commits
4. For main repo:
   - Initializes the beads database with the correct issue prefix
5. Installs git hooks (main repo only; worktrees inherit)
6. Syncs issues from git
7. Displays the configuration and ready work

**Verify configuration:**
- In worktree: `cat .beads/config.yaml` should show `db:` pointing to main repo
- In worktree: `git status` should not show `.beads/config.yaml` as modified
- `bd ready` should show available work with no staleness errors

**Benefits:**
- No more staleness errors or `--allow-stale` workarounds
- Real-time visibility across all worktrees
- Simpler mental model - one source of truth
- Works with all agents (codex, claude-code, opencode, cursor-agent)

### GitHub Copilot Integration

If using GitHub Copilot, it will automatically load instructions from `.github/copilot-instructions.md`.
For projects that USE bd (rather than develop bd itself), reference this AGENTS.md file from your copilot instructions instead of using the template from `bd onboard` (which is designed for bd developers).

### MCP Server (Recommended)

If using Claude or MCP-compatible clients, install the beads MCP server:

```bash
pip install beads-mcp
```

Add to MCP config (e.g., `~/.config/claude/config.json`):
```json
{
  "beads": {
    "command": "beads-mcp",
    "args": []
  }
}
```

Then use `mcp__beads__*` functions instead of CLI commands.

### Managing AI-Generated Planning Documents

AI assistants often create planning and design documents during development:
- PLAN.md, IMPLEMENTATION.md, ARCHITECTURE.md
- DESIGN.md, CODEBASE_SUMMARY.md, INTEGRATION_PLAN.md
- TESTING_GUIDE.md, TECHNICAL_DESIGN.md, and similar files

**Best Practice: Use a dedicated directory for these ephemeral files**

**Recommended approach:**
- Create a `history/` directory in the project root
- Store ALL AI-generated planning/design docs in `history/`
- Keep the repository root clean and focused on permanent project files
- Only access `history/` when explicitly asked to review past planning

**Example .gitignore entry (optional):**
```
# AI planning documents (ephemeral)
history/
```

**Benefits:**
- Clean repository root
- Clear separation between ephemeral and permanent documentation
- Easy to exclude from version control if desired
- Preserves planning history for archeological research
- Reduces noise when browsing the project

### Important Rules

- Use bd for ALL task tracking
- Always use `--json` flag for programmatic use
- Link discovered work with `discovered-from` dependencies
- Check `bd ready` before asking "what should I work on?"
- Store AI planning docs in `history/` directory
- Do NOT create markdown TODO lists
- Do NOT use external issue trackers
- Do NOT duplicate tracking systems
- Do NOT clutter repo root with planning documents

For more details, see README.md and QUICKSTART.md.
