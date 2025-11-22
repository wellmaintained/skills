import express, { type Express, type Request, type Response } from 'express';
import type { Server } from 'http';
import type { LiveWebBackend } from '../backends/liveweb.js';
import { SSEBroadcaster } from './sse-broadcaster.js';
import { NotFoundError, ValidationError } from '../types/errors.js';
import { AssetManager, FileSystemAssetManager } from './asset-manager.js';

export class ExpressServer {
  private app: Express;
  private server?: Server;
  private broadcaster: SSEBroadcaster;
  private assetManager: AssetManager;

  constructor(
    private backend: LiveWebBackend,
    private port: number,
    assetManager?: AssetManager
  ) {
    this.app = express();
    this.app.use(express.json());
    this.broadcaster = new SSEBroadcaster();
    this.backend.setBroadcaster(this.broadcaster);
    this.assetManager = assetManager || new FileSystemAssetManager();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Serve static files (CSS, JS)
    const staticPath = this.assetManager.getStaticPath();
    if (staticPath) {
      this.app.use('/static', express.static(staticPath));
      // Also serve Vite assets from /assets path
      this.app.use('/assets', express.static(staticPath + '/assets'));
    } else {
      // Serve manually from asset manager (for bundled binaries)
      this.app.get('/static/:filename', (req: Request, res: Response) => {
        const asset = this.assetManager.getStaticAsset(req.params.filename);
        if (asset) {
          res.type(asset.contentType);
          res.send(asset.content);
        } else {
          res.sendStatus(404);
        }
      });
    }

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
        console.log(`[ExpressServer] State found: ${!!state}`);

        if (!state) {
          res.status(404).json({ error: 'Issue not found' });
          return;
        }

        res.json({
          issueId: req.params.id,
          metrics: state.metrics,
          issues: state.issues,
          edges: state.edges,
          rootId: state.rootId,
          lastUpdate: state.lastUpdate,
        });
      } catch (error) {
        this.handleError(res, error);
      }
    });

    this.app.post('/api/issue/:id/status', async (req: Request, res: Response) => {
      try {
        const { status } = req.body ?? {};
        if (!status) {
          throw new ValidationError('status is required');
        }

        await this.backend.updateIssueStatus(req.params.id, status);
        res.json({ success: true });
      } catch (error) {
        this.handleError(res, error);
      }
    });

    this.app.post('/api/issue/:id/create-child', async (req: Request, res: Response) => {
      try {
        const parentId = req.params.id;
        const { title, type, priority, description, status } = req.body ?? {};
        console.log('[Express] create-child called with parentId:', parentId, 'title:', title);
        // Ensure priority is a number
        const priorityNum = typeof priority === 'string' ? parseInt(priority, 10) : priority;
        const issue = await this.backend.createSubtask(parentId, {
          title,
          type,
          priority: priorityNum,
          description,
          status,
        });
        console.log('[Express] create-child created issue:', issue.id, 'parent should be:', parentId);
        res.json(issue);
      } catch (error) {
        console.error('Error creating subtask:', error);
        this.handleError(res, error);
      }
    });

    this.app.post('/api/issue/:id/reparent', async (req: Request, res: Response) => {
      try {
        const { newParentId } = req.body ?? {};
        if (!newParentId) {
          throw new ValidationError('newParentId is required');
        }

        await this.backend.reparentIssue(req.params.id, newParentId);
        res.json({ success: true });
      } catch (error) {
        this.handleError(res, error);
      }
    });

    // SSE endpoint
    this.app.get('/api/issue/:id/events', (_req: Request, res: Response) => {
      this.broadcaster.addClient(res);
    });

    // Serve dashboard HTML with issue ID placeholder replacement
    this.app.get('/issue/:id', (req: Request, res: Response) => {
      let html = this.assetManager.getDashboardHtml();
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

  getExpressApp(): Express {
    return this.app;
  }

  private handleError(res: Response, error: unknown): void {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (error instanceof NotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }

    console.error('ExpressServer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
