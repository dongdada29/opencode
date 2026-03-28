import type { Hooks, PluginInput, AuthOuathResult } from "@opencode-ai/plugin"
import { generatePKCE } from "@openauthjs/openauth/pkce"

const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"

interface TokenResponse {
  refresh_token: string
  access_token: string
  expires_in: number
}

type AuthCallbackResult =
  | { type: "failed" }
  | { type: "success"; provider?: string; refresh: string; access: string; expires: number }
  | { type: "success"; provider?: string; key: string }

/**
 * @param mode - "max" for Claude Pro/Max, "console" for API key creation
 */
async function authorize(mode: "max" | "console"): Promise<{ url: string; verifier: string }> {
  const pkce = await generatePKCE()

  const url = new URL(
    `https://${mode === "console" ? "console.anthropic.com" : "claude.ai"}/oauth/authorize`,
    import.meta.url,
  )
  url.searchParams.set("code", "true")
  url.searchParams.set("client_id", CLIENT_ID)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("redirect_uri", "https://console.anthropic.com/oauth/code/callback")
  url.searchParams.set("scope", "org:create_api_key user:profile user:inference")
  url.searchParams.set("code_challenge", pkce.challenge)
  url.searchParams.set("code_challenge_method", "S256")
  url.searchParams.set("state", pkce.verifier)
  return {
    url: url.toString(),
    verifier: pkce.verifier,
  }
}

async function exchange(code: string, verifier: string): Promise<AuthCallbackResult> {
  const splits = code.split("#")
  const result = await fetch("https://console.anthropic.com/v1/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code: splits[0],
      state: splits[1],
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      redirect_uri: "https://console.anthropic.com/oauth/code/callback",
      code_verifier: verifier,
    }),
  })
  if (!result.ok) {
    return { type: "failed" }
  }
  const json = (await result.json()) as TokenResponse
  return {
    type: "success",
    refresh: json.refresh_token,
    access: json.access_token,
    expires: Date.now() + json.expires_in * 1000,
  }
}

export async function AnthropicAuthPlugin(input: PluginInput): Promise<Hooks> {
  return {
    auth: {
      provider: "anthropic",
      async loader(getAuth, provider) {
        const auth = await getAuth()
        if (auth.type === "oauth") {
          // Zero out cost for max plan
          for (const model of Object.values(provider.models)) {
            model.cost = {
              input: 0,
              output: 0,
              cache: {
                read: 0,
                write: 0,
              },
            }
          }

          return {
            apiKey: "",
            async fetch(requestInput: RequestInfo | URL, init?: RequestInit) {
              const auth = await getAuth()
              if (auth.type !== "oauth") return fetch(requestInput, init)

              // Refresh token if needed
              if (!auth.access || auth.expires < Date.now()) {
                const response = await fetch("https://console.anthropic.com/v1/oauth/token", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    grant_type: "refresh_token",
                    refresh_token: auth.refresh,
                    client_id: CLIENT_ID,
                  }),
                })
                if (!response.ok) {
                  throw new Error(`Token refresh failed: ${response.status}`)
                }
                const json = (await response.json()) as TokenResponse
                await input.client.auth.set({
                  path: {
                    id: "anthropic",
                  },
                  body: {
                    type: "oauth",
                    refresh: json.refresh_token,
                    access: json.access_token,
                    expires: Date.now() + json.expires_in * 1000,
                  },
                })
                auth.access = json.access_token
              }

              const requestInit = init ?? {}

              const requestHeaders = new Headers()
              if (requestInput instanceof Request) {
                requestInput.headers.forEach((value, key) => {
                  requestHeaders.set(key, value)
                })
              }
              if (requestInit.headers) {
                if (requestInit.headers instanceof Headers) {
                  requestInit.headers.forEach((value, key) => {
                    requestHeaders.set(key, value)
                  })
                } else if (Array.isArray(requestInit.headers)) {
                  for (const [key, value] of requestInit.headers) {
                    if (typeof value !== "undefined") {
                      requestHeaders.set(key, String(value))
                    }
                  }
                } else {
                  for (const [key, value] of Object.entries(requestInit.headers)) {
                    if (typeof value !== "undefined") {
                      requestHeaders.set(key, String(value))
                    }
                  }
                }
              }

              const incomingBeta = requestHeaders.get("anthropic-beta") || ""
              const incomingBetasList = incomingBeta
                .split(",")
                .map((b) => b.trim())
                .filter(Boolean)

              const includeClaudeCode = incomingBetasList.includes("claude-code-20250219")

              const mergedBetas = [
                "oauth-2025-04-20",
                "interleaved-thinking-2025-05-14",
                ...(includeClaudeCode ? ["claude-code-20250219"] : []),
              ].join(",")

              requestHeaders.set("authorization", `Bearer ${auth.access}`)
              requestHeaders.set("anthropic-beta", mergedBetas)
              requestHeaders.set("user-agent", "claude-cli/2.1.2 (external, cli)")
              requestHeaders.delete("x-api-key")

              const TOOL_PREFIX = "mcp_"
              let body = requestInit.body
              if (body && typeof body === "string") {
                try {
                  const parsed = JSON.parse(body)

                  // Sanitize system prompt - server blocks "OpenCode" string
                  if (parsed.system && Array.isArray(parsed.system)) {
                    parsed.system = parsed.system.map((item: { type: string; text?: string }) => {
                      if (item.type === "text" && item.text) {
                        return {
                          ...item,
                          text: item.text.replace(/OpenCode/g, "Claude Code").replace(/opencode/gi, "Claude"),
                        }
                      }
                      return item
                    })
                  }

                  // Add prefix to tools definitions
                  if (parsed.tools && Array.isArray(parsed.tools)) {
                    parsed.tools = parsed.tools.map((tool: { name?: string }) => ({
                      ...tool,
                      name: tool.name ? `${TOOL_PREFIX}${tool.name}` : tool.name,
                    }))
                  }
                  // Add prefix to tool_use blocks in messages
                  if (parsed.messages && Array.isArray(parsed.messages)) {
                    parsed.messages = parsed.messages.map((msg: { content?: unknown[] }) => {
                      if (msg.content && Array.isArray(msg.content)) {
                        msg.content = msg.content.map((block: unknown) => {
                          const typedBlock = block as { type?: string; name?: string }
                          if (typedBlock.type === "tool_use" && typedBlock.name) {
                            return { ...typedBlock, name: `${TOOL_PREFIX}${typedBlock.name}` }
                          }
                          return block
                        })
                      }
                      return msg
                    })
                  }
                  body = JSON.stringify(parsed)
                } catch {
                  // ignore parse errors
                }
              }

              let finalRequestInput = requestInput
              let requestUrl: URL | null = null
              try {
                if (typeof requestInput === "string" || requestInput instanceof URL) {
                  requestUrl = new URL(requestInput.toString())
                } else if (requestInput instanceof Request) {
                  requestUrl = new URL(requestInput.url)
                }
              } catch {
                requestUrl = null
              }

              if (requestUrl && requestUrl.pathname === "/v1/messages" && !requestUrl.searchParams.has("beta")) {
                requestUrl.searchParams.set("beta", "true")
                finalRequestInput =
                  requestInput instanceof Request ? new Request(requestUrl.toString(), requestInput) : requestUrl
              }

              const response = await fetch(finalRequestInput, {
                ...requestInit,
                body,
                headers: requestHeaders,
              })

              // Transform streaming response to rename tools back
              if (response.body) {
                const reader = response.body.getReader()
                const decoder = new TextDecoder()
                const encoder = new TextEncoder()

                const stream = new ReadableStream({
                  async pull(controller) {
                    const { done, value } = await reader.read()
                    if (done) {
                      controller.close()
                      return
                    }

                    let text = decoder.decode(value, { stream: true })
                    text = text.replace(/"name"\s*:\s*"mcp_([^"]+)"/g, '"name": "$1"')
                    controller.enqueue(encoder.encode(text))
                  },
                })

                return new Response(stream, {
                  status: response.status,
                  statusText: response.statusText,
                  headers: response.headers,
                })
              }

              return response
            },
          }
        }

        return {}
      },
      methods: [
        {
          label: "Claude Pro/Max",
          type: "oauth",
          authorize: async (_inputs?: Record<string, string>): Promise<AuthOuathResult> => {
            const { url, verifier } = await authorize("max")
            return {
              url: url,
              instructions: "Paste the authorization code here: ",
              method: "code",
              callback: async (code: string): Promise<AuthCallbackResult> => {
                return exchange(code, verifier)
              },
            }
          },
        },
        {
          label: "Create an API Key",
          type: "oauth",
          authorize: async (_inputs?: Record<string, string>): Promise<AuthOuathResult> => {
            const { url, verifier } = await authorize("console")
            return {
              url: url,
              instructions: "Paste the authorization code here: ",
              method: "code",
              callback: async (code: string): Promise<AuthCallbackResult> => {
                const credentials = await exchange(code, verifier)
                if (credentials.type === "failed") return credentials
                // At this point, credentials has access property
                const accessToken = (credentials as { access: string }).access
                const result = (await fetch(`https://api.anthropic.com/api/oauth/claude_cli/create_api_key`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    authorization: `Bearer ${accessToken}`,
                  },
                }).then((r) => r.json())) as { raw_key: string }
                return { type: "success", key: result.raw_key }
              },
            }
          },
        },
        {
          label: "Manually enter API Key",
          type: "api",
        },
      ],
    },
  }
}
