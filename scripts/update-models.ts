const URL = "https://models.dev/api.json";
const DEST_ACTUAL = "packages/opencode/assets/models.json";

async function update() {
  console.log(`Fetching ${URL}...`);
  try {
    // Use curl as a fallback because Bun.fetch might have TLS issues in some environments
    const { execSync } = await import("child_process");
    execSync(`curl -L -s --fail ${URL} -o ${DEST_ACTUAL}`);
    
    // Also update the timestamp file
    const timestampFile = DEST_ACTUAL.replace(".json", ".last_updated");
    await Bun.write(timestampFile, new Date().toISOString());
    
    console.log(`Successfully updated ${DEST_ACTUAL}`);
    console.log(`Timestamp updated in ${timestampFile}`);
  } catch (error) {
    console.error(`Error updating models: ${error}`);
    process.exit(1);
  }
}

update();
