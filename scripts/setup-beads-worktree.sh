#!/bin/bash
# Setup beads for use in a git worktree
# This script initializes the beads database, installs git hooks, and syncs issues
#
# Usage:
#   ./scripts/setup-beads-worktree.sh          # Run as script
#   source ./scripts/setup-beads-worktree.sh   # Source to persist env vars
#
# What it does:
# 1. Configures PATH to use bd wrapper (auto-sets --actor and --db)
# 2. Initializes beads database with correct issue prefix
# 3. Installs git hooks (main repo only, worktrees inherit)
# 4. Syncs issues from git into worktree's isolated database
# 5. Displays configuration and ready work

set -e

echo "🔧 Setting up beads for git worktree..."

# Step 1: Create bd wrapper symlink in node_modules/.bin
echo "1️⃣  Configuring bd wrapper..."
# Create node_modules/.bin directory if it doesn't exist
mkdir -p node_modules/.bin
# Symlink our bd wrapper so it's found before the system bd
ln -sf "$PWD/scripts/bd" node_modules/.bin/bd
echo "   ✓ Wrapper linked: node_modules/.bin/bd -> scripts/bd"

# Step 2: Initialize beads database (if not already done)
echo "2️⃣  Initializing beads database..."
if ! bd status 2>/dev/null | grep -q "issue_prefix"; then
    # Extract the issue prefix from an existing issue ID in issues.jsonl
    # Look for the first issue and extract the prefix (part before the hyphen-number)
    ISSUE_PREFIX=$(grep -o '"id":"[a-z]*-' .beads/issues.jsonl 2>/dev/null | head -1 | sed 's/"id":"\([a-z]*\)-.*/\1/' || echo "wms")

    if [ -z "$ISSUE_PREFIX" ] || [ "$ISSUE_PREFIX" = "id" ]; then
        ISSUE_PREFIX="wms"
    fi

    bd init --prefix "$ISSUE_PREFIX" 2>/dev/null || true
    echo "   ✓ Database initialized with prefix: $ISSUE_PREFIX"
else
    echo "   ✓ Database already initialized"
fi

# Step 2: Verify git hooks are configured (critical for auto-sync)
echo "2️⃣  Verifying git hooks..."
if [ -d ".git/hooks" ]; then
    # We're in the main repo, install hooks if needed
    if [ ! -x ".git/hooks/pre-commit" ] || ! grep -q "bd sync" ".git/hooks/pre-commit" 2>/dev/null; then
        echo "   Installing git hooks..."
        bd hooks install 2>/dev/null || true
    fi
    echo "   ✓ Git hooks configured"
else
    # We're in a worktree, check that main repo has hooks
    # .git file contains: gitdir: /path/to/main/.git/worktrees/worktree-name
    # We need: /path/to/main/.git/hooks
    MAIN_REPO_GIT_DIR=$(cat .git | sed 's/gitdir: //')
    MAIN_GIT_DIR=$(dirname "$(dirname "$MAIN_REPO_GIT_DIR")")
    HOOKS_DIR="$MAIN_GIT_DIR/hooks"

    if [ -x "$HOOKS_DIR/pre-commit" ] && grep -q "bd sync" "$HOOKS_DIR/pre-commit" 2>/dev/null; then
        echo "   ✓ Using hooks from main repository (worktree)"
    else
        echo "   ⚠️  WARNING: Git hooks not found in main repository!"
        echo "      Run 'bd hooks install' in the main repo to enable auto-sync"
        echo "      Without hooks, you must manually run 'bd sync' before commits"
    fi
fi

# Step 3: Sync beads database
echo "3️⃣  Syncing issues from git..."
bd sync 2>/dev/null || true
echo "   ✓ Issues synced"

# Step 5: Display configuration
echo ""
echo "✅ Beads setup complete!"
echo ""
echo "Beads wrapper configuration:"
echo "  Wrapper: node_modules/.bin/bd -> scripts/bd"
echo "  Actor: $(basename "$PWD")"
echo "  Database: $PWD/.beads/beads.db"
echo ""
echo "Ready work available:"
bd ready --json 2>/dev/null | jq -r '.[] | "  [\(.priority)] \(.id): \(.title)"' | head -5 || echo "  (run 'bd ready' to see available work)"
echo ""
echo "Note: All bd commands will automatically use worktree-specific --actor and --db"
