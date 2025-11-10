#!/usr/bin/env bash
# Version Consistency Checker
#
# This script validates that version numbers are consistent across all files in each plugin.
# The source of truth is the plugin.json file in each plugin's .claude-plugin directory.
#
# For each plugin, it checks:
# 1. The version in .claude-plugin/marketplace.json matches plugin.json
# 2. The version in skills/package.json matches plugin.json (if it exists)
# 3. The version in skills/{plugin-name}/package.json matches plugin.json (if it exists)
#
# Exit codes:
#   0 - All versions are consistent
#   1 - Version mismatches found
#
# How to fix version issues:
# 1. Update the version in the plugin's .claude-plugin/plugin.json file (source of truth)
# 2. Run this script to identify which other files need updating
# 3. Update all files to match the plugin.json version
# 4. The marketplace.json lastUpdated timestamp will be updated automatically by CI

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ERRORS=0
MARKETPLACE_JSON="$PROJECT_ROOT/.claude-plugin/marketplace.json"

echo "🔍 Checking version consistency across all plugins..."
echo ""

# Check that marketplace.json exists
if [ ! -f "$MARKETPLACE_JSON" ]; then
    echo "❌ Error: $MARKETPLACE_JSON not found"
    exit 1
fi

# Iterate through each plugin directory
for PLUGIN_DIR in "$PROJECT_ROOT"/plugins/*/; do
    PLUGIN_NAME=$(basename "$PLUGIN_DIR")
    PLUGIN_JSON="$PLUGIN_DIR.claude-plugin/plugin.json"

    echo "📦 Checking plugin: $PLUGIN_NAME"

    # Check that plugin.json exists
    if [ ! -f "$PLUGIN_JSON" ]; then
        echo "   ❌ Error: $PLUGIN_JSON not found"
        ERRORS=$((ERRORS + 1))
        continue
    fi

    # Extract version from plugin.json (source of truth)
    PLUGIN_VERSION=$(jq -r '.version' "$PLUGIN_JSON")
    if [ "$PLUGIN_VERSION" = "null" ] || [ -z "$PLUGIN_VERSION" ]; then
        echo "   ❌ Error: No version found in $PLUGIN_JSON"
        ERRORS=$((ERRORS + 1))
        continue
    fi

    echo "   📌 Source of truth: $PLUGIN_JSON → v$PLUGIN_VERSION"

    # Check marketplace.json version
    MARKETPLACE_VERSION=$(jq -r --arg plugin "$PLUGIN_NAME" '.plugins[] | select(.name == $plugin) | .version' "$MARKETPLACE_JSON")
    if [ "$MARKETPLACE_VERSION" = "null" ] || [ -z "$MARKETPLACE_VERSION" ]; then
        echo "   ❌ Error: Plugin '$PLUGIN_NAME' not found in $MARKETPLACE_JSON"
        ERRORS=$((ERRORS + 1))
    elif [ "$MARKETPLACE_VERSION" != "$PLUGIN_VERSION" ]; then
        echo "   ❌ Version mismatch in $MARKETPLACE_JSON"
        echo "      Expected: v$PLUGIN_VERSION"
        echo "      Found:    v$MARKETPLACE_VERSION"
        ERRORS=$((ERRORS + 1))
    else
        echo "   ✅ $MARKETPLACE_JSON version matches"
    fi

    # Check skills/package.json if it exists
    SKILLS_PACKAGE_JSON="$PLUGIN_DIR/skills/package.json"
    if [ -f "$SKILLS_PACKAGE_JSON" ]; then
        SKILLS_VERSION=$(jq -r '.version' "$SKILLS_PACKAGE_JSON")
        if [ "$SKILLS_VERSION" != "$PLUGIN_VERSION" ]; then
            echo "   ❌ Version mismatch in skills/package.json"
            echo "      Expected: v$PLUGIN_VERSION"
            echo "      Found:    v$SKILLS_VERSION"
            ERRORS=$((ERRORS + 1))
        else
            echo "   ✅ skills/package.json version matches"
        fi
    fi

    # Check skills/{plugin-name}/package.json if it exists
    SKILL_PACKAGE_JSON="$PLUGIN_DIR/skills/$PLUGIN_NAME/package.json"
    if [ -f "$SKILL_PACKAGE_JSON" ]; then
        SKILL_VERSION=$(jq -r '.version' "$SKILL_PACKAGE_JSON")
        if [ "$SKILL_VERSION" != "$PLUGIN_VERSION" ]; then
            echo "   ❌ Version mismatch in skills/$PLUGIN_NAME/package.json"
            echo "      Expected: v$PLUGIN_VERSION"
            echo "      Found:    v$SKILL_VERSION"
            ERRORS=$((ERRORS + 1))
        else
            echo "   ✅ skills/$PLUGIN_NAME/package.json version matches"
        fi
    fi

    echo ""
done

# Summary
if [ $ERRORS -eq 0 ]; then
    echo "✅ All version numbers are consistent!"
    exit 0
else
    echo "❌ Found $ERRORS version inconsistency issue(s)"
    echo ""
    echo "How to fix:"
    echo "1. Update versions in plugin.json files (these are the source of truth)"
    echo "2. Update all other files to match the plugin.json version"
    echo "3. The marketplace.json will be auto-updated by CI after merge to main"
    exit 1
fi
