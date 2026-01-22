# Nuwaxcode 配置指南

## 安装

首先，请通过 npm 全局安装 Nuwaxcode：

```bash
npm install -g nuwaxcode@latest
```

## ACP Meta 配置

Nuwaxcode 支持通过 ACP (Agent Client Protocol) 的 `_meta` 字段传入额外的会话配置信息。

### 自定义 System Prompt

仿照 `claude-code` 的模式，您可以在初始化 Session 时通过 `_meta` 传递 `systemPrompt`。这允许客户端动态设定 Agent 的人设或上下文。

**示例 (JSON RPC):**

```json
{
  "method": "session/new",
  "params": {
    "_meta": {
      "systemPrompt": "你是 Nuwaxcode，一个强大的 AI 编程助手。请在回答前仔细思考..."
    }
  }
}
```

Nuwaxcode 会提取该字段并将其作为 System Prompt 注入到底层 LLM 的上下文中。

---

## 全局权限配置 (禁用工具)

您可以通过全局配置文件或环境变量来精细控制工具的权限。例如，如果您希望禁用 Agent 的联网能力 (`websearch`, `webfetch`)，可以使用以下配置。

### 方式一：配置文件 (推荐)

在 **项目根目录** 或 **用户全局配置目录** (`~/.config/opencode/`) 下创建或编辑 `opencode.json`：

```json
{
  "permission": {
    "websearch": "deny",
    "webfetch": "deny"
  }
}
```

配置生效后，Agent 将无法调用被拒绝 (`deny`) 的工具。

### 方式二：环境变量

您也可以在启动服务时通过设置环境变量 `OPENCODE_PERMISSION` 来注入权限配置：

```bash
export OPENCODE_PERMISSION='{"websearch":"deny","webfetch":"deny"}'
```

### 支持的权限选项

`permission` 对象支持对所有注册工具的控制，常用的包括：

- `websearch`: 联网搜索
- `webfetch`: 获取网页内容
- `bash`: 执行 Shell 命令
- `edit`: 文件编辑 (包括 write, patch 等)
- `read`: 文件读取

可选值：

- `"allow"`: 允许 (默认)
- `"deny"`: 拒绝 (禁用)
- `"ask"`: 询问用户 (CLI 交互模式下有效)

---

## Zed 编辑器调试配置

要在 Zed 中使用并调试 Nuwaxcode，请修改 Zed 的配置文件 (`cmd+,` 打开 `settings.json`)。

### 1. 配置 Agent Server

添加 `nuwaxcode` 到 `agent_servers`：

**示例 1：智谱 GLM-4 (Anthropic 兼容协议)**

```json
{
  "agent_servers": {
    "nuwaxcode": {
      "type": "custom",
      "command": "nuwaxcode",
      "args": ["acp"],
      "env": {
        "OPENCODE_MODEL": "anthropic-compatible/glm-4.7",
        "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic",
        "ANTHROPIC_API_KEY": "sk-...",
        "OPENCODE_LOG_DIR": "/path/to/logs/"
      },
      "favorite_models": [],
      "default_config_options": {},
      "favorite_config_option_values": {}
    }
  }
}
```

**示例 2：智谱 GLM-4 (OpenAI 兼容协议)**

```json
{
  "agent_servers": {
    "nuwaxcode": {
      "type": "custom",
      "command": "nuwaxcode",
      "args": ["acp"],
      "env": {
        "OPENCODE_MODEL": "openai-compatible/glm-4.7",
        "OPENAI_BASE_URL": "https://open.bigmodel.cn/api/paas/v4/",
        "OPENAI_API_KEY": "sk-...",
        "OPENCODE_LOG_DIR": "/path/to/logs/"
      },
      "favorite_models": [],
      "default_config_options": {},
      "favorite_config_option_values": {}
    }
  }
}
```

> 注意：请确保 `nuwaxcode` 已在您的 PATH 环境中。

### 2. 查看调试日志

Nuwaxcode (Opencode) 的日志默认存储在 XDG 数据目录中。在 macOS/Linux 上通常位于 `~/.local/share/opencode/log/`。

您可以在终端中实时监控日志以进行调试：

```bash
# 查看实时日志
tail -f ~/.local/share/opencode/log/nuwaxcode.log
```

如果遇到连接问题或 Agent 行为异常，日志通常会包含详细的错误堆栈和运行状态信息。

---

## 可观测性与日志参考

为了方便调试、审计和性能分析，Nuwaxcode 提供了详细的结构化日志（Structured Logging）。日志文件默认以 `key=value` 的形式记录，关键字段采用 JSON 格式以保留层级结构。

### 启用日志

#### 方式一：CLI 参数

在启动 CLI 时，使用 `--log-dir` 参数指定日志存储目录：

```bash
nuwaxcode run "hello" --log-dir ./logs
```

#### 方式二：环境变量 (默认配置)

设置环境变量 `OPENCODE_LOG_DIR`：

```bash
export OPENCODE_LOG_DIR="./logs"
nuwaxcode run "hello"
```

日志文件将按日期生成，例如 `nuwaxcode_2026_01_20.log`。

### 核心日志事件一览表

以下是日志中常见的事件名称（Event Name）及其含义，便于快速检索：

| 分类 | 事件名称 (`Event`) | 含义与关键信息 |
| :--- | :--- | :--- |
| **System** | `system.env` | 系统启动时的完整环境变量快照。<br>敏感信息（如 API Key, Token 等）已自动脱敏为 `******`。 |
| **Config** | `config.load` | 最终加载的完整配置对象 (已过滤敏感信息)。<br>包含了从文件、默认值合并后的所有设置。 |
| **ACP** | `acp.initialize` | ACP 协议初始化握手。<br>记录 `clientCapabilities`, `clientInfo` 等客户端信息。 |
| | `acp.shutdown.success/error` | ACP 服务正常关闭或异常退出。<br>标志着连接周期的结束。 |
| | `acp.message.part` | **双向**消息/内容更新。<br>包含**用户输入**与**模型生成**的实时增量及工具状态。 |
| | `acp.permission.result` | 权限请求结果。<br>记录 `permissionID`, `outcome` (allow/reject)。 |
| | `acp.tool.update` | 工具调用状态更新。<br>记录 `toolCallId`, `status` (pending/in_progress/completed/error)。 |
| **Session** | `session.create` | 发起会话创建请求。<br>记录 `sessionId`, `cwd`, `mcpServers` (MCP 服务数量)。 |
| | `session.create.result` | 会话创建成功。<br>记录最终的 Session State 对象。 |
| | `session.load` / `.result` | 会话加载请求与结果。<br>用于恢复旧会话。 |
| | `session.context` | 会话上下文详情。<br>包含完整的 `systemPrompt`, `model` 配置, `cwd` 等。 |
| **LLM** | `llm.prompt` | 发送给 LLM 的完整提示词。<br>字段：`content` (完整文本)。 |
| | `llm.config` | 当前 LLM 请求的配置参数。<br>字段：`provider`, `model`, `temperature`, `options`。 |
| **MCP** | `mcp.tool.execute` | MCP 工具执行详情。<br>字段：`tool` (名称), `args` (参数), `duration` (耗时), `status` (started/completed)。 |
| | `mcp.stderr` | 本地 MCP 服务的标准错误输出 (stderr)。<br>用于捕获工具内部崩溃或调试信息。 |
| **Skill** | `skill.load` | 技能加载事件。<br>字段：`name` (技能名), `location` (定义文件路径)。 |
| | `skill.execute` | 技能执行事件。<br>字段：`name`, `dir` (运行目录)。 |
| **Performance** | `provider.state` | 核心 Provider 状态初始化。<br>关键耗时点，包含所有 Provider 的发现与合并。 |
| | `provider.getSDK` | 动态加载特定 Provider SDK。<br>可能涉及 `bun install` 耗时。 |
| | `plugin.load` | 插件加载耗时。<br>包含插件安装与导入过程。 |
| | `bun.install` | 依赖安装耗时。<br>底层依赖包的下载与安装。 |

### 日志内容示例

```text
[2026-01-20T08:50:48.712Z] INFO  llm.prompt content="You are opencode, an interactive CLI tool..."

[2026-01-20T08:50:48.713Z] INFO  llm.config provider=opencode model=big-pickle temperature=N/A options={"reasoningEffort":"minimal"}

[2026-01-20T08:50:48.715Z] INFO  system.env PATH=/usr/bin:/bin NODE_ENV=development ...

[2026-01-20T08:51:12.334Z] INFO  mcp.tool.execute status=completed duration=150ms tool=list_files
```

---

## 模型连接配置 (环境变量)

Nuwaxcode 支持通过环境变量配置默认的模型连接参数，方便在不同环境（如 Docker、CI/CD）中快速切换。

| 环境变量         | 说明                                       | 示例            |
| :--------------- | :----------------------------------------- | :-------------- |
| `OPENCODE_MODEL` | 默认此模型 ID。当 CLI 未指定 `-m` 时生效。 | `openai/gpt-4o` |

### OpenAI 及其兼容协议 (OpenAI, DeepSeek, Ollama, openai-compatible 等)

| 环境变量                   | 说明                     | 示例                          |
| :------------------------- | :----------------------- | :---------------------------- |
| `OPENCODE_OPENAI_API_BASE` | OpenAI 兼容接口 Base URL | `https://api.deepseek.com/v1` |
| `OPENCODE_OPENAI_API_KEY`  | API Key                  | `sk-proj-...`                 |

> **多种环境变量名支持**
>
> 为了兼容不同的使用习惯和第三方工具，以下环境变量名互相等效（按优先级排序，靠前的优先级更高）：
>
> | 配置项   | 支持的环境变量名（按优先级）                                         |
> | :------- | :------------------------------------------------------------------- |
> | Base URL | `OPENCODE_OPENAI_API_BASE` > `OPENCODE_API_BASE` > `OPENAI_BASE_URL` |
> | API Key  | `OPENCODE_OPENAI_API_KEY` > `OPENCODE_API_KEY` > `OPENAI_API_KEY`    |

**示例场景：使用 openai-compatible 连接 DeepSeek**

```bash
# 使用任意一种环境变量名均可
export OPENCODE_MODEL="openai-compatible/deepseek-chat"
export OPENAI_BASE_URL="https://api.deepseek.com/v1"   # 或 OPENCODE_OPENAI_API_BASE
export OPENAI_API_KEY="sk-..."                         # 或 OPENCODE_OPENAI_API_KEY

nuwaxcode run "Hello DeepSeek"
```

### Anthropic 及其兼容协议 (Claude, GLM-4 等)

| 环境变量                      | 说明                        | 示例                        |
| :---------------------------- | :-------------------------- | :-------------------------- |
| `OPENCODE_ANTHROPIC_API_BASE` | Anthropic 兼容接口 Base URL | `https://your-proxy.com/v1` |
| `OPENCODE_ANTHROPIC_API_KEY`  | API Key                     | `sk-ant-...`                |

> **多种环境变量名支持**
>
> 为了兼容不同的使用习惯和第三方工具，以下环境变量名互相等效（按优先级排序，靠前的优先级更高）：
>
> | 配置项   | 支持的环境变量名（按优先级）                                               |
> | :------- | :------------------------------------------------------------------------- |
> | Base URL | `OPENCODE_ANTHROPIC_API_BASE` > `OPENCODE_API_BASE` > `ANTHROPIC_BASE_URL` |
> | API Key  | `OPENCODE_ANTHROPIC_API_KEY` > `OPENCODE_API_KEY` > `ANTHROPIC_API_KEY`    |
>
> ⚠️ **注意**: Anthropic 环境变量与 OpenAI 环境变量是独立的。例如，使用 `anthropic-compatible` 模型时，会优先读取 `OPENCODE_ANTHROPIC_*` 或 `ANTHROPIC_*` 系列变量，不会使用 `OPENAI_*` 变量。

**示例场景：连接智谱 GLM-4 (Anthropic 兼容模式)**

```bash
# 使用任意一种环境变量名均可
export OPENCODE_MODEL="anthropic-compatible/glm-4.7"
export ANTHROPIC_BASE_URL="https://open.bigmodel.cn/api/anthropic"  # 或 OPENCODE_ANTHROPIC_API_BASE
export ANTHROPIC_API_KEY="your_api_key"                             # 或 OPENCODE_ANTHROPIC_API_KEY

nuwaxcode run "Hello GLM"
```
