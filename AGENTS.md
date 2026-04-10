- To test opencode in `packages/opencode`, run `bun dev`.
- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- The default branch in this repo is `feat/nuwaxcode`.
- **Release Workflow**:
  1. **Changelog**: Update `CHANGELOG-nuwaxcode.md` with new version details.
  2. **Run Script**:
     - Run: `./release.sh <new_version>` (e.g., `./release.sh 1.1.52`)
     - The script will automatically:
       - Bump version in `packages/opencode/package.json`.
       - Sync all `optionalDependencies`.
       - Run `publish` with `--latest` (default `NPM_DIST_TAG=latest`).
       - (Optional) Pass OTP as second argument: `./release.sh 1.1.52 123456`
     - **Pre-release / do not move `latest`**: set `NPM_DIST_TAG=beta` (or another tag). Example: `NPM_DIST_TAG=beta ./release.sh 1.1.72` — publishes under the `beta` dist-tag only; `npm install nuwaxcode` still resolves `latest` to the previous release.
