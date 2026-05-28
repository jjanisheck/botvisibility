# CLI Repo Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert this repo from a mixed Next.js website + CLI codebase into a clean public OSS home for the `botvisibility` CLI, preserving full git history.

**Architecture:** Single flatten commit moves `cli/*` to repo root and deletes website + tooling cruft. Subsequent commits add a vitest test suite, GitHub Actions CI, and contributor documentation. The CLI's TypeScript build output and runtime behavior are unchanged.

**Tech Stack:** Node 18+, TypeScript 5, vitest, GitHub Actions, npm.

**Spec:** `docs/superpowers/specs/2026-04-08-cli-repo-extraction-design.md`

---

## Task 1: Safety backup branch

**Files:** none (git operation only)

- [ ] **Step 1: Create backup branch**

```bash
git branch pre-flatten-backup
git branch --list pre-flatten-backup
```

Expected: `pre-flatten-backup` listed.

---

## Task 2: Flatten — delete website files

**Files:**
- Delete: `src/app/`, `src/components/`, `src/data/`, `src/lib/`, `public/`, `netlify.toml`, `next.config.ts`, `next-env.d.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `tsconfig.tsbuildinfo`, root `package.json`, root `package-lock.json`, root `tsconfig.json`, root `README.md`

- [ ] **Step 1: Remove website source directories**

```bash
git rm -rf src/app src/components src/data src/lib public
```

- [ ] **Step 2: Remove Next.js + Netlify config files**

```bash
git rm netlify.toml next.config.ts next-env.d.ts postcss.config.mjs eslint.config.mjs
```

- [ ] **Step 3: Remove root TypeScript build artifact and root package files**

```bash
git rm tsconfig.tsbuildinfo package.json package-lock.json tsconfig.json README.md
rm -rf .next node_modules
```

(`.next` and `node_modules` are gitignored or local-only.)

---

## Task 3: Flatten — delete tooling cruft

**Files:**
- Delete: `.claude-flow/`, `.superpowers/`, `.swarm/`, `.mcp.json`, `docs/plans/`, `scripts/scan-showcase.ts`

- [ ] **Step 1: Remove Claude tooling directories that are NOT `.claude/`**

```bash
git rm -rf .claude-flow .superpowers .swarm
git rm .mcp.json
```

- [ ] **Step 2: Remove old plans and website-only script**

```bash
git rm -rf docs/plans
git rm scripts/scan-showcase.ts
rmdir scripts 2>/dev/null || true
```

(`docs/superpowers/specs/` and `docs/superpowers/plans/` are kept — they hold this brainstorming work.)

---

## Task 4: Flatten — promote `cli/` to root

**Files:**
- Move: `cli/src/index.ts` → `src/index.ts`
- Move: `cli/src/scanner.ts` → `src/scanner.ts`
- Move: `cli/src/repo-scanner.ts` → `src/repo-scanner.ts`
- Move: `cli/src/scoring.ts` → `src/scoring.ts`
- Move: `cli/src/types.ts` → `src/types.ts`
- Move: `cli/package.json` → `package.json`
- Move: `cli/tsconfig.json` → `tsconfig.json`
- Move: `cli/README.md` → `README.md`
- Delete: `cli/` directory and any leftover `cli/package-lock.json`

- [ ] **Step 1: Move CLI source files**

```bash
git mv cli/src/index.ts src/index.ts
git mv cli/src/scanner.ts src/scanner.ts
git mv cli/src/repo-scanner.ts src/repo-scanner.ts
git mv cli/src/scoring.ts src/scoring.ts
git mv cli/src/types.ts src/types.ts
```

- [ ] **Step 2: Move CLI config and README**

```bash
git mv cli/package.json package.json
git mv cli/tsconfig.json tsconfig.json
git mv cli/README.md README.md
```

- [ ] **Step 3: Remove leftover cli/ contents**

```bash
git rm -f cli/package-lock.json 2>/dev/null || true
rmdir cli/src 2>/dev/null || true
rmdir cli 2>/dev/null || true
```

---

## Task 5: Flatten — update package.json and .gitignore

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Update `package.json` — bump version, add test scripts and devDeps**

Replace the contents of `package.json` with:

```json
{
  "name": "botvisibility",
  "version": "1.3.1",
  "description": "Scan any URL to check if it's ready for AI agents",
  "main": "dist/index.js",
  "bin": {
    "botvisibility": "./dist/index.js"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsc",
    "dev": "tsc -w",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "prepublishOnly": "npm run build && npm test"
  },
  "keywords": [
    "ai",
    "agents",
    "llm",
    "openapi",
    "llms.txt",
    "agent-card",
    "api",
    "scanner",
    "audit",
    "mcp"
  ],
  "author": "Joey Janisheck",
  "license": "MIT",
  "homepage": "https://botvisibility.com",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/jjanisheck/botvisibility.git"
  },
  "bugs": {
    "url": "https://github.com/jjanisheck/botvisibility/issues"
  },
  "dependencies": {},
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@vitest/coverage-v8": "^2.1.0",
    "typescript": "^5.0.0",
    "vitest": "^2.1.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

- [ ] **Step 2: Replace `.gitignore`**

Replace the contents of `.gitignore` with:

```gitignore
# Dependencies
node_modules/

# Build output
dist/
*.tsbuildinfo

# Test coverage
coverage/

# OS
.DS_Store
Thumbs.db

# Editors
.idea/
.vscode/
*.swp

# Logs
*.log
npm-debug.log*

# Env
.env
.env.local
```

---

## Task 6: Flatten — install, build, and verify

**Files:** none (verification only)

- [ ] **Step 1: Install fresh dependencies**

```bash
npm install
```

Expected: regenerates `package-lock.json`, installs vitest. No errors.

- [ ] **Step 2: Build the CLI**

```bash
npm run build
```

Expected: `dist/index.js` exists, executable, no TypeScript errors.

- [ ] **Step 3: Smoke test against a real URL**

```bash
node dist/index.js botvisibility.com --json | head -20
```

Expected: valid JSON output with `currentLevel`, `levels`, `checks` fields. Exit code 0.

```bash
node dist/index.js botvisibility.com --json | python3 -c "import sys,json; d=json.load(sys.stdin); print('level:', d['currentLevel'])"
```

Expected: prints `level: <number>`.

- [ ] **Step 4: Verify no website paths remain**

```bash
ls src/
find . -maxdepth 2 -name "next.config*" -o -name "netlify.toml" -o -name "postcss.config*"
```

Expected: `src/` contains only `index.ts scanner.ts repo-scanner.ts scoring.ts types.ts`. The `find` command produces no output.

- [ ] **Step 5: Stage `package-lock.json`**

```bash
git add package-lock.json package.json .gitignore
git status
```

Expected: shows the staged flatten + the regenerated lockfile.

- [ ] **Step 6: Commit Phase 1 (single flatten commit)**

```bash
git commit -m "$(cat <<'EOF'
chore: extract CLI as standalone repo (remove website)

Promotes cli/* to repo root, deletes Next.js website code, Netlify
config, and dev tooling cruft. Bumps package version to 1.3.1 and
adds vitest test scripts/devDeps in preparation for the test suite.

Website code has been migrated to a separate repository.
Full git history is preserved.

EOF
)"
```

Expected: one commit, hundreds of file deletions, handful of renames.

---

## Task 7: Test infrastructure

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/fixtures/openapi-minimal.json`
- Create: `tests/fixtures/openapi-rich.json`

- [ ] **Step 1: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
  },
});
```

- [ ] **Step 2: Create `tests/fixtures/openapi-minimal.json` (a sparse OpenAPI doc with only GET endpoints)**

```json
{
  "openapi": "3.0.0",
  "info": { "title": "Minimal API", "version": "1.0.0" },
  "paths": {
    "/items": {
      "get": {
        "summary": "List items",
        "responses": { "200": { "description": "OK" } }
      }
    },
    "/items/{id}": {
      "get": {
        "summary": "Get item",
        "responses": { "200": { "description": "OK" } }
      }
    }
  }
}
```

- [ ] **Step 3: Create `tests/fixtures/openapi-rich.json` (a full-featured spec hitting most L2/L3 patterns)**

```json
{
  "openapi": "3.0.0",
  "info": { "title": "Rich API", "version": "1.0.0" },
  "components": {
    "securitySchemes": {
      "apiKey": {
        "type": "apiKey",
        "in": "header",
        "name": "X-API-Key"
      },
      "oauth2": {
        "type": "oauth2",
        "flows": {
          "clientCredentials": {
            "tokenUrl": "https://example.com/token",
            "scopes": {
              "read": "Read access",
              "write": "Write access"
            }
          }
        }
      }
    }
  },
  "paths": {
    "/items": {
      "get": {
        "parameters": [
          { "name": "cursor", "in": "query", "schema": { "type": "string" } },
          { "name": "fields", "in": "query", "schema": { "type": "string" } },
          { "name": "filter", "in": "query", "schema": { "type": "string" } },
          { "name": "search", "in": "query", "schema": { "type": "string" } }
        ],
        "responses": { "200": { "description": "OK" } }
      },
      "post": {
        "parameters": [
          { "name": "Idempotency-Key", "in": "header", "schema": { "type": "string" } }
        ],
        "responses": { "202": { "description": "Accepted" } }
      }
    },
    "/items/bulk": {
      "post": {
        "summary": "Bulk create items",
        "responses": { "200": { "description": "OK" } }
      }
    }
  }
}
```

- [ ] **Step 4: Commit fixtures**

```bash
git add vitest.config.ts tests/fixtures/
git commit -m "$(cat <<'EOF'
test: add vitest config and OpenAPI fixtures

EOF
)"
```

---

## Task 8: Scoring tests

**Files:**
- Create: `tests/scoring.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `tests/scoring.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calculateLevelProgress, getCurrentLevel, LEVELS } from '../src/scoring.js';
import type { CheckResult } from '../src/types.js';

function makeCheck(level: 1 | 2 | 3 | 4, status: 'pass' | 'fail' | 'na', id = 'x'): CheckResult {
  return {
    id,
    name: `check-${id}`,
    passed: status === 'pass',
    status,
    level,
    category: 'test',
    autoDetectable: true,
    message: '',
  };
}

function makeChecks(level: 1 | 2 | 3 | 4, passed: number, failed: number): CheckResult[] {
  const out: CheckResult[] = [];
  for (let i = 0; i < passed; i++) out.push(makeCheck(level, 'pass', `${level}.${i}p`));
  for (let i = 0; i < failed; i++) out.push(makeCheck(level, 'fail', `${level}.${i}f`));
  return out;
}

describe('calculateLevelProgress', () => {
  it('returns zero counts when no checks supplied', () => {
    const progress = calculateLevelProgress([]);
    expect(progress).toHaveLength(LEVELS.length);
    for (const lp of progress) {
      expect(lp.passed).toBe(0);
      expect(lp.failed).toBe(0);
      expect(lp.total).toBe(0);
      expect(lp.complete).toBe(false);
    }
  });

  it('counts passes, failures, and N/A correctly per level', () => {
    const checks: CheckResult[] = [
      makeCheck(1, 'pass', 'a'),
      makeCheck(1, 'pass', 'b'),
      makeCheck(1, 'fail', 'c'),
      makeCheck(1, 'na', 'd'),
      makeCheck(2, 'pass', 'e'),
    ];
    const progress = calculateLevelProgress(checks);
    const l1 = progress.find((p) => p.level.number === 1)!;
    expect(l1.passed).toBe(2);
    expect(l1.failed).toBe(1);
    expect(l1.na).toBe(1);
    expect(l1.total).toBe(4);
    expect(l1.complete).toBe(false);

    const l2 = progress.find((p) => p.level.number === 2)!;
    expect(l2.passed).toBe(1);
    expect(l2.complete).toBe(true);
  });
});

describe('getCurrentLevel', () => {
  it('returns 0 when no L1 checks pass', () => {
    const progress = calculateLevelProgress(makeChecks(1, 0, 14));
    expect(getCurrentLevel(progress)).toBe(0);
  });

  it('returns 1 when at least 50% of L1 passes but no L2', () => {
    const progress = calculateLevelProgress(makeChecks(1, 7, 7));
    expect(getCurrentLevel(progress)).toBe(1);
  });

  it('returns 2 when L1 >= 50% and L2 >= 50%', () => {
    const checks = [...makeChecks(1, 7, 7), ...makeChecks(2, 5, 4)];
    const progress = calculateLevelProgress(checks);
    expect(getCurrentLevel(progress)).toBe(2);
  });

  it('returns 2 via the alternative path: L1 35% with L2 75%', () => {
    const checks = [...makeChecks(1, 5, 9), ...makeChecks(2, 7, 2)];
    const progress = calculateLevelProgress(checks);
    expect(getCurrentLevel(progress)).toBe(2);
  });

  it('returns 3 when L2 achieved and L3 >= 50%', () => {
    const checks = [
      ...makeChecks(1, 7, 7),
      ...makeChecks(2, 5, 4),
      ...makeChecks(3, 4, 3),
    ];
    const progress = calculateLevelProgress(checks);
    expect(getCurrentLevel(progress)).toBe(3);
  });

  it('returns 3 via alternative L3 path: L2 35% with L3 75%', () => {
    const checks = [
      ...makeChecks(1, 7, 7),
      ...makeChecks(2, 4, 5),
      ...makeChecks(3, 6, 1),
    ];
    const progress = calculateLevelProgress(checks);
    expect(getCurrentLevel(progress)).toBe(3);
  });

  it('returns 0 when all checks fail', () => {
    const checks = [
      ...makeChecks(1, 0, 14),
      ...makeChecks(2, 0, 9),
      ...makeChecks(3, 0, 7),
    ];
    const progress = calculateLevelProgress(checks);
    expect(getCurrentLevel(progress)).toBe(0);
  });

  it('caps at 3 (L4 is signaled separately via cliChecks)', () => {
    const checks = [
      ...makeChecks(1, 14, 0),
      ...makeChecks(2, 9, 0),
      ...makeChecks(3, 7, 0),
    ];
    const progress = calculateLevelProgress(checks);
    expect(getCurrentLevel(progress)).toBe(3);
  });
});
```

- [ ] **Step 2: Run scoring tests**

```bash
npx vitest run tests/scoring.test.ts
```

Expected: all tests pass (PASS lines shown).

- [ ] **Step 3: Commit**

```bash
git add tests/scoring.test.ts
git commit -m "$(cat <<'EOF'
test(scoring): cover level progress and weighted level decisions

EOF
)"
```

---

## Task 9: Scanner pure-function tests

**Files:**
- Create: `tests/scanner.test.ts`

- [ ] **Step 1: Write tests for `parseOpenApiSpec` and the pure check functions**

Create `tests/scanner.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
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
    expect(checkAsyncOps(minimal).status).toBe('fail');
  });

  it('checkIdempotency passes on rich', () => {
    expect(checkIdempotency(rich).status).toBe('pass');
    expect(checkIdempotency(minimal).status).toBe('fail');
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

  it('all spec checks return fail when spec is null', () => {
    expect(checkApiReadOps(null).status).toBe('fail');
    expect(checkApiWriteOps(null).status).toBe('fail');
    expect(checkApiKeyAuth(null).status).toBe('fail');
    expect(checkSparseFields(null).status).toBe('fail');
  });
});

describe('HTML-based checks', () => {
  it('checkAiMetaTags passes when llms:description is present', () => {
    const html = '<html><head><meta name="llms:description" content="x"></head></html>';
    expect(checkAiMetaTags(html).status).toBe('pass');
  });

  it('checkAiMetaTags fails when no llms meta tags', () => {
    const html = '<html><head><title>x</title></head></html>';
    expect(checkAiMetaTags(html).status).toBe('fail');
  });

  it('checkAiMetaTags fails when html is null', () => {
    expect(checkAiMetaTags(null).status).toBe('fail');
  });

  it('checkLinkHeaders passes when a link rel="llms" is present', () => {
    const html = '<html><head><link rel="llms" href="/llms.txt"></head></html>';
    expect(checkLinkHeaders(html).status).toBe('pass');
  });

  it('checkLinkHeaders fails when no relevant link tags', () => {
    expect(checkLinkHeaders('<html></html>').status).toBe('fail');
  });

  it('checkStructuredData detects JSON-LD', () => {
    const html = '<html><head><script type="application/ld+json">{}</script></head></html>';
    const result = checkStructuredData(html);
    expect(['pass', 'partial']).toContain(result.status);
  });
});
```

- [ ] **Step 2: Run the test file**

```bash
npx vitest run tests/scanner.test.ts
```

Expected: all tests pass. If any check function rejects unexpected inputs differently than asserted (e.g., `checkAiMetaTags` may use a different meta-name pattern), inspect `src/scanner.ts` and adjust the assertion to match the real implementation — these tests should follow the code, not the other way around.

- [ ] **Step 3: Commit**

```bash
git add tests/scanner.test.ts
git commit -m "$(cat <<'EOF'
test(scanner): cover URL normalization, OpenAPI parsing, and pure check functions

EOF
)"
```

---

## Task 10: Repo-scanner tests

**Files:**
- Create: `tests/repo-scanner.test.ts`
- Create: `tests/fixtures/empty-repo/.gitkeep`
- Create: `tests/fixtures/repo-with-openapi/openapi.yaml`
- Create: `tests/fixtures/repo-with-openapi/README.md`

- [ ] **Step 1: Inspect what `repo-scanner.ts` exports and accepts**

```bash
grep -n "^export" cli-source-removed-this-line src/repo-scanner.ts || true
```

Use Grep tool on `src/repo-scanner.ts` for `^export (async )?function` to identify the entry point (likely `runRepoChecks(repoPath: string)`).

- [ ] **Step 2: Create empty repo fixture**

```bash
mkdir -p tests/fixtures/empty-repo
touch tests/fixtures/empty-repo/.gitkeep
```

- [ ] **Step 3: Create OpenAPI repo fixture**

`tests/fixtures/repo-with-openapi/openapi.yaml`:

```yaml
openapi: 3.0.0
info:
  title: Sample API
  version: 1.0.0
paths:
  /users:
    get:
      summary: List users
      responses:
        '200':
          description: OK
```

`tests/fixtures/repo-with-openapi/README.md`:

```markdown
# Sample repo for repo-scanner tests
```

- [ ] **Step 4: Write `tests/repo-scanner.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runRepoChecks } from '../src/repo-scanner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EMPTY = join(__dirname, 'fixtures', 'empty-repo');
const WITH_OPENAPI = join(__dirname, 'fixtures', 'repo-with-openapi');

describe('runRepoChecks', () => {
  it('returns a result object for an empty repo without throwing', async () => {
    const result = await runRepoChecks(EMPTY);
    expect(result).toBeDefined();
    expect(Array.isArray(result.checks)).toBe(true);
  });

  it('returns checks for a repo with an OpenAPI spec', async () => {
    const result = await runRepoChecks(WITH_OPENAPI);
    expect(result.checks.length).toBeGreaterThan(0);
  });

  it('every check has a stable shape', async () => {
    const result = await runRepoChecks(EMPTY);
    for (const check of result.checks) {
      expect(check).toHaveProperty('id');
      expect(check).toHaveProperty('status');
      expect(['pass', 'fail', 'partial', 'na']).toContain(check.status);
    }
  });
});
```

- [ ] **Step 5: Run repo-scanner tests**

```bash
npx vitest run tests/repo-scanner.test.ts
```

Expected: all tests pass. If the actual `runRepoChecks` signature differs (e.g., returns a different shape), adjust assertions to match.

- [ ] **Step 6: Run the full suite**

```bash
npm test
```

Expected: all three test files pass.

- [ ] **Step 7: Commit**

```bash
git add tests/repo-scanner.test.ts tests/fixtures/empty-repo tests/fixtures/repo-with-openapi
git commit -m "$(cat <<'EOF'
test(repo-scanner): cover empty repo and OpenAPI fixture cases

EOF
)"
```

---

## Task 11: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/ISSUE_TEMPLATE/bug_report.md`
- Create: `.github/ISSUE_TEMPLATE/feature_request.md`
- Create: `.github/pull_request_template.md`

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Test
        run: npm test
```

- [ ] **Step 2: Write `.github/ISSUE_TEMPLATE/bug_report.md`**

```markdown
---
name: Bug report
about: Report a problem with the BotVisibility CLI
title: '[BUG] '
labels: bug
---

**What happened?**
A clear description of the bug.

**Steps to reproduce**
1. Run `npx botvisibility ...`
2. ...

**Expected behavior**
What you expected to happen.

**Environment**
- CLI version: (output of `npx botvisibility --help` shows it)
- Node version:
- OS:
```

- [ ] **Step 3: Write `.github/ISSUE_TEMPLATE/feature_request.md`**

```markdown
---
name: Feature request
about: Suggest a new check or CLI feature
title: '[FEATURE] '
labels: enhancement
---

**What problem does this solve?**

**Proposed solution**

**Alternatives considered**
```

- [ ] **Step 4: Write `.github/pull_request_template.md`**

```markdown
## Summary

<!-- What does this PR change and why? -->

## Type of change

- [ ] Bug fix
- [ ] New check
- [ ] Documentation
- [ ] Refactor / cleanup

## Verification

- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] Tested manually against a real URL (if scanner change)
```

- [ ] **Step 5: Commit**

```bash
git add .github/
git commit -m "$(cat <<'EOF'
ci: add GitHub Actions workflow and contributor templates

Build and test on Node 18/20/22 for every push and PR.

EOF
)"
```

---

## Task 12: Polished README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read the current `README.md` (the promoted CLI README)**

Confirm what is there before rewriting.

- [ ] **Step 2: Replace `README.md` with the polished version**

Use this as the new content (preserves the existing check tables and content but adds badges, "why this exists", and a Contributing section):

```markdown
# BotVisibility CLI

[![npm version](https://img.shields.io/npm/v/botvisibility.svg)](https://www.npmjs.com/package/botvisibility)
[![npm downloads](https://img.shields.io/npm/dm/botvisibility.svg)](https://www.npmjs.com/package/botvisibility)
[![CI](https://github.com/jjanisheck/botvisibility/actions/workflows/ci.yml/badge.svg)](https://github.com/jjanisheck/botvisibility/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> Lighthouse for AI agents. Scan any URL to see how visible and usable it is to Claude, GPT, Copilot, and autonomous agent frameworks.

```bash
npx botvisibility stripe.com
```

## Why this exists

When AI agents browse a site that doesn't publish machine-readable metadata or APIs, they fall back to scraping HTML, guessing endpoints, and retrying. That burns 5-100x more tokens per session and silently inflates the cost of every agent interaction. BotVisibility runs 30+ automated checks across 4 levels and tells you exactly what's missing.

## Install & run

No install needed:

```bash
npx botvisibility <url>
```

Or globally:

```bash
npm install -g botvisibility
botvisibility stripe.com
```

## Usage

```bash
# Basic URL scan
npx botvisibility https://example.com

# JSON output for CI/CD
npx botvisibility stripe.com --json

# Full scan with local repo analysis (unlocks Level 4)
npx botvisibility https://myapp.com --repo ./

# Combined scan with JSON output
npx botvisibility mysite.com --repo ../my-backend --json
```

## What it checks

Four levels, 37 total checks. The full reference lives in [`docs/checks.md`](docs/checks.md). Quick overview:

- **Level 1 — Discoverable (14 checks):** llms.txt, agent-card, OpenAPI spec, robots.txt AI policy, MCP server, ai.json, skill files, RSS, page token efficiency, and more.
- **Level 2 — Usable (9 checks):** API read/write/primary actions, API key auth, scoped keys, OIDC, structured errors, async ops, idempotency.
- **Level 3 — Optimized (7 checks):** sparse fields, cursor pagination, filtering, bulk ops, rate limit headers, caching headers, MCP tool quality.
- **Level 4 — Agent-Native (7 checks, `--repo` required):** intent endpoints, agent sessions, scoped agent tokens, audit logs, sandbox env, consequence labels, native tool schemas.

## Scoring

BotVisibility uses a weighted cross-level algorithm so investing in higher-level capabilities still moves your score even if some low-level items are missing. Full algorithm and worked examples in [`docs/scoring.md`](docs/scoring.md).

## CI/CD integration

Drop into any CI to catch agent-readiness regressions:

```yaml
- name: Check BotVisibility
  run: |
    SCORE=$(npx botvisibility mysite.com --json | jq '.currentLevel')
    if [ "$SCORE" -lt 1 ]; then
      echo "BotVisibility score below Level 1"
      exit 1
    fi
```

Recipes for GitHub Actions, GitLab CI, and CircleCI in [`docs/ci-integration.md`](docs/ci-integration.md).

## The agent tax

Every unoptimized interaction costs AI agents extra tokens. At Claude Sonnet 4.6 rates and 1,000 agent visits per day, an unoptimized site can waste **$22,800/month** in tokens. Full analysis and methodology in [`docs/agent-tax.md`](docs/agent-tax.md).

## Contributing

Contributions welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for development setup and how to add a new check.

## Links

- **Scanner & website:** [botvisibility.com](https://botvisibility.com)
- **GitHub:** [github.com/jjanisheck/botvisibility](https://github.com/jjanisheck/botvisibility)

## License

MIT
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: polish README with badges, why-it-exists, and docs links

EOF
)"
```

---

## Task 13: Detailed docs (`docs/checks.md`, `docs/scoring.md`, `docs/ci-integration.md`, `docs/agent-tax.md`)

**Files:**
- Create: `docs/checks.md`
- Create: `docs/scoring.md`
- Create: `docs/ci-integration.md`
- Create: `docs/agent-tax.md`

- [ ] **Step 1: Create `docs/checks.md`**

This file is the long-form check reference. It should contain all 37 checks (14 L1, 9 L2, 7 L3, 7 L4) with for each: name, level, what it looks for, why it matters, how to fix. Source the truth from `src/scanner.ts` (the `checkX` functions and their result messages) and `src/scoring.ts` (the `CHECK_DEFINITIONS` and `CLI_CHECKS` arrays).

Structure:

```markdown
# Checks reference

BotVisibility runs 37 checks across 4 levels. This reference describes each check, why it matters for AI agent token efficiency, and how to fix failures.

## Level 1: Discoverable (14 checks)

Bots can find your site's capabilities without scraping HTML.

### 1.1 llms.txt

**What it checks:** A machine-readable site description at `/llms.txt`.

**Why it matters:** Agents that find an llms.txt skip parsing your full HTML (~30,000 tokens) and read a structured summary (~500 tokens) instead — a 98% reduction.

**How to fix:** Publish `/llms.txt` with your site purpose, primary URLs, and key documentation links. See [llmstxt.org](https://llmstxt.org).

### 1.2 Agent Card

[continue for all 14 L1 checks, then 9 L2, 7 L3, 7 L4]
```

When implementing, walk through the `CHECK_DEFINITIONS` array in `src/scoring.ts` and for each entry write a section using the `checkX` function in `src/scanner.ts` as the source of truth for what the check looks for. For L4 checks, use `CLI_CHECKS` and `src/repo-scanner.ts`.

- [ ] **Step 2: Create `docs/scoring.md`**

```markdown
# Scoring algorithm

BotVisibility uses a weighted cross-level algorithm. Rather than requiring 100% of each level in strict order, it rewards sites that invest in higher-level capabilities even when some lower-level items are missing.

## The rules

Let `r1`, `r2`, `r3` be the pass rates (passed / applicable) for Levels 1, 2, 3.

- **Level 1 (Discoverable):** achieved when `r1 >= 0.50`.
- **Level 2 (Usable):** achieved when `(r1 >= 0.50 AND r2 >= 0.50)` OR `(r1 >= 0.35 AND r2 >= 0.75)`.
- **Level 3 (Optimized):** achieved when `(L2 achieved AND r3 >= 0.50)` OR `(r2 >= 0.35 AND r3 >= 0.75)`.
- **Level 4 (Agent-Native):** signaled separately via the `--repo` flag and the `cliChecks` array — not folded into the numeric `currentLevel`.

The numeric `currentLevel` is the highest of `{0, 1, 2, 3}` for which the rules above are satisfied.

## Worked example

Suppose a site has:
- 14 L1 checks: 8 pass, 6 fail (`r1 = 0.57`)
- 9 L2 checks: 5 pass, 4 fail (`r2 = 0.55`)
- 7 L3 checks: 2 pass, 5 fail (`r3 = 0.29`)

Evaluation:
- L1: `r1 >= 0.50` → achieved.
- L2: `r1 >= 0.50 AND r2 >= 0.50` → achieved.
- L3: `r3 < 0.50` and `r2 < 0.35` is false but `r3 < 0.75` → not achieved.

Result: `currentLevel = 2`.

## Why "weighted cross-level"?

The point is to prevent the all-or-nothing trap where a site that has built robust API tooling (L2/L3) but is missing one or two discovery files (L1) gets scored lower than a site that has llms.txt but no API. The 35% / 75% alternative path lets serious API investments count even when discovery is incomplete.

## Source

See `src/scoring.ts:getCurrentLevel` for the canonical implementation, and `tests/scoring.test.ts` for the regression suite covering each path.
```

- [ ] **Step 3: Create `docs/ci-integration.md`**

```markdown
# CI/CD integration

BotVisibility's `--json` output makes it easy to gate deployments on agent-readiness. This page collects copy-paste recipes.

## GitHub Actions

```yaml
name: BotVisibility check
on:
  pull_request:
  schedule:
    - cron: '0 6 * * *'

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - name: Run scan
        run: |
          SCORE=$(npx -y botvisibility ${{ vars.PRODUCTION_URL }} --json | jq '.currentLevel')
          echo "BotVisibility score: $SCORE"
          if [ "$SCORE" -lt 2 ]; then
            echo "::error::BotVisibility score $SCORE is below required Level 2"
            exit 1
          fi
```

## GitLab CI

```yaml
botvisibility:
  image: node:20
  script:
    - SCORE=$(npx -y botvisibility "$PRODUCTION_URL" --json | jq '.currentLevel')
    - 'echo "Score: $SCORE"'
    - test "$SCORE" -ge 2
```

## CircleCI

```yaml
version: 2.1
jobs:
  botvisibility:
    docker:
      - image: cimg/node:20.0
    steps:
      - run:
          name: Scan
          command: |
            SCORE=$(npx -y botvisibility "$PRODUCTION_URL" --json | jq '.currentLevel')
            test "$SCORE" -ge 2

workflows:
  scan:
    jobs:
      - botvisibility
```

## Reading specific check results

The `--json` payload exposes the full check list:

```bash
npx botvisibility example.com --json | jq '.checks[] | select(.status == "fail") | {id, name}'
```

Use this to surface exactly which checks regressed in PR comments or Slack notifications.
```

- [ ] **Step 4: Create `docs/agent-tax.md`**

```markdown
# The agent tax

Every interaction between an AI agent and an unoptimized site burns excess tokens. This document explains how the cost adds up and how BotVisibility quantifies it.

## The math

| Without optimization | With optimization | Savings |
|---|---|---|
| Scrape HTML for site info (~30,000 tokens) | Read llms.txt (~500 tokens) | 98% |
| Guess API endpoints from docs (~100,000 tokens) | Read OpenAPI spec (~15,000 tokens) | 85% |
| Parse HTML error pages (~10,000 tokens) | Read JSON error (~50 tokens) | 99% |
| Fetch every field of every record (~2,000 tokens) | Sparse field selection (~200 tokens) | 90% |

A single unoptimized agent session can burn **120,000-500,000+ excess tokens**. At Claude Sonnet 4.6 rates that's roughly $0.83 per session vs $0.07 optimized.

## Annualized impact

| Agent visits/day | Unoptimized cost/month | Optimized cost/month | Wasted/month |
|---|---|---|---|
| 100 | $2,490 | $210 | $2,280 |
| 1,000 | $24,900 | $2,100 | $22,800 |
| 10,000 | $249,000 | $21,000 | $228,000 |

## Methodology

These figures assume:
- Average session = 1 discovery phase + 1 API exploration phase + 3 errors handled
- Token counts measured against real-world site scans during BotVisibility test runs
- Pricing: Claude Sonnet 4.6 input tokens at published list rates as of 2026-04-08
- "Optimized" means the site passes all relevant L1-L3 checks

## What you can do

Every L1 and L2 check that BotVisibility flags reduces your agent tax. The biggest single wins:

1. **llms.txt** — eliminates the bulk of HTML scraping
2. **Published OpenAPI spec** — cuts API exploration cost by 85%+
3. **Structured JSON errors** — eliminates error-page parsing
4. **Cursor pagination + sparse fields** — caps the cost of any individual API call

Run `npx botvisibility yoursite.com` to see your current state.
```

- [ ] **Step 5: Commit**

```bash
git add docs/checks.md docs/scoring.md docs/ci-integration.md docs/agent-tax.md
git commit -m "$(cat <<'EOF'
docs: add deep references for checks, scoring, CI, and agent tax

EOF
)"
```

---

## Task 14: CONTRIBUTING.md and CHANGELOG.md

**Files:**
- Create: `CONTRIBUTING.md`
- Create: `CHANGELOG.md`

- [ ] **Step 1: Create `CONTRIBUTING.md`**

```markdown
# Contributing to BotVisibility CLI

Thanks for your interest. This is a small project and contributions are welcome — especially new checks, bug reports against real-world sites, and documentation improvements.

## In scope

- New L1-L3 checks based on emerging agent-readiness standards (llms.txt, MCP, agent cards, etc.)
- New L4 (`--repo`) checks that detect agent-friendly patterns in source code
- Improvements to existing check accuracy and false-positive reduction
- Documentation, recipes, and CI examples

## Out of scope

- Hosted scanning (the website at botvisibility.com lives in a separate repo)
- General-purpose web scrapers or SEO checks
- Anything that depends on external paid APIs

## Dev setup

```bash
git clone https://github.com/jjanisheck/botvisibility.git
cd botvisibility
npm install
npm run build
npm test
```

Run the CLI locally during development:

```bash
node dist/index.js example.com
node dist/index.js example.com --repo /path/to/some/repo
```

## Adding a new check

1. Add the definition to `CHECK_DEFINITIONS` in `src/scoring.ts` (or `CLI_CHECKS` for L4).
2. Implement the check function in `src/scanner.ts` (or `src/repo-scanner.ts` for L4). Follow the patterns of existing `checkX` functions — return a `CheckResult` with `id`, `name`, `status`, `level`, `message`, and (where useful) `recommendation` and `foundAt`.
3. Wire the check into `runAllChecks` in `src/scanner.ts`.
4. Add a test in `tests/scanner.test.ts` (or `tests/repo-scanner.test.ts`).
5. Add the check to `docs/checks.md`.
6. Run `npm test` and `npm run build`.

## Pull request guidelines

- Keep PRs small and focused — one new check per PR is ideal.
- New checks must include tests.
- New checks must include a `docs/checks.md` entry.
- CI must be green before review.

## Code of conduct

Be kind. Be helpful. Assume good faith.
```

- [ ] **Step 2: Create `CHANGELOG.md`**

```markdown
# Changelog

All notable changes to the BotVisibility CLI are documented here. This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- vitest test suite covering scoring, scanner pure functions, and repo-scanner.
- GitHub Actions CI matrix on Node 18, 20, and 22.
- Deep documentation: `docs/checks.md`, `docs/scoring.md`, `docs/ci-integration.md`, `docs/agent-tax.md`.
- `CONTRIBUTING.md` with dev setup, scope, and how to add a new check.
- Issue and PR templates under `.github/`.

### Changed
- Repository restructured as a standalone CLI. Website code has been migrated to a separate repository. CLI sources promoted from `cli/` to the repo root.
- `package.json` adds test scripts and `vitest` devDependencies.
- README polished with badges and a "why this exists" section.

## [1.3.0] - 2026-03-30

- Added Page Token Efficiency (1.13) and RSS/Atom Feed (1.14) checks.

## [1.2.1] - 2026-03-29

- Bug fixes; CLI v1.2.x line.

## [1.2.0] - 2026-03-29

- Added Level 3 code checks via `--repo`.

## [1.1.0]

- Renamed from `agent-readiness-audit` to `botvisibility`.

## [1.0.0]

- Initial release.
```

- [ ] **Step 3: Commit**

```bash
git add CONTRIBUTING.md CHANGELOG.md
git commit -m "$(cat <<'EOF'
docs: add CONTRIBUTING and CHANGELOG

EOF
)"
```

---

## Task 15: Final verification

**Files:** none

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: all tests pass, exit 0.

- [ ] **Step 2: Run the build**

```bash
npm run build
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 3: Verify the publish tarball contents**

```bash
npm pack --dry-run
```

Expected: tarball includes only `dist/`, `README.md`, `LICENSE`, and `package.json`. No `tests/`, no `docs/`, no source `src/`.

- [ ] **Step 4: Confirm the working tree is clean**

```bash
git status
```

Expected: nothing to commit, working tree clean.

- [ ] **Step 5: Show the new commit log for the cleanup**

```bash
git log --oneline | head -15
```

Expected: the cleanup commits sit on top of the prior history.

---

## Out of scope (deferred to user)

- Pushing to `origin/main`
- Flipping repo visibility from private to public
- Adding repository topics in GitHub UI
- Running `npm publish` to release 1.3.1

These are operational steps the user will perform after reviewing the final state.
