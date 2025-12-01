#!/bin/bash
# ACP 环境变量测试脚本
# 此脚本用于测试 ACP 模式下的环境变量配置

set -e

echo "=== ACP 环境变量配置测试 ==="
echo ""

# 测试配置
TEST_DIR=$(mktemp -d)
trap "rm -rf $TEST_DIR" EXIT

cd $TEST_DIR

# 创建测试用的提示词文件
cat > custom-prompt.txt << 'EOF'
You are a test assistant for OpenCode.
This is a custom system prompt loaded from a file.
EOF

# 设置环境变量
export OPENCODE_PROVIDER_ANTHROPIC_BASE_URL="https://api.test.com/anthropic"
export OPENCODE_PROVIDER_ANTHROPIC_API_KEY="test-key-12345"
export OPENCODE_SYSTEM_PROMPT="$TEST_DIR/custom-prompt.txt"
export OPENCODE_USER_PROMPT_PREFIX="[TEST] "
export OPENCODE_USER_PROMPT_SUFFIX=" [/TEST]"
export OPENCODE_MCP_ENABLED="browser"
export OPENCODE_MCP_DISABLED="filesystem"

echo "测试环境变量配置:"
echo "  OPENCODE_PROVIDER_ANTHROPIC_BASE_URL=$OPENCODE_PROVIDER_ANTHROPIC_BASE_URL"
echo "  OPENCODE_PROVIDER_ANTHROPIC_API_KEY=${OPENCODE_PROVIDER_ANTHROPIC_API_KEY:0:10}..."
echo "  OPENCODE_SYSTEM_PROMPT=$OPENCODE_SYSTEM_PROMPT"
echo "  OPENCODE_USER_PROMPT_PREFIX=$OPENCODE_USER_PROMPT_PREFIX"
echo "  OPENCODE_USER_PROMPT_SUFFIX=$OPENCODE_USER_PROMPT_SUFFIX"
echo "  OPENCODE_MCP_ENABLED=$OPENCODE_MCP_ENABLED"
echo "  OPENCODE_MCP_DISABLED=$OPENCODE_MCP_DISABLED"
echo ""

# 验证环境变量
echo "验证环境变量..."
if [ -z "$OPENCODE_PROVIDER_ANTHROPIC_BASE_URL" ]; then
  echo "❌ OPENCODE_PROVIDER_ANTHROPIC_BASE_URL 未设置"
  exit 1
fi

if [ -z "$OPENCODE_PROVIDER_ANTHROPIC_API_KEY" ]; then
  echo "❌ OPENCODE_PROVIDER_ANTHROPIC_API_KEY 未设置"
  exit 1
fi

if [ ! -f "$OPENCODE_SYSTEM_PROMPT" ]; then
  echo "❌ 提示词文件不存在: $OPENCODE_SYSTEM_PROMPT"
  exit 1
fi

echo "✓ 所有环境变量配置正确"
echo ""

# 显示提示词文件内容
echo "提示词文件内容:"
cat "$OPENCODE_SYSTEM_PROMPT"
echo ""
echo ""

echo "✓ 测试完成！"
echo ""
echo "现在可以运行 'opencode acp' 来启动 ACP 服务器，"
echo "这些环境变量会在运行时自动应用。"

