import type { ValidationStatusContract } from './llm-ops.enums.contract.js';

export type PromptValidationContract = {
  id: string;
  promptVersionId: string;
  validatorName: string;
  validatorPhase: string;
  validationStatus: ValidationStatusContract;
  criticalAmbiguityCount: number;
  warningCount: number;
  coherenceScore: string | null;
  findings: Array<Record<string, unknown>>;
  summary: string | null;
  validatedAt: string;
  validatedBy: string;
};

export type CreatePromptValidationRequestContract = {
  promptVersionId: string;
  validatorName: string;
  validatorPhase: string;
  validationStatus: ValidationStatusContract;
  criticalAmbiguityCount?: number;
  warningCount?: number;
  coherenceScore?: string | null;
  findings?: Array<Record<string, unknown>>;
  summary?: string | null;
  validatedBy: string;
};