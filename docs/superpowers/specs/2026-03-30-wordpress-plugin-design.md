# BotVisibility WordPress Plugin — Design Spec

**Date:** 2026-03-30
**Status:** Approved
**Scope:** Standalone self-scanning WordPress plugin for AI agent readiness (L1-L3)

---

## 1. Overview

A WordPress plugin that scans the site it's installed on against all 30 BotVisibility L1-L3 checks, displays results in the WordPress admin matching the botvisibility.com UI, and generates/serves the missing files and services needed to improve the site's AI agent readiness score.

WordPress powers ~77% of websites. This plugin brings BotVisibility's scanning and remediation directly to that audience without requiring them to visit an external site.

### Key Decisions

| Aspect | Decision |
|--------|----------|
| Type | Standalone self-scan (no external site scanning) |
| Scanning | Internal PHP checks (no external API calls) |
| File serving | Hybrid: virtual routes by default, optional static file export |
| OpenAPI | Auto-generated from WP REST API + custom spec override |
| Admin UI | Multi-tab dark-themed UI matching botvisibility.com |
| Checks | All 30 L1-L3 checks ported from TypeScript to PHP |
| Fix capability | Per-check "Fix" buttons + "Fix All" bulk action |
| Compatibility | PHP 7.4+, WordPress 6.0+, multisite-aware |

---

## 2. Plugin Structure

```
botvisibility/
├── botvisibility.php              # Main plugin file (bootstrap, hooks, activation)
├── includes/
│   ├── class-scanner.php          # L1/L2/L3 check logic (port of scanner.ts)
│   ├── class-scoring.php          # Level definitions, scoring algorithm
│   ├── class-file-generator.php   # Generate llms.txt, agent-card.json, ai.json, etc.
│   ├── class-virtual-routes.php   # Rewrite rules for serving generated files
│   ├── class-openapi-generator.php # Auto-generate OpenAPI spec from WP REST API
│   ├── class-admin.php            # Admin pages, tabs, AJAX handlers
│   └── class-meta-tags.php        # Inject AI meta tags and link headers into <head>
├── admin/
│   ├── css/admin.css              # Admin styles (scoped dark theme)
│   ├── js/admin.js                # AJAX scanning, tab navigation, UI interactions
│   └── views/
│       ├── dashboard.php          # Score overview tab
│       ├── level-detail.php       # Reusable L1/L2/L3 detail view
│       ├── file-generator.php     # File generation/management tab
│       └── settings.php           # Plugin settings tab
├── templates/
│   ├── llms-txt.php               # Template for llms.txt generation
│   ├── agent-card.php             # Template for agent-card.json
│   ├── ai-json.php                # Template for ai.json
│   ├── skill-md.php               # Template for skill.md
│   └── skills-index.php           # Template for skills/index.json
└── assets/
    └── logo.svg                   # BotVisibility logo for badge/admin
```

### Conventions

- WordPress coding standards throughout
- All classes prefixed `BotVisibility_`
- Options stored via WordPress Options API (serialized array under `botvisibility_options`)
- Minimum PHP 7.4, WordPress 6.0
- No external dependencies — pure PHP, no Composer

---

## 3. Self-Scanning Architecture

Unlike the Next.js version (which scans remote sites via HTTP), this plugin scans itself from the inside.

### Internal Checks (No HTTP Needed)

These checks use direct filesystem and WordPress API access:

- **File existence**: `file_exists()` for robots.txt, llms.txt, skill.md, etc. in the web root and `.well-known/` directory
- **WP REST API introspection**: `rest_get_server()->get_routes()` for OpenAPI generation and L2/L3 checks
- **Database queries**: Site metadata, post content, plugin settings
- **Theme inspection**: Meta tags and link headers via registered `wp_head` hooks
- **RSS feed**: WordPress always registers feeds — automatic pass for check 1.14

### HTTP Self-Checks (Still Needed)

Some checks require inspecting actual HTTP response headers:

- **CORS headers** (1.6) — `wp_remote_get()` to verify `Access-Control-Allow-Origin`
- **Rate limit headers** (3.5) — inspect response for `X-RateLimit-*` headers
- **Caching headers** (3.6) — inspect `ETag`, `Cache-Control`, `Last-Modified`
- **Structured error responses** (2.7) — probe a non-existent endpoint
- **Page token efficiency** (1.13) — fetch rendered homepage HTML and analyze token ratio

### Scanner Class

```php
class BotVisibility_Scanner {
    // Internal checks — fast, no network
    private function check_llms_txt()           // file_exists + content validation
    private function check_agent_card()         // file_exists + JSON decode
    private function check_robots_txt()         // file_exists + parse AI directives
    private function check_openapi_spec()       // check generated or uploaded spec
    private function check_ai_meta_tags()       // inspect registered wp_head hooks
    private function check_link_headers()       // inspect registered wp_head hooks
    private function check_rss_feed()           // WP always has feeds — auto-pass
    private function check_skill_file()         // file_exists + YAML frontmatter
    private function check_ai_json()            // file_exists + JSON structure
    private function check_skills_index()       // file_exists + JSON array
    private function check_mcp_server()         // file_exists for mcp.json

    // HTTP self-checks — hit own URLs via wp_remote_get()
    private function check_cors_headers()
    private function check_rate_limits()
    private function check_caching_headers()
    private function check_structured_errors()
    private function check_token_efficiency()

    // WP REST API analysis (for L2/L3)
    private function analyze_rest_api()         // introspect registered routes
    private function check_api_read_ops()       // GET endpoints exist
    private function check_api_write_ops()      // POST/PUT/PATCH/DELETE exist
    private function check_api_primary_action()
    private function check_api_key_auth()       // Application Passwords
    private function check_scoped_keys()        // OAuth2 scopes from capabilities
    private function check_openid_config()
    private function check_async_ops()
    private function check_idempotency()
    private function check_sparse_fields()      // ?_fields= parameter
    private function check_cursor_pagination()  // ?page= parameter
    private function check_search_filtering()   // ?search= parameter
    private function check_bulk_operations()
    private function check_mcp_tool_quality()
}
```

### Scanning Flow

1. Admin clicks "Scan Now"
2. AJAX request to `admin-ajax.php` with nonce
3. Scanner runs internal checks first (instant), then HTTP self-checks
4. Results returned as JSON, displayed progressively in admin UI
5. Results cached as WordPress transient (1 hour default, re-scannable anytime)

---

## 4. Check Definitions (L1-L3)

### L1: Discoverable (14 checks)

| ID | Check | Scanner Method | Fixable |
|----|-------|---------------|---------|
| 1.1 | llms.txt | File exists + markdown validation | Yes — auto-generate from site content |
| 1.2 | Agent Card | `.well-known/agent-card.json` exists + JSON validation | Yes — auto-generate from site metadata |
| 1.3 | OpenAPI Spec | Check generated/uploaded spec | Yes — auto-generate from WP REST API |
| 1.4 | robots.txt AI Policy | Parse for AI crawler directives | Yes — append AI-friendly directives |
| 1.5 | Documentation Accessibility | JSON-LD with potentialAction | Yes — inject JSON-LD via wp_head |
| 1.6 | CORS Headers | HTTP self-check for Access-Control-Allow-Origin | Yes — add CORS headers to REST API |
| 1.7 | AI Meta Tags | Inspect registered wp_head hooks | Yes — inject meta tags |
| 1.8 | Skill File | `/skill.md` exists + YAML frontmatter | Yes — auto-generate |
| 1.9 | AI Site Profile | `.well-known/ai.json` exists + structure | Yes — auto-generate |
| 1.10 | Skills Index | `.well-known/skills/index.json` exists | Yes — auto-generate |
| 1.11 | Link Headers | HTML `<link>` elements for discovery files | Yes — inject via wp_head |
| 1.12 | MCP Server | `.well-known/mcp.json` exists | Yes — generate MCP manifest |
| 1.13 | Page Token Efficiency | Fetch homepage, analyze token ratio | Partial — guidance only |
| 1.14 | RSS/Atom Feed | Feed exists | Auto-pass (WordPress built-in) |

### L2: Usable (9 checks)

| ID | Check | Scanner Method | Fixable |
|----|-------|---------------|---------|
| 2.1 | API Read Operations | GET endpoints in OpenAPI spec | Auto-pass (WP REST API) |
| 2.2 | API Write Operations | POST/PUT/PATCH/DELETE in spec | Auto-pass (WP REST API) |
| 2.3 | API Primary Action | Non-GET endpoints exist | Auto-pass (WP REST API) |
| 2.4 | API Key Authentication | Application Passwords in spec | Auto-pass (WP 5.6+) |
| 2.5 | Scoped API Keys | OAuth2 scopes in spec | Yes — map WP capabilities to scopes |
| 2.6 | OpenID Configuration | `.well-known/openid-configuration` | Yes — generate OIDC doc |
| 2.7 | Structured Error Responses | Probe bad endpoint | Auto-pass (WP REST returns JSON errors) |
| 2.8 | Async Operations | Callbacks/webhooks in spec | Partial — depends on site functionality |
| 2.9 | Idempotency Support | Idempotency-Key header | Yes — add middleware |

### L3: Optimized (7 checks)

| ID | Check | Scanner Method | Fixable |
|----|-------|---------------|---------|
| 3.1 | Sparse Fields | `fields` parameter in spec | Auto-pass (WP `?_fields=`) |
| 3.2 | Cursor Pagination | cursor/page_token parameters | Partial (WP uses `?page=`, not cursor) |
| 3.3 | Search & Filtering | search/filter parameters | Auto-pass (WP `?search=`) |
| 3.4 | Bulk Operations | Batch endpoints | Partial — WP has `/batch/v1` but not all endpoints |
| 3.5 | Rate Limit Headers | X-RateLimit-* headers | Yes — add rate limit headers |
| 3.6 | Caching Headers | ETag, Cache-Control | Yes — add caching headers |
| 3.7 | MCP Tool Quality | Tool definitions with input schemas | Yes — generate quality tool definitions |

### WordPress Advantages (Auto-Pass Checks)

WordPress sites get several checks for free:
- **1.14** RSS/Atom Feed — built-in
- **2.1** API Read Ops — WP REST API
- **2.2** API Write Ops — WP REST API
- **2.3** API Primary Action — WP REST API
- **2.4** API Key Auth — Application Passwords (WP 5.6+)
- **2.7** Structured Errors — WP REST returns JSON errors
- **3.1** Sparse Fields — `?_fields=` parameter
- **3.3** Search & Filtering — `?search=` parameter

That's **8 of 30 checks passing with zero configuration** on a stock WordPress install.

---

## 5. File Generation

### Files the Plugin Auto-Generates

| File | Virtual Route | Source Data |
|------|--------------|-------------|
| `/llms.txt` | `^llms\.txt$` | Site title, tagline, key pages, post types |
| `/.well-known/agent-card.json` | `^\.well-known/agent-card\.json$` | Site metadata, REST API info, capabilities |
| `/.well-known/ai.json` | `^\.well-known/ai\.json$` | Site name, capabilities, skill links |
| `/.well-known/skills/index.json` | `^\.well-known/skills/index\.json$` | Skill catalog (user-editable) |
| `/skill.md` | `^skill\.md$` | YAML frontmatter + site workflows |
| `/openapi.json` | `^openapi\.json$` | WP REST API route introspection |
| `/.well-known/mcp.json` | `^\.well-known/mcp\.json$` | MCP manifest from REST API tools |
| `/.well-known/openid-configuration` | `^\.well-known/openid-configuration$` | WP auth settings (if applicable) |

### Virtual Route System

```php
class BotVisibility_Virtual_Routes {
    public function register_rewrite_rules() {
        // .well-known/* routes
        add_rewrite_rule('^\.well-known/agent-card\.json$', 'index.php?botvis_file=agent-card', 'top');
        add_rewrite_rule('^\.well-known/ai\.json$', 'index.php?botvis_file=ai-json', 'top');
        add_rewrite_rule('^\.well-known/skills/index\.json$', 'index.php?botvis_file=skills-index', 'top');
        add_rewrite_rule('^\.well-known/mcp\.json$', 'index.php?botvis_file=mcp', 'top');
        add_rewrite_rule('^\.well-known/openid-configuration$', 'index.php?botvis_file=openid', 'top');

        // Root-level files
        add_rewrite_rule('^llms\.txt$', 'index.php?botvis_file=llms-txt', 'top');
        add_rewrite_rule('^skill\.md$', 'index.php?botvis_file=skill-md', 'top');
        add_rewrite_rule('^openapi\.json$', 'index.php?botvis_file=openapi', 'top');
    }

    public function handle_request() {
        // Intercept matched query var, set correct Content-Type, output generated content
        // Falls through to static file if user exported one
    }
}
```

### Static Export

- Admin button: "Export to Static Files"
- Writes physical files to web root and `.well-known/` directory
- Shows warnings if directory isn't writable
- Tracks which files are static vs virtual for cleanup on deactivation

### Content Editing

Each generated file has a corresponding settings field where users can customize the output. Auto-generated content is the starting point, not the final word.

### Meta Tags & Link Headers

Injected into `<head>` via `wp_head` hook:

```html
<meta name="llms:description" content="{site tagline}" />
<meta name="llms:url" content="/llms.txt" />
<meta name="llms:instructions" content="/skill.md" />
<link rel="alternate" type="text/plain" href="/llms.txt" title="LLMs.txt" />
<link rel="alternate" type="application/json" href="/.well-known/ai.json" title="AI Profile" />
<link rel="alternate" type="application/json" href="/.well-known/agent-card.json" title="Agent Card" />
```

---

## 6. OpenAPI Auto-Generation

### How It Works

```php
class BotVisibility_OpenAPI_Generator {
    public function generate() {
        $routes = rest_get_server()->get_routes();
        // Introspect each route's methods, args, schema
        // Build OpenAPI 3.0 paths, parameters, responses
    }
}
```

### What WordPress REST API Provides

- `GET /wp-json/wp/v2/posts` — read operations
- `POST /wp-json/wp/v2/posts` — write operations
- `DELETE /wp-json/wp/v2/posts/{id}` — destructive operations
- Application Passwords (WP 5.6+) — API key authentication
- `?_fields=id,title` — sparse field selection
- `?page=` — pagination
- `?search=` — search/filtering
- JSON error responses — structured errors

### What the Plugin Adds

- OAuth2 scope mapping from WP capabilities — L2 scoped keys (2.5)
- Rate limit header middleware — L3 rate limits (3.5)
- ETag/Cache-Control header middleware — L3 caching (3.6)
- Idempotency-Key header support — L2 idempotency (2.9)

### Generated Spec Contents

- All public REST routes (core + custom post types + plugin-registered routes)
- Parameter descriptions from `register_rest_route()` args
- Response schemas from registered schema callbacks
- Authentication schemes (Application Passwords, cookie auth)
- Filterable via `botvisibility_openapi_spec` filter hook

### Custom Override

If the user uploads a custom `openapi.json`, it takes precedence. The auto-generated spec is always available as a fallback or starting point to export and edit.

---

## 7. Admin UI

### Menu Structure

Top-level admin menu item "BotVisibility" with 4 tabs: Dashboard, Scan Results, File Manager, Settings.

### Visual Design — Matching botvisibility.com

The admin UI ports the dark-themed UI from botvisibility.com into a scoped container inside the WordPress admin:

- **Dark surfaces** (`#0a0a0a`, `#111`) with subtle borders, rendered inside `<div class="botvisibility-admin">` to scope styles
- **Gradient thermometer bar** — continuous red-amber-green-blue progress bar with animated fill and white needle
- **Score display** — large mono-font `18/30` with rainbow gradient text + "checks passed" label
- **Level badge** with color coding matching `LEVELS[].color` (L1 red, L2 amber, L3 green)
- **Check result cards** — expandable items with status icons (green check / red X / amber warning / gray question), animated slide-in
- **Agent Tax card** — gradient-bordered card showing token waste ratio with `Nx overhead` display
- **Confetti animation** on achieving a new level

CSS uses custom properties matching the site's design tokens (`--surface-1`, `--text-inverse`, `--text-tertiary`). Phosphor icons replaced with inline SVGs (same visual, no React dependency).

### Tab 1: Dashboard

- Score ring/gauge showing current level (L1/L2/L3) and pass rate
- Level progress bars — one per level showing X/14, X/9, X/7
- "Scan Now" button, "Fix All" button (generates all missing files at once)
- Last scanned timestamp
- Agent Tax card (token waste analysis of homepage)
- Badge embed code — copyable HTML snippet

### Tab 2: Scan Results (L1 / L2 / L3 sub-tabs)

- Each check listed with status icon (pass/fail/partial/na)
- Expandable details: what was found, what's expected, token savings estimate
- Per-check "Fix" button — generates the specific missing file or enables the feature
- Check IDs and descriptions match the main BotVisibility project (1.1-3.7)

### Tab 3: File Manager

- Table of all generatable files: File, Status (active/inactive/static/virtual), Actions
- Per-file: Preview, Edit Content, Enable/Disable, Export to Static
- Bulk actions: Enable All, Export All to Static, Reset to Defaults
- robots.txt editor — append AI-friendly directives (never overwrites existing rules)

### Tab 4: Settings

- **Site Description** — used in llms.txt and agent-card.json (pre-filled from tagline)
- **Capabilities** — checkboxes for what the site offers (content, API, e-commerce, etc.)
- **robots.txt AI Policy** — toggle to allow/block specific AI crawlers
- **CORS** — toggle to add CORS headers to REST API responses
- **Cache headers** — toggle to add ETag/Cache-Control
- **Rate limit headers** — toggle to add X-RateLimit-* headers
- **Auto-scan schedule** — daily/weekly background scan via WP-Cron with admin notification on score changes
- **Static export path** — customize where exported files go

All settings use WordPress Settings API with nonces and `manage_options` capability checks.

---

## 8. Lifecycle & Security

### Activation

1. Flush rewrite rules (registers virtual routes)
2. Create default options with sensible defaults
3. Run initial self-scan, cache results as transient
4. Capability check: `manage_options` for all admin pages

### Deactivation

1. Remove rewrite rules
2. Optionally clean up static exported files (user setting)
3. Preserve options in database for re-activation

### Uninstall (Delete)

1. Remove all options from `wp_options`
2. Delete any static exported files
3. Clean uninstall — no traces left

### Security

- All AJAX handlers verify `current_user_can('manage_options')` + nonce
- Generated files contain no sensitive data (site metadata only)
- robots.txt modifications are additive only
- OpenAPI spec only exposes public routes (respects `permission_callback`)
- No external API calls — all scanning is local
- All user inputs sanitized, all outputs escaped
- No Composer dependencies — no supply chain risk

### Compatibility

- PHP 7.4+
- WordPress 6.0+
- Multisite compatible (per-site activation)
- No external dependencies

---

## 9. Scoring Algorithm

Ported directly from `src/lib/scoring.ts`:

- **L1 achieved**: L1 pass rate >= 50%
- **L2 achieved**: (L1 >= 50% AND L2 >= 50%) OR (L1 >= 35% AND L2 >= 75%)
- **L3 achieved**: (L2 achieved AND L3 >= 50%) OR (L2 >= 35% AND L3 >= 75%)

Weighted cross-level scoring rewards sites that invest in higher-level capabilities even if some lower-level items are missing.

---

## 10. WordPress Filter Hooks (Extensibility)

The plugin provides filter hooks for theme/plugin developers:

- `botvisibility_openapi_spec` — modify the auto-generated OpenAPI spec
- `botvisibility_llms_txt` — modify llms.txt content before serving
- `botvisibility_agent_card` — modify agent-card.json content
- `botvisibility_ai_json` — modify ai.json content
- `botvisibility_skill_md` — modify skill.md content
- `botvisibility_scan_results` — modify scan results before display
- `botvisibility_check_result_{check_id}` — override individual check results
