// Core types for agent-readiness scanning — 4-level model

export interface Level {
  number: 1 | 2 | 3 | 4;
  name: string;
  description: string;
  color: string;
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
  level: 1 | 2 | 3 | 4;
  category: string;
  autoDetectable: boolean;
  message: string;
  details?: string;
  recommendation?: string;
  foundAt?: string;
}

export interface CliCheck {
  id: string;
  name: string;
  level: 4;
  category: 'Agent-Native';
  description: string;
  whyCliOnly: string;
}

export interface ScanResult {
  url: string;
  timestamp: string;
  currentLevel: number;
  levels: LevelProgress[];
  checks: CheckResult[];
  cliChecks: CliCheck[];
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
