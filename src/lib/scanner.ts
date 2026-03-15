import { CheckResult } from './types';

const BOT_USER_AGENT = 'BotVisibility/1.0 (+https://botvisibility.com; agent-readiness-scanner)';
const FETCH_TIMEOUT = 10000; // 10 seconds

// Wrapper around fetch with User-Agent, timeout, and error handling
async function safeFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const headers: Record<string, string> = {
      'User-Agent': BOT_USER_AGENT,
    };
    if (opts.headers) {
      const h = opts.headers as Record<string, string>;
      for (const [k, v] of Object.entries(h)) {
        headers[k] = v;
      }
    }

    const res = await fetch(url, {
      ...opts,
      headers,
      signal: controller.signal,
      redirect: 'follow',
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

// Validate URL format and normalize
export function normalizeUrl(input: string): string {
  let url = input.trim();

  // Add https:// if no protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  // Parse and rebuild to normalize
  const parsed = new URL(url);
  return parsed.origin;
}

// Individual check functions - each returns a CheckResult

export async function checkLlmsTxt(baseUrl: string): Promise<CheckResult> {
  const paths = ['/llms.txt', '/llms-full.txt', '/.well-known/llms.txt'];

  for (const path of paths) {
    const url = `${baseUrl}${path}`;
    try {
      const res = await safeFetch(url, {
        method: 'GET',
        headers: { 'Accept': 'text/plain' },
      });

      if (res.ok) {
        const text = await res.text();
        // Verify it's actually text content, not an HTML error page
        const isHtml = text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html');
        if (isHtml) continue;

        const hasContent = text.length > 50;
        const hasMarkdownStyle = text.includes('#') || text.includes('##');
        const hasLinks = text.includes('http://') || text.includes('https://');

        if (hasContent && (hasMarkdownStyle || hasLinks)) {
          return {
            id: '1.1',
            name: 'llms.txt',
            passed: true,
            status: 'pass',
            level: 1,
            category: 'Discoverable',
            autoDetectable: true,
            message: 'llms.txt exists with valid content',
            details: `Found at ${path} (${text.length} chars)`,
            foundAt: url
          };
        } else if (hasContent) {
          return {
            id: '1.1',
            name: 'llms.txt',
            passed: true,
            status: 'partial',
            level: 1,
            category: 'Discoverable',
            autoDetectable: true,
            message: 'llms.txt exists but could be improved',
            details: `Found at ${path} but missing markdown structure or links`,
            recommendation: 'Add app description, API links, and documentation references. See llmstxt.org for format.',
            foundAt: url
          };
        }
      }
    } catch {
      // Try next path
    }
  }

  return {
    id: '1.1',
    name: 'llms.txt',
    passed: false,
    status: 'fail',
    level: 1,
    category: 'Discoverable',
    autoDetectable: true,
    message: 'No llms.txt found',
    recommendation: 'Create /llms.txt with app description, capabilities, and API documentation links. Takes ~15 minutes. See llmstxt.org'
  };
}

export async function checkAgentCard(baseUrl: string): Promise<CheckResult> {
  const url = `${baseUrl}/.well-known/agent-card.json`;
  try {
    const res = await safeFetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (res.ok) {
      const text = await res.text();
      // Skip if server returned HTML (soft 404)
      const isHtml = text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html');
      if (isHtml) {
        return {
          id: '1.2',
          name: 'Agent Card',
          passed: false,
          status: 'fail',
          level: 1,
          category: 'Discoverable',
          autoDetectable: true,
          message: 'No agent-card.json found',
          recommendation: 'Create /.well-known/agent-card.json with name, description, url, api spec URL, and auth info. Takes ~15 minutes.'
        };
      }
      try {
        const json = JSON.parse(text);
        const requiredFields = ['name', 'description', 'url'];
        const optionalFields = ['api', 'auth', 'capabilities', 'contact'];
        const hasRequired = requiredFields.every(f => f in json);
        const hasOptional = optionalFields.filter(f => f in json).length;

        if (hasRequired) {
          return {
            id: '1.2',
            name: 'Agent Card',
            passed: true,
            status: 'pass',
            level: 1,
            category: 'Discoverable',
            autoDetectable: true,
            message: 'Valid agent-card.json found',
            details: `Has required fields + ${hasOptional} optional fields`,
            foundAt: url
          };
        } else {
          const missing = requiredFields.filter(f => !(f in json));
          return {
            id: '1.2',
            name: 'Agent Card',
            passed: false,
            status: 'partial',
            level: 1,
            category: 'Discoverable',
            autoDetectable: true,
            message: 'Agent card exists but missing required fields',
            details: `Missing: ${missing.join(', ')}`,
            recommendation: `Add missing fields: ${missing.join(', ')}`,
            foundAt: url
          };
        }
      } catch {
        return {
          id: '1.2',
          name: 'Agent Card',
          passed: false,
          status: 'fail',
          level: 1,
          category: 'Discoverable',
          autoDetectable: true,
          message: 'agent-card.json exists but is invalid JSON',
          recommendation: 'Fix JSON syntax errors in /.well-known/agent-card.json',
          foundAt: url
        };
      }
    }

    return {
      id: '1.2',
      name: 'Agent Card',
      passed: false,
      status: 'fail',
      level: 1,
      category: 'Discoverable',
      autoDetectable: true,
      message: 'No agent-card.json found',
      recommendation: 'Create /.well-known/agent-card.json with name, description, url, api spec URL, and auth info. Takes ~15 minutes.'
    };
  } catch (e) {
    return {
      id: '1.2',
      name: 'Agent Card',
      passed: false,
      status: 'fail',
      level: 1,
      category: 'Discoverable',
      autoDetectable: true,
      message: 'Failed to check agent-card.json',
      details: e instanceof Error ? e.message : 'Network error'
    };
  }
}

export async function checkOpenApiSpec(baseUrl: string): Promise<CheckResult> {
  const paths = [
    '/openapi.json',
    '/openapi.yaml',
    '/swagger.json',
    '/api-docs',
    '/api/openapi.json',
    '/docs/openapi.json',
    '/v1/openapi.json'
  ];

  for (const path of paths) {
    try {
      const url = `${baseUrl}${path}`;
      const res = await safeFetch(url, {
        headers: { 'Accept': 'application/json, application/yaml, text/yaml' }
      });

      if (res.ok) {
        const text = await res.text();
        const isOpenApi = text.includes('openapi') || text.includes('swagger') || text.includes('paths');

        if (isOpenApi) {
          return {
            id: '1.3',
            name: 'OpenAPI Spec',
            passed: true,
            status: 'pass',
            level: 1,
            category: 'Discoverable',
            autoDetectable: true,
            message: 'OpenAPI/Swagger spec found',
            details: `Found at ${path}`,
            foundAt: url
          };
        }
      }
    } catch {
      // Continue to next path
    }
  }

  return {
    id: '1.3',
    name: 'OpenAPI Spec',
    passed: false,
    status: 'fail',
    level: 1,
    category: 'Discoverable',
    autoDetectable: true,
    message: 'No OpenAPI/Swagger spec found',
    recommendation: 'Publish an OpenAPI 3.x spec at /openapi.json. This single file makes your entire API usable by every agent framework. Takes 30-45 min for basic endpoints.'
  };
}

export async function checkRobotsTxt(baseUrl: string): Promise<CheckResult> {
  const url = `${baseUrl}/robots.txt`;
  try {
    const res = await safeFetch(url, {
      headers: { 'Accept': 'text/plain' }
    });

    if (res.ok) {
      const text = await res.text().then(t => t.toLowerCase());

      const aiAgents = ['gptbot', 'claudebot', 'googlebot-extended', 'anthropic', 'openai'];
      const blockedAgents = aiAgents.filter(agent => {
        const regex = new RegExp(`user-agent:\\s*${agent}[\\s\\S]*?disallow:\\s*/`, 'i');
        return regex.test(text);
      });

      const allowsApi = !text.includes('disallow: /api');
      const hasSitemap = text.includes('sitemap:');

      if (blockedAgents.length === 0 && allowsApi) {
        return {
          id: '1.4',
          name: 'robots.txt AI Policy',
          passed: true,
          status: 'pass',
          level: 1,
          category: 'Discoverable',
          autoDetectable: true,
          message: 'robots.txt allows AI crawlers',
          details: `No AI agents blocked, API paths accessible${hasSitemap ? ', sitemap referenced' : ''}`,
          foundAt: url
        };
      } else if (blockedAgents.length > 0) {
        return {
          id: '1.4',
          name: 'robots.txt AI Policy',
          passed: false,
          status: 'fail',
          level: 1,
          category: 'Discoverable',
          autoDetectable: true,
          message: 'robots.txt blocks AI crawlers',
          details: `Blocked: ${blockedAgents.join(', ')}`,
          recommendation: 'Remove Disallow rules for AI agents (GPTBot, ClaudeBot) to allow indexing of public docs and API.',
          foundAt: url
        };
      } else {
        return {
          id: '1.4',
          name: 'robots.txt AI Policy',
          passed: false,
          status: 'partial',
          level: 1,
          category: 'Discoverable',
          autoDetectable: true,
          message: 'robots.txt may block API paths',
          details: '/api paths may be disallowed',
          recommendation: 'Ensure /api and /docs paths are not blocked for AI crawlers.',
          foundAt: url
        };
      }
    }

    // No robots.txt is fine - means nothing is blocked
    return {
      id: '1.4',
      name: 'robots.txt AI Policy',
      passed: true,
      status: 'pass',
      level: 1,
      category: 'Discoverable',
      autoDetectable: true,
      message: 'No robots.txt (nothing blocked)',
      details: 'Site is fully accessible to crawlers'
    };
  } catch (e) {
    return {
      id: '1.4',
      name: 'robots.txt AI Policy',
      passed: false,
      status: 'unknown',
      level: 1,
      category: 'Discoverable',
      autoDetectable: true,
      message: 'Could not check robots.txt',
      details: e instanceof Error ? e.message : 'Network error'
    };
  }
}

export async function checkCorsHeaders(baseUrl: string): Promise<CheckResult> {
  try {
    // Try multiple methods to detect CORS headers
    // First try OPTIONS preflight
    let corsHeader: string | null = null;
    let corsMethodsHeader: string | null = null;

    try {
      const optRes = await safeFetch(baseUrl, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'GET'
        }
      });
      corsHeader = optRes.headers.get('access-control-allow-origin');
      corsMethodsHeader = optRes.headers.get('access-control-allow-methods');
    } catch {
      // OPTIONS might fail, that's ok
    }

    // If OPTIONS didn't work, try a regular GET and check for CORS header
    if (!corsHeader) {
      const getRes = await safeFetch(baseUrl, {
        method: 'GET',
        headers: { 'Origin': 'https://example.com' }
      });
      corsHeader = getRes.headers.get('access-control-allow-origin');
      corsMethodsHeader = getRes.headers.get('access-control-allow-methods');
    }

    if (corsHeader) {
      return {
        id: '1.5a',
        name: 'CORS Headers',
        passed: true,
        status: 'pass',
        level: 1,
        category: 'Discoverable',
        autoDetectable: true,
        message: 'CORS headers present',
        details: `Allow-Origin: ${corsHeader}${corsMethodsHeader ? `, Methods: ${corsMethodsHeader}` : ''}`
      };
    }

    return {
      id: '1.5a',
      name: 'CORS Headers',
      passed: false,
      status: 'fail',
      level: 1,
      category: 'Discoverable',
      autoDetectable: true,
      message: 'No CORS headers detected',
      recommendation: 'Add Access-Control-Allow-Origin headers to enable cross-origin API access for web-based agents.'
    };
  } catch {
    return {
      id: '1.5a',
      name: 'CORS Headers',
      passed: false,
      status: 'unknown',
      level: 1,
      category: 'Discoverable',
      autoDetectable: true,
      message: 'Could not check CORS headers'
    };
  }
}

export async function checkOpenIdConfig(baseUrl: string): Promise<CheckResult> {
  const url = `${baseUrl}/.well-known/openid-configuration`;
  try {
    const res = await safeFetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (res.ok) {
      const json = await res.json() as Record<string, unknown>;
      const hasIssuer = 'issuer' in json;
      const hasTokenEndpoint = 'token_endpoint' in json;

      if (hasIssuer && hasTokenEndpoint) {
        return {
          id: '2.2a',
          name: 'OpenID Configuration',
          passed: true,
          status: 'pass',
          level: 2,
          category: 'Usable',
          autoDetectable: true,
          message: 'OpenID Connect discovery available',
          details: `Issuer: ${json.issuer}`,
          foundAt: url
        };
      }
    }

    return {
      id: '2.2a',
      name: 'OpenID Configuration',
      passed: false,
      status: 'fail',
      level: 2,
      category: 'Usable',
      autoDetectable: true,
      message: 'No OpenID configuration found',
      details: 'Not required if using API keys for agent auth'
    };
  } catch {
    return {
      id: '2.2a',
      name: 'OpenID Configuration',
      passed: false,
      status: 'fail',
      level: 2,
      category: 'Usable',
      autoDetectable: true,
      message: 'No OpenID configuration found'
    };
  }
}

export async function checkStructuredData(baseUrl: string): Promise<CheckResult> {
  try {
    const res = await safeFetch(baseUrl, {
      headers: { 'Accept': 'text/html' }
    });

    if (res.ok) {
      const html = await res.text();

      // Check for JSON-LD
      const hasJsonLd = html.includes('application/ld+json');
      // Check for OpenGraph / meta description (helps bots understand the page)
      const hasOgTags = html.includes('og:title') || html.includes('og:description');
      const hasMetaDescription = html.includes('name="description"') || html.includes('name=\'description\'');
      // Check for developer/documentation links
      const hasDevLinks = html.includes('/docs') || html.includes('/api') || html.includes('developer') || html.includes('documentation');
      // Check for sitemap reference
      const hasSitemap = html.includes('sitemap');

      if (hasJsonLd) {
        return {
          id: '1.5',
          name: 'Documentation Accessibility',
          passed: true,
          status: 'pass',
          level: 1,
          category: 'Discoverable',
          autoDetectable: true,
          message: 'Page has structured data (JSON-LD)',
          details: 'Structured data helps agents understand page content'
        };
      } else if (hasDevLinks || (hasOgTags && hasMetaDescription)) {
        return {
          id: '1.5',
          name: 'Documentation Accessibility',
          passed: true,
          status: 'pass',
          level: 1,
          category: 'Discoverable',
          autoDetectable: true,
          message: hasDevLinks ? 'Page has documentation/API links' : 'Page has rich meta tags for discoverability',
          details: hasDevLinks ? 'Found links to docs or API' : 'OpenGraph and meta description present'
        };
      } else if (hasOgTags || hasMetaDescription || hasSitemap) {
        return {
          id: '1.5',
          name: 'Documentation Accessibility',
          passed: true,
          status: 'partial',
          level: 1,
          category: 'Discoverable',
          autoDetectable: true,
          message: 'Basic page discoverability present',
          details: 'Some meta tags found, but no structured data or doc links',
          recommendation: 'Add JSON-LD structured data and ensure docs are accessible without JavaScript.'
        };
      }
    }

    return {
      id: '1.5',
      name: 'Documentation Accessibility',
      passed: false,
      status: 'fail',
      level: 1,
      category: 'Discoverable',
      autoDetectable: true,
      message: 'No structured data or doc links found',
      recommendation: 'Add JSON-LD structured data and ensure docs are accessible without JavaScript.'
    };
  } catch {
    return {
      id: '1.5',
      name: 'Documentation Accessibility',
      passed: false,
      status: 'unknown',
      level: 1,
      category: 'Discoverable',
      autoDetectable: true,
      message: 'Could not fetch homepage'
    };
  }
}

export async function checkRateLimitHeaders(baseUrl: string): Promise<CheckResult> {
  try {
    const res = await safeFetch(baseUrl, { method: 'GET' });

    const rateLimitHeaders = [
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
      'ratelimit-limit',
      'ratelimit-remaining',
      'retry-after'
    ];

    const foundHeaders: string[] = [];
    for (const header of rateLimitHeaders) {
      if (res.headers.get(header)) {
        foundHeaders.push(header);
      }
    }

    if (foundHeaders.length >= 2) {
      return {
        id: '3.6',
        name: 'Rate Limit Headers',
        passed: true,
        status: 'pass',
        level: 3,
        category: 'Optimized',
        autoDetectable: true,
        message: 'Rate limit headers present',
        details: `Found: ${foundHeaders.join(', ')}`
      };
    } else if (foundHeaders.length === 1) {
      return {
        id: '3.6',
        name: 'Rate Limit Headers',
        passed: false,
        status: 'partial',
        level: 3,
        category: 'Optimized',
        autoDetectable: true,
        message: 'Partial rate limit headers',
        details: `Found: ${foundHeaders.join(', ')}`,
        recommendation: 'Add X-RateLimit-Remaining and X-RateLimit-Reset headers'
      };
    }

    return {
      id: '3.6',
      name: 'Rate Limit Headers',
      passed: false,
      status: 'fail',
      level: 3,
      category: 'Optimized',
      autoDetectable: true,
      message: 'No rate limit headers',
      recommendation: 'Add X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers to all API responses.'
    };
  } catch {
    return {
      id: '3.6',
      name: 'Rate Limit Headers',
      passed: false,
      status: 'unknown',
      level: 3,
      category: 'Optimized',
      autoDetectable: true,
      message: 'Could not check rate limit headers'
    };
  }
}

export async function checkCachingHeaders(baseUrl: string): Promise<CheckResult> {
  try {
    const res = await safeFetch(baseUrl, { method: 'GET' });

    const etag = res.headers.get('etag');
    const lastModified = res.headers.get('last-modified');
    const cacheControl = res.headers.get('cache-control');

    const cachingSignals = [etag, lastModified, cacheControl].filter(Boolean);

    if (cachingSignals.length >= 2) {
      return {
        id: '3.7',
        name: 'Caching Headers',
        passed: true,
        status: 'pass',
        level: 3,
        category: 'Optimized',
        autoDetectable: true,
        message: 'Caching headers present',
        details: `ETag: ${etag ? 'yes' : 'no'}, Cache-Control: ${cacheControl || 'no'}, Last-Modified: ${lastModified ? 'yes' : 'no'}`
      };
    } else if (cachingSignals.length === 1) {
      return {
        id: '3.7',
        name: 'Caching Headers',
        passed: true,
        status: 'partial',
        level: 3,
        category: 'Optimized',
        autoDetectable: true,
        message: 'Basic caching support',
        details: `ETag: ${etag || 'no'}, Cache-Control: ${cacheControl || 'no'}, Last-Modified: ${lastModified || 'no'}`,
        recommendation: 'Add ETag headers alongside Cache-Control for conditional requests support.'
      };
    }

    return {
      id: '3.7',
      name: 'Caching Headers',
      passed: false,
      status: 'fail',
      level: 3,
      category: 'Optimized',
      autoDetectable: true,
      message: 'No caching headers',
      recommendation: 'Add ETag or Last-Modified headers to enable 304 responses and reduce token cost for repeated reads.'
    };
  } catch {
    return {
      id: '3.7',
      name: 'Caching Headers',
      passed: false,
      status: 'unknown',
      level: 3,
      category: 'Optimized',
      autoDetectable: true,
      message: 'Could not check caching headers'
    };
  }
}

// Run all checks
export async function runAllChecks(baseUrl: string): Promise<CheckResult[]> {
  const checks = await Promise.all([
    checkLlmsTxt(baseUrl),
    checkAgentCard(baseUrl),
    checkOpenApiSpec(baseUrl),
    checkRobotsTxt(baseUrl),
    checkStructuredData(baseUrl),
    checkCorsHeaders(baseUrl),
    checkOpenIdConfig(baseUrl),
    checkRateLimitHeaders(baseUrl),
    checkCachingHeaders(baseUrl),
  ]);

  return checks;
}

// Run checks one by one for streaming
export async function* runChecksIterator(baseUrl: string): AsyncGenerator<CheckResult> {
  yield await checkLlmsTxt(baseUrl);
  yield await checkAgentCard(baseUrl);
  yield await checkOpenApiSpec(baseUrl);
  yield await checkRobotsTxt(baseUrl);
  yield await checkStructuredData(baseUrl);
  yield await checkCorsHeaders(baseUrl);
  yield await checkOpenIdConfig(baseUrl);
  yield await checkRateLimitHeaders(baseUrl);
  yield await checkCachingHeaders(baseUrl);
}
