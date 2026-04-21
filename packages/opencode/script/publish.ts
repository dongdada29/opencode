#!/usr/bin/env bun
import { $ } from "bun"
import pkg from "../package.json"
import { Script } from "@opencode-ai/script"
import { isCancel, text } from "@clack/prompts"
import { fileURLToPath } from "url"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

const { binaries } = await import("./build.ts")

// OTP 参数优先级说明：
// 1) --otp=123456：显式提供 OTP，直接使用，不进入交互。
// 2) --no-otp：显式声明跳过 OTP，不进入交互。
// 3) 两者都未提供：进入交互提示，允许人工输入或留空跳过。
// 这样可以同时支持 CI/自动化场景（无交互）和本地手工发布场景（可交互）。
const otpArg = process.argv.find((arg) => arg.startsWith("--otp="))
const skipOtp = process.argv.includes("--no-otp")
let otp = otpArg ? otpArg.split("=")[1] : null

if (!otp && !skipOtp) {
  // 仅在既没有显式 OTP、也没有声明跳过 OTP 时，才请求交互输入。
  // 避免在自动化环境里卡在 stdin。
  const response = await text({
    message: "Enter NPM OTP (required for 2FA, leave empty to skip):",
    placeholder: "123456",
  })

  if (isCancel(response)) {
    process.exit(0)
  }

  if (response) {
    otp = response as string
  }
}

const otpFlags = otp ? ["--otp", otp] : []

{
  const name = `${pkg.name}-${process.platform}-${process.arch}`
  console.log(`smoke test: running dist/${name}/bin/nuwaxcode --version`)
  await $`./dist/${name}/bin/nuwaxcode --version`
}

await $`mkdir -p ./dist/${pkg.name}`
await $`cp -r ./bin ./dist/${pkg.name}/bin`
await $`cp ./script/postinstall.mjs ./dist/${pkg.name}/postinstall.mjs`

await Bun.file(`./dist/${pkg.name}/package.json`).write(
  JSON.stringify(
    {
      name: pkg.name,
      bin: {
        [pkg.name]: `./bin/${pkg.name}`,
      },
      scripts: {
        postinstall: "bun ./postinstall.mjs || node ./postinstall.mjs",
      },
      version: pkg.version,
      optionalDependencies: binaries,
    },
    null,
    2,
  ),
)

const isLatest = process.argv.includes("--latest")
const tags = [Script.channel]
if (isLatest) {
  tags.push("latest")
}

// 所有带二进制文件的子包必须先成功发布到 npm，再发布主包 `nuwaxcode`。
// 若子包发布失败却被忽略，主包仍会带上 optionalDependencies@当前版本，而 registry 上
// 没有对应 tarball 时，用户执行 `npm i -g nuwaxcode` 时 optional 安装会静默失败，
// postinstall 随后报错：Cannot find module 'nuwaxcode-linux-x64/package.json'。
const tasks = Object.entries(binaries).map(async ([name]) => {
  if (process.platform !== "win32") {
    await $`chmod -R 755 .`.cwd(`./dist/${name}`)
  }
  await $`bun pm pack`.cwd(`./dist/${name}`)

  const primaryTag = tags[0]
  await $`npm publish *.tgz --access public --tag ${primaryTag} ${otpFlags}`.cwd(`./dist/${name}`)

  for (const tag of tags.slice(1)) {
    await $`npm dist-tag add ${name}@${pkg.version} ${tag} ${otpFlags}`
  }
})
await Promise.all(tasks)

{
  await $`cd ./dist/${pkg.name} && bun pm pack`
  const primaryTag = tags[0]
  await $`npm publish *.tgz --access public --tag ${primaryTag} ${otpFlags}`.cwd(`./dist/${pkg.name}`)

  for (const tag of tags.slice(1)) {
    await $`npm dist-tag add ${pkg.name}@${pkg.version} ${tag} ${otpFlags}`
  }
}

if (!Script.preview) {
  // Create archives for GitHub release
  for (const key of Object.keys(binaries)) {
    if (key.includes("linux")) {
      await $`tar -czf ../../${key}.tar.gz *`.cwd(`dist/${key}/bin`)
    } else {
      await $`zip -r ../../${key}.zip *`.cwd(`dist/${key}/bin`)
    }
  }

  const image = "ghcr.io/anomalyco/nuwaxcode"
  const platforms = "linux/amd64,linux/arm64"
  const tags = [`${image}:${pkg.version}`, `${image}:latest`]
  const tagFlags = tags.flatMap((t) => ["-t", t])
  await $`docker buildx build --platform ${platforms} ${tagFlags} --push .`
}
