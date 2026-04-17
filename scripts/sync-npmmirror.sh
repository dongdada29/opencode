#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# 对 nuwaxcode 主包及 npm 元数据中的全部 optional 平台子包，逐一触发 npmmirror 同步；
# 可选在镜像上校验指定版本是否已可安装。
#
# 接口：PUT https://registry.npmmirror.com/<包名>/sync
# 镜像页示例：https://npmmirror.com/package/nuwaxcode-darwin-x64
#
# 用法（在仓库根目录）：
#   ./scripts/sync-npmmirror.sh              # 同步主包 + 所有 optional 子包（按 npm 元数据）
#   ./scripts/sync-npmmirror.sh --dry      # 只打印将要发起的 PUT
#   ./scripts/sync-npmmirror.sh --check    # 不 PUT，仅在 npmmirror 上检查各包 version 是否存在
#
# 环境变量：
#   NPM_MIRROR_VERSION   版本号；未设置时读取 packages/opencode/package.json 的 version
#   NPM_MIRROR_REGISTRY  默认 https://registry.npmmirror.com
#
# 包名列表：优先 npm view nuwaxcode@<ver> optionalDependencies；若无或为空则回退本地 package.json。
# -----------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REG="${NPM_MIRROR_REGISTRY:-https://registry.npmmirror.com}"
cd "$ROOT"

MODE="sync"
while [[ "${1:-}" == -* ]]; do
  case "$1" in
    --dry) MODE="dry" ;;
    --check) MODE="check" ;;
    -h|--help)
      cat <<'EOF'
用法: ./scripts/sync-npmmirror.sh [--dry | --check]

  默认        对 nuwaxcode 及 npm 上该版本 optionalDependencies 中的每个包发起 npmmirror PUT .../sync
  --dry       只打印将要请求的 URL，不发起网络请求
  --check     在 npmmirror 上检查每个包是否已有当前版本（不发起同步）

环境变量:
  NPM_MIRROR_VERSION    未设置时使用 packages/opencode/package.json 的 version
  NPM_MIRROR_REGISTRY   默认 https://registry.npmmirror.com

包名来源: 优先 npm view nuwaxcode@<ver> optionalDependencies；失败则用本地 package.json。
EOF
      exit 0
      ;;
    *)
      echo "未知参数: $1（支持 --dry / --check）" >&2
      exit 2
      ;;
  esac
  shift
done

VER="${NPM_MIRROR_VERSION:-}"
if [[ -z "$VER" ]]; then
  VER="$(node -pe "require('./packages/opencode/package.json').version")"
fi

META="$(npm view "nuwaxcode@${VER}" optionalDependencies --json 2>/dev/null || echo "null")"
if [[ "$META" == "null" || "$META" == "{}" ]]; then
  echo "提示: 无法从 npm 读取 nuwaxcode@${VER} 的 optionalDependencies（可能未发布），改用本地 package.json。" >&2
  META="$(node -pe "JSON.stringify(require('./packages/opencode/package.json').optionalDependencies || {})")"
fi

# 合并包名：主包 + optional 里所有键（去重、排序）
export OPT_JSON="$META"
PACKAGES="$(node -e "
const o = JSON.parse(process.env.OPT_JSON || '{}');
const s = new Set(['nuwaxcode']);
for (const k of Object.keys(o)) s.add(k);
console.log([...s].sort().join('\\n'));
")"

COUNT="$(echo "$PACKAGES" | grep -c . || true)"
echo "版本: ${VER}  |  待处理包数: ${COUNT}  |  模式: ${MODE}"
echo "----------"

sync_one() {
  local pkg="$1"
  local url="${REG%/}/${pkg}/sync"
  case "$MODE" in
    dry)
      echo "PUT ${url}"
      ;;
    sync)
      printf '同步 %s ... ' "$pkg"
      if curl -fsS -X PUT "${url}" -o /tmp/npmsync-body.$$ 2>/dev/null; then
        echo "ok ($(tr -d '\n' < /tmp/npmsync-body.$$))"
      else
        echo "失败" >&2
        cat /tmp/npmsync-body.$$ >&2 2>/dev/null || true
        return 1
      fi
      rm -f /tmp/npmsync-body.$$
      sleep 0.2
      ;;
    check)
      local got
      got="$(npm view "${pkg}@${VER}" version --registry="${REG}" 2>/dev/null | tr -d '\r\n' || true)"
      if [[ "$got" == "$VER" ]]; then
        echo "OK   ${pkg}@${VER}"
      else
        echo "MISS ${pkg}@${VER}  (镜像返回: ${got:-无/404})" >&2
        return 1
      fi
      ;;
  esac
}

FAILED=0
while IFS= read -r pkg; do
  [[ -z "$pkg" ]] && continue
  if ! sync_one "$pkg"; then
    FAILED=1
  fi
done <<< "$PACKAGES"

if [[ "$FAILED" -ne 0 ]]; then
  echo "----------" >&2
  if [[ "$MODE" == "check" ]]; then
    echo "校验未全部通过：请在 npm 官方确认 tarball 已发布后执行 ./scripts/sync-npmmirror.sh，稍候再执行 --check。" >&2
  else
    echo "部分请求失败（见上文）。可稍后重试；若 npm 上该版本不存在，同步不会成功。" >&2
  fi
  exit 1
fi

echo "----------"
echo "完成。"
