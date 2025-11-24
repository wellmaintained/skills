#!/usr/bin/env bash
set -euo pipefail

echo "Checking required files for each plugin..."

for plugin_dir in plugins/*/; do
  plugin_name=$(basename "$plugin_dir")
  echo "Checking plugin: $plugin_name"

  # Check for required files
  required_files=(
    ".claude-plugin/plugin.json"
    "README.md"
    "QUICKSTART.md"
    "LICENSE"
  )

  for file in "${required_files[@]}"; do
    if [ ! -f "$plugin_dir$file" ]; then
      echo "❌ Missing required file: $plugin_dir$file"
      exit 1
    fi
  done

  echo "✅ All required files present for $plugin_name"
done

echo "✅ All plugins have required files"
