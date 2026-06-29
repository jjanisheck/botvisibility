# Changelog

All notable changes to the BotVisibility CLI are documented here. This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2026-06-28

Level 5 (Agent-Native) is now verified **externally**, like every other level. All **58 checks across all 5 levels** run from a live URL scan — reading a site's published declarations (`/.well-known/agent-card.json` + OpenAPI) and probing the declared endpoints. No `--repo`, source access, or CLI-gating is required for any check, including Level 5. CLI scan output now matches the `botvisibility.com` web scan shape so results are interchangeable.

### Added

- **External Level 5 (`src/deep-checks.ts`)** — the 7 Agent-Native checks (`5.1`–`5.7`) are implemented as a declaration + live-probe contract: a check passes only when the capability is declared in the agent card (or OpenAPI for `5.6`) **and** the declared endpoint responds with an accepted HTTP status. A timeout, network error, or `429` is `n/a` (never a failure); a declared-but-broken endpoint fails.
- **Level 4 (Indexable) expanded 12 → 15** — `4.13 Structured Data Quality`, `4.14 Entity Coverage`, `4.15 Content Freshness`.
- **Web-parity scan output** — top-level `scoringVersion` and a `score` summary (`passed`/`failed`/`partial`/`na`/`total`/`level`/`levelName`/`grade` + an `indexable` sub-score), matching `GET https://botvisibility.com/api/scan?...&format=json`.
- New tests for the external Level-5 probes and the three new Level-4 checks (204 → 236 total).

### Changed (BREAKING)

- **`getCurrentLevel` can now return `5`.** Level 5 is achievable from an external scan, so the numeric `currentLevel` is no longer capped at 4. The weighted cross-level algorithm gains an L5 tier (`l5Achieved = (l4 && r5 >= 0.50) || (r4 >= 0.35 && r5 >= 0.75)`).
- **`--repo` is now optional and supplementary.** It no longer "unlocks" Level 5 and is not required for any check. Use it to scan a local project directory alongside the live URL (surfacing implementations not yet published). Repo results are reported separately and **do not affect the score**. Their IDs are namespaced `repo-5.x` so they never collide with the canonical external Level-5 checks.
- **JSON output shape changed for parity.** The `cliChecks` array is removed; output is now `{ scoringVersion, score, url, timestamp, currentLevel, levels, checks }` (plus a supplementary `repoChecks` array only when `--repo` is used).
- Help text and the README drop all "Level 5 is CLI-only / `--repo` required / requires source" framing — the model is now "58 checks across 5 levels, all run externally."

## [2.0.1] - 2026-05-30

Maintenance release. No CLI behavior or check changes — `2.0.0` and `2.0.1` scan identically.

### Fixed

- The `2.0.0` merge accidentally re-introduced the Next.js website (which lives in a separate repository) into this CLI-only repo, leaving its sources and config under a `tsc`-built package. This broke CI — `tsc` could not resolve `next/server` or the `@/*` alias. Removed the web app entirely (`src/app`, `src/lib`, Next/Netlify/PostCSS/ESLint config, `public/` assets, the stale nested `cli/` copy, and the x402 demo script) so the build compiles only CLI sources and CI is green again.

## [2.0.0] - 2026-05-18

Expanded the checklist from 37 → 55 checks across **5 levels** to match the published `botvisibility.com` catalog. This is a breaking change for JSON consumers because Agent-Native check IDs shift from `4.x` to `5.x`.

### Added

- **Level 4: Indexable (12 new web-scanned checks)** — `4.1 Googlebot Allowed`, `4.2 Google-Extended Policy`, `4.3 Homepage Indexable`, `4.4 Sitemap Present`, `4.5 HTTPS`, `4.6 Mobile Viewport`, `4.7 JSON-LD Present`, `4.8 Entity Schema`, `4.9 Canonical URL`, `4.10 Heading Hierarchy`, `4.11 Image Alt Coverage`, `4.12 Substantive Content`. Most reuse the already-fetched homepage HTML so the scanner doesn't add round-trips.
- **Level 1 additions** — `1.15 Content Signals` (robots.txt `Content-Signal` directive per contentsignals.org), `1.16 API Catalog` (RFC 9727 linkset at `/.well-known/api-catalog`), `1.17 Markdown for Agents` (`Accept: text/markdown` returns markdown), `1.18 WebMCP` (`navigator.modelContext.provideContext` in homepage HTML).
- **Level 2 additions** — `2.10 OAuth Protected Resource` (RFC 9728 discovery document) and `2.11 x402 Payments` (probe protected routes for HTTP 402 + machine-readable payment requirements).
- Weighted-level algorithm extended so **Level 4 (Indexable) gates Level 5 (Agent-Native)**: `l4Achieved = (l3 && r4 >= 0.50) || (r3 >= 0.35 && r4 >= 0.75)`. The numeric `currentLevel` returned by `getCurrentLevel` now caps at 4; Level 5 is still signaled separately via `--repo` and the `cliChecks` array.
- 63 new tests (141 → 204 total) covering every new check with positive, partial, and negative paths.

### Changed (BREAKING)

- **Agent-Native check IDs renumbered**: `4.1`–`4.7` → `5.1`–`5.7`. Repo-scanned Agent-Native checks now report `level: 5`. Update any CI scripts or dashboards that key on `id` or `level` for these checks.
- `LEVELS` now declares 5 levels with `Indexable` (magenta) at position 4 and `Agent-Native` (blue) moved to position 5.
- Help text, level color rendering, and "next level" guidance in the CLI now reflect 5 levels.

## [1.3.2] - 2026-04-20

### Added
- Test coverage lifted from 49 → 141 tests. New suites cover timeout/network-failure paths, `robots.txt` AI policy branches, CORS OPTIONS→GET fallback, malformed-JSON handling on agent-card/ai.json/skills-index, page-token-efficiency thresholds with mitigation, MCP tool-quality 80% boundary, RSS two-stage discovery, structured-error probe, and every Level 4 repo check. Overall statement coverage is now 85.5% (branch 82.1%).

### Changed
- CLI argument parsing extracted into `src/args.ts` and exported as `parseArgs`. `main()` now consumes it unchanged. No behavior change; enables unit testing of flag combinations.

## [1.3.1] - 2026-04-08

First public open-source release. The CLI is now a standalone repository.

### Added
- **MCP Server discovery (1.12)** check — looks for `/.well-known/mcp.json` and similar paths.
- **MCP Tool Quality (3.7)** check — validates MCP tools have name, description, and input schema.
- vitest test suite covering scoring, scanner pure functions, and repo-scanner (49 tests).
- GitHub Actions CI matrix on Node 18, 20, and 22.
- Deep documentation: `docs/checks.md`, `docs/scoring.md`, `docs/ci-integration.md`, `docs/agent-tax.md`.
- `CONTRIBUTING.md` with dev setup, scope, and how to add a new check.
- Issue and PR templates under `.github/`.

### Fixed
- The CLI now actually runs all 37 checks defined in `CHECK_DEFINITIONS` + `CLI_CHECKS`. Previously two checks (1.12 MCP Server, 3.7 MCP Tool Quality) were declared but never wired into `runAllChecks`, so scans only reported 35 of the 37.
- Help text now shows correct per-level counts (L1=14, L3=7).

### Changed
- Repository restructured as a standalone CLI. Website code has been migrated to a separate repository. CLI sources promoted from `cli/` to the repo root.
- `package.json` adds test scripts and `vitest` devDependencies.
- README polished with badges and a "why this exists" section.

## [1.3.0] - 2026-03-30

- Added Page Token Efficiency (1.13) and RSS/Atom Feed (1.14) checks.

## [1.2.1] - 2026-03-29

- Bug fixes; checklist + dark theme polish; CLI v1.2.x line.

## [1.2.0] - 2026-03-29

- Added Level 3 code checks via `--repo`.
- Added CLI documentation page.

## [1.1.0]

- Renamed package from `agent-readiness-audit` to `botvisibility`.
- Switched from 31-item flat scoring to 4-level model with OpenAPI mining.

## [1.0.0]

- Initial release.
