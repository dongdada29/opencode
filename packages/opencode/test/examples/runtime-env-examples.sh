#!/bin/bash
# 运行时环境变量配置示例脚本
# 此脚本展示了如何使用环境变量动态配置 OpenCode

set -e

echo "=== OpenCode 运行时环境变量配置示例 ==="
echo ""

# ============================================
# 1. Provider 配置示例
# ============================================
echo "1. Provider 运行时配置示例"
echo "---------------------------"

# 配置 Anthropic Provider
export OPENCODE_PROVIDER_ANTHROPIC_BASE_URL="https://api.minimaxi.com/anthropic"
export OPENCODE_PROVIDER_ANTHROPIC_API_KEY="your-api-key-here"
export OPENCODE_PROVIDER_ANTHROPIC_MODELS='["MiniMax-M2", "MiniMax-M3"]'

echo "✓ 已设置 Anthropic Provider 配置:"
echo "  - BASE_URL: $OPENCODE_PROVIDER_ANTHROPIC_BASE_URL"
echo "  - API_KEY: ${OPENCODE_PROVIDER_ANTHROPIC_API_KEY:0:10}..."
echo "  - MODELS: $OPENCODE_PROVIDER_ANTHROPIC_MODELS"
echo ""

# 配置 OpenAI Provider
export OPENCODE_PROVIDER_OPENAI_BASE_URL="https://api.openai-custom.com/v1"
export OPENCODE_PROVIDER_OPENAI_API_KEY="sk-custom-key"

echo "✓ 已设置 OpenAI Provider 配置:"
echo "  - BASE_URL: $OPENCODE_PROVIDER_OPENAI_BASE_URL"
echo "  - API_KEY: ${OPENCODE_PROVIDER_OPENAI_API_KEY:0:10}..."
echo ""

# ============================================
# 2. 提示词配置示例
# ============================================
echo "2. 提示词运行时配置示例"
echo "---------------------------"

# 方式 1: 直接文本
export OPENCODE_SYSTEM_PROMPT="You are a specialized Python coding assistant. Always write clean, documented code."

# 方式 2: 文件路径
# export OPENCODE_SYSTEM_PROMPT="/path/to/custom-prompt.txt"
# 或使用 ~ 路径
# export OPENCODE_SYSTEM_PROMPT="~/custom-prompts/python-assistant.txt"

export OPENCODE_USER_PROMPT_PREFIX="[Project Context] "
export OPENCODE_USER_PROMPT_SUFFIX=" [End Context]"

echo "✓ 已设置提示词配置:"
echo "  - SYSTEM_PROMPT: ${OPENCODE_SYSTEM_PROMPT:0:50}..."
echo "  - USER_PREFIX: $OPENCODE_USER_PROMPT_PREFIX"
echo "  - USER_SUFFIX: $OPENCODE_USER_PROMPT_SUFFIX"
echo ""

# ============================================
# 3. MCP 工具控制示例
# ============================================
echo "3. MCP 工具运行时控制示例"
echo "---------------------------"

# 启用特定的 MCP 工具
export OPENCODE_MCP_ENABLED="browser,github,filesystem"

# 禁用特定的 MCP 工具
export OPENCODE_MCP_DISABLED="database,redis"

echo "✓ 已设置 MCP 工具控制:"
echo "  - ENABLED: $OPENCODE_MCP_ENABLED"
echo "  - DISABLED: $OPENCODE_MCP_DISABLED"
echo ""

# ============================================
# 4. Browser MCP 配置示例
# ============================================
echo "4. Browser MCP 配置示例"
echo "---------------------------"

# 禁用 Browser MCP
# export OPENCODE_BROWSER_MCP_DISABLED="true"

# 使用自定义命令
export OPENCODE_BROWSER_MCP_COMMAND="npx -y @chrome-devtools/mcp"

# 设置环境变量（JSON 格式）
export OPENCODE_BROWSER_MCP_ENV='{"CHROME_PATH": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "HEADLESS": "false"}'

echo "✓ 已设置 Browser MCP 配置:"
echo "  - COMMAND: $OPENCODE_BROWSER_MCP_COMMAND"
echo "  - ENV: $OPENCODE_BROWSER_MCP_ENV"
echo ""

# ============================================
# 5. 启动 OpenCode ACP 服务器
# ============================================
echo "5. 启动 OpenCode ACP 服务器"
echo "---------------------------"
echo ""
echo "现在可以使用以下命令启动 OpenCode ACP 服务器："
echo ""
echo "  opencode acp"
echo ""
echo "或者在编辑器配置中使用："
echo ""
echo "  Zed (settings.json):"
echo "  {"
echo "    \"agent_servers\": {"
echo "      \"OpenCode\": {"
echo "        \"command\": \"opencode\","
echo "        \"args\": [\"acp\"]"
echo "      }"
echo "    }"
echo "  }"
echo ""
echo "环境变量会在运行时自动应用！"
echo ""

