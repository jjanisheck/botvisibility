# Scoring algorithm

BotVisibility uses a weighted cross-level algorithm. Rather than requiring 100% of each level in strict order, it rewards sites that invest in higher-level capabilities even when some lower-level items are missing.

## The rules

Let `r1`, `r2`, `r3` be the pass rates (passed / applicable) for Levels 1, 2, 3. Checks marked N/A (e.g., write-endpoint checks on a read-only API) do not count toward the denominator.

- **Level 1 (Discoverable):** achieved when `r1 >= 0.50`.
- **Level 2 (Usable):** achieved when `(r1 >= 0.50 AND r2 >= 0.50)` OR `(r1 >= 0.35 AND r2 >= 0.75)`.
- **Level 3 (Optimized):** achieved when `(L2 achieved AND r3 >= 0.50)` OR `(r2 >= 0.35 AND r3 >= 0.75)`.
- **Level 4 (Agent-Native):** signaled separately via the `--repo` flag and the `cliChecks` array — not folded into the numeric `currentLevel`.

The numeric `currentLevel` is the highest of `{0, 1, 2, 3}` for which the rules above are satisfied.

## Worked example

Suppose a site has:
- 14 L1 checks: 8 pass, 6 fail (`r1 ≈ 0.57`)
- 9 L2 checks: 5 pass, 4 fail (`r2 ≈ 0.55`)
- 7 L3 checks: 2 pass, 5 fail (`r3 ≈ 0.29`)

Evaluation:
- L1: `r1 >= 0.50` → achieved.
- L2: `r1 >= 0.50 AND r2 >= 0.50` → achieved.
- L3: `r3 < 0.50`, and the alternative path needs `r3 >= 0.75` → not achieved.

Result: `currentLevel = 2`.

## Why "weighted cross-level"?

The point is to prevent the all-or-nothing trap where a site that has built robust API tooling (L2/L3) but is missing one or two discovery files (L1) gets scored lower than a site that has llms.txt but no API. The 35% / 75% alternative path lets serious API investments count even when discovery is incomplete.

## Source

See `src/scoring.ts` (`getCurrentLevel`) for the canonical implementation, and `tests/scoring.test.ts` for the regression suite covering each path.
