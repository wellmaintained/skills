import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import request from 'supertest';
import { ExpressServer } from '../src/server/express-server.js';
import { LiveWebBackend } from '../src/backends/liveweb.js';

describe('ExpressServer API', () => {
  let server: ExpressServer;
  let backend: LiveWebBackend;

  beforeEach(() => {
    backend = new LiveWebBackend(undefined, mock(async () => '[]'));
    server = new ExpressServer(backend, 0);
  });

  afterEach(async () => {
    await server.stop();
  });

  it('returns cached issue state', async () => {
    backend.updateState('test-1', {
      diagram: 'graph TD',
      metrics: { total: 1, completed: 0, inProgress: 0, blocked: 0, open: 1 },
      issues: [{ id: 'test-1', title: 'Test', number: 1, body: '', state: 'open', url: '', labels: [] } as any],
      edges: [],
      rootId: 'test-1',
      lastUpdate: new Date('2025-11-05T20:00:00Z'),
    });

    const response = await request(server.getExpressApp()).get('/api/issue/test-1');

    expect(response.status).toBe(200);
    expect(response.body.issueId).toBe('test-1');
    expect(response.body.edges).toEqual([]);
  });

  it('returns 404 for unknown issues', async () => {
    const response = await request(server.getExpressApp()).get('/api/issue/missing');

    expect(response.status).toBe(404);
  });

  it('handles status updates via POST', async () => {
    const spy = spyOn(backend, 'updateIssueStatus').mockResolvedValue(undefined);

    const response = await request(server.getExpressApp())
      .post('/api/issue/test-1/status')
      .send({ status: 'in_progress' });

    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalledWith('test-1', 'in_progress');
  });

  it('creates subtasks via POST', async () => {
    const child = { id: 'child-1' };
    const spy = spyOn(backend, 'createSubtask').mockResolvedValue(child as any);

    const response = await request(server.getExpressApp())
      .post('/api/issue/test-1/create-child')
      .send({ title: 'Child', type: 'task', priority: 2 });

    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalledWith('test-1', { title: 'Child', type: 'task', priority: 2 });
    expect(response.body).toEqual(child);
  });

  it('reparents issues via POST', async () => {
    const spy = spyOn(backend, 'reparentIssue').mockResolvedValue(undefined);

    const response = await request(server.getExpressApp())
      .post('/api/issue/test-2/reparent')
      .send({ newParentId: 'test-1' });

    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalledWith('test-2', 'test-1');
  });

  it('serves favicon.ico', async () => {
    const response = await request(server.getExpressApp()).get('/favicon.ico');

    // Should either return the favicon or 404 if not built
    expect([200, 404]).toContain(response.status);
    if (response.status === 200) {
      expect(response.type).toBe('image/x-icon');
    }
  });
});
