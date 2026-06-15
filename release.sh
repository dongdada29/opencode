#!/bin/bash

# Release Workflow Script for NuwaxCode
# Usage: ./release.sh <new_version> [otp_code|--no-otp]
# Example: ./release.sh 1.1.52
# Example with OTP: ./release.sh 1.1.52 123456
# Example skip OTP prompt: ./release.sh 1.1.52 --no-otp
#
# NPM dist-tag：未设置时预发布版本（如 1.3.0-beta.8）自动用 beta，稳定版用 latest。
# 也可显式覆盖：NPM_DIST_TAG=beta ./release.sh 1.1.72
#
# 发版结束后默认会校验 npm 上 optional 子包是否齐全；若需跳过（例如 registry 延迟）：
#   SKIP_REGISTRY_VERIFY=1 ./release.sh 1.1.76
#
# 发版后若需触发国内 npmmirror 同步主包 + 全部 optional 平台子包：
#   ./scripts/sync-npmmirror.sh
# 仅检查镜像上是否已有当前 package.json 版本（不发起 PUT）：
#   ./scripts/sync-npmmirror.sh --check
#
# CI：打 tag v* 触发 .github/workflows/build-release.yml（构建 + GitHub Release + npm），
# npm 发布校验与 ./scripts/release-publish.sh 一致。

set -e

NEW_VERSION=$1
OTP_CODE=$2
NO_OTP_FLAG=""
if [ "$OTP_CODE" = "--no-otp" ]; then
  NO_OTP_FLAG="--no-otp"
  OTP_CODE=""
fi
if [ -z "$NEW_VERSION" ]; then
  echo "Error: Please provide a version number."
  echo "Usage: ./release.sh <new_version> [otp_code|--no-otp]"
  echo "Optional: NPM_DIST_TAG=<tag> ./release.sh <new_version> [otp_code]"
  exit 1
fi

ROOT="$(pwd)"
NPM_DIST_TAG="$("$ROOT/scripts/resolve-npm-dist-tag.sh" "$NEW_VERSION")"
echo "📌 npm dist-tag: $NPM_DIST_TAG"

echo "🚀 Starting release process for version $NEW_VERSION..."

if [ ! -f "packages/opencode/package.json" ]; then
  echo "Error: Could not find packages/opencode/package.json. Are you in the project root?"
  exit 1
fi

echo "📦 Updating package.json versions..."
PACKAGE_JSON="packages/opencode/package.json"

bun -e "
  const fs = require('fs');
  const pkg = require('./$PACKAGE_JSON');
  pkg.version = '$NEW_VERSION';
  if (pkg.optionalDependencies) {
    for (const key in pkg.optionalDependencies) {
      if (key.startsWith('nuwaxcode-')) {
        pkg.optionalDependencies[key] = '$NEW_VERSION';
      }
    }
  }
  fs.writeFileSync('./$PACKAGE_JSON', JSON.stringify(pkg, null, 2) + '\n');
"

echo "✅ Updated $PACKAGE_JSON to version $NEW_VERSION"

echo "📝 Please ensure you have updated CHANGELOG-nuwaxcode.md"
read -p "Press Enter to continue if changelog is updated (or Ctrl+C to abort)..."

echo "🏗️  Rebuilding binaries for version $NEW_VERSION..."
(cd packages/opencode && OPENCODE_VERSION="$NEW_VERSION" OPENCODE_CHANNEL="${NPM_DIST_TAG}" bun run script/build.ts)

# 与 CI publish-npm job 共用同一套 npm 发布与校验逻辑（见 scripts/release-publish.sh）
export NPM_DIST_TAG
if [ -n "$OTP_CODE" ]; then
  export NPM_CONFIG_OTP="$OTP_CODE"
  echo "Using provided OTP."
elif [ -n "$NO_OTP_FLAG" ]; then
  export NPM_CONFIG_OTP=""
fi

"$ROOT/scripts/release-publish.sh" "$NEW_VERSION"

echo "✅ Release $NEW_VERSION completed successfully!"
