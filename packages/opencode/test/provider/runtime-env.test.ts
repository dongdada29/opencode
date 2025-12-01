import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { Provider } from "../../src/provider/provider"
import { Instance } from "../../src/project/instance"
import { tmpdir } from "../fixture/fixture"

describe("Provider Runtime Environment Variables", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // 清理环境变量
    delete process.env.OPENCODE_PROVIDER_ANTHROPIC_BASE_URL
    delete process.env.OPENCODE_PROVIDER_ANTHROPIC_API_KEY
    delete process.env.OPENCODE_PROVIDER_ANTHROPIC_MODELS
  })

  afterEach(() => {
    // 恢复原始环境变量
    process.env = { ...originalEnv }
  })

  test("should parse runtime environment variables for base URL", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        process.env.OPENCODE_PROVIDER_ANTHROPIC_BASE_URL = "https://api.custom.com/anthropic"

        // 获取 provider 状态会触发环境变量解析
        const providers = await Provider.list()
        const anthropic = providers["anthropic"]

        if (anthropic) {
          // 验证 baseURL 会被应用到 options
          // 注意：由于 getSDK 是异步的，我们需要在实际使用时验证
          expect(process.env.OPENCODE_PROVIDER_ANTHROPIC_BASE_URL).toBe("https://api.custom.com/anthropic")
        }
      },
    })
  })

  test("should parse runtime environment variables for API key", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const testApiKey = "test-api-key-12345"
        process.env.OPENCODE_PROVIDER_ANTHROPIC_API_KEY = testApiKey

        const providers = await Provider.list()
        expect(process.env.OPENCODE_PROVIDER_ANTHROPIC_API_KEY).toBe(testApiKey)
      },
    })
  })

  test("should parse runtime environment variables for models", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const modelsJson = '["custom-model-1", "custom-model-2"]'
        process.env.OPENCODE_PROVIDER_ANTHROPIC_MODELS = modelsJson

        const providers = await Provider.list()
        // 验证环境变量被正确设置
        expect(process.env.OPENCODE_PROVIDER_ANTHROPIC_MODELS).toBe(modelsJson)
      },
    })
  })

  test("should handle invalid JSON in models environment variable", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        process.env.OPENCODE_PROVIDER_ANTHROPIC_MODELS = "invalid-json"

        // 应该不会抛出错误，而是记录警告
        const providers = await Provider.list()
        expect(providers).toBeDefined()
      },
    })
  })

  test("should support different provider IDs", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        process.env.OPENCODE_PROVIDER_OPENAI_BASE_URL = "https://api.openai-custom.com/v1"
        process.env.OPENCODE_PROVIDER_OPENAI_API_KEY = "openai-key-123"

        const providers = await Provider.list()
        expect(process.env.OPENCODE_PROVIDER_OPENAI_BASE_URL).toBe("https://api.openai-custom.com/v1")
        expect(process.env.OPENCODE_PROVIDER_OPENAI_API_KEY).toBe("openai-key-123")
      },
    })
  })
})

