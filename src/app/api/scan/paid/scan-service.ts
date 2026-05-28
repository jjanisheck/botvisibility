/**
 * Paid Scan Service
 *
 * Executes enhanced scans for paid tiers.
 * Reuses core scanner functionality and adds premium features.
 */

import {
  checkLlmsTxt,
  checkAgentCard,
  checkOpenApiSpec,
  checkRobotsTxt,
  checkStructuredData,
  checkCorsHeaders,
  checkOpenIdConfig,
  checkRateLimitHeaders,
  checkCachingHeaders,
} from '@/lib/scanner';
import { calculateScore, getTier, MANUAL_CHECKS } from '@/lib/scoring';
import { CheckResult, ScanResult } from '@/lib/types';
import { getPricingTier } from '@/lib/payments';

/**
 * Enhanced scan result with paid features
 */
export interface PaidScanResult extends ScanResult {
  /** Tier that was purchased */
  paidTier: string;
  /** Priority-ordered action items */
  priorityActions: PriorityAction[];
  /** Implementation guides for failed checks */
  implementationGuides: ImplementationGuide[];
  /** Export URLs if available */
  exports?: {
    pdf?: string;
    json?: string;
  };
}

export interface PriorityAction {
  rank: number;
  checkId: string;
  checkName: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'quick' | 'moderate' | 'significant';
  description: string;
  estimatedTimeMinutes: number;
}

export interface ImplementationGuide {
  checkId: string;
  checkName: string;
  overview: string;
  steps: string[];
  codeExample?: string;
  resources: string[];
}

/**
 * Run enhanced paid scan
 */
export async function runPaidScan(
  baseUrl: string,
  tierId: string
): Promise<PaidScanResult> {
  const tier = getPricingTier(tierId);
  if (!tier) {
    throw new Error(`Unknown paid scan tier: ${tierId}`);
  }

  // Run all core checks (same as free scan)
  const checks = await Promise.all([
    checkLlmsTxt(baseUrl),
    checkAgentCard(baseUrl),
    checkOpenApiSpec(baseUrl),
    checkRobotsTxt(baseUrl),
    checkStructuredData(baseUrl),
    checkCorsHeaders(baseUrl),
    checkOpenIdConfig(baseUrl),
    checkRateLimitHeaders(baseUrl),
    checkCachingHeaders(baseUrl),
  ]);

  const score = calculateScore(checks);
  const tierResult = getTier(score, checks.length);

  // Generate priority actions for failed checks
  const priorityActions = generatePriorityActions(checks);

  // Generate implementation guides for failed checks
  const implementationGuides = generateImplementationGuides(checks);

  const result: PaidScanResult = {
    url: baseUrl,
    timestamp: new Date().toISOString(),
    score,
    maxScore: checks.length,
    tier: tierResult,
    checks,
    manualChecks: MANUAL_CHECKS,
    paidTier: tierId,
    priorityActions,
    implementationGuides,
  };

  // Add export URLs for detailed tier and above
  if (tierId !== 'free') {
    result.exports = {
      json: `/api/scan/paid/export?format=json&scanId=${encodeURIComponent(baseUrl)}`,
      // PDF export would be implemented separately
      // pdf: `/api/scan/paid/export?format=pdf&scanId=${encodeURIComponent(baseUrl)}`,
    };
  }

  return result;
}

/**
 * Generate prioritized action items from failed checks
 */
function generatePriorityActions(checks: CheckResult[]): PriorityAction[] {
  const failed = checks.filter(c => !c.passed);

  return failed
    .map((check, index) => ({
      rank: index + 1,
      checkId: check.id,
      checkName: check.name,
      impact: getImpact(check),
      effort: getEffort(check),
      description: check.recommendation ?? check.message,
      estimatedTimeMinutes: getEstimatedTime(check),
    }))
    .sort((a, b) => {
      // Sort by impact (high first), then effort (quick first)
      const impactOrder = { high: 0, medium: 1, low: 2 };
      const effortOrder = { quick: 0, moderate: 1, significant: 2 };

      const impactDiff = impactOrder[a.impact] - impactOrder[b.impact];
      if (impactDiff !== 0) return impactDiff;

      return effortOrder[a.effort] - effortOrder[b.effort];
    })
    .map((action, index) => ({ ...action, rank: index + 1 }));
}

function getImpact(check: CheckResult): 'high' | 'medium' | 'low' {
  // Level 1 (Discoverable) = high impact
  // Level 2 (Usable) = medium impact
  // Level 3+ = lower impact
  if (check.level === 1) return 'high';
  if (check.level === 2) return 'medium';
  return 'low';
}

function getEffort(check: CheckResult): 'quick' | 'moderate' | 'significant' {
  // Quick wins
  const quickChecks = ['1.1', '1.2', '1.4']; // llms.txt, agent-card, robots.txt
  if (quickChecks.includes(check.id)) return 'quick';

  // Moderate effort
  const moderateChecks = ['1.3', '1.5', '2.2a']; // OpenAPI, docs, OpenID
  if (moderateChecks.includes(check.id)) return 'moderate';

  return 'significant';
}

function getEstimatedTime(check: CheckResult): number {
  const times: Record<string, number> = {
    '1.1': 15, // llms.txt
    '1.2': 15, // agent-card
    '1.3': 45, // OpenAPI spec
    '1.4': 10, // robots.txt
    '1.5': 30, // Documentation
    '1.5a': 20, // CORS
    '2.2a': 60, // OpenID
    '3.6': 30, // Rate limits
    '3.7': 20, // Caching
  };

  return times[check.id] ?? 30;
}

/**
 * Generate implementation guides for failed checks
 */
function generateImplementationGuides(checks: CheckResult[]): ImplementationGuide[] {
  const failed = checks.filter(c => !c.passed);

  return failed.map(check => ({
    checkId: check.id,
    checkName: check.name,
    overview: getGuideOverview(check),
    steps: getGuideSteps(check),
    codeExample: getCodeExample(check),
    resources: getResources(check),
  }));
}

function getGuideOverview(check: CheckResult): string {
  const overviews: Record<string, string> = {
    '1.1': 'llms.txt is a simple text file that helps AI models understand your application. Place it at the root of your domain.',
    '1.2': 'An Agent Card is a JSON file at /.well-known/agent-card.json that provides structured metadata about your API.',
    '1.3': 'OpenAPI (Swagger) specifications enable agents to automatically discover and use your API endpoints.',
    '1.4': 'robots.txt controls which crawlers can access your content. Ensure AI crawlers are not blocked.',
    '1.5': 'Structured data and meta tags help AI systems understand your content and documentation.',
    '1.5a': 'CORS headers are required for web-based AI agents to make cross-origin API requests.',
    '2.2a': 'OpenID Connect discovery enables standard OAuth flows for API authentication.',
    '3.6': 'Rate limit headers tell agents how many requests they can make and when limits reset.',
    '3.7': 'Caching headers enable efficient conditional requests and reduce unnecessary data transfer.',
  };

  return overviews[check.id] ?? check.recommendation ?? 'Implement this feature to improve bot visibility.';
}

function getGuideSteps(check: CheckResult): string[] {
  const steps: Record<string, string[]> = {
    '1.1': [
      'Create a file named llms.txt in your public directory',
      'Add a title and description of your application',
      'List your main API endpoints or capabilities',
      'Include links to documentation',
      'Deploy and verify at yourdomain.com/llms.txt',
    ],
    '1.2': [
      'Create .well-known directory in your public folder',
      'Create agent-card.json with required fields: name, description, url',
      'Add optional fields: api, auth, capabilities, contact',
      'Validate JSON syntax',
      'Deploy and verify at yourdomain.com/.well-known/agent-card.json',
    ],
    '1.3': [
      'Document your API endpoints in OpenAPI 3.x format',
      'Include request/response schemas',
      'Add authentication requirements',
      'Host the spec at /openapi.json or /api-docs',
      'Consider using tools like Swagger UI for visualization',
    ],
    '1.5a': [
      'Add Access-Control-Allow-Origin header to API responses',
      'Configure allowed methods: GET, POST, PUT, DELETE',
      'Allow required headers including Authorization',
      'Handle OPTIONS preflight requests',
      'Test with a cross-origin request',
    ],
  };

  return steps[check.id] ?? [
    'Review the check requirements',
    'Implement the necessary changes',
    'Test the implementation',
    'Deploy and verify',
  ];
}

function getCodeExample(check: CheckResult): string | undefined {
  const examples: Record<string, string> = {
    '1.1': `# llms.txt
# MyApp - AI-Ready API

> MyApp helps users manage tasks via API

## Capabilities
- Create and manage tasks
- Search and filter items
- Real-time notifications

## API Documentation
- OpenAPI: https://myapp.com/openapi.json
- Guides: https://myapp.com/docs

## Authentication
API keys available at https://myapp.com/settings/api`,

    '1.2': `{
  "name": "MyApp",
  "description": "Task management API",
  "url": "https://myapp.com",
  "api": {
    "type": "openapi",
    "url": "https://myapp.com/openapi.json"
  },
  "auth": {
    "type": "apiKey",
    "header": "Authorization"
  },
  "capabilities": ["tasks", "notifications"]
}`,

    '1.5a': `// Next.js middleware.ts
import { NextResponse } from 'next/server';

export function middleware(request) {
  const response = NextResponse.next();

  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  return response;
}`,

    '3.6': `// Add to API response headers
res.setHeader('X-RateLimit-Limit', '100');
res.setHeader('X-RateLimit-Remaining', remaining.toString());
res.setHeader('X-RateLimit-Reset', resetTime.toString());`,
  };

  return examples[check.id];
}

function getResources(check: CheckResult): string[] {
  const resources: Record<string, string[]> = {
    '1.1': [
      'https://llmstxt.org - Official llms.txt specification',
      'https://github.com/anthropics/llms-txt - Examples and templates',
    ],
    '1.2': [
      'https://agentprotocol.ai - Agent Card specification',
      'JSON Schema for validation',
    ],
    '1.3': [
      'https://swagger.io/specification/ - OpenAPI 3.x specification',
      'https://editor.swagger.io - Online editor',
    ],
    '1.4': [
      'https://developers.google.com/search/docs/crawling-indexing/robots/intro',
      'AI crawler guidelines from OpenAI and Anthropic',
    ],
  };

  return resources[check.id] ?? [
    'https://botvisibility.com/docs - BotVisibility documentation',
  ];
}
