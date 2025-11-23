# Phase 6: Testing Updates - Achieve >90% Coverage

**Related Bead**: pensive-aa99 (Phase 6/9)
**Date**: 2025-11-05
**Status**: Ready for implementation

## Overview

This phase increases test coverage from 62.91% to >90% by adding comprehensive unit tests for currently uncovered modules. The focus is on testing core functionality with proper mocks for API clients and external dependencies.

## Current Coverage Analysis

**Overall**: 62.91% (Target: >90%)

### High Coverage (>85%) - Maintain
- ✅ `src/cli/auth-wrapper.ts`: 100%
- ✅ `src/auth/*`: 85.98%
- ✅ `src/config/*`: 87.02%
- ✅ `src/diagrams/*`: 99.43%
- ✅ `src/discovery/*`: 94.07%
- ✅ `src/monitoring/*`: 100%
- ✅ `src/store/*`: 91.02%
- ✅ `src/synthesis/*`: 88.93%
- ✅ `src/types/*`: 98.09%

### Low Coverage - Priority to Fix
- ❌ `src/cli.ts`: 0% (423 lines)
- ❌ `src/skill.ts`: 0% (579 lines)
- ❌ `src/clients/beads-client.ts`: 0% (547 lines)
- ❌ `src/decomposition/issue-decomposer.ts`: 0% (357 lines)
- ❌ `src/backends/github-projects.ts`: 0% (436 lines)
- ⚠️  `src/backends/github.ts`: 70.35%
- ⚠️  `src/backends/shortcut.ts`: 74.26%

### Legacy/Deprecated - Skip
- `src/utils/gh-cli.ts`: 0% (will be removed)
- `src/utils/bd-cli.ts`: 0% (will be removed)

## Goals

1. Achieve >90% overall test coverage
2. Add comprehensive unit tests for uncovered modules
3. Mock external dependencies (Octokit, Shortcut client, filesystem, process)
4. Test error handling paths
5. Maintain existing test quality

## Implementation Tasks

### Task 1: Add BeadsClient Tests

**File**: `tests/clients/beads-client.test.ts` (new file)

**Coverage Target**: >85% for `src/clients/beads-client.ts`

**What to Test**:
- `listIssues()`: Filtering by status, priority, type, assignee
- `getIssue()`: Retrieve specific issue by ID
- `createIssue()`: Create new issues with all fields
- `updateIssue()`: Update existing issues
- `addDependency()`: Link issues with dependency types
- `removeDependency()`: Remove issue links
- `searchIssues()`: Search by title/description
- Error handling: Invalid issue IDs, missing required fields

**Mock Strategy**:
```typescript
vi.mock('child_process', () => ({
  execFile: vi.fn()
}));
```

**Key Test Cases**:
1. List open issues
2. List issues with filters (status, priority, type)
3. Get issue by ID (success and not found)
4. Create issue with minimal/full fields
5. Update issue fields
6. Add/remove dependencies
7. Search issues with query
8. Error handling (invalid JSON, process errors)

**Success Criteria**:
- ✅ 20+ test cases covering main operations
- ✅ All CRUD operations tested
- ✅ Error paths tested
- ✅ Coverage >85%

---

### Task 2: Add IssueDecomposer Tests

**File**: `tests/decomposition/issue-decomposer.test.ts` (new file)

**Coverage Target**: >85% for `src/decomposition/issue-decomposer.ts`

**What to Test**:
- `decomposeIssue()`: Break down issue into subtasks
- `analyzeComplexity()`: Determine if issue needs decomposition
- `generateSubtasks()`: Create subtask list from description
- `createEpic()`: Convert issue to epic with subtasks
- Integration with backend (mocked)
- Integration with AI parser (mocked)

**Mock Strategy**:
```typescript
vi.mock('../backends/github', () => ({
  GitHubBackend: vi.fn()
}));

vi.mock('../decomposition/issue-parser', () => ({
  parseIssueDescription: vi.fn()
}));
```

**Key Test Cases**:
1. Decompose simple issue (no decomposition needed)
2. Decompose complex issue (creates subtasks)
3. Analyze complexity (low, medium, high)
4. Generate subtasks from structured description
5. Create epic with subtasks in backend
6. Error handling (backend failures, parsing errors)
7. Edge cases (empty description, malformed input)

**Success Criteria**:
- ✅ 15+ test cases
- ✅ All decomposition scenarios tested
- ✅ AI parser integration mocked properly
- ✅ Coverage >85%

---

### Task 3: Add GitHubProjects Tests

**File**: `tests/backends/github-projects.test.ts` (new file)

**Coverage Target**: >85% for `src/backends/github-projects.ts`

**What to Test**:
- `getProject()`: Retrieve project by ID
- `listProjects()`: List projects in org
- `addItemToProject()`: Add issue to project
- `updateProjectItemField()`: Update custom field values
- `getProjectItems()`: List items in project
- GraphQL query construction
- Error handling (GraphQL errors, auth failures)

**Mock Strategy**:
```typescript
vi.mock('octokit', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    graphql: vi.fn()
  }))
}));
```

**Key Test Cases**:
1. Get project by ID (success)
2. List projects for organization
3. Add item to project
4. Update custom field (status, priority)
5. Get project items with pagination
6. GraphQL error handling
7. Authentication errors
8. Rate limiting

**Success Criteria**:
- ✅ 12+ test cases
- ✅ All GraphQL operations tested
- ✅ Pagination tested
- ✅ Coverage >85%

---

### Task 4: Add CLI Tests

**File**: `tests/cli/cli.test.ts` (new file)

**Coverage Target**: >70% for `src/cli.ts` (some paths are only reachable in integration tests)

**What to Test**:
- Command parsing (Commander.js)
- Option handling
- Error handling
- Help text generation
- Version command
- Commands delegate to executeCapability

**Note**: Most command execution is already covered by `cli-integration.test.ts`. This task focuses on the CLI framework itself.

**Mock Strategy**:
```typescript
vi.mock('../skill', () => ({
  createSkill: vi.fn(),
  executeCapability: vi.fn()
}));
```

**Key Test Cases**:
1. Parse status command with options
2. Parse sync command with flags
3. Parse diagram command with arguments
4. Parse auth subcommands
5. Help text for each command
6. Version command
7. Invalid command handling
8. Missing required arguments

**Success Criteria**:
- ✅ 15+ test cases
- ✅ All commands have parsing tests
- ✅ Help and version tested
- ✅ Coverage >70% (integration tests cover the rest)

---

### Task 5: Add Skill Tests

**File**: `tests/skill.test.ts` (new file)

**Coverage Target**: >75% for `src/skill.ts`

**What to Test**:
- `createSkill()`: Factory function with config loading
- `executeCapability()`: Capability routing
- Individual capabilities:
  - `status`: Query aggregated status
  - `sync`: Post progress update
  - `diagram`: Generate diagrams
  - `discoveries`: Detect discoveries
  - `mapping-get/create`: Manage mappings
  - `decompose`: Decompose issues
- Error handling
- Config loading
- Credential loading

**Mock Strategy**:
```typescript
vi.mock('./config/config-manager', () => ({
  ConfigManager: { load: vi.fn() }
}));

vi.mock('./auth/credential-store', () => ({
  CredentialStore: vi.fn()
}));

vi.mock('./backends/github', () => ({
  GitHubBackend: vi.fn()
}));
```

**Key Test Cases**:
1. createSkill() with GitHub backend
2. createSkill() with Shortcut backend
3. executeCapability('status') delegates correctly
4. executeCapability('sync') delegates correctly
5. executeCapability('diagram') delegates correctly
6. executeCapability with invalid capability name
7. Config loading errors
8. Credential loading errors
9. Backend initialization errors

**Success Criteria**:
- ✅ 20+ test cases
- ✅ All capabilities have routing tests
- ✅ Error paths tested
- ✅ Coverage >75%

---

### Task 6: Improve Backend Coverage

**Files**:
- `tests/backends/github.test.ts` (extend existing)
- `tests/backends/shortcut.test.ts` (extend existing)

**Coverage Targets**:
- GitHub: 70.35% → >85%
- Shortcut: 74.26% → >85%

**What to Add**:

**GitHub Backend**:
- Test uncovered lines in `src/backends/github.ts`: 365-778, 781-791
- Focus on error paths and edge cases
- Pagination scenarios
- Rate limiting
- GraphQL error handling

**Shortcut Backend**:
- Test uncovered lines in `src/backends/shortcut.ts`
- Workflow state mapping edge cases
- Custom field handling
- Error responses from API

**Key Test Cases to Add**:

**GitHub**:
1. Pagination for large issue lists
2. Rate limit errors and retry logic
3. GraphQL errors with partial data
4. Invalid project IDs
5. Missing custom field configurations
6. Authentication token expiration

**Shortcut**:
1. Missing workflow states
2. Invalid custom field values
3. Large story lists with pagination
4. API rate limiting
5. Workspace permission errors

**Success Criteria**:
- ✅ GitHub coverage >85%
- ✅ Shortcut coverage >85%
- ✅ All error paths tested
- ✅ Pagination tested

---

### Task 7: Coverage Verification and Report

**What to Do**:
1. Run full coverage report: `npm test -- --run --coverage`
2. Verify overall coverage >90%
3. Verify each module meets target coverage
4. Generate coverage badge for README
5. Document any remaining uncovered code with justification

**Verification Commands**:
```bash
npm test -- --run --coverage
npm run test:coverage -- --reporter=html  # Generate HTML report
```

**Coverage Targets**:
- **Overall**: >90%
- **src/cli.ts**: >70%
- **src/skill.ts**: >75%
- **src/clients/beads-client.ts**: >85%
- **src/decomposition/issue-decomposer.ts**: >85%
- **src/backends/github-projects.ts**: >85%
- **src/backends/github.ts**: >85%
- **src/backends/shortcut.ts**: >85%

**Documentation**:
- Update README with coverage badge
- Document any intentionally uncovered code
- Add testing guide to CONTRIBUTING.md

**Success Criteria**:
- ✅ Overall coverage >90%
- ✅ All priority modules meet targets
- ✅ Coverage report generated
- ✅ Documentation updated

---

## Testing Strategy

### Unit Test Principles

1. **Mock External Dependencies**: Mock all I/O (filesystem, network, process)
2. **Test Behavior, Not Implementation**: Focus on public API contracts
3. **Test Error Paths**: Every error handler should be tested
4. **Use Realistic Data**: Test with data that looks like production
5. **Keep Tests Fast**: All unit tests should complete in <100ms

### Mock Patterns

**Filesystem**:
```typescript
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn()
}));
```

**Child Process**:
```typescript
vi.mock('child_process', () => ({
  execFile: vi.fn((cmd, args, cb) => cb(null, { stdout: '{}', stderr: '' }))
}));
```

**API Clients**:
```typescript
vi.mock('octokit', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: { issues: { get: vi.fn().mockResolvedValue({ data: {} }) } }
  }))
}));
```

### Test Organization

```
tests/
  ├── auth/              # Authentication tests (existing)
  ├── backends/          # Backend tests (extend existing)
  ├── cli/               # CLI tests (extend existing)
  ├── clients/           # NEW: BeadsClient tests
  ├── decomposition/     # NEW: IssueDecomposer tests
  ├── config/            # Config tests (existing)
  ├── diagrams/          # Diagram tests (existing)
  ├── discovery/         # Discovery tests (existing)
  ├── monitoring/        # Monitoring tests (existing)
  ├── store/             # Store tests (existing)
  ├── synthesis/         # Synthesis tests (existing)
  ├── utils/             # Utility tests (existing)
  └── skill.test.ts      # NEW: Skill orchestration tests
```

## Dependencies

- All implementation phases (1-5) must be complete
- Vitest configured with coverage reporting
- All mocking libraries available (vi.mock)

## Success Criteria

- ✅ Overall test coverage >90%
- ✅ All priority modules meet individual targets
- ✅ All tests pass with `npm test -- --run`
- ✅ No flaky tests (run suite 3 times, all pass)
- ✅ Coverage report generated and documented
- ✅ README updated with coverage badge
- ✅ Testing guide documented

## Notes

- Legacy CLI wrappers (`gh-cli.ts`, `bd-cli.ts`) will be removed in Phase 8, so 0% coverage is acceptable
- Some CLI paths are only reachable in integration tests (70% target is realistic)
- Focus on testing business logic, not framework code (Commander.js)
- Mock API responses based on real API documentation
- Keep tests maintainable - avoid over-mocking

## Estimated Time

8-10 hours total:
- Task 1 (BeadsClient): 1.5h
- Task 2 (IssueDecomposer): 1.5h
- Task 3 (GitHubProjects): 1.5h
- Task 4 (CLI): 1h
- Task 5 (Skill): 2h
- Task 6 (Backend improvements): 1.5h
- Task 7 (Verification): 1h
