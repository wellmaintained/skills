# Agentic Development Workflow for Beads-Bridge

This document describes the recommended development workflow for AI agents working on beads-bridge, based on best practices from the [beads project](https://github.com/steveyegge/beads).

## Core Principles

Beads is explicitly designed for AI agents as first-class users. This workflow embraces that design:

1. **Agents as Primary Operators** - Agents autonomously manage issues, not just respond to requests
2. **Distributed State via Git** - All issue state in `.beads/issues.jsonl` enables multi-agent coordination
3. **Proactive Issue Filing** - Create issues for discovered work instead of silently passing over problems
4. **Hash-Based IDs** - Collision-resistant IDs (bd-a1b2) enable concurrent multi-agent work without conflicts
5. **JSON-First Interface** - All commands use `--json` for programmatic integration

## Workflow Overview

```
Session Start → Work Execution → Landing the Plane
     ↓               ↓                    ↓
Check ready    Claim task         File remaining work
Orient self    Implement          Run quality gates
Find work      Discover           Sync to git
               File issues        Verify clean
                                  Prepare handoff
```

## Phase 1: Session Initialization

Run this protocol at the start of every session:

### 1.1 First-Time Setup (Once Per Agent)

```bash
# Only if never run before in this repository
bd onboard
```

This provides integration instructions and updates project documentation.

### 1.2 Check Available Work

```bash
# Query issues with no blockers
bd ready --json
```

**Output Example:**
```json
{
  "ready": [
    {
      "id": "bd-a1b2",
      "title": "Add OAuth refresh token handling",
      "priority": 1,
      "type": "feature",
      "blockers": []
    }
  ]
}
```

### 1.3 Decision Tree

**If ready work exists:**
- Claim highest priority item
- Proceed to Phase 2

**If no ready work:**
- Check backlog: `bd list --priority 4 --json`
- Ask user what to work on
- OR explore codebase to understand context

**If context unclear:**
- Use exploration tools to understand codebase first
- File issues for discovered improvements
- Then ask user for direction

## Phase 2: Work Execution

### 2.1 Claim and Understand Task

```bash
# 1. Claim the task
bd update bd-a1b2 --status in_progress --json

# 2. Read full details
bd show bd-a1b2 --json

# 3. Check dependencies
bd dep tree bd-a1b2 --json
```

### 2.2 Development Cycle

**Location:**
```bash
cd /home/mrdavidlaing/baljeet-workspace/pensive/workspace/wellmaintained-skills/plugins/beads-bridge/skills/beads-bridge/
```

**Development Commands:**

```bash
# Interactive development (watch mode)
npm run test:watch

# Make changes...
# ... edit files ...

# Before committing: CI mode tests
npm test  # Non-watch mode for quality gates
npm run build
npm run type-check
```

**Test Strategy:**
- `npm test` - CI mode (non-watch, for quality gates) - **Use this before committing**
- `npm run test:watch` - Interactive development mode - **Use during development**
- `npm test -- --run --coverage` - Coverage analysis

### 2.3 Proactive Issue Discovery

**Key principle:** Don't silently pass over problems. File issues immediately.

**When you find a bug:**
```bash
bd create "Bug: issue-parser doesn't handle empty descriptions" \
  -t bug \
  -p 1 \
  --deps discovered-from:bd-a1b2 \
  --json
```

**When you realize a subtask is needed:**
```bash
bd create "Task: Extract diagram placement logic to separate module" \
  -t task \
  -p 2 \
  --deps parent:bd-a1b2 \
  --json
```

**When you discover a blocker:**
```bash
# 1. Create the blocking issue
bd create "Blocker: Need OAuth token refresh endpoint" \
  -t task \
  -p 0 \
  --json
# Returns: bd-f14c

# 2. Link it as a blocker
bd dep add bd-a1b2 blocks:bd-f14c --json
```

**When you find related work:**
```bash
bd dep add bd-a1b2 related:bd-c3d4 --json
```

### 2.4 Dependency Types

Use appropriate dependency types to articulate relationships:

- `blocks` - This issue prevents progress on another
- `parent` - Parent-child task hierarchy
- `discovered-from` - Found during work on another issue
- `related` - Related work (cross-references)

**Example:**
```bash
# Current task bd-a1b2 is blocked by bd-f14c
bd dep add bd-a1b2 blocks:bd-f14c

# New task bd-e5f6 was discovered while working on bd-a1b2
bd create "..." --deps discovered-from:bd-a1b2

# Task bd-g7h8 is a subtask of epic bd-a1b2
bd create "..." --deps parent:bd-a1b2
```

### 2.5 Continuous State Updates

Update issue state as work progresses:

```bash
# Priority changed
bd update bd-a1b2 --priority 0 --json

# Add notes
bd update bd-a1b2 --notes "Requires refactoring auth module first" --json
```

### 2.6 Quality Gates

Before completing any task:

```bash
# 1. Run tests in CI mode (not watch mode)
npm test

# 2. Build
npm run build

# 3. Type check
npm run type-check
```

**If failures occur:**
```bash
# Create P0 issue for failures
bd create "Fix: Tests failing in auth-wrapper.test.ts" \
  -t bug \
  -p 0 \
  --deps discovered-from:bd-a1b2 \
  --json
```

**Do NOT mark work complete if tests/build fail.**

## Phase 3: Landing the Plane

**CRITICAL:** Never end a session without this protocol. This enables clean handoffs to future sessions (or other agents).

### 3.1 File Remaining Work

Create issues for anything in-progress or discovered:

```bash
# Work left to do
bd create "Continue: Complete OAuth refresh implementation" \
  -t task \
  -p 2 \
  --deps discovered-from:bd-a1b2 \
  --json

# Technical debt found
bd create "Refactor: Extract credential validation to separate module" \
  -t task \
  -p 3 \
  --deps discovered-from:bd-a1b2 \
  --json
```

### 3.2 Run Quality Gates

```bash
# Run full test suite in CI mode
npm test

# Build
npm run build

# Type check
npm run type-check
```

**If failures occur, create P0 issues before proceeding.**

### 3.3 Sync State to Git

Beads auto-syncs after 5-second debounce, but verify:

```bash
# Check if JSONL is modified
git status

# Review changes
git diff .beads/issues.jsonl
```

**Expected output:**
```
modified:   .beads/issues.jsonl
```

### 3.4 Atomic Commit

**ALWAYS commit beads state with code changes together:**

```bash
git add .

git commit -m "$(cat <<'EOF'
feat: add OAuth token refresh handling

Implemented automatic token refresh with retry logic.
Added tests for credential store and OAuth flow.

Beads issues updated:
- bd-a1b2: Completed OAuth refresh implementation
- bd-f14c: Created for token expiry detection
- bd-e5f6: Created for retry backoff refactoring

🤖 Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

**Commit Message Format:**
- Concise summary (50 chars)
- Detailed description (wrap at 72 chars)
- List beads issue changes
- Include attribution footer

### 3.5 Verify Clean State

```bash
# Should show clean working tree
git status

# Show next available work
bd ready --json
```

### 3.6 Prepare Handoff

Provide formatted context for next session:

**Template:**
```markdown
## Session Complete

**Completed:**
- bd-a1b2: OAuth token refresh handling
- Tests passing (463 tests, 81.75% coverage)
- Build successful

**Blocked:**
- bd-g7h8: Waiting for design review (blocks:bd-i9j0)

**Ready Next:**
- bd-c3d4: Implement token rotation scheduler (priority 1)
- bd-k1l2: Add Shortcut workspace discovery (priority 2)

**Important Discoveries:**
- bd-f14c: Token expiry detection needs separate module
- bd-e5f6: Retry logic should use exponential backoff
```

## Multi-Repository Coordination

When changes span multiple repositories:

### Create Linked Epics

```bash
# In frontend repository
cd ~/workspace/frontend
bd create "Epic: Implement auth UI in frontend" -t epic -p 1 --json
# Returns: frontend-e42

# In backend repository
cd ~/workspace/backend
bd create "Epic: Implement auth API in backend" -t epic -p 1 --json
# Returns: backend-e15

# Link them
cd ~/workspace/frontend
bd dep add frontend-e42 related:backend-e15 --json

cd ~/workspace/backend
bd dep add backend-e15 related:frontend-e42 --json
```

### Use Beads-Bridge for Coordination

```bash
# Link epics to GitHub issue via external_ref
bd update frontend-e42 --external-ref "github:owner/repo#123"
bd update backend-e15 --external-ref "github:owner/repo#123"
```

### Sync Status to GitHub

```bash
# Update GitHub issue with progress
beads-bridge sync --repository owner/repo --issue 123

# Generate dependency diagram
beads-bridge diagram --repository owner/repo --issue 123
```

## Anti-Patterns to Avoid

### ❌ Don't Do This

- **Create markdown TODO lists** - Use `bd create` instead
- **Skip "Landing the Plane"** - Future sessions need clean handoffs
- **Commit code without `.beads/issues.jsonl`** - State and code must stay in sync
- **Use `-i` flags** - Interactive mode not supported for agents
- **Batch issue updates** - Update incrementally as work progresses
- **Leave work in-progress** - File continuation issues before ending session
- **Silently pass over problems** - File issues for discovered work
- **Guess at next work** - Always check `bd ready --json`

### ✅ Do This Instead

- **Use `bd ready --json`** - Autonomous work discovery
- **Create issues proactively** - When discovering bugs/tasks/blockers
- **Link issues properly** - Use dependency types (blocks, parent, discovered-from, related)
- **Commit atomically** - Beads state + code changes together
- **Run quality gates** - Tests + build + type-check before session end
- **Provide handoff context** - Next session needs to orient quickly
- **Update incrementally** - Change status/priority as work progresses
- **Trust the system** - Auto-sync and hash-based IDs handle concurrency

## Advanced: Multi-Agent Workflows

Hash-based IDs enable multiple agents to work concurrently:

### Concurrent Development

```bash
# Agent A on branch feature-auth
bd create "Add OAuth support" -t feature -p 1
# Creates: bd-a1b2 (hash-based, unique)

# Agent B on branch feature-diagrams (simultaneously)
bd create "Add Mermaid diagrams" -t feature -p 1
# Creates: bd-c3d4 (different hash, no conflict)

# Both branches can merge without ID conflicts
```

### Best Practices

1. **Separate branches** - Each agent works on own branch
2. **Regular rebasing** - `git pull --rebase` to sync issues
3. **Auto-import** - Beads auto-imports newer JSONL after pull
4. **Conflict resolution** - Use `bd` commands to resolve dependency conflicts

### Merge Protocol

```bash
# Before merging
git pull --rebase origin main

# Beads auto-imports issues from main
# Review any conflicts
bd list --json

# Resolve conflicts if needed
bd dep add bd-a1b2 blocks:bd-e5f6

# Continue with merge
git push origin feature-branch
```

## Comparison: Traditional vs. Beads Agentic

| Aspect | Traditional Workflow | Beads Agentic Workflow |
|--------|---------------------|------------------------|
| Work Discovery | Agent asks "what should I work on?" | Agent checks `bd ready --json` autonomously |
| Task Tracking | Markdown TODOs | Persistent, linkable beads issues |
| Context Handoff | Lost between sessions | Issues survive context resets |
| Status Updates | Manual, often forgotten | Incremental, git-backed |
| Discovery | Silently pass over problems | Proactively file issues |
| Multi-Agent | Conflicts, duplicate work | Hash IDs prevent conflicts |
| State Management | In-memory, fragile | Git-distributed, resilient |

## Quick Reference

### Essential Commands

```bash
# Session start
bd onboard              # First time only
bd ready --json         # Find unblocked work

# Work execution
bd update <id> --status in_progress --json
bd show <id> --json
bd dep tree <id> --json

# Proactive discovery
bd create "..." -t bug|feature|task -p 0-4 --deps discovered-from:<id> --json
bd dep add <id> blocks:<blocker-id> --json

# Quality gates
npm test                # CI mode
npm run build
npm run type-check

# Landing the plane
git add .
git commit -m "..."     # Include beads changes
git status              # Verify clean
bd ready --json         # Show next work
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

## Further Reading

- [Beads Repository](https://github.com/steveyegge/beads) - Official beads documentation
- [Pensive AGENTS.md](../../../../../AGENTS.md) - Project-specific agent instructions
- [Beads-Bridge Architecture](./ARCHITECTURE.md) - Implementation details
- [Test Coverage Report](./coverage-report.md) - Testing strategy and metrics
