import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  checkContentSignals,
  checkApiCatalog,
  checkMarkdownForAgents,
  checkWebMcp,
  checkOAuthProtectedResource,
  checkX402Payments,
  checkGooglebotAllowed,
  checkGoogleExtendedPolicy,
  checkHomepageIndexable,
  checkSitemapPresent,
  checkHttps,
  checkMobileViewport,
  checkJsonLdPresent,
  checkEntitySchema,
  checkCanonicalUrl,
  checkHeadingHierarchy,
  checkImageAltCoverage,
  checkSubstantiveContent,
} from '../src/scanner.js';

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
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
function text(body: string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers });
}
function notFound(): Response { return text('not found', 404); }

afterEach(() => {
  vi.unstubAllGlobals();
});

// --- 1.15 Content Signals ---

describe('checkContentSignals', () => {
  it('fails when robots.txt is missing', () => {
    expect(checkContentSignals(null).status).toBe('fail');
  });
  it('passes when robots.txt declares ai-train and search via Content-Signal', () => {
    const robots = 'User-agent: *\nContent-Signal: search=yes, ai-train=no, ai-input=yes\n';
    expect(checkContentSignals(robots).status).toBe('pass');
  });
  it('partial when Content-Signal is present but no recognized signals', () => {
    const robots = 'User-agent: *\nContent-Signal: custom=yes\n';
    expect(checkContentSignals(robots).status).toBe('partial');
  });
  it('fails when robots.txt has no Content-Signal directive', () => {
    expect(checkContentSignals('User-agent: *\nAllow: /\n').status).toBe('fail');
  });
});

// --- 1.16 API Catalog (RFC 9727) ---

describe('checkApiCatalog', () => {
  it('passes when linkset includes service-desc relations', async () => {
    mockFetch(async (url) =>
      url.endsWith('/.well-known/api-catalog')
        ? json({ linkset: [{ anchor: 'https://api.example.com', 'service-desc': [{ href: '/openapi.json' }] }] })
        : notFound()
    );
    const r = await checkApiCatalog('https://example.com');
    expect(r.status).toBe('pass');
    expect(r.id).toBe('1.16');
  });
  it('partial when linkset has no service-desc relation', async () => {
    mockFetch(async (url) =>
      url.endsWith('/.well-known/api-catalog')
        ? json({ linkset: [{ anchor: 'https://api.example.com', author: [{ href: 'x' }] }] })
        : notFound()
    );
    const r = await checkApiCatalog('https://example.com');
    expect(r.status).toBe('partial');
  });
  it('fails when /.well-known/api-catalog is absent', async () => {
    mockFetch(async () => notFound());
    expect((await checkApiCatalog('https://example.com')).status).toBe('fail');
  });
});

// --- 1.17 Markdown for Agents ---

describe('checkMarkdownForAgents', () => {
  it('passes when homepage returns text/markdown content type', async () => {
    mockFetch(async (url, init) => {
      const accept = (init.headers as Record<string, string>)?.['Accept'] || '';
      if (accept.includes('markdown')) return text('# Welcome\n\nMarkdown body.', 200, { 'Content-Type': 'text/markdown' });
      return text('<html>...</html>');
    });
    const r = await checkMarkdownForAgents('https://example.com');
    expect(r.status).toBe('pass');
    expect(r.id).toBe('1.17');
  });
  it('fails when Accept: text/markdown still returns HTML', async () => {
    mockFetch(async () => text('<!doctype html><html><body>hi</body></html>', 200, { 'Content-Type': 'text/html' }));
    expect((await checkMarkdownForAgents('https://example.com')).status).toBe('fail');
  });
});

// --- 1.18 WebMCP ---

describe('checkWebMcp', () => {
  it('passes when navigator.modelContext.provideContext is called', () => {
    const html = `<html><script>navigator.modelContext.provideContext({tools:[]})</script></html>`;
    expect(checkWebMcp(html).status).toBe('pass');
  });
  it('passes through bracket access too', () => {
    const html = `<html><script>navigator['modelContext'].provideContext({})</script></html>`;
    expect(checkWebMcp(html).status).toBe('pass');
  });
  it('fails when no provideContext call exists', () => {
    expect(checkWebMcp('<html><body>nope</body></html>').status).toBe('fail');
  });
});

// --- 2.10 OAuth Protected Resource (RFC 9728) ---

describe('checkOAuthProtectedResource', () => {
  it('passes when authorization_servers is a non-empty array', async () => {
    mockFetch(async (url) =>
      url.endsWith('/.well-known/oauth-protected-resource')
        ? json({ resource: 'https://api.example.com', authorization_servers: ['https://auth.example.com'], scopes_supported: ['read'] })
        : notFound()
    );
    const r = await checkOAuthProtectedResource('https://example.com');
    expect(r.status).toBe('pass');
  });
  it('partial when document exists but lacks authorization_servers', async () => {
    mockFetch(async (url) =>
      url.endsWith('/.well-known/oauth-protected-resource')
        ? json({ resource: 'https://api.example.com' })
        : notFound()
    );
    expect((await checkOAuthProtectedResource('https://example.com')).status).toBe('partial');
  });
  it('returns na when the document is absent', async () => {
    mockFetch(async () => notFound());
    expect((await checkOAuthProtectedResource('https://example.com')).status).toBe('na');
  });
});

// --- 2.11 x402 Payments ---

describe('checkX402Payments', () => {
  it('passes when a probe returns HTTP 402 with x402 body', async () => {
    mockFetch(async () =>
      new Response(JSON.stringify({ x402Version: 1, accepts: [{ scheme: 'exact' }] }), {
        status: 402,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const r = await checkX402Payments('https://example.com');
    expect(r.status).toBe('pass');
  });
  it('partial when 402 returned without x402 markers', async () => {
    mockFetch(async () => new Response('Payment Required', { status: 402 }));
    expect((await checkX402Payments('https://example.com')).status).toBe('partial');
  });
  it('returns na when no 402 anywhere', async () => {
    mockFetch(async () => notFound());
    expect((await checkX402Payments('https://example.com')).status).toBe('na');
  });
});

// --- 4.1 Googlebot Allowed ---

describe('checkGooglebotAllowed', () => {
  it('passes when robots.txt is missing', () => {
    expect(checkGooglebotAllowed(null).status).toBe('pass');
  });
  it('passes on a permissive robots.txt', () => {
    expect(checkGooglebotAllowed('User-agent: *\nAllow: /\n').status).toBe('pass');
  });
  it('fails when robots.txt disallows / for Googlebot', () => {
    expect(checkGooglebotAllowed('User-agent: Googlebot\nDisallow: /\n').status).toBe('fail');
  });
  it('fails when * disallows / and Googlebot has no explicit block', () => {
    expect(checkGooglebotAllowed('User-agent: *\nDisallow: /\n').status).toBe('fail');
  });
  it('passes when * disallows / but Googlebot block exists allowing all', () => {
    expect(checkGooglebotAllowed('User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nAllow: /\n').status).toBe('pass');
  });
});

// --- 4.2 Google-Extended Policy ---

describe('checkGoogleExtendedPolicy', () => {
  it('passes when an explicit Google-Extended block exists', () => {
    expect(
      checkGoogleExtendedPolicy('User-agent: Google-Extended\nDisallow: /\n').status,
    ).toBe('pass');
  });
  it('fails when there is no Google-Extended block', () => {
    expect(checkGoogleExtendedPolicy('User-agent: *\nAllow: /\n').status).toBe('fail');
  });
  it('fails when robots.txt is missing entirely', () => {
    expect(checkGoogleExtendedPolicy(null).status).toBe('fail');
  });
});

// --- 4.3 Homepage Indexable ---

describe('checkHomepageIndexable', () => {
  it('passes when no noindex anywhere', () => {
    expect(checkHomepageIndexable('<html><head></head></html>', null).status).toBe('pass');
  });
  it('fails on meta robots noindex', () => {
    expect(
      checkHomepageIndexable('<html><head><meta name="robots" content="noindex"></head></html>', null).status,
    ).toBe('fail');
  });
  it('fails on X-Robots-Tag: noindex header', () => {
    expect(checkHomepageIndexable('<html></html>', 'noindex').status).toBe('fail');
  });
});

// --- 4.4 Sitemap Present ---

describe('checkSitemapPresent', () => {
  it('passes when sitemap.xml is reachable and robots.txt references it', async () => {
    mockFetch(async (url) =>
      url.endsWith('/sitemap.xml') ? text('<?xml version="1.0"?><urlset></urlset>', 200, { 'Content-Type': 'application/xml' }) : notFound()
    );
    const r = await checkSitemapPresent('https://example.com', 'Sitemap: https://example.com/sitemap.xml\n');
    expect(r.status).toBe('pass');
  });
  it('partial when sitemap.xml reachable but robots.txt does not reference it', async () => {
    mockFetch(async (url) =>
      url.endsWith('/sitemap.xml') ? text('<?xml version="1.0"?><urlset></urlset>', 200) : notFound()
    );
    expect((await checkSitemapPresent('https://example.com', null)).status).toBe('partial');
  });
  it('fails when no sitemap at all', async () => {
    mockFetch(async () => notFound());
    expect((await checkSitemapPresent('https://example.com', null)).status).toBe('fail');
  });
});

// --- 4.5 HTTPS ---

describe('checkHttps', () => {
  it('passes when http redirects to https', async () => {
    mockFetch(async (url) => {
      if (url.startsWith('http://')) {
        return new Response(null, { status: 301, headers: { Location: 'https://example.com/' } });
      }
      return text('ok');
    });
    expect((await checkHttps('https://example.com')).status).toBe('pass');
  });
  it('fails when http serves 200 without redirect', async () => {
    mockFetch(async () => text('plain http', 200));
    expect((await checkHttps('https://example.com')).status).toBe('fail');
  });
  it('passes when http connection refused (https-only origin)', async () => {
    mockFetch(async (url) => {
      if (url.startsWith('http://')) throw new Error('ECONNREFUSED');
      return text('ok');
    });
    expect((await checkHttps('https://example.com')).status).toBe('pass');
  });
});

// --- 4.6 Mobile Viewport ---

describe('checkMobileViewport', () => {
  it('passes with width=device-width viewport meta', () => {
    expect(
      checkMobileViewport('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head></html>').status,
    ).toBe('pass');
  });
  it('fails without a viewport meta', () => {
    expect(checkMobileViewport('<html><head></head></html>').status).toBe('fail');
  });
});

// --- 4.7 JSON-LD Present ---

describe('checkJsonLdPresent', () => {
  it('passes with at least one valid JSON-LD script block', () => {
    const html = '<html><script type="application/ld+json">{"@type":"Thing"}</script></html>';
    expect(checkJsonLdPresent(html).status).toBe('pass');
  });
  it('fails when no JSON-LD blocks exist', () => {
    expect(checkJsonLdPresent('<html><body>x</body></html>').status).toBe('fail');
  });
  it('fails when JSON-LD block is unparseable', () => {
    const html = '<html><script type="application/ld+json">{invalid</script></html>';
    expect(checkJsonLdPresent(html).status).toBe('fail');
  });
});

// --- 4.8 Entity Schema ---

describe('checkEntitySchema', () => {
  it('passes when JSON-LD declares Organization', () => {
    const html = `<html><script type="application/ld+json">${JSON.stringify({ '@type': 'Organization', name: 'Acme' })}</script></html>`;
    expect(checkEntitySchema(html).status).toBe('pass');
  });
  it('passes when entity is nested in @graph', () => {
    const json = JSON.stringify({ '@graph': [{ '@type': 'WebSite' }] });
    expect(checkEntitySchema(`<html><script type="application/ld+json">${json}</script></html>`).status).toBe('pass');
  });
  it('fails when no entity types match', () => {
    const json = JSON.stringify({ '@type': 'Article' });
    expect(checkEntitySchema(`<html><script type="application/ld+json">${json}</script></html>`).status).toBe('fail');
  });
});

// --- 4.9 Canonical URL ---

describe('checkCanonicalUrl', () => {
  it('passes when canonical is self-referential to homepage', () => {
    const html = '<html><head><link rel="canonical" href="https://example.com/"></head></html>';
    expect(checkCanonicalUrl(html, 'https://example.com').status).toBe('pass');
  });
  it('partial when canonical points to a different path on same origin', () => {
    const html = '<html><head><link rel="canonical" href="/other"></head></html>';
    expect(checkCanonicalUrl(html, 'https://example.com').status).toBe('partial');
  });
  it('partial when canonical points off-origin', () => {
    const html = '<html><head><link rel="canonical" href="https://other.example.com/"></head></html>';
    expect(checkCanonicalUrl(html, 'https://example.com').status).toBe('partial');
  });
  it('fails when no canonical link exists', () => {
    expect(checkCanonicalUrl('<html></html>', 'https://example.com').status).toBe('fail');
  });
});

// --- 4.10 Heading Hierarchy ---

describe('checkHeadingHierarchy', () => {
  it('passes with one h1 and at least one h2 and no skips', () => {
    expect(checkHeadingHierarchy('<h1>A</h1><h2>B</h2><h3>C</h3>').status).toBe('pass');
  });
  it('flags missing h2 / extra h1 as a single-issue partial', () => {
    expect(checkHeadingHierarchy('<h1>A</h1>').status).toBe('partial');
  });
  it('fails on heading-level skip plus missing h2', () => {
    expect(checkHeadingHierarchy('<h1>A</h1><h3>C</h3>').status).toBe('fail');
  });
  it('fails when there are no headings at all', () => {
    expect(checkHeadingHierarchy('<p>no headings</p>').status).toBe('fail');
  });
});

// --- 4.11 Image Alt Coverage ---

describe('checkImageAltCoverage', () => {
  it('passes when >=80% of images have alt attributes', () => {
    const html = '<img src="a" alt=""><img src="b" alt="b"><img src="c" alt="c"><img src="d" alt="d"><img src="e">';
    expect(checkImageAltCoverage(html).status).toBe('pass');
  });
  it('partial when 50-79% have alt', () => {
    const html = '<img src="a" alt=""><img src="b" alt="b"><img src="c"><img src="d">';
    expect(checkImageAltCoverage(html).status).toBe('partial');
  });
  it('returns na when no images', () => {
    expect(checkImageAltCoverage('<p>no images</p>').status).toBe('na');
  });
});

// --- 4.12 Substantive Content ---

describe('checkSubstantiveContent', () => {
  it('passes when >= 300 words of stripped content', () => {
    const word = 'lorem ';
    const html = `<html><body><p>${word.repeat(320)}</p></body></html>`;
    expect(checkSubstantiveContent(html).status).toBe('pass');
  });
  it('partial when 150-299 words', () => {
    const html = `<html><body><p>${'word '.repeat(200)}</p></body></html>`;
    expect(checkSubstantiveContent(html).status).toBe('partial');
  });
  it('fails when fewer than 150 words', () => {
    expect(checkSubstantiveContent('<html><body><p>only a few words.</p></body></html>').status).toBe('fail');
  });
  it('strips nav/footer/script before counting', () => {
    const html = `<html><body><nav>${'menu '.repeat(500)}</nav><p>only a few words.</p><footer>${'foot '.repeat(500)}</footer></body></html>`;
    expect(checkSubstantiveContent(html).status).toBe('fail');
  });
});
