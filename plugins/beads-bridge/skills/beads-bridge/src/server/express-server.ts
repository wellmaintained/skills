import express, { type Express, type Request, type Response } from 'express';
import type { Server } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import type { LiveWebBackend } from '../backends/liveweb.js';
import { SSEBroadcaster } from './sse-broadcaster.js';
import { NotFoundError } from '../types/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ExpressServer {
  private app: Express;
  private server?: Server;
  private broadcaster: SSEBroadcaster;

  constructor(
    private backend: LiveWebBackend,
    private port: number
  ) {
    this.app = express();
    this.broadcaster = new SSEBroadcaster();
    this.backend.setBroadcaster(this.broadcaster);
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Serve static files (CSS, JS)
    const frontendPath = path.join(__dirname, '..', 'frontend');
    this.app.use('/static', express.static(frontendPath));

    // Health check
    this.app.get('/api/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok' });
    });

    // Get issue state
    this.app.get('/api/issue/:id', async (req: Request, res: Response) => {
      try {
        const state = this.backend.getState(req.params.id);

        if (!state) {
          res.status(404).json({ error: 'Issue not found' });
          return;
        }

        res.json({
          issueId: req.params.id,
          diagram: state.diagram,
          metrics: state.metrics,
          issues: state.issues,
          lastUpdate: state.lastUpdate,
        });
      } catch (error) {
        if (error instanceof NotFoundError) {
          res.status(404).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    });

    // SSE endpoint
    this.app.get('/api/issue/:id/events', (_req: Request, res: Response) => {
      this.broadcaster.addClient(res);
    });

    // Serve dashboard HTML with issue ID placeholder replacement
    this.app.get('/issue/:id', (req: Request, res: Response) => {
      const htmlPath = path.join(__dirname, '..', 'frontend', 'dashboard.html');
      let html = readFileSync(htmlPath, 'utf-8');
      html = html.replace(/{{ISSUE_ID}}/g, req.params.id);
      res.send(html);
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`Dashboard running at http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    this.broadcaster.closeAll();

    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => resolve());
      });
    }
  }

  getBroadcaster(): SSEBroadcaster {
    return this.broadcaster;
  }
}
