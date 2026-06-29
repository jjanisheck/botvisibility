# Scoring algorithm

BotVisibility uses a weighted cross-level algorithm. Rather than requiring 100% of each level in strict order, it rewards sites that invest in higher-level capabilities even when some lower-level items are missing.

## The rules

Let `r1`–`r5` be the pass rates (passed / applicable) for Levels 1–5. Checks marked N/A (e.g., write-endpoint checks on a read-only API, or a Level-5 probe that timed out) do not count toward the denominator.

- **Level 1 (Discoverable):** achieved when `r1 >= 0.50`.
- **Level 2 (Usable):** achieved when `(r1 >= 0.50 AND r2 >= 0.50)` OR `(r1 >= 0.35 AND r2 >= 0.75)`.
- **Level 3 (Optimized):** achieved when `(L2 achieved AND r3 >= 0.50)` OR `(r2 >= 0.35 AND r3 >= 0.75)`.
- **Level 4 (Indexable):** achieved when `(L3 achieved AND r4 >= 0.50)` OR `(r3 >= 0.35 AND r4 >= 0.75)`.
- **Level 5 (Agent-Native):** achieved when `(L4 achieved AND r5 >= 0.50)` OR `(r4 >= 0.35 AND r5 >= 0.75)`. Level 5 is verified externally (declaration + live probe), so it counts toward `currentLevel` like every other level.

The numeric `currentLevel` is the highest of `{0, 1, 2, 3, 4, 5}` for which the rules above are satisfied.

## Worked example

Suppose a site has:
- 18 L1 checks: 11 pass, 7 fail (`r1 ≈ 0.61`)
- 11 L2 checks: 6 pass, 5 fail (`r2 ≈ 0.55`)
- 7 L3 checks: 4 pass, 3 fail (`r3 ≈ 0.57`)
- 15 L4 checks: 4 pass, 11 fail (`r4 ≈ 0.27`)

Evaluation:
- L1: `r1 >= 0.50` → achieved.
- L2: `r1 >= 0.50 AND r2 >= 0.50` → achieved.
- L3: `L2 achieved AND r3 >= 0.50` → achieved.
- L4: `r4 < 0.50`, and the alternative path needs `r4 >= 0.75` → not achieved.

Result: `currentLevel = 3`. Level 4 (Indexable) is the next thing to work on.

## Why "weighted cross-level"?

The point is to prevent the all-or-nothing trap where a site that has built robust API tooling (L2/L3) but is missing one or two discovery files (L1) gets scored lower than a site that has llms.txt but no API. The 35% / 75% alternative path lets serious API investments count even when lower levels are incomplete.

Level 4 (Indexable) is treated as a gate before Level 5 because AI search systems can't ground answers in a site that isn't crawlable or doesn't expose substantive content — even if the underlying API is perfect.

Level 5 (Agent-Native) is now part of the same external scan: it reads the site's published `capabilities` declaration and probes the declared endpoints, so `currentLevel` can reach 5 with no `--repo` or source access.

## Source

See `src/scoring.ts` (`getCurrentLevel`) for the canonical implementation, `src/deep-checks.ts` for the external Level-5 probes, and `tests/scoring.test.ts` for the regression suite covering each path.
