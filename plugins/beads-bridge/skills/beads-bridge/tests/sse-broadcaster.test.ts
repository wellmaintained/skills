import { describe, it, expect, vi } from 'vitest';
import { SSEBroadcaster, SSEEvent } from '../src/server/sse-broadcaster.js';
import type { Response } from 'express';

describe('SSEBroadcaster', () => {
  it('should add client and send connected event', () => {
    const broadcaster = new SSEBroadcaster();
    const mockRes = createMockResponse();

    broadcaster.addClient(mockRes);

    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
    expect(mockRes.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
    expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('"type":"connected"'));
  });

  it('should broadcast to all connected clients', () => {
    const broadcaster = new SSEBroadcaster();
    const client1 = createMockResponse();
    const client2 = createMockResponse();

    broadcaster.addClient(client1);
    broadcaster.addClient(client2);

    const event: SSEEvent = { type: 'update', issueId: 'test-1', data: { test: true } };
    broadcaster.broadcast(event);

    expect(client1.write).toHaveBeenCalledWith(expect.stringContaining('"type":"update"'));
    expect(client2.write).toHaveBeenCalledWith(expect.stringContaining('"type":"update"'));
  });

  it('should remove client on close event', () => {
    const broadcaster = new SSEBroadcaster();
    const mockRes = createMockResponse();

    broadcaster.addClient(mockRes);

    // Simulate close event
    const closeHandler = (mockRes.on as any).mock.calls.find((call: any) => call[0] === 'close')[1];
    closeHandler();

    broadcaster.broadcast({ type: 'test' });

    // Client should only receive connected event, not test event
    expect(mockRes.write).toHaveBeenCalledTimes(1);
  });
});

function createMockResponse(): Response {
  const listeners: { [key: string]: Function } = {};
  return {
    setHeader: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    on: vi.fn((event: string, handler: Function) => {
      listeners[event] = handler;
    }),
  } as any;
}
