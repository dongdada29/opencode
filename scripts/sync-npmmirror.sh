#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# 仅触发 npmmirror 从 npm 官方源拉取「主包」nuwaxcode 的最新元数据与 tarball（一次同步任务）。
#
# 接口：PUT https://registry.npmmirror.com/<name>/sync
# 镜像站：https://npmmirror.com/package/nuwaxcode
#
# 用法（在仓库根目录）：
#   ./scripts/sync-npmmirror.sh
#   ./scripts/sync-npmmirror.sh --dry    # 只打印将要请求的 URL，不发送请求
#
# 可选环境变量：
#   NPM_MIRROR_PACKAGE   默认 nuwaxcode
#   NPM_MIRROR_REGISTRY  默认 https://registry.npmmirror.com
#
# 说明：平台二进制子包（nuwaxcode-linux-x64 等）是独立包名；若也需要尽快进镜像，
#       需对各自包名再发同步（本脚本按你的要求只同步主包 latest 链路）。
# -----------------------------------------------------------------------------
set -euo pipefail

PKG="${NPM_MIRROR_PACKAGE:-nuwaxcode}"
REG="${NPM_MIRROR_REGISTRY:-https://registry.npmmirror.com}"
URL="${REG%/}/${PKG}/sync"

if [[ "${1:-}" == "--dry" ]]; then
  echo "PUT ${URL}"
  exit 0
fi

# -f：HTTP 4xx/5xx 视为失败；-sS：静默进度、保留错误体
curl -fsS -X PUT "${URL}"
echo
