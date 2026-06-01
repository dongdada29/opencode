#!/usr/bin/env bash
# npm 发布与校验（与 release.sh 后半段一致，供本地与 CI 共用）
# Usage: ./scripts/release-publish.sh <version>
# Env:
#   NPM_DIST_TAG          dist-tag，默认 latest
#   SKIP_REGISTRY_VERIFY  设为 1 跳过发布后 registry 校验
#   NODE_AUTH_TOKEN       CI 下发 npm token（本地可用 npm login）
#   SKIP_DOCKER_PUBLISH   默认 1，仅发 npm
set -euo pipefail

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/release-publish.sh <version>"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f "packages/opencode/package.json" ]; then
  echo "Error: packages/opencode/package.json not found"
  exit 1
fi

NPM_DIST_TAG="${NPM_DIST_TAG:-latest}"

echo "📦 Syncing package.json to version $VERSION..."
export VERSION
bun -e "
  const fs = require('fs');
  const path = 'packages/opencode/package.json';
  const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
  pkg.version = process.env.VERSION;
  if (pkg.optionalDependencies) {
    for (const key of Object.keys(pkg.optionalDependencies)) {
      if (key.startsWith('nuwaxcode-')) pkg.optionalDependencies[key] = process.env.VERSION;
    }
  }
  fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
"

cd packages/opencode

if [ -d "./dist/nuwaxcode" ]; then
  echo "🧹 Cleaning stale ./dist/nuwaxcode before publish..."
  rm -rf "./dist/nuwaxcode"
fi

echo "🧪 Pre-release version consistency checks..."
bun run script/check-version-consistency.ts --phase pre --version "$VERSION"

echo "🚀 Publishing to npm (dist-tag: ${NPM_DIST_TAG})..."
export SKIP_DOCKER_PUBLISH="${SKIP_DOCKER_PUBLISH:-1}"
export OPENCODE_VERSION="$VERSION"
export OPENCODE_RELEASE="1"

if [ "$NPM_DIST_TAG" = "latest" ]; then
  export OPENCODE_CHANNEL="latest"
else
  export OPENCODE_CHANNEL="$NPM_DIST_TAG"
fi

bun run script/publish.ts

if [ "${SKIP_REGISTRY_VERIFY:-}" = "1" ]; then
  echo "⏭️  SKIP_REGISTRY_VERIFY=1，跳过 npm optional 完整性校验"
else
  echo "🔍 Waiting for npm registry propagation..."
  sleep 45
  echo "🔍 Post-release version consistency checks..."
  bun run script/check-version-consistency.ts --phase post --version "$VERSION"
fi

echo "✅ npm publish $VERSION completed"
