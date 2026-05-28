import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  checkLlmsTxt,
  checkAgentCard,
  checkRobotsTxt,
  checkCorsHeaders,
  checkSkillFile,
  checkAiSiteProfile,
  checkSkillsIndex,
  checkOpenIdConfig,
  checkStructuredErrors,
  checkRateLimitHeaders,
  checkCachingHeaders,
  checkRssFeed,
  checkMcpToolQuality,
  checkPageTokenEfficiency,
} from '../src/scanner.js';

// Generic fetch mock: each test supplies its own handler(url, init) => Response.
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function text(body: string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers });
}

function notFound(): Response {
  return text('not found', 404);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// --- 1. Timeout / network-failure behavior ---

describe('timeout & network-failure handling', () => {
  it('checkLlmsTxt returns fail when every fetch throws (simulates timeout)', async () => {
    mockFetch(async () => {
      throw new DOMException('aborted', 'AbortError');
    });
    const r = await checkLlmsTxt('https://example.com');
    expect(r.status).toBe('fail');
    expect(r.id).toBe('1.1');
  });

  it('checkCorsHeaders returns na when every fetch throws', async () => {
    mockFetch(async () => {
      throw new TypeError('network failed');
    });
    const r = await checkCorsHeaders('https://example.com');
    expect(r.status).toBe('na');
    expect(r.id).toBe('1.6');
  });

  it('checkRateLimitHeaders returns na on network error', async () => {
    mockFetch(async () => {
      throw new Error('ECONNREFUSED');
    });
    const r = await checkRateLimitHeaders('https://example.com');
    expect(r.status).toBe('na');
  });

  it('checkCachingHeaders returns na on network error', async () => {
    mockFetch(async () => {
      throw new Error('ECONNREFUSED');
    });
    const r = await checkCachingHeaders('https://example.com');
    expect(r.status).toBe('na');
  });

  it('checkRobotsTxt returns na on network error', async () => {
    mockFetch(async () => {
      throw new Error('ECONNREFUSED');
    });
    const r = await checkRobotsTxt('https://example.com');
    expect(r.status).toBe('na');
  });
});

// --- 2. robots.txt AI policy ---

describe('checkRobotsTxt', () => {
  it('passes with a permissive robots.txt', async () => {
    mockFetch(async () => text('User-agent: *\nAllow: /\n'));
    const r = await checkRobotsTxt('https://example.com');
    expect(r.status).toBe('pass');
  });

  it('fails when GPTBot is disallowed', async () => {
    mockFetch(async () => text('User-agent: GPTBot\nDisallow: /\n'));
    const r = await checkRobotsTxt('https://example.com');
    expect(r.status).toBe('fail');
    expect(r.details).toContain('gptbot');
  });

  it('fails when ClaudeBot is disallowed', async () => {
    mockFetch(async () => text('User-agent: ClaudeBot\nDisallow: /\n'));
    const r = await checkRobotsTxt('https://example.com');
    expect(r.status).toBe('fail');
    expect(r.details).toContain('claudebot');
  });

  it('partial when no agent blocked but /api is disallowed', async () => {
    mockFetch(async () => text('User-agent: *\nDisallow: /api\n'));
    const r = await checkRobotsTxt('https://example.com');
    expect(r.status).toBe('partial');
  });

  it('passes when the server returns 404 (no robots.txt is fine)', async () => {
    mockFetch(async () => notFound());
    const r = await checkRobotsTxt('https://example.com');
    expect(r.status).toBe('pass');
  });
});

// --- 3. CORS fallback from OPTIONS to GET ---

describe('checkCorsHeaders', () => {
  it('passes when OPTIONS returns an Access-Control-Allow-Origin header', async () => {
    mockFetch(async (_url, init) => {
      if (init.method === 'OPTIONS') {
        return text('ok', 200, { 'access-control-allow-origin': '*' });
      }
      return text('body');
    });
    const r = await checkCorsHeaders('https://example.com');
    expect(r.status).toBe('pass');
    expect(r.details).toContain('*');
  });

  it('falls back to GET when OPTIONS throws', async () => {
    mockFetch(async (_url, init) => {
      if (init.method === 'OPTIONS') {
        throw new Error('method not allowed');
      }
      return text('body', 200, { 'access-control-allow-origin': 'https://trusted.io' });
    });
    const r = await checkCorsHeaders('https://example.com');
    expect(r.status).toBe('pass');
    expect(r.details).toContain('https://trusted.io');
  });

  it('falls back to GET when OPTIONS omits the header', async () => {
    mockFetch(async (_url, init) => {
      if (init.method === 'OPTIONS') {
        return text('ok', 200); // 200 with no CORS header
      }
      return text('body', 200, { 'access-control-allow-origin': '*' });
    });
    const r = await checkCorsHeaders('https://example.com');
    expect(r.status).toBe('pass');
  });

  it('fails when neither OPTIONS nor GET expose the header', async () => {
    mockFetch(async () => text('body'));
    const r = await checkCorsHeaders('https://example.com');
    expect(r.status).toBe('fail');
  });
});

// --- 4. Malformed JSON on well-known files ---

describe('malformed-JSON handling', () => {
  it('checkAgentCard fails when body is invalid JSON', async () => {
    mockFetch(async (url) =>
      url.endsWith('/.well-known/agent-card.json')
        ? text('{ not: valid }', 200, { 'Content-Type': 'application/json' })
        : notFound()
    );
    const r = await checkAgentCard('https://example.com');
    expect(r.status).toBe('fail');
    expect(r.message.toLowerCase()).toContain('invalid json');
  });

  it('checkAgentCard marks partial when required fields are missing', async () => {
    mockFetch(async (url) =>
      url.endsWith('/.well-known/agent-card.json')
        ? json({ name: 'Example' }) // missing description + url
        : notFound()
    );
    const r = await checkAgentCard('https://example.com');
    expect(r.status).toBe('partial');
    expect(r.details).toContain('description');
    expect(r.details).toContain('url');
  });

  it('checkAiSiteProfile fails when body is invalid JSON', async () => {
    mockFetch(async (url) =>
      url.endsWith('/.well-known/ai.json')
        ? text('not json at all', 200, { 'Content-Type': 'application/json' })
        : notFound()
    );
    const r = await checkAiSiteProfile('https://example.com');
    expect(r.status).toBe('fail');
  });

  it('checkAiSiteProfile partial when name is present but capabilities are missing', async () => {
    mockFetch(async (url) =>
      url.endsWith('/.well-known/ai.json') ? json({ name: 'Example' }) : notFound()
    );
    const r = await checkAiSiteProfile('https://example.com');
    expect(r.status).toBe('partial');
  });

  it('checkSkillsIndex fails when body is invalid JSON', async () => {
    mockFetch(async (url) =>
      url.endsWith('/.well-known/skills/index.json')
        ? text('{{{broken', 200, { 'Content-Type': 'application/json' })
        : notFound()
    );
    const r = await checkSkillsIndex('https://example.com');
    expect(r.status).toBe('fail');
  });

  it('checkSkillsIndex passes when entries have id and name', async () => {
    mockFetch(async (url) =>
      url.endsWith('/.well-known/skills/index.json')
        ? json([{ id: 'search', name: 'Search' }])
        : notFound()
    );
    const r = await checkSkillsIndex('https://example.com');
    expect(r.status).toBe('pass');
  });

  it('checkSkillsIndex partial when entries are missing id/name', async () => {
    mockFetch(async (url) =>
      url.endsWith('/.well-known/skills/index.json')
        ? json([{ label: 'search' }])
        : notFound()
    );
    const r = await checkSkillsIndex('https://example.com');
    expect(r.status).toBe('partial');
  });

  it('checkSkillFile passes when markdown content has headers', async () => {
    mockFetch(async (url) =>
      url.endsWith('/skill.md')
        ? text(
            '# Skill\n\nDo thing A then thing B. Returns results. More than fifty characters of content here.',
            200,
            { 'Content-Type': 'text/markdown' }
          )
        : notFound()
    );
    const r = await checkSkillFile('https://example.com');
    expect(r.status).toBe('pass');
  });

  it('checkSkillFile fails when the response is an HTML redirect page', async () => {
    mockFetch(async () => text('<!DOCTYPE html><html><body>Not found</body></html>'));
    const r = await checkSkillFile('https://example.com');
    expect(r.status).toBe('fail');
  });
});

// --- 5. Page-token efficiency thresholds + mitigation ---

describe('checkPageTokenEfficiency', () => {
  // The function compares raw HTML tokens vs tokens after stripping script/style/svg/tags.
  // partialThreshold = 0.70 + mitigationPct, failThreshold = 0.85 + mitigationPct.

  it('returns na when html is null', () => {
    expect(checkPageTokenEfficiency(null).status).toBe('na');
  });

  it('returns na when html is too short to evaluate', () => {
    expect(checkPageTokenEfficiency('<html>hi</html>').status).toBe('na');
  });

  it('passes for a content-heavy page with little markup overhead', () => {
    const content = 'Readable content about this site. '.repeat(80); // ~2700 chars
    const html = `<html><body><p>${content}</p></body></html>`;
    const r = checkPageTokenEfficiency(html);
    expect(r.status).toBe('pass');
  });

  it('fails when >85% of the page is script/boilerplate overhead', () => {
    // Huge inline script + tiny visible text → well over 85% waste.
    const script = 'var x=1;'.repeat(800); // ~6400 chars of script
    const html = `<html><head><script>${script}</script></head><body><p>hi</p></body></html>`;
    const r = checkPageTokenEfficiency(html);
    expect(r.status).toBe('fail');
  });

  it('upgrades a partial result to pass when llms.txt and OpenAPI mitigate (+0.20 threshold)', () => {
    // Build a page whose waste ratio sits between 0.70 (default partial) and 0.90 (with mitigation).
    const script = 'var x=1;'.repeat(200); // ~1600 script chars
    const visible = 'Readable body text. '.repeat(20); // ~400 visible chars
    const html = `<html><head><script>${script}</script></head><body><p>${visible}</p></body></html>`;

    const plain = checkPageTokenEfficiency(html);
    expect(['partial', 'fail']).toContain(plain.status);

    const mitigated = checkPageTokenEfficiency(html, [
      { id: '1.1', name: 'llms.txt', passed: true, status: 'pass', level: 1, category: '', autoDetectable: true, message: '' },
      { id: '1.3', name: 'OpenAPI Spec', passed: true, status: 'pass', level: 1, category: '', autoDetectable: true, message: '' },
    ]);
    // Mitigation should at least soften the grade by one tier.
    if (plain.status === 'fail') {
      expect(['partial', 'pass']).toContain(mitigated.status);
    } else {
      expect(mitigated.status).toBe('pass');
    }
    expect(mitigated.details).toContain('llms.txt');
  });
});

// --- 6. MCP tool-quality 80% boundary (check 3.7) ---

describe('checkMcpToolQuality 80% rule', () => {
  function mockMcp(tools: unknown[]): void {
    mockFetch(async (url) =>
      url.endsWith('/.well-known/mcp.json') ? json({ endpoint: 'x', tools }) : notFound()
    );
  }

  const good = {
    name: 'ok',
    description: 'Does a well-described thing for agents.',
    inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
  };
  const bad = { name: 'nope' }; // no description, no schema

  it('passes at exactly 4/5 well-described tools (80%)', async () => {
    mockMcp([good, good, good, good, bad]);
    const r = await checkMcpToolQuality('https://example.com');
    expect(r.status).toBe('pass');
  });

  it('is partial at 3/5 well-described (60%)', async () => {
    mockMcp([good, good, good, bad, bad]);
    const r = await checkMcpToolQuality('https://example.com');
    expect(r.status).toBe('partial');
  });

  it('fails at 1/5 well-described (20%)', async () => {
    mockMcp([good, bad, bad, bad, bad]);
    const r = await checkMcpToolQuality('https://example.com');
    expect(r.status).toBe('fail');
  });

  it('reads tools nested under capabilities.tools', async () => {
    mockFetch(async (url) =>
      url.endsWith('/.well-known/mcp.json')
        ? json({ capabilities: { tools: [good, good] } })
        : notFound()
    );
    const r = await checkMcpToolQuality('https://example.com');
    expect(r.status).toBe('pass');
  });
});

// --- 7. is covered in repo-scanner-boundaries.test.ts ---

// --- 8. RSS/Atom two-stage discovery ---

describe('checkRssFeed', () => {
  it('passes via HTML <link> tag without probing', async () => {
    const calls: string[] = [];
    mockFetch(async (url) => {
      calls.push(url);
      return notFound();
    });
    const html =
      '<html><head>' +
      '<link rel="alternate" type="application/rss+xml" href="/feed.xml">' +
      '</head></html>';
    const r = await checkRssFeed(html, 'https://example.com');
    expect(r.status).toBe('pass');
    expect(calls.length).toBe(0); // stage 2 never invoked
    expect(r.details).toContain('/feed.xml');
  });

  it('falls back to probing when HTML has no feed link', async () => {
    mockFetch(async (url) =>
      url.endsWith('/feed.xml')
        ? text('<?xml version="1.0"?><rss><channel></channel></rss>', 200, {
            'Content-Type': 'application/rss+xml',
          })
        : notFound()
    );
    const r = await checkRssFeed('<html></html>', 'https://example.com');
    expect(r.status).toBe('pass');
    expect(r.foundAt).toContain('/feed.xml');
  });

  it('fails when neither HTML links nor probed paths yield a feed', async () => {
    mockFetch(async () => notFound());
    const r = await checkRssFeed('<html></html>', 'https://example.com');
    expect(r.status).toBe('fail');
  });
});

// --- 9. covered in cli.test.ts ---

// --- 10. Structured-error probe ---

describe('checkStructuredErrors', () => {
  const probeSuffix = '/api/this-path-should-not-exist-botvisibility-probe';

  it('passes when probe returns a structured JSON error', async () => {
    mockFetch(async (url) =>
      url.endsWith(probeSuffix)
        ? new Response(JSON.stringify({ error: 'not_found', message: 'no such resource' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        : notFound()
    );
    const r = await checkStructuredErrors('https://example.com');
    expect(r.status).toBe('pass');
  });

  it('passes on application/problem+json (RFC 7807)', async () => {
    mockFetch(async (url) =>
      url.endsWith(probeSuffix)
        ? new Response(JSON.stringify({ type: 'about:blank', title: 'Not Found', status: 404 }), {
            status: 404,
            headers: { 'Content-Type': 'application/problem+json' },
          })
        : notFound()
    );
    const r = await checkStructuredErrors('https://example.com');
    expect(r.status).toBe('pass');
  });

  it('is partial when JSON is returned but has no recognizable error fields', async () => {
    mockFetch(async (url) =>
      url.endsWith(probeSuffix)
        ? new Response(JSON.stringify({ hello: 'world' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        : notFound()
    );
    const r = await checkStructuredErrors('https://example.com');
    expect(r.status).toBe('partial');
  });

  it('is na when the site returns HTML (no JSON API present)', async () => {
    mockFetch(async (url) =>
      url.endsWith(probeSuffix)
        ? text('<!doctype html><html>Not Found</html>', 404, { 'Content-Type': 'text/html' })
        : notFound()
    );
    const r = await checkStructuredErrors('https://example.com');
    expect(r.status).toBe('na');
  });

  it('fails when response has no content-type and no JSON body', async () => {
    mockFetch(async (url) =>
      url.endsWith(probeSuffix) ? text('plain error', 500) : notFound()
    );
    const r = await checkStructuredErrors('https://example.com');
    expect(r.status).toBe('fail');
  });
});

// --- Bonus: rate-limit and caching partial thresholds ---

describe('checkRateLimitHeaders thresholds', () => {
  it('passes with two or more rate-limit headers', async () => {
    mockFetch(async () =>
      text('ok', 200, {
        'x-ratelimit-limit': '100',
        'x-ratelimit-remaining': '42',
      })
    );
    const r = await checkRateLimitHeaders('https://example.com');
    expect(r.status).toBe('pass');
  });

  it('partial with exactly one rate-limit header', async () => {
    mockFetch(async () => text('ok', 200, { 'retry-after': '30' }));
    const r = await checkRateLimitHeaders('https://example.com');
    expect(r.status).toBe('partial');
  });

  it('fails when no rate-limit headers are present', async () => {
    mockFetch(async () => text('ok'));
    const r = await checkRateLimitHeaders('https://example.com');
    expect(r.status).toBe('fail');
  });
});

describe('checkCachingHeaders thresholds', () => {
  it('passes with two or more caching signals', async () => {
    mockFetch(async () =>
      text('ok', 200, {
        etag: '"abc"',
        'cache-control': 'max-age=60',
      })
    );
    const r = await checkCachingHeaders('https://example.com');
    expect(r.status).toBe('pass');
  });

  it('partial with a single caching signal', async () => {
    mockFetch(async () => text('ok', 200, { 'cache-control': 'no-store' }));
    const r = await checkCachingHeaders('https://example.com');
    expect(r.status).toBe('partial');
  });

  it('fails with no caching signals', async () => {
    mockFetch(async () => text('ok'));
    const r = await checkCachingHeaders('https://example.com');
    expect(r.status).toBe('fail');
  });
});

describe('checkOpenIdConfig', () => {
  it('passes when discovery document has issuer and token_endpoint', async () => {
    mockFetch(async (url) =>
      url.endsWith('/.well-known/openid-configuration')
        ? json({
            issuer: 'https://example.com',
            token_endpoint: 'https://example.com/token',
          })
        : notFound()
    );
    const r = await checkOpenIdConfig('https://example.com');
    expect(r.status).toBe('pass');
  });

  it('is na when discovery document is absent (optional feature)', async () => {
    mockFetch(async () => notFound());
    const r = await checkOpenIdConfig('https://example.com');
    expect(r.status).toBe('na');
  });
});
