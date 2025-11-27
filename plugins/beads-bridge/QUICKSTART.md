# Beads-Bridge Quick Start

Get up and running with beads-bridge in under 5 minutes.

---

## Prerequisites

Before you begin, ensure you have:

- [ ] **Node.js >= 18.0.0** installed ([download](https://nodejs.org/))
- [ ] **Beads CLI (`bd`) >= v0.21.3** installed ([install guide](https://github.com/steveyegge/beads#installation))
- [ ] At least one repository with Beads tracking initialized
- [ ] A GitHub or Shortcut account with API access

---

## Installation (2 minutes)

### Step 1: Add the Marketplace

```bash
/plugin marketplace add wellmaintained/skills
```

### Step 2: Install beads-bridge

```bash
/plugin install beads-bridge@wellmaintained
```

You'll see output like:

```
🔧 Installing beads-bridge dependencies...
📦 Installing npm dependencies...
🔨 Building beads-bridge...
✅ beads-bridge installed successfully!
```

---

## Authentication (2 minutes)

### For GitHub

```bash
beads-bridge auth github
```

This will:
1. Open a browser window
2. Show you a device code
3. Prompt you to authenticate
4. Save credentials locally (encrypted)

### For Shortcut

```bash
beads-bridge auth shortcut
```

You'll be prompted to enter your Shortcut API token:
1. Go to https://app.shortcut.com/settings/account/api-tokens
2. Create a new token
3. Paste it when prompted

### Verify Authentication

```bash
beads-bridge auth status
```

Expected output:

```json
{
  "github": {
    "authenticated": true,
    "type": "oauth",
    "expiresAt": "2025-12-06T..."
  },
  "shortcut": {
    "authenticated": true,
    "type": "api_key"
  }
}
```

---

## Configuration (1 minute)

Navigate to your project and initialize:

```bash
cd /path/to/your/project
beads-bridge init --repository your-org/your-repo
```

This creates `.beads-bridge/config.yaml`:

```yaml
version: "2.0"
backend: github
github:
  repository: "your-org/your-repo"
repositories:
  - name: myproject
    path: /absolute/path/to/myproject
logging:
  level: info
```

Edit if needed to add more repositories.

---

## First Use (30 seconds)

### Link via `external_ref`

```bash
bd update myproject-e1 --external-ref "github:your-org/your-repo#123"
```

This lets the skill discover related epics without additional commands.

### Query Status

In a Claude Code conversation, simply ask:

```
User: "What's the status of GitHub issue #123?"
```

Claude will automatically use the beads-bridge skill to:
1. Resolve the external reference
2. Query all linked Beads epics
3. Aggregate progress across repositories
4. Return a summary with blockers and metrics

---

## Common Commands

### Status Queries

```bash
# Basic status
beads-bridge status -r owner/repo -i 123

# Include blocker details
beads-bridge status -r owner/repo -i 123 --blockers
```

### Progress Updates

```bash
# Post progress comment to GitHub
beads-bridge sync -r owner/repo -i 123
```

### Diagrams

```bash
# Add Mermaid diagram to comment
beads-bridge diagram -r owner/repo -i 123

# Update issue description instead
beads-bridge diagram -r owner/repo -i 123 --placement description
```

### Live Dashboard

```bash
# Start interactive dashboard with real-time updates
beads-bridge serve -r owner/repo -i 123

# Opens browser at http://localhost:3000 with:
# - Interactive dependency graph (zoom/pan)
# - Real-time progress updates
# - Visual task status
# - Blocker highlighting
```

### External References

```bash
# Ensure each epic or story has the upstream reference
bd update frontend-e42 --external-ref "github:owner/repo#123"
```

---

## Example Workflow

### 1. Create a GitHub tracking issue

```markdown
# Authentication Redesign

Track implementation across repositories.

## Repositories
- frontend: Login UI, session management
- backend: OAuth endpoints, token refresh
- shared-lib: Auth types and helpers
```

### 2. Create Beads epics in each repository

```bash
cd frontend
bd epic create "frontend-e42" "Authentication UI"

cd ../backend
bd epic create "backend-e15" "OAuth Implementation"

cd ../shared-lib
bd epic create "shared-e8" "Auth Types"
```

### 3. Link via `external_ref`

```bash
bd update frontend-e42 --external-ref "github:your-org/product-initiatives#456"
bd update backend-e15 --external-ref "github:your-org/product-initiatives#456"
bd update shared-e8 --external-ref "github:your-org/product-initiatives#456"
```

### 4. Let Claude track progress

In any Claude Code conversation:

```
User: "Update the status of the authentication redesign (issue #456)"

Claude: *runs beads-bridge sync*
Posted progress update:
- 12/28 tasks completed (43%)
- 2 blockers found
- 5 tasks in progress
```

---

## Troubleshooting

### Issue: "beads-bridge: command not found"

**Solution:**

```bash
# Check installation path
ls ~/.claude/plugins/beads-bridge@wellmaintained/

# Run directly if needed
node ~/.claude/plugins/beads-bridge@wellmaintained/skills/beads-bridge/dist/cli.js --version
```

### Issue: "No external reference found for repository#123"

**Solution:** Ensure each relevant epic has `external_ref` set (see step 3 in Example Workflow above).

### Issue: "Authentication failed"

**Solution:**

```bash
# Check status
beads-bridge auth status

# Re-authenticate
beads-bridge auth github  # or shortcut
```

### Issue: "bd command not found"

**Solution:** Install Beads CLI:

```bash
# macOS/Linux with Homebrew
brew install steveyegge/tap/beads

# Or from source
git clone https://github.com/steveyegge/beads.git
cd beads
go install ./cmd/bd
```

---

## Next Steps

- **[Full Documentation](./README.md)** - Complete feature reference
- **[Skill Guide](./skills/beads-bridge/SKILL.md)** - How Claude uses this skill
- **[Configuration](./skills/beads-bridge/docs/CONFIGURATION.md)** - Advanced config options
- **[LiveWeb Dashboard](./skills/beads-bridge/docs/LIVEWEB_BACKEND.md)** - Dashboard setup guide
- **[GitHub Discussions](https://github.com/wellmaintained/skills/discussions)** - Ask questions

---

**Need help?** [Open an issue](https://github.com/wellmaintained/skills/issues) or reach out in [Discussions](https://github.com/wellmaintained/skills/discussions).

**Happy tracking! 🚀**
