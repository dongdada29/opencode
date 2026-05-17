#!/usr/bin/env bun
/**
 * Local smoke test for nuwaxcode 1.2.0 native sandbox (no Electron).
 * Usage: bun run script/verify-sandbox.ts
 */
import path from "path"
import fs from "fs"
import { Config, ConfigParse } from "../src/config"
import { resolveWritableRoots, isPathWritable } from "../src/sandbox/path"

const fail = (msg: string) => {
  console.error(`FAIL: ${msg}`)
  process.exit(1)
}

const ok = (msg: string) => console.log(`OK: ${msg}`)

// 1) Strict config schema
const parsed = ConfigParse.schema(
  Config.Info.zod,
  {
    sandbox: {
      sandbox_mode: "strict",
      helper_path: "C:\\helper\\nuwax-sandbox-helper.exe",
      mode: "workspace-write",
      network_enabled: true,
    },
  },
  "verify.json",
)
if (parsed.sandbox?.sandbox_mode !== "strict") fail("sandbox_mode not strict")
ok("Config.Info accepts OPENCODE sandbox object")

try {
  ConfigParse.schema(
    Config.Info.zod,
    { sandbox: { sandbox_mode: "strict" }, extra_key: true } as Record<string, unknown>,
    "bad.json",
  )
  fail("expected unknown top-level key to throw")
} catch {
  ok("unknown top-level keys rejected")
}

// 2) Writable roots (strict = session only)
const session = path.resolve(process.cwd(), "_verify_session")
const sibling = path.resolve(process.cwd(), "_verify_sibling", "out.txt")
fs.mkdirSync(session, { recursive: true })
fs.mkdirSync(path.dirname(sibling), { recursive: true })

const roots = resolveWritableRoots({ sandbox_mode: "strict" }, session)
if (!isPathWritable(path.join(session, "inside.txt"), roots)) {
  fail("write inside session should be allowed")
}
if (isPathWritable(sibling, roots)) {
  fail("write outside session should be blocked")
}
ok("strict writable_roots: session allowed, sibling denied")

// 3) Built binary version (if dist exists)
const distExe = path.resolve(
  import.meta.dir,
  "../dist/nuwaxcode-windows-x64/bin/opencode.exe",
)
if (fs.existsSync(distExe)) {
  const proc = Bun.spawn([distExe, "--version"], { stdout: "pipe", stderr: "pipe" })
  const version = (await new Response(proc.stdout).text()).trim()
  if (!version.startsWith("1.2.")) {
    fail(`dist binary version expected 1.2.x, got ${version}`)
  }
  ok(`dist binary --version = ${version}`)
} else {
  console.log("SKIP: dist binary not found (run: bun run build --single --skip-embed-web-ui)")
}

console.log("\nAll local nuwaxcode sandbox checks passed.")
