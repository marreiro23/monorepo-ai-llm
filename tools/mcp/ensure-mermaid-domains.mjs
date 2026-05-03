#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const appsRoot = path.join(repoRoot, 'apps');
const cliDomain = process.argv.find((arg) => arg.startsWith('--domain='))?.split('=')[1]?.trim();
const envDomain = process.env.APP_NAME?.trim();
const targetDomain = cliDomain || envDomain || null;

function toId(text) {
  return text.replace(/[^a-zA-Z0-9_]/g, '_');
}

function parseImportLine(line) {
  const namedMatch = line.match(/^\s*import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/);
  if (namedMatch) {
    return {
      symbols: namedMatch[1].split(',').map((v) => v.trim()).filter(Boolean),
      source: namedMatch[2],
    };
  }

  const defaultMatch = line.match(/^\s*import\s+([a-zA-Z0-9_]+)\s+from\s+['"]([^'"]+)['"]/);
  if (defaultMatch) {
    return {
      symbols: [defaultMatch[1]],
      source: defaultMatch[2],
    };
  }

  return null;
}

function parseArray(content, key) {
  const regex = new RegExp(`${key}\\s*:\\s*\\[([^\\]]*)\\]`, 'm');
  const match = content.match(regex);
  if (!match) {
    return [];
  }

  return match[1]
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function analyzeDomain(domainName) {
  const appDir = path.join(appsRoot, domainName);
  const srcDir = path.join(appDir, 'src');

  if (!fs.existsSync(srcDir)) {
    throw new Error(`Dominio invalido ou sem src: ${domainName}`);
  }

  const tsFiles = fs
    .readdirSync(srcDir)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
    .sort();

  const files = [];
  const classToNode = new Map();
  const keyToNode = new Map();
  const externalPackages = new Set();
  const nestModuleRefs = { imports: [], controllers: [], providers: [], exports: [] };

  for (const fileName of tsFiles) {
    const fullPath = path.join(srcDir, fileName);
    const content = fs.readFileSync(fullPath, 'utf8');
    const classMatch = content.match(/export\s+class\s+([A-Za-z0-9_]+)/);
    const className = classMatch ? classMatch[1] : null;

    const importsRelative = [];
    const importsExternal = [];

    for (const line of content.split('\n')) {
      const parsed = parseImportLine(line);
      if (!parsed) {
        continue;
      }

      if (parsed.source.startsWith('.')) {
        importsRelative.push(...parsed.symbols);
      } else {
        importsExternal.push(parsed.source);
      }
    }

    for (const pkg of importsExternal) {
      externalPackages.add(pkg);
    }

    const ctorMatch = content.match(/constructor\s*\(([^)]*)\)/s);
    const constructorDeps = !ctorMatch
      ? []
      : ctorMatch[1]
          .split(',')
          .map((part) => {
            const typeMatch = part.match(/:\s*([A-Za-z0-9_]+)/);
            return typeMatch ? typeMatch[1].trim() : null;
          })
          .filter(Boolean);

    const type = fileName.endsWith('.controller.ts')
      ? 'controller'
      : fileName.endsWith('.service.ts')
        ? 'service'
        : fileName.endsWith('.module.ts')
          ? 'module'
          : fileName === 'main.ts'
            ? 'bootstrap'
            : 'other';

    const key = fileName.replace('.ts', '');
    const nodeId = `n_${toId(domainName)}_${toId(key)}`;
    const label = className ? `${className}\\n(${fileName})` : fileName;

    if (className) {
      classToNode.set(className, nodeId);
    }
    keyToNode.set(key, nodeId);

    if (fileName === 'app.module.ts' || fileName === `${domainName}.module.ts`) {
      nestModuleRefs.imports = parseArray(content, 'imports');
      nestModuleRefs.controllers = parseArray(content, 'controllers');
      nestModuleRefs.providers = parseArray(content, 'providers');
      nestModuleRefs.exports = parseArray(content, 'exports');
    }

    files.push({
      fileName,
      key,
      nodeId,
      label,
      type,
      importsRelative,
      constructorDeps,
    });
  }

  return {
    domainName,
    files,
    classToNode,
    keyToNode,
    externalPackages: Array.from(externalPackages).sort(),
    nestModuleRefs,
  };
}

function renderMermaid(domainName, allDomains) {
  const analysis = analyzeDomain(domainName);
  const lines = [
    '%% managed-by: mcp-mermaid-domains',
    `%% domain: ${domainName}`,
    'flowchart LR',
    '',
    '  subgraph project[Aplicacao completa - dominios do monorepo]',
    '    root_repo[(monorepo-ai-llm)]',
  ];

  for (const domain of allDomains) {
    const id = `d_${toId(domain)}`;
    lines.push(`    ${id}[${domain}]`);
    lines.push(`    root_repo --> ${id}`);
  }

  lines.push('  end');
  lines.push(`  style d_${toId(domainName)} fill:#dff6dd,stroke:#2e7d32,stroke-width:2px`);
  lines.push('');
  lines.push(`  subgraph local[Dominio ${domainName} - dependencias internas do modulo]`);

  for (const file of analysis.files) {
    lines.push(`    ${file.nodeId}[${file.label}]`);
  }
  lines.push('  end');
  lines.push('');

  const mainNode = analysis.keyToNode.get('main');
  const appModuleNode = analysis.keyToNode.get('app.module') || analysis.keyToNode.get(`${domainName}.module`);

  if (mainNode && appModuleNode) {
    lines.push(`  ${mainNode} -->|bootstrap| ${appModuleNode}`);
  }

  if (appModuleNode) {
    for (const ref of analysis.nestModuleRefs.imports) {
      const node = analysis.classToNode.get(ref);
      if (node) {
        lines.push(`  ${appModuleNode} -->|imports| ${node}`);
      }
    }
    for (const ref of analysis.nestModuleRefs.controllers) {
      const node = analysis.classToNode.get(ref);
      if (node) {
        lines.push(`  ${appModuleNode} -->|controllers| ${node}`);
      }
    }
    for (const ref of analysis.nestModuleRefs.providers) {
      const node = analysis.classToNode.get(ref);
      if (node) {
        lines.push(`  ${appModuleNode} -->|providers| ${node}`);
      }
    }
    for (const ref of analysis.nestModuleRefs.exports) {
      const node = analysis.classToNode.get(ref);
      if (node) {
        lines.push(`  ${appModuleNode} -->|exports| ${node}`);
      }
    }
  }

  for (const file of analysis.files) {
    for (const dep of file.constructorDeps) {
      const depNode = analysis.classToNode.get(dep);
      if (depNode) {
        lines.push(`  ${file.nodeId} -->|injeta| ${depNode}`);
      }
    }
    for (const dep of file.importsRelative) {
      const depNode = analysis.classToNode.get(dep);
      if (depNode) {
        lines.push(`  ${file.nodeId} -. importa .-> ${depNode}`);
      }
    }
  }

  if (analysis.externalPackages.length > 0) {
    lines.push('');
    lines.push('  subgraph ext[Dependencias externas detectadas no dominio]');
    for (const pkg of analysis.externalPackages) {
      const pkgNode = `p_${toId(domainName)}_${toId(pkg)}`;
      lines.push(`    ${pkgNode}[( ${pkg} )]`);
      if (appModuleNode) {
        lines.push(`    ${appModuleNode} -. usa .-> ${pkgNode}`);
      }
    }
    lines.push('  end');
  }

  lines.push('');
  return lines.join('\n');
}

function ensureMermaidFile(domainName) {
  const appDir = path.join(appsRoot, domainName);
  const srcDir = path.join(appDir, 'src');

  if (!fs.existsSync(appDir) || !fs.existsSync(srcDir)) {
    throw new Error(`Dominio invalido ou sem src: ${domainName}`);
  }

  const outFile = path.join(appDir, 'domain.mmd');
  const content = renderMermaid(domainName, listDomains());
  const existed = fs.existsSync(outFile);

  fs.writeFileSync(outFile, content, 'utf8');

  return {
    domainName,
    outFile,
    action: existed ? 'updated' : 'created',
  };
}

function listDomains() {
  if (!fs.existsSync(appsRoot)) {
    return [];
  }

  return fs
    .readdirSync(appsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function run() {
  const allDomains = listDomains();
  const domains = targetDomain ? [targetDomain] : allDomains;

  if (domains.length === 0) {
    console.log('Nenhum dominio encontrado em apps/.');
    return;
  }

  const results = [];

  for (const domain of domains) {
    const result = ensureMermaidFile(domain);
    results.push(result);
  }

  for (const result of results) {
    console.log(`[${result.action}] ${result.domainName} -> ${path.relative(repoRoot, result.outFile)}`);
  }
}

run();
