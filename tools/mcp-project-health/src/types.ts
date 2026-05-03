export type CheckStatus = 'ok' | 'fixed' | 'warning' | 'error' | 'skipped';

export interface Finding {
  severity: 'info' | 'warning' | 'error';
  file?: string;
  line?: number;
  message: string;
}

export interface Correction {
  file: string;
  description: string;
  before: string;
  after: string;
}

export interface CheckResult {
  tool: string;
  status: CheckStatus;
  durationMs: number;
  findings: Finding[];
  corrections: Correction[];
  reportPath?: string;
}
