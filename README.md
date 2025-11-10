# Well Maintained Skills

Skills for Claude Code.

---

## Available Skills

See **[SKILLS.md](./SKILLS.md)** for a complete guide to all skills available in this marketplace, including:
- When Claude automatically uses each skill
- Example queries and use cases
- Installation and setup instructions
- Prerequisites and configuration requirements

Quick preview of available skills:
- **beads-bridge** - Track multi-repo work with GitHub/Shortcut integration

---

## Available Plugins

### beads-bridge

Bridge Beads issue tracking with GitHub Projects and Shortcut for unified project visibility across multiple repositories.

**Requirements:**
- Node.js >= 18.0.0
- Beads CLI (`bd`) >= v0.21.3

[📖 Documentation](./plugins/beads-bridge) | [🚀 Quick Start](./plugins/beads-bridge/QUICKSTART.md)

---

## Installation

### 1. Add this marketplace

```bash
/plugin marketplace add wellmaintained/skills
```

### 2. Install a plugin

```bash
/plugin install beads-bridge@wellmaintained
```

---

## Contributing

### Schema Validation

This repository uses JSON schemas to validate plugin configurations. Before submitting changes to `marketplace.json` or `plugin.json` files, validate them locally:

```bash
# Validate all schemas (recommended)
npm run validate

# Or validate individually
npm run validate:marketplace
npm run validate:plugins
```

See [schemas/README.md](./schemas/README.md) for detailed documentation on schema validation.

### Pre-commit Hook (Optional)

Set up automatic validation before commits:

```bash
cat > .git/hooks/pre-commit <<'EOF'
#!/bin/bash
exec bash scripts/validate-schemas.sh
EOF

chmod +x .git/hooks/pre-commit
```

---

## Releases

This repository uses automated releases powered by [semantic-release](https://semantic-release.gitbook.io/).

**For contributors:**
- Use [conventional commit messages](https://www.conventionalcommits.org/)
- Releases happen automatically when you push to `main`
- See [RELEASE.md](RELEASE.md) for detailed release process

**Version bumps:**
- `fix:` = patch release (1.0.0 → 1.0.1)
- `feat:` = minor release (1.0.0 → 1.1.0)
- `feat!:` or `BREAKING CHANGE:` = major release (1.0.0 → 2.0.0)

---

## License

Individual plugins are licensed under their respective licenses (see each plugin's LICENSE file).

This marketplace is MIT licensed. See [LICENSE](./LICENSE).

---

Made by 🤖, overseen by 👨🏻‍💻
