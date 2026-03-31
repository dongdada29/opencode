import { beforeEach, expect, mock, test } from "bun:test"
import { z } from "zod"

type LogEntry = { level: "INFO" | "DEBUG" | "WARN" | "ERROR"; msg: string; extra?: Record<string, unknown> }
const logEntries = ((globalThis as any).__mcpSummaryLogEntries ??= []) as LogEntry[]
const nativeFetch = globalThis.fetch

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url
  if (url.includes("models.dev/api.json")) {
    return new Response("{}", { status: 200 })
  }
  return nativeFetch(input as any, init)
}) as typeof fetch

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

const MockModel = z
  .object({
    id: z.string(),
    name: z.string(),
    release_date: z.string().default("2026-01-01"),
    attachment: z.boolean().default(false),
    reasoning: z.boolean().default(false),
    temperature: z.boolean().default(true),
    tool_call: z.boolean().default(true),
    options: z.record(z.string(), z.any()).default({}),
    limit: z.object({
      context: z.number().default(128000),
      output: z.number().default(4096),
    }),
    modalities: z
      .object({
        input: z.array(z.string()),
        output: z.array(z.string()),
      })
      .optional(),
  })
  .catchall(z.any())

const MockProvider = z
  .object({
    id: z.string(),
    name: z.string(),
    env: z.array(z.string()),
    models: z.record(z.string(), MockModel),
  })
  .catchall(z.any())

mock.module("../../src/provider/models", () => ({
  ModelsDev: {
    Model: MockModel,
    Provider: MockProvider,
    get: async () => ({}),
    refresh: async () => {},
  },
}))

const { MCP } = await import("../../src/mcp/index")
const { Instance } = await import("../../src/project/instance")
const { tmpdir } = await import("../fixture/fixture")

function findLastInfo(msg: string) {
  const matches = logEntries.filter((entry) => entry.level === "INFO" && entry.msg === msg)
  return matches[matches.length - 1]
}

beforeEach(() => {
  logEntries.length = 0
})

test("addBatch 输出 mcp.create/mcp.addBatch summary 字段", async () => {
  await using tmp = await tmpdir()

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const result = await MCP.addBatch({
        "disabled-local": {
          type: "local",
          command: ["echo", "hello"],
          environment: {},
          enabled: false,
        },
      })

      expect(result.status["disabled-local"]?.status).toBe("disabled")

      const createSummary = findLastInfo("mcp.create.summary")
      expect(createSummary?.extra?.key).toBe("disabled-local")
      expect(createSummary?.extra?.type).toBe("local")
      expect(createSummary?.extra?.status).toBe("disabled")
      expect(typeof createSummary?.extra?.connectMs).toBe("number")
      expect(typeof createSummary?.extra?.listToolsMs).toBe("number")
      expect(typeof createSummary?.extra?.totalMs).toBe("number")

      const serverSummary = findLastInfo("mcp.addBatch.server.summary")
      expect(serverSummary?.extra?.name).toBe("disabled-local")
      expect(serverSummary?.extra?.branch).toBe("create_no_client")
      expect(serverSummary?.extra?.status).toBe("disabled")
      expect(typeof serverSummary?.extra?.totalMs).toBe("number")

      const batchSummary = findLastInfo("mcp.addBatch.summary")
      expect(batchSummary?.extra?.inputCount).toBe(1)
      expect(batchSummary?.extra?.toAddCount).toBe(1)
      expect(batchSummary?.extra?.reusedCount).toBe(0)
      expect(batchSummary?.extra?.connectedCount).toBe(0)
      expect(batchSummary?.extra?.failedCount).toBe(0)
      expect(batchSummary?.extra?.disabledCount).toBe(1)
      expect(batchSummary?.extra?.authPendingCount).toBe(0)
      expect(typeof batchSummary?.extra?.totalMs).toBe("number")
    },
  })
})

test("addBatch 单个 server 抛错不影响整批，并输出 create_threw summary", async () => {
  await using tmp = await tmpdir()

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const result = await MCP.addBatch({
        "broken-remote-throw": {
          type: "remote",
          url: "not-a-valid-url",
          headers: {},
        } as any,
        "disabled-local-throw": {
          type: "local",
          command: ["echo", "hello"],
          environment: {},
          enabled: false,
        },
      })

      expect(result.status["broken-remote-throw"]?.status).toBe("failed")
      expect(result.status["disabled-local-throw"]?.status).toBe("disabled")

      const throwSummary = logEntries
        .filter((entry) => entry.level === "INFO" && entry.msg === "mcp.addBatch.server.summary")
        .find((entry) => entry.extra?.name === "broken-remote-throw")
      expect(throwSummary?.extra?.branch).toBe("create_threw")
      expect(throwSummary?.extra?.status).toBe("failed")
      expect(typeof throwSummary?.extra?.error).toBe("string")
      expect(typeof throwSummary?.extra?.totalMs).toBe("number")

      const batchSummary = findLastInfo("mcp.addBatch.summary")
      expect(batchSummary?.extra?.inputCount).toBe(2)
      expect(batchSummary?.extra?.toAddCount).toBe(2)
      expect(batchSummary?.extra?.failedCount).toBe(1)
      expect(batchSummary?.extra?.disabledCount).toBe(1)
      expect(typeof batchSummary?.extra?.totalMs).toBe("number")
    },
  })
})
