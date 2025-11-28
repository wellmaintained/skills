import { build } from "bun";
import { join, resolve, dirname } from "path";
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "fs";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const distDir = join(projectRoot, 'dist');

// Get version: prefer BUILD_VERSION env var (from semantic-release), fallback to git describe
let buildVersion = process.env.BUILD_VERSION || '';
if (buildVersion) {
    console.log(`Build version (from env): ${buildVersion}`);
} else {
    try {
        buildVersion = execSync('git describe --tags --always', { encoding: 'utf-8' }).trim();
        // Remove leading 'v' if present
        if (buildVersion.startsWith('v')) {
            buildVersion = buildVersion.slice(1);
        }
        console.log(`Build version (from git): ${buildVersion}`);
    } catch {
        buildVersion = 'dev';
        console.warn('Could not get git version, using "dev"');
    }
}

// Ensure dist exists
if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
}

console.log('Building client...');
const proc = Bun.spawn(["bun", "run", "build:client"], {
    cwd: projectRoot,
    stdio: ["inherit", "inherit", "inherit"]
});
await proc.exited;

if (proc.exitCode !== 0) {
    console.error("Client build failed");
    process.exit(1);
}

console.log('Bundling assets...');
const frontendDir = join(projectRoot, 'dist', 'frontend');
const indexHtml = readFileSync(join(frontendDir, 'index.html'), 'utf-8');
const indexCss = readFileSync(join(frontendDir, 'assets', 'index.css'), 'utf-8');
const indexJs = readFileSync(join(frontendDir, 'assets', 'index.js'), 'utf-8');

const escapeContent = (str: string) => str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');

const bundledAssetManagerCode = `
import { AssetManager } from './asset-manager.js';

const indexHtml = \`${escapeContent(indexHtml)}\`;
const indexCss = \`${escapeContent(indexCss)}\`;
const indexJs = \`${escapeContent(indexJs)}\`;

export interface AssetManager {
  getDashboardHtml(): string;
  getStaticAsset(filename: string): { content: Buffer | string, contentType: string } | null;
  getStaticPath(): string | null;
}

export class FileSystemAssetManager implements AssetManager {
  constructor() {}

  getDashboardHtml(): string {
    return indexHtml;
  }

  getStaticAsset(filename: string): { content: Buffer | string, contentType: string } | null {
    const normalized = filename.startsWith('/') ? filename.slice(1) : filename;
    
    if (normalized === 'assets/index.css') {
      return { content: indexCss, contentType: 'text/css' };
    }
    if (normalized === 'assets/index.js') {
      return { content: indexJs, contentType: 'application/javascript' };
    }
    return null;
  }

  getStaticPath(): string | null {
    return null;
  }
}
`;

const bundledAssetPath = join(projectRoot, 'src', 'server', 'asset-manager.bundled.ts');
writeFileSync(bundledAssetPath, bundledAssetManagerCode);

console.log('Bundling server with Bun...');
const intermediateBundle = join(distDir, 'beads-bridge.bundled.js');

const result = await Bun.build({
    entrypoints: [join(projectRoot, 'src', 'cli.ts')],
    outdir: distDir,
    target: "bun",
    naming: "beads-bridge.bundled.js",
    define: {
        'BUILD_VERSION': JSON.stringify(buildVersion),
    },
    plugins: [
        {
            name: 'alias-asset-manager',
            setup(build) {
                build.onResolve({ filter: /asset-manager(\.js)?$/ }, _args => {
                    // Only alias if it's the one in src/server
                    // We check if the importer is in src/server or if the path resolves to it
                    // Simple check: if it ends with asset-manager
                    return {
                        path: bundledAssetPath
                    }
                });
            }
        }
    ]
});

if (!result.success) {
    console.error("Server bundle failed");
    console.error(result.logs);
    process.exit(1);
}

console.log('Compiling binary...');
const binPath = join(distDir, 'beads-bridge');

const compileProc = Bun.spawn(["bun", "build", "--compile", "--outfile", binPath, intermediateBundle], {
    cwd: projectRoot,
    stdio: ["inherit", "inherit", "inherit"]
});
await compileProc.exited;

if (compileProc.exitCode !== 0) {
    console.error("Binary compilation failed");
    process.exit(1);
}

console.log(`\nSuccess! Binary created at ${binPath}`);
