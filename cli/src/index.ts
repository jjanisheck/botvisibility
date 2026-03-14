#!/usr/bin/env node

import { normalizeUrl, runAllChecks } from './scanner.js';
import { runRepoChecks } from './repo-scanner.js';
import { getTier } from './scoring.js';
import { CheckResult, ScanResult, RepoCheckResult } from './types.js';
import * as path from 'path';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
};

function printHelp() {
  console.log(`
${colors.bold}agent-readiness-audit${colors.reset}
Scan any URL to check if it's ready for AI agents.

${colors.bold}USAGE${colors.reset}
  npx agent-readiness-audit <url> [options]

${colors.bold}OPTIONS${colors.reset}
  --json        Output results as JSON
  --repo <path> Also scan a local git repo for deeper checks
  --help, -h    Show this help message

${colors.bold}EXAMPLES${colors.reset}
  npx agent-readiness-audit https://example.com
  npx agent-readiness-audit stripe.com --json
  npx agent-readiness-audit https://myapp.com --repo ./
  npx agent-readiness-audit clone.fyi --repo ../my-backend --json

${colors.bold}WHAT WE CHECK${colors.reset}
  ${colors.green}URL Checks:${colors.reset}
    - /llms.txt - AI-readable app description
    - /.well-known/agent-card.json - Agent capability manifest
    - /openapi.json (+ common paths) - API specification
    - /robots.txt - AI crawler policy
    - CORS headers - Cross-origin access
    - Rate limit headers - Throttling transparency
    - Caching headers - ETags, Cache-Control
    - OpenID configuration - Auth discovery
    - Structured data - JSON-LD, meta tags

  ${colors.cyan}Repo Checks (--repo):${colors.reset}
    - OpenAPI/Swagger spec files
    - Webhook handler patterns
    - Rate limit middleware
    - Structured error responses
    - Idempotency key handling
    - SDK/client libraries
    - Streaming/event endpoints

${colors.bold}SCORING${colors.reset}
  🔴 Invisible   (0-20%)  - Agents can't find or use you
  🟠 Findable   (21-40%)  - Agents struggle to use you reliably
  🟡 Usable     (41-62%)  - Basic tasks work, rough edges remain
  🟢 Ready      (63-80%)  - Agents can work with you reliably
  🚀 Agent-Native (81%+)  - Designed for the agentic era

${colors.bold}LEARN MORE${colors.reset}
  https://github.com/joeyjanisheck/agent-readiness-audit
`);
}

function statusIcon(status: CheckResult['status']): string {
  switch (status) {
    case 'pass': return `${colors.green}✓${colors.reset}`;
    case 'fail': return `${colors.red}✗${colors.reset}`;
    case 'partial': return `${colors.yellow}◐${colors.reset}`;
    case 'unknown': return `${colors.dim}?${colors.reset}`;
  }
}

function printCheck(check: CheckResult | RepoCheckResult) {
  const icon = statusIcon(check.status);
  const levelColor = check.level === 1 ? colors.cyan :
                     check.level === 2 ? colors.blue :
                     check.level === 3 ? colors.yellow :
                     colors.magenta;

  console.log(`  ${icon} ${colors.bold}${check.name}${colors.reset} ${levelColor}[L${check.level}]${colors.reset}`);
  console.log(`    ${colors.dim}${check.message}${colors.reset}`);

  if (check.details) {
    console.log(`    ${colors.dim}${check.details}${colors.reset}`);
  }

  if (check.recommendation && !check.passed) {
    console.log(`    ${colors.yellow}→ ${check.recommendation}${colors.reset}`);
  }

  if ('filePath' in check && check.filePath) {
    console.log(`    ${colors.dim}File: ${check.filePath}${colors.reset}`);
  }
}

function printResults(result: ScanResult, repoChecks?: RepoCheckResult[]) {
  const tierColors: Record<string, string> = {
    'Invisible': colors.red,
    'Findable': colors.yellow,
    'Usable': colors.yellow,
    'Ready': colors.green,
    'Agent-Native': colors.magenta,
  };

  const tierColor = tierColors[result.tier.name] || colors.white;

  console.log('');
  console.log(`${colors.bold}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}  AGENT-READINESS SCAN RESULTS${colors.reset}`);
  console.log(`${colors.bold}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log('');
  console.log(`  ${colors.dim}URL:${colors.reset} ${result.url}`);
  console.log(`  ${colors.dim}Scanned:${colors.reset} ${new Date(result.timestamp).toLocaleString()}`);
  console.log('');

  // Score
  const passed = result.checks.filter(c => c.passed).length;
  console.log(`  ${colors.bold}Score:${colors.reset} ${passed}/${result.checks.length} auto-detected checks passed`);
  console.log(`  ${colors.bold}Tier:${colors.reset}  ${result.tier.emoji} ${tierColor}${result.tier.name}${colors.reset} (${result.tier.range})`);
  console.log(`  ${colors.dim}${result.tier.description}${colors.reset}`);
  console.log('');

  // URL Checks
  console.log(`${colors.bold}URL CHECKS${colors.reset}`);
  console.log(`${colors.dim}───────────────────────────────────────────────────────${colors.reset}`);

  const grouped: Record<string, CheckResult[]> = {};
  for (const check of result.checks) {
    if (!grouped[check.category]) grouped[check.category] = [];
    grouped[check.category].push(check);
  }

  for (const [category, checks] of Object.entries(grouped)) {
    console.log('');
    console.log(`  ${colors.bold}${category}${colors.reset}`);
    for (const check of checks) {
      printCheck(check);
      console.log('');
    }
  }

  // Repo checks
  if (repoChecks && repoChecks.length > 0) {
    console.log(`${colors.bold}REPO CHECKS${colors.reset}`);
    console.log(`${colors.dim}───────────────────────────────────────────────────────${colors.reset}`);

    const repoGrouped: Record<string, RepoCheckResult[]> = {};
    for (const check of repoChecks) {
      if (!repoGrouped[check.category]) repoGrouped[check.category] = [];
      repoGrouped[check.category].push(check);
    }

    for (const [category, checks] of Object.entries(repoGrouped)) {
      console.log('');
      console.log(`  ${colors.bold}${category}${colors.reset}`);
      for (const check of checks) {
        printCheck(check);
        console.log('');
      }
    }

    const repoPassed = repoChecks.filter(c => c.passed).length;
    console.log(`  ${colors.dim}Repo checks: ${repoPassed}/${repoChecks.length} passed${colors.reset}`);
    console.log('');
  }

  // Summary
  console.log(`${colors.bold}═══════════════════════════════════════════════════════${colors.reset}`);
  const allChecks = [...result.checks, ...(repoChecks || [])];
  const totalPassed = allChecks.filter(c => c.passed).length;
  const totalPartial = allChecks.filter(c => c.status === 'partial').length;
  const totalFailed = allChecks.filter(c => c.status === 'fail').length;

  console.log(`  ${colors.green}✓ ${totalPassed} passed${colors.reset}  ${colors.yellow}◐ ${totalPartial} partial${colors.reset}  ${colors.red}✗ ${totalFailed} failed${colors.reset}`);
  console.log('');
  console.log(`  ${colors.dim}Full checklist: https://github.com/joeyjanisheck/agent-readiness-audit${colors.reset}`);
  console.log('');
}

async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  const jsonOutput = args.includes('--json');
  const helpFlag = args.includes('--help') || args.includes('-h');
  const repoIndex = args.indexOf('--repo');
  const repoPath = repoIndex !== -1 ? args[repoIndex + 1] : null;

  // Filter out flags to get URL
  const urlArgs = args.filter((arg, i) =>
    !arg.startsWith('--') &&
    !arg.startsWith('-') &&
    (repoIndex === -1 || i !== repoIndex + 1)
  );

  if (helpFlag || urlArgs.length === 0) {
    printHelp();
    process.exit(0);
  }

  const urlInput = urlArgs[0];

  // Normalize URL
  let baseUrl: string;
  try {
    baseUrl = normalizeUrl(urlInput);
  } catch (e) {
    console.error(`${colors.red}Error: Invalid URL "${urlInput}"${colors.reset}`);
    process.exit(1);
  }

  if (!jsonOutput) {
    console.log('');
    console.log(`${colors.cyan}Scanning ${baseUrl}...${colors.reset}`);
  }

  // Run URL checks
  const checks = await runAllChecks(baseUrl);
  const score = checks.filter(c => c.passed).length;
  const tier = getTier(score, 31);

  const result: ScanResult = {
    url: baseUrl,
    timestamp: new Date().toISOString(),
    score,
    maxScore: 31,
    tier,
    checks
  };

  // Run repo checks if specified
  let repoChecks: RepoCheckResult[] | undefined;
  if (repoPath) {
    const absolutePath = path.resolve(repoPath);
    if (!jsonOutput) {
      console.log(`${colors.cyan}Scanning repo at ${absolutePath}...${colors.reset}`);
    }
    repoChecks = runRepoChecks(absolutePath);
  }

  // Output
  if (jsonOutput) {
    const output = {
      ...result,
      repoChecks: repoChecks || []
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    printResults(result, repoChecks);
  }
}

main().catch(err => {
  console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
  process.exit(1);
});
