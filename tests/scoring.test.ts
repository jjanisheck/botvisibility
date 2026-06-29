import { describe, it, expect } from 'vitest';
import {
  calculateLevelProgress,
  getCurrentLevel,
  computeScore,
  levelName,
  calculateGrade,
  LEVELS,
  CHECK_DEFINITIONS,
  LEVEL5_CHECKS,
  LEVEL_5_IDS,
  SCORING_VERSION,
} from '../src/scoring.js';
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
  it('matches the published 58-check model, all 5 levels external (51 L1-4 + 7 L5)', () => {
    expect(CHECK_DEFINITIONS).toHaveLength(51);
    expect(LEVEL5_CHECKS).toHaveLength(7);
    expect(CHECK_DEFINITIONS.length + LEVEL5_CHECKS.length).toBe(58);

    const perLevel = (n: LevelNumber) => CHECK_DEFINITIONS.filter(d => d.level === n).length;
    expect(perLevel(1)).toBe(18);
    expect(perLevel(2)).toBe(11);
    expect(perLevel(3)).toBe(7);
    expect(perLevel(4)).toBe(15);
    expect(LEVEL5_CHECKS.every(c => c.level === 5 && c.category === 'Agent-Native')).toBe(true);
  });

  it('LEVEL5_CHECKS ids line up with LEVEL_5_IDS (no orphans)', () => {
    const ids = new Set(LEVEL5_CHECKS.map(c => c.id));
    for (const id of Object.values(LEVEL_5_IDS)) {
      expect(ids.has(id)).toBe(true);
    }
    expect(ids.size).toBe(Object.values(LEVEL_5_IDS).length);
  });

  it('emits scoring version "2" to match the web scan', () => {
    expect(SCORING_VERSION).toBe('2');
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

  it('returns 4 when L1-L4 complete but no Level-5 checks pass', () => {
    const checks = [
      ...makeChecks(1, 18, 0),
      ...makeChecks(2, 11, 0),
      ...makeChecks(3, 7, 0),
      ...makeChecks(4, 15, 0),
    ];
    const progress = calculateLevelProgress(checks);
    expect(getCurrentLevel(progress)).toBe(4);
  });

  it('returns 5 when L4 achieved and L5 (Agent-Native) >= 50% — externally', () => {
    const checks = [
      ...makeChecks(1, 18, 0),
      ...makeChecks(2, 11, 0),
      ...makeChecks(3, 7, 0),
      ...makeChecks(4, 15, 0),
      ...makeChecks(5, 4, 3),
    ];
    const progress = calculateLevelProgress(checks);
    expect(getCurrentLevel(progress)).toBe(5);
  });

  it('stops at 4 when L5 falls below the threshold', () => {
    const checks = [
      ...makeChecks(1, 18, 0),
      ...makeChecks(2, 11, 0),
      ...makeChecks(3, 7, 0),
      ...makeChecks(4, 15, 0),
      ...makeChecks(5, 1, 6),
    ];
    const progress = calculateLevelProgress(checks);
    expect(getCurrentLevel(progress)).toBe(4);
  });
});

describe('computeScore', () => {
  it('summarizes counts, level, levelName, and indexable sub-score', () => {
    const checks = [
      ...makeChecks(1, 18, 0),
      ...makeChecks(2, 11, 0),
      ...makeChecks(3, 7, 0),
      ...makeChecks(4, 15, 0),
      ...makeChecks(5, 7, 0),
    ];
    const progress = calculateLevelProgress(checks);
    const level = getCurrentLevel(progress);
    const score = computeScore(checks, progress, level);
    expect(score.total).toBe(58);
    expect(score.passed).toBe(58);
    expect(score.failed).toBe(0);
    expect(score.level).toBe(5);
    expect(score.levelName).toBe('Agent-Native');
    expect(score.grade).toBe('perfect');
    expect(score.indexable).toEqual({ passed: 15, failed: 0, partial: 0, na: 0, total: 15 });
  });

  it('na checks are excluded from grade applicability', () => {
    const checks = [
      ...makeChecks(1, 18, 0),
      makeCheck(2, 'na', 'n1'),
    ];
    const progress = calculateLevelProgress(checks);
    const score = computeScore(checks, progress, getCurrentLevel(progress));
    // 18 pass, 0 fail/partial → perfect regardless of the single n/a.
    expect(score.grade).toBe('perfect');
    expect(score.na).toBe(1);
  });
});

describe('levelName / calculateGrade', () => {
  it('maps levels to names (0 = Getting Started)', () => {
    expect(levelName(0)).toBe('Getting Started');
    expect(levelName(1)).toBe('Discoverable');
    expect(levelName(5)).toBe('Agent-Native');
  });

  it('grade is perfect only when nothing failed or partial', () => {
    expect(calculateGrade(10, 0, 0, 10)).toBe('perfect');
    expect(calculateGrade(9, 1, 0, 10)).not.toBe('perfect');
    expect(calculateGrade(1, 9, 0, 10)).toBe('needs-work');
    expect(calculateGrade(0, 0, 0, 0)).toBe('needs-work');
  });
});
