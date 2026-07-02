---
name: botvisibility
description: Scan any URL for AI agent readiness — 58 checks across 5 levels (Discoverable, Usable, Optimized, Indexable, Agent-Native). Use when you need to audit how ready a website or API is for AI agents, or check whether a target exposes llms.txt, OpenAPI, an MCP server, agent cards, CORS, auth, or agent-native payments before integrating.
license: MIT
homepage: https://botvisibility.com
metadata:
  category: developer-tools
  provider: BotVisibility
---

# BotVisibility

Lighthouse for AI agents. BotVisibility scans any URL across 58 checks and 5
levels and returns a prioritized report of what an AI agent can and can't do
with the site. Everything is verified externally — the way a real agent would
encounter the site.

## When to use

- Audit a site's agent-readiness ("how ready is example.com for AI agents?").
- Check for agent infrastructure before integrating (llms.txt, OpenAPI, MCP,
  agent cards, CORS, rate-limit headers, auth discovery, x402 payments).
- Compare two sites, or get a ranked list of the highest-impact fixes.

Do NOT use it to fetch page content, screenshot for humans, or do general web
search — it measures agent-readiness signals, not content.

## How to call it

**REST (simplest):**

```
GET https://botvisibility.com/api/scan?url=https://example.com&format=json
```

Returns JSON with a top-level `score` (passed/failed/level/grade) and per-check
results with `id`, `status` (pass|fail|partial|na), `message`, and
`recommendation`. Free up to a daily per-caller allowance; beyond that it returns
HTTP 402 with x402 payment requirements.

**MCP (Streamable HTTP):** `https://botvisibility.com/api/mcp` — tools include
`scan_url`, `compare_sites`, `get_recommendations`, `deep_scan`.

**CLI:** `npx botvisibility example.com`

**Python:** `pip install botvisibility`

## Reference

- Docs: https://botvisibility.com/docs
- OpenAPI: https://botvisibility.com/openapi.json
- llms.txt: https://botvisibility.com/llms.txt
- Auth: https://botvisibility.com/auth.md
