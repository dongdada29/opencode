# 测试文件总结

本文档总结了为运行时环境变量功能创建的所有测试文件和示例脚本。

## 📁 测试文件列表

### 单元测试文件

1. **`test/provider/runtime-env.test.ts`**
   - Provider 运行时环境变量测试
   - 测试 Base URL、API Key、Models 配置
   - 测试不同 Provider ID 支持
   - 测试错误处理（无效 JSON）

2. **`test/session/prompt-env.test.ts`**
   - 系统提示词环境变量测试
   - 测试文本和文件路径两种方式
   - 测试用户提示词前缀/后缀
   - 测试文件路径处理（包括 ~ 路径）

3. **`test/mcp/runtime-control.test.ts`**
   - MCP 工具控制测试
   - 测试启用/禁用列表解析
   - 测试 Browser MCP 配置
   - 测试环境变量 JSON 解析

### 示例脚本

1. **`test/examples/runtime-env-examples.sh`**
   - 完整的配置示例脚本
   - 展示所有环境变量的使用方法
   - 包含详细的使用说明

2. **`test/examples/acp-env-test.sh`**
   - ACP 环境变量测试脚本
   - 创建测试环境
   - 验证配置正确性

3. **`test/examples/integration-test.sh`**
   - 集成测试脚本
   - 完整的测试流程
   - 环境变量验证

4. **`test/quick-test.sh`**
   - 快速验证脚本
   - 快速检查环境变量功能
   - 彩色输出，易于阅读

### 文档

1. **`test/examples/README.md`**
   - 示例脚本使用说明
   - 环境变量详细说明
   - 使用场景和故障排除

2. **`test/RUNTIME_ENV_TESTING.md`**
   - 完整的测试指南
   - 测试用例说明
   - 集成测试场景

3. **`test/TEST_SUMMARY.md`** (本文件)
   - 测试文件总结

## 🚀 快速开始

### 运行所有测试
```bash
cd packages/opencode
bun test
```

### 快速验证
```bash
./test/quick-test.sh
```

### 查看配置示例
```bash
./test/examples/runtime-env-examples.sh
```

### 运行集成测试
```bash
./test/examples/integration-test.sh
```

## 📊 测试覆盖率

### ✅ 已覆盖

- [x] Provider 环境变量解析
- [x] Provider Base URL 配置
- [x] Provider API Key 配置
- [x] Provider Models 配置（JSON）
- [x] 系统提示词环境变量（文本）
- [x] 系统提示词环境变量（文件）
- [x] 用户提示词前缀/后缀
- [x] MCP 工具启用列表
- [x] MCP 工具禁用列表
- [x] Browser MCP 配置
- [x] 错误处理（无效 JSON、文件不存在）

### ⏳ 待补充（需要实际运行环境）

- [ ] 实际 Provider SDK 创建时的环境变量应用
- [ ] 实际提示词解析时的环境变量应用
- [ ] 实际 MCP 工具过滤时的环境变量应用
- [ ] ACP 会话创建时的环境变量读取
- [ ] 端到端测试（完整流程）

## 🧪 测试场景

### 场景 1: 基础配置测试
```bash
export OPENCODE_PROVIDER_ANTHROPIC_BASE_URL="https://api.test.com"
export OPENCODE_PROVIDER_ANTHROPIC_API_KEY="test-key"
opencode acp
```

### 场景 2: 提示词文件测试
```bash
export OPENCODE_SYSTEM_PROMPT="/path/to/prompt.txt"
export OPENCODE_USER_PROMPT_PREFIX="[Context] "
opencode acp
```

### 场景 3: MCP 工具控制测试
```bash
export OPENCODE_MCP_ENABLED="browser"
export OPENCODE_MCP_DISABLED="github,filesystem"
opencode acp
```

### 场景 4: 完整配置测试
```bash
source test/examples/runtime-env-examples.sh
opencode acp
```

## 📝 测试最佳实践

1. **清理环境**: 每个测试前后清理环境变量
2. **使用临时目录**: 使用 `tmpdir` fixture 创建临时文件
3. **验证结果**: 不仅测试设置，还要验证实际应用
4. **错误处理**: 测试正常情况和边界情况
5. **文档说明**: 为每个测试添加清晰的描述

## 🔍 调试技巧

### 查看环境变量
```bash
env | grep OPENCODE
```

### 验证 JSON 格式
```bash
echo "$OPENCODE_PROVIDER_ANTHROPIC_MODELS" | jq .
```

### 检查文件路径
```bash
ls -la "$OPENCODE_SYSTEM_PROMPT"
```

### 运行单个测试
```bash
bun test test/provider/runtime-env.test.ts
```

## 📚 相关文档

- [运行时环境变量测试指南](./RUNTIME_ENV_TESTING.md)
- [示例脚本说明](./examples/README.md)
- [ACP 文档](../../../packages/web/src/content/docs/acp.mdx)
- [MCP 服务器文档](../../../packages/web/src/content/docs/mcp-servers.mdx)

## 🤝 贡献

添加新测试时：
1. 遵循现有测试风格
2. 添加清晰的测试描述
3. 更新本文档
4. 确保所有测试通过

