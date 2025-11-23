import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSkill } from '../../src/skill.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Sync Progress with Diagram Integration', () => {
  const testConfigPath = path.join(__dirname, '../fixtures/test-config.json');

  // TODO: Fix integration test - requires valid config with GitHub repo
  it.skip('should include diagram when syncing progress', async () => {
    // This is an integration test that requires a real config
    // For now, we'll skip it in CI and run manually
    if (process.env.CI) {
      return;
    }

    const skill = await createSkill(testConfigPath, 'shortcut');

    const result = await skill.execute('sync_progress', {
      repository: 'shortcut',
      issueNumber: 89216,
      includeBlockers: true
    });

    expect(result.success).toBe(true);
    // Comment should contain diagram
    // Manual verification: Check Shortcut story 89216 for the comment
  });
});
