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
