import type { Response } from 'express';

export type SSEEvent =
  | { type: 'connected' }
  | { type: 'update'; issueId: string; data: any }
  | { type: 'error'; message: string };

export class SSEBroadcaster {
  private clients: Set<Response> = new Set();

  addClient(res: Response): void {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial connection event
    this.sendTo(res, { type: 'connected' });

    // Track client
    this.clients.add(res);

    // Remove on disconnect
    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  broadcast(event: SSEEvent): void {
    this.clients.forEach((client) => this.sendTo(client, event));
  }

  closeAll(): void {
    this.clients.forEach((client) => client.end());
    this.clients.clear();
  }

  private sendTo(res: Response, event: SSEEvent): void {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}
