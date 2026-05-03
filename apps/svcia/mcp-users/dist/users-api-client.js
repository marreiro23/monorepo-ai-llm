export class UsersApiClient {
    baseUrl;
    fetchImpl;
    constructor(baseUrl = 'http://localhost:3001', fetchImpl = fetch) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.fetchImpl = fetchImpl;
    }
    async listUsers() {
        const response = await this.request('/users');
        if (!response.success || !Array.isArray(response.data)) {
            throw new Error(response.message ?? 'Users API returned an invalid users list response');
        }
        return response.data;
    }
    async getUser(id) {
        const response = await this.request(`/users/${encodeURIComponent(id)}`);
        if (!response.success || !response.data) {
            throw new Error(response.message ?? `User not found: ${id}`);
        }
        return response.data;
    }
    async searchUsers(query, limit = 20) {
        const normalizedQuery = query.trim().toLowerCase();
        const users = await this.listUsers();
        const filtered = normalizedQuery
            ? users.filter((user) => {
                return user.fullName.toLowerCase().includes(normalizedQuery) || user.email.toLowerCase().includes(normalizedQuery);
            })
            : users;
        return filtered.slice(0, limit);
    }
    async request(path) {
        const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
            method: 'GET',
            headers: {
                accept: 'application/json'
            }
        });
        const text = await response.text();
        const payload = text ? JSON.parse(text) : null;
        if (!response.ok) {
            throw new Error(`Users API GET ${path} failed with HTTP ${response.status}`);
        }
        return payload;
    }
}
