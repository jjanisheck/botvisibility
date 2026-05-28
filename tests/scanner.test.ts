import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  normalizeUrl,
  parseOpenApiSpec,
  checkOpenApiSpecFromParsed,
  checkApiReadOps,
  checkApiWriteOps,
  checkApiKeyAuth,
  checkScopedApiKeys,
  checkAsyncOps,
  checkIdempotency,
  checkSparseFields,
  checkCursorPagination,
  checkSearchFiltering,
  checkBulkOps,
  checkAiMetaTags,
  checkLinkHeaders,
  checkStructuredData,
  checkMcpServer,
  checkMcpToolQuality,
} from '../src/scanner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): Record<string, unknown> {
  const raw = readFileSync(join(__dirname, 'fixtures', name), 'utf-8');
  return JSON.parse(raw);
}

describe('normalizeUrl', () => {
  it('adds https:// when missing', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
  });

  it('keeps explicit https://', () => {
    expect(normalizeUrl('https://example.com/path')).toBe('https://example.com');
  });

  it('keeps explicit http://', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com');
  });

  it('strips path and query', () => {
    expect(normalizeUrl('https://example.com/foo?bar=1')).toBe('https://example.com');
  });
});

describe('parseOpenApiSpec', () => {
  it('detects only GET endpoints in a minimal spec', () => {
    const parsed = parseOpenApiSpec(loadFixture('openapi-minimal.json'));
    expect(parsed.hasGetEndpoints).toBe(true);
    expect(parsed.hasWriteEndpoints).toBe(false);
    expect(parsed.hasApiKeyAuth).toBe(false);
    expect(parsed.hasCursorPagination).toBe(false);
  });

  it('detects all rich features in the rich fixture', () => {
    const parsed = parseOpenApiSpec(loadFixture('openapi-rich.json'));
    expect(parsed.hasGetEndpoints).toBe(true);
    expect(parsed.hasWriteEndpoints).toBe(true);
    expect(parsed.hasApiKeyAuth).toBe(true);
    expect(parsed.hasScopedAuth).toBe(true);
    expect(parsed.hasIdempotencyKey).toBe(true);
    expect(parsed.hasSparseFields).toBe(true);
    expect(parsed.hasCursorPagination).toBe(true);
    expect(parsed.hasSearchFiltering).toBe(true);
    expect(parsed.hasBulkOperations).toBe(true);
    expect(parsed.hasAsyncPatterns).toBe(true);
  });
});

describe('check functions on parsed spec', () => {
  const minimal = parseOpenApiSpec(loadFixture('openapi-minimal.json'));
  const rich = parseOpenApiSpec(loadFixture('openapi-rich.json'));

  it('checkOpenApiSpecFromParsed passes when spec exists', () => {
    expect(checkOpenApiSpecFromParsed(rich).status).toBe('pass');
  });

  it('checkOpenApiSpecFromParsed fails when no spec', () => {
    expect(checkOpenApiSpecFromParsed(null).status).toBe('fail');
  });

  it('checkApiReadOps passes for both fixtures', () => {
    expect(checkApiReadOps(minimal).status).toBe('pass');
    expect(checkApiReadOps(rich).status).toBe('pass');
  });

  it('checkApiWriteOps fails on minimal, passes on rich', () => {
    expect(checkApiWriteOps(minimal).status).toBe('fail');
    expect(checkApiWriteOps(rich).status).toBe('pass');
  });

  it('checkApiKeyAuth fails on minimal, passes on rich', () => {
    expect(checkApiKeyAuth(minimal).status).toBe('fail');
    expect(checkApiKeyAuth(rich).status).toBe('pass');
  });

  it('checkScopedApiKeys passes on rich (oauth2 scopes)', () => {
    expect(checkScopedApiKeys(rich).status).toBe('pass');
  });

  it('checkAsyncOps passes on rich (202 responses)', () => {
    expect(checkAsyncOps(rich).status).toBe('pass');
    // Minimal spec has no write endpoints, so async ops are N/A.
    expect(checkAsyncOps(minimal).status).toBe('na');
  });

  it('checkIdempotency passes on rich', () => {
    expect(checkIdempotency(rich).status).toBe('pass');
    // Minimal spec has no write endpoints, so idempotency is N/A.
    expect(checkIdempotency(minimal).status).toBe('na');
  });

  it('checkSparseFields passes on rich', () => {
    expect(checkSparseFields(rich).status).toBe('pass');
  });

  it('checkCursorPagination passes on rich', () => {
    expect(checkCursorPagination(rich).status).toBe('pass');
  });

  it('checkSearchFiltering passes on rich', () => {
    expect(checkSearchFiltering(rich).status).toBe('pass');
  });

  it('checkBulkOps passes on rich', () => {
    expect(checkBulkOps(rich).status).toBe('pass');
  });

  it('all spec checks return na when spec is null', () => {
    // When no spec is found, the scanner marks API checks as N/A
    // (not failures) so they don't penalize sites without an API.
    expect(checkApiReadOps(null).status).toBe('na');
    expect(checkApiWriteOps(null).status).toBe('na');
    expect(checkApiKeyAuth(null).status).toBe('na');
    expect(checkSparseFields(null).status).toBe('na');
  });
});

describe('HTML-based checks', () => {
  it('checkAiMetaTags passes when llms:description and a second tag are present', () => {
    const html =
      '<html><head>' +
      '<meta name="llms:description" content="x">' +
      '<meta name="llms:url" content="/llms.txt">' +
      '</head></html>';
    expect(checkAiMetaTags(html).status).toBe('pass');
  });

  it('checkAiMetaTags is partial with only llms:description', () => {
    const html = '<html><head><meta name="llms:description" content="x"></head></html>';
    expect(checkAiMetaTags(html).status).toBe('partial');
  });

  it('checkAiMetaTags fails when no llms meta tags', () => {
    const html = '<html><head><title>x</title></head></html>';
    expect(checkAiMetaTags(html).status).toBe('fail');
  });

  it('checkAiMetaTags fails when html is null', () => {
    expect(checkAiMetaTags(null).status).toBe('fail');
  });

  it('checkLinkHeaders passes when a link to llms.txt is present', () => {
    const html = '<html><head><link rel="alternate" href="/llms.txt"></head></html>';
    expect(checkLinkHeaders(html).status).toBe('pass');
  });

  it('checkLinkHeaders fails when no relevant link tags', () => {
    expect(checkLinkHeaders('<html></html>').status).toBe('fail');
  });

  it('checkStructuredData passes when JSON-LD contains potentialAction', () => {
    const json = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      potentialAction: { '@type': 'SearchAction' },
    });
    const html = `<html><head><script type="application/ld+json">${json}</script></head></html>`;
    expect(checkStructuredData(html).status).toBe('pass');
  });

  it('checkStructuredData fails when JSON-LD lacks potentialAction', () => {
    const html = '<html><head><script type="application/ld+json">{}</script></head></html>';
    expect(checkStructuredData(html).status).toBe('fail');
  });
});

// --- MCP Server checks (1.12, 3.7) ---

function mockFetchOnce(url: string, body: unknown): void {
  const mock = vi.fn(async (reqUrl: RequestInfo | URL) => {
    const u = typeof reqUrl === 'string' ? reqUrl : reqUrl.toString();
    if (u === url) {
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('not found', { status: 404 });
  });
  vi.stubGlobal('fetch', mock);
}

function mockFetchAll404(): void {
  const mock = vi.fn(async () => new Response('not found', { status: 404 }));
  vi.stubGlobal('fetch', mock);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('checkMcpServer', () => {
  it('passes when /.well-known/mcp.json returns valid JSON', async () => {
    mockFetchOnce('https://example.com/.well-known/mcp.json', {
      endpoint: 'https://example.com/mcp',
      tools: [],
    });
    const result = await checkMcpServer('https://example.com');
    expect(result.status).toBe('pass');
    expect(result.id).toBe('1.12');
  });

  it('fails when no MCP file is found at any well-known path', async () => {
    mockFetchAll404();
    const result = await checkMcpServer('https://example.com');
    expect(result.status).toBe('fail');
    expect(result.id).toBe('1.12');
  });
});

describe('checkMcpToolQuality', () => {
  it('passes when 80%+ of MCP tools have name, description, and inputSchema', async () => {
    mockFetchOnce('https://example.com/.well-known/mcp.json', {
      endpoint: 'https://example.com/mcp',
      tools: [
        {
          name: 'search',
          description: 'Search for items by keyword and filter by tag.',
          inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
        },
        {
          name: 'create_item',
          description: 'Create a new item with the given title and body.',
          inputSchema: { type: 'object', properties: { title: { type: 'string' } } },
        },
      ],
    });
    const result = await checkMcpToolQuality('https://example.com');
    expect(result.status).toBe('pass');
    expect(result.id).toBe('3.7');
  });

  it('returns na when no MCP server is discovered', async () => {
    mockFetchAll404();
    const result = await checkMcpToolQuality('https://example.com');
    expect(result.status).toBe('na');
    expect(result.id).toBe('3.7');
  });

  it('fails when MCP file exists but tools are missing descriptions', async () => {
    mockFetchOnce('https://example.com/.well-known/mcp.json', {
      tools: [
        { name: 'a' }, // no description, no schema
        { name: 'b' },
        { name: 'c' },
      ],
    });
    const result = await checkMcpToolQuality('https://example.com');
    expect(result.status).toBe('fail');
  });

  it('fails when MCP file lists no tools at all', async () => {
    mockFetchOnce('https://example.com/.well-known/mcp.json', {
      endpoint: 'https://example.com/mcp',
      tools: [],
    });
    const result = await checkMcpToolQuality('https://example.com');
    expect(result.status).toBe('fail');
  });
});
