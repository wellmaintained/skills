# Release Process

This repository uses [semantic-release](https://semantic-release.gitbook.io/) to automate version management and releases. Releases happen automatically based on conventional commits.

## How It Works

### Automated Development Releases

Every push to `main` that passes tests triggers semantic-release:

1. CI validates code structure and schemas
2. CI runs all plugin tests
3. If tests pass, semantic-release:
   - Analyzes commits since last release
   - Calculates version bump based on commit types
   - Updates all package.json files
   - Updates .claude-plugin/marketplace.json
   - Generates/updates CHANGELOG.md
   - Creates git tag (e.g., `v2.1.0-dev.1`)
   - Creates GitHub release with notes
   - Commits changes back to main

### Version Bump Rules

semantic-release determines version bumps from conventional commit messages:

| Commit Type | Version Bump | Example |
|-------------|--------------|---------|
| `fix:` | Patch (1.0.0 → 1.0.1) | `fix: correct schema validation error` |
| `feat:` | Minor (1.0.0 → 1.1.0) | `feat: add new plugin discovery feature` |
| `feat!:` or `BREAKING CHANGE:` | Major (1.0.0 → 2.0.0) | `feat!: restructure plugin directory layout` |
| `docs:`, `chore:`, `refactor:`, `test:` | No release | Documentation and maintenance |

### Development vs Production Versions

**Development versions** (prerelease):
- Created on every commit to main after tests pass
- Format: `v2.1.0-dev.1`, `v2.1.0-dev.2`, etc.
- Incremental counter for dev builds

**Production versions** (clean):
- semantic-release promotes to production automatically when appropriate
- Format: `v2.1.0` (no dev suffix)
- Based on accumulated changes and commit types

## Conventional Commit Format

All commits to main should follow the conventional commit format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Commit Types

- **fix:** Bug fixes (patch version bump)
- **feat:** New features (minor version bump)
- **feat!:** Breaking changes (major version bump)
- **docs:** Documentation changes only (no release)
- **chore:** Maintenance tasks (no release)
- **refactor:** Code refactoring (no release)
- **test:** Test changes (no release)
- **ci:** CI/CD changes (no release)

### Examples

**Bug fix (patch):**
```
fix: correct version consistency check in CI

The version check was not properly comparing marketplace.json
versions. Now uses consistent jq query for all version fields.
```

**New feature (minor):**
```
feat: add JSON schema validation to CI workflow

Adds comprehensive schema validation for marketplace.json and
plugin.json files using ajv-cli with format validation.

Benefits:
- Catches configuration errors early
- Enforces naming conventions
- Validates version format
```

**Breaking change (major):**
```
feat!: restructure plugin directory to match conventions

BREAKING CHANGE: Plugins must now follow standard directory
structure with skills at skills/<skill-name>/ instead of
having duplicate files at multiple levels.

Migration:
- Remove duplicate SKILL.md at skills/ level
- Keep only skills/<skill-name>/SKILL.md
- Update plugin.json if needed
```

## Checking Release Status

### Before You Start Work

Check that CI passed on main:
1. Go to Actions tab in GitHub
2. Verify latest CI run on main is green ✅
3. Check the release job completed successfully

### After You Merge

1. Wait for CI to complete (usually 3-5 minutes)
2. Check the Actions tab for job status
3. Check the Releases page for new release
4. Verify version updated in package.json files

## Troubleshooting

### semantic-release Failed

**Check the CI logs:**
1. Go to Actions tab
2. Click the failed workflow run
3. Expand the "Run semantic-release" step
4. Look for error messages

**Common issues:**

**"No release published"**
- This is normal! It means no commits since last release warrant a new version
- Only `fix:` and `feat:` commits trigger releases
- `docs:`, `chore:`, etc. don't trigger releases

**"ERELEASEBRANCH: The branch `main` is not in the range of branches"**
- Check .releaserc.json has correct branch name
- Ensure you're pushing to the correct branch

**"ENOCOMMITS: No commits since last release"**
- This is normal if you just pushed changes that don't trigger releases
- Only commit types fix:, feat:, BREAKING CHANGE: trigger releases

**"EGHNOPERMISSION: GitHub token missing permissions"**
- Check CI workflow has correct permissions block
- Verify GITHUB_TOKEN has contents: write permission

### Version Not Updated

If versions aren't updating after a release:
1. Check that .releaserc.json includes all package.json files in assets
2. Verify the paths match: `plugins/*/skills/*/package.json`
3. Check semantic-release created a commit with version updates
4. Look for the commit message: `chore(release): X.Y.Z [skip ci]`

### Tests Failing

Releases only happen after tests pass. If tests fail:
1. Fix the failing tests first
2. Push the fix with a conventional commit
3. CI will run again and release if tests pass

## Manual Release (Emergency Only)

In rare cases, you may need to manually create a release:

1. Ensure all tests pass on main
2. Determine next version following semver
3. Update all package.json files manually
4. Update .claude-plugin/marketplace.json
5. Commit: `chore(release): X.Y.Z [skip ci]`
6. Create git tag: `git tag vX.Y.Z`
7. Push: `git push && git push --tags`
8. Create GitHub release manually

**Note:** After manual release, semantic-release will resume from the new version.

## Resources

- [semantic-release documentation](https://semantic-release.gitbook.io/)
- [Conventional Commits specification](https://www.conventionalcommits.org/)
- [Semantic Versioning specification](https://semver.org/)
