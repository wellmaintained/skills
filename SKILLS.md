# Skills Available in wellmaintained Marketplace

This document provides a comprehensive guide to all skills available in the wellmaintained marketplace. Skills are specialized capabilities that Claude Code uses automatically when you ask questions or request work related to their domain.

> **For Skill Authors:** When adding new skills to this marketplace, please update this document with your skill's information following the template at the end of this file.

---

## What are Skills?

Skills are Claude Code's way of extending capabilities with domain-specific knowledge and tooling. When you ask Claude to perform tasks, it automatically identifies and invokes the appropriate skill based on your request. You don't need to explicitly call skills - Claude uses them when relevant.

**How it works:**
1. You ask Claude to do something (e.g., "What's the status of issue #123?")
2. Claude recognizes keywords and context that match a skill's description
3. Claude automatically invokes that skill to complete your request
4. You get the results without needing to know which skill was used

---

## Quick Reference

| Skill Name | Plugin | Description | Use When |
|------------|--------|-------------|----------|
| beads-bridge | beads-bridge | Bridge Beads issue tracking with GitHub/Shortcut | Tracking multi-repo work, syncing progress, generating dependency diagrams |

---

## Detailed Skill Documentation

### beads-bridge

**Plugin:** `beads-bridge@wellmaintained`
**Version:** 2.0.0
**Author:** David Laing

**When Claude uses this:**
- Tracking status of Beads epics across multiple repositories
- Syncing progress updates to GitHub Issues or Shortcut Stories
- Generating Mermaid dependency diagrams
- Detecting newly discovered work during implementation
- Managing mappings between project management tools and Beads epics
- Decomposing issue task lists into Beads epics and tasks

#### What it does

This skill bridges Beads (a git-backed multi-repository issue tracker) with project management tools like GitHub Projects v2 and Shortcut. It enables teams working across multiple repositories to maintain a unified view of work while preserving detailed technical tracking in Beads.

**Perfect for:**
- **Tech Leads:** Monitor progress across 5+ repositories from a single GitHub Projects board
- **Product Managers:** Get accurate completion estimates based on actual dependency analysis
- **Engineering Teams:** Automatically propagate discovered work to project tracking
- **Stakeholders:** View real-time progress with auto-updating diagrams and metrics

#### Key Capabilities

- **Query Status** - Get aggregated progress across GitHub Issues/Shortcut Stories and Beads epics
- **Sync Progress** - Automatically post progress updates from Beads to GitHub/Shortcut with metrics and diagrams
- **Generate Diagrams** - Create Mermaid dependency visualizations showing cross-repository relationships
- **Detect Discoveries** - Identify newly discovered work during implementation (scope creep detection)
- **Manage Mappings** - Create and query links between GitHub Issues/Shortcut Stories and Beads epics
- **Decompose Tasks** - Convert issue/story task lists into structured Beads epics and tasks
- **Force Sync** - Immediate synchronization of multiple operations (progress, diagrams, discoveries)

#### How it Works

The skill operates on **mappings** - links between a single GitHub Issue or Shortcut Story (tracking the initiative) and one or more Beads epics (tracking the technical implementation across repositories).

```
GitHub Issue #123 → Mapping → [frontend-e42, backend-e15, shared-e8]
```

Each mapping enables:
- Aggregated progress from all repositories
- Dependency trees showing technical relationships
- Scope discovery detection across repos
- Real-time synchronization of status

#### Example Queries

**Status & Progress:**
- "What's the status of the authentication redesign work in GitHub issue #123?"
- "Update progress for issue #456"
- "Show me completion metrics for story 89216"
- "Check blockers for issue #789"

**Visualization:**
- "Show me the dependency tree for issue #123"
- "Generate a diagram of all epics for story 45678"
- "Create a Mermaid chart showing cross-repo dependencies"

**Scope Management:**
- "Check if any new work was discovered during implementation of #123"
- "Detect scope creep for story 89216"
- "Show me high-priority discoveries for issue #456"

**Mapping & Setup:**
- "Link GitHub issue #456 to frontend-e99 and backend-e42"
- "Create a mapping between story 89216 and pensive-e123"
- "Show me all epics linked to issue #789"

**Task Decomposition:**
- "Decompose GitHub issue #789 into Beads epics and tasks"
- "Break down story 45678 into tracked work across repositories"
- "Convert this issue's task list into Beads structure"

**Synchronization:**
- "Sync everything for issue #123 right now"
- "Force sync progress, diagrams, and discoveries for story 89216"
- "Update all tracking information for issue #456"

#### Prerequisites

**Required tools:**
- Node.js >= 18.0.0
- Beads CLI (`bd`) >= v0.21.3
- Git repositories with Beads initialized
- GitHub CLI (`gh`) with authentication (for GitHub backend)
- Shortcut API token (for Shortcut backend)

**Configuration:**
The skill uses `.beads-bridge/config.json` in your project root. Initialize with:

```bash
# For GitHub
beads-bridge init --repository owner/repo

# For Shortcut
beads-bridge init --backend shortcut --repository owner/repo
```

Example GitHub configuration:
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
  ]
}
```

#### Installation

1. **Add the wellmaintained marketplace** (one-time setup):
   ```bash
   /plugin marketplace add wellmaintained/skills
   ```

2. **Install the beads-bridge plugin:**
   ```bash
   /plugin install beads-bridge@wellmaintained
   ```

3. **Authenticate with GitHub or Shortcut:**
   ```bash
   beads-bridge auth github
   # or
   beads-bridge auth shortcut
   ```

4. **Initialize configuration in your project:**
   ```bash
   cd /path/to/your/project
   beads-bridge init --repository owner/repo
   ```

**Full documentation:**
- [Installation Guide](./plugins/beads-bridge/docs/INSTALLATION.md)
- [Quick Start](./plugins/beads-bridge/QUICKSTART.md)
- [CLI Reference](./plugins/beads-bridge/docs/CLI_REFERENCE.md)
- [Architecture Details](./plugins/beads-bridge/docs/ARCHITECTURE.md)
- [Troubleshooting](./plugins/beads-bridge/docs/TROUBLESHOOTING.md)

#### Performance

- Query status: ~500ms per epic (with local caching)
- Generate diagram: ~1-2s for 50 nodes
- Detect discoveries: ~300ms per epic
- Sync operations: Parallelized across epics (3 concurrent max)

#### Security

- Credentials stored separately from config
- Encrypted using AES-256-GCM with machine-specific key
- OAuth tokens refreshable via `beads-bridge auth` commands
- Location: `~/.config/beads-bridge/credentials.json` (encrypted)
- No external services or network calls except GitHub/Shortcut API

---

## Contributing New Skills

When adding a new skill to this marketplace, please update this document with your skill's information.

### Template for New Skills

```markdown
### [skill-name]

**Plugin:** `plugin-name@wellmaintained`
**Version:** x.y.z
**Author:** Your Name

**When Claude uses this:**
- [Trigger condition 1]
- [Trigger condition 2]
- [Trigger condition 3]

#### What it does

[2-3 paragraph description of what the skill does and who it's for]

**Perfect for:**
- **[Role 1]:** [Benefit]
- **[Role 2]:** [Benefit]

#### Key Capabilities

- **[Capability 1]** - [Description]
- **[Capability 2]** - [Description]
- **[Capability 3]** - [Description]

#### Example Queries

**[Category 1]:**
- "[Example query 1]"
- "[Example query 2]"

**[Category 2]:**
- "[Example query 3]"
- "[Example query 4]"

#### Prerequisites

**Required tools:**
- [Tool 1] >= version
- [Tool 2] >= version

**Configuration:**
[Brief description of any required configuration]

#### Installation

1. **Add the wellmaintained marketplace** (one-time setup):
   ```bash
   /plugin marketplace add wellmaintained/skills
   ```

2. **Install the plugin:**
   ```bash
   /plugin install plugin-name@wellmaintained
   ```

3. **[Additional setup steps if needed]**

**Full documentation:**
- [Link to plugin README](./plugins/plugin-name)
- [Link to other relevant docs]
```

### Adding Your Skill to Quick Reference

Update the Quick Reference table at the top of this document:

```markdown
| [skill-name] | plugin-name | [Brief description] | [When to use] |
```

---

## Questions or Issues?

- **General marketplace questions:** [Open an issue](https://github.com/wellmaintained/skills/issues)
- **Plugin-specific questions:** See the plugin's README for contact information
- **Contributing:** See [CONTRIBUTING.md](./CONTRIBUTING.md)

---

**Made by 🤖, overseen by 👨🏻‍💻**
