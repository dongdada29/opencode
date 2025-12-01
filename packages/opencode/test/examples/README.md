# OpenCode 运行时环境变量功能测试示例

本目录包含用于测试和演示 OpenCode 运行时环境变量功能的示例脚本。

## 文件说明

### 1. `runtime-env-examples.sh`
展示所有运行时环境变量配置的完整示例脚本。

**使用方法:**
```bash
chmod +x test/examples/runtime-env-examples.sh
./test/examples/runtime-env-examples.sh
```

**功能:**
- Provider 配置示例（BASE_URL, API_KEY, MODELS）
- 提示词配置示例（SYSTEM_PROMPT, USER_PREFIX, USER_SUFFIX）
- MCP 工具控制示例（ENABLED, DISABLED）
- Browser MCP 配置示例

### 2. `acp-env-test.sh`
用于测试 ACP 模式下的环境变量配置的测试脚本。

**使用方法:**
```bash
chmod +x test/examples/acp-env-test.sh
./test/examples/acp-env-test.sh
```

**功能:**
- 创建测试环境
- 设置所有环境变量
- 验证配置正确性
- 显示配置信息

## 环境变量说明

### Provider 配置

```bash
# 设置 Provider Base URL
export OPENCODE_PROVIDER_{PROVIDER_ID}_BASE_URL="https://api.example.com"

# 设置 Provider API Key
export OPENCODE_PROVIDER_{PROVIDER_ID}_API_KEY="your-api-key"

# 设置可用模型列表（JSON 数组）
export OPENCODE_PROVIDER_{PROVIDER_ID}_MODELS='["model1", "model2"]'
```

**示例:**
```bash
export OPENCODE_PROVIDER_ANTHROPIC_BASE_URL="https://api.minimaxi.com/anthropic"
export OPENCODE_PROVIDER_ANTHROPIC_API_KEY="sk-xxx"
export OPENCODE_PROVIDER_ANTHROPIC_MODELS='["MiniMax-M2"]'
```

### 提示词配置

```bash
# 系统提示词（支持文件路径或直接文本）
export OPENCODE_SYSTEM_PROMPT="/path/to/prompt.txt"
# 或
export OPENCODE_SYSTEM_PROMPT="You are a helpful assistant."

# 用户提示词前缀
export OPENCODE_USER_PROMPT_PREFIX="[Context] "

# 用户提示词后缀
export OPENCODE_USER_PROMPT_SUFFIX=" [End]"
```

### MCP 工具控制

```bash
# 启用特定 MCP 工具（逗号分隔）
export OPENCODE_MCP_ENABLED="browser,github"

# 禁用特定 MCP 工具（逗号分隔）
export OPENCODE_MCP_DISABLED="filesystem,database"
```

### Browser MCP 配置

```bash
# 禁用 Browser MCP
export OPENCODE_BROWSER_MCP_DISABLED="true"

# 自定义 Browser MCP 命令
export OPENCODE_BROWSER_MCP_COMMAND="npx -y @chrome-devtools/mcp"

# Browser MCP 环境变量（JSON 格式）
export OPENCODE_BROWSER_MCP_ENV='{"CHROME_PATH": "/path/to/chrome"}'
```

## 测试场景

### 场景 1: 使用自定义 Provider
```bash
export OPENCODE_PROVIDER_ANTHROPIC_BASE_URL="https://api.custom.com/anthropic"
export OPENCODE_PROVIDER_ANTHROPIC_API_KEY="custom-key"
opencode acp
```

### 场景 2: 自定义提示词
```bash
export OPENCODE_SYSTEM_PROMPT="You are a Python expert."
export OPENCODE_USER_PROMPT_PREFIX="[Code Review] "
opencode acp
```

### 场景 3: 控制 MCP 工具
```bash
export OPENCODE_MCP_ENABLED="browser"
export OPENCODE_MCP_DISABLED="github,filesystem"
opencode acp
```

### 场景 4: 完整配置
```bash
# 加载所有配置
source test/examples/runtime-env-examples.sh

# 启动 ACP
opencode acp
```

## 在编辑器中使用

### Zed
```json
{
  "agent_servers": {
    "OpenCode": {
      "command": "opencode",
      "args": ["acp"],
      "env": {
        "OPENCODE_PROVIDER_ANTHROPIC_BASE_URL": "https://api.custom.com/anthropic",
        "OPENCODE_SYSTEM_PROMPT": "You are a coding assistant."
      }
    }
  }
}
```

### Avante.nvim
```lua
{
  acp_providers = {
    ["opencode"] = {
      command = "opencode",
      args = { "acp" },
      env = {
        OPENCODE_PROVIDER_ANTHROPIC_BASE_URL = "https://api.custom.com/anthropic",
        OPENCODE_SYSTEM_PROMPT = "You are a coding assistant."
      }
    }
  }
}
```

## 注意事项

1. **优先级**: 运行时环境变量 > 配置文件 > 默认值
2. **Provider ID**: 环境变量中的 Provider ID 需要转换为大写，特殊字符替换为下划线
   - `anthropic` → `ANTHROPIC`
   - `google-vertex` → `GOOGLE_VERTEX`
3. **文件路径**: `OPENCODE_SYSTEM_PROMPT` 支持绝对路径、相对路径和 `~` 开头的路径
4. **JSON 格式**: `MODELS` 和 `ENV` 环境变量必须是有效的 JSON 格式

## 故障排除

### 环境变量未生效
- 确保环境变量在启动 `opencode acp` 之前设置
- 检查环境变量名称是否正确（注意大小写和下划线）
- 验证 JSON 格式是否正确（对于 MODELS 和 ENV）

### 提示词文件未加载
- 检查文件路径是否正确
- 确保文件存在且有读取权限
- 尝试使用绝对路径

### MCP 工具未过滤
- 检查 MCP 工具名称是否正确（格式: `{mcpName}_{toolName}`）
- 确保环境变量中的名称与实际的 MCP 服务器名称匹配

