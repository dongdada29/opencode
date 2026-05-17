import { Log } from "@/util"
import type { Info as SandboxInfo } from "@/config/sandbox"

const log = Log.create({ service: "sandbox-env" })

/** Parse `NUWAX_AGENT_SANDBOX_CONFIG` injected by nuwax-agent (spawn / config merge). */
export function parseNuwaxAgentSandboxConfig(): SandboxInfo | undefined {
  const raw = process.env.NUWAX_AGENT_SANDBOX_CONFIG?.trim()
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as SandboxInfo
  } catch (error) {
    log.warn("invalid NUWAX_AGENT_SANDBOX_CONFIG", {
      error: error instanceof Error ? error.message : String(error),
    })
    return undefined
  }
}
