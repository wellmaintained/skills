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
