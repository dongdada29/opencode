import { RequestError, type McpServer } from "@agentclientprotocol/sdk"
import type { ACPSessionState } from "./types"
import { Log } from "@/util/log"
import type { OpencodeClient } from "@opencode-ai/sdk"

const log = Log.create({ service: "acp-session-manager" })

export class ACPSessionManager {
  private sessions = new Map<string, ACPSessionState>()
  private sdk: OpencodeClient

  constructor(sdk: OpencodeClient) {
    this.sdk = sdk
  }

  async create(cwd: string, mcpServers: McpServer[], model?: ACPSessionState["model"]): Promise<ACPSessionState> {
    const session = await this.sdk.session
      .create({
        body: {
          title: `ACP Session ${crypto.randomUUID()}`,
        },
        query: {
          directory: cwd,
        },
        throwOnError: true,
      })
      .then((x) => x.data)

    const sessionId = session.id
    const resolvedModel = model

    // 从环境变量读取 MCP 启用/禁用配置
    const mcpEnabledEnv = process.env["OPENCODE_MCP_ENABLED"]
    const mcpDisabledEnv = process.env["OPENCODE_MCP_DISABLED"]
    const mcpEnabled = mcpEnabledEnv ? mcpEnabledEnv.split(",").map((s) => s.trim()).filter(Boolean) : undefined
    const mcpDisabled = mcpDisabledEnv ? mcpDisabledEnv.split(",").map((s) => s.trim()).filter(Boolean) : undefined

    const state: ACPSessionState = {
      id: sessionId,
      cwd,
      mcpServers,
      createdAt: new Date(),
      model: resolvedModel,
      mcpEnabled,
      mcpDisabled,
    }
    log.info("creating_session", { state, mcpEnabled, mcpDisabled })

    this.sessions.set(sessionId, state)
    return state
  }

  get(sessionId: string): ACPSessionState {
    const session = this.sessions.get(sessionId)
    if (!session) {
      log.error("session not found", { sessionId })
      throw RequestError.invalidParams(JSON.stringify({ error: `Session not found: ${sessionId}` }))
    }
    return session
  }

  getModel(sessionId: string) {
    const session = this.get(sessionId)
    return session.model
  }

  setModel(sessionId: string, model: ACPSessionState["model"]) {
    const session = this.get(sessionId)
    session.model = model
    this.sessions.set(sessionId, session)
    return session
  }

  setMode(sessionId: string, modeId: string) {
    const session = this.get(sessionId)
    session.modeId = modeId
    this.sessions.set(sessionId, session)
    return session
  }
}
