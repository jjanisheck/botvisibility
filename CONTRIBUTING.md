# Contributing to BotVisibility CLI

Thanks for your interest. This is a small project and contributions are welcome — especially new checks, bug reports against real-world sites, and documentation improvements.

## In scope

- New L1-L3 checks based on emerging agent-readiness standards (llms.txt, MCP, agent cards, etc.)
- New L4 (`--repo`) checks that detect agent-friendly patterns in source code
- Improvements to existing check accuracy and false-positive reduction
- Documentation, recipes, and CI examples

## Out of scope

- Hosted scanning (the website at botvisibility.com lives in a separate repo)
- General-purpose web scrapers or SEO checks
- Anything that depends on external paid APIs

## Dev setup

```bash
git clone https://github.com/jjanisheck/botvisibility.git
cd botvisibility
npm install
npm run build
npm test
```

Run the CLI locally during development:

```bash
node dist/index.js example.com
node dist/index.js example.com --repo /path/to/some/repo
```

## Adding a new check

1. Add the definition to `CHECK_DEFINITIONS` in `src/scoring.ts` (or `LEVEL5_CHECKS` for a Level-5 Agent-Native check).
2. Implement the check function in `src/scanner.ts` (Levels 1–4) or `src/deep-checks.ts` (Level 5: declaration + live probe). Follow the patterns of existing `checkX` functions — return a `CheckResult` with `id`, `name`, `status`, `level`, `message`, and (where useful) `recommendation` and `foundAt`.
3. Wire the new check into `runAllChecks` in `src/scanner.ts` (Level 5 checks are wired via `runDeepChecks`). The optional `--repo` supplementary checks live in `src/repo-scanner.ts` / `runRepoChecks`.
4. Add a test in `tests/scanner.test.ts` or `tests/repo-scanner.test.ts`.
5. Add the check to `docs/checks.md`.
6. Run `npm test` and `npm run build`.

## Pull request guidelines

- Keep PRs small and focused — one new check per PR is ideal.
- New checks must include tests.
- New checks must include a `docs/checks.md` entry.
- CI must be green before review.

## Code of conduct

Be kind. Be helpful. Assume good faith.
