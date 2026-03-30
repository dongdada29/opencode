- To test opencode in `packages/opencode`, run `bun dev`.
- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- The default branch in this repo is `feat/nuwaxcode`.
- **Release Workflow**:
  1. **Changelog**: Update `CHANGELOG-nuwaxcode.md` with new version details.
  2. **Bump Version**: Update `packages/opencode/package.json` version field.
  3. **Commit & Push**: Push changes to `feat/nuwaxcode` branch.
  4. **Tag & Trigger CI**: `git tag v<version> && git push origin v<version>`
     - CI (`.github/workflows/build-release.yml`) builds all 11 platform targets on a single ubuntu-24.04 runner via Bun cross-compilation.
     - Produces 13 archives: darwin (arm64, x64, x64-baseline), linux (arm64, x64, x64-baseline, arm64-musl, x64-musl, x64-baseline-musl), windows (x64, x64-baseline, each with .tar.gz + .zip).
     - Auto-creates GitHub Release and uploads all assets.
  5. **Verify**: Check release at `https://github.com/nuwax-ai/nuwaxcode/releases/tag/v<version>`.
  6. **Electron Integration**: Update `NUWAXCODE_VERSION` in Electron client's `scripts/prepare/prepare-nuwaxcode.js` and `installVersion` in `src/main/services/system/dependencies.ts`, then run `node scripts/prepare/prepare-nuwaxcode.js`.
  7. **npm publish** (optional): Run `./release.sh <new_version>` for npm registry publish.
