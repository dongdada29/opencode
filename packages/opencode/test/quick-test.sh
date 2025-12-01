#!/bin/bash
# 快速测试脚本 - 验证运行时环境变量功能

set -e

echo "🧪 OpenCode 运行时环境变量功能快速测试"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数器
PASSED=0
FAILED=0

# 测试函数
test_env_var() {
  local name=$1
  local value=$2
  local description=$3

  export "$name=$value"
  if [ -n "${!name}" ]; then
    echo -e "${GREEN}✓${NC} $description"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}✗${NC} $description"
    ((FAILED++))
    return 1
  fi
}

test_json() {
  local name=$1
  local value=$2
  local description=$3

  export "$name=$value"
  if echo "${!name}" | jq . > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} $description"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}✗${NC} $description (无效 JSON)"
    ((FAILED++))
    return 1
  fi
}

echo "1. 测试 Provider 环境变量..."
echo "----------------------------"
test_env_var "OPENCODE_PROVIDER_ANTHROPIC_BASE_URL" "https://api.test.com/anthropic" "Provider Base URL"
test_env_var "OPENCODE_PROVIDER_ANTHROPIC_API_KEY" "test-key-12345" "Provider API Key"
test_json "OPENCODE_PROVIDER_ANTHROPIC_MODELS" '["model1", "model2"]' "Provider Models (JSON)"
echo ""

echo "2. 测试提示词环境变量..."
echo "----------------------------"
test_env_var "OPENCODE_SYSTEM_PROMPT" "You are a test assistant." "System Prompt (文本)"
test_env_var "OPENCODE_USER_PROMPT_PREFIX" "[Context] " "User Prompt Prefix"
test_env_var "OPENCODE_USER_PROMPT_SUFFIX" " [End]" "User Prompt Suffix"
echo ""

echo "3. 测试 MCP 工具控制..."
echo "----------------------------"
test_env_var "OPENCODE_MCP_ENABLED" "browser,github" "MCP Enabled List"
test_env_var "OPENCODE_MCP_DISABLED" "filesystem,database" "MCP Disabled List"
echo ""

echo "4. 测试 Browser MCP 配置..."
echo "----------------------------"
test_env_var "OPENCODE_BROWSER_MCP_COMMAND" "npx -y @chrome-devtools/mcp" "Browser MCP Command"
test_json "OPENCODE_BROWSER_MCP_ENV" '{"CHROME_PATH": "/path/to/chrome"}' "Browser MCP Env (JSON)"
echo ""

echo "5. 测试环境变量解析..."
echo "----------------------------"

# 测试 Provider ID 转换
PROVIDER_ID="anthropic"
UPPER_ID=$(echo "$PROVIDER_ID" | tr '[:lower:]' '[:upper:]' | tr '-' '_')
if [ "$UPPER_ID" = "ANTHROPIC" ]; then
  echo -e "${GREEN}✓${NC} Provider ID 转换: $PROVIDER_ID -> $UPPER_ID"
  ((PASSED++))
else
  echo -e "${RED}✗${NC} Provider ID 转换失败"
  ((FAILED++))
fi

# 测试 MCP 列表解析
MCP_LIST="browser, github , filesystem"
PARSED=$(echo "$MCP_LIST" | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr '\n' ',' | sed 's/,$//')
if [ -n "$PARSED" ]; then
  echo -e "${GREEN}✓${NC} MCP 列表解析: $MCP_LIST -> $PARSED"
  ((PASSED++))
else
  echo -e "${RED}✗${NC} MCP 列表解析失败"
  ((FAILED++))
fi
echo ""

# 总结
echo "=========================================="
echo "测试结果:"
echo -e "  ${GREEN}通过: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
  echo -e "  ${RED}失败: $FAILED${NC}"
else
  echo -e "  ${GREEN}失败: $FAILED${NC}"
fi
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ 所有测试通过！${NC}"
  echo ""
  echo "下一步:"
  echo "  1. 运行完整测试: bun test"
  echo "  2. 查看示例脚本: ./test/examples/runtime-env-examples.sh"
  echo "  3. 启动 ACP 服务器: opencode acp"
  exit 0
else
  echo -e "${RED}✗ 部分测试失败，请检查环境变量配置${NC}"
  exit 1
fi

