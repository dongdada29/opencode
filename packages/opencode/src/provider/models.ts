import { Global } from "@opencode-ai/core/global"
import { Log } from "../util"
import path from "path"
import { Schema } from "effect"
import { Flag } from "@opencode-ai/core/flag/flag"
import { lazy } from "@/util/lazy"
import { Filesystem } from "../util"
import { Flock } from "@opencode-ai/core/util/flock"
import { Hash } from "@opencode-ai/core/util/hash"
import { fetchModelsFromSource } from "./models-source"

// Try to import bundled snapshot (generated at build time)
// Falls back to undefined in dev mode when snapshot doesn't exist
/* @ts-ignore */

const log = Log.create({ service: "models.dev" })
const source = url()
const filepath = path.join(
  Global.Path.cache,
  source === "https://models.dev" ? "models.json" : `models-${Hash.fast(source)}.json`,
)
const ttl = 5 * 60 * 1000
let lastResolvedSource: "cache_file" | "macro" | "bundled_asset" | "network_fetch" | "none" = "none"

const bundledPaths = [
  path.join(path.dirname(process.execPath), "assets", "models.json"),
  path.join(__dirname, "../../assets/models.json"),
]

const Cost = Schema.Struct({
  input: Schema.Number,
  output: Schema.Number,
  cache_read: Schema.optional(Schema.Number),
  cache_write: Schema.optional(Schema.Number),
  context_over_200k: Schema.optional(
    Schema.Struct({
      input: Schema.Number,
      output: Schema.Number,
      cache_read: Schema.optional(Schema.Number),
      cache_write: Schema.optional(Schema.Number),
    }),
  ),
})

export const Model = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  family: Schema.optional(Schema.String),
  release_date: Schema.String,
  attachment: Schema.Boolean,
  reasoning: Schema.Boolean,
  temperature: Schema.Boolean,
  tool_call: Schema.Boolean,
  interleaved: Schema.optional(
    Schema.Union([
      Schema.Literal(true),
      Schema.Struct({
        field: Schema.Literals(["reasoning_content", "reasoning_details"]),
      }),
    ]),
  ),
  cost: Schema.optional(Cost),
  limit: Schema.Struct({
    context: Schema.Number,
    input: Schema.optional(Schema.Number),
    output: Schema.Number,
  }),
  modalities: Schema.optional(
    Schema.Struct({
      input: Schema.Array(Schema.Literals(["text", "audio", "image", "video", "pdf"])),
      output: Schema.Array(Schema.Literals(["text", "audio", "image", "video", "pdf"])),
    }),
  ),
  experimental: Schema.optional(
    Schema.Struct({
      modes: Schema.optional(
        Schema.Record(
          Schema.String,
          Schema.Struct({
            cost: Schema.optional(Cost),
            provider: Schema.optional(
              Schema.Struct({
                body: Schema.optional(Schema.Record(Schema.String, Schema.MutableJson)),
                headers: Schema.optional(Schema.Record(Schema.String, Schema.String)),
              }),
            ),
          }),
        ),
      ),
    }),
  ),
  status: Schema.optional(Schema.Literals(["alpha", "beta", "deprecated"])),
  provider: Schema.optional(
    Schema.Struct({ npm: Schema.optional(Schema.String), api: Schema.optional(Schema.String) }),
  ),
})
export type Model = Schema.Schema.Type<typeof Model>

export const Provider = Schema.Struct({
  api: Schema.optional(Schema.String),
  name: Schema.String,
  env: Schema.Array(Schema.String),
  id: Schema.String,
  npm: Schema.optional(Schema.String),
  models: Schema.Record(Schema.String, Model),
})

export type Provider = Schema.Schema.Type<typeof Provider>

function url() {
  return Flag.OPENCODE_MODELS_URL || "https://models.dev"
}

function fresh() {
  return Date.now() - Number(Filesystem.stat(filepath)?.mtimeMs ?? 0) < ttl
}

function skip(force: boolean) {
  return !force && fresh()
}

export const Data = lazy(async () => {
  const result = await Filesystem.readJson(Flag.OPENCODE_MODELS_PATH ?? filepath).catch(() => {})
  if (result) {
    lastResolvedSource = "cache_file"
    return result
  }
  return Flock.withLock(`models-dev:${filepath}`, async () => {
    const lockedResult = await Filesystem.readJson(Flag.OPENCODE_MODELS_PATH ?? filepath).catch(() => {})
    if (lockedResult) {
      lastResolvedSource = "cache_file"
      return lockedResult
    }
    const sourceResult = await fetchModelsFromSource({
      cachePath: Flag.OPENCODE_MODELS_PATH ?? filepath,
      bundledPaths,
      macroData: async () => {
        // @ts-ignore
        const snapshot = await import("./models-snapshot.js")
          .then((m) => m.snapshot as Record<string, unknown>)
          .catch(() => undefined)
        return snapshot ? JSON.stringify(snapshot) : undefined
      },
      skipNetwork: Flag.OPENCODE_DISABLE_MODELS_FETCH,
      url: `${url()}/api.json`,
    })
    if (!sourceResult.ok) {
      lastResolvedSource = "none"
      throw new Error(
        `No models data available: cache, macro, bundled asset, and network all unavailable (source: ${sourceResult.source})`,
      )
    }
    lastResolvedSource = sourceResult.source
    if (sourceResult.source === "network_fetch") {
      await Filesystem.write(filepath, sourceResult.data).catch((e) => {
        log.error("Failed to write models cache", { error: e })
      })
    }
    return JSON.parse(sourceResult.data)
  })
})

export async function get() {
  const result = await Data()
  return result as Record<string, Provider>
}

export function sourceInfo() {
  return {
    source: lastResolvedSource,
    cachePath: Flag.OPENCODE_MODELS_PATH ?? filepath,
    modelsURL: url(),
    fetchDisabled: !!Flag.OPENCODE_DISABLE_MODELS_FETCH,
  }
}

export async function refresh(force = false) {
  if (skip(force)) return Data.reset()
  await Flock.withLock(`models-dev:${filepath}`, async () => {
    if (skip(force)) return Data.reset()
    const sourceResult = await fetchModelsFromSource({
      cachePath: Flag.OPENCODE_MODELS_PATH ?? filepath,
      bundledPaths,
      skipCache: true,
      skipNetwork: Flag.OPENCODE_DISABLE_MODELS_FETCH,
      url: `${url()}/api.json`,
    })
    if (!sourceResult.ok) return
    lastResolvedSource = sourceResult.source
    if (sourceResult.source === "network_fetch") {
      await Filesystem.write(filepath, sourceResult.data).catch((e) => {
        log.error("Failed to write models cache", { error: e })
      })
    }
    Data.reset()
  }).catch((e) => {
    log.error("Failed to fetch models.dev", {
      error: e,
    })
  })
}

if (!Flag.OPENCODE_DISABLE_MODELS_FETCH && !process.argv.includes("--get-yargs-completions")) {
  void refresh()
  setInterval(
    async () => {
      await refresh()
    },
    60 * 1000 * 60,
  ).unref()
}
