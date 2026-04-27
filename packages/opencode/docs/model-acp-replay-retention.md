# Models and Local ACP — Implementation Record

## Purpose

This document records all custom model/ACP enhancements on `feat/nuwaxcode-nuwaclaw-builtin` that differ from `origin/dev`. Use it to replay work after future `dev` merges, or to audit what's custom vs upstream.

## Branch Baseline

- Base branch: `dev`
- Feature branch: `feat/nuwaxcode-nuwaclaw-builtin`
- Merge strategy: manual replay by batch after each `dev` merge, not bulk restore

---

## Batch 1 — Model Source, ACP Session, CLI (COMPLETED 2026-04-27)

### 1.1 Model Source Loading

**New file: `src/provider/models-source.ts`**

Unified model source loader. Priority: cache file → macro → bundled asset → network.

Key design:
- `FetchModelsOptions` interface with `url?: string` to respect `Flag.OPENCODE_MODELS_URL`
- Falls back to `"https://models.dev/api.json"` when url not provided
- Logs source and URL at each hit point for observability
- Uses `Installation.USER_AGENT` for network requests

**Modified: `src/provider/models.ts`**

Changes from `origin/dev` baseline:
- `fetchApi()` deleted — replaced by `fetchModelsFromSource`
- `import { Installation }` removed — no longer referenced
- `lastResolvedSource` variable tracks where data was resolved from
- `bundledPaths` restored for compiled binary support:
  ```ts
  path.join(path.dirname(process.execPath), "assets", "models.json")  // compiled binary
  path.join(__dirname, "../../assets/models.json")                    // dev mode
  ```
- `Data()` uses `fetchModelsFromSource` with `bundledPaths` + `url`, throws on all-sources-failed
- `refresh()` uses `fetchModelsFromSource` with `skipCache: true`, updates `lastResolvedSource`
- `sourceInfo()` export exposes `{ source, cachePath, modelsURL, fetchDisabled }` for observability
- Writes cache file only when source is `"network_fetch"` (bundled/macro data is read-only)

Replay checklist for this section:
- [ ] `models-source.ts` exists with `url` in FetchModelsOptions
- [ ] `bundledPaths` has both paths (execPath + __dirname)
- [ ] `Data()` and `refresh()` both use `fetchModelsFromSource`
- [ ] No `fetchApi` function or `Installation` import
- [ ] `sourceInfo()` is exported

### 1.2 ACP Session Model Caching & Logging

**Modified: `src/acp/agent.ts`**

- `MODEL_CACHE_TTL = 30_000` (30s) per-directory model resolution cache
- `defaultModel()` has per-branch structured logging with `totalMs` timing:
  - `config.defaultModel` / `memory_cache` / `user_config_validated` /
    `user_config_no_providers` / `opencode_big_pickle` / `opencode_best` /
    `provider_sort_best` / `user_config_fallback` / `hard_fallback`
- `loadSessionMode` logs `loadSessionMode.model_source` with full source metadata
- Import: `import { ModelsDev, Provider } from "../provider"`

Replay checklist:
- [ ] `modelCache` Map exists with 30s TTL
- [ ] All `defaultModel` return paths log source + duration
- [ ] `loadSessionMode` includes `ModelsDev.sourceInfo()` log

### 1.3 TUI Model Interaction

**No changes needed — dev baseline is sufficient.**

`src/cli/cmd/tui/context/local.tsx` already has:
- null-safe agent handling (`agent.current()` can return undefined)
- `parseModel()` local function (replaces removed `Provider.parseModel` import)
- `variant.selected()` / `variant.current()` separation
- `Filesystem.readJson` / `writeJson` for persistence

### 1.4 CLI Model Source Display

**Modified: `src/cli/cmd/models.ts`**
- `--verbose` flag outputs `ModelsDev.sourceInfo()` fields (source, cache path, URL, fetch status)

**Modified: `src/cli/cmd/run.ts`**
- Non-JSON mode shows `~ models source: <source> (<url>)` on startup
- Import: `import { ModelsDev, Provider } from "../../provider"`

Replay checklist:
- [ ] `models --verbose` prints source info
- [ ] `run` shows source hint in non-JSON mode

### 1.5 Model Adaptation — Compatible Providers

**Modified: `src/provider/provider.ts`**

Three additions to the `custom()` function:

**a) `anthropic` enhanced with token limit overrides:**
- Changed from `Effect.succeed` to `Effect.fnUntraced` to access env
- Injects `max_tokens` from `OPENCODE_MAX_TOKENS` env / `provider.options.max_tokens`
- Injects `max_context_tokens` from `OPENCODE_MAX_CONTEXT_TOKENS` env / `provider.options.max_context_tokens`

**b) `anthropic-compatible` loader (new):**
- Env: `OPENCODE_ANTHROPIC_API_BASE` / `ANTHROPIC_BASE_URL`, `OPENCODE_ANTHROPIC_API_KEY` / `ANTHROPIC_API_KEY`
- `/v1` suffix auto-normalization
- `autoload` gate: `!!(baseURL || apiKey)`
- `getModel` fallback chain: `sdk.languageModel(modelID)` → `sdk(modelID)` → recreate `@ai-sdk/anthropic`
- Includes `max_tokens`/`max_context_tokens` support

**c) `openai-compatible` loader (new):**
- Env priority: `OPENCODE_OPENAI_API_BASE` → `OPENCODE_API_BASE` → `OPENAI_BASE_URL`
- Env priority: `OPENCODE_OPENAI_API_KEY` → `OPENCODE_API_KEY` → `OPENAI_API_KEY`
- `autoload` gate: `!!(baseURL && apiKey)` (both required)
- `getModel` fallback chain: `sdk.chatModel(modelID)` → `sdk(modelID)` → `sdk.languageModel(modelID)` → recreate `@ai-sdk/openai-compatible`
- Includes `max_tokens`/`max_context_tokens` support

Replay checklist:
- [ ] `anthropic` uses `Effect.fnUntraced`, has max_tokens/max_context_tokens injection
- [ ] `anthropic-compatible` entry in custom() return object
- [ ] `openai-compatible` entry in custom() return object
- [ ] Both have `/v1` normalization (anthropic-compatible) or proper env priority (openai-compatible)

---

## Batch 2 — Routes, Skills, Logging (NOT NEEDED)

All files match `origin/dev` baseline. No custom changes required:
- `src/server/routes/project.ts`
- `src/server/routes/pty.ts`
- `src/skill/skill.ts`
- `src/util/log.ts`

---

## Batch 3 — Tests, Prompts (NOT NEEDED)

All files match `origin/dev` baseline. No custom changes required:
- `test/acp/system-prompt.test.ts`
- `test/mcp/connection-reuse.test.ts`
- `test/provider/env_config.test.ts`
- `src/session/prompt/anthropic-20250930.txt`
- `src/session/prompt/codex_header.txt`
- `src/session/prompt/anthropic_spoof.txt`

---

## Post-Replay Validation

```bash
bun run --cwd packages/opencode typecheck
```

Acceptance criteria:
- [ ] typecheck passes with zero errors
- [ ] ACP session init returns model metadata correctly
- [ ] local model switching works for provider/model pairs
- [ ] invalid model rejected with user-visible warning
- [ ] fallback model selected when configured model unavailable
- [ ] no unresolved merge markers in repo

---

## Execution Notes

- Keep CI/workflow files on `ours`.
- Keep `packages/opencode/package.json` workspace identity as `nuwaxcode`.
- Never replay full historical deltas. Replay only behavior-relevant slices.
- After each `dev` merge: check this doc, replay unmerged batches, update status.

---

## Change Log

- 2026-04-27: Initial retention document created after merge stabilization.
- 2026-04-27: Batch 1.1 — `models-source.ts` created + `models.ts` refactored (unified source loading, bundledPaths, sourceInfo, url configurability, refresh unification, fail-fast).
- 2026-04-27: Batch 1.2 — ACP `defaultModel` caching + branch logging + `loadSessionMode.model_source`.
- 2026-04-27: Batch 1.4 — CLI verbose output (`models --verbose`, `run` source hint).
- 2026-04-27: Batch 1.5 — Provider model adaptation: `anthropic` token overrides, `anthropic-compatible`, `openai-compatible` restored in Effect architecture.
## Batch 4 — GitHub CI Build & Release (COMPLETED)

### 4.1 Build-Release Workflow

**New file: `.github/workflows/build-release.yml`** (130 lines)

Dedicated build-release workflow for the fork repo (`nuwax-ai/nuwaxcode`):
- Tag-triggered cross-compile for 11 platform targets
- Cross-compile darwin-x64 on ARM runner with smoke test + archive handling
- Single runner builds all targets (not matrix)
- Links `@opentui/core` and `@opentui/solid` symlinks for build script compatibility
- Installs opencode workspace deps before build
- Uses standard GitHub runners (replaces blacksmith runners)
- Windows bash syntax fixed

### 4.2 Publish Workflow Simplification

**Modified: `.github/workflows/publish.yml`**

- Drastically simplified (478 lines removed, 559→81)
- Repository check fixed for `nuwax-ai/nuwaxcode`
- Release version derived from `package.json`, upload loop fixed
- Allows release to proceed when some build jobs are cancelled
- Allows publish on `feat/nuwaxcode-nuwaclaw-builtin` branch
- Uses `macos-13` instead of deprecated `macos-13-large`

### 4.3 Pre-Push Hook

**Modified: `.husky/pre-push`**

- Auto-updates `models.json` before push
- Aborts push if models content changed (prevents stale model data)
- Typecheck is non-blocking in pre-push

### 4.4 Offline Models Loading

**New: `scripts/update-models.ts`**
- Update script to fetch latest models from source

**New: `packages/opencode/assets/models.json`**
- Bundled models snapshot for offline/compiled binary use

**Modified: `packages/opencode/package.json`**
- Added models update script

Replay checklist:
- [ ] `.github/workflows/build-release.yml` exists
- [ ] `.github/workflows/publish.yml` uses simplified structure
- [ ] `.husky/pre-push` has models auto-update logic
- [ ] `scripts/update-models.ts` exists
- [ ] `packages/opencode/assets/models.json` exists

---

## Change Log

- 2026-04-27: Initial retention document created after merge stabilization.
- 2026-04-27: Batch 1.1 — `models-source.ts` created + `models.ts` refactored (unified source loading, bundledPaths, sourceInfo, url configurability, refresh unification, fail-fast).
- 2026-04-27: Batch 1.2 — ACP `defaultModel` caching + branch logging + `loadSessionMode.model_source`.
- 2026-04-27: Batch 1.4 — CLI verbose output (`models --verbose`, `run` source hint).
- 2026-04-27: Batch 1.5 — Provider model adaptation: `anthropic` token overrides, `anthropic-compatible`, `openai-compatible` restored in Effect architecture.
- 2026-04-27: Batch 4 — CI build-release workflow, publish simplification, pre-push hook, offline models loading.
- 2026-04-27: Batch 1 complete. Typecheck passes. Batches 2 & 3 confirmed no-op.
