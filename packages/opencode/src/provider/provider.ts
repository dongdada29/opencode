import z from "zod"
import fuzzysort from "fuzzysort"
import { Config } from "../config/config"
import { mergeDeep, sortBy } from "remeda"
import { NoSuchModelError, type LanguageModel, type Provider as SDK } from "ai"
import { Log } from "../util/log"
import { BunProc } from "../bun"
import { Plugin } from "../plugin"
import { ModelsDev } from "./models"
import { NamedError } from "@opencode-ai/util/error"
import { Auth } from "../auth"
import { Instance } from "../project/instance"
import { Flag } from "../flag/flag"
import { iife } from "@/util/iife"

// Direct imports for bundled providers
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createAzure } from "@ai-sdk/azure"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createVertex } from "@ai-sdk/google-vertex"
import { createVertexAnthropic } from "@ai-sdk/google-vertex/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { createOpenaiCompatible as createGitHubCopilotOpenAICompatible } from "./sdk/openai-compatible/src"

export namespace Provider {
  const log = Log.create({ service: "provider" })

  const BUNDLED_PROVIDERS: Record<string, (options: any) => SDK> = {
    "@ai-sdk/amazon-bedrock": createAmazonBedrock,
    "@ai-sdk/anthropic": createAnthropic,
    "@ai-sdk/azure": createAzure,
    "@ai-sdk/google": createGoogleGenerativeAI,
    "@ai-sdk/google-vertex": createVertex,
    "@ai-sdk/google-vertex/anthropic": createVertexAnthropic,
    "@ai-sdk/openai": createOpenAI,
    "@ai-sdk/openai-compatible": createOpenAICompatible,
    "@openrouter/ai-sdk-provider": createOpenRouter,
    // @ts-ignore (TODO: kill this code so we dont have to maintain it)
    "@ai-sdk/github-copilot": createGitHubCopilotOpenAICompatible,
  }

  type CustomLoader = (provider: ModelsDev.Provider) => Promise<{
    autoload: boolean
    getModel?: (sdk: any, modelID: string, options?: Record<string, any>) => Promise<any>
    options?: Record<string, any>
  }>

  type Source = "env" | "config" | "custom" | "api"

  const CUSTOM_LOADERS: Record<string, CustomLoader> = {
    async anthropic(provider) {
      const config = await Config.get()
      const configProvider = config.provider?.anthropic

      const options: Record<string, any> = {
        headers: {
          "anthropic-beta":
            "claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14",
        },
      }

      // 优先从环境变量读取，然后从配置文件读取（配置文件优先级更高）
      // 支持配置自定义API URL (baseURL)
      // 环境变量已在 load env 部分处理，这里只处理配置文件
      if (configProvider?.options?.baseURL) {
        options.baseURL = configProvider.options.baseURL
      } else if (process.env["ANTHROPIC_BASE_URL"]) {
        // 如果配置文件中没有，使用环境变量
        options.baseURL = process.env["ANTHROPIC_BASE_URL"]
      }

      // 支持配置自定义API Key
      // 环境变量已在 load env 部分处理，这里只处理配置文件
      if (configProvider?.options?.apiKey) {
        options.apiKey = configProvider.options.apiKey
      } else {
        // 如果配置文件中没有，尝试从环境变量读取
        const envApiKey = process.env["ANTHROPIC_AUTH_TOKEN"] || process.env["ANTHROPIC_API_KEY"]
        if (envApiKey) {
          options.apiKey = envApiKey
        }
      }

      // 支持配置自定义headers
      if (configProvider?.options?.headers) {
        options.headers = {
          ...options.headers,
          ...configProvider.options.headers,
        }
      }

      // 支持模型映射环境变量
      const modelMappings: Record<string, string> = {}
      
      // 从环境变量读取模型映射
      if (process.env["ANTHROPIC_DEFAULT_HAIKU_MODEL"]) {
        modelMappings.haiku = process.env["ANTHROPIC_DEFAULT_HAIKU_MODEL"]
      }
      if (process.env["ANTHROPIC_DEFAULT_OPUS_MODEL"]) {
        modelMappings.opus = process.env["ANTHROPIC_DEFAULT_OPUS_MODEL"]
      }
      if (process.env["ANTHROPIC_DEFAULT_SONNET_MODEL"]) {
        modelMappings.sonnet = process.env["ANTHROPIC_DEFAULT_SONNET_MODEL"]
      }
      if (process.env["ANTHROPIC_MODEL"]) {
        modelMappings.default = process.env["ANTHROPIC_MODEL"]
      }

      // 从配置文件读取模型映射
      if (configProvider?.options?.defaultHaikuModel) {
        modelMappings.haiku = configProvider.options.defaultHaikuModel
      }
      if (configProvider?.options?.defaultOpusModel) {
        modelMappings.opus = configProvider.options.defaultOpusModel
      }
      if (configProvider?.options?.defaultSonnetModel) {
        modelMappings.sonnet = configProvider.options.defaultSonnetModel
      }
      if (configProvider?.options?.defaultModel) {
        modelMappings.default = configProvider.options.defaultModel
      }

      return {
        autoload: false,
        options,
        async getModel(sdk: any, modelID: string, _options?: Record<string, any>) {
          // 应用模型映射
          let mappedModelID = modelID
          const lowerModelID = modelID.toLowerCase()

          // 检查是否是 haiku 模型（包括各种变体）
          if (modelMappings.haiku && (lowerModelID.includes("haiku") || lowerModelID.includes("3-5-haiku") || lowerModelID.includes("3.5-haiku"))) {
            mappedModelID = modelMappings.haiku
            log.info("model mapping", { from: modelID, to: mappedModelID, type: "haiku" })
          }
          // 检查是否是 opus 模型
          else if (modelMappings.opus && lowerModelID.includes("opus")) {
            mappedModelID = modelMappings.opus
            log.info("model mapping", { from: modelID, to: mappedModelID, type: "opus" })
          }
          // 检查是否是 sonnet 模型（包括各种变体）
          else if (modelMappings.sonnet && lowerModelID.includes("sonnet")) {
            mappedModelID = modelMappings.sonnet
            log.info("model mapping", { from: modelID, to: mappedModelID, type: "sonnet" })
          }
          // 如果没有匹配到特定类型，使用默认模型映射
          else if (modelMappings.default) {
            mappedModelID = modelMappings.default
            log.info("model mapping", { from: modelID, to: mappedModelID, type: "default" })
          }

          return sdk.languageModel(mappedModelID)
        },
      }
    },
    async opencode(input) {
      const hasKey = await (async () => {
        if (input.env.some((item) => process.env[item])) return true
        if (await Auth.get(input.id)) return true
        return false
      })()

      if (!hasKey) {
        for (const [key, value] of Object.entries(input.models)) {
          if (value.cost.input === 0) continue
          delete input.models[key]
        }
      }

      return {
        autoload: Object.keys(input.models).length > 0,
        options: hasKey ? {} : { apiKey: "public" },
      }
    },
    openai: async () => {
      return {
        autoload: false,
        async getModel(sdk: any, modelID: string, _options?: Record<string, any>) {
          return sdk.responses(modelID)
        },
        options: {},
      }
    },
    "github-copilot": async () => {
      return {
        autoload: false,
        async getModel(sdk: any, modelID: string, _options?: Record<string, any>) {
          if (modelID.includes("gpt-5")) {
            return sdk.responses(modelID)
          }
          return sdk.chat(modelID)
        },
        options: {},
      }
    },
    "github-copilot-enterprise": async () => {
      return {
        autoload: false,
        async getModel(sdk: any, modelID: string, _options?: Record<string, any>) {
          if (modelID.includes("gpt-5")) {
            return sdk.responses(modelID)
          }
          return sdk.chat(modelID)
        },
        options: {},
      }
    },
    azure: async () => {
      return {
        autoload: false,
        async getModel(sdk: any, modelID: string, options?: Record<string, any>) {
          if (options?.["useCompletionUrls"]) {
            return sdk.chat(modelID)
          } else {
            return sdk.responses(modelID)
          }
        },
        options: {},
      }
    },
    "azure-cognitive-services": async () => {
      const resourceName = process.env["AZURE_COGNITIVE_SERVICES_RESOURCE_NAME"]
      return {
        autoload: false,
        async getModel(sdk: any, modelID: string, options?: Record<string, any>) {
          if (options?.["useCompletionUrls"]) {
            return sdk.chat(modelID)
          } else {
            return sdk.responses(modelID)
          }
        },
        options: {
          baseURL: resourceName ? `https://${resourceName}.cognitiveservices.azure.com/openai` : undefined,
        },
      }
    },
    "amazon-bedrock": async () => {
      if (!process.env["AWS_PROFILE"] && !process.env["AWS_ACCESS_KEY_ID"] && !process.env["AWS_BEARER_TOKEN_BEDROCK"])
        return { autoload: false }

      const region = process.env["AWS_REGION"] ?? "us-east-1"

      const { fromNodeProviderChain } = await import(await BunProc.install("@aws-sdk/credential-providers"))
      return {
        autoload: true,
        options: {
          region,
          credentialProvider: fromNodeProviderChain(),
        },
        async getModel(sdk: any, modelID: string, _options?: Record<string, any>) {
          // Skip region prefixing if model already has global prefix
          if (modelID.startsWith("global.")) {
            return sdk.languageModel(modelID)
          }

          let regionPrefix = region.split("-")[0]

          switch (regionPrefix) {
            case "us": {
              const modelRequiresPrefix = [
                "nova-micro",
                "nova-lite",
                "nova-pro",
                "nova-premier",
                "claude",
                "deepseek",
              ].some((m) => modelID.includes(m))
              const isGovCloud = region.startsWith("us-gov")
              if (modelRequiresPrefix && !isGovCloud) {
                modelID = `${regionPrefix}.${modelID}`
              }
              break
            }
            case "eu": {
              const regionRequiresPrefix = [
                "eu-west-1",
                "eu-west-2",
                "eu-west-3",
                "eu-north-1",
                "eu-central-1",
                "eu-south-1",
                "eu-south-2",
              ].some((r) => region.includes(r))
              const modelRequiresPrefix = ["claude", "nova-lite", "nova-micro", "llama3", "pixtral"].some((m) =>
                modelID.includes(m),
              )
              if (regionRequiresPrefix && modelRequiresPrefix) {
                modelID = `${regionPrefix}.${modelID}`
              }
              break
            }
            case "ap": {
              const isAustraliaRegion = ["ap-southeast-2", "ap-southeast-4"].includes(region)
              if (
                isAustraliaRegion &&
                ["anthropic.claude-sonnet-4-5", "anthropic.claude-haiku"].some((m) => modelID.includes(m))
              ) {
                regionPrefix = "au"
                modelID = `${regionPrefix}.${modelID}`
              } else {
                const modelRequiresPrefix = ["claude", "nova-lite", "nova-micro", "nova-pro"].some((m) =>
                  modelID.includes(m),
                )
                if (modelRequiresPrefix) {
                  regionPrefix = "apac"
                  modelID = `${regionPrefix}.${modelID}`
                }
              }
              break
            }
          }

          return sdk.languageModel(modelID)
        },
      }
    },
    openrouter: async () => {
      return {
        autoload: false,
        options: {
          headers: {
            "HTTP-Referer": "https://opencode.ai/",
            "X-Title": "opencode",
          },
        },
      }
    },
    vercel: async () => {
      return {
        autoload: false,
        options: {
          headers: {
            "http-referer": "https://opencode.ai/",
            "x-title": "opencode",
          },
        },
      }
    },
    "google-vertex": async () => {
      const project = process.env["GOOGLE_CLOUD_PROJECT"] ?? process.env["GCP_PROJECT"] ?? process.env["GCLOUD_PROJECT"]
      const location = process.env["GOOGLE_CLOUD_LOCATION"] ?? process.env["VERTEX_LOCATION"] ?? "us-east5"
      const autoload = Boolean(project)
      if (!autoload) return { autoload: false }
      return {
        autoload: true,
        options: {
          project,
          location,
        },
        async getModel(sdk: any, modelID: string) {
          const id = String(modelID).trim()
          return sdk.languageModel(id)
        },
      }
    },
    "google-vertex-anthropic": async () => {
      const project = process.env["GOOGLE_CLOUD_PROJECT"] ?? process.env["GCP_PROJECT"] ?? process.env["GCLOUD_PROJECT"]
      const location = process.env["GOOGLE_CLOUD_LOCATION"] ?? process.env["VERTEX_LOCATION"] ?? "global"
      const autoload = Boolean(project)
      if (!autoload) return { autoload: false }
      return {
        autoload: true,
        options: {
          project,
          location,
        },
        async getModel(sdk: any, modelID: string) {
          const id = String(modelID).trim()
          return sdk.languageModel(id)
        },
      }
    },
    zenmux: async () => {
      return {
        autoload: false,
        options: {
          headers: {
            "HTTP-Referer": "https://opencode.ai/",
            "X-Title": "opencode",
          },
        },
      }
    },
  }

  const state = Instance.state(async () => {
    using _ = log.time("state")
    const config = await Config.get()
    const database = await ModelsDev.get()

    const disabled = new Set(config.disabled_providers ?? [])
    const enabled = config.enabled_providers ? new Set(config.enabled_providers) : null

    function isProviderAllowed(providerID: string): boolean {
      if (enabled && !enabled.has(providerID)) return false
      if (disabled.has(providerID)) return false
      return true
    }

    const providers: {
      [providerID: string]: {
        source: Source
        info: ModelsDev.Provider
        getModel?: (sdk: any, modelID: string, options?: Record<string, any>) => Promise<any>
        options: Record<string, any>
      }
    } = {}
    const models = new Map<
      string,
      {
        providerID: string
        modelID: string
        info: ModelsDev.Model
        language: LanguageModel
        npm?: string
      }
    >()
    const sdk = new Map<number, SDK>()
    // Maps `${provider}/${key}` to the provider’s actual model ID for custom aliases.
    const realIdByKey = new Map<string, string>()

    log.info("init")

    function mergeProvider(
      id: string,
      options: Record<string, any>,
      source: Source,
      getModel?: (sdk: any, modelID: string, options?: Record<string, any>) => Promise<any>,
    ) {
      const provider = providers[id]
      if (!provider) {
        const info = database[id]
        if (!info) return
        if (info.api && !options["baseURL"]) options["baseURL"] = info.api
        providers[id] = {
          source,
          info,
          options,
          getModel,
        }
        return
      }
      provider.options = mergeDeep(provider.options, options)
      provider.source = source
      provider.getModel = getModel ?? provider.getModel
    }

    const configProviders = Object.entries(config.provider ?? {})

    // Add GitHub Copilot Enterprise provider that inherits from GitHub Copilot
    if (database["github-copilot"]) {
      const githubCopilot = database["github-copilot"]
      database["github-copilot-enterprise"] = {
        ...githubCopilot,
        id: "github-copilot-enterprise",
        name: "GitHub Copilot Enterprise",
        // Enterprise uses a different API endpoint - will be set dynamically based on auth
        api: undefined,
      }
    }

    for (const [providerID, provider] of configProviders) {
      const existing = database[providerID]
      const parsed: ModelsDev.Provider = {
        id: providerID,
        npm: provider.npm ?? existing?.npm,
        name: provider.name ?? existing?.name ?? providerID,
        env: provider.env ?? existing?.env ?? [],
        api: provider.api ?? existing?.api,
        models: existing?.models ?? {},
      }

      for (const [modelID, model] of Object.entries(provider.models ?? {})) {
        const existing = parsed.models[model.id ?? modelID]
        const name = iife(() => {
          if (model.name) return model.name
          if (model.id && model.id !== modelID) return modelID
          return existing?.name ?? modelID
        })
        const parsedModel: ModelsDev.Model = {
          id: modelID,
          name,
          release_date: model.release_date ?? existing?.release_date,
          attachment: model.attachment ?? existing?.attachment ?? false,
          reasoning: model.reasoning ?? existing?.reasoning ?? false,
          temperature: model.temperature ?? existing?.temperature ?? false,
          tool_call: model.tool_call ?? existing?.tool_call ?? true,
          cost:
            !model.cost && !existing?.cost
              ? {
                  input: 0,
                  output: 0,
                  cache_read: 0,
                  cache_write: 0,
                }
              : {
                  cache_read: 0,
                  cache_write: 0,
                  ...existing?.cost,
                  ...model.cost,
                },
          options: {
            ...existing?.options,
            ...model.options,
          },
          limit: model.limit ??
            existing?.limit ?? {
              context: 0,
              output: 0,
            },
          modalities: model.modalities ??
            existing?.modalities ?? {
              input: ["text"],
              output: ["text"],
            },
          headers: model.headers,
          provider: model.provider ?? existing?.provider,
        }
        if (model.id && model.id !== modelID) {
          realIdByKey.set(`${providerID}/${modelID}`, model.id)
        }
        parsed.models[modelID] = parsedModel
      }

      database[providerID] = parsed
    }

    // load env
    for (const [providerID, provider] of Object.entries(database)) {
      if (disabled.has(providerID)) continue
      const apiKey = provider.env.map((item) => process.env[item]).at(0)

      const envOptions: Record<string, any> = {}

      // 支持从环境变量读取API Key
      if (apiKey) {
        envOptions.apiKey = apiKey
      }

      // 支持三方兼容服务的baseURL
      if (process.env[`${providerID.toUpperCase()}_BASE_URL`]) {
        envOptions.baseURL = process.env[`${providerID.toUpperCase()}_BASE_URL`]
      }

      // Anthropic兼容的baseURL环境变量
      if (providerID === "anthropic" && process.env["ANTHROPIC_BASE_URL"]) {
        envOptions.baseURL = process.env["ANTHROPIC_BASE_URL"]
      }

      // Anthropic兼容的API Key环境变量（支持多种命名）
      if (providerID === "anthropic") {
        const anthropicApiKey = process.env["ANTHROPIC_AUTH_TOKEN"] || process.env["ANTHROPIC_API_KEY"]
        if (anthropicApiKey) {
          envOptions.apiKey = anthropicApiKey
        }
      }

      // 支持API_TIMEOUT_MS环境变量
      if (process.env["API_TIMEOUT_MS"]) {
        const timeout = parseInt(process.env["API_TIMEOUT_MS"])
        if (!isNaN(timeout)) {
          envOptions.timeout = timeout
        }
      }

      if (Object.keys(envOptions).length > 0) {
        mergeProvider(providerID, envOptions, "env")
      }
    }

    // load apikeys
    for (const [providerID, provider] of Object.entries(await Auth.all())) {
      if (disabled.has(providerID)) continue
      if (provider.type === "api") {
        const options: Record<string, any> = { apiKey: provider.key }

        // 支持从认证配置中读取 baseURL (用于三方兼容服务)
        if (provider.baseURL) {
          options.baseURL = provider.baseURL
        }

        // 支持从认证配置中读取其他选项
        if (provider.timeout) {
          options.timeout = provider.timeout
        }

        if (provider.headers) {
          options.headers = provider.headers
        }

        mergeProvider(providerID, options, "api")
      }
    }

    for (const plugin of await Plugin.list()) {
      if (!plugin.auth) continue
      const providerID = plugin.auth.provider
      if (disabled.has(providerID)) continue

      // For github-copilot plugin, check if auth exists for either github-copilot or github-copilot-enterprise
      let hasAuth = false
      const auth = await Auth.get(providerID)
      if (auth) hasAuth = true

      // Special handling for github-copilot: also check for enterprise auth
      if (providerID === "github-copilot" && !hasAuth) {
        const enterpriseAuth = await Auth.get("github-copilot-enterprise")
        if (enterpriseAuth) hasAuth = true
      }

      if (!hasAuth) continue
      if (!plugin.auth.loader) continue

      // Load for the main provider if auth exists
      if (auth) {
        const options = await plugin.auth.loader(() => Auth.get(providerID) as any, database[plugin.auth.provider])
        mergeProvider(plugin.auth.provider, options ?? {}, "custom")
      }

      // If this is github-copilot plugin, also register for github-copilot-enterprise if auth exists
      if (providerID === "github-copilot") {
        const enterpriseProviderID = "github-copilot-enterprise"
        if (!disabled.has(enterpriseProviderID)) {
          const enterpriseAuth = await Auth.get(enterpriseProviderID)
          if (enterpriseAuth) {
            const enterpriseOptions = await plugin.auth.loader(
              () => Auth.get(enterpriseProviderID) as any,
              database[enterpriseProviderID],
            )
            mergeProvider(enterpriseProviderID, enterpriseOptions ?? {}, "custom")
          }
        }
      }
    }

    for (const [providerID, fn] of Object.entries(CUSTOM_LOADERS)) {
      if (disabled.has(providerID)) continue
      const result = await fn(database[providerID])
      if (result && (result.autoload || providers[providerID])) {
        mergeProvider(providerID, result.options ?? {}, "custom", result.getModel)
      }
    }

    // load config
    for (const [providerID, provider] of configProviders) {
      mergeProvider(providerID, provider.options ?? {}, "config")
    }

    for (const [providerID, provider] of Object.entries(providers)) {
      if (!isProviderAllowed(providerID)) {
        delete providers[providerID]
        continue
      }

      if (providerID === "github-copilot") {
        provider.info.npm = "@ai-sdk/github-copilot"
      }

      const configProvider = config.provider?.[providerID]
      const filteredModels = Object.fromEntries(
        Object.entries(provider.info.models)
          // Filter out blacklisted models
          .filter(
            ([modelID]) =>
              modelID !== "gpt-5-chat-latest" && !(providerID === "openrouter" && modelID === "openai/gpt-5-chat"),
          )
          // Filter out experimental models
          .filter(
            ([, model]) =>
              ((!model.experimental && model.status !== "alpha") || Flag.OPENCODE_ENABLE_EXPERIMENTAL_MODELS) &&
              model.status !== "deprecated",
          )
          // Filter by provider's whitelist/blacklist from config
          .filter(([modelID]) => {
            if (!configProvider) return true

            return (
              (!configProvider.blacklist || !configProvider.blacklist.includes(modelID)) &&
              (!configProvider.whitelist || configProvider.whitelist.includes(modelID))
            )
          }),
      )

      provider.info.models = filteredModels

      if (Object.keys(provider.info.models).length === 0) {
        delete providers[providerID]
        continue
      }

      log.info("found", { providerID, npm: provider.info.npm })
    }

    return {
      models,
      providers,
      sdk,
      realIdByKey,
    }
  })

  export async function list() {
    return state().then((state) => state.providers)
  }

  // 解析运行时环境变量配置
  function parseRuntimeEnvConfig(providerID: string): Record<string, any> {
    const envOptions: Record<string, any> = {}
    const upperProviderID = providerID.toUpperCase().replace(/[^A-Z0-9]/g, "_")

    // 支持 OPENCODE_PROVIDER_{PROVIDER_ID}_BASE_URL
    const baseURLKey = `OPENCODE_PROVIDER_${upperProviderID}_BASE_URL`
    const baseURL = process.env[baseURLKey]
    if (baseURL) {
      envOptions.baseURL = baseURL
    }

    // 支持 OPENCODE_PROVIDER_{PROVIDER_ID}_API_KEY
    const apiKeyKey = `OPENCODE_PROVIDER_${upperProviderID}_API_KEY`
    const apiKey = process.env[apiKeyKey]
    if (apiKey) {
      envOptions.apiKey = apiKey
    }

    // 支持 OPENCODE_PROVIDER_{PROVIDER_ID}_MODELS (JSON 格式)
    const modelsKey = `OPENCODE_PROVIDER_${upperProviderID}_MODELS`
    const modelsStr = process.env[modelsKey]
    if (modelsStr) {
      try {
        const models = JSON.parse(modelsStr)
        if (Array.isArray(models)) {
          envOptions.models = models
        }
      } catch (e) {
        log.warn("failed to parse models from environment variable", {
          providerID,
          key: modelsKey,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }

    return envOptions
  }

  async function getSDK(provider: ModelsDev.Provider, model: ModelsDev.Model) {
    return (async () => {
      using _ = log.time("getSDK", {
        providerID: provider.id,
      })
      const s = await state()
      const pkg = model.provider?.npm ?? provider.npm ?? provider.id
      const options = { ...s.providers[provider.id]?.options }
      
      // 应用运行时环境变量配置（最高优先级）
      const runtimeEnvConfig = parseRuntimeEnvConfig(provider.id)
      Object.assign(options, runtimeEnvConfig)
      
      if (pkg.includes("@ai-sdk/openai-compatible") && options["includeUsage"] === undefined) {
        options["includeUsage"] = true
      }

      const key = Bun.hash.xxHash32(JSON.stringify({ pkg, options }))
      const existing = s.sdk.get(key)
      if (existing) return existing

      const customFetch = options["fetch"]

      options["fetch"] = async (input: any, init?: BunFetchRequestInit) => {
        // Preserve custom fetch if it exists, wrap it with timeout logic
        const fetchFn = customFetch ?? fetch
        const opts = init ?? {}

        if (options["timeout"] !== undefined && options["timeout"] !== null) {
          const signals: AbortSignal[] = []
          if (opts.signal) signals.push(opts.signal)
          if (options["timeout"] !== false) signals.push(AbortSignal.timeout(options["timeout"]))

          const combined = signals.length > 1 ? AbortSignal.any(signals) : signals[0]

          opts.signal = combined
        }

        return fetchFn(input, {
          ...opts,
          // @ts-ignore see here: https://github.com/oven-sh/bun/issues/16682
          timeout: false,
        })
      }

      // Special case: google-vertex-anthropic uses a subpath import
      const bundledKey = provider.id === "google-vertex-anthropic" ? "@ai-sdk/google-vertex/anthropic" : pkg
      const bundledFn = BUNDLED_PROVIDERS[bundledKey]
      if (bundledFn) {
        log.info("using bundled provider", { providerID: provider.id, pkg: bundledKey })
        const loaded = bundledFn({
          name: provider.id,
          ...options,
        })
        s.sdk.set(key, loaded)
        return loaded as SDK
      }

      let installedPath: string
      if (!pkg.startsWith("file://")) {
        installedPath = await BunProc.install(pkg, "latest")
      } else {
        log.info("loading local provider", { pkg })
        installedPath = pkg
      }

      const mod = await import(installedPath)

      const fn = mod[Object.keys(mod).find((key) => key.startsWith("create"))!]
      const loaded = fn({
        name: provider.id,
        ...options,
      })
      s.sdk.set(key, loaded)
      return loaded as SDK
    })().catch((e) => {
      throw new InitError({ providerID: provider.id }, { cause: e })
    })
  }

  export async function getProvider(providerID: string) {
    return state().then((s) => s.providers[providerID])
  }

  export async function getModel(providerID: string, modelID: string) {
    const key = `${providerID}/${modelID}`
    const s = await state()
    if (s.models.has(key)) return s.models.get(key)!

    log.info("getModel", {
      providerID,
      modelID,
    })

    const provider = s.providers[providerID]
    if (!provider) {
      const availableProviders = Object.keys(s.providers)
      const matches = fuzzysort.go(providerID, availableProviders, { limit: 3, threshold: -10000 })
      const suggestions = matches.map((m) => m.target)
      throw new ModelNotFoundError({ providerID, modelID, suggestions })
    }

    const info = provider.info.models[modelID]
    if (!info) {
      const availableModels = Object.keys(provider.info.models)
      const matches = fuzzysort.go(modelID, availableModels, { limit: 3, threshold: -10000 })
      const suggestions = matches.map((m) => m.target)
      throw new ModelNotFoundError({ providerID, modelID, suggestions })
    }

    const sdk = await getSDK(provider.info, info)

    try {
      const keyReal = `${providerID}/${modelID}`
      const realID = s.realIdByKey.get(keyReal) ?? info.id
      const language = provider.getModel
        ? await provider.getModel(sdk, realID, provider.options)
        : sdk.languageModel(realID)
      log.info("found", { providerID, modelID })
      s.models.set(key, {
        providerID,
        modelID,
        info,
        language,
        npm: info.provider?.npm ?? provider.info.npm,
      })
      return {
        modelID,
        providerID,
        info,
        language,
        npm: info.provider?.npm ?? provider.info.npm,
      }
    } catch (e) {
      if (e instanceof NoSuchModelError)
        throw new ModelNotFoundError(
          {
            modelID: modelID,
            providerID,
          },
          { cause: e },
        )
      throw e
    }
  }

  export async function closest(providerID: string, query: string[]) {
    const s = await state()
    const provider = s.providers[providerID]
    if (!provider) return undefined
    for (const item of query) {
      for (const modelID of Object.keys(provider.info.models)) {
        if (modelID.includes(item))
          return {
            providerID,
            modelID,
          }
      }
    }
  }

  export async function getSmallModel(providerID: string) {
    const cfg = await Config.get()

    if (cfg.small_model) {
      const parsed = parseModel(cfg.small_model)
      return getModel(parsed.providerID, parsed.modelID)
    }

    const provider = await state().then((state) => state.providers[providerID])
    if (provider) {
      let priority = [
        "claude-haiku-4-5",
        "claude-haiku-4.5",
        "3-5-haiku",
        "3.5-haiku",
        "gemini-2.5-flash",
        "gpt-5-nano",
      ]
      // claude-haiku-4.5 is considered a premium model in github copilot, we shouldn't use premium requests for title gen
      if (providerID === "github-copilot") {
        priority = priority.filter((m) => m !== "claude-haiku-4.5")
      }
      if (providerID.startsWith("opencode")) {
        priority = ["gpt-5-nano"]
      }
      for (const item of priority) {
        for (const model of Object.keys(provider.info.models)) {
          if (model.includes(item)) return getModel(providerID, model)
        }
      }
    }

    // Check if opencode provider is available before using it
    const opencodeProvider = await state().then((state) => state.providers["opencode"])
    if (opencodeProvider && opencodeProvider.info.models["gpt-5-nano"]) {
      return getModel("opencode", "gpt-5-nano")
    }

    return undefined
  }

  const priority = ["gpt-5", "claude-sonnet-4", "big-pickle", "gemini-3-pro"]
  export function sort(models: ModelsDev.Model[]) {
    return sortBy(
      models,
      [(model) => priority.findIndex((filter) => model.id.includes(filter)), "desc"],
      [(model) => (model.id.includes("latest") ? 0 : 1), "asc"],
      [(model) => model.id, "desc"],
    )
  }

  export async function defaultModel() {
    const cfg = await Config.get()
    if (cfg.model) return parseModel(cfg.model)

    const provider = await list()
      .then((val) => Object.values(val))
      .then((x) => x.find((p) => !cfg.provider || Object.keys(cfg.provider).includes(p.info.id)))
    if (!provider) throw new Error("no providers found")
    const [model] = sort(Object.values(provider.info.models))
    if (!model) throw new Error("no models found")
    return {
      providerID: provider.info.id,
      modelID: model.id,
    }
  }

  export function parseModel(model: string) {
    const [providerID, ...rest] = model.split("/")
    return {
      providerID: providerID,
      modelID: rest.join("/"),
    }
  }

  export const ModelNotFoundError = NamedError.create(
    "ProviderModelNotFoundError",
    z.object({
      providerID: z.string(),
      modelID: z.string(),
      suggestions: z.array(z.string()).optional(),
    }),
  )

  export const InitError = NamedError.create(
    "ProviderInitError",
    z.object({
      providerID: z.string(),
    }),
  )
}
