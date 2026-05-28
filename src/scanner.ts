import { CheckResult } from './types.js';

const FETCH_TIMEOUT = 10000;

// --- OpenAPI Spec Mining Types ---

export interface ParsedOpenApiSpec {
  raw: Record<string, unknown>;
  paths: Record<string, Record<string, unknown>>;
  hasGetEndpoints: boolean;
  hasWriteEndpoints: boolean;
  hasNonGetEndpoints: boolean;
  securitySchemes: Record<string, unknown>;
  hasApiKeyAuth: boolean;
  hasScopedAuth: boolean;
  hasAsyncPatterns: boolean;
  hasIdempotencyKey: boolean;
  hasSparseFields: boolean;
  hasCursorPagination: boolean;
  hasSearchFiltering: boolean;
  hasBulkOperations: boolean;
}

// Validate URL format and normalize
export function normalizeUrl(input: string): string {
  let url = input.trim();

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  const parsed = new URL(url);
  return parsed.origin;
}

// --- OpenAPI Spec Mining ---

export function parseOpenApiSpec(spec: Record<string, unknown>): ParsedOpenApiSpec {
  const paths = (spec.paths ?? {}) as Record<string, Record<string, unknown>>;

  let hasGetEndpoints = false;
  let hasWriteEndpoints = false;
  let hasNonGetEndpoints = false;
  let hasAsyncPatterns = false;
  let hasIdempotencyKey = false;
  let hasSparseFields = false;
  let hasCursorPagination = false;
  let hasSearchFiltering = false;
  let hasBulkOperations = false;

  const specStr = JSON.stringify(spec).toLowerCase();

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;

    const methods = Object.keys(pathItem);
    for (const method of methods) {
      const m = method.toLowerCase();
      if (m === 'get') hasGetEndpoints = true;
      if (m === 'post' || m === 'put' || m === 'patch' || m === 'delete') {
        hasWriteEndpoints = true;
        hasNonGetEndpoints = true;
      }
      if (m === 'options' || m === 'head') hasNonGetEndpoints = true;

      const operation = pathItem[method];
      if (operation && typeof operation === 'object') {
        const opStr = JSON.stringify(operation).toLowerCase();

        if (opStr.includes('callback') || opStr.includes('webhook') || opStr.includes('"202"') || opStr.includes('async')) {
          hasAsyncPatterns = true;
        }
        if (opStr.includes('idempotency') || opStr.includes('idempotency-key') || opStr.includes('idempotencykey')) {
          hasIdempotencyKey = true;
        }
        if (opStr.includes('"fields"') || opStr.includes('sparse') || opStr.includes('fieldset')) {
          hasSparseFields = true;
        }
        if (opStr.includes('cursor') || opStr.includes('page_token') || opStr.includes('next_token') || opStr.includes('pagetoken')) {
          hasCursorPagination = true;
        }
        if (opStr.includes('"filter"') || opStr.includes('"search"') || opStr.includes('"query"') || opStr.includes('"q"')) {
          hasSearchFiltering = true;
        }
        if (opStr.includes('bulk') || opStr.includes('batch')) {
          hasBulkOperations = true;
        }
      }
    }

    const pathLower = pathKey.toLowerCase();
    if (pathLower.includes('bulk') || pathLower.includes('batch')) {
      hasBulkOperations = true;
    }
    if (pathLower.includes('search')) {
      hasSearchFiltering = true;
    }
  }

  if (spec.webhooks || specStr.includes('"callbacks"')) {
    hasAsyncPatterns = true;
  }

  const components = (spec.components ?? spec.securityDefinitions ?? {}) as Record<string, unknown>;
  const securitySchemes = ((components as Record<string, unknown>)?.securitySchemes ?? (spec.securityDefinitions as Record<string, unknown>) ?? {}) as Record<string, unknown>;

  let hasApiKeyAuth = false;
  let hasScopedAuth = false;

  for (const [, scheme] of Object.entries(securitySchemes)) {
    if (scheme && typeof scheme === 'object') {
      const s = scheme as Record<string, unknown>;
      if (s.type === 'apiKey' || s.type === 'http') {
        hasApiKeyAuth = true;
      }
      if (s.type === 'oauth2' || s.type === 'openIdConnect') {
        hasScopedAuth = true;
        hasApiKeyAuth = true;
      }
      if (s.flows && typeof s.flows === 'object') {
        const flows = s.flows as Record<string, unknown>;
        for (const flow of Object.values(flows)) {
          if (flow && typeof flow === 'object' && (flow as Record<string, unknown>).scopes) {
            hasScopedAuth = true;
          }
        }
      }
    }
  }

  return {
    raw: spec,
    paths,
    hasGetEndpoints,
    hasWriteEndpoints,
    hasNonGetEndpoints,
    securitySchemes,
    hasApiKeyAuth,
    hasScopedAuth,
    hasAsyncPatterns,
    hasIdempotencyKey,
    hasSparseFields,
    hasCursorPagination,
    hasSearchFiltering,
    hasBulkOperations,
  };
}

export async function fetchOpenApiSpec(baseUrl: string): Promise<ParsedOpenApiSpec | null> {
  const paths = [
    '/openapi.json',
    '/openapi.yaml',
    '/swagger.json',
    '/api-docs',
    '/api/openapi.json',
    '/docs/openapi.json',
    '/v1/openapi.json',
  ];

  for (const specPath of paths) {
    try {
      const url = `${baseUrl}${specPath}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json, application/yaml, text/yaml' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const text = await res.text();
        const isOpenApi = text.includes('openapi') || text.includes('swagger') || text.includes('paths');
        if (isOpenApi) {
          try {
            const json = JSON.parse(text) as Record<string, unknown>;
            return parseOpenApiSpec(json);
          } catch {
            // Not valid JSON, skip
          }
        }
      }
    } catch {
      // Continue to next path
    }
  }

  return null;
}

// --- Helper for fetch with timeout ---

async function timedFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Homepage HTML helper (fetch once, reuse for checks 1.5, 1.7, 1.11) ---

async function fetchHomepageHtml(baseUrl: string): Promise<string | null> {
  try {
    const res = await timedFetch(baseUrl, { headers: { 'Accept': 'text/html' } });
    if (res.ok) return await res.text();
    return null;
  } catch { return null; }
}

// --- Level 1 Check Functions ---

export async function checkLlmsTxt(baseUrl: string): Promise<CheckResult> {
  const paths = ['/llms.txt', '/llms-full.txt', '/.well-known/llms.txt'];

  for (const p of paths) {
    const url = `${baseUrl}${p}`;
    try {
      const res = await timedFetch(url, {
        method: 'GET',
        headers: { 'Accept': 'text/plain' },
      });

      if (res.ok) {
        const text = await res.text();
        const isHtml = text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html');
        if (isHtml) continue;

        const hasContent = text.length > 50;
        const hasMarkdownStyle = text.includes('#') || text.includes('##');
        const hasLinks = text.includes('http://') || text.includes('https://');

        if (hasContent && (hasMarkdownStyle || hasLinks)) {
          return {
            id: '1.1', name: 'llms.txt', passed: true, status: 'pass', level: 1, category: 'Discoverable', autoDetectable: true,
            message: 'llms.txt exists with valid content',
            details: `Found at ${p} (${text.length} chars)`,
            foundAt: url
          };
        } else if (hasContent) {
          return {
            id: '1.1', name: 'llms.txt', passed: true, status: 'partial', level: 1, category: 'Discoverable', autoDetectable: true,
            message: 'llms.txt exists but could be improved',
            details: `Found at ${p} but missing markdown structure or links`,
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
    id: '1.1', name: 'llms.txt', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true,
    message: 'No llms.txt found',
    recommendation: 'Create /llms.txt with app description, capabilities, and API documentation links. See llmstxt.org'
  };
}

export async function checkAgentCard(baseUrl: string): Promise<CheckResult> {
  const url = `${baseUrl}/.well-known/agent-card.json`;
  try {
    const res = await timedFetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (res.ok) {
      const text = await res.text();
      const isHtml = text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html');
      if (isHtml) {
        return {
          id: '1.2', name: 'Agent Card', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true,
          message: 'No agent-card.json found',
          recommendation: 'Create /.well-known/agent-card.json with name, description, url, api spec URL, and auth info.'
        };
      }
      try {
        const json = JSON.parse(text);
        const requiredFields = ['name', 'description', 'url'];
        const hasRequired = requiredFields.every(f => f in json);

        if (hasRequired) {
          return {
            id: '1.2', name: 'Agent Card', passed: true, status: 'pass', level: 1, category: 'Discoverable', autoDetectable: true,
            message: 'Valid agent-card.json found',
            foundAt: url
          };
        } else {
          const missing = requiredFields.filter(f => !(f in json));
          return {
            id: '1.2', name: 'Agent Card', passed: false, status: 'partial', level: 1, category: 'Discoverable', autoDetectable: true,
            message: 'Agent card exists but missing required fields',
            details: `Missing: ${missing.join(', ')}`,
            recommendation: `Add missing fields: ${missing.join(', ')}`,
            foundAt: url
          };
        }
      } catch {
        return {
          id: '1.2', name: 'Agent Card', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true,
          message: 'agent-card.json exists but is invalid JSON',
          recommendation: 'Fix JSON syntax errors in /.well-known/agent-card.json',
          foundAt: url
        };
      }
    }

    return {
      id: '1.2', name: 'Agent Card', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true,
      message: 'No agent-card.json found',
      recommendation: 'Create /.well-known/agent-card.json with name, description, url, api spec URL, and auth info.'
    };
  } catch (e) {
    return {
      id: '1.2', name: 'Agent Card', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true,
      message: 'Failed to check agent-card.json',
      details: e instanceof Error ? e.message : 'Network error'
    };
  }
}

export function checkOpenApiSpecFromParsed(spec: ParsedOpenApiSpec | null): CheckResult {
  if (spec) {
    return {
      id: '1.3', name: 'OpenAPI Spec', passed: true, status: 'pass', level: 1, category: 'Discoverable', autoDetectable: true,
      message: 'OpenAPI/Swagger spec found',
      details: `${Object.keys(spec.paths).length} paths detected`,
    };
  }

  return {
    id: '1.3', name: 'OpenAPI Spec', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true,
    message: 'No OpenAPI/Swagger spec found',
    recommendation: 'Publish an OpenAPI 3.x spec at /openapi.json'
  };
}

export async function checkRobotsTxt(baseUrl: string): Promise<CheckResult> {
  const url = `${baseUrl}/robots.txt`;
  try {
    const res = await timedFetch(url, {
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

      if (blockedAgents.length === 0 && allowsApi) {
        return {
          id: '1.4', name: 'robots.txt AI Policy', passed: true, status: 'pass', level: 1, category: 'Discoverable', autoDetectable: true,
          message: 'robots.txt allows AI crawlers',
          foundAt: url
        };
      } else if (blockedAgents.length > 0) {
        return {
          id: '1.4', name: 'robots.txt AI Policy', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true,
          message: 'robots.txt blocks AI crawlers',
          details: `Blocked: ${blockedAgents.join(', ')}`,
          recommendation: 'Remove Disallow rules for AI agents (GPTBot, ClaudeBot)'
        };
      } else {
        return {
          id: '1.4', name: 'robots.txt AI Policy', passed: false, status: 'partial', level: 1, category: 'Discoverable', autoDetectable: true,
          message: 'robots.txt may block API paths',
          recommendation: 'Ensure /api and /docs paths are not blocked for AI crawlers'
        };
      }
    }

    return {
      id: '1.4', name: 'robots.txt AI Policy', passed: true, status: 'pass', level: 1, category: 'Discoverable', autoDetectable: true,
      message: 'No robots.txt (nothing blocked)'
    };
  } catch (e) {
    return {
      id: '1.4', name: 'robots.txt AI Policy', passed: false, status: 'na', level: 1, category: 'Discoverable', autoDetectable: true,
      message: 'Could not check robots.txt',
      details: e instanceof Error ? e.message : 'Network error'
    };
  }
}

export function checkStructuredData(html: string | null): CheckResult {
  if (!html) {
    return { id: '1.5', name: 'Documentation Accessibility', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true, message: 'Could not fetch homepage' };
  }

  // Extract JSON-LD blocks
  const jsonLdRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const json = JSON.parse(match[1]);
      const hasAction = JSON.stringify(json).includes('potentialAction');
      if (hasAction) {
        return { id: '1.5', name: 'Documentation Accessibility', passed: true, status: 'pass', level: 1, category: 'Discoverable', autoDetectable: true, message: 'JSON-LD with potentialAction found', details: 'Structured data includes actionable entry points for agents' };
      }
    } catch { /* skip invalid JSON-LD */ }
  }

  return { id: '1.5', name: 'Documentation Accessibility', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true, message: 'No JSON-LD with potentialAction found', recommendation: 'Add Schema.org JSON-LD with potentialAction to make your site actionable by agents' };
}

export async function checkCorsHeaders(baseUrl: string): Promise<CheckResult> {
  try {
    let corsHeader: string | null = null;

    try {
      const optRes = await timedFetch(baseUrl, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'GET'
        }
      });
      corsHeader = optRes.headers.get('access-control-allow-origin');
    } catch {
      // OPTIONS might fail
    }

    if (!corsHeader) {
      const getRes = await timedFetch(baseUrl, {
        method: 'GET',
        headers: { 'Origin': 'https://example.com' }
      });
      corsHeader = getRes.headers.get('access-control-allow-origin');
    }

    if (corsHeader) {
      return {
        id: '1.6', name: 'CORS Headers', passed: true, status: 'pass', level: 1, category: 'Discoverable', autoDetectable: true,
        message: 'CORS headers present',
        details: `Allow-Origin: ${corsHeader}`
      };
    }

    return {
      id: '1.6', name: 'CORS Headers', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true,
      message: 'No CORS headers detected',
      recommendation: 'Add Access-Control-Allow-Origin headers to enable cross-origin API access.'
    };
  } catch {
    return {
      id: '1.6', name: 'CORS Headers', passed: false, status: 'na', level: 1, category: 'Discoverable', autoDetectable: true,
      message: 'Could not check CORS headers'
    };
  }
}

// --- New Level 1 Checks (1.7–1.11) ---

export function checkAiMetaTags(html: string | null): CheckResult {
  if (!html) {
    return { id: '1.7', name: 'AI Meta Tags', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true, message: 'Could not fetch homepage' };
  }
  const hasLlmsDesc = /meta\s+name=["']llms:description["']/i.test(html);
  const hasLlmsUrl = /meta\s+name=["']llms:url["']/i.test(html);
  const hasLlmsInstr = /meta\s+name=["']llms:instructions["']/i.test(html);
  const count = [hasLlmsDesc, hasLlmsUrl, hasLlmsInstr].filter(Boolean).length;

  if (hasLlmsDesc) {
    return { id: '1.7', name: 'AI Meta Tags', passed: true, status: count >= 2 ? 'pass' : 'partial', level: 1, category: 'Discoverable', autoDetectable: true, message: `Found ${count} AI meta tag${count > 1 ? 's' : ''} (llms:description${hasLlmsUrl ? ', llms:url' : ''}${hasLlmsInstr ? ', llms:instructions' : ''})` };
  }
  return { id: '1.7', name: 'AI Meta Tags', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true, message: 'No AI meta tags found', recommendation: 'Add <meta name="llms:description" content="..."> to your <head> for AI agent discovery' };
}

export async function checkSkillFile(baseUrl: string): Promise<CheckResult> {
  try {
    const res = await timedFetch(`${baseUrl}/skill.md`, { headers: { 'Accept': 'text/plain, text/markdown' } });
    if (res.ok) {
      const text = await res.text();
      const isHtml = text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html');
      if (isHtml) {
        return { id: '1.8', name: 'Skill File', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true, message: 'No skill.md found', recommendation: 'Create /skill.md with YAML frontmatter and step-by-step agent instructions' };
      }
      const hasContent = text.length > 50;
      const hasFrontmatter = text.trimStart().startsWith('---');
      const hasHeaders = text.includes('#');
      if (hasContent && (hasFrontmatter || hasHeaders)) {
        return { id: '1.8', name: 'Skill File', passed: true, status: 'pass', level: 1, category: 'Discoverable', autoDetectable: true, message: 'skill.md found with valid content', details: `${text.length} chars${hasFrontmatter ? ', has YAML frontmatter' : ''}`, foundAt: `${baseUrl}/skill.md` };
      }
      return { id: '1.8', name: 'Skill File', passed: false, status: 'partial', level: 1, category: 'Discoverable', autoDetectable: true, message: 'skill.md exists but may be incomplete', recommendation: 'Add YAML frontmatter and structured instructions to skill.md' };
    }
    return { id: '1.8', name: 'Skill File', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true, message: 'No skill.md found', recommendation: 'Create /skill.md with YAML frontmatter and step-by-step agent instructions' };
  } catch {
    return { id: '1.8', name: 'Skill File', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true, message: 'Could not check skill.md' };
  }
}

export async function checkAiSiteProfile(baseUrl: string): Promise<CheckResult> {
  try {
    const res = await timedFetch(`${baseUrl}/.well-known/ai.json`, { headers: { 'Accept': 'application/json' } });
    if (res.ok) {
      const text = await res.text();
      const isHtml = text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html');
      if (isHtml) {
        return { id: '1.9', name: 'AI Site Profile', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true, message: 'No ai.json found', recommendation: 'Create /.well-known/ai.json with name, capabilities, and links to skill files' };
      }
      try {
        const json = JSON.parse(text);
        const hasName = 'name' in json;
        const hasCaps = 'capabilities' in json || 'skills' in json;
        if (hasName && hasCaps) {
          return { id: '1.9', name: 'AI Site Profile', passed: true, status: 'pass', level: 1, category: 'Discoverable', autoDetectable: true, message: 'ai.json found with name and capabilities', foundAt: `${baseUrl}/.well-known/ai.json` };
        }
        return { id: '1.9', name: 'AI Site Profile', passed: false, status: 'partial', level: 1, category: 'Discoverable', autoDetectable: true, message: 'ai.json exists but missing required fields', recommendation: 'Add name and capabilities/skills fields to ai.json' };
      } catch {
        return { id: '1.9', name: 'AI Site Profile', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true, message: 'ai.json is invalid JSON' };
      }
    }
    return { id: '1.9', name: 'AI Site Profile', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true, message: 'No ai.json found', recommendation: 'Create /.well-known/ai.json with name, capabilities, and links to skill files' };
  } catch {
    return { id: '1.9', name: 'AI Site Profile', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true, message: 'Could not check ai.json' };
  }
}

export async function checkSkillsIndex(baseUrl: string): Promise<CheckResult> {
  try {
    const res = await timedFetch(`${baseUrl}/.well-known/skills/index.json`, { headers: { 'Accept': 'application/json' } });
    if (res.ok) {
      const text = await res.text();
      const isHtml = text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html');
      if (isHtml) {
        return { id: '1.10', name: 'Skills Index', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true, message: 'No skills index found', recommendation: 'Create /.well-known/skills/index.json listing all available agent skills' };
      }
      try {
        const json = JSON.parse(text);
        const arr = Array.isArray(json) ? json : (json.skills || json.items || []);
        if (Array.isArray(arr) && arr.length > 0 && arr[0].id && arr[0].name) {
          return { id: '1.10', name: 'Skills Index', passed: true, status: 'pass', level: 1, category: 'Discoverable', autoDetectable: true, message: `Skills index found with ${arr.length} skill${arr.length > 1 ? 's' : ''}`, foundAt: `${baseUrl}/.well-known/skills/index.json` };
        }
        return { id: '1.10', name: 'Skills Index', passed: false, status: 'partial', level: 1, category: 'Discoverable', autoDetectable: true, message: 'Skills index exists but entries missing id/name', recommendation: 'Each skill entry should have at least id and name fields' };
      } catch {
        return { id: '1.10', name: 'Skills Index', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true, message: 'Skills index is invalid JSON' };
      }
    }
    return { id: '1.10', name: 'Skills Index', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true, message: 'No skills index found', recommendation: 'Create /.well-known/skills/index.json listing all available agent skills' };
  } catch {
    return { id: '1.10', name: 'Skills Index', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true, message: 'Could not check skills index' };
  }
}

export function checkLinkHeaders(html: string | null): CheckResult {
  if (!html) {
    return { id: '1.11', name: 'Link Headers', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true, message: 'Could not fetch homepage' };
  }
  const linkRegex = /<link\s[^>]*href=["']([^"']*(?:llms\.txt|ai\.json|agent-card\.json)[^"']*)["'][^>]*>/gi;
  const found: string[] = [];
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    found.push(match[1]);
  }
  if (found.length > 0) {
    return { id: '1.11', name: 'Link Headers', passed: true, status: 'pass', level: 1, category: 'Discoverable', autoDetectable: true, message: `Found ${found.length} AI discovery link${found.length > 1 ? 's' : ''} in <head>`, details: found.join(', ') };
  }
  return { id: '1.11', name: 'Link Headers', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true, message: 'No AI discovery links in <head>', recommendation: 'Add <link> elements pointing to llms.txt, ai.json, or agent-card.json' };
}

// --- Level 2 Check Functions ---

export function checkApiReadOps(spec: ParsedOpenApiSpec | null): CheckResult {
  if (!spec) {
    return { id: '2.1', name: 'API Read Operations', passed: false, status: 'na', level: 2, category: 'Usable', autoDetectable: true, message: 'No OpenAPI spec found — cannot evaluate' };
  }
  return {
    id: '2.1', name: 'API Read Operations', level: 2, category: 'Usable', autoDetectable: true,
    passed: spec.hasGetEndpoints, status: spec.hasGetEndpoints ? 'pass' : 'fail',
    message: spec.hasGetEndpoints ? 'GET endpoints found in API spec' : 'No GET endpoints found in API spec',
    recommendation: spec.hasGetEndpoints ? undefined : 'Add GET endpoints for reading resources',
  };
}

export function checkApiWriteOps(spec: ParsedOpenApiSpec | null): CheckResult {
  if (!spec) {
    return { id: '2.2', name: 'API Write Operations', passed: false, status: 'na', level: 2, category: 'Usable', autoDetectable: true, message: 'No OpenAPI spec found — cannot evaluate' };
  }
  return {
    id: '2.2', name: 'API Write Operations', level: 2, category: 'Usable', autoDetectable: true,
    passed: spec.hasWriteEndpoints, status: spec.hasWriteEndpoints ? 'pass' : 'fail',
    message: spec.hasWriteEndpoints ? 'Write endpoints (POST/PUT/PATCH/DELETE) found' : 'No write endpoints found in API spec',
    recommendation: spec.hasWriteEndpoints ? undefined : 'Add POST/PUT/PATCH endpoints for creating and updating resources',
  };
}

export function checkApiPrimaryAction(spec: ParsedOpenApiSpec | null): CheckResult {
  if (!spec) {
    return { id: '2.3', name: 'API Primary Action', passed: false, status: 'na', level: 2, category: 'Usable', autoDetectable: true, message: 'No OpenAPI spec found — cannot evaluate' };
  }
  return {
    id: '2.3', name: 'API Primary Action', level: 2, category: 'Usable', autoDetectable: true,
    passed: spec.hasNonGetEndpoints, status: spec.hasNonGetEndpoints ? 'pass' : 'fail',
    message: spec.hasNonGetEndpoints ? 'Non-GET endpoints found — primary actions available' : 'Only GET endpoints found',
    recommendation: spec.hasNonGetEndpoints ? undefined : 'Add endpoints for primary actions (POST for creation, PUT/PATCH for updates)',
  };
}

export function checkApiKeyAuth(spec: ParsedOpenApiSpec | null): CheckResult {
  if (!spec) {
    return { id: '2.4', name: 'API Key Authentication', passed: false, status: 'na', level: 2, category: 'Usable', autoDetectable: true, message: 'No OpenAPI spec found — cannot evaluate' };
  }
  return {
    id: '2.4', name: 'API Key Authentication', level: 2, category: 'Usable', autoDetectable: true,
    passed: spec.hasApiKeyAuth, status: spec.hasApiKeyAuth ? 'pass' : 'fail',
    message: spec.hasApiKeyAuth ? 'API key or HTTP auth scheme found' : 'No API key authentication found in spec',
    recommendation: spec.hasApiKeyAuth ? undefined : 'Add securitySchemes with apiKey or http bearer auth',
  };
}

export function checkScopedApiKeys(spec: ParsedOpenApiSpec | null): CheckResult {
  if (!spec) {
    return { id: '2.5', name: 'Scoped API Keys', passed: false, status: 'na', level: 2, category: 'Usable', autoDetectable: true, message: 'No OpenAPI spec found — cannot evaluate' };
  }
  return {
    id: '2.5', name: 'Scoped API Keys', level: 2, category: 'Usable', autoDetectable: true,
    passed: spec.hasScopedAuth, status: spec.hasScopedAuth ? 'pass' : 'na',
    message: spec.hasScopedAuth ? 'Scoped auth (OAuth2/OpenID) with defined scopes found' : 'No scoped auth detected — may not be needed',
  };
}

export async function checkOpenIdConfig(baseUrl: string): Promise<CheckResult> {
  const url = `${baseUrl}/.well-known/openid-configuration`;
  try {
    const res = await timedFetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (res.ok) {
      const json = await res.json() as Record<string, unknown>;
      const hasIssuer = 'issuer' in json;
      const hasTokenEndpoint = 'token_endpoint' in json;

      if (hasIssuer && hasTokenEndpoint) {
        return {
          id: '2.6', name: 'OpenID Configuration', passed: true, status: 'pass', level: 2, category: 'Usable', autoDetectable: true,
          message: 'OpenID Connect discovery available',
          details: `Issuer: ${json.issuer}`,
          foundAt: url
        };
      }
    }

    return {
      id: '2.6', name: 'OpenID Configuration', passed: false, status: 'na', level: 2, category: 'Usable', autoDetectable: true,
      message: 'No OpenID configuration found — not required if using API keys',
    };
  } catch {
    return {
      id: '2.6', name: 'OpenID Configuration', passed: false, status: 'na', level: 2, category: 'Usable', autoDetectable: true,
      message: 'No OpenID configuration found — not required if using API keys',
    };
  }
}

export async function checkStructuredErrors(baseUrl: string): Promise<CheckResult> {
  try {
    const probeUrl = `${baseUrl}/api/this-path-should-not-exist-botvisibility-probe`;
    const res = await timedFetch(probeUrl, {
      headers: { 'Accept': 'application/json' },
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json') || contentType.includes('application/problem+json')) {
      try {
        const text = await res.text();
        const json = JSON.parse(text);
        const hasErrorStructure = json.error || json.message || json.detail || json.title || json.status || json.code;
        if (hasErrorStructure) {
          return {
            id: '2.7', name: 'Structured Error Responses', passed: true, status: 'pass', level: 2, category: 'Usable', autoDetectable: true,
            message: 'API returns structured JSON errors',
            details: `Error response has structured fields (${Object.keys(json).slice(0, 4).join(', ')})`,
          };
        }
        return {
          id: '2.7', name: 'Structured Error Responses', passed: true, status: 'partial', level: 2, category: 'Usable', autoDetectable: true,
          message: 'API returns JSON on error but structure is unclear',
          recommendation: 'Use a standard error format with error, message, and status fields',
        };
      } catch {
        // JSON parse failed
      }
    }

    if (contentType.includes('text/html')) {
      return {
        id: '2.7', name: 'Structured Error Responses', passed: false, status: 'na', level: 2, category: 'Usable', autoDetectable: true,
        message: 'No JSON API detected — not applicable',
      };
    }

    return {
      id: '2.7', name: 'Structured Error Responses', passed: false, status: 'fail', level: 2, category: 'Usable', autoDetectable: true,
      message: 'API does not return structured JSON errors',
      recommendation: 'Return JSON error responses with error, message, and status fields.',
    };
  } catch {
    return {
      id: '2.7', name: 'Structured Error Responses', passed: false, status: 'na', level: 2, category: 'Usable', autoDetectable: true,
      message: 'Could not probe API for error format',
    };
  }
}

export function checkAsyncOps(spec: ParsedOpenApiSpec | null): CheckResult {
  if (!spec) {
    return { id: '2.8', name: 'Async Operations', passed: false, status: 'na', level: 2, category: 'Usable', autoDetectable: true, message: 'No OpenAPI spec found — cannot evaluate' };
  }
  return {
    id: '2.8', name: 'Async Operations', level: 2, category: 'Usable', autoDetectable: true,
    passed: spec.hasAsyncPatterns, status: spec.hasAsyncPatterns ? 'pass' : 'na',
    message: spec.hasAsyncPatterns ? 'Async operation patterns detected (callbacks/webhooks/202)' : 'No async patterns detected — may not be needed',
  };
}

export function checkIdempotency(spec: ParsedOpenApiSpec | null): CheckResult {
  if (!spec) {
    return { id: '2.9', name: 'Idempotency Support', passed: false, status: 'na', level: 2, category: 'Usable', autoDetectable: true, message: 'No OpenAPI spec found — cannot evaluate' };
  }
  return {
    id: '2.9', name: 'Idempotency Support', level: 2, category: 'Usable', autoDetectable: true,
    passed: spec.hasIdempotencyKey, status: spec.hasIdempotencyKey ? 'pass' : 'na',
    message: spec.hasIdempotencyKey ? 'Idempotency key support detected' : 'No idempotency key detected — may not be needed',
  };
}

// --- Level 3 Check Functions ---

export function checkSparseFields(spec: ParsedOpenApiSpec | null): CheckResult {
  if (!spec) {
    return { id: '3.1', name: 'Sparse Fields', passed: false, status: 'na', level: 3, category: 'Optimized', autoDetectable: true, message: 'No OpenAPI spec found — cannot evaluate' };
  }
  return {
    id: '3.1', name: 'Sparse Fields', level: 3, category: 'Optimized', autoDetectable: true,
    passed: spec.hasSparseFields, status: spec.hasSparseFields ? 'pass' : 'na',
    message: spec.hasSparseFields ? 'Sparse fieldset support detected (fields parameter)' : 'No sparse fieldset support detected — may not be needed',
    recommendation: spec.hasSparseFields ? undefined : 'Add a fields query parameter to allow agents to request only needed data',
  };
}

export function checkCursorPagination(spec: ParsedOpenApiSpec | null): CheckResult {
  if (!spec) {
    return { id: '3.2', name: 'Cursor Pagination', passed: false, status: 'na', level: 3, category: 'Optimized', autoDetectable: true, message: 'No OpenAPI spec found — cannot evaluate' };
  }
  return {
    id: '3.2', name: 'Cursor Pagination', level: 3, category: 'Optimized', autoDetectable: true,
    passed: spec.hasCursorPagination, status: spec.hasCursorPagination ? 'pass' : 'na',
    message: spec.hasCursorPagination ? 'Cursor-based pagination detected' : 'No cursor pagination detected — may not be needed',
    recommendation: spec.hasCursorPagination ? undefined : 'Add cursor-based pagination for efficient traversal of large collections',
  };
}

export function checkSearchFiltering(spec: ParsedOpenApiSpec | null): CheckResult {
  if (!spec) {
    return { id: '3.3', name: 'Search & Filtering', passed: false, status: 'na', level: 3, category: 'Optimized', autoDetectable: true, message: 'No OpenAPI spec found — cannot evaluate' };
  }
  return {
    id: '3.3', name: 'Search & Filtering', level: 3, category: 'Optimized', autoDetectable: true,
    passed: spec.hasSearchFiltering, status: spec.hasSearchFiltering ? 'pass' : 'na',
    message: spec.hasSearchFiltering ? 'Search/filter parameters detected' : 'No search or filter parameters detected — may not be needed',
    recommendation: spec.hasSearchFiltering ? undefined : 'Add filter and search query parameters to help agents find resources efficiently',
  };
}

export function checkBulkOps(spec: ParsedOpenApiSpec | null): CheckResult {
  if (!spec) {
    return { id: '3.4', name: 'Bulk Operations', passed: false, status: 'na', level: 3, category: 'Optimized', autoDetectable: true, message: 'No OpenAPI spec found — cannot evaluate' };
  }
  return {
    id: '3.4', name: 'Bulk Operations', level: 3, category: 'Optimized', autoDetectable: true,
    passed: spec.hasBulkOperations, status: spec.hasBulkOperations ? 'pass' : 'na',
    message: spec.hasBulkOperations ? 'Bulk/batch operation endpoints detected' : 'No bulk operations detected — may not be needed',
    recommendation: spec.hasBulkOperations ? undefined : 'Add bulk/batch endpoints for operations on multiple resources',
  };
}

export async function checkRateLimitHeaders(baseUrl: string): Promise<CheckResult> {
  try {
    const res = await timedFetch(baseUrl, { method: 'GET' });

    const rateLimitHeaders = [
      'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset',
      'ratelimit-limit', 'ratelimit-remaining', 'retry-after'
    ];

    const foundHeaders: string[] = [];
    for (const header of rateLimitHeaders) {
      if (res.headers.get(header)) {
        foundHeaders.push(header);
      }
    }

    if (foundHeaders.length >= 2) {
      return {
        id: '3.5', name: 'Rate Limit Headers', passed: true, status: 'pass', level: 3, category: 'Optimized', autoDetectable: true,
        message: 'Rate limit headers present',
        details: `Found: ${foundHeaders.join(', ')}`
      };
    } else if (foundHeaders.length === 1) {
      return {
        id: '3.5', name: 'Rate Limit Headers', passed: false, status: 'partial', level: 3, category: 'Optimized', autoDetectable: true,
        message: 'Partial rate limit headers',
        details: `Found: ${foundHeaders.join(', ')}`,
        recommendation: 'Add X-RateLimit-Remaining and X-RateLimit-Reset headers'
      };
    }

    return {
      id: '3.5', name: 'Rate Limit Headers', passed: false, status: 'fail', level: 3, category: 'Optimized', autoDetectable: true,
      message: 'No rate limit headers',
      recommendation: 'Add X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers.'
    };
  } catch {
    return {
      id: '3.5', name: 'Rate Limit Headers', passed: false, status: 'na', level: 3, category: 'Optimized', autoDetectable: true,
      message: 'Could not check rate limit headers'
    };
  }
}

export async function checkCachingHeaders(baseUrl: string): Promise<CheckResult> {
  try {
    const res = await timedFetch(baseUrl, { method: 'GET' });

    const etag = res.headers.get('etag');
    const lastModified = res.headers.get('last-modified');
    const cacheControl = res.headers.get('cache-control');

    const cachingSignals = [etag, lastModified, cacheControl].filter(Boolean);

    if (cachingSignals.length >= 2) {
      return {
        id: '3.6', name: 'Caching Headers', passed: true, status: 'pass', level: 3, category: 'Optimized', autoDetectable: true,
        message: 'Caching headers present',
        details: `ETag: ${etag ? 'yes' : 'no'}, Cache-Control: ${cacheControl || 'no'}, Last-Modified: ${lastModified ? 'yes' : 'no'}`
      };
    } else if (cachingSignals.length === 1) {
      return {
        id: '3.6', name: 'Caching Headers', passed: true, status: 'partial', level: 3, category: 'Optimized', autoDetectable: true,
        message: 'Basic caching support',
        recommendation: 'Add ETag headers alongside Cache-Control for conditional requests support.'
      };
    }

    return {
      id: '3.6', name: 'Caching Headers', passed: false, status: 'fail', level: 3, category: 'Optimized', autoDetectable: true,
      message: 'No caching headers',
      recommendation: 'Add ETag or Last-Modified headers to enable 304 responses and reduce token cost.'
    };
  } catch {
    return {
      id: '3.6', name: 'Caching Headers', passed: false, status: 'na', level: 3, category: 'Optimized', autoDetectable: true,
      message: 'Could not check caching headers'
    };
  }
}

// --- RSS/Atom Feed Detection ---

export async function checkRssFeed(html: string | null, baseUrl: string): Promise<CheckResult> {
  // First: look for <link> tags pointing to RSS/Atom in the HTML
  if (html) {
    const feedLinkRegex = /<link\s[^>]*type=["'](application\/rss\+xml|application\/atom\+xml|application\/feed\+json)["'][^>]*>/gi;
    const hrefRegex = /href=["']([^"']+)["']/i;
    const feeds: string[] = [];
    let match;
    while ((match = feedLinkRegex.exec(html)) !== null) {
      const hrefMatch = hrefRegex.exec(match[0]);
      if (hrefMatch) feeds.push(hrefMatch[1]);
    }
    if (feeds.length > 0) {
      return {
        id: '1.14', name: 'RSS/Atom Feed', passed: true, status: 'pass',
        level: 1, category: 'Discoverable', autoDetectable: true,
        message: `Found ${feeds.length} feed${feeds.length > 1 ? 's' : ''} via <link> tags`,
        details: feeds.join(', '),
      };
    }
  }

  // Second: probe common feed URLs
  const feedPaths = ['/feed', '/feed.xml', '/rss', '/rss.xml', '/atom.xml', '/blog/feed', '/blog/rss', '/index.xml'];
  for (const path of feedPaths) {
    try {
      const url = `${baseUrl}${path}`;
      const res = await timedFetch(url, { headers: { 'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml' } });
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        const body = await res.text();
        const isXmlFeed = contentType.includes('xml') || body.trimStart().startsWith('<?xml') || body.includes('<rss') || body.includes('<feed') || body.includes('<channel');
        const isJsonFeed = contentType.includes('json') && body.includes('"feed_url"');
        if (isXmlFeed || isJsonFeed) {
          return {
            id: '1.14', name: 'RSS/Atom Feed', passed: true, status: 'pass',
            level: 1, category: 'Discoverable', autoDetectable: true,
            message: `Feed found at ${path}`,
            foundAt: url,
          };
        }
      }
    } catch { /* continue to next path */ }
  }

  return {
    id: '1.14', name: 'RSS/Atom Feed', passed: false, status: 'fail',
    level: 1, category: 'Discoverable', autoDetectable: true,
    message: 'No RSS or Atom feed detected',
    recommendation: 'Add an RSS or Atom feed so agents can consume your content as structured text without parsing HTML. Most CMS platforms support this natively.',
  };
}

// --- MCP Server Discovery (1.12) ---

interface McpDiscoveryResult {
  found: boolean;
  url?: string;
  endpointUrl?: string;
  body?: unknown;
}

async function discoverMcpServer(baseUrl: string): Promise<McpDiscoveryResult> {
  const candidatePaths = ['/.well-known/mcp.json', '/.well-known/mcp', '/mcp.json', '/mcp'];
  for (const p of candidatePaths) {
    try {
      const url = `${baseUrl}${p}`;
      const res = await timedFetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) continue;
      const text = await res.text();
      const trimmed = text.trimStart();
      if (trimmed.startsWith('<!') || trimmed.startsWith('<html')) continue;
      try {
        const body = JSON.parse(text);
        const endpointUrl =
          (body && typeof body === 'object' && 'endpoint' in (body as Record<string, unknown>) && typeof (body as Record<string, string>).endpoint === 'string')
            ? (body as Record<string, string>).endpoint
            : (body && typeof body === 'object' && 'url' in (body as Record<string, unknown>) && typeof (body as Record<string, string>).url === 'string')
              ? (body as Record<string, string>).url
              : undefined;
        return { found: true, url, endpointUrl, body };
      } catch {
        // JSON discovery failed, but the file exists — count as a partial signal
        return { found: true, url };
      }
    } catch {
      // network/timeout — try next path
    }
  }
  return { found: false };
}

export async function checkMcpServer(baseUrl: string): Promise<CheckResult> {
  const result = await discoverMcpServer(baseUrl);
  if (result.found && result.body) {
    return {
      id: '1.12', name: 'MCP Server', passed: true, status: 'pass', level: 1, category: 'Discoverable', autoDetectable: true,
      message: 'MCP server discovery file found',
      foundAt: result.url,
    };
  }
  if (result.found) {
    return {
      id: '1.12', name: 'MCP Server', passed: false, status: 'partial', level: 1, category: 'Discoverable', autoDetectable: true,
      message: 'MCP discovery file exists but is not valid JSON',
      recommendation: 'Return a JSON document from /.well-known/mcp.json describing your MCP server endpoint and tools.',
      foundAt: result.url,
    };
  }
  return {
    id: '1.12', name: 'MCP Server', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true,
    message: 'No MCP server discovery file found',
    recommendation: 'Publish a Model Context Protocol discovery file at /.well-known/mcp.json so agents can find your tools.',
  };
}

// --- MCP Tool Quality (3.7) ---

export async function checkMcpToolQuality(baseUrl: string): Promise<CheckResult> {
  const discovery = await discoverMcpServer(baseUrl);
  if (!discovery.found || !discovery.body) {
    return {
      id: '3.7', name: 'MCP Tool Quality', passed: false, status: 'na', level: 3, category: 'Optimized', autoDetectable: true,
      message: 'No MCP server discovered — cannot evaluate tool quality',
    };
  }

  // Extract tools from common MCP discovery shapes
  const body = discovery.body as Record<string, unknown>;
  let tools: Array<Record<string, unknown>> = [];
  if (Array.isArray(body.tools)) {
    tools = body.tools as Array<Record<string, unknown>>;
  } else if (body.capabilities && typeof body.capabilities === 'object') {
    const caps = body.capabilities as Record<string, unknown>;
    if (Array.isArray(caps.tools)) tools = caps.tools as Array<Record<string, unknown>>;
  }

  if (tools.length === 0) {
    return {
      id: '3.7', name: 'MCP Tool Quality', passed: false, status: 'fail', level: 3, category: 'Optimized', autoDetectable: true,
      message: 'MCP discovery file found but lists no tools',
      recommendation: 'Declare tools in your MCP discovery file with name, description, and inputSchema for each.',
      foundAt: discovery.url,
    };
  }

  let wellDescribed = 0;
  for (const tool of tools) {
    const hasName = typeof tool.name === 'string' && (tool.name as string).length > 0;
    const hasDescription = typeof tool.description === 'string' && (tool.description as string).length >= 20;
    const hasInputSchema =
      tool.inputSchema && typeof tool.inputSchema === 'object' &&
      ((tool.inputSchema as Record<string, unknown>).type !== undefined ||
       (tool.inputSchema as Record<string, unknown>).properties !== undefined);
    if (hasName && hasDescription && hasInputSchema) wellDescribed++;
  }

  const ratio = wellDescribed / tools.length;
  if (ratio >= 0.8) {
    return {
      id: '3.7', name: 'MCP Tool Quality', passed: true, status: 'pass', level: 3, category: 'Optimized', autoDetectable: true,
      message: `${wellDescribed}/${tools.length} MCP tools have name, description, and input schema`,
      foundAt: discovery.url,
    };
  }
  if (ratio >= 0.4) {
    return {
      id: '3.7', name: 'MCP Tool Quality', passed: false, status: 'partial', level: 3, category: 'Optimized', autoDetectable: true,
      message: `Only ${wellDescribed}/${tools.length} MCP tools are fully described`,
      recommendation: 'Add a description (20+ chars) and inputSchema with type/properties to every MCP tool.',
      foundAt: discovery.url,
    };
  }
  return {
    id: '3.7', name: 'MCP Tool Quality', passed: false, status: 'fail', level: 3, category: 'Optimized', autoDetectable: true,
    message: `${wellDescribed}/${tools.length} MCP tools are well-described — most are missing description or inputSchema`,
    recommendation: 'Each MCP tool should declare a name, a clear description (20+ chars), and a JSON inputSchema.',
    foundAt: discovery.url,
  };
}

// --- Page Token Efficiency (Agent Tax) ---

export function checkPageTokenEfficiency(html: string | null, otherChecks?: CheckResult[]): CheckResult {
  if (!html || html.length < 400) {
    return {
      id: '1.13', name: 'Page Token Efficiency', passed: false, status: 'na',
      level: 1, category: 'Discoverable', autoDetectable: true,
      message: 'No HTML content to evaluate',
    };
  }

  const rawTokens = Math.ceil(html.length / 4);

  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  cleaned = cleaned.replace(/<[^>]+>/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  const cleanTokens = Math.ceil(cleaned.length / 4);

  if (rawTokens === 0 || cleanTokens === 0) {
    return {
      id: '1.13', name: 'Page Token Efficiency', passed: false, status: 'fail',
      level: 1, category: 'Discoverable', autoDetectable: true,
      message: 'Page contains no extractable text — LLMs see an empty page',
      recommendation: 'Ensure your homepage renders server-side HTML content. Fully client-rendered SPAs are invisible to LLM scrapers.',
    };
  }

  const wasteRatio = 1 - (cleanTokens / rawTokens);
  const multiplier = (rawTokens / cleanTokens).toFixed(1);

  // Calculate mitigation from agent-friendly discovery files
  let mitigationPct = 0;
  const mitigations: string[] = [];
  if (otherChecks) {
    const passed = (id: string) => otherChecks.find(c => c.id === id)?.status === 'pass';
    if (passed('1.1'))  { mitigationPct += 0.10; mitigations.push('llms.txt'); }
    if (passed('1.3'))  { mitigationPct += 0.10; mitigations.push('OpenAPI'); }
    if (passed('1.2'))  { mitigationPct += 0.05; mitigations.push('Agent Card'); }
    if (passed('1.8'))  { mitigationPct += 0.05; mitigations.push('Skill File'); }
  }

  const partialThreshold = 0.70 + mitigationPct;
  const failThreshold = 0.85 + mitigationPct;

  let status: 'pass' | 'partial' | 'fail';
  let message: string;
  let recommendation: string | undefined;
  const mitigated = mitigations.length > 0;
  const mitigationNote = mitigated ? ` (mitigated by ${mitigations.join(', ')})` : '';

  if (wasteRatio < partialThreshold) {
    status = 'pass';
    message = mitigated
      ? `${Math.round(wasteRatio * 100)}% HTML waste, but ${mitigations.join(' + ')} provide structured alternatives — ${multiplier}x agent tax effectively mitigated`
      : `Page is token-efficient — ${multiplier}x agent tax (${rawTokens.toLocaleString()} raw → ${cleanTokens.toLocaleString()} useful tokens)`;
  } else if (wasteRatio < failThreshold) {
    status = 'partial';
    message = `Moderate token overhead — ${multiplier}x agent tax (${rawTokens.toLocaleString()} raw → ${cleanTokens.toLocaleString()} useful tokens)${mitigationNote}`;
    recommendation = `Your page wastes ${Math.round(wasteRatio * 100)}% of tokens on HTML overhead.${mitigated ? ` Partially offset by ${mitigations.join(', ')}.` : ''} Add an llms.txt file or structured API endpoints so agents can skip the HTML entirely.`;
  } else {
    status = 'fail';
    message = `Excessive token waste — ${multiplier}x agent tax (${rawTokens.toLocaleString()} raw → ${cleanTokens.toLocaleString()} useful tokens)${mitigationNote}`;
    recommendation = `${Math.round(wasteRatio * 100)}% of your page is invisible to LLMs (scripts, styles, boilerplate). An agent parsing this page wastes ${(rawTokens - cleanTokens).toLocaleString()} tokens on overhead. Add llms.txt or structured endpoints so agents can access content directly.`;
  }

  return {
    id: '1.13', name: 'Page Token Efficiency',
    passed: status === 'pass',
    status,
    level: 1, category: 'Discoverable', autoDetectable: true,
    message,
    recommendation,
    details: JSON.stringify({ rawTokens, cleanTokens, wasteRatio: Math.round(wasteRatio * 100), multiplier, mitigations }),
  };
}

// --- Shared fetch helpers (used by new L1/L4 checks) ---

export async function fetchRobotsTxt(baseUrl: string): Promise<string | null> {
  try {
    const res = await timedFetch(`${baseUrl}/robots.txt`, { headers: { 'Accept': 'text/plain' } });
    if (res.ok) return await res.text();
    return null;
  } catch { return null; }
}

async function fetchHomepageData(baseUrl: string): Promise<{ html: string | null; xRobotsTag: string | null }> {
  try {
    const res = await timedFetch(baseUrl, { headers: { 'Accept': 'text/html' } });
    if (res.ok) return { html: await res.text(), xRobotsTag: res.headers.get('x-robots-tag') };
    return { html: null, xRobotsTag: null };
  } catch { return { html: null, xRobotsTag: null }; }
}

function parseRobotsBlocks(robotsTxt: string): Array<{ agents: string[]; disallows: string[]; allows: string[] }> {
  const lines = robotsTxt.split(/\r?\n/);
  const blocks: Array<{ agents: string[]; disallows: string[]; allows: string[] }> = [];
  let current: { agents: string[]; disallows: string[]; allows: string[] } | null = null;
  let inDirective = false;
  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*/, '').trim();
    if (!line) continue;
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') {
      if (!current || inDirective) {
        current = { agents: [], disallows: [], allows: [] };
        blocks.push(current);
        inDirective = false;
      }
      current.agents.push(value.toLowerCase());
    } else if (current) {
      if (key === 'disallow') { current.disallows.push(value); inDirective = true; }
      if (key === 'allow') { current.allows.push(value); inDirective = true; }
    }
  }
  return blocks;
}

function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try { blocks.push(JSON.parse(m[1])); } catch { /* skip invalid */ }
  }
  return blocks;
}

// --- Level 1: 1.15 Content Signals ---

export function checkContentSignals(robotsTxt: string | null): CheckResult {
  if (robotsTxt === null) {
    return {
      id: '1.15', name: 'Content Signals', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true,
      message: 'No robots.txt — cannot declare AI content preferences',
      recommendation: 'Add a robots.txt with a Content-Signal directive (ai-train, search, ai-input). See contentsignals.org.',
    };
  }
  const lower = robotsTxt.toLowerCase();
  const hasDirective = /content-signal\s*:/i.test(robotsTxt);
  const signals = ['ai-train', 'search', 'ai-input'].filter(s => lower.includes(s));
  if (hasDirective && signals.length > 0) {
    return {
      id: '1.15', name: 'Content Signals', passed: true, status: 'pass', level: 1, category: 'Discoverable', autoDetectable: true,
      message: `Content-Signal directive declares ${signals.join(', ')}`,
    };
  }
  if (hasDirective) {
    return {
      id: '1.15', name: 'Content Signals', passed: false, status: 'partial', level: 1, category: 'Discoverable', autoDetectable: true,
      message: 'Content-Signal directive found but no recognized signals',
      recommendation: 'Declare ai-train, search, and/or ai-input values. See contentsignals.org.',
    };
  }
  return {
    id: '1.15', name: 'Content Signals', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true,
    message: 'No Content-Signal directive in robots.txt',
    recommendation: 'Add Content-Signal: search=yes, ai-train=no (or similar) to robots.txt. See contentsignals.org.',
  };
}

// --- Level 1: 1.16 API Catalog (RFC 9727) ---

export async function checkApiCatalog(baseUrl: string): Promise<CheckResult> {
  const url = `${baseUrl}/.well-known/api-catalog`;
  try {
    const res = await timedFetch(url, { headers: { 'Accept': 'application/linkset+json, application/json' } });
    if (!res.ok) {
      return {
        id: '1.16', name: 'API Catalog', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true,
        message: 'No /.well-known/api-catalog found',
        recommendation: 'Publish an RFC 9727 API catalog linkset at /.well-known/api-catalog listing your APIs.',
      };
    }
    const text = await res.text();
    const trimmed = text.trimStart();
    if (trimmed.startsWith('<!') || trimmed.startsWith('<html')) {
      return {
        id: '1.16', name: 'API Catalog', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true,
        message: 'No /.well-known/api-catalog found',
        recommendation: 'Publish an RFC 9727 API catalog linkset at /.well-known/api-catalog listing your APIs.',
      };
    }
    let body: unknown;
    try { body = JSON.parse(text); }
    catch {
      return {
        id: '1.16', name: 'API Catalog', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true,
        message: '/.well-known/api-catalog exists but is not valid JSON', foundAt: url,
      };
    }
    const linkset = (body as { linkset?: unknown[] }).linkset;
    if (Array.isArray(linkset) && linkset.length > 0) {
      const hasServiceDesc = JSON.stringify(linkset).includes('service-desc');
      const status: 'pass' | 'partial' = hasServiceDesc ? 'pass' : 'partial';
      return {
        id: '1.16', name: 'API Catalog', passed: status === 'pass', status, level: 1, category: 'Discoverable', autoDetectable: true,
        message: hasServiceDesc
          ? `RFC 9727 API catalog found with ${linkset.length} entr${linkset.length === 1 ? 'y' : 'ies'}`
          : 'API catalog found but no service-desc relation present',
        foundAt: url,
        recommendation: status === 'pass' ? undefined : 'Add service-desc, service-doc, and status link relations per RFC 9727.',
      };
    }
    return {
      id: '1.16', name: 'API Catalog', passed: false, status: 'partial', level: 1, category: 'Discoverable', autoDetectable: true,
      message: '/.well-known/api-catalog is JSON but missing the linkset array',
      recommendation: 'Wrap entries under a top-level `linkset` array per RFC 9727.',
      foundAt: url,
    };
  } catch {
    return {
      id: '1.16', name: 'API Catalog', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true,
      message: 'Could not check /.well-known/api-catalog',
    };
  }
}

// --- Level 1: 1.17 Markdown for Agents ---

export async function checkMarkdownForAgents(baseUrl: string): Promise<CheckResult> {
  try {
    const res = await timedFetch(baseUrl, { headers: { 'Accept': 'text/markdown' } });
    if (!res.ok) {
      return {
        id: '1.17', name: 'Markdown for Agents', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true,
        message: 'No markdown rendering on the homepage',
        recommendation: 'Serve markdown when Accept: text/markdown is requested so agents skip HTML overhead.',
      };
    }
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const body = await res.text();
    const trimmed = body.trimStart();
    const looksLikeHtml = trimmed.startsWith('<!') || trimmed.startsWith('<html') || /<html|<body|<head/i.test(trimmed.slice(0, 400));
    const isMarkdownByCT = contentType.includes('markdown') || contentType.includes('text/x-markdown');
    const looksLikeMarkdown = !looksLikeHtml && (trimmed.startsWith('#') || /^[*-]\s/m.test(trimmed) || /\]\(https?:/.test(trimmed));
    if (isMarkdownByCT || looksLikeMarkdown) {
      return {
        id: '1.17', name: 'Markdown for Agents', passed: true, status: 'pass', level: 1, category: 'Discoverable', autoDetectable: true,
        message: 'Homepage returns markdown when Accept: text/markdown is requested',
        details: `Content-Type: ${contentType || '(unspecified)'}`,
      };
    }
    return {
      id: '1.17', name: 'Markdown for Agents', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true,
      message: 'Accept: text/markdown still returns HTML',
      recommendation: 'Detect Accept: text/markdown and serve a markdown rendering of the page so agents skip HTML overhead.',
    };
  } catch {
    return {
      id: '1.17', name: 'Markdown for Agents', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true,
      message: 'Could not probe markdown rendering',
    };
  }
}

// --- Level 1: 1.18 WebMCP ---

export function checkWebMcp(html: string | null): CheckResult {
  if (!html) {
    return {
      id: '1.18', name: 'WebMCP', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true,
      message: 'Could not fetch homepage',
    };
  }
  const matched =
    /navigator\s*\.\s*modelContext\s*\.\s*provideContext\s*\(/i.test(html) ||
    /navigator\[\s*['"]modelContext['"]\s*\]\s*\.\s*provideContext\s*\(/i.test(html);
  if (matched) {
    return {
      id: '1.18', name: 'WebMCP', passed: true, status: 'pass', level: 1, category: 'Discoverable', autoDetectable: true,
      message: 'Homepage calls navigator.modelContext.provideContext()',
    };
  }
  return {
    id: '1.18', name: 'WebMCP', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true,
    message: 'No WebMCP provideContext() call detected',
    recommendation: 'Use navigator.modelContext.provideContext({ tools: [...] }) to expose in-browser tools to AI agents.',
  };
}

// --- Level 2: 2.10 OAuth Protected Resource (RFC 9728) ---

export async function checkOAuthProtectedResource(baseUrl: string): Promise<CheckResult> {
  const url = `${baseUrl}/.well-known/oauth-protected-resource`;
  try {
    const res = await timedFetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) {
      return {
        id: '2.10', name: 'OAuth Protected Resource', passed: false, status: 'na', level: 2, category: 'Usable', autoDetectable: true,
        message: 'No /.well-known/oauth-protected-resource — not required if using API keys',
      };
    }
    const text = await res.text();
    const trimmed = text.trimStart();
    if (trimmed.startsWith('<!') || trimmed.startsWith('<html')) {
      return {
        id: '2.10', name: 'OAuth Protected Resource', passed: false, status: 'na', level: 2, category: 'Usable', autoDetectable: true,
        message: 'No /.well-known/oauth-protected-resource — not required if using API keys',
      };
    }
    let body: Record<string, unknown>;
    try { body = JSON.parse(text) as Record<string, unknown>; }
    catch {
      return {
        id: '2.10', name: 'OAuth Protected Resource', passed: false, status: 'fail', level: 2, category: 'Usable', autoDetectable: true,
        message: 'oauth-protected-resource exists but is invalid JSON', foundAt: url,
      };
    }
    const hasAuthServers = Array.isArray(body.authorization_servers) && (body.authorization_servers as unknown[]).length > 0;
    const hasScopes = Array.isArray(body.scopes_supported) || Array.isArray(body.scopes);
    if (hasAuthServers) {
      return {
        id: '2.10', name: 'OAuth Protected Resource', passed: true, status: 'pass', level: 2, category: 'Usable', autoDetectable: true,
        message: hasScopes
          ? 'OAuth protected-resource advertises authorization servers and scopes'
          : 'OAuth protected-resource advertises authorization servers',
        foundAt: url,
      };
    }
    return {
      id: '2.10', name: 'OAuth Protected Resource', passed: false, status: 'partial', level: 2, category: 'Usable', autoDetectable: true,
      message: 'oauth-protected-resource is missing authorization_servers',
      recommendation: 'Add an authorization_servers array (and scopes_supported) per RFC 9728.',
      foundAt: url,
    };
  } catch {
    return {
      id: '2.10', name: 'OAuth Protected Resource', passed: false, status: 'na', level: 2, category: 'Usable', autoDetectable: true,
      message: 'Could not probe oauth-protected-resource',
    };
  }
}

// --- Level 2: 2.11 x402 Payments ---

export async function checkX402Payments(baseUrl: string): Promise<CheckResult> {
  const probes = ['/api/x402-probe', '/x402', '/.well-known/x402'];
  for (const p of probes) {
    try {
      const res = await timedFetch(`${baseUrl}${p}`, { headers: { 'Accept': 'application/json' } });
      if (res.status === 402) {
        const text = await res.text();
        const isX402 = /x402Version|"accepts"|"payTo"|paymentRequirements/i.test(text);
        if (isX402) {
          return {
            id: '2.11', name: 'x402 Payments', passed: true, status: 'pass', level: 2, category: 'Usable', autoDetectable: true,
            message: 'HTTP 402 returned with x402 payment requirements',
            foundAt: `${baseUrl}${p}`,
          };
        }
        return {
          id: '2.11', name: 'x402 Payments', passed: false, status: 'partial', level: 2, category: 'Usable', autoDetectable: true,
          message: 'HTTP 402 returned but body is not in x402 format',
          recommendation: 'Return JSON with x402Version, accepts, and paymentRequirements per the x402 spec.',
          foundAt: `${baseUrl}${p}`,
        };
      }
    } catch { /* try next */ }
  }
  return {
    id: '2.11', name: 'x402 Payments', passed: false, status: 'na', level: 2, category: 'Usable', autoDetectable: true,
    message: 'No x402 payment endpoint detected — not required if you do not charge agents directly',
    recommendation: 'Return HTTP 402 with machine-readable x402 paymentRequirements on protected routes if you want agent-native billing.',
  };
}

// --- Level 4: 4.1 Googlebot Allowed ---

export function checkGooglebotAllowed(robotsTxt: string | null): CheckResult {
  if (robotsTxt === null) {
    return {
      id: '4.1', name: 'Googlebot Allowed', passed: true, status: 'pass', level: 4, category: 'Indexable', autoDetectable: true,
      message: 'No robots.txt — Googlebot is unrestricted',
    };
  }
  const blocks = parseRobotsBlocks(robotsTxt);
  const blocksFor = (name: string) => blocks.filter(b => b.agents.includes(name));
  const explicit = blocksFor('googlebot');
  const target = explicit.length > 0 ? explicit : blocksFor('*');
  const blocksAll = target.some(b => b.disallows.includes('/'));
  if (blocksAll) {
    return {
      id: '4.1', name: 'Googlebot Allowed', passed: false, status: 'fail', level: 4, category: 'Indexable', autoDetectable: true,
      message: 'robots.txt disallows / for Googlebot (or all agents)',
      recommendation: 'Remove the Disallow: / rule for Googlebot and User-agent: * so AI search systems can index the site.',
    };
  }
  return {
    id: '4.1', name: 'Googlebot Allowed', passed: true, status: 'pass', level: 4, category: 'Indexable', autoDetectable: true,
    message: 'Googlebot is permitted in robots.txt',
  };
}

// --- Level 4: 4.2 Google-Extended Policy ---

export function checkGoogleExtendedPolicy(robotsTxt: string | null): CheckResult {
  if (robotsTxt === null) {
    return {
      id: '4.2', name: 'Google-Extended Policy', passed: false, status: 'fail', level: 4, category: 'Indexable', autoDetectable: true,
      message: 'No robots.txt — no Google-Extended policy declared',
      recommendation: 'Add a User-agent: Google-Extended block to robots.txt declaring your AI training/grounding policy.',
    };
  }
  const blocks = parseRobotsBlocks(robotsTxt);
  const ge = blocks.filter(b => b.agents.includes('google-extended'));
  if (ge.length > 0) {
    return {
      id: '4.2', name: 'Google-Extended Policy', passed: true, status: 'pass', level: 4, category: 'Indexable', autoDetectable: true,
      message: 'Explicit User-agent: Google-Extended block found',
    };
  }
  return {
    id: '4.2', name: 'Google-Extended Policy', passed: false, status: 'fail', level: 4, category: 'Indexable', autoDetectable: true,
    message: 'No User-agent: Google-Extended block in robots.txt',
    recommendation: 'Add an explicit User-agent: Google-Extended block (Allow or Disallow) to declare your AI grounding policy.',
  };
}

// --- Level 4: 4.3 Homepage Indexable ---

export function checkHomepageIndexable(html: string | null, xRobotsTag: string | null): CheckResult {
  if (!html) {
    return {
      id: '4.3', name: 'Homepage Indexable', passed: false, status: 'fail', level: 4, category: 'Indexable', autoDetectable: true,
      message: 'Could not fetch homepage',
    };
  }
  const headerHasNoindex = !!xRobotsTag && /noindex/i.test(xRobotsTag);
  const metaHasNoindex =
    /<meta\s+[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex[^"']*["']/i.test(html) ||
    /<meta\s+[^>]*content=["'][^"']*noindex[^"']*["'][^>]*name=["']robots["']/i.test(html);
  if (headerHasNoindex || metaHasNoindex) {
    const sources = [
      headerHasNoindex ? 'X-Robots-Tag header' : null,
      metaHasNoindex ? '<meta name="robots">' : null,
    ].filter(Boolean).join(' + ');
    return {
      id: '4.3', name: 'Homepage Indexable', passed: false, status: 'fail', level: 4, category: 'Indexable', autoDetectable: true,
      message: `Homepage declares noindex via ${sources}`,
      recommendation: 'Remove the noindex directive so the homepage can appear in search and AI-grounding results.',
    };
  }
  return {
    id: '4.3', name: 'Homepage Indexable', passed: true, status: 'pass', level: 4, category: 'Indexable', autoDetectable: true,
    message: 'Homepage is eligible for indexing',
  };
}

// --- Level 4: 4.4 Sitemap Present ---

export async function checkSitemapPresent(baseUrl: string, robotsTxt: string | null): Promise<CheckResult> {
  let sitemapInRobots: string | null = null;
  if (robotsTxt) {
    const m = robotsTxt.match(/sitemap\s*:\s*(\S+)/i);
    if (m) sitemapInRobots = m[1];
  }
  try {
    const res = await timedFetch(`${baseUrl}/sitemap.xml`, { headers: { 'Accept': 'application/xml, text/xml' } });
    if (res.ok) {
      const body = await res.text();
      const looksLikeSitemap = body.includes('<urlset') || body.includes('<sitemapindex') || body.trimStart().startsWith('<?xml');
      if (looksLikeSitemap) {
        const status: 'pass' | 'partial' = sitemapInRobots ? 'pass' : 'partial';
        return {
          id: '4.4', name: 'Sitemap Present', passed: status === 'pass', status, level: 4, category: 'Indexable', autoDetectable: true,
          message: sitemapInRobots
            ? 'sitemap.xml reachable and referenced from robots.txt'
            : 'sitemap.xml reachable (consider also referencing it from robots.txt)',
          foundAt: `${baseUrl}/sitemap.xml`,
          recommendation: sitemapInRobots ? undefined : 'Add a Sitemap: directive to robots.txt pointing at your sitemap.',
        };
      }
    }
  } catch { /* fall through */ }
  if (sitemapInRobots) {
    return {
      id: '4.4', name: 'Sitemap Present', passed: false, status: 'partial', level: 4, category: 'Indexable', autoDetectable: true,
      message: 'robots.txt declares a Sitemap but it could not be fetched',
      details: sitemapInRobots,
      recommendation: 'Verify the sitemap URL responds with valid XML.',
    };
  }
  return {
    id: '4.4', name: 'Sitemap Present', passed: false, status: 'fail', level: 4, category: 'Indexable', autoDetectable: true,
    message: 'No sitemap.xml found',
    recommendation: 'Publish a sitemap.xml and reference it from robots.txt (Sitemap: directive).',
  };
}

// --- Level 4: 4.5 HTTPS ---

export async function checkHttps(baseUrl: string): Promise<CheckResult> {
  if (!baseUrl.toLowerCase().startsWith('https://')) {
    return {
      id: '4.5', name: 'HTTPS', passed: false, status: 'fail', level: 4, category: 'Indexable', autoDetectable: true,
      message: 'Origin does not use HTTPS',
      recommendation: 'Serve the site over HTTPS and redirect http requests.',
    };
  }
  const httpUrl = baseUrl.replace(/^https:\/\//i, 'http://');
  try {
    const res = await timedFetch(httpUrl, { method: 'GET', redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location') || '';
      if (/^https:\/\//i.test(location)) {
        return {
          id: '4.5', name: 'HTTPS', passed: true, status: 'pass', level: 4, category: 'Indexable', autoDetectable: true,
          message: 'http requests redirect to https', details: `Location: ${location}`,
        };
      }
      return {
        id: '4.5', name: 'HTTPS', passed: false, status: 'partial', level: 4, category: 'Indexable', autoDetectable: true,
        message: 'http responds with a redirect that does not target https',
        recommendation: 'Redirect http → https with a 301 Location header.',
      };
    }
    if (res.status >= 200 && res.status < 300) {
      return {
        id: '4.5', name: 'HTTPS', passed: false, status: 'fail', level: 4, category: 'Indexable', autoDetectable: true,
        message: 'Origin serves content over http without redirecting',
        recommendation: 'Force HTTPS by redirecting all http requests with a 301.',
      };
    }
    return {
      id: '4.5', name: 'HTTPS', passed: true, status: 'pass', level: 4, category: 'Indexable', autoDetectable: true,
      message: 'Origin is https-only (http requests rejected)',
    };
  } catch {
    return {
      id: '4.5', name: 'HTTPS', passed: true, status: 'pass', level: 4, category: 'Indexable', autoDetectable: true,
      message: 'Origin is https-only (http connection refused)',
    };
  }
}

// --- Level 4: 4.6 Mobile Viewport ---

export function checkMobileViewport(html: string | null): CheckResult {
  if (!html) {
    return {
      id: '4.6', name: 'Mobile Viewport', passed: false, status: 'fail', level: 4, category: 'Indexable', autoDetectable: true,
      message: 'Could not fetch homepage',
    };
  }
  const m =
    /<meta\s+[^>]*name=["']viewport["'][^>]*content=["']([^"']+)["']/i.exec(html) ||
    /<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']viewport["']/i.exec(html);
  if (m && /width\s*=\s*device-width/i.test(m[1])) {
    return {
      id: '4.6', name: 'Mobile Viewport', passed: true, status: 'pass', level: 4, category: 'Indexable', autoDetectable: true,
      message: 'Mobile viewport meta tag present', details: m[1],
    };
  }
  return {
    id: '4.6', name: 'Mobile Viewport', passed: false, status: 'fail', level: 4, category: 'Indexable', autoDetectable: true,
    message: 'No mobile viewport meta tag with width=device-width',
    recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the <head>.',
  };
}

// --- Level 4: 4.7 JSON-LD Present ---

export function checkJsonLdPresent(html: string | null): CheckResult {
  if (!html) {
    return {
      id: '4.7', name: 'JSON-LD Present', passed: false, status: 'fail', level: 4, category: 'Indexable', autoDetectable: true,
      message: 'Could not fetch homepage',
    };
  }
  const blocks = extractJsonLdBlocks(html);
  if (blocks.length > 0) {
    return {
      id: '4.7', name: 'JSON-LD Present', passed: true, status: 'pass', level: 4, category: 'Indexable', autoDetectable: true,
      message: `Found ${blocks.length} valid JSON-LD script block${blocks.length === 1 ? '' : 's'}`,
    };
  }
  return {
    id: '4.7', name: 'JSON-LD Present', passed: false, status: 'fail', level: 4, category: 'Indexable', autoDetectable: true,
    message: 'No valid JSON-LD script blocks on the homepage',
    recommendation: 'Add <script type="application/ld+json"> blocks with Schema.org markup so search engines can ground answers.',
  };
}

// --- Level 4: 4.8 Entity Schema ---

export function checkEntitySchema(html: string | null): CheckResult {
  if (!html) {
    return {
      id: '4.8', name: 'Entity Schema', passed: false, status: 'fail', level: 4, category: 'Indexable', autoDetectable: true,
      message: 'Could not fetch homepage',
    };
  }
  const blocks = extractJsonLdBlocks(html);
  const entityTypes = ['Organization', 'WebSite', 'LocalBusiness'];
  const found = new Set<string>();
  const collectTypes = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(collectTypes); return; }
    if (typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      const t = obj['@type'];
      if (typeof t === 'string' && entityTypes.includes(t)) found.add(t);
      if (Array.isArray(t)) {
        for (const v of t) if (typeof v === 'string' && entityTypes.includes(v)) found.add(v);
      }
      const graph = obj['@graph'];
      if (Array.isArray(graph)) graph.forEach(collectTypes);
    }
  };
  blocks.forEach(collectTypes);
  if (found.size > 0) {
    return {
      id: '4.8', name: 'Entity Schema', passed: true, status: 'pass', level: 4, category: 'Indexable', autoDetectable: true,
      message: `Found entity schema (${Array.from(found).join(', ')})`,
    };
  }
  return {
    id: '4.8', name: 'Entity Schema', passed: false, status: 'fail', level: 4, category: 'Indexable', autoDetectable: true,
    message: 'No Organization, WebSite, or LocalBusiness entity in JSON-LD',
    recommendation: 'Add a JSON-LD block with @type: Organization (or WebSite/LocalBusiness) for entity grounding.',
  };
}

// --- Level 4: 4.9 Canonical URL ---

export function checkCanonicalUrl(html: string | null, baseUrl: string): CheckResult {
  if (!html) {
    return {
      id: '4.9', name: 'Canonical URL', passed: false, status: 'fail', level: 4, category: 'Indexable', autoDetectable: true,
      message: 'Could not fetch homepage',
    };
  }
  const m =
    /<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(html) ||
    /<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i.exec(html);
  if (!m) {
    return {
      id: '4.9', name: 'Canonical URL', passed: false, status: 'fail', level: 4, category: 'Indexable', autoDetectable: true,
      message: 'No <link rel="canonical"> on the homepage',
      recommendation: 'Add <link rel="canonical" href="https://yourdomain.com/"> to the <head>.',
    };
  }
  let canonicalUrl: URL;
  try {
    canonicalUrl = new URL(m[1], baseUrl);
  } catch {
    return {
      id: '4.9', name: 'Canonical URL', passed: false, status: 'partial', level: 4, category: 'Indexable', autoDetectable: true,
      message: 'Canonical link is not a valid URL', details: m[1],
    };
  }
  const baseHost = new URL(baseUrl).hostname;
  const sameOrigin = canonicalUrl.hostname === baseHost;
  const rootPath = canonicalUrl.pathname === '/' || canonicalUrl.pathname === '';
  if (sameOrigin && rootPath) {
    return {
      id: '4.9', name: 'Canonical URL', passed: true, status: 'pass', level: 4, category: 'Indexable', autoDetectable: true,
      message: 'Self-referential canonical URL on the homepage', details: canonicalUrl.toString(),
    };
  }
  if (sameOrigin) {
    return {
      id: '4.9', name: 'Canonical URL', passed: false, status: 'partial', level: 4, category: 'Indexable', autoDetectable: true,
      message: 'Canonical points to a different path on the same origin', details: canonicalUrl.toString(),
      recommendation: 'Self-reference the homepage so the origin / is canonical.',
    };
  }
  return {
    id: '4.9', name: 'Canonical URL', passed: false, status: 'partial', level: 4, category: 'Indexable', autoDetectable: true,
    message: 'Canonical URL points off-origin', details: canonicalUrl.toString(),
    recommendation: 'Canonical should target this origin\'s homepage.',
  };
}

// --- Level 4: 4.10 Heading Hierarchy ---

export function checkHeadingHierarchy(html: string | null): CheckResult {
  if (!html) {
    return {
      id: '4.10', name: 'Heading Hierarchy', passed: false, status: 'fail', level: 4, category: 'Indexable', autoDetectable: true,
      message: 'Could not fetch homepage',
    };
  }
  const headings: number[] = [];
  const re = /<h([1-6])\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) headings.push(parseInt(m[1], 10));
  if (headings.length === 0) {
    return {
      id: '4.10', name: 'Heading Hierarchy', passed: false, status: 'fail', level: 4, category: 'Indexable', autoDetectable: true,
      message: 'No heading tags found',
      recommendation: 'Use semantic <h1>-<h6> headings so search engines and agents can outline the page.',
    };
  }
  const h1Count = headings.filter(h => h === 1).length;
  const h2Count = headings.filter(h => h === 2).length;
  const first20 = headings.slice(0, 20);
  let skip = false;
  for (let i = 1; i < first20.length; i++) {
    if (first20[i] > first20[i - 1] + 1) { skip = true; break; }
  }
  const issues: string[] = [];
  if (h1Count !== 1) issues.push(`${h1Count} h1 tags (expected exactly 1)`);
  if (h2Count < 1) issues.push('no h2 tags');
  if (skip) issues.push('heading level skips detected');
  if (issues.length === 0) {
    return {
      id: '4.10', name: 'Heading Hierarchy', passed: true, status: 'pass', level: 4, category: 'Indexable', autoDetectable: true,
      message: `Heading hierarchy is clean (1 h1, ${h2Count} h2)`,
    };
  }
  return {
    id: '4.10', name: 'Heading Hierarchy', passed: false, status: issues.length === 1 ? 'partial' : 'fail', level: 4, category: 'Indexable', autoDetectable: true,
    message: `Heading hierarchy issues: ${issues.join('; ')}`,
    recommendation: 'Use exactly one h1, at least one h2, and avoid skipping heading levels.',
  };
}

// --- Level 4: 4.11 Image Alt Coverage ---

export function checkImageAltCoverage(html: string | null): CheckResult {
  if (!html) {
    return {
      id: '4.11', name: 'Image Alt Coverage', passed: false, status: 'fail', level: 4, category: 'Indexable', autoDetectable: true,
      message: 'Could not fetch homepage',
    };
  }
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  if (imgs.length === 0) {
    return {
      id: '4.11', name: 'Image Alt Coverage', passed: false, status: 'na', level: 4, category: 'Indexable', autoDetectable: true,
      message: 'No images on the homepage — not applicable',
    };
  }
  const withAlt = imgs.filter(tag => /\salt\s*=/i.test(tag));
  const ratio = withAlt.length / imgs.length;
  if (ratio >= 0.8) {
    return {
      id: '4.11', name: 'Image Alt Coverage', passed: true, status: 'pass', level: 4, category: 'Indexable', autoDetectable: true,
      message: `${withAlt.length}/${imgs.length} images have alt attributes (${Math.round(ratio * 100)}%)`,
    };
  }
  return {
    id: '4.11', name: 'Image Alt Coverage', passed: false, status: ratio >= 0.5 ? 'partial' : 'fail', level: 4, category: 'Indexable', autoDetectable: true,
    message: `Only ${withAlt.length}/${imgs.length} images have alt attributes (${Math.round(ratio * 100)}%)`,
    recommendation: 'Add alt text to every <img> (use alt="" for purely decorative images).',
  };
}

// --- Level 4: 4.12 Substantive Content ---

export function checkSubstantiveContent(html: string | null): CheckResult {
  if (!html) {
    return {
      id: '4.12', name: 'Substantive Content', passed: false, status: 'fail', level: 4, category: 'Indexable', autoDetectable: true,
      message: 'Could not fetch homepage',
    };
  }
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header\b[\s\S]*?<\/header>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const wordCount = stripped.length === 0 ? 0 : stripped.split(/\s+/).length;
  if (wordCount >= 300) {
    return {
      id: '4.12', name: 'Substantive Content', passed: true, status: 'pass', level: 4, category: 'Indexable', autoDetectable: true,
      message: `${wordCount} words of substantive content`,
    };
  }
  return {
    id: '4.12', name: 'Substantive Content', passed: false, status: wordCount >= 150 ? 'partial' : 'fail', level: 4, category: 'Indexable', autoDetectable: true,
    message: `Only ${wordCount} words of substantive content (need >=300)`,
    recommendation: 'Add at least 300 words of real content to the homepage so it carries meaning for indexing and AI grounding.',
  };
}

// --- Run All Checks ---

export async function runAllChecks(baseUrl: string): Promise<CheckResult[]> {
  // Fetch shared resources once
  const [spec, homepage, robotsTxt] = await Promise.all([
    fetchOpenApiSpec(baseUrl),
    fetchHomepageData(baseUrl),
    fetchRobotsTxt(baseUrl),
  ]);
  const homepageHtml = homepage.html;
  const xRobotsTag = homepage.xRobotsTag;

  // Level 1 checks (17 — token efficiency added after so it can apply mitigations)
  const level1Base = await Promise.all([
    checkLlmsTxt(baseUrl),
    checkAgentCard(baseUrl),
    Promise.resolve(checkOpenApiSpecFromParsed(spec)),
    checkRobotsTxt(baseUrl),
    Promise.resolve(checkStructuredData(homepageHtml)),
    checkCorsHeaders(baseUrl),
    Promise.resolve(checkAiMetaTags(homepageHtml)),
    checkSkillFile(baseUrl),
    checkAiSiteProfile(baseUrl),
    checkSkillsIndex(baseUrl),
    Promise.resolve(checkLinkHeaders(homepageHtml)),
    checkMcpServer(baseUrl),
    checkRssFeed(homepageHtml, baseUrl),
    Promise.resolve(checkContentSignals(robotsTxt)),
    checkApiCatalog(baseUrl),
    checkMarkdownForAgents(baseUrl),
    Promise.resolve(checkWebMcp(homepageHtml)),
  ]);
  const tokenEfficiency = checkPageTokenEfficiency(homepageHtml, level1Base);
  const level1 = [...level1Base, tokenEfficiency];

  // Level 2 checks
  const level2 = await Promise.all([
    Promise.resolve(checkApiReadOps(spec)),
    Promise.resolve(checkApiWriteOps(spec)),
    Promise.resolve(checkApiPrimaryAction(spec)),
    Promise.resolve(checkApiKeyAuth(spec)),
    Promise.resolve(checkScopedApiKeys(spec)),
    checkOpenIdConfig(baseUrl),
    checkStructuredErrors(baseUrl),
    Promise.resolve(checkAsyncOps(spec)),
    Promise.resolve(checkIdempotency(spec)),
    checkOAuthProtectedResource(baseUrl),
    checkX402Payments(baseUrl),
  ]);

  // Level 3 checks
  const level3 = await Promise.all([
    Promise.resolve(checkSparseFields(spec)),
    Promise.resolve(checkCursorPagination(spec)),
    Promise.resolve(checkSearchFiltering(spec)),
    Promise.resolve(checkBulkOps(spec)),
    checkRateLimitHeaders(baseUrl),
    checkCachingHeaders(baseUrl),
    checkMcpToolQuality(baseUrl),
  ]);

  // Level 4: Indexable
  const level4 = await Promise.all([
    Promise.resolve(checkGooglebotAllowed(robotsTxt)),
    Promise.resolve(checkGoogleExtendedPolicy(robotsTxt)),
    Promise.resolve(checkHomepageIndexable(homepageHtml, xRobotsTag)),
    checkSitemapPresent(baseUrl, robotsTxt),
    checkHttps(baseUrl),
    Promise.resolve(checkMobileViewport(homepageHtml)),
    Promise.resolve(checkJsonLdPresent(homepageHtml)),
    Promise.resolve(checkEntitySchema(homepageHtml)),
    Promise.resolve(checkCanonicalUrl(homepageHtml, baseUrl)),
    Promise.resolve(checkHeadingHierarchy(homepageHtml)),
    Promise.resolve(checkImageAltCoverage(homepageHtml)),
    Promise.resolve(checkSubstantiveContent(homepageHtml)),
  ]);

  return [...level1, ...level2, ...level3, ...level4];
}
