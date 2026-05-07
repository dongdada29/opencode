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

日志文件将按日期和时间生成，例如 `nuwaxcode_2026_01_22_132601_1gq4r9.log`。其命名规则为：`nuwaxcode_YYYY_MM_DD_HHmmss_随机后缀.log`。

### 核心日志事件一览表

以下是日志中常见的事件名称（Event Name）及其含义，便于快速检索：

| 分类 | 事件名称 (`Event`) | 含义与关键信息 |
| :--- | :--- | :--- |
| **System** | `system.env` | 系统启动时的完整环境变量快照（用于诊断环境差异）。<br>敏感信息（如 API Key, Token 等）已自动脱敏为 `******`。 |
| **Config** | `config.load` | 最终加载的完整配置对象 (已脱敏)。<br>包含了从文件、环境变量及默认值合并后的所有设置（如模型、键位映射等）。 |
| **ACP** | `acp.initialize` | ACP 协议初始化握手。<br>记录 `clientCapabilities`, `clientInfo` (客户端名称及版本，如 Zed)。 |
| | `acp.shutdown.success/error` | ACP 服务正常关闭或异常退出。<br>标志着连接周期的结束。 |
| | `acp.message.part` | **双向**消息/内容更新。<br>包含用户输入 (`text`)、模型生成 (`delta`)、快照信息 (`snapshot`) 及工具状态。 |
| | `acp.permission.result` | 权限请求结果。<br>记录 `permissionID`, `outcome` (allow/reject)。 |
| | `acp.tool.update` | 工具调用状态更新。<br>记录 `toolCallId`, `status` (pending/in_progress/completed/error)。 |
| **Session** | `session.create` / `.result` | 会话创建请求与结果。<br>记录 `sessionId`, `cwd`, 以及初始化的 `model` 配置。 |
| | `session.load` / `.result` | 会话加载请求与结果。<br>用于恢复旧会话。 |
| | `session.context` | 会话上下文详情。<br>包含 `systemPrompt`, `model`, `mcpServers` 等完整上下文快照。 |
| **LLM** | `llm.prompt` | 发送给 LLM 的完整提示词消息数组。<br>包含 System Prompt、对话历史及工具调用结果。 |
| | `llm.config` | 当前 LLM 请求的配置参数。<br>记录 `provider`, `model`, `temperature` 以及其他 API 特定参数。 |
| **MCP** | `mcp.tool.execute` / `mcp.stderr` | MCP 工具执行。记录工具名称、参数、耗时以及標準错误输出。<br>`mcp.stderr` 对调试自定义 MCP Server 极其关键。 |
| **Skill** | `skill.load` / `skill.execute` | 技能（Skill）的加载与执行事件。<br>记录技能路径、名称以及执行时的参数。 |
| **Performance** | `provider.state` | 核心 Provider 状态初始化耗时。 |
| | `provider.getSDK` | 动态加载 Provider SDK 耗时。 |
| | `plugin.load` | 插件（Plugin）加载耗时（包含 `bun install` 和导入过程）。 |
| | `bun.run` / `bun.install` | 内部执行 Bun 命令或安装依赖的详细信息及耗时。 |

### 日志内容示例

```text
[2026-01-20T08:50:48.712Z] INFO  llm.prompt content="You are an interactive CLI tool..."

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


## 上下文限制配置 (max_context_tokens)

除了输出限制，您还可以配置 `max_context_tokens` 来限制模型的上下文窗口大小 (Context Window)。这对于使用代理或自定义模型时非常有用，可以强制截断过长的上下文，避免超出模型限制。

配置优先级：Model Options > Provider Options > Environment Variable > Default

### 示例配置

```json
{
  "provider": {
    "openai-compatible": {
      "options": {
        "max_context_tokens": 16000 // 为该 provider 的所有模型设置上下文上限
      },
      "models": {
        "deepseek-chat": {
            "options": {
                "max_context_tokens": 32000 // 仅为该模型设置上下文上限，覆盖 provider 设置
            }
        }
      }
    }
  }
}
```

## Token 限制配置 (max_tokens)

对于 `openai-compatible` 和 `anthropic-compatible` 等自定义模型，您可以通过配置文件覆盖默认的 Token 输出限制。默认情况下，系统使用 4096 作为输出后的最大 token 数限制，您可以通过 `options.max_tokens` 来修改此值。

### 示例配置

修改 `~/.config/opencode/opencode.json`：

```json
{
  "provider": {
    "openai-compatible": {
      "options": {
        "max_tokens": 16000
      }
    },
    "anthropic-compatible": {
      "options": {
        "max_tokens": 8000
      }
    }
  }
}
```

配置后，相应 Provider 的所有模型输出上限将更新为您指定的值。

### 使用环境变量配置 (推荐用于 Docker/CI)

您也可以通过环境变量来设置全局或特定 Provider 的 max_tokens，优先级低于 `opencode.json` 配置。

| 环境变量                      | 说明                                        |
| :---------------------------- | :------------------------------------------ |
| `OPENCODE_MAX_TOKENS`         | 全局最大 Token 限制 (所有自定义 Provider)   |
| `OPENCODE_MAX_CONTEXT_TOKENS` | 全局上下文窗口限制 (所有自定义 Provider)    |

**示例：**

```bash
export OPENCODE_MAX_TOKENS=12000
nuwaxcode run "hello"
```


