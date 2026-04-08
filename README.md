# BotVisibility CLI

[![npm version](https://img.shields.io/npm/v/botvisibility.svg)](https://www.npmjs.com/package/botvisibility)
[![npm downloads](https://img.shields.io/npm/dm/botvisibility.svg)](https://www.npmjs.com/package/botvisibility)
[![CI](https://github.com/jjanisheck/botvisibility/actions/workflows/ci.yml/badge.svg)](https://github.com/jjanisheck/botvisibility/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> Lighthouse for AI agents. Scan any URL to see how visible and usable it is to Claude, GPT, Copilot, and autonomous agent frameworks.

```bash
npx botvisibility stripe.com
```

## Why this exists

When AI agents browse a site that doesn't publish machine-readable metadata or APIs, they fall back to scraping HTML, guessing endpoints, and retrying. That burns 5-100x more tokens per session and silently inflates the cost of every agent interaction. BotVisibility runs 37 automated checks across 4 levels and tells you exactly what's missing and how to fix it.

## Install & run

No install needed:

```bash
npx botvisibility <url>
```

Or globally:

```bash
npm install -g botvisibility
botvisibility stripe.com
```

## Usage

```bash
# Basic URL scan
npx botvisibility https://example.com

# JSON output for CI/CD
npx botvisibility stripe.com --json

# Full scan with local repo analysis (unlocks Level 4)
npx botvisibility https://myapp.com --repo ./

# Combined scan with JSON output
npx botvisibility mysite.com --repo ../my-backend --json
```

## What it checks

Four levels, 37 total checks. The full reference lives in [`docs/checks.md`](docs/checks.md). Quick overview:

- **Level 1 — Discoverable (14 checks):** llms.txt, agent-card, OpenAPI spec, robots.txt AI policy, MCP server, ai.json, skill files, RSS, page token efficiency, and more.
- **Level 2 — Usable (9 checks):** API read/write/primary actions, API key auth, scoped keys, OIDC, structured errors, async ops, idempotency.
- **Level 3 — Optimized (7 checks):** sparse fields, cursor pagination, filtering, bulk ops, rate limit headers, caching headers, MCP tool quality.
- **Level 4 — Agent-Native (7 checks, `--repo` required):** intent endpoints, agent sessions, scoped agent tokens, audit logs, sandbox env, consequence labels, native tool schemas.

## Scoring

BotVisibility uses a weighted cross-level algorithm so investing in higher-level capabilities still moves your score even if some low-level items are missing. Full algorithm and worked examples in [`docs/scoring.md`](docs/scoring.md).

## CI/CD integration

Drop into any CI to catch agent-readiness regressions:

```yaml
- name: Check BotVisibility
  run: |
    SCORE=$(npx botvisibility mysite.com --json | jq '.currentLevel')
    if [ "$SCORE" -lt 1 ]; then
      echo "BotVisibility score below Level 1"
      exit 1
    fi
```

Recipes for GitHub Actions, GitLab CI, and CircleCI in [`docs/ci-integration.md`](docs/ci-integration.md).

## The agent tax

Every unoptimized interaction costs AI agents extra tokens. At Claude Sonnet 4.6 rates and 1,000 agent visits per day, an unoptimized site can waste **$22,800/month** in tokens. Full analysis and methodology in [`docs/agent-tax.md`](docs/agent-tax.md).

## Contributing

Contributions welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for development setup and how to add a new check.

## Links

- **Scanner & website:** [botvisibility.com](https://botvisibility.com)
- **GitHub:** [github.com/jjanisheck/botvisibility](https://github.com/jjanisheck/botvisibility)

## License

MIT
