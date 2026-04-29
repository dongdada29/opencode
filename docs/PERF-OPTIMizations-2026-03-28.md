# nuwaxcode ACP 性能优化

**日期**: 2026-03-28
**作者**: Claude Code (自动生成)

## 概述

本文档记录了针对 nuwaxcode ACP 性能的优化措施，目标是将首次聊天请求从 ~5044ms 降到 ~2500-3500ms。

## 优化前基线

| 指标 | 耗时 |
|------|------|
| engine.getOrCreate | 1783ms |
| acp.session.create | 3255ms |
| **总请求耗时** | **5044ms** |

## 优化措施

### 1. 并行配置加载 (`config/config.ts`)

**问题**: 配置加载是串行的，远程配置获取 → 全局配置加载 → 项目配置加载）

**优化**:
- 使用 `Promise.all` 并行加载所有远程配置和全局配置
- 远程配置错误不再阻塞启动，而是记录错误并继续

**预期收益**: -300~500ms

```typescript
// 优化前
for (const [key, value] of Object.entries(auth)) {
  if (value.type === "wellknown") {
    const response = await fetch(`${key}/.well-known/opencode`)
    // ...
  }
}
result = mergeConfigConcatArrays(result, await global())

// 优化后
const [remoteConfigs, globalConfig] = await Promise.all([
  Promise.all(wellknownEntries.map(async ([key]) => {
    try {
      const response = await fetch(`${key}/.well-known/opencode`)
      // ...
    } catch (err) {
      log.error("failed to fetch remote config", { url: key, error: err })
      return { key, config: null }
  })),
  global(),
])
```

### 2. 模型解析缓存 (`acp/agent.ts`)

**问题**: `defaultModel()` 每次调用都会执行两个串行 SDK 调用

**优化**:
- 添加 60 秒 TTL 的模型缓存
- 使用 `Promise.all` 并行执行 `sdk.config.get()` 和 `sdk.config.providers()`

**预期收益**: -200~400ms

```typescript
// 优化前
const specified = await sdk.config.get(...)
const providers = await sdk.config.providers(...)

// 优化后
const [specified, providers] = await Promise.all([
  sdk.config.get(...),
  sdk.config.providers(...),
])

// 缓存
const modelCache = new Map<string, { model: ModelInfo; expires: number }>()
const MODEL_CACHE_TTL = 60_000 // 60 seconds
```

### 3. Bootstrap 并行化 (`project/bootstrap.ts`)

**问题**: 服务初始化是串行的，Plugin.init → Share.init → Format.init → LSP.init → ...

**优化**:
- 所有独立服务并行初始化
- LSP 初始化不再阻塞启动（懒加载）

**预期收益**: -200~400ms

```typescript
// 优化前
await Plugin.init()
Share.init()
ShareNext.init()
Format.init()
await LSP.init()
FileWatcher.init()
// ...

// 优化后
const parallelInits = Promise.all([
  LSP.init().catch(...),
  Promise.resolve().then(() => Share.init()),
  Promise.resolve().then(() => Format.init()),
  // ... 其他服务
])
await parallelInits
```

### 4. MCP 连接复用 (`mcp/index.ts`)

**注意**: 此优化已存在于代码中，无需修改

- `addBatch()` 方法使用 configHash 检测配置变化
- 如果配置未变化，直接复用现有连接

## 预期总收益

| 优化项 | 预计收益 |
|--------|----------|
| 并行配置加载 | -300~500ms |
| 模型解析缓存 | -200~400ms |
| Bootstrap 并行化 | -200~400ms |
| MCP 连接复用 | 已存在 |
| **总计** | **-700~1300ms** |

**目标**: 将首次聊天请求从 ~5044ms 降到 **~2500-3500ms**

## 验证

1. 运行 TypeScript 类型检查:
   ```bash
   cd /Users/apple/workspace/nuwaxcode/packages/opencode
   bun run typecheck
   ```

2. 启动 NuwaClaw 应用并测试首次聊天请求
3. 查看 `~/.nuwaclaw/logs/perf.*.log` 性能日志

## 后续优化建议

1. **LSP 懒加载**: 将 LSP 初始化延迟到首次使用时
2. **文件监视器按需启动**: 只在有文件变更监听需求时才启动
3. **网络请求压缩**: 启用 HTTP/2 和 gzip 压缩
4. **提供商列表缓存**: 跨会话缓存提供商和模型列表
