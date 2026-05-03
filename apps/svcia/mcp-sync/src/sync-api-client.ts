export type SyncJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export type SyncJobRecord = {
  id: string;
  type: string;
  status: SyncJobStatus;
  context?: string | null;
  itemCount?: number | null;
  errorMessage?: string | null;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
};

export type SyncedSiteRecord = {
  id: string;
  remoteId: string;
  name?: string | null;
  displayName?: string | null;
  webUrl?: string | null;
  rawData?: Record<string, unknown> | null;
  syncedAt: string;
};

export type SyncedUserRecord = {
  id: string;
  remoteId: string;
  displayName?: string | null;
  mail?: string | null;
  userPrincipalName?: string | null;
  rawData?: Record<string, unknown> | null;
  syncedAt: string;
};

export type SyncStatusSummary = {
  totalJobs: number;
  byStatus: Record<SyncJobStatus, number>;
  latestJob: SyncJobRecord | null;
  latestCompletedJob: SyncJobRecord | null;
  latestFailedJob: SyncJobRecord | null;
  runningJobs: SyncJobRecord[];
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export class SyncApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(baseUrl = 'http://localhost:3004', fetchImpl: FetchLike = fetch) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
  }

  async listJobs(
    limit = 50,
    status?: SyncJobStatus | null,
  ): Promise<SyncJobRecord[]> {
    const response =
      await this.request<ApiResponse<SyncJobRecord[]>>('/sync/jobs');
    const jobs = this.readList(response, 'sync jobs');
    const filtered = status
      ? jobs.filter((job) => job.status === status)
      : jobs;
    return filtered.slice(0, limit);
  }

  async getStatus(): Promise<SyncStatusSummary> {
    const jobs = await this.listJobs(500);
    const byStatus: Record<SyncJobStatus, number> = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
    };

    for (const job of jobs) {
      byStatus[job.status] += 1;
    }

    return {
      totalJobs: jobs.length,
      byStatus,
      latestJob: jobs[0] ?? null,
      latestCompletedJob:
        jobs.find((job) => job.status === 'completed') ?? null,
      latestFailedJob: jobs.find((job) => job.status === 'failed') ?? null,
      runningJobs: jobs.filter((job) => job.status === 'running'),
    };
  }

  async listSites(limit = 50): Promise<SyncedSiteRecord[]> {
    const response =
      await this.request<ApiResponse<SyncedSiteRecord[]>>('/sync/sites');
    return this.readList(response, 'synced sites').slice(0, limit);
  }

  async listUsers(limit = 50): Promise<SyncedUserRecord[]> {
    const response =
      await this.request<ApiResponse<SyncedUserRecord[]>>('/sync/users');
    return this.readList(response, 'synced users').slice(0, limit);
  }

  private readList<T>(response: ApiResponse<T[]>, label: string): T[] {
    if (!response.success || !Array.isArray(response.data)) {
      throw new Error(
        response.message ?? `Sync API returned an invalid ${label} response`,
      );
    }

    return response.data;
  }

  private async request<T>(path: string): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    });

    const text = await response.text();
    const payload = text ? (JSON.parse(text) as T) : null;
    if (!response.ok) {
      throw new Error(
        `Sync API GET ${path} failed with HTTP ${response.status}`,
      );
    }

    return payload as T;
  }
}
