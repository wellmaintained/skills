#!/usr/bin/env bash
set -euo pipefail

echo "Validating plugin.json files JSON syntax..."

find plugins -name "plugin.json" -type f | while read plugin_file; do
  echo "Checking syntax: $plugin_file..."
  if ! jq empty "$plugin_file" 2>/dev/null; then
    echo "❌ $plugin_file is not valid JSON"
    exit 1
  fi
  echo "✅ $plugin_file has valid JSON syntax"
done

echo "✅ All plugin.json files have valid JSON syntax"
