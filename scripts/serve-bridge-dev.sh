#!/bin/bash
# Start beads-bridge in dev watch mode
# Ensures dependencies are installed, watches client for rebuilds, and serves the dashboard
# IMPORTANT: The serve command must run from repository root so it can find .beads/
# Note: TypeScript type checking is separate - use 'just type-check-bridge'

set -e

# Get the repository root (where this script is located, assuming scripts/ is in repo root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

BRIDGE_DIR="$REPO_ROOT/src/beads-bridge"
ISSUE_ID="${1:-wms-yun}"
LOG_LEVEL="${2:-INFO}"

echo "🚀 Starting beads-bridge in dev watch mode for issue: $ISSUE_ID"
echo "📁 Repository root: $REPO_ROOT"
echo ""

# Ensure we're in repo root for the serve command
cd "$REPO_ROOT"

# Ensure dependencies are installed
echo "📦 Ensuring dependencies are installed..."
cd "$BRIDGE_DIR" && bun install

# Build client (needed for frontend assets)
echo "🔨 Building client..."
cd "$BRIDGE_DIR" && bun run build:client

# Start Vite client watch mode in background (rebuilds on file changes)
echo "👀 Starting Vite client watch mode in background..."
cd "$BRIDGE_DIR" && bunx vite build --config src/client/vite.config.ts --watch &
VITE_WATCH_PID=$!

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping watch processes..."
    echo "   Stopping Vite watch (PID: $VITE_WATCH_PID)..."
    kill $VITE_WATCH_PID 2>/dev/null || true
    wait $VITE_WATCH_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Wait a moment for watch process to start
echo "⏳ Waiting for watch process to start..."
sleep 2

# Start serve command from repository root (so it can find .beads/)
echo "🌐 Starting serve command for $ISSUE_ID..."
echo "   (Running from repo root so .beads/ directory can be found)"
echo "   (Using Bun to run TypeScript directly)"
echo "   (Log level: $LOG_LEVEL)"
echo ""
cd "$REPO_ROOT" && bun "$BRIDGE_DIR/src/cli.ts" serve "$ISSUE_ID" --log-level "$LOG_LEVEL"

