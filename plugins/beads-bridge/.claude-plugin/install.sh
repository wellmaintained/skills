#!/bin/bash
set -e

echo "🔧 Installing beads-bridge plugin..."

# Find the repository root (where src/beads-bridge/ is located)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$PLUGIN_DIR/../.." && pwd)"

# Check if bd is installed
if ! command -v bd &> /dev/null; then
    echo "⚠️  Warning: Beads CLI (bd) not found in PATH"
    echo "   Install from: https://github.com/steveyegge/beads"
    echo "   beads-bridge will still install, but won't work until bd is available"
fi

# Check if beads-bridge is already installed in PATH
if command -v beads-bridge &> /dev/null; then
    echo "✅ beads-bridge is already installed in PATH!"
    echo "   Version: $(beads-bridge --version)"
    echo ""
    echo "📖 See SKILL.md for usage instructions"
    exit 0
fi

# Try to install beads-bridge CLI using the install script
echo "📦 Installing beads-bridge CLI..."

if [ -f "$REPO_ROOT/src/beads-bridge/scripts/install-beads-bridge.sh" ]; then
    # Local development: use the script from the repo
    echo "Using local install script from repo..."
    bash "$REPO_ROOT/src/beads-bridge/scripts/install-beads-bridge.sh"
else
    # Production: download from GitHub
    echo "Downloading install script from GitHub..."
    curl -fsSL https://raw.githubusercontent.com/wellmaintained/skills/main/src/beads-bridge/scripts/install-beads-bridge.sh | bash
fi

# Verify installation
if command -v beads-bridge &> /dev/null; then
    echo "✅ beads-bridge installed successfully!"
    echo "   Version: $(beads-bridge --version)"
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
    echo "📖 Full docs: https://github.com/wellmaintained/skills/tree/main/src/beads-bridge"
else
    echo "❌ Error: beads-bridge installation failed"
    echo "   Please check the error messages above or install manually:"
    echo "   curl -fsSL https://raw.githubusercontent.com/wellmaintained/skills/main/src/beads-bridge/scripts/install-beads-bridge.sh | bash"
    exit 1
fi
