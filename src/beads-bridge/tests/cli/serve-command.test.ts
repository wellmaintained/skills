import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server, type AddressInfo } from 'node:net';
import { findAvailablePortInRange } from '../../src/cli/commands/serve.js';

describe('serve command helpers', () => {
  let blocker: Server | null = null;
  let blockedPort: number;

  beforeAll(async () => {
    blocker = createServer();
    await new Promise((resolve, reject) => {
      blocker!.once('listening', resolve);
      blocker!.once('error', reject);
      blocker!.listen(0, '0.0.0.0');
    });

    blockedPort = (blocker!.address() as AddressInfo).port;
  });

  afterAll(async () => {
    if (blocker) {
      await new Promise((resolve) => blocker!.close(() => resolve(null)));
      blocker = null;
    }
  });

  it('picks the next available port within the range', async () => {
    const port = await findAvailablePortInRange(blockedPort, blockedPort + 5);
    expect(port).toBeGreaterThanOrEqual(blockedPort);
    expect(port).toBeLessThan(blockedPort + 5);
    expect(port).not.toBe(blockedPort);
  });
});
