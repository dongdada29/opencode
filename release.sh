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

# Run publish
echo "🚀 Publishing to NPM (dist-tag: ${NPM_DIST_TAG})..."
cd packages/opencode

if [ "$NPM_DIST_TAG" = "latest" ]; then
  PUBLISH_CMD="bun run publish --latest"
else
  # packages/opencode/script/publish.ts：无 --latest 时仅用 Script.channel，不添加 latest
  export OPENCODE_CHANNEL="$NPM_DIST_TAG"
  PUBLISH_CMD="bun run publish"
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

# 确认 registry 上主包声明的 optional 子包均已存在（避免「主包已发、子包缺失」）
if [ "${SKIP_REGISTRY_VERIFY:-}" = "1" ]; then
  echo "⏭️  SKIP_REGISTRY_VERIFY=1，跳过 npm optional 完整性校验"
else
  echo "🔍 校验 npm：nuwaxcode@${NEW_VERSION} 与全部 optional 子包…"
  bun run script/verify-registry-complete.ts "$NEW_VERSION"
fi

echo "✅ Release $NEW_VERSION completed successfully!"
