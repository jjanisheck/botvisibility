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

// --- Run All Checks ---

export async function runAllChecks(baseUrl: string): Promise<CheckResult[]> {
  // First, fetch OpenAPI spec and homepage HTML (used by many checks)
  const [spec, homepageHtml] = await Promise.all([
    fetchOpenApiSpec(baseUrl),
    fetchHomepageHtml(baseUrl),
  ]);

  // Level 1 checks (parallel) — 13 discovery checks (token efficiency added after)
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
  ]);

  // Token efficiency runs after other L1 checks so it can apply mitigations
  const tokenEfficiency = checkPageTokenEfficiency(homepageHtml, level1Base);
  const level1 = [...level1Base, tokenEfficiency];

  // Level 2 checks (mix of sync spec-dependent + async network)
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
  ]);

  // Level 3 checks (mix of sync spec-dependent + async network)
  const level3 = await Promise.all([
    Promise.resolve(checkSparseFields(spec)),
    Promise.resolve(checkCursorPagination(spec)),
    Promise.resolve(checkSearchFiltering(spec)),
    Promise.resolve(checkBulkOps(spec)),
    checkRateLimitHeaders(baseUrl),
    checkCachingHeaders(baseUrl),
    checkMcpToolQuality(baseUrl),
  ]);

  return [...level1, ...level2, ...level3];
}
