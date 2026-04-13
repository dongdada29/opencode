import { ModelsDev } from "./packages/opencode/src/provider/models.ts"

async function test() {
  console.log("Testing ModelsDev.get()...")
  const providers = await ModelsDev.get()
  console.log("Providers found:", Object.keys(providers))
  if (providers["test-provider"]) {
    console.log("SUCCESS: Found test-provider from bundled asset.")
  } else {
    console.error("FAILURE: test-provider not found.")
    process.exit(1)
  }
}

test().catch(err => {
  console.error(err)
  process.exit(1)
})
