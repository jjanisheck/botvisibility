# BotVisibility

**The Speedtest.net for AI agents.**

Check how visible your website is to AI agents like Claude, GPT, and Gemini. Get a score, understand your gaps, and improve your agent-readiness in minutes.

[botvisibility.com](https://botvisibility.com) | [CLI](#cli-usage) | [Checklist](#the-31-item-checklist)

---

## Why BotVisibility Matters

The shift from "humans use apps" to "agents use apps on behalf of humans" is happening now. AI assistants are becoming the primary interface for millions of users.

Apps that make it easy for agents to interact with them will:
- Appear in agent tool registries and marketplaces
- Cost agents 80-95% fewer tokens to operate
- Work reliably instead of breaking on UI changes
- Build trust with developers building on LLMs

Apps that don't will get automated anyway—via brittle browser scrapers—or get skipped entirely.

**BotVisibility tells you where you stand.**

---

## Quick Start

### Web Scanner

Visit [botvisibility.com](https://botvisibility.com) and enter any URL. You'll get:
- Instant automated checks (9 tests)
- A visibility tier from Invisible to Beacon
- Specific recommendations for improvement
- A checklist of 22 additional manual checks

### CLI Scanner

```bash
# Scan any URL
npx agent-readiness-audit https://example.com

# Output as JSON (for CI/CD)
npx agent-readiness-audit https://example.com --json

# Include repo analysis for deeper checks
npx agent-readiness-audit https://example.com --repo /path/to/code

# Full scan with JSON output
npx agent-readiness-audit https://example.com --repo ./ --json
```

---

## Visibility Tiers

Your score determines your tier:

| Score | Tier | What It Means |
|-------|------|---------------|
| 0-20% | **Invisible** | Agents can't find or use you. You're automated via brittle browser scrapers, if at all. |
| 21-40% | **Dim** | Agents know you exist but struggle to use you. Lots of workarounds required. |
| 41-62% | **Visible** | Agents can find you and handle basic tasks. Some blind spots remain. |
| 63-80% | **Clear** | Agents see you clearly. You're ahead of most of the internet. |
| 81-100% | **Beacon** | Maximum bot visibility. Agents find you, understand you, and prefer you. |

---

## CLI Usage

### Installation

The CLI runs via npx—no installation required:

```bash
npx agent-readiness-audit <url> [options]
```

Or install globally:

```bash
npm install -g agent-readiness-audit
agent-readiness-audit https://example.com
```

### Options

| Flag | Description |
|------|-------------|
| `--json` | Output results as JSON (useful for CI/CD pipelines) |
| `--repo <path>` | Include local repository analysis for deeper checks |
| `--help`, `-h` | Show help message |

### Examples

```bash
# Basic URL scan
npx agent-readiness-audit stripe.com

# JSON output for automation
npx agent-readiness-audit myapp.com --json > results.json

# Full scan with repo analysis
npx agent-readiness-audit https://myapp.com --repo ./my-backend

# Pipe to jq for specific data
npx agent-readiness-audit example.com --json | jq '.tier.name'
```

### CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
- name: Check BotVisibility Score
  run: |
    RESULT=$(npx agent-readiness-audit ${{ env.SITE_URL }} --json)
    TIER=$(echo $RESULT | jq -r '.tier.name')
    PASSED=$(echo $RESULT | jq '.checks | map(select(.passed)) | length')
    echo "BotVisibility Tier: $TIER"
    echo "Checks Passed: $PASSED/9"

    # Fail if below threshold
    if [ "$TIER" = "Invisible" ]; then
      echo "::error::BotVisibility score is too low"
      exit 1
    fi
```

---

## The 31-Item Checklist

BotVisibility scans for 31 items across 4 levels. The automated scanner checks 9 of these; the rest require manual verification.

### Level 1: Discoverable (6 items)
*Can agents find you and understand what you do?*

| Check | Auto | Description |
|-------|------|-------------|
| llms.txt | ✓ | AI-readable description at `/llms.txt` |
| Agent Card | ✓ | Machine-readable manifest at `/.well-known/agent-card.json` |
| OpenAPI Spec | ✓ | Published API specification |
| robots.txt Policy | ✓ | Clear AI crawler policy |
| Doc Accessibility | ✓ | Text-based docs, not locked in JS |
| Platform Skills | | Tool definitions for Claude, GPT, etc. |

### Level 2: Usable (10 items)
*Can agents actually do things in your app?*

| Check | Auto | Description |
|-------|------|-------------|
| API-First Actions | | Primary value available via API |
| Read Operations | | List, get, search endpoints |
| Write Operations | | Create, update, delete endpoints |
| API Parity | | API matches UI capabilities |
| API Key Auth | | Non-OAuth authentication option |
| Scoped Permissions | | Granular API key scopes |
| OpenID Config | ✓ | OAuth discovery endpoint |
| Structured Errors | | JSON error responses with codes |
| Async Operations | | Job IDs for long operations |
| Idempotency | | Duplicate request handling |

### Level 3: Optimized (8 items)
*Is interacting with your app token-efficient?*

| Check | Auto | Description |
|-------|------|-------------|
| Sparse Fields | | Select specific response fields |
| Cursor Pagination | | Efficient list iteration |
| Search & Filtering | | Query params for filtering |
| Bulk Operations | | Batch create/update/delete |
| Consistent Schemas | | Predictable response structure |
| Rate Limit Headers | ✓ | Transparent throttling |
| Caching Headers | ✓ | ETags, Cache-Control |
| Agent Documentation | | Dedicated AI/agent docs |

### Level 4: Agent-Native (7 items)
*Was your app designed with agents as first-class users?*

| Check | Auto | Description |
|-------|------|-------------|
| Intent Endpoints | | High-level action APIs |
| Agent Sessions | | Persistent context across runs |
| Scoped Tokens | | Agent-specific permissions |
| Audit Logs | | Agent action tracking |
| Sandbox | | Test environment without side effects |
| Consequence Labels | | Marked destructive actions |
| Native Tool Schemas | | Ready-to-use tool definitions |

---

## How to Improve Your Score

### 30-Minute Quick Wins

**1. Add `llms.txt` (~15 min)**

Create a plain text file at your domain root:

```
# YourApp

> One-sentence description of what your app does.

YourApp lets users [core value proposition]. It provides APIs for [key capabilities].

## Docs
- [API Reference](https://yourapp.com/docs/api)
- [Authentication](https://yourapp.com/docs/auth)

## Agent APIs
- [Agent Quickstart](https://yourapp.com/docs/agents)
- [OpenAPI Spec](https://yourapp.com/openapi.json)
```

See [llmstxt.org](https://llmstxt.org) for the full specification.

**2. Add Agent Card (~15 min)**

Create `/.well-known/agent-card.json`:

```json
{
  "name": "YourApp",
  "description": "What your app does in one sentence.",
  "url": "https://yourapp.com",
  "api": {
    "spec": "https://yourapp.com/openapi.json",
    "baseUrl": "https://api.yourapp.com/v1"
  },
  "auth": {
    "type": "bearer",
    "tokenUrl": "https://yourapp.com/docs/auth"
  },
  "capabilities": ["read", "write", "search"],
  "contact": "agents@yourapp.com"
}
```

### 1-Hour Wins

**3. Publish OpenAPI Spec**

If using a framework that auto-generates specs (FastAPI, NestJS), expose it at `/openapi.json`. Otherwise, document your top 5 endpoints—partial coverage is dramatically better than none.

**4. Fix robots.txt**

Remove blanket blocks on AI crawlers:

```
# Allow AI agents to index public content
User-agent: GPTBot
Allow: /docs
Allow: /api

User-agent: ClaudeBot
Allow: /docs
Allow: /api
```

**5. Add Rate Limit Headers**

Include these on every API response:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1609459200
```

Add `Retry-After` to 429 responses.

---

## Real-World Example: Clone

[Clone](https://clone.fyi) implemented full BotVisibility as one of the first agent-ready apps:

| Component | URL |
|-----------|-----|
| llms.txt | `https://clone.fyi/llms.txt` |
| Agent Card | `https://clone.fyi/.well-known/agent-card.json` |
| Agent Endpoints | `https://clone.fyi/api/agent/*` |
| Claude Skill | Available in skill registry |

Result: Agents can discover, authenticate, and use Clone without touching the UI. Token cost vs browser automation: ~15x cheaper.

---

## FAQ

**Q: Do I need to implement everything before agents can use my app?**

No. Level 1 alone makes you dramatically more discoverable. Level 2 makes you usable. Ship in order, prioritize by impact.

**Q: My app is B2C. Does this apply?**

Yes. When a user says "cancel my subscription on YourApp," the AI assistant needs agent-ready infrastructure to comply. B2C apps that enable this become sticky in ways pure UI apps aren't.

**Q: How do I handle security with agent access?**

Scoped tokens (Level 4.3) are core. Agent tokens should have minimum viable permissions. Combine with audit logs so you can review and revoke.

**Q: Is llms.txt an official standard?**

It's an emerging standard with growing adoption, similar to where robots.txt was in the early web. The cost is a 10-line text file.

---

## Contributing

Found a missing check? Have a better example? PRs welcome.

**What makes a good checklist item:**
- Actionable (hours or days, not months)
- Universally applicable (works for most stacks)
- Clear "why" (not just what, but what breaks without it)

---

## Need Help?

This checklist is free and yours to keep. For implementation help:

- **Consulting:** Agent-readiness infrastructure, API design, skill files for major platforms
- **Audits:** Free 30-minute audit for apps that publish this checklist and link back

**Contact:** [janisheck.com](https://janisheck.com) | [GitHub](https://github.com/joeyjanisheck)

---

## License

MIT. Use it, fork it, embed it, share it.

---

*Last updated: March 2026*
*Maintained by [@joeyjanisheck](https://github.com/joeyjanisheck)*
