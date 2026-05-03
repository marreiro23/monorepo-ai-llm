#!/usr/bin/env node

/**
 * Smoke Test: Permission Validation Gate
 *
 * Valida que o guard de permissões está funcionando corretamente:
 * 1. Endpoints na matriz são permitidos
 * 2. Endpoints fora da matriz são bloqueados (403)
 * 3. Endpoints whitelistados são sempre permitidos
 * 4. Sistema de auditoria registra tentativas
 */

import { execSync } from 'child_process';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

async function makeRequest(endpoint, method = 'GET', expectStatus = 200) {
  const url = `${API_BASE}${endpoint}`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const success = response.status === expectStatus;
    const icon = success ? '✅' : '❌';
    const color = success ? 'green' : 'red';

    log(`${icon} ${method} ${endpoint} → ${response.status} (esperado: ${expectStatus})`, color);

    if (!success) {
      const body = await response.text();
      log(`   Resposta: ${body.substring(0, 200)}`, 'yellow');
    }

    return { success, status: response.status, response };
  } catch (error) {
    log(`❌ ${method} ${endpoint} → ERRO: ${error.message}`, 'red');
    return { success: false, status: 0, error };
  }
}

async function runTests() {
  logSection('🔒 SMOKE TEST: Permission Validation Gate');

  let passed = 0;
  let failed = 0;

  // Teste 1: Endpoints whitelistados devem sempre passar
  logSection('Teste 1: Endpoints Whitelistados (sempre permitidos)');

  const whitelistedTests = [
    { endpoint: '/health', method: 'GET', expect: 200 },
    { endpoint: '/governance', method: 'GET', expect: 200 },
    { endpoint: '/governance/permissions/matrix', method: 'GET', expect: 200 },
    { endpoint: '/governance/permissions/validation', method: 'GET', expect: 200 },
    { endpoint: '/audit', method: 'GET', expect: 200 }
  ];

  for (const test of whitelistedTests) {
    const result = await makeRequest(test.endpoint, test.method, test.expect);
    result.success ? passed++ : failed++;
  }

  // Teste 2: Endpoints na matriz devem passar
  logSection('Teste 2: Endpoints na Matriz de Permissões (permitidos)');

  const matrixTests = [
    { endpoint: '/graph/sites', method: 'GET', expect: 200 },
    { endpoint: '/graph/users', method: 'GET', expect: 200 },
    { endpoint: '/graph/groups', method: 'GET', expect: 200 }
  ];

  for (const test of matrixTests) {
    const result = await makeRequest(test.endpoint, test.method, test.expect);
    result.success ? passed++ : failed++;
  }

  // Teste 3: Endpoints fora da matriz devem ser bloqueados
  logSection('Teste 3: Endpoints Fora da Matriz (bloqueados com 403)');

  const blockedTests = [
    { endpoint: '/api/undefined-endpoint', method: 'GET', expect: 403 },
    { endpoint: '/graph/unknown-resource', method: 'GET', expect: 403 },
    { endpoint: '/sharepoint/invalid-operation', method: 'POST', expect: 403 }
  ];

  for (const test of blockedTests) {
    const result = await makeRequest(test.endpoint, test.method, test.expect);
    result.success ? passed++ : failed++;
  }

  // Teste 4: Validar que auditoria está registrando
  logSection('Teste 4: Sistema de Auditoria');

  const auditResult = await makeRequest('/audit/log?limit=10', 'GET', 200);
  if (auditResult.success) {
    const data = await auditResult.response.json();
    const hasEvents = data.data?.events?.length > 0;

    if (hasEvents) {
      log(`✅ Sistema de auditoria registrou ${data.data.events.length} eventos`, 'green');
      passed++;
    } else {
      log('❌ Sistema de auditoria não registrou eventos', 'red');
      failed++;
    }
  } else {
    failed++;
  }

  // Teste 5: Validar estrutura de erro 403
  logSection('Teste 5: Estrutura de Resposta 403');

  const errorTest = await makeRequest('/api/test-blocked-endpoint', 'GET', 403);
  if (errorTest.status === 403) {
    try {
      const errorBody = await errorTest.response.json();
      const hasRequiredFields =
        errorBody.statusCode === 403 &&
        errorBody.message &&
        errorBody.details?.reason &&
        errorBody.details?.documentation;

      if (hasRequiredFields) {
        log('✅ Resposta 403 possui estrutura correta', 'green');
        log(`   Reason: ${errorBody.details.reason}`, 'blue');
        log(`   Documentation: ${errorBody.details.documentation}`, 'blue');
        passed++;
      } else {
        log('❌ Resposta 403 não possui estrutura completa', 'red');
        failed++;
      }
    } catch (e) {
      log('❌ Erro ao parsear resposta 403', 'red');
      failed++;
    }
  } else {
    failed++;
  }

  // Resumo
  logSection('📊 RESUMO DOS TESTES');

  const total = passed + failed;
  const successRate = ((passed / total) * 100).toFixed(1);

  log(`Total de testes: ${total}`, 'blue');
  log(`✅ Passou: ${passed}`, 'green');
  log(`❌ Falhou: ${failed}`, 'red');
  log(`Taxa de sucesso: ${successRate}%`, successRate === '100.0' ? 'green' : 'yellow');

  if (failed === 0) {
    log('\n🎉 Todos os testes passaram! Gate de permissões funcionando corretamente.', 'green');
    return 0;
  } else {
    log('\n⚠️  Alguns testes falharam. Verifique a configuração do guard.', 'red');
    return 1;
  }
}

// Verifica se a API está rodando
async function checkApiHealth() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    if (response.ok) {
      log('✅ API está rodando', 'green');
      return true;
    }
  } catch (error) {
    log('❌ API não está acessível. Inicie a API com: npm run dev', 'red');
    log(`   URL testada: ${API_BASE}`, 'yellow');
    return false;
  }
}

// Execução principal
(async () => {
  log('🚀 Iniciando smoke test do Permission Validation Gate...', 'cyan');
  log(`📍 API Base URL: ${API_BASE}`, 'blue');

  const isHealthy = await checkApiHealth();
  if (!isHealthy) {
    process.exit(1);
  }

  const exitCode = await runTests();
  process.exit(exitCode);
})();

// Made with Bob
