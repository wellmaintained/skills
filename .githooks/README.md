# Custom Git Hooks

This directory contains modified bd git hooks that fix staleness issues.

## Why Custom Hooks?

The standard bd hooks (installed via `bd hooks install`) have a bug where `post-merge` only imports JSONL but doesn't export, leaving `jsonl_file_hash` metadata stale. This causes "Database out of sync with JSONL" errors on subsequent commands.

## What's Different?

**post-merge**: Added `bd sync --flush-only` after import to update `jsonl_file_hash` metadata

All other hooks (pre-commit, pre-push, post-checkout) are unchanged from bd v0.23.0.

## Installation

The `scripts/setup-beads-worktree.sh` script automatically configures git to use these hooks:

```bash
git config core.hooksPath .githooks
```

## Manual Installation

If hooks aren't working:

```bash
# Configure git to use custom hooks directory
git config core.hooksPath .githooks

# Make hooks executable
chmod +x .githooks/*
```

## Updating Hooks

If bd updates its hook templates and you want to bring those changes in:

1. Run `bd hooks install` to get latest templates in `.git/hooks/`
2. Copy updated hooks to `.githooks/`:
   ```bash
   cp .git/hooks/pre-commit .githooks/
   cp .git/hooks/pre-push .githooks/
   cp .git/hooks/post-checkout .githooks/
   ```
3. Manually apply the post-merge fix (add flush-only export at end)
4. Ensure all hooks are executable: `chmod +x .githooks/*`

## Hook Descriptions

- **pre-commit**: Flushes pending DB changes to JSONL before commit
- **post-merge**: Imports JSONL after git pull/merge, then exports to sync hashes
- **pre-push**: Prevents pushing stale JSONL
- **post-checkout**: Imports JSONL after branch checkout
