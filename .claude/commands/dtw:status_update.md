# Discovery Tree Workflow: Status Update

You are an orchestrating agent pushing status updates back to external project management tools.

**Goal:** Update GitHub issues, Shortcut stories, or other external tools with completed outcomes from the Discovery Tree.

## Your Task

1. **Identify completed outcomes** ready to report
2. **Find related external issue** (GitHub, Shortcut, etc.)
3. **Summarize what's been achieved** in user-facing terms
4. **Update external issue** with progress
5. **Close external issue** if epic is complete

## Workflow

### Step 1: Check Epic Progress

```bash
# See all epics and their completion status
bd epic status --no-daemon
```

**Identify epics ready to sync:**
- Partially complete → update external issue with progress
- Fully complete → close external issue

### Step 2: For Each Epic to Sync

```bash
# Get epic details
bd show <epic-id>

# See all child outcomes
bd dep tree <epic-id>

# Get closed children (completed outcomes)
bd list --status closed | grep <epic-id-prefix>
```

### Step 3: Find External Issue

**Check epic description for external reference:**
```bash
bd show <epic-id> --json | jq -r '.description' | grep -i "github\|shortcut\|external"
```

**If using beads-bridge:**
```bash
# Check for external_ref field
bd show <epic-id> --json | jq -r '.external_ref'
```

**Common patterns:**
- GitHub: `github:owner/repo#123` or full URL
- Shortcut: `sc-12345` or full URL
- Jira: `PROJ-123` or full URL

### Step 4: Summarize Completed Outcomes

**For each closed child bead:**

```bash
# Get completed beads
bd list --status closed --json | jq -r '.[] | select(.parent_id=="<epic-id>") | "\(.id): \(.title)"'
```

**Group into user-facing outcomes:**

❌ **Don't report technical steps:**
- "Added Redis caching"
- "Created API endpoint"
- "Wrote tests"

✅ **Report user-facing outcomes:**
- "API now responds in <200ms (was 2s)"
- "Invalid login shows clear error message"
- "Session persists for 30 days"

**Template:**
```markdown
## Completed Outcomes

- ✅ [User-facing outcome 1] - Delivered in PR #X
- ✅ [User-facing outcome 2] - Delivered in PR #Y
- ✅ [User-facing outcome 3] - Delivered in PR #Z

## In Progress

- 🔄 [Outcome being worked on]
- 🔄 [Another outcome being worked on]

## Remaining Work

- [ ] [Outcome not yet started]
- [ ] [Another outcome not yet started]

## Progress: X/Y outcomes complete (Z%)
```

### Step 5: Update GitHub Issue

**If using GitHub issues:**

```bash
# Fetch issue to see current state
gh issue view <issue-number>

# Add progress comment
gh issue comment <issue-number> --body "## Progress Update

$(cat <<'EOF'
[Your completed outcomes summary from Step 4]

---
🤖 Updated via Discovery Tree workflow
EOF
)"
```

**Update issue checkboxes if applicable:**
```bash
# Edit issue body to check off completed items
gh issue edit <issue-number> --body "$(gh issue view <issue-number> --json body -q .body | sed 's/- \[ \] Completed item/- \[x\] Completed item/')"
```

### Step 6: Update Shortcut Story

**If using Shortcut:**

```bash
# Using beads-bridge if configured
cd src/beads-bridge
bun run cli sync-progress --epic <epic-id>

# Or manually via Shortcut API
curl -X PUT "https://api.app.shortcut.com/api/v3/stories/<story-id>" \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "[Your updated description with outcomes]",
    "workflow_state_id": <in-progress-state-id>
  }'
```

### Step 7: Close External Issue (If Epic Complete)

**Check if all outcomes delivered:**
```bash
# Count total vs closed
TOTAL=$(bd list --json | jq -r '[.[] | select(.parent_id=="<epic-id>")] | length')
CLOSED=$(bd list --status closed --json | jq -r '[.[] | select(.parent_id=="<epic-id>")] | length')

if [ "$TOTAL" -eq "$CLOSED" ]; then
  echo "Epic complete! All $TOTAL outcomes delivered."
fi
```

**Close GitHub issue:**
```bash
gh issue close <issue-number> --comment "## ✅ Completed

All outcomes for this epic have been delivered:

[Your summary of completed outcomes]

Total outcomes delivered: $TOTAL
Epic: <epic-id>
View epic: \`bd show <epic-id>\`

---
🤖 Closed via Discovery Tree workflow
"
```

**Close Shortcut story:**
```bash
curl -X PUT "https://api.app.shortcut.com/api/v3/stories/<story-id>" \
  -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_state_id": <done-state-id>,
    "completed_at_override": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```

### Step 8: Mark Epic as Synced

**Add comment to epic:**
```bash
bd comment <epic-id> "Synced to external issue: [URL]

Status: [Partially complete / Fully complete]
Completed outcomes: $CLOSED/$TOTAL
Last synced: $(date)"
```

**For beads-bridge users:**
```bash
# Update sync timestamp
bd update <epic-id> --notes "Last external sync: $(date)
External status: [in-progress/closed]
External URL: [URL]"
```

### Step 9: Sync Beads to Git

Since external tools are updated, ensure beads are committed:

```bash
# Export beads to JSONL
bd sync --export-only

# Commit beads changes
git add .beads/issues.jsonl
git commit -m "chore(beads): sync external updates for <epic-id>

Updated external issue with completed outcomes.
Status: $CLOSED/$TOTAL outcomes complete.
"

# Push to remote
git push
```

### Step 10: Summary

Report to user:

```
✅ External Sync Complete!

Epic: <epic-id>
External issue: [URL]

Progress:
- Completed: $CLOSED outcomes
- In progress: $IN_PROGRESS outcomes
- Remaining: $REMAINING outcomes
- Total: $TOTAL outcomes

External status: [Updated / Closed]

Next steps:
- bd epic status  (check other epics)
- bd ready  (find more work)
```

## Sync Strategies

### Strategy 1: Sync on Completion (Recommended)

Sync each time an epic reaches a meaningful milestone:
- First outcome delivered
- 50% complete
- 100% complete

### Strategy 2: Periodic Sync

Sync on a schedule:
- Daily standup
- End of week
- Sprint end

### Strategy 3: On-Demand

Only sync when explicitly requested:
- Stakeholder asks for update
- Before important meeting
- When external issue is referenced

## Using Beads-Bridge

If you have beads-bridge configured:

```bash
cd src/beads-bridge

# Sync specific epic
bun run cli sync --epic <epic-id>

# Sync all epics with external refs
bun run cli sync --all

# Generate status report
bun run cli report --epic <epic-id> --format markdown > status.md
```

**Beads-bridge handles:**
- Fetching external issue details
- Formatting updates appropriately
- Posting comments/updates
- Tracking sync state

## Manual Sync Template

For copy-paste to external issues:

```markdown
## 🌲 Discovery Tree Progress Update

**Epic:** [Epic title from bead]

### ✅ Completed Outcomes

- [Outcome 1 title] ([bead-id]) - [Link to PR]
  - Delivered: [date]
  - Key result: [what's now true for users]

- [Outcome 2 title] ([bead-id]) - [Link to PR]
  - Delivered: [date]
  - Key result: [what's now true for users]

### 🔄 In Progress

- [Outcome 3 title] ([bead-id])
  - Status: Implementation in progress
  - ETA: [estimate if known]

### 📋 Remaining Work

- [ ] [Outcome 4 title] ([bead-id])
- [ ] [Outcome 5 title] ([bead-id])

### 📊 Progress

**Overall:** X/Y outcomes complete (Z%)

**View full tree:** `bd dep tree <epic-id>`

---
🤖 Generated via Discovery Tree workflow | Last updated: [date]
```

## Error Handling

**If external issue not found:**
```
Error: Cannot find external issue for epic <epic-id>
Check: bd show <epic-id> (look for external_ref or URL in description)
Provide: /dtw:status_update <epic-id> <external-issue-url>
```

**If credentials missing:**
```
Error: GitHub CLI not authenticated
Fix: gh auth login

Error: Shortcut token not found
Fix: export SHORTCUT_API_TOKEN=your-token
```

**If epic has no completed outcomes:**
```
Warning: Epic <epic-id> has no completed outcomes yet
Nothing to sync to external issue.
Wait for: /dtw:approve to close some beads first
```

## Key Principles

1. **User-facing language** - Report outcomes, not implementation details
2. **Accurate progress** - Don't overstate or understate completion
3. **Regular sync** - Keep external stakeholders informed
4. **Traceability** - Link outcomes to PRs and bead IDs
5. **Bidirectional** - External issues inform beads, completed beads update external

**This completes the Discovery Tree workflow cycle:**
1. `/dtw:orchestrate` - External → Beads
2. `/dtw:handoff` - Beads → Implementation
3. `/dtw:implement` - Code the outcome
4. `/dtw:approve` - Verify & merge
5. `/dtw:status_update` - Beads → External ✅
