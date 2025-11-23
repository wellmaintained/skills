# beads-bridge CLI Extraction Design

**Date:** 2025-11-23
**Status:** Approved
**Author:** Claude (brainstorming session)

## Overview

Extract beads-bridge from the Claude plugin structure into a standalone CLI tool while maintaining the plugin as pure documentation. This enables independent distribution as both a standalone tool and a Claude plugin.

## Motivation

**Primary goals:**
- **Distribution strategy** - Publish beads-bridge as an independent package (npm, standalone binary)
- **Multiple use cases** - Support both standalone CLI usage and Claude integration

**Key principle:** Complete separation - beads-bridge becomes a standalone project that knows nothing about Claude. The plugin becomes pure documentation teaching Claude how to use the CLI.

## Architecture

### Repository Structure

```
wellmaintained-skills/
├── package.json               # Root with workspaces config
│   {
│     "workspaces": ["src/beads-bridge"],
│     "version": "2.0.0"
│   }
├── bun.lock                   # Shared lockfile
│
├── src/beads-bridge/          # Standalone CLI tool (workspace)
│   ├── package.json           # Shares version with root
│   ├── src/
│   │   ├── cli.ts            # CLI entry point
│   │   ├── commands/         # CLI commands
│   │   ├── server/           # Express server
│   │   ├── client/           # React frontend
│   │   ├── clients/          # Beads client
│   │   └── services/         # Core services
│   ├── tests/                # Test suite
│   ├── scripts/
│   │   ├── build.ts          # Binary compilation
│   │   └── install-beads-bridge.sh  # Installer script
│   ├── tsconfig.json
│   └── README.md             # CLI documentation
│
└── plugins/beads-bridge/      # Claude plugin (docs only)
    ├── .claude-plugin/
    │   ├── plugin.json        # Plugin metadata
    │   └── install.sh         # Downloads binary to PATH
    ├── SKILL.md               # Claude instructions
    ├── README.md              # Plugin documentation
    ├── QUICKSTART.md
    └── LICENSE
```

### Version Management

- **Bun workspaces** manage monorepo
- Root package.json is source of truth for version
- semantic-release updates root version
- src/beads-bridge/package.json inherits from workspace
- Versions stay in sync automatically via Bun

### Plugin Architecture

**Before:** TypeScript skill with capability handlers (StatusQuery, ProgressSync, etc.)

**After:** Pure markdown skill teaching Claude to spawn beads-bridge CLI commands

**Install:** Download pre-compiled binary to PATH via install-beads-bridge.sh

**Runtime:** Expect `beads-bridge` in PATH, show helpful error if missing

**No TypeScript code** in plugin - pure documentation teaching CLI usage

## Build & Release Pipeline

### CI Workflow Changes

```yaml
build-binaries:
  # Builds from src/beads-bridge/ (new location)
  steps:
    - Install dependencies (bun install at root, handles workspace)
    - Build binary: cd src/beads-bridge && bun run build
    - Rename with platform suffix
    - Upload artifacts

release:
  needs: [build-binaries, ...]
  steps:
    - Download binaries to src/beads-bridge/dist/
    - Run semantic-release (updates root version)
    - Attach binaries from src/beads-bridge/dist/
```

### Release Asset Paths

Update `.releaserc.json` paths:
```json
// Before
"path": "plugins/beads-bridge/skills/beads-bridge/dist/beads-bridge-linux-x64"

// After
"path": "src/beads-bridge/dist/beads-bridge-linux-x64"
```

## Installation Flow

### Plugin Installation

```bash
# plugins/beads-bridge/.claude-plugin/install.sh

#!/bin/bash
echo "🔧 Installing beads-bridge..."

# Check if already installed
if command -v beads-bridge &> /dev/null; then
    echo "✓ beads-bridge already installed ($(beads-bridge --version))"
    exit 0
fi

# Download and run installer from src/beads-bridge/
echo "📦 Downloading beads-bridge binary..."
bash <(curl -fsSL https://raw.githubusercontent.com/wellmaintained/skills/main/src/beads-bridge/scripts/install-beads-bridge.sh)

# Verify
if command -v beads-bridge &> /dev/null; then
    echo "✅ beads-bridge installed successfully!"
else
    echo "❌ Installation failed. Manual install:"
    echo "   https://github.com/wellmaintained/skills/releases/latest"
    exit 1
fi
```

### File Locations

- **Installer:** `src/beads-bridge/scripts/install-beads-bridge.sh`
- **Build script:** `src/beads-bridge/scripts/build.ts`
- **Plugin install:** `plugins/beads-bridge/.claude-plugin/install.sh` (thin wrapper)

### Runtime Behavior

SKILL.md teaches Claude to:
1. Check if `beads-bridge` command exists (spawn and check exit code)
2. If missing, show helpful error with installation instructions
3. If present, spawn commands like `beads-bridge serve wms-123`
4. Parse stdout/stderr for results

## Migration Steps

### 1. Setup Workspace Structure
- Add `"workspaces": ["src/beads-bridge"]` to root package.json
- Create src/beads-bridge/ directory
- Move package.json, tsconfig.json from plugins/.../skills/beads-bridge/

### 2. Move Source Code
- Move src/, tests/, scripts/ to src/beads-bridge/
- Keep: CLI, server, client, services, tests
- Update import paths if needed

### 3. Simplify Plugin to Docs-Only
- Delete plugins/beads-bridge/skills/ entirely
- Rewrite SKILL.md to teach CLI usage (instead of referencing TypeScript capabilities)
- Update install.sh to reference src/beads-bridge/scripts/install-beads-bridge.sh

### 4. Update CI/CD
- Change build paths: plugins/.../skills/beads-bridge → src/beads-bridge
- Update .releaserc.json asset paths
- Test builds on all platforms

### 5. Update Installer Script
- Move install-binary.sh to src/beads-bridge/scripts/install-beads-bridge.sh
- Update to install to standard PATH locations

### 6. Test & Verify
- Build binaries
- Test plugin installation
- Test CLI works standalone
- Test SKILL.md instructions work in Claude

## Testing & Validation

### Post-Migration Testing

**1. Workspace Functionality**
- `bun install` at root handles workspace correctly
- `bun run build` works from src/beads-bridge/
- Version stays in sync between root and src/beads-bridge/

**2. Binary Builds (Critical!)**
- CI builds binaries from new location
- All 4 platforms build successfully (Linux x64, macOS arm64, macOS x64, Windows x64)
- Binaries are executable and functional

**3. Installation Flow**
- Plugin install.sh downloads binary correctly
- Binary lands in PATH
- `beads-bridge --version` works

**4. Plugin Functionality**
- SKILL.md teaches Claude correct CLI usage
- Claude can spawn beads-bridge commands
- Example: "Show me status for wms-123" works end-to-end

**5. Standalone CLI**
- Can install beads-bridge independently (without plugin)
- All commands work (auth, serve, etc.)
- Documentation accurate for standalone use

## Benefits

### For Users
- **Flexibility:** Use beads-bridge as standalone CLI or via Claude
- **Fast installation:** Download pre-built binary, no build tools needed
- **Clear separation:** Plugin is just docs, tool is independent

### For Development
- **Monorepo:** Bun workspaces manage dependencies cleanly
- **Standalone development:** Work on CLI without plugin concerns
- **Independent releases:** Tool can be published to npm or distributed separately

### For Distribution
- **Multiple channels:** npm package, standalone binary, Claude plugin
- **Self-contained:** Tool includes everything it needs (installer, docs)
- **Clean architecture:** Clear boundaries between tool and plugin

## Open Questions

None - design validated.

## References

- Current structure: `plugins/beads-bridge/skills/beads-bridge/`
- Bun workspace docs: https://bun.sh/docs/install/workspaces
- Multi-platform binary builds: `.github/workflows/ci.yml`
