import { CheckResult, Level, LevelProgress, CliCheck } from './types.js';

export const LEVELS: Level[] = [
  { number: 1, name: 'Discoverable', description: 'Bots can find you via machine-readable metadata.', color: 'red' },
  { number: 2, name: 'Usable', description: 'Your API works for agents — auth, errors, and core operations.', color: 'yellow' },
  { number: 3, name: 'Optimized', description: 'Your API minimizes token cost and handles scale.', color: 'green' },
  { number: 4, name: 'Agent-Native', description: 'Your platform treats AI agents as first-class users.', color: 'blue' },
];

// 30 web-scanned check definitions
export const CHECK_DEFINITIONS = [
  // Level 1: Discoverable (14)
  { id: '1.1', name: 'llms.txt', level: 1 as const, category: 'Discoverable' },
  { id: '1.2', name: 'Agent Card', level: 1 as const, category: 'Discoverable' },
  { id: '1.3', name: 'OpenAPI Spec', level: 1 as const, category: 'Discoverable' },
  { id: '1.4', name: 'robots.txt AI Policy', level: 1 as const, category: 'Discoverable' },
  { id: '1.5', name: 'Documentation Accessibility', level: 1 as const, category: 'Discoverable' },
  { id: '1.6', name: 'CORS Headers', level: 1 as const, category: 'Discoverable' },
  { id: '1.7', name: 'AI Meta Tags', level: 1 as const, category: 'Discoverable' },
  { id: '1.8', name: 'Skill File', level: 1 as const, category: 'Discoverable' },
  { id: '1.9', name: 'AI Site Profile', level: 1 as const, category: 'Discoverable' },
  { id: '1.10', name: 'Skills Index', level: 1 as const, category: 'Discoverable' },
  { id: '1.11', name: 'Link Headers', level: 1 as const, category: 'Discoverable' },
  { id: '1.12', name: 'MCP Server', level: 1 as const, category: 'Discoverable' },
  { id: '1.13', name: 'Page Token Efficiency', level: 1 as const, category: 'Discoverable' },
  { id: '1.14', name: 'RSS/Atom Feed', level: 1 as const, category: 'Discoverable' },

  // Level 2: Usable (9)
  { id: '2.1', name: 'API Read Operations', level: 2 as const, category: 'Usable' },
  { id: '2.2', name: 'API Write Operations', level: 2 as const, category: 'Usable' },
  { id: '2.3', name: 'API Primary Action', level: 2 as const, category: 'Usable' },
  { id: '2.4', name: 'API Key Authentication', level: 2 as const, category: 'Usable' },
  { id: '2.5', name: 'Scoped API Keys', level: 2 as const, category: 'Usable' },
  { id: '2.6', name: 'OpenID Configuration', level: 2 as const, category: 'Usable' },
  { id: '2.7', name: 'Structured Error Responses', level: 2 as const, category: 'Usable' },
  { id: '2.8', name: 'Async Operations', level: 2 as const, category: 'Usable' },
  { id: '2.9', name: 'Idempotency Support', level: 2 as const, category: 'Usable' },

  // Level 3: Optimized (7)
  { id: '3.1', name: 'Sparse Fields', level: 3 as const, category: 'Optimized' },
  { id: '3.2', name: 'Cursor Pagination', level: 3 as const, category: 'Optimized' },
  { id: '3.3', name: 'Search & Filtering', level: 3 as const, category: 'Optimized' },
  { id: '3.4', name: 'Bulk Operations', level: 3 as const, category: 'Optimized' },
  { id: '3.5', name: 'Rate Limit Headers', level: 3 as const, category: 'Optimized' },
  { id: '3.6', name: 'Caching Headers', level: 3 as const, category: 'Optimized' },
  { id: '3.7', name: 'MCP Tool Quality', level: 3 as const, category: 'Optimized' },
];

export const CLI_CHECKS: CliCheck[] = [
  { id: '4.1', name: 'Intent-Based Endpoints', level: 4, category: 'Agent-Native', description: 'High-level intent endpoints alongside CRUD', whyCliOnly: 'Requires understanding API design intent' },
  { id: '4.2', name: 'Agent Sessions', level: 4, category: 'Agent-Native', description: 'Persistent sessions with context', whyCliOnly: 'Requires inspecting session implementation' },
  { id: '4.3', name: 'Scoped Agent Tokens', level: 4, category: 'Agent-Native', description: 'Agent-specific tokens with capability limits', whyCliOnly: 'Requires reviewing auth configuration' },
  { id: '4.4', name: 'Agent Audit Logs', level: 4, category: 'Agent-Native', description: 'API actions logged with agent identifiers', whyCliOnly: 'Requires inspecting logging infrastructure' },
  { id: '4.5', name: 'Sandbox Environment', level: 4, category: 'Agent-Native', description: 'Sandbox for agent testing', whyCliOnly: 'Requires verifying separate environment' },
  { id: '4.6', name: 'Consequence Labels', level: 4, category: 'Agent-Native', description: 'Marks consequential/irreversible actions', whyCliOnly: 'Requires reviewing docs/schema annotations' },
  { id: '4.7', name: 'Native Tool Schemas', level: 4, category: 'Agent-Native', description: 'Ready-to-use tool definitions', whyCliOnly: 'Requires checking for tool definition files' },
];

export function calculateLevelProgress(checks: CheckResult[]): LevelProgress[] {
  return LEVELS.map((level) => {
    const levelChecks = checks.filter((c) => c.level === level.number);
    const passed = levelChecks.filter((c) => c.status === 'pass').length;
    const na = levelChecks.filter((c) => c.status === 'na').length;
    const total = levelChecks.length;
    const failed = total - passed - na;
    const applicable = total - na;
    return { level, passed, failed, na, total, complete: applicable > 0 && passed === applicable };
  });
}

/**
 * Weighted cross-level algorithm for determining achieved level.
 *
 * Rather than requiring 100% of each level in strict order, this rewards sites
 * that invest in higher-level capabilities even if some lower-level items are missing.
 *
 *   - L1 (Discoverable): achieved when L1 rate >= 50%
 *   - L2 (Usable):       L1 >= 50% AND L2 >= 50%, OR L1 >= 35% AND L2 >= 75%
 *   - L3 (Optimized):    L2 achieved AND L3 >= 50%, OR L2 >= 35% AND L3 >= 75%
 */
export function getCurrentLevel(levelProgress: LevelProgress[]): number {
  const rate = (lp: LevelProgress | undefined): number => {
    if (!lp) return 0;
    const applicable = lp.total - lp.na;
    return applicable > 0 ? lp.passed / applicable : 0;
  };

  const l1 = levelProgress.find((lp) => lp.level.number === 1);
  const l2 = levelProgress.find((lp) => lp.level.number === 2);
  const l3 = levelProgress.find((lp) => lp.level.number === 3);

  const r1 = rate(l1);
  const r2 = rate(l2);
  const r3 = rate(l3);

  const l2Achieved =
    (r1 >= 0.50 && r2 >= 0.50) ||
    (r1 >= 0.35 && r2 >= 0.75);
  const l3Achieved =
    (l2Achieved && r3 >= 0.50) ||
    (r2 >= 0.35 && r3 >= 0.75);

  if (l3Achieved) return 3;
  if (l2Achieved) return 2;
  if (r1 >= 0.50) return 1;

  return 0;
}
