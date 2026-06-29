# Checks reference

BotVisibility runs **58 checks** across 5 levels — **all run externally** against a live URL (no source access required for any level, including Level 5). This page describes each check, why it matters for AI agent token efficiency, and how to fix failures.

The canonical implementation lives in `src/scanner.ts` (Levels 1–4) and `src/deep-checks.ts` (Level 5: declaration + live probe). Check IDs and definitions are listed in `src/scoring.ts`. The optional `--repo <path>` flag adds supplementary local-source analysis via `src/repo-scanner.ts`; it is not required for any check and does not affect the score.

---

## Level 1 — Discoverable (18 checks)

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

### 1.15 Content Signals

**What it checks:** A `Content-Signal:` directive in `robots.txt` declaring AI usage preferences (`ai-train`, `search`, `ai-input`).

**Why it matters:** Content Signals (contentsignals.org) give agents a single machine-readable place to learn what your site permits for training, search grounding, and inference.

**How to fix:** Add `Content-Signal: search=yes, ai-train=no, ai-input=yes` (or your chosen policy) to `robots.txt`.

### 1.16 API Catalog

**What it checks:** An RFC 9727 API catalog linkset at `/.well-known/api-catalog` with `service-desc`, `service-doc`, and `status` link relations.

**Why it matters:** Agents can discover every API you publish (and their OpenAPI specs) from a single well-known URL, skipping per-endpoint scraping.

**How to fix:** Publish a JSON document under `Content-Type: application/linkset+json` with a top-level `linkset` array listing each API and its related resources.

### 1.17 Markdown for Agents

**What it checks:** Requests with `Accept: text/markdown` return a markdown rendering of the page (not HTML).

**Why it matters:** Markdown is 5–10× smaller than the equivalent HTML, so agents get the page contents without paying the HTML tax.

**How to fix:** Detect `Accept: text/markdown` on the homepage and (where applicable, other pages) and respond with a markdown body and `Content-Type: text/markdown`.

### 1.18 WebMCP

**What it checks:** The homepage calls `navigator.modelContext.provideContext()` to register in-browser tools for AI agents (WebMCP).

**Why it matters:** WebMCP lets agents discover and use tools that live in your client-side app — without leaving the page or hitting a backend.

**How to fix:** Call `navigator.modelContext.provideContext({ tools: [...] })` from your homepage JS to expose tools to embedded agents.

---

## Level 2 — Usable (11 checks)

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

### 2.10 OAuth Protected Resource

**What it checks:** A `/.well-known/oauth-protected-resource` document (RFC 9728) advertising authorization servers and scopes.

**Why it matters:** Agents can learn where to obtain tokens for your API in a single fetch, instead of guessing OAuth endpoints from documentation.

**How to fix:** Publish a JSON document at `/.well-known/oauth-protected-resource` with `authorization_servers`, `scopes_supported`, and your `resource` identifier per RFC 9728.

### 2.11 x402 Payments

**What it checks:** A protected route returns HTTP 402 with a machine-readable `x402` payment-requirements body (`x402Version`, `accepts`, `paymentRequirements`).

**Why it matters:** x402 is the emerging agent-native billing protocol — agents can pay for access automatically when the API responds in this format.

**How to fix:** On paid routes, return HTTP 402 with a JSON body listing `accepts` payment schemes and the amounts/tokens involved.

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

## Level 4 — Indexable (15 checks)

AI search systems can find, crawl, index, and ground answers in your site. Most of these checks reuse the homepage HTML the scanner already fetched, so they add no extra round-trips.

### 4.1 Googlebot Allowed

**What it checks:** `robots.txt` does not `Disallow: /` for `Googlebot` (or `User-agent: *` without an explicit Googlebot override).

**Why it matters:** AI search systems lean on the same crawl as traditional search. Blocking Googlebot blocks AI-grounding too.

**How to fix:** Remove `Disallow: /` for Googlebot and `User-agent: *`, or add an explicit `User-agent: Googlebot` block that allows crawling.

### 4.2 Google-Extended Policy

**What it checks:** An explicit `User-agent: Google-Extended` block in `robots.txt` declaring your AI training/grounding policy.

**Why it matters:** `Google-Extended` is the dedicated control for Google's AI products. Stating your policy explicitly avoids ambiguity.

**How to fix:** Add a `User-agent: Google-Extended` block with `Allow:` or `Disallow:` directives reflecting your policy.

### 4.3 Homepage Indexable

**What it checks:** Homepage has no `noindex` meta tag and no `X-Robots-Tag: noindex` response header.

**Why it matters:** A `noindex` directive removes the homepage from the search index entirely — no AI system can ground answers in it.

**How to fix:** Remove the `noindex` meta or header from the homepage (keep it on staging environments only).

### 4.4 Sitemap Present

**What it checks:** A reachable `/sitemap.xml` and a `Sitemap:` directive in `robots.txt` pointing to it.

**Why it matters:** Sitemaps let AI search systems discover every page without crawling the entire link graph.

**How to fix:** Publish a valid `sitemap.xml` (or `sitemap_index.xml`) and reference it from `robots.txt`.

### 4.5 HTTPS

**What it checks:** The origin serves over HTTPS, and `http://` requests redirect to `https://`.

**Why it matters:** Search engines deprioritize unencrypted sites and AI systems generally won't ground answers in them.

**How to fix:** Issue a certificate (Let's Encrypt, ACME) and force-redirect all http traffic to https with a 301.

### 4.6 Mobile Viewport

**What it checks:** A `<meta name="viewport" content="width=device-width, ...">` tag in the homepage `<head>`.

**Why it matters:** Mobile-first indexing means search systems evaluate the mobile rendering. No viewport tag = poor mobile rendering = lower index priority.

**How to fix:** Add `<meta name="viewport" content="width=device-width, initial-scale=1">` to the homepage `<head>`.

### 4.7 JSON-LD Present

**What it checks:** At least one valid `<script type="application/ld+json">` block on the homepage.

**Why it matters:** JSON-LD is the substrate for rich results and AI grounding — without it, search systems can only infer entity information from raw text.

**How to fix:** Add a Schema.org JSON-LD block (start with `WebSite` and `Organization`) to the homepage `<head>`.

### 4.8 Entity Schema

**What it checks:** JSON-LD declares the site/business entity via `@type: Organization`, `WebSite`, or `LocalBusiness`.

**Why it matters:** Entity schema is what links your site to a knowledge-graph entry. AI answers cite entities, not pages.

**How to fix:** Add an `Organization` (or `WebSite` / `LocalBusiness`) JSON-LD block with `name`, `url`, `logo`, and `sameAs` links to your social/Wikipedia profiles.

### 4.9 Canonical URL

**What it checks:** A self-referential `<link rel="canonical">` on the homepage pointing to its own origin `/`.

**Why it matters:** Canonical URLs prevent duplicate-content penalties and tell search systems which URL to attribute signals to.

**How to fix:** Add `<link rel="canonical" href="https://yourdomain.com/">` to the homepage `<head>`.

### 4.10 Heading Hierarchy

**What it checks:** Exactly one `<h1>`, at least one `<h2>`, and no heading-level skips in the first 20 headings.

**Why it matters:** Heading structure is a primary signal for how search systems outline your page — bad hierarchy yields bad excerpts.

**How to fix:** Use exactly one `<h1>` per page, follow it with semantic `<h2>` sections, and don't skip levels (no `<h1>` → `<h3>`).

### 4.11 Image Alt Coverage

**What it checks:** At least 80% of `<img>` tags on the homepage have an `alt` attribute (including `alt=""` for decorative images).

**Why it matters:** Alt text is what search systems and AI use to understand images. Missing alt text means the image is invisible to indexing.

**How to fix:** Add descriptive `alt` text to every meaningful image; use `alt=""` for purely decorative ones.

### 4.12 Substantive Content

**What it checks:** The homepage carries at least 300 words of real content after stripping nav, footer, and scripts.

**Why it matters:** Thin pages can't be grounded against. AI systems need substantive prose to extract claims and citations from.

**How to fix:** Add a real description of what your product does, who it's for, and what makes it different — at least 300 words on the homepage.

### 4.13 Structured Data Quality

**What it checks:** At least one JSON-LD block is rich — it has an `@type` and three or more meaningful schema.org properties (`name`, `url`, `description`, `logo`, `sameAs`, etc.).

**Why it matters:** A bare `@type` tells search systems nothing. Rich, typed entities are what produce knowledge-panel and rich-result eligibility.

**How to fix:** Flesh out your primary JSON-LD entity with several real properties, not just `@type` and `name`.

### 4.14 Entity Coverage

**What it checks:** A JSON-LD entity declares `sameAs` links that connect it to the knowledge graph (Wikipedia, Crunchbase, social profiles).

**Why it matters:** `sameAs` links are how search systems reconcile your site with a knowledge-graph entity and attribute answers to you.

**How to fix:** Add a `sameAs` array of authoritative profile URLs to your `Organization`/`WebSite`/`Person` entity.

### 4.15 Content Freshness

**What it checks:** The homepage exposes a machine-readable "last updated" signal — JSON-LD `dateModified`, an `article:modified_time`/`og:updated_time` meta tag, or a `<time datetime>` element.

**Why it matters:** Freshness signals help AI search systems decide whether your content is current enough to ground an answer in.

**How to fix:** Emit `dateModified` in JSON-LD, an `article:modified_time` meta tag, or a `<time datetime>` element reflecting the last update.

---

## Level 5 — Agent-Native (7 checks)

First-class agent support — verified **externally**, like every other level. Each check passes only when **both** are true:

1. **Declared** — the capability is declared in `/.well-known/agent-card.json` (the `capabilities` object), or in your OpenAPI spec for `5.6`.
2. **Probed** — the declared endpoint responds to a live `GET` with an accepted HTTP status.

A timeout, network error, or `429` is reported as `n/a` (never a failure); a capability declared but whose endpoint is broken (e.g. 404) **fails**.

### 5.1 Intent-Based Endpoints

**What it checks:** `capabilities.intentEndpoints[0]` is declared and the first endpoint responds to `GET` with status ∈ `{200, 401, 405, 415}`.

**Why it matters:** CRUD endpoints force agents to compose 5-10 calls for a single user intent. Intent endpoints encode the business action directly.

**How to fix:** Declare `capabilities.intentEndpoints` (list your best one first) and back it with a reachable route.

### 5.2 Agent Sessions

**What it checks:** `capabilities.sessions.endpoint` is declared and responds to `GET` with status ∈ `{200, 401}`.

**Why it matters:** Stateless APIs make agents re-send the entire context on every call. Sessions cap the per-call token cost.

**How to fix:** Declare `capabilities.sessions.endpoint` and serve a session route.

### 5.3 Scoped Agent Tokens

**What it checks:** `capabilities.scopedTokens.{tokenEndpoint, scopes}` (scopes non-empty) is declared and `tokenEndpoint` responds with status ∈ `{200, 401, 405}`. **Fallback:** if not declared, `GET /.well-known/oauth-authorization-server` returns `200` with a non-empty `scopes_supported` array.

**Why it matters:** General-purpose API keys are blunt instruments. Agent-scoped tokens with explicit capabilities let users delegate narrowly.

**How to fix:** Declare `capabilities.scopedTokens`, or publish OAuth authorization-server metadata with `scopes_supported`.

### 5.4 Agent Audit Logs

**What it checks:** `capabilities.auditLog.header` is declared and that correlation header is present (case-insensitive) on the **site root** (`/`) response.

**Why it matters:** Without agent attribution in logs, debugging agent behavior and detecting misuse is nearly impossible.

**How to fix:** Emit the correlation header (e.g. `X-Request-Id`) **site-wide** via server middleware — not only on one API route — and declare `capabilities.auditLog.header`.

### 5.5 Sandbox Environment

**What it checks:** `capabilities.sandbox.baseUrl` (a fully-qualified URL) is declared and responds to `GET` with status ∈ `{200, 401}`.

**Why it matters:** Agents can't safely learn on production. A sandbox lets developers iterate without risk.

**How to fix:** Declare `capabilities.sandbox.baseUrl` and serve a sandbox (a static example response is enough).

### 5.6 Consequence Labels

**What it checks:** At least one operation in your published OpenAPI spec carries `x-consequence`, `x-irreversible`, or `x-side-effects`. (No published OpenAPI → `n/a`, inconclusive.)

**Why it matters:** Agents need to know which actions can't be undone before they commit. Consequence labels feed agent guardrails.

**How to fix:** Annotate consequential or irreversible operations in your OpenAPI spec (e.g. `x-consequence: irreversible`).

### 5.7 Native Tool Schemas

**What it checks:** `capabilities.toolSchemas` (defaults to `/.well-known/skills/index.json` if absent) responds to `GET` with status `200` **and** a body that parses as JSON.

**Why it matters:** When you ship pre-built tool schemas, framework users can drop them in directly instead of hand-translating your OpenAPI spec.

**How to fix:** Publish `/.well-known/skills/index.json` (valid JSON) or declare `capabilities.toolSchemas` pointing to your tool definitions.

---

## Source

- Level 1–4 check definitions: `src/scoring.ts` (`CHECK_DEFINITIONS`)
- Level 1–4 check implementations: `src/scanner.ts`
- Level 5 check definitions: `src/scoring.ts` (`LEVEL5_CHECKS`)
- Level 5 check implementations: `src/deep-checks.ts` (external declaration + live probe)
- Supplementary `--repo` local-source analysis: `src/repo-scanner.ts`
