import path from "path"
import fs from "fs/promises"
import { Global } from "../global"
import z from "zod"

export namespace Log {
  export const Level = z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).meta({ ref: "LogLevel", description: "Log level" })
  export type Level = z.infer<typeof Level>

  const levelPriority: Record<Level, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  }

  let level: Level = "INFO"

  function shouldLog(input: Level): boolean {
    return levelPriority[input] >= levelPriority[level]
  }

  export type Logger = {
    debug(message?: any, extra?: Record<string, any>): void
    info(message?: any, extra?: Record<string, any>): void
    error(message?: any, extra?: Record<string, any>): void
    warn(message?: any, extra?: Record<string, any>): void
    tag(key: string, value: string): Logger
    clone(): Logger
    time(
      message: string,
      extra?: Record<string, any>,
    ): {
      stop(): void
      [Symbol.dispose](): void
    }
  }

  const loggers = new Map<string, Logger>()

  export const Default = create({ service: "default" })

  export interface Options {
    print: boolean
    dev?: boolean
    level?: Level
    dir?: string
  }

  let logpath = ""
  export function file() {
    return logpath
  }

  let suppress = false
  export let flush = async () => { }
  let write = (msg: any) => {
    if (!suppress) {
      process.stderr.write(msg)
    }
    return msg.length
  }

  export function raw(msg: string) {
    write(msg + "\n")
  }

  // Initial setup function to share logic between early init and explicit init
  function setup(dir: string, printLogs: boolean) {
    try {
      // Use sync mkdir for early init safety, it's fine for init() too
      // However, fs/promises is imported as fs. We need 'fs' or 'node:fs' for sync.
      // Since we can't easily change imports here without breaking other things or making it messy,
      // we'll use require for the sync version just this once if needed, or assume the user ensures the dir exists?
      // No, we must create it.
      const fsSync = require("fs")
      fsSync.mkdirSync(dir, { recursive: true })

      const date = new Date()
      const yyyy = date.getFullYear()
      const MM = String(date.getMonth() + 1).padStart(2, "0")
      const DD = String(date.getDate()).padStart(2, "0")
      const HH = String(date.getHours()).padStart(2, "0")
      const mm = String(date.getMinutes()).padStart(2, "0")
      const ss = String(date.getSeconds()).padStart(2, "0")
      const suffix = Math.random().toString(36).substring(2, 8)
      const filename = `nuwaxcode_${yyyy}_${MM}_${DD}_${HH}${mm}${ss}_${suffix}.log`

      logpath = path.join(dir, filename)
      const logfile = Bun.file(logpath)
      const writer = logfile.writer()

      flush = async () => {
        await writer.flush()
      }

      write = (msg: any) => {
        // If printLogs is true, write to stderr AND file
        // If printLogs is false (suppress=true), write ONLY to file
        const print = printLogs
        if (print) {
          process.stderr.write(msg)
        }

        // Writer.write is sync-ish (buffers), flush is async.
        // We just write to buffer here.
        const num = writer.write(msg)
        writer.flush() // Auto-flush for safety
        return num
      }

      suppress = !printLogs
    } catch (e) {
      // Fallback to stderr if file setup fails
      console.error("Failed to setup log file:", e)
      suppress = false
      write = (msg: any) => {
        process.stderr.write(msg)
        return msg.length
      }
    }
  }

  // Early initialization: Check Env Var immediately
  if (process.env.OPENCODE_LOG_DIR) {
    const print = process.argv.includes("--print-logs")
    setup(process.env.OPENCODE_LOG_DIR, print)
  }

  export async function init(options: Options) {
    if (options.level) level = options.level

    // If we already set up logging via env var, and the options match (or we default to env), we might just return?
    // But options.dir might be different from env (overridden by generic config).
    // If options.dir is provided and different from current logpath's dir, we should re-init?
    // For now, let's keep it simple: if initialized early, we might skip unless dir changes?
    // Actually, `init` in `index.ts` passes `options.dir ?? process.env.OPENCODE_LOG_DIR`.
    // So usually it will be the same.

    const targetDir = options.dir ?? process.env.OPENCODE_LOG_DIR ?? (options.print ? undefined : Global.Path.log)

    // If no directory desired (and not suppressed default logic), return.
    if (!targetDir) {
      suppress = !options.print
      return
    }

    // Check if we are already logging to this directory (simple check)
    if (logpath && logpath.startsWith(targetDir)) {
      // Just update suppression/level
      if (options.print !== undefined) {
        // Update write function closure's `printLogs` concept? 
        // Our `write` function baked in `printLogs`. We need to update `suppress` or re-setup?
        // The `write` implementation above uses `printLogs` which was passed by value.
        // Let's refactor `write` to use module-level `suppress` variable.
        suppress = !options.print
      }
      return
    }

    // If new directory or not initialized yet
    // Ensure mkdir (async here is fine, but we used sync in setup. Let's reuse setup logic but maybe async mkdir?)
    // To match strict early init, let's just use the synchronous setup helper we made.
    setup(targetDir, options.print)
  }

  async function cleanup(dir: string) {
    const glob = new Bun.Glob("nuwaxcode_*.log")
    const files = await Array.fromAsync(
      glob.scan({
        cwd: dir,
        absolute: true,
      }),
    )
    if (files.length <= 5) return

    const filesToDelete = files.sort().slice(0, -10)
    await Promise.all(filesToDelete.map((file) => fs.unlink(file).catch(() => { })))
  }

  function formatError(error: Error, depth = 0): string {
    const result = error.message
    return error.cause instanceof Error && depth < 10
      ? result + " Caused by: " + formatError(error.cause, depth + 1)
      : result
  }

  let last = Date.now()
  export function create(tags?: Record<string, any>) {
    tags = tags || {}

    const service = tags["service"]
    if (service && typeof service === "string") {
      const cached = loggers.get(service)
      if (cached) {
        return cached
      }
    }

    function build(message: any, extra?: Record<string, any>) {
      const prefix = Object.entries({
        ...tags,
        ...extra,
      })
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => {
          const prefix = `${key}=`
          if (value instanceof Error) return prefix + formatError(value)
          if (typeof value === "object") return prefix + JSON.stringify(value)
          return prefix + value
        })
        .join(" ")

      let safeMessage = message
      if (message && typeof message === "object" && !(message instanceof Error)) {
        safeMessage = JSON.stringify(message)
      } else if (typeof message === "string") {
        // Prevent carriage returns from messing up the terminal log line
        safeMessage = message.replace(/\r/g, "\\r")
      }

      const next = new Date()
      const diff = next.getTime() - last
      last = next.getTime()
      return [next.toISOString().split(".")[0], "+" + diff + "ms", prefix, safeMessage].filter(Boolean).join(" ") + "\n"
    }
    const result: Logger = {
      debug(message?: any, extra?: Record<string, any>) {
        if (shouldLog("DEBUG")) {
          write("DEBUG " + build(message, extra))
        }
      },
      info(message?: any, extra?: Record<string, any>) {
        if (shouldLog("INFO")) {
          write("INFO  " + build(message, extra))
        }
      },
      error(message?: any, extra?: Record<string, any>) {
        if (shouldLog("ERROR")) {
          write("ERROR " + build(message, extra))
        }
      },
      warn(message?: any, extra?: Record<string, any>) {
        if (shouldLog("WARN")) {
          write("WARN  " + build(message, extra))
        }
      },
      tag(key: string, value: string) {
        if (tags) tags[key] = value
        return result
      },
      clone() {
        return Log.create({ ...tags })
      },
      time(message: string, extra?: Record<string, any>) {
        const now = Date.now()
        result.info(message, { status: "started", ...extra })
        function stop() {
          result.info(message, {
            status: "completed",
            duration: Date.now() - now,
            ...extra,
          })
        }
        return {
          stop,
          [Symbol.dispose]() {
            stop()
          },
        }
      },
    }

    if (service && typeof service === "string") {
      loggers.set(service, result)
    }

    return result
  }
}
