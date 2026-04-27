import { Installation } from "../installation"
import { Log } from "../util"

const log = Log.create({ service: "models.source" })

export type SourceResult =
  | { ok: true; data: string; source: "cache_file" | "macro" | "bundled_asset" | "network_fetch" }
  | { ok: false; source: "network_fetch" | "none"; reason: string }

export interface FetchModelsOptions {
  cachePath: string
  bundledPaths: string[]
  macroData?: () => Promise<string | undefined>
  skipCache?: boolean
  skipNetwork?: boolean
  url?: string
}

/**
 * Unified models source loader.
 * Priority: cache -> embedded macro -> bundled asset -> network.
 */
export async function fetchModelsFromSource(options: FetchModelsOptions): Promise<SourceResult> {
  log.info("fetch.start", {
    cachePath: options.cachePath,
    bundledPaths: options.bundledPaths,
    skipCache: options.skipCache ?? false,
    skipNetwork: options.skipNetwork ?? false,
    hasMacroData: !!options.macroData,
    url: options.url ?? "https://models.dev/api.json",
  })

  if (!options.skipCache) {
    const text = await Bun.file(options.cachePath).text().catch(() => undefined)
    if (text) {
      log.info("fetch.hit", { source: "cache_file", bytes: text.length })
      return { ok: true, data: text, source: "cache_file" }
    }
  }

  if (options.macroData) {
    const text = await options.macroData().catch(() => undefined)
    if (text) {
      log.info("fetch.hit", { source: "macro", bytes: text.length })
      return { ok: true, data: text, source: "macro" }
    }
  }

  for (const candidate of options.bundledPaths) {
    const file = Bun.file(candidate)
    const exists = await file.exists()
    log.info("fetch.bundle.check", { path: candidate, exists })
    if (!exists) continue
    const text = await file.text().catch(() => undefined)
    if (text) {
      log.info("fetch.hit", { source: "bundled_asset", bytes: text.length, path: candidate })
      return { ok: true, data: text, source: "bundled_asset" }
    }
  }

  if (!options.skipNetwork) {
    const networkUrl = options.url ?? "https://models.dev/api.json"
    const result = await fetch(networkUrl, {
      headers: { "User-Agent": Installation.USER_AGENT },
      signal: AbortSignal.timeout(10000),
    }).catch(() => null)
    if (result?.ok) {
      const text = await result.text()
      log.info("fetch.hit", { source: "network_fetch", bytes: text.length, url: networkUrl })
      return { ok: true, data: text, source: "network_fetch" }
    }
    return { ok: false, source: "network_fetch", reason: `HTTP ${result?.status ?? "fetch error"}` }
  }

  return { ok: false, source: "none", reason: "all sources unavailable" }
}
