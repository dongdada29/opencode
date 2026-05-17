import { describe, expect, test } from "bun:test"
import path from "path"
import { isWithinRoot, pickNarrowestDirectory } from "../../src/sandbox/path"

describe("sandbox.policy directory resolution", () => {
  test("strict: prefer nested instance dir over broad session dir", () => {
    const projectRoot = path.resolve("C:/workspace/test-nuwaclaw")
    const sessionCwd = path.resolve(
      "C:/workspace/test-nuwaclaw/computer-project-workspace/1746495851/1549540",
    )
    expect(isWithinRoot(sessionCwd, projectRoot)).toBe(true)
    const picked = pickNarrowestDirectory(projectRoot, sessionCwd)
    expect(picked).toBe(sessionCwd)
    const sibling = path.resolve(
      "C:/workspace/test-nuwaclaw/computer-project-workspace/1746495851/1549499/out.txt",
    )
    expect(isWithinRoot(sibling, picked)).toBe(false)
  })

  test("strict: prefer nested session dir when instance bootstrap is broad", () => {
    const projectRoot = path.resolve("C:/workspace/test-nuwaclaw")
    const sessionCwd = path.resolve(
      "C:/workspace/test-nuwaclaw/computer-project-workspace/1746495851/1549542",
    )
    const picked = pickNarrowestDirectory(projectRoot, sessionCwd)
    expect(picked).toBe(sessionCwd)
  })
})
