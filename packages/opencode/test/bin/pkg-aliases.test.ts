import { describe, test, expect } from "bun:test"
import { createRequire } from "module"

const require = createRequire(import.meta.url)
const { packageAliases, needsX64Baseline } = require("../../script/pkg-aliases.cjs")

describe("pkg-aliases", () => {
  test("packageAliases adds opencode legacy name", () => {
    expect(packageAliases("nuwaxcode-linux-x64-baseline")).toEqual([
      "nuwaxcode-linux-x64-baseline",
      "opencode-linux-x64-baseline",
    ])
  })

  test("needsX64Baseline is false when linux x64 reports avx2", () => {
    const fs = {
      readFileSync: () => "flags\t: fpu vme de pse avx2",
    }
    expect(needsX64Baseline("linux", "x64", fs)).toBe(false)
  })

  test("needsX64Baseline is true when linux x64 lacks avx2", () => {
    const fs = {
      readFileSync: () => "flags\t: fpu vme de pse sse4_2",
    }
    expect(needsX64Baseline("linux", "x64", fs)).toBe(true)
  })
})
