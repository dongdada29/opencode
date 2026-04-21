import { describe, expect, test } from "bun:test"
import { SessionSummary } from "../../src/session/summary"
import type { Session } from "../../src/session"

function createSessionInfo(input: Partial<Session.Info>): Session.Info {
  return {
    id: "ses_test",
    slug: "test-slug",
    projectID: "proj_test",
    directory: "/tmp/test",
    title: "Regular Session",
    version: "1.1.78",
    time: {
      created: Date.now(),
      updated: Date.now(),
    },
    ...input,
  } as Session.Info
}

describe("SessionSummary.shouldSkipMessageTitleGeneration", () => {
  test("ACP source should skip message title generation", () => {
    const session = createSessionInfo({
      source: "acp",
      title: "Any Title",
    })

    expect(SessionSummary.shouldSkipMessageTitleGeneration(session)).toBe(true)
  })

  test("ACP default title prefix should skip even when source is missing", () => {
    const session = createSessionInfo({
      title: "ACP Session 123e4567-e89b-12d3-a456-426614174000",
      source: undefined,
    })

    expect(SessionSummary.shouldSkipMessageTitleGeneration(session)).toBe(true)
  })

  test("non-ACP session should keep message title generation", () => {
    const session = createSessionInfo({
      title: "Refactor auth middleware",
      source: undefined,
    })

    expect(SessionSummary.shouldSkipMessageTitleGeneration(session)).toBe(false)
  })
})
