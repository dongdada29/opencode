import { Global } from "../global"
import { Log } from "../util/log"
import path from "path"
import z from "zod"
import { data } from "./models-macro" with { type: "macro" }
import { Flag } from "../flag/flag"
import { fetchModelsFromSource } from "./models-source"

export namespace ModelsDev {
  const log = Log.create({ service: "models.dev" })
  const filepath = path.join(Global.Path.cache, "models.json")
  const bundledPath = path.join(__dirname, "../../assets/models.json")

  export const Model = z.object({
    id: z.string(),
    name: z.string(),
    family: z.string().optional(),
    release_date: z.string(),
    attachment: z.boolean(),
    reasoning: z.boolean(),
    temperature: z.boolean(),
    tool_call: z.boolean(),
    interleaved: z
      .union([
        z.literal(true),
        z
          .object({
            field: z.enum(["reasoning_content", "reasoning_details"]),
          })
          .strict(),
      ])
      .optional(),
    cost: z
      .object({
        input: z.number(),
        output: z.number(),
        cache_read: z.number().optional(),
        cache_write: z.number().optional(),
      })
      .optional(),
    limit: z.object({
      context: z.number(),
      input: z.number().optional(),
      output: z.number(),
    }),
    modalities: z
      .object({
        input: z.array(z.enum(["text", "api", "image", "video", "pdf"])),
        output: z.array(z.enum(["text", "api", "image", "video", "pdf"])),
      })
      .optional(),
    experimental: z.boolean().optional(),
    status: z.enum(["alpha", "beta", "deprecated"]).optional(),
    options: z.record(z.string(), z.any()),
    headers: z.record(z.string(), z.string()).optional(),
    provider: z.object({ npm: z.string() }).optional(),
    variants: z.record(z.string(), z.record(z.string(), z.any())).optional(),
  })
  export type Model = z.infer<typeof Model>

  export const Provider = z.object({
    api: z.string().optional(),
    name: z.string(),
    env: z.array(z.string()),
    id: z.string(),
    npm: z.string().optional(),
    models: z.record(z.string(), Model),
  })

  export type Provider = z.infer<typeof Provider>

  export async function get() {
    const startedAt = Date.now()
    refresh()
    const result = await fetchModelsFromSource({
      cachePath: filepath,
      bundledPath,
      macroData: typeof data === "function" ? data : undefined,
    })
    if (!result.ok) {
      log.error("models.get.all_sources_failed", {
        totalMs: Date.now() - startedAt,
        source: result.source,
      })
      throw new Error("No models data available: cache, macro, bundled asset, and network all unavailable")
    }
    const providers = JSON.parse(result.data) as Record<string, Provider>
    log.info("models.get", {
      source: result.source,
      providerCount: Object.keys(providers).length,
      totalMs: Date.now() - startedAt,
    })
    return providers
  }

  export async function refresh() {
    if (Flag.OPENCODE_DISABLE_MODELS_FETCH) return
    const refreshStart = Date.now()

    // Refresh uses local sources only — no network fetch
    const result = await fetchModelsFromSource({
      cachePath: filepath,
      bundledPath,
      skipCache: true,
      skipNetwork: true,
    })

    if (!result.ok) {
      log.warn("models.refresh.skipped", {
        elapsedMs: Date.now() - refreshStart,
        source: result.source,
      })
      return
    }

    const file = Bun.file(filepath)
    await Bun.write(file, result.data)
    log.info("models.refresh.done", {
      source: result.source,
      elapsedMs: Date.now() - refreshStart,
      bytes: result.data.length,
      filepath,
    })
  }
}

setInterval(() => ModelsDev.refresh(), 60 * 1000 * 60).unref()
