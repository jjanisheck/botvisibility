import { CheckResult } from './types.js';

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

// Individual check functions

export async function checkLlmsTxt(baseUrl: string): Promise<CheckResult> {
  const url = `${baseUrl}/llms.txt`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'text/plain' },
    });

    if (res.ok) {
      const text = await res.text();
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
          details: `Found at ${url} (${text.length} chars)`,
          foundAt: url
        };
      } else {
        return {
          id: '1.1',
          name: 'llms.txt',
          passed: false,
          status: 'partial',
          level: 1,
          category: 'Discoverable',
          autoDetectable: true,
          message: 'llms.txt exists but appears incomplete',
          recommendation: 'Add app description, API links, and documentation references.'
        };
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
      recommendation: 'Create /llms.txt with app description and API links. See llmstxt.org'
    };
  } catch (e) {
    return {
      id: '1.1',
      name: 'llms.txt',
      passed: false,
      status: 'fail',
      level: 1,
      category: 'Discoverable',
      autoDetectable: true,
      message: 'Failed to check llms.txt',
      details: e instanceof Error ? e.message : 'Network error'
    };
  }
}

export async function checkAgentCard(baseUrl: string): Promise<CheckResult> {
  const url = `${baseUrl}/.well-known/agent-card.json`;
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (res.ok) {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        const requiredFields = ['name', 'description', 'url'];
        const hasRequired = requiredFields.every(f => f in json);

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
            message: 'Agent card missing required fields',
            details: `Missing: ${missing.join(', ')}`
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
          message: 'agent-card.json is invalid JSON'
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
      recommendation: 'Create /.well-known/agent-card.json'
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
      const res = await fetch(url, {
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
    recommendation: 'Publish an OpenAPI 3.x spec at /openapi.json'
  };
}

export async function checkRobotsTxt(baseUrl: string): Promise<CheckResult> {
  const url = `${baseUrl}/robots.txt`;
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'text/plain' }
    });

    if (res.ok) {
      const text = await res.text().then(t => t.toLowerCase());

      const aiAgents = ['gptbot', 'claudebot', 'googlebot-extended', 'anthropic', 'openai'];
      const blockedAgents = aiAgents.filter(agent => {
        const regex = new RegExp(`user-agent:\\s*${agent}[\\s\\S]*?disallow:\\s*/`, 'i');
        return regex.test(text);
      });

      if (blockedAgents.length === 0) {
        return {
          id: '1.4',
          name: 'robots.txt AI Policy',
          passed: true,
          status: 'pass',
          level: 1,
          category: 'Discoverable',
          autoDetectable: true,
          message: 'robots.txt allows AI crawlers',
          foundAt: url
        };
      } else {
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
          recommendation: 'Remove Disallow rules for AI agents'
        };
      }
    }

    return {
      id: '1.4',
      name: 'robots.txt AI Policy',
      passed: true,
      status: 'pass',
      level: 1,
      category: 'Discoverable',
      autoDetectable: true,
      message: 'No robots.txt (nothing blocked)'
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
    const res = await fetch(baseUrl, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'GET'
      }
    });

    const corsHeader = res.headers.get('access-control-allow-origin');

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
        details: `Allow-Origin: ${corsHeader}`
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
      recommendation: 'Add Access-Control-Allow-Origin headers'
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
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (res.ok) {
      const json = await res.json();
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
      message: 'No OpenID configuration found'
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
    const res = await fetch(baseUrl, {
      headers: { 'Accept': 'text/html' }
    });

    if (res.ok) {
      const html = await res.text();
      const hasJsonLd = html.includes('application/ld+json');
      const hasDevLinks = html.includes('/docs') || html.includes('/api') || html.includes('developer');

      if (hasJsonLd) {
        return {
          id: '1.5',
          name: 'Documentation Accessibility',
          passed: true,
          status: 'pass',
          level: 1,
          category: 'Discoverable',
          autoDetectable: true,
          message: 'Page has structured data (JSON-LD)'
        };
      } else if (hasDevLinks) {
        return {
          id: '1.5',
          name: 'Documentation Accessibility',
          passed: true,
          status: 'partial',
          level: 1,
          category: 'Discoverable',
          autoDetectable: true,
          message: 'Page has documentation links'
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
      recommendation: 'Add JSON-LD structured data'
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
    const res = await fetch(baseUrl, { method: 'GET' });

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
      recommendation: 'Add X-RateLimit-* headers to API responses'
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
    const res = await fetch(baseUrl, { method: 'GET' });

    const etag = res.headers.get('etag');
    const cacheControl = res.headers.get('cache-control');

    if (etag && cacheControl) {
      return {
        id: '3.7',
        name: 'Caching Headers',
        passed: true,
        status: 'pass',
        level: 3,
        category: 'Optimized',
        autoDetectable: true,
        message: 'Caching headers present'
      };
    } else if (etag || cacheControl) {
      return {
        id: '3.7',
        name: 'Caching Headers',
        passed: false,
        status: 'partial',
        level: 3,
        category: 'Optimized',
        autoDetectable: true,
        message: 'Partial caching support',
        recommendation: 'Add ETag headers for conditional requests'
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
      recommendation: 'Add ETag or Last-Modified headers'
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

// Run all URL checks
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
