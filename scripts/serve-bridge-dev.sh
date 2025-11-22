#!/bin/bash
# Start beads-bridge in dev watch mode
# Ensures dependencies are installed, runs TypeScript watch, and serves the dashboard
# IMPORTANT: The serve command must run from repository root so it can find .beads/

set -e

# Get the repository root (where this script is located, assuming scripts/ is in repo root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

BRIDGE_DIR="$REPO_ROOT/plugins/beads-bridge/skills/beads-bridge"
ISSUE_ID="${1:-wms-yun}"

echo "🚀 Starting beads-bridge in dev watch mode for issue: $ISSUE_ID"
echo "📁 Repository root: $REPO_ROOT"
echo ""

# Ensure we're in repo root for the serve command
cd "$REPO_ROOT"

# Ensure dependencies are installed
echo "📦 Ensuring dependencies are installed..."
cd "$BRIDGE_DIR" && npm install

# Build initial compilation
echo "🔨 Building initial compilation..."
cd "$BRIDGE_DIR" && npm run build

# Start TypeScript watch mode in background
echo "👀 Starting TypeScript watch mode in background..."
cd "$BRIDGE_DIR" && npm run dev &
WATCH_PID=$!

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping TypeScript watch (PID: $WATCH_PID)..."
    kill $WATCH_PID 2>/dev/null || true
    wait $WATCH_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Wait for initial compilation
echo "⏳ Waiting for initial compilation..."
sleep 3

# Start serve command from repository root (so it can find .beads/)
echo "🌐 Starting serve command for $ISSUE_ID..."
echo "   (Running from repo root so .beads/ directory can be found)"
echo ""
cd "$REPO_ROOT" && node "$BRIDGE_DIR/dist/cli.js" serve "$ISSUE_ID"

