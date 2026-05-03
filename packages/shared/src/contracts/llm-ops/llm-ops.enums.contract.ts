export type InvocationSourceContract = 'vscode' | 'api';

export type ApprovalStatusContract = 'draft' | 'in_review' | 'approved' | 'rejected' | 'deprecated';

export type PromptKindContract = 'system' | 'user' | 'wrapper' | 'handoff' | 'topic-flow' | 'instruction';

export type ValidationStatusContract = 'passed' | 'failed' | 'warning';

export type RuntimeOutcomeContract = 'success' | 'partial_success' | 'failed' | 'abandoned';

export type RegressionStatusContract = 'not_run' | 'passed' | 'failed';

export type LearningEventTypeContract =
  | 'ambiguity'
  | 'rephrase_request'
  | 'execution_failure'
  | 'output_rejection'
  | 'human_correction'
  | 'handoff_failure';

export type TopicDomainContract = 'users' | 'permissions' | 'sharepoint' | 'teams-channels' | 'groups' | 'endpoint-creation';
