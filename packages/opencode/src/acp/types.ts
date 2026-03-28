import type { McpServer } from "@agentclientprotocol/sdk"
import type { OpencodeClient } from "@opencode-ai/sdk/v2"

export interface ACPSessionState {
  id: string
  cwd: string
  mcpServers: McpServer[]
  createdAt: Date
  model?: {
    providerID: string
    modelID: string
  }
  modeId?: string
  /** System prompt passed via ACP _meta.systemPrompt */
  systemPrompt?: string | { append: string }
  /** MCP 懒加载 promise，newSession 时 fire-and-forget，首次 prompt 时 await */
  mcpInitPromise?: Promise<void>
}

export interface ACPConfig {
  sdk: OpencodeClient
  defaultModel?: {
    providerID: string
    modelID: string
  }
}
