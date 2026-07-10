import { describe, expect, test } from "bun:test"
import { ProviderV2 } from "@opencode-ai/core/provider"
import {
  LLMError,
  QuotaExceededReason,
  AuthenticationReason,
  ContentPolicyReason,
  InvalidRequestReason,
} from "@opencode-ai/llm"
import { MessageV2 } from "../../src/session/message-v2"

describe("session.message-v2.fromError", () => {
  const providerID = ProviderV2.ID.make("custom")

  test("maps LLMError QuotaExceeded reason to ProviderAuthError", () => {
    const error = new LLMError({
      module: "RequestExecutor",
      method: "execute",
      reason: new QuotaExceededReason({ message: "Insufficient Balance" }),
    })
    const result = MessageV2.fromError(error, { providerID })
    expect(result.name).toBe("ProviderAuthError")
    expect((result as { data: { message: string } }).data.message).toBe("Insufficient Balance")
  })

  test("maps LLMError Authentication reason to ProviderAuthError", () => {
    const error = new LLMError({
      module: "RequestExecutor",
      method: "execute",
      reason: new AuthenticationReason({ message: "invalid api key", kind: "invalid" }),
    })
    expect(MessageV2.fromError(error, { providerID }).name).toBe("ProviderAuthError")
  })

  test("maps LLMError ContentPolicy reason to ContentFilterError", () => {
    const error = new LLMError({
      module: "RequestExecutor",
      method: "execute",
      reason: new ContentPolicyReason({ message: "blocked by safety filter" }),
    })
    expect(MessageV2.fromError(error, { providerID }).name).toBe("ContentFilterError")
  })

  test("maps other LLMError reasons to APIError preserving the message", () => {
    const error = new LLMError({
      module: "RequestExecutor",
      method: "execute",
      reason: new InvalidRequestReason({ message: "bad request" }),
    })
    const result = MessageV2.fromError(error, { providerID })
    expect(result.name).toBe("APIError")
    expect((result as { data: { message: string } }).data.message).toBe("bad request")
  })
})
