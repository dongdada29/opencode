#!/bin/bash

# Release Workflow Script for NuwaxCode
# Usage: ./release.sh <new_version> [otp_code|--no-otp]
# Example: ./release.sh 1.1.52
# Example with OTP: ./release.sh 1.1.52 123456
# Example skip OTP prompt: ./release.sh 1.1.52 --no-otp
#
# NPM dist-tag (default: latest). Set to e.g. beta to publish without moving latest:
#   NPM_DIST_TAG=beta ./release.sh 1.1.72
#   NPM_DIST_TAG=beta ./release.sh 1.1.72 123456
#
# 发版结束后默认会校验 npm 上 optional 子包是否齐全；若需跳过（例如 registry 延迟）：
#   SKIP_REGISTRY_VERIFY=1 ./release.sh 1.1.76
#
# 发版后若需触发国内 npmmirror 同步主包 + 全部 optional 平台子包：
#   ./scripts/sync-npmmirror.sh
# 仅检查镜像上是否已有当前 package.json 版本（不发起 PUT）：
#   ./scripts/sync-npmmirror.sh --check

set -e

NEW_VERSION=$1
OTP_CODE=$2
# 支持显式跳过 OTP 交互：
# - 传第二个参数为 --no-otp 时，不再拼接 --otp，直接把 --no-otp 透传给发布脚本。
# - 这样可避免在无交互/远程执行时卡在 OTP 输入提示。
NO_OTP_FLAG=""
if [ "$OTP_CODE" = "--no-otp" ]; then
  NO_OTP_FLAG="--no-otp"
  OTP_CODE=""
fi
# 未设置时与历史行为一致：打 latest；设为 beta/next 等则只打该 tag，不挂 latest
NPM_DIST_TAG="${NPM_DIST_TAG:-latest}"

if [ -z "$NEW_VERSION" ]; then
  echo "Error: Please provide a version number."
  echo "Usage: ./release.sh <new_version> [otp_code|--no-otp]"
  echo "Optional: NPM_DIST_TAG=beta ./release.sh <new_version> [otp_code]"
  exit 1
fi

echo "🚀 Starting release process for version $NEW_VERSION..."

# Ensure we are in the project root
if [ ! -f "packages/opencode/package.json" ]; then
    echo "Error: Could not find packages/opencode/package.json. Are you in the project root?"
    exit 1
fi

# Update package.json version and sync optionalDependencies
echo "📦 Updating package.json versions..."
PACKAGE_JSON="packages/opencode/package.json"

# Use Bun to update the JSON file in place (cleaner than sed for JSON)
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

# Remind about Changelog
echo "📝 Please ensure you have updated CHANGELOG-nuwaxcode.md"
read -p "Press Enter to continue if changelog is updated (or Ctrl+C to abort)..."

# 强制重建二进制，避免“package.json 已升级，但二进制仍是旧版本”的错配。
echo "🏗️  Rebuilding binaries for version $NEW_VERSION..."
cd packages/opencode
OPENCODE_VERSION="$NEW_VERSION" OPENCODE_CHANNEL="${NPM_DIST_TAG}" bun run script/build.ts

# 发布前一致性闸门：主包、optionalDependencies、dist 二进制、本地 smoke 版本必须完全一致。
echo "🧪 Running pre-release version consistency checks..."
bun run script/check-version-consistency.ts --phase pre --version "$NEW_VERSION"

# Run publish
echo "🚀 Publishing to NPM (dist-tag: ${NPM_DIST_TAG})..."

# 清理上一次发布遗留的聚合包目录（dist/nuwaxcode）。
# publish.ts 会先扫描 dist/*/package.json 再重写该目录；
# 若此目录残留旧的 nuwaxcode-ai package.json，会被误当作二进制子包参与发布，导致 ENOENT。
if [ -d "./dist/nuwaxcode" ]; then
  echo "🧹 Cleaning stale ./dist/nuwaxcode before publish..."
  rm -rf "./dist/nuwaxcode"
fi

if [ "$NPM_DIST_TAG" = "latest" ]; then
  # 直接调用发布脚本，避免依赖 package.json 里必须存在 "publish" 别名。
  # 这样即使 scripts 结构调整（比如移除 publish alias），release 仍可执行。
  # 显式设置正式发布上下文，避免 Script 根据当前 git 分支误判为 preview/channel 发布。
  export OPENCODE_CHANNEL="latest"
  export OPENCODE_VERSION="$NEW_VERSION"
  export OPENCODE_RELEASE="1"
  PUBLISH_CMD="bun run script/publish.ts --latest"
else
  # packages/opencode/script/publish.ts：无 --latest 时仅用 Script.channel，不添加 latest
  export OPENCODE_CHANNEL="$NPM_DIST_TAG"
  # 同上：直接执行脚本，减少对 package.json scripts 映射的耦合。
  PUBLISH_CMD="bun run script/publish.ts"
fi

if [ ! -z "$OTP_CODE" ]; then
    PUBLISH_CMD="$PUBLISH_CMD --otp=$OTP_CODE"
    echo "Using provided OTP."
elif [ ! -z "$NO_OTP_FLAG" ]; then
    PUBLISH_CMD="$PUBLISH_CMD $NO_OTP_FLAG"
    echo "Skipping OTP prompt (--no-otp)."
else
    # If no OTP provided, checking if we should use --no-otp or let it prompt
    # The publish script handles --no-otp if user wants to bypass, or interactive if not provided
    # Let's just run it. If user didn't provide OTP arg, they will be prompted by the script if needed.
    # The publish script logic: if no otp arg and no --no-otp, it prompts.
    :
fi

# Execute publish
eval $PUBLISH_CMD

# 发布后一致性闸门：registry 主包与 optional 完整，且安装态 CLI 版本等于发布版本。
if [ "${SKIP_REGISTRY_VERIFY:-}" = "1" ]; then
  echo "⏭️  SKIP_REGISTRY_VERIFY=1，跳过 npm optional 完整性校验"
else
  echo "🔍 Running post-release version consistency checks..."
  bun run script/check-version-consistency.ts --phase post --version "$NEW_VERSION"
fi

echo "✅ Release $NEW_VERSION completed successfully!"
