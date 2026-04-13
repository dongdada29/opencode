import { write } from "bun";

const URL = "https://models.dev/api.json";
const DEST_ACTUAL = "packages/opencode/assets/models.json";

async function update() {
  console.log(`Fetching ${URL}...`);
  try {
    const response = await fetch(URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }
    const text = await response.text();
    await Bun.write(DEST_ACTUAL, text);
    console.log(`Successfully updated ${DEST_ACTUAL}`);
  } catch (error) {
    console.error(`Error updating models: ${error}`);
    process.exit(1);
  }
}

update();
