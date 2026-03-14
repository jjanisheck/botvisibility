#!/usr/bin/env node

import { normalizeUrl, runAllChecks } from './scanner.js';
import { runRepoChecks } from './repo-scanner.js';
import { getTier } from './scoring.js';
import { CheckResult, ScanResult, RepoCheckResult } from './types.js';
import * as path from 'path';
import * as readline from 'readline';

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
${colors.bold}BotVisibility CLI${colors.reset}
The Speedtest.net for AI agents. Scan any URL to check bot visibility.

${colors.bold}USAGE${colors.reset}
  npx agent-readiness-audit <url> [options]

${colors.bold}OPTIONS${colors.reset}
  --json        Output results as JSON (for CI/CD integration)
  --repo <path> Include local repo analysis for deeper checks
  --help, -h    Show this help message

${colors.bold}EXAMPLES${colors.reset}
  ${colors.dim}# Basic URL scan${colors.reset}
  npx agent-readiness-audit https://example.com

  ${colors.dim}# JSON output for CI/CD${colors.reset}
  npx agent-readiness-audit stripe.com --json

  ${colors.dim}# Full scan with repo analysis${colors.reset}
  npx agent-readiness-audit https://myapp.com --repo ./

  ${colors.dim}# Combined scan with JSON output${colors.reset}
  npx agent-readiness-audit clone.fyi --repo ../my-backend --json

${colors.bold}URL CHECKS${colors.reset}
  ${colors.green}Level 1: Discoverable${colors.reset}
    - /llms.txt - AI-readable app description
    - /.well-known/agent-card.json - Agent capability manifest
    - /openapi.json (+ variants) - API specification
    - /robots.txt - AI crawler policy
    - CORS headers - Cross-origin access
    - Structured data - JSON-LD, meta tags

  ${colors.cyan}Level 2: Usable${colors.reset}
    - OpenID configuration - Auth discovery

  ${colors.yellow}Level 3: Optimized${colors.reset}
    - Rate limit headers - Throttling transparency
    - Caching headers - ETags, Cache-Control

${colors.bold}REPO CHECKS${colors.reset} (with --repo)
    - OpenAPI/Swagger spec files
    - Webhook handler patterns
    - Rate limit middleware
    - Structured error responses
    - Idempotency key handling
    - SDK/client libraries
    - Streaming/event endpoints

${colors.bold}VISIBILITY TIERS${colors.reset}
  ${colors.red}🔴 Invisible${colors.reset}   (0-20%)   Agents can't find or use you
  ${colors.yellow}🟠 Dim${colors.reset}        (21-40%)  Bots know you exist but struggle
  ${colors.yellow}🟡 Visible${colors.reset}    (41-62%)  Bots can handle basic tasks
  ${colors.green}🟢 Clear${colors.reset}      (63-80%)  Ahead of most of the internet
  ${colors.magenta}🚀 Beacon${colors.reset}     (81%+)    Maximum bot visibility

${colors.bold}LEARN MORE${colors.reset}
  https://botvisibility.com
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

function getTierColor(tierName: string): string {
  const tierColors: Record<string, string> = {
    'Invisible': colors.red,
    'Dim': colors.yellow,
    'Visible': colors.yellow,
    'Clear': colors.green,
    'Beacon': colors.magenta,
  };
  return tierColors[tierName] || colors.white;
}

function printResults(result: ScanResult, repoChecks?: RepoCheckResult[]) {
  const tierColor = getTierColor(result.tier.name);

  console.log('');
  console.log(`${colors.bold}╔═══════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}║            BOTVISIBILITY SCAN RESULTS                 ║${colors.reset}`);
  console.log(`${colors.bold}╚═══════════════════════════════════════════════════════╝${colors.reset}`);
  console.log('');
  console.log(`  ${colors.dim}URL:${colors.reset}     ${result.url}`);
  console.log(`  ${colors.dim}Scanned:${colors.reset} ${new Date(result.timestamp).toLocaleString()}`);
  console.log('');

  // Score display - game-like
  const passed = result.checks.filter(c => c.passed).length;
  const percentage = Math.round((passed / result.checks.length) * 100);

  console.log(`  ${colors.bold}┌─────────────────────────────────────┐${colors.reset}`);
  console.log(`  ${colors.bold}│${colors.reset}  ${result.tier.emoji}  ${tierColor}${colors.bold}${result.tier.name.toUpperCase().padEnd(12)}${colors.reset}  ${colors.dim}${result.tier.range.padStart(8)}${colors.reset}  ${colors.bold}│${colors.reset}`);
  console.log(`  ${colors.bold}│${colors.reset}                                     ${colors.bold}│${colors.reset}`);
  console.log(`  ${colors.bold}│${colors.reset}     ${colors.bold}${passed}${colors.reset}${colors.dim}/${result.checks.length}${colors.reset} checks passed  ${colors.bold}${percentage}%${colors.reset}     ${colors.bold}│${colors.reset}`);
  console.log(`  ${colors.bold}└─────────────────────────────────────┘${colors.reset}`);
  console.log('');
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
  console.log(`  ${colors.dim}Full checklist: https://botvisibility.com${colors.reset}`);
  console.log('');
}

// Ask user a yes/no question
function askQuestion(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(question, (answer) => {
      rl.close();
      const normalized = answer.toLowerCase().trim();
      resolve(normalized === 'y' || normalized === 'yes');
    });
  });
}

// Generate the publish payload
interface PublishPayload {
  domain: string;
  scannedAt: string;
  tier: string;
  score: number;
  maxScore: number;
  percentage: number;
  checks: Array<{
    id: string;
    name: string;
    passed: boolean;
    status: string;
    level: number;
  }>;
  repoChecks?: Array<{
    id: string;
    name: string;
    passed: boolean;
    status: string;
    level: number;
  }>;
}

function generatePublishPayload(
  result: ScanResult,
  repoChecks?: RepoCheckResult[]
): PublishPayload {
  // Extract domain from URL
  const url = new URL(result.url);
  const domain = url.hostname.replace(/^www\./, '');

  return {
    domain,
    scannedAt: result.timestamp,
    tier: result.tier.name,
    score: result.score,
    maxScore: result.maxScore,
    percentage: Math.round((result.score / result.maxScore) * 100),
    checks: result.checks.map(c => ({
      id: c.id,
      name: c.name,
      passed: c.passed,
      status: c.status,
      level: c.level
    })),
    repoChecks: repoChecks?.map(c => ({
      id: c.id,
      name: c.name,
      passed: c.passed,
      status: c.status,
      level: c.level
    }))
  };
}

async function promptPublish(result: ScanResult, repoChecks?: RepoCheckResult[]) {
  console.log('');
  console.log(`${colors.bold}📢 Share Your Score${colors.reset}`);
  console.log(`${colors.dim}───────────────────────────────────────────────────────${colors.reset}`);
  console.log('');

  const shouldPublish = await askQuestion(
    `  Would you like to publish this score to ${colors.cyan}botvisibility.com${colors.reset}? (y/n) `
  );

  if (shouldPublish) {
    const payload = generatePublishPayload(result, repoChecks);
    const domain = payload.domain;
    const profileUrl = `https://botvisibility.com/site/${domain}`;

    console.log('');
    console.log(`  ${colors.green}✓${colors.reset} Score ready to publish!`);
    console.log('');
    console.log(`  ${colors.bold}Your public profile will be available at:${colors.reset}`);
    console.log(`  ${colors.cyan}${profileUrl}${colors.reset}`);
    console.log('');
    console.log(`  ${colors.dim}This page will show:${colors.reset}`);
    console.log(`    • Your ${payload.tier} tier badge`);
    console.log(`    • ${payload.percentage}% visibility score`);
    console.log(`    • Check results and recommendations`);
    console.log(`    • Score history over time`);
    console.log('');

    // Show the payload that would be sent (for debugging/transparency)
    console.log(`  ${colors.dim}Payload preview:${colors.reset}`);
    console.log(`  ${colors.dim}${JSON.stringify({
      domain: payload.domain,
      tier: payload.tier,
      score: `${payload.score}/${payload.maxScore}`,
      checks: `${payload.checks.length} URL checks` + (payload.repoChecks ? ` + ${payload.repoChecks.length} repo checks` : '')
    })}${colors.reset}`);
    console.log('');

    // TODO: When API is ready, uncomment this:
    // try {
    //   const response = await fetch('https://botvisibility.com/api/publish', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(payload)
    //   });
    //   if (response.ok) {
    //     const data = await response.json();
    //     console.log(`  ${colors.green}✓${colors.reset} Published! View at: ${data.profileUrl}`);
    //   }
    // } catch (e) {
    //   console.log(`  ${colors.yellow}⚠${colors.reset} Could not publish. Try again later.`);
    // }

    console.log(`  ${colors.yellow}⚠${colors.reset} Publishing API coming soon! For now, share your results manually.`);
    console.log('');
  } else {
    console.log('');
    console.log(`  ${colors.dim}No problem! Run with --json to export results.${colors.reset}`);
    console.log('');
  }
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
    console.log(`${colors.cyan}🔍 Scanning ${baseUrl}...${colors.reset}`);
  }

  // Run URL checks
  const checks = await runAllChecks(baseUrl);
  const score = checks.filter(c => c.passed).length;
  const tier = getTier(score, checks.length);

  const result: ScanResult = {
    url: baseUrl,
    timestamp: new Date().toISOString(),
    score,
    maxScore: checks.length,
    tier,
    checks
  };

  // Run repo checks if specified
  let repoChecks: RepoCheckResult[] | undefined;
  if (repoPath) {
    const absolutePath = path.resolve(repoPath);
    if (!jsonOutput) {
      console.log(`${colors.cyan}📁 Scanning repo at ${absolutePath}...${colors.reset}`);
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

    // Prompt to publish (only in interactive mode)
    if (process.stdin.isTTY) {
      await promptPublish(result, repoChecks);
    }
  }
}

main().catch(err => {
  console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
  process.exit(1);
});
