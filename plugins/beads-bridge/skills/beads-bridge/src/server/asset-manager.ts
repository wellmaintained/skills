import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AssetManager {
  getDashboardHtml(): string;
  getStaticAsset(filename: string): { content: Buffer | string, contentType: string } | null;
  getStaticPath(): string | null; // Returns path if serving from filesystem (for express.static)
}

export class FileSystemAssetManager implements AssetManager {
  private frontendPath: string;

  constructor() {
    // In dist structure: dist/server/asset-manager.js -> dist/frontend
    // In src structure: src/server/asset-manager.ts -> src/frontend
    this.frontendPath = path.join(__dirname, '..', 'frontend');
  }

  getDashboardHtml(): string {
    const htmlPath = path.join(this.frontendPath, 'dashboard.html');
    return readFileSync(htmlPath, 'utf-8');
  }

  getStaticAsset(_filename: string): { content: Buffer | string, contentType: string } | null {
    // Not used if getStaticPath returns a string
    return null;
  }

  getStaticPath(): string | null {
    return this.frontendPath;
  }
}

// Singleton instance or factory could be used, but class export is fine
