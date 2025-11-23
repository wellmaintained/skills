# Plan: Simplified Sync Workflow for beads-bridge

**Date:** 2025-11-16
**Status:** Proposed - Seeking Feedback
**Related:** [GitHub Issue #5](https://github.com/wellmaintained/skills/issues/5)

## Summary

This plan addresses [Issue #5: Simplify sync workflow by auto-detecting backend and issue ID](https://github.com/wellmaintained/skills/issues/5) by implementing automatic beads state synchronization and intelligent change detection.

**Key improvements:**
1. Single command `beads-bridge sync` updates all GitHub issues/PRs automatically
2. Uses beads `external_ref` field instead of manual mapping file lookups
3. Automatic git-based change detection (only syncs what changed)
4. Integrates with beads sync branch feature for clean multi-branch workflows

## Current Problems (from Issue #5)

**Today's friction:**
```bash
# Multiple manual steps required
grep -r "pensive-vri5" .beads-bridge/mappings/  # Manual lookup
node .claude/skills/beads-bridge/dist/cli.js shortcut-sync -s 90143
```

**Issues:**
- Manual grep to find story/issue IDs
- Separate commands for GitHub vs Shortcut
- Hard to discover which command to use
- Easy to forget to sync after beads updates

## Proposed Solution

### 1. Automatic Beads State Sync

When you run `beads-bridge sync`, it automatically:
```bash
beads-bridge sync

# Internally runs:
# 1. bd sync --commit --push  (sync beads to beads-metadata branch)
# 2. Find changed epics via git diff
# 3. Sync each to GitHub/Shortcut
```

**Benefits:**
- No manual `bd sync` needed
- Always post current state to GitHub
- Single command regardless of backend

### 2. Use Beads `external_ref` Field

Instead of separate mapping files, use beads' built-in `external_ref`:

```bash
# Create epic with external reference
bd create "Epic: Simplify sync workflow" \
  --external-ref "github:wellmaintained/skills#5" \
  -t epic -p 1

# Create feature linked to PR
bd create "Feature: POC A - Auto-detect" \
  --external-ref "github:wellmaintained/skills#pr-10" \
  -t feature --deps parent:wms-abc1
```

**Benefits:**
- No manual grep needed
- Reference travels with the issue
- Works across repos (multi-repo support)
- Standard beads feature

### 3. Smart Change Detection

Only sync epics that have changed since last push:

```bash
# Compares local beads-metadata vs origin/beads-metadata
git diff origin/beads-metadata..beads-metadata -- .beads/issues.jsonl

# Syncs only changed epics with external_ref
```

**Benefits:**
- Efficient - no unnecessary API calls
- Automatic - detects what needs updating
- Safe - only posts when there are changes

### 4. Beads Sync Branch Integration

Uses beads' sync branch feature to keep state unified across branches:

```bash
# One-time setup
bd config set sync.branch beads-metadata

# Now works from any branch
git checkout poc-a-branch
bd update wms-def2 --status complete
# ↑ Automatically commits to beads-metadata (not current branch)

beads-bridge sync
# ↑ Reads from beads-metadata, syncs to GitHub
```

**Benefits:**
- No branch divergence - single source of truth
- Clean feature branches (no .beads/ changes in PRs)
- Work from any branch without switching

## Complete Workflow Example

### Scenario: Implementing Auto-Detection Feature (Issue #5)

```bash
# === SETUP (once) ===
# Configure beads sync branch
bd config set sync.branch beads-metadata

# Create epic for GitHub issue
bd create "Epic: Simplify sync workflow (GH #5)" \
  -t epic \
  -p 1 \
  --external-ref "github:wellmaintained/skills#5"
# Returns: wms-abc1


# === POC PHASE ===
# Work on POC A
git checkout -b poc-a-external-ref

bd create "Feature: POC A - Use beads external_ref" \
  -t feature \
  -p 1 \
  --deps parent:wms-abc1 \
  --external-ref "github:wellmaintained/skills#pr-10"
# Returns: wms-def2

# Implement code
# ... edit src/, tests/ ...

git add src/ tests/
git commit -m "feat: POC A implementation"
# Note: NO .beads/ files in this commit!

git push origin poc-a-external-ref

# Create PR
gh pr create --draft \
  --title "POC A: Auto-detect using beads external_ref" \
  --body "Implements wms-def2. See GH #5 for context."

# Update beads
bd update wms-def2 --status complete

# Sync everything with ONE command
beads-bridge sync

# Output:
# ⚙ Syncing beads state to beads-metadata...
# ✓ Beads state synced
# ⚙ Finding changed epics...
# ✓ Found 1 epic to sync
# ⚙ Syncing 1 external reference...
#   ✓ github:wellmaintained/skills#5 (wms-abc1)
# ✓ All syncs completed successfully
```

**What happened:**
1. `bd sync --commit --push` committed beads changes to `beads-metadata` branch
2. Git diff found epic `wms-abc1` changed
3. Read `external_ref: github:wellmaintained/skills#5`
4. Generated Yak Map from all issues under `wms-abc1`
5. Updated GitHub Issue #5 description with Yak Map
6. Posted comment about POC A completion

**Stakeholder sees on GitHub Issue #5:**
- Updated Yak Map showing POC A complete
- Comment: "POC A ready for feedback (PR #10)"
- All without manual mapping lookups!


# === PARALLEL POC B (simultaneously) ===
git checkout -b poc-b-mapping-search

bd create "Feature: POC B - Enhanced mapping search" \
  -t feature \
  -p 1 \
  --deps parent:wms-abc1 \
  --external-ref "github:wellmaintained/skills#pr-11"

# ... implementation ...

bd update wms-ghi3 --status complete

# Same simple sync
beads-bridge sync

# Updates Issue #5 with BOTH POC A and POC B in the Yak Map!


# === STAKEHOLDER FEEDBACK ===
# Stakeholder comments on Issue #5: "Choose POC A"

bd update wms-ghi3 --notes "Not selected by stakeholder"
gh pr close 11 --comment "Closing - POC A selected"

beads-bridge sync
# Updates Issue #5 Yak Map to reflect POC B closed
```

## Implementation Details

### Command Interface

```bash
# Sync all changed epics (DEFAULT)
beads-bridge sync

# Sync specific epic by ID
beads-bridge sync wms-abc1

# Sync specific issue (if mapping exists)
beads-bridge sync -i 5

# Force sync all (even if no changes detected)
beads-bridge sync --force
```

### External Ref Formats

```bash
# GitHub issue
--external-ref "github:owner/repo#123"

# GitHub PR (syncs to parent epic's issue)
--external-ref "github:owner/repo#pr-456"

# Shortcut story
--external-ref "shortcut:90143"
```

### Change Detection Algorithm

```typescript
1. Run: bd sync --commit --push
   → Commits all beads changes to beads-metadata branch
   → Pushes to origin/beads-metadata

2. Compare local vs remote:
   git diff origin/beads-metadata..beads-metadata -- .beads/issues.jsonl

3. Parse JSONL diff to find changed issue IDs

4. For each changed ID:
   - Find its parent epic with external_ref
   - Group by epic

5. Sync each epic:
   - Parse external_ref (github: or shortcut:)
   - Read all beads under that epic
   - Generate Yak Map
   - Update GitHub Issue/PR or Shortcut Story
```

### PR Reference Handling

When a feature has a PR reference:
```bash
bd create "Feature: Alpha implementation" \
  --external-ref "github:wellmaintained/skills#pr-10" \
  --deps parent:wms-abc1
```

The sync finds the parent epic (`wms-abc1`) and updates its GitHub issue (#5), not PR #10 directly.

**Why:** The Yak Map belongs in the main tracking issue, not scattered across PRs.

## Migration Path

### For New Users

Just use `external_ref` from the start:
```bash
bd create "Epic: My feature" \
  --external-ref "github:owner/repo#123" \
  -t epic
```

### For Existing Users (with mapping files)

**Option A: Continue using mappings**
- Mapping files still work
- Gradually migrate to external_ref

**Option B: One-time migration**
```bash
# Future enhancement: migration tool
beads-bridge migrate-to-external-ref

# Reads .beads-bridge/mappings/
# Updates beads issues with --external-ref
# Keeps mappings as backup
```

## Benefits Summary

**For Developers:**
- ✅ Single command: `beads-bridge sync`
- ✅ No manual grep or ID lookups
- ✅ Works from any git branch
- ✅ Clean feature branches (no .beads/ in PRs)

**For Stakeholders:**
- ✅ Real-time updates to GitHub issues
- ✅ Always-current Yak Maps
- ✅ Automatic progress tracking
- ✅ Transparent about scope changes

**For Agents:**
- ✅ Simple mental model
- ✅ One command to sync everything
- ✅ Automatic change detection
- ✅ No manual state management

## Open Questions for Feedback

1. **External ref format:** Is `github:owner/repo#123` clear enough? Better alternatives?

2. **PR syncing:** Should PR references update the PR itself, or the parent issue (proposed)?

3. **Change detection window:** Only sync since last push to origin/beads-metadata, or offer time-based options?

4. **Migration strategy:** Auto-migrate existing mappings, or keep both systems?

5. **Error handling:** Fail fast (stop on first error) or continue syncing others?

## Next Steps

1. **Feedback on this plan** - Does this solve the original problem?
2. **POC implementation** - Build basic version to test
3. **Alpha testing** - Use with Issue #5 workflow
4. **Beta refinement** - Address edge cases
5. **Ship** - Merge and document

## Related Documentation

- [Issue #5: Simplify sync workflow](https://github.com/wellmaintained/skills/issues/5)
- [Beads external_ref documentation](https://github.com/steveyegge/beads)
- [Beads sync branch guide](https://github.com/steveyegge/beads/blob/main/docs/PROTECTED_BRANCHES.md)
- [Agentic workflow doc](./AGENTIC_WORKFLOW.md)
