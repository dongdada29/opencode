# plugin.init 性能优化 - 移除 npm 安装延迟

**日期**: 2026-03-28
**影响版本**: nuwaxcode 1.1.64+
**优化效果**: 首次聊天请求从 11s 降到 5s (-55%)

---

## 问题背景

NuwaClaw 应用首次聊天请求耗时 12549ms，其中 `plugin.init` 占用 5428ms（59%）。

### 性能分析

| 阶段 | 耗时 | 占比 |
|------|------|------|
| ACP 握手 (plugin.init) | 7392ms | 59% |
| 会话创建 (MCP 连接) | 5146ms | 41% |

**plugin.init 耗时分解**：
```
opencode-anthropic-auth@0.0.9  install: 1450ms
@gitlab/opencode-gitlab-auth@1.3.0  install: 2427ms
─────────────────────────────────────────────────
总计: ~3900ms (占 plugin.init 的 72%)
```

### 根因

每次引擎启动时，通过 `bun add` 从 npm 安装两个 BUILTIN 认证插件。

---

## 解决方案

### 方案 A：将 BUILTIN 插件改为 INTERNAL_PLUGINS（已实施）

**原理**：将 `opencode-anthropic-auth` 和 `@gitlab/opencode-gitlab-auth` 的源码直接复制到 nuwaxcode 中，像 `CodexAuthPlugin` 一样作为内部插件。

### 修改文件

1. **`src/plugin/anthropic.ts`** (新建)
   - 从 `opencode-anthropic-auth` npm 包转换
   - 使用 `@openauthjs/openauth/pkce` 进行 PKCE 认证
   - 支持 Claude Pro/Max OAuth 和 API Key 创建

2. **`src/plugin/gitlab.ts`** (新建)
   - 从 `@gitlab/opencode-gitlab-auth` npm 包转换
   - 使用 `Bun.serve` 替代 Fastify（避免额外依赖）
   - 支持 GitLab OAuth 和 Personal Access Token

3. **`src/plugin/index.ts`** (修改)
   ```typescript
   // 删除
   // const BUILTIN = ["opencode-anthropic-auth@0.0.9", "@gitlab/opencode-gitlab-auth@1.3.0"]

   // 添加导入
   import { AnthropicAuthPlugin } from "./anthropic"
   import { GitLabAuthPlugin } from "./gitlab"

   // 修改 INTERNAL_PLUGINS
   const INTERNAL_PLUGINS: PluginInstance[] = [
     CodexAuthPlugin,
     CopilotAuthPlugin,
     AnthropicAuthPlugin,
     GitLabAuthPlugin
   ]
   ```

---

## 技术细节

### TypeScript 类型适配

原始 npm 包使用 JavaScript，转换时需要正确处理类型：

```typescript
// 定义回调结果类型
type AuthCallbackResult =
  | { type: "failed" }
  | { type: "success"; provider?: string; refresh: string; access: string; expires: number }
  | { type: "success"; provider?: string; key: string }

// authorize 函数签名
async authorize(_inputs?: Record<string, string>): Promise<AuthOuathResult>
```

### GitLab 插件：Bun.serve 替代 Fastify

```typescript
// 原始（Fastify）
import fastify from "fastify"
const app = fastify()
app.get("/callback", async (req, reply) => { ... })
await app.listen({ port: OAUTH_PORT })

// 修改后（Bun.serve）
oauthServer = Bun.serve({
  port: OAUTH_PORT,
  fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === "/callback") {
      // 处理回调
      return new Response(HTML_SUCCESS, { headers: { "Content-Type": "text/html" } })
    }
    return new Response("Not found", { status: 404 })
  },
})
```

---

## macOS 代码签名问题

### 现象

复制新构建的二进制到 `~/.nuwaclaw/node_modules/nuwaxcode-darwin-arm64/bin/` 后，运行时收到 SIGKILL。

### 原因

macOS 代码签名验证机制会拒绝未正确签名的二进制文件。即使源文件有 adhoc 签名，复制后可能失效。

### 解决方案

复制后重新签名：

```bash
codesign --force --sign - /path/to/nuwaxcode
```

### CI/CD 建议

在构建流程中确保二进制被正确签名，或在 Electron 端安装逻辑中添加签名步骤。

---

## 优化效果

### 性能对比

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| engine.getOrCreate | 5615ms | 1783ms | **-68%** |
| acp.session.create | 5464ms | 3255ms | **-40%** |
| 总请求耗时 | 11086ms | 5044ms | **-55%** |

### 详细日志

**优化前** (10:24:25):
```
[PERF] engine.getOrCreate: 5615ms  project=1560772
[PERF] acp.session.create: 5464ms  mcpCount=1
[PERF] /chat: 11086ms
```

**优化后** (10:44:43):
```
[PERF] acp.init.handshake: 1779ms  engine=nuwaxcode
[PERF] engine.getOrCreate: 1783ms  project=1560796
[PERF] acp.session.create: 3255ms  mcpCount=1
[PERF] /chat: 5044ms
```

---

## 维护注意事项

1. **插件更新**：如果 Anthropic 或 GitLab 更改 OAuth 流程，需要同步更新 `anthropic.ts` 和 `gitlab.ts`

2. **依赖管理**：
   - `@openauthjs/openauth` 已在 package.json 中
   - GitLab 插件使用 Bun 内置能力，无额外依赖

3. **忽略旧插件**：`plugin/index.ts` 中已添加过滤逻辑，避免用户配置中的旧 npm 包被重复安装

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `src/plugin/index.ts` | 插件系统入口 |
| `src/plugin/anthropic.ts` | Anthropic OAuth 认证 |
| `src/plugin/gitlab.ts` | GitLab OAuth 认证 |
| `src/plugin/codex.ts` | 内部插件参考示例 |
| `src/bun/index.ts` | BunProc.install 实现 |

---

## 参考

- 原始计划：`~/.claude/plans/witty-tumbling-ripple.md`
- npm 包：`opencode-anthropic-auth@0.0.9`, `@gitlab/opencode-gitlab-auth@1.3.0`
