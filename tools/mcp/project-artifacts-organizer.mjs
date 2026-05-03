#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const repoRoot = path.resolve(scriptDir, '../..');
const expectedBaseRoot = '/mnt/repositorio/workdir/repostorios';
const repoName = path.basename(repoRoot);
const expectedRepoRoot = path.join(expectedBaseRoot, repoName);

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      continue;
    }
    const [k, v] = arg.slice(2).split('=');
    parsed[k] = v ?? true;
  }
  return parsed;
}

function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function ensureDir(dirPath, findings, applyFix) {
  if (fileExists(dirPath)) {
    return;
  }

  findings.push(`Diretorio ausente: ${path.relative(repoRoot, dirPath)}`);
  if (applyFix) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function moveIfExists(fromRelative, toRelative, findings, applyFix) {
  const fromPath = path.join(repoRoot, fromRelative);
  const toPath = path.join(repoRoot, toRelative);

  if (!fileExists(fromPath)) {
    return;
  }

  findings.push(`Arquivo fora do padrao: ${fromRelative} -> ${toRelative}`);

  if (applyFix) {
    fs.mkdirSync(path.dirname(toPath), { recursive: true });
    if (fileExists(toPath)) {
      const backupPath = `${toPath}.bak`;
      fs.renameSync(toPath, backupPath);
    }
    fs.renameSync(fromPath, toPath);
  }
}

function buildNotebookTemplate(operationName) {
  return JSON.stringify(
    {
      cells: [
        {
          cell_type: 'markdown',
          metadata: { language: 'markdown' },
          source: [
            `# Runbook de Operacao: ${operationName}`,
            '',
            'Este notebook e obrigatorio para operacoes de desenvolvimento.',
            'Cada celula descreve: o que faz e onde e executada.',
            '',
            'Padrao de raiz: `/mnt/repositorio/workdir/repostorios/<repositorio>`.',
          ],
        },
        {
          cell_type: 'code',
          metadata: { language: 'python' },
          source: [
            '# O que faz: valida se o repositorio esta sob a raiz padrao e mostra o diretorio atual.',
            '# Onde executa: shell local, na raiz do repositorio.',
            'from pathlib import Path',
            'import subprocess',
            '',
            "base_root = Path('/mnt/repositorio/workdir/repostorios')",
            "current_root = Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip())",
            'repo_name = current_root.name',
            'expected_root = base_root / repo_name',
            '',
            "print(f'BASE_ROOT: {base_root}')",
            "print(f'CURRENT_ROOT: {current_root}')",
            "print(f'EXPECTED_ROOT: {expected_root}')",
            '',
            'if current_root == expected_root:',
            "    print('[OK] Repo na raiz padrao')",
            'else:',
            "    raise RuntimeError('[ERRO] Repo fora da raiz padrao')",
          ],
        },
        {
          cell_type: 'code',
          metadata: { language: 'python' },
          source: [
            '# O que faz: executa checks de organizacao de artefatos do projeto.',
            '# Onde executa: shell local, na raiz do repositorio.',
            'from pathlib import Path',
            'import subprocess',
            '',
            "repo_root = Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip())",
            "command = ['node', 'tools/mcp/project-artifacts-organizer.mjs', '--action=check']",
            "print(f'Executando em: {repo_root}')",
            'subprocess.run(command, cwd=repo_root, check=True)',
          ],
        },
      ],
      metadata: {
        kernel_info: { name: 'python3' },
        language_info: { name: 'python' },
      },
      nbformat: 4,
      nbformat_minor: 5,
    },
    null,
    2,
  );
}

function buildMarkdownTemplate(operationName, notebookPath) {
  return [
    `# Runbook de Operacao: ${operationName}`,
    '',
    '## Objetivo',
    'Documentar como executar, testar e validar a operacao de desenvolvimento.',
    '',
    '## Regras obrigatorias',
    '1. Toda operacao deve possuir este arquivo `.md` e um notebook `.ipynb` correspondente.',
    '2. Cada celula do notebook deve explicar o que faz e onde e executada.',
    '3. O repositorio deve permanecer sob `/mnt/repositorio/workdir/repostorios/<repositorio>`.',
    '',
    '## Notebook associado',
    `- ${notebookPath}`,
    '',
    '## Como executar',
    '1. Abrir o notebook associado.',
    '2. Executar as celulas na ordem.',
    '3. Registrar saidas e evidencias no PR.',
    '',
    '## Como testar',
    '1. Rodar `npm run lint`.',
    '2. Rodar `npm run test`.',
    '3. Rodar `npm run build`.',
    '',
    '## Como validar organizacao',
    '1. `node tools/mcp/project-artifacts-organizer.mjs --action=check`',
    '2. Se houver pendencias: `node tools/mcp/project-artifacts-organizer.mjs --action=fix`',
    '',
  ].join('\n');
}

function ensureRunbookPair(operationSlug, findings, applyFix) {
  const notebookRel = `spec/execucao/runbook-${operationSlug}.ipynb`;
  const markdownRel = `spec/fases/runbook-${operationSlug}.md`;

  const notebookAbs = path.join(repoRoot, notebookRel);
  const markdownAbs = path.join(repoRoot, markdownRel);

  if (!fileExists(notebookAbs)) {
    findings.push(`Notebook de runbook ausente: ${notebookRel}`);
    if (applyFix) {
      fs.mkdirSync(path.dirname(notebookAbs), { recursive: true });
      fs.writeFileSync(notebookAbs, buildNotebookTemplate(operationSlug), 'utf8');
    }
  }

  if (!fileExists(markdownAbs)) {
    findings.push(`Markdown de runbook ausente: ${markdownRel}`);
    if (applyFix) {
      fs.mkdirSync(path.dirname(markdownAbs), { recursive: true });
      fs.writeFileSync(markdownAbs, buildMarkdownTemplate(operationSlug, notebookRel), 'utf8');
    }
  }
}

function listFilesByPrefixSuffix(dirPath, prefix, suffix) {
  if (!fileExists(dirPath)) {
    return [];
  }

  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.startsWith(prefix) && name.endsWith(suffix));
}

function ensureRunbookPairsForAll(findings, applyFix) {
  const execDir = path.join(repoRoot, 'spec/execucao');
  const runbookNotebooks = listFilesByPrefixSuffix(execDir, 'runbook-', '.ipynb');

  for (const notebookName of runbookNotebooks) {
    const operationSlug = notebookName
      .replace(/^runbook-/, '')
      .replace(/\.ipynb$/, '');
    ensureRunbookPair(operationSlug, findings, applyFix);
  }
}

function ensureRunbookNotebookCellDocs(findings, applyFix) {
  const execDir = path.join(repoRoot, 'spec/execucao');
  const runbookNotebooks = listFilesByPrefixSuffix(execDir, 'runbook-', '.ipynb');

  for (const notebookName of runbookNotebooks) {
    const notebookAbs = path.join(execDir, notebookName);
    let notebook;

    try {
      notebook = JSON.parse(fs.readFileSync(notebookAbs, 'utf8'));
    } catch {
      findings.push(
        `Notebook invalido (JSON): ${path.relative(repoRoot, notebookAbs)}`,
      );
      continue;
    }

    if (!Array.isArray(notebook.cells)) {
      findings.push(
        `Notebook sem cells[]: ${path.relative(repoRoot, notebookAbs)}`,
      );
      continue;
    }

    let changed = false;

    for (const cell of notebook.cells) {
      if (cell.cell_type !== 'code') {
        continue;
      }

      if (!Array.isArray(cell.source)) {
        cell.source = [];
      }

      const line0 = String(cell.source[0] ?? '').trim();
      const line1 = String(cell.source[1] ?? '').trim();
      const hasWhat = /^#\s*o que faz\s*:/i.test(line0);
      const hasWhere = /^#\s*onde executa\s*:/i.test(line1);

      if (hasWhat && hasWhere) {
        continue;
      }

      findings.push(
        `Celula de codigo sem cabecalho padrao (O que faz/Onde executa): ${path.relative(repoRoot, notebookAbs)}`,
      );

      if (applyFix) {
        const rest = [...cell.source];
        if (hasWhat) {
          rest.shift();
        }
        if (hasWhere && rest.length > 0) {
          rest.shift();
        }

        cell.source = [
          '# O que faz: descrever objetivo desta celula.',
          '# Onde executa: shell local na raiz do repositorio.',
          ...rest,
        ];
        changed = true;
      }
    }

    if (applyFix && changed) {
      fs.writeFileSync(notebookAbs, `${JSON.stringify(notebook, null, 2)}\n`, 'utf8');
    }
  }
}

function run(action, operation) {
  const findings = [];
  const applyFix = action === 'fix';

  if (repoRoot !== expectedRepoRoot) {
    findings.push(
      `Raiz fora do padrao: ${repoRoot} (esperado: ${expectedRepoRoot})`,
    );
  }

  const standardDirs = [
    'spec/fases',
    'spec/execucao',
    'spec/testes',
    'tools/mcp',
    'utils/scripts-admin',
    'scripts/smoke-tests',
  ];

  for (const dir of standardDirs) {
    ensureDir(path.join(repoRoot, dir), findings, applyFix);
  }

  const relocations = [
    ['spec/notebooks_06_remote_debian_docker_baseline.ipynb', 'spec/execucao/fase-06-remote-debian-docker-baseline.ipynb'],
    ['spec/notebooks_07_hardening_observability.ipynb', 'spec/execucao/fase-07-hardening-observability.ipynb'],
    ['spec/notebooks_08_boundary_governance_ci.ipynb', 'spec/execucao/fase-08-boundary-governance-ci.ipynb'],
    ['spec/notebooks_09_migracao_api_llm_embedded.ipynb', 'spec/execucao/fase-09-migracao-api-llm-embedded.ipynb'],
    ['spec/PLANO-MIGRACAO-API-LLM-EMBEDDED.md', 'spec/fases/fase-09-plano-migracao-api-llm-embedded.md'],
    ['spec/docs_implementation-plan_remote-debian-docker.md', 'spec/fases/fase-00-implementation-plan-remote-debian-docker.md'],
  ];

  for (const [fromRel, toRel] of relocations) {
    moveIfExists(fromRel, toRel, findings, applyFix);
  }

  if (action === 'new-runbook') {
    if (!operation) {
      console.error('Uso: --action=new-runbook --operation=<nome-da-operacao>');
      process.exit(2);
    }
    const operationSlug = slugify(operation);
    ensureRunbookPair(operationSlug, findings, true);
  } else {
    ensureRunbookPair('operacao-desenvolvimento', findings, applyFix);
  }

  ensureRunbookPairsForAll(findings, applyFix);
  ensureRunbookNotebookCellDocs(findings, applyFix);

  if (findings.length === 0) {
    console.log(`[OK] Nenhuma pendencia encontrada (${action}).`);
    return;
  }

  console.log(`[INFO] Pendencias encontradas (${findings.length}):`);
  for (const item of findings) {
    console.log(`- ${item}`);
  }

  if (action === 'check') {
    process.exitCode = 1;
    return;
  }

  console.log('[OK] Ajustes aplicados.');
}

const args = parseArgs(process.argv.slice(2));
const action = String(args.action || 'check');
const operation = args.operation ? String(args.operation) : null;

if (!['check', 'fix', 'new-runbook'].includes(action)) {
  console.error('Acao invalida. Use: check | fix | new-runbook');
  process.exit(2);
}

run(action, operation);
