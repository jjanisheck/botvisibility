# The agent tax

Every interaction between an AI agent and an unoptimized site burns excess tokens. This document explains how the cost adds up and how BotVisibility quantifies it.

## The math

| Without optimization | With optimization | Savings |
|---|---|---|
| Scrape HTML for site info (~30,000 tokens) | Read llms.txt (~500 tokens) | 98% |
| Guess API endpoints from docs (~100,000 tokens) | Read OpenAPI spec (~15,000 tokens) | 85% |
| Parse HTML error pages (~10,000 tokens) | Read JSON error (~50 tokens) | 99% |
| Fetch every field of every record (~2,000 tokens) | Sparse field selection (~200 tokens) | 90% |

A single unoptimized agent session can burn **120,000-500,000+ excess tokens**. At Claude Sonnet 4.6 rates that's roughly $0.83 per session vs $0.07 optimized.

## Annualized impact

| Agent visits/day | Unoptimized cost/month | Optimized cost/month | Wasted/month |
|---|---|---|---|
| 100 | $2,490 | $210 | $2,280 |
| 1,000 | $24,900 | $2,100 | $22,800 |
| 10,000 | $249,000 | $21,000 | $228,000 |

## Methodology

These figures assume:
- Average session = 1 discovery phase + 1 API exploration phase + 3 errors handled
- Token counts measured against real-world site scans during BotVisibility test runs
- Pricing: Claude Sonnet 4.6 input tokens at published list rates
- "Optimized" means the site passes all relevant L1-L3 checks

## What you can do

Every L1 and L2 check that BotVisibility flags reduces your agent tax. The biggest single wins:

1. **llms.txt** — eliminates the bulk of HTML scraping
2. **Published OpenAPI spec** — cuts API exploration cost by 85%+
3. **Structured JSON errors** — eliminates error-page parsing
4. **Cursor pagination + sparse fields** — caps the cost of any individual API call

Run `npx botvisibility yoursite.com` to see your current state.
