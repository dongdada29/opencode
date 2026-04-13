import { Installation } from "../installation"
import { Log } from "../util/log"

const log = Log.create({ service: "models.source" })

export type SourceResult =
  | { ok: true; data: string; source: string }
  | { ok: false; source: string; reason: string }

export interface FetchModelsOptions {
  /** Path to the cache file (e.g. ~/.cache/opencode/models.json) */
  cachePath: string
  /** Candidate paths for bundled asset (tries in order) */
  bundledPaths: string[]
  /** Build-time macro data function, if available */
  macroData?: () => Promise<string>
  /** Skip reading from cache (useful for refresh) */
  skipCache?: boolean
  /** Skip network fetch entirely */
  skipNetwork?: boolean
}

/**
 * Unified method to fetch models JSON from available sources.
 * Priority: cache file → macro → bundled asset → network fetch
 */
export async function fetchModelsFromSource(options: FetchModelsOptions): Promise<SourceResult> {
  log.info("fetchFromSource.start", {
    cachePath: options.cachePath,
    bundledPaths: options.bundledPaths,
    skipCache: options.skipCache ?? false,
    skipNetwork: options.skipNetwork ?? false,
    hasMacroData: !!options.macroData,
  })

  // 1. Cache file
  if (!options.skipCache) {
    const cacheFile = Bun.file(options.cachePath)
    const cached = await cacheFile.text().catch(() => undefined)
    if (cached) {
      log.info("fetchFromSource.hit", { source: "cache_file", bytes: cached.length })
      return { ok: true, data: cached, source: "cache_file" }
    }
  }

  // 2. Macro (build-time embedded data)
  if (options.macroData) {
    const json = await options.macroData()
    if (json) {
      log.info("fetchFromSource.hit", { source: "macro", bytes: json.length })
      return { ok: true, data: json, source: "macro" }
    }
  }

  // 3. Bundled asset (try each candidate path)
  for (const bundledPath of options.bundledPaths) {
    const bundledFile = Bun.file(bundledPath)
    const bundledExists = await bundledFile.exists()
    log.info("fetchFromSource.bundled_check", {
      path: bundledPath,
      exists: bundledExists,
    })
    if (bundledExists) {
      const text = await bundledFile.text()
      if (text) {
        log.info("fetchFromSource.hit", { source: "bundled_asset", bytes: text.length, path: bundledPath })
        return { ok: true, data: text, source: "bundled_asset" }
      }
    }
  }

  // 4. Network fetch
  if (!options.skipNetwork) {
    log.info("fetchFromSource.network_fetch", { url: "https://models.dev/api.json" })
    const result = await fetch("https://models.dev/api.json", {
      headers: {
        "User-Agent": Installation.USER_AGENT,
      },
      signal: AbortSignal.timeout(10 * 1000),
    }).catch(() => null)

    if (result && result.ok) {
      const text = await result.text()
      log.info("fetchFromSource.hit", { source: "network_fetch", bytes: text.length })
      return { ok: true, data: text, source: "network_fetch" }
    }
    return { ok: false, source: "network_fetch", reason: `HTTP ${result?.status ?? "fetch error"}` }
  }

  return { ok: false, source: "none", reason: "all sources unavailable" }
}
