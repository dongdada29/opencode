- To test opencode in `packages/opencode`, run `bun dev`.
- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- The default branch in this repo is `feat/nuwaxcode`.
- **Release Workflow**:
  1. **Update Version**:
     - `CHANGELOG-nuwaxcode.md`: Add new version entry.
     - `packages/opencode/package.json`: Bump `version` AND sync all `optionalDependencies` versions.
  2. **Publish**:
     - Run: `cd packages/opencode && bun run publish --latest`
     - **Flags**:
       - `--latest`: REQUIRED to update the `latest` tag on NPM (otherwise it only publishes to the branch tag).
       - `--no-otp`: Skip the interactive OTP prompt (use if 2FA is handled externally or not required).
