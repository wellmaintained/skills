# Beads Issue Tracker

This directory contains the beads issue tracking database for the wellmaintained-skills repository.

## What is Beads?

[Beads](https://github.com/steveyegge/beads) is a lightweight, git-friendly issue tracker with first-class dependency support. Issues are stored locally in `.beads/beads.db` and synced via JSONL files.

## Issue Prefix

Issues in this repo use the prefix: **wms** (wellmaintained-skills)

Examples: `wms-8ux`, `wms-4qj`, `wms-1xb`

## Quick Start for Agents

**New agent in a fresh worktree?** Start here:

```bash
cat .beads/AGENT_QUICK_START.md
```

This gives you everything you need to grab a task and start working.

## Documentation Files

- **AGENT_QUICK_START.md** - Start here! Generic "grab and go" instructions
- **AGENT_UPGRADE_INSTRUCTIONS.md** - Specific guide for octokit upgrade task
- **AGENT_UPGRADE_TEMPLATE.md** - Detailed template for package upgrade workflow
- **README.md** - This file

## Common Commands

```bash
# See available work
bd ready                              # Show ready tasks (no blockers)
bd list --status open                 # Show all open tasks
bd list --label dependencies          # Show dependency upgrades

# Work on a task
bd show <bead-id>                     # View task details
bd update <bead-id> --status in_progress
bd comment <bead-id> "Update message"
bd close <bead-id> --reason "Done!"

# Get help
bd --help
bd quickstart
```

## Current Tasks

Run `bd list --status open` to see current open tasks.

As of initialization:
- Dependency upgrade tasks (octokit, @shortcut/client, express)
- More tasks will be added as needed

## For Contributors

Issues tracked here are **code-specific technical tasks** like:
- Dependency upgrades
- Bug fixes
- Feature implementations
- Refactoring work

Higher-level project management and cross-repo coordination happens in a separate tracker.

## Database Files

- `beads.db` - SQLite database (gitignored via .beads/.gitignore)
- `issues.jsonl` - JSONL export for git sync (committed)
- `*.jsonl`, `*.meta.json` - Merge driver artifacts (committed)
- `config.yaml` - Beads configuration (committed)
- `metadata.json` - Repo metadata (committed)

## Git Integration

Beads includes:
- **Git hooks** - Prevent race conditions with auto-sync
- **Merge driver** - Smart JSONL merging to prevent conflicts
- **JSONL sync** - Changes are automatically exported to `issues.jsonl`

These are configured automatically during `bd init`.

## No Environment Variables Needed!

Because this repo has its own local beads database, agents working here don't need to set `BEADS_DB` or `BD_ACTOR` environment variables. Just clone/checkout and start using `bd` commands.

## Learn More

- [Beads Documentation](https://github.com/steveyegge/beads)
- [Beads Quickstart](https://github.com/steveyegge/beads#quickstart): Run `bd quickstart`
