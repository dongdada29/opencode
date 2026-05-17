export * as ConfigSandbox from "./sandbox"
import { Schema } from "effect"
import { zod } from "@/util/effect-zod"
import { withStatics } from "@/util/schema"

export const SandboxMode = Schema.Literals(["strict", "compat", "permissive"])
  .annotate({
    identifier: "SandboxMode",
    description:
      "Nuwax sandbox policy: strict (session cwd), compat (+ project/app data), permissive (no path gate)",
  })
  .pipe(withStatics((s) => ({ zod: zod(s) })))

export const WindowsSandboxMode = Schema.Literals(["workspace-write", "read-only"])
  .annotate({
    identifier: "WindowsSandboxMode",
    description: "Windows helper policy mode passed to nuwax-sandbox-helper",
  })
  .pipe(withStatics((s) => ({ zod: zod(s) })))

export const Info = Schema.Struct({
  sandbox_mode: SandboxMode,
  writable_roots: Schema.optional(Schema.mutable(Schema.Array(Schema.String))).annotate({
    description:
      "Allowed write roots. Strict mode defaults to the active Instance.directory when omitted.",
  }),
  helper_path: Schema.optional(Schema.String).annotate({
    description: "Path to nuwax-sandbox-helper (Windows bash execution)",
  }),
  network_enabled: Schema.optional(Schema.Boolean).annotate({
    description: "Allow network in sandbox helper policy (default true)",
  }),
  mode: Schema.optional(WindowsSandboxMode).annotate({
    description: "Windows helper workspace-write vs read-only (default workspace-write)",
  }),
})
  .annotate({
    identifier: "SandboxConfig",
    description: "Execution sandbox for built-in write/edit/bash tools (nuwax-agent integration)",
  })
  .pipe(withStatics((s) => ({ zod: zod(s) })))

export type Info = Schema.Schema.Type<typeof Info>