# Checks reference

BotVisibility runs **37 checks** across 4 levels. This page describes each check, why it matters for AI agent token efficiency, and how to fix failures.

The canonical implementation lives in `src/scanner.ts` (web-based checks) and `src/repo-scanner.ts` (`--repo` code-based checks). Check IDs and definitions are listed in `src/scoring.ts`.

---

## Level 1 — Discoverable (14 checks)

Bots can find your site's capabilities without scraping HTML.

### 1.1 llms.txt

**What it checks:** A machine-readable site description at `/llms.txt`.

**Why it matters:** Agents that find an llms.txt skip parsing your full HTML (~30,000 tokens) and read a structured summary (~500 tokens) instead — a 98% reduction on the discovery phase alone.

**How to fix:** Publish `/llms.txt` with your site purpose, primary URLs, and key documentation links. Spec at [llmstxt.org](https://llmstxt.org).

### 1.2 Agent Card

**What it checks:** A capability declaration at `/.well-known/agent-card.json`.

**Why it matters:** Agent cards let agents understand what your site can do (search, checkout, support) without trial-and-error endpoint discovery.

**How to fix:** Create `/.well-known/agent-card.json` listing your supported skills, endpoints, and authentication requirements.

### 1.3 OpenAPI Spec

**What it checks:** A published OpenAPI (Swagger) specification, discovered via common paths or HTML link tags.

**Why it matters:** Without an OpenAPI spec, agents guess at endpoints and parameters. With one, they read it once and call your API correctly the first time. Saves ~85,000 tokens per session.

**How to fix:** Publish your OpenAPI spec at `/openapi.json`, `/openapi.yaml`, or another well-known path, and link to it from your homepage `<head>`.

### 1.4 robots.txt AI Policy

**What it checks:** AI crawler directives in `/robots.txt` (e.g., explicit `User-agent: ChatGPT-User`, `User-agent: Claude-Web`).

**Why it matters:** Without explicit AI directives, agents and crawlers don't know whether they're welcome. An explicit allow signal increases scan reliability and avoids accidental blocks.

**How to fix:** Add per-agent stanzas to `/robots.txt` that allow or disallow each AI crawler explicitly.

### 1.5 Documentation Accessibility

**What it checks:** JSON-LD with `potentialAction` annotations on the homepage, indicating actionable entry points.

**Why it matters:** Schema.org `potentialAction` lets agents discover what they can *do* on your site (search, buy, subscribe) directly from structured data.

**How to fix:** Add a `<script type="application/ld+json">` block to your homepage with at least one `potentialAction`.

### 1.6 CORS Headers

**What it checks:** Whether the homepage and well-known endpoints respond with permissive `Access-Control-Allow-Origin` headers.

**Why it matters:** Browser-based agents can't fetch your resources cross-origin without CORS. Missing CORS headers silently break in-browser agent workflows.

**How to fix:** Set `Access-Control-Allow-Origin: *` (or a specific allowlist) on public discovery files (`/llms.txt`, `/.well-known/*`).

### 1.7 AI Meta Tags

**What it checks:** `<meta name="llms:description">`, `llms:url`, and `llms:instructions` tags in the homepage `<head>`.

**Why it matters:** Lightweight discovery — even a single `llms:description` meta tag tells an agent what page it's looking at without parsing the full body.

**How to fix:** Add `<meta name="llms:description" content="...">` and friends to your homepage `<head>`.

### 1.8 Skill File

**What it checks:** A skill definition at `/skill.md` with YAML frontmatter and structured instructions.

**Why it matters:** Skill files give agents step-by-step instructions for completing tasks on your site, eliminating exploration overhead.

**How to fix:** Create `/skill.md` with YAML frontmatter (name, description) and a markdown body of step-by-step agent instructions.

### 1.9 AI Site Profile

**What it checks:** A site manifest at `/.well-known/ai.json` with `name` and `capabilities` (or `skills`) fields.

**Why it matters:** Provides a single discovery entry point that ties together your llms.txt, agent card, and skill files.

**How to fix:** Publish `/.well-known/ai.json` with at least `{ "name": "...", "capabilities": [...] }`.

### 1.10 Skills Index

**What it checks:** A skills catalog at `/.well-known/skills/index.json` listing all available agent skills with `id` and `name` fields.

**Why it matters:** When you have multiple skill files, an index lets agents discover them all in one fetch.

**How to fix:** Publish `/.well-known/skills/index.json` listing every skill file on your site.

### 1.11 Link Headers

**What it checks:** `<link>` elements in your HTML `<head>` pointing to AI discovery files (llms.txt, ai.json, agent-card.json).

**Why it matters:** Agents that fetch your HTML can find your discovery files in one network round-trip via link tags, even if they don't know the conventional paths.

**How to fix:** Add `<link rel="alternate" href="/llms.txt">` and similar to your `<head>`.

### 1.12 MCP Server

**What it checks:** Discovery of a Model Context Protocol endpoint via well-known paths or link tags.

**Why it matters:** MCP is the emerging standard for agent-to-server communication. Sites that expose an MCP endpoint give agents direct, typed tool access.

**How to fix:** Run an MCP server and announce it via `/.well-known/mcp` or a `<link rel="mcp">` tag.

### 1.13 Page Token Efficiency

**What it checks:** The estimated token cost to parse your homepage HTML, weighted by how much of that content is meaningful vs boilerplate.

**Why it matters:** Bloated HTML directly inflates every agent session. A 30,000-token homepage costs an agent ~$0.10 just to *read* before doing anything useful.

**How to fix:** Reduce inline scripts, inline styles, repeated boilerplate, and tracking pixels. Publish llms.txt to give agents a low-cost alternative to your HTML.

### 1.14 RSS/Atom Feed

**What it checks:** A linked RSS or Atom feed via `<link rel="alternate" type="application/rss+xml">` or auto-discoverable `/feed.xml`, `/rss.xml`.

**Why it matters:** Feeds let agents subscribe to your content updates without polling HTML pages, dramatically reducing repeat-visit token cost.

**How to fix:** Generate an RSS or Atom feed and link to it from your `<head>`.

---

## Level 2 — Usable (9 checks)

Your API works for agents — auth, errors, and core operations.

### 2.1 API Read Operations

**What it checks:** GET endpoints in your published OpenAPI spec.

**Why it matters:** Agents need read access to discover state before taking action. A spec with no GET endpoints is unusable.

**How to fix:** Add at least one GET endpoint to your API and publish it in the spec.

### 2.2 API Write Operations

**What it checks:** POST/PUT/PATCH/DELETE endpoints in the spec.

**Why it matters:** Read-only APIs limit agents to observation. Most useful agent workflows require taking action.

**How to fix:** Add write endpoints for your core resources.

### 2.3 API Primary Action

**What it checks:** A primary value-creation endpoint exists (e.g., `/checkout`, `/send`, `/create-order`) in the spec.

**Why it matters:** Even with reads and writes, an API without a clear "do the main thing" endpoint forces agents to compose multiple calls and risk errors.

**How to fix:** Expose the central business action of your service as a single endpoint.

### 2.4 API Key Authentication

**What it checks:** An API key security scheme in the OpenAPI `securitySchemes` section.

**Why it matters:** OAuth flows are difficult for agents to complete autonomously. Simple API key auth is the lowest-friction option for agent identity.

**How to fix:** Add an API key auth option alongside any OAuth scheme. Mark it explicitly in the OpenAPI spec.

### 2.5 Scoped API Keys

**What it checks:** Permission scopes on API key or OAuth schemes (e.g., `read`, `write` scopes in oauth2 flows).

**Why it matters:** Unscoped keys are dangerous to give to agents. Scoped keys let users grant agents narrow, revocable permissions.

**How to fix:** Implement scope-based access control and document the scopes in your OpenAPI spec.

### 2.6 OpenID Configuration

**What it checks:** An OIDC discovery document at `/.well-known/openid-configuration`.

**Why it matters:** OIDC discovery is the standard way for agents to learn how to authenticate with your service.

**How to fix:** Publish an OIDC discovery document if you support OAuth/OIDC auth.

### 2.7 Structured Error Responses

**What it checks:** API errors return structured JSON (with `error`, `code`, `message` fields) rather than HTML error pages.

**Why it matters:** HTML error pages cost ~10,000 tokens to parse. Structured JSON errors cost ~50. This is one of the biggest token-savings wins.

**How to fix:** Return JSON error bodies for all API endpoints, with consistent field names. Set `Content-Type: application/json` even on 4xx and 5xx responses.

### 2.8 Async Operations

**What it checks:** Spec patterns indicating job-id + polling or webhook callbacks (e.g., 202 responses, `callback` keyword, `async`).

**Why it matters:** Long-running operations need to be agent-friendly. Without async patterns, agents either time out or hold expensive connections open.

**How to fix:** For any operation that takes >5 seconds, return a 202 with a job ID and provide a polling endpoint or webhook callback.

### 2.9 Idempotency Support

**What it checks:** `Idempotency-Key` header support on write endpoints.

**Why it matters:** Agents retry on failure. Without idempotency keys, retries cause duplicate writes (double charges, double messages, etc.).

**How to fix:** Accept and honor an `Idempotency-Key` header on all POST/PUT/PATCH endpoints.

---

## Level 3 — Optimized (7 checks)

Agents work efficiently. Pagination, filtering, caching, and tool quality reduce token waste.

### 3.1 Sparse Fields

**What it checks:** A `fields` (or `select`, `fieldset`) query parameter in the spec.

**Why it matters:** Agents often need only one or two fields per record. Sparse field selection cuts list-endpoint payload sizes by 90%+.

**How to fix:** Add a `fields=name,email` style parameter to list endpoints.

### 3.2 Cursor Pagination

**What it checks:** Cursor-based pagination parameters (`cursor`, `page_token`, `next_token`) in the spec.

**Why it matters:** Offset pagination breaks at scale and forces agents to re-scan pages on every retry. Cursor pagination is stable and resumable.

**How to fix:** Switch list endpoints to cursor-based pagination.

### 3.3 Search & Filtering

**What it checks:** Server-side `filter` and/or `search` parameters in the spec.

**Why it matters:** Without server-side filtering, agents fetch entire collections client-side and burn tokens grepping through them.

**How to fix:** Implement filtering by common fields and a generic search parameter on list endpoints.

### 3.4 Bulk Operations

**What it checks:** Batch create/update/delete endpoints in the spec.

**Why it matters:** N round-trips for N items is N times the latency *and* N times the token cost. Bulk endpoints collapse this to one call.

**How to fix:** Add `/bulk` or `/batch` variants for high-volume operations.

### 3.5 Rate Limit Headers

**What it checks:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers on API responses.

**Why it matters:** Without rate limit headers, agents back off too aggressively (wasting time) or too little (getting blocked). Headers let agents pace themselves precisely.

**How to fix:** Emit `X-RateLimit-*` headers on every API response.

### 3.6 Caching Headers

**What it checks:** `ETag`, `Cache-Control`, and `Last-Modified` headers on API responses.

**Why it matters:** Conditional requests let agents skip re-fetching unchanged resources, cutting repeat-visit cost to near zero.

**How to fix:** Set ETag and Cache-Control on stable resources. Honor If-None-Match and return 304 on unchanged GET requests.

### 3.7 MCP Tool Quality

**What it checks:** MCP tools (if your site exposes an MCP server) have descriptive names, clear summaries, and well-typed input schemas.

**Why it matters:** Poorly described MCP tools confuse agents and lead to wrong tool selection. Good descriptions are the difference between an MCP server that works and one that doesn't.

**How to fix:** For each MCP tool, write a one-sentence summary, a clear description, and an explicit JSON schema for inputs.

---

## Level 4 — Agent-Native (7 checks, `--repo` required)

First-class agent support. These checks scan your local source code and require the `--repo <path>` flag.

### 4.1 Intent-Based Endpoints

**What it checks:** High-level action endpoints (e.g., `/send-invoice`, `/cancel-subscription`) in your route definitions, alongside CRUD primitives.

**Why it matters:** CRUD endpoints force agents to compose 5-10 calls for a single user intent. Intent endpoints encode the business action directly.

**How to fix:** Add intent-shaped routes for your most common multi-step workflows.

### 4.2 Agent Sessions

**What it checks:** Persistent session management for multi-step agent interactions in your code (session stores, context tracking).

**Why it matters:** Stateless APIs make agents re-send the entire context on every call. Sessions cap the per-call token cost.

**How to fix:** Implement a session abstraction (Redis-backed or similar) that agents can attach to.

### 4.3 Scoped Agent Tokens

**What it checks:** Agent-specific token issuance with capability limits in your auth configuration.

**Why it matters:** General-purpose API keys are blunt instruments. Agent-scoped tokens with explicit capabilities let users delegate narrowly.

**How to fix:** Implement a token-issuance flow where users can mint tokens with specific scopes for specific agents.

### 4.4 Agent Audit Logs

**What it checks:** API actions logged with agent identifiers (e.g., `agent_id`, `actor_type: "agent"`) in your logging code.

**Why it matters:** Without agent attribution in logs, debugging agent behavior and detecting misuse is nearly impossible.

**How to fix:** Tag every authenticated request with the calling agent's identity in your audit log.

### 4.5 Sandbox Environment

**What it checks:** A separate test/sandbox environment for safe agent experimentation, declared in your config or docs.

**Why it matters:** Agents can't safely learn on production. A sandbox lets developers iterate without risk.

**How to fix:** Provision a sandbox environment with test credentials and document it.

### 4.6 Consequence Labels

**What it checks:** Annotations marking irreversible or destructive actions in your route handlers, OpenAPI spec, or schema files.

**Why it matters:** Agents need to know which actions can't be undone before they commit. Consequence labels feed agent guardrails.

**How to fix:** Annotate destructive endpoints (e.g., `x-consequence: irreversible`) and/or label them in your docs.

### 4.7 Native Tool Schemas

**What it checks:** Ready-to-use tool definitions for agent frameworks (OpenAI tools, Anthropic tool-use, MCP tool schemas) in your repo.

**Why it matters:** When you ship pre-built tool schemas, framework users can drop them in directly instead of hand-translating your OpenAPI spec.

**How to fix:** Publish a `tools.json` or `mcp.json` in your repo with tool definitions matching the major agent frameworks.

---

## Source

- Web check definitions: `src/scoring.ts` (`CHECK_DEFINITIONS`)
- Web check implementations: `src/scanner.ts`
- L4 / `--repo` check definitions: `src/scoring.ts` (`CLI_CHECKS`)
- L4 / `--repo` check implementations: `src/repo-scanner.ts`
