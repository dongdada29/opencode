<!-- ce4fd839-dfb5-4d7f-90bd-ffefff121ef1 41fe0036-7ec0-46ff-8313-5566da818fb9 -->
# ACP SDK 增强与 Browser MCP 集成开发计划

## 一、已实现功能分析

### 1. ACP SDK 支持 ✅

- **位置**: `packages/opencode/src/acp/`
- **实现**: 完整的 ACP 协议实现，包括：
- `agent.ts`: ACP Agent 接口实现
- `session.ts`: 会话管理
- `server.ts`: 服务器启动
- `client.ts`: 客户端能力
- **命令**: `opencode acp` 已可用
- **状态**: 完全实现，符合 ACP v1 规范

### 2. 环境变量配置 API URL 和 Key ✅ (部分)

- **位置**: `packages/opencode/src/provider/provider.ts` (519-552行)
- **已支持**:
- `ANTHROPIC_BASE_URL`: 支持三方兼容服务 baseURL
- `{PROVIDER}_BASE_URL`: 通用 provider baseURL 环境变量
- `API_TIMEOUT_MS`: 超时配置
- Provider 的 `env` 字段支持从环境变量读取 API Key
- **限制**: 配置在启动时加载，不是完全运行时动态

### 3. 提示词动态替换 ❌

- **位置**: `packages/opencode/src/session/system.ts`
- **现状**: 提示词从静态文件加载，不支持环境变量替换
- **需要**: 运行时通过环境变量动态替换系统提示词和用户提示词

### 4. MCP 工具动态启用/禁用 ❌

- **位置**: `packages/opencode/src/mcp/index.ts`
- **现状**: MCP 工具在配置加载时初始化，不支持会话级别的动态控制
- **需要**: 在 new session 时通过环境变量控制 MCP 工具的启用/禁用

### 5. Browser MCP 工具 ❌

- **现状**: 未实现内置 Browser MCP 工具
- **需要**: 集成 `@modelcontextprotocol/server-browser` 或类似实现

---

## 二、需要实现的功能

### 功能 1: 运行时环境变量动态配置 API URL、Key 和模型列表

**目标**: 支持在运行时通过环境变量动态覆盖 provider 配置

**实现方案**:

1. **修改 Provider 状态管理** (`packages/opencode/src/provider/provider.ts`)

- 在 `state()` 函数中添加运行时环境变量检查
- 优先级: 运行时环境变量 > 配置文件 > 默认值
- 支持环境变量:
 - `OPENCODE_PROVIDER_{PROVIDER_ID}_BASE_URL`
 - `OPENCODE_PROVIDER_{PROVIDER_ID}_API_KEY`
 - `OPENCODE_PROVIDER_{PROVIDER_ID}_MODELS` (JSON 格式模型列表)

2. **修改 ACP Agent** (`packages/opencode/src/acp/agent.ts`)

- 在 `newSession` 时读取环境变量并应用到 provider 配置
- 确保每个会话可以有不同的 provider 配置

**文件修改**:

- `packages/opencode/src/provider/provider.ts`: 添加运行时环境变量解析
- `packages/opencode/src/acp/agent.ts`: 在会话创建时应用环境变量配置

---

### 功能 2: 运行时环境变量动态替换提示词

**目标**: 支持通过环境变量在运行时替换系统提示词和用户提示词

**实现方案**:

1. **修改 SystemPrompt** (`packages/opencode/src/session/system.ts`)

- 添加环境变量检查:
 - `OPENCODE_SYSTEM_PROMPT`: 替换系统提示词
 - `OPENCODE_USER_PROMPT_PREFIX`: 用户提示词前缀
 - `OPENCODE_USER_PROMPT_SUFFIX`: 用户提示词后缀
- 在 `resolveSystemPrompt` 中优先使用环境变量

2. **修改 SessionPrompt** (`packages/opencode/src/session/prompt.ts`)

- 在 `resolveSystemPrompt` 函数中检查环境变量
- 支持文件路径或直接文本内容

3. **ACP 集成** (`packages/opencode/src/acp/agent.ts`)

- 在 `prompt` 方法中应用环境变量提示词

**文件修改**:

- `packages/opencode/src/session/system.ts`: 添加环境变量提示词支持
- `packages/opencode/src/session/prompt.ts`: 集成环境变量提示词解析

---

### 功能 3: 运行时环境变量控制 MCP 工具启用/禁用

**目标**: 在创建新会话时通过环境变量动态控制 MCP 工具的启用/禁用

**实现方案**:

1. **修改 MCP 状态管理** (`packages/opencode/src/mcp/index.ts`)

- 添加会话级别的 MCP 工具过滤
- 支持环境变量: `OPENCODE_MCP_ENABLED` (逗号分隔的 MCP 名称列表)
- 支持环境变量: `OPENCODE_MCP_DISABLED` (逗号分隔的 MCP 名称列表)

2. **修改 ACP Session** (`packages/opencode/src/acp/session.ts`)

- 在 `create` 方法中读取环境变量
- 将 MCP 启用/禁用状态存储在会话状态中

3. **修改工具解析** (`packages/opencode/src/session/prompt.ts`)

- 在 `resolveTools` 中根据会话状态过滤 MCP 工具

**文件修改**:

- `packages/opencode/src/mcp/index.ts`: 添加会话级别 MCP 控制
- `packages/opencode/src/acp/session.ts`: 存储会话 MCP 配置
- `packages/opencode/src/session/prompt.ts`: 应用 MCP 过滤

---

### 功能 4: 内置 Browser MCP 工具实现

**目标**: 集成 Browser MCP 工具，支持在 Subagent 任务中使用浏览器功能

**实现方案**:

1. **安装依赖**

- 添加 `@modelcontextprotocol/server-browser` 或使用 Chrome DevTools MCP
- 参考: https://github.com/ChromeDevTools/chrome-devtools-mcp

2. **创建 Browser MCP 包装器** (`packages/opencode/src/mcp/browser.ts`)

- 实现 Browser MCP 客户端连接
- 封装浏览器操作工具（navigate, click, type, snapshot 等）

3. **集成到 MCP 系统** (`packages/opencode/src/mcp/index.ts`)

- 将 Browser MCP 作为内置 MCP 服务器
- 默认启用，可通过配置禁用

4. **Subagent 支持** (`packages/opencode/src/tool/task.ts`)

- 确保 Browser MCP 工具在 subagent 任务中可用

**文件创建/修改**:

- `packages/opencode/src/mcp/browser.ts`: Browser MCP 实现（新建）
- `packages/opencode/src/mcp/index.ts`: 集成 Browser MCP
- `packages/opencode/package.json`: 添加依赖

---

## 三、实施优先级

1. **P0 (必须)**: 功能 1 - 运行时环境变量配置 API
2. **P0 (必须)**: 功能 2 - 运行时提示词替换
3. **P1 (重要)**: 功能 3 - MCP 工具动态控制
4. **P1 (重要)**: 功能 4 - Browser MCP 工具集成

---

## 四、技术细节

### 环境变量命名规范

- Provider 配置: `OPENCODE_PROVIDER_{PROVIDER_ID}_{CONFIG_KEY}`
- 提示词: `OPENCODE_SYSTEM_PROMPT`, `OPENCODE_USER_PROMPT_PREFIX/SUFFIX`
- MCP 控制: `OPENCODE_MCP_ENABLED`, `OPENCODE_MCP_DISABLED`

### 配置优先级

1. 运行时环境变量（最高优先级）
2. 会话级别配置
3. 配置文件
4. 默认值（最低优先级）

### Browser MCP 集成方式

- 使用 `@modelcontextprotocol/server-browser` 或直接集成 Chrome DevTools MCP
- 作为内置工具，无需用户配置即可使用
- 支持通过环境变量或配置禁用

---

## 五、测试计划

1. **单元测试**: 各功能模块的独立测试
2. **集成测试**: ACP 会话创建和工具调用测试
3. **端到端测试**: 完整流程测试（环境变量 -> 配置应用 -> 工具调用）

---

## 六、文档更新

1. 更新 ACP 文档，说明环境变量配置方式
2. 添加 Browser MCP 工具使用文档
3. 更新配置示例文件

### To-dos

- [ ] 实现运行时环境变量动态配置 Provider API URL、Key 和模型列表 - 修改 provider.ts 添加运行时环境变量解析，修改 acp/agent.ts 在会话创建时应用配置
- [ ] 实现运行时环境变量动态替换系统提示词和用户提示词 - 修改 system.ts 和 prompt.ts 支持环境变量提示词
- [ ] 实现运行时环境变量控制 MCP 工具启用/禁用 - 修改 mcp/index.ts 添加会话级别控制，修改 acp/session.ts 存储配置，修改 prompt.ts 应用过滤
- [ ] 集成内置 Browser MCP 工具 - 创建 browser.ts，集成到 mcp/index.ts，确保 subagent 支持
- [ ] 编写单元测试、集成测试和端到端测试
- [ ] 更新文档：ACP 环境变量配置、Browser MCP 使用说明、配置示例