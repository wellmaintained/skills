import path from 'path';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AssetManager {
  getDashboardHtml(logLevel?: string): string;
  getStaticAsset(filename: string): { content: Buffer | string, contentType: string } | null;
  getStaticPath(): string | null; // Returns path if serving from filesystem (for express.static)
}

export class FileSystemAssetManager implements AssetManager {
  private frontendPath: string;

  constructor() {
    // When running from source (Bun), __dirname is src/server
    // When running from dist, __dirname is dist/server
    // Frontend is always built to dist/frontend
    const distFrontend = path.join(__dirname, '..', '..', 'dist', 'frontend');
    const srcFrontend = path.join(__dirname, '..', 'frontend');
    
    // Prefer dist/frontend (built assets), fallback to src/frontend if dist doesn't exist
    this.frontendPath = existsSync(distFrontend) ? distFrontend : srcFrontend;
  }

  getDashboardHtml(logLevel?: string): string {
    const htmlPath = path.join(this.frontendPath, 'index.html');
    let html = readFileSync(htmlPath, 'utf-8');
    
    // Inject log level into HTML template
    if (logLevel) {
      const scriptTag = `<script>window.__LOG_LEVEL__ = '${logLevel}';</script>`;
      // Insert before closing </head> tag, or at the beginning of <body> if no </head>
      if (html.includes('</head>')) {
        html = html.replace('</head>', `  ${scriptTag}\n</head>`);
      } else if (html.includes('<body>')) {
        html = html.replace('<body>', `<body>\n  ${scriptTag}`);
      } else {
        // Fallback: prepend to HTML
        html = `${scriptTag}\n${html}`;
      }
    }
    
    return html;
  }

  getStaticAsset(filename: string): { content: Buffer | string, contentType: string } | null {
    // Handle favicon.ico specifically
    const filePath = path.join(this.frontendPath, filename);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath);
      let contentType = 'application/octet-stream';

      if (filename.endsWith('.ico')) {
        contentType = 'image/x-icon';
      } else if (filename.endsWith('.css')) {
        contentType = 'text/css';
      } else if (filename.endsWith('.js')) {
        contentType = 'application/javascript';
      }

      return { content, contentType };
    }
    return null;
  }

  getStaticPath(): string | null {
    return this.frontendPath;
  }
}

// Singleton instance or factory could be used, but class export is fine
