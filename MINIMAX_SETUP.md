# MiniMax等三方Anthropic兼容服务环境变量配置

## 方法一：完全使用环境变量（推荐）

如果你设置了这些环境变量，Opencode会自动读取：

```bash
export ANTHROPIC_BASE_URL="https://api.minimaxi.com/anthropic"
export ANTHROPIC_AUTH_TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
export API_TIMEOUT_MS="3000000"
```

Opencode会自动检测并使用这些环境变量配置Anthropic provider。

## 方法二：配置文件 + 环境变量混合

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "anthropic": {
      "options": {
        "baseURL": "{env:ANTHROPIC_BASE_URL}",
        "apiKey": "{env:ANTHROPIC_AUTH_TOKEN}"
      }
    }
  },
  "model": "anthropic/claude-3-5-sonnet-20241022",
  "theme": "dark"
}
```

## 方法三：完全在配置文件中指定

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "anthropic": {
      "options": {
        "baseURL": "https://api.minimaxi.com/anthropic",
        "apiKey": "your-api-token-here"
      }
    }
  },
  "model": "anthropic/claude-3-5-sonnet-20241022"
}
```

## 支持的环境变量

- `ANTHROPIC_BASE_URL`: API endpoint地址
- `ANTHROPIC_AUTH_TOKEN`: 认证token
- `API_TIMEOUT_MS`: 请求超时时间（毫秒）
- `ANTHROPIC_MODEL`: 默认模型
- 任何 `{provider}_BASE_URL` 格式的环境变量（如 `OPENAI_BASE_URL` 等）

## 配置优先级

配置按以下顺序加载，后面的会覆盖前面的：
1. 环境变量（最低优先级）
2. Auth 认证配置（`opencode auth login` 保存的配置）
3. 配置文件（`opencode.jsonc`，最高优先级）

## 注意事项

1. `timeout` 会自动从 `API_TIMEOUT_MS` 环境变量读取
2. 支持所有 Anthropic 兼容的第三方服务（如 MiniMax、OpenRouter 等）
3. 使用 `opencode auth login` 命令时，可以为 Anthropic provider 配置自定义 baseURL
