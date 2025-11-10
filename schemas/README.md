# JSON Schemas for Claude Code Plugin Validation

This directory contains JSON schemas for validating Claude Code plugin configuration files.

## Schemas

### marketplace.schema.json

Validates `marketplace.json` files that define plugin marketplaces according to Claude Code specifications.

**Validates:**
- Required fields: `name`, `owner`, `plugins`
- Marketplace metadata: `description`, `version`, `homepage`, etc.
- Plugin entries with proper source configurations
- Author and repository information
- Semantic versioning format
- Kebab-case naming conventions
- Email and URI formats

### plugin.schema.json

Validates `plugin.json` manifest files for individual plugins according to Claude Code specifications.

**Validates:**
- Required field: `name`
- Plugin metadata: `version`, `description`, `author`, `license`, etc.
- Component paths: `commands`, `agents`, `skills`, `hooks`, `mcpServers`
- Repository and homepage URLs
- Author information (string or object format)
- Installation configuration
- Requirements specification
- Semantic versioning format
- Kebab-case naming conventions

## Usage

### Command Line Validation

#### Using npm scripts (recommended)

```bash
# Validate all schemas
npm run validate

# Validate only marketplace.json
npm run validate:marketplace

# Validate only plugin.json files
npm run validate:plugins
```

#### Using ajv-cli directly

```bash
# Validate marketplace.json
npx ajv validate -s schemas/marketplace.schema.json -d .claude-plugin/marketplace.json --spec=draft7 --strict=false -c ajv-formats

# Validate plugin.json
npx ajv validate -s schemas/plugin.schema.json -d plugins/your-plugin/.claude-plugin/plugin.json --spec=draft7 --strict=false -c ajv-formats

# Validate all plugin.json files
find plugins -name "plugin.json" -type f -exec npx ajv validate -s schemas/plugin.schema.json -d {} --spec=draft7 --strict=false -c ajv-formats \;
```

### Pre-commit Hook

Use the provided validation script as a pre-commit hook:

```bash
bash scripts/validate-schemas.sh
```

This script will:
1. Check if ajv-cli is installed (and install it if needed)
2. Validate marketplace.json against the schema
3. Validate all plugin.json files against the schema
4. Provide clear error messages if validation fails

#### Setting up as a Git pre-commit hook

```bash
# Create or edit .git/hooks/pre-commit
cat > .git/hooks/pre-commit <<'EOF'
#!/bin/bash
exec bash scripts/validate-schemas.sh
EOF

# Make it executable
chmod +x .git/hooks/pre-commit
```

### CI/CD Integration

The schemas are automatically validated in CI via the `validate-plugins.yml` workflow, which runs on:
- Pull requests affecting plugins or marketplace
- Pushes to main branch
- Manual workflow dispatch

## Installation

The validation tool (ajv-cli) is installed as a dev dependency:

```bash
npm install --save-dev ajv-cli ajv-formats
```

Or install globally:

```bash
npm install -g ajv-cli ajv-formats
```

## Schema Development

### Testing Schema Changes

When modifying schemas, test against existing files:

```bash
# Test marketplace schema
npx ajv validate -s schemas/marketplace.schema.json -d .claude-plugin/marketplace.json --spec=draft7 --strict=false -c ajv-formats

# Test plugin schema
npx ajv validate -s schemas/plugin.schema.json -d plugins/*/,.claude-plugin/plugin.json --spec=draft7 --strict=false -c ajv-formats
```

### Schema Features

Both schemas include:
- **Format validation**: Email addresses, URIs, date-time formats
- **Pattern validation**: Kebab-case names, semantic versioning, relative paths
- **Conditional validation**: Different requirements based on source type
- **Type flexibility**: Support for string or object formats where appropriate
- **Clear error messages**: Descriptive validation errors for debugging

### Common Validation Errors

#### Invalid name format
```
Error: must match pattern "^[a-z0-9]+(-[a-z0-9]+)*$"
```
- Names must be kebab-case (lowercase, hyphens only)
- Example: `my-plugin-name` ✅, `My_Plugin_Name` ❌

#### Invalid version format
```
Error: must match pattern for semantic versioning
```
- Use semantic versioning: `MAJOR.MINOR.PATCH`
- Example: `1.2.3` ✅, `v1.2` ❌

#### Missing required field
```
Error: must have required property 'name'
```
- Ensure all required fields are present
- Check schema for required fields list

#### Invalid source configuration
```
Error: must match exactly one schema in oneOf
```
- For GitHub sources: use `{"source": "github", "repo": "owner/repo"}`
- For Git URLs: use `{"source": "url", "url": "https://..."}`
- For relative paths: use string like `"./plugins/my-plugin"`

## References

The schemas are based on the official Claude Code documentation:
- [Plugin Marketplaces](https://docs.claude.com/claude-code/plugin-marketplaces)
- [Plugin Reference](https://docs.claude.com/claude-code/plugins-reference)

## Version History

- **1.0.0** (2025-11-10): Initial schema implementation
  - Complete marketplace.json validation
  - Complete plugin.json validation
  - Support for all documented fields and formats
  - Integrated with CI/CD pipeline
