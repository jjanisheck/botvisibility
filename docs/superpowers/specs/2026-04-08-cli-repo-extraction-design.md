# BotVisibility CLI — Repo Extraction & OSS Cleanup

**Date:** 2026-04-08
**Status:** Approved (design)
**Owner:** Joey Janisheck

## Goal

Convert this repository from a mixed Next.js website + CLI codebase into a clean, public, open-source home for the `botvisibility` CLI tool. Preserve full git history, promote the CLI to the repo root, add a real test suite, set up CI, and produce contributor-ready documentation.

## Background & motivation

This repo originally hosted both the BotVisibility website (Next.js, deployed to Netlify) and the `botvisibility` CLI (TypeScript, published to npm from `cli/`). The website has been migrated to a separate repository, and the npm package has already been published from this repo at version `1.3.0`.

The user wants this repository to become the public open-source home of the CLI: clean structure, focused docs, and full history preserved. The repo is currently private and will be flipped to public after cleanup.

## Decisions (locked from brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| History strategy | **Flatten & keep full history** | Preserve blame/credit; private repo means no force-push pain. |
| Package name & version | **`botvisibility` @ `1.3.1`** | Smallest disruption for existing npm users. |
| Documentation depth | **README + `docs/` folder** | Navigable for serious users without full template overhead. |
| Tests | **Real vitest suite** | Proper foundation for a public OSS project. |
| Publishing | **Manual `npm publish`** | User stays in control of release timing. |
| Tooling cruft | **Delete website-only stuff; keep `.claude/` and `CLAUDE.md`** | On-brand for an agent-readiness tool; benefits contributors. |

## Target repo structure

```
botvisibility/
├── .github/
│   ├── workflows/ci.yml              # build + test on PRs/pushes
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── pull_request_template.md
├── .claude/                          # kept (Claude Code config)
├── src/                              # CLI sources (moved from cli/src/)
│   ├── index.ts
│   ├── scanner.ts
│   ├── repo-scanner.ts
│   ├── scoring.ts
│   └── types.ts
├── tests/                            # new vitest suite
│   ├── scoring.test.ts
│   ├── scanner.test.ts
│   ├── repo-scanner.test.ts
│   └── fixtures/
├── docs/
│   ├── checks.md                     # full reference for all 30+ checks
│   ├── scoring.md                    # scoring algorithm details
│   ├── ci-integration.md             # GitHub Actions, GitLab, CircleCI recipes
│   └── agent-tax.md                  # token-cost analysis
├── .gitignore                        # dist/, node_modules/, coverage/
├── CLAUDE.md                         # kept
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE                           # kept (MIT)
├── README.md                         # promoted from cli/README.md, polished
├── package.json                      # promoted from cli/, version 1.3.1
├── package-lock.json                 # regenerated
├── tsconfig.json                     # promoted from cli/
└── vitest.config.ts
```

### Files to delete

**Website (Next.js):**
`src/app/`, `src/components/`, `src/data/`, `src/lib/`, `public/`, `netlify.toml`, `next.config.ts`, `next-env.d.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `tsconfig.tsbuildinfo`, `.next/`, root `package.json`, root `package-lock.json`

**Tooling cruft:**
`.claude-flow/`, `.superpowers/`, `.swarm/`, `.mcp.json`, `docs/plans/`, `docs/superpowers/` (except this spec, which moves with the cleanup), `scripts/scan-showcase.ts`

**After contents promoted:** `cli/` directory itself.

## Implementation phases

### Phase 1: Safety & flatten (one commit)

Branch: work directly on `main` after creating `pre-flatten-backup` branch.

**Commit:** `chore: extract CLI as standalone repo (remove website)`

Steps:
1. `git branch pre-flatten-backup` — safety net
2. Delete website files listed above
3. Delete tooling cruft listed above
4. `git mv cli/src/* src/` — preserves blame
5. `git mv cli/package.json package.json` (after removing root `package.json`)
6. `git mv cli/tsconfig.json tsconfig.json` (after removing root `tsconfig.json`)
7. `git mv cli/README.md README.md` (after removing root `README.md`)
8. `rmdir cli/` (now empty except maybe `package-lock.json`)
9. Update `package.json`: bump version to `1.3.1`, add `test`/`test:watch`/`test:coverage` scripts, add `vitest` and `@vitest/coverage-v8` to devDependencies
10. Update `.gitignore`: remove `.next/`, ensure `dist/`, `node_modules/`, `coverage/` are present
11. `npm install` to regenerate `package-lock.json`

**Verification:**
- `npm run build` produces `dist/index.js`
- `node dist/index.js botvisibility.com` exits 0 with valid output
- `node dist/index.js botvisibility.com --json | jq .currentLevel` returns a number
- No website file paths remain

### Phase 2: Test suite

**Commit:** `test: add vitest suite covering scoring, scanner, and repo-scanner`

Files:
- `vitest.config.ts` — Node environment, includes `tests/**/*.test.ts`
- `tests/scoring.test.ts` — pure-function tests for scoring algorithm
- `tests/scanner.test.ts` — mocked-fetch tests for L1/L2/L3 web checks
- `tests/repo-scanner.test.ts` — fixture-based tests for L3 code + L4 checks
- `tests/fixtures/` — small mock repos and HTTP response fixtures

**`tests/scoring.test.ts` cases:**
- Empty results → Level 0
- All L1 pass, no L2 results → Level 1
- L1 50% pass + L2 50% pass → Level 2
- L1 35% pass + L2 75% pass → Level 2 (alternative threshold path)
- L2 achieved + L3 50% → Level 3
- L4 checks present without `--repo` → returns L3 max
- All checks fail → Level 0
- All checks pass → Level 4

**`tests/scanner.test.ts` cases:** one representative test per check family using mocked `fetch`:
- Discovery files (llms.txt, agent-card, ai.json, skill.md, skills/index.json) — 200 vs 404
- robots.txt with/without AI directives
- OpenAPI spec discovery (linked vs unlinked)
- CORS headers present/absent
- Structured error response (JSON vs HTML)
- Rate limit / caching headers
- MCP server discovery

**`tests/repo-scanner.test.ts` cases:** fixture repos containing:
- OpenAPI spec → L3 spec checks pass
- Intent-based endpoint patterns → L4 checks pass
- Empty repo → all L4 checks fail gracefully without throwing

**Verification:** `npm test` passes locally; coverage report runs without error.

### Phase 3: CI

**Commit:** `ci: add GitHub Actions workflow for build and test`

Files:
- `.github/workflows/ci.yml`
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/pull_request_template.md`

**Workflow:**
- Triggers: `push` to `main`, all `pull_request`
- Job: `build-and-test` on `ubuntu-latest`
- Matrix: `node-version: [18, 20, 22]`
- Steps: checkout → setup-node (with npm cache) → `npm ci` → `npm run build` → `npm test`

**Issue/PR templates:** minimal (a few sections each, no excessive scaffolding).

**Verification:** Push to a throwaway branch, confirm workflow goes green on GitHub Actions before merging.

### Phase 4: Documentation

**Commit:** `docs: add contributor docs, deep references, and polished README`

Files:
- `README.md` (replaces existing)
- `docs/checks.md`
- `docs/scoring.md`
- `docs/ci-integration.md`
- `docs/agent-tax.md`
- `CONTRIBUTING.md`
- `CHANGELOG.md`

**`README.md`** — promoted from `cli/README.md` with these changes:
- Badges row at top: npm version, npm downloads, license, CI status
- "Why this exists" 1-2 sentence paragraph above the install block
- Trim deep check tables → summary + link to `docs/checks.md`
- Add "Contributing" section linking to `CONTRIBUTING.md`
- Keep: install, quick usage, example output, links to website resources

**`docs/checks.md`** — full reference for all 30+ checks. Each check: name, level, what it looks for, why it matters (token cost), how to fix.

**`docs/scoring.md`** — weighted cross-level algorithm explained with worked example.

**`docs/ci-integration.md`** — copy/paste recipes for GitHub Actions, GitLab CI, CircleCI. Score-gating, JSON parsing with jq, regression failure.

**`docs/agent-tax.md`** — port the token-cost analysis: $22,800/month math, before/after table, methodology. Self-contained.

**`CONTRIBUTING.md`** — short and welcoming:
- Project goals (in scope, out of scope)
- Dev setup: clone, `npm install`, `npm run build`, `npm test`
- How to add a new check (point at `src/scanner.ts` patterns)
- PR conventions (small, focused, tests required for new checks)

**`CHANGELOG.md`** — Keep-a-Changelog format. Entry for `1.3.1`: "Repository restructured as standalone CLI; no functional changes."

### Phase 5: Make repo public

Out of scope for code changes, but the spec captures the operational steps:
1. Push all commits to `origin/main`
2. Confirm CI is green
3. GitHub repo settings → Visibility → Public
4. Add repository topics: `cli`, `ai-agents`, `llm`, `openapi`, `llms-txt`, `agent-readiness`, `audit`, `mcp`
5. Set repository description to match README tagline
6. (Optional) pin to GitHub profile

### Phase 6: Publish 1.3.1 (separate, manual)

Out of scope for this spec — user will run `npm publish` locally when ready.

## Verification checklist

- [ ] `pre-flatten-backup` branch exists
- [ ] `npm install` succeeds at root after flatten
- [ ] `npm run build` produces `dist/index.js`
- [ ] `node dist/index.js botvisibility.com` runs end-to-end and exits 0
- [ ] No `next.config*`, `netlify.toml`, or `src/app/` paths remain
- [ ] `npm test` passes with non-zero number of tests
- [ ] `npm pack --dry-run` includes only `dist/` and `README.md`
- [ ] CI workflow runs green on a test branch
- [ ] All target files from "Target repo structure" exist
- [ ] All "Files to delete" no longer exist

## Out of scope

- Adding new CLI features or checks
- Refactoring existing scanner/scoring code
- Migrating any website code back into this repo
- Setting up release automation (manual `npm publish` is the chosen path)
- Code coverage thresholds (deferred until suite stabilizes)
- Code of conduct as a separate file (single-line reference in CONTRIBUTING is enough)
- Making the repo public (operational, performed by user via GitHub UI)
- Publishing 1.3.1 to npm (manual, performed by user when ready)

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Flatten breaks the CLI build | `pre-flatten-backup` branch + verification step before next commit |
| Tests are flaky against live botvisibility.com | All scanner tests use mocked `fetch`; only manual smoke test hits a live URL |
| `npm publish` from new structure produces wrong tarball | `npm pack --dry-run` verification before publishing |
| Loss of git blame during file moves | Use `git mv` (not delete + add) for `cli/src/*` → `src/` |
| Website history pollutes log forever | Accepted tradeoff (decision A); old commits remain visible but harmless |
