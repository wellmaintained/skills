# Automated Release Workflow and CI/CD Pipeline

**Date:** 2025-01-10
**Status:** Design Complete
**Implementation:** Pending

## Overview

Automate version management, testing, and releases for the wellmaintained-skills plugin marketplace using semantic-release. The system creates development tags automatically after tests pass and manages production releases through conventional commit analysis.

## Goals

1. Eliminate manual version synchronization across multiple package.json files
2. Enforce test passing before any release
3. Generate changelogs automatically from commit history
4. Reduce release ceremony to zero for development builds
5. Maintain clean semantic versioning for production releases

## Architecture

### Single Workflow: CI with Integrated Tagging

**File:** `.github/workflows/ci.yml`

**Triggers:**
- Pull requests to main
- Pushes to main branch

**Jobs:**

**1. Validate** (runs always)
- JSON syntax validation (marketplace.json, plugin.json files)
- Schema validation (ajv-cli with marketplace and plugin schemas)
- Directory structure validation
- Required files check (README.md, LICENSE, etc.)
- Version consistency check

**2. Test** (depends on validate, runs always)
- Matrix strategy: tests each plugin independently
- For each plugin:
  - Install dependencies (`npm ci`)
  - Build (`npm run build`)
  - Run tests (`npm test`)
  - Fail workflow if any test fails

**3. Release** (depends on test, runs only on main branch)
- Condition: `github.ref == 'refs/heads/main' && github.event_name == 'push'`
- Install semantic-release and plugins
- Run `npx semantic-release`
- semantic-release:
  - Analyzes conventional commits since last release
  - Calculates version bump (major/minor/patch)
  - Updates all package.json files
  - Updates marketplace.json
  - Generates/updates CHANGELOG.md
  - Creates git tag (e.g., `v2.1.0-dev.1`)
  - Creates GitHub release
  - Commits changes with `[skip ci]` flag

## semantic-release Configuration

**File:** `.releaserc.json`

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    [
      "@semantic-release/npm",
      {
        "npmPublish": false
      }
    ],
    "@semantic-release/github",
    [
      "@semantic-release/git",
      {
        "assets": [
          "CHANGELOG.md",
          "package.json",
          "package-lock.json",
          "plugins/*/skills/*/package.json",
          ".claude-plugin/marketplace.json"
        ],
        "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
      }
    ]
  ]
}
```

**Commit Analysis Rules:**
- `fix:` → patch version bump (1.0.0 → 1.0.1)
- `feat:` → minor version bump (1.0.0 → 1.1.0)
- `BREAKING CHANGE:` or `feat!:` or `fix!:` → major version bump (1.0.0 → 2.0.0)

## Version Strategy

**Development Versions:**
- Created on every push to main after tests pass
- Format: `v2.1.0-dev.1`, `v2.1.0-dev.2`, etc.
- Incremental counter for pre-release versions
- Valid semantic versioning with pre-release identifier

**Production Versions:**
- Created when accumulated changes warrant a release
- Format: `v2.1.0` (clean semver, no pre-release suffix)
- semantic-release decides when to promote based on commit types

## File Changes

**Files to Create:**

1. `.github/workflows/ci.yml` - Combined CI and release workflow
2. `.releaserc.json` - semantic-release configuration
3. `RELEASE.md` - Documentation for maintainers
4. Update root `package.json` - Add semantic-release devDependencies

**Files to Modify:**

1. `.github/workflows/validate-plugins.yml` - Rename to `ci.yml` or merge content

**Dependencies to Add:**

```json
{
  "devDependencies": {
    "semantic-release": "^22.0.0",
    "@semantic-release/changelog": "^6.0.0",
    "@semantic-release/git": "^10.0.0"
  }
}
```

## Workflow from Developer Perspective

**Normal Development:**
1. Create feature branch
2. Make changes using conventional commits
3. Push to branch
4. Create pull request
5. CI runs: validate → test (no release)
6. Merge to main
7. CI runs: validate → test → automatic dev release

**Production Release:**
- semantic-release automatically promotes to production version when appropriate
- No manual GitHub release creation needed
- Check GitHub releases page to see what was released
- semantic-release generates comprehensive release notes from commits

## Conventional Commit Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `fix:` - Bug fix (patch)
- `feat:` - New feature (minor)
- `feat!:` or `BREAKING CHANGE:` - Breaking change (major)
- `docs:` - Documentation only
- `chore:` - Maintenance (no version bump)
- `refactor:` - Code refactoring (no version bump)
- `test:` - Test changes (no version bump)

**Examples:**
```
fix: correct version consistency check script

feat: add JSON schema validation to CI

feat!: restructure plugin directory layout

BREAKING CHANGE: Plugins must now follow standard directory structure
```

## Benefits

1. **Zero manual version management** - semantic-release updates all version references
2. **Automatic changelogs** - Generated from conventional commits
3. **Test enforcement** - Releases only happen after tests pass
4. **Clear version history** - Dev tags for every commit, production releases for milestones
5. **Standard tooling** - semantic-release is industry standard, well-maintained
6. **Simple workflow** - Push to main, everything else is automatic

## Migration Path

1. Install semantic-release dependencies
2. Create `.releaserc.json` configuration
3. Update CI workflow to include semantic-release step
4. Create RELEASE.md documentation
5. Test on a development branch first
6. Merge to main and verify first automated release

## Testing Strategy

Before full rollout:
1. Create test branch matching production structure
2. Configure semantic-release for test branch
3. Make several conventional commits
4. Verify dev tags are created correctly
5. Verify package.json files update correctly
6. Verify CHANGELOG.md generates correctly
7. Verify GitHub releases are created
8. Switch configuration to main branch

## Rollback Plan

If semantic-release causes issues:
1. Revert `.github/workflows/ci.yml` to remove semantic-release job
2. Manual version management resumes
3. Investigate and fix configuration
4. Re-enable when ready

## Documentation Requirements

**RELEASE.md Contents:**
- Overview of automated release system
- Conventional commit format guide
- How to check if CI passed
- How versions are determined
- Troubleshooting common issues
- Examples of conventional commits
- Link to semantic-release documentation

## Success Criteria

- [ ] CI validates, tests, and releases automatically
- [ ] All tests must pass before any release
- [ ] Package.json files stay synchronized
- [ ] Marketplace.json updates with releases
- [ ] CHANGELOG.md generates correctly
- [ ] GitHub releases created automatically
- [ ] Developers use conventional commits
- [ ] No manual version editing needed
