import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

// Ensure dist exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 1. Generate bundled asset manager
console.log('Bundling assets...');
const frontendDir = path.join(projectRoot, 'src', 'frontend');
const dashboardHtml = fs.readFileSync(path.join(frontendDir, 'dashboard.html'), 'utf-8');
const dashboardCss = fs.readFileSync(path.join(frontendDir, 'dashboard.css'), 'utf-8');
const dashboardJs = fs.readFileSync(path.join(frontendDir, 'dashboard.js'), 'utf-8');

const escapeContent = (str) => str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');

const bundledAssetManagerCode = `
import { AssetManager } from './asset-manager.js';

const dashboardHtml = \`${escapeContent(dashboardHtml)}\`;
const dashboardCss = \`${escapeContent(dashboardCss)}\`;
const dashboardJs = \`${escapeContent(dashboardJs)}\`;

export interface AssetManager {
  getDashboardHtml(): string;
  getStaticAsset(filename: string): { content: Buffer | string, contentType: string } | null;
  getStaticPath(): string | null;
}

export class FileSystemAssetManager implements AssetManager {
  constructor() {}

  getDashboardHtml(): string {
    return dashboardHtml;
  }

  getStaticAsset(filename: string): { content: Buffer | string, contentType: string } | null {
    if (filename === 'dashboard.css') {
      return { content: dashboardCss, contentType: 'text/css' };
    }
    if (filename === 'dashboard.js') {
      return { content: dashboardJs, contentType: 'application/javascript' };
    }
    return null;
  }

  getStaticPath(): string | null {
    return null;
  }
}
`;

const bundledAssetPath = path.join(projectRoot, 'src', 'server', 'asset-manager.bundled.ts');
fs.writeFileSync(bundledAssetPath, bundledAssetManagerCode);

// 2. Build with esbuild
console.log('Building bundle with esbuild...');
const bundlePath = path.join(distDir, 'beads-bridge-binary.cjs');

try {
  await esbuild.build({
    entryPoints: [path.join(projectRoot, 'src', 'cli.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: bundlePath,
    format: 'cjs',
    plugins: [
        {
            name: 'alias-asset-manager',
            setup(build) {
                build.onResolve({ filter: /asset-manager(\.js)?$/ }, args => {
                    return {
                        path: bundledAssetPath
                    }
                });
            }
        }
    ],
    define: {
        'process.env.NODE_ENV': '"production"'
    }
  });
  console.log(`Bundle created: ${bundlePath}`);
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
    // Clean up bundled asset manager?
    // fs.unlinkSync(bundledAssetPath);
}

// 3. Compile with Bun (preferred) or Node SEA
console.log('Compiling binary...');

// Check for bun
try {
    execSync('bun --version', { stdio: 'ignore' });
    console.log('Using Bun for compilation...');
    
    const binPath = path.join(distDir, 'beads-bridge');
    // Compile the CJS bundle
    execSync(`bun build --compile --outfile "${binPath}" "${bundlePath}"`, { 
        cwd: projectRoot, 
        stdio: 'inherit' 
    });
    
    console.log(`\nSuccess! Binary created at ${binPath}`);
    console.log(`Size: ${(fs.statSync(binPath).size / 1024 / 1024).toFixed(2)} MB`);
    
} catch (e) {
    console.log('Bun not found or failed. Falling back to Node SEA (experimental)...');
    // ... (Node SEA logic could go here, but omitted for now to keep script clean/reliable based on POC findings)
    console.error('Node SEA compilation is currently unstable on this environment (macOS code signing). Please install Bun to build binary.');
    // We leave the CJS bundle which is runnable with node
    console.log(`You can run the bundle with: node ${bundlePath}`);
}
