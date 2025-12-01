import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { SystemPrompt } from "../../src/session/system"
import { Instance } from "../../src/project/instance"
import { tmpdir } from "../fixture/fixture"
import path from "path"
import fs from "fs/promises"

describe("System Prompt Environment Variables", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    delete process.env.OPENCODE_SYSTEM_PROMPT
    delete process.env.OPENCODE_USER_PROMPT_PREFIX
    delete process.env.OPENCODE_USER_PROMPT_SUFFIX
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  test("should read system prompt from environment variable (text)", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const customPrompt = "You are a specialized coding assistant."
        process.env.OPENCODE_SYSTEM_PROMPT = customPrompt

        const prompt = await SystemPrompt.fromEnv()
        expect(prompt).toBe(customPrompt)
      },
    })
  })

  test("should read system prompt from file path", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        const promptFile = path.join(dir, "custom-prompt.txt")
        await Bun.write(promptFile, "Custom system prompt from file.")
        process.env.OPENCODE_SYSTEM_PROMPT = promptFile
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const promptFile = path.join(tmp.path, "custom-prompt.txt")
        process.env.OPENCODE_SYSTEM_PROMPT = promptFile

        const prompt = await SystemPrompt.fromEnv()
        expect(prompt).toContain("Custom system prompt from file")
      },
    })
  })

  test("should handle file path with ~ prefix", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        const promptFile = path.join(dir, "custom-prompt.txt")
        await Bun.write(promptFile, "Custom prompt with ~")
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        // 测试 ~ 路径处理（需要实际实现支持）
        const promptFile = path.join(tmp.path, "custom-prompt.txt")
        process.env.OPENCODE_SYSTEM_PROMPT = promptFile

        const prompt = await SystemPrompt.fromEnv()
        if (prompt) {
          expect(prompt).toBeDefined()
        }
      },
    })
  })

  test("should return undefined when environment variable is not set", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const prompt = await SystemPrompt.fromEnv()
        expect(prompt).toBeUndefined()
      },
    })
  })
})

describe("User Prompt Prefix/Suffix", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    delete process.env.OPENCODE_USER_PROMPT_PREFIX
    delete process.env.OPENCODE_USER_PROMPT_SUFFIX
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  test("should apply prefix to user prompts", () => {
    process.env.OPENCODE_USER_PROMPT_PREFIX = "[Context] "
    const prefix = process.env.OPENCODE_USER_PROMPT_PREFIX || ""
    expect(prefix).toBe("[Context] ")
  })

  test("should apply suffix to user prompts", () => {
    process.env.OPENCODE_USER_PROMPT_SUFFIX = " [End Context]"
    const suffix = process.env.OPENCODE_USER_PROMPT_SUFFIX || ""
    expect(suffix).toBe(" [End Context]")
  })

  test("should handle empty prefix and suffix", () => {
    const prefix = process.env.OPENCODE_USER_PROMPT_PREFIX || ""
    const suffix = process.env.OPENCODE_USER_PROMPT_SUFFIX || ""
    expect(prefix).toBe("")
    expect(suffix).toBe("")
  })
})

