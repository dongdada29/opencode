#!/bin/bash

# MyOpenCode 开发环境脚本
# 自动设置 Anthropic 环境变量并运行 myopencode

# 设置 Anthropic 环境变量
export ANTHROPIC_AUTH_TOKEN=""
export ANTHROPIC_BASE_URL="https://api.minimaxi.com/anthropic/v1"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="MiniMax-M2"
export ANTHROPIC_DEFAULT_OPUS_MODEL="MiniMax-M2"
export ANTHROPIC_DEFAULT_SONNET_MODEL="MiniMax-M2"
export ANTHROPIC_MODEL="MiniMax-M2"
export API_TIMEOUT_MS="300000"
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 切换到项目根目录
cd "$SCRIPT_DIR" || exit 1

# 运行 myopencode（使用 bun dev）
bun dev "$@"

