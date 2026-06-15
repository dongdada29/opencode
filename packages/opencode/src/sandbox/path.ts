import path from "path"
import { FSUtil } from "@opencode-ai/core/fs-util"
import type { Info as SandboxInfo } from "@/config/sandbox"

export function isWithinRoot(candidate: string, root: string): boolean {
  const resolvedCandidate = path.resolve(candidate)
  const resolvedRoot = path.resolve(root)
  const rel = path.relative(resolvedRoot, resolvedCandidate)
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))
}

export function normalizeSandboxPath(filepath: string): string {
  const resolved = path.resolve(filepath)
  return process.platform === "win32" ? FSUtil.normalizePath(resolved) : resolved
}

export function collectTempDirs(): string[] {
  const dirs: string[] = []
  for (const key of ["TMP", "TEMP", "TMPDIR"] as const) {
    const value = process.env[key]
    if (value) dirs.push(path.resolve(value))
  }
  return dirs
}

export function collectCompatAppDataDirs(): string[] {
  if (process.platform !== "win32") return []
  const dirs: string[] = []
  for (const key of ["APPDATA", "LOCALAPPDATA"] as const) {
    const value = process.env[key]
    if (value) dirs.push(path.resolve(value))
  }
  return dirs
}

/** Pick the most specific (deepest) directory when one path contains the other. */
export function pickNarrowestDirectory(...candidates: string[]): string {
  const resolved = [...new Set(candidates.filter(Boolean).map((p) => path.resolve(p)))]
  if (resolved.length === 0) return path.resolve(".")
  let narrowest = resolved[0]!
  for (const candidate of resolved.slice(1)) {
    if (isWithinRoot(candidate, narrowest)) {
      narrowest = candidate
    } else if (!isWithinRoot(narrowest, candidate)) {
      // Unrelated paths — keep the first candidate (HTTP ?directory= wins over stale DB).
      continue
    }
  }
  return narrowest
}

export function resolveWritableRoots(sandbox: SandboxInfo, instanceDirectory: string): string[] {
  const mode = sandbox.sandbox_mode
  if (mode === "permissive") return []

  const roots = new Set<string>()
  // Strict: only the session/instance directory, never config writable_roots or broad temp.
  if (mode === "strict") {
    roots.add(path.resolve(instanceDirectory))
  } else {
    const configured = sandbox.writable_roots?.map((p) => path.resolve(p)) ?? []
    if (configured.length > 0) {
      for (const root of configured) roots.add(root)
    } else {
      roots.add(path.resolve(instanceDirectory))
    }
  }

  if (mode !== "strict") {
    for (const temp of collectTempDirs()) {
      roots.add(temp)
    }
  }

  if (mode === "compat") {
    for (const dir of collectCompatAppDataDirs()) {
      roots.add(dir)
    }
  }

  return [...roots]
}

export function isPathWritable(targetPath: string, roots: string[]): boolean {
  if (roots.length === 0) return true
  const normalized = normalizeSandboxPath(targetPath)
  return roots.some((root) => isWithinRoot(normalized, root))
}
