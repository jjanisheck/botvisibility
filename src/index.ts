#!/usr/bin/env node

import { normalizeUrl, runAllChecks } from './scanner.js';
import { runRepoChecks } from './repo-scanner.js';
import { calculateLevelProgress, getCurrentLevel, computeScore, LEVELS, SCORING_VERSION } from './scoring.js';
import { CheckResult, ScanResult, RepoCheckResult } from './types.js';
import { parseArgs } from './args.js';
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
};

function getLevelColor(levelNumber: number): string {
  switch (levelNumber) {
    case 1: return colors.red;
    case 2: return colors.yellow;
    case 3: return colors.green;
    case 4: return colors.magenta;
    case 5: return colors.blue;
    default: return colors.white;
  }
}

function printHelp() {
  console.log(`
${colors.bold}BotVisibility CLI${colors.reset}
The Speedtest.net for AI agents. Scan any URL to check bot visibility.

${colors.bold}USAGE${colors.reset}
  npx botvisibility <url> [options]

  Runs all 58 checks across 5 levels, all externally — no source access needed.

${colors.bold}OPTIONS${colors.reset}
  --json        Output results as JSON (for CI/CD integration)
  --repo <path> Also scan a local project directory alongside the live URL
                (supplementary; surfaces implementations not yet published)
  --help, -h    Show this help message

${colors.bold}EXAMPLES${colors.reset}
  ${colors.dim}# Basic URL scan (all 58 checks, all 5 levels)${colors.reset}
  npx botvisibility https://example.com

  ${colors.dim}# JSON output for CI/CD${colors.reset}
  npx botvisibility stripe.com --json

  ${colors.dim}# Also scan a local project directory${colors.reset}
  npx botvisibility https://myapp.com --repo ./

  ${colors.dim}# Combined scan with JSON output${colors.reset}
  npx botvisibility clone.fyi --repo ../my-backend --json

${colors.bold}LEVELS${colors.reset} ${colors.dim}(58 checks, all run externally)${colors.reset}
  ${colors.red}Level 1: Discoverable${colors.reset}   Bots can find you via machine-readable metadata (18 checks)
  ${colors.yellow}Level 2: Usable${colors.reset}        Your API works for agents (11 checks, most require OpenAPI)
  ${colors.green}Level 3: Optimized${colors.reset}     Your API minimizes token cost and handles scale (7 checks)
  ${colors.magenta}Level 4: Indexable${colors.reset}     AI search systems can find, index, and ground answers (15 checks)
  ${colors.blue}Level 5: Agent-Native${colors.reset}  Your platform treats AI agents as first-class users (7 checks)

${colors.bold}LEARN MORE${colors.reset}
  https://botvisibility.com
  https://github.com/jjanisheck/botvisibility
`);
}

function statusIcon(status: CheckResult['status']): string {
  switch (status) {
    case 'pass': return `${colors.green}+${colors.reset}`;
    case 'fail': return `${colors.red}x${colors.reset}`;
    case 'partial': return `${colors.yellow}~${colors.reset}`;
    case 'na': return `${colors.dim}-${colors.reset}`;
  }
}

function printLevelSection(
  levelNumber: number,
  levelName: string,
  checks: (CheckResult | RepoCheckResult)[],
) {
  const levelColor = getLevelColor(levelNumber);
  const applicable = checks.filter(c => c.status !== 'na');
  const passed = checks.filter(c => c.status === 'pass').length;
  const naCount = checks.filter(c => c.status === 'na').length;

  console.log('');
  console.log(`${levelColor}${colors.bold}LEVEL ${levelNumber}: ${levelName.toUpperCase()}${colors.reset}${' '.repeat(Math.max(0, 40 - levelName.length - 10))}${colors.bold}${passed}/${applicable.length}${colors.reset}`);
  console.log(`${colors.dim}${'─'.repeat(55)}${colors.reset}`);

  // Print non-NA checks
  for (const check of checks) {
    if (check.status === 'na') continue;
    const icon = statusIcon(check.status);
    console.log(`  ${icon} ${colors.bold}${check.name}${colors.reset}`);
    console.log(`    ${colors.dim}${check.message}${colors.reset}`);

    if (check.details) {
      console.log(`    ${colors.dim}${check.details}${colors.reset}`);
    }

    if (check.recommendation && check.status !== 'pass') {
      console.log(`    ${colors.yellow}-> ${check.recommendation}${colors.reset}`);
    }

    if ('filePath' in check && check.filePath) {
      console.log(`    ${colors.dim}File: ${check.filePath}${colors.reset}`);
    }
  }

  // Collapsed NA count
  if (naCount > 0) {
    console.log(`  ${colors.dim}- ${naCount} check${naCount === 1 ? '' : 's'} require${naCount === 1 ? 's' : ''} an OpenAPI spec to evaluate${colors.reset}`);
  }
}

function printResults(result: ScanResult, repoChecks?: RepoCheckResult[]) {
  // Scoring is computed from the canonical 58 external checks only.
  // Repo checks (if any) are supplementary and shown separately below.
  const checks = result.checks;
  const levelProgress = result.levels;
  const currentLevel = result.currentLevel;

  const totalPassed = checks.filter(c => c.status === 'pass').length;
  const totalApplicable = checks.filter(c => c.status !== 'na').length;

  // Find the "current working level" — first incomplete
  const workingLevel = levelProgress.find(lp => !lp.complete) || levelProgress[levelProgress.length - 1];
  const workingLevelColor = getLevelColor(workingLevel.level.number);

  console.log('');
  console.log(`${colors.bold}+-------------------------------------------------------+${colors.reset}`);
  console.log(`${colors.bold}|            BOTVISIBILITY SCAN RESULTS                 |${colors.reset}`);
  console.log(`${colors.bold}+-------------------------------------------------------+${colors.reset}`);
  console.log('');
  console.log(`  ${colors.dim}URL:${colors.reset}     ${result.url}`);
  console.log(`  ${colors.dim}Scanned:${colors.reset} ${new Date(result.timestamp).toLocaleString()}`);
  console.log('');

  // Score box
  console.log(`  ${colors.bold}+-------------------------------------+${colors.reset}`);
  console.log(`  ${colors.bold}|${colors.reset}  ${workingLevelColor}${colors.bold}Level ${workingLevel.level.number}: ${workingLevel.level.name}${colors.reset}${' '.repeat(Math.max(0, 24 - workingLevel.level.name.length))}${colors.bold}|${colors.reset}`);
  console.log(`  ${colors.bold}|${colors.reset}     ${colors.bold}${totalPassed}${colors.reset}${colors.dim}/${totalApplicable}${colors.reset} checks passed${' '.repeat(14)}${colors.bold}|${colors.reset}`);
  console.log(`  ${colors.bold}+-------------------------------------+${colors.reset}`);
  console.log('');

  if (currentLevel === 0) {
    console.log(`  ${colors.dim}Start by making your site discoverable to AI agents.${colors.reset}`);
  } else if (currentLevel < 5) {
    const nextLevel = LEVELS[currentLevel]; // 0-indexed: currentLevel is the next one
    console.log(`  ${colors.dim}Level ${currentLevel} reached! Work on Level ${nextLevel.number}: ${nextLevel.name}.${colors.reset}`);
  } else {
    console.log(`  ${colors.green}All 5 levels reached! Maximum agent visibility achieved.${colors.reset}`);
  }

  // Group checks by level (all 5 levels run externally)
  for (const level of LEVELS) {
    const levelChecks = checks.filter(c => c.level === level.number);
    if (levelChecks.length > 0) {
      printLevelSection(level.number, level.name, levelChecks);
    }
  }

  // Summary
  console.log('');
  console.log(`${colors.bold}${'='.repeat(55)}${colors.reset}`);
  const totalPartial = checks.filter(c => c.status === 'partial').length;
  const totalFailed = checks.filter(c => c.status === 'fail').length;
  const totalNa = checks.filter(c => c.status === 'na').length;

  console.log(`  ${colors.green}+ ${totalPassed} passed${colors.reset}  ${colors.yellow}~ ${totalPartial} partial${colors.reset}  ${colors.red}x ${totalFailed} failed${colors.reset}  ${colors.dim}- ${totalNa} n/a${colors.reset}`);

  // Supplementary local repo analysis (does not affect the score above)
  if (repoChecks && repoChecks.length > 0) {
    console.log('');
    console.log(`${colors.bold}LOCAL REPO ANALYSIS${colors.reset} ${colors.dim}(supplementary — not scored)${colors.reset}`);
    console.log(`${colors.dim}${'─'.repeat(55)}${colors.reset}`);
    for (const check of repoChecks) {
      if (check.status === 'na') continue;
      const icon = statusIcon(check.status);
      console.log(`  ${icon} ${colors.bold}${check.name}${colors.reset} ${colors.dim}(${check.id})${colors.reset}`);
      console.log(`    ${colors.dim}${check.message}${colors.reset}`);
      if (check.filePath) {
        console.log(`    ${colors.dim}File: ${check.filePath}${colors.reset}`);
      }
    }
  }

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
  currentLevel: number;
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
  const url = new URL(result.url);
  const domain = url.hostname.replace(/^www\./, '');

  return {
    domain,
    scannedAt: result.timestamp,
    currentLevel: result.currentLevel,
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
  console.log(`${colors.bold}Share Your Score${colors.reset}`);
  console.log(`${colors.dim}${'─'.repeat(55)}${colors.reset}`);
  console.log('');

  const shouldPublish = await askQuestion(
    `  Would you like to publish this score to ${colors.cyan}botvisibility.com${colors.reset}? (y/n) `
  );

  if (shouldPublish) {
    const payload = generatePublishPayload(result, repoChecks);
    const domain = payload.domain;
    const profileUrl = `https://botvisibility.com/site/${domain}`;

    console.log('');
    console.log(`  ${colors.green}+${colors.reset} Score ready to publish!`);
    console.log('');
    console.log(`  ${colors.bold}Your public profile will be available at:${colors.reset}`);
    console.log(`  ${colors.cyan}${profileUrl}${colors.reset}`);
    console.log('');
    console.log(`  ${colors.dim}This page will show:${colors.reset}`);
    console.log(`    - Level ${payload.currentLevel} badge`);
    console.log(`    - Check results and recommendations`);
    console.log(`    - Score history over time`);
    console.log('');

    console.log(`  ${colors.dim}Payload preview:${colors.reset}`);
    console.log(`  ${colors.dim}${JSON.stringify({
      domain: payload.domain,
      currentLevel: payload.currentLevel,
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
    //     console.log(`  ${colors.green}+${colors.reset} Published! View at: ${data.profileUrl}`);
    //   }
    // } catch (e) {
    //   console.log(`  ${colors.yellow}!${colors.reset} Could not publish. Try again later.`);
    // }

    console.log(`  ${colors.yellow}!${colors.reset} Publishing API coming soon! For now, share your results manually.`);
    console.log('');
  } else {
    console.log('');
    console.log(`  ${colors.dim}No problem! Run with --json to export results.${colors.reset}`);
    console.log('');
  }
}

async function main() {
  const { jsonOutput, helpFlag, repoPath, url: urlInput } = parseArgs(process.argv.slice(2));

  if (helpFlag || !urlInput) {
    printHelp();
    process.exit(0);
  }

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

  // Run repo checks if specified
  let repoChecks: RepoCheckResult[] | undefined;
  if (repoPath) {
    const absolutePath = path.resolve(repoPath);
    if (!jsonOutput) {
      console.log(`${colors.cyan}Scanning repo at ${absolutePath}...${colors.reset}`);
    }
    repoChecks = runRepoChecks(absolutePath);
  }

  // Calculate level progress + score from the canonical 58 external checks only.
  // Repo checks are supplementary and never affect the score.
  const levelProgress = calculateLevelProgress(checks);
  const currentLevel = getCurrentLevel(levelProgress);
  const score = computeScore(checks, levelProgress, currentLevel);

  const result: ScanResult = {
    scoringVersion: SCORING_VERSION,
    score,
    url: baseUrl,
    timestamp: new Date().toISOString(),
    currentLevel,
    levels: levelProgress,
    checks,
  };

  // Output
  if (jsonOutput) {
    // Matches the web scan JSON shape; repoChecks (if any) appended as supplementary.
    const output = repoChecks && repoChecks.length > 0
      ? { ...result, repoChecks }
      : result;
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
