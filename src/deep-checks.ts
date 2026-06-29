// Level 5 (Agent-Native) checks — verified EXTERNALLY.
//
// Each check passes only if BOTH are true:
//   1. Declared  — the capability is declared in a machine-discoverable manifest
//                  (the `capabilities` object in /.well-known/agent-card.json, or
//                  OpenAPI for 5.6).
//   2. Probed    — the declared endpoint responds to an external GET with an
//                  accepted HTTP status.
//
// Result semantics:
//   - pass = declared AND the probe returns an accepted status.
//   - fail = not declared, OR declared but the probe returns a status outside
//            the accepted set (a declared-but-broken endpoint fails).
//   - na   = the probe could not complete (network error, timeout, or HTTP 429).
//            Never counted as a failure.
//
// All probes are server-side GET requests (no CORS concerns). Declared paths are
// resolved against the site origin; a fully-qualified URL is used as-is.

import { CheckResult } from './types.js';
import type { ParsedOpenApiSpec } from './scanner.js';
import { LEVEL5_CHECKS, LEVEL_5_IDS } from './scoring.js';

const PROBE_TIMEOUT = 10000;

const META = Object.fromEntries(LEVEL5_CHECKS.map((c) => [c.id, c]));

// --- probe primitives -------------------------------------------------------

type ProbeResult =
  | { kind: 'response'; status: number; headers: Headers }
  | { kind: 'indeterminate' }; // network error, timeout, or 429 — never a fail

async function probe(url: string): Promise<ProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    if (res.status === 429) return { kind: 'indeterminate' };
    return { kind: 'response', status: res.status, headers: res.headers };
  } catch {
    return { kind: 'indeterminate' };
  } finally {
    clearTimeout(timeout);
  }
}

// Probe that also returns the body text (used by 5.7 to verify JSON parses).
async function probeBody(url: string): Promise<(ProbeResult & { kind: 'response'; body: string }) | { kind: 'indeterminate' }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    if (res.status === 429) return { kind: 'indeterminate' };
    const body = await res.text();
    return { kind: 'response', status: res.status, headers: res.headers, body };
  } catch {
    return { kind: 'indeterminate' };
  } finally {
    clearTimeout(timeout);
  }
}

function resolve(pathOrUrl: string, origin: string): string | null {
  try {
    return new URL(pathOrUrl, origin).toString();
  } catch {
    return null;
  }
}

// --- result builders --------------------------------------------------------

function base(id: string): Pick<CheckResult, 'id' | 'name' | 'level' | 'category' | 'autoDetectable'> {
  const m = META[id];
  return {
    id,
    name: m?.name ?? id,
    level: 5,
    category: 'Agent-Native',
    autoDetectable: false, // verified by live probe, not static inspection
  };
}

function pass(id: string, message: string, details?: string): CheckResult {
  return { ...base(id), passed: true, status: 'pass', message, ...(details ? { details } : {}) };
}

function fail(id: string, message: string, recommendation?: string, details?: string): CheckResult {
  return {
    ...base(id),
    passed: false,
    status: 'fail',
    message,
    ...(recommendation ? { recommendation } : {}),
    ...(details ? { details } : {}),
  };
}

// Indeterminate probe — not a failure (network error / timeout / 429).
function na(id: string, message: string): CheckResult {
  return { ...base(id), passed: false, status: 'na', message };
}

const accepted = (status: number, set: number[]) => set.includes(status);

// --- agent-card capabilities ------------------------------------------------

const AGENT_CARD_PATHS = ['/.well-known/agent-card.json', '/.well-known/agent.json', '/agent-card.json'];

export interface AgentCapabilities {
  intentEndpoints?: unknown;
  sessions?: { endpoint?: unknown };
  scopedTokens?: { tokenEndpoint?: unknown; scopes?: unknown; expirySeconds?: unknown };
  auditLog?: { header?: unknown };
  sandbox?: { baseUrl?: unknown };
  toolSchemas?: unknown;
  [key: string]: unknown;
}

// Fetch the agent card and return its `capabilities` object (or null if no card).
export async function fetchAgentCapabilities(baseUrl: string): Promise<AgentCapabilities | null> {
  for (const p of AGENT_CARD_PATHS) {
    const url = resolve(p, baseUrl);
    if (!url) continue;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT);
    try {
      const res = await fetch(url, { method: 'GET', signal: controller.signal });
      if (!res.ok) continue;
      const json = (await res.json()) as Record<string, unknown>;
      const caps = json?.capabilities;
      if (caps && typeof caps === 'object') return caps as AgentCapabilities;
      // Card exists but declares no capabilities — treat as empty declaration.
      return {};
    } catch {
      /* try next path */
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}

// --- per-check implementations ----------------------------------------------

// 5.1 Intent Endpoints — GET the FIRST declared path; accept {200,401,405,415}.
async function checkIntentEndpoints(baseUrl: string, caps: AgentCapabilities | null): Promise<CheckResult> {
  const id = LEVEL_5_IDS.INTENT;
  const list = caps?.intentEndpoints;
  const first = Array.isArray(list) && typeof list[0] === 'string' ? (list[0] as string) : null;
  if (!first) {
    return fail(id, 'No intentEndpoints declared in agent-card capabilities', 'Declare capabilities.intentEndpoints (e.g. ["/api/scan"]) in /.well-known/agent-card.json.');
  }
  const url = resolve(first, baseUrl);
  if (!url) return fail(id, `Declared intent endpoint is not a valid URL: ${first}`);
  const r = await probe(url);
  if (r.kind === 'indeterminate') return na(id, `Could not reach declared intent endpoint (${first})`);
  if (accepted(r.status, [200, 401, 405, 415])) {
    return pass(id, `Reachable at ${url}`, JSON.stringify({ found: url, status: r.status }));
  }
  return fail(id, `Declared intent endpoint returned ${r.status}`, undefined, JSON.stringify({ found: url, status: r.status }));
}

// 5.2 Agent Sessions — GET capabilities.sessions.endpoint; accept {200,401}.
async function checkAgentSessions(baseUrl: string, caps: AgentCapabilities | null): Promise<CheckResult> {
  const id = LEVEL_5_IDS.SESSIONS;
  const endpoint = typeof caps?.sessions?.endpoint === 'string' ? (caps!.sessions!.endpoint as string) : null;
  if (!endpoint) {
    return fail(id, 'No sessions.endpoint declared in agent-card capabilities', 'Declare capabilities.sessions.endpoint and back it with a session route.');
  }
  const url = resolve(endpoint, baseUrl);
  if (!url) return fail(id, `Declared sessions endpoint is not a valid URL: ${endpoint}`);
  const r = await probe(url);
  if (r.kind === 'indeterminate') return na(id, `Could not reach declared sessions endpoint (${endpoint})`);
  if (accepted(r.status, [200, 401])) {
    return pass(id, `Reachable at ${url}`, JSON.stringify({ found: url, status: r.status }));
  }
  return fail(id, `Declared sessions endpoint returned ${r.status}`, undefined, JSON.stringify({ found: url, status: r.status }));
}

// 5.3 Scoped Agent Tokens — GET capabilities.scopedTokens.tokenEndpoint (with
// non-empty scopes); accept {200,401,405}. Fallback: /.well-known/oauth-authorization-server
// returns 200 with a non-empty scopes_supported array.
async function checkScopedAgentTokens(baseUrl: string, caps: AgentCapabilities | null): Promise<CheckResult> {
  const id = LEVEL_5_IDS.SCOPED_TOKENS;
  const st = caps?.scopedTokens;
  const tokenEndpoint = typeof st?.tokenEndpoint === 'string' ? (st!.tokenEndpoint as string) : null;
  const scopes = Array.isArray(st?.scopes) ? (st!.scopes as unknown[]) : [];

  if (tokenEndpoint && scopes.length > 0) {
    const url = resolve(tokenEndpoint, baseUrl);
    if (!url) return fail(id, `Declared tokenEndpoint is not a valid URL: ${tokenEndpoint}`);
    const r = await probe(url);
    if (r.kind === 'indeterminate') return na(id, `Could not reach declared token endpoint (${tokenEndpoint})`);
    if (accepted(r.status, [200, 401, 405])) {
      return pass(id, `Reachable at ${url}`, JSON.stringify({ found: url, status: r.status, scopes: scopes.length }));
    }
    return fail(id, `Declared token endpoint returned ${r.status}`, undefined, JSON.stringify({ found: url, status: r.status }));
  }

  // Fallback: OAuth Authorization Server metadata with non-empty scopes_supported.
  const metaUrl = resolve('/.well-known/oauth-authorization-server', baseUrl);
  if (metaUrl) {
    const r = await probeBody(metaUrl);
    if (r.kind === 'indeterminate') return na(id, 'Could not reach /.well-known/oauth-authorization-server');
    if (r.status === 200) {
      try {
        const json = JSON.parse(r.body) as Record<string, unknown>;
        const supported = json?.scopes_supported;
        if (Array.isArray(supported) && supported.length > 0) {
          return pass(id, `Scopes advertised via OAuth metadata (${supported.length})`, JSON.stringify({ found: metaUrl, scopes_supported: supported.length }));
        }
      } catch {
        /* not JSON — falls through to fail */
      }
    }
  }
  return fail(id, 'No scoped agent tokens declared (capabilities.scopedTokens or OAuth metadata)', 'Declare capabilities.scopedTokens.{tokenEndpoint,scopes} or publish /.well-known/oauth-authorization-server with scopes_supported.');
}

// 5.4 Agent Audit Logs — GET the site root; the declared correlation header must
// be present on the response (case-insensitive). Header must be emitted site-wide.
async function checkAgentAuditLogs(baseUrl: string, caps: AgentCapabilities | null): Promise<CheckResult> {
  const id = LEVEL_5_IDS.AUDIT_LOGS;
  const header = typeof caps?.auditLog?.header === 'string' ? (caps!.auditLog!.header as string) : null;
  if (!header) {
    return fail(id, 'No auditLog.header declared in agent-card capabilities', 'Declare capabilities.auditLog.header and emit that correlation header (e.g. X-Request-Id) site-wide.');
  }
  const root = resolve('/', baseUrl);
  if (!root) return fail(id, 'Could not resolve site root');
  const r = await probe(root);
  if (r.kind === 'indeterminate') return na(id, 'Could not reach site root to inspect headers');
  if (r.headers.has(header)) {
    return pass(id, `Found audit-trace header: ${header.toLowerCase()}`, JSON.stringify({ header: header.toLowerCase() }));
  }
  return fail(id, `Declared audit header "${header}" not present on the root response`, 'Emit the correlation header on every response (server middleware), not only on one API route.');
}

// 5.5 Sandbox Environment — GET capabilities.sandbox.baseUrl (fully-qualified);
// accept {200,401}.
async function checkSandboxEnvironment(baseUrl: string, caps: AgentCapabilities | null): Promise<CheckResult> {
  const id = LEVEL_5_IDS.SANDBOX;
  const sandbox = typeof caps?.sandbox?.baseUrl === 'string' ? (caps!.sandbox!.baseUrl as string) : null;
  if (!sandbox) {
    return fail(id, 'No sandbox.baseUrl declared in agent-card capabilities', 'Declare capabilities.sandbox.baseUrl (a fully-qualified URL) and serve a sandbox.');
  }
  const url = resolve(sandbox, baseUrl);
  if (!url) return fail(id, `Declared sandbox.baseUrl is not a valid URL: ${sandbox}`);
  const r = await probe(url);
  if (r.kind === 'indeterminate') return na(id, `Could not reach declared sandbox (${sandbox})`);
  if (accepted(r.status, [200, 401])) {
    return pass(id, `Reachable at ${url}`, JSON.stringify({ found: url, status: r.status }));
  }
  return fail(id, `Declared sandbox returned ${r.status}`, undefined, JSON.stringify({ found: url, status: r.status }));
}

const CONSEQUENCE_FIELDS = ['x-consequence', 'x-irreversible', 'x-side-effects'];

// 5.6 Consequence Labels — an OpenAPI operation carries x-consequence,
// x-irreversible, or x-side-effects. Pass when >= 1 operation does.
function checkConsequenceLabels(spec: ParsedOpenApiSpec | null): CheckResult {
  const id = LEVEL_5_IDS.CONSEQUENCE;
  if (!spec) {
    // No OpenAPI to inspect — the probe is inconclusive, not a failure.
    return na(id, 'Probe inconclusive: no published OpenAPI spec to inspect for consequence labels');
  }
  const fieldsSeen = new Set<string>();
  let count = 0;
  const httpMethods = new Set(['get', 'put', 'post', 'delete', 'patch', 'options', 'head', 'trace']);

  for (const pathItem of Object.values(spec.paths ?? {})) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!httpMethods.has(method.toLowerCase())) continue;
      if (!operation || typeof operation !== 'object') continue;
      const op = operation as Record<string, unknown>;
      const hit = CONSEQUENCE_FIELDS.filter((f) => f in op);
      if (hit.length > 0) {
        count++;
        hit.forEach((f) => fieldsSeen.add(f));
      }
    }
  }

  if (count > 0) {
    const fields = Array.from(fieldsSeen);
    return pass(
      id,
      `${count} consequence-labeled operation${count === 1 ? '' : 's'} across ${fields.join(', ')}`,
      JSON.stringify({ count, fields }),
    );
  }
  return fail(id, 'No operations carry x-consequence/x-irreversible/x-side-effects', 'Annotate consequential or irreversible operations in your OpenAPI spec.');
}

// 5.7 Native Tool Schemas — GET capabilities.toolSchemas (default
// /.well-known/skills/index.json); pass when status 200 AND the body parses as JSON.
async function checkNativeToolSchemas(baseUrl: string, caps: AgentCapabilities | null): Promise<CheckResult> {
  const id = LEVEL_5_IDS.TOOL_SCHEMAS;
  const declared = typeof caps?.toolSchemas === 'string' ? (caps!.toolSchemas as string) : null;
  const target = declared ?? '/.well-known/skills/index.json';
  const url = resolve(target, baseUrl);
  if (!url) return fail(id, `Declared toolSchemas is not a valid URL: ${target}`);
  const r = await probeBody(url);
  if (r.kind === 'indeterminate') return na(id, `Could not reach tool schemas (${target})`);
  if (r.status === 200) {
    try {
      JSON.parse(r.body);
      return pass(id, `Reachable at ${url}`, JSON.stringify({ found: url }));
    } catch {
      return fail(id, `Tool schemas at ${target} did not parse as JSON`, undefined, JSON.stringify({ found: url, status: r.status }));
    }
  }
  return fail(id, `Tool schemas returned ${r.status}`, declared ? undefined : 'Publish /.well-known/skills/index.json (valid JSON) or declare capabilities.toolSchemas.', JSON.stringify({ found: url, status: r.status }));
}

// Run all 7 Level-5 (Agent-Native) checks. `spec` is the already-fetched OpenAPI
// spec (reused for 5.6 so we don't fetch it twice).
export async function runDeepChecks(baseUrl: string, spec: ParsedOpenApiSpec | null): Promise<CheckResult[]> {
  const caps = await fetchAgentCapabilities(baseUrl);
  const [intent, sessions, tokens, audit, sandbox, tools] = await Promise.all([
    checkIntentEndpoints(baseUrl, caps),
    checkAgentSessions(baseUrl, caps),
    checkScopedAgentTokens(baseUrl, caps),
    checkAgentAuditLogs(baseUrl, caps),
    checkSandboxEnvironment(baseUrl, caps),
    checkNativeToolSchemas(baseUrl, caps),
  ]);
  const consequence = checkConsequenceLabels(spec);
  // Return in canonical id order (5.1 … 5.7).
  return [intent, sessions, tokens, audit, sandbox, consequence, tools];
}
