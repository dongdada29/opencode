import path from "path"

import { Effect } from "effect"

import { Config } from "@/config"

import type { Info as SandboxInfo } from "@/config/sandbox"

import { InstanceState } from "@/effect"

import { Log } from "@/util"

import { Session } from "@/session"

import type { SessionID } from "@/session/schema"

import { resolveWritableRoots, normalizeSandboxPath, isPathWritable, pickNarrowestDirectory } from "./path"

import { SandboxPathError } from "./error"

import { parseNuwaxAgentSandboxConfig } from "./env"

const log = Log.create({ service: "sandbox-policy" })

export type SandboxPolicy = {
  sandbox: SandboxInfo
  writableRoots: string[]
  instanceDirectory: string
}


export const getSandboxPolicy = Effect.fn("Sandbox.getSandboxPolicy")(function* (sessionID?: SessionID) {

  const cfg = yield* Config.Service.use((svc) => svc.get())

  const sandbox = parseNuwaxAgentSandboxConfig() ?? cfg.sandbox

  if (!sandbox || sandbox.sandbox_mode === "permissive") {

    return null

  }

  const ins = yield* InstanceState.context

  const instanceDir = path.resolve(ins.directory)

  let instanceDirectory = instanceDir



  if (sessionID && sandbox.sandbox_mode === "strict") {

    const sessions = yield* Session.Service

    const session = yield* sessions.get(sessionID)

    const sessionDir = path.resolve(session.directory)

    instanceDirectory = pickNarrowestDirectory(instanceDir, sessionDir)

  } else if (sessionID) {

    const sessions = yield* Session.Service

    const session = yield* sessions.get(sessionID)

    instanceDirectory = path.resolve(session.directory)

  }



  const writableRoots = resolveWritableRoots(sandbox, instanceDirectory)

  return {

    sandbox,

    writableRoots,

    instanceDirectory,

  } satisfies SandboxPolicy

})



export const assertSandboxWritable = Effect.fn("Sandbox.assertSandboxWritable")(function* (

  targetPath: string,

  sessionID?: SessionID,

) {

  const policy = yield* getSandboxPolicy(sessionID)

  if (!policy) return



  const resolved =

    path.isAbsolute(targetPath) || (process.platform === "win32" && /^[a-zA-Z]:[\\/]/.test(targetPath))

      ? normalizeSandboxPath(targetPath)

      : normalizeSandboxPath(path.join(policy.instanceDirectory, targetPath))



  if (!isPathWritable(resolved, policy.writableRoots)) {

    log.warn("sandbox write blocked", {

      target: resolved,

      sessionID,

      instanceDirectory: policy.instanceDirectory,

      writableRoots: policy.writableRoots,

      sandbox_mode: policy.sandbox.sandbox_mode,

    })

    return yield* Effect.fail(new SandboxPathError(resolved, policy.writableRoots))

  }

})


