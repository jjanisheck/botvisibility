import { CheckResult, Tier, ManualCheck } from './types';

// Tier definitions based on README scoring
export function getTier(score: number, maxScore: number = 31): Tier {
  const percentage = (score / maxScore) * 100;

  if (percentage <= 20) {
    return {
      name: 'Invisible',
      emoji: '🔴',
      color: 'red',
      description: "Agents can't find you or use you. You're automated via brittle browser scrapers, if at all.",
      range: '0-20%'
    };
  }
  if (percentage <= 40) {
    return {
      name: 'Findable',
      emoji: '🟠',
      color: 'orange',
      description: "Agents know you exist but struggle to use you reliably. Lots of workarounds required.",
      range: '21-40%'
    };
  }
  if (percentage <= 62) {
    return {
      name: 'Usable',
      emoji: '🟡',
      color: 'yellow',
      description: "Agents can accomplish basic tasks. Significant inefficiency and rough edges remain.",
      range: '41-62%'
    };
  }
  if (percentage <= 80) {
    return {
      name: 'Ready',
      emoji: '🟢',
      color: 'green',
      description: "Agents can work with your app reliably. You're ahead of most of the internet.",
      range: '63-80%'
    };
  }
  return {
    name: 'Agent-Native',
    emoji: '🚀',
    color: 'purple',
    description: "Your app is designed for the agentic era. Agents prefer you.",
    range: '81-100%'
  };
}

// Calculate score from check results
export function calculateScore(checks: CheckResult[]): number {
  return checks.filter(c => c.passed).length;
}

// All 31 checklist items - auto-detectable ones for scanning
export const AUTO_DETECTABLE_CHECKS = [
  // Level 1: Discoverable
  { id: '1.1', name: 'llms.txt', level: 1, category: 'Discoverable' },
  { id: '1.2', name: 'Agent Card', level: 1, category: 'Discoverable' },
  { id: '1.3', name: 'OpenAPI Spec', level: 1, category: 'Discoverable' },
  { id: '1.4', name: 'robots.txt AI Policy', level: 1, category: 'Discoverable' },
  { id: '1.5', name: 'Documentation Accessibility', level: 1, category: 'Discoverable' },
  // 1.6 Platform Skill Files - not auto-detectable

  // Level 2: Usable - mostly manual, but some detectable
  { id: '2.2', name: 'OpenID Configuration', level: 2, category: 'Usable' },

  // Level 3: Optimized - some detectable via headers
  { id: '3.6', name: 'Rate Limit Headers', level: 3, category: 'Optimized' },
  { id: '3.7', name: 'Caching Headers', level: 3, category: 'Optimized' },
] as const;

// Manual checks that cannot be auto-detected from outside
export const MANUAL_CHECKS: ManualCheck[] = [
  // Level 1 manual
  {
    id: '1.6',
    name: 'Platform Skill Files',
    level: 1,
    category: 'Discoverable',
    description: 'A skill/tool definition exists for at least one major AI platform',
    why: 'Platform-specific skill files let agents on those platforms use your app with zero setup.'
  },

  // Level 2: Usable - all manual
  {
    id: '2.1a',
    name: 'API-First: Primary Action',
    level: 2,
    category: 'Usable',
    description: 'The primary value action of your app is available via API',
    why: 'If agents can only read data but not act, they can observe but not help.'
  },
  {
    id: '2.1b',
    name: 'API-First: Read Operations',
    level: 2,
    category: 'Usable',
    description: 'Read operations are available (list, get, search)',
    why: 'Agents need to fetch and query your data to understand context.'
  },
  {
    id: '2.1c',
    name: 'API-First: Write Operations',
    level: 2,
    category: 'Usable',
    description: 'Write operations are available (create, update, delete)',
    why: 'Without write access, agents are read-only observers.'
  },
  {
    id: '2.1d',
    name: 'API-First: Full Parity',
    level: 2,
    category: 'Usable',
    description: 'All API actions match what\'s available in the UI',
    why: 'The gap between "has an API" and "API does everything the UI does" is where most apps fail.'
  },
  {
    id: '2.2',
    name: 'API Key Authentication',
    level: 2,
    category: 'Usable',
    description: 'API key authentication is supported (not only OAuth browser flows)',
    why: 'OAuth flows requiring browser redirects are a dealbreaker for most agents.'
  },
  {
    id: '2.2b',
    name: 'Scoped API Keys',
    level: 2,
    category: 'Usable',
    description: 'API keys can be scoped to specific permissions',
    why: 'Limiting blast radius with scoped permissions is essential for agent safety.'
  },
  {
    id: '2.3',
    name: 'Structured Error Responses',
    level: 2,
    category: 'Usable',
    description: 'All API errors return structured JSON with error codes',
    why: 'Agents need machine-readable errors to self-correct.'
  },
  {
    id: '2.4',
    name: 'Async Operations',
    level: 2,
    category: 'Usable',
    description: 'Long-running operations return a job ID with pollable status',
    why: 'Agents have context windows and timeouts. They can\'t wait 45 seconds.'
  },
  {
    id: '2.5',
    name: 'Idempotency',
    level: 2,
    category: 'Usable',
    description: 'Write endpoints support idempotency keys',
    why: 'Agents retry. Without idempotency, you get duplicate records and charges.'
  },

  // Level 3: Optimized - mostly manual
  {
    id: '3.1',
    name: 'Sparse Fields',
    level: 3,
    category: 'Optimized',
    description: 'A fields or select parameter exists to request only needed fields',
    why: 'Token cost is real. Returning 40 fields when 3 are needed wastes 80% of tokens.'
  },
  {
    id: '3.2',
    name: 'Cursor Pagination',
    level: 3,
    category: 'Optimized',
    description: 'List endpoints use cursor-based pagination',
    why: 'Page-number pagination breaks when records are added/removed mid-process.'
  },
  {
    id: '3.3',
    name: 'Search & Filtering',
    level: 3,
    category: 'Optimized',
    description: 'Resources can be filtered by common attributes',
    why: 'Without filtering, agents fetch everything and filter in memory (expensive).'
  },
  {
    id: '3.4',
    name: 'Bulk Operations',
    level: 3,
    category: 'Optimized',
    description: 'Batch create/update/delete endpoints exist',
    why: 'Creating 50 records shouldn\'t require 50 API calls.'
  },
  {
    id: '3.5',
    name: 'Consistent Schemas',
    level: 3,
    category: 'Optimized',
    description: 'Responses use consistent, predictable, versioned schemas',
    why: 'Inconsistent field names and types force defensive parsing.'
  },
  {
    id: '3.8',
    name: 'Agent Documentation',
    level: 3,
    category: 'Optimized',
    description: 'A dedicated "Using with AI Agents" section exists in docs',
    why: 'Developers building agents need explicit guidance on what\'s possible.'
  },

  // Level 4: Agent-Native - all manual
  {
    id: '4.1',
    name: 'Intent-Based Endpoints',
    level: 4,
    category: 'Agent-Native',
    description: 'High-level "intent" endpoints exist alongside CRUD',
    why: 'Intent APIs let agents say "send invoice" instead of orchestrating multiple calls.'
  },
  {
    id: '4.2',
    name: 'Agent Sessions',
    level: 4,
    category: 'Agent-Native',
    description: 'Agents can create persistent sessions with context',
    why: 'Long-running agentic workflows need to pick up where they left off.'
  },
  {
    id: '4.3',
    name: 'Scoped Agent Tokens',
    level: 4,
    category: 'Agent-Native',
    description: 'Agent-specific tokens with hard capability limits',
    why: 'When agents make mistakes, scoped tokens contain the damage.'
  },
  {
    id: '4.4',
    name: 'Agent Audit Logs',
    level: 4,
    category: 'Agent-Native',
    description: 'API actions logged with agent identifiers',
    why: '"The AI deleted it" is a support ticket you don\'t want.'
  },
  {
    id: '4.5',
    name: 'Sandbox Environment',
    level: 4,
    category: 'Agent-Native',
    description: 'A sandbox exists for agent testing',
    why: 'Developers need to iterate without triggering real emails or charges.'
  },
  {
    id: '4.6',
    name: 'Consequence Labels',
    level: 4,
    category: 'Agent-Native',
    description: 'Documentation marks consequential/irreversible actions',
    why: 'Agent frameworks gate on consequence labels for human confirmation.'
  },
  {
    id: '4.7',
    name: 'Native Tool Schemas',
    level: 4,
    category: 'Agent-Native',
    description: 'Core API actions packaged as ready-to-use tool definitions',
    why: 'This is the last mile from "interesting API" to "working agent tool".'
  },
];

// Total items: auto-detectable + manual
export const TOTAL_ITEMS = AUTO_DETECTABLE_CHECKS.length + MANUAL_CHECKS.length;
