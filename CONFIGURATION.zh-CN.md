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
