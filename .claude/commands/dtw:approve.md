# Discovery Tree Workflow: Approve

You are an orchestrating agent reviewing and approving an implemented outcome against the bead's acceptance criteria.

**Goal:** Review PR(s), verify outcome is achieved, provide feedback or approve, close bead when satisfied.

## Arguments

`<bead-id>` - The bead to review (e.g., `wms-123`)

## Your Task

1. **Read the bead** to understand the expected outcome
2. **Review related PR(s)** against acceptance criteria
3. **Provide feedback** via PR comments or approve
4. **Close bead** when outcome is achieved
5. **Update parent bead** with completed outcome

## Workflow

### Step 1: Read the Bead

```bash
bd show <bead-id>
```

**Extract:**
- **Outcome:** What should be true?
- **Acceptance Criteria:** How to verify success?
- **Context:** Why does this matter?

**Check status:**
```bash
bd show <bead-id> --json | jq -r '.status'
```

Should be `in_progress`. If not, check what's happening.

### Step 2: Review Comments

```bash
bd comments <bead-id>
```

**Look for:**
- Agent's announced approach
- Progress updates
- Blockers or questions
- PR ready announcement

**Answer any questions:**
```bash
bd comment <bead-id> "Re: [question] - [your answer]"
```

### Step 3: Find Related PR(s)

**From comments:**
- Look for "PR #XXX ready" messages

**From GitHub:**
```bash
# List PRs mentioning this bead
gh pr list --search "<bead-id>" --state open

# Or search by branch name
gh pr list --search "wt-<bead-id>" --state open
```

**For competing implementations:**
- There may be multiple PRs (e.g., redis, memory, hybrid approaches)
- Review all before deciding which to merge

### Step 4: Review Each PR

For each PR:

```bash
# View PR details
gh pr view <pr-number>

# View diff
gh pr diff <pr-number>

# Check CI status
gh pr checks <pr-number>
```

**Review against acceptance criteria:**

For each criterion from the bead:
- [ ] Does the PR deliver this?
- [ ] How can I verify?
- [ ] Are there tests covering it?
- [ ] Is the implementation sound?

**Check code quality:**
- [ ] Follows project conventions
- [ ] Properly tested
- [ ] Documented where needed
- [ ] No obvious bugs or security issues

### Step 5: Provide Feedback or Approve

**If changes needed:**

```bash
# Comment on PR
gh pr comment <pr-number> --body "## Review Feedback

**Acceptance Criteria Check:**
- ✅ Criterion 1: Verified
- ❌ Criterion 2: Issue found - [describe]
- ✅ Criterion 3: Verified

**Changes Requested:**
1. [Specific change needed]
2. [Specific change needed]

**Questions:**
- [Any clarifying questions]

Please update the PR and comment when ready for re-review.
"

# Also add bead comment for visibility
bd comment <bead-id> "PR #<pr-number> needs changes: [brief summary of main issues]"
```

Then wait for agent to update PR and notify.

**If approved:**

```bash
# Approve PR
gh pr review <pr-number> --approve --body "## ✅ Outcome Achieved

All acceptance criteria met:
- ✅ [Criterion 1]
- ✅ [Criterion 2]
- ✅ [Criterion 3]

Implementation looks good. Ready to merge.
"
```

### Step 6: For Competing Implementations

If multiple PRs exist:

1. **Review all PRs** against criteria
2. **Compare approaches:**
   - Performance
   - Complexity
   - Maintainability
   - Tradeoffs

3. **Choose best approach:**
```bash
bd comment <bead-id> "Reviewed all approaches:

**PR #45 (Redis):**
- ✅ Meets all criteria
- Performance: 50ms latency
- Complexity: Medium (Redis dependency)
- Tradeoff: Requires Redis server

**PR #46 (Memory):**
- ✅ Meets all criteria
- Performance: 5ms latency
- Complexity: Low (no dependencies)
- Tradeoff: 100MB memory limit

**PR #47 (Hybrid):**
- ✅ Meets all criteria
- Performance: 10ms latency
- Complexity: Medium
- Tradeoff: Balanced approach

**Decision: Merging PR #47 (Hybrid)** - Best balance of performance and complexity.
"

# Approve chosen PR
gh pr review 47 --approve

# Close others politely
gh pr comment 45 --body "Thank you for this implementation! After reviewing all approaches, we're going with the hybrid solution in PR #47. Your Redis implementation provided valuable insights for comparison."
gh pr close 45

gh pr comment 46 --body "Thank you for this implementation! After reviewing all approaches, we're going with the hybrid solution in PR #47. Your in-memory approach provided valuable insights for comparison."
gh pr close 46
```

### Step 7: Merge PR

```bash
# Merge the approved PR
gh pr merge <pr-number> --squash --delete-branch

# Capture merge commit SHA if needed
MERGE_SHA=$(gh pr view <pr-number> --json mergeCommit --jq '.mergeCommit.oid')
```

**If merge fails (conflicts, etc.):**
```bash
bd comment <bead-id> "PR #<pr-number> approved but merge failed: [error]. Please resolve conflicts and re-push."
```

### Step 8: Close the Bead

```bash
bd close <bead-id> --reason "Merged PR #<pr-number>. Outcome achieved: [brief description of what's now true]"
```

**Example:**
```bash
bd close wms-123 --reason "Merged PR #47 (hybrid caching). API now responds in <200ms with 99% cache hit rate."
```

### Step 9: Update Parent Bead

```bash
# Find parent
PARENT_ID=$(bd show <bead-id> --json | jq -r '.dependencies[] | select(.type=="parent-child") | .target_id')

# Add comment to parent documenting completion
bd comment ${PARENT_ID} "Completed: <bead-id> - [outcome description]

Implementation: [Brief summary of approach taken]
PR: #<pr-number>
"

# Check if parent is now complete
bd dep tree ${PARENT_ID}

# If all children done, consider closing parent too
```

### Step 10: Clean Up Worktree

```bash
# Return to main branch
cd <main-repo-path>

# Remove worktree (branch already deleted by PR merge)
git worktree remove wt-<bead-id>-<approach>

# If multiple worktrees for competing implementations
git worktree list | grep "wt-<bead-id>" | awk '{print $1}' | xargs -I {} git worktree remove {}
```

### Step 11: Summary

Report to user:

```
✅ Outcome Review Complete!

Bead: <bead-id>
Status: Closed
PR: #<pr-number> (merged)
Outcome: [What is now true]

Parent: <parent-id>
Progress: [X/Y child outcomes complete]

Next steps:
- bd ready  (find more work)
- bd epic status  (check overall progress)
- /dtw:status_update  (push to GitHub/Shortcut when ready)
```

## Verification Checklist

Before closing bead, verify:

- [ ] **Outcome achieved:** What bead said would be true, is true
- [ ] **All acceptance criteria met:** Each one verified
- [ ] **Tests pass:** CI green
- [ ] **Code quality:** Follows conventions, well-tested
- [ ] **Documentation:** Updated if needed
- [ ] **PR merged:** Code is on main branch
- [ ] **Bead closed:** With clear reason
- [ ] **Parent updated:** Progress documented
- [ ] **Worktree cleaned:** No leftover branches/worktrees

## Handling Issues

**If outcome not fully achieved:**
```bash
bd comment <bead-id> "Review complete. Outcome partially achieved:
- ✅ [What works]
- ❌ [What's missing]

Options:
1. Request changes to this PR
2. Create follow-up bead for missing parts
3. Adjust acceptance criteria (if they were wrong)

Recommendation: [your recommendation]"
```

**If acceptance criteria were wrong:**
```bash
bd update <bead-id> --description "<updated description with corrected criteria>"
bd comment <bead-id> "Updated acceptance criteria based on implementation learning. Original criteria: [X]. New criteria: [Y]. Reason: [Z]"
```

**If implementation revealed new work needed:**
```bash
# Create follow-up bead
bd create "Follow-up: [new outcome discovered]" -t task -p 1 --json
bd dep add <new-bead-id> <parent-id> -t parent-child
bd comment <new-bead-id> "Discovered during implementation of <bead-id>. Needed because: [reason]"
```

## Key Principles

1. **Outcome-focused review** - Did we achieve what should be true?
2. **Criteria-based** - Every acceptance criterion must be met
3. **Fair comparison** - For competing implementations, evaluate objectively
4. **Learning capture** - Document decisions and tradeoffs
5. **Parent updates** - Keep parent bead's context current

## Example Session

```bash
# 1. Review bead
bd show wms-123

# 2. Check comments
bd comments wms-123

# 3. Find PR
gh pr list --search "wms-123"

# 4. Review PR
gh pr view 45
gh pr diff 45

# 5. Verify criteria met
# ... manual testing ...

# 6. Approve
gh pr review 45 --approve --body "All criteria met!"

# 7. Merge
gh pr merge 45 --squash --delete-branch

# 8. Close bead
bd close wms-123 --reason "Merged PR #45. API <200ms response achieved."

# 9. Update parent
bd comment wms-100 "Completed: wms-123 - Fast API responses. Using hybrid Redis+local cache."

# 10. Clean up
git worktree remove wt-wms-123-redis
```

**Next:** Use `bd ready` to find more work, or `/dtw:status_update` to update external tools.
