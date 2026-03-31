import { describe, expect, test, beforeEach, mock } from "bun:test"
import type { AgentSideConnection } from "@agentclientprotocol/sdk"
import { z } from "zod"

// Mock the Log module
const logEntries = ((globalThis as any).__acpLogEntries ??= []) as any[]
mock.module("../../src/util/log", () => {
  const createLogger = () => ({
    info: (msg: any, extra: any) => {
      logEntries.push({ level: "INFO", msg, ...extra })
    },
    error: (msg: any, extra: any) => {
      logEntries.push({ level: "ERROR", msg, ...extra })
    },
    debug: () => { },
    warn: () => { },
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

// Dynamically import ACP after mocking
const { ACP } = await import("../../src/acp/agent")

describe("ACP System Prompt via _meta", () => {
  let acp: import("../../src/acp/agent").ACP.Agent
  let connection: AgentSideConnection

  beforeEach(async () => {
    // Clear logs
    logEntries.length = 0

    connection = {
      async sessionUpdate() {},
      async requestPermission() {
        return { outcome: { outcome: "selected", optionId: "once" } } as any
      }
    } as any

    const config = {
      sdk: {
        sessions: {
          create: async () => ({ id: "test-session" })
        },
        events: {
          subscribe: () => ({ async *[Symbol.asyncIterator]() {} })
        }
      } as any
    }

    acp = new ACP.Agent(connection, config)
  })

  test("should extract systemPrompt from _meta during session creation", async () => {
    const customSystemPrompt = "你是 Nuwaxcode，一个强大的 AI 编程助手。请在回答前仔细思考..."
    
    // Mock the session manager to capture the system prompt
    let capturedSystemPrompt: string | { append: string } | undefined
    acp["sessionManager"].create = async (cwd, mcpServers, model, systemPrompt) => {
      capturedSystemPrompt = systemPrompt
      return {
        id: "test-session",
        cwd,
        mcpServers,
        createdAt: new Date(),
        model,
        systemPrompt
      }
    }

    // Mock loadSessionMode
    acp["loadSessionMode"] = async () => ({
      models: [{ providerID: "test", modelID: "test" }] as any,
      modes: { availableModes: [], currentModeId: "default" },
      sessionId: "test-session",
      _meta: {}
    })

    const mockConfig = {
      defaultModel: { providerID: "test", modelID: "test" },
      sdk: acp["config"].sdk
    }
    acp["config"] = mockConfig as any

    const params = {
      cwd: "/test/directory",
      mcpServers: [],
      _meta: {
        systemPrompt: customSystemPrompt
      }
    }

    await acp.newSession(params as any)

    expect(capturedSystemPrompt).toBe(customSystemPrompt)
  })

  test("should handle append-style system prompt", async () => {
    const appendPrompt = { append: "请始终用中文回答问题。" }
    
    let capturedSystemPrompt: string | { append: string } | undefined
    acp["sessionManager"].create = async (cwd, mcpServers, model, systemPrompt) => {
      capturedSystemPrompt = systemPrompt
      return {
        id: "test-session",
        cwd,
        mcpServers,
        createdAt: new Date(),
        model,
        systemPrompt
      }
    }

    acp["loadSessionMode"] = async () => ({
      models: [{ providerID: "test", modelID: "test" }] as any,
      modes: { availableModes: [], currentModeId: "default" },
      sessionId: "test-session",
      _meta: {}
    })

    const mockConfig = {
      defaultModel: { providerID: "test", modelID: "test" },
      sdk: acp["config"].sdk
    }
    acp["config"] = mockConfig as any

    const params = {
      cwd: "/test/directory",
      mcpServers: [],
      _meta: {
        systemPrompt: appendPrompt
      }
    }

    await acp.newSession(params as any)

    expect(capturedSystemPrompt).toEqual(appendPrompt)
  })

  test("should work without _meta systemPrompt", async () => {
    let capturedSystemPrompt: string | { append: string } | undefined
    acp["sessionManager"].create = async (cwd, mcpServers, model, systemPrompt) => {
      capturedSystemPrompt = systemPrompt
      return {
        id: "test-session",
        cwd,
        mcpServers,
        createdAt: new Date(),
        model,
        systemPrompt
      }
    }

    acp["loadSessionMode"] = async () => ({
      models: [{ providerID: "test", modelID: "test" }] as any,
      modes: { availableModes: [], currentModeId: "default" },
      sessionId: "test-session",
      _meta: {}
    })

    const mockConfig = {
      defaultModel: { providerID: "test", modelID: "test" },
      sdk: acp["config"].sdk
    }
    acp["config"] = mockConfig as any

    const params = {
      cwd: "/test/directory",
      mcpServers: []
      // No _meta
    }

    await acp.newSession(params as any)

    expect(capturedSystemPrompt).toBeUndefined()
  })

  test("should work with empty _meta", async () => {
    let capturedSystemPrompt: string | { append: string } | undefined
    acp["sessionManager"].create = async (cwd, mcpServers, model, systemPrompt) => {
      capturedSystemPrompt = systemPrompt
      return {
        id: "test-session",
        cwd,
        mcpServers,
        createdAt: new Date(),
        model,
        systemPrompt
      }
    }

    acp["loadSessionMode"] = async () => ({
      models: [{ providerID: "test", modelID: "test" }] as any,
      modes: { availableModes: [], currentModeId: "default" },
      sessionId: "test-session",
      _meta: {}
    })

    const mockConfig = {
      defaultModel: { providerID: "test", modelID: "test" },
      sdk: acp["config"].sdk
    }
    acp["config"] = mockConfig as any

    const params = {
      cwd: "/test/directory",
      mcpServers: [],
      _meta: {}
    }

    await acp.newSession(params as any)

    expect(capturedSystemPrompt).toBeUndefined()
  })

  test("should log when systemPrompt is provided", async () => {
    const customSystemPrompt = "Test system prompt"

    acp["sessionManager"].create = async (cwd, mcpServers, model, systemPrompt) => {
      return {
        id: "test-session",
        cwd,
        mcpServers,
        createdAt: new Date(),
        model,
        systemPrompt
      }
    }

    acp["loadSessionMode"] = async () => ({
      models: [{ providerID: "test", modelID: "test" }] as any,
      modes: { availableModes: [], currentModeId: "default" },
      sessionId: "test-session",
      _meta: {}
    })

    const mockConfig = {
      defaultModel: { providerID: "test", modelID: "test" },
      sdk: acp["config"].sdk
    }
    acp["config"] = mockConfig as any

    const params = {
      cwd: "/test/directory",
      mcpServers: [],
      _meta: {
        systemPrompt: customSystemPrompt
      }
    }

    await acp.newSession(params as any)

    const hasSystemPromptLog = logEntries.some(entry =>
      (entry.hasSystemPrompt === true || entry.extra?.hasSystemPrompt === true) && entry.level === "INFO"
    )
    expect(hasSystemPromptLog).toBe(true)
  })
})
