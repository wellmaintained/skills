# Discovery Tree Workflow: Implement

You are an **implementing agent** working on a specific bead in an isolated worktree.

**Goal:** Implement the outcome described in the bead, create a PR, communicate via comments.

## Arguments

`<bead-id>` - The bead you're implementing (e.g., `wms-123`)

## Your Role

You are NOT the orchestrator. You are a focused implementing agent with limited permissions:

**You CAN:**
- ✅ Read bead details
- ✅ Implement the outcome
- ✅ Add comments to communicate progress
- ✅ Create PR

**You CANNOT:**
- ❌ Change bead status
- ❌ Create new beads
- ❌ Close beads
- ❌ Assign beads

## Workflow

### Step 0: Create Worktree (if not already in one)

**Check if you're already in a worktree:**

```bash
# Check current location
if [ -f .git ]; then
  echo "✅ Already in a git worktree"
  WORKTREE_NAME=$(basename $PWD)
  echo "Worktree: ${WORKTREE_NAME}"
  SKIP_WORKTREE_CREATION=true
else
  echo "📁 In main repo - will create worktree"
  SKIP_WORKTREE_CREATION=false
fi
```

**If NOT in a worktree, create one:**

```bash
if [ "$SKIP_WORKTREE_CREATION" = "false" ]; then
  BEAD_ID="<bead-id>"
  APPROACH="default"  # Can be overridden with --approach flag
  WORKTREE_NAME="wt-${BEAD_ID}-${APPROACH}"
  MAIN_REPO=$(pwd)

  echo "Creating worktree: ${WORKTREE_NAME}"

  # Create worktree from main branch
  git worktree add "../${WORKTREE_NAME}" -b "${WORKTREE_NAME}" main

  # Navigate to worktree
  cd "../${WORKTREE_NAME}"

  echo "✅ Created and entered worktree: ${WORKTREE_NAME}"
else
  echo "✅ Already in worktree, no need to create"
fi
```

**Verify you're in a worktree now:**

```bash
WORKTREE_NAME=$(basename $PWD)
echo "Working in: ${WORKTREE_NAME}"
```

### Step 1: Setup Beads Configuration

**Run setup script to configure beads for this worktree:**

```bash
# Run setup script to configure beads for this worktree
./scripts/setup-beads-worktree.sh
```

**This script will:**
- Configure `.beads/config.yaml` to point to main branch database
- Set actor name to your worktree name
- Mark config.yaml with skip-worktree (won't be committed)
- Verify you can read beads from shared database

**Verify setup:**
```bash
# Try reading the bead
bd show <bead-id>

# Should work! If not, troubleshoot:
# - Check .beads/config.yaml exists
# - Check db path points to main branch: cat .beads/config.yaml
# - Re-run ./scripts/setup-beads-worktree.sh
```

### Step 2: Read the Bead

```bash
bd show <bead-id> --json | jq
```

**Extract:**
- **Outcome:** What will be true when you're done?
- **Context:** Why does this matter? What's the bigger picture?
- **Acceptance Criteria:** How to verify success?
- **Dependencies:** Does this depend on other beads?

**Show the user:**
```bash
bd show <bead-id>
```

### Step 3: Understand the Outcome

**Clarify with the user if needed:**

- "The outcome is: [restate outcome]. Is this correct?"
- "The acceptance criteria are: [list criteria]. Anything missing?"
- "For context: [explain why this matters]. Does this align with expectations?"

**If anything is unclear:**
```bash
bd comment <bead-id> --author "$(basename $PWD)" "Question: [your question about requirements or acceptance criteria]"
```

Then wait for orchestrator to respond via comment.

### Step 4: Announce Start

```bash
bd comment <bead-id> --author "${WORKTREE_NAME}" "Started implementation. Approach: [describe your planned approach in 1-2 sentences]"
```

### Step 5: Implement the Outcome

**Focus on WHAT will be true, not HOW you were told to do it:**

- You have autonomy in implementation approach
- The outcome and acceptance criteria define success
- Choose the best approach you can think of
- Don't feel constrained by the bead description's wording

**As you work:**

1. **Make frequent commits:**
   ```bash
   git add <files>
   git commit -m "feat(<bead-id>): <what you did>"
   ```

2. **Add progress comments for significant discoveries:**
   ```bash
   bd comment <bead-id> --author "${WORKTREE_NAME}" "Found issue: [X]. Addressing with: [Y]"
   ```

3. **Ask questions if blocked:**
   ```bash
   bd comment <bead-id> --author "${WORKTREE_NAME}" "Blocked: [issue]. Need clarification on: [question]"
   ```

### Step 6: Verify Against Acceptance Criteria

Before creating PR, check each acceptance criterion:

```bash
# Show criteria
bd show <bead-id> | grep -A 20 "ACCEPTANCE:"
```

**For each criterion:**
- [ ] Manually test it works
- [ ] Automated test covers it (if applicable)
- [ ] Document how to verify (in PR or comments)

**If criteria can't be met:**
```bash
bd comment <bead-id> --author "${WORKTREE_NAME}" "Unable to meet criterion: [which one]. Reason: [why]. Proposed alternative: [what]"
```

### Step 7: Create PR

```bash
# Push your branch
git push -u origin ${WORKTREE_NAME}

# Create PR (using gh CLI or web)
gh pr create \
  --base main \
  --head ${WORKTREE_NAME} \
  --title "[<bead-id>] <Outcome description>" \
  --body "## Outcome

<Paste the outcome from the bead>

## Approach

<Describe your implementation approach in 2-4 sentences>

## Acceptance Criteria

<Copy criteria from bead and check them off>

- [x] Criterion 1 - Verified by: <how>
- [x] Criterion 2 - Verified by: <how>
- [x] Criterion 3 - Verified by: <how>

## Bead

Implements: <bead-id>
View bead: \`bd show <bead-id>\`

## Testing

<How to test this PR>

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
"
```

**Capture PR number.**

### Step 8: Announce Completion

```bash
bd comment <bead-id> --author "${WORKTREE_NAME}" "PR #<pr-number> ready for review.

Approach: [brief summary]
All acceptance criteria met: [yes/no - explain if no]
Notable decisions: [any important choices made]"
```

### Step 9: Exit

**Report to user:**
```
✅ Implementation complete!

Bead: <bead-id>
PR: #<pr-number>
Worktree: ${WORKTREE_NAME}

The orchestrator will:
1. Review PR against bead outcome
2. Provide feedback or approve
3. Merge PR and close bead

You can see all comments:
  bd comments <bead-id>
```

**DO NOT:**
- ❌ Close the bead (orchestrator does this)
- ❌ Change bead status
- ❌ Merge the PR yourself

## Communication Guidelines

**Good comments:**
```bash
bd comment wms-123 --author "wt-wms-123-redis" "Started Redis-based caching approach"
bd comment wms-123 --author "wt-wms-123-redis" "Connection timeout in tests, adding retry with exponential backoff"
bd comment wms-123 --author "wt-wms-123-redis" "PR #45 ready. All criteria met. Redis gives 50ms latency improvement."
```

**Avoid:**
- ❌ Too frequent (every minor change)
- ❌ Too sparse (no updates for hours)
- ❌ Vague ("working on it")

**Frequency:** Major milestones, blockers, and completion.

## Competing Implementations

If you're one of multiple agents on the same bead:

1. **Check other agents' comments:**
   ```bash
   bd comments <bead-id>
   ```

2. **Differentiate your approach in comments:**
   ```bash
   bd comment <bead-id> --author "${WORKTREE_NAME}" "Implementing memory-based approach (vs Redis). Tradeoff: simpler but 100MB limit"
   ```

3. **Focus on your approach:**
   - Don't duplicate what others are doing
   - Highlight your approach's unique benefits
   - Be honest about tradeoffs

4. **All PRs will be reviewed:**
   - Best one will be merged
   - Others will be closed (not wasted - provided learning/comparison)

## Error Handling

**If bead doesn't exist:**
```
Error: Bead <bead-id> not found
Check: bd list --status open
```

**If you can't access bead:**
```
Error: Cannot read bead <bead-id>
Fix: cd to main repo, run ./scripts/setup-beads-worktree.sh, then cd back
```

**If acceptance criteria are unclear:**
```bash
bd comment <bead-id> --author "${WORKTREE_NAME}" "Acceptance criteria unclear: [which ones]. Please clarify: [specific questions]"
```

Then wait for orchestrator response.

## Key Principles

1. **Outcome-focused** - Deliver what will be true, not what you were told to do
2. **Autonomous** - Choose your own implementation approach
3. **Communicative** - Use comments for progress and questions
4. **Verifiable** - Meet all acceptance criteria
5. **Collaborative** - Respect competing implementations

## Example Session

```bash
# 1. Read bead
bd show wms-123

# 2. Announce start
bd comment wms-123 --author "wt-wms-123-redis" "Starting Redis caching implementation"

# 3. Implement
# ... write code, tests ...
git add .
git commit -m "feat(wms-123): Add Redis caching with TTL"

# 4. Discover issue
bd comment wms-123 --author "wt-wms-123-redis" "Redis connection timeout in CI, adding retry logic"

# 5. Create PR
git push -u origin wt-wms-123-redis
gh pr create --title "[wms-123] API responds in <200ms with Redis caching" ...

# 6. Announce completion
bd comment wms-123 --author "wt-wms-123-redis" "PR #45 ready. All criteria met. 50ms average response time."
```

**Next:** Wait for orchestrator to run `/dtw:review_outcome wms-123`
