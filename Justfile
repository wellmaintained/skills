# Justfile - Development helper commands
# Run `just` or `just --list` to see all available commands

# Default: show all available commands
default:
    @just --list

# ============================================================================
# Root-level Commands
# ============================================================================

# Validate all JSON schemas (marketplace and plugins)
validate:
    @echo "🔍 Validating JSON schemas..."
    bun run validate

# Validate marketplace.json schema
validate-marketplace:
    @echo "📋 Validating marketplace.json..."
    bun run validate:marketplace

# Validate all plugin.json files
validate-plugins:
    @echo "🔌 Validating plugin.json files..."
    bun run validate:plugins

# Check version consistency across all plugins
check-versions:
    @echo "🔍 Checking version consistency..."
    bash scripts/check-version-consistency.sh

# Run all root-level checks (validation + version check)
check: validate check-versions
    @echo "✅ All checks passed!"

# ============================================================================
# Beads-Bridge Plugin Commands
# ============================================================================

# Build the beads-bridge plugin
build-bridge:
    @echo "🔨 Building beads-bridge..."
    cd plugins/beads-bridge/skills/beads-bridge && bun run build

# Build beads-bridge binary
build-bridge-binary:
    @echo "🔨 Building beads-bridge binary..."
    cd plugins/beads-bridge/skills/beads-bridge && bun run build:binary

# Run TypeScript type checking for beads-bridge
type-check-bridge:
    @echo "🔍 Type checking beads-bridge..."
    cd plugins/beads-bridge/skills/beads-bridge && bun run type-check

# Run tests for beads-bridge (using Vitest)
test-bridge:
    @echo "🧪 Running beads-bridge tests..."
    cd plugins/beads-bridge/skills/beads-bridge && bun run test

# Run tests in watch mode for beads-bridge (using Vitest)
test-bridge-watch:
    @echo "🧪 Running beads-bridge tests (watch mode)..."
    cd plugins/beads-bridge/skills/beads-bridge && bun run test:watch

# Run tests with coverage for beads-bridge (using Vitest)
test-bridge-coverage:
    @echo "🧪 Running beads-bridge tests with coverage..."
    cd plugins/beads-bridge/skills/beads-bridge && bun run test:coverage

# Lint beads-bridge code
lint-bridge:
    @echo "🔍 Linting beads-bridge..."
    cd plugins/beads-bridge/skills/beads-bridge && bun run lint

# Format beads-bridge code
format-bridge:
    @echo "✨ Formatting beads-bridge code..."
    cd plugins/beads-bridge/skills/beads-bridge && bun run format

# Watch client development server for beads-bridge
dev-bridge-client:
    @echo "👀 Starting beads-bridge client dev server..."
    cd plugins/beads-bridge/skills/beads-bridge && bun run dev:client

# Start beads-bridge serve in dev watch mode (installs deps, watches client, serves issue)
# Usage: just serve-bridge [issue-id]
# Default issue-id: wms-yun
# Note: TypeScript type checking is separate - use 'just type-check-bridge'
serve-bridge issue-id="wms-yun":
    @bash scripts/serve-bridge-dev.sh {{issue-id}}

# Full quality check for beads-bridge (lint + type-check + test)
qa-bridge: lint-bridge type-check-bridge test-bridge
    @echo "✅ Beads-bridge quality checks passed!"

# ============================================================================
# Combined Workflows
# ============================================================================

# Run all validations and checks
qa: validate check-versions
    @echo "✅ All quality checks passed!"

# Build all plugins
build-all: build-bridge
    @echo "✅ All plugins built!"

# Test all plugins
test-all: test-bridge
    @echo "✅ All tests passed!"

# Full CI check (validate, build, test)
ci: qa build-all test-all
    @echo "✅ CI checks passed!"

# ============================================================================
# Development Helpers
# ============================================================================

# Install dependencies for root project
install:
    @echo "📦 Installing root dependencies..."
    bun install

# Install dependencies for beads-bridge
install-bridge:
    @echo "📦 Installing beads-bridge dependencies..."
    cd plugins/beads-bridge/skills/beads-bridge && bun install

# Install all dependencies
install-all: install install-bridge
    @echo "✅ All dependencies installed!"

# Clean build artifacts
clean:
    @echo "🧹 Cleaning build artifacts..."
    -rm -rf plugins/*/skills/*/dist
    -rm -rf plugins/*/skills/*/node_modules/.vite
    @echo "✅ Clean complete!"

# Show project structure
tree:
    @echo "📁 Project structure:"
    @tree -L 3 -I 'node_modules|dist|.git' || find . -maxdepth 3 -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' | head -30

# ============================================================================
# Beads Issue Tracking Helpers
# ============================================================================

# Show ready work from beads
ready:
    @echo "📋 Ready work:"
    @bd ready || echo "⚠️  bd (beads) not found. Install with: pip install beads"

# List all open issues
issues:
    @echo "📋 Open issues:"
    @bd list --status open || echo "⚠️  bd (beads) not found. Install with: pip install beads"

