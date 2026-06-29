import { CheckResult, Level, LevelProgress, Level5Check, ScoreSummary } from './types.js';

// 5-level scoring model. All levels are verified externally (live URL scan);
// L5 (Agent-Native) = a machine-readable declaration + a live endpoint probe.
// Ported from the botvisibility.com source of truth so CLI and web scores match.
export const LEVELS: Level[] = [
  {
    number: 1,
    name: 'Discoverable',
    color: '#ef4444',
    description: 'Bots can find you. Your site exposes the metadata and machine-readable files that let AI agents know you exist.',
  },
  {
    number: 2,
    name: 'Usable',
    color: '#f59e0b',
    description: 'Your API works for agents. Authentication, error handling, and core operations are agent-compatible.',
  },
  {
    number: 3,
    name: 'Optimized',
    color: '#22c55e',
    description: 'Agents can work efficiently. Pagination, filtering, and caching reduce token waste and round-trips.',
  },
  {
    number: 4,
    name: 'Indexable',
    color: '#8b5cf6',
    description: 'AI search systems can find, index, and ground answers in this site. Crawl access, page experience, structured data, and content quality are in place.',
  },
  {
    number: 5,
    name: 'Agent-Native',
    color: '#059AFA',
    description: 'First-class agent support. Intent endpoints, sessions, scoped tokens, and tool schemas treat agents as primary consumers.',
  },
];

// 51 Level 1–4 check definitions (the 7 Level-5 checks live in LEVEL5_CHECKS; 58 total)
export const CHECK_DEFINITIONS = [
  // Level 1: Discoverable (18)
  { id: '1.1', name: 'llms.txt', level: 1 as const, category: 'Discoverable', description: 'A /.well-known/llms.txt or /llms.txt file exists with machine-readable site information.' },
  { id: '1.2', name: 'Agent Card', level: 1 as const, category: 'Discoverable', description: 'An agent card (/.well-known/agent.json or similar) describes capabilities for AI agents.' },
  { id: '1.3', name: 'OpenAPI Spec', level: 1 as const, category: 'Discoverable', description: 'An OpenAPI/Swagger specification is publicly accessible.' },
  { id: '1.4', name: 'robots.txt AI Policy', level: 1 as const, category: 'Discoverable', description: 'robots.txt includes directives for AI crawlers and agents.' },
  { id: '1.5', name: 'Documentation Accessibility', level: 1 as const, category: 'Discoverable', description: 'Developer documentation is publicly accessible without authentication.' },
  { id: '1.6', name: 'CORS Headers', level: 1 as const, category: 'Discoverable', description: 'CORS headers allow cross-origin API access for browser-based agents.' },
  { id: '1.7', name: 'AI Meta Tags', level: 1 as const, category: 'Discoverable', description: 'HTML meta tags (llms:description, llms:url, llms:instructions) help AI agents discover site capabilities.' },
  { id: '1.8', name: 'Skill File', level: 1 as const, category: 'Discoverable', description: 'A /skill.md file provides structured agent instructions with YAML frontmatter.' },
  { id: '1.9', name: 'AI Site Profile', level: 1 as const, category: 'Discoverable', description: 'A /.well-known/ai.json file describes the site name, capabilities, and skill links for agents.' },
  { id: '1.10', name: 'Skills Index', level: 1 as const, category: 'Discoverable', description: 'A /.well-known/skills/index.json file lists all available agent skills with id and name.' },
  { id: '1.11', name: 'Link Headers', level: 1 as const, category: 'Discoverable', description: 'HTML <link> elements in <head> point to llms.txt, ai.json, or agent-card.json for discovery.' },
  { id: '1.12', name: 'MCP Server', level: 1 as const, category: 'Discoverable', description: 'A Model Context Protocol (MCP) server endpoint is discoverable at /.well-known/mcp.json or /mcp.' },
  { id: '1.13', name: 'Page Token Efficiency', level: 1 as const, category: 'Discoverable', description: 'The homepage HTML is token-efficient — LLMs can extract useful content without excessive overhead from scripts, styles, and boilerplate.' },
  { id: '1.14', name: 'RSS/Atom Feed', level: 1 as const, category: 'Discoverable', description: 'An RSS or Atom feed is available, providing structured content that agents can consume without parsing HTML.' },
  { id: '1.15', name: 'Content Signals', level: 1 as const, category: 'Discoverable', description: 'robots.txt declares AI content usage preferences via a Content-Signal directive (ai-train, search, ai-input) — see contentsignals.org.' },
  { id: '1.16', name: 'API Catalog', level: 1 as const, category: 'Discoverable', description: 'A /.well-known/api-catalog endpoint returns an RFC 9727 linkset pointing to service-desc, service-doc, and status for each API.' },
  { id: '1.17', name: 'Markdown for Agents', level: 1 as const, category: 'Discoverable', description: 'Requests with Accept: text/markdown return a markdown rendering of the page, so agents skip HTML overhead.' },
  { id: '1.18', name: 'WebMCP', level: 1 as const, category: 'Discoverable', description: 'The homepage calls navigator.modelContext.provideContext() to expose in-browser tools to AI agents (WebMCP).' },

  // Level 2: Usable (11)
  { id: '2.1', name: 'API Read Operations', level: 2 as const, category: 'Usable', description: 'Read operations (list, get, search) are available via API.' },
  { id: '2.2', name: 'API Write Operations', level: 2 as const, category: 'Usable', description: 'Write operations (create, update, delete) are available via API.' },
  { id: '2.3', name: 'API Primary Action', level: 2 as const, category: 'Usable', description: 'The primary value action of the app is available via API.' },
  { id: '2.4', name: 'API Key Authentication', level: 2 as const, category: 'Usable', description: 'API key authentication is supported, not only OAuth browser flows.' },
  { id: '2.5', name: 'Scoped API Keys', level: 2 as const, category: 'Usable', description: 'API keys can be scoped to specific permissions.' },
  { id: '2.6', name: 'OpenID Configuration', level: 2 as const, category: 'Usable', description: 'An OpenID Connect discovery document is available.' },
  { id: '2.7', name: 'Structured Error Responses', level: 2 as const, category: 'Usable', description: 'All API errors return structured JSON with error codes.' },
  { id: '2.8', name: 'Async Operations', level: 2 as const, category: 'Usable', description: 'Long-running operations return a job ID with pollable status.' },
  { id: '2.9', name: 'Idempotency Support', level: 2 as const, category: 'Usable', description: 'Write endpoints support idempotency keys to prevent duplicate operations.' },
  { id: '2.10', name: 'OAuth Protected Resource', level: 2 as const, category: 'Usable', description: 'A /.well-known/oauth-protected-resource document advertises authorization servers and scopes so agents can obtain tokens (RFC 9728).' },
  { id: '2.11', name: 'x402 Payments', level: 2 as const, category: 'Usable', description: 'API endpoints support the x402 agent-native payment protocol — a protected route returns HTTP 402 with machine-readable payment requirements.' },

  // Level 3: Optimized (7)
  { id: '3.1', name: 'Sparse Fields', level: 3 as const, category: 'Optimized', description: 'A fields or select parameter exists to request only needed fields.' },
  { id: '3.2', name: 'Cursor Pagination', level: 3 as const, category: 'Optimized', description: 'List endpoints use cursor-based pagination.' },
  { id: '3.3', name: 'Search & Filtering', level: 3 as const, category: 'Optimized', description: 'Resources can be filtered by common attributes.' },
  { id: '3.4', name: 'Bulk Operations', level: 3 as const, category: 'Optimized', description: 'Batch create/update/delete endpoints exist.' },
  { id: '3.5', name: 'Rate Limit Headers', level: 3 as const, category: 'Optimized', description: 'Responses include rate limit headers (X-RateLimit-* or similar).' },
  { id: '3.6', name: 'Caching Headers', level: 3 as const, category: 'Optimized', description: 'Responses include caching headers (ETag, Cache-Control, Last-Modified).' },
  { id: '3.7', name: 'MCP Tool Quality', level: 3 as const, category: 'Optimized', description: 'MCP server exposes well-described tools and resources with input schemas for agent use.' },

  // Level 4: Indexable (15)
  { id: '4.1', name: 'Googlebot Allowed', level: 4 as const, category: 'Indexable', description: 'robots.txt does not Disallow / for Googlebot or all user agents — required for AI search indexing.' },
  { id: '4.2', name: 'Google-Extended Policy', level: 4 as const, category: 'Indexable', description: 'robots.txt has an explicit User-agent: Google-Extended block stating an AI training/grounding policy.' },
  { id: '4.3', name: 'Homepage Indexable', level: 4 as const, category: 'Indexable', description: 'Homepage has no noindex meta tag or X-Robots-Tag: noindex header — eligible for the search index.' },
  { id: '4.4', name: 'Sitemap Present', level: 4 as const, category: 'Indexable', description: 'A reachable sitemap.xml exists and is referenced from robots.txt — helps AI search systems discover all pages.' },
  { id: '4.5', name: 'HTTPS', level: 4 as const, category: 'Indexable', description: 'Origin serves over https; http requests redirect to https.' },
  { id: '4.6', name: 'Mobile Viewport', level: 4 as const, category: 'Indexable', description: 'Homepage declares a mobile-friendly viewport meta tag with width=device-width.' },
  { id: '4.7', name: 'JSON-LD Present', level: 4 as const, category: 'Indexable', description: 'Homepage includes at least one valid JSON-LD script block — required substrate for rich results and AI grounding.' },
  { id: '4.8', name: 'Entity Schema', level: 4 as const, category: 'Indexable', description: 'JSON-LD declares the site/business entity via @type: Organization, WebSite, or LocalBusiness.' },
  { id: '4.9', name: 'Canonical URL', level: 4 as const, category: 'Indexable', description: 'Homepage has a self-referential <link rel="canonical"> tag pointing to its own origin.' },
  { id: '4.10', name: 'Heading Hierarchy', level: 4 as const, category: 'Indexable', description: 'Page has exactly one h1, at least one h2, and no heading-level skips in the first 20 headings.' },
  { id: '4.11', name: 'Image Alt Coverage', level: 4 as const, category: 'Indexable', description: '80% or more of <img> tags on the homepage have alt attributes (alt="" for decorative counts).' },
  { id: '4.12', name: 'Substantive Content', level: 4 as const, category: 'Indexable', description: 'Homepage main content is at least 300 words after stripping nav, footer, and scripts.' },
  { id: '4.13', name: 'Structured Data Quality', level: 4 as const, category: 'Indexable', description: 'At least one JSON-LD block is rich — it has an @type and three or more meaningful schema.org properties (name, url, description, logo, sameAs, etc.).' },
  { id: '4.14', name: 'Entity Coverage', level: 4 as const, category: 'Indexable', description: 'A JSON-LD entity (Organization, WebSite, Person, etc.) declares sameAs links that connect it to Google\'s knowledge graph.' },
  { id: '4.15', name: 'Content Freshness', level: 4 as const, category: 'Indexable', description: 'The homepage exposes a machine-readable freshness signal — JSON-LD dateModified, an article:modified_time / og:updated_time meta tag, or a <time datetime> element.' },
];

// Single source of truth for Level-5 probe ids (Agent-Native).
// Code-side call-sites import these names rather than hardcoding string
// literals, so renumbering LEVEL5_CHECKS only requires updating one place.
export const LEVEL_5_IDS = {
  INTENT: '5.1',
  SESSIONS: '5.2',
  SCOPED_TOKENS: '5.3',
  AUDIT_LOGS: '5.4',
  SANDBOX: '5.5',
  CONSEQUENCE: '5.6',
  TOOL_SCHEMAS: '5.7',
} as const;

// 7 Level-5 checks (Agent-Native — externally scanned: declaration + live probe)
export const LEVEL5_CHECKS: Level5Check[] = [
  {
    id: LEVEL_5_IDS.INTENT,
    name: 'Intent-Based Endpoints',
    level: 5,
    category: 'Agent-Native',
    description: 'High-level "intent" endpoints exist alongside CRUD (e.g., /send-invoice instead of multiple calls).',
  },
  {
    id: LEVEL_5_IDS.SESSIONS,
    name: 'Agent Sessions',
    level: 5,
    category: 'Agent-Native',
    description: 'Agents can create persistent sessions with context that survives across requests.',
  },
  {
    id: LEVEL_5_IDS.SCOPED_TOKENS,
    name: 'Scoped Agent Tokens',
    level: 5,
    category: 'Agent-Native',
    description: 'Agent-specific tokens with hard capability limits and expiration.',
  },
  {
    id: LEVEL_5_IDS.AUDIT_LOGS,
    name: 'Agent Audit Logs',
    level: 5,
    category: 'Agent-Native',
    description: 'API actions are logged with agent identifiers for traceability.',
  },
  {
    id: LEVEL_5_IDS.SANDBOX,
    name: 'Sandbox Environment',
    level: 5,
    category: 'Agent-Native',
    description: 'A sandbox environment exists for agent testing without real side effects.',
  },
  {
    id: LEVEL_5_IDS.CONSEQUENCE,
    name: 'Consequence Labels',
    level: 5,
    category: 'Agent-Native',
    description: 'Documentation and API metadata mark consequential or irreversible actions.',
  },
  {
    id: LEVEL_5_IDS.TOOL_SCHEMAS,
    name: 'Native Tool Schemas',
    level: 5,
    category: 'Agent-Native',
    description: 'Core API actions are packaged as ready-to-use tool definitions for agent frameworks.',
  },
];

// Scoring version emitted in scan output (matches the web scan).
export const SCORING_VERSION = '2';

/**
 * Groups checks by level, counts pass/fail/na, and determines if each level is complete.
 * A level is complete when all applicable (non-na) checks pass.
 */
export function calculateLevelProgress(checks: CheckResult[]): LevelProgress[] {
  return LEVELS.map((level) => {
    const levelChecks = checks.filter((c) => c.level === level.number);
    const passed = levelChecks.filter((c) => c.status === 'pass').length;
    const na = levelChecks.filter((c) => c.status === 'na').length;
    const total = levelChecks.length;
    const failed = total - passed - na; // includes 'fail' and 'partial'
    const applicable = total - na;
    const complete = applicable > 0 && passed === applicable;
    return { level, passed, failed, na, total, complete };
  });
}

/**
 * Returns the highest achieved level (0 if none) using a weighted cross-level algorithm.
 *
 * Rather than requiring 100% of each level in strict order, this rewards sites
 * that invest in higher-level capabilities even if some lower-level items are missing.
 *
 * Algorithm:
 *   - A level's "rate" = passed / applicable (ignoring N/A checks)
 *   - L1 (Discoverable): achieved when L1 rate >= 50%
 *   - L2 (Usable):       achieved when L1 rate >= 50% AND L2 rate >= 50%,
 *                         OR when L1 rate >= 35% AND L2 rate >= 75%
 *   - L3 (Optimized):    achieved when L2 achieved AND L3 rate >= 50%,
 *                         OR when L2 rate >= 35% AND L3 rate >= 75%
 *   - L4 (Indexable):    achieved when L3 achieved AND L4 rate >= 50%,
 *                         OR when L3 rate >= 35% AND L4 rate >= 75%
 *   - L5 (Agent-Native): achieved when L4 achieved AND L5 rate >= 50%,
 *                         OR when L4 rate >= 35% AND L5 rate >= 75%
 *
 * L5 (Agent-Native) is verified externally (declaration + live probe), so this
 * function can return 5 when those checks pass.
 */
export function getCurrentLevel(levelProgress: LevelProgress[]): number {
  const rate = (lp: LevelProgress | undefined): number => {
    if (!lp) return 0;
    const applicable = lp.total - lp.na;
    return applicable > 0 ? lp.passed / applicable : 0;
  };

  const l1 = levelProgress.find((lp) => lp.level.number === 1);
  const l2 = levelProgress.find((lp) => lp.level.number === 2);
  const l3 = levelProgress.find((lp) => lp.level.number === 3);
  const l4 = levelProgress.find((lp) => lp.level.number === 4);
  const l5 = levelProgress.find((lp) => lp.level.number === 5);

  const r1 = rate(l1);
  const r2 = rate(l2);
  const r3 = rate(l3);
  const r4 = rate(l4);
  const r5 = rate(l5);

  const l2Achieved =
    (r1 >= 0.50 && r2 >= 0.50) ||
    (r1 >= 0.35 && r2 >= 0.75);
  const l3Achieved =
    (l2Achieved && r3 >= 0.50) ||
    (r2 >= 0.35 && r3 >= 0.75);
  const l4Achieved =
    (l3Achieved && r4 >= 0.50) ||
    (r3 >= 0.35 && r4 >= 0.75);
  const l5Achieved =
    (l4Achieved && r5 >= 0.50) ||
    (r4 >= 0.35 && r5 >= 0.75);

  if (l5Achieved) return 5;
  if (l4Achieved) return 4;
  if (l3Achieved) return 3;
  if (l2Achieved) return 2;
  if (r1 >= 0.50) return 1;

  return 0;
}

// Human-readable name for an achieved level (0 = not yet at Level 1).
export function levelName(level: number): string {
  if (level <= 0) return 'Getting Started';
  return LEVELS.find((l) => l.number === level)?.name ?? 'Getting Started';
}

/**
 * Letter-style grade for the overall scan, derived from the share of applicable
 * (non-N/A) checks that pass.
 *
 * NOTE: only `perfect` and `needs-work` are observable from the public web API,
 * so the intermediate tiers/thresholds here are a best-effort match. If the
 * canonical grade ladder differs, update this single function.
 */
export function calculateGrade(passed: number, failed: number, partial: number, applicable: number): string {
  if (applicable <= 0) return 'needs-work';
  if (failed === 0 && partial === 0) return 'perfect';
  const ratio = passed / applicable;
  if (ratio >= 0.9) return 'excellent';
  if (ratio >= 0.7) return 'good';
  if (ratio >= 0.5) return 'fair';
  return 'needs-work';
}

/**
 * Builds the aggregate score summary that matches the web scan output shape.
 * Computed from the canonical 58 checks only.
 */
export function computeScore(checks: CheckResult[], levelProgress: LevelProgress[], currentLevel: number): ScoreSummary {
  const count = (status: CheckResult['status']) => checks.filter((c) => c.status === status).length;
  const passed = count('pass');
  const failed = count('fail');
  const partial = count('partial');
  const na = count('na');
  const total = checks.length;
  const applicable = total - na;

  const l4 = levelProgress.find((lp) => lp.level.number === 4);
  const l4Checks = checks.filter((c) => c.level === 4);
  const indexable = {
    passed: l4Checks.filter((c) => c.status === 'pass').length,
    failed: l4Checks.filter((c) => c.status === 'fail').length,
    partial: l4Checks.filter((c) => c.status === 'partial').length,
    na: l4Checks.filter((c) => c.status === 'na').length,
    total: l4?.total ?? l4Checks.length,
  };

  return {
    passed,
    failed,
    partial,
    na,
    total,
    level: currentLevel,
    levelName: levelName(currentLevel),
    grade: calculateGrade(passed, failed, partial, applicable),
    indexable,
  };
}
