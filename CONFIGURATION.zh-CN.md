# Nuwaxcode 配置指南

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

### 1. 配置 Context Server

添加 `nuwaxcode` 到 `context_servers`：

```json
{
  "context_servers": {
    "nuwaxcode": {
      "command": "nuwaxcode",
      "args": ["acp"]
    }
  }
}
```

> 注意：请确保 `nuwaxcode` 已在您的 PATH 环境中。如果未安装到 PATH，请使用绝对路径，例如 `/Users/yourname/.bun/bin/nuwaxcode`。

### 2. 查看调试日志

Nuwaxcode (Opencode) 的日志默认存储在 XDG 数据目录中。在 macOS/Linux 上通常位于 `~/.local/share/opencode/log/`。

您可以在终端中实时监控日志以进行调试：

```bash
# 查看实时日志
tail -f ~/.local/share/opencode/log/nuwaxcode.log
```

如果遇到连接问题或 Agent 行为异常，日志通常会包含详细的错误堆栈和运行状态信息。

---

## System Prompt 与 模型配置日志

为了方便调试和审计，Nuwaxcode 支持将完整的 System Prompt（系统提示词）和当前生效的 Model Configuration（模型配置）记录到本地日志文件中。

### 启用方式

#### 方式一：CLI 参数

在启动 CLI 时，使用 `--log-dir` 参数指定日志存储目录：

```bash
nuwaxcode run "hello" --log-dir ./logs
```

#### 方式二：环境变量 (默认配置)

如果希望默认开启日志并指定目录，可以设置环境变量 `OPENCODE_LOG_DIR`：

```bash
export OPENCODE_LOG_DIR="./logs"
nuwaxcode run "hello"
```

### 日志文件

日志文件将按日期生成，例如 `nuwaxcode_2026_01_20.log`。

### 日志内容示例

日志中将包含以下关键信息：

1.  **System Prompt**: 完整的系统提示词，包含所有注入的上下文和规则。
2.  **Model Configuration**: 当前调用的模型参数（Provider, Model ID, Temperature 等）。

```text
[2026-01-20T08:50:48.712Z] System Prompt:
You are opencode, an interactive CLI tool ...
...

[2026-01-20T08:50:48.713Z] Model Configuration:
Provider: opencode
Model: big-pickle
Temperature: N/A
TopP: N/A
TopK: N/A
Options: {
  "reasoningEffort": "minimal"
}
```
