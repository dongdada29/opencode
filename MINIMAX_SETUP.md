# MiniMax等三方Anthropic兼容服务环境变量配置

## 方法一：完全使用环境变量（推荐）

如果你设置了这些环境变量，MyOpenCode会自动读取：

```bash
export ANTHROPIC_BASE_URL="https://api.minimaxi.com/anthropic/v1"
export ANTHROPIC_AUTH_TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
export API_TIMEOUT_MS="3000000"

# 模型映射（可选，用于三方兼容服务）
export ANTHROPIC_DEFAULT_HAIKU_MODEL="MiniMax-M2"
export ANTHROPIC_DEFAULT_SONNET_MODEL="MiniMax-M2"
export ANTHROPIC_DEFAULT_OPUS_MODEL="MiniMax-M2"
export ANTHROPIC_MODEL="MiniMax-M2"  # 默认模型映射
```

MyOpenCode会自动检测并使用这些环境变量配置Anthropic provider。

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
        "baseURL": "https://api.minimaxi.com/anthropic/v1",
        "apiKey": "your-api-token-here",
        // 模型映射（可选）
        "defaultModel": "MiniMax-M2",
        "defaultHaikuModel": "MiniMax-M2",
        "defaultSonnetModel": "MiniMax-M2",
        "defaultOpusModel": "MiniMax-M2"
      },
      // 添加自定义模型到模型列表（这样可以在模型列表中看到）
      "models": {
        "MiniMax-M2": {
          "name": "MiniMax Claude兼容模型",
          "cost": {
            "input": 0.001,
            "output": 0.002
          },
          "limit": {
            "context": 200000,
            "output": 10000
          }
        }
      }
    }
  },
  "model": "anthropic/MiniMax-M2"
}
```

**注意**：
- 在 `models` 中定义的模型会出现在模型列表中（`myopencode models anthropic`）
- 模型映射功能（`defaultModel` 等）只在调用时生效，不会在列表中显示
- 如果只想使用模型映射而不在列表中显示，可以只配置 `options` 中的模型映射

## 支持的环境变量

### 基础配置
- `ANTHROPIC_BASE_URL`: API endpoint地址（也可以通过配置文件 `baseURL` 设置）
- `ANTHROPIC_AUTH_TOKEN`: 认证token（也可以通过 `ANTHROPIC_API_KEY` 或配置文件 `apiKey` 设置）
- `ANTHROPIC_API_KEY`: 认证key（与 `ANTHROPIC_AUTH_TOKEN` 等效）
- `API_TIMEOUT_MS`: 请求超时时间（毫秒）

### 模型映射（用于三方兼容服务）
- `ANTHROPIC_MODEL`: 默认模型映射（当请求的模型不匹配特定类型时使用）
- `ANTHROPIC_DEFAULT_HAIKU_MODEL`: Haiku 系列模型的映射（如 `claude-haiku-4-5` → `MiniMax-M2`）
- `ANTHROPIC_DEFAULT_SONNET_MODEL`: Sonnet 系列模型的映射（如 `claude-sonnet-4-5` → `MiniMax-M2`）
- `ANTHROPIC_DEFAULT_OPUS_MODEL`: Opus 系列模型的映射（如 `claude-opus-4` → `MiniMax-M2`）

### 其他
- 任何 `{provider}_BASE_URL` 格式的环境变量（如 `OPENAI_BASE_URL` 等）

## 配置优先级

配置按以下顺序加载，后面的会覆盖前面的：
1. 环境变量（最低优先级）
2. Auth 认证配置（`myopencode auth login` 保存的配置）
3. 配置文件（`myopencode.jsonc`，最高优先级）

### API URL 和 API Key 的配置方式

**API URL (baseURL)**：
- 环境变量：`ANTHROPIC_BASE_URL`
- 配置文件：`provider.anthropic.options.baseURL`
- Auth 配置：`myopencode auth login` 时设置

**API Key**：
- 环境变量：`ANTHROPIC_AUTH_TOKEN` 或 `ANTHROPIC_API_KEY`（两者等效）
- 配置文件：`provider.anthropic.options.apiKey`
- Auth 配置：`myopencode auth login` 时设置

## 注意事项

1. `timeout` 会自动从 `API_TIMEOUT_MS` 环境变量读取
2. 支持所有 Anthropic 兼容的第三方服务（如 MiniMax、OpenRouter 等）
3. 使用 `myopencode auth login` 命令时，可以为 Anthropic provider 配置自定义 baseURL
4. **模型映射**：当使用三方兼容服务时，可以通过环境变量或配置文件将标准 Claude 模型名称映射到实际使用的模型名称
   - 例如：请求 `claude-haiku-4-5` 时，如果设置了 `ANTHROPIC_DEFAULT_HAIKU_MODEL=MiniMax-M2`，实际会使用 `MiniMax-M2` 模型
   - 映射优先级：配置文件 > 环境变量
