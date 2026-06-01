- To test opencode in `packages/opencode`, run `bun dev`.
- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- The default branch in this repo is `feat/nuwaxcode`.
- **Release Workflow**:
  1. **Changelog**: Update `CHANGELOG-nuwaxcode.md` with new version details.
  2. **Bump Version**: Update `packages/opencode/package.json` version field.
  2.1 **Version Consistency Rule (Mandatory)**:
     - `packages/opencode/package.json` is the only version source of truth.
     - All `optionalDependencies` entries matching `nuwaxcode-*` must equal the same version.
     - Rebuild binaries before publish, then run:
       - `bun run script/check-version-consistency.ts --phase pre --version <version>`
     - After publish, run:
       - `bun run script/check-version-consistency.ts --phase post --version <version>`
     - Any mismatch must fail the release immediately.
  3. **Commit & Push**: Push changes to `feat/nuwaxcode` branch.
  4. **Tag & Trigger CI**（仅此方式触发，无 workflow_dispatch）: `git tag v<version> && git push origin v<version>`
     - 发版前在仓库内完成：`CHANGELOG-nuwaxcode.md`、`packages/opencode/package.json` 版本号。
     - CI [`.github/workflows/build-release.yml`](.github/workflows/build-release.yml)：拉取 models.dev → 全平台构建 → GitHub Release → npm。
     - npm 发布与校验与 [`scripts/release-publish.sh`](scripts/release-publish.sh) 一致（`check-version-consistency` pre/post、清理 `dist/nuwaxcode`）。需配置 secret `NPM_TOKEN`。
  5. **Verify**: `https://github.com/nuwax-ai/nuwaxcode/releases/tag/v<version>` 与 `npm view nuwaxcode@<version> version`。
  6. **Electron Integration**: Update `NUWAXCODE_VERSION` in Electron client's `scripts/prepare/prepare-nuwaxcode.js` and `installVersion` in `src/main/services/system/dependencies.ts`, then run `node scripts/prepare/prepare-nuwaxcode.js`.
  7. **本地全量发版（含构建）**: `./release.sh <version> [otp|--no-otp]`；仅 npm 发布段：`./scripts/release-publish.sh <version>`（需已存在 `packages/opencode/dist`）。
