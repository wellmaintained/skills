#!/bin/bash
set -e

echo "🔧 Installing beads-bridge..."

cd "$(dirname "$0")/../skills/beads-bridge"

# Check if bd is installed
if ! command -v bd &> /dev/null; then
    echo "⚠️  Warning: Beads CLI (bd) not found in PATH"
    echo "   Install from: https://github.com/steveyegge/beads"
    echo "   beads-bridge will still install, but won't work until bd is available"
fi

# Try to install pre-compiled binary first
echo "📦 Attempting to download pre-compiled binary..."

if bash ../../scripts/install-binary.sh node_modules/.bin 2>/dev/null; then
    echo "✅ Installed pre-compiled binary successfully!"
else
    echo "⚠️  Binary download failed, building from source instead..."
    echo ""

    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        echo "❌ Error: Node.js >= 18.0.0 is required but not installed"
        echo "   Please install Node.js from https://nodejs.org/"
        exit 1
    fi

    # Check Node.js version
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo "❌ Error: Node.js >= 18.0.0 is required (found $(node -v))"
        echo "   Please upgrade Node.js from https://nodejs.org/"
        exit 1
    fi

    # Check if Bun is installed (preferred for building)
    if command -v bun &> /dev/null; then
        echo "Using Bun for installation..."
        PACKAGE_MANAGER="bun"
    else
        echo "Using npm for installation..."
        PACKAGE_MANAGER="npm"
    fi

    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing dependencies..."
        $PACKAGE_MANAGER install --silent
    else
        echo "✓ Dependencies already installed"
    fi

    # Build binary
    echo "🔨 Building beads-bridge binary..."
    $PACKAGE_MANAGER run build --silent

    # Verify build succeeded
    if [ ! -f "dist/beads-bridge" ] && [ ! -f "dist/beads-bridge.exe" ]; then
        echo "❌ Error: Build failed - binary not found"
        exit 1
    fi

    echo "✅ Built from source successfully!"
fi

echo ""
echo "✅ beads-bridge installed successfully!"
echo ""
echo "Next steps:"
echo "  1. Authenticate with backends:"
echo "     beads-bridge auth github    # OAuth flow"
echo "     beads-bridge auth shortcut  # API token"
echo ""
echo "  2. Configure your project:"
echo "     cd /path/to/your/project"
echo "     beads-bridge init --repository owner/repo"
echo ""
echo "  3. Start using in Claude conversations:"
echo "     'Show me the status of GitHub issue #123'"
echo ""
echo "📖 Full docs: https://github.com/wellmaintained/skills/tree/main/plugins/beads-bridge"
