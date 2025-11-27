# Remove Deprecated Mapping Store Implementation Plan
# Remove Deprecated Mapping Store Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Sunset the legacy `.beads-bridge/mappings/` storage, route all progress/diagram sync logic through beads `external_ref`, and warn users when leftover mapping directories are detected.

**Architecture:** Replace `MappingStore` consumers with a new resolver that discovers beads epics via external refs, inject it into handlers, and remove obsolete CLI commands/capabilities. Emit a warning when `.beads-bridge/mappings/` exists but no matching external refs are found.

**Tech Stack:** TypeScript (Bun runtime), Commander CLI, Bun test runner, Beads CLI integrations.

---

### Task 1: Introduce External Reference Resolver

**Files:**
- Create: `src/beads-bridge/src/utils/external-ref-resolver.ts`
- Modify: `src/beads-bridge/src/utils/index.ts`
- Test: `src/beads-bridge/tests/utils/external-ref-resolver.test.ts`

**Step 1: Write the failing test**

```ts
// src/beads-bridge/tests/utils/external-ref-resolver.test.ts
import { describe, expect, it, vi } from 'bun:test';
import { ExternalRefResolver } from '../../src/utils/external-ref-resolver.js';

const mockBeads = {
  listIssues: vi.fn(),
  getEpicStatus: vi.fn()
};

const resolver = new ExternalRefResolver(mockBeads as any, {
  configDir: '.beads-bridge'
});

it('finds epics by github external ref', async () => {
  mockBeads.listIssues.mockResolvedValueOnce([
    { id: 'front-e1', issue_type: 'epic', external_ref: 'github:org/repo#123' }
  ]);
  mockBeads.getEpicStatus.mockResolvedValueOnce({ total: 10, completed: 4, blockers: [], discovered: [] });

  const result = await resolver.resolve({ repository: 'org/repo', issueNumber: 123 });

  expect(result.epics).toEqual([
    { repository: 'front', epicId: 'front-e1' }
  ]);
  expect(result.metrics.total).toBe(10);
});
```

**Step 2: Run test to verify it fails**

Run: `cd src/beads-bridge && bun test tests/utils/external-ref-resolver.test.ts`
Expected: FAIL (file/not found or missing implementation).

**Step 3: Write minimal implementation**

```ts
// src/beads-bridge/src/utils/external-ref-resolver.ts
export interface ExternalRefResolverOptions {
  configDir: string;
}

export class ExternalRefResolver {
  constructor(private readonly beads: BeadsClient, private readonly options: ExternalRefResolverOptions) {}

  async resolve(params: { repository: string; issueNumber: number }): Promise<ResolutionResult> {
    const targetRef = `github:${params.repository}#${params.issueNumber}`;
    const repositories = await this.beads.getAllIssues();
    const epics = [];

    for (const [repoName, issues] of repositories.entries()) {
      const match = issues.find(issue => issue.external_ref === targetRef && issue.issue_type === 'epic');
      if (match) {
        epics.push({ repository: repoName, epicId: match.id });
      }
    }

    if (epics.length === 0) {
      return { epics: [], metrics: { total: 0, completed: 0, blockers: [] } };
    }

    const stats = await this.beads.getEpicStatus(epics[0].repository, epics[0].epicId);
    return {
      epics,
      metrics: {
        total: stats.total,
        completed: stats.completed,
        blockers: stats.blockers
      }
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd src/beads-bridge && bun test tests/utils/external-ref-resolver.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
cd src/beads-bridge
git add src/utils/external-ref-resolver.ts src/utils/index.ts tests/utils/external-ref-resolver.test.ts
git commit -m "feat: add external ref resolver"
```

---

### Task 2: Replace MappingStore usage in skill and handlers

**Files:**
- Modify: `src/beads-bridge/src/skill.ts`, `src/beads-bridge/src/capabilities/progress-sync.ts`, `src/beads-bridge/src/capabilities/diagram-generator.ts`, `src/beads-bridge/src/synthesis/progress-synthesizer.ts`, `src/beads-bridge/src/diagrams/diagram-placer.ts`, `src/beads-bridge/src/decomposition/epic-decomposer.ts`
- Remove: `src/beads-bridge/src/store/mapping-store.ts`, `src/beads-bridge/src/store/index.ts`
- Tests: update affected specs (diagram, progress, decomposition) to stub resolver instead of MappingStore

**Step 1: Update tests to fail without mappings**
- Edit `tests/diagram-placer.test.ts`, `tests/progress-synthesizer.test.ts`, `tests/decomposition/epic-decomposer.test.ts.bak` to inject a fake resolver and expect calls to `resolve`.
- Run targeted tests: `bun test tests/diagram-placer.test.ts tests/progress-synthesizer.test.ts`
- Expected: FAIL (because production code still uses MappingStore).

**Step 2: Refactor production code**
- Construct `ExternalRefResolver` inside `createSkill` and pass to handlers.
- In `ProgressSynthesizer.getAggregatedProgress`, call `resolver.resolve` instead of `mappings.findByGitHubIssue`.
- `DiagramGeneratorHandler` and `DiagramPlacer` now call resolver to discover epics.
- Remove MappingStore imports/fields.
- Delete mapping store module and barrel export.

**Step 3: Re-run the same tests**
- `bun test tests/diagram-placer.test.ts tests/progress-synthesizer.test.ts`
- Expected: PASS.

**Step 4: Remove orphaned tests/files**
- Delete `tests/mapping-store.test.ts` and any `.bak` files referencing mappings.

**Step 5: Commit**

```bash
cd src/beads-bridge
git add src/**/* tests/**/*
git commit -m "refactor: route sync logic via external refs"
```

---

### Task 3: Remove legacy CLI commands and capabilities

**Files:**
- Modify: `src/beads-bridge/src/cli.ts`, `src/beads-bridge/src/capabilities/force-sync.ts`, `src/beads-bridge/src/types/skill.ts`, `src/beads-bridge/src/skill.ts`
- Remove: `src/beads-bridge/src/capabilities/force-sync.ts`, `src/beads-bridge/src/orchestration/shortcut-sync-orchestrator.ts`
- Tests: delete `tests/orchestration/shortcut-sync-orchestrator.test.ts.bak`, update CLI command snapshots if present.

**Step 1: Delete CLI commands**
- Remove `mapping`, `shortcut-*`, and `force-sync` commands from `cli.ts`.
- Adjust help text accordingly.

**Step 2: Update capability list**
- Remove `manage_mappings` and `force_sync` from `SkillCapability` union and metadata.
- Delete `ForceSyncHandler` file and references.
- Remove `ShortcutSyncOrchestrator`. Ensure `ProgressSyncHandler` handles Shortcut backend by checking external refs via resolver.

**Step 3: Run CLI-related tests**
- `bun test tests/cli/auth-commands.test.ts.bak tests/progress-synthesizer.test.ts`
- Expected: PASS.

**Step 4: Commit**

```bash
cd src/beads-bridge
git add src/**/* tests/**/*
git commit -m "chore: remove legacy mapping CLI commands"
```

---

### Task 4: Add legacy directory warning and update docs

**Files:**
- Create helper: `src/beads-bridge/src/utils/legacy-mapping-warning.ts`
- Modify: `src/beads-bridge/src/skill.ts`, `src/beads-bridge/src/config/config-manager.ts`, docs `src/beads-bridge/docs/ARCHITECTURE.md`, `src/beads-bridge/docs/TROUBLESHOOTING.md`, root `CHANGELOG.md`
- Tests: `tests/utils/legacy-mapping-warning.test.ts`, update integration specs to expect warning stub.

**Step 1: Write failing test**

```ts
// tests/utils/legacy-mapping-warning.test.ts
import { describe, expect, it, mock } from 'bun:test';
import { checkLegacyMappingDir } from '../../src/utils/legacy-mapping-warning.js';

it('returns warning message when mappings dir exists', async () => {
  mock.module('fs/promises', () => ({ access: () => Promise.resolve() }));
  const warn = mock.fn();

  const result = await checkLegacyMappingDir('.beads-bridge', warn);

  expect(result).toBe(true);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('external_ref'));
});
```

Run: `bun test tests/utils/legacy-mapping-warning.test.ts` → FAIL.

**Step 2: Implement helper**

```ts
// src/utils/legacy-mapping-warning.ts
import { access } from 'fs/promises';
import { join } from 'path';

export async function checkLegacyMappingDir(configDir: string, warn = console.warn): Promise<boolean> {
  const mappingsPath = join(configDir, 'mappings');
  try {
    await access(mappingsPath);
    warn('⚠️ Legacy .beads-bridge/mappings/ detected. Configure beads issues with external_ref (e.g., github:owner/repo#123).');
    return true;
  } catch {
    return false;
  }
}
```

Run test: expect PASS.

**Step 3: Hook warning into commands**
- In `createSkill`, when resolver finds zero epics, call `checkLegacyMappingDir` once per execution.
- Ensure warning triggers only for commands previously dependent on mappings (`sync`, `status`, `diagram`, `decompose`).

**Step 4: Update documentation**
- Remove mapping references from `ARCHITECTURE.md`, `TROUBLESHOOTING.md`, and mention new warning.
- Add changelog entry under `wms-10a`.

**Step 5: Run full test suite**
- `cd src/beads-bridge && bun test`
- Expected: PASS.

**Step 6: Commit**

```bash
cd src/beads-bridge
git add src/**/* tests/**/* docs/**/* CHANGELOG.md
git commit -m "feat: warn when legacy mappings directory exists"
```

---

### Task 5: Final verification and cleanup

**Files:**
- None new; focus on repo hygiene.

**Step 1: Run lint and type checks**
- `bun run lint`
- `bun run type-check`
- `bun run type-check:client`

**Step 2: Ensure root tests remain green**
- `cd ../.. && npm run validate`

**Step 3: Review git status**
- `git status -sb`

**Step 4: Summarize work**
- Prepare final summary + note any follow-ups (e.g., bead-side migration tooling).

**Step 5: Ready for PR**
- Tag plan completion in issue tracker if applicable.

---

Plan complete and saved to `docs/plans/2025-11-27-wms-10a-mapping-removal.md`.

Execution options:

1. **Subagent-Driven (this session)** – I'll use superpowers:subagent-driven-development here, dispatching a fresh subagent per task with reviews between tasks.
2. **Parallel Session** – Open a new terminal session in `.worktrees/wms-10a`, load this plan, and run superpowers:executing-plans to carry it out.

Which approach would you prefer?
