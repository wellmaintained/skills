# Building Single Binary

The `beads-bridge` CLI can be compiled into a single executable binary for easier distribution.

## Prerequisites

- Node.js >= 20
- [Bun](https://bun.sh/) (Recommended for compilation)
- Or `npm` (Fallback using Node SEA, experimental on macOS)

## Usage

Run the build script:

```bash
npm run build:binary
```

This will:
1. Bundle frontend assets into `src/server/asset-manager.bundled.ts`.
2. Bundle the CLI code using `esbuild` into `dist/beads-bridge-binary.cjs`.
3. Compile the bundle into a native executable `dist/beads-bridge` using `bun build --compile`.

The output binary will be located at `dist/beads-bridge`.

## Troubleshooting

### macOS Code Signing
If building with Node SEA on macOS (Apple Silicon), you may encounter code signing issues. The build script attempts to handle this, but using Bun is recommended as it handles this natively.

### Assets
The build process inlines `dashboard.html`, `.css`, and `.js` into the binary. If you modify these files, you must rebuild the binary.
