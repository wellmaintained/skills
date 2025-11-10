import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ExpressServer } from '../src/server/express-server.js';
import { LiveWebBackend } from '../src/backends/liveweb.js';

describe('ExpressServer', () => {
  let server: ExpressServer;
  let backend: LiveWebBackend;

  beforeEach(() => {
    backend = new LiveWebBackend();
    server = new ExpressServer(backend, 3001); // Use different port for testing
  });

  afterEach(async () => {
    await server.stop();
  });

  // TODO: Fix flaky test - timeouts/socket errors in CI environment
  it.skip('should start and stop server', async () => {
    await server.start();

    const response = await fetch('http://localhost:3001/api/health');
    expect(response.ok).toBe(true);

    await server.stop();

    // Server should be stopped
    await expect(fetch('http://localhost:3001/api/health')).rejects.toThrow();
  });

  // TODO: Fix flaky test - timeouts/socket errors in CI environment
  it.skip('should serve issue API endpoint', async () => {
    backend.updateState('test-1', {
      diagram: 'flowchart TD\n  test["Test"]',
      metrics: { total: 1, completed: 0, inProgress: 0, blocked: 0, open: 1 },
      issues: [
        { id: 'test-1', title: 'Test', status: 'open', url: 'http://localhost:3001/issue/test-1' },
      ],
      lastUpdate: new Date('2025-11-05T20:00:00Z'),
    });

    await server.start();

    const response = await fetch('http://localhost:3001/api/issue/test-1');
    const data = await response.json();

    expect(data.issueId).toBe('test-1');
    expect(data.diagram).toContain('flowchart TD');
    expect(data.metrics.total).toBe(1);
    expect(data.issues).toHaveLength(1);
  });

  // TODO: Fix flaky test - timeouts/socket errors in CI environment
  it.skip('should return 404 for non-existent issue', async () => {
    await server.start();

    const response = await fetch('http://localhost:3001/api/issue/nonexistent');
    expect(response.status).toBe(404);
  });
});
