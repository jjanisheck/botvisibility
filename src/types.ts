// Core types for agent-readiness scanning — 5-level model.
// All 58 checks across all 5 levels are verified externally (live URL scan);
// Level 5 (Agent-Native) is checked via published declarations + a live probe.

export type LevelNumber = 1 | 2 | 3 | 4 | 5;

export interface Level {
  number: LevelNumber;
  name: string;
  // Hex color (matches the web scan output, e.g. "#ef4444").
  color: string;
  description: string;
}

export interface LevelProgress {
  level: Level;
  passed: number;
  failed: number;
  na: number;
  total: number;
  complete: boolean;
}

export interface CheckResult {
  id: string;
  name: string;
  passed: boolean;
  status: 'pass' | 'fail' | 'partial' | 'na';
  level: LevelNumber;
  category: string;
  autoDetectable: boolean;
  message: string;
  details?: string;
  recommendation?: string;
  foundAt?: string;
}

// A Level-5 (Agent-Native) check definition. These are now verified externally
// (declaration in /.well-known/agent-card.json or OpenAPI + a live endpoint probe),
// not via the CLI or source access.
export interface Level5Check {
  id: string;
  name: string;
  level: 5;
  category: 'Agent-Native';
  description: string;
}

// Aggregate score summary, matching the web scan output shape.
export interface ScoreSummary {
  passed: number;
  failed: number;
  partial: number;
  na: number;
  total: number;
  level: number;
  levelName: string;
  grade: string;
  indexable: {
    passed: number;
    failed: number;
    partial: number;
    na: number;
    total: number;
  };
}

export interface ScanResult {
  scoringVersion: string;
  score: ScoreSummary;
  url: string;
  timestamp: string;
  currentLevel: number;
  levels: LevelProgress[];
  checks: CheckResult[];
}

export interface RepoCheckResult extends CheckResult {
  filePath?: string;
  lineNumber?: number;
  codeSnippet?: string;
}

export interface RepoScanResult {
  repoPath: string;
  timestamp: string;
  checks: RepoCheckResult[];
}
