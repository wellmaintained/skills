# Shared Database for Git Worktrees Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate staleness errors in git worktrees by using a single shared database in the main repo instead of isolated per-worktree databases.

**Architecture:** Modify setup script to detect worktrees, configure `.beads/config.yaml` to point to main repo's database, and use `.git/info/exclude` to prevent config changes from being committed.

**Tech Stack:** Bash scripting, bd/beads configuration system, git worktrees

---

## Task 1: Update setup-beads-worktree.sh - Add Main Repo Detection

**Files:**
- Modify: `scripts/setup-beads-worktree.sh:16-87`

**Step 1: Add function to detect and find main repo path**

Add this function after line 16 (`set -e`):

```bash
# Detect if we're in a worktree and find the main repo path
# Returns: main repo path, or empty string if we're in main repo
find_main_repo() {
    if [ -f ".git" ]; then
        # We're in a worktree - .git is a file, not a directory
        # Parse the gitdir path from .git file
        # Format: gitdir: /path/to/main/.git/worktrees/<name>
        GITDIR=$(grep "gitdir:" .git | cut -d' ' -f2)

        # Remove /worktrees/<name> suffix to get main .git directory
        MAIN_GIT_DIR=$(echo "$GITDIR" | sed 's|/worktrees/[^/]*$||')

        # Get parent directory of .git to get main repo root
        MAIN_REPO=$(dirname "$MAIN_GIT_DIR")

        echo "$MAIN_REPO"
    else
        # We're in the main repo
        echo ""
    fi
}
```

**Step 2: Test the function works**

Add test code temporarily after the function:

```bash
MAIN_REPO=$(find_main_repo)
if [ -n "$MAIN_REPO" ]; then
    echo "DEBUG: Detected worktree, main repo at: $MAIN_REPO"
else
    echo "DEBUG: Running in main repo"
fi
```

**Step 3: Run script in main repo to verify detection**

Run: `./scripts/setup-beads-worktree.sh`
Expected output: `DEBUG: Running in main repo`

**Step 4: Test in a worktree (if available)**

If you have a vibe-kanban worktree:
Run: `cd /path/to/worktree && ./scripts/setup-beads-worktree.sh`
Expected: `DEBUG: Detected worktree, main repo at: /path/to/main/repo`

**Step 5: Commit the detection function**

```bash
git add scripts/setup-beads-worktree.sh
git commit -m "feat(worktrees): add main repo detection function"
```

---

## Task 2: Update config.yaml for Worktrees

**Files:**
- Modify: `scripts/setup-beads-worktree.sh:28-43`

**Step 1: Add function to configure shared database**

Add this function after the `find_main_repo()` function:

```bash
# Configure beads to use shared database from main repo
# Args: $1 = main repo path, $2 = worktree name
configure_shared_database() {
    local MAIN_REPO="$1"
    local WORKTREE_NAME="$2"
    local CONFIG_FILE=".beads/config.yaml"
    local SHARED_DB="$MAIN_REPO/.beads/beads.db"

    echo "   Configuring shared database..."

    # Backup existing config if it exists
    if [ -f "$CONFIG_FILE" ]; then
        cp "$CONFIG_FILE" "$CONFIG_FILE.backup"
    fi

    # Update or add db path in config.yaml
    # Use perl for in-place editing that works on both macOS and Linux
    if grep -q "^db:" "$CONFIG_FILE" 2>/dev/null; then
        # Update existing db line
        perl -i -pe "s|^db:.*|db: \"$SHARED_DB\"|" "$CONFIG_FILE"
    else
        # Append db line
        echo "" >> "$CONFIG_FILE"
        echo "# Shared database path (worktree configuration)" >> "$CONFIG_FILE"
        echo "db: \"$SHARED_DB\"" >> "$CONFIG_FILE"
    fi

    # Update or add actor in config.yaml
    if grep -q "^actor:" "$CONFIG_FILE" 2>/dev/null; then
        # Update existing actor line
        perl -i -pe "s|^actor:.*|actor: \"$WORKTREE_NAME\"|" "$CONFIG_FILE"
    else
        # Append actor line
        echo "" >> "$CONFIG_FILE"
        echo "# Actor name for audit trail (worktree identifier)" >> "$CONFIG_FILE"
        echo "actor: \"$WORKTREE_NAME\"" >> "$CONFIG_FILE"
    fi

    echo "   ✓ Configured db: $SHARED_DB"
    echo "   ✓ Configured actor: $WORKTREE_NAME"
}
```

**Step 2: Add function to configure git ignore**

Add this function after `configure_shared_database()`:

```bash
# Add config.yaml to .git/info/exclude to prevent commits
configure_git_exclude() {
    local EXCLUDE_FILE=".git/info/exclude"

    # Check if config.yaml is already in exclude
    if ! grep -q "^config\\.yaml$" "$EXCLUDE_FILE" 2>/dev/null; then
        echo "" >> "$EXCLUDE_FILE"
        echo "# Worktree-specific beads configuration (modified by setup script)" >> "$EXCLUDE_FILE"
        echo "config.yaml" >> "$EXCLUDE_FILE"
        echo "   ✓ Added config.yaml to .git/info/exclude"
    else
        echo "   ✓ config.yaml already in .git/info/exclude"
    fi
}
```

**Step 3: Integrate into main script flow**

Replace lines 28-43 (the "Step 2: Initialize beads database" section) with:

```bash
# Step 2: Configure for worktree or main repo
echo "2️⃣  Configuring beads..."

MAIN_REPO=$(find_main_repo)

if [ -n "$MAIN_REPO" ]; then
    # We're in a worktree - use shared database
    WORKTREE_NAME=$(basename "$PWD")
    echo "   Detected worktree: $WORKTREE_NAME"
    echo "   Main repo: $MAIN_REPO"

    # Configure shared database in config.yaml
    configure_shared_database "$MAIN_REPO" "$WORKTREE_NAME"

    # Prevent config.yaml from being committed
    configure_git_exclude

    echo "   ✓ Worktree configured to use shared database"
else
    # We're in main repo - initialize database if needed
    echo "   Detected main repository"

    if ! bd status 2>/dev/null | grep -q "issue_prefix"; then
        # Extract the issue prefix from an existing issue ID in issues.jsonl
        ISSUE_PREFIX=$(grep -o '"id":"[a-z]*-' .beads/issues.jsonl 2>/dev/null | head -1 | sed 's/"id":"\([a-z]*\)-.*/\1/' || echo "wms")

        if [ -z "$ISSUE_PREFIX" ] || [ "$ISSUE_PREFIX" = "id" ]; then
            ISSUE_PREFIX="wms"
        fi

        bd init --prefix "$ISSUE_PREFIX" 2>/dev/null || true
        echo "   ✓ Database initialized with prefix: $ISSUE_PREFIX"
    else
        echo "   ✓ Database already initialized"
    fi
fi
```

**Step 4: Remove debug code**

Remove the temporary debug code added in Task 1, Step 2.

**Step 5: Update the final status display**

Replace lines 74-86 with:

```bash
# Step 5: Display configuration
echo ""
echo "✅ Beads setup complete!"
echo ""

MAIN_REPO=$(find_main_repo)
if [ -n "$MAIN_REPO" ]; then
    # Worktree configuration
    echo "Beads worktree configuration:"
    echo "  Worktree: $(basename "$PWD")"
    echo "  Shared database: $MAIN_REPO/.beads/beads.db"
    echo "  Actor: $(basename "$PWD")"
    echo "  Config: .beads/config.yaml (git-ignored via .git/info/exclude)"
else
    # Main repo configuration
    echo "Beads main repository configuration:"
    echo "  Database: $PWD/.beads/beads.db"
    echo "  Actor: \$USER (default)"
fi

echo ""
echo "Ready work available:"
bd ready --json 2>/dev/null | jq -r '.[] | "  [\(.priority)] \(.id): \(.title)"' | head -5 || echo "  (run 'bd ready' to see available work)"
echo ""
```

**Step 6: Test in main repo**

Run: `./scripts/setup-beads-worktree.sh`
Expected: Shows "main repository configuration" message

**Step 7: Commit the changes**

```bash
git add scripts/setup-beads-worktree.sh
git commit -m "feat(worktrees): configure shared database via config.yaml

- Auto-detect worktree vs main repo
- Configure db and actor in .beads/config.yaml for worktrees
- Use .git/info/exclude to prevent config commits
- Update status display to show configuration type"
```

---

## Task 3: Simplify or Remove bd Wrapper Script

**Files:**
- Modify: `scripts/bd:1-40`

**Step 1: Update wrapper to be informational only**

Since config.yaml now handles the database and actor configuration, the wrapper is no longer needed for functionality. We can simplify it to just provide logging, or remove it entirely.

Option A - Simplify to logging only:

```bash
#!/bin/bash
# BD wrapper for git worktrees
# Provides informational logging about worktree context
#
# This script is called when 'bd' is invoked in a worktree because
# node_modules/.bin/bd is symlinked to this script by setup-beads-worktree.sh
#
# Note: Configuration is now handled via .beads/config.yaml
# This wrapper is optional and only provides logging.
#
# Usage: bd <command> [args...]
# Example: bd ready --json

# Find the real bd executable (not this script)
PATH_WITHOUT_SCRIPTS=$(echo "$PATH" | tr ':' '\n' | grep -v "$(cd "$(dirname "$0")" && pwd)" | tr '\n' ':')
REAL_BD=$(PATH="$PATH_WITHOUT_SCRIPTS" command -v bd)

if [ -z "$REAL_BD" ]; then
    echo "Error: Could not find bd executable in PATH" >&2
    exit 1
fi

# Detect if we're in a worktree by checking if .git is a file
if [ -f ".git" ]; then
    # We're in a worktree - configuration comes from .beads/config.yaml
    WORKTREE_NAME=$(basename "$PWD")

    # Optional: Log wrapper activity to stderr (won't interfere with JSON output)
    # Uncomment for debugging:
    # echo "🔧 BD Worktree Wrapper: Using shared database for '$WORKTREE_NAME'" >&2
    # echo "   Config from: .beads/config.yaml" >&2
fi

# Call real bd - it will read configuration from .beads/config.yaml
exec "$REAL_BD" "$@"
```

Option B - Remove wrapper entirely and update setup script to not create symlink.

**Step 2: Decide which option**

For now, let's go with Option A (simplified logging wrapper) to maintain backward compatibility and provide helpful debugging info.

Apply the Option A code above to `scripts/bd`.

**Step 3: Update setup script to mention the simplified wrapper**

In `scripts/setup-beads-worktree.sh`, update line 20-26:

```bash
# Step 1: Create bd wrapper symlink in node_modules/.bin
echo "1️⃣  Configuring bd wrapper..."
# Create node_modules/.bin directory if it doesn't exist
mkdir -p node_modules/.bin
# Symlink our bd wrapper (provides logging, config is via .beads/config.yaml)
ln -sf "$PWD/scripts/bd" node_modules/.bin/bd
echo "   ✓ Wrapper linked: node_modules/.bin/bd -> scripts/bd"
```

**Step 4: Test the simplified wrapper**

Run: `./scripts/bd ready`
Expected: Should work without any wrapper messages (unless you uncomment the debug lines)

**Step 5: Commit the changes**

```bash
git add scripts/bd scripts/setup-beads-worktree.sh
git commit -m "refactor(worktrees): simplify bd wrapper to logging only

Configuration now handled via .beads/config.yaml, so wrapper
no longer needs to pass --db and --actor flags. Kept wrapper
for optional debugging and backward compatibility."
```

---

## Task 4: Update Documentation

**Files:**
- Modify: `AGENTS.md:84-131`

**Step 1: Update the worktree configuration section**

Replace lines 84-131 (the "Git Worktrees and Multi-Agent Configuration" section) with:

```markdown
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
```

**Step 2: Remove references to --allow-stale in settings**

Check `.claude/settings.local.json` and remove any `--allow-stale` flags if present:

```bash
# Search for --allow-stale references
grep -r "allow-stale" .claude/
```

If found, update the permissions to remove `--allow-stale` flags.

**Step 3: Commit documentation changes**

```bash
git add AGENTS.md
git commit -m "docs(worktrees): update for shared database architecture

- Document shared database approach
- Remove references to isolated databases
- Update setup script documentation
- Remove --allow-stale workaround mentions"
```

---

## Task 5: Test in a Vibe-Kanban Worktree

**Files:**
- Test: Vibe-kanban worktree (create via vibe-kanban UI)

**Step 1: Create a test task in vibe-kanban**

1. Open vibe-kanban UI
2. Create a test task: "Test shared database configuration"
3. Note the task ID

**Step 2: Start an agent on the task**

1. Assign the test task to any executor (e.g., codex)
2. Let vibe-kanban create the worktree
3. The worktree should be in `/tmp/vibe-kanban/worktrees/`

**Step 3: SSH/access the worktree and run setup**

```bash
cd /tmp/vibe-kanban/worktrees/<task-id>-*
./scripts/setup-beads-worktree.sh
```

Expected output:
```
🔧 Setting up beads for git worktree...
1️⃣  Configuring bd wrapper...
   ✓ Wrapper linked: node_modules/.bin/bd -> scripts/bd
2️⃣  Configuring beads...
   Detected worktree: <worktree-name>
   Main repo: /Users/mrdavidlaing/mo-inator-workspace/wellmaintained-skills
   Configuring shared database...
   ✓ Configured db: /Users/.../wellmaintained-skills/.beads/beads.db
   ✓ Configured actor: <worktree-name>
   ✓ Added config.yaml to .git/info/exclude
   ✓ Worktree configured to use shared database
...
✅ Beads setup complete!

Beads worktree configuration:
  Worktree: <worktree-name>
  Shared database: /Users/.../wellmaintained-skills/.beads/beads.db
  Actor: <worktree-name>
  Config: .beads/config.yaml (git-ignored via .git/info/exclude)
```

**Step 4: Verify config.yaml is not tracked by git**

```bash
git status
```

Expected: Should NOT show `.beads/config.yaml` as modified

**Step 5: Verify config.yaml points to shared database**

```bash
cat .beads/config.yaml | grep "^db:"
```

Expected output:
```
db: "/Users/mrdavidlaing/mo-inator-workspace/wellmaintained-skills/.beads/beads.db"
```

**Step 6: Test bd commands work without staleness errors**

```bash
bd ready
bd list --status=open
bd stats
```

Expected: All commands work without staleness warnings or errors

**Step 7: Verify agent can use bd commands**

Have the agent run:
```bash
bd ready --json
```

Expected: Agent sees ready work, no PATH issues, no staleness errors

**Step 8: Create an issue from worktree and verify visibility**

In worktree:
```bash
bd create --title="Test issue from worktree" --type=task --priority=2 --json
```

In main repo:
```bash
bd list --status=open | grep "Test issue from worktree"
```

Expected: Issue is immediately visible in main repo (shared database!)

**Step 9: Check actor tracking**

In main repo:
```bash
bd show <test-issue-id>
```

Expected: Should show `created_by: <worktree-name>` in the issue details

**Step 10: Document test results**

If all tests pass, the implementation is complete! If any issues, document them for fixing.

---

## Task 6: Update .beads/.gitignore (Optional Safety)

**Files:**
- Modify: `.beads/.gitignore:1-30`

**Step 1: Add comment about config.yaml handling**

Add this comment after line 12 (after daemon files section):

```
# Note: config.yaml is version-controlled in main repo
# Worktrees use .git/info/exclude to ignore their modified config.yaml
# This ensures worktree config changes don't get committed
```

**Step 2: Verify config.yaml is NOT in .beads/.gitignore**

We want config.yaml to be tracked in the main repo, so it should NOT be in `.beads/.gitignore`.

Run: `grep "config.yaml" .beads/.gitignore`
Expected: No match (config.yaml is not ignored globally)

**Step 3: Commit the clarifying comment**

```bash
git add .beads/.gitignore
git commit -m "docs(beads): clarify config.yaml git handling in worktrees"
```

---

## Task 7: Clean Up Main Repo After Testing

**Files:**
- Clean: `.beads/config.yaml` (if modified during testing)

**Step 1: Check if config.yaml was modified in main repo**

```bash
git status .beads/config.yaml
```

**Step 2: If modified, restore to clean state**

The main repo's config.yaml should NOT have `db:` or `actor:` settings (those are worktree-specific).

If it was modified:
```bash
git checkout .beads/config.yaml
```

**Step 3: Verify config.yaml is clean**

```bash
cat .beads/config.yaml
```

Expected: Should show the standard config without `db:` or `actor:` lines (unless they were there originally as commented examples).

**Step 4: Run setup script in main repo to verify**

```bash
./scripts/setup-beads-worktree.sh
```

Expected: Should detect main repo and NOT modify config.yaml

---

## Testing Checklist

After implementation, verify:

- [ ] Setup script detects main repo vs worktree correctly
- [ ] Worktree config.yaml points to main repo database
- [ ] Worktree config.yaml sets actor to worktree name
- [ ] Git does not track worktree config.yaml changes
- [ ] All bd commands work in worktrees without staleness errors
- [ ] Issues created in worktrees are immediately visible in main repo
- [ ] Actor tracking correctly identifies worktree
- [ ] Vibe-kanban agents can run bd commands successfully
- [ ] Main repo config.yaml remains clean and tracked
- [ ] Documentation is updated and accurate

---

## Rollback Plan

If issues occur, rollback by:

1. Restore previous setup script: `git checkout HEAD~N scripts/setup-beads-worktree.sh`
2. In affected worktrees, remove config modifications:
   ```bash
   git checkout .beads/config.yaml
   grep -v "config.yaml" .git/info/exclude > .git/info/exclude.tmp
   mv .git/info/exclude.tmp .git/info/exclude
   ```
3. Re-run old setup script

---

## Success Criteria

Implementation is successful when:

1. ✅ Worktrees automatically use shared database from main repo
2. ✅ No more staleness errors in any worktree
3. ✅ Changes in one worktree are immediately visible in all others
4. ✅ Actor tracking works for audit trail
5. ✅ Vibe-kanban agents work without PATH or environment issues
6. ✅ Main repo config remains clean and version-controlled
7. ✅ Worktree config changes are never committed
