/**
 * nuwaxcode 平台 optional 包名与历史 opencode-* 包名的成对解析。
 * 供 bin/opencode 与 postinstall 共用。
 */
const childProcess = require("child_process")

/** nuwaxcode-* 与 opencode-* 成对尝试（nuwaxcode 优先） */
function packageAliases(name) {
  const legacy = name.replace(/^nuwaxcode-/, "opencode-")
  return legacy === name ? [name] : [name, legacy]
}

function linuxX64HasAvx2(fs) {
  try {
    return /(^|\s)avx2(\s|$)/i.test(fs.readFileSync("/proc/cpuinfo", "utf8"))
  } catch {
    return false
  }
}

function darwinX64HasAvx2() {
  try {
    const result = childProcess.spawnSync("sysctl", ["-n", "hw.optional.avx2_0"], {
      encoding: "utf8",
      timeout: 1500,
    })
    if (result.status !== 0) return false
    return (result.stdout || "").trim() === "1"
  } catch {
    return false
  }
}

/** x64 平台是否应优先 baseline 包（与 bin/opencode 中 supportsAvx2 逻辑一致） */
function needsX64Baseline(platform, arch, fs) {
  if (arch !== "x64") return false
  if (platform === "linux") return !linuxX64HasAvx2(fs)
  if (platform === "darwin") return !darwinX64HasAvx2()
  return false
}

module.exports = { packageAliases, linuxX64HasAvx2, darwinX64HasAvx2, needsX64Baseline }
