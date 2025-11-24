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

# Validate marketplace.json JSON syntax
validate-marketplace-syntax:
    @echo "🔍 Validating marketplace.json JSON syntax..."
    @jq empty .claude-plugin/marketplace.json 2>/dev/null || (echo "❌ .claude-plugin/marketplace.json is not valid JSON" && exit 1)
    @echo "✅ .claude-plugin/marketplace.json has valid JSON syntax"

# Validate all plugin.json files JSON syntax
validate-plugins-syntax:
    @echo "🔍 Validating plugin.json files JSON syntax..."
    @bash scripts/validate-plugins-syntax.sh

# Check required files for all plugins
check-required-files:
    @echo "🔍 Checking required files for each plugin..."
    @bash scripts/check-required-files.sh

# Validate plugin directory structure
check-directory-structure:
    @echo "🔍 Validating plugin directory structure..."
    @bash scripts/check-directory-structure.sh

# Full structural validation (syntax + schema + files + structure + versions)
validate-structure: validate-marketplace-syntax validate-marketplace validate-plugins-syntax validate-plugins check-required-files check-directory-structure check-versions
    @echo "✅ All structural validations passed!"

# Run all root-level checks (validation + version check)
check: validate check-versions
    @echo "✅ All checks passed!"

# ============================================================================
# Beads-Bridge CLI Commands
# ============================================================================

# Build the beads-bridge CLI
build-bridge:
    @echo "🔨 Building beads-bridge..."
    cd src/beads-bridge && bun run build

# Build beads-bridge binary
build-bridge-binary:
    @echo "🔨 Building beads-bridge binary..."
    cd src/beads-bridge && bun run build

# Build beads-bridge binary for specific platform (note: cross-compilation requires running on that platform)
build-binary platform arch:
    @echo "🔨 Building beads-bridge for {{platform}}-{{arch}}..."
    @cd src/beads-bridge && bun install && bun run build
    @echo "📦 Renaming binary with platform suffix..."
    @cd src/beads-bridge/dist && \
        if [ "{{platform}}" = "win32" ]; then \
            mv beads-bridge beads-bridge-{{platform}}-{{arch}}.exe || mv beads-bridge.exe beads-bridge-{{platform}}-{{arch}}.exe; \
        else \
            mv beads-bridge beads-bridge-{{platform}}-{{arch}}; \
        fi
    @echo "✅ Binary built: src/beads-bridge/dist/beads-bridge-{{platform}}-{{arch}}"

# Run TypeScript type checking for beads-bridge
type-check-bridge:
    @echo "🔍 Type checking beads-bridge..."
    cd src/beads-bridge && bun run type-check

# Run tests for beads-bridge (using Bun)
test-bridge:
    @echo "🧪 Running beads-bridge tests..."
    cd src/beads-bridge && bun run test

# Run tests in watch mode for beads-bridge
test-bridge-watch:
    @echo "🧪 Running beads-bridge tests (watch mode)..."
    cd src/beads-bridge && bun run test:watch

# Run tests with coverage for beads-bridge
test-bridge-coverage:
    @echo "🧪 Running beads-bridge tests with coverage..."
    cd src/beads-bridge && bun run test:coverage

# Lint beads-bridge code
lint-bridge:
    @echo "🔍 Linting beads-bridge..."
    cd src/beads-bridge && bun run lint

# Format beads-bridge code
format-bridge:
    @echo "✨ Formatting beads-bridge code..."
    cd src/beads-bridge && bun run format

# Watch client development server for beads-bridge
dev-bridge-client:
    @echo "👀 Starting beads-bridge client dev server..."
    cd src/beads-bridge && bun run dev:client

# Start beads-bridge serve in dev watch mode (installs deps, watches client, serves issue)
# Usage: just serve-bridge [issue-id] [log-level]
# Default issue-id: wms-yun
# Default log-level: INFO
# Note: TypeScript type checking is separate - use 'just type-check-bridge'
serve-bridge issue-id="wms-yun" log-level="INFO":
    @bash scripts/serve-bridge-dev.sh {{issue-id}} {{log-level}}

# Full quality check for beads-bridge (lint + type-check + test)
qa-bridge: lint-bridge type-check-bridge test-bridge
    @echo "✅ Beads-bridge quality checks passed!"

# Test plugin installation script (if it exists)
test-plugin-install plugin:
    @echo "🧪 Testing installation for {{plugin}}..."
    @cd plugins/{{plugin}} && \
        if [ -f ".claude-plugin/install.sh" ]; then \
            echo "Running installation script..."; \
            bash .claude-plugin/install.sh || true; \
            echo "✅ Installation script executed"; \
        else \
            echo "ℹ️  No installation script for {{plugin}}"; \
        fi

# Build and test a plugin (used by CI)
test-plugin plugin:
    @echo "🧪 Building and testing {{plugin}}..."
    @if [ "{{plugin}}" = "beads-bridge" ] && [ -d "src/beads-bridge" ]; then \
        cd src/beads-bridge; \
    elif [ -d "plugins/{{plugin}}/skills/{{plugin}}" ]; then \
        cd plugins/{{plugin}}/skills/{{plugin}}; \
    else \
        echo "⚠️  No build needed for {{plugin}}"; \
        exit 0; \
    fi && \
    if [ -f "package.json" ]; then \
        echo "Installing dependencies for {{plugin}}..."; \
        bun install; \
        echo "Building {{plugin}}..."; \
        bun run build; \
        if jq -e '.scripts.test' package.json > /dev/null; then \
            echo "Running tests for {{plugin}}..."; \
            bun run test; \
            echo "✅ Tests completed"; \
        else \
            echo "ℹ️  No tests defined for {{plugin}}"; \
        fi; \
    fi

# ============================================================================
# Marketplace Management
# ============================================================================

# Update marketplace.json timestamp
update-marketplace-timestamp:
    @echo "📋 Updating marketplace.json lastUpdated timestamp..."
    @jq '.metadata.lastUpdated = (now | todate)' .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp
    @mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json
    @echo "✅ Marketplace timestamp updated"

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
    cd src/beads-bridge && bun install

# Install all dependencies
install-all: install install-bridge
    @echo "✅ All dependencies installed!"

# Clean build artifacts
clean:
    @echo "🧹 Cleaning build artifacts..."
    -rm -rf src/*/dist
    -rm -rf src/*/node_modules/.vite
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

