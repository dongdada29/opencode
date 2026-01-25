import { describe, it, expect, mock, spyOn } from "bun:test"
import { SessionProcessor } from "./processor"
import { LLM } from "./llm"
import { SessionRetry } from "./retry"
import { Session } from "."
import { SessionStatus } from "./status"
import { Bus } from "@/bus"

// Mock dependencies
mock.module("@/util/log", () => ({
  Log: {
    create: () => ({
      info: () => {},
      error: () => {},
      time: () => ({ [Symbol.dispose]: () => {} }),
    }),
  },
}))

mock.module("@/config/config", () => ({
  Config: {
    get: async () => ({ experimental: {} }),
  },
}))

mock.module("./status", () => ({
  SessionStatus: {
    set: mock(() => {}),
  },
}))

mock.module("./message-v2", () => ({
  MessageV2: {
    fromError: (e: any) => ({ name: "APIError", data: { message: "Test Error", isRetryable: true } }),
    parts: async () => [],
    filterCompacted: async (s: any) => [],
    stream: async function* () {},
  },
}))

mock.module(".", () => ({
  Session: {
    updatePart: mock(async () => {}),
    updateMessage: mock(async () => {}),
    Event: { Error: "session.error" },
  },
}))

mock.module("@/bus", () => ({
  Bus: {
    publish: mock(() => {}),
  },
}))

describe("SessionProcessor Infinite Loop Fix", () => {
  it("should stop after MAX_RETRIES (10) attempts when LLM fails consistently", async () => {
    // Mock SessionRetry to always say it's retryable
    spyOn(SessionRetry, "retryable").mockReturnValue("Provider is overloaded")
    spyOn(SessionRetry, "delay").mockReturnValue(0)
    spyOn(SessionRetry, "sleep").mockResolvedValue(undefined)

    // Mock LLM.stream to always throw
    const streamSpy = spyOn(LLM, "stream").mockImplementation(async () => {
      throw new Error("Simulated API Error")
    })

    const processor = SessionProcessor.create({
      assistantMessage: {
        id: "msg_1",
        sessionID: "ses_1",
        time: { created: Date.now() },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      } as any,
      sessionID: "ses_1",
      model: { providerID: "test" } as any,
      abort: new AbortController().signal,
    })

    const result = await processor.process({} as any)

    // Assertions
    expect(streamSpy).toHaveBeenCalledTimes(11) // 1 initial + 10 retries
    expect(result).toBe("stop")
  })
})
