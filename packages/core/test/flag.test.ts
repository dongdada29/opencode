import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { Flag } from "@opencode-ai/core/flag/flag"

describe("Flag.OPENCODE_FORCE_INPUT_MODALITIES", () => {
  const key = "OPENCODE_FORCE_INPUT_MODALITIES"
  let original: string | undefined

  beforeEach(() => {
    original = process.env[key]
  })
  afterEach(() => {
    if (original === undefined) delete process.env[key]
    else process.env[key] = original
  })

  test("empty when env is unset", () => {
    delete process.env[key]
    expect(Flag.OPENCODE_FORCE_INPUT_MODALITIES).toEqual([])
  })

  test("parses comma-separated modalities", () => {
    process.env[key] = "image,pdf"
    expect(Flag.OPENCODE_FORCE_INPUT_MODALITIES).toEqual(["image", "pdf"])
  })

  test("normalizes case and surrounding whitespace", () => {
    process.env[key] = " IMAGE , PDF "
    expect(Flag.OPENCODE_FORCE_INPUT_MODALITIES).toEqual(["image", "pdf"])
  })

  test("drops invalid values, keeps valid ones", () => {
    process.env[key] = "image,foo,pdf,bar"
    expect(Flag.OPENCODE_FORCE_INPUT_MODALITIES).toEqual(["image", "pdf"])
  })

  test("evaluated at access time (runtime override takes effect)", () => {
    delete process.env[key]
    expect(Flag.OPENCODE_FORCE_INPUT_MODALITIES).toEqual([])
    process.env[key] = "image"
    expect(Flag.OPENCODE_FORCE_INPUT_MODALITIES).toEqual(["image"])
  })
})
