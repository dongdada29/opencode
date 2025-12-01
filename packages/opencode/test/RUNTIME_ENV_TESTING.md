# 运行时环境变量功能测试指南

本文档描述了如何测试 OpenCode 的运行时环境变量功能。

## 测试文件结构

```
test/
├── provider/
│   └── runtime-env.test.ts          # Provider 运行时环境变量测试
├── session/
│   └── prompt-env.test.ts          # 提示词环境变量测试
├── mcp/
│   └── runtime-control.test.ts      # MCP 工具控制测试
└── examples/
    ├── runtime-env-examples.sh      # 配置示例脚本
    ├── acp-env-test.sh              # ACP 环境变量测试脚本
    └── README.md                    # 示例说明文档
```

## 运行测试

### 运行所有测试
```bash
cd packages/opencode
bun test
```

### 运行特定测试文件
```bash
# Provider 环境变量测试
bun test test/provider/runtime-env.test.ts

# 提示词环境变量测试
bun test test/session/prompt-env.test.ts

# MCP 控制测试
bun test test/mcp/runtime-control.test.ts
```

### 运行示例脚本
```bash
# 查看配置示例
./test/examples/runtime-env-examples.sh

# 运行 ACP 环境变量测试
./test/examples/acp-env-test.sh
```

## 测试用例说明

### 1. Provider 运行时环境变量测试 (`runtime-env.test.ts`)

**测试内容:**
- ✅ 解析 Provider Base URL 环境变量
- ✅ 解析 Provider API Key 环境变量
- ✅ 解析 Provider Models 环境变量（JSON 格式）
- ✅ 处理无效 JSON 格式
- ✅ 支持不同 Provider ID

**环境变量格式:**
```bash
OPENCODE_PROVIDER_{PROVIDER_ID}_BASE_URL
OPENCODE_PROVIDER_{PROVIDER_ID}_API_KEY
OPENCODE_PROVIDER_{PROVIDER_ID}_MODELS
```

**示例:**
```bash
export OPENCODE_PROVIDER_ANTHROPIC_BASE_URL="https://api.custom.com/anthropic"
export OPENCODE_PROVIDER_ANTHROPIC_API_KEY="test-key"
export OPENCODE_PROVIDER_ANTHROPIC_MODELS='["model1", "model2"]'
```

### 2. 提示词环境变量测试 (`prompt-env.test.ts`)

**测试内容:**
- ✅ 从环境变量读取系统提示词（文本）
- ✅ 从文件路径读取系统提示词
- ✅ 处理 `~` 开头的路径
- ✅ 处理未设置的环境变量
- ✅ 用户提示词前缀/后缀

**环境变量:**
```bash
OPENCODE_SYSTEM_PROMPT          # 系统提示词（文件路径或文本）
OPENCODE_USER_PROMPT_PREFIX     # 用户提示词前缀
OPENCODE_USER_PROMPT_SUFFIX     # 用户提示词后缀
```

**示例:**
```bash
# 方式 1: 直接文本
export OPENCODE_SYSTEM_PROMPT="You are a coding assistant."

# 方式 2: 文件路径
export OPENCODE_SYSTEM_PROMPT="/path/to/prompt.txt"

# 用户提示词修饰
export OPENCODE_USER_PROMPT_PREFIX="[Context] "
export OPENCODE_USER_PROMPT_SUFFIX=" [End]"
```

### 3. MCP 工具控制测试 (`runtime-control.test.ts`)

**测试内容:**
- ✅ 解析 MCP 启用列表
- ✅ 解析 MCP 禁用列表
- ✅ 处理空列表
- ✅ 去除空白字符
- ✅ Browser MCP 配置

**环境变量:**
```bash
OPENCODE_MCP_ENABLED            # 启用的 MCP 工具（逗号分隔）
OPENCODE_MCP_DISABLED           # 禁用的 MCP 工具（逗号分隔）
OPENCODE_BROWSER_MCP_DISABLED   # 禁用 Browser MCP
OPENCODE_BROWSER_MCP_COMMAND    # 自定义 Browser MCP 命令
OPENCODE_BROWSER_MCP_ENV        # Browser MCP 环境变量（JSON）
```

**示例:**
```bash
export OPENCODE_MCP_ENABLED="browser,github"
export OPENCODE_MCP_DISABLED="filesystem,database"
export OPENCODE_BROWSER_MCP_COMMAND="npx -y @chrome-devtools/mcp"
export OPENCODE_BROWSER_MCP_ENV='{"CHROME_PATH": "/path/to/chrome"}'
```

## 集成测试场景

### 场景 1: 完整配置测试

```bash
# 设置所有环境变量
export OPENCODE_PROVIDER_ANTHROPIC_BASE_URL="https://api.test.com/anthropic"
export OPENCODE_PROVIDER_ANTHROPIC_API_KEY="test-key"
export OPENCODE_SYSTEM_PROMPT="You are a test assistant."
export OPENCODE_USER_PROMPT_PREFIX="[TEST] "
export OPENCODE_MCP_ENABLED="browser"
export OPENCODE_BROWSER_MCP_DISABLED="false"

# 启动 ACP 服务器
opencode acp
```

### 场景 2: 文件路径提示词测试

```bash
# 创建提示词文件
cat > /tmp/test-prompt.txt << 'EOF'
You are a specialized Python assistant.
Always write clean, documented code.
EOF

# 设置环境变量
export OPENCODE_SYSTEM_PROMPT="/tmp/test-prompt.txt"

# 启动 ACP
opencode acp
```

### 场景 3: MCP 工具过滤测试

```bash
# 只启用 Browser MCP
export OPENCODE_MCP_ENABLED="browser"
export OPENCODE_MCP_DISABLED="github,filesystem"

# 启动 ACP
opencode acp
```

## 验证测试结果

### 1. 检查环境变量是否被读取

在代码中添加日志或使用调试工具验证环境变量是否被正确读取：

```typescript
// 在 provider.ts 的 parseRuntimeEnvConfig 中添加日志
console.log("Runtime env config:", envOptions)
```

### 2. 检查 Provider 配置是否应用

启动 ACP 后，检查 Provider 的 options 是否包含环境变量中的值。

### 3. 检查提示词是否替换

发送一个 prompt，检查系统提示词是否使用了环境变量中的值。

### 4. 检查 MCP 工具是否过滤

列出可用的工具，验证只有启用的 MCP 工具出现。

## 常见问题

### Q: 环境变量未生效？
A: 确保环境变量在启动 `opencode acp` 之前设置，并且变量名格式正确。

### Q: JSON 解析失败？
A: 检查 JSON 格式是否正确，特别是 `MODELS` 和 `ENV` 环境变量。

### Q: 文件路径未找到？
A: 使用绝对路径，或确保相对路径相对于当前工作目录。

### Q: MCP 工具未过滤？
A: 检查工具名称格式，应该是 `{mcpName}_{toolName}`。

## 测试覆盖率

当前测试覆盖：
- ✅ Provider 环境变量解析
- ✅ 提示词环境变量解析（文本和文件）
- ✅ MCP 工具控制
- ✅ Browser MCP 配置
- ✅ 错误处理（无效 JSON、文件不存在等）

待补充测试：
- ⏳ 实际 Provider SDK 创建时的环境变量应用
- ⏳ 实际提示词解析时的环境变量应用
- ⏳ 实际 MCP 工具过滤时的环境变量应用
- ⏳ ACP 会话创建时的环境变量读取

## 贡献

添加新测试时，请遵循以下原则：
1. 使用 `describe` 和 `test` 组织测试
2. 使用 `beforeEach` 和 `afterEach` 清理环境变量
3. 使用 `tmpdir` fixture 创建临时目录
4. 添加清晰的测试描述
5. 测试正常情况和边界情况

