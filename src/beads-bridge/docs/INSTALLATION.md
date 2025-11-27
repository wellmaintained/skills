# Installation Guide

Complete installation and setup guide for beads-bridge.

## Prerequisites

### Required

- **Node.js** >= 18.0.0
- **npm** or **pnpm**
- **Beads CLI** (`bd`) >= v0.21.3
  - **Important**: v0.21.3+ required for scope discovery detection
  - This version includes the `dependency_type` field in `bd show --json` output
  - Earlier versions will cause discovery detection to fail
  - Install from: https://github.com/steveyegge/beads

### Repository Requirements

- Git repositories with Beads tracking initialized (`.beads/` directory)
- For GitHub backend: GitHub Projects v2 board (classic projects not supported)
- For Shortcut backend: Shortcut workspace with configured workflow states

### No CLI Tools Required

The beads-bridge skill no longer requires `gh` (GitHub CLI) or `short` (Shortcut CLI). Authentication is handled via built-in OAuth.

## Installation Methods

### 1. Global Installation (Recommended for CLI usage)

```bash
npm install -g beads-bridge
```

Verify installation:
```bash
beads-bridge --version
```

### 2. Local Development Installation

For Claude Code skills or development:

```bash
cd .claude/skills/beads-bridge
npm install
npm run build
```

Run via Node:
```bash
node dist/cli.js --version
```

### 3. Claude Code Auto-Installation

When Claude first uses this skill, it automatically installs and builds:

```bash
# Navigate to skill directory
cd .claude/skills/beads-bridge

# Check if already installed
if [ ! -d "node_modules" ]; then
  echo "Installing beads-bridge skill dependencies..."
  pnpm install
  pnpm run build
fi

# Verify CLI is available
pnpm exec beads-bridge --version
```

## Authentication

### GitHub Authentication

```bash
beads-bridge auth github
```

This initiates OAuth device flow:
1. CLI displays a device code
2. Opens browser to https://github.com/login/device
3. Enter the device code
4. Authorize beads-bridge application
5. CLI receives OAuth token and stores it securely

**Required scopes:**
- `repo` - For private repositories
- `public_repo` - For public repositories

### Shortcut Authentication

```bash
beads-bridge auth shortcut
```

Enter your Shortcut API token when prompted.

**Getting a token:**
1. Log into Shortcut web UI
2. Go to Settings → API Tokens
3. Create new token with "Write" permissions
4. Copy token and paste into CLI prompt

### Verify Authentication

```bash
beads-bridge auth status
```

Expected output:
```json
{
  "github": {
    "authenticated": true,
    "user": "your-username"
  },
  "shortcut": {
    "authenticated": true,
    "workspace": "your-workspace"
  }
}
```

### Credential Storage

Credentials are stored securely:
- **Location**: `~/.config/beads-bridge/credentials.json`
- **Encryption**: AES-256-GCM with machine-specific key
- **Permissions**: `600` (owner read/write only)
- **Refreshable**: Run auth commands again to update

## Configuration

### Initialize Configuration

For GitHub backend:
```bash
cd /path/to/your/project
beads-bridge init --repository owner/repo
```

For Shortcut backend:
```bash
beads-bridge init --backend shortcut --repository owner/repo
```

This creates `.beads-bridge/config.json` with default settings.

### GitHub Configuration Example

```json
{
  "version": "2.0",
  "backend": "github",
  "github": {
    "repository": "acme-corp/product-initiatives"
  },
  "repositories": [
    {
      "name": "frontend",
      "path": "/absolute/path/to/frontend"
    },
    {
      "name": "backend",
      "path": "/absolute/path/to/backend"
    }
  ],
  "logging": {
    "level": "info"
  }
}
```

### Shortcut Configuration Example

```json
{
  "version": "2.0",
  "backend": "shortcut",
  "shortcut": {
    "workspace": "your-workspace-name"
  },
  "repositories": [
    {
      "name": "pensive",
      "path": "/Users/you/workspace/pensive"
    }
  ],
  "logging": {
    "level": "info"
  }
}
```

### Configuration Fields

#### Required Fields

- `version` - Config version (currently "2.0")
- `backend` - Backend type ("github" or "shortcut")
- `repositories` - Array of Beads repositories

#### Backend-Specific Fields

**For GitHub:**
- `github.repository` - GitHub repository in "owner/repo" format

**For Shortcut:**
- `shortcut.workspace` - Shortcut workspace name

#### Optional Fields

- `logging.level` - Log level ("debug", "info", "warn", "error")
- `logging.file` - Log file path (default: stdout)
- `cache.enabled` - Enable local caching (default: true)
- `cache.ttl` - Cache TTL in seconds (default: 300)
- `sync.maxConcurrency` - Max parallel operations (default: 3)

### Repository Configuration

Each repository in the `repositories` array must have:

```json
{
  "name": "repository-name",
  "path": "/absolute/path/to/repository"
}
```

**Important:**
- Paths must be absolute, not relative
- Each repository must have `.beads/` directory (Beads initialized)
- Repository names must match prefixes used in task lists (e.g., `[frontend]`)

## Post-Installation Setup

### 1. Verify Beads CLI

```bash
bd --version
# Should be >= v0.21.3

bd status
# Should show Beads is tracking repositories
```

### 2. Test Configuration

```bash
cd /path/to/your/project

# Verify config is valid
beads-bridge config validate

# Test Beads repository access
beads-bridge config test
```

### 3. Link Epics via `external_ref`

For GitHub:
```bash
bd update frontend-e42 --external-ref "github:owner/repo#123"
```

For Shortcut:
```bash
bd update pensive-8e2d --external-ref "shortcut:89216"
```

### 4. Test Status Query

For GitHub:
```bash
beads-bridge status --repository owner/repo --issue 123
```

For Shortcut:
```bash
beads-bridge shortcut-status --story 89216
```

Expected output:
```json
{
  "success": true,
  "data": {
    "totalTasks": 12,
    "completed": 5,
    "inProgress": 3,
    "blocked": 1,
    "open": 3,
    "percentComplete": 42
  }
}
```

## Upgrading

### From v1.x to v2.0

Version 2.0 introduces breaking changes:

1. **Config format changed** - Run migration:
```bash
beads-bridge migrate --from 1.x --to 2.0
```

2. **Authentication moved** - Re-authenticate:
```bash
beads-bridge auth github
beads-bridge auth shortcut
```

3. **Mapping storage changed** - Mappings automatically migrated on first run

### Regular Updates

```bash
# Global installation
npm update -g beads-bridge

# Local installation
cd .claude/skills/beads-bridge
npm update
npm run build
```

Check for updates:
```bash
beads-bridge --version
# Compare with latest: https://github.com/your-org/beads-bridge/releases
```

## Uninstalling

### Remove Global Installation

```bash
npm uninstall -g beads-bridge
```

### Remove Credentials

```bash
rm -rf ~/.config/beads-bridge/
```

### Remove Project Configuration

```bash
cd /path/to/your/project
rm -rf .beads-bridge/
```

**Note**: This removes mappings and configuration but does not affect Beads data in repositories.

## Troubleshooting Installation

### npm Permission Errors

If you get permission errors during global install:

```bash
# Option 1: Use npx
npx beads-bridge --version

# Option 2: Configure npm to use user directory
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g beads-bridge
```

### Node Version Issues

If you have the wrong Node version:

```bash
# Using nvm
nvm install 18
nvm use 18
node --version  # Should show v18.x.x

# Using n
npm install -g n
n 18
node --version
```

### Build Failures

If TypeScript compilation fails:

```bash
cd .claude/skills/beads-bridge

# Clear caches
rm -rf node_modules dist
npm cache clean --force

# Reinstall
npm install
npm run build
```

### Beads CLI Not Found

If `bd` command is not found:

```bash
# Check PATH
which bd

# Add to PATH (if installed but not in PATH)
export PATH="$HOME/.local/bin:$PATH"
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc

# Reinstall Beads
# Follow instructions at: https://github.com/steveyegge/beads
```

## Next Steps

After successful installation:

1. Read the [CLI Reference](CLI_REFERENCE.md) for command syntax
2. Review [Architecture](ARCHITECTURE.md) to understand how it works
3. Check [Troubleshooting](TROUBLESHOOTING.md) for common issues
4. Create your first mapping and sync progress
