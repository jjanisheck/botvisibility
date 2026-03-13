# 🤖 Agent-Readiness Audit Checklist

**Is your app ready for the age of AI agents?**

Most apps aren't. AI agents — Claude, GPT, Gemini, AutoGPT, and every agent framework built on top of them — currently interact with software in three ways, ranked from worst to best:

1. **Browser automation** (Playwright, Puppeteer) — slow, expensive, fragile, breaks on every UI change
2. **Reading source code** — even worse; agents infer your API from your frontend JS
3. **Native agent APIs** — fast, cheap, reliable, intentional

This checklist helps you figure out where your app falls on that spectrum and what to do about it. Score yourself, fix the quick wins, and systematically work toward being an app agents *love* to use.

---

## Why This Matters (Now)

The shift from "humans use apps" to "agents use apps on behalf of humans" is already happening. Apps that make it easy for agents to interact with them natively will:

- Appear in agent tool registries and marketplaces
- Cost agents 80–95% fewer tokens to operate (making them more likely to use you)
- Work reliably instead of breaking when you ship a UI redesign
- Build trust with developers building on top of LLMs

Apps that don't will get automated anyway — via brittle browser scrapers — or get skipped entirely in favor of competitors who made it easy.

---

## How to Use This Checklist

1. Go through each item and mark it ✅ (done), 🔄 (in progress), or ❌ (not started)
2. Count your checkboxes per level
3. Calculate your score using the [scoring table](#scoring)
4. Prioritize the [Quick Wins](#quick-wins) section first

**Tip:** This isn't about checking every box before you ship. It's a map. Even Level 1 complete puts you ahead of 90% of the internet.

---

## Level 1: Discoverable
*Can agents find you and understand what you do?*

**Target score: 6/6 items**

### 1.1 — `llms.txt`
- [ ] `/llms.txt` exists at your domain root

**Why it matters:** `llms.txt` is the emerging standard for telling AI systems what your app does and how to interact with it — the same concept as `robots.txt`, but for LLMs instead of crawlers. Agents and AI platforms check this file first. Without it, they're guessing.

**Format:**
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

**Reference:** [llmstxt.org](https://llmstxt.org)

---

### 1.2 — Agent Card
- [ ] `/.well-known/agent-card.json` exists and is valid

**Why it matters:** `agent-card.json` is a machine-readable manifest describing your app's agent capabilities, supported auth methods, available endpoints, and contact info. Agent frameworks can parse this automatically to understand how to work with you.

**Minimal example:**
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

---

### 1.3 — OpenAPI / Swagger Spec
- [ ] A machine-readable API spec exists (OpenAPI 3.x preferred)
- [ ] The spec is publicly accessible at a stable URL (e.g., `/openapi.json`)
- [ ] The spec is complete enough to generate a working client

**Why it matters:** OpenAPI specs are the lingua franca for AI tool use. Every major LLM framework — OpenAI function calling, Claude tool use, LangChain, LlamaIndex — can auto-generate agent tools from an OpenAPI spec. This single file can make your entire API usable by every agent framework instantly.

**Bonus:** Include `x-openai-isConsequential: false` on safe read endpoints and `x-openai-isConsequential: true` on writes so agents can self-confirm before destructive actions.

---

### 1.4 — Crawling & Discovery
- [ ] `robots.txt` has a clear, intentional policy for AI crawlers
- [ ] API endpoints are not blocked by `robots.txt`
- [ ] Your core domain pages have accurate meta descriptions (agents use these for intent matching)

**Why it matters:** Many apps accidentally block AI crawlers in their `robots.txt` (`User-agent: GPTBot` or `User-agent: ClaudeBot` with `Disallow: /`). This prevents agents from learning about your app at all. Be intentional: block scraping of private content, but allow indexing of public docs and your API.

---

### 1.5 — Documentation Quality
- [ ] Your docs are text-based, not locked behind interactive demos or heavy JS
- [ ] Authentication flow is documented in plain language (not just a Postman collection)
- [ ] At least one "getting started" example is copy-paste runnable

**Why it matters:** Agents often read your docs to understand context before making API calls. If your docs are a React SPA that requires JavaScript execution to render, agents see empty HTML. Static or SSR docs dramatically improve agent comprehension.

---

### 1.6 — Platform Skill Files
- [ ] A skill/tool definition exists for at least one major AI platform

**Why it matters:** Platform-specific skill files let agents on those platforms use your app with zero setup. A Claude skill file, an OpenAI GPT Action schema, or a LangChain tool definition means users of those platforms can say "use YourApp to do X" and it just works.

**Platform formats:**
- **Claude / OpenClaw:** `SKILL.md` with natural language instructions + API details
- **OpenAI GPT Actions:** OpenAPI spec with `x-openai-*` extensions
- **LangChain:** Python tool class with `name`, `description`, `_run()`
- **Semantic Kernel:** Plugin manifest JSON

---

## Level 2: Usable
*Can agents actually do things in your app?*

**Target score: 10/10 items**

### 2.1 — API-First Core Actions
- [ ] The primary value action of your app is available via API (not just the UI)
- [ ] Read operations are available (list, get, search)
- [ ] Write operations are available (create, update, delete)
- [ ] All API actions match what's available in the UI (no hidden-behind-UI-only features)

**Why it matters:** If an agent can read data but not act on it, it can observe but not help. The gap between "has an API" and "API does everything the UI does" is where most apps fail. Agents need parity.

---

### 2.2 — Agent-Friendly Authentication
- [ ] API key authentication is supported (not only OAuth browser flows)
- [ ] API keys can be created programmatically or via a simple dashboard step
- [ ] API keys can be scoped to specific permissions (read-only, specific resources)
- [ ] API keys don't expire silently without notification

**Why it matters:** OAuth flows requiring browser redirects are a dealbreaker for most agents. Agents can't open a browser, click "Allow", and wait. API keys — especially scoped ones — are the default auth method for agent-to-app communication. If your only auth is "click this OAuth button," agents are dead in the water.

---

### 2.3 — Predictable Error Handling
- [ ] All API errors return structured JSON (not HTML error pages)
- [ ] Error responses include a machine-readable error code (not just HTTP status)
- [ ] Errors include enough context for an agent to self-correct

**Why it matters:** When an agent makes a bad API call, it needs to understand *why* and adjust. `{"error": "invalid_email_format", "field": "email", "message": "Email must include @ symbol"}` is actionable. A 400 with an HTML page is a dead end.

**Good error format:**
```json
{
  "error": {
    "code": "validation_failed",
    "message": "The 'email' field is required.",
    "field": "email",
    "docs": "https://yourapp.com/docs/api/users#create"
  }
}
```

---

### 2.4 — Async Operations
- [ ] Long-running operations return a job ID immediately
- [ ] Job status is pollable via API
- [ ] Webhooks are available for job completion (preferred over polling)

**Why it matters:** Agents have context windows and timeouts. An API call that takes 45 seconds to respond will timeout or leave the agent waiting. The pattern: accept the request immediately, return a job ID, let the agent poll or receive a webhook when it's done.

---

### 2.5 — Idempotency
- [ ] Write endpoints support idempotency keys or are naturally idempotent
- [ ] Duplicate submissions don't create duplicate records silently

**Why it matters:** Agents retry. Network errors, context resets, and tool re-runs mean the same API call might be made 2–3 times. Without idempotency, you get duplicate orders, duplicate records, duplicate charges. An `Idempotency-Key` header costs you almost nothing to implement and prevents a whole class of agent bugs.

---

## Level 3: Optimized
*Is interacting with your app token-efficient?*

**Target score: 8/8 items**

### 3.1 — Response Bloat
- [ ] API responses don't include irrelevant fields by default
- [ ] A `fields` or `select` parameter exists to request only needed fields
- [ ] List endpoints return summaries by default, not full objects

**Why it matters:** Token cost is real. An API response that includes 40 fields when an agent needs 3 wastes ~80% of the tokens used to process it. Over hundreds of calls, this adds up. Apps that let agents request exactly what they need are dramatically cheaper to use.

**Example:**
```
GET /users/123?fields=id,name,email
```

---

### 3.2 — Pagination
- [ ] List endpoints are paginated (no unbounded responses)
- [ ] Cursor-based pagination is used (preferred over page number)
- [ ] The response includes a `next_cursor` or equivalent

**Why it matters:** Agents processing a list of 10,000 items don't need all 10,000 at once — and their context window can't hold them anyway. Cursor-based pagination lets agents process manageable chunks. Page-number pagination breaks when records are added/removed mid-process.

---

### 3.3 — Search & Filtering
- [ ] Resources can be filtered by common attributes via query params
- [ ] A search endpoint exists that accepts natural-language-style queries
- [ ] Date range filtering is supported on time-sensitive resources

**Why it matters:** Without filtering, agents have to fetch everything and filter in memory (expensive). With good filtering, an agent can say "get me all unpaid invoices from Q1" in one API call instead of fetching all invoices and processing them.

---

### 3.4 — Bulk Operations
- [ ] Batch create/update/delete endpoints exist for high-volume use cases
- [ ] Bulk operations are atomic or clearly specify partial-success behavior

**Why it matters:** An agent that needs to create 50 records shouldn't make 50 API calls. Bulk endpoints reduce latency, reduce API call overhead, and are dramatically cheaper in token cost (one response vs. 50 responses to parse).

---

### 3.5 — Structured Outputs
- [ ] Responses use consistent, predictable schemas
- [ ] Schemas are documented and stable (versioned)
- [ ] Enum fields use consistent values (not mixed case, not free-form strings)

**Why it matters:** LLMs are good at parsing JSON but struggle with inconsistency. A field that's sometimes `"status": "active"`, sometimes `"status": "Active"`, and sometimes `"status": 1` forces the agent to write defensive parsing code or guess. Consistency reduces errors and token waste.

---

### 3.6 — Rate Limit Transparency
- [ ] Rate limit headers are included in every response (`X-RateLimit-Remaining`, `X-RateLimit-Reset`)
- [ ] A 429 response includes `Retry-After` header
- [ ] Rate limits are documented clearly

**Why it matters:** Agents don't sleep. Without rate limit headers, an agent will keep hammering your API until it gets 429s, then has to guess when to retry. With proper headers, agents can self-regulate and back off gracefully.

---

### 3.7 — Caching Support
- [ ] `ETag` or `Last-Modified` headers are included on cacheable responses
- [ ] Appropriate `Cache-Control` headers are set
- [ ] Idempotent read endpoints support conditional requests

**Why it matters:** Agents often re-read the same data across turns of a conversation. With proper cache headers, the second fetch can return a 304 with no body — near-zero token cost. Without them, every read is a full response.

---

### 3.8 — Agent-Optimized Documentation
- [ ] A dedicated "Using with AI Agents" section exists in your docs
- [ ] Common agent workflows are documented as step-by-step examples
- [ ] A list of "what agents can do" is explicitly stated (not implied)

**Why it matters:** Developers building agents on top of your API need to know what's possible without reverse-engineering it. A page that says "here's how to build an agent that does X with YourApp" drives adoption and reduces support load.

---

## Level 4: Agent-Native
*Was your app designed with agents as first-class users?*

**Target score: 7/7 items**

### 4.1 — Intent-Based Endpoints
- [ ] High-level "intent" endpoints exist alongside CRUD endpoints
- [ ] Example: `/actions/send-invoice` instead of orchestrating `POST /invoices` + `POST /emails` + `PATCH /invoices/{id}/status`

**Why it matters:** CRUD APIs force agents to understand your data model deeply and orchestrate multi-step workflows themselves. Intent APIs let an agent say "send invoice to customer X" in one call. Less agent logic = fewer errors, fewer tokens, more reliable outcomes.

---

### 4.2 — Agent Session Management
- [ ] Agents can create persistent sessions with associated context
- [ ] Sessions can be named and resumed across agent runs
- [ ] Session data is available to the agent on resume

**Why it matters:** Long-running agentic workflows (multi-day tasks, background jobs) need to pick up where they left off. An agent that can store session state in your app doesn't need to re-discover context from scratch every time it runs.

---

### 4.3 — Scoped Agent Tokens
- [ ] Agent-specific token types exist with hard capability limits
- [ ] Tokens can be scoped to specific resources, not just permission types
- [ ] Token scopes are enforced server-side

**Why it matters:** An agent's blast radius should be limited. A token for "the agent managing project X" should only be able to touch project X. This is different from a general API key. When agents make mistakes (and they do), scoped tokens contain the damage.

---

### 4.4 — Agent Audit Logs
- [ ] All API actions are logged with the acting token/agent identifier
- [ ] Logs are queryable by time range and actor
- [ ] Logs distinguish agent actions from human actions

**Why it matters:** "The AI deleted it" is a support ticket you don't want. Audit logs that clearly show what each agent token did, when, and why (ideally with the agent's stated reasoning) are essential for debugging, compliance, and user trust.

---

### 4.5 — Sandbox / Test Environment
- [ ] A free-tier sandbox environment exists for agent testing
- [ ] Sandbox data is isolated from production
- [ ] Sandbox actions don't trigger real-world side effects (emails, charges, etc.)

**Why it matters:** Developers building agents on your platform need to iterate. If every test run sends a real email or charges a real card, they'll avoid testing at all — and agents will end up running in production with untested logic. A sandbox is table stakes for developer trust.

---

### 4.6 — Consequence Labels
- [ ] API documentation clearly marks "consequential" actions (irreversible, costly, external effects)
- [ ] The OpenAPI spec uses `x-openai-isConsequential` or equivalent to signal to agent frameworks
- [ ] Highly consequential endpoints require an explicit confirmation step

**Why it matters:** Most agent frameworks can gate on consequence labels — requiring human confirmation before executing irreversible actions. If you don't mark these, agents treat everything as low-stakes. Deleting an account gets the same silent execution as reading a list.

---

### 4.7 — Native Tool Schemas
- [ ] Your core API actions are packaged as ready-to-use tool definitions
- [ ] JSON Schema definitions are published for all tool inputs/outputs
- [ ] Tool definitions are available for OpenAI Function Calling, Claude Tool Use, and/or LangChain formats

**Why it matters:** This is the last mile of agent-readiness. Instead of a developer having to write a function wrapper around your API, they drop in your pre-built tool definition. The friction from "interesting API" to "working agent tool" goes from hours to minutes.

**Example Claude tool definition:**
```json
{
  "name": "create_invoice",
  "description": "Creates a new invoice for a customer. Use this when the user wants to bill a customer for work completed.",
  "input_schema": {
    "type": "object",
    "properties": {
      "customer_id": { "type": "string", "description": "The customer's ID" },
      "amount": { "type": "number", "description": "Invoice amount in cents" },
      "due_date": { "type": "string", "format": "date", "description": "ISO 8601 date" }
    },
    "required": ["customer_id", "amount"]
  }
}
```

---

## Scoring

### Your Score

Count your checked items per level:

| Level | Items | Your Score | Percentage |
|-------|-------|------------|------------|
| Level 1: Discoverable | 6 | __ / 6 | ___ % |
| Level 2: Usable | 10 | __ / 10 | ___ % |
| Level 3: Optimized | 8 | __ / 8 | ___ % |
| Level 4: Agent-Native | 7 | __ / 7 | ___ % |
| **Total** | **31** | **__ / 31** | **___ %** |

### Readiness Tiers

| Score | Tier | What It Means |
|-------|------|---------------|
| 0–6 (0–20%) | 🔴 **Invisible** | Agents can't find you or use you. You're automated via brittle browser scrapers, if at all. |
| 7–12 (21–40%) | 🟠 **Findable** | Agents know you exist but struggle to use you reliably. Lots of workarounds required. |
| 13–19 (41–62%) | 🟡 **Usable** | Agents can accomplish basic tasks. Significant inefficiency and rough edges remain. |
| 20–25 (63–80%) | 🟢 **Ready** | Agents can work with your app reliably. You're ahead of most of the internet. |
| 26–31 (81–100%) | 🚀 **Agent-Native** | Your app is designed for the agentic era. Agents prefer you. |

---

## Quick Wins
*Implement these in under an hour.*

These are the highest-leverage items — maximum impact, minimal effort. If you do nothing else, do these.

### ⚡ 30-Minute Wins

**1. Add `llms.txt`** (~15 min)

Create a plain text file at `https://yourapp.com/llms.txt`. Copy the format above, fill in your app's details, link to your API docs. Done. This single file broadcasts your existence to every AI system that knows to look for it.

**2. Add `/.well-known/agent-card.json`** (~15 min)

Create the JSON file. Most web frameworks can serve a static JSON file from a route in minutes. This gives agent frameworks a machine-readable map of your capabilities.

---

### ⚡ 45-Minute Wins

**3. Publish your OpenAPI spec** (~30–45 min if you have an undocumented API)

If you're using FastAPI, it generates this automatically. If you're on Rails, `rswag` or `apitome` can get you there fast. If you have nothing, start with your 3 most important endpoints. A partial spec is dramatically better than no spec.

**4. Fix your `robots.txt`** (~5 min)

Check if you're accidentally blocking AI crawlers. Look for `User-agent: GPTBot`, `User-agent: ClaudeBot`, `User-agent: Googlebot-Extended` in your `robots.txt`. If you're blocking them wholesale on public content, remove those rules.

**5. Add structured error responses** (~30–45 min)

Add a global error handler that wraps all errors in `{"error": {"code": "...", "message": "..."}}`. Most frameworks have middleware for this. Consistent error shapes are one of the highest-value things you can do for any API consumer, agent or human.

---

### ⚡ 1-Hour Wins

**6. Add API key authentication** (~45–60 min)

If you only have OAuth, add a simple API key option. Store hashed keys in your database, accept them in the `Authorization: Bearer` header. This unblocks every agent that can't run a browser flow.

**7. Add `RateLimit` headers** (~20 min)

Whatever rate limiting you already have, return `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` in every response. Add `Retry-After` to 429 responses. This is pure middleware and takes minimal code.

**8. Write a "Using with AI Agents" doc page** (~60 min)

Write a single page in your docs that answers: What can agents do in my app? What auth should they use? What are the most useful 5 API endpoints? Provide 1–2 copy-paste code examples. This page alone can drive significant developer adoption.

---

## Real-World Reference: Clone (clone.fyi)

Clone is a social music app that implemented this stack as one of the first apps designed for agent-readiness from the ground up. Here's what they shipped:

| Component | URL | Notes |
|-----------|-----|-------|
| `llms.txt` | `https://clone.fyi/llms.txt` | Describes app purpose, links to agent docs |
| Agent Card | `https://clone.fyi/.well-known/agent-card.json` | Capabilities, auth, endpoint map |
| Agent Endpoints | `https://clone.fyi/api/agent/*` | Structured, agent-optimized API surface |
| Claude Skill | `SKILL.md` in skill registry | Enables native Claude integration |

**Outcome:** Agents can discover Clone, understand its capabilities, authenticate, and perform actions without ever touching the UI. Token cost vs. browser automation: ~15x cheaper.

---

## Frequently Asked Questions

**Q: Do I need to implement all of this before my app works with agents?**

No. Level 1 alone makes you dramatically more discoverable. Level 2 makes you usable. Levels 3 and 4 are about efficiency and depth. Ship in order, prioritize by your use case.

**Q: My app is B2C, not developer-focused. Does this apply to me?**

Yes. AI assistants (Claude, ChatGPT, Gemini) are increasingly used directly by end users to manage SaaS apps. When a user says "cancel my subscription on YourApp," the assistant needs agent-ready infrastructure to comply. B2C apps that enable this become sticky in a way pure UI apps aren't.

**Q: What about LLM-native apps that were built with AI in mind?**

Being LLM-native in your UX (AI chat interface, etc.) is different from being agent-ready in your API. You can have the best AI features in the world and still fail every item on this checklist if your underlying API isn't structured for external agent access.

**Q: How do I handle security when agents are calling my API?**

Scoped tokens (Level 4.3) are the core answer. An agent token should only have permission to do what that specific agent needs to do. Combine with audit logs (Level 4.4) so you can review and revoke if needed. Treat agent tokens like service accounts: minimum viable permissions.

**Q: Is `llms.txt` an official standard?**

It's an emerging standard with growing adoption, similar to where `robots.txt` was in the early web. It's not an RFC. But every implementation signals to the ecosystem that you're paying attention, and the cost is a 10-line text file.

---

## Contributing

Found a missing item? Have a better example? PRs welcome.

**What makes a good checklist item:**
- Actionable (can be checked off in hours or days, not months)
- Universally applicable (works for most SaaS stacks, not just one framework)
- Has a clear "why" — not just "do this thing" but "here's what breaks without it"

---

## Need Help?

This checklist is free and yours to keep. If you want help implementing it, I do consulting work on agent-readiness infrastructure — `llms.txt`, agent card setup, API design for agent compatibility, skill files for major platforms, and audit/review of existing APIs.

I built this stack for [Clone (clone.fyi)](https://clone.fyi) and wrote this checklist because I couldn't find a good one anywhere.

If you're building something that needs to work well with AI agents and want a fast path through this list:

**→ [janisheck.com](https://janisheck.com)** | **[GitHub](https://github.com/jjanisheck)** — reach out and let's talk.

Happy to do a free 30-minute audit call for any app that publishes this checklist and links back to this repo. (Seriously. I want more real-world test cases.)

---

## License

MIT. Use it, fork it, embed it, share it. Attribution appreciated but not required.

If this helped, a ⭐ on GitHub goes a long way.

---

*Last updated: March 2026 | Maintained by [@joeyjanisheck](https://github.com/joeyjanisheck)*
