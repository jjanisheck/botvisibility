import { describe, it, expect } from 'vitest';
import { parseArgs } from '../src/args.js';

describe('parseArgs', () => {
  it('returns a null url when argv is empty', () => {
    const r = parseArgs([]);
    expect(r.url).toBeNull();
    expect(r.jsonOutput).toBe(false);
    expect(r.helpFlag).toBe(false);
    expect(r.repoPath).toBeNull();
  });

  it('parses a bare url', () => {
    const r = parseArgs(['example.com']);
    expect(r.url).toBe('example.com');
    expect(r.jsonOutput).toBe(false);
    expect(r.repoPath).toBeNull();
  });

  it('detects --json', () => {
    const r = parseArgs(['example.com', '--json']);
    expect(r.jsonOutput).toBe(true);
    expect(r.url).toBe('example.com');
  });

  it('detects --help and -h as equivalent', () => {
    expect(parseArgs(['--help']).helpFlag).toBe(true);
    expect(parseArgs(['-h']).helpFlag).toBe(true);
    expect(parseArgs(['example.com']).helpFlag).toBe(false);
  });

  it('captures --repo value and excludes it from url parsing', () => {
    const r = parseArgs(['example.com', '--repo', './my-app']);
    expect(r.url).toBe('example.com');
    expect(r.repoPath).toBe('./my-app');
  });

  it('handles --repo before the url', () => {
    const r = parseArgs(['--repo', '../backend', 'example.com']);
    expect(r.url).toBe('example.com');
    expect(r.repoPath).toBe('../backend');
  });

  it('returns null repoPath when --repo has no value', () => {
    const r = parseArgs(['--repo']);
    expect(r.repoPath).toBeNull();
  });

  it('combines --json + --repo + url', () => {
    const r = parseArgs(['clone.fyi', '--repo', '../svc', '--json']);
    expect(r.url).toBe('clone.fyi');
    expect(r.repoPath).toBe('../svc');
    expect(r.jsonOutput).toBe(true);
  });

  it('ignores a --repo value path when used as the first positional url', () => {
    // When --repo is followed by a path that would otherwise look like a URL,
    // that path must not be picked up as the URL.
    const r = parseArgs(['--repo', 'example.com', 'real-site.io']);
    expect(r.repoPath).toBe('example.com');
    expect(r.url).toBe('real-site.io');
  });

  it('treats flag-prefixed tokens as non-url positional args', () => {
    // Unknown --flags must not be interpreted as the URL.
    const r = parseArgs(['--unknown-flag', 'example.com']);
    expect(r.url).toBe('example.com');
  });
});
