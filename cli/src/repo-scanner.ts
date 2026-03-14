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
        // Skip node_modules, .git, etc
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

// Check for OpenAPI/Swagger spec files in repo
export function checkOpenApiFiles(repoPath: string): RepoCheckResult {
  const specFiles = findFiles(repoPath, /\b(openapi|swagger)\.(json|ya?ml)$/i);

  if (specFiles.length > 0) {
    return {
      id: 'repo-openapi',
      name: 'OpenAPI Spec Files',
      passed: true,
      status: 'pass',
      level: 1,
      category: 'Discoverable',
      autoDetectable: true,
      message: `Found ${specFiles.length} OpenAPI/Swagger spec file(s)`,
      filePath: specFiles[0],
      details: specFiles.map(f => path.relative(repoPath, f)).join(', ')
    };
  }

  return {
    id: 'repo-openapi',
    name: 'OpenAPI Spec Files',
    passed: false,
    status: 'fail',
    level: 1,
    category: 'Discoverable',
    autoDetectable: true,
    message: 'No OpenAPI/Swagger spec files found in repo',
    recommendation: 'Create an openapi.json or openapi.yaml file defining your API'
  };
}

// Check for webhook handler patterns
export function checkWebhookHandlers(repoPath: string): RepoCheckResult {
  const patterns = [
    /webhook/i,
    /on_?event/i,
    /handle_?event/i,
    /event_?handler/i
  ];

  const codeFiles = /\.(ts|js|py|rb|go|java|php)$/;
  const allMatches: Array<{file: string, line: number, content: string}> = [];

  for (const pattern of patterns) {
    const matches = searchInFiles(repoPath, pattern, codeFiles);
    allMatches.push(...matches);
  }

  if (allMatches.length > 0) {
    const uniqueFiles = [...new Set(allMatches.map(m => m.file))];
    return {
      id: 'repo-webhooks',
      name: 'Webhook Handlers',
      passed: true,
      status: 'pass',
      level: 2,
      category: 'Usable',
      autoDetectable: true,
      message: `Found webhook patterns in ${uniqueFiles.length} file(s)`,
      details: allMatches.slice(0, 3).map(m =>
        `${path.relative(repoPath, m.file)}:${m.line}`
      ).join(', ')
    };
  }

  return {
    id: 'repo-webhooks',
    name: 'Webhook Handlers',
    passed: false,
    status: 'fail',
    level: 2,
    category: 'Usable',
    autoDetectable: true,
    message: 'No webhook handler patterns found',
    recommendation: 'Implement webhook endpoints for async event notifications'
  };
}

// Check for rate limit middleware
export function checkRateLimitMiddleware(repoPath: string): RepoCheckResult {
  const patterns = [
    /rate.?limit/i,
    /throttle/i,
    /RateLimiter/i,
    /express-rate-limit/i,
    /slowapi/i,
    /ratelimit/i
  ];

  const codeFiles = /\.(ts|js|py|rb|go|java|php|json)$/;
  const allMatches: Array<{file: string, line: number, content: string}> = [];

  for (const pattern of patterns) {
    const matches = searchInFiles(repoPath, pattern, codeFiles);
    allMatches.push(...matches);
  }

  if (allMatches.length > 0) {
    return {
      id: 'repo-ratelimit',
      name: 'Rate Limit Middleware',
      passed: true,
      status: 'pass',
      level: 3,
      category: 'Optimized',
      autoDetectable: true,
      message: `Found rate limiting in ${allMatches.length} location(s)`,
      details: allMatches.slice(0, 3).map(m =>
        `${path.relative(repoPath, m.file)}:${m.line}`
      ).join(', ')
    };
  }

  return {
    id: 'repo-ratelimit',
    name: 'Rate Limit Middleware',
    passed: false,
    status: 'fail',
    level: 3,
    category: 'Optimized',
    autoDetectable: true,
    message: 'No rate limiting middleware found',
    recommendation: 'Add rate limiting to protect your API and return proper headers'
  };
}

// Check error response patterns
export function checkErrorPatterns(repoPath: string): RepoCheckResult {
  const goodPatterns = [
    /error.?code/i,
    /error_code/i,
    /"error"\s*:\s*\{/i,
    /json\s*\(\s*\{\s*"?error/i,
    /JsonResponse.*error/i
  ];

  const codeFiles = /\.(ts|js|py|rb|go|java|php)$/;
  const allMatches: Array<{file: string, line: number, content: string}> = [];

  for (const pattern of goodPatterns) {
    const matches = searchInFiles(repoPath, pattern, codeFiles);
    allMatches.push(...matches);
  }

  if (allMatches.length >= 3) {
    return {
      id: 'repo-errors',
      name: 'Structured Error Responses',
      passed: true,
      status: 'pass',
      level: 2,
      category: 'Usable',
      autoDetectable: true,
      message: `Found structured error patterns in ${allMatches.length} location(s)`,
      details: 'Code uses consistent error response structure'
    };
  } else if (allMatches.length > 0) {
    return {
      id: 'repo-errors',
      name: 'Structured Error Responses',
      passed: false,
      status: 'partial',
      level: 2,
      category: 'Usable',
      autoDetectable: true,
      message: `Found some error patterns (${allMatches.length})`,
      recommendation: 'Ensure all errors return structured JSON with error codes'
    };
  }

  return {
    id: 'repo-errors',
    name: 'Structured Error Responses',
    passed: false,
    status: 'fail',
    level: 2,
    category: 'Usable',
    autoDetectable: true,
    message: 'No structured error patterns found',
    recommendation: 'Add consistent error response format: { "error": { "code": "...", "message": "..." } }'
  };
}

// Check for idempotency key handling
export function checkIdempotencyKeys(repoPath: string): RepoCheckResult {
  const patterns = [
    /idempoten/i,
    /Idempotency.?Key/i,
    /idempotency_key/i,
    /x-idempotency/i
  ];

  const codeFiles = /\.(ts|js|py|rb|go|java|php)$/;
  const allMatches: Array<{file: string, line: number, content: string}> = [];

  for (const pattern of patterns) {
    const matches = searchInFiles(repoPath, pattern, codeFiles);
    allMatches.push(...matches);
  }

  if (allMatches.length > 0) {
    return {
      id: 'repo-idempotency',
      name: 'Idempotency Keys',
      passed: true,
      status: 'pass',
      level: 2,
      category: 'Usable',
      autoDetectable: true,
      message: `Found idempotency handling in ${allMatches.length} location(s)`,
      details: allMatches.slice(0, 2).map(m =>
        `${path.relative(repoPath, m.file)}:${m.line}`
      ).join(', ')
    };
  }

  return {
    id: 'repo-idempotency',
    name: 'Idempotency Keys',
    passed: false,
    status: 'fail',
    level: 2,
    category: 'Usable',
    autoDetectable: true,
    message: 'No idempotency key handling found',
    recommendation: 'Support Idempotency-Key header for write operations'
  };
}

// Check for SDK/client library
export function checkSdkLibrary(repoPath: string): RepoCheckResult {
  // Check for common SDK patterns
  const sdkPatterns = [
    /sdk/i,
    /client.?lib/i,
    /api.?client/i
  ];

  const dirNames = ['sdk', 'client', 'clients', 'packages'];

  try {
    const items = fs.readdirSync(repoPath);
    for (const item of items) {
      const fullPath = path.join(repoPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && dirNames.some(d => item.toLowerCase().includes(d))) {
        return {
          id: 'repo-sdk',
          name: 'SDK/Client Library',
          passed: true,
          status: 'pass',
          level: 4,
          category: 'Agent-Native',
          autoDetectable: true,
          message: `Found SDK/client directory: ${item}`,
          filePath: fullPath
        };
      }
    }
  } catch {
    // Ignore
  }

  // Check for SDK references in package.json or similar
  const codeFiles = /\.(json|md)$/;
  const allMatches: Array<{file: string, line: number, content: string}> = [];

  for (const pattern of sdkPatterns) {
    const matches = searchInFiles(repoPath, pattern, codeFiles);
    allMatches.push(...matches);
  }

  if (allMatches.length > 0) {
    return {
      id: 'repo-sdk',
      name: 'SDK/Client Library',
      passed: false,
      status: 'partial',
      level: 4,
      category: 'Agent-Native',
      autoDetectable: true,
      message: 'Found SDK references but no dedicated library',
      recommendation: 'Create a standalone SDK package for your API'
    };
  }

  return {
    id: 'repo-sdk',
    name: 'SDK/Client Library',
    passed: false,
    status: 'fail',
    level: 4,
    category: 'Agent-Native',
    autoDetectable: true,
    message: 'No SDK/client library found',
    recommendation: 'Create SDK packages for common languages'
  };
}

// Check for streaming/event endpoints
export function checkStreamingEndpoints(repoPath: string): RepoCheckResult {
  const patterns = [
    /server.?sent.?event/i,
    /EventSource/i,
    /text\/event-stream/i,
    /websocket/i,
    /socket\.io/i,
    /streaming/i,
    /stream.?response/i
  ];

  const codeFiles = /\.(ts|js|py|rb|go|java|php)$/;
  const allMatches: Array<{file: string, line: number, content: string}> = [];

  for (const pattern of patterns) {
    const matches = searchInFiles(repoPath, pattern, codeFiles);
    allMatches.push(...matches);
  }

  if (allMatches.length > 0) {
    return {
      id: 'repo-streaming',
      name: 'Streaming/Event Endpoints',
      passed: true,
      status: 'pass',
      level: 3,
      category: 'Optimized',
      autoDetectable: true,
      message: `Found streaming patterns in ${allMatches.length} location(s)`,
      details: allMatches.slice(0, 2).map(m =>
        `${path.relative(repoPath, m.file)}:${m.line}`
      ).join(', ')
    };
  }

  return {
    id: 'repo-streaming',
    name: 'Streaming/Event Endpoints',
    passed: false,
    status: 'fail',
    level: 3,
    category: 'Optimized',
    autoDetectable: true,
    message: 'No streaming/event endpoints found',
    recommendation: 'Consider adding SSE or WebSocket for real-time updates'
  };
}

// Run all repo checks
export function runRepoChecks(repoPath: string): RepoCheckResult[] {
  // Verify path exists
  if (!fs.existsSync(repoPath)) {
    return [{
      id: 'repo-error',
      name: 'Repository Path',
      passed: false,
      status: 'fail',
      level: 1,
      category: 'Error',
      autoDetectable: true,
      message: `Path does not exist: ${repoPath}`
    }];
  }

  return [
    checkOpenApiFiles(repoPath),
    checkWebhookHandlers(repoPath),
    checkRateLimitMiddleware(repoPath),
    checkErrorPatterns(repoPath),
    checkIdempotencyKeys(repoPath),
    checkSdkLibrary(repoPath),
    checkStreamingEndpoints(repoPath)
  ];
}
