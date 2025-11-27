## [1.10.1](https://github.com/wellmaintained/skills/compare/v1.10.0...v1.10.1) (2025-11-27)


### Bug Fixes

* **client:** resolve TypeScript type-check errors in App.tsx, Canvas, and useIssueData hook ([70ec162](https://github.com/wellmaintained/skills/commit/70ec1623f1273a2bef42252edbe74a19cdd2dd8c))

# [1.10.0](https://github.com/wellmaintained/skills/compare/v1.9.0...v1.10.0) (2025-11-27)


### Features

* add MissingExternalRefError class ([fa8f5bf](https://github.com/wellmaintained/skills/commit/fa8f5bf8f578804425f2c52ec02efa9ee889a4be))
* implement helpful error message for missing external_ref ([c948830](https://github.com/wellmaintained/skills/commit/c9488305edbceed06d00ebd0d8a1ea2bc7ec1d6b))

# [1.9.0](https://github.com/wellmaintained/skills/compare/v1.8.0...v1.9.0) (2025-11-27)


### Bug Fixes

* **parser:** handle Shortcut URLs with story slug ([9325476](https://github.com/wellmaintained/skills/commit/9325476c3198ece5407053f8a99462244e17155c))


### Features

* **sync:** implement simplified sync command (POC B) ([3c85146](https://github.com/wellmaintained/skills/commit/3c85146695ca290bbd8cea6611838f09b33c9d7d))

# [1.8.0](https://github.com/wellmaintained/skills/compare/v1.7.0...v1.8.0) (2025-11-25)


### Bug Fixes

* **bd-wrapper:** add --allow-stale flag for worktree contexts ([7b6e2ec](https://github.com/wellmaintained/skills/commit/7b6e2ec411ee5f1c1ed05154ff2b49c2d08a8dc5))
* **beads:** restore issues.jsonl as canonical JSONL filename ([4f2f7f5](https://github.com/wellmaintained/skills/commit/4f2f7f5402b20a3ae8967bab55b658f45eaf7753))
* **hooks:** add custom git hooks to prevent staleness errors ([bc2cbdd](https://github.com/wellmaintained/skills/commit/bc2cbddabfea16421802d26af8afcd319491864b))
* **setup:** explicitly import JSONL to prevent staleness errors ([5523f0a](https://github.com/wellmaintained/skills/commit/5523f0a8311dd93fd2ca3cbf7abafe563866d4c4))


### Features

* **bd-wrapper:** add logging to show worktree flags ([c689ae1](https://github.com/wellmaintained/skills/commit/c689ae1a5aa346835f217e0fed0985c47e6ad0e1))
* **worktrees:** implement shared database for git worktrees ([368d2d2](https://github.com/wellmaintained/skills/commit/368d2d21bbeed0f5457b6bd643643c1aa5a39ca7))

# [1.7.0](https://github.com/wellmaintained/skills/compare/v1.6.0...v1.7.0) (2025-11-24)


### Bug Fixes

* **ci:** allow test failures temporarily for extraction verification ([50b59b9](https://github.com/wellmaintained/skills/commit/50b59b9465f5bb4da99da02a71378cca27d97c95))
* **justfile:** update paths for beads-bridge extraction ([cdf7d2f](https://github.com/wellmaintained/skills/commit/cdf7d2f4e928f86f034f95245cf26638c640c1df))
* **justfile:** update remaining paths for beads-bridge extraction ([9883f09](https://github.com/wellmaintained/skills/commit/9883f0903895c651baf3438dfc11a532c7b57723))


### Features

* **beads-bridge:** extract into standalone CLI with workspace structure ([3fb7e2b](https://github.com/wellmaintained/skills/commit/3fb7e2beb1aba88a1f34c4b59f71dfdfd88ba957))
* **beads:** add extraction epic and update task statuses ([7ec3f92](https://github.com/wellmaintained/skills/commit/7ec3f92b72fde05b3c2c90a909332c2700ee4f0e))
* **ci:** update CI/CD for beads-bridge workspace extraction ([b502725](https://github.com/wellmaintained/skills/commit/b502725f4f405a9c6f601dc2a8a62a68886f7589))
* **install:** add smart installer for beads-bridge CLI ([4adbaf5](https://github.com/wellmaintained/skills/commit/4adbaf5b99687868e7c818b5f734acaf156bc9ea))

# [1.6.0](https://github.com/wellmaintained/skills/compare/v1.5.0...v1.6.0) (2025-11-23)


### Features

* add multi-platform binary builds and installer ([5c9b840](https://github.com/wellmaintained/skills/commit/5c9b840020a7dde9c0b74220f53d99ba69380aa7))

# [1.5.0](https://github.com/wellmaintained/skills/compare/v1.4.0...v1.5.0) (2025-11-23)


### Features

* **wms-2zy:** implement new bead card design with improved UX ([54f8553](https://github.com/wellmaintained/skills/commit/54f8553fec2a2fc6c35440e5b15dfbbc37618b77))

# [1.4.0](https://github.com/wellmaintained/skills/compare/v1.3.0...v1.4.0) (2025-11-23)


### Bug Fixes

* **beads-bridge:** enable drag-and-drop reparenting functionality ([de72616](https://github.com/wellmaintained/skills/commit/de72616e26ff8f964803591b6310dc3e81c44ed4))
* **beads-bridge:** prevent status flicker by deferring optimistic update removal ([808891d](https://github.com/wellmaintained/skills/commit/808891d535e4d3c0b403c9032fc0f3c45bd48f7b))
* **beads-bridge:** update header metrics in real-time on status/task changes ([d42119f](https://github.com/wellmaintained/skills/commit/d42119f36e5225bd1906c9b5754423faa307d3e1))
* correct parent-child relationship for wms-2zy ([9c099cf](https://github.com/wellmaintained/skills/commit/9c099cf9ed19292076bca28de3646d04e3a885c3))
* Resolve bd doctor issues ([20a2d2c](https://github.com/wellmaintained/skills/commit/20a2d2ca139ef64b4699191416e65acccbd264f5))


### Features

* add just command runner for dev scripts ([e691199](https://github.com/wellmaintained/skills/commit/e6911996a38eec61c207dd139ac0a1852f3386e7))
* add new bead card design task to wms-ztf ([1d28caf](https://github.com/wellmaintained/skills/commit/1d28caf87e1c7a1f6b8b2d6f0b671723633f6fba))
* **beads-bridge:** implement structured logging system with configurable levels ([17f7421](https://github.com/wellmaintained/skills/commit/17f74219a4d7343dbae3c17e4dfc074e1c017c7a))
* Enhance LiveWebBackend and UI for subtask creation ([af78e41](https://github.com/wellmaintained/skills/commit/af78e41cf19cc4b40d98d7f06b23f11a7952e0d1))
* migrate toolchain to Bun and refactor for maintainability ([e506d0c](https://github.com/wellmaintained/skills/commit/e506d0cafaebdaf4099dfaf8debe0ddf2b91c1be))
* **wms-pb3:** add task to fix favicon 404 error ([8028c3c](https://github.com/wellmaintained/skills/commit/8028c3cf9ad6924901288ef2844cb2c751145ef3))

# [1.3.0](https://github.com/wellmaintained/skills/compare/v1.2.1...v1.3.0) (2025-11-22)


### Bug Fixes

* Update beads-bridge serve to work with Vite build output ([8379db8](https://github.com/wellmaintained/skills/commit/8379db8ed9899311ca934b02f6abe7cca1fd8148))


### Features

* Upgrade beads-bridge serve from read-only Mermaid visualization to interactive React/reactflow editor. ([0e8a996](https://github.com/wellmaintained/skills/commit/0e8a996297879a3b2dba68904fb57c494120fe70))

## [1.2.1](https://github.com/wellmaintained/skills/compare/v1.2.0...v1.2.1) (2025-11-18)


### Bug Fixes

* **beads-bridge:** support hierarchical bead IDs in status coloring ([3d889ae](https://github.com/wellmaintained/skills/commit/3d889ae547366de4efd82298c532f34dcef5b098))

# [1.2.0](https://github.com/wellmaintained/skills/compare/v1.1.4...v1.2.0) (2025-11-16)


### Bug Fixes

* **beads:** require shared BEADS_DB env var to prevent race conditions ([321ba1f](https://github.com/wellmaintained/skills/commit/321ba1fac41fe7fc8d809846641f7e7482b9174d))


### Features

* initialize beads issue tracking with dependency upgrade tasks ([ce8b6c7](https://github.com/wellmaintained/skills/commit/ce8b6c7879251665d497cc18443d9c1d89a0cc49))

## [1.1.4](https://github.com/wellmaintained/skills/compare/v1.1.3...v1.1.4) (2025-11-15)


### Bug Fixes

* **beads-bridge:** update js-yaml to fix prototype pollution vulnerability ([149549a](https://github.com/wellmaintained/skills/commit/149549a5bbb9a78dfd96babb344ce2820c91232d))
* **beads-bridge:** upgrade vitest to 4.x and fix esbuild vulnerabilities ([d41a4c6](https://github.com/wellmaintained/skills/commit/d41a4c6bf3a1a9842de4998a9c9b827fc331c579))

## [1.1.3](https://github.com/wellmaintained/skills/compare/v1.1.2...v1.1.3) (2025-11-14)


### Bug Fixes

* **beads-bridge:** fix plugin.json validation errors ([e446653](https://github.com/wellmaintained/skills/commit/e446653eebc51eab62baef1c60b8c3a9599d23e1))

## [1.1.2](https://github.com/wellmaintained/skills/compare/v1.1.1...v1.1.2) (2025-11-13)


### Bug Fixes

* use relative path for monorepo plugin source ([6ee1b13](https://github.com/wellmaintained/skills/commit/6ee1b135f4b2a6b49a833061397f9f7bc33ac1a6))

## [1.1.1](https://github.com/wellmaintained/skills/compare/v1.1.0...v1.1.1) (2025-11-12)


### Bug Fixes

* improve error reporting for invalid repository paths ([ca9a97e](https://github.com/wellmaintained/skills/commit/ca9a97e128a6a73b75fbefa2720b306434a0e564))

# [1.1.0](https://github.com/wellmaintained/skills/compare/v1.0.1...v1.1.0) (2025-11-10)


### Features

* add CI workflow monitoring guide to release documentation ([a2fd332](https://github.com/wellmaintained/skills/commit/a2fd33268896d203eedaa6db796b83a374de5b3a))

## [1.0.1](https://github.com/wellmaintained/skills/compare/v1.0.0...v1.0.1) (2025-11-10)


### Bug Fixes

* improve badge clarity in plugin documentation ([bf0a5f7](https://github.com/wellmaintained/skills/commit/bf0a5f758f894ab8b56b1dd8bd17a28929d2be52))
* improve clarity in release documentation ([8a7e2a8](https://github.com/wellmaintained/skills/commit/8a7e2a8ec18c2c0cc6f63f022f7b93d23940042e))

# 1.0.0 (2025-11-10)


### Bug Fixes

* apply status-based colors to Mermaid diagram nodes ([0ff68a2](https://github.com/wellmaintained/skills/commit/0ff68a2366b179002172b8861234603ec0b40eb6)), closes [#d4](https://github.com/wellmaintained/skills/issues/d4) [#cce5](https://github.com/wellmaintained/skills/issues/cce5) [#f8f9](https://github.com/wellmaintained/skills/issues/f8f9) [#f8d7](https://github.com/wellmaintained/skills/issues/f8d7) [wellmaintained/skills#2](https://github.com/wellmaintained/skills/issues/2)
* **beads-bridge:** remove duplicate files to match Claude Code structure ([95b5625](https://github.com/wellmaintained/skills/commit/95b56251ef2e5935a3c895fc1d94732fdedaaa3e))
* **ci:** enable proper test failures and improve plugin quality gates ([e365018](https://github.com/wellmaintained/skills/commit/e3650180303f59abee6edcc83722a94299c0c7e9))
* **ci:** fix jq timestamp command and allow flaky tests ([7adb2fe](https://github.com/wellmaintained/skills/commit/7adb2fe2ac433572b2349f15afd07e80edd1e5f1))
* **ci:** update validate-plugins workflow to use correct marketplace.json path ([1e483dc](https://github.com/wellmaintained/skills/commit/1e483dc956ac23545c2d59be756a8f9fc80dcc95))
* correct marketplace.json schema to match Claude Code spec ([9dd1672](https://github.com/wellmaintained/skills/commit/9dd1672c4010d1a48f2ae5e65268a2b09041a517))
* move marketplace.json to .claude-plugin/ directory ([e3f7d11](https://github.com/wellmaintained/skills/commit/e3f7d11d5ab9fd4c948cf5108144fb27bcfa5e14))
* position Mermaid color init directive before diagram ([34f5a90](https://github.com/wellmaintained/skills/commit/34f5a905e9c8b91b62647a5f963f33882792f24e))
* prevent race condition in CI release job ([8117485](https://github.com/wellmaintained/skills/commit/81174857232f206dcc5cd542097b15c53f433cab))
* pull latest changes before semantic-release runs ([33ebc47](https://github.com/wellmaintained/skills/commit/33ebc474e6be9ffe1dce0c3040f469f4ebc61ea1))
* sync package.json version and skip flaky express tests ([d6b7b25](https://github.com/wellmaintained/skills/commit/d6b7b255277cfc9790553b7956b4d56e4e070d57))


### Features

* add live dashboard colors to Mermaid diagrams ([8eb8bd0](https://github.com/wellmaintained/skills/commit/8eb8bd01a840f8c6dd335f01149edb499c921861))
* add section-updater utility for markdown sections ([bd2b627](https://github.com/wellmaintained/skills/commit/bd2b62700daffa7a647f0b8ab56718c684f4cd4e))
* add semantic-release configuration for automated releases ([8545b6d](https://github.com/wellmaintained/skills/commit/8545b6dd39d4dd2b1e0ce88af0982cc72ee4d5e5))
* add semantic-release job to CI workflow ([a909597](https://github.com/wellmaintained/skills/commit/a909597e538c7c09048e4b84006223b0b573a52f))
* add sync types for Shortcut sync orchestrator ([69cfc8e](https://github.com/wellmaintained/skills/commit/69cfc8efbe77e19d466cfd63a4ffba22f3f121e1))
* **ci:** add JSON schema validation for marketplace and plugin configs ([d5c697b](https://github.com/wellmaintained/skills/commit/d5c697be1864736cced6a45f98fc6cb3b764b9e7))
* **ci:** add workflow_dispatch and workflow path triggers ([8d1bccc](https://github.com/wellmaintained/skills/commit/8d1bccc0714702fc20a7c92921f4f1381c3db1f1))
* create ShortcutSyncOrchestrator skeleton ([f7ff72a](https://github.com/wellmaintained/skills/commit/f7ff72a23868b8cffdd2bfabbd1327ac15e3c488))
* implement narrative comment generation in orchestrator ([388e1b2](https://github.com/wellmaintained/skills/commit/388e1b22d5812dfd0433368d8159ad3dbcf491dd))
* implement Yak Map section update in orchestrator ([6b2b9be](https://github.com/wellmaintained/skills/commit/6b2b9be3f1402bd7a02592d6a13578368a4151f1))
* integrate ShortcutSyncOrchestrator and route syncProgress ([076674f](https://github.com/wellmaintained/skills/commit/076674f01dda46cc03df1813dbfb4fae597a948d))
* sync beads-bridge updates from pensive ([2fcb3c6](https://github.com/wellmaintained/skills/commit/2fcb3c6678a2eb8a80cfb3770984ed778c9fffeb))
