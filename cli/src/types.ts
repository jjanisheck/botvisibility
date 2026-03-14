// Core types for agent-readiness scanning

export interface CheckResult {
  id: string;
  name: string;
  passed: boolean;
  status: 'pass' | 'fail' | 'partial' | 'unknown';
  level: 1 | 2 | 3 | 4;
  category: string;
  autoDetectable: boolean;
  message: string;
  details?: string;
  recommendation?: string;
  foundAt?: string;
}

export interface Tier {
  name: 'Invisible' | 'Dim' | 'Visible' | 'Clear' | 'Beacon';
  emoji: string;
  color: string;
  description: string;
  range: string;
}

export interface ScanResult {
  url: string;
  timestamp: string;
  score: number;
  maxScore: number;
  tier: Tier;
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
