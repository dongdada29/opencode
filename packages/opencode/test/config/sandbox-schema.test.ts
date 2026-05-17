import { describe, expect, test } from "bun:test"
import { Config } from "../../src/config"
import { ConfigParse } from "../../src/config/parse"

describe("config.sandbox schema", () => {
  test("accepts sandbox in strict config", () => {
    const data = ConfigParse.schema(Config.Info.zod, {
      sandbox: {
        sandbox_mode: "strict",
        helper_path: "C:\\helper\\nuwax-sandbox-helper.exe",
        mode: "workspace-write",
        network_enabled: true,
      },
    }, "test.json")

    expect(data.sandbox?.sandbox_mode).toBe("strict")
    expect(data.sandbox?.helper_path).toContain("nuwax-sandbox-helper")
  })

  test("rejects unknown top-level keys", () => {
    expect(() =>
      ConfigParse.schema(Config.Info.zod, {
        sandbox: { sandbox_mode: "strict" },
        unknown_sandbox_key: true,
      } as Record<string, unknown>, "test.json"),
    ).toThrow()
  })
})
