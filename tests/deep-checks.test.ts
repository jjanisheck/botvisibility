import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchAgentCapabilities, runDeepChecks } from '../src/deep-checks.js';
import type { ParsedOpenApiSpec } from '../src/scanner.js';

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

function mockFetch(handler: Handler): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      return handler(url, init ?? {});
    })
  );
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
function text(body: string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers });
}

afterEach(() => vi.unstubAllGlobals());

const BASE = 'https://example.com';

// The reference capabilities block from botvisibility.com.
const FULL_CAPS = {
  intentEndpoints: ['/api/scan'],
  auditLog: { header: 'x-request-id' },
  toolSchemas: '/.well-known/skills/index.json',
  sessions: { endpoint: '/api/agent/sessions' },
  scopedTokens: { tokenEndpoint: '/api/agent/token', scopes: ['scan:read'], expirySeconds: 3600 },
  sandbox: { baseUrl: 'https://example.com/api/sandbox' },
};

const SPEC_WITH_CONSEQUENCE: ParsedOpenApiSpec = {
  raw: {},
  paths: { '/api/scan': { post: { 'x-consequence': 'charges the caller', summary: 'scan' } } },
  hasGetEndpoints: false,
  hasWriteEndpoints: true,
  hasNonGetEndpoints: true,
  securitySchemes: {},
  hasApiKeyAuth: false,
  hasScopedAuth: false,
  hasAsyncPatterns: false,
  hasIdempotencyKey: false,
  hasSparseFields: false,
  hasCursorPagination: false,
  hasSearchFiltering: false,
  hasBulkOperations: false,
};

function byId(results: { id: string }[], id: string) {
  return results.find((r) => r.id === id)!;
}

describe('fetchAgentCapabilities', () => {
  it('returns the capabilities object from /.well-known/agent-card.json', async () => {
    mockFetch((url) =>
      url.includes('/.well-known/agent-card.json') ? json({ capabilities: FULL_CAPS }) : text('nope', 404)
    );
    const caps = await fetchAgentCapabilities(BASE);
    expect(caps).not.toBeNull();
    expect((caps as any).intentEndpoints).toEqual(['/api/scan']);
  });

  it('returns null when no agent card is published', async () => {
    mockFetch(() => text('nope', 404));
    expect(await fetchAgentCapabilities(BASE)).toBeNull();
  });

  it('returns {} when the card exists but declares no capabilities', async () => {
    mockFetch((url) => (url.includes('agent-card.json') ? json({ name: 'x' }) : text('no', 404)));
    expect(await fetchAgentCapabilities(BASE)).toEqual({});
  });
});

describe('runDeepChecks — fully-declared, fully-reachable site scores 7/7', () => {
  it('passes all seven Level-5 checks', async () => {
    mockFetch((url) => {
      if (url.includes('/.well-known/agent-card.json')) return json({ capabilities: FULL_CAPS });
      if (url.endsWith('/api/scan')) return text('ok', 200);
      if (url.endsWith('/api/agent/sessions')) return text('', 401); // accepted for 5.2
      if (url.endsWith('/api/agent/token')) return text('', 405); // accepted for 5.3
      if (url.endsWith('/api/sandbox')) return text('ok', 200);
      if (url.endsWith('/.well-known/skills/index.json')) return json({ skills: [] });
      if (url === 'https://example.com/' || url === `${BASE}/`) return text('home', 200, { 'x-request-id': 'abc' });
      return text('not found', 404);
    });
    const results = await runDeepChecks(BASE, SPEC_WITH_CONSEQUENCE);
    expect(results).toHaveLength(7);
    expect(results.every((r) => r.status === 'pass')).toBe(true);
    expect(results.map((r) => r.id)).toEqual(['5.1', '5.2', '5.3', '5.4', '5.5', '5.6', '5.7']);
    // every result is a Level-5 Agent-Native, externally-verified check
    expect(results.every((r) => r.level === 5 && r.category === 'Agent-Native' && r.autoDetectable === false)).toBe(true);
  });
});

describe('runDeepChecks — declaration + probe semantics', () => {
  it('fails a check that is not declared', async () => {
    mockFetch((url) => (url.includes('agent-card.json') ? json({ capabilities: {} }) : text('no', 404)));
    const results = await runDeepChecks(BASE, null);
    expect(byId(results, '5.1').status).toBe('fail'); // no intentEndpoints
    expect(byId(results, '5.2').status).toBe('fail'); // no sessions
  });

  it('fails a declared endpoint whose probe returns a non-accepted status (broken endpoint)', async () => {
    mockFetch((url) => {
      if (url.includes('agent-card.json')) return json({ capabilities: { intentEndpoints: ['/gone'] } });
      if (url.endsWith('/gone')) return text('not found', 404);
      return text('no', 404);
    });
    const results = await runDeepChecks(BASE, null);
    expect(byId(results, '5.1').status).toBe('fail');
    expect(byId(results, '5.1').details).toContain('404');
  });

  it('marks a check n/a (not fail) when the probe cannot complete', async () => {
    mockFetch((url) => {
      if (url.includes('agent-card.json')) return json({ capabilities: { intentEndpoints: ['/api/scan'] } });
      if (url.endsWith('/api/scan')) return Promise.reject(new Error('network down'));
      return text('no', 404);
    });
    const results = await runDeepChecks(BASE, null);
    expect(byId(results, '5.1').status).toBe('na');
  });

  it('treats HTTP 429 as n/a (indeterminate), never a failure', async () => {
    mockFetch((url) => {
      if (url.includes('agent-card.json')) return json({ capabilities: { intentEndpoints: ['/api/scan'] } });
      if (url.endsWith('/api/scan')) return text('slow down', 429);
      return text('no', 404);
    });
    const results = await runDeepChecks(BASE, null);
    expect(byId(results, '5.1').status).toBe('na');
  });

  it('5.3 passes via the OAuth-metadata fallback when scopedTokens is not declared', async () => {
    mockFetch((url) => {
      if (url.includes('agent-card.json')) return json({ capabilities: {} });
      if (url.includes('/.well-known/oauth-authorization-server')) {
        return json({ scopes_supported: ['read', 'write'] });
      }
      return text('no', 404);
    });
    const results = await runDeepChecks(BASE, null);
    expect(byId(results, '5.3').status).toBe('pass');
  });

  it('5.4 reads the SITE ROOT for the declared correlation header', async () => {
    const calls: string[] = [];
    mockFetch((url) => {
      calls.push(url);
      if (url.includes('agent-card.json')) return json({ capabilities: { auditLog: { header: 'X-Request-Id' } } });
      if (url === `${BASE}/`) return text('home', 200, { 'x-request-id': 'r1' });
      return text('no', 404);
    });
    const results = await runDeepChecks(BASE, null);
    expect(byId(results, '5.4').status).toBe('pass');
    expect(calls).toContain(`${BASE}/`);
  });

  it('5.6 reads consequence labels from the OpenAPI spec, not the agent card', async () => {
    mockFetch((url) => (url.includes('agent-card.json') ? json({ capabilities: {} }) : text('no', 404)));
    const withSpec = await runDeepChecks(BASE, SPEC_WITH_CONSEQUENCE);
    expect(byId(withSpec, '5.6').status).toBe('pass');
    expect(byId(withSpec, '5.6').details).toContain('x-consequence');

    // No OpenAPI to inspect → inconclusive (na), never a failure.
    const withoutSpec = await runDeepChecks(BASE, null);
    expect(byId(withoutSpec, '5.6').status).toBe('na');
  });

  it('5.7 fails when the tool-schemas endpoint returns 200 but non-JSON', async () => {
    mockFetch((url) => {
      if (url.includes('agent-card.json')) return json({ capabilities: {} });
      if (url.endsWith('/.well-known/skills/index.json')) return text('<html>not json</html>', 200);
      return text('no', 404);
    });
    const results = await runDeepChecks(BASE, null);
    expect(byId(results, '5.7').status).toBe('fail');
  });
});
