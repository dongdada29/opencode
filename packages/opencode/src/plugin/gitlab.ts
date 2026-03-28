import type { Hooks, PluginInput, AuthOuathResult } from "@opencode-ai/plugin"
import { Log } from "../util/log"
import * as crypto from "crypto"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { exec } from "child_process"

const log = Log.create({ service: "plugin.gitlab" })

/**
 * GitLab OAuth constants
 */
// IMPORTANT: The bundled client ID below is from gitlab-vscode-extension and is registered
// with redirect URI: vscode://gitlab.gitlab-workflow/authentication
// This will NOT work with OpenCode's local HTTP callback server.
// To fix: Set GITLAB_OAUTH_CLIENT_ID environment variable with your own client ID.
const BUNDLED_CLIENT_ID =
  process.env.GITLAB_OAUTH_CLIENT_ID || "1d89f9fdb23ee96d4e603201f6861dab6e143c5c3c00469a018a2d94bdc03d4e"
const GITLAB_COM_URL = "https://gitlab.com"
const OAUTH_SCOPES = ["api"]

/**
 * Debug logging to file (doesn't break UI)
 */
function debugLog(message: string, data?: unknown) {
  try {
    const homeDir = os.homedir()
    const logDir = path.join(homeDir, ".local", "share", "nuwaxcode", "log")
    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }
    const logPath = path.join(logDir, "gitlab-auth.log")
    const timestamp = new Date().toISOString()
    const logLine = data ? `[${timestamp}] ${message}: ${JSON.stringify(data)}\n` : `[${timestamp}] ${message}\n`
    fs.appendFileSync(logPath, logLine)
  } catch {
    // Ignore logging errors
  }
}

/**
 * Get OpenCode auth file path
 */
function getAuthPath(): string {
  const homeDir = os.homedir()
  const xdgDataHome = process.env.XDG_DATA_HOME
  if (xdgDataHome) {
    return path.join(xdgDataHome, "nuwaxcode", "auth.json")
  }
  if (process.platform !== "win32") {
    return path.join(homeDir, ".local", "share", "nuwaxcode", "auth.json")
  }
  return path.join(homeDir, ".nuwaxcode", "auth.json")
}

/**
 * Save auth data to OpenCode's auth.json
 * Workaround for OpenCode not saving the enterpriseUrl field
 */
async function saveAuthData(
  access: string,
  refresh: string,
  expires: number,
  enterpriseUrl: string,
): Promise<void> {
  const authPath = getAuthPath()
  const authDir = path.dirname(authPath)
  // Ensure directory exists
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
  }
  // Read existing auth data
  let authData: Record<string, unknown> = {}
  if (fs.existsSync(authPath)) {
    const content = fs.readFileSync(authPath, "utf-8")
    authData = JSON.parse(content)
  }
  // Update GitLab auth
  authData.gitlab = {
    type: "oauth",
    access,
    refresh,
    expires,
    enterpriseUrl,
  }
  // Write back
  fs.writeFileSync(authPath, JSON.stringify(authData, null, 2))
  fs.chmodSync(authPath, 0o600)
}

/**
 * Read auth data from file
 */
function readAuthData(): { type: string; access: string; refresh: string; expires: number; enterpriseUrl?: string } | null {
  try {
    const authPath = getAuthPath()
    if (!fs.existsSync(authPath)) return null
    const content = fs.readFileSync(authPath, "utf-8")
    const authData = JSON.parse(content) as Record<string, unknown>
    const gitlab = authData.gitlab as { type: string; access?: string; refresh?: string; expires?: number; enterpriseUrl?: string } | undefined
    if (!gitlab || gitlab.type !== "oauth") return null
    return {
      type: "oauth",
      access: gitlab.access || "",
      refresh: gitlab.refresh || "",
      expires: gitlab.expires || 0,
      enterpriseUrl: gitlab.enterpriseUrl,
    }
  } catch {
    return null
  }
}

/**
 * Generate a cryptographically secure random string for PKCE
 */
function generateSecret(length = 43): string {
  const bytes = crypto.randomBytes(length)
  return base64UrlEncode(bytes)
}

/**
 * Generate a code challenge from a code verifier using SHA-256
 */
function generateCodeChallengeFromVerifier(verifier: string): string {
  const hash = crypto.createHash("sha256").update(verifier).digest()
  return base64UrlEncode(hash)
}

/**
 * Base64 URL-encode a buffer (RFC 4648 Section 5)
 */
function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

interface CallbackResult {
  code: string
  state: string
}

interface GitLabTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeAuthorizationCode(
  instanceUrl: string,
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<GitLabTokenResponse> {
  const baseUrl = instanceUrl.replace(/\/$/, "")
  const tokenUrl = `${baseUrl}/oauth/token`
  const params = new URLSearchParams({
    client_id: BUNDLED_CLIENT_ID,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  })
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${errorText}`)
  }
  return response.json() as Promise<GitLabTokenResponse>
}

/**
 * Exchange refresh token for new access token
 */
async function exchangeRefreshToken(instanceUrl: string, refreshToken: string): Promise<GitLabTokenResponse> {
  const baseUrl = instanceUrl.replace(/\/$/, "")
  const tokenUrl = `${baseUrl}/oauth/token`
  const params = new URLSearchParams({
    client_id: BUNDLED_CLIENT_ID,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  })
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Token refresh failed: ${response.status} ${response.statusText} - ${errorText}`)
  }
  return response.json() as Promise<GitLabTokenResponse>
}

const OAUTH_PORT = 8080

const HTML_SUCCESS = `<!DOCTYPE html>
<html>
  <head><title>Authentication Successful</title></head>
  <body>
    <h1>Authentication Successful</h1>
    <p>You can close this window and return to your terminal.</p>
  </body>
</html>`

const HTML_ERROR = (error: string) => `<!DOCTYPE html>
<html>
  <head><title>Authentication Failed</title></head>
  <body>
    <h1>Authentication Failed</h1>
    <p>${error}</p>
    <p>You can close this window.</p>
  </body>
</html>`

interface PendingOAuth {
  state: string
  resolve: (result: CallbackResult) => void
  reject: (error: Error) => void
}

let oauthServer: ReturnType<typeof Bun.serve> | undefined
let pendingOAuth: PendingOAuth | undefined

async function startOAuthServer(): Promise<{ port: number; redirectUri: string }> {
  if (oauthServer) {
    return { port: OAUTH_PORT, redirectUri: `http://127.0.0.1:${OAUTH_PORT}/callback` }
  }

  oauthServer = Bun.serve({
    port: OAUTH_PORT,
    fetch(req) {
      const url = new URL(req.url)

      if (url.pathname === "/callback") {
        const code = url.searchParams.get("code")
        const state = url.searchParams.get("state")
        const error = url.searchParams.get("error")
        const errorDescription = url.searchParams.get("error_description")

        if (error) {
          const errorMsg = errorDescription || error
          pendingOAuth?.reject(new Error(`OAuth error: ${errorMsg}`))
          pendingOAuth = undefined
          return new Response(HTML_ERROR(errorMsg), {
            headers: { "Content-Type": "text/html" },
          })
        }

        if (!code || !state) {
          const errorMsg = "Missing code or state parameter"
          pendingOAuth?.reject(new Error(errorMsg))
          pendingOAuth = undefined
          return new Response(HTML_ERROR(errorMsg), {
            status: 400,
            headers: { "Content-Type": "text/html" },
          })
        }

        if (!pendingOAuth || state !== pendingOAuth.state) {
          const errorMsg = "Invalid state - possible CSRF attack"
          pendingOAuth?.reject(new Error(errorMsg))
          pendingOAuth = undefined
          return new Response(HTML_ERROR(errorMsg), {
            status: 400,
            headers: { "Content-Type": "text/html" },
          })
        }

        const current = pendingOAuth
        pendingOAuth = undefined
        current.resolve({ code, state })

        return new Response(HTML_SUCCESS, {
          headers: { "Content-Type": "text/html" },
        })
      }

      return new Response("Not found", { status: 404 })
    },
  })

  log.info("gitlab oauth server started", { port: OAUTH_PORT })
  return { port: OAUTH_PORT, redirectUri: `http://127.0.0.1:${OAUTH_PORT}/callback` }
}

function stopOAuthServer() {
  if (oauthServer) {
    oauthServer.stop()
    oauthServer = undefined
    log.info("gitlab oauth server stopped")
  }
}

function waitForOAuthCallback(state: string, timeout = 120000): Promise<CallbackResult> {
  return new Promise((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      if (pendingOAuth && pendingOAuth.state === state) {
        pendingOAuth = undefined
        reject(new Error("OAuth callback timeout"))
      }
    }, timeout)

    pendingOAuth = {
      state,
      resolve: (result) => {
        clearTimeout(timeoutHandle)
        resolve(result)
      },
      reject: (error) => {
        clearTimeout(timeoutHandle)
        reject(error)
      },
    }
  })
}

type AuthCallbackResult =
  | { type: "failed" }
  | { type: "success"; provider?: string; refresh: string; access: string; expires: number }

export async function GitLabAuthPlugin(input: PluginInput): Promise<Hooks> {
  return {
    auth: {
      provider: "gitlab",
      /**
       * Loader function to provide auth credentials to the GitLab AI SDK provider
       * Automatically refreshes OAuth tokens if expired or expiring soon
       */
      async loader(getAuth) {
        const auth = await getAuth()
        if (!auth || auth.type !== "oauth") return {}

        // For OAuth, check token expiry and refresh if needed
        const authWithUrl = auth as typeof auth & { enterpriseUrl?: string }
        const instanceUrl = authWithUrl.enterpriseUrl || "https://gitlab.com"
        const now = Date.now()
        const expiryBuffer = 5 * 60 * 1000 // 5 minutes buffer

        // Check if token is expired or expiring soon
        if (auth.expires > now + expiryBuffer) {
          debugLog("Token is still valid", {
            expiresAt: new Date(auth.expires).toISOString(),
            expiresIn: Math.round((auth.expires - now) / 1000 / 60) + " minutes",
          })
          return {
            apiKey: auth.access || "",
            instanceUrl,
          }
        }

        // Token needs refresh
        debugLog("Token expired or expiring soon, refreshing...", {
          expiresAt: new Date(auth.expires).toISOString(),
          expired: auth.expires <= now,
        })

        try {
          const tokens = await exchangeRefreshToken(instanceUrl, auth.refresh)
          const newExpiry = Date.now() + tokens.expires_in * 1000

          debugLog("Token refresh successful", {
            newExpiresAt: new Date(newExpiry).toISOString(),
            expiresIn: Math.round(tokens.expires_in / 60) + " minutes",
          })

          // Save the new tokens
          await saveAuthData(tokens.access_token, tokens.refresh_token, newExpiry, instanceUrl)

          // Also update via SDK
          await input.client.auth.set({
            path: { id: "gitlab" },
            body: {
              type: "oauth",
              refresh: tokens.refresh_token,
              access: tokens.access_token,
              expires: newExpiry,
            },
          })

          debugLog("New tokens saved successfully")

          return {
            apiKey: tokens.access_token,
            instanceUrl,
          }
        } catch (error) {
          debugLog("Failed to refresh token in loader", {
            error: error instanceof Error ? error.message : String(error),
          })

          // Fall back to returning the existing (possibly expired) token
          return {
            apiKey: auth.access || "",
            instanceUrl,
          }
        }
      },
      methods: [
        {
          type: "oauth",
          label: "GitLab OAuth",
          prompts: [
            {
              type: "text",
              key: "instanceUrl",
              message: "GitLab instance URL",
              placeholder: "https://gitlab.com",
              validate: (value: string) => {
                if (!value) {
                  return "Instance URL is required"
                }
                try {
                  new URL(value)
                  return undefined
                } catch {
                  return "Invalid URL format"
                }
              },
            },
          ],
          async authorize(inputs?: Record<string, string>): Promise<AuthOuathResult> {
            const instanceUrl = inputs?.instanceUrl || GITLAB_COM_URL
            // Normalize instance URL
            let normalizedUrl: string
            try {
              const url = new URL(instanceUrl)
              normalizedUrl = `${url.protocol}//${url.host}`
            } catch {
              throw new Error(`Invalid GitLab instance URL: ${instanceUrl}`)
            }
            // Generate PKCE parameters
            const codeVerifier = generateSecret(43)
            const codeChallenge = generateCodeChallengeFromVerifier(codeVerifier)
            const state = generateSecret(32)
            // Start callback server
            const { redirectUri } = await startOAuthServer()
            const callbackPromise = waitForOAuthCallback(state)
            // Build authorization URL
            const params = new URLSearchParams({
              client_id: BUNDLED_CLIENT_ID,
              redirect_uri: redirectUri,
              response_type: "code",
              state,
              scope: OAUTH_SCOPES.join(" "),
              code_challenge: codeChallenge,
              code_challenge_method: "S256",
            })
            const authUrl = `${normalizedUrl}/oauth/authorize?${params.toString()}`
            // Open browser automatically
            const platform = process.platform
            const openCommand = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open"
            exec(`${openCommand} "${authUrl}"`)
            return {
              method: "auto",
              url: authUrl,
              instructions:
                "Your browser will open for authentication. The callback will be handled automatically.",
              async callback(): Promise<AuthCallbackResult> {
                debugLog("callback() called")
                try {
                  // Wait for the OAuth callback from our local server
                  debugLog("Waiting for callback...")
                  const result = await callbackPromise
                  debugLog("Received callback", { hasCode: !!result.code, hasState: !!result.state })
                  // Verify state matches
                  if (result.state !== state) {
                    debugLog("State mismatch", { expected: state, received: result.state })
                    stopOAuthServer()
                    return { type: "failed" }
                  }
                  debugLog("State verified")
                  // Exchange code for tokens
                  debugLog("Exchanging code for tokens...")
                  const tokens = await exchangeAuthorizationCode(normalizedUrl, result.code, codeVerifier, redirectUri)
                  debugLog("Token exchange successful")
                  // Stop the callback server
                  stopOAuthServer()
                  // Calculate expiry
                  const expiresAt = Date.now() + tokens.expires_in * 1000
                  debugLog("Tokens received", { expiresAt: new Date(expiresAt).toISOString() })
                  // Save auth data (workaround for OpenCode not saving enterpriseUrl)
                  debugLog("Saving auth data...")
                  await saveAuthData(tokens.access_token, tokens.refresh_token, expiresAt, normalizedUrl)
                  debugLog("Auth data saved successfully")
                  return {
                    type: "success",
                    provider: normalizedUrl,
                    access: tokens.access_token,
                    refresh: tokens.refresh_token,
                    expires: expiresAt,
                  }
                } catch (error) {
                  debugLog("Error in callback", {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                  })
                  // Stop the callback server
                  stopOAuthServer()
                  return { type: "failed" }
                }
              },
            }
          },
        },
        {
          type: "api",
          label: "GitLab Personal Access Token",
          prompts: [
            {
              type: "text",
              key: "instanceUrl",
              message: "GitLab instance URL",
              placeholder: "https://gitlab.com",
              validate: (value: string) => {
                if (!value) {
                  return "Instance URL is required"
                }
                try {
                  new URL(value)
                  return undefined
                } catch {
                  return "Invalid URL format"
                }
              },
            },
            {
              type: "text",
              key: "token",
              message: "Personal Access Token",
              placeholder: "glpat-xxxxxxxxxxxxxxxxxxxx",
              validate: (value: string) => {
                if (!value) {
                  return "Token is required"
                }
                if (!value.startsWith("glpat-")) {
                  return "Token should start with glpat-"
                }
                return undefined
              },
            },
          ],
          async authorize(inputs?: Record<string, string>) {
            const instanceUrl = inputs?.instanceUrl || GITLAB_COM_URL
            const token = inputs?.token
            if (!token) {
              return { type: "failed" as const }
            }
            // Normalize instance URL
            let normalizedUrl: string
            try {
              const url = new URL(instanceUrl)
              normalizedUrl = `${url.protocol}//${url.host}`
            } catch {
              return { type: "failed" as const }
            }
            // Validate token by making a test request
            try {
              const response = await fetch(`${normalizedUrl}/api/v4/user`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              })
              if (!response.ok) {
                return { type: "failed" as const }
              }
              return {
                type: "success" as const,
                key: token,
                provider: normalizedUrl,
              }
            } catch {
              return { type: "failed" as const }
            }
          },
        },
      ],
    },
  }
}
