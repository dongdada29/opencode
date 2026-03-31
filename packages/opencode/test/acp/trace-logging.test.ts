import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import type { AgentSideConnection } from "@agentclientprotocol/sdk"
import { z } from "zod"

type LogEntry = { level: "INFO" | "DEBUG" | "WARN" | "ERROR"; msg: string; extra?: Record<string, unknown> }
const logEntries = ((globalThis as any).__acpLogEntries ??= []) as LogEntry[]

mock.module("../../src/util/log", () => {
  const createLogger = () => ({
    info: (msg: string, extra?: Record<string, unknown>) => {
      logEntries.push({ level: "INFO", msg, extra })
    },
    debug: (msg: string, extra?: Record<string, unknown>) => {
      logEntries.push({ level: "DEBUG", msg, extra })
    },
    warn: (msg: string, extra?: Record<string, unknown>) => {
      logEntries.push({ level: "WARN", msg, extra })
    },
    error: (msg: string, extra?: Record<string, unknown>) => {
      logEntries.push({ level: "ERROR", msg, extra })
    },
    tag() {
      return this
    },
    clone() {
      return createLogger()
    },
    time: () => ({ stop: () => { } }),
  })

  return {
    Log: {
      create: createLogger,
      Default: createLogger(),
      Level: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]),
    },
  }
})

// Avoid real MCP initialization in unit tests.
mock.module("../../src/mcp", () => ({
  MCP: {
    addBatch: async () => { },
  },
}))

const { ACP } = await import("../../src/acp/agent")

function blockingEventStream(signal?: AbortSignal) {
  return (async function* () {
    await new Promise<void>((resolve) => {
      if (signal?.aborted) return resolve()
      signal?.addEventListener("abort", () => resolve(), { once: true })
    })
  })()
}

function createAgent(overrides?: {
  sessionPrompt?: () => Promise<void>
  sessionCreate?: () => Promise<{ data: { id: string; time: { created: string } } }>
}) {
  const connection: AgentSideConnection = {
    async sessionUpdate() { },
    async requestPermission() {
      return { outcome: { outcome: "selected", optionId: "once" } } as any
    },
  } as any

  const sdk = {
    global: {
      event: async (opts?: { signal?: AbortSignal }) => ({
        stream: blockingEventStream(opts?.signal),
      }),
    },
    session: {
      create: overrides?.sessionCreate
        ? overrides.sessionCreate
        : async () => ({
          data: {
            id: "session-trace-1",
            time: { created: new Date().toISOString() },
          },
        }),
      prompt: overrides?.sessionPrompt ?? (async () => { }),
      message: async () => ({
        data: {
          info: { role: "assistant" },
        },
      }),
      command: async () => { },
      get: async () => ({
        data: {
          id: "session-trace-1",
          time: { created: new Date().toISOString() },
        },
      }),
      messages: async () => ({ data: [] }),
    },
    config: {
      providers: async () => ({
        data: {
          providers: [
            {
              id: "opencode",
              name: "opencode",
              models: { "big-pickle": { id: "big-pickle", name: "big-pickle" } },
            },
          ],
        },
      }),
      get: async () => ({ data: { model: "opencode/big-pickle" } }),
    },
    app: {
      agents: async () => ({ data: [{ name: "build", description: "build", mode: "agent" }] }),
    },
    command: {
      list: async () => ({ data: [] }),
    },
    permission: {
      reply: async () => ({ data: true }),
    },
  } as any

  const agent = new ACP.Agent(connection, {
    sdk,
    defaultModel: {
      providerID: "opencode",
      modelID: "big-pickle",
    },
  } as any)

  return { agent, sdk }
}

function findLog(level: LogEntry["level"], msg: string) {
  return logEntries.find((entry) => entry.level === level && entry.msg === msg)
}

describe("acp trace logging", () => {
  beforeEach(() => {
    logEntries.length = 0
  })

  afterEach(() => {
    logEntries.length = 0
  })

  test("newSession emits stage timings with requestId", async () => {
    const { agent } = createAgent()

    ; (agent as any).loadSessionMode = async () => ({
      sessionId: "session-trace-1",
      models: {
        currentModelId: "opencode/big-pickle",
        availableModels: [],
      },
      modes: {
        availableModes: [{ id: "build", name: "build", description: "build" }],
        currentModeId: "build",
      },
      _meta: {},
    })

    await agent.newSession({
      cwd: "/tmp/trace-new",
      mcpServers: [],
      _meta: { requestId: "rid-new-session-001" },
    } as any)

    const log = findLog("INFO", "acp.session.new")
    expect(log).toBeDefined()
    expect(log?.extra?.requestId).toBe("rid-new-session-001")
    expect(log?.extra?.sessionId).toBe("session-trace-1")
    expect(typeof log?.extra?.defaultModelMs).toBe("number")
    expect(typeof log?.extra?.sessionCreateMs).toBe("number")
    expect(typeof log?.extra?.loadSessionModeMs).toBe("number")

    ; (agent as any).eventAbort.abort()
  })

  test("prompt emits no-first-token and total when no assistant output arrives", async () => {
    const { agent } = createAgent()

    ; (agent as any).sessionManager.get = () => ({
      id: "session-trace-2",
      cwd: "/tmp/trace-prompt",
      model: { providerID: "opencode", modelID: "big-pickle" },
      modeId: "build",
      mcpServers: [],
    })

    await agent.prompt({
      sessionId: "session-trace-2",
      prompt: [{ type: "text", text: "hello" }],
      _meta: { request_id: "rid-no-token-001" },
    } as any)

    const noToken = findLog("INFO", "acp.prompt.no-first-token")
    const total = findLog("INFO", "acp.prompt.total")
    expect(noToken?.extra?.requestId).toBe("rid-no-token-001")
    expect(total?.extra?.requestId).toBe("rid-no-token-001")
    expect(typeof total?.extra?.totalMs).toBe("number")

    ; (agent as any).eventAbort.abort()
  })

  test("prompt non_blocking 超时后继续执行，并清理等待句柄避免后续重复等待", async () => {
    const { agent } = createAgent()

    ; (agent as any).sessionManager.get = () => ({
      id: "session-trace-mcp-timeout",
      cwd: "/tmp/trace-mcp-timeout",
      model: { providerID: "opencode", modelID: "big-pickle" },
      modeId: "build",
      mcpServers: [],
    })
    let pendingMcpInitPromise: Promise<void> | undefined = new Promise<void>(() => { })
    ; (agent as any).sessionManager.getMcpInitPromise = () => pendingMcpInitPromise
    let clearCount = 0
    ; (agent as any).sessionManager.clearMcpInitPromise = () => {
      clearCount += 1
      pendingMcpInitPromise = undefined
    }

    await agent.prompt({
      sessionId: "session-trace-mcp-timeout",
      prompt: [{ type: "text", text: "hello" }],
      _meta: {
        requestId: "rid-mcp-timeout-001",
        mcpInitPolicy: "non_blocking",
        mcpInitTimeoutMs: 1,
      },
    } as any)

    const waitLog = findLog("INFO", "acp.prompt.mcp-init.wait")
    const total = findLog("INFO", "acp.prompt.total")
    expect(waitLog?.extra?.requestId).toBe("rid-mcp-timeout-001")
    expect(waitLog?.extra?.outcome).toBe("timeout")
    expect(waitLog?.extra?.policy).toBe("non_blocking")
    expect(total?.extra?.mcpInitPolicy).toBe("non_blocking")
    expect(total?.extra?.mcpInitWaitOutcome).toBe("timeout")
    expect(clearCount).toBe(1)

    const waitLogCountAfterFirstPrompt = logEntries.filter(
      (entry) => entry.level === "INFO" && entry.msg === "acp.prompt.mcp-init.wait",
    ).length

    await agent.prompt({
      sessionId: "session-trace-mcp-timeout",
      prompt: [{ type: "text", text: "hello-again" }],
      _meta: {
        requestId: "rid-mcp-timeout-002",
        mcpInitPolicy: "non_blocking",
        mcpInitTimeoutMs: 1,
      },
    } as any)

    const waitLogCountAfterSecondPrompt = logEntries.filter(
      (entry) => entry.level === "INFO" && entry.msg === "acp.prompt.mcp-init.wait",
    ).length
    expect(waitLogCountAfterSecondPrompt).toBe(waitLogCountAfterFirstPrompt)

    ; (agent as any).eventAbort.abort()
  })

  test("prompt blocking 仍等待 mcpInit 完成后再继续", async () => {
    const { agent } = createAgent()

    ; (agent as any).sessionManager.get = () => ({
      id: "session-trace-mcp-blocking",
      cwd: "/tmp/trace-mcp-blocking",
      model: { providerID: "opencode", modelID: "big-pickle" },
      modeId: "build",
      mcpServers: [],
    })
    let resolveMcpInit: (() => void) | undefined
    const mcpInitPromise = new Promise<void>((resolve) => {
      resolveMcpInit = resolve
    })
    ; (agent as any).sessionManager.getMcpInitPromise = () => mcpInitPromise
    let clearCount = 0
    ; (agent as any).sessionManager.clearMcpInitPromise = () => {
      clearCount += 1
    }

    const promptTask = agent.prompt({
      sessionId: "session-trace-mcp-blocking",
      prompt: [{ type: "text", text: "hello" }],
      _meta: {
        requestId: "rid-mcp-blocking-001",
        mcpInitPolicy: "blocking",
      },
    } as any)

    await new Promise((resolve) => setTimeout(resolve, 0))
    resolveMcpInit?.()
    await promptTask

    const waitLog = findLog("INFO", "acp.prompt.mcp-init.wait")
    const total = findLog("INFO", "acp.prompt.total")
    expect(waitLog?.extra?.requestId).toBe("rid-mcp-blocking-001")
    expect(waitLog?.extra?.outcome).toBe("completed")
    expect(waitLog?.extra?.policy).toBe("blocking")
    expect(total?.extra?.mcpInitPolicy).toBe("blocking")
    expect(total?.extra?.mcpInitWaitOutcome).toBe("completed")
    expect(clearCount).toBe(1)

    ; (agent as any).eventAbort.abort()
  })

  test("prompt failure path logs acp.prompt.failed with requestId", async () => {
    const { agent } = createAgent({
      sessionPrompt: async () => {
        throw new Error("prompt failed in test")
      },
    })

    ; (agent as any).sessionManager.get = () => ({
      id: "session-trace-3",
      cwd: "/tmp/trace-failed",
      model: { providerID: "opencode", modelID: "big-pickle" },
      modeId: "build",
      mcpServers: [],
    })

    await expect(
      agent.prompt({
        sessionId: "session-trace-3",
        prompt: [{ type: "text", text: "hello" }],
        _meta: { requestId: "rid-failed-001" },
      } as any),
    ).rejects.toThrow("prompt failed in test")

    const failed = findLog("ERROR", "acp.prompt.failed")
    expect(failed?.extra?.requestId).toBe("rid-failed-001")
    expect(typeof failed?.extra?.totalMs).toBe("number")

    ; (agent as any).eventAbort.abort()
  })

  test("first token is logged only once for a prompt", async () => {
    let releasePrompt: (() => void) | undefined
    const { agent } = createAgent({
      sessionPrompt: async () => {
        await new Promise<void>((resolve) => {
          releasePrompt = resolve
        })
      },
    })

    const sessionState = {
      id: "session-trace-4",
      cwd: "/tmp/trace-first-token",
      model: { providerID: "opencode", modelID: "big-pickle" },
      modeId: "build",
      mcpServers: [],
    }
    ; (agent as any).sessionManager.get = () => sessionState
    ; (agent as any).sessionManager.tryGet = () => sessionState

    const promptTask = agent.prompt({
      sessionId: "session-trace-4",
      prompt: [{ type: "text", text: "hello" }],
      _meta: { requestId: "rid-first-token-001" },
    } as any)

    await new Promise((resolve) => setTimeout(resolve, 0))

    await (agent as any).handleEvent({
      type: "message.part.updated",
      properties: {
        part: {
          sessionID: "session-trace-4",
          messageID: "m1",
          type: "text",
          ignored: false,
          synthetic: false,
        },
        delta: "hello",
      },
    })

    await (agent as any).handleEvent({
      type: "message.part.updated",
      properties: {
        part: {
          sessionID: "session-trace-4",
          messageID: "m1",
          type: "text",
          ignored: false,
          synthetic: false,
        },
        delta: "world",
      },
    })

    releasePrompt?.()
    await promptTask

    const firstTokenLogs = logEntries.filter(
      (entry) => entry.level === "INFO" && entry.msg === "acp.prompt.first-token",
    )
    expect(firstTokenLogs).toHaveLength(1)
    expect(firstTokenLogs[0].extra?.requestId).toBe("rid-first-token-001")

    ; (agent as any).eventAbort.abort()
  })
})
