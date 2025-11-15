# Agent Task: Package Upgrade Template

## Quick Reference - Available Upgrade Tasks

```bash
# List all open dependency upgrade beads
bd list --label dependencies --status open

# Currently available in this repo:
# - wms-8ux: Upgrade octokit from 3.2.2 to 5.0.5 (Medium risk)
# - wms-4qj: Upgrade @shortcut/client from 1.1.0 to 2.3.1 (Medium risk)
# - wms-1xb: Upgrade express from 4.21.2 to 5.1.0 (HIGH risk)
```

## Environment Setup

**Good news!** This repo has its own local beads database at `.beads/beads.db`. **No environment variables needed!**

Verify connection:
```bash
bd info
bd show <bead-id>  # e.g., wms-8ux
```

## Project Location
```bash
cd plugins/beads-bridge/skills/beads-bridge
```

## Standard Upgrade Workflow

### Phase 1: Start Work
```bash
bd update <bead-id> --status in_progress
bd comment <bead-id> "Starting <package> upgrade. Current: <version>, Target: <version>. Researching breaking changes first."
```

### Phase 2: Research
- Search for migration guides and changelogs
- Document breaking changes
- Post findings to bead:
```bash
bd comment <bead-id> "Research complete. Breaking changes: [list]"
```

### Phase 3: Code Analysis
```bash
# Find usage
grep -r "<package-name>" src/ tests/

# Analyze impact
bd comment <bead-id> "Code analysis: Found N usages in [files]. Migration complexity: [low/medium/high]"
```

**IMPORTANT**: If package is unused, consider removal instead of upgrade!

### Phase 4: Upgrade
```bash
# Update package
npm install <package>@<version>

# Fix breaking changes in code
# [Make necessary changes]

# Post updates
bd comment <bead-id> "Upgrade applied. Fixed breaking changes in [files]"
```

### Phase 5: Verification
```bash
# Run all checks
npm run type-check
npm run lint
npm test
npm audit

# Post results
bd comment <bead-id> "Tests: X passed, Y failed. Vulnerabilities: N"
```

### Phase 6: Completion

**If successful:**
```bash
bd comment <bead-id> "✅ SUCCESS: Upgraded <package> <old>→<new>. All tests passing. No vulnerabilities."
bd close <bead-id> --reason "Upgrade complete and tested"
```

**If blocked:**
```bash
bd comment <bead-id> "⚠️ BLOCKED: [describe issue and what help is needed]"
bd update <bead-id> --status blocked
```

## Success Criteria Checklist

- [ ] Package upgraded in package.json and package-lock.json
- [ ] All breaking changes addressed
- [ ] Type checking passes (`npm run type-check`)
- [ ] Linter passes (`npm run lint`)
- [ ] All tests passing (`npm test` - should be 437 passed, 4 skipped)
- [ ] No npm vulnerabilities (`npm audit`)
- [ ] Clean commit with descriptive message
- [ ] Bead updated throughout with comments
- [ ] Bead closed with final summary

## Commit Message Format

```
chore(beads-bridge): upgrade <package> from <old> to <new>

[Brief description of what was upgraded and why]

Breaking changes addressed:
- [List key changes]
- [Another change]

All tests passing (437 tests).
No vulnerabilities.

Closes: <bead-id>
```

## Communication Best Practices

1. **Post comments frequently** - Don't go silent for long periods
2. **Be specific** - "Found 5 usages in src/backends/github.ts" not "found some"
3. **Show your thinking** - If you discover something unexpected, share it
4. **Ask for help** - If blocked, explain what you tried and where you're stuck
5. **Celebrate success** - Use ✅ and clear summaries when done

## Example: Good Agent Workflow

A zod upgrade agent demonstrated excellent behavior:

```bash
# Comment 1: Started work
"Starting work on zod upgrade. Current version in package.json: ^3.22.0, target: 4.1.12. Will research breaking changes first."

# Comment 2: Research complete
"Research complete. Major breaking changes in Zod 4: [detailed list]
Next: Scanning codebase for Zod usage patterns."

# Comment 3: Discovery
"Codebase scan complete. Discovered that zod is listed in package.json dependencies but appears to be UNUSED..."

# Comment 4: Smart decision
"DISCOVERY: npm ls zod shows '(empty)' - zod is completely unused.
RECOMMENDATION: Instead of upgrading zod 3.22→4.1.12, we should REMOVE it entirely..."

# Comment 5: Action taken
"Removed zod from package.json dependencies. This is cleaner than upgrading since the package is completely unused."

# Comment 6: Success
"✅ SUCCESS: All tests passing (437 passed, 4 skipped). [summary]
Result: Instead of upgrading zod 3→4, removed it entirely as it was dead code."
```

**Key lessons:**
- Agent researched first (due diligence)
- Agent scanned before acting (discovered truth)
- Agent made intelligent pivot (remove vs upgrade)
- Agent tested thoroughly (all tests pass)
- Agent communicated clearly throughout

## Tips for Different Risk Levels

### Medium Risk (octokit, @shortcut/client)
- Should be straightforward if APIs are stable
- Focus on testing the specific integration (GitHub/Shortcut)
- Check if newer version has better TypeScript types

### High Risk (express)
- Affects core web server functionality
- Consider doing in smaller steps if possible
- Extra thorough testing required
- May want to research if there's a LTS version to target

## Reference Files

- See current task instructions: `.beads/AGENT_UPGRADE_INSTRUCTIONS.md` (specific to octokit)
- See project structure: `plugins/beads-bridge/skills/beads-bridge/`
- See test structure: `plugins/beads-bridge/skills/beads-bridge/tests/`

## Getting Help

If you get stuck:
1. Post a comment to the bead describing the issue
2. Set status to `blocked`
3. Human will review and provide guidance

Happy upgrading! 🚀
