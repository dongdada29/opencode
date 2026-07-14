import { RequestError } from "@agentclientprotocol/sdk"
import type { AssistantMessage } from "@opencode-ai/sdk/v2"
import { Schema } from "effect"

export class SessionNotFoundError extends Schema.TaggedErrorClass<SessionNotFoundError>()("ACPSessionNotFoundError", {
  sessionId: Schema.String,
}) {}

export class InvalidConfigOptionError extends Schema.TaggedErrorClass<InvalidConfigOptionError>()(
  "ACPInvalidConfigOptionError",
  {
    configId: Schema.String,
  },
) {}

export class InvalidModelError extends Schema.TaggedErrorClass<InvalidModelError>()("ACPInvalidModelError", {
  modelId: Schema.String,
  providerId: Schema.optional(Schema.String),
}) {}

export class InvalidEffortError extends Schema.TaggedErrorClass<InvalidEffortError>()("ACPInvalidEffortError", {
  effort: Schema.String,
}) {}

export class InvalidModeError extends Schema.TaggedErrorClass<InvalidModeError>()("ACPInvalidModeError", {
  mode: Schema.String,
}) {}

export class AuthRequiredError extends Schema.TaggedErrorClass<AuthRequiredError>()("ACPAuthRequiredError", {
  providerId: Schema.optional(Schema.String),
  safeMessage: Schema.optional(Schema.String),
}) {}

export class UnknownAuthMethodError extends Schema.TaggedErrorClass<UnknownAuthMethodError>()(
  "ACPUnknownAuthMethodError",
  {
    methodId: Schema.String,
  },
) {}

export class UnsupportedOperationError extends Schema.TaggedErrorClass<UnsupportedOperationError>()(
  "ACPUnsupportedOperationError",
  {
    method: Schema.String,
  },
) {}

export class ServiceFailureError extends Schema.TaggedErrorClass<ServiceFailureError>()("ACPServiceFailureError", {
  safeMessage: Schema.String,
  service: Schema.optional(Schema.String),
}) {}

export type Error =
  | SessionNotFoundError
  | InvalidConfigOptionError
  | InvalidModelError
  | InvalidEffortError
  | InvalidModeError
  | AuthRequiredError
  | UnknownAuthMethodError
  | UnsupportedOperationError
  | ServiceFailureError

export function toRequestError(error: Error) {
  switch (error._tag) {
    case "ACPSessionNotFoundError":
      return RequestError.invalidParams({ sessionId: error.sessionId }, `session not found: ${error.sessionId}`)
    case "ACPInvalidConfigOptionError":
      return RequestError.invalidParams({ configId: error.configId }, `unknown config option: ${error.configId}`)
    case "ACPInvalidModelError":
      return RequestError.invalidParams(
        { providerId: error.providerId, modelId: error.modelId },
        `model not found: ${error.modelId}`,
      )
    case "ACPInvalidEffortError":
      return RequestError.invalidParams({ effort: error.effort }, `effort not found: ${error.effort}`)
    case "ACPInvalidModeError":
      return RequestError.invalidParams({ mode: error.mode }, `mode not found: ${error.mode}`)
    case "ACPAuthRequiredError":
      return RequestError.authRequired(
        { providerId: error.providerId },
        error.safeMessage ?? "provider authentication required",
      )
    case "ACPUnknownAuthMethodError":
      return RequestError.invalidParams({ methodId: error.methodId }, `unknown auth method: ${error.methodId}`)
    case "ACPUnsupportedOperationError":
      return RequestError.methodNotFound(error.method)
    case "ACPServiceFailureError":
      return RequestError.internalError({ service: error.service }, error.safeMessage)
  }
}

export function fromUnknownDefect(_defect: unknown, safeMessage = "Internal service failure") {
  return new ServiceFailureError({ safeMessage })
}

/**
 * An assistant message error as reported by the backing opencode session
 * (`info.error`), discriminated by `name`. Mirrors the union in the SDK's
 * `AssistantMessage.error`.
 */
export type AssistantError = NonNullable<AssistantMessage["error"]>

export type AssistantErrorMeta = {
  readonly name: string
  readonly message?: string
  readonly statusCode?: number
}

/**
 * Outcome of mapping an assistant error to an ACP turn termination. A `stop`
 * outcome ends the turn with a semantically-matching {@link StopReason}
 * (and the error details in `_meta`); a `fail` outcome surfaces the error as
 * a JSON-RPC error response via the existing `toRequestError` plumbing.
 */
export type MappedAssistantError =
  | {
      readonly kind: "stop"
      readonly stopReason: "refusal" | "cancelled" | "max_tokens"
      readonly meta: AssistantErrorMeta
    }
  | { readonly kind: "fail"; readonly error: Error }

// NOTE: deliberately avoids bare `limit.?exceeded` / `exceeded` — those match
// "rate limit exceeded" / "Too many requests", which are retryable throttling,
// not billing failures. Match concrete billing signals instead.
const PAYMENT_ERROR_RE =
  /insufficient|out of (credit|balance|quota|funds)|quota|payment|billing|exhausted|余额|额度|欠费|充值/i

/**
 * Heuristic: does this API error look like a billing/quota failure rather
 * than a generic upstream error? Payment failures are routed to
 * `authRequired` so clients can prompt re-auth / billing instead of retrying.
 */
export function isPaymentRelatedApiError(data: {
  readonly statusCode?: number
  readonly responseBody?: string
}): boolean {
  if (data.statusCode === 402) return true
  if (data.statusCode === 429) {
    const body = (data.responseBody ?? "").slice(0, 2048)
    return PAYMENT_ERROR_RE.test(body)
  }
  return false
}

/**
 * Heuristic: does the error message text read like a billing/quota failure?
 * Used when no structured status code is available — e.g. an `UnknownError`
 * derived from an `LLMError` whose `reason` was dropped by `fromError`. The
 * message is provider-formatted and user-facing, so matching on it is safe
 * (it is also what we forward to the client as `safeMessage`).
 */
export function isPaymentRelatedMessage(text: string | undefined): boolean {
  if (!text) return false
  return PAYMENT_ERROR_RE.test(text.slice(0, 2048))
}

/**
 * Map a provider/assistant error embedded in a session message to the ACP
 * termination that best expresses it:
 * - content-filter -> refusal, abort -> cancelled, output-length -> max_tokens
 * - auth / payment (e.g. quota exhausted) -> authRequired JSON-RPC error
 * - everything else -> internalError JSON-RPC error
 *
 * Only `data.message` (provider-formatted, user-facing) is forwarded; raw
 * response bodies / headers are never leaked to the client.
 */
export function mapAssistantError(
  error: AssistantError,
  ctx: { readonly providerID?: string },
): MappedAssistantError {
  switch (error.name) {
    case "ContentFilterError":
      return { kind: "stop", stopReason: "refusal", meta: { name: error.name, message: error.data.message } }
    case "MessageAbortedError":
      return { kind: "stop", stopReason: "cancelled", meta: { name: error.name, message: error.data.message } }
    case "MessageOutputLengthError":
      return { kind: "stop", stopReason: "max_tokens", meta: { name: error.name } }
    case "ProviderAuthError":
      return {
        kind: "fail",
        error: new AuthRequiredError({ providerId: error.data.providerID, safeMessage: error.data.message }),
      }
    case "APIError": {
      const data = error.data
      if (
        isPaymentRelatedApiError({ statusCode: data.statusCode, responseBody: data.responseBody }) ||
        isPaymentRelatedMessage(data.message)
      ) {
        return {
          kind: "fail",
          error: new AuthRequiredError({ providerId: ctx.providerID, safeMessage: data.message }),
        }
      }
      return { kind: "fail", error: new ServiceFailureError({ service: "provider", safeMessage: data.message }) }
    }
    case "ContextOverflowError":
      return {
        kind: "fail",
        error: new ServiceFailureError({
          service: "session",
          safeMessage: `context limit exceeded: ${error.data.message}`,
        }),
      }
    case "StructuredOutputError":
      return { kind: "fail", error: new ServiceFailureError({ service: "session", safeMessage: error.data.message }) }
    case "UnknownError":
      if (isPaymentRelatedMessage(error.data.message)) {
        return {
          kind: "fail",
          error: new AuthRequiredError({ providerId: ctx.providerID, safeMessage: error.data.message }),
        }
      }
      return { kind: "fail", error: new ServiceFailureError({ service: "provider", safeMessage: error.data.message }) }
    default:
      // Defensive: runtime JSON may carry an error name outside the typed
      // union (e.g. after a provider schema upgrade).
      return {
        kind: "fail",
        error: new ServiceFailureError({ service: "provider", safeMessage: "unrecognized provider error" }),
      }
  }
}
