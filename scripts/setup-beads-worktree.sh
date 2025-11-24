#!/bin/bash
# Setup beads for use in a git worktree
# This script initializes the beads database, installs git hooks, and syncs issues
#
# Usage:
#   ./scripts/setup-beads-worktree.sh          # Run as script
#   source ./scripts/setup-beads-worktree.sh   # Source to persist env vars
#
# What it does:
# 1. Configures .beads/config.yaml for shared database (worktrees) or initializes DB (main repo)
# 2. Verifies git hooks are configured
# 3. Syncs database with JSONL (forced import to clear staleness)
# 4. Displays configuration and ready work

set -e

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

# Configure beads to use shared database from main repo
# Args: $1 = main repo path, $2 = worktree name
configure_shared_database() {
    local MAIN_REPO="$1"
    local WORKTREE_NAME="$2"
    local CONFIG_FILE=".beads/config.yaml"
    local SHARED_DB="$MAIN_REPO/.beads/beads.db"

    # Remove old symlink approach if it exists
    if [ -L "$PWD/.beads/beads.db" ]; then
        rm "$PWD/.beads/beads.db"
        echo "   Removed old database symlink"
    fi

    # Verify main repo database exists
    if [ ! -f "$SHARED_DB" ]; then
        echo "   Error: Main repo database not found: $SHARED_DB" >&2
        echo "   Run this script in main repo first to initialize database" >&2
        exit 1
    fi

    echo "   Configuring shared database..."

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

    # Remove local issues.jsonl (use shared DB only, no local JSONL)
    if [ -f ".beads/issues.jsonl" ]; then
        rm .beads/issues.jsonl
        echo "   ✓ Removed local issues.jsonl (using shared database)"
    fi

    # Remove local beads.db (if it exists) to force use of shared database
    if [ -f ".beads/beads.db" ] && [ ! -L ".beads/beads.db" ]; then
        rm .beads/beads.db
        echo "   ✓ Removed local beads.db (using shared database)"
    fi

    # Remove metadata.json (references local JSONL that we deleted)
    if [ -f ".beads/metadata.json" ]; then
        rm .beads/metadata.json
        echo "   ✓ Removed local metadata.json (using shared database)"
    fi
}

# Mark config.yaml with skip-worktree to prevent commits
configure_git_skip_worktree() {
    # Tell git to ignore local modifications to config.yaml
    git update-index --skip-worktree .beads/config.yaml 2>/dev/null || {
        echo "   ⚠️  Warning: Could not set skip-worktree on config.yaml"
        echo "      Manual fix: git update-index --skip-worktree .beads/config.yaml"
    }
    echo "   ✓ Marked config.yaml with skip-worktree (won't be committed)"
}

echo "🔧 Setting up beads for git worktree..."

# Step 1: Configure for worktree or main repo
echo "1️⃣  Configuring beads..."

MAIN_REPO=$(find_main_repo)

if [ -n "$MAIN_REPO" ]; then
    # We're in a worktree - use shared database
    WORKTREE_NAME=$(basename "$PWD")
    echo "   Detected worktree: $WORKTREE_NAME"
    echo "   Main repo: $MAIN_REPO"

    # Configure shared database in config.yaml
    configure_shared_database "$MAIN_REPO" "$WORKTREE_NAME"

    # Prevent config.yaml from being committed
    configure_git_skip_worktree

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

# Step 2: Verify git hooks are configured (critical for auto-sync)
echo "2️⃣  Verifying git hooks..."

# Configure git to use custom hooks directory (fixes staleness issues)
git config core.hooksPath .githooks 2>/dev/null || true

if [ -d ".git/hooks" ]; then
    # We're in the main repo
    if [ -d ".githooks" ] && [ -x ".githooks/pre-commit" ]; then
        echo "   ✓ Using custom git hooks from .githooks/"
    else
        echo "   ⚠️  WARNING: Custom git hooks not found in .githooks/"
        echo "      Falling back to standard hooks, may have staleness issues"
    fi
else
    # We're in a worktree, hooks are inherited from main repo config
    echo "   ✓ Using hooks from main repository (worktree)"
fi

# Step 3: Sync database with JSONL
echo "3️⃣  Syncing database..."

if [ -n "$MAIN_REPO" ]; then
    # Worktree: Force import from main repo's JSONL to sync metadata
    # This clears staleness warnings by updating last_import_time
    bd import -i "$MAIN_REPO/.beads/issues.jsonl" --force 2>/dev/null || true
    echo "   ✓ Synced with main repo JSONL"
else
    # Main repo: Import and full sync
    bd import -i .beads/issues.jsonl 2>/dev/null || bd sync --import-only 2>/dev/null || true
    echo "   ✓ JSONL imported"
    bd sync 2>/dev/null || true
    echo "   ✓ Sync complete"
fi

# Step 4: Display configuration
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
    echo "  Config: .beads/config.yaml (skip-worktree)"
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
