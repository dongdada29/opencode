#!/usr/bin/env bash
# 一次性修复 npm dist-tag：将 latest 指回稳定版，beta 指到预发布版。
# Usage: ./scripts/fix-npm-dist-tags.sh [stable_version] [beta_version]
# Example: ./scripts/fix-npm-dist-tags.sh 1.2.3 1.3.0-beta.8
set -euo pipefail

STABLE_VERSION="${1:-1.2.3}"
BETA_VERSION="${2:-1.3.0-beta.8}"

PACKAGES=(
  nuwaxcode
  nuwaxcode-darwin-arm64
  nuwaxcode-darwin-x64
  nuwaxcode-linux-arm64
  nuwaxcode-linux-x64
  nuwaxcode-windows-arm64
  nuwaxcode-windows-x64
)

echo "🔧 修复 npm dist-tag：latest → ${STABLE_VERSION}，beta → ${BETA_VERSION}"
echo "   registry: https://registry.npmjs.org"
echo ""

REGISTRY="https://registry.npmjs.org"

for pkg in "${PACKAGES[@]}"; do
  echo "📦 ${pkg}"
  npm dist-tag add "${pkg}@${STABLE_VERSION}" latest --registry "$REGISTRY"
  npm dist-tag add "${pkg}@${BETA_VERSION}" beta --registry "$REGISTRY"
done

echo ""
echo "✅ 完成。验证："
npm view nuwaxcode dist-tags --registry "$REGISTRY"
