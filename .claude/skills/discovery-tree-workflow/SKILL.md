---
name: discovery-tree-workflow
description: Use when planning and tracking work - creates visible, emergent work breakdown using bd (beads) with just-in-time planning and hierarchical task trees
---

# Discovery Tree Workflow

## Overview

Discovery Trees make work visible through hierarchical task breakdown that emerges just-in-time. Track work with bd (beads), grow the tree as you discover new requirements, maintain focus by capturing distractions.

**Core principle:** Start minimal, plan just-in-time, grow through discovery, make status visible.

**Announce at start:** "I'm using the Discovery Tree workflow to track this work with bd."

## When to Use

**Always use when:**
- Starting any non-trivial work (more than a single simple task)
- Planning features, bugs, or investigations
- Working with multiple related tasks
- Need to make progress visible
- Want to capture emergent work without losing focus

**Instead of:**
- TodoWrite for tracking progress
- Upfront detailed planning
- Hidden mental task lists
- Linear task lists that don't show relationships

## Core Philosophy

### Just-in-Time Planning
- Start with minimal detail (one task describing user value)
- Have short conversations (2-10 minutes) to break down next steps
- Don't plan everything upfront - plan what you need now
- Delays planning until the last responsible moment

### Emergent Work
- New requirements discovered during work → add to tree
- Unexpected complexity → break down further
- Distractions or ideas → capture as tasks, mark low priority
- Tree grows organically as understanding deepens

### Visual Status
- Color by status (open, in_progress, closed, blocked)
- Progress visible at a glance
- No context needed to see what's done, active, remaining
- Bottom-up view shows full context for any task

## The Discovery Tree Workflow

### 1. Create Root Epic and Task

Every Discovery Tree starts with an epic (container) and a root task (actual work):

```bash
# Create epic (container for all work)
bd create "Feature: User Authentication" -t epic -p 1 --json

# Create root task (describes the user value)
bd create "User Authentication [root]" -t task -p 1 --json

# Link root task to epic
bd dep add <root-task-id> <epic-id> -t parent-child
```

**Why both epic and root task?**
- Epic: Container that tracks overall completion
- Root task: Actual work item that can have subtasks

### 2. Initial Breakdown Conversation

Have a quick conversation (2-10 minutes) to identify first level of work:

**Questions to ask:**
- "What are the main pieces of this?"
- "What do we need to understand first?"
- "What can we start with minimal detail?"

**Create tasks for what you discover:**

```bash
# Create main tasks
bd create "API endpoint for login" -t task -p 1 --json
bd create "Password validation logic" -t task -p 1 --json
bd create "Session management" -t task -p 1 --json

# Link them to root task
bd dep add <task-id> <root-task-id> -t parent-child
```

**Don't over-plan:** Stop when you have enough to start. More detail emerges as you work.

### 3. Start Working

Pick a task and claim it:

```bash
bd update <task-id> --status in_progress
```

**As you work:**
- Discover subtasks needed? Create and link them
- Find blocking issues? Create with `blocked` status
- Get distracted by ideas? Create low-priority task to bookmark

```bash
# Discovered more work
bd create "Validate email format" -t task -p 1 --json
bd dep add <subtask-id> <parent-task-id> -t parent-child

# Found blocker
bd create "Database schema needs user table" -t task -p 0 --json
bd update <current-task-id> --status blocked
```

### 4. Complete and Continue

When task is done:

```bash
bd close <task-id> --reason "Completed"
```

**IMPORTANT: Update parent task with what was accomplished:**

```bash
# View parent task to see current state
bd show <parent-task-id>

# Update parent with accumulated progress
bd update <parent-task-id> --notes "Completed: <what-you-just-did>. Previously: <what-was-done-before>"
# OR update the description to reflect ALL completed subtasks
bd update <parent-task-id> --description "Updated description reflecting all work done so far"
```

This keeps the parent task's context accurate as subtasks complete, similar to how jj-change-workflow updates commit messages after squashing.

Check progress:

```bash
bd epic status --no-daemon
```

**If more work remains:** Claim next task, repeat cycle

**If work emerges:** Add to tree, keep going

**If blocked:** Mark blocked, work on unblocked tasks

### 5. View Progress

**Bottom-up view (from any task):**
```bash
bd dep tree <task-id>
# Shows: current task → parent → grandparent → root
```

**Epic completion:**
```bash
bd epic status --no-daemon
# Shows: progress percentage for each epic
```

**See what's ready to work:**
```bash
bd ready
# Shows: all unblocked open tasks
```

## Integration with Skills

### With TDD
1. Create task for feature
2. TDD cycle: RED → GREEN → REFACTOR
3. If new test reveals complexity → create subtask
4. Close task when all tests pass

### With Example-Driven Design
1. Create task for user story
2. EXAMPLE phase discovers API shape → might create subtasks
3. Each phase completion → progress visible in tree
4. CHECK phase → close task or create next example task

### With Mikado Method
1. Discover prerequisite → create task with `discovered-from` dependency
2. Each prerequisite becomes subtask
3. Work on leaf tasks (no dependencies)
4. Close prerequisites, return to parent

## Quick Reference

| Action | Command |
|--------|---------|
| Create epic | `bd create "Epic name" -t epic -p 1 --json` |
| Create root task | `bd create "Root [root]" -t task -p 1 --json` |
| Link to parent | `bd dep add <child-id> <parent-id> -t parent-child` |
| Claim task | `bd update <task-id> --status in_progress` |
| Complete task | `bd close <task-id> --reason "Done"` |
| Update parent after subtask | `bd update <parent-id> --notes "Completed: X"` |
| View tree | `bd dep tree <task-id>` |
| Check progress | `bd epic status --no-daemon` |
| Find ready work | `bd ready` |
| Mark blocked | `bd update <task-id> --status blocked` |

## Common Patterns

### Capture Distractions
```bash
# Something came up while working
bd create "Refactor utils.ts for clarity" -t task -p 3 --json
bd dep add <distraction-id> <current-parent-id> -t parent-child
# Now it's captured, back to current work
```

### Break Down Complex Task
```bash
# Realized task is bigger than expected
bd create "Part 1: Schema validation" -t task -p 1 --json
bd create "Part 2: Error handling" -t task -p 1 --json
bd dep add <subtask1-id> <complex-task-id> -t parent-child
bd dep add <subtask2-id> <complex-task-id> -t parent-child
bd update <complex-task-id> --status open  # Parent stays open until children done
```

### Handle Discovered Prerequisites
```bash
# Found something that must be done first
bd create "Add user_id column to sessions table" -t task -p 0 --json
bd dep add <current-task-id> <prerequisite-id> -t blocks
bd update <current-task-id> --status blocked
bd update <prerequisite-id> --status in_progress
```

## Red Flags

**STOP if you catch yourself:**
- Planning all details upfront before starting work
- Using TodoWrite instead of bd for multi-step work
- Keeping task breakdown in your head instead of bd
- Not capturing emerged work because "it's small"
- Marking tasks complete without using `bd close`
- Closing subtasks without updating parent task with what was done
- Forgetting to check `bd ready` when looking for next work
- Creating flat task lists instead of hierarchical trees

**All of these mean: Use Discovery Trees with bd for visible, emergent planning.**

## Why This Works

**Just-in-time planning:**
- Short conversations vs hours of upfront meetings
- Plan what you need now, defer rest
- Less waste from planning things that change

**Emergent structure:**
- Tree grows as understanding deepens
- Captures reality of software development (new discoveries)
- Makes unexpected work visible, not hidden

**Visual progress:**
- Anyone can see status without asking
- Bottom-up tree shows full context
- Epic progress shows completion percentage

**Focus maintenance:**
- Distractions captured as low-priority tasks
- Current work stays visible
- Easy to return to main path