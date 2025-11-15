# Agent Task: Upgrade octokit from 3.2.2 to 5.0.5

## Issue Tracking
**Bead ID**: `wms-8ux`
**Title**: Upgrade octokit from 3.2.2 to 5.0.5
**Priority**: P2 (Medium)
**Risk**: Medium - Runtime dependency for GitHub integration
**Impact**: GitHub backend functionality

## Environment Setup - CRITICAL

**ALWAYS set these first** when working in a worktree:

```bash
export BEADS_DB="/home/mrdavidlaing/baljeet-workspace/pensive/workspace/wellmaintained-skills/.beads/beads.db"
export BD_ACTOR="agent-$(whoami)-$$"
```

**Why?** Git worktrees don't share the `.beads/` folder. Without these:
- ❌ You'll create a duplicate database
- ❌ Other agents won't see your work
- ❌ You might claim tasks already taken

Verify the connection works:
```bash
bd info  # Should show: /home/.../wellmaintained-skills/.beads/beads.db
bd show wms-8ux
```

## Project Location
```bash
cd plugins/beads-bridge/skills/beads-bridge
```

## Task Requirements

### 1. Update Bead Status to in_progress
```bash
bd update wms-8ux --status in_progress
bd comment wms-8ux "Starting octokit upgrade. Current version: 3.2.2, target: 5.0.5. Researching breaking changes first."
```

### 2. Research Phase
- Search for octokit migration guides (3.x → 4.x → 5.x)
- Document major breaking changes
- Post findings as a comment to the bead

### 3. Code Analysis
- Find all octokit usage in the codebase: `grep -r "octokit" src/ tests/`
- Identify which APIs are being used
- Determine migration complexity
- Post analysis as a comment

### 4. Upgrade & Fix
- Update package.json: octokit to ^5.0.5
- Run `npm install`
- Fix any breaking changes in code
- Post updates as you progress

### 5. Testing
- Run full test suite: `npm test`
- Run type checking: `npm run type-check`
- Run linter: `npm run lint`
- Verify all 437 tests still pass
- Post test results

### 6. Security Check
```bash
npm audit
```
- Ensure 0 vulnerabilities remain

### 7. Track Progress with Comments
After each major step, post a comment:
```bash
bd comment wms-8ux "Research complete. Breaking changes: [list here]"
bd comment wms-8ux "Code analysis: Found N usages in [files]"
bd comment wms-8ux "Upgrade complete. Tests: X passed"
```

### 8. Completion
If successful:
```bash
bd comment wms-8ux "✅ SUCCESS: Upgraded octokit 3.2.2→5.0.5. All tests passing (437 passed). No vulnerabilities."
bd close wms-8ux --reason "Upgrade complete and tested"
```

If blocked or issues found:
```bash
bd comment wms-8ux "⚠️ BLOCKED: [describe issue]"
bd update wms-8ux --status blocked
```

## Success Criteria

- [ ] octokit upgraded from 3.2.2 to 5.0.5 in package.json
- [ ] All code updated for breaking changes
- [ ] All 437 tests passing
- [ ] Type checking passes
- [ ] Linter passes (0 errors)
- [ ] 0 npm vulnerabilities
- [ ] Clean git commit with meaningful message
- [ ] Bead status updated throughout process
- [ ] Final comment documenting outcome

## Commit Message Format

If successful, use this format:
```
chore(beads-bridge): upgrade octokit from 3.2.2 to 5.0.5

[Brief description of changes made]

Breaking changes addressed:
- [List key API changes you handled]

All tests passing (437 tests).
No vulnerabilities.

Closes: wms-8ux
```

## Example of Good Agent Behavior

A previous agent working on a zod upgrade demonstrated excellent behavior:
1. Started work and posted comment
2. Researched thoroughly before making changes
3. Discovered zod was unused (smart analysis!)
4. Made the better decision to remove vs upgrade
5. Tested thoroughly
6. Posted clear status updates
7. Closed the bead with success summary

## Notes

- The previous agent found that zod was unused and removed it instead of upgrading - be similarly thoughtful!
- If you discover octokit is also unused, consider removal instead of upgrade
- Post comments frequently so we can track your progress
- Ask questions via comments if you get stuck
- The beads database is local to this repo in `.beads/beads.db`

## Getting Started

```bash
# 1. Verify beads connection (no env vars needed!)
bd show wms-8ux

# 2. Mark as in-progress
bd update wms-8ux --status in_progress
bd comment wms-8ux "Starting work on octokit upgrade..."

# 3. Begin research
# [Your work starts here]
```

Good luck! 🚀
