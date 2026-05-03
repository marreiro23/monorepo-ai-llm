export enum InvocationSourceEnum {
  VSCODE = 'vscode',
  API = 'api'
}

export enum ApprovalStatusEnum {
  DRAFT = 'draft',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DEPRECATED = 'deprecated'
}

export enum ValidationStatusEnum {
  PASSED = 'passed',
  FAILED = 'failed',
  WARNING = 'warning'
}

export enum PromptKindEnum {
  SYSTEM = 'system',
  USER = 'user',
  WRAPPER = 'wrapper',
  HANDOFF = 'handoff',
  TOPIC_FLOW = 'topic-flow',
  INSTRUCTION = 'instruction'
}

export enum DependencyTypeEnum {
  AGENT = 'agent',
  PROMPT_TEMPLATE = 'prompt-template',
  PROMPT_VERSION = 'prompt-version',
  TOPIC_FLOW = 'topic-flow',
  REFERENCE = 'reference',
  TOOLING = 'tooling'
}

export enum LearningEventTypeEnum {
  AMBIGUITY = 'ambiguity',
  REPHRASE_REQUEST = 'rephrase_request',
  EXECUTION_FAILURE = 'execution_failure',
  OUTPUT_REJECTION = 'output_rejection',
  HUMAN_CORRECTION = 'human_correction',
  HANDOFF_FAILURE = 'handoff_failure'
}

export enum RuntimeOutcomeEnum {
  SUCCESS = 'success',
  PARTIAL_SUCCESS = 'partial_success',
  FAILED = 'failed',
  ABANDONED = 'abandoned'
}

export enum RegressionStatusEnum {
  NOT_RUN = 'not_run',
  PASSED = 'passed',
  FAILED = 'failed'
}

export enum TopicDomainEnum {
  USERS = 'users',
  PERMISSIONS = 'permissions',
  SHAREPOINT = 'sharepoint',
  TEAMS_CHANNELS = 'teams-channels',
  GROUPS = 'groups',
  ENDPOINT_CREATION = 'endpoint-creation'
}
