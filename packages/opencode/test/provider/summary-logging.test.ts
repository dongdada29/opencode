import { beforeEach, expect, mock, test } from "bun:test"
import { z } from "zod"

type LogEntry = { level: "INFO" | "DEBUG" | "WARN" | "ERROR"; msg: string; extra?: Record<string, unknown> }
const logEntries = ((globalThis as any).__providerSummaryLogEntries ??= []) as LogEntry[]

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
    time: () => ({
      stop: () => {},
      [Symbol.dispose]: () => {},
      [Symbol.asyncDispose]: async () => {},
    }),
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
    release_date: z.string(),
    attachment: z.boolean(),
    reasoning: z.boolean(),
    temperature: z.boolean(),
    tool_call: z.boolean(),
    options: z.record(z.string(), z.any()),
    limit: z.object({
      context: z.number(),
      output: z.number(),
    }),
    modalities: z
      .object({
        input: z.array(z.string()),
        output: z.array(z.string()),
      })
      .optional(),
    cost: z
      .object({
        input: z.number(),
        output: z.number(),
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
    get: async () => ({
      opencode: {
        id: "opencode",
        name: "OpenCode",
        env: [],
        models: {
          "big-pickle": {
            id: "big-pickle",
            name: "big-pickle",
            release_date: "2026-01-01",
            attachment: false,
            reasoning: false,
            temperature: true,
            tool_call: true,
            options: {},
            limit: {
              context: 128000,
              output: 4096,
            },
            modalities: {
              input: ["text"],
              output: ["text"],
            },
            cost: {
              input: 0,
              output: 0,
            },
          },
        },
      },
    }),
  },
}))

mock.module("../../src/plugin", () => ({
  Plugin: {
    list: async () => [],
  },
}))

mock.module("../../src/auth", () => ({
  Auth: {
    all: async () => ({}),
    get: async () => undefined,
  },
}))

const { Provider } = await import("../../src/provider/provider")
const { Instance } = await import("../../src/project/instance")
const { tmpdir } = await import("../fixture/fixture")

function findLastInfo(msg: string) {
  const matches = logEntries.filter((entry) => entry.level === "INFO" && entry.msg === msg)
  return matches[matches.length - 1]
}

beforeEach(() => {
  logEntries.length = 0
})

test("Provider.list 输出 provider.state 日志字段", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(
        `${dir}/opencode.json`,
        JSON.stringify({
          $schema: "https://opencode.ai/config.json",
        }),
      )
    },
  })

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const providers = await Provider.list()
      expect(providers["opencode"]).toBeDefined()

      const modelsDevLog = findLastInfo("provider.state.models-dev")
      expect(modelsDevLog?.extra?.modelsDevProviders).toBe(1)
      expect(modelsDevLog?.extra?.databaseProviders).toBe(1)
      expect(typeof modelsDevLog?.extra?.modelsDevMs).toBe("number")

      const readyLog = findLastInfo("provider.state.ready")
      expect(typeof readyLog?.extra?.totalMs).toBe("number")
      expect(typeof readyLog?.extra?.providerCount).toBe("number")
      expect(typeof readyLog?.extra?.sdkCount).toBe("number")
      expect(typeof readyLog?.extra?.modelLoaderCount).toBe("number")
      expect((readyLog?.extra?.providerCount as number) >= 1).toBe(true)
    },
  })
})
