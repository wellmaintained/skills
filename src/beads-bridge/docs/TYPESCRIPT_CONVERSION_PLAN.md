# TypeScript Conversion Plan: Eliminating CLI Dependencies

## Executive Summary

This plan outlines the conversion of beads-bridge from a CLI-wrapper architecture (shelling to `gh` and `short` commands) to a pure TypeScript implementation using direct API libraries. This will improve performance, reliability, error handling, and eliminate external binary dependencies.

**Key Benefits:**
- Remove dependency on `gh` and `short` CLI tools
- Better error handling and type safety
- Improved performance (no subprocess overhead)
- Richer API access (GraphQL for GitHub Projects v2)
- Easier testing and mocking

**Estimated Effort:** 42-56 hours (~1-1.5 weeks)

**Breaking Changes:** Yes - requires migration to v2.0.0

## Technology Stack

### Core Libraries

1. **Octokit** - Official GitHub SDK
   - Package: `octokit` (https://github.com/octokit/octokit.js)
   - Features: Unified REST + GraphQL, auto-pagination, TypeScript-first
   - Stars: 7.6k
   - Maturity: Production-ready, actively maintained by GitHub

2. **@shortcut/client** - Official Shortcut SDK
   - Package: `@shortcut/client` (https://github.com/useshortcut/client-js)
   - Features: Full REST API coverage, TypeScript support
   - Stars: 138
   - Maturity: Official library, stable API

### Authentication
- **GitHub**: OAuth 2.0 Device Flow (no browser required)
- **Shortcut**: API Token (from user settings)
- **Storage**: Encrypted credentials in `~/.config/beads-bridge/credentials.json`

## Implementation Phases

### Phase 1: Authentication & Credential Storage (6-8 hours)

#### Goals
- Implement OAuth device flow for GitHub
- Create secure credential storage
- Build credential management CLI commands

#### Key Modules

**1.1 OAuth Module** (`src/auth/github-oauth.ts`)
```typescript
export class GitHubOAuth {
  async authenticate(): Promise<string> {
    // 1. Request device code
    // 2. Display user code and verification URL
    // 3. Poll for authorization
    // 4. Return access token
  }
}
```

**1.2 Credential Store** (`src/auth/credential-store.ts`)
```typescript
interface Credentials {
  github?: {
    token: string;
    scopes: string[];
    expiresAt?: Date;
  };
  shortcut?: {
    token: string;
  };
}

export class CredentialStore {
  async save(credentials: Credentials): Promise<void>
  async load(): Promise<Credentials>
  async clear(): Promise<void>
}
```

**1.3 CLI Commands**
```bash
beads-bridge auth github     # Interactive GitHub OAuth
beads-bridge auth shortcut   # Prompt for Shortcut token
beads-bridge auth status     # Show auth status
beads-bridge auth clear      # Remove stored credentials
```

#### Acceptance Criteria
- [ ] OAuth device flow successfully authenticates with GitHub
- [ ] Credentials stored securely with encryption
- [ ] CLI commands work for setup and management
- [ ] Error handling for expired/invalid tokens

---

### Phase 2: GitHub Backend Rewrite with Octokit (10-12 hours)

#### Goals
- Replace all `gh api` calls with Octokit
- Implement GraphQL queries for Projects v2
- Maintain existing interface contract

#### Key Changes

**2.1 Client Initialization** (`src/backends/github.ts`)
```typescript
import { Octokit } from 'octokit';

export class GitHubBackend implements Backend {
  private octokit: Octokit;

  constructor(credentials: Credentials) {
    this.octokit = new Octokit({
      auth: credentials.github?.token
    });
  }
}
```

**2.2 Issue Operations**

**BEFORE:**
```typescript
const { stdout } = await execFile('gh', [
  'api', `/repos/${owner}/${repo}/issues/${number}`
]);
const issue = JSON.parse(stdout);
```

**AFTER:**
```typescript
const { data: issue } = await this.octokit.rest.issues.get({
  owner,
  repo,
  issue_number: number
});
```

**2.3 Projects v2 GraphQL**

```typescript
const query = `
  query($org: String!, $number: Int!) {
    organization(login: $org) {
      projectV2(number: $number) {
        id
        title
        items(first: 100) {
          nodes {
            id
            content {
              ... on Issue {
                number
                title
                state
              }
            }
          }
        }
      }
    }
  }
`;

const result = await this.octokit.graphql(query, {
  org: orgName,
  number: projectNumber
});
```

**2.4 Error Handling**
```typescript
try {
  await this.octokit.rest.issues.update({ ... });
} catch (error) {
  if (error.status === 404) {
    throw new Error(`Issue not found: ${owner}/${repo}#${number}`);
  } else if (error.status === 403) {
    throw new Error('Permission denied. Check token scopes.');
  }
  throw error;
}
```

#### Acceptance Criteria
- [ ] All REST API operations work (issues, labels, comments)
- [ ] GraphQL Projects v2 queries return correct data
- [ ] Error handling covers auth, permissions, rate limits
- [ ] Pagination handled for large result sets
- [ ] Existing tests pass with new implementation

---

### Phase 3: Shortcut Backend Rewrite (6-8 hours)

#### Goals
- Replace all `short` CLI calls with @shortcut/client
- Maintain workflow state mapping
- Keep existing interface

#### Key Changes

**3.1 Client Initialization** (`src/backends/shortcut.ts`)
```typescript
import { ShortcutClient } from '@shortcut/client';

export class ShortcutBackend implements Backend {
  private client: ShortcutClient;

  constructor(credentials: Credentials) {
    this.client = new ShortcutClient(credentials.shortcut?.token || '');
  }
}
```

**3.2 Story Operations**

**BEFORE:**
```typescript
const { stdout } = await execFile('short', [
  'story', 'show', storyId, '--json'
]);
const story = JSON.parse(stdout);
```

**AFTER:**
```typescript
const story = await this.client.getStory(parseInt(storyId));
```

**3.3 Workflow State Management**
```typescript
// Map Beads status to Shortcut workflow state
private async getWorkflowState(status: BeadsStatus): Promise<number> {
  const workflows = await this.client.listWorkflows();
  const states = workflows[0].states;

  switch (status) {
    case 'open':
      return states.find(s => s.type === 'unstarted')?.id || states[0].id;
    case 'in_progress':
      return states.find(s => s.type === 'started')?.id || states[1].id;
    case 'closed':
      return states.find(s => s.type === 'done')?.id || states[states.length - 1].id;
  }
}
```

**3.4 Batch Operations**
```typescript
// Shortcut API supports batch updates
async updateMultipleStories(updates: StoryUpdate[]): Promise<void> {
  await Promise.all(
    updates.map(u => this.client.updateStory(u.id, u.changes))
  );
}
```

#### Acceptance Criteria
- [ ] All story CRUD operations work
- [ ] Comments and links created successfully
- [ ] Workflow state mapping preserved
- [ ] Custom field handling works
- [ ] Existing tests pass

---

### Phase 4: Configuration Updates (4-6 hours)

#### Goals
- Update config schema for API credentials
- Add OAuth app configuration
- Migration helpers for existing configs

#### Configuration Schema

**4.1 New Config Structure** (`src/config/schema.ts`)
```typescript
export interface BeadsBridgeConfig {
  version: 2;

  auth: {
    github?: {
      clientId: string;  // OAuth app client ID
      scopes: string[];  // Required: repo, read:org, read:project
    };
    shortcut?: {
      // Token stored in credential store
    };
  };

  backends: {
    github?: {
      defaultOrg?: string;
      defaultRepo?: string;
      projectNumber?: number;
      labelPrefix?: string;
    };
    shortcut?: {
      defaultWorkspace?: string;
      projectId?: number;
      customFields?: Record<string, string>;
    };
  };

  sync: {
    direction: 'beads-to-pm' | 'pm-to-beads' | 'bidirectional';
    conflictResolution: 'beads-wins' | 'pm-wins' | 'manual';
  };
}
```

**4.2 Migration Helper**
```typescript
export async function migrateConfigV1toV2(oldConfig: any): Promise<BeadsBridgeConfig> {
  return {
    version: 2,
    auth: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID || 'default-client-id',
        scopes: ['repo', 'read:org', 'read:project']
      }
    },
    backends: {
      github: {
        defaultOrg: oldConfig.github?.org,
        defaultRepo: oldConfig.github?.repo,
        projectNumber: oldConfig.github?.projectNumber
      },
      shortcut: {
        projectId: oldConfig.shortcut?.projectId
      }
    },
    sync: oldConfig.sync || { direction: 'beads-to-pm', conflictResolution: 'beads-wins' }
  };
}
```

#### Acceptance Criteria
- [ ] Config schema supports new auth model
- [ ] Migration from v1 to v2 works
- [ ] Validation errors are clear
- [ ] Docs updated with new config format

---

### Phase 5: CLI Command Updates (2-3 hours)

#### Goals
- Update command implementations
- Improve error messages
- Add auth status checks

#### Changes

**5.1 Command Wrapper**
```typescript
// Ensure authenticated before running commands
async function withAuth(backend: 'github' | 'shortcut', fn: () => Promise<void>) {
  const creds = await credentialStore.load();

  if (backend === 'github' && !creds.github?.token) {
    console.error('Not authenticated with GitHub. Run: beads-bridge auth github');
    process.exit(1);
  }

  await fn();
}
```

**5.2 Improved Error Messages**
```typescript
// Replace generic errors with helpful suggestions
try {
  await backend.sync();
} catch (error) {
  if (error.message.includes('401')) {
    console.error('Authentication failed. Your token may have expired.');
    console.error('Run: beads-bridge auth github');
  } else if (error.message.includes('403')) {
    console.error('Permission denied. Your token needs additional scopes.');
    console.error('Run: beads-bridge auth github --reauth');
  } else {
    console.error(`Sync failed: ${error.message}`);
  }
  process.exit(1);
}
```

#### Acceptance Criteria
- [ ] All commands check auth before executing
- [ ] Error messages guide users to solutions
- [ ] Help text updated with new auth flow

---

### Phase 6: Testing Updates (8-10 hours)

#### Goals
- Mock Octokit and @shortcut/client
- Update integration tests
- Add auth flow tests

#### Test Strategy

**6.1 Unit Tests with Mocks**
```typescript
import { Octokit } from 'octokit';

jest.mock('octokit');

describe('GitHubBackend', () => {
  let mockOctokit: jest.Mocked<Octokit>;

  beforeEach(() => {
    mockOctokit = {
      rest: {
        issues: {
          get: jest.fn(),
          update: jest.fn(),
          create: jest.fn()
        }
      },
      graphql: jest.fn()
    } as any;

    (Octokit as jest.Mock).mockReturnValue(mockOctokit);
  });

  it('should fetch issue', async () => {
    mockOctokit.rest.issues.get.mockResolvedValue({
      data: { number: 123, title: 'Test Issue' }
    });

    const backend = new GitHubBackend({ github: { token: 'test' } });
    const issue = await backend.getIssue('owner', 'repo', 123);

    expect(issue.title).toBe('Test Issue');
  });
});
```

**6.2 Integration Tests**
```typescript
// Use real credentials from environment
describe('GitHub Integration', () => {
  const token = process.env.GITHUB_TEST_TOKEN;

  beforeAll(() => {
    if (!token) {
      throw new Error('GITHUB_TEST_TOKEN required for integration tests');
    }
  });

  it('should create and fetch issue', async () => {
    const backend = new GitHubBackend({ github: { token } });
    // ... real API calls to test repo
  });
});
```

**6.3 Auth Flow Tests**
```typescript
describe('GitHubOAuth', () => {
  it('should poll for device authorization', async () => {
    // Mock fetch to simulate GitHub OAuth flow
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ json: () => ({ device_code: 'ABC', user_code: '1234' }) })
      .mockResolvedValueOnce({ json: () => ({ error: 'authorization_pending' }) })
      .mockResolvedValueOnce({ json: () => ({ access_token: 'gho_token123' }) });

    const oauth = new GitHubOAuth('client-id');
    const token = await oauth.authenticate();

    expect(token).toBe('gho_token123');
  });
});
```

#### Test Coverage Goals
- [ ] Unit tests: >90% coverage
- [ ] All API operations mocked
- [ ] Integration tests for happy paths
- [ ] Auth flow error scenarios covered

---

### Phase 7: Documentation Updates (3-4 hours)

#### Files to Update

**7.1 README.md**
- Remove references to `gh` and `short` CLI dependencies
- Add OAuth setup instructions
- Update installation steps
- Add troubleshooting section for auth issues

**7.2 SKILL.md**
- Update dependencies list
- Revise setup instructions
- Add auth command documentation

**7.3 New Auth Guide** (`docs/AUTHENTICATION.md`)
```markdown
# Authentication Guide

## GitHub OAuth Setup

### 1. Run Interactive Authentication
```bash
beads-bridge auth github
```

This will:
1. Request a device code from GitHub
2. Display a verification URL and code
3. Open your browser to https://github.com/login/device
4. Wait for you to authorize the app
5. Save your access token securely

### 2. Required Scopes
- `repo` - Access private repositories
- `read:org` - Read organization data
- `read:project` - Access GitHub Projects v2

### Troubleshooting
- **Token expired**: Run `beads-bridge auth github` to re-authenticate
- **Wrong scopes**: Run `beads-bridge auth github --reauth` to update scopes
- **Rate limited**: Check `beads-bridge auth status` for rate limit info
```

**7.4 Migration Guide** (`docs/MIGRATION_V1_TO_V2.md`)
```markdown
# Migration Guide: v1.x to v2.0

## Breaking Changes

### 1. No More CLI Dependencies
- ❌ Remove: `gh` CLI installation
- ❌ Remove: `short` CLI installation
- ✅ Add: OAuth authentication with `beads-bridge auth`

### 2. Configuration Format Changed
- Config file location: same (`~/.config/beads-bridge/config.yaml`)
- Schema: updated (auto-migrated on first run)

### 3. First-Time Setup
```bash
# 1. Update to v2.0
npm install -g beads-bridge@2.0

# 2. Authenticate
beads-bridge auth github
beads-bridge auth shortcut

# 3. Verify
beads-bridge auth status

# 4. Test sync
beads-bridge sync --dry-run
```

## Rollback Plan
If you need to revert to v1.x:
```bash
npm install -g beads-bridge@1.x
# Your old config will still work
```
```

#### Acceptance Criteria
- [ ] All docs reflect new auth model
- [ ] Migration guide is clear and tested
- [ ] Examples updated with new commands
- [ ] Troubleshooting covers common auth issues

---

### Phase 8: Migration & Backwards Compatibility (2-3 hours)

#### Goals
- Auto-migrate v1 configs
- Detect existing `gh`/`short` auth
- Smooth upgrade path

#### Migration Strategy

**8.1 Config Auto-Migration**
```typescript
async function loadConfig(): Promise<BeadsBridgeConfig> {
  const configPath = path.join(os.homedir(), '.config/beads-bridge/config.yaml');
  const config = yaml.load(fs.readFileSync(configPath, 'utf8'));

  if (!config.version || config.version === 1) {
    console.log('Migrating config from v1 to v2...');
    const newConfig = await migrateConfigV1toV2(config);
    fs.writeFileSync(configPath, yaml.dump(newConfig));
    console.log('✓ Config migrated successfully');
    return newConfig;
  }

  return config as BeadsBridgeConfig;
}
```

**8.2 Import Existing Tokens**
```typescript
// Check if user has gh CLI configured
async function importGitHubToken(): Promise<string | null> {
  try {
    const { stdout } = await execFile('gh', ['auth', 'token']);
    return stdout.trim();
  } catch {
    return null;
  }
}

// Offer to import during first auth
async function firstTimeSetup() {
  const existingToken = await importGitHubToken();

  if (existingToken) {
    const answer = await prompt('Found existing gh CLI token. Import it? (y/n)');
    if (answer === 'y') {
      await credentialStore.save({ github: { token: existingToken } });
      console.log('✓ Imported token from gh CLI');
      return;
    }
  }

  // Fall back to OAuth
  await runOAuthFlow();
}
```

#### Acceptance Criteria
- [ ] v1 configs auto-migrate on first run
- [ ] Existing `gh` tokens can be imported
- [ ] Clear messages during migration
- [ ] No data loss during upgrade

---

### Phase 9: Package Updates (1-2 hours)

#### Goals
- Update dependencies
- Version bump to 2.0.0
- Publish to npm

#### Changes

**9.1 package.json Updates**
```json
{
  "name": "beads-bridge",
  "version": "2.0.0",
  "dependencies": {
    "octokit": "^3.1.0",
    "@shortcut/client": "^1.0.0",
    "commander": "^14.0.2",
    "zod": "^3.22.0",
    "yaml": "^2.3.4"
  },
  "peerDependencies": {
    "node": ">=18.0.0"
  }
}
```

**9.2 Remove Old Dependencies**
- Remove any CLI wrapper utilities
- Clean up subprocess-related code

**9.3 CHANGELOG.md**
```markdown
# Changelog

## [2.0.0] - 2025-11-XX

### Breaking Changes
- Removed dependency on `gh` and `short` CLI tools
- New OAuth-based authentication for GitHub
- Updated configuration schema (auto-migrated)

### Added
- Direct API integration with Octokit
- Direct API integration with @shortcut/client
- OAuth device flow authentication
- Credential management commands
- GraphQL support for GitHub Projects v2

### Improved
- 10x faster sync operations (no subprocess overhead)
- Better error messages with actionable suggestions
- Type-safe API interactions
- Comprehensive test coverage (>90%)

### Migration
See [MIGRATION_V1_TO_V2.md](docs/MIGRATION_V1_TO_V2.md) for upgrade guide.
```

#### Acceptance Criteria
- [ ] Version bumped to 2.0.0
- [ ] Dependencies updated
- [ ] CHANGELOG complete
- [ ] Published to npm

---

## Testing Strategy

### Unit Tests
- Mock all API clients
- Test business logic in isolation
- Coverage target: >90%

### Integration Tests
- Use real API credentials (from env vars)
- Test against sandbox repos/workspaces
- Run in CI with secrets

### Manual Testing Checklist
- [ ] Fresh install on clean machine
- [ ] OAuth flow completes successfully
- [ ] Sync beads → GitHub creates issues
- [ ] Sync beads → Shortcut creates stories
- [ ] Bidirectional sync resolves conflicts
- [ ] Error messages are helpful
- [ ] Migration from v1 works

---

## Rollout Plan

### Phase 1: Alpha (Week 1)
- Internal testing
- GitHub backend only
- Limited beta users

### Phase 2: Beta (Week 2)
- Both backends enabled
- Public beta announcement
- Gather feedback

### Phase 3: Release (Week 3)
- Version 2.0.0 published to npm
- Documentation finalized
- Migration guide published

---

## Risk Mitigation

### Risk 1: OAuth Complexity
- **Mitigation**: Provide fallback to personal access tokens
- **Fallback**: Document manual token creation

### Risk 2: Breaking Changes
- **Mitigation**: Auto-migration + clear migration guide
- **Fallback**: Support v1.x for 6 months

### Risk 3: API Rate Limits
- **Mitigation**: Implement retry logic with exponential backoff
- **Fallback**: Cache responses, batch operations

---

## Success Metrics

- [ ] Zero CLI dependencies (only Node.js required)
- [ ] Sync performance: <2s for 50 issues
- [ ] Test coverage: >90%
- [ ] Migration success rate: >95%
- [ ] User-reported auth issues: <5%

---

## Future Enhancements (Post-2.0)

1. **Additional Backends**
   - Linear
   - Jira
   - Asana

2. **Advanced Features**
   - Webhook support for real-time sync
   - Conflict resolution UI
   - Bulk operations

3. **Enterprise Features**
   - SSO authentication
   - OS keychain integration
   - Audit logging
