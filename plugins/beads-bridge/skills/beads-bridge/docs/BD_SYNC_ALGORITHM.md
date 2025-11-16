# Understanding `bd sync` and Change Detection

## 1. How `bd sync` Works

`bd sync` synchronizes beads issue state between your local SQLite database and the git-backed JSONL files on a sync branch (in our case, `beads-metadata`).

### The Sync Process

```bash
bd sync
```

**What happens:**

1. **Export**: Flush any pending database changes to `.beads/issues.jsonl` (local working directory)
2. **Commit**: Commit the JSONL changes to the `beads-metadata` branch (via worktree at `.git/beads-worktrees/beads-metadata/`)
3. **Pull**: Pull latest changes from `origin/beads-metadata`
4. **Import**: Import any remote changes back into the local database
5. **Push**: Push the merged state back to `origin/beads-metadata`

**Key insight:** After `bd sync` completes, the `beads-metadata` branch contains the authoritative state of all beads issues in JSONL format.

### Sync Branch Worktree

When you configure `bd config set sync.branch beads-metadata`, beads creates a git worktree at:

```
.git/beads-worktrees/beads-metadata/
```

This worktree is always checked out to the `beads-metadata` branch. When bd sync commits, it commits to this worktree, keeping `.beads/` changes out of your feature branches.

## 2. Detecting Which Beads Changed

After running `bd sync`, we can detect changed beads by comparing the current `beads-metadata` state with what it was before the sync.

### Using Git Diff

```bash
# Compare local beads-metadata with remote origin/beads-metadata
git diff origin/beads-metadata beads-metadata -- .beads/issues.jsonl
```

**What this shows:**

- **Added lines** (+): New issues created, or existing issues updated
- **Removed lines** (-): Old versions of updated issues (beads JSONL is append-only, so updates add new records)

### Parsing the Diff

Each line in `.beads/issues.jsonl` is a complete JSON object representing one issue state:

```json
{"id":"wms-zyj","content_hash":"d8c4...","title":"Feature: POC A","status":"closed",...}
```

**Algorithm to find changed issues:**

```bash
# Get all changed issue IDs
git diff origin/beads-metadata beads-metadata -- .beads/issues.jsonl \
  | grep '^+{' \
  | sed 's/^+//' \
  | jq -r '.id'
```

**Output:**
```
wms-zyj
wms-abc
wms-xyz
```

These are the issue IDs that changed since the last sync.

### Why This Works

- Git diff shows what's different between local and remote
- The `+` lines are the new/updated records
- Each line is a complete JSON object with an `id` field
- We extract the IDs to know which issues need external sync

## 3. Walking Up the Dependency Tree

Once we know which issues changed, we need to find their parent epic with a `github:` or `shortcut:` external_ref.

### Beads Dependency Structure

```
wms-bbg (Epic: GH #5)              <- Has external_ref: "github:wellmaintained/skills#5"
  └─ wms-zyj (Feature: POC A)      <- Changed issue (no external_ref)
       └─ wms-task1 (Task)         <- Child task (no external_ref)
```

### The Walk-Up Algorithm

For each changed issue:

1. **Check if issue has external_ref**: If yes, use it directly
2. **If no external_ref**: Get the issue's dependencies (parents)
3. **Check each parent for external_ref**: If found, use it
4. **If parent has no external_ref**: Recursively walk up to parent's parents
5. **Stop when**: You find an external_ref OR reach root (no more parents)

### Implementation

```typescript
async function findExternalRef(issueId: string, bdCli: BdCli): Promise<string | null> {
  // Get issue details
  const issue = await bdCli.execJson(['show', issueId, '--no-daemon']);

  // Does this issue have an external_ref?
  if (issue.external_ref) {
    return issue.external_ref;
  }

  // Get dependencies (parents) - note: beads returns parent-child relationships
  if (!issue.dependencies || issue.dependencies.length === 0) {
    return null; // No parent, no external_ref
  }

  // Walk up to parents
  for (const dep of issue.dependencies) {
    if (dep.dependency_type === 'parent-child') {
      // This dep.id is the parent issue ID
      const parentRef = await findExternalRef(dep.id, bdCli);
      if (parentRef) {
        return parentRef; // Found it in parent hierarchy
      }
    }
  }

  return null; // No external_ref found in entire tree
}
```

### Example Walkthrough

**Changed issue:** `wms-task1`

```bash
# Step 1: Check wms-task1
bd show wms-task1 --no-daemon --json
# -> No external_ref
# -> dependencies: [{ id: "wms-zyj", dependency_type: "parent-child" }]

# Step 2: Check parent wms-zyj
bd show wms-zyj --no-daemon --json
# -> No external_ref
# -> dependencies: [{ id: "wms-bbg", dependency_type: "parent-child" }]

# Step 3: Check parent wms-bbg
bd show wms-bbg --no-daemon --json
# -> external_ref: "github:wellmaintained/skills#5"  ✓ Found it!
```

**Result:** `wms-task1` maps to `github:wellmaintained/skills#5`

## 4. Updating the Yak Map for the External Ref

Once we know which external_ref (GitHub issue or Shortcut story) needs updating, we regenerate and update the Yak Map.

### Parse External Ref

```typescript
function parseExternalRef(externalRef: string): { backend: 'github' | 'shortcut', id: string } {
  // Format: "github:owner/repo#123" or "shortcut:12345"

  if (externalRef.startsWith('github:')) {
    // Extract: "github:wellmaintained/skills#5" -> { backend: 'github', id: 'wellmaintained/skills#5' }
    return {
      backend: 'github',
      id: externalRef.replace('github:', '')
    };
  }

  if (externalRef.startsWith('shortcut:')) {
    // Extract: "shortcut:90143" -> { backend: 'shortcut', id: '90143' }
    return {
      backend: 'shortcut',
      id: externalRef.replace('shortcut:', '')
    };
  }

  throw new Error(`Unknown external_ref format: ${externalRef}`);
}
```

### Generate Yak Map

For the epic issue (the one with external_ref), generate a Mermaid diagram showing the dependency tree:

```bash
bd dep tree wms-bbg --reverse --json
```

This returns the epic and all its descendants (children, grandchildren, etc.).

Convert to Mermaid format:

```mermaid
graph TD
    epic[Epic: Simplify sync workflow<br/>GH #5 / wms-bbg]
    poc_a[POC A: Auto-sync + git-based change detection<br/>PR #6 / wms-zyj]
    task1[Task: Implement syncState()<br/>wms-task1]

    epic --> poc_a
    poc_a --> task1

    classDef done fill:#90EE90,stroke:#006400,stroke-width:2px
    classDef inProgress fill:#FFD700,stroke:#FF8C00,stroke-width:2px
    classDef pending fill:#D3D3D3,stroke:#696969,stroke-width:2px

    class task1,poc_a done
    class epic inProgress
```

### Update GitHub Issue / Shortcut Story

**For GitHub:**

```typescript
// 1. Get current issue body
const issueBody = await octokit.rest.issues.get({
  owner: 'wellmaintained',
  repo: 'skills',
  issue_number: 5
});

// 2. Find existing Yak Map section (between "## Work Progress" and next "##")
// 3. Replace it with new Yak Map
// 4. Update issue

await octokit.rest.issues.update({
  owner: 'wellmaintained',
  repo: 'skills',
  issue_number: 5,
  body: updatedBody
});
```

**For Shortcut:**

Similar process - get story, update description with new Yak Map.

## Complete Workflow Example

```typescript
async function syncChangedIssues() {
  // 1. Run bd sync to synchronize state
  await execBd(['sync', '--no-daemon']);

  // 2. Detect changed issues via git diff
  const changedIssues = await detectChangedIssues();
  // -> ['wms-task1', 'wms-zyj']

  // 3. For each changed issue, find external_ref
  const externalRefsToUpdate = new Set<string>();

  for (const issueId of changedIssues) {
    const externalRef = await findExternalRef(issueId, bdCli);
    if (externalRef) {
      externalRefsToUpdate.add(externalRef);
    }
  }
  // -> Set(['github:wellmaintained/skills#5'])

  // 4. For each unique external_ref, update Yak Map
  for (const externalRef of externalRefsToUpdate) {
    const { backend, id } = parseExternalRef(externalRef);

    // Find the epic issue ID (the one with this external_ref)
    const epicIssue = await findIssueByExternalRef(externalRef);

    // Generate Yak Map from dependency tree
    const yakMap = await generateYakMap(epicIssue.id);

    // Update external system
    if (backend === 'github') {
      await updateGitHubIssueWithYakMap(id, yakMap);
    } else {
      await updateShortcutStoryWithYakMap(id, yakMap);
    }
  }
}
```

## Key Differences from POC A

**POC A approach (incorrect):**
- Looks at git commit messages for GitHub URLs
- Only works if developer manually includes issue URL in commit
- Doesn't use beads dependency tree
- Doesn't use `external_ref` field

**Correct approach:**
- Use `git diff` on beads-metadata branch to detect changed beads
- Use `bd show` with `dependencies` field to walk up tree
- Use `external_ref` field to find GitHub/Shortcut mapping
- Generate Yak Map from `bd dep tree` output

## References

- **Beads sync documentation**: https://github.com/steveyegge/beads
- **Implementation plan**: `/plugins/beads-bridge/skills/beads-bridge/docs/plans/2025-11-16-simplified-sync-workflow.md`
- **Beads external_ref**: Added in bd-142, not displayed in output (requires `--no-daemon` workaround)
