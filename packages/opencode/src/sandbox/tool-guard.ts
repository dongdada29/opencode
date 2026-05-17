import path from "path"
import { Effect } from "effect"
import type { Info as SandboxInfo } from "@/config/sandbox"
import { Instance } from "@/project/instance"
import { SandboxPathError } from "./error"
import { parseNuwaxAgentSandboxConfig } from "./env"
import { isPathWritable, normalizeSandboxPath, resolveWritableRoots } from "./path"

function resolveTargetPath(targetPath: string, instanceDirectory: string): string {
  if (
    path.isAbsolute(targetPath) ||
    (process.platform === "win32" && /^[a-zA-Z]:[\\/]/.test(targetPath))
  ) {
    return normalizeSandboxPath(targetPath)
  }
  return normalizeSandboxPath(path.join(instanceDirectory, targetPath))
}

/**
 * Synchronous write guard for built-in tools (edit/write/apply_patch).
 * Uses `NUWAX_AGENT_SANDBOX_CONFIG` + `Instance.directory` (session cwd) — no Effect services.
 */
export function assertSandboxWritableInTool(targetPath: string, sandbox?: SandboxInfo): void {
  const active = sandbox ?? parseNuwaxAgentSandboxConfig()
  if (!active || active.sandbox_mode === "permissive") return

  const instanceDirectory = path.resolve(Instance.directory)
  const writableRoots = resolveWritableRoots(active, instanceDirectory)
  const resolved = resolveTargetPath(targetPath, instanceDirectory)

  if (!isPathWritable(resolved, writableRoots)) {
    throw new SandboxPathError(resolved, writableRoots)
  }
}

/** Effect wrapper for built-in tool `execute` (maps to `Error`, no extra services). */
export function assertSandboxWritableEffect(targetPath: string) {
  return Effect.try({
    try: () => assertSandboxWritableInTool(targetPath),
    catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
  })
}
