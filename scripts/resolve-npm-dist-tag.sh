#!/usr/bin/env bash
# 根据 semver 版本号解析 npm dist-tag。
# 预发布版本（含 '-'，如 1.3.0-beta.8）默认使用 beta，稳定版使用 latest。
# 若已设置 NPM_DIST_TAG 环境变量，则优先使用该值。
#
# Usage:
#   ./scripts/resolve-npm-dist-tag.sh <version>
#   NPM_DIST_TAG=custom ./scripts/resolve-npm-dist-tag.sh <version>
set -euo pipefail

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/resolve-npm-dist-tag.sh <version>" >&2
  exit 1
fi

if [ -n "${NPM_DIST_TAG:-}" ]; then
  echo "$NPM_DIST_TAG"
  exit 0
fi

# semver 预发布标识：主版本号后带 '-'（如 1.3.0-beta.8、1.0.0-rc.1）
if [[ "$VERSION" == *-* ]]; then
  echo "beta"
else
  echo "latest"
fi
