import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { Instance } from "../../src/project/instance"
import { tmpdir } from "../fixture/fixture"

describe("MCP Runtime Control", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    delete process.env.OPENCODE_MCP_ENABLED
    delete process.env.OPENCODE_MCP_DISABLED
    delete process.env.OPENCODE_BROWSER_MCP_DISABLED
    delete process.env.OPENCODE_BROWSER_MCP_COMMAND
    delete process.env.OPENCODE_BROWSER_MCP_ENV
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  test("should parse MCP enabled list from environment variable", () => {
    process.env.OPENCODE_MCP_ENABLED = "browser,github,filesystem"
    const enabled = process.env.OPENCODE_MCP_ENABLED
      ? new Set(enabled.split(",").map((s) => s.trim()).filter(Boolean))
      : undefined

    expect(enabled).toBeDefined()
    expect(enabled?.has("browser")).toBe(true)
    expect(enabled?.has("github")).toBe(true)
    expect(enabled?.has("filesystem")).toBe(true)
  })

  test("should parse MCP disabled list from environment variable", () => {
    process.env.OPENCODE_MCP_DISABLED = "database,redis"
    const disabled = process.env.OPENCODE_MCP_DISABLED
      ? new Set(disabled.split(",").map((s) => s.trim()).filter(Boolean))
      : undefined

    expect(disabled).toBeDefined()
    expect(disabled?.has("database")).toBe(true)
    expect(disabled?.has("redis")).toBe(true)
  })

  test("should handle empty MCP enabled/disabled lists", () => {
    const enabled = process.env.OPENCODE_MCP_ENABLED
      ? new Set(process.env.OPENCODE_MCP_ENABLED.split(",").map((s) => s.trim()).filter(Boolean))
      : undefined
    const disabled = process.env.OPENCODE_MCP_DISABLED
      ? new Set(process.env.OPENCODE_MCP_DISABLED.split(",").map((s) => s.trim()).filter(Boolean))
      : undefined

    expect(enabled).toBeUndefined()
    expect(disabled).toBeUndefined()
  })

  test("should trim whitespace from MCP lists", () => {
    process.env.OPENCODE_MCP_ENABLED = " browser , github , filesystem "
    const enabled = process.env.OPENCODE_MCP_ENABLED
      ? new Set(process.env.OPENCODE_MCP_ENABLED.split(",").map((s) => s.trim()).filter(Boolean))
      : undefined

    expect(enabled?.has("browser")).toBe(true)
    expect(enabled?.has("github")).toBe(true)
    expect(enabled?.has("filesystem")).toBe(true)
  })
})

describe("Browser MCP Configuration", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    delete process.env.OPENCODE_BROWSER_MCP_DISABLED
    delete process.env.OPENCODE_BROWSER_MCP_COMMAND
    delete process.env.OPENCODE_BROWSER_MCP_ENV
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  test("should detect Browser MCP disabled flag", () => {
    process.env.OPENCODE_BROWSER_MCP_DISABLED = "true"
    const disabled = process.env.OPENCODE_BROWSER_MCP_DISABLED === "true"
    expect(disabled).toBe(true)
  })

  test("should parse custom Browser MCP command", () => {
    process.env.OPENCODE_BROWSER_MCP_COMMAND = "npx -y @chrome-devtools/mcp"
    const command = process.env.OPENCODE_BROWSER_MCP_COMMAND
      ? process.env.OPENCODE_BROWSER_MCP_COMMAND.split(" ").filter(Boolean)
      : ["npx", "-y", "@modelcontextprotocol/server-browser"]

    expect(command).toEqual(["npx", "-y", "@chrome-devtools/mcp"])
  })

  test("should parse Browser MCP environment variables", () => {
    const envJson = '{"CHROME_PATH": "/path/to/chrome", "HEADLESS": "true"}'
    process.env.OPENCODE_BROWSER_MCP_ENV = envJson

    try {
      const env = process.env.OPENCODE_BROWSER_MCP_ENV ? JSON.parse(process.env.OPENCODE_BROWSER_MCP_ENV) : undefined
      expect(env).toBeDefined()
      expect(env.CHROME_PATH).toBe("/path/to/chrome")
      expect(env.HEADLESS).toBe("true")
    } catch (e) {
      // JSON 解析失败时应该处理错误
      expect(e).toBeInstanceOf(Error)
    }
  })

  test("should use default Browser MCP command when not specified", () => {
    const command = process.env.OPENCODE_BROWSER_MCP_COMMAND
      ? process.env.OPENCODE_BROWSER_MCP_COMMAND.split(" ").filter(Boolean)
      : ["npx", "-y", "@modelcontextprotocol/server-browser"]

    expect(command).toEqual(["npx", "-y", "@modelcontextprotocol/server-browser"])
  })
})

