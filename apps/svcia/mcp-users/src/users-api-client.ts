export type UserRecord = {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
  updatedAt: string;
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

export class UsersApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(baseUrl = 'http://localhost:3001', fetchImpl: FetchLike = fetch) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
  }

  async listUsers(): Promise<UserRecord[]> {
    const response = await this.request<ApiResponse<UserRecord[]>>('/users');
    if (!response.success || !Array.isArray(response.data)) {
      throw new Error(
        response.message ?? 'Users API returned an invalid users list response',
      );
    }

    return response.data;
  }

  async getUser(id: string): Promise<UserRecord> {
    const response = await this.request<ApiResponse<UserRecord>>(
      `/users/${encodeURIComponent(id)}`,
    );
    if (!response.success || !response.data) {
      throw new Error(response.message ?? `User not found: ${id}`);
    }

    return response.data;
  }

  async searchUsers(query: string, limit = 20): Promise<UserRecord[]> {
    const normalizedQuery = query.trim().toLowerCase();
    const users = await this.listUsers();
    const filtered = normalizedQuery
      ? users.filter((user) => {
          return (
            user.fullName.toLowerCase().includes(normalizedQuery) ||
            user.email.toLowerCase().includes(normalizedQuery)
          );
        })
      : users;

    return filtered.slice(0, limit);
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
        `Users API GET ${path} failed with HTTP ${response.status}`,
      );
    }

    return payload as T;
  }
}
