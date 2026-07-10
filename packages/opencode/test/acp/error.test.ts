import { describe, expect, test } from "bun:test"
import { RequestError } from "@agentclientprotocol/sdk"
import * as ACPError from "../../src/acp/error"

describe("acp.error", () => {
  test("maps validation failures to invalid params", () => {
    const cases: ACPError.Error[] = [
      new ACPError.SessionNotFoundError({ sessionId: "ses_missing" }),
      new ACPError.InvalidConfigOptionError({ configId: "temperature" }),
      new ACPError.InvalidModelError({ providerId: "anthropic", modelId: "claude-missing" }),
      new ACPError.InvalidEffortError({ effort: "extreme" }),
      new ACPError.InvalidModeError({ mode: "turbo" }),
    ]

    expect(cases.map((error) => ACPError.toRequestError(error).code)).toEqual([-32602, -32602, -32602, -32602, -32602])
  })

  test("includes safe validation details", () => {
    expect(ACPError.toRequestError(new ACPError.SessionNotFoundError({ sessionId: "ses_123" }))).toMatchObject({
      code: -32602,
      data: { sessionId: "ses_123" },
    })
    expect(ACPError.toRequestError(new ACPError.InvalidModelError({ modelId: "gpt-missing" }))).toMatchObject({
      code: -32602,
      data: { modelId: "gpt-missing" },
    })
  })

  test("maps auth required to the SDK auth error", () => {
    const requestError = ACPError.toRequestError(new ACPError.AuthRequiredError({ providerId: "anthropic" }))

    expect(requestError).toBeInstanceOf(RequestError)
    expect(requestError.code).toBe(-32000)
    expect(requestError.message).toBe("Authentication required: provider authentication required")
    expect(requestError.data).toEqual({ providerId: "anthropic" })
  })

  test("maps unsupported operations to method not found", () => {
    const requestError = ACPError.toRequestError(new ACPError.UnsupportedOperationError({ method: "session/new" }))

    expect(requestError.code).toBe(-32601)
    expect(requestError.data).toEqual({ method: "session/new" })
  })

  test("maps service failures to safe internal errors", () => {
    const requestError = ACPError.toRequestError(
      new ACPError.ServiceFailureError({ service: "provider", safeMessage: "Provider request failed" }),
    )

    expect(requestError.code).toBe(-32603)
    expect(requestError.message).toBe("Internal error: Provider request failed")
    expect(requestError.data).toEqual({ service: "provider" })
  })

  test("wraps unknown defects without leaking raw details", () => {
    const requestError = ACPError.toRequestError(
      ACPError.fromUnknownDefect(new Error("stack has sk-ant-secret and oauth refresh token")),
    )
    const serialized = JSON.stringify(requestError.toErrorResponse())

    expect(requestError.code).toBe(-32603)
    expect(requestError.message).toBe("Internal error: Internal service failure")
    expect(serialized).not.toContain("sk-ant-secret")
    expect(serialized).not.toContain("oauth refresh token")
    expect(serialized).not.toContain("stack")
  })

  test("isPaymentRelatedApiError detects billing vs rate-limit failures", () => {
    expect(ACPError.isPaymentRelatedApiError({ statusCode: 402 })).toBe(true)
    expect(ACPError.isPaymentRelatedApiError({ statusCode: 402, responseBody: undefined })).toBe(true)
    expect(
      ACPError.isPaymentRelatedApiError({ statusCode: 429, responseBody: '{"error":"insufficient_quota"}' }),
    ).toBe(true)
    expect(
      ACPError.isPaymentRelatedApiError({ statusCode: 429, responseBody: "rate limited, retry later" }),
    ).toBe(false)
    expect(ACPError.isPaymentRelatedApiError({ statusCode: 500 })).toBe(false)
    expect(ACPError.isPaymentRelatedApiError({})).toBe(false)
  })

  test("maps content-filter, abort, and output-length errors to stop reasons", () => {
    const cases: Array<{
      error: ACPError.AssistantError
      stopReason: "refusal" | "cancelled" | "max_tokens"
      meta: ACPError.AssistantErrorMeta
    }> = [
      {
        error: { name: "ContentFilterError", data: { message: "blocked by safety" } },
        stopReason: "refusal",
        meta: { name: "ContentFilterError", message: "blocked by safety" },
      },
      {
        error: { name: "MessageAbortedError", data: { message: "Aborted" } },
        stopReason: "cancelled",
        meta: { name: "MessageAbortedError", message: "Aborted" },
      },
      {
        error: { name: "MessageOutputLengthError", data: {} },
        stopReason: "max_tokens",
        meta: { name: "MessageOutputLengthError" },
      },
    ]
    for (const { error, stopReason, meta } of cases) {
      expect(ACPError.mapAssistantError(error, {})).toEqual({ kind: "stop", stopReason, meta })
    }
  })

  test("maps auth and payment errors to authRequired with the provider message", () => {
    const cases: Array<{ error: ACPError.AssistantError; ctx: { providerID?: string }; message: string }> = [
      {
        error: { name: "ProviderAuthError", data: { providerID: "anthropic", message: "invalid api key" } },
        ctx: {},
        message: "invalid api key",
      },
      {
        error: { name: "APIError", data: { message: "余额不足", statusCode: 402, isRetryable: false } },
        ctx: { providerID: "custom" },
        message: "余额不足",
      },
    ]
    for (const { error, ctx, message } of cases) {
      const mapped = ACPError.mapAssistantError(error, ctx)
      expect(mapped.kind).toBe("fail")
      if (mapped.kind !== "fail") continue
      const requestError = ACPError.toRequestError(mapped.error)
      expect(requestError.code).toBe(-32000)
      expect(requestError.message).toContain(message)
    }
  })

  test("maps generic upstream errors to internalError", () => {
    const errors: ACPError.AssistantError[] = [
      { name: "APIError", data: { message: "server error", statusCode: 500, isRetryable: true } },
      { name: "ContextOverflowError", data: { message: "too long" } },
      { name: "StructuredOutputError", data: { message: "bad json", retries: 0 } },
      { name: "UnknownError", data: { message: "boom" } },
    ]
    for (const error of errors) {
      const mapped = ACPError.mapAssistantError(error, {})
      expect(mapped.kind).toBe("fail")
      if (mapped.kind !== "fail") continue
      expect(ACPError.toRequestError(mapped.error).code).toBe(-32603)
    }
  })

  test("authRequired error forwards safeMessage to the client", () => {
    const requestError = ACPError.toRequestError(
      new ACPError.AuthRequiredError({ providerId: "anthropic", safeMessage: "billing: quota exceeded" }),
    )
    expect(requestError.code).toBe(-32000)
    expect(requestError.message).toContain("billing: quota exceeded")
  })

  test("isPaymentRelatedMessage detects billing phrases in error text", () => {
    expect(ACPError.isPaymentRelatedMessage("Insufficient Balance")).toBe(true)
    expect(ACPError.isPaymentRelatedMessage("余额不足")).toBe(true)
    expect(ACPError.isPaymentRelatedMessage("quota exceeded")).toBe(true)
    expect(ACPError.isPaymentRelatedMessage("a transient network error")).toBe(false)
    expect(ACPError.isPaymentRelatedMessage("rate limit exceeded")).toBe(false)
    expect(ACPError.isPaymentRelatedMessage("Too many requests")).toBe(false)
    expect(ACPError.isPaymentRelatedMessage(undefined)).toBe(false)
  })

  test("maps UnknownError with a payment message to authRequired", () => {
    // Mirrors a provider billing failure (HTTP non-200, "Insufficient Balance")
    // that the LLM layer raised as an LLMError and fromError collapsed to
    // UnknownError before the session-layer fix.
    const mapped = ACPError.mapAssistantError(
      { name: "UnknownError", data: { message: "RequestExecutor.execute: Insufficient Balance" } },
      { providerID: "custom" },
    )
    expect(mapped.kind).toBe("fail")
    if (mapped.kind !== "fail") return
    const requestError = ACPError.toRequestError(mapped.error)
    expect(requestError.code).toBe(-32000)
    expect(requestError.message).toContain("Insufficient Balance")
  })

  test("maps APIError without a status code but a payment message to authRequired", () => {
    const mapped = ACPError.mapAssistantError(
      { name: "APIError", data: { message: "Insufficient Balance", isRetryable: false } },
      { providerID: "custom" },
    )
    expect(mapped.kind).toBe("fail")
    if (mapped.kind !== "fail") return
    expect(ACPError.toRequestError(mapped.error).code).toBe(-32000)
  })
})
