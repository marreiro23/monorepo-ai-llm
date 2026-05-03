export class SyncApiClient {
    baseUrl;
    fetchImpl;
    constructor(baseUrl = 'http://localhost:3004', fetchImpl = fetch) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.fetchImpl = fetchImpl;
    }
    async listJobs(limit = 50, status) {
        const response = await this.request('/sync/jobs');
        const jobs = this.readList(response, 'sync jobs');
        const filtered = status ? jobs.filter((job) => job.status === status) : jobs;
        return filtered.slice(0, limit);
    }
    async getStatus() {
        const jobs = await this.listJobs(500);
        const byStatus = {
            pending: 0,
            running: 0,
            completed: 0,
            failed: 0
        };
        for (const job of jobs) {
            byStatus[job.status] += 1;
        }
        return {
            totalJobs: jobs.length,
            byStatus,
            latestJob: jobs[0] ?? null,
            latestCompletedJob: jobs.find((job) => job.status === 'completed') ?? null,
            latestFailedJob: jobs.find((job) => job.status === 'failed') ?? null,
            runningJobs: jobs.filter((job) => job.status === 'running')
        };
    }
    async listSites(limit = 50) {
        const response = await this.request('/sync/sites');
        return this.readList(response, 'synced sites').slice(0, limit);
    }
    async listUsers(limit = 50) {
        const response = await this.request('/sync/users');
        return this.readList(response, 'synced users').slice(0, limit);
    }
    readList(response, label) {
        if (!response.success || !Array.isArray(response.data)) {
            throw new Error(response.message ?? `Sync API returned an invalid ${label} response`);
        }
        return response.data;
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
            throw new Error(`Sync API GET ${path} failed with HTTP ${response.status}`);
        }
        return payload;
    }
}
