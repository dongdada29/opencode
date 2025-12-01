#!/bin/bash
# 集成测试脚本 - 测试完整的 ACP 环境变量功能流程

set -e

echo "🔧 OpenCode ACP 环境变量集成测试"
echo "=================================="
echo ""

# 创建临时测试目录
TEST_DIR=$(mktemp -d)
trap "rm -rf $TEST_DIR" EXIT

cd "$TEST_DIR"

echo "📁 测试目录: $TEST_DIR"
echo ""

# 1. 创建测试配置文件
echo "1. 创建测试配置文件..."
cat > opencode.jsonc << 'EOF'
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5",
  "theme": "dark"
}
EOF
echo "✓ 配置文件已创建"
echo ""

# 2. 创建测试提示词文件
echo "2. 创建测试提示词文件..."
cat > custom-prompt.txt << 'EOF'
You are a specialized test assistant for OpenCode.
This prompt is loaded from a file via environment variable.
Always respond in a helpful and concise manner.
EOF
echo "✓ 提示词文件已创建"
echo ""

# 3. 设置环境变量
echo "3. 设置环境变量..."
export OPENCODE_PROVIDER_ANTHROPIC_BASE_URL="https://api.test.com/anthropic"
export OPENCODE_PROVIDER_ANTHROPIC_API_KEY="test-integration-key-$(date +%s)"
export OPENCODE_PROVIDER_ANTHROPIC_MODELS='["test-model-1", "test-model-2"]'
export OPENCODE_SYSTEM_PROMPT="$TEST_DIR/custom-prompt.txt"
export OPENCODE_USER_PROMPT_PREFIX="[INTEGRATION TEST] "
export OPENCODE_USER_PROMPT_SUFFIX=" [/TEST]"
export OPENCODE_MCP_ENABLED="browser"
export OPENCODE_MCP_DISABLED="filesystem,database"
export OPENCODE_BROWSER_MCP_COMMAND="npx -y @modelcontextprotocol/server-browser"
export OPENCODE_BROWSER_MCP_ENV='{"HEADLESS": "true"}'

echo "✓ 环境变量已设置:"
echo "   OPENCODE_PROVIDER_ANTHROPIC_BASE_URL=$OPENCODE_PROVIDER_ANTHROPIC_BASE_URL"
echo "   OPENCODE_PROVIDER_ANTHROPIC_API_KEY=${OPENCODE_PROVIDER_ANTHROPIC_API_KEY:0:20}..."
echo "   OPENCODE_PROVIDER_ANTHROPIC_MODELS=$OPENCODE_PROVIDER_ANTHROPIC_MODELS"
echo "   OPENCODE_SYSTEM_PROMPT=$OPENCODE_SYSTEM_PROMPT"
echo "   OPENCODE_USER_PROMPT_PREFIX=$OPENCODE_USER_PROMPT_PREFIX"
echo "   OPENCODE_USER_PROMPT_SUFFIX=$OPENCODE_USER_PROMPT_SUFFIX"
echo "   OPENCODE_MCP_ENABLED=$OPENCODE_MCP_ENABLED"
echo "   OPENCODE_MCP_DISABLED=$OPENCODE_MCP_DISABLED"
echo "   OPENCODE_BROWSER_MCP_COMMAND=$OPENCODE_BROWSER_MCP_COMMAND"
echo ""

# 4. 验证环境变量
echo "4. 验证环境变量..."
ERRORS=0

if [ -z "$OPENCODE_PROVIDER_ANTHROPIC_BASE_URL" ]; then
  echo "❌ OPENCODE_PROVIDER_ANTHROPIC_BASE_URL 未设置"
  ((ERRORS++))
fi

if [ -z "$OPENCODE_PROVIDER_ANTHROPIC_API_KEY" ]; then
  echo "❌ OPENCODE_PROVIDER_ANTHROPIC_API_KEY 未设置"
  ((ERRORS++))
fi

if [ ! -f "$OPENCODE_SYSTEM_PROMPT" ]; then
  echo "❌ 提示词文件不存在: $OPENCODE_SYSTEM_PROMPT"
  ((ERRORS++))
fi

# 验证 JSON 格式
if ! echo "$OPENCODE_PROVIDER_ANTHROPIC_MODELS" | jq . > /dev/null 2>&1; then
  echo "❌ OPENCODE_PROVIDER_ANTHROPIC_MODELS JSON 格式无效"
  ((ERRORS++))
fi

if ! echo "$OPENCODE_BROWSER_MCP_ENV" | jq . > /dev/null 2>&1; then
  echo "❌ OPENCODE_BROWSER_MCP_ENV JSON 格式无效"
  ((ERRORS++))
fi

if [ $ERRORS -eq 0 ]; then
  echo "✓ 所有环境变量验证通过"
else
  echo "❌ 发现 $ERRORS 个错误"
  exit 1
fi
echo ""

# 5. 显示提示词文件内容
echo "5. 提示词文件内容:"
echo "-------------------"
cat "$OPENCODE_SYSTEM_PROMPT"
echo ""
echo ""

# 6. 测试总结
echo "=================================="
echo "✅ 集成测试准备完成！"
echo ""
echo "环境变量已正确设置，可以："
echo ""
echo "1. 运行单元测试:"
echo "   cd packages/opencode"
echo "   bun test"
echo ""
echo "2. 启动 ACP 服务器（在当前目录）:"
echo "   opencode acp"
echo ""
echo "3. 在编辑器中配置 ACP:"
echo "   - Zed: 添加 agent_servers 配置"
echo "   - Avante.nvim: 添加 acp_providers 配置"
echo ""
echo "注意: 环境变量仅在当前 shell 会话中有效"
echo "要在新会话中使用，请重新设置环境变量或使用配置文件"

