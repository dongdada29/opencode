#!/usr/bin/env bash
# 一次性修复 npm dist-tag：将 latest 指回稳定版，beta 指到预发布版。
# Usage: ./scripts/fix-npm-dist-tags.sh [stable_version] [beta_version]
# Example: ./scripts/fix-npm-dist-tags.sh 1.2.3 1.3.0-beta.8
#
# 认证（二选一）：
#   npm login --registry https://registry.npmjs.org
#   NPM_TOKEN=npm_xxx ./scripts/fix-npm-dist-tags.sh
set -euo pipefail

STABLE_VERSION="${1:-1.2.3}"
BETA_VERSION="${2:-1.3.0-beta.8}"
REGISTRY="https://registry.npmjs.org"

PACKAGES=(
  nuwaxcode
  nuwaxcode-darwin-arm64
  nuwaxcode-darwin-x64
  nuwaxcode-linux-arm64
  nuwaxcode-linux-x64
  nuwaxcode-windows-arm64
  nuwaxcode-windows-x64
)

# npm 官方 registry 的 auth token（与 CI 的 NODE_AUTH_TOKEN / NPM_TOKEN 一致）
NPM_AUTH_TOKEN="${NPM_TOKEN:-${NODE_AUTH_TOKEN:-}}"
npm_cmd() {
  if [ -n "$NPM_AUTH_TOKEN" ]; then
    npm "$@" --registry "$REGISTRY" --//registry.npmjs.org/:_authToken="$NPM_AUTH_TOKEN"
  else
    npm "$@" --registry "$REGISTRY"
  fi
}

echo "🔧 修复 npm dist-tag：latest → ${STABLE_VERSION}，beta → ${BETA_VERSION}"
echo "   registry: ${REGISTRY}"
echo ""

if ! npm_cmd whoami >/dev/null 2>&1; then
  echo "❌ 无法认证 npmjs.org（E401）"
  echo ""
  echo "你当前的 npm 全局 registry 可能是镜像站，改 dist-tag 必须对官方 registry 有写权限。"
  echo ""
  echo "任选一种方式："
  echo ""
  echo "  方式 1 — 重新登录（会打开浏览器）："
  echo "    npm login --registry ${REGISTRY}"
  echo ""
  echo "  方式 2 — 使用 Access Token（推荐，与 CI 相同）："
  echo "    在 https://www.npmjs.com/settings/~tokens 创建 Granular Access Token"
  echo "    权限需包含 nuwaxcode 包的「Read and write」"
  echo "    然后执行："
  echo "    NPM_TOKEN=npm_xxxx ./scripts/fix-npm-dist-tags.sh ${STABLE_VERSION} ${BETA_VERSION}"
  echo ""
  exit 1
fi

echo "👤 npm 用户: $(npm_cmd whoami)"
echo ""

for pkg in "${PACKAGES[@]}"; do
  echo "📦 ${pkg}"
  npm_cmd dist-tag add "${pkg}@${STABLE_VERSION}" latest
  npm_cmd dist-tag add "${pkg}@${BETA_VERSION}" beta
done

echo ""
echo "✅ 完成。验证："
npm_cmd view nuwaxcode dist-tags
