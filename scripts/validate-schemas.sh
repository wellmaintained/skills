#!/bin/bash
# Pre-commit hook script to validate JSON schemas
# Can be used manually or as a git pre-commit hook

set -e

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$REPO_ROOT"

echo "🔍 Validating JSON schemas..."

# Check if ajv-cli is available
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js and npm."
    exit 1
fi

# Check if ajv-cli is installed
if ! npx ajv --help &> /dev/null; then
    echo "⚠️  ajv-cli not found. Installing locally..."
    npm install --save-dev ajv-cli ajv-formats
fi

# Validate marketplace.json
echo ""
echo "📋 Validating marketplace.json..."
if [ -f ".claude-plugin/marketplace.json" ]; then
    if npx ajv validate -s schemas/marketplace.schema.json -d .claude-plugin/marketplace.json --spec=draft7 --strict=false -c ajv-formats 2>&1; then
        echo "✅ marketplace.json is valid"
    else
        echo "❌ marketplace.json validation failed"
        exit 1
    fi
else
    echo "⚠️  .claude-plugin/marketplace.json not found, skipping"
fi

# Validate all plugin.json files
echo ""
echo "🔌 Validating plugin.json files..."
plugin_count=0
valid_count=0

while IFS= read -r plugin_file; do
    plugin_count=$((plugin_count + 1))
    echo "  Checking: $plugin_file"

    if npx ajv validate -s schemas/plugin.schema.json -d "$plugin_file" --spec=draft7 --strict=false -c ajv-formats 2>&1; then
        echo "  ✅ $plugin_file is valid"
        valid_count=$((valid_count + 1))
    else
        echo "  ❌ $plugin_file validation failed"
        exit 1
    fi
done < <(find plugins -name "plugin.json" -type f 2>/dev/null || true)

if [ $plugin_count -eq 0 ]; then
    echo "⚠️  No plugin.json files found"
else
    echo ""
    echo "✅ All $valid_count/$plugin_count plugin.json files are valid"
fi

echo ""
echo "🎉 Schema validation passed!"
