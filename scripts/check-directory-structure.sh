#!/usr/bin/env bash
set -euo pipefail

echo "Validating plugin directory structure..."

for plugin_dir in plugins/*/; do
  plugin_name=$(basename "$plugin_dir")
  echo "Checking structure for: $plugin_name"

  # Check .claude-plugin is at root
  if [ ! -d "$plugin_dir.claude-plugin" ]; then
    echo "❌ Missing .claude-plugin directory at plugin root: $plugin_dir"
    exit 1
  fi

  # Check skills directory structure
  if [ -d "$plugin_dir/skills" ]; then
    # Skills should be at skills/skill-name/SKILL.md, not skills/SKILL.md
    if [ -f "$plugin_dir/skills/SKILL.md" ]; then
      echo "❌ Found SKILL.md at wrong level: $plugin_dir/skills/SKILL.md"
      echo "   Skills should be at skills/<skill-name>/SKILL.md"
      exit 1
    fi

    # Check for source files at wrong level
    if [ -d "$plugin_dir/skills/src" ] || [ -d "$plugin_dir/skills/tests" ]; then
      echo "❌ Found src/tests directories at wrong level in $plugin_dir/skills/"
      echo "   Source files should be at skills/<skill-name>/src/"
      exit 1
    fi

    # Check for package.json at wrong level
    if [ -f "$plugin_dir/skills/package.json" ]; then
      echo "❌ Found package.json at wrong level: $plugin_dir/skills/package.json"
      echo "   package.json should be at skills/<skill-name>/package.json"
      exit 1
    fi
  fi

  echo "✅ Directory structure is correct for $plugin_name"
done

echo "✅ All plugin directory structures are valid"
