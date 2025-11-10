# Beads-Bridge Plugin for Claude Code

[![Test Coverage](https://img.shields.io/badge/coverage-81.75%25-yellow.svg)](./skills/beads-bridge/docs/coverage-report.md)
[![Tests](https://img.shields.io/badge/tests-463%20passing-brightgreen.svg)](./skills/beads-bridge/docs/coverage-report.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Bridge [Beads](https://github.com/steveyegge/beads) issue tracking with GitHub Projects and Shortcut for unified project visibility across multiple repositories.

---

## What Problem Does This Solve?

**The Challenge:** You're working across 5+ repositories, each with its own Beads-tracked issues. Product managers need a unified view of progress, but aggregating data manually is tedious and error-prone.

**The Solution:** beads-bridge automatically:
- Aggregates task completion across all repositories
- Posts progress updates to GitHub Issues or Shortcut Stories
- Generates visual dependency diagrams (Mermaid)
- Detects newly discovered work during implementation
- Keeps project managers informed without manual updates

---

## Features

### Core Capabilities

- **Multi-Repository Aggregation** - Track progress across frontend, backend, mobile, etc.
- **Automatic Progress Updates** - Post comments with completion metrics and diagrams
- **Visual Dependency Trees** - Mermaid diagrams show relationships and blockers
- **Scope Discovery Detection** - Identify work that wasn't in the original plan
- **Bidirectional Sync** - Changes in Beads → updates in PM tool (and vice versa)
- **Smart Scheduling** - Sync during work hours, reduce noise after-hours

### Supported Backends

- **GitHub Projects v2** - Issues, Projects, dependency tracking
- **Shortcut** - Stories, epics, workflows
- **LiveWeb** - Real-time dashboard with interactive dependency graphs
- **Jira** (planned) - Coming soon

---

## Installation

### Via Claude Code Marketplace

```bash
# 1. Add the Well Maintained marketplace
/plugin marketplace add wellmaintained/skills

# 2. Install beads-bridge
/plugin install beads-bridge@wellmaintained
```

The installation script will:
1. Verify Node.js >= 18.0.0
2. Install npm dependencies
3. Build the TypeScript CLI
4. Warn if Beads CLI (`bd`) is not installed

### Manual Installation

If you want to install directly:

```bash
# Clone the marketplace
git clone https://github.com/wellmaintained/skills.git
cd claude-plugins/plugins/beads-bridge

# Run installation
bash .claude-plugin/install.sh
```

---

## Quick Start

See [QUICKSTART.md](./QUICKSTART.md) for a 5-minute getting started guide.

### 1. Authenticate

```bash
# GitHub (OAuth flow)
beads-bridge auth github

# Shortcut (API token)
beads-bridge auth shortcut

# Verify
beads-bridge auth status
```

### 2. Configure Your Project

```bash
cd /path/to/your/project
beads-bridge init --repository owner/repo
```

This creates `.beads-bridge/config.yaml` with your settings.

### 3. Create a Mapping

Link a GitHub issue to Beads epics:

```bash
beads-bridge mapping create \
  --repository owner/repo \
  --issue 123 \
  --epics '[
    {"repository":"frontend","epicId":"frontend-e42","repositoryPath":"../frontend"},
    {"repository":"backend","epicId":"backend-e15","repositoryPath":"../backend"}
  ]'
```

### 4. Use in Claude Conversations

```
User: "What's the status of GitHub issue #123?"

Claude: *uses beads-bridge skill to query aggregated progress*

Output:
- 28/47 tasks completed (60%)
- 2 blockers: backend-t156, frontend-t203
- 3 in progress
- Estimated completion: Nov 15
```

---

## Configuration

### Project Config (`.beads-bridge/config.yaml`)

```yaml
version: "2.0"
backend: github

github:
  repository: "your-org/product-initiatives"

repositories:
  - name: frontend
    path: /absolute/path/to/frontend
  - name: backend
    path: /absolute/path/to/backend

logging:
  level: info
```

### Credentials (`~/.config/beads-bridge/credentials.json`)

Managed via CLI:

```bash
beads-bridge auth github    # OAuth device flow
beads-bridge auth shortcut  # API token prompt
beads-bridge auth status    # Check current state
```

Credentials are encrypted with AES-256-GCM using a machine-specific key.

---

## Usage Examples

### Query Status

```bash
# Get aggregated progress
beads-bridge status --repository owner/repo --issue 123

# Include blocker details
beads-bridge status --repository owner/repo --issue 123 --blockers
```

### Sync Progress

```bash
# Post progress update comment
beads-bridge sync --repository owner/repo --issue 123
```

### Generate Diagrams

```bash
# Add diagram to issue comment
beads-bridge diagram --repository owner/repo --issue 123

# Update issue description instead
beads-bridge diagram --repository owner/repo --issue 123 --placement description
```

### Detect Discoveries

```bash
# Find newly discovered work
beads-bridge discoveries --repository owner/repo --issue 123
```

### Decompose Issues

```bash
# Convert GitHub issue task list into Beads epics
beads-bridge decompose --repository owner/repo --issue 456
```

### Live Dashboard

```bash
# Start interactive dashboard with real-time updates
beads-bridge serve --repository owner/repo --issue 123

# Dashboard opens at http://localhost:3000 with:
# - Interactive dependency graph with zoom/pan
# - Real-time progress updates
# - Task status visualization
# - Blocker highlighting
```

---

## Requirements

- **Node.js** >= 18.0.0
- **Beads CLI** (`bd`) >= v0.21.3
  - Install from: https://github.com/steveyegge/beads
  - **Important:** v0.21.3+ required for scope discovery detection
- **Git repositories** with Beads tracking initialized (`.beads/` directory)
- **For GitHub:** GitHub Projects v2 board (classic projects not supported)
- **For Shortcut:** Shortcut workspace with configured workflow states

---

## Troubleshooting

### "Command not found: beads-bridge"

The CLI should be accessible after installation. Try:

```bash
# Check if installed
ls ~/.claude/plugins/beads-bridge@wellmaintained/skills/beads-bridge/dist/cli.js

# Run directly
node ~/.claude/plugins/beads-bridge@wellmaintained/skills/beads-bridge/dist/cli.js --version
```

### "No mapping found for repository#issue"

You need to create a mapping first:

```bash
beads-bridge mapping create --repository owner/repo --issue 123 --epics '[...]'
```

### "Authentication error"

Check authentication status:

```bash
beads-bridge auth status

# Re-authenticate if needed
beads-bridge auth github
```

### "bd command not found"

Install Beads CLI:

```bash
# macOS/Linux
brew install steveyegge/tap/beads

# Or from source
git clone https://github.com/steveyegge/beads.git
cd beads
go install ./cmd/bd
```

---

## Documentation

- **[Quick Start Guide](./QUICKSTART.md)** - 5-minute getting started
- **[Skill Documentation](./skills/beads-bridge/SKILL.md)** - Complete skill reference
- **[Configuration Guide](./skills/beads-bridge/docs/CONFIGURATION.md)** - Config schema
- **[Authentication Guide](./skills/beads-bridge/docs/AUTHENTICATION.md)** - OAuth setup
- **[LiveWeb Backend](./skills/beads-bridge/docs/LIVEWEB_BACKEND.md)** - Dashboard setup
- **[Test Coverage](./skills/beads-bridge/docs/coverage-report.md)** - Test metrics

---

## Development

Want to contribute? See the [main marketplace CONTRIBUTING.md](../../CONTRIBUTING.md).

### Local Development

```bash
cd skills/beads-bridge

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Type check
npm run typecheck
```

---

## License

MIT License - see [LICENSE](./LICENSE) file for details.

---

## Support

- **Issues:** [GitHub Issues](https://github.com/wellmaintained/skills/issues)
- **Discussions:** [GitHub Discussions](https://github.com/wellmaintained/skills/discussions)
- **Maintainer:** [David Laing](https://github.com/mrdavidlaing)

---

Made by 🤖, overseen by 👨🏻‍💻
