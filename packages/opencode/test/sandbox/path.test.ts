import { describe, expect, test } from "bun:test"
import path from "path"
import { isWithinRoot, resolveWritableRoots, isPathWritable } from "../../src/sandbox/path"

describe("sandbox.path", () => {
  test("strict: session dir allowed, sibling dir denied", () => {
    const session = path.resolve("/workspace/project/session-a")
    const sibling = path.resolve("/workspace/project/session-b/out.txt")
    const roots = resolveWritableRoots({ sandbox_mode: "strict" }, session)

    expect(isPathWritable(path.join(session, "a.txt"), roots)).toBe(true)
    expect(isPathWritable(sibling, roots)).toBe(false)
  })

  test("isWithinRoot rejects parent escape", () => {
    const root = path.resolve("C:/workspace/session")
    const outside = path.resolve("C:/workspace/other/file.txt")
    expect(isWithinRoot(outside, root)).toBe(false)
  })

  test("permissive yields empty roots (no gate)", () => {
    const roots = resolveWritableRoots({ sandbox_mode: "permissive" }, "/any")
    expect(roots).toEqual([])
    expect(isPathWritable("/anywhere", roots)).toBe(true)
  })

  test("strict: no system temp in writable roots", () => {
    const session = path.resolve("/workspace/project/session-a")
    const roots = resolveWritableRoots({ sandbox_mode: "strict" }, session)
    const temp = process.env.TEMP || process.env.TMP || "/tmp"
    if (temp) {
      expect(isPathWritable(path.join(path.resolve(temp), "escape.txt"), roots)).toBe(false)
    }
  })

  test("strict ignores configured writable_roots (session cwd only)", () => {
    const session = path.resolve("/workspace/project/session-a")
    const projectRoot = path.resolve("/workspace/project")
    const sibling = path.resolve("/workspace/project/session-b/out.txt")
    const roots = resolveWritableRoots(
      {
        sandbox_mode: "strict",
        writable_roots: [projectRoot],
      },
      session,
    )

    expect(isPathWritable(path.join(session, "a.txt"), roots)).toBe(true)
    expect(isPathWritable(path.join(projectRoot, "shared.txt"), roots)).toBe(false)
    expect(isPathWritable(sibling, roots)).toBe(false)
  })
})
