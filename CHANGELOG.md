# Changelog

All notable changes to the BotVisibility CLI are documented here. This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- vitest test suite covering scoring, scanner pure functions, and repo-scanner (49 tests).
- GitHub Actions CI matrix on Node 18, 20, and 22.
- Deep documentation: `docs/checks.md`, `docs/scoring.md`, `docs/ci-integration.md`, `docs/agent-tax.md`.
- `CONTRIBUTING.md` with dev setup, scope, and how to add a new check.
- Issue and PR templates under `.github/`.
- **MCP Server discovery (1.12)** check — looks for `/.well-known/mcp.json` and similar paths.
- **MCP Tool Quality (3.7)** check — validates MCP tools have name, description, and input schema.

### Fixed
- The CLI now actually runs all 37 checks defined in `CHECK_DEFINITIONS` + `CLI_CHECKS`. Previously two checks (1.12 MCP Server, 3.7 MCP Tool Quality) were declared but never wired into `runAllChecks`, so scans only reported 35 of the 37.
- Help text now shows correct per-level counts (L1=14, L3=7).

### Changed
- Repository restructured as a standalone CLI. Website code has been migrated to a separate repository. CLI sources promoted from `cli/` to the repo root.
- `package.json` adds test scripts and `vitest` devDependencies. Version bumped to 1.3.1.
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
