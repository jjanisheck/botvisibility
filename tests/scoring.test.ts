import { describe, it, expect } from 'vitest';
import { calculateLevelProgress, getCurrentLevel, LEVELS, CHECK_DEFINITIONS, CLI_CHECKS } from '../src/scoring.js';
import type { CheckResult, LevelNumber } from '../src/types.js';

function makeCheck(level: LevelNumber, status: 'pass' | 'fail' | 'na', id = 'x'): CheckResult {
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

function makeChecks(level: LevelNumber, passed: number, failed: number): CheckResult[] {
  const out: CheckResult[] = [];
  for (let i = 0; i < passed; i++) out.push(makeCheck(level, 'pass', `${level}.${i}p`));
  for (let i = 0; i < failed; i++) out.push(makeCheck(level, 'fail', `${level}.${i}f`));
  return out;
}

describe('LEVELS metadata', () => {
  it('declares 5 levels in order', () => {
    expect(LEVELS).toHaveLength(5);
    expect(LEVELS.map(l => l.number)).toEqual([1, 2, 3, 4, 5]);
    expect(LEVELS.map(l => l.name)).toEqual([
      'Discoverable', 'Usable', 'Optimized', 'Indexable', 'Agent-Native',
    ]);
  });
});

describe('CHECK_DEFINITIONS coverage', () => {
  it('matches the published 55-item checklist (48 web + 7 CLI)', () => {
    expect(CHECK_DEFINITIONS).toHaveLength(48);
    expect(CLI_CHECKS).toHaveLength(7);

    const perLevel = (n: LevelNumber) => CHECK_DEFINITIONS.filter(d => d.level === n).length;
    expect(perLevel(1)).toBe(18);
    expect(perLevel(2)).toBe(11);
    expect(perLevel(3)).toBe(7);
    expect(perLevel(4)).toBe(12);
    expect(CLI_CHECKS.every(c => c.level === 5 && c.category === 'Agent-Native')).toBe(true);
  });
});

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
      makeCheck(4, 'pass', 'f'),
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

    const l4 = progress.find((p) => p.level.number === 4)!;
    expect(l4.passed).toBe(1);
    expect(l4.complete).toBe(true);
  });
});

describe('getCurrentLevel', () => {
  it('returns 0 when no L1 checks pass', () => {
    const progress = calculateLevelProgress(makeChecks(1, 0, 18));
    expect(getCurrentLevel(progress)).toBe(0);
  });

  it('returns 1 when at least 50% of L1 passes but no L2', () => {
    const progress = calculateLevelProgress(makeChecks(1, 9, 9));
    expect(getCurrentLevel(progress)).toBe(1);
  });

  it('returns 2 when L1 >= 50% and L2 >= 50%', () => {
    const checks = [...makeChecks(1, 9, 9), ...makeChecks(2, 6, 5)];
    const progress = calculateLevelProgress(checks);
    expect(getCurrentLevel(progress)).toBe(2);
  });

  it('returns 2 via the alternative path: L1 35% with L2 75%', () => {
    const checks = [...makeChecks(1, 7, 11), ...makeChecks(2, 9, 2)];
    const progress = calculateLevelProgress(checks);
    expect(getCurrentLevel(progress)).toBe(2);
  });

  it('returns 3 when L2 achieved and L3 >= 50%', () => {
    const checks = [
      ...makeChecks(1, 9, 9),
      ...makeChecks(2, 6, 5),
      ...makeChecks(3, 4, 3),
    ];
    const progress = calculateLevelProgress(checks);
    expect(getCurrentLevel(progress)).toBe(3);
  });

  it('returns 3 via alternative L3 path: L2 35% with L3 75%', () => {
    const checks = [
      ...makeChecks(1, 9, 9),
      ...makeChecks(2, 4, 7),
      ...makeChecks(3, 6, 1),
    ];
    const progress = calculateLevelProgress(checks);
    expect(getCurrentLevel(progress)).toBe(3);
  });

  it('returns 4 when L3 achieved and L4 (Indexable) >= 50%', () => {
    const checks = [
      ...makeChecks(1, 9, 9),
      ...makeChecks(2, 6, 5),
      ...makeChecks(3, 4, 3),
      ...makeChecks(4, 7, 5),
    ];
    const progress = calculateLevelProgress(checks);
    expect(getCurrentLevel(progress)).toBe(4);
  });

  it('returns 4 via alternative L4 path: L3 35% with L4 75%', () => {
    const checks = [
      ...makeChecks(1, 9, 9),
      ...makeChecks(2, 6, 5),
      ...makeChecks(3, 3, 4),
      ...makeChecks(4, 9, 3),
    ];
    const progress = calculateLevelProgress(checks);
    expect(getCurrentLevel(progress)).toBe(4);
  });

  it('stops at 3 when L3 achieved but L4 fails (Indexable is now a gate)', () => {
    const checks = [
      ...makeChecks(1, 18, 0),
      ...makeChecks(2, 11, 0),
      ...makeChecks(3, 7, 0),
      ...makeChecks(4, 2, 10),
    ];
    const progress = calculateLevelProgress(checks);
    expect(getCurrentLevel(progress)).toBe(3);
  });

  it('returns 0 when all checks fail', () => {
    const checks = [
      ...makeChecks(1, 0, 18),
      ...makeChecks(2, 0, 11),
      ...makeChecks(3, 0, 7),
      ...makeChecks(4, 0, 12),
    ];
    const progress = calculateLevelProgress(checks);
    expect(getCurrentLevel(progress)).toBe(0);
  });

  it('caps at 4 (L5 Agent-Native is signaled separately via cliChecks)', () => {
    const checks = [
      ...makeChecks(1, 18, 0),
      ...makeChecks(2, 11, 0),
      ...makeChecks(3, 7, 0),
      ...makeChecks(4, 12, 0),
    ];
    const progress = calculateLevelProgress(checks);
    expect(getCurrentLevel(progress)).toBe(4);
  });
});
