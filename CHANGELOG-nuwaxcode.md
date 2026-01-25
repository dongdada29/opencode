# Changelog - feat/nuwaxcode 分支

本文档总结了 `feat/nuwaxcode` 分支相对于主分支的主要更改。

## v1.1.61 (2026-01-25)

### 🔄 优化

- **Performance**: 实现 **TUI 懒加载**。移除了 ACP 模式下对 React/Blessed 等重型 UI 库的静态导入，显著降低了 headless 模式下的内存开销（~70%）和容器启动时间（~50%）。
- **Latency**: ACP 冷启动速度由之前的分钟级降低至 **26s** 左右。

---

## v1.1.60 (2026-01-25)

### 🔄 优化

- **MCP**: 实现 **MCP Batch API**。在 ACP 会话初始化时，通过一个批处理调用同时连接多个 MCP 服务器，将 HTTP 往返开销由 O(N) 降低至 O(1)。
- **Throughput**: 极大提升了在高并发环境下的连接复用速度（热启动耗时缩短至 **30s** 左右）。

---

## v1.1.59 (2026-01-25)

### 🔄 优化

- **MCP**: 实现 **MCP Tools 缓存** (5s TTL)。避免在单次 prompt 处理中重复调用昂贵的 `listTools()` RPC。
- **Initialization**: 并行化 `loadSessionMode` 中的配置加载逻辑（providers/agents/commands 并行获取）。

---

## v1.1.56 (2026-01-23)

### 🐛 修复

- **ACP**: 修复接收 `question.asked` 事件时请求权限导致的无限阻塞问题。

---

## v1.1.55 (2026-01-23)

### ✨ 新特性

- **Config**: 支持 `max_context_tokens` 配置选项。

### 🐛 修复

- **Provider**: 修复自定义加载器中 provider 未定义的边缘情况。

---

## v1.1.54 (2026-01-23)

### ✨ 新特性

- **Config**: 支持通过配置项和环境变量设置 `max_tokens`。

---

### 🐛 修复

- **Config**: 支持在 Linux 上读取固定路径 `/root/.config/opencode/opencode.json` 的配置文件。

---

## v1.1.52 (2026-01-22)

### 🐛 修复

- **Logging**: 修复日志初始化过晚导致早期日志泄漏到终端的问题，实现同步早期初始化。
- **MCP**: 修复本地 MCP 服务器启动时因 stderr 流不兼容导致的 `TODO: stream.Readable stdio @ 2` 错误。
- **Debug**: 增强 MCP 工具加载调试日志，包含详细的启动命令、环境信息及工具列表追踪。
- **Dependencies**: 修复 `optionalDependencies` 版本同步逻辑。

---

## v1.1.51 (2026-01-22)

### 🔄 优化

- **Logging**: 更新日志文件名格式，包含具体时间 (HHmmss) 以提高区分度。

---

## v1.1.50 (2026-01-22)

### 🐛 修复

- **Dependencies**: 修复 `optionalDependencies` 版本不同步的问题，确保所有平台二进制包版本一致。

---

## v1.1.49 (2026-01-22)

### ✨ 新特性

- **Logging**: 新增初始化性能追踪 (`bun.install`, `plugin.load`, `provider.state`)，帮助诊断启动耗时。
- **ACP**: `acp.message.part` 事件现在记录双向消息（用户输入与模型回复），提供完整会话视图。
- **Config**: 增强配置日志，`system.env` 和 `config.load` 现在包含完整的（已脱敏）配置状态。

### 📝 文档

- **CONFIGURATION**: 更新中文配置文档，新增 "Observability & Log Reference" 章节，详细列出所有日志事件及其含义。

---

## v1.1.48

### 🐛 修复

- **ACP Model Selection**: 修复 Title Agent 错误使用 `gpt-5-nano` 的问题。
- **Prompts**: 更新 prompts 中的品牌名称。

---

## v1.1.47

### 🔄 优化

- **Logging**: 优化日志文件名，添加随机后缀以确保每次会话生成独立的日志文件。

---

## 🎉 主要变更

### 项目重命名

- 将项目从 `opencode` 重命名为 `nuwaxcode`
- 移除 `@xagi` 命名空间，包名改为 `nuwaxcode`
- 更新 TUI 和 CLI 品牌标识为 'nuwax' 风格

### 版本发布

- 当前版本: **v1.1.45**
- 主要版本迭代: v1.1.27 → v1.1.45

---

## ✨ 新特性

### 环境变量配置支持

- **`OPENCODE_MODEL`**: 支持通过环境变量配置模型
- **`OPENCODE_LOG_DIR`**: 支持通过环境变量配置日志目录
- **`OPENCODE_API_BASE`**: 支持自定义 API 基础地址
- **`OPENCODE_API_KEY`**: 支持通过环境变量配置 API 密钥
- **Anthropic 环境变量**: 独立支持 Anthropic 相关环境变量配置

### 动态模型加载器

- 添加 OpenAI-compatible 动态模型提供器
- 添加 Anthropic 动态加载器支持
- 添加 Anthropic-compatible 动态加载器支持

### 日志系统增强

- 支持通过 `--log-dir` 参数指定日志目录
- 实现每日日志文件命名规则
- 添加日志目录配置、每日轮换、显式刷新功能
- 支持记录系统提示词 (System Prompt)
- 默认禁用文件日志，除非配置了 log-dir

### ACP 功能增强

- 支持通过 `_meta` 在 ACP 会话创建时传递系统提示词
- 添加 ACP 系统提示词测试
- 将系统提示词传递给 agent 调用

### 构建与发布

- 添加 Linux musl libc 支持
- 更新发布工作流

---

## 🐛 修复

- 修复 OpenAI-compatible 提供器动态加载问题
- 修复 'require is not defined' 错误 (将入口点转换为 ESM)
- 修复 `catalog:` 协议导致的安装失败问题 (替换为具体版本号)
- 隔离 Anthropic 环境变量与通用 opencode API 变量
- 修复构建依赖问题
- 修复 `AI_APICallError` 401: 移除 `opencode` provider 的 `gpt-5-nano` 自动回退

---

## 📝 文档

- 添加安装说明
- 添加配置指南
- 更新中文配置文档
- 添加 Zed 调试说明
- 添加环境变量配置说明（独立章节）
- 添加旧版环境变量兼容性说明

---

## 🔧 其他更改

- 添加 `.agent` 到 `.gitignore`
- 升级 Bun 到 1.3.6
- 更新各项依赖
- 添加环境变量配置测试

---

## 📋 提交列表

| Commit      | 描述                                                             |
| ----------- | ---------------------------------------------------------------- |
| `d1b4ffd09` | docs: 更新中文配置文档                                           |
| `60a8e8737` | docs: 更新中文配置文档，添加 nuwaxcode 更新日志                  |
| `5460ee74a` | feat: 移除 `@xagi` 命名空间，添加 musl libc 支持，更新发布工作流 |
| `65909a003` | docs: 添加安装说明                                               |
| `202fc626c` | fix: 支持 openai/anthropic 兼容模型并更新文档                    |
| `b2aa930b3` | feat: 添加 anthropic-compatible 动态加载器支持                   |
| `1d58132b9` | feat: 添加 anthropic 动态加载器支持                              |
| `3432fd729` | fix: 解决 openai-compatible 提供器动态加载问题                   |
| `58fe4c7e5` | refactor: 重命名项目为 nuwaxcode，更新元数据                     |
| `cde6e3c9b` | feat: 添加动态 OpenAI-compatible 模型提供器                      |
| `6e1babf0d` | test: 添加环境变量配置测试                                       |
| `cad247ab8` | feat: 支持通过环境变量配置模型和日志目录                         |
| `7f3c369b8` | feat: 支持 anthropic 环境变量配置                                |
| `56c046702` | feat: 支持 OPENCODE_API_BASE 和 OPENCODE_API_KEY                 |
| `caedaf621` | feat: 支持 OPENCODE_MODEL 环境变量                               |
| `7dbf78cd4` | fix: 默认禁用文件日志                                            |
| `5028d2a15` | feat: 支持 OPENCODE_LOG_DIR 环境变量                             |
| `8cbea8543` | feat: 记录系统提示词，版本升级至 v1.1.39                         |
| `a77897b26` | feat: 增强日志管理系统                                           |
| `f5e1c585a` | feat: 支持 --log-dir 参数                                        |
| `5942b827a` | feat: 支持通过 ACP \_meta 传递系统提示词                         |
| `fbb501fd8` | refactor: 重命名 opencode 为 nuwaxcode                           |
| `653450621` | feat: 重命名并添加 ACP meta systemPrompt 支持                    |

---

_生成日期: 2026-01-21_
