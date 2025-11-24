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

# Step 3: Import JSONL to populate last_import_time (prevents staleness errors)
echo "3️⃣  Importing JSONL to database..."
bd import -i .beads/issues.jsonl 2>/dev/null || bd sync --import-only 2>/dev/null || true
echo "   ✓ JSONL imported"

# Step 4: Full sync to ensure everything is up to date
echo "4️⃣  Syncing with remote..."
bd sync 2>/dev/null || true
echo "   ✓ Sync complete"

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
