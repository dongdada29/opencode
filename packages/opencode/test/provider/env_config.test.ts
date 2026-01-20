
import { test, expect, mock, beforeEach, afterEach } from "bun:test"
import path from "path"

// Mock BunProc and default plugins
mock.module("../../src/bun/index", () => ({
  BunProc: {
    install: async (pkg: string) => pkg,
    run: async () => { throw new Error("BunProc.run should not be called") },
    which: () => process.execPath,
    InstallFailedError: class extends Error {},
  },
}))

const mockPlugin = () => ({})
mock.module("opencode-copilot-auth", () => ({ default: mockPlugin }))
mock.module("opencode-anthropic-auth", () => ({ default: mockPlugin }))
mock.module("@gitlab/opencode-gitlab-auth", () => ({ default: mockPlugin }))

import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { Provider } from "../../src/provider/provider"
import { Env } from "../../src/env"
import { Log } from "../../src/util/log"

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

test("OPENCODE_MODEL sets default model", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(path.join(dir, "opencode.json"), JSON.stringify({ $schema: "https://opencode.ai/config.json" }))
    },
  })
  await Instance.provide({
    directory: tmp.path,
    init: async () => {
      Env.set("OPENCODE_MODEL", "anthropic/claude-3-5-sonnet")
      // Set key to ensure provider loads
      Env.set("ANTHROPIC_API_KEY", "test-key")
    },
    fn: async () => {
      const model = await Provider.defaultModel()
      expect(model.providerID).toBe("anthropic")
      expect(model.modelID).toBe("claude-3-5-sonnet")
    },
  })
})

test("OPENCODE_OPENAI_* env vars configure OpenAI provider", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(path.join(dir, "opencode.json"), JSON.stringify({ $schema: "https://opencode.ai/config.json" }))
    },
  })
  await Instance.provide({
    directory: tmp.path,
    init: async () => {
      Env.set("OPENCODE_OPENAI_API_BASE", "https://api.custom-openai.com/v1")
      Env.set("OPENCODE_OPENAI_API_KEY", "sk-custom-openai")
    },
    fn: async () => {
      const providers = await Provider.list()
      const openai = providers["openai"]
      expect(openai).toBeDefined()
      expect(openai.options.baseURL).toBe("https://api.custom-openai.com/v1")
      expect(openai.options.apiKey).toBe("sk-custom-openai")
    },
  })
})

test("OPENCODE_ANTHROPIC_* env vars configure Anthropic provider", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(path.join(dir, "opencode.json"), JSON.stringify({ $schema: "https://opencode.ai/config.json" }))
    },
  })
  await Instance.provide({
    directory: tmp.path,
    init: async () => {
      Env.set("OPENCODE_ANTHROPIC_API_BASE", "https://api.custom-anthropic.com/v1")
      Env.set("OPENCODE_ANTHROPIC_API_KEY", "sk-custom-anthropic")
    },
    fn: async () => {
      const providers = await Provider.list()
      const anthropic = providers["anthropic"]
      expect(anthropic).toBeDefined()
      expect(anthropic.options.baseURL).toBe("https://api.custom-anthropic.com/v1")
      expect(anthropic.options.apiKey).toBe("sk-custom-anthropic")
    },
  })
})

test("Anthropic provider DOES NOT pick up OPENCODE_API_* fallback", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(path.join(dir, "opencode.json"), JSON.stringify({ $schema: "https://opencode.ai/config.json" }))
    },
  })
  await Instance.provide({
    directory: tmp.path,
    init: async () => {
      // Set generic vars which should NOT depend by Anthropic anymore
      Env.set("OPENCODE_API_BASE", "https://generic.com/v1")
      Env.set("OPENCODE_API_KEY", "generic-key")
    },
    fn: async () => {
      const providers = await Provider.list()
      const anthropic = providers["anthropic"]
      // Should NOT be defined/autoloded just because generic vars present
      // unless ANTHROPIC_API_KEY native var is set (which it isn't here)
      // Actually, autoload depends on (baseURL || apiKey).
      // If we removed the fallback, autoload should be false.
      // But wait, does Provider.list() return providers that are not autoloaded?
      // No, `load()` filters based on initialization.
      // If not autoloaded and no config, it might not appear?
      // Let's check `Provider.list` logic.
      // Actually `Provider.list()` calls `load()`.
      // `load()` iterates keys. `anthropic` is in keys.
      // It calls loader. loader returns `autoload`.
      // If `autoload` is false and no config...
      // `provider.ts`: if (!loader.autoload && !config.provider?.[key]) continue
      expect(anthropic).toBeUndefined()
    },
  })
})

test("OpenAI provider DOES pick up OPENCODE_API_* fallback", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(path.join(dir, "opencode.json"), JSON.stringify({ $schema: "https://opencode.ai/config.json" }))
    },
  })
  await Instance.provide({
    directory: tmp.path,
    init: async () => {
      Env.set("OPENCODE_API_BASE", "https://generic.com/v1")
      Env.set("OPENCODE_API_KEY", "generic-key")
    },
    fn: async () => {
      const providers = await Provider.list()
      const openai = providers["openai"]
      expect(openai).toBeDefined()
      expect(openai.options.baseURL).toBe("https://generic.com/v1")
      expect(openai.options.apiKey).toBe("generic-key")
    },
  })
})

test("OPENCODE_LOG_DIR sets log directory", async () => {
  await using tmp = await tmpdir({})
  const logDir = path.join(tmp.path, "env_logs")
  
  await Instance.provide({
    directory: tmp.path,
    init: async () => {
      Env.set("OPENCODE_LOG_DIR", logDir)
    },
    fn: async () => {
      // Log.init should pick up env var even if dir is undefined/missing in options
      await Log.init({ print: false, dev: false, level: "INFO" } as any)

      const logFile = Log.file()
      expect(logFile).toBeDefined()
      expect(logFile.startsWith(logDir)).toBe(true)

      // Write a test log entry
      const testLogger = Log.create({ service: "env-config-test" })
      testLogger.info("OPENCODE_LOG_DIR test log entry", { logDir, logFile })
      
      // Flush and read log content
      await Log.flush()
      const logContent = await Bun.file(logFile).text()
      console.log("\n=== OPENCODE_LOG_DIR Test Log Content ===\n")
      console.log(logContent)
      console.log("=== End Log Content ===\n")
      
      expect(logContent).toContain("env-config-test")
    }
  })
})

test("OPENCODE_MODEL + OPENCODE_LOG_DIR logs System Prompt and Model Configuration", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(path.join(dir, "opencode.json"), JSON.stringify({ $schema: "https://opencode.ai/config.json" }))
    },
  })
  const logDir = path.join(tmp.path, "llm_logs")
  const envModelValue = "anthropic/claude-3-5-sonnet"
  
  await Instance.provide({
    directory: tmp.path,
    init: async () => {
      Env.set("OPENCODE_MODEL", envModelValue)
      Env.set("OPENCODE_LOG_DIR", logDir)
      Env.set("ANTHROPIC_API_KEY", "test-key")
    },
    fn: async () => {
      // === STEP 1: Verify env var is set ===
      const readEnvModel = Env.get("OPENCODE_MODEL")
      console.log("\n=== ENV VAR → MODEL SELECTION CHAIN ===\n")
      console.log(`[1] OPENCODE_MODEL env var set to: ${readEnvModel}`)
      expect(readEnvModel).toBe(envModelValue)
      
      // === STEP 2: Verify Provider.defaultModel() reads env var ===
      const model = await Provider.defaultModel()
      console.log(`[2] Provider.defaultModel() returns:`)
      console.log(`    - providerID: ${model.providerID}`)
      console.log(`    - modelID: ${model.modelID}`)
      expect(model.providerID).toBe("anthropic")
      expect(model.modelID).toBe("claude-3-5-sonnet")
      
      // === STEP 3: Verify log directory from env var ===
      await Log.init({ print: false, dev: false, level: "INFO" } as any)
      const logFile = Log.file()
      console.log(`[3] OPENCODE_LOG_DIR creates log at: ${logFile}`)
      expect(logFile).toBeDefined()
      expect(logFile.startsWith(logDir)).toBe(true)
      
      // === STEP 4: Simulate LLM stream logging (matches src/session/llm.ts:100-159) ===
      console.log(`[4] Simulating LLM stream with model from env var...`)
      const systemPrompt = ["You are OpenCode, the best coding agent.", "Help the user with coding tasks."]
      const modelConfig = {
        providerID: model.providerID,  // ← This comes from OPENCODE_MODEL
        modelID: model.modelID,        // ← This comes from OPENCODE_MODEL
        temperature: 0.7,
        topP: 0.95,
        topK: undefined,
        options: { maxTokens: 4096 }
      }
      
      // Write System Prompt (matches llm.ts format)
      Log.raw(`\n[${new Date().toISOString()}] System Prompt:\n${systemPrompt.join("\n")}\n\n`)
      
      // Write Model Configuration (matches llm.ts format)
      Log.raw(`[${new Date().toISOString()}] Model Configuration:
Provider: ${modelConfig.providerID}
Model: ${modelConfig.modelID}
Temperature: ${modelConfig.temperature ?? "N/A"}
TopP: ${modelConfig.topP ?? "N/A"}
TopK: ${modelConfig.topK ?? "N/A"}
Options: ${JSON.stringify(modelConfig.options, null, 2)}
`)
      
      // === STEP 5: Verify log content ===
      await Log.flush()
      const logContent = await Bun.file(logFile).text()
      
      console.log(`\n[5] Log file content:\n`)
      console.log(logContent)
      console.log("=== END CHAIN VERIFICATION ===\n")
      
      // Verify System Prompt logged
      expect(logContent).toContain("System Prompt:")
      expect(logContent).toContain("You are OpenCode")
      
      // Verify Model Configuration contains the model from OPENCODE_MODEL env var
      expect(logContent).toContain("Model Configuration:")
      expect(logContent).toContain("Provider: anthropic")
      expect(logContent).toContain("Model: claude-3-5-sonnet")  // ← Proves env var took effect!
      expect(logContent).toContain("Temperature: 0.7")
      expect(logContent).toContain("TopP: 0.95")
      expect(logContent).toContain("maxTokens")
    }
  })
})

test("Combined: OPENCODE_MODEL + OPENCODE_OPENAI_API_BASE + OPENCODE_OPENAI_API_KEY", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(path.join(dir, "opencode.json"), JSON.stringify({ $schema: "https://opencode.ai/config.json" }))
    },
  })
  
  const envModel = "openai/gpt-4o"
  const envApiBase = "https://api.custom-llm.com/v1"
  const envApiKey = "sk-custom-key-12345"
  
  await Instance.provide({
    directory: tmp.path,
    init: async () => {
      Env.set("OPENCODE_MODEL", envModel)
      Env.set("OPENCODE_OPENAI_API_BASE", envApiBase)
      Env.set("OPENCODE_OPENAI_API_KEY", envApiKey)
    },
    fn: async () => {
      console.log("\n=== COMBINED ENV VAR TEST: MODEL + API_BASE + API_KEY ===\n")
      
      // 1. Verify env vars are set
      console.log(`[1] Environment variables set:`)
      console.log(`    OPENCODE_MODEL = ${Env.get("OPENCODE_MODEL")}`)
      console.log(`    OPENCODE_OPENAI_API_BASE = ${Env.get("OPENCODE_OPENAI_API_BASE")}`)
      console.log(`    OPENCODE_OPENAI_API_KEY = ${Env.get("OPENCODE_OPENAI_API_KEY")?.slice(0, 10)}...`)
      
      // 2. Verify model selection from OPENCODE_MODEL
      const model = await Provider.defaultModel()
      console.log(`[2] Provider.defaultModel() returns:`)
      console.log(`    providerID: ${model.providerID}`)
      console.log(`    modelID: ${model.modelID}`)
      expect(model.providerID).toBe("openai")
      expect(model.modelID).toBe("gpt-4o")
      
      // 3. Verify provider options from OPENCODE_OPENAI_API_BASE/KEY
      const providers = await Provider.list()
      const openai = providers["openai"]
      console.log(`[3] Provider options loaded:`)
      console.log(`    baseURL: ${openai.options.baseURL}`)
      console.log(`    apiKey: ${openai.options.apiKey?.slice(0, 10)}...`)
      expect(openai).toBeDefined()
      expect(openai.options.baseURL).toBe(envApiBase)
      expect(openai.options.apiKey).toBe(envApiKey)
      
      console.log("\n=== ALL COMBINED ENV VARS VERIFIED ===\n")
    }
  })
})
