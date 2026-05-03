import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { spawnSync } from 'node:child_process';

export interface GitPushRequest {
  remote?: string;
  branch?: string;
  setUpstream?: boolean;
}

export interface PullRequestCreateRequest {
  title?: string;
  body?: string;
  base?: string;
  head?: string;
  draft?: boolean;
}

interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

@Injectable()
export class GitMcpService {
  private readonly repoRoot = process.cwd();

  status() {
    const branch = this.run('git', ['branch', '--show-current']);
    this.assertSuccess(branch, 'Falha ao obter branch atual');

    const porcelain = this.run('git', ['status', '--porcelain']);
    this.assertSuccess(porcelain, 'Falha ao obter status do repositorio');

    const lines = porcelain.stdout.split('\n').map((line) => line.trimEnd()).filter(Boolean);
    const staged = lines.filter((line) => line[0] && line[0] !== ' ').length;
    const unstaged = lines.filter((line) => line[1] && line[1] !== ' ').length;
    const untracked = lines.filter((line) => line.startsWith('??')).length;

    return {
      ok: true,
      branch: branch.stdout.trim(),
      clean: lines.length === 0,
      summary: {
        total: lines.length,
        staged,
        unstaged,
        untracked,
      },
      entries: lines,
      usage: {
        commit: 'POST /mcp/git/commit',
        push: 'POST /mcp/git/push',
        pullRequestStatus: 'GET /mcp/git/pr/status',
        createPullRequest: 'POST /mcp/git/pr/create',
      },
    };
  }

  commit(message: string, addAll: boolean) {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      throw new BadRequestException('Mensagem de commit e obrigatoria');
    }

    if (addAll) {
      const addAllResult = this.run('git', ['add', '-A']);
      this.assertSuccess(addAllResult, 'Falha ao executar git add -A');
    }

    const stagedCheck = this.run('git', ['diff', '--cached', '--name-only']);
    this.assertSuccess(stagedCheck, 'Falha ao validar arquivos staged');
    const stagedFiles = stagedCheck.stdout.split('\n').map((line) => line.trim()).filter(Boolean);

    if (stagedFiles.length === 0) {
      throw new BadRequestException('Nao ha arquivos staged para commit');
    }

    const commitResult = this.run('git', ['commit', '-m', trimmedMessage]);
    this.assertSuccess(commitResult, 'Falha ao executar commit');

    const hash = this.run('git', ['rev-parse', '--short', 'HEAD']);
    this.assertSuccess(hash, 'Falha ao obter hash do commit');

    return {
      ok: true,
      commit: hash.stdout.trim(),
      stagedFiles,
      output: commitResult.stdout,
    };
  }

  push(request: GitPushRequest) {
    const remote = (request.remote || 'origin').trim();
    const branch = (request.branch || this.currentBranch()).trim();
    const args = ['push'];

    if (request.setUpstream) {
      args.push('-u');
    }

    args.push(remote, branch);

    const pushResult = this.run('git', args);
    this.assertSuccess(pushResult, 'Falha ao executar push');

    return {
      ok: true,
      remote,
      branch,
      output: [pushResult.stdout, pushResult.stderr].filter(Boolean).join('\n').trim(),
    };
  }

  pullRequestStatus(branch?: string) {
    this.ensureGhAvailable();

    const targetBranch = (branch || this.currentBranch()).trim();
    const result = this.run('gh', ['pr', 'list', '--head', targetBranch, '--json', 'number,title,url,state,headRefName,baseRefName']);
    this.assertSuccess(result, 'Falha ao consultar PRs via gh CLI');

    let prs: Array<Record<string, unknown>> = [];
    try {
      prs = JSON.parse(result.stdout || '[]') as Array<Record<string, unknown>>;
    } catch {
      throw new InternalServerErrorException('Falha ao interpretar resposta JSON do gh pr list');
    }

    return {
      ok: true,
      branch: targetBranch,
      count: prs.length,
      pullRequests: prs,
    };
  }

  createPullRequest(request: PullRequestCreateRequest) {
    this.ensureGhAvailable();

    const title = (request.title || '').trim();
    if (!title) {
      throw new BadRequestException('Titulo da PR e obrigatorio');
    }

    const base = (request.base || 'main').trim();
    const head = (request.head || this.currentBranch()).trim();
    const body = (request.body || '').trim();

    const args = ['pr', 'create', '--base', base, '--head', head, '--title', title];
    if (body) {
      args.push('--body', body);
    } else {
      args.push('--body', 'PR criada via MCP Git');
    }
    if (request.draft) {
      args.push('--draft');
    }

    const createResult = this.run('gh', args);
    this.assertSuccess(createResult, 'Falha ao criar PR via gh CLI');

    const url = createResult.stdout
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith('http'));

    return {
      ok: true,
      base,
      head,
      url: url || null,
      output: [createResult.stdout, createResult.stderr].filter(Boolean).join('\n').trim(),
    };
  }

  private currentBranch() {
    const branchResult = this.run('git', ['branch', '--show-current']);
    this.assertSuccess(branchResult, 'Falha ao obter branch atual');
    const branch = branchResult.stdout.trim();
    if (!branch) {
      throw new InternalServerErrorException('Branch atual vazia');
    }
    return branch;
  }

  private ensureGhAvailable() {
    const ghVersion = this.run('gh', ['--version']);
    if (ghVersion.status !== 0) {
      throw new BadRequestException('GitHub CLI (gh) nao encontrado no ambiente');
    }

    const auth = this.run('gh', ['auth', 'status']);
    if (auth.status !== 0) {
      throw new BadRequestException('gh nao autenticado. Execute gh auth login no servidor');
    }
  }

  private run(command: string, args: string[]): CommandResult {
    const result = spawnSync(command, args, {
      cwd: this.repoRoot,
      encoding: 'utf8',
      env: process.env,
    });

    return {
      status: result.status,
      stdout: (result.stdout || '').trim(),
      stderr: (result.stderr || '').trim(),
    };
  }

  private assertSuccess(result: CommandResult, message: string) {
    if (result.status !== 0) {
      throw new InternalServerErrorException({
        message,
        status: result.status,
        stderr: result.stderr || 'sem stderr',
      });
    }
  }
}
