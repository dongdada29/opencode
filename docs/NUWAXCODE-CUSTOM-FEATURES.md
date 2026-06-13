# nuwaxcode 自定义功能清单

> 相对于 opencode 官方 (anomalyco/opencode dev 分支) 的所有差异
> 更新于 2026-06-13，基于 v1.17.4 合并

---

## 1. Sandbox 安全模块（10 文件，全部自建）

沙箱环境下的路径隔离、工具权限控制、bash 命令守卫。

| 文件 | 说明 |
|------|------|
| `packages/opencode/src/sandbox/bash-helper.ts` | Bash 命令沙箱辅助 |
| `packages/opencode/src/sandbox/env.ts` | 解析 `NUWAX_AGENT_SANDBOX_CONFIG` 环境变量 |
| `packages/opencode/src/sandbox/error.ts` | 沙箱错误类型（`SandboxPathError`） |
| `packages/opencode/src/sandbox/index.ts` | 沙箱入口，导出所有子模块 |
| `packages/opencode/src/sandbox/path.ts` | 路径隔离：`resolveWritableRoots`、`isPathWritable` |
| `packages/opencode/src/sandbox/policy-sync.ts` | 同步沙箱策略（非 Effect 版） |
| `packages/opencode/src/sandbox/policy.ts` | Effect 版沙箱策略，`getSandboxPolicySync` |
| `packages/opencode/src/sandbox/tool-guard.ts` | 工具调用前的路径权限守卫 |
| `packages/opencode/src/config/sandbox.ts` | `Info` 类型定义（`sandbox_mode`, `writable_roots`） |
| `packages/opencode/script/verify-sandbox.ts` | 沙箱验证脚本 |
| `packages/opencode/test/sandbox/path.test.ts` | 路径测试 |
| `packages/opencode/test/sandbox/policy.test.ts` | 策略测试 |
| `packages/opencode/test/config/sandbox-schema.test.ts` | Schema 测试 |

## 2. ACP 系统提示（3 文件修改 + 1 新建）

通过 `_meta.systemPrompt` 在 ACP session 创建时传入自定义系统提示。

**数据流**：客户端 → `_meta.systemPrompt = { append: "..." }` → `newSession` 提取 → session state → `prompt` 传给 SDK

| 文件 | 类型 | 说明 |
|------|------|------|
| `packages/opencode/src/acp/types.ts` | 新建 | `ACPSystemPromptMeta` 类型（`string \| { append: string }`） |
| `packages/opencode/src/acp/session.ts` | 修改 | `Info` / `StoreInput` 加 `systemPrompt` 字段 |
| `packages/opencode/src/acp/service.ts` | 修改 | `newSession` 提取 `_meta`；`prompt` 传递 `system` 给 SDK |

## 3. 自定义系统提示词（9 文件修改）

`packages/opencode/src/session/prompt/` 下的提示词文件：

| 文件 | 说明 |
|------|------|
| `anthropic.txt` | Anthropic 模型专用 |
| `beast.txt` | Beast 模式 |
| `codex.txt` | Codex 模型专用 |
| `copilot-gpt-5.txt` | Copilot GPT-5 专用 |
| `default.txt` | 默认提示词 |
| `gemini.txt` | Gemini 模型专用 |
| `gpt.txt` | GPT 模型专用 |
| `kimi.txt` | Kimi 模型专用 |
| `trinity.txt` | Trinity 模型专用 |

## 4. 模型 & Provider 自定义（4 文件新建）

| 文件 | 说明 |
|------|------|
| `packages/opencode/src/provider/models-source.ts` | 自定义模型源加载逻辑 |
| `packages/opencode/src/provider/models.ts` | 自定义模型列表 |
| `packages/opencode/src/provider/schema.ts` | `ProviderID` / `ModelID` branded types |
| `packages/opencode/src/provider/index.ts` | Provider barrel re-export |

## 5. 实例 & 工具模块（2 文件新建/恢复）

| 文件 | 说明 |
|------|------|
| `packages/opencode/src/project/instance.ts` | `Instance` 对象（上游已删除），从 ALS context 暴露 `directory` / `worktree` |
| `packages/opencode/src/util/effect-zod.ts` | Effect-Zod schema 桥接 |

## 6. Barrel 文件（4 文件新建/恢复）

上游删除了 barrel re-exports，我们保留以支持旧 import 路径：

| 文件 | 说明 |
|------|------|
| `packages/opencode/src/config/index.ts` | Config barrel（re-export 所有 config 子模块） |
| `packages/opencode/src/util/index.ts` | Util barrel |
| `packages/opencode/src/util/log.ts` | 日志模块（上游迁移到 Effect services） |
| `packages/opencode/src/util/schema.ts` | Schema 工具 |

## 7. CI/CD & 发布脚本（11 文件）

| 文件 | 说明 |
|------|------|
| `.github/workflows/build-release.yml` | 标签触发（`v[0-9]*`）的全平台构建发布 |
| `.github/workflows/beta.yml` | 每小时自动同步 beta |
| `.github/workflows/publish.yml` | npm 发布工作流 |
| `release.sh` | 本地全量发版脚本 |
| `scripts/release-publish.sh` | npm 发布段脚本 |
| `scripts/sync-npmmirror.sh` | npmmirror 同步 |
| `scripts/update-models.ts` | 模型数据更新 |
| `packages/opencode/script/check-version-consistency.ts` | 版本一致性校验 |
| `packages/opencode/script/pkg-aliases.cjs` | 包别名 |
| `packages/opencode/script/verify-registry-complete.ts` | 注册表完整性校验 |
| `packages/opencode/script/postinstall.mjs` | 自定义 postinstall |

## 8. 文档（5 文件）

| 文件 | 说明 |
|------|------|
| `CHANGELOG-nuwaxcode.md` | 版本变更记录 |
| `CONFIGURATION.zh-CN.md` | 中文配置文档 |
| `README.zh.md` | 中文 README |
| `docs/NUWAXCODE-CUSTOM-FEATURES.md` | 本文件 |
| `docs/PERF-*.md` | 性能优化文档 |

## 9. 环境变量支持

| 变量 | 文件 | 说明 |
|------|------|------|
| `OPENCODE_MODEL` | `src/config/config.ts` | 指定默认模型 |
| `OPENCODE_API_BASE` | `src/provider/provider.ts` | 自定义 API 基础 URL |
| `OPENCODE_API_KEY` | `src/provider/provider.ts` | 自定义 API Key |
| `OPENCODE_LOG_DIR` | `src/config/config.ts` | 日志目录 |
| `NUWAX_AGENT_SANDBOX_CONFIG` | `src/sandbox/env.ts` | 沙箱配置 JSON |

## 10. 依赖版本差异

| 包 | opencode 官方 | nuwaxcode | 原因 |
|----|--------------|-----------|------|
| `effect` | 4.0.0-beta.74 | 4.0.0-beta.74 | 已同步 |
| `drizzle-orm` | 1.0.0-rc.2 | 1.0.0-rc.2 | 已同步 |
| `@opentui/core` | 0.3.4 | 0.3.4 | 已同步 |
| `@ai-sdk/amazon-bedrock` | 4.0.112 | 4.0.112 | 已同步 |
| `@ff-labs/fff-bun` | 0.9.4 | 0.9.4 | 已同步 |
| `effect` (root deps) | 无 | `catalog:` | 强制 hoisting，解决 bundler 解析 |

## 11. 其他差异

| 类别 | 文件数 | 说明 |
|------|--------|------|
| DB migration | ~40 | nuwaclaw 集成产生的 migration（upstream 没有） |
| i18n | 18 | console 多语言文件有微调 |
| UI theme | 8 | 主题颜色/样式微调 |
| SDK gen | 3 | SDK 重新生成的类型文件 |
| bun.lock | 1 | lockfile 差异（registry URL、hoisting） |

---

## 合并策略

1. **自建文件**（sandbox、types、instance 等）→ 保留 ours
2. **上游核心代码** → 整体取 upstream（`git checkout upstream/dev -- packages/opencode/src/`），再放回自定义文件
3. **上游删除但我们依赖的模块** → 从 git 历史恢复或重建
4. **依赖版本** → catalog 与 upstream 对齐
5. **自定义文件只有 ~20 个**，其余 200+ 差异来自 migration、i18n、lockfile 等
