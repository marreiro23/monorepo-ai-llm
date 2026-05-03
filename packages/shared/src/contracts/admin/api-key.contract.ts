export type ApiKeyOwnerType = 'internal' | 'external';
export type ApiKeyStatus = 'active' | 'rotating' | 'revoked' | 'expired';

export type ApiKeyContract = {
  id: string;
  name: string;
  keyPrefix: string;
  owner: string;
  ownerType: ApiKeyOwnerType;
  scopes: string[];
  status: ApiKeyStatus;
  expiresAt: string | null;
  scheduledRotationAt: string | null;
  successorKeyId: string | null;
  predecessorKeyId: string | null;
  lastUsedAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateApiKeyRequest = {
  name: string;
  owner: string;
  ownerType: ApiKeyOwnerType;
  scopes?: string[];
  expiresAt?: string;
  metadata?: Record<string, unknown>;
};

export type RotateApiKeyRequest = {
  scheduledAt: string;
  dryRun?: boolean;
};

export type ApiKeyCreateResponse = {
  key: ApiKeyContract;
  plaintext: string;
};

export type ApiKeyRotateResponse = {
  predecessor: ApiKeyContract;
  successor: ApiKeyContract;
  plaintext: string;
  scheduledAt: string;
  dryRun: boolean;
};

export type ApiKeyListResponse = {
  data: ApiKeyContract[];
  count: number;
};
