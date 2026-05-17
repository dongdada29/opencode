import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "path"
import { Effect } from "effect"
import { Shell } from "@/shell/shell"
import type { SandboxPolicy } from "./policy"
import { resolveWritableRoots } from "./path"

const SAFE_ENV_KEYS = [
  "PATH",
  "Path",
  "SYSTEMROOT",
  "SystemRoot",
  "WINDIR",
  "windir",
  "SYSTEMDRIVE",
  "SystemDrive",
  "COMSPEC",
  "ComSpec",
  "PATHEXT",
  "PATHExt",
  "TEMP",
  "TMP",
  "USERPROFILE",
  "HOME",
  "LOCALAPPDATA",
  "APPDATA",
  "COMPUTERNAME",
  "USERNAME",
  "OS",
  "PROCESSOR_ARCHITECTURE",
  "LANG",
  "TZ",
] as const

function buildHelperEnv(baseEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const key of SAFE_ENV_KEYS) {
    const value = baseEnv[key]
    if (value !== undefined && value !== null) {
      env[key] = String(value)
    }
  }
  delete env.ELECTRON_RUN_AS_NODE
  return env
}

function resolveHelperShell(shellPath: string): { cmd: string; args: string[] } {
  const gitBash = Shell.gitbash()
  if (gitBash && Shell.posix(shellPath)) {
    return { cmd: gitBash, args: ["-c"] }
  }
  return {
    cmd: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    args: ["-NoProfile", "-NonInteractive", "-Command"],
  }
}

function resolveSandboxCwd(requestedCwd: string, policy: SandboxPolicy): string {
  const winMode = policy.sandbox.mode ?? "workspace-write"
  if (winMode !== "workspace-write") return path.resolve(requestedCwd)

  const roots = resolveWritableRoots(policy.sandbox, policy.instanceDirectory)
  const resolved = path.resolve(requestedCwd)
  if (roots.some((root) => {
    const rel = path.relative(root, resolved)
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))
  })) {
    return resolved
  }
  return roots[0] ?? resolved
}

export type SandboxBashResult = {
  exitCode: number
  stdout: string
  stderr: string
  timedOut: boolean
}

export const runBashViaSandboxHelper = Effect.fn("Sandbox.runBashViaSandboxHelper")(function* (input: {
  policy: SandboxPolicy
  shell: string
  command: string
  cwd: string
  timeout: number
}) {
  const helperPath = input.policy.sandbox.helper_path
  if (!helperPath || !fs.existsSync(helperPath)) {
    return yield* Effect.fail(new Error(`Sandbox helper not found: ${helperPath ?? "(unset)"}`))
  }

  const winMode = input.policy.sandbox.mode ?? "workspace-write"
  const networkEnabled = input.policy.sandbox.network_enabled ?? true
  const writableRoots = resolveWritableRoots(input.policy.sandbox, input.policy.instanceDirectory)
  const sandboxCwd = resolveSandboxCwd(input.cwd, input.policy)

  const policyJson = {
    type: winMode === "workspace-write" ? "workspace-write" : "read-only",
    network_access: networkEnabled,
    sandbox_mode: input.policy.sandbox.sandbox_mode,
    ...(writableRoots.length > 0 ? { writable_roots: writableRoots } : {}),
  }

  const shellWrap = resolveHelperShell(input.shell)
  const helperArgs = [
    "run",
    "--mode",
    winMode,
    "--cwd",
    sandboxCwd,
    "--policy-json",
    JSON.stringify(policyJson),
    "--",
    shellWrap.cmd,
    ...shellWrap.args,
    input.command,
  ]

  const env = buildHelperEnv(process.env)
  const cappedTimeout = Math.min(input.timeout > 0 ? input.timeout : 120_000, 120_000)

  return yield* Effect.tryPromise({
    try: () =>
      new Promise<SandboxBashResult>((resolve, reject) => {
        const child = spawn(helperPath, helperArgs, {
          cwd: sandboxCwd,
          env,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        })

        let stdout = ""
        let stderr = ""
        let timer: ReturnType<typeof setTimeout> | undefined

        if (cappedTimeout > 0) {
          timer = setTimeout(() => {
            try {
              child.kill("SIGKILL")
            } catch {
              // ignore
            }
          }, cappedTimeout)
        }

        child.stdout?.on("data", (chunk) => {
          stdout += chunk.toString()
        })
        child.stderr?.on("data", (chunk) => {
          stderr += chunk.toString()
        })

        child.on("error", (err) => {
          if (timer) clearTimeout(timer)
          reject(err)
        })

        child.on("close", (code, signal) => {
          if (timer) clearTimeout(timer)
          try {
            const parsed = JSON.parse(stdout) as {
              exit_code?: number
              stdout?: string
              stderr?: string
              timed_out?: boolean
            }
            resolve({
              exitCode: parsed.exit_code ?? code ?? 1,
              stdout: parsed.stdout ?? "",
              stderr: parsed.stderr ?? "",
              timedOut: parsed.timed_out ?? signal === "SIGKILL",
            })
          } catch {
            resolve({
              exitCode: code ?? 1,
              stdout,
              stderr,
              timedOut: signal === "SIGKILL",
            })
          }
        })
      }),
    catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
  })
})

export function shouldUseSandboxHelper(policy: SandboxPolicy | null): policy is SandboxPolicy {
  return (
    policy !== null &&
    process.platform === "win32" &&
    !!policy.sandbox.helper_path &&
    fs.existsSync(policy.sandbox.helper_path)
  )
}
