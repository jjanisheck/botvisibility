import { RepoCheckResult } from './types.js';
import * as fs from 'fs';
import * as path from 'path';

// Recursive file finder
function findFiles(dir: string, pattern: RegExp, results: string[] = []): string[] {
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (!['node_modules', '.git', 'dist', 'build', '.next', 'vendor'].includes(item)) {
          findFiles(fullPath, pattern, results);
        }
      } else if (pattern.test(item)) {
        results.push(fullPath);
      }
    }
  } catch {
    // Skip unreadable directories
  }
  return results;
}

// Search file content
function searchInFiles(dir: string, pattern: RegExp, filePattern: RegExp): Array<{file: string, line: number, content: string}> {
  const matches: Array<{file: string, line: number, content: string}> = [];
  const files = findFiles(dir, filePattern);

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          matches.push({
            file,
            line: i + 1,
            content: lines[i].trim().slice(0, 100)
          });
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  return matches;
}

const codeFiles = /\.(ts|js|py|rb|go|java|php)$/;
const allFiles = /\.(ts|js|py|rb|go|java|php|json|ya?ml|md|toml)$/;

// --- Supplemental checks (kept from original, remapped IDs) ---

export function checkOpenApiFiles(repoPath: string): RepoCheckResult {
  const specFiles = findFiles(repoPath, /\b(openapi|swagger)\.(json|ya?ml)$/i);

  if (specFiles.length > 0) {
    return {
      id: 'repo-1.3', name: 'OpenAPI Spec Files', passed: true, status: 'pass', level: 1, category: 'Discoverable', autoDetectable: true,
      message: `Found ${specFiles.length} OpenAPI/Swagger spec file(s)`,
      filePath: specFiles[0],
      details: specFiles.map(f => path.relative(repoPath, f)).join(', ')
    };
  }

  return {
    id: 'repo-1.3', name: 'OpenAPI Spec Files', passed: false, status: 'fail', level: 1, category: 'Discoverable', autoDetectable: true,
    message: 'No OpenAPI/Swagger spec files found in repo',
    recommendation: 'Create an openapi.json or openapi.yaml file defining your API'
  };
}

export function checkRateLimitMiddleware(repoPath: string): RepoCheckResult {
  const patterns = [/rate.?limit/i, /throttle/i, /RateLimiter/i, /express-rate-limit/i, /slowapi/i, /ratelimit/i];
  const allMatches: Array<{file: string, line: number, content: string}> = [];

  for (const pattern of patterns) {
    allMatches.push(...searchInFiles(repoPath, pattern, codeFiles));
  }

  if (allMatches.length > 0) {
    return {
      id: 'repo-3.5', name: 'Rate Limit Middleware', passed: true, status: 'pass', level: 3, category: 'Optimized', autoDetectable: true,
      message: `Found rate limiting in ${allMatches.length} location(s)`,
      details: allMatches.slice(0, 3).map(m => `${path.relative(repoPath, m.file)}:${m.line}`).join(', ')
    };
  }

  return {
    id: 'repo-3.5', name: 'Rate Limit Middleware', passed: false, status: 'fail', level: 3, category: 'Optimized', autoDetectable: true,
    message: 'No rate limiting middleware found',
    recommendation: 'Add rate limiting to protect your API and return proper headers'
  };
}

export function checkErrorPatterns(repoPath: string): RepoCheckResult {
  const goodPatterns = [/error.?code/i, /error_code/i, /"error"\s*:\s*\{/i, /json\s*\(\s*\{\s*"?error/i, /JsonResponse.*error/i];
  const allMatches: Array<{file: string, line: number, content: string}> = [];

  for (const pattern of goodPatterns) {
    allMatches.push(...searchInFiles(repoPath, pattern, codeFiles));
  }

  if (allMatches.length >= 3) {
    return {
      id: 'repo-2.7', name: 'Structured Error Responses', passed: true, status: 'pass', level: 2, category: 'Usable', autoDetectable: true,
      message: `Found structured error patterns in ${allMatches.length} location(s)`,
      details: 'Code uses consistent error response structure'
    };
  } else if (allMatches.length > 0) {
    return {
      id: 'repo-2.7', name: 'Structured Error Responses', passed: false, status: 'partial', level: 2, category: 'Usable', autoDetectable: true,
      message: `Found some error patterns (${allMatches.length})`,
      recommendation: 'Ensure all errors return structured JSON with error codes'
    };
  }

  return {
    id: 'repo-2.7', name: 'Structured Error Responses', passed: false, status: 'fail', level: 2, category: 'Usable', autoDetectable: true,
    message: 'No structured error patterns found',
    recommendation: 'Add consistent error response format: { "error": { "code": "...", "message": "..." } }'
  };
}

export function checkIdempotencyKeys(repoPath: string): RepoCheckResult {
  const patterns = [/idempoten/i, /Idempotency.?Key/i, /idempotency_key/i, /x-idempotency/i];
  const allMatches: Array<{file: string, line: number, content: string}> = [];

  for (const pattern of patterns) {
    allMatches.push(...searchInFiles(repoPath, pattern, codeFiles));
  }

  if (allMatches.length > 0) {
    return {
      id: 'repo-2.9', name: 'Idempotency Keys', passed: true, status: 'pass', level: 2, category: 'Usable', autoDetectable: true,
      message: `Found idempotency handling in ${allMatches.length} location(s)`,
      details: allMatches.slice(0, 2).map(m => `${path.relative(repoPath, m.file)}:${m.line}`).join(', ')
    };
  }

  return {
    id: 'repo-2.9', name: 'Idempotency Keys', passed: false, status: 'fail', level: 2, category: 'Usable', autoDetectable: true,
    message: 'No idempotency key handling found',
    recommendation: 'Support Idempotency-Key header for write operations'
  };
}

export function checkStreamingEndpoints(repoPath: string): RepoCheckResult {
  const patterns = [/server.?sent.?event/i, /EventSource/i, /text\/event-stream/i, /websocket/i, /socket\.io/i, /streaming/i, /stream.?response/i];
  const allMatches: Array<{file: string, line: number, content: string}> = [];

  for (const pattern of patterns) {
    allMatches.push(...searchInFiles(repoPath, pattern, codeFiles));
  }

  if (allMatches.length > 0) {
    return {
      id: 'repo-3.6', name: 'Streaming/Event Endpoints', passed: true, status: 'pass', level: 3, category: 'Optimized', autoDetectable: true,
      message: `Found streaming patterns in ${allMatches.length} location(s)`,
      details: allMatches.slice(0, 2).map(m => `${path.relative(repoPath, m.file)}:${m.line}`).join(', ')
    };
  }

  return {
    id: 'repo-3.6', name: 'Streaming/Event Endpoints', passed: false, status: 'fail', level: 3, category: 'Optimized', autoDetectable: true,
    message: 'No streaming/event endpoints found',
    recommendation: 'Consider adding SSE or WebSocket for real-time updates'
  };
}

// --- Level 5: Agent-Native checks ---

export function checkIntentEndpoints(repoPath: string): RepoCheckResult {
  // Search for intent-based/action-oriented route patterns
  const patterns = [
    /\/(send|process|execute|submit|trigger|run|perform|generate|analyze|convert|export|import|sync|verify|validate|approve|reject|cancel|refund)[_-]?\w+/i,
    /router\.(post|put)\s*\(\s*['"]\/(send|process|execute|submit|trigger)/i,
    /app\.(post|put)\s*\(\s*['"]\/(send|process|execute|submit|trigger)/i,
    /path\s*=\s*['"]\/(send|process|execute|submit|trigger)/i,
  ];

  const allMatches: Array<{file: string, line: number, content: string}> = [];
  for (const pattern of patterns) {
    allMatches.push(...searchInFiles(repoPath, pattern, codeFiles));
  }

  if (allMatches.length >= 2) {
    const uniqueFiles = [...new Set(allMatches.map(m => m.file))];
    return {
      id: '5.1', name: 'Intent-Based Endpoints', passed: true, status: 'pass', level: 5, category: 'Agent-Native', autoDetectable: true,
      message: `Found intent-based endpoints in ${uniqueFiles.length} file(s)`,
      details: allMatches.slice(0, 3).map(m => `${path.relative(repoPath, m.file)}:${m.line}`).join(', ')
    };
  } else if (allMatches.length === 1) {
    return {
      id: '5.1', name: 'Intent-Based Endpoints', passed: false, status: 'partial', level: 5, category: 'Agent-Native', autoDetectable: true,
      message: 'Found some intent-based patterns',
      recommendation: 'Add more high-level intent endpoints (e.g., /send-invoice, /process-payment) alongside CRUD'
    };
  }

  return {
    id: '5.1', name: 'Intent-Based Endpoints', passed: false, status: 'fail', level: 5, category: 'Agent-Native', autoDetectable: true,
    message: 'No intent-based endpoints found',
    recommendation: 'Add high-level intent endpoints (e.g., /send-invoice, /process-payment) alongside CRUD'
  };
}

export function checkAgentSessions(repoPath: string): RepoCheckResult {
  const patterns = [
    /agent.?session/i,
    /session.?context/i,
    /conversation.?id/i,
    /thread.?id/i,
    /agent.?context/i,
    /persistent.?session/i,
    /session.?store/i,
    /x-session-id/i,
    /x-agent-session/i,
  ];

  const allMatches: Array<{file: string, line: number, content: string}> = [];
  for (const pattern of patterns) {
    allMatches.push(...searchInFiles(repoPath, pattern, allFiles));
  }

  if (allMatches.length > 0) {
    const uniqueFiles = [...new Set(allMatches.map(m => m.file))];
    return {
      id: '5.2', name: 'Agent Sessions', passed: true, status: 'pass', level: 5, category: 'Agent-Native', autoDetectable: true,
      message: `Found agent session patterns in ${uniqueFiles.length} file(s)`,
      details: allMatches.slice(0, 3).map(m => `${path.relative(repoPath, m.file)}:${m.line}`).join(', ')
    };
  }

  return {
    id: '5.2', name: 'Agent Sessions', passed: false, status: 'fail', level: 5, category: 'Agent-Native', autoDetectable: true,
    message: 'No agent session management found',
    recommendation: 'Implement persistent sessions with context for multi-step agent interactions'
  };
}

export function checkScopedAgentTokens(repoPath: string): RepoCheckResult {
  const patterns = [
    /agent.?token/i,
    /agent.?scope/i,
    /agent.?key/i,
    /agent.?credential/i,
    /capability.?limit/i,
    /scoped.?token/i,
    /agent.?permission/i,
    /agent.?role/i,
    /x-agent-token/i,
  ];

  const allMatches: Array<{file: string, line: number, content: string}> = [];
  for (const pattern of patterns) {
    allMatches.push(...searchInFiles(repoPath, pattern, allFiles));
  }

  if (allMatches.length > 0) {
    const uniqueFiles = [...new Set(allMatches.map(m => m.file))];
    return {
      id: '5.3', name: 'Scoped Agent Tokens', passed: true, status: 'pass', level: 5, category: 'Agent-Native', autoDetectable: true,
      message: `Found agent token patterns in ${uniqueFiles.length} file(s)`,
      details: allMatches.slice(0, 3).map(m => `${path.relative(repoPath, m.file)}:${m.line}`).join(', ')
    };
  }

  return {
    id: '5.3', name: 'Scoped Agent Tokens', passed: false, status: 'fail', level: 5, category: 'Agent-Native', autoDetectable: true,
    message: 'No agent-specific token/scope patterns found',
    recommendation: 'Create agent-specific tokens with capability limits (read-only, write, admin)'
  };
}

export function checkAgentAuditLogs(repoPath: string): RepoCheckResult {
  const patterns = [
    /agent.?audit/i,
    /audit.?log.*agent/i,
    /agent.?identifier/i,
    /agent.?id.*log/i,
    /log.*agent.?id/i,
    /x-agent-id/i,
    /user.?agent.*audit/i,
  ];

  const allMatches: Array<{file: string, line: number, content: string}> = [];
  for (const pattern of patterns) {
    allMatches.push(...searchInFiles(repoPath, pattern, allFiles));
  }

  if (allMatches.length > 0) {
    const uniqueFiles = [...new Set(allMatches.map(m => m.file))];
    return {
      id: '5.4', name: 'Agent Audit Logs', passed: true, status: 'pass', level: 5, category: 'Agent-Native', autoDetectable: true,
      message: `Found agent audit logging in ${uniqueFiles.length} file(s)`,
      details: allMatches.slice(0, 3).map(m => `${path.relative(repoPath, m.file)}:${m.line}`).join(', ')
    };
  }

  return {
    id: '5.4', name: 'Agent Audit Logs', passed: false, status: 'fail', level: 5, category: 'Agent-Native', autoDetectable: true,
    message: 'No agent audit logging found',
    recommendation: 'Log API actions with agent identifiers for traceability'
  };
}

export function checkSandboxEnvironment(repoPath: string): RepoCheckResult {
  const patterns = [
    /sandbox/i,
    /test.?environment/i,
    /staging.?env/i,
    /dry.?run/i,
    /test.?mode/i,
  ];

  const allMatches: Array<{file: string, line: number, content: string}> = [];
  for (const pattern of patterns) {
    allMatches.push(...searchInFiles(repoPath, pattern, allFiles));
  }

  // Also check for sandbox config files
  const sandboxFiles = findFiles(repoPath, /sandbox|\.env\.test|\.env\.staging/i);

  const total = allMatches.length + sandboxFiles.length;

  if (total > 0) {
    return {
      id: '5.5', name: 'Sandbox Environment', passed: true, status: 'pass', level: 5, category: 'Agent-Native', autoDetectable: true,
      message: `Found sandbox/test environment patterns in ${total} location(s)`,
      details: allMatches.length > 0
        ? allMatches.slice(0, 2).map(m => `${path.relative(repoPath, m.file)}:${m.line}`).join(', ')
        : sandboxFiles.slice(0, 2).map(f => path.relative(repoPath, f)).join(', ')
    };
  }

  return {
    id: '5.5', name: 'Sandbox Environment', passed: false, status: 'fail', level: 5, category: 'Agent-Native', autoDetectable: true,
    message: 'No sandbox environment found',
    recommendation: 'Provide a sandbox environment for agents to test operations safely'
  };
}

export function checkConsequenceLabels(repoPath: string): RepoCheckResult {
  const patterns = [
    /consequen(ce|tial)/i,
    /irreversible/i,
    /destructive/i,
    /dangerous/i,
    /x-consequence/i,
    /x-reversible/i,
    /side.?effect/i,
    /confirmation.?required/i,
  ];

  const allMatches: Array<{file: string, line: number, content: string}> = [];
  for (const pattern of patterns) {
    allMatches.push(...searchInFiles(repoPath, pattern, allFiles));
  }

  if (allMatches.length > 0) {
    const uniqueFiles = [...new Set(allMatches.map(m => m.file))];
    return {
      id: '5.6', name: 'Consequence Labels', passed: true, status: 'pass', level: 5, category: 'Agent-Native', autoDetectable: true,
      message: `Found consequence annotations in ${uniqueFiles.length} file(s)`,
      details: allMatches.slice(0, 3).map(m => `${path.relative(repoPath, m.file)}:${m.line}`).join(', ')
    };
  }

  return {
    id: '5.6', name: 'Consequence Labels', passed: false, status: 'fail', level: 5, category: 'Agent-Native', autoDetectable: true,
    message: 'No consequence labels found',
    recommendation: 'Mark consequential/irreversible actions in your API docs or schema annotations'
  };
}

export function checkNativeToolSchemas(repoPath: string): RepoCheckResult {
  // Check for tool definition files
  const toolFiles = findFiles(repoPath, /\.(tool|tools)\.(json|ya?ml)$|mcp\.(json|ya?ml)$|tool_?definitions?\.(json|ya?ml)$/i);

  // Also search for tool schema patterns in code
  const patterns = [
    /tool.?schema/i,
    /tool.?definition/i,
    /function.?calling/i,
    /tool.?manifest/i,
    /mcp.?config/i,
    /openai.?function/i,
    /anthropic.?tool/i,
  ];

  const allMatches: Array<{file: string, line: number, content: string}> = [];
  for (const pattern of patterns) {
    allMatches.push(...searchInFiles(repoPath, pattern, allFiles));
  }

  const total = toolFiles.length + allMatches.length;

  if (toolFiles.length > 0) {
    return {
      id: '5.7', name: 'Native Tool Schemas', passed: true, status: 'pass', level: 5, category: 'Agent-Native', autoDetectable: true,
      message: `Found tool definition files`,
      filePath: toolFiles[0],
      details: toolFiles.map(f => path.relative(repoPath, f)).join(', ')
    };
  } else if (allMatches.length > 0) {
    return {
      id: '5.7', name: 'Native Tool Schemas', passed: false, status: 'partial', level: 5, category: 'Agent-Native', autoDetectable: true,
      message: `Found tool schema references in ${allMatches.length} location(s)`,
      details: allMatches.slice(0, 2).map(m => `${path.relative(repoPath, m.file)}:${m.line}`).join(', '),
      recommendation: 'Extract tool definitions into standalone .tool.json or MCP config files'
    };
  }

  return {
    id: '5.7', name: 'Native Tool Schemas', passed: false, status: 'fail', level: 5, category: 'Agent-Native', autoDetectable: true,
    message: 'No tool definition files found',
    recommendation: 'Create ready-to-use tool definition files (.tool.json, MCP configs) for agent frameworks'
  };
}

// --- Level 3: Optimization code checks ---

export function checkSparseFieldsCode(repoPath: string): RepoCheckResult {
  const patterns = [
    /[?&]fields=/i,
    /[?&]select=/i,
    /\.select\s*\(/i,
    /\.only\s*\(/i,
    /\.values\s*\(/i,
    /\.values_list\s*\(/i,
    /fields\s*[:=]\s*req/i,
    /query\.fields/i,
    /params\.(fields|select)/i,
    /projection\s*[:=]/i,
  ];

  const allMatches: Array<{file: string, line: number, content: string}> = [];
  for (const pattern of patterns) {
    allMatches.push(...searchInFiles(repoPath, pattern, codeFiles));
  }

  if (allMatches.length >= 2) {
    const uniqueFiles = [...new Set(allMatches.map(m => m.file))];
    return {
      id: 'repo-3.1', name: 'Sparse Fields', passed: true, status: 'pass', level: 3, category: 'Optimized', autoDetectable: true,
      message: `Found sparse field patterns in ${uniqueFiles.length} file(s)`,
      details: allMatches.slice(0, 3).map(m => `${path.relative(repoPath, m.file)}:${m.line}`).join(', ')
    };
  } else if (allMatches.length === 1) {
    return {
      id: 'repo-3.1', name: 'Sparse Fields', passed: false, status: 'partial', level: 3, category: 'Optimized', autoDetectable: true,
      message: 'Found some sparse field patterns',
      recommendation: 'Add a fields or select query parameter to all list/get endpoints'
    };
  }

  return {
    id: 'repo-3.1', name: 'Sparse Fields', passed: false, status: 'fail', level: 3, category: 'Optimized', autoDetectable: true,
    message: 'No sparse field support found in code',
    recommendation: 'Add a fields or select parameter to endpoints so agents can request only needed data'
  };
}

export function checkCursorPaginationCode(repoPath: string): RepoCheckResult {
  const patterns = [
    /cursor/i,
    /next_?token/i,
    /next_?page_?token/i,
    /page_?token/i,
    /start_?after/i,
    /\.paginate\s*\(/i,
    /has_?more/i,
    /next_?cursor/i,
    /continuation_?token/i,
  ];

  const allMatches: Array<{file: string, line: number, content: string}> = [];
  for (const pattern of patterns) {
    allMatches.push(...searchInFiles(repoPath, pattern, codeFiles));
  }

  if (allMatches.length >= 2) {
    const uniqueFiles = [...new Set(allMatches.map(m => m.file))];
    return {
      id: 'repo-3.2', name: 'Cursor Pagination', passed: true, status: 'pass', level: 3, category: 'Optimized', autoDetectable: true,
      message: `Found cursor pagination patterns in ${uniqueFiles.length} file(s)`,
      details: allMatches.slice(0, 3).map(m => `${path.relative(repoPath, m.file)}:${m.line}`).join(', ')
    };
  } else if (allMatches.length === 1) {
    return {
      id: 'repo-3.2', name: 'Cursor Pagination', passed: false, status: 'partial', level: 3, category: 'Optimized', autoDetectable: true,
      message: 'Found some cursor pagination patterns',
      recommendation: 'Implement cursor-based pagination on all list endpoints with has_more and next_cursor'
    };
  }

  return {
    id: 'repo-3.2', name: 'Cursor Pagination', passed: false, status: 'fail', level: 3, category: 'Optimized', autoDetectable: true,
    message: 'No cursor pagination found in code',
    recommendation: 'Replace offset pagination with cursor-based pagination for efficient large-set traversal'
  };
}

export function checkSearchFilteringCode(repoPath: string): RepoCheckResult {
  const patterns = [
    /[?&](filter|search|q)=/i,
    /req\.query\.(filter|search|q)\b/i,
    /params\.(filter|search|q)\b/i,
    /query_?params.*filter/i,
    /filter_?by/i,
    /search_?query/i,
    /\.filter\s*\(.*req/i,
    /\.where\s*\(.*req/i,
  ];

  const allMatches: Array<{file: string, line: number, content: string}> = [];
  for (const pattern of patterns) {
    allMatches.push(...searchInFiles(repoPath, pattern, codeFiles));
  }

  if (allMatches.length >= 2) {
    const uniqueFiles = [...new Set(allMatches.map(m => m.file))];
    return {
      id: 'repo-3.3', name: 'Search & Filtering', passed: true, status: 'pass', level: 3, category: 'Optimized', autoDetectable: true,
      message: `Found search/filter patterns in ${uniqueFiles.length} file(s)`,
      details: allMatches.slice(0, 3).map(m => `${path.relative(repoPath, m.file)}:${m.line}`).join(', ')
    };
  } else if (allMatches.length === 1) {
    return {
      id: 'repo-3.3', name: 'Search & Filtering', passed: false, status: 'partial', level: 3, category: 'Optimized', autoDetectable: true,
      message: 'Found some search/filter patterns',
      recommendation: 'Add filter and search query parameters to all list endpoints'
    };
  }

  return {
    id: 'repo-3.3', name: 'Search & Filtering', passed: false, status: 'fail', level: 3, category: 'Optimized', autoDetectable: true,
    message: 'No API search or filtering found in code',
    recommendation: 'Add filter, search, and query parameters so agents can find specific resources without over-fetching'
  };
}

export function checkBulkOpsCode(repoPath: string): RepoCheckResult {
  const patterns = [
    /\/batch/i,
    /\/bulk/i,
    /bulkCreate/i,
    /bulk_create/i,
    /insertMany/i,
    /createMany/i,
    /updateMany/i,
    /deleteMany/i,
    /bulk_update/i,
    /batch_create/i,
    /Promise\.all\s*\(/i,
  ];

  const allMatches: Array<{file: string, line: number, content: string}> = [];
  for (const pattern of patterns) {
    allMatches.push(...searchInFiles(repoPath, pattern, codeFiles));
  }

  if (allMatches.length >= 1) {
    const uniqueFiles = [...new Set(allMatches.map(m => m.file))];
    return {
      id: 'repo-3.4', name: 'Bulk Operations', passed: true, status: 'pass', level: 3, category: 'Optimized', autoDetectable: true,
      message: `Found bulk operation patterns in ${uniqueFiles.length} file(s)`,
      details: allMatches.slice(0, 3).map(m => `${path.relative(repoPath, m.file)}:${m.line}`).join(', ')
    };
  }

  return {
    id: 'repo-3.4', name: 'Bulk Operations', passed: false, status: 'fail', level: 3, category: 'Optimized', autoDetectable: true,
    message: 'No bulk/batch operations found in code',
    recommendation: 'Add batch endpoints for creating, updating, or deleting multiple resources in a single request'
  };
}

export function checkCachingHeadersCode(repoPath: string): RepoCheckResult {
  const patterns = [
    /ETag/i,
    /Cache-Control/i,
    /Last-Modified/i,
    /If-None-Match/i,
    /If-Modified-Since/i,
    /stale-while-revalidate/i,
    /max-age/i,
    /\.cache\s*\(/i,
    /cacheControl/i,
    /setHeader.*cache/i,
  ];

  const allMatches: Array<{file: string, line: number, content: string}> = [];
  for (const pattern of patterns) {
    allMatches.push(...searchInFiles(repoPath, pattern, codeFiles));
  }

  if (allMatches.length >= 2) {
    const uniqueFiles = [...new Set(allMatches.map(m => m.file))];
    return {
      id: 'repo-3.6', name: 'Caching Headers', passed: true, status: 'pass', level: 3, category: 'Optimized', autoDetectable: true,
      message: `Found caching header patterns in ${uniqueFiles.length} file(s)`,
      details: allMatches.slice(0, 3).map(m => `${path.relative(repoPath, m.file)}:${m.line}`).join(', ')
    };
  } else if (allMatches.length === 1) {
    return {
      id: 'repo-3.6', name: 'Caching Headers', passed: false, status: 'partial', level: 3, category: 'Optimized', autoDetectable: true,
      message: 'Found some caching patterns',
      recommendation: 'Add ETag, Cache-Control, and Last-Modified headers to API responses'
    };
  }

  return {
    id: 'repo-3.6', name: 'Caching Headers', passed: false, status: 'fail', level: 3, category: 'Optimized', autoDetectable: true,
    message: 'No caching header patterns found in code',
    recommendation: 'Add Cache-Control, ETag, and Last-Modified headers to reduce token waste from redundant requests'
  };
}

export function checkMcpToolQualityCode(repoPath: string): RepoCheckResult {
  // Look for MCP server definitions
  const mcpPatterns = [
    /McpServer/i,
    /server\.tool\s*\(/i,
    /\.addTool\s*\(/i,
    /mcp.*server/i,
    /tool.*inputSchema/i,
    /\"tools\"\s*:/i,
  ];

  const mcpMatches: Array<{file: string, line: number, content: string}> = [];
  for (const pattern of mcpPatterns) {
    mcpMatches.push(...searchInFiles(repoPath, pattern, allFiles));
  }

  // Look for MCP config/manifest files
  const mcpFiles = findFiles(repoPath, /mcp\.(json|ya?ml)$|\.well-known.*mcp/i);

  // Check for tool descriptions
  const descPatterns = [/description\s*[:=]\s*["'`]/i];
  const descMatches: Array<{file: string, line: number, content: string}> = [];
  for (const pattern of descPatterns) {
    descMatches.push(...searchInFiles(repoPath, pattern, allFiles));
  }

  const totalMcp = mcpMatches.length + mcpFiles.length;

  if (totalMcp === 0) {
    return {
      id: 'repo-3.7', name: 'MCP Tool Quality', passed: false, status: 'fail', level: 3, category: 'Optimized', autoDetectable: true,
      message: 'No MCP server or tool definitions found in code',
      recommendation: 'Create an MCP server with well-described tools and input schemas for AI agent integration'
    };
  }

  // Check quality: do the tools have descriptions?
  const hasDescriptions = descMatches.length >= 2;
  const schemaPatterns = [/inputSchema/i, /parameters.*type.*object/i, /json.?schema/i];
  let schemaCount = 0;
  for (const pattern of schemaPatterns) {
    schemaCount += searchInFiles(repoPath, pattern, allFiles).length;
  }

  if (hasDescriptions && schemaCount > 0) {
    return {
      id: 'repo-3.7', name: 'MCP Tool Quality', passed: true, status: 'pass', level: 3, category: 'Optimized', autoDetectable: true,
      message: `MCP tools found with descriptions and schemas in ${totalMcp} location(s)`,
      details: mcpMatches.slice(0, 3).map(m => `${path.relative(repoPath, m.file)}:${m.line}`).join(', ')
    };
  }

  return {
    id: 'repo-3.7', name: 'MCP Tool Quality', passed: false, status: 'partial', level: 3, category: 'Optimized', autoDetectable: true,
    message: `MCP tools found but missing ${!hasDescriptions ? 'descriptions' : 'input schemas'}`,
    recommendation: 'Ensure all MCP tools have detailed descriptions (>10 chars) and inputSchema definitions'
  };
}

// --- Run all repo checks ---

export function runRepoChecks(repoPath: string): RepoCheckResult[] {
  if (!fs.existsSync(repoPath)) {
    return [{
      id: 'repo-error', name: 'Repository Path', passed: false, status: 'fail', level: 1, category: 'Error', autoDetectable: true,
      message: `Path does not exist: ${repoPath}`
    }];
  }

  return [
    // Supplemental checks for Levels 1-2
    checkOpenApiFiles(repoPath),
    checkErrorPatterns(repoPath),
    checkIdempotencyKeys(repoPath),
    // Level 3: Optimization code checks
    checkSparseFieldsCode(repoPath),
    checkCursorPaginationCode(repoPath),
    checkSearchFilteringCode(repoPath),
    checkBulkOpsCode(repoPath),
    checkRateLimitMiddleware(repoPath),
    checkCachingHeadersCode(repoPath),
    checkMcpToolQualityCode(repoPath),
    checkStreamingEndpoints(repoPath),
    // Level 5: Agent-Native checks
    checkIntentEndpoints(repoPath),
    checkAgentSessions(repoPath),
    checkScopedAgentTokens(repoPath),
    checkAgentAuditLogs(repoPath),
    checkSandboxEnvironment(repoPath),
    checkConsequenceLabels(repoPath),
    checkNativeToolSchemas(repoPath),
  ];
}
