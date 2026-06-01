#!/usr/bin/env node

import fs from "fs"
import path from "path"
import os from "os"
import { fileURLToPath } from "url"
import { createRequire } from "module"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// 发布后 postinstall 在包根目录；开发时与本文件同目录
const aliasesPath = fs.existsSync(path.join(__dirname, "pkg-aliases.cjs"))
  ? path.join(__dirname, "pkg-aliases.cjs")
  : path.join(__dirname, "script", "pkg-aliases.cjs")
const { packageAliases, needsX64Baseline } = require(aliasesPath)

function detectPlatformAndArch() {
  let platform
  switch (os.platform()) {
    case "darwin":
      platform = "darwin"
      break
    case "linux":
      platform = "linux"
      break
    case "win32":
      platform = "windows"
      break
    default:
      platform = os.platform()
      break
  }

  let arch
  switch (os.arch()) {
    case "x64":
      arch = "x64"
      break
    case "arm64":
      arch = "arm64"
      break
    case "arm":
      arch = "arm"
      break
    default:
      arch = os.arch()
      break
  }

  return { platform, arch }
}

function findBinary() {
  const { platform, arch } = detectPlatformAndArch()
  const binaryName = platform === "windows" ? "opencode.exe" : "opencode"
  const core = `${platform}-${arch}`
  const packageCandidates = []
  if (needsX64Baseline(platform, arch, fs)) {
    packageCandidates.push(...packageAliases(`nuwaxcode-${core}-baseline`))
  }
  packageCandidates.push(...packageAliases(`nuwaxcode-${core}`))

  let lastError = null
  for (const packageName of packageCandidates) {
    try {
      const packageJsonPath = require.resolve(`${packageName}/package.json`)
      const packageDir = path.dirname(packageJsonPath)
      const binaryPath = path.join(packageDir, "bin", binaryName)

      if (!fs.existsSync(binaryPath)) {
        throw new Error(`Binary not found at ${binaryPath}`)
      }

      return binaryPath
    } catch (error) {
      lastError = error
    }
  }

  throw new Error(
    `Could not find platform package for ${platform}-${arch}. Tried: ${packageCandidates.join(", ")}. Last error: ${lastError?.message}`,
    { cause: lastError },
  )
}

async function main() {
  try {
    if (os.platform() === "win32") {
      console.log("Windows detected: binary setup not needed (using packaged .exe)")
      return
    }

    // 仅校验 optional 平台包已安装；CLI 入口直接解析 node_modules，不再使用 bin/.opencode
    findBinary()
  } catch (error) {
    console.error("Failed to verify nuwaxcode platform binary:", error.message)
    process.exit(1)
  }
}

try {
  void main()
} catch (error) {
  console.error("Postinstall script error:", error.message)
  process.exit(0)
}
