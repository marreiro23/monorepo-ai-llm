import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

@Injectable()
export class MermaidMcpService {
  private readonly repoRoot = process.cwd();
  private readonly scriptPath = join(this.repoRoot, 'tools', 'mcp', 'ensure-mermaid-domains.mjs');

  sync(domain?: string) {
    if (!existsSync(this.scriptPath)) {
      throw new InternalServerErrorException(`Script MCP nao encontrado em ${this.scriptPath}`);
    }

    const args = [this.scriptPath];
    if (domain) {
      args.push(`--domain=${domain}`);
    }

    const run = spawnSync(process.execPath, args, {
      cwd: this.repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        ...(domain ? { APP_NAME: domain } : {}),
      },
    });

    if (run.status !== 0) {
      throw new InternalServerErrorException({
        message: 'Falha ao sincronizar arquivos Mermaid',
        status: run.status,
        stderr: run.stderr?.trim() || 'sem stderr',
      });
    }

    return {
      ok: true,
      mode: domain ? 'single-domain' : 'all-domains',
      domain: domain ?? null,
      script: this.scriptPath,
      output: (run.stdout || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    };
  }

  status() {
    const appsRoot = join(this.repoRoot, 'apps');
    const domains = existsSync(appsRoot)
      ? readdirSync(appsRoot, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .sort()
      : [];

    return {
      ok: true,
      scriptExists: existsSync(this.scriptPath),
      scriptPath: this.scriptPath,
      domains,
      usage: {
        syncAll: 'POST /mcp/mermaid/sync',
        syncOne: 'POST /mcp/mermaid/sync?domain=users-api',
      },
    };
  }
}
