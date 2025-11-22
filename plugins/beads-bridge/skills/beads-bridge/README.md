# Beads-Bridge

[![Test Coverage](https://img.shields.io/badge/coverage-81.75%25-yellow.svg)](./docs/coverage-report.md)
[![Tests](https://img.shields.io/badge/tests-463%20passing-brightgreen.svg)](./docs/coverage-report.md)

Bidirectional sync between [Beads](https://github.com/steveyegge/beads) local issue tracking and project management platforms (GitHub, Shortcut).

## Version 2.0

**What's New:**
- Native SDK clients (Octokit for GitHub, @shortcut/client for Shortcut)
- No CLI dependencies required
- Separate credential management
- Automatic config migration from v1.0

## Features

- **Bidirectional Sync:** Keep Beads and your PM platform in sync
- **Multiple Backends:** GitHub Projects v2, Shortcut (Jira planned)
- **Dependency Tracking:** Sync issue dependencies and blockers
- **Scope Discovery:** Detect when work expands beyond estimates
- **Conflict Resolution:** Automatic and manual conflict handling
- **Mermaid Diagrams:** Visual dependency graphs
- **Work Hours:** Smart sync scheduling around your working hours

## Configuration

Beads-bridge v2.0 uses two separate configuration systems:

1. **Project Config** (`.beads-bridge/config.yaml`) - Project settings
2. **Credentials** (`~/.config/beads-bridge/credentials.json`) - API tokens

### Quick Start

```bash
# Initialize project config
beads-bridge init

# Authenticate
beads-bridge auth github    # For GitHub
beads-bridge auth shortcut  # For Shortcut

# Verify setup
beads-bridge auth status
```

See [Configuration Guide](./docs/CONFIGURATION.md) for complete documentation.

### No CLI Dependencies

v2.0 uses native SDK clients (Octokit, @shortcut/client). No need to install `gh` or `short` CLI tools.

**Requirements:**
- Node.js >= 18.0.0
- That's it!

## Backends

### GitHub Backend

Syncs with GitHub Projects v2 using Octokit SDK.

See [Configuration Guide](./docs/CONFIGURATION.md) for setup.

### Shortcut Backend

Syncs with Shortcut using native @shortcut/client SDK.

See [Shortcut Backend Documentation](./docs/SHORTCUT_BACKEND.md) for details.

### LiveWeb Backend

Real-time local web dashboard for visualizing beads dependency graphs.

```bash
beads-bridge serve pensive-8e2d
```

Opens browser to `http://localhost:3000/issue/pensive-8e2d` with live-updating graph.

See [LiveWeb Backend Documentation](docs/LIVEWEB_BACKEND.md) for details.

## Documentation

- [Configuration Guide](./docs/CONFIGURATION.md) - Complete config schema and options
- [Authentication Guide](./docs/AUTHENTICATION.md) - OAuth and token setup
- [Shortcut Backend](./docs/SHORTCUT_BACKEND.md) - Shortcut-specific features
- [LiveWeb Backend](./docs/LIVEWEB_BACKEND.md) - Real-time web dashboard
- [Test Coverage Report](./docs/coverage-report.md) - Test coverage analysis and metrics

## Architecture

### Backend Abstraction

```typescript
interface Backend {
  createIssue(issue: BeadsIssue): Promise<BackendIssue>
  updateIssue(id: string, updates: Partial<BeadsIssue>): Promise<void>
  getIssue(id: string): Promise<BackendIssue>
  linkIssues(from: string, to: string, type: LinkType): Promise<void>
  // ... more operations
}
```

Backends:
- **GitHubBackend:** Uses Octokit SDK for GitHub API
- **ShortcutBackend:** Uses @shortcut/client for Shortcut API

### Credential Management

Credentials stored separately in `~/.config/beads-bridge/credentials.json`:

```json
{
  "github": {
    "token": "ghp_encrypted_token",
    "type": "oauth"
  },
  "shortcut": {
    "token": "encrypted_api_token",
    "type": "api_key"
  }
}
```

Authentication via CLI:
```bash
beads-bridge auth github    # OAuth flow
beads-bridge auth shortcut  # API token prompt
beads-bridge auth status    # Check auth state
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm test -- --run --coverage

# Type check
npm run typecheck

# Build
npm run build
```

### Distribution

The CLI can be compiled into a single binary for distribution.
See [Building Single Binary](./docs/BUILDING_BINARY.md).

### Test Coverage

Current coverage: **81.75%** (463 tests passing)

See [Test Coverage Report](./docs/coverage-report.md) for detailed analysis.

Key coverage metrics:
- Core business logic: >90%
- Backend integrations: 75-100%
- Configuration system: 87%
- Authentication: 86%
- Integration tests: 25 end-to-end tests

## Migration from v1.0

**Automatic migration on first run.**

Changes:
- Config version bumped to 2.0
- `github.cliPath` removed (no longer needed)
- Authentication moved to separate credential store

Your existing settings will be preserved. No action required.

## License

MIT
