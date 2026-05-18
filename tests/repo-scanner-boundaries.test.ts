import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  checkIntentEndpoints,
  checkAgentSessions,
  checkScopedAgentTokens,
  checkAgentAuditLogs,
  checkSandboxEnvironment,
  checkConsequenceLabels,
  checkNativeToolSchemas,
  checkErrorPatterns,
  checkSparseFieldsCode,
  checkCursorPaginationCode,
  checkSearchFilteringCode,
  checkBulkOpsCode,
  checkCachingHeadersCode,
} from '../src/repo-scanner.js';

// Build a throwaway repo fixture from a map of relative path -> file contents.
// Each test gets an isolated tmpdir so there's no cross-test state.
const tempRoots: string[] = [];

function makeRepo(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bv-repo-'));
  tempRoots.push(root);
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop()!;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// --- Level 5: Agent-Native (every one of these was previously untested) ---

describe('L5 checkIntentEndpoints pattern thresholds', () => {
  it('fails with no matching patterns', () => {
    const repo = makeRepo({ 'src/app.ts': 'const handler = () => {};\n' });
    expect(checkIntentEndpoints(repo).status).toBe('fail');
  });

  it('is partial with exactly one intent pattern', () => {
    // Uses "analyze" so it matches only the general URL regex, not the
    // path= / router.post / app.post variants (which are limited to
    // send|process|execute|submit|trigger).
    const repo = makeRepo({
      'src/app.ts': `const url = '/analyze-report';\n`,
    });
    expect(checkIntentEndpoints(repo).status).toBe('partial');
  });

  it('passes with two or more intent patterns', () => {
    const repo = makeRepo({
      'src/app.ts': `
app.post('/send-invoice', handler);
app.post('/process-payment', handler);
`.trimStart(),
    });
    expect(checkIntentEndpoints(repo).status).toBe('pass');
  });
});

describe('L5 checkAgentSessions', () => {
  it('fails on an empty repo', () => {
    const repo = makeRepo({ 'README.md': '# hi\n' });
    expect(checkAgentSessions(repo).status).toBe('fail');
  });

  it('passes when agent session patterns appear in code or config', () => {
    const repo = makeRepo({
      'src/session.ts': 'function createAgentSession() { /* ... */ }\n',
      'config.yaml': 'x-agent-session: enabled\n',
    });
    expect(checkAgentSessions(repo).status).toBe('pass');
  });
});

describe('L5 checkScopedAgentTokens', () => {
  it('fails on empty repo', () => {
    const repo = makeRepo({ 'index.js': '// nothing\n' });
    expect(checkScopedAgentTokens(repo).status).toBe('fail');
  });

  it('passes when agent token/scope patterns exist', () => {
    const repo = makeRepo({
      'src/auth.ts': 'const agentToken = req.headers["x-agent-token"];\n',
    });
    expect(checkScopedAgentTokens(repo).status).toBe('pass');
  });
});

describe('L5 checkAgentAuditLogs', () => {
  it('fails when no agent-identified logging is present', () => {
    const repo = makeRepo({ 'src/log.ts': 'console.log("hi");\n' });
    expect(checkAgentAuditLogs(repo).status).toBe('fail');
  });

  it('passes when agent identifier logging patterns exist', () => {
    const repo = makeRepo({
      'src/log.ts': 'logger.info({ "x-agent-id": req.headers["x-agent-id"], action });\n',
    });
    expect(checkAgentAuditLogs(repo).status).toBe('pass');
  });
});

describe('L5 checkSandboxEnvironment', () => {
  it('fails with no sandbox config or patterns', () => {
    const repo = makeRepo({ 'src/index.ts': 'export {};\n' });
    expect(checkSandboxEnvironment(repo).status).toBe('fail');
  });

  it('passes via a .env.test file alone', () => {
    const repo = makeRepo({ '.env.test': 'NODE_ENV=test\n' });
    expect(checkSandboxEnvironment(repo).status).toBe('pass');
  });

  it('passes via dry-run code patterns alone', () => {
    const repo = makeRepo({
      'src/tx.ts': 'if (dryRun) { return; }\n',
    });
    expect(checkSandboxEnvironment(repo).status).toBe('pass');
  });
});

describe('L5 checkConsequenceLabels', () => {
  it('fails when no consequence annotations exist', () => {
    const repo = makeRepo({ 'openapi.yaml': 'openapi: 3.0.0\n' });
    expect(checkConsequenceLabels(repo).status).toBe('fail');
  });

  it('passes when irreversible/destructive annotations appear', () => {
    const repo = makeRepo({
      'openapi.yaml': `
paths:
  /delete:
    post:
      x-consequence: irreversible
`.trimStart(),
    });
    expect(checkConsequenceLabels(repo).status).toBe('pass');
  });
});

describe('L5 checkNativeToolSchemas three-way classification', () => {
  it('fails when nothing tool-related is present', () => {
    const repo = makeRepo({ 'README.md': '# nothing\n' });
    expect(checkNativeToolSchemas(repo).status).toBe('fail');
  });

  it('is partial when only code references tool schemas but no file exists', () => {
    const repo = makeRepo({
      'src/tools.ts': 'const toolDefinition = { name: "search" };\n',
    });
    expect(checkNativeToolSchemas(repo).status).toBe('partial');
  });

  it('passes when a *.tool.json file exists at repo root', () => {
    const repo = makeRepo({
      'search.tool.json': JSON.stringify({ name: 'search', inputSchema: {} }),
    });
    expect(checkNativeToolSchemas(repo).status).toBe('pass');
  });

  it('passes when an mcp.json file exists', () => {
    const repo = makeRepo({
      'mcp.json': JSON.stringify({ tools: [] }),
    });
    expect(checkNativeToolSchemas(repo).status).toBe('pass');
  });
});

// --- Pattern-count threshold boundaries on repo checks ---

describe('checkErrorPatterns — ≥3 pass / 1-2 partial / 0 fail', () => {
  it('fails with zero matches', () => {
    const repo = makeRepo({ 'src/a.ts': 'const x = 1;\n' });
    expect(checkErrorPatterns(repo).status).toBe('fail');
  });

  it('is partial at exactly 2 matches', () => {
    const repo = makeRepo({
      'src/errors.ts': `
const errorCode = "E_BAD_REQUEST";
return { "error": { "code": "bad_request" } };
`.trimStart(),
    });
    const r = checkErrorPatterns(repo);
    expect(r.status).toBe('partial');
  });

  it('passes at 3 or more matches', () => {
    const repo = makeRepo({
      'src/errors.ts': `
const errorCode1 = "A";
const error_code2 = "B";
const errorCode3 = "C";
const errorCode4 = "D";
`.trimStart(),
    });
    expect(checkErrorPatterns(repo).status).toBe('pass');
  });
});

describe('checkSparseFieldsCode — ≥2 pass / 1 partial / 0 fail', () => {
  it('fails with no sparse-field patterns', () => {
    const repo = makeRepo({ 'src/a.ts': 'const x = 1;\n' });
    expect(checkSparseFieldsCode(repo).status).toBe('fail');
  });

  it('is partial at exactly one match', () => {
    const repo = makeRepo({
      'src/list.ts': 'const url = "/items?fields=id,name";\n',
    });
    expect(checkSparseFieldsCode(repo).status).toBe('partial');
  });

  it('passes at two or more matches', () => {
    const repo = makeRepo({
      'src/list.ts': `
const listUrl = "/items?fields=id,name";
const getUrl = "/items/1?select=id,title";
`.trimStart(),
    });
    expect(checkSparseFieldsCode(repo).status).toBe('pass');
  });
});

describe('checkCursorPaginationCode — ≥2 pass / 1 partial / 0 fail', () => {
  it('fails with no cursor patterns', () => {
    const repo = makeRepo({ 'src/a.ts': 'const x = 1;\n' });
    expect(checkCursorPaginationCode(repo).status).toBe('fail');
  });

  it('is partial at exactly one match', () => {
    const repo = makeRepo({
      'src/page.ts': 'const cursor = params.cursor;\n',
    });
    expect(checkCursorPaginationCode(repo).status).toBe('partial');
  });

  it('passes at two or more matches', () => {
    const repo = makeRepo({
      'src/page.ts': `
const cursor = params.cursor;
const has_more = result.has_more;
`.trimStart(),
    });
    expect(checkCursorPaginationCode(repo).status).toBe('pass');
  });
});

describe('checkSearchFilteringCode — ≥2 pass / 1 partial / 0 fail', () => {
  it('is partial at exactly one match', () => {
    const repo = makeRepo({
      'src/search.ts': 'const q = req.query.q;\n',
    });
    expect(checkSearchFilteringCode(repo).status).toBe('partial');
  });

  it('passes at two or more matches', () => {
    const repo = makeRepo({
      'src/search.ts': `
const q = req.query.q;
const filter = req.query.filter;
`.trimStart(),
    });
    expect(checkSearchFilteringCode(repo).status).toBe('pass');
  });
});

describe('checkBulkOpsCode — ≥1 pass / 0 fail', () => {
  it('fails with no bulk patterns', () => {
    const repo = makeRepo({ 'src/a.ts': 'const x = 1;\n' });
    expect(checkBulkOpsCode(repo).status).toBe('fail');
  });

  it('passes with a single bulk endpoint reference', () => {
    const repo = makeRepo({
      'src/batch.ts': 'app.post("/bulk/users", handler);\n',
    });
    expect(checkBulkOpsCode(repo).status).toBe('pass');
  });
});

describe('checkCachingHeadersCode — ≥2 pass / 1 partial / 0 fail', () => {
  it('fails with no cache-header patterns', () => {
    const repo = makeRepo({ 'src/a.ts': 'const x = 1;\n' });
    expect(checkCachingHeadersCode(repo).status).toBe('fail');
  });

  it('is partial at exactly one match', () => {
    const repo = makeRepo({
      'src/resp.ts': 'res.setHeader("ETag", hash);\n',
    });
    expect(checkCachingHeadersCode(repo).status).toBe('partial');
  });

  it('passes at two or more matches', () => {
    const repo = makeRepo({
      'src/resp.ts': `
res.setHeader("ETag", hash);
res.setHeader("Cache-Control", "max-age=60");
`.trimStart(),
    });
    expect(checkCachingHeadersCode(repo).status).toBe('pass');
  });
});
