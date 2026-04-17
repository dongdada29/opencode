#!/usr/bin/env bun
/**
 * 校验 npm 上已发布的 `nuwaxcode@<version>`：其 optionalDependencies 里的每个平台子包
 * 在 registry 上是否都能解析到同版本。
 *
 * 用于：
 * - 发版流程末尾确认本次发布完整（避免再次出现主包有、子包 404）；
 * - 排查用户 `npm i -g nuwaxcode` 报找不到 `nuwaxcode-linux-x64/package.json`。
 *
 * 用法（在 packages/opencode 目录下，或通过 bun 指定路径）：
 *   bun run script/verify-registry-complete.ts
 *   bun run script/verify-registry-complete.ts 1.1.75
 */
import { $ } from "bun"
import pkg from "../package.json"

const version = process.argv[2] ?? pkg.version
const mainSpec = `nuwaxcode@${version}`

const metaResult =
  await $`npm view ${mainSpec} optionalDependencies --json`.quiet().nothrow()
if (metaResult.exitCode !== 0) {
  console.error(
    `无法从 registry 读取 nuwaxcode@${version}（exit ${metaResult.exitCode}）。` +
      `若尚未发布该版本的主包，请先发布或传入已存在的版本号。`,
  )
  if (metaResult.stderr.toString().trim()) {
    console.error(metaResult.stderr.toString())
  }
  process.exit(1)
}

const raw = metaResult.stdout.toString().trim()
let optional: Record<string, string>
try {
  optional = JSON.parse(raw) as Record<string, string>
} catch {
  console.error("npm 返回的 optionalDependencies 不是合法 JSON:", raw.slice(0, 200))
  process.exit(1)
}

if (!optional || typeof optional !== "object" || Object.keys(optional).length === 0) {
  console.error(`nuwaxcode@${version} 没有 optionalDependencies 或字段为空`)
  process.exit(1)
}

const missing: string[] = []

for (const [name, ver] of Object.entries(optional)) {
  const v = String(ver)
  const subSpec = `${name}@${v}`
  const check = await $`npm view ${subSpec} version`.quiet().nothrow()
  if (check.exitCode !== 0) {
    missing.push(`${name}@${v}`)
    continue
  }
  const published = check.stdout.toString().trim()
  if (!published) {
    missing.push(`${name}@${v}`)
  }
}

if (missing.length > 0) {
  console.error(`nuwaxcode@${version} 以下 optional 子包在 registry 上缺失或不可安装：`)
  for (const m of missing) {
    console.error(`  - ${m}`)
  }
  process.exit(1)
}

console.log(
  `校验通过：nuwaxcode@${version} 的 ${Object.keys(optional).length} 个 optional 子包均在 registry 上存在。`,
)
