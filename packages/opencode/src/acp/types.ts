import type { McpServer } from "@agentclientprotocol/sdk"
import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import type { ProviderID, ModelID } from "../provider/schema"

/**
 * ACP `session/new` 在 `params._meta.systemPrompt` 里下发的系统提示（与 claude-code-acp 等客户端约定一致）。
 * - 字符串：作为本条会话每次 `prompt` 传给后端的 `system` 全文；
 * - `{ append }`：仅追加片段，由 HTTP `session.prompt` 的 `system` 字段传入，在 LLM 层与 agent / provider 提示合并。
 */
export type ACPSystemPromptMeta = string | { append: string }

export interface ACPSessionState {
  id: string
  cwd: string
  mcpServers: McpServer[]
  createdAt: Date
  model?: {
    providerID: ProviderID
    modelID: ModelID
  }
  variant?: string
  modeId?: string
  /** 来自 `newSession` 的 `_meta.systemPrompt`，在每次非 slash-command 的 `prompt` 中映射为 SDK 的 `system` */
  systemPrompt?: ACPSystemPromptMeta
}

export interface ACPConfig {
  sdk: OpencodeClient
  defaultModel?: {
    providerID: ProviderID
    modelID: ModelID
  }
}
