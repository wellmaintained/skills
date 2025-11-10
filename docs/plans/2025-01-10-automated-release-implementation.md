# Automated Release Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement semantic-release based automated version management and release workflow that creates development tags after tests pass and manages production releases through conventional commit analysis.

**Architecture:** Single GitHub Actions CI workflow that validates structure/schemas, runs tests, then uses semantic-release to automatically bump versions, update package.json files, generate changelogs, and create releases. semantic-release analyzes conventional commits to determine version bumps and handles all git operations.

**Tech Stack:** semantic-release, GitHub Actions, ajv-cli (already present), Node.js 18

---

## Task 1: Add semantic-release Dependencies

**Files:**
- Modify: `package.json` (root)
- Modify: `package-lock.json` (will be auto-generated)

**Step 1: Add semantic-release to package.json devDependencies**

Open `package.json` and add these dependencies to the `devDependencies` section:

```json
{
  "devDependencies": {
    "ajv-cli": "^5.0.0",
    "ajv-formats": "^3.0.1",
    "semantic-release": "^22.0.0",
    "@semantic-release/changelog": "^6.0.0",
    "@semantic-release/git": "^10.0.0"
  }
}
```

**Step 2: Install dependencies**

Run: `npm install`
Expected: package-lock.json updated with new dependencies, node_modules populated

**Step 3: Verify installation**

Run: `npx semantic-release --version`
Expected: Output showing version 22.x.x

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add semantic-release dependencies for automated versioning"
```

---

## Task 2: Create semantic-release Configuration

**Files:**
- Create: `.releaserc.json`

**Step 1: Create .releaserc.json with semantic-release configuration**

Create `.releaserc.json` at repository root:

```json
{
  "branches": [
    "main"
  ],
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

**Step 2: Verify configuration syntax**

Run: `cat .releaserc.json | jq empty`
Expected: No output (valid JSON)

**Step 3: Commit**

```bash
git add .releaserc.json
git commit -m "feat: add semantic-release configuration for automated releases"
```

---

## Task 3: Rename and Update CI Workflow

**Files:**
- Rename: `.github/workflows/validate-plugins.yml` → `.github/workflows/ci.yml`
- Modify: `.github/workflows/ci.yml`

**Step 1: Rename the workflow file**

Run: `git mv .github/workflows/validate-plugins.yml .github/workflows/ci.yml`
Expected: File renamed in git staging area

**Step 2: Update workflow name**

In `.github/workflows/ci.yml`, change line 1 from:
```yaml
name: Validate Plugins
```

To:
```yaml
name: CI
```

**Step 3: Add semantic-release job after test-plugins job**

Add this new job at the end of the jobs section in `.github/workflows/ci.yml`:

```yaml
  release:
    name: Semantic Release
    runs-on: ubuntu-latest
    needs: [validate-structure, test-plugins]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    permissions:
      contents: write
      issues: write
      pull-requests: write
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npx semantic-release
```

**Step 4: Verify YAML syntax**

Run: `cat .github/workflows/ci.yml | ruby -ryaml -e 'YAML.load(STDIN.read)'`
Expected: No errors (valid YAML)

**Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "feat: add semantic-release job to CI workflow

Workflow now:
- Validates structure and schemas
- Runs tests for all plugins
- Creates automated releases on main branch after tests pass

semantic-release analyzes conventional commits and:
- Calculates version bumps
- Updates package.json files
- Updates marketplace.json
- Generates CHANGELOG.md
- Creates GitHub releases
- Commits changes back to main"
```

---

## Task 4: Create RELEASE.md Documentation

**Files:**
- Create: `RELEASE.md`

**Step 1: Create RELEASE.md with maintainer documentation**

Create `RELEASE.md` at repository root:

```markdown
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
```

**Step 2: Commit**

```bash
git add RELEASE.md
git commit -m "docs: add release process documentation for maintainers

Comprehensive guide covering:
- How automated releases work
- Conventional commit format
- Version bump rules
- Development vs production versions
- Troubleshooting common issues
- Examples of good commit messages"
```

---

## Task 5: Update README with Release Information

**Files:**
- Modify: `README.md`

**Step 1: Add release information section**

In `README.md`, add a new section after the "Contributing" section (or create Contributing section if it doesn't exist):

```markdown
## Releases

This repository uses automated releases powered by [semantic-release](https://semantic-release.gitbook.io/).

**For contributors:**
- Use [conventional commit messages](https://www.conventionalcommits.org/)
- Releases happen automatically when you push to `main`
- See [RELEASE.md](RELEASE.md) for detailed release process

**Version bumps:**
- `fix:` = patch release (1.0.0 → 1.0.1)
- `feat:` = minor release (1.0.0 → 1.1.0)
- `feat!:` or `BREAKING CHANGE:` = major release (1.0.0 → 2.0.0)
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add release information to README

Points contributors to RELEASE.md and explains conventional
commit format for version bumps."
```

---

## Task 6: Test Configuration Locally (Dry Run)

**Files:**
- None (testing only)

**Step 1: Run semantic-release in dry-run mode**

Run: `GITHUB_TOKEN=fake npx semantic-release --dry-run`
Expected: Output showing what semantic-release would do, including:
- Commit analysis results
- Calculated version bump
- Assets that would be updated
- "The release would be published" message

**Step 2: Verify dry-run finds commits correctly**

Check the output includes:
- Analysis of recent commits
- Identification of commit types (fix, feat, etc.)
- Calculated next version

If output shows "No release published", that's expected - means recent commits don't warrant a release.

**Step 3: Document test results**

No commit needed - this was a verification step.

---

## Task 7: Create Initial Test Release

**Files:**
- None (will be created by semantic-release)

**Step 1: Push all changes to main**

Run: `git push origin main`
Expected: All commits pushed successfully

**Step 2: Monitor CI workflow**

1. Go to GitHub Actions tab
2. Watch the CI workflow run
3. Verify all jobs complete successfully:
   - validate-structure ✅
   - test-plugins ✅
   - release ✅

**Step 3: Verify release created**

Check these were created/updated by semantic-release:
1. **GitHub Release:** Go to Releases tab, verify new release exists
2. **Git Tag:** Run `git fetch --tags && git tag` to see new tag
3. **CHANGELOG.md:** Verify file created at root
4. **Version Updates:** Run `git pull` and check package.json versions updated

**Step 4: Verify marketplace.json updated**

Run: `jq '.plugins[].version' .claude-plugin/marketplace.json`
Expected: Version matches the new release version

**Step 5: Document any issues**

If anything didn't work as expected:
- Capture error messages from CI logs
- Note which step failed
- Prepare to iterate on configuration

---

## Task 8: Test Version Bump with Conventional Commit

**Files:**
- Modify: `README.md` (or any file for testing)

**Step 1: Make a small fix with conventional commit**

Add a small improvement to README.md (e.g., fix a typo or add clarification).

**Step 2: Commit with fix: prefix**

```bash
git add README.md
git commit -m "fix: improve clarity in release documentation

Made version bump rules more prominent and easier to scan."
```

**Step 3: Push and monitor**

Run: `git push origin main`

Monitor CI:
1. Watch Actions tab
2. Verify release job runs
3. Check new patch version created (e.g., 2.0.0 → 2.0.1)

**Step 4: Verify version incremented correctly**

Run: `git pull && git tag --sort=-v:refname | head -5`
Expected: New tag with patch version bump

---

## Task 9: Test Feature Release with feat: Commit

**Files:**
- Modify: `RELEASE.md` (or any file for testing)

**Step 1: Make a small feature addition**

Add a new section to RELEASE.md or expand existing content.

**Step 2: Commit with feat: prefix**

```bash
git add RELEASE.md
git commit -m "feat: add troubleshooting section to release docs

Added common issues and solutions section to help maintainers
debug semantic-release problems."
```

**Step 3: Push and monitor**

Run: `git push origin main`

Monitor CI and verify minor version bump (e.g., 2.0.1 → 2.1.0)

**Step 4: Verify CHANGELOG.md updated**

Run: `git pull && cat CHANGELOG.md`
Expected: Both the fix and feat commits listed in changelog

---

## Task 10: Final Verification and Cleanup

**Files:**
- Potentially: Cleanup any test changes

**Step 1: Verify complete workflow**

Check these all work correctly:
- [ ] CI validates structure and schemas
- [ ] CI runs tests for all plugins
- [ ] Tests must pass before release
- [ ] semantic-release creates version tags
- [ ] package.json files update automatically
- [ ] marketplace.json updates automatically
- [ ] CHANGELOG.md generates and updates
- [ ] GitHub releases created with notes
- [ ] Conventional commits trigger correct version bumps

**Step 2: Review CHANGELOG.md**

Run: `cat CHANGELOG.md`
Expected: Well-formatted changelog with sections for each release

**Step 3: Test that chore: commits don't trigger releases**

Make a trivial change:
```bash
echo "# Test comment" >> .gitignore
git add .gitignore
git commit -m "chore: test that maintenance commits don't release"
git push origin main
```

Monitor CI - verify release job runs but semantic-release outputs "No release published"

**Step 4: Clean up test comment if needed**

If you added test content, remove it:
```bash
git checkout .gitignore
git commit -m "chore: remove test changes"
git push origin main
```

**Step 5: Final commit**

```bash
git commit --allow-empty -m "chore: mark automated release workflow implementation complete

All components verified working:
- semantic-release configuration
- CI workflow integration
- Conventional commit analysis
- Version bumping (patch, minor, major)
- CHANGELOG generation
- GitHub release creation
- Package.json synchronization"
```

---

## Success Criteria

Implementation is complete when:

- [ ] semantic-release dependencies installed
- [ ] .releaserc.json configured correctly
- [ ] CI workflow includes release job
- [ ] Release job only runs on main branch after tests pass
- [ ] RELEASE.md documentation created
- [ ] README.md updated with release info
- [ ] fix: commits create patch releases (0.0.1)
- [ ] feat: commits create minor releases (0.1.0)
- [ ] BREAKING CHANGE: creates major releases (1.0.0)
- [ ] chore: commits don't trigger releases
- [ ] package.json files synchronize automatically
- [ ] marketplace.json synchronizes automatically
- [ ] CHANGELOG.md generates correctly
- [ ] GitHub releases created with proper notes
- [ ] Git tags follow semantic versioning

## Rollback Plan

If issues arise during implementation:

1. **Disable release job:** Add `if: false` to release job in ci.yml
2. **Revert commits:** Use `git revert` on semantic-release commits
3. **Manual version management:** Resume editing versions manually while debugging
4. **Review logs:** Check GitHub Actions logs for error details
5. **Test locally:** Run `npx semantic-release --dry-run` to debug without pushing

## Notes for Implementation

- Each task is independent and testable
- Tasks 1-5 set up infrastructure
- Tasks 6-9 test the workflow
- Task 10 verifies everything works end-to-end
- Expect the first run to create an initial release
- semantic-release will analyze all previous commits when first run
- Use conventional commits from this point forward
- Keep commits small and focused for better changelogs
