export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  level: 1 | 2 | 3 | 4;
}

export interface Level {
  id: number;
  name: string;
  subtitle: string;
  items: ChecklistItem[];
}

export const levels: Level[] = [
  {
    id: 1,
    name: "Discoverable",
    subtitle: "Can agents find you and understand what you do?",
    items: [
      {
        id: "1.1",
        title: "llms.txt",
        description: "/llms.txt exists at your domain root",
        level: 1,
      },
      {
        id: "1.2",
        title: "Agent Card",
        description: "/.well-known/agent-card.json exists and is valid",
        level: 1,
      },
      {
        id: "1.3",
        title: "OpenAPI / Swagger Spec",
        description: "A machine-readable API spec exists (OpenAPI 3.x preferred)",
        level: 1,
      },
      {
        id: "1.4",
        title: "Crawling & Discovery",
        description: "robots.txt has a clear, intentional policy for AI crawlers",
        level: 1,
      },
      {
        id: "1.5",
        title: "Documentation Quality",
        description: "Docs are text-based, not locked behind heavy JS",
        level: 1,
      },
      {
        id: "1.6",
        title: "Platform Skill Files",
        description: "A skill/tool definition exists for at least one major AI platform",
        level: 1,
      },
    ],
  },
  {
    id: 2,
    name: "Accessible",
    subtitle: "Can agents actually do things in your app?",
    items: [
      {
        id: "2.1a",
        title: "API-First: Primary Action",
        description: "The primary value action of your app is available via API",
        level: 2,
      },
      {
        id: "2.1b",
        title: "API-First: Read Operations",
        description: "Read operations are available (list, get, search)",
        level: 2,
      },
      {
        id: "2.1c",
        title: "API-First: Write Operations",
        description: "Write operations are available (create, update, delete)",
        level: 2,
      },
      {
        id: "2.2",
        title: "Agent-Friendly Authentication",
        description: "API key authentication is supported (not only OAuth browser flows)",
        level: 2,
      },
      {
        id: "2.3",
        title: "Predictable Error Handling",
        description: "All API errors return structured JSON (not HTML error pages)",
        level: 2,
      },
      {
        id: "2.4",
        title: "Async Operations",
        description: "Long-running operations return a job ID immediately with pollable status",
        level: 2,
      },
      {
        id: "2.5",
        title: "Idempotency",
        description: "Write endpoints support idempotency keys or are naturally idempotent",
        level: 2,
      },
      {
        id: "2.6",
        title: "API Parity",
        description: "All API actions match what's available in the UI",
        level: 2,
      },
    ],
  },
  {
    id: 3,
    name: "Transactable",
    subtitle: "Is interacting with your app token-efficient?",
    items: [
      {
        id: "3.1",
        title: "Response Bloat",
        description: "API responses don't include irrelevant fields; a fields/select parameter exists",
        level: 3,
      },
      {
        id: "3.2",
        title: "Pagination",
        description: "List endpoints are paginated with cursor-based pagination",
        level: 3,
      },
      {
        id: "3.3",
        title: "Search & Filtering",
        description: "Resources can be filtered by common attributes via query params",
        level: 3,
      },
      {
        id: "3.4",
        title: "Bulk Operations",
        description: "Batch create/update/delete endpoints exist for high-volume use cases",
        level: 3,
      },
      {
        id: "3.5",
        title: "Structured Outputs",
        description: "Responses use consistent, predictable, documented schemas",
        level: 3,
      },
      {
        id: "3.6",
        title: "Rate Limit Transparency",
        description: "Rate limit headers included in every response with Retry-After on 429s",
        level: 3,
      },
      {
        id: "3.7",
        title: "Caching Support",
        description: "ETag or Last-Modified headers included on cacheable responses",
        level: 3,
      },
      {
        id: "3.8",
        title: "Agent-Optimized Documentation",
        description: "A dedicated 'Using with AI Agents' section exists in your docs",
        level: 3,
      },
      {
        id: "3.9",
        title: "Natural Language Search",
        description: "A search endpoint exists that accepts natural-language-style queries",
        level: 3,
      },
    ],
  },
  {
    id: 4,
    name: "Native",
    subtitle: "Was your app designed with agents as first-class users?",
    items: [
      {
        id: "4.1",
        title: "Intent-Based Endpoints",
        description: "High-level 'intent' endpoints exist alongside CRUD endpoints",
        level: 4,
      },
      {
        id: "4.2",
        title: "Agent Session Management",
        description: "Agents can create persistent sessions with associated context",
        level: 4,
      },
      {
        id: "4.3",
        title: "Scoped Agent Tokens",
        description: "Agent-specific token types exist with hard capability limits",
        level: 4,
      },
      {
        id: "4.4",
        title: "Agent Audit Logs",
        description: "All API actions are logged with acting token/agent identifier",
        level: 4,
      },
      {
        id: "4.5",
        title: "Sandbox / Test Environment",
        description: "A free-tier sandbox environment exists for agent testing",
        level: 4,
      },
      {
        id: "4.6",
        title: "Consequence Labels",
        description: "API documentation clearly marks 'consequential' actions",
        level: 4,
      },
      {
        id: "4.7",
        title: "Native Tool Schemas",
        description: "Core API actions are packaged as ready-to-use tool definitions",
        level: 4,
      },
      {
        id: "4.8",
        title: "Multi-Platform Tool Support",
        description: "Tool definitions available for OpenAI, Claude, and LangChain formats",
        level: 4,
      },
    ],
  },
];

export const getTier = (score: number): { emoji: string; name: string; description: string; color: string } => {
  const percentage = (score / 31) * 100;
  if (percentage <= 20) {
    return { emoji: "🔴", name: "Invisible", description: "Agents can't find you or use you.", color: "text-red-500" };
  }
  if (percentage <= 40) {
    return { emoji: "🟠", name: "Findable", description: "Agents know you exist but struggle to use you reliably.", color: "text-orange-500" };
  }
  if (percentage <= 62) {
    return { emoji: "🟡", name: "Usable", description: "Agents can accomplish basic tasks. Rough edges remain.", color: "text-yellow-500" };
  }
  if (percentage <= 80) {
    return { emoji: "🟢", name: "Ready", description: "Agents can work with your app reliably.", color: "text-green-500" };
  }
  return { emoji: "🚀", name: "Agent-Native", description: "Your app is designed for the agentic era.", color: "text-purple-500" };
};

export const totalItems = levels.reduce((sum, level) => sum + level.items.length, 0);
