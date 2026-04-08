import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runRepoChecks, checkOpenApiFiles } from '../src/repo-scanner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EMPTY = join(__dirname, 'fixtures', 'empty-repo');
const WITH_OPENAPI = join(__dirname, 'fixtures', 'repo-with-openapi');

describe('runRepoChecks', () => {
  it('returns an array of checks for an empty repo without throwing', () => {
    const checks = runRepoChecks(EMPTY);
    expect(Array.isArray(checks)).toBe(true);
    expect(checks.length).toBeGreaterThan(0);
  });

  it('returns checks for a repo with an OpenAPI spec', () => {
    const checks = runRepoChecks(WITH_OPENAPI);
    expect(checks.length).toBeGreaterThan(0);
  });

  it('every check has a stable shape', () => {
    const checks = runRepoChecks(EMPTY);
    for (const check of checks) {
      expect(check).toHaveProperty('id');
      expect(check).toHaveProperty('name');
      expect(check).toHaveProperty('status');
      expect(['pass', 'fail', 'partial', 'na']).toContain(check.status);
    }
  });

  it('returns an error result for a non-existent repo path', () => {
    const checks = runRepoChecks('/path/that/does/not/exist/anywhere');
    expect(checks.length).toBe(1);
    expect(checks[0].status).toBe('fail');
    expect(checks[0].id).toBe('repo-error');
  });
});

describe('checkOpenApiFiles', () => {
  it('finds an OpenAPI yaml file at repo root', () => {
    const result = checkOpenApiFiles(WITH_OPENAPI);
    expect(result.status).toBe('pass');
  });

  it('reports failure for a repo with no OpenAPI files', () => {
    const result = checkOpenApiFiles(EMPTY);
    expect(result.status).toBe('fail');
  });
});
