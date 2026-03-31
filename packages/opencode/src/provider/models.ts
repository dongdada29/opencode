import { Global } from "../global"
import { Log } from "../util/log"
import path from "path"
import z from "zod"
import { data } from "./models-macro" with { type: "macro" }
import { Installation } from "../installation"
import { Flag } from "../flag/flag"

export namespace ModelsDev {
  const log = Log.create({ service: "models.dev" })
  const filepath = path.join(Global.Path.cache, "models.json")

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
        context_over_200k: z
          .object({
            input: z.number(),
            output: z.number(),
            cache_read: z.number().optional(),
            cache_write: z.number().optional(),
          })
          .optional(),
      })
      .optional(),
    limit: z.object({
      context: z.number(),
      input: z.number().optional(),
      output: z.number(),
    }),
    modalities: z
      .object({
        input: z.array(z.enum(["text", "audio", "image", "video", "pdf"])),
        output: z.array(z.enum(["text", "audio", "image", "video", "pdf"])),
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
    const file = Bun.file(filepath)
    const result = await file.json().catch(() => {})
    if (result) {
      const providers = result as Record<string, Provider>
      log.info("models.get", {
        source: "cache_file",
        providerCount: Object.keys(providers).length,
        totalMs: Date.now() - startedAt,
        filepath,
      })
      return providers
    }
    if (typeof data === "function") {
      const macroStart = Date.now()
      const json = await data()
      const providers = JSON.parse(json) as Record<string, Provider>
      log.info("models.get", {
        source: "macro",
        providerCount: Object.keys(providers).length,
        macroMs: Date.now() - macroStart,
        totalMs: Date.now() - startedAt,
      })
      return providers
    }
    const fetchStart = Date.now()
    const json = await fetch("https://models.dev/api.json").then((x) => x.text())
    const providers = JSON.parse(json) as Record<string, Provider>
    log.info("models.get", {
      source: "network_fetch",
      providerCount: Object.keys(providers).length,
      fetchMs: Date.now() - fetchStart,
      totalMs: Date.now() - startedAt,
    })
    return providers
  }

  export async function refresh() {
    if (Flag.OPENCODE_DISABLE_MODELS_FETCH) return
    const refreshStart = Date.now()
    const file = Bun.file(filepath)
    log.info("refreshing", {
      file,
    })
    const result = await fetch("https://models.dev/api.json", {
      headers: {
        "User-Agent": Installation.USER_AGENT,
      },
      signal: AbortSignal.timeout(10 * 1000),
    }).catch((e) => {
      log.error("Failed to fetch models.dev", {
        error: e,
        elapsedMs: Date.now() - refreshStart,
      })
    })
    if (result && result.ok) {
      const text = await result.text()
      await Bun.write(file, text)
      log.info("models.refresh.done", {
        elapsedMs: Date.now() - refreshStart,
        bytes: text.length,
        filepath,
      })
    } else {
      log.warn("models.refresh.skipped", {
        elapsedMs: Date.now() - refreshStart,
        status: result?.status,
      })
    }
  }
}

setInterval(() => ModelsDev.refresh(), 60 * 1000 * 60).unref()
