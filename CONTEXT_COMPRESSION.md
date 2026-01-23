# Nuwaxcode 内部上下文压缩机制分析报告

本文档详细介绍了 Nuwaxcode 项目中实现的内部上下文压缩机制，包括其触发条件和实现方案。

## 1. 触发条件 (Trigger Conditions)

上下文压缩主要通过两种方式触发：自动检测溢出和基于策略的裁剪。

### 1.1 上下文溢出检测 (Context Overflow)
在会话处理器 (`processor.ts`) 的循环中，每当模型完成一个步骤 (`finish-step`)，系统都会检查当前已使用的 Token 数量。

- **计算公式**：`已用 Token = 输入 Token + 缓存读 Token + 输出 Token`。
- **阈值判断**：如果 `已用 Token > 可用限制`，则认为发生溢出。
  - `可用限制` 通常为模型上下文限制减去预留的最大输出 Token 数 (`OUTPUT_TOKEN_MAX`，默认为 32,000)。
- **核心代码**：`SessionCompaction.isOverflow` 方法。

### 1.2 显式裁剪 (Explicit Pruning)
系统会定期（如在会话主循环循环结束时）尝试裁剪不必要的旧数据。

- **触发逻辑**：
  - 遍历历史消息，统计已完成的工具调用（Tool Call）的输出大小。
  - **保护机制**：排除受保护的工具（如 `skill`）以及最近两轮对话。
  - **阈值**：
    - 只有当旧工具输出的总量超过 `PRUNE_PROTECT` (40,000 Token) 时才开始标记裁剪。
    - 只有当可裁剪的总量超过 `PRUNE_MINIMUM` (20,000 Token) 时才执行实际更新。

---

## 2. 实现方案 (Implementation Strategy)

Nuwaxcode 采用了两种策略来减小上下文体积：**内容清空 (Content Clearing)** 和 **总结压缩 (Summarization)**。

### 2.1 内容清空 (Pruning / Content Clearing)
针对大型工具输出（如大量代码搜索结果），系统在不破坏对话结构的前提下清空其原始内容。

- **操作**：将工具部分的 `compacted` 时间戳设置为当前时间。
- **模型转换层处理**：在将消息转换为 LLM 格式时 (`toModelMessage`)，如果检测到该部分已被裁剪，则将其输出内容替换为固定提示词：`"[Old tool result content cleared]"`。
- **优点**：极大减少 Token 占用，同时保留“某个工具曾被调用且产生了结果”的历史信息。

### 2.2 总结压缩 (Compaction / Summarization)
这是最核心的压缩方案，通过引入专门的“总结代理” (Compaction Agent) 来重构会话状态。

- **流程**：
  1. **生成总结**：调用 LLM（通常使用 `compaction` 代理配置）对之前的对话进行深度总结。Prompt 重点关注：做了什么、正在做什么、涉及哪些文件、下一步计划是什么。
  2. **标记阶段性**：生成一条带有 `summary: true` 标记的助手消息。
  3. **截断上下文**：在后续请求中，`filterCompacted` 方法会以最新的总结消息为界，丢弃该总结之前的原始历史消息。
- **插件扩展**：系统提供了 `experimental.session.compacting` 钩子，允许插件在压缩过程中注入额外的上下文或自定义总结 Prompt。

---

## 3. 相关核心文件

- [compaction.ts](file:///Users/apple/workspace/nuwaxcode/packages/opencode/src/session/compaction.ts): 定义了溢出检测、裁剪算法和总结处理流程。
- [processor.ts](file:///Users/apple/workspace/nuwaxcode/packages/opencode/src/session/processor.ts): 执行 LLM 流式处理，并在每步结束后触发溢出检测。
- [prompt.ts](file:///Users/apple/workspace/nuwaxcode/packages/opencode/src/session/prompt.ts): 会话主循环，协调总结任务的执行及定期触发裁剪。
- [message-v2.ts](file:///Users/apple/workspace/nuwaxcode/packages/opencode/src/session/message-v2.ts): 处理消息向模型格式的转换，实现内容过滤和截断。
