# nuwaxcode 自定义功能清单

> 合并 upstream v1.17.4 后验证（2026-06-13）

本文件记录 `feat/nuwaxcode` 分支相对于 upstream（anomalyco/opencode）的所有自定义功能，
用于合并后快速确认功能完整性。

---

## 品牌 & 包配置

| 文件 | 说明 |
|------|------|
| `packages/opencode/package.json` | name: "nuwaxcode", bin: { "nuwaxcode" } |
| `CHANGELOG-nuwaxcode.md` | 版本变更记录 |
| `CONFIGURATION.zh-CN.md` | 中文配置文档 |
| `README.zh.md` | 中文 README |

## ACP 系统提示功能

通过 `_meta.systemPrompt` 在 ACP session 创建时传入自定义系统提示。
客户端（nuwaclaw）发送 `_meta.systemPrompt = { append: "..." }`，
nuwaxcode 在 `newSession` 中提取并存入 session state，每次 `prompt` 时传给 SDK。

| 文件 | 说明 |
|------|------|
| `packages/opencode/src/acp/types.ts` | `ACPSystemPromptMeta` 类型定义（`string \| { append: string }`） |
| `packages/opencode/src/acp/session.ts` | `Info` / `StoreInput` 带 `systemPrompt` 字段 |
| `packages/opencode/src/acp/service.ts` | `newSession` 从 `params._meta.systemPrompt` 提取；`prompt` 传递给 `sdk.session.prompt()` |

## 环境变量支持

| 变量 | 文件 | 说明 |
|------|------|------|
| `OPENCODE_MODEL` | `src/config/config.ts` | 指定默认模型 |
| `OPENCODE_API_BASE` | `src/provider/provider.ts` | 自定义 API 基础 URL |
| `OPENCODE_API_KEY` | `src/provider/provider.ts` | 自定义 API Key |
| `OPENCODE_LOG_DIR` | `src/config/config.ts` | 日志目录 |

## Sandbox 安全模块

提供沙箱环境下的路径隔离、工具权限控制和 bash 命令守卫。
依赖 `@/project/instance`（自定义，上游已删除）、`@/effect/instance-state`、`@/session/session`。

| 文件 | 说明 |
|------|------|
| `packages/opencode/src/sandbox/bash-helper.ts` | Bash 命令辅助 |
| `packages/opencode/src/sandbox/env.ts` | 沙箱环境变量 |
| `packages/opencode/src/sandbox/error.ts` | 沙箱错误类型 |
| `packages/opencode/src/sandbox/index.ts` | 沙箱入口 |
| `packages/opencode/src/sandbox/path.ts` | 路径隔离逻辑 |
| `packages/opencode/src/sandbox/policy-sync.ts` | 策略同步 |
| `packages/opencode/src/sandbox/policy.ts` | 沙箱策略 |
| `packages/opencode/src/sandbox/tool-guard.ts` | 工具权限守卫 |
| `packages/opencode/src/config/sandbox.ts` | Sandbox `Info` 类型（`sandbox_mode`, `writable_roots`） |

## 系统提示词

`packages/opencode/src/session/prompt/` 下的自定义提示词：

- `anthropic.txt` — Anthropic 模型专用
- `beast.txt` — Beast 模式
- `codex.txt` — Codex 模型专用
- `copilot-gpt-5.txt` — Copilot GPT-5 专用
- `default.txt` — 默认提示词
- `gemini.txt` — Gemini 模型专用
- `gpt.txt` — GPT 模型专用
- `kimi.txt` — Kimi 模型专用
- `trinity.txt` — Trinity 模型专用
- `build-switch.txt` — 构建切换提示
- `max-steps.txt` — 最大步数提示
- `plan-mode.txt` — 计划模式
- `plan-reminder-anthropic.txt` — Anthropic 计划提醒
- `plan.txt` — 计划提示

## CI/CD & 发布脚本

| 文件 | 说明 |
|------|------|
| `.github/workflows/build-release.yml` | 标签触发（`v[0-9]*`）的全平台构建发布，run-name 显示版本 |
| `.github/workflows/beta.yml` | 每小时自动同步 beta |
| `.github/workflows/publish.yml` | npm 发布工作流 |
| `release.sh` | 本地全量发版脚本 |
| `scripts/release-publish.sh` | npm 发布段脚本 |
| `scripts/sync-npmmirror.sh` | npmmirror 同步 |
| `scripts/update-models.ts` | 模型数据更新 |
| `packages/opencode/script/check-version-consistency.ts` | 版本一致性校验 |
| `packages/opencode/script/pkg-aliases.cjs` | 包别名 |
| `packages/opencode/script/verify-registry-complete.ts` | 注册表完整性校验 |
| `packages/opencode/script/verify-sandbox.ts` | 沙箱验证 |

## 其他自定义

| 文件 | 说明 |
|------|------|
| `packages/opencode/src/provider/models-source.ts` | 自定义模型源加载 |
| `packages/opencode/src/provider/models.ts` | 自定义模型列表 |
| `packages/opencode/src/provider/schema.ts` | ProviderID / ModelID branded types |
| `packages/opencode/src/provider/index.ts` | provider barrel |
| `packages/opencode/src/project/instance.ts` | `Instance` 对象（上游已删除，从 ALS context 暴露 directory/worktree） |
| `packages/opencode/src/config/index.ts` | config barrel（re-export 所有 config 子模块） |
| `packages/opencode/src/util/index.ts` | util barrel |
| `packages/opencode/src/util/log.ts` | 日志模块 |
| `packages/opencode/src/util/schema.ts` | schema 工具 |
| `packages/opencode/src/util/effect-zod.ts` | Effect-Zod 桥接 |
| `packages/opencode/src/cli/cmd/models.ts` | `models` CLI 命令 |
| `packages/opencode/bin/opencode` | 自定义 CLI 入口 |
| `demo-system-prompt.js` | 系统提示演示脚本 |
| `docs/` | 性能优化等文档 |

## v1.17.4 合并后的依赖升级

| 包 | 旧版本 | 新版本 | 原因 |
|----|--------|--------|------|
| `effect` | 4.0.0-beta.48 | 4.0.0-beta.74 | drizzle-orm rc.2 要求 >=4.0.0-beta.58 |
| `drizzle-orm` | 1.0.0-beta.19 | 1.0.0-rc.2 | effect-core 子模块兼容 effect v4 |
| `@opentui/core` | 0.1.105 | 0.3.4 | 上游需要 Audio 等新导出 |
| `@opentui/solid` | 0.1.105 | 0.3.4 | 上游需要 runtime-plugin-support/configure |
| `@opentui/keymap` | (无) | 0.3.4 | 上游新增依赖 |
| `@ai-sdk/amazon-bedrock` | 4.0.96 | 4.0.112 | 上游需要 /mantle 子路径 |
| `@ff-labs/fff-bun` | (无) | 0.9.4 | build.ts 需要 |

## 合并策略备忘

合并 upstream 时的冲突处理原则：

1. **nuwaxcode 特有文件**（如上表）→ 保留 ours
2. **upstream 核心代码** → 整体取 upstream（`git checkout upstream/dev -- packages/opencode/src/`），再放回自定义文件
3. **upstream 删除但我们依赖的模块**（如 `instance.ts`）→ 从 git 历史恢复或重建
4. **构建产物**（如 `models-snapshot.*`）→ 加入 `.gitignore`
5. **依赖版本** → catalog 与 upstream 对齐，避免 bundler 解析失败
