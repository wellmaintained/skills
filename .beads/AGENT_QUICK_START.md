# Agent Quick Start - Grab a Task and Go!

## For Agents Working in a Fresh Worktree

This repo has its own beads issue tracker, but **worktrees must share the database** to coordinate properly.

### IMPORTANT: Set Up Shared Database First

**ALWAYS run this first** in any worktree:

```bash
export BEADS_DB="/home/mrdavidlaing/baljeet-workspace/pensive/workspace/wellmaintained-skills/.beads/beads.db"
export BD_ACTOR="agent-$(whoami)-$$"  # Unique ID for tracking
```

**Why?** Git worktrees don't share the `.beads/` folder. Without these env vars:
- ❌ You'll initialize a separate database (bad!)
- ❌ You won't see other agents' work
- ❌ You might claim the same task as another agent

**With env vars:**
- ✅ All agents share one database
- ✅ You see task status in real-time
- ✅ No duplicate work

**Verify it worked:**
```bash
bd info  # Should show the shared database path
```

### Step 1: See What's Available

```bash
# Show all open tasks
bd list --status open

# Show ready-to-work tasks (no blockers)
bd ready

# Show dependency upgrade tasks specifically
bd list --label dependencies --status open
```

### Step 2: Pick a Task

Choose any open task that interests you. Tasks are labeled by priority and risk:
- **P0-P1**: High priority
- **P2**: Medium priority
- **P3-P4**: Low priority

Risk levels:
- **Medium risk**: octokit, @shortcut/client - Good starting points
- **HIGH risk**: express - Requires extra care

### Step 3: Claim It (IMPORTANT: Race Condition Prevention!)

**Before claiming, verify it's still available:**

```bash
# Double-check the task is still open
bd show <bead-id> --json | grep '"status"'

# If it shows "open", claim it IMMEDIATELY:
bd update <bead-id> --status in_progress
bd comment <bead-id> "Agent ${BD_ACTOR} starting work. Will post updates as I progress."
```

**Why this matters:** Multiple agents might be running `bd ready` at the same time. Always:
1. Check status right before claiming
2. Claim immediately (don't wait)
3. Identify yourself in the first comment (use $BD_ACTOR)

If another agent claimed it first, you'll see `status: in_progress` - pick a different task!

### Step 4: Read Task Details

```bash
bd show <bead-id>
```

The task description includes:
- What needs to be done
- Where to work (usually `plugins/beads-bridge/skills/beads-bridge`)
- Success criteria
- Risk level

### Step 5: Follow the Standard Workflow

For **dependency upgrades**, follow this pattern:

#### 1. Research First
```bash
# Search for migration guides and breaking changes
# Post findings:
bd comment <bead-id> "Research complete. Breaking changes: [list]"
```

#### 2. Analyze Code
```bash
cd plugins/beads-bridge/skills/beads-bridge
grep -r "<package-name>" src/ tests/

# Post analysis:
bd comment <bead-id> "Found N usages in [files]. Complexity: [low/medium/high]"
```

**SMART TIP**: If the package is unused (like zod was), remove it instead of upgrading!

#### 3. Make Changes
```bash
npm install <package>@<version>
# Fix any breaking changes in code
bd comment <bead-id> "Upgrade applied. Fixed [describe changes]"
```

#### 4. Test Everything
```bash
npm run type-check
npm run lint
npm test
npm audit

# Post results:
bd comment <bead-id> "✅ All checks passing: types ✓, lint ✓, tests 437 passed ✓, 0 vulnerabilities ✓"
```

#### 5. Complete the Task
```bash
bd comment <bead-id> "✅ SUCCESS: [summary of what you did]"
bd close <bead-id> --reason "Task complete and tested"
```

### Step 6: Commit Your Work

```bash
git add .
git commit -m "chore(beads-bridge): [brief description]

[More details]

Closes: <bead-id>"
```

## Communication Guidelines

**Post updates frequently!** Don't go silent. After each major step, post a comment so others can track your progress.

Good comment examples:
- "Research complete. Found X breaking changes: [list]"
- "Code analysis done. Package is used in 5 files, medium complexity"
- "Upgrade applied. Fixed API changes in src/backends/github.ts"
- "Tests passing. Ready to close."

If you get stuck:
```bash
bd comment <bead-id> "⚠️ BLOCKED: [describe issue]. Need help with [specific question]"
bd update <bead-id> --status blocked
```

## Reference Documents

- **Task-specific details**: Read `.beads/AGENT_UPGRADE_INSTRUCTIONS.md` for current octokit task
- **General template**: Read `.beads/AGENT_UPGRADE_TEMPLATE.md` for workflow patterns
- **Best practices**: See example from previous zod agent (removed unused package instead of upgrading)

## Project Structure

```
plugins/beads-bridge/skills/beads-bridge/   ← Your workspace
├── package.json                            ← Dependencies to upgrade
├── src/                                    ← Source code
│   ├── backends/                          ← GitHub/Shortcut integration
│   ├── clients/                           ← API clients
│   └── ...
├── tests/                                  ← Test files
└── dist/                                   ← Build output (gitignored)
```

## Success Criteria (Standard)

For any task, ensure:
- [ ] All changes made and tested
- [ ] Type checking passes (`npm run type-check`)
- [ ] Linter passes with 0 errors (`npm run lint`)
- [ ] All tests pass (437 passed, 4 skipped)
- [ ] No new vulnerabilities (`npm audit`)
- [ ] Bead updated with comments throughout
- [ ] Bead closed with final summary
- [ ] Clean commit with descriptive message

## Example: Previous Agent's Excellent Work

A previous agent was asked to upgrade zod. Here's what they did right:

1. ✅ **Researched first** - Documented all breaking changes before touching code
2. ✅ **Analyzed code** - Ran grep to find all usages
3. ✅ **Discovered insight** - Found zod was completely unused!
4. ✅ **Made smart decision** - Removed it instead of upgrading (better outcome)
5. ✅ **Tested thoroughly** - All 437 tests still passed
6. ✅ **Communicated clearly** - Posted 6 detailed comments tracking progress
7. ✅ **Closed properly** - Summary comment + closed with reason

**Be like that agent!** Think critically, communicate frequently, test thoroughly.

## Quick Command Reference

```bash
# List tasks
bd list --status open
bd ready

# Claim task
bd update <bead-id> --status in_progress

# Track progress
bd comment <bead-id> "Message here"

# Complete task
bd close <bead-id> --reason "Done!"

# Get help
bd show <bead-id>        # Show task details
bd --help                # Show all commands
```

## Ready to Start?

1. Run `bd ready` to see what's available
2. Pick a task
3. Update it to `in_progress`
4. Start working!

Good luck! 🚀
