# BD Sync Algorithm - Correct Approach for POC A

## Problem with Original Algorithm

The initial algorithm documentation suggested using:

```bash
git diff origin/beads-metadata beads-metadata -- .beads/issues.jsonl
```

**Issue:** After `bd sync` completes, it pushes changes to `origin/beads-metadata`, so local and remote are already in sync. The diff would show nothing!

## The Correct Approach

We already have the infrastructure to do this correctly:

1. **Use `bd dep tree --format mermaid`** - Beads has built-in Mermaid generation
2. **Use existing MermaidGenerator** - `src/diagrams/mermaid-generator.ts`
3. **Use existing DiagramPlacer** - `src/diagrams/diagram-placer.ts`
4. **Run BEFORE bd sync pushes** - Capture changes before they're synced

## How It Should Work

### 1. Detect Changed Issues BEFORE Push

```typescript
async function detectChangedIssues(bdCli: BdCli): Promise<string[]> {
  // Compare local beads-metadata with remote BEFORE sync pushes
  const { stdout } = await execGit([
    'diff',
    'origin/beads-metadata',  // Remote state (before sync)
    'beads-metadata',          // Local state (after export, before push)
    '--',
    '.beads/issues.jsonl'
  ], { cwd: bdCli.getCwd() });

  // Parse diff to extract changed issue IDs
  const changedIds = new Set<string>();

  for (const line of stdout.split('\n')) {
    if (line.startsWith('+{')) {
      // This is an added/updated line
      const json = JSON.parse(line.substring(1));
      changedIds.add(json.id);
    }
  }

  return Array.from(changedIds);
}
```

### 2. Walk Up to Find external_ref

```typescript
async function findExternalRef(
  issueId: string,
  bdCli: BdCli,
  visited = new Set<string>()
): Promise<string | null> {
  // Prevent infinite loops
  if (visited.has(issueId)) {
    return null;
  }
  visited.add(issueId);

  // Get issue with dependencies
  const issues = await bdCli.execJson<any[]>([
    'show',
    issueId,
    '--no-daemon'
  ]);

  const issue = issues[0];
  if (!issue) {
    return null;
  }

  // Check if this issue has external_ref
  if (issue.external_ref) {
    return issue.external_ref;
  }

  // Walk up to parents
  if (issue.dependencies && issue.dependencies.length > 0) {
    for (const dep of issue.dependencies) {
      if (dep.dependency_type === 'parent-child') {
        // dep.id is the parent
        const parentRef = await findExternalRef(dep.id, bdCli, visited);
        if (parentRef) {
          return parentRef;
        }
      }
    }
  }

  return null;
}
```

### 3. Use Existing Infrastructure for Diagram Generation

We already have `MermaidGenerator` that does this:

```typescript
// From src/diagrams/mermaid-generator.ts
async generate(
  repository: string,
  rootIssueId: string,
  options: MermaidOptions = {}
): Promise<string> {
  const bdCli = this.beads['getBdCli'](repository);

  // Uses bd's built-in Mermaid generation
  const args = ['dep', 'tree', rootIssueId, '--format', 'mermaid', '--reverse'];
  const { stdout } = await bdCli.exec(args);

  // Add status-based styling
  return this.addStatusStyling(stdout.trim());
}
```

**Key insight:** We don't need to manually build the Mermaid graph - `bd` does it for us!

### 4. Use Existing DiagramPlacer for Updates

We already have `DiagramPlacer` that updates GitHub issues:

```typescript
// From src/diagrams/diagram-placer.ts
async updateDiagram(
  githubRepository: string,
  githubIssueNumber: number,
  options: PlacementOptions
): Promise<PlacementResult> {
  // 1. Get GitHub issue
  // 2. Find mapping to get Beads epics
  // 3. Generate diagram using MermaidGenerator
  // 4. Update issue description with new diagram
  // 5. Optionally create snapshot comment
}
```

## Complete Workflow for POC A

```typescript
async function syncWithDiagramUpdate() {
  const bdCli = new BdCli({ cwd: '/path/to/repo' });

  // STEP 1: Detect changes BEFORE bd sync pushes
  // Run partial sync to export and commit, but not push yet
  await bdCli.exec(['sync', '--no-push', '--no-daemon']);

  // STEP 2: Now detect what changed (local vs remote)
  const changedIssueIds = await detectChangedIssues(bdCli);

  if (changedIssueIds.length === 0) {
    // No changes, just complete the sync
    await bdCli.exec(['sync', '--no-daemon']);
    return;
  }

  // STEP 3: Find unique external_refs affected
  const externalRefs = new Set<string>();
  const epicsByRef = new Map<string, string>(); // external_ref -> epic issue ID

  for (const issueId of changedIssueIds) {
    const externalRef = await findExternalRef(issueId, bdCli);
    if (externalRef) {
      externalRefs.add(externalRef);

      // Find which issue has this external_ref (the epic)
      const epicIssue = await findIssueByExternalRef(externalRef, bdCli);
      if (epicIssue) {
        epicsByRef.set(externalRef, epicIssue.id);
      }
    }
  }

  // STEP 4: Update diagrams for each affected external_ref
  for (const externalRef of externalRefs) {
    const epicId = epicsByRef.get(externalRef);
    if (!epicId) continue;

    // Parse external_ref format: "github:owner/repo#123" or "shortcut:12345"
    const { backend, owner, repo, issueNumber } = parseExternalRef(externalRef);

    if (backend === 'github') {
      // Generate fresh diagram using bd dep tree
      const generator = new MermaidGenerator(beadsClient);
      const diagram = await generator.generate(
        bdCli.getCwd(),
        epicId,
        { /* options */ }
      );

      // Update GitHub issue using DiagramPlacer
      const placer = new DiagramPlacer(githubBackend, generator, mappingStore);
      await placer.updateDiagram(
        `${owner}/${repo}`,
        issueNumber,
        {
          updateDescription: true,
          createSnapshot: false, // Don't create comment for every sync
          trigger: 'auto-sync'
        }
      );
    } else if (backend === 'shortcut') {
      // Similar for Shortcut
      // ... update Shortcut story with diagram
    }
  }

  // STEP 5: Complete the sync (push)
  await bdCli.exec(['sync', '--no-daemon']);
}
```

## Key Differences from Initial Approach

### Wrong Approach (from first doc)
- ❌ Looked at git commit messages for URLs
- ❌ Tried to diff AFTER sync completed (too late!)
- ❌ Manually built Mermaid graphs
- ❌ Didn't use existing infrastructure

### Correct Approach (this doc)
- ✅ Use `bd sync --no-push` to export/commit without pushing
- ✅ Detect changes while local and remote still differ
- ✅ Use `bd dep tree --format mermaid` (built-in)
- ✅ Leverage existing `MermaidGenerator` and `DiagramPlacer`
- ✅ Walk dependency tree to find `external_ref`
- ✅ Complete sync with push after diagram updates

## Parsing external_ref

```typescript
function parseExternalRef(externalRef: string): {
  backend: 'github' | 'shortcut';
  owner?: string;
  repo?: string;
  issueNumber?: number;
  storyId?: number;
} {
  // GitHub format: "github:owner/repo#123"
  const githubMatch = externalRef.match(/^github:([^/]+)\/([^#]+)#(\d+)$/);
  if (githubMatch) {
    return {
      backend: 'github',
      owner: githubMatch[1],
      repo: githubMatch[2],
      issueNumber: parseInt(githubMatch[3], 10)
    };
  }

  // Shortcut format: "shortcut:12345"
  const shortcutMatch = externalRef.match(/^shortcut:(\d+)$/);
  if (shortcutMatch) {
    return {
      backend: 'shortcut',
      storyId: parseInt(shortcutMatch[1], 10)
    };
  }

  throw new Error(`Unknown external_ref format: ${externalRef}`);
}
```

## Finding Issue by external_ref

```typescript
async function findIssueByExternalRef(
  externalRef: string,
  bdCli: BdCli
): Promise<{ id: string } | null> {
  // Get all issues
  const issues = await bdCli.execJson<any[]>(['list', '--no-daemon']);

  // Find issue with matching external_ref
  // Note: external_ref might not be in output due to beads bug
  // Workaround: use --no-db mode
  const issuesNoDb = await bdCli.execJson<any[]>(['list', '--no-daemon', '--no-db']);

  for (const issue of issuesNoDb) {
    if (issue.external_ref === externalRef) {
      return { id: issue.id };
    }
  }

  return null;
}
```

## Summary

**The algorithm is:**

1. `bd sync --no-push` (export + commit, don't push yet)
2. `git diff origin/beads-metadata beads-metadata` (detect changes)
3. For each changed issue, walk up tree to find `external_ref`
4. Group by unique `external_ref`
5. For each `external_ref`:
   - Parse to get backend/owner/repo/issue
   - Use `MermaidGenerator.generate()` with `bd dep tree --format mermaid`
   - Use `DiagramPlacer.updateDiagram()` to update GitHub/Shortcut
6. `bd sync` (complete the push)

**Existing code we reuse:**
- `MermaidGenerator` - already calls `bd dep tree --format mermaid`
- `DiagramPlacer` - already updates GitHub issue descriptions
- Just need to add the detection and orchestration logic!
