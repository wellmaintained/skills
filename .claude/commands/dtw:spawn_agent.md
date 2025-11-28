# Discovery Tree Workflow: Spawn Agent

You are an orchestrating agent preparing a bead for implementation by a new implementing agent.

**Goal:** Review the bead, claim it, and prepare for a new implementing agent session.

## Arguments

`<bead-id>` - The bead to implement (e.g., `wms-123`)
`[--approach <name>]` - Optional approach identifier for competing implementations (e.g., `redis`, `memory`)

## Your Task

1. **Review the bead** to ensure it's ready for implementation
2. **Claim the bead** (mark as in_progress)
3. **Add tracking comment** documenting the spawn
4. **Instruct user** to start new Claude Code session for implementing agent

## Workflow

### Step 1: Review the Bead

```bash
bd show <bead-id>
```

**Verify the bead has:**
- ✅ Clear outcome description (what will be true)
- ✅ Relevant context (why this matters)
- ✅ Acceptance criteria (how to verify)
- ✅ Status is `open` (not already in_progress)

**If missing critical info:**
- Update the bead with better context/acceptance criteria
- Don't spawn until bead is complete

### Step 2: Claim the Bead

```bash
# Mark as in_progress (orchestrator controls status)
bd update <bead-id> --status in_progress
```

**Add comment about spawning:**
```bash
BEAD_ID="<bead-id>"
APPROACH="${approach:-default}"
WORKTREE_NAME="wt-${BEAD_ID}-${APPROACH}"

bd comment ${BEAD_ID} "Preparing for implementation:
- Worktree: ${WORKTREE_NAME}
- Approach: ${APPROACH}
- Next: Start new implementing agent session"
```

### Step 3: Instruct User to Start Implementing Agent

Tell the user:

```
✅ Bead ${BEAD_ID} is ready for implementation!

**Next step:** Start a new Claude Code session and run:

/dtw:implement ${BEAD_ID}

The implementing agent will:
1. Create worktree: ${WORKTREE_NAME}
2. Setup beads configuration
3. Implement the outcome
4. Create PR when done

**Monitor progress:**
bd comments ${BEAD_ID}

**When PR is ready, use:**
/dtw:review_outcome ${BEAD_ID}
```

## For Competing Implementations

To spawn multiple agents with different approaches:

```bash
# Claim for first approach
/dtw:spawn_agent wms-456 --approach redis

# In separate session: User runs /dtw:implement wms-456 --approach redis

# Claim for second approach (competing implementation)
/dtw:spawn_agent wms-456 --approach memory

# In separate session: User runs /dtw:implement wms-456 --approach memory

# Claim for third approach
/dtw:spawn_agent wms-456 --approach hybrid

# In separate session: User runs /dtw:implement wms-456 --approach hybrid
```

**Each agent:**
- Works in separate worktree (wt-wms-456-redis, wt-wms-456-memory, etc.)
- Has separate branch with same name
- Reads from same bead (shared DB)
- Communicates via comments (different authors)

**All PRs will be reviewed, best one merged.**

## Error Handling

**If bead doesn't exist:**
```
Error: Bead ${BEAD_ID} not found
Run: bd list --status open
```

**If bead already in_progress:**
```
Warning: Bead ${BEAD_ID} already in progress
Check: bd comments ${BEAD_ID}

For competing implementations:
- Use different --approach name
- Multiple agents can work on same bead with different approaches
```

**If bead missing context/acceptance criteria:**
```
Warning: Bead ${BEAD_ID} needs more detail before implementation

Add context:
bd update ${BEAD_ID} --description "
OUTCOME: [what will be true]

CONTEXT:
- Why this matters
- Related work
- External references

ACCEPTANCE:
- [ ] Criterion 1
- [ ] Criterion 2
"
```

## What the Implementing Agent Will Do

When the user starts a new session and runs `/dtw:implement <bead-id>`, that agent will:

1. **Create worktree:**
   ```bash
   git worktree add ../wt-<bead-id>-<approach> -b wt-<bead-id>-<approach> main
   ```

2. **Setup beads:**
   ```bash
   cd ../wt-<bead-id>-<approach>
   ./scripts/setup-beads-worktree.sh
   ```

3. **Implement outcome:**
   - Read bead details
   - Understand outcome and acceptance criteria
   - Write code, tests, docs
   - Make frequent commits

4. **Add progress comments:**
   ```bash
   bd comment <bead-id> --author "wt-<bead-id>-<approach>" "Progress update"
   ```

5. **Create PR:**
   - Push branch
   - Create PR to main
   - Link to bead in PR body

6. **Announce completion:**
   ```bash
   bd comment <bead-id> --author "wt-<bead-id>-<approach>" "PR #X ready for review"
   ```

The implementing agent does NOT:
- Change bead status
- Create new beads
- Close beads
- Merge PRs

## Key Principles

1. **Orchestrator prepares** - Review bead, claim it, track it
2. **Implementing agent executes** - Creates workspace, implements, creates PR
3. **Separation of concerns** - Orchestrator controls state, implementer delivers code
4. **Communication via comments** - All agents coordinate through bead comments
5. **Autonomy** - Implementing agent chooses how to implement the outcome

## Example Flow

**Orchestrator (you):**
```bash
# Review
bd show wms-123

# Claim
bd update wms-123 --status in_progress

# Track
bd comment wms-123 "Preparing for implementation: worktree wt-wms-123-default"
```

**Tell user:** "Start new Claude Code session, run `/dtw:implement wms-123`"

**Implementing agent (new session):**
```bash
# Agent runs /dtw:implement wms-123
# Creates worktree
# Implements outcome
# Creates PR
# Adds comment: "PR #45 ready for review"
```

**Back to orchestrator (you):**
```bash
# Monitor
bd comments wms-123

# When PR ready
/dtw:review_outcome wms-123
```

**Next step:** After claiming the bead, tell user to start new implementing agent session.
