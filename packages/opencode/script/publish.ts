#!/usr/bin/env bun
import { $ } from "bun"
import pkg from "../package.json"
import { Script } from "@opencode-ai/script"
import { isCancel, text } from "@clack/prompts"
import { fileURLToPath } from "url"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

const { binaries } = await import("./build.ts")

const otpArg = process.argv.find(arg => arg.startsWith("--otp="))
let otp = otpArg ? otpArg.split("=")[1] : null

const noOtp = process.argv.includes("--no-otp")
if (!otp && !noOtp) {
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

const tasks = Object.entries(binaries).map(async ([name]) => {
  if (process.platform !== "win32") {
    await $`chmod -R 755 .`.cwd(`./dist/${name}`)
  }
  await $`bun pm pack`.cwd(`./dist/${name}`)

  const primaryTag = tags[0]
  try {
    await $`npm publish *.tgz --access public --tag ${primaryTag} ${otpFlags}`.cwd(`./dist/${name}`)
  } catch (e) {
    console.log(`Publish failed for ${name} (might check if version exists), continuing to tags...`)
  }

  for (const tag of tags.slice(1)) {
    await $`npm dist-tag add ${name}@${pkg.version} ${tag} ${otpFlags}`
  }
})
await Promise.all(tasks)

{
  await $`cd ./dist/${pkg.name} && bun pm pack`
  const primaryTag = tags[0]
  try {
    await $`npm publish *.tgz --access public --tag ${primaryTag} ${otpFlags}`.cwd(`./dist/${pkg.name}`)
  } catch (e) {
    console.log(`Publish failed for ${pkg.name} (might check if version exists), continuing to tags...`)
  }

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
