import path from "path"
import { Instance } from "@/project/instance"
import type { SandboxPolicy } from "./policy"
import { parseNuwaxAgentSandboxConfig } from "./env"
import { resolveWritableRoots } from "./path"

/**
 * Sync sandbox policy for bash helper routing (no Config/Session services).
 * Uses `NUWAX_AGENT_SANDBOX_CONFIG` + current `Instance.directory` (session cwd).
 */
export function getSandboxPolicySync(): SandboxPolicy | null {
  const sandbox = parseNuwaxAgentSandboxConfig()
  if (!sandbox || sandbox.sandbox_mode === "permissive") {
    return null
  }
  const instanceDirectory = path.resolve(Instance.directory)
  const writableRoots = resolveWritableRoots(sandbox, instanceDirectory)
  return {
    sandbox,
    writableRoots,
    instanceDirectory,
  }
}
