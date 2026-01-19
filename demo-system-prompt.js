#!/usr/bin/env node

// 这是一个演示如何使用 ACP _meta.systemPrompt 功能的示例脚本

console.log("=== ACP System Prompt 功能演示 ===\n")

// 模拟 ACP session/new 请求
const demoRequests = [
  {
    name: "自定义系统提示",
    payload: {
      method: "session/new",
      params: {
        cwd: "/Users/apple/workspace/opencode",
        mcpServers: [],
        _meta: {
          systemPrompt: "你是 Nuwaxcode，一个强大的 AI 编程助手。请在回答前仔细思考..."
        }
      }
    }
  },
  {
    name: "追加模式系统提示",
    payload: {
      method: "session/new", 
      params: {
        cwd: "/Users/apple/workspace/opencode",
        mcpServers: [],
        _meta: {
          systemPrompt: {
            append: "请始终用中文回答所有问题。"
          }
        }
      }
    }
  },
  {
    name: "无自定义系统提示",
    payload: {
      method: "session/new",
      params: {
        cwd: "/Users/apple/workspace/opencode", 
        mcpServers: []
        // 没有 _meta
      }
    }
  }
]

demoRequests.forEach((demo, index) => {
  console.log(`${index + 1}. ${demo.name}:`)
  console.log(JSON.stringify(demo.payload, null, 2))
  console.log("─".repeat(50))
})

console.log("\n💡 说明:")
console.log("1. Nuwaxcode 会从 _meta.systemPrompt 中提取自定义系统提示")
console.log("2. 支持字符串格式的完整替换模式")
console.log("3. 支持 { append: string } 格式的追加模式")
console.log("4. 如果没有提供 _meta.systemPrompt，将使用默认系统提示")
console.log("5. 所有系统提示都会被注入到底层 LLM 的上下文中")

console.log("\n📝 配置文件位置:")
console.log("- 项目配置: /project/root/opencode.json")
console.log("- 全局配置: ~/.config/opencode/opencode.json")

console.log("\n🔍 日志查看:")
console.log("tail -f ~/.local/share/opencode/log/nuwaxcode.log")