import { afterEach, beforeEach, expect, mock, test } from "bun:test"
import type { AgentSideConnection } from "@agentclientprotocol/sdk"
import { z } from "zod"

type LogEntry = { level: "INFO" | "DEBUG" | "WARN" | "ERROR"; msg: string; extra?: Record<string, unknown> }
const logEntries = ((globalThis as any).__acpDefaultModelLogEntries ??= []) as LogEntry[]

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
    time: () => ({ stop: () => {} }),
  })

  return {
    Log: {
      create: createLogger,
      Default: createLogger(),
      Level: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]),
    },
  }
})

mock.module("../../src/mcp", () => ({
  MCP: {
    addBatch: async () => {},
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

function createAgent() {
  const connection: AgentSideConnection = {
    async sessionUpdate() {},
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
      create: async () => ({
        data: {
          id: "session-default-model-1",
          time: { created: new Date().toISOString() },
        },
      }),
      prompt: async () => {},
      message: async () => ({
        data: {
          info: { role: "assistant" },
        },
      }),
      command: async () => {},
      get: async () => ({
        data: {
          id: "session-default-model-1",
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
  } as any)

  return { agent }
}

function findLog(level: LogEntry["level"], msg: string) {
  const matches = logEntries.filter((entry) => entry.level === level && entry.msg === msg)
  return matches[matches.length - 1]
}

beforeEach(() => {
  logEntries.length = 0
})

afterEach(() => {
  logEntries.length = 0
})

test("prompt defaultModel 解析链路输出 fetch/resolve 日志", async () => {
  const { agent } = createAgent()

  ;(agent as any).sessionManager.get = () => ({
    id: "session-default-model-log",
    cwd: "/tmp/default-model-log",
    model: undefined,
    modeId: "build",
    mcpServers: [],
  })

  await agent.prompt({
    sessionId: "session-default-model-log",
    prompt: [{ type: "text", text: "hello" }],
    _meta: {
      requestId: "rid-default-model-001",
    },
  } as any)

  const fetchLog = findLog("INFO", "defaultModel.fetch")
  const resolveLog = findLog("INFO", "defaultModel.resolve")

  expect(fetchLog).toBeDefined()
  expect(fetchLog?.extra?.directory).toBe("/tmp/default-model-log")
  expect(typeof fetchLog?.extra?.configGetMs).toBe("number")
  expect(typeof fetchLog?.extra?.providerCount).toBe("number")
  expect(typeof fetchLog?.extra?.hasSpecified).toBe("boolean")

  expect(resolveLog).toBeDefined()
  expect(typeof resolveLog?.extra?.source).toBe("string")
  expect(resolveLog?.extra?.directory).toBe("/tmp/default-model-log")
  expect(typeof resolveLog?.extra?.providerID).toBe("string")
  expect(typeof resolveLog?.extra?.modelID).toBe("string")
  expect(typeof resolveLog?.extra?.totalMs).toBe("number")

  ;(agent as any).eventAbort.abort()
})
