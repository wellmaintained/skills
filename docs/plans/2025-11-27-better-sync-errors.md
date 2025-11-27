# Design: Improved Sync Error Messages

**Date:** 2025-11-27
**Status:** Approved
**Issue:** wms-plp

## Overview

Improve error messages in the `beads-bridge sync` command when a bead is missing an `external_ref`. Instead of failing silently or generically, the CLI will display actionable instructions with examples for both GitHub and Shortcut backends.

## Architecture

We will implement a custom error class to encapsulate the error state and the help text, keeping the Service logic clean and the CLI display logic simple.

### Components

1.  **`MissingExternalRefError` Class**
    *   **Location:** `src/beads-bridge/src/types/errors.ts`
    *   **Purpose:** Encapsulate the error state (bead ID) and generate the help text.
    *   **Properties:** `beadId`, `helpText`

2.  **`SyncService` Updates**
    *   **Location:** `src/beads-bridge/src/services/sync-service.ts`
    *   **Changes:**
        *   Update `getBead()` to return bead even if `external_ref` is missing.
        *   Update `sync()` to check for `external_ref` and throw `MissingExternalRefError`.

3.  **CLI Command Updates**
    *   **Location:** `src/beads-bridge/src/cli/commands/sync.ts`
    *   **Changes:**
        *   Catch `MissingExternalRefError`.
        *   Display the error message and the encapsulated help text.
        *   Exit with code 1.

## Detailed Design

### 1. `MissingExternalRefError`

```typescript
export class MissingExternalRefError extends Error {
  public readonly helpText: string;

  constructor(public readonly beadId: string) {
    super(`Bead '${beadId}' has no external_ref set`);
    this.name = 'MissingExternalRefError';
    
    this.helpText = `
To set an external_ref:
  bd update ${beadId} --external-ref "github:owner/repo#123"
  bd update ${beadId} --external-ref "shortcut:12345"

Supported formats:
  - github:owner/repo#123
  - https://github.com/owner/repo/issues/123
  - shortcut:12345
  - https://app.shortcut.com/org/story/12345
`.trim();
  }
}
```

### 2. Service Layer

**`getBead`:**
```typescript
async getBead(beadId: string): Promise<BeadsIssue | null> {
  try {
    const output = await execBdCommand(['show', beadId, '--json']);
    const result = JSON.parse(output);
    const bead = Array.isArray(result) ? result[0] : result;
    // CHANGED: Return bead even if external_ref is missing
    return bead || null;
  } catch (error) {
    // ... error handling
  }
}
```

**`sync`:**
```typescript
async sync(beadId: string, options: { dryRun?: boolean } = {}): Promise<SyncReport> {
  // ... get bead

  if (!bead.external_ref) {
    // CHANGED: Throw specific error instead of reporting "skipped"
    throw new MissingExternalRefError(bead.id);
  }

  // ... rest of sync logic
}
```

### 3. CLI Layer

```typescript
try {
  const report = await service.sync(beadId, options);
  // ... success handling
} catch (error) {
  if (error instanceof MissingExternalRefError) {
    console.error(`Error: ${error.message}`);
    console.error('');
    console.error(error.helpText);
    process.exit(1);
  }
  // ... generic error handling
}
```

## Testing Plan

1.  **Unit Tests (`MissingExternalRefError`):** Verify help text formatting.
2.  **Service Tests (`SyncService`):** Verify `sync()` throws the custom error when `external_ref` is missing.
3.  **CLI Tests:** Verify the output contains the help text and examples.
